#!/usr/bin/env python3
"""Join private platform export to an explicit synthetic allow-list, emit only matched rows."""
from pathlib import Path
import collections
import datetime as dt
import email.utils
import hashlib
import json
import math
import re
import statistics

ROOT = Path(__file__).resolve().parent
EXPORT = ROOT / 'vercel-logs-private.json'
BASELINE = ROOT / 'production-2026-10-01/requests.jsonl'
PLAN = ROOT / 'production-2026-10-01/plan.json'
OUTPUT = ROOT / 'vercel-baseline-matched.json'
SUMMARY = ROOT / 'vercel-baseline-summary.json'
UNITS_EVIDENCE = ROOT / 'vercel-first-chart-detail.txt'
EXPECTED_PROJECT = 'prj_nRTO3q3aNYLfaM3dotAowOc028fO'
EXPECTED_DEPLOYMENT = 'dpl_6uGzGxdgxboMZ5jeFwQMTL24demr'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def iso(ms):
    return dt.datetime.fromtimestamp(ms / 1000, dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')


def stats(values):
    ordered = sorted(values)
    return {
        'n': len(values), 'min': min(values),
        'p50': ordered[math.ceil(len(ordered) * .50) - 1],
        'p95': ordered[math.ceil(len(ordered) * .95) - 1],
        'max': max(values), 'mean': statistics.mean(values), 'sum': sum(values),
    }


export = json.loads(EXPORT.read_text())
# Use the parent's separate sanity-request UI capture only to map export field semantics/units.
# That request is not added to baseline samples or percentiles.
units_text = UNITS_EVIDENCE.read_text()
assert 'Peak Memory: 212 MB' in units_text and '/ 2048 MB' in units_text
assert 'Peak Concurrency' in units_text and 'Execution Duration: 249ms' in units_text
units_request_id = re.search(r'Request ID: ([^\"]+)', units_text).group(1)
units_row = [x for x in export if x['requestId'] == units_request_id]
assert len(units_row) == 1
assert (units_row[0]['maxMemoryUsed'], units_row[0]['memorySize'], units_row[0]['durationMs'], units_row[0]['concurrency']) == (212, 2048, 249, 1)
baseline = [json.loads(line) for line in BASELINE.read_text().splitlines() if line.strip()]
plan = json.loads(PLAN.read_text())
assert len(baseline) == 120
assert len({(x['round'], x['endpoint']) for x in baseline}) == 120
assert dict(collections.Counter(x['endpoint'] for x in baseline)) == {x: 20 for x in plan['endpointCases']}
index = collections.defaultdict(list)
for row in export:
    index[row['requestId']].append(row)

matched = []
instance_labels = {}
joined_ids = set()
for b in baseline:
    xid = b['headers']['x-vercel-id']
    request_id = xid.rsplit('::', 1)[-1]
    candidates = index.get(request_id, [])
    assert len(candidates) == 1, f'Baseline exact join nonunique or absent: {b["endpoint"]} round {b["round"]}: {len(candidates)}'
    p = candidates[0]
    assert request_id not in joined_ids
    joined_ids.add(request_id)
    expected_path = f'zodiacs.org/api/v1/{b["endpoint"]}'
    assert p['requestPath'] == expected_path
    assert p['requestMethod'] == 'POST'
    assert p['responseStatusCode'] == b['status'] == 200
    assert p['deploymentId'] == EXPECTED_DEPLOYMENT == plan['deployment']
    assert p['projectId'] == EXPECTED_PROJECT
    assert p['environment'] == 'production'
    assert p['function'] == '/api/compatibility'
    assert p['host'] == 'zodiacs.org'
    assert p['requestQueryString'] == f'__zodiacs_compute={b["endpoint"]}'
    assert int(request_id.split('-')[-2]) == p['timestampInMs']
    assert isinstance(p['durationMs'], (int,float)) and p['durationMs'] >= 0
    assert isinstance(p['maxMemoryUsed'], (int,float)) and p['maxMemoryUsed'] >= 0
    assert isinstance(p['memorySize'], (int,float)) and p['memorySize'] > 0
    assert isinstance(p['concurrency'], (int,float)) and p['concurrency'] >= 0
    inst = p['instanceId']
    if inst not in instance_labels:
        instance_labels[inst] = f'instance-{len(instance_labels)+1:02d}'
    http_date = email.utils.parsedate_to_datetime(b['httpDate'])
    http_delta = round(http_date.timestamp()*1000) - p['timestampInMs']
    matched.append({
        'endpoint': b['endpoint'], 'round': b['round'],
        'xVercelId': xid, 'requestId': request_id,
        'match': {
            'method': 'exact x-vercel-id final double-colon segment equals export requestId',
            'uniqueExportMatch': True,
            'idTimestampEqualsExportTimestamp': True,
            'validated': ['projectId', 'deploymentId', 'host', 'environment', 'requestPath', 'requestMethod', 'responseStatusCode', 'function', 'internalRewriteParameter'],
        },
        'platform': {
            'timestampInMs': p['timestampInMs'], 'timestampUtc': iso(p['timestampInMs']),
            'durationMs': p['durationMs'], 'maxMemoryUsed': p['maxMemoryUsed'],
            'memorySize': p['memorySize'], 'memoryFieldUnit': 'MB (Vercel UI label); peak/current maximum semantics verified against separate UI evidence',
            'concurrency': p['concurrency'], 'concurrencyMeaning': 'Peak Concurrency (Vercel UI label)', 'instanceLabel': instance_labels[inst],
            'region': p['region'], 'function': p['function'], 'status': p['responseStatusCode'],
            'cache': p['vercelCache'],
            'messageEmpty': p['message'] == '', 'level': p['level'],
            'startType': None, 'activeCpuMs': None, 'billedProvisionedMemoryGbHours': None,
        },
        'client': {
            'recordedAt': b['clientAt'], 'httpDate': b['httpDate'],
            'httpDateMinusPlatformTimestampMs': http_delta,
            'headerMs': b['headerMs'], 'elapsedMs': b['elapsedMs'],
            'decodedResponseBytes': b['bytes'], 'responseSchema': b['schema'], 'responseBodySha256': b['bodySha256'],
            'engine': {k:b['receipt']['engine'][k] for k in ['name','version','ephemeris'] if k in b['receipt']['engine']},
        },
    })

metadata = {
    'schema': 'zodiacs.compute-api.synthetic-platform-join.v1',
    'sourceSha': plan['source'], 'deploymentId': EXPECTED_DEPLOYMENT, 'projectId': EXPECTED_PROJECT,
    'baselineRequestCount': len(baseline), 'exactUniqueMatches': len(matched),
    'provenance': {
        'baseline': {'relativePath': str(BASELINE.relative_to(ROOT)), 'sha256': digest(BASELINE)},
        'plan': {'relativePath': str(PLAN.relative_to(ROOT)), 'sha256': digest(PLAN)},
        'privateExport': {'sha256': digest(EXPORT), 'purpose': 'Original retained privately; all nonbaseline records excluded from this artifact'},
        'metricSemanticsUiEvidence': {'relativePath': UNITS_EVIDENCE.name, 'sha256': digest(UNITS_EVIDENCE), 'use': 'Units and column meanings only; this separate sanity request is excluded from baseline statistics'},
    },
    'sanitization': [
        'Explicit baseline request-ID allow-list; no nonbaseline export rows included',
        'Raw export message, user-agent, query, trace/session IDs, and invocation IDs omitted',
        'Raw instance IDs replaced with per-artifact stable labels',
        'Synthetic response bodies, receipts and input payloads omitted; response hashes and documented case provenance retained',
    ],
    'limitations': [
        'durationMs is Vercel export execution duration, not active CPU or a demonstrated billed duration',
        'No startType or cold-start field exists in supplied export; no cold/warm class inferred',
        'Memory fields use Vercel UI MB labels; GB-hour billing and allocation sharing are not measured',
        'maxMemoryUsed may represent instance peak state and must not be interpreted as isolated per-request allocation',
        'concurrency is UI-labelled Peak Concurrency; it does not reconstruct complete scheduling or establish a start type',
        'HTTP Date has one-second resolution; exact request-ID equality is the join key',
        'All observations cover documented synthetic workloads, not worst-case budgets or population performance',
    ],
}
OUTPUT.write_text(json.dumps({**metadata, 'samples': matched}, indent=2)+'\n')
by_endpoint = {}
for endpoint in plan['endpointCases']:
    sample = [x for x in matched if x['endpoint'] == endpoint]
    by_endpoint[endpoint] = {
        'sampleCount': len(sample),
        'executionDurationMs': stats([x['platform']['durationMs'] for x in sample]),
        'recordedPeakMemoryMb': stats([x['platform']['maxMemoryUsed'] for x in sample]),
        'memorySizeMbValues': sorted({x['platform']['memorySize'] for x in sample}),
        'concurrencyCounts': dict(sorted(collections.Counter(x['platform']['concurrency'] for x in sample).items())),
        'instanceLabels': sorted({x['platform']['instanceLabel'] for x in sample}),
        'clientElapsedMs': stats([x['client']['elapsedMs'] for x in sample]),
        'platformFirstTimestamp': min(x['platform']['timestampUtc'] for x in sample),
        'platformLastTimestamp': max(x['platform']['timestampUtc'] for x in sample),
        'startType': None, 'costPerThousandUsd': None,
    }
for values in by_endpoint.values():
    values['recordedPeakMemoryMb'].pop('sum', None)
summary = {
    **metadata,
    'percentileMethod': 'nearest rank: sorted[ceil(p*n)-1]; n=20, p50=10th, p95=19th observation',
    'platformFirstTimestamp': min(x['platform']['timestampUtc'] for x in matched),
    'platformLastTimestamp': max(x['platform']['timestampUtc'] for x in matched),
    'regions': sorted({x['platform']['region'] for x in matched}),
    'functionPaths': sorted({x['platform']['function'] for x in matched}),
    'instanceCount': len(instance_labels),
    'concurrencyCounts': dict(sorted(collections.Counter(x['platform']['concurrency'] for x in matched).items())),
    'allMatchedMessagesEmpty': all(x['platform']['messageEmpty'] for x in matched),
    'executionDurationMs': stats([x['platform']['durationMs'] for x in matched]),
    'memorySizeMbValues': sorted({x['platform']['memorySize'] for x in matched}),
    'recordedPeakMemoryMb': stats([x['platform']['maxMemoryUsed'] for x in matched]),
    'byEndpoint': by_endpoint,
    'matchedArtifactSha256': digest(OUTPUT),
}
summary['recordedPeakMemoryMb'].pop('sum', None)
SUMMARY.write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:summary[k] for k in ['baselineRequestCount','exactUniqueMatches','platformFirstTimestamp','platformLastTimestamp','regions','instanceCount','concurrencyCounts','allMatchedMessagesEmpty','executionDurationMs','memorySizeMbValues','recordedPeakMemoryMb','byEndpoint']},indent=2))
