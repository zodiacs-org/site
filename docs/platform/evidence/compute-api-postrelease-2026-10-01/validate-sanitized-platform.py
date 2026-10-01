#!/usr/bin/env python3
"""Validate the arithmetic/internal consistency of four allowlisted sanitized inputs.

Usage: python3 validate-sanitized-platform.py [DIRECTORY] [--audit-time UTC]
The directory defaults to this script's directory. JSON receipt goes to stdout;
errors go to stderr and return exit status 1. No network or third-party packages.
No file named by input content is opened. Private provenance entries are ignored.
This is a closed-cohort validator, not an independent audit of provider exports.
"""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys
from urllib.parse import parse_qs, urlparse

REQUIRED = (
    'platform-matched-sanitized.json',
    'platform-summary.json',
    'platform-query-sanitized.json',
)
OPTIONAL = 'platform-deployment-binding.json'
ROUTES = ('chart', 'positions', 'houses', 'events', 'time', 'sky-fact')
STARTS = {'hot': 119, 'prewarmed': 1, 'cold': 0}
SCHEMA = 'zodiacs.compute-api.postrelease-platform-verification.v1'
D = Decimal
LIMITS = [
    'Sanitized consistency does not independently reconstruct or prove the raw x-vercel-id-to-requestId join.',
    'Raw export completeness/exclusivity, exact allowlist equality, or a closed live Query population cannot be independently reconstructed from this subset.',
    'Hidden original fields, including internal rewrite fields, are unavailable; exposed function labels do not prove routing or rewrite behavior.',
    'Actual underlying UI/private snapshots, live provider facts, deployment state, pricing verification, and start-label assignments cannot be independently authenticated here.',
    'messageEmpty flags and allMatchedMessagesEmpty are checked only for sanitized self-consistency; the empty raw-message assertion cannot be reconstructed without raw messages.',
    'The 611 ms first-chart response-finished assertion has no underlying detail/timing record in these inputs and is not independently verified.',
    'CPU and memory-duration are rounded group display aggregates. Per-request CPU/memory are null, and raw precision/formatter policy are unavailable.',
    'Cost arithmetic uses the recorded rates and group GB-hours once. It is not invoice allocation or actual billing verification and excludes unmodeled charges, discounts, credits, and tax.',
    'Causal explanations, population/worst-case performance, and cold-start latency/cost cannot be inferred. There are zero Cold samples and one Prewarmed sample.',
    'Only sanitized input byte hashes are recomputed. Private provenance references are not opened, hashed, reproduced, or treated as verified; hashes provide integrity, not authenticity.',
]

class Invalid(Exception):
    pass


def require(condition, message):
    if not condition:
        raise Invalid(message)


def exact_keys(value, keys, where):
    require(isinstance(value, dict), f'{where}: expected object')
    require(set(value) == set(keys), f'{where}: missing or unexpected fields')


def number(value, where, positive=False, integer=False):
    require(type(value) in (int, D), f'{where}: expected JSON number, not boolean/string')
    v = D(value)
    require(v.is_finite(), f'{where}: non-finite number')
    require(v > 0 if positive else v >= 0, f'{where}: invalid negative/zero value')
    if integer:
        require(type(value) is int, f'{where}: expected JSON integer')
    return v


def close(actual, expected, where, abs_tol=D('1e-15')):
    a, e = number(actual, where), D(expected)
    require(abs(a-e) <= max(abs_tol, abs(e)*D('1e-12')),
            f'{where}: expected {e}, found {a}')


def utc(value, where):
    require(isinstance(value, str) and value.endswith('Z'), f'{where}: expected UTC timestamp ending Z')
    try:
        parsed = datetime.fromisoformat(value[:-1] + '+00:00')
    except ValueError:
        raise Invalid(f'{where}: invalid UTC timestamp') from None
    require(parsed.tzinfo == timezone.utc, f'{where}: expected UTC')
    return parsed


def no_duplicates(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'JSON duplicate key encountered')
        result[key] = value
    return result


def reject_constant(_value):
    raise Invalid('JSON non-finite constant encountered')


def read_input(directory, name):
    # The only input opener; name is always one of the four constants above.
    require(name in REQUIRED + (OPTIONAL,), 'Input is not allowlisted')
    path = directory / name
    require(not path.is_symlink(), f'{name}: symbolic links are not accepted')
    try:
        fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
        with os.fdopen(fd, 'rb') as handle:
            require(stat.S_ISREG(os.fstat(handle.fileno()).st_mode), f'{name}: expected regular file')
            raw = handle.read(5_000_001)
    except OSError as error:
        raise Invalid(f'{name}: cannot read required input ({error.strerror})') from None
    require(len(raw) <= 5_000_000, f'{name}: input exceeds safety limit')
    try:
        value = json.loads(raw.decode('utf-8'), parse_float=D,
                           parse_constant=reject_constant, object_pairs_hook=no_duplicates)
    except (UnicodeError, json.JSONDecodeError):
        raise Invalid(f'{name}: invalid UTF-8 JSON') from None
    require(isinstance(value, dict), f'{name}: expected JSON object')
    return value, hashlib.sha256(raw).hexdigest()


def stats(values):
    ordered = sorted(D(v) for v in values)
    n = len(ordered)
    require(n > 0, 'Cannot summarize an empty distribution')
    return {'n': n, 'min': ordered[0], 'p50': ordered[(n*50+99)//100-1],
            'p95': ordered[(n*95+99)//100-1], 'max': ordered[-1],
            'mean': sum(ordered, D(0))/n}


def check_stats(recorded, computed, where):
    exact_keys(recorded, ('n','min','p50','p95','max','mean'), where)
    for key, value in computed.items():
        number(recorded[key], f'{where}.{key}', integer=(key=='n'))
        if key == 'mean':
            close(recorded[key], value, f'{where}.{key}', D('1e-12'))
        else:
            require(recorded[key] == value, f'{where}.{key}: nearest-rank/sample mismatch')


def parse_display(value, kind, where):
    require(isinstance(value, str), f'{where}: expected display string')
    pattern = r'([0-9]+(?:\.[0-9]+)?)(ms|s)' if kind == 'cpu' else r'([0-9]+(?:\.[0-9]+)?) GB-hrs'
    match = re.fullmatch(pattern, value)
    require(match is not None, f'{where}: unrecognized display/unit')
    return D(match.group(1)) * (1000 if kind=='cpu' and match.group(2)=='s' else 1)


def costs(cpu_ms, gb_hours, n, prices):
    cpu = D(cpu_ms)/D(3600000)*prices['activeCpuUsdPerHour']*1000/n
    memory = D(gb_hours)*prices['provisionedMemoryUsdPerGbHour']*1000/n
    invocations = prices['invocationsUsdPerMillion']/1000
    return {'activeCpuUsdPerThousand': cpu, 'memoryUsdPerThousand': memory,
            'invocationsUsdPerThousand': invocations,
            'computeAndInvocationsUsdPerThousand': cpu+memory+invocations}


def check_cost(recorded, computed, where):
    exact_keys(recorded, computed, where)
    for key, value in computed.items():
        close(recorded[key], value, f'{where}.{key}')


def group_index(groups, where):
    require(isinstance(groups, list), f'{where}: expected list')
    result = {}
    fields = ('endpoint','startType','n','activeCpuSumDisplay','activeCpuSumMs',
              'memoryDurationSumDisplay','memoryDurationSumGbHours',
              'executionDurationMs','clientElapsedMs','cost')
    for i, group in enumerate(groups):
        exact_keys(group, fields, f'{where}[{i}]')
        key = (group['endpoint'], group['startType'])
        require(key[0] in ROUTES and key[1] in STARTS, f'{where}[{i}]: invalid route/start type')
        require(key not in result, f'{where}: duplicate route/start-type group')
        result[key] = group
    return result


def validate(directory, audit_time=None):
    documents, hashes, checks = {}, {}, []
    for name in REQUIRED:
        documents[name], hashes[name] = read_input(directory, name)
    if (directory / OPTIONAL).exists() or (directory / OPTIONAL).is_symlink():
        documents[OPTIONAL], hashes[OPTIONAL] = read_input(directory, OPTIONAL)
    matched, summary, query = (documents[name] for name in REQUIRED)
    common = ('schema','deploymentId','sourceSha','projectId','window',
              'exactUniqueRequestMatches','exportCount','queryCountSum',
              'exportRequestIdsExactlyEqualAllowlist','queryStartTypeCounts',
              'provenanceSha256','limitations')
    exact_keys(matched, common + ('samples',), 'matched')
    exact_keys(summary, common + ('matchedArtifactSha256','perRoute','byRouteAndStartType',
               'firstChart','firstChartPlatformResponseFinishedMs','allMatchedMessagesEmpty',
               'instanceCount','peakConcurrencyCounts','recordedPeakMemoryMb',
               'provisionedMemoryMbValues','prices','costFormula','percentileMethod',
               'queryUrls','coldExecutionDurationMs','coldCostPerThousandUsd','cohortTotals'), 'summary')
    exact_keys(query, ('window','queryStartTypeCounts','queryUrls','groups','pricing'), 'query')
    require(matched['schema'] == summary['schema'] == SCHEMA, 'Unsupported schema')
    for key in ('deploymentId','sourceSha','projectId','window'):
        require(matched[key] == summary[key], f'{key}: sanitized metadata mismatch')
    require(re.fullmatch(r'[a-f0-9]{40}', matched['sourceSha']) is not None, 'sourceSha: invalid SHA-1 shape')
    require(isinstance(matched['deploymentId'], str) and matched['deploymentId'].startswith('dpl_'), 'deploymentId: invalid')
    require(isinstance(matched['projectId'], str) and matched['projectId'].startswith('prj_'), 'projectId: invalid')
    exact_keys(matched['window'], ('startUtc','endUtc'), 'window')
    start, end = (utc(matched['window'][key], f'window.{key}') for key in ('startUtc','endUtc'))
    require(start < end, 'window: start must precede end')
    require(query['window'] == matched['window'], 'query.window: mismatch')
    require(summary['matchedArtifactSha256'] == hashes[REQUIRED[0]], 'summary.matchedArtifactSha256: byte hash mismatch')
    checks.append('Sanitized JSON schemas, metadata/window consistency, and matched-artifact SHA-256')

    binding_status = 'not supplied; optional binding checks skipped'
    if OPTIONAL in documents:
        binding = documents[OPTIONAL]
        for source_key, target_key in (('deploymentId','deploymentId'),('projectId','projectId'),('githubCommitSha','sourceSha')):
            require(binding[source_key] == matched[target_key], f'binding.{source_key}: mismatch')
        require(isinstance(binding['regions'], list) and binding['regions'], 'binding.regions: expected nonempty list')
        for doc_name, doc in (('matched',matched),('summary',summary)):
            require(isinstance(doc['provenanceSha256'],dict), f'{doc_name}.provenanceSha256: expected object')
            require(doc['provenanceSha256'].get(OPTIONAL) == hashes[OPTIONAL], f'{doc_name}: sanitized binding byte hash mismatch')
        binding_status = 'supplied; sanitized identifiers, regions, and referenced SHA-256 consistent'
        checks.append('Optional sanitized deployment-binding identifiers and SHA-256; no live deployment recheck')

    samples = matched['samples']
    require(isinstance(samples, list) and len(samples)==120, 'samples: expected exactly 120 rows')
    sample_fields = ('endpoint','round','requestId','deploymentId','sourceSha','region','status','platform','client')
    platform_fields = ('timestampUtc','timestampInMs','executionDurationMs','peakMemoryMb',
        'provisionedMemoryMb','peakConcurrency','instanceLabel','function','messageEmpty',
        'startType','startTypeEvidence','activeCpuMs','provisionedMemoryGbHours')
    client_fields = ('startedAt','endedAt','elapsedMs','headerMs','responseBytes','responseSha256',
        'noStore','openCors','schema','receiptPresent','engine')
    by_route, by_group, ids = defaultdict(list), defaultdict(list), set()
    starts, ends = [], []
    for i, row in enumerate(samples):
        where = f'samples[{i}]'
        exact_keys(row, sample_fields, where)
        p, c = row['platform'], row['client']
        exact_keys(p, platform_fields, where+'.platform')
        exact_keys(c, client_fields, where+'.client')
        require(row['endpoint'] in ROUTES, where+': unexpected endpoint')
        number(row['round'], where+'.round', integer=True)
        require(row['round'] < 20, where+': round outside 0..19')
        rid = row['requestId']
        require(isinstance(rid,str) and re.fullmatch(r'[A-Za-z0-9-]{1,160}',rid) is not None, where+': malformed request ID')
        require(rid not in ids, where+': duplicate request ID')
        ids.add(rid)
        for key in ('deploymentId','sourceSha'):
            require(row[key] == matched[key], where+f'.{key}: mismatch')
        require(type(row['status']) is int and row['status']==200, where+': non-200 status')
        require(isinstance(row['region'], str) and row['region'], where+': missing region')
        if OPTIONAL in documents:
            require(row['region'] in documents[OPTIONAL]['regions'], where+': binding region mismatch')
        require(p['startType'] in STARTS, where+': unknown start type')
        require(isinstance(p['startTypeEvidence'],str) and p['startTypeEvidence'], where+': missing evidence label')
        require(isinstance(p['instanceLabel'],str) and p['instanceLabel'], where+': missing sanitized instance label')
        require(isinstance(p['function'],str) and p['function'].startswith('/'), where+': missing exposed function label')
        for key in ('executionDurationMs','peakMemoryMb','provisionedMemoryMb','peakConcurrency','timestampInMs'):
            number(p[key], where+'.platform.'+key, positive=(key!='executionDurationMs'), integer=(key in ('peakConcurrency','timestampInMs')))
        require(p['peakMemoryMb'] <= p['provisionedMemoryMb'], where+': peak memory exceeds provisioned memory')
        require(type(p['messageEmpty']) is bool, where+': messageEmpty must be boolean')
        require(p['activeCpuMs'] is None and p['provisionedMemoryGbHours'] is None, where+': per-request resource values must remain null')
        ts = utc(p['timestampUtc'], where+'.platform.timestampUtc')
        delta = ts-datetime(1970,1,1,tzinfo=timezone.utc)
        exact_ms = D(delta.days)*86400000+D(delta.seconds)*1000+D(delta.microseconds)/1000
        require(exact_ms == p['timestampInMs'], where+': platform timestamp fields disagree')
        cs, ce = utc(c['startedAt'],where+'.client.startedAt'), utc(c['endedAt'],where+'.client.endedAt')
        require(start <= cs <= ts <= ce <= end, where+': timestamp outside cohort/client bounds')
        starts.append(cs); ends.append(ce)
        for key in ('elapsedMs','headerMs','responseBytes'):
            number(c[key], where+'.client.'+key, positive=True, integer=(key=='responseBytes'))
        require(c['headerMs'] <= c['elapsedMs'], where+': headers later than total elapsed')
        require(isinstance(c['responseSha256'],str) and re.fullmatch(r'[a-f0-9]{64}',c['responseSha256']) is not None, where+': invalid response hash shape')
        for key in ('noStore','openCors','receiptPresent'):
            require(c[key] is True, where+f'.client.{key}: expected true recorded flag')
        require(c['schema']==f"zodiacs.compute-api.{row['endpoint']}.v1", where+': response schema mismatch')
        exact_keys(c['engine'], ('name','version','ephemeris'), where+'.client.engine')
        exact_keys(c['engine']['ephemeris'], ('name','version'), where+'.client.engine.ephemeris')
        for obj in (c['engine'],c['engine']['ephemeris']):
            require(all(isinstance(obj[key],str) and obj[key] for key in ('name','version')), where+': invalid engine metadata')
        by_route[row['endpoint']].append(row)
        by_group[(row['endpoint'],p['startType'])].append(row)
    require(min(starts)==start and max(ends)==end, 'window: does not equal sanitized client envelope')
    require(set(by_route)==set(ROUTES), 'Endpoint set mismatch')
    for route, rows in by_route.items():
        require(len(rows)==20 and sorted(row['round'] for row in rows)==list(range(20)), route+': expected one row for each round 0..19')
    actual_starts = Counter(row['platform']['startType'] for row in samples)
    actual_starts = {key:actual_starts[key] for key in STARTS}
    require(actual_starts==STARTS, 'Expected distinct 119 Hot / 1 Prewarmed / 0 Cold labels')
    for label, doc in (('matched',matched),('summary',summary),('query',query)):
        exact_keys(doc['queryStartTypeCounts'], STARTS, label+'.queryStartTypeCounts')
        for key in STARTS:
            number(doc['queryStartTypeCounts'][key],label+'.queryStartTypeCounts.'+key,integer=True)
        require(doc['queryStartTypeCounts']==actual_starts,label+': recorded start counts mismatch')
    for label,doc in (('matched',matched),('summary',summary)):
        for key in ('exactUniqueRequestMatches','exportCount','queryCountSum'):
            number(doc[key],label+'.'+key,integer=True)
            require(doc[key]==120,label+'.'+key+': inconsistent sanitized claim')
        require(doc['exportRequestIdsExactlyEqualAllowlist'] is True,label+': missing sanitized allowlist claim')
    checks.append('120 unique sanitized IDs; six endpoints × 20 unique rounds; distinct 119 Hot / 1 Prewarmed / 0 Cold; timestamp and row-field consistency')
    checks.append('Sanitized claimed export/join counts agree with rows only; raw joins and exclusivity remain unverified')

    chart = min(by_route['chart'],key=lambda row:utc(row['client']['startedAt'],'chart.startedAt'))
    require(chart['round']==0 and chart['platform']['startType']=='prewarmed', 'First chart must be round 0 and Prewarmed')
    require(summary['firstChart']==chart, 'summary.firstChart: exact sanitized sample mismatch')
    require(query['queryUrls']==summary['queryUrls'], 'queryUrls: summary/query mismatch')
    exact_keys(query['queryUrls'], ('start-query','cpu-query','memory-query','first-chart'),'queryUrls')
    metrics = {'start-query':'serverlessFunctionInvocation.count', 'cpu-query':'serverlessFunctionInvocation.functionCpuTimeMs', 'memory-query':'serverlessFunctionInvocation.functionDurationGbhr'}
    for key, metric in metrics.items():
        url = urlparse(query['queryUrls'][key]); qs=parse_qs(url.query,keep_blank_values=True)
        require(url.scheme=='https' and url.netloc=='vercel.com' and url.path.endswith('/observability/query') and not url.fragment, key+': malformed recorded query URL')
        require(qs=={'metric':[metric], 'by':['requestPath,functionStartType'], 'time':[matched['window']['startUtc']+'/'+matched['window']['endUtc']]}, key+': URL metric/group/window mismatch')
    url = urlparse(query['queryUrls']['first-chart']); qs=parse_qs(url.query,keep_blank_values=True)
    require(url.scheme=='https' and url.netloc=='vercel.com' and url.path.endswith('/logs') and not url.fragment, 'first-chart: malformed recorded URL')
    require(set(qs)=={'startDate','endDate','search','selectedLogId'}, 'first-chart: unexpected URL fields')
    require(qs['search']==['requestId:'+chart['requestId']] and qs['selectedLogId']==[chart['requestId']], 'first-chart: exact request-ID URL mismatch')
    for key in ('startDate','endDate'):
        require(len(qs[key])==1 and re.fullmatch(r'\d+',qs[key][0]), 'first-chart: invalid URL time bound')
    require(int(qs['startDate'][0])*1000 <= chart['platform']['timestampInMs'] <= int(qs['endDate'][0])*1000, 'first-chart: URL time bounds exclude sample')
    number(summary['firstChartPlatformResponseFinishedMs'],'summary.firstChartPlatformResponseFinishedMs')
    checks.append('First-chart ID, full sanitized sample, round/start label, and recorded detail/query URLs agree; response-finished assertion unverified')

    require(query['pricing']==summary['prices'], 'Recorded pricing metadata mismatch')
    prices = summary['prices']
    exact_keys(prices,('sourceUrl','verifiedUtc','sourceLastUpdated','currency','region','plan','mode','activeCpuUsdPerHour','provisionedMemoryUsdPerGbHour','invocationsUsdPerMillion','evidence'),'prices')
    for key in ('activeCpuUsdPerHour','provisionedMemoryUsdPerGbHour','invocationsUsdPerMillion'):
        number(prices[key],'prices.'+key,positive=True)
    require(prices['currency']=='USD','prices.currency: expected USD')
    require({row['region'] for row in samples}=={prices['region']}, 'Recorded price region differs from sample regions')
    require(prices['sourceUrl']=='https://vercel.com/docs/functions/usage-and-pricing','prices: unexpected recorded source URL')
    utc(prices['verifiedUtc'],'prices.verifiedUtc')
    formula = f"1000/N * ((CPU_ms / 3600000)*{prices['activeCpuUsdPerHour']} + memory_GB_hours*{prices['provisionedMemoryUsdPerGbHour']}) + {prices['invocationsUsdPerMillion']/1000}"
    require(summary['costFormula']==formula,'costFormula: differs from independently applied recorded-rate formula')
    require(summary['percentileMethod'].startswith('Nearest rank: sorted[ceil(p*n)-1].'),'percentileMethod: unsupported recorded method')
    groups=group_index(query['groups'],'query.groups')
    summary_groups=group_index(summary['byRouteAndStartType'],'summary.byRouteAndStartType')
    require(set(groups)==set(by_group)==set(summary_groups),'Route/start-type group set mismatch')
    computed_groups=[]
    for key, group in groups.items():
        label='groups.'+'/'.join(key); rows=by_group[key]; n=len(rows)
        require(group==summary_groups[key],label+': summary/query mismatch')
        number(group['n'],label+'.n',positive=True,integer=True)
        require(group['n']==n,label+': count differs from sanitized samples')
        cpu=parse_display(group['activeCpuSumDisplay'],'cpu',label+'.activeCpuSumDisplay')
        memory=parse_display(group['memoryDurationSumDisplay'],'memory',label+'.memoryDurationSumDisplay')
        require(number(group['activeCpuSumMs'],label+'.activeCpuSumMs')==cpu,label+': CPU display conversion mismatch')
        require(number(group['memoryDurationSumGbHours'],label+'.memoryDurationSumGbHours')==memory,label+': memory display conversion mismatch')
        execution=stats([row['platform']['executionDurationMs'] for row in rows])
        client=stats([row['client']['elapsedMs'] for row in rows])
        check_stats(group['executionDurationMs'],execution,label+'.executionDurationMs')
        check_stats(group['clientElapsedMs'],client,label+'.clientElapsedMs')
        cost=costs(cpu,memory,n,prices); check_cost(group['cost'],cost,label+'.cost')
        computed_groups.append({'endpoint':key[0],'startType':key[1],'n':n,'activeCpuSumMs':cpu,'memoryDurationSumGbHours':memory,'cost':cost})
    checks.append('Seven route/start-type group counts, CPU/unit and GB-hour display conversions, nearest-rank execution/client summaries, and recorded-rate costs')
    exact_keys(summary['perRoute'], ROUTES, 'summary.perRoute')
    computed_routes={}
    for route in ROUTES:
        rows=by_route[route]; recorded=summary['perRoute'][route]; label='perRoute.'+route
        exact_keys(recorded,('n','startTypeCounts','executionDurationMs','clientElapsedMs','recordedPeakMemoryMb','activeCpuSumMs','memoryDurationSumGbHours','cost'),label)
        number(recorded['n'],label+'.n',integer=True)
        require(recorded['n']==len(rows),label+': wrong count')
        route_starts=dict(Counter(row['platform']['startType'] for row in rows))
        require(recorded['startTypeCounts']==route_starts,label+': wrong start counts')
        for value in recorded['startTypeCounts'].values():
            number(value,label+'.startTypeCounts',integer=True)
        execution=stats([row['platform']['executionDurationMs'] for row in rows])
        client=stats([row['client']['elapsedMs'] for row in rows])
        check_stats(recorded['executionDurationMs'],execution,label+'.executionDurationMs')
        check_stats(recorded['clientElapsedMs'],client,label+'.clientElapsedMs')
        check_stats(recorded['recordedPeakMemoryMb'],stats([row['platform']['peakMemoryMb'] for row in rows]),label+'.recordedPeakMemoryMb')
        route_groups=[g for g in computed_groups if g['endpoint']==route]
        cpu=sum((g['activeCpuSumMs'] for g in route_groups),D(0))
        memory=sum((g['memoryDurationSumGbHours'] for g in route_groups),D(0))
        close(recorded['activeCpuSumMs'],cpu,label+'.activeCpuSumMs')
        close(recorded['memoryDurationSumGbHours'],memory,label+'.memoryDurationSumGbHours')
        cost=costs(cpu,memory,len(rows),prices); check_cost(recorded['cost'],cost,label+'.cost')
        computed_routes[route]={'n':len(rows),'startTypeCounts':route_starts,'executionDurationMs':execution,'clientElapsedMs':client,'activeCpuSumMs':cpu,'memoryDurationSumGbHours':memory,'cost':cost}
    checks.append('Six route counts, nearest-rank execution/client/peak-memory summaries, independent group sums, and per-1,000 costs')
    total_cpu=sum((g['activeCpuSumMs'] for g in computed_groups),D(0))
    total_memory=sum((g['memoryDurationSumGbHours'] for g in computed_groups),D(0))
    total_cost=costs(total_cpu,total_memory,len(samples),prices)
    cohort=summary['cohortTotals']
    exact_keys(cohort,('n','activeCpuSumMs','memoryDurationSumGbHours','cost','grossComputeAndInvocationsUsdForObservedCohort','mix'),'cohortTotals')
    number(cohort['n'],'cohortTotals.n',integer=True)
    require(cohort['n']==120,'cohortTotals.n: wrong count')
    close(cohort['activeCpuSumMs'],total_cpu,'cohortTotals.activeCpuSumMs')
    close(cohort['memoryDurationSumGbHours'],total_memory,'cohortTotals.memoryDurationSumGbHours')
    check_cost(cohort['cost'],total_cost,'cohortTotals.cost')
    gross=total_cost['computeAndInvocationsUsdPerThousand']*len(samples)/1000
    close(cohort['grossComputeAndInvocationsUsdForObservedCohort'],gross,'cohortTotals.grossComputeAndInvocationsUsdForObservedCohort')
    for key,value in total_cost.items():
        weighted=sum((row['cost'][key]*row['n'] for row in computed_routes.values()),D(0))/len(samples)
        close(weighted,value,'cohort weighted per-route cost.'+key)
    checks.append('Cohort CPU/GB-hour totals, direct and weighted cost arithmetic, and observed-cohort gross estimate')
    check_stats(summary['recordedPeakMemoryMb'],stats([r['platform']['peakMemoryMb'] for r in samples]),'summary.recordedPeakMemoryMb')
    number(summary['instanceCount'],'summary.instanceCount',integer=True)
    require(summary['instanceCount']==len({r['platform']['instanceLabel'] for r in samples}),'summary.instanceCount: sanitized label count mismatch')
    require(summary['peakConcurrencyCounts']==dict(Counter(str(r['platform']['peakConcurrency']) for r in samples)),'summary.peakConcurrencyCounts: mismatch')
    for value in summary['peakConcurrencyCounts'].values():
        number(value,'summary.peakConcurrencyCounts',integer=True)
    require(summary['provisionedMemoryMbValues']==sorted({r['platform']['provisionedMemoryMb'] for r in samples}),'summary.provisionedMemoryMbValues: mismatch')
    require(summary['allMatchedMessagesEmpty'] is True and all(r['platform']['messageEmpty'] is True for r in samples),'Sanitized message-empty flags disagree')
    require(summary['coldExecutionDurationMs'] is None and summary['coldCostPerThousandUsd'] is None,'Cold performance must remain null for zero Cold samples')
    checks.append('Sanitized instance/concurrency/memory metadata, message-empty flag consistency only, and unmeasured Cold metrics retained as null')
    result = {
        'schema':'zodiacs.compute-api.sanitized-independent-validation.v1',
        'status':'PASS_SANITIZED_CONSISTENCY_ONLY',
        'scope':'Independent implementation using only allowlisted sanitized input bytes; no private inputs, original analyzer, raw exports, or live provider access.',
        'inputSha256':hashes,
        'optionalBinding':binding_status,
        'checksPassed':checks,
        'numericPolicy':'Nearest-rank p50/p95 use integer ceiling indices and exact selected sample values. Means allow max(1e-12 absolute, 1e-12 relative); other arithmetic max(1e-15 absolute, 1e-12 relative). Decimal arithmetic is applied to JSON decimal literals and rounded display values.',
        'computed':{'n':len(samples),'uniqueRequestIds':len(ids),'endpointCounts':{r:len(by_route[r]) for r in ROUTES},'distinctStartTypeCounts':actual_starts,
                    'firstChartRequestId':chart['requestId'],'firstChartExecutionDurationMs':chart['platform']['executionDurationMs'],'firstChartClientElapsedMs':chart['client']['elapsedMs'],
                    'recordedRates':{k:prices[k] for k in ('currency','region','activeCpuUsdPerHour','provisionedMemoryUsdPerGbHour','invocationsUsdPerMillion')},
                    'activeCpuSumMs':total_cpu,'memoryDurationSumGbHours':total_memory,'costPerThousand':total_cost,'grossObservedCohortUsd':gross,
                    'cohortExecutionDurationMs':stats([r['platform']['executionDurationMs'] for r in samples]),'cohortClientElapsedMs':stats([r['client']['elapsedMs'] for r in samples]),
                    'groups':computed_groups,'perRoute':computed_routes},
        'notIndependentlyReconstructable':LIMITS,
    }
    if audit_time is not None:
        utc(audit_time,'--audit-time')
        result['validatedAtUtc']=audit_time
        result['auditTimeSource']='Caller-supplied UTC; not file mtimes or host clock'
    return result


def json_default(value):
    if isinstance(value,D):
        return int(value) if value==value.to_integral_value() else float(value)
    raise TypeError('Unserializable validator value')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory',nargs='?',type=Path,default=Path(__file__).resolve().parent)
    parser.add_argument('--audit-time',help='Optional caller-supplied UTC audit timestamp ending Z')
    args=parser.parse_args()
    try:
        result=validate(args.directory,args.audit_time)
    except (Invalid,KeyError,TypeError,ValueError,OverflowError) as error:
        # Do not emit a PASS or a partial receipt when any check is incomplete.
        detail=str(error) if isinstance(error,Invalid) else 'Missing/malformed required field ('+type(error).__name__+')'
        print('FAIL_SANITIZED_VALIDATION: '+detail,file=sys.stderr)
        return 1
    print(json.dumps(result,indent=2,default=json_default,allow_nan=False))
    return 0

if __name__=='__main__':
    sys.exit(main())
