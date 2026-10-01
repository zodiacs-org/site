#!/usr/bin/env python3
"""Recompute published synthetic-only statistics/cost arithmetic without private logs."""
from pathlib import Path
from decimal import Decimal
import collections, hashlib, json, math
root=Path(__file__).resolve().parent
load=lambda name:json.loads((root/name).read_text())
b=load('vercel-baseline-matched.json');s=load('vercel-baseline-summary.json');q=load('vercel-hot-cost-supplement.json')
assert len(b['samples'])==120 and len({x['requestId'] for x in b['samples']})==120
assert s['matchedArtifactSha256']==hashlib.sha256((root/'vercel-baseline-matched.json').read_bytes()).hexdigest()
assert collections.Counter(x['endpoint'] for x in b['samples'])=={k:20 for k in q['byEndpoint']}
assert q['populationReconciliation']['queryStartTypes']=={'hot':120,'cold':0}
for endpoint,data in q['byEndpoint'].items():
 rows=[x for x in b['samples'] if x['endpoint']==endpoint]
 values=sorted(x['platform']['durationMs'] for x in rows)
 assert all(x['requestId']==x['xVercelId'].rsplit('::',1)[-1] for x in rows)
 assert all(x['platform']['messageEmpty'] and x['platform']['status']==200 for x in rows)
 for field,expected in [('min',min(values)),('max',max(values)),('p50',values[9]),('p95',values[18]),('sum',sum(values)),('mean',sum(values)/20)]:
  assert data['hotExecutionDurationMs'][field]==expected,(endpoint,field)
 inputs=data['aggregateMeasuredInputs'];d=lambda value:Decimal(str(value))
 cost=d(50)*(d(inputs['activeCpu']['approximateMs'])/d(3600000)*d(q['pricing']['activeCpuUsdPerHour'])+d(inputs['memoryDuration']['approximateGbHours'])*d(q['pricing']['provisionedMemoryUsdPerGbHour']))+d(1000)/d(1000000)*d(q['pricing']['invocationsUsdPerMillion'])
 assert abs(cost-d(data['grossComputeAndInvocationEstimateUsdPer1000']['total']))<d('1e-15')
 assert data['coldExecutionDurationMs'] is None and data['coldCount']==0
 print(endpoint, 'n=20 hot', 'p50/p95=',values[9],values[18],'ms', 'approximate gross compute USD/1000=',data['grossComputeAndInvocationEstimateUsdPer1000']['reportValue'])
print('PASS: public synthetic-only statistics and nominal arithmetic; private Query observations require authorized source access.')
