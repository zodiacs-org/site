#!/usr/bin/env python3
"""Fail-closed exact synthetic request join; private inputs, allowlisted outputs."""
from pathlib import Path
import collections, datetime as dt, hashlib, json, math, re, statistics

ROOT = Path(__file__).resolve().parent
DEPLOYMENT = 'dpl_AsJc5MrDgH4PpgoZSGMe7XTZePe4'
SOURCE = 'fd1ce88af66eca158c24a92569a9101281b964f7'
PROJECT = 'prj_nRTO3q3aNYLfaM3dotAowOc028fO'
FIRST = '4qxpn-1790886364519-db3f1d9862d4'
START = '2026-10-01T20:25:57.295Z'
END = '2026-10-01T20:30:24.868Z'
def read(name): return json.loads((ROOT/name).read_text())
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def iso(ms): return dt.datetime.fromtimestamp(ms/1000,dt.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
def ms(s): return int(dt.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()*1000)
def stats(v):
    if not v: return None
    s=sorted(v); return dict(n=len(v),min=min(v),p50=s[math.ceil(.5*len(v))-1],p95=s[math.ceil(.95*len(v))-1],max=max(v),mean=statistics.mean(v))
def write(name,obj): (ROOT/name).write_text(json.dumps(obj,indent=2)+'\n')

plan=read('plan.json')
assert plan['source']==SOURCE and plan['intendedDeployment']==DEPLOYMENT
binding=read('platform-deployment-binding.json')
assert binding['deploymentId']==DEPLOYMENT and binding['githubCommitSha']==SOURCE and binding['projectId']==PROJECT
assert binding['target']=='production' and binding['state']=='READY' and 'zodiacs.org' in binding['aliases'] and binding['regions']==['iad1']
baseline=[json.loads(line) for line in (ROOT/'requests.jsonl').read_text().splitlines() if line.strip()]
export=read('platform-logs-private.json')
assert len(baseline)==120 and len({(b['endpoint'],b['round']) for b in baseline})==120
assert dict(collections.Counter(b['endpoint'] for b in baseline))==dict.fromkeys(plan['endpoints'],20)
index=collections.defaultdict(list)
for p in export: index[p['requestId']].append(p)
ids={b['requestId'].rsplit('::',1)[-1] for b in baseline}
assert len(ids)==120 and len(export)==120 and set(index)==ids
assert all(ms(START)<=p['timestampInMs']<=ms(END) for p in export)

evidence={k:read('platform-'+k+'-private.json') for k in ['start-query','cpu-query','memory-query','first-chart']}
groups={}
for key,metric in [('start-query','count'),('cpu-query','cpu'),('memory-query','memory')]:
    snap=evidence[key]['snapshot']
    assert 'by=requestPath%2CfunctionStartType' in evidence[key]['url']
    assert '20%3A25%3A57.295Z%2F2026-10-01T20%3A30%3A24.868Z' in evidence[key]['url']
    assert '  - paragraph: 1 of 1' in snap and 'button "Next Page" [disabled]' in snap
    expected={'count':'Count Sum','cpu':'Active CPU Time Sum','memory':'Duration (Gb-hrs) Sum'}[metric]
    assert expected in snap
    rows=re.findall(r'      - row "(/api/v1/[^ ]+) Copy Filter Exclude ([^ ]+) Copy Filter Exclude ([^"]+)":',snap)
    assert len(rows)==7
    for route,kind,value in rows:
        g=groups.setdefault((route.rsplit('/',1)[-1],kind),{})
        assert metric not in g
        g[metric+'Display']=value
        g[metric]=int(value) if metric=='count' else (float(value.replace('ms','')) if value.endswith('ms') else float(value[:-1])*1000) if metric=='cpu' else float(value.replace(' GB-hrs',''))
assert sum(g['count'] for g in groups.values())==120
assert groups[('chart','hot')]['count']==19 and groups[('chart','prewarmed')]['count']==1
assert all(groups[(e,'hot')]['count']==20 for e in plan['endpoints'] if e!='chart')
assert all(k in ['hot','prewarmed'] for _,k in groups)
detail=evidence['first-chart']['snapshot']
assert FIRST in detail and 'Start Type: Hot (prewarmed)' in detail
assert 'Execution Duration: 424ms' in detail and 'Peak Memory: 200 MB' in detail
assert '/ 2048 MB' in detail and 'Peak Concurrency' in detail and 'Response finished in 611ms' in detail
assert DEPLOYMENT in detail and 'Runtime: Node.js 22.x' in detail

instances={}; samples=[]
for b in baseline:
    request_id=b['requestId'].rsplit('::',1)[-1]
    assert len(index[request_id])==1
    p=index[request_id][0]
    assert p['deploymentId']==DEPLOYMENT and p['projectId']==PROJECT
    assert p['environment']=='production' and p['host']=='zodiacs.org'
    assert p['requestPath']=='zodiacs.org/api/v1/'+b['endpoint']
    assert p['requestQueryString']=='__zodiacs_compute='+b['endpoint']
    assert p['requestMethod']=='POST' and p['responseStatusCode']==b['status']==200
    assert p['region']=='iad1' and p['function']=='/api/compatibility'
    assert p['timestampInMs']==int(request_id.split('-')[-2])
    assert all(isinstance(p[k],(int,float)) and p[k]>=0 for k in ['durationMs','maxMemoryUsed','memorySize','concurrency'])
    if p['instanceId'] not in instances: instances[p['instanceId']]='instance-%02d'%(len(instances)+1)
    kind='prewarmed' if request_id==FIRST else 'hot'
    samples.append({
      'endpoint':b['endpoint'],'round':b['round'],'requestId':request_id,
      'deploymentId':DEPLOYMENT,'sourceSha':SOURCE,'region':p['region'],'status':p['responseStatusCode'],
      'platform':{'timestampUtc':iso(p['timestampInMs']),'timestampInMs':p['timestampInMs'],'executionDurationMs':p['durationMs'],
        'peakMemoryMb':p['maxMemoryUsed'],'provisionedMemoryMb':p['memorySize'],'peakConcurrency':p['concurrency'],
        'instanceLabel':instances[p['instanceId']],'function':p['function'],'messageEmpty':p['message']=='','startType':kind,
        'startTypeEvidence':'Exact-request detail UI: Hot (prewarmed)' if kind=='prewarmed' else 'Closed-population exact export + route/start-type Count Sum, after exact first-chart prewarmed assignment',
        'activeCpuMs':None,'provisionedMemoryGbHours':None},
      'client':{**{k:b[k] for k in ['startedAt','endedAt','elapsedMs','headerMs','responseBytes','responseSha256','noStore','openCors','schema','receiptPresent']},
        'engine':{'name':b['engine']['name'],'version':b['engine']['version'],
          'ephemeris':{'name':b['engine']['ephemeris']['name'],'version':b['engine']['ephemeris']['version']}}}
    })
assert collections.Counter((s['endpoint'],s['platform']['startType']) for s in samples)=={k:g['count'] for k,g in groups.items()}
assert all(s['platform']['messageEmpty'] for s in samples)

prices={'sourceUrl':'https://vercel.com/docs/functions/usage-and-pricing','verifiedUtc':'2026-10-01T20:40:26Z','sourceLastUpdated':'2026-06-16',
  'currency':'USD','region':'iad1','plan':'Pro','mode':'Fluid','activeCpuUsdPerHour':.128,'provisionedMemoryUsdPerGbHour':.0106,'invocationsUsdPerMillion':.6,
  'evidence':'Official pricing page iad1 row and Pro invocation example; dashboard Pro and exact first-chart Fluid labels'}
def cost(cpu,memory,n):
    return {'activeCpuUsdPerThousand':cpu/3600000*.128*1000/n,'memoryUsdPerThousand':memory*.0106*1000/n,
      'invocationsUsdPerThousand':.0006,'computeAndInvocationsUsdPerThousand':(cpu/3600000*.128+memory*.0106)*1000/n+.0006}
breakdown=[]
for (endpoint,kind),g in groups.items():
    rows=[s for s in samples if s['endpoint']==endpoint and s['platform']['startType']==kind]
    breakdown.append({'endpoint':endpoint,'startType':kind,'n':g['count'],'activeCpuSumDisplay':g['cpuDisplay'],'activeCpuSumMs':g['cpu'],
      'memoryDurationSumDisplay':g['memoryDisplay'],'memoryDurationSumGbHours':g['memory'],'executionDurationMs':stats([s['platform']['executionDurationMs'] for s in rows]),
      'clientElapsedMs':stats([s['client']['elapsedMs'] for s in rows]),'cost':cost(g['cpu'],g['memory'],g['count'])})
by_endpoint={}
for endpoint in plan['endpoints']:
    rows=[s for s in samples if s['endpoint']==endpoint]; gs=[g for (e,k),g in groups.items() if e==endpoint]
    cpu=sum(g['cpu'] for g in gs);memory=sum(g['memory'] for g in gs)
    by_endpoint[endpoint]={'n':len(rows),'startTypeCounts':dict(collections.Counter(s['platform']['startType'] for s in rows)),
      'executionDurationMs':stats([s['platform']['executionDurationMs'] for s in rows]),'clientElapsedMs':stats([s['client']['elapsedMs'] for s in rows]),
      'recordedPeakMemoryMb':stats([s['platform']['peakMemoryMb'] for s in rows]),'activeCpuSumMs':cpu,'memoryDurationSumGbHours':memory,'cost':cost(cpu,memory,len(rows))}
limits=[
 'Exact export joins all 120 synthetic request IDs; Query project window has identical closed population. Query has no extra deployment/environment filter.',
 '119 Hot and 1 Prewarmed are distinct platform labels. Cold count is zero: cold latency/cost acceptance remains unmeasured.',
 'Execution duration is not client round-trip time or Active CPU. The client first-chart delay is not causally explained by these measurements.',
 'CPU and GB-hour totals are rounded UI strings. Numeric Query JSON download did not complete; raw values and formatter policy are unavailable. Arithmetic digits do not imply measurement precision.',
 'Per-request CPU and memory-duration are null; only grouped aggregate measurements are available, including the one-member Prewarmed chart group.',
 'GB-hour sum is used once, without multiplying provisioned memory again or summing peak-memory gauges. Values are usage estimates, not invoice allocation.',
 'Cost excludes network/CDN requests and transfer, WAF, observability, subscription fees, tax, credits and discounts. No WAF charge is inferred from SDK checks.',
 'This deterministic synthetic cohort is small and is neither a population estimate nor a worst-case/load benchmark. The one Prewarmed observation cannot characterize a distribution.',
 'All matched exported message fields are empty. This does not prove no personal information in other logs, traces, host request metadata, storage or module state.'
]
provenance={name:sha(ROOT/name) for name in ['requests.jsonl','plan.json','platform-deployment-binding.json','platform-logs-private.json','platform-start-query-private.json','platform-cpu-query-private.json','platform-memory-query-private.json','platform-first-chart-private.json']}
metadata={'schema':'zodiacs.compute-api.postrelease-platform-verification.v1','deploymentId':DEPLOYMENT,'sourceSha':SOURCE,'projectId':PROJECT,
  'window':{'startUtc':START,'endUtc':END},'exactUniqueRequestMatches':120,'exportCount':120,'queryCountSum':120,
  'exportRequestIdsExactlyEqualAllowlist':True,'queryStartTypeCounts':{'hot':119,'prewarmed':1,'cold':0},'provenanceSha256':provenance,'limitations':limits}
write('platform-matched-sanitized.json',{**metadata,'samples':samples})
summary={**metadata,'matchedArtifactSha256':sha(ROOT/'platform-matched-sanitized.json'),'perRoute':by_endpoint,'byRouteAndStartType':breakdown,
  'firstChart':next(s for s in samples if s['requestId']==FIRST),'firstChartPlatformResponseFinishedMs':611,
  'allMatchedMessagesEmpty':True,'instanceCount':len(instances),'peakConcurrencyCounts':dict(collections.Counter(s['platform']['peakConcurrency'] for s in samples)),
  'recordedPeakMemoryMb':stats([s['platform']['peakMemoryMb'] for s in samples]),'provisionedMemoryMbValues':sorted({s['platform']['provisionedMemoryMb'] for s in samples}),
  'prices':prices,'costFormula':'1000/N * ((CPU_ms / 3600000)*0.128 + memory_GB_hours*0.0106) + 0.0006',
  'percentileMethod':'Nearest rank: sorted[ceil(p*n)-1]. Prewarmed single-sample percentiles are arithmetic only, not acceptance evidence.',
  'queryUrls':{k:v['url'] for k,v in evidence.items()},'coldExecutionDurationMs':None,'coldCostPerThousandUsd':None}
total_cpu=sum(g['cpu'] for g in groups.values());total_memory=sum(g['memory'] for g in groups.values())
summary['cohortTotals']={'n':120,'activeCpuSumMs':total_cpu,'memoryDurationSumGbHours':total_memory,
  'cost':cost(total_cpu,total_memory,120),'grossComputeAndInvocationsUsdForObservedCohort':total_cpu/3600000*.128+total_memory*.0106+120*.6/1000000,
  'mix':'20 samples of each of six routes; 119 Hot and 1 Prewarmed. This sample mix is not a general traffic forecast.'}
write('platform-summary.json',summary)
write('platform-query-sanitized.json',{'window':metadata['window'],'queryStartTypeCounts':metadata['queryStartTypeCounts'],'queryUrls':summary['queryUrls'],'groups':breakdown,'pricing':prices})
print(json.dumps({'matches':120,'startTypes':metadata['queryStartTypeCounts'],'perRoute':by_endpoint,'byRouteAndStartType':breakdown,'allMessagesEmpty':True,'peakMemory':summary['recordedPeakMemoryMb']},indent=2))
