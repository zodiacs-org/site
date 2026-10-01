#!/usr/bin/env python3
"""Local reconciliation of saved Query DOM evidence; no browser or production requests."""
from pathlib import Path
from decimal import Decimal, getcontext
import collections, datetime as dt, hashlib, json, re, urllib.parse
getcontext().prec=32
ROOT=Path(__file__).resolve().parent
BASE=ROOT/'vercel-baseline-matched.json'
SUMMARY=ROOT/'vercel-baseline-summary.json'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def n(x):return float(x)
def d(x):return Decimal(str(x))
prior_hashes={p.name:digest(p) for p in [BASE,SUMMARY,ROOT/'vercel-baseline-methodology.md',ROOT/'analyze-vercel-baseline.py']}
base=json.loads(BASE.read_text());previous=json.loads(SUMMARY.read_text())
expected_routes={f'/api/v1/{x["endpoint"]}' for x in base['samples']}
window='2026-10-01T06:05:00.000Z/2026-10-01T06:10:00.000Z'
settings={
 'vercel-start-types-query.txt':('serverlessFunctionInvocation.count','requestPath,functionStartType','Count'),
 'vercel-cpu-query.txt':('serverlessFunctionInvocation.functionCpuTimeMs','requestPath','Active CPU Time'),
 'vercel-memory-query.txt':('serverlessFunctionInvocation.functionDurationGbhr','requestPath','Duration (Gb-hrs)'),
}
queries={}
for filename,(metric,by,label) in settings.items():
 p=ROOT/filename;j=json.loads(p.read_text());url=urllib.parse.urlparse(j['url']);qs=urllib.parse.parse_qs(url.query);s=j['snapshot']
 assert url.netloc=='vercel.com' and url.path=='/zodiacsofficial/zodiacs-org/observability/query'
 assert qs=={'metric':[metric],'by':[by],'time':[window]},(filename,qs)
 assert 'generic: '+label in s and 'generic: Sum' in s
 assert 'paragraph: 1 of 1' in s and 'button "Next Page" [disabled]' in s
 assert 'button "Add filter"' in s
 queries[filename]={'url':j['url'],'sha256':digest(p),'snapshot':s,'metric':metric,'groupBy':by.split(','),'aggregation':'Sum','displayLabel':label}
start_rows=re.findall(r'row "(/api/v1/\S+) Copy Filter Exclude (\S+) Copy Filter Exclude (\d+)":',queries['vercel-start-types-query.txt']['snapshot'])
assert len(start_rows)==6 and {x[0] for x in start_rows}==expected_routes
assert all(start=='hot' and count=='20' for _,start,count in start_rows)
cpu_rows=re.findall(r'row "(/api/v1/\S+) Copy Filter Exclude (\d+(?:\.\d+)?)(ms|s)":',queries['vercel-cpu-query.txt']['snapshot'])
mem_rows=re.findall(r'row "(/api/v1/\S+) Copy Filter Exclude (\d+(?:\.\d+)?) GB-hrs":',queries['vercel-memory-query.txt']['snapshot'])
assert len(cpu_rows)==len(mem_rows)==6
assert {x[0] for x in cpu_rows}=={x[0] for x in mem_rows}==expected_routes
cpu={route:{'display':value+unit,'ms':d(value)*(1000 if unit=='s' else 1)} for route,value,unit in cpu_rows}
mem={route:{'display':value+' GB-hrs','gbHours':d(value),'lastDisplayedDecimalQuantum':Decimal(10)**(-len(value.split('.')[1]))} for route,value in mem_rows}
lo=int(dt.datetime.fromisoformat(window.split('/')[0].replace('Z','+00:00')).timestamp()*1000)
hi=int(dt.datetime.fromisoformat(window.split('/')[1].replace('Z','+00:00')).timestamp()*1000)
export=json.loads((ROOT/'vercel-logs-private.json').read_text())
win=[x for x in export if lo<=x['timestampInMs']<hi]
assert len(win)==120
assert {x['requestId'] for x in win}=={x['requestId'] for x in base['samples']}
assert len({x['requestId'] for x in win})==120
assert all(x['environment']=='production' and x['deploymentId']==base['deploymentId'] and x['projectId']==base['projectId'] for x in win)
assert collections.Counter('/api/v1/'+x['endpoint'] for x in base['samples'])=={route:20 for route in expected_routes}
pricing={
 'sourceUrl':'https://vercel.com/docs/functions/usage-and-pricing','sourceTitle':'Fluid compute pricing','retrievedUtc':'2026-10-01T10:37:39Z','sourceLastUpdated':'2026-06-16',
 'currency':'USD','region':'iad1','plan':'Pro','mode':'Fluid',
 'planModeEvidence':['Pro label visible in saved project Query snapshots','Fluid label in vercel-first-chart-detail.txt; parent verified project UI'],
 'activeCpuUsdPerHour':0.128,'provisionedMemoryUsdPerGbHour':0.0106,'invocationsUsdPerMillion':0.60,
 'billingSemantics':'CPU bills actual execution; provisioned memory covers instance work including waits until last in-flight request finishes. Shared-instance memory must not be multiplied by overlapping request count. Invocations are separate; plan credits may offset gross charges.',
 'rateVerification':'Independently re-opened official page and verified iad1 regional row and invocation-price example. Published rates, not an account-specific invoice.'}
(ROOT/'vercel-query-pricing-provenance.json').write_text(json.dumps(pricing,indent=2)+'\n')
CPU_RATE=d(pricing['activeCpuUsdPerHour']);MEM_RATE=d(pricing['provisionedMemoryUsdPerGbHour']);INV_RATE=d(pricing['invocationsUsdPerMillion'])/1000000
rows={}
for endpoint in previous['byEndpoint']:
 route='/api/v1/'+endpoint;count=20;factor=Decimal(1000)/count
 c=cpu[route]['ms'];m=mem[route]['gbHours']
 cpu_cost=c/Decimal(3600000)*CPU_RATE*factor
 mem_cost=m*MEM_RATE*factor
 inv_cost=INV_RATE*1000
 total=cpu_cost+mem_cost+inv_cost
 rows[endpoint]={
  'sampleCount':count,'observedStartType':'hot','hotCount':20,'coldCount':0,
  'hotExecutionDurationMs':previous['byEndpoint'][endpoint]['executionDurationMs'],
  'coldExecutionDurationMs':None,
  'aggregateMeasuredInputs':{
   'activeCpu':{'metric':'serverlessFunctionInvocation.functionCpuTimeMs','label':'Active CPU Time','aggregation':'Sum','display':cpu[route]['display'],'approximateMs':n(c)},
   'memoryDuration':{'metric':'serverlessFunctionInvocation.functionDurationGbhr','label':'Duration (Gb-hrs)','aggregation':'Sum','display':mem[route]['display'],'approximateGbHours':n(m)},
   'invocations':20,
  },
  'normalization':{'requests':1000,'factorFrom20Samples':50,'approximateActiveCpuSeconds':n(c/1000*factor),'approximateMemoryDurationGbHours':n(m*factor)},
  'grossComputeAndInvocationEstimateUsdPer1000':{
   'cpu':n(cpu_cost),'memoryDurationAtProvisionedMemoryRate':n(mem_cost),'invocations':n(inv_cost),'total':n(total),'reportValue':format(total,'.3g'),
   'description':'Approximate gross usage-cost estimate from observed aggregate CPU and memory-duration metrics at published Fluid rates, plus invocations. Not invoice/net bill.',
   'guaranteedRoundingRange':None,

  }
 }
supplement={
 'schema':'zodiacs.compute-api.platform-query-supplement.v1','deploymentId':base['deploymentId'],'sourceSha':base['sourceSha'],'projectId':base['projectId'],
 'supersedes':'Earlier connector/export-only unknown start types and aggregate CPU/memory availability. The historical raw/evidence files and their null per-request metric fields remain unchanged.',
 'queryScope':{'projectPath':'/zodiacsofficial/zodiacs-org','utcWindow':window,'additionalFilters':None,'note':'Queries are project-scoped, with no explicit deployment/environment filter. Independent exact export reconciliation establishes the 120 records in this window are the same production deployment baseline.'},
 'populationReconciliation':{'baselineCount':120,'privateExportWindowCount':120,'privateExportWindowIdsExactlyEqualBaselineIds':True,'queryCountSum':120,'routes':6,'perRouteCount':20,'queryTablePageCount':1,'queryStartTypes':{'hot':120,'cold':0},'classificationMethod':'Closed-population route/window reconciliation with Count Sum grouped by Request Path and Function Start Type; not guessed from request order/instance reuse'},
 'pricing':pricing,
 'costFormula':'(1000/N) * [(CPU_sum_ms/3600000)*0.128 + (Duration_GBhrs_sum)*0.0106] + 1000*(0.60/1000000), with N=20 for each endpoint',
 'memoryAccounting':'Use the measured Query GB-hour total once; do not multiply by memory size again. Exact baseline records report Peak Concurrency 1; no overlapping-request memory double-counting is introduced by this calculation.',
 'precisionLimits':['CPU and GB-hour sums are saved UI strings; raw Query export did not complete','The exact UI rounding/formatting policy is not verified, so guaranteed numerical rounding intervals cannot be established','Three-significant-digit reporting is approximate; additional digits in JSON preserve arithmetic reproducibility, not measurement precision','Per-request active CPU remains unavailable; do not spread aggregate CPU uniformly across requests and call it measured'],
 'firewallAccounting':'Firewall costs are excluded; two events SDK checks are not assumed to mean two billable units without separate usage evidence.',
 'excludedCosts':['CDN requests/routing','Fast Data Transfer','Fast Origin Transfer','Firewall/rate limiting','Observability','Pro base subscription','Taxes','Credits or account-specific discounts'],
 'remainingGaps':['No cold requests in the reconciled window; cold p50/p95 and cold cost remain unmeasured','This is observed synthetic-workload usage pricing, not actual invoice allocation or worst-case cost'],
 'byEndpoint':rows,
 'evidence':{filename:{k:v for k,v in q.items() if k!='snapshot'} for filename,q in queries.items()},
 'historicalBaselineArtifacts':prior_hashes,
 'privateExportSha256':digest(ROOT/'vercel-logs-private.json'),
 'privacy':'Only six synthetic-baseline aggregate rows and existing sanitized baseline statistics are included; no nonbaseline traffic or raw IPs are published.'
}
(ROOT/'vercel-hot-cost-supplement.json').write_text(json.dumps(supplement,indent=2)+'\n')
assert prior_hashes=={filename:digest(ROOT/filename) for filename in prior_hashes}
print('All120 exact-window reconciliation and unchanged historical-artifact checks passed')
for name,r in rows.items():
 c=r['grossComputeAndInvocationEstimateUsdPer1000'];print(name,c['reportValue'],c['total'])
