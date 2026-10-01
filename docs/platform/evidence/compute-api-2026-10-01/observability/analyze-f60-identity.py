#!/usr/bin/env python3
"""Read-only local diagnostic; never emits raw IP values or unrelated export records."""
from pathlib import Path
import json, hashlib, collections, datetime as dt, subprocess
ROOT=Path(__file__).resolve().parent
SITE=ROOT.parent/'site'
SHA='9cfafa3e742de943062c9174338472781724a4b5'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
probe_path=ROOT/'production-2026-10-01/rate-aligned-requests.jsonl'
export_path=ROOT/'vercel-logs-private.json'
probe=[json.loads(x) for x in probe_path.read_text().splitlines() if x.strip()]
export=json.loads(export_path.read_text())
idx=collections.defaultdict(list)
for r in export:idx[r['requestId']].append(r)
records=[];instances={}
for row in probe:
 rid=row['headers']['x-vercel-id'].rsplit('::',1)[-1];candidate=idx[rid];assert len(candidate)==1
 p=candidate[0]
 assert p['requestPath']=='zodiacs.org/api/v1/'+row['endpoint']
 assert p['requestMethod']=='POST' and p['responseStatusCode']==row['status']==200
 assert p['deploymentId']=='dpl_6uGzGxdgxboMZ5jeFwQMTL24demr'
 assert int(rid.split('-')[-2])==p['timestampInMs']
 if p['instanceId'] not in instances:instances[p['instanceId']]=f'instance-{len(instances)+1:02d}'
 records.append({'index':row['index'],'endpoint':row['endpoint'],'requestId':rid,'timestampInMs':p['timestampInMs'],'status':p['responseStatusCode'],'region':p['region'],'instanceLabel':instances[p['instanceId']],'peakConcurrency':p['concurrency'],'messageEmpty':p['message']==''})
keys=sorted(set().union(*(r.keys() for r in export)))
identity_fields=[k for k in keys if any(s in k.lower() for s in ['clientip','ipaddress','real-ip','forwarded','ratelimit','rate-limit','counting','headers','public_ip'])]
assert not identity_fields
lock=json.loads(subprocess.check_output(['git','show',SHA+':package-lock.json'],cwd=SITE))
pkg=json.loads((SITE/'node_modules/@vercel/firewall/package.json').read_text())
assert pkg['version']==lock['packages']['node_modules/@vercel/firewall']['version']=='1.2.1'
sources={}
for f in ['src/lib/compute-api/handler.ts','src/lib/compute-api/constants.ts','api/_compute/compute.mjs']:
 source=subprocess.check_output(['git','show',SHA+':'+f],cwd=SITE)
 sources[f]={'sourceSha':SHA,'fileSha256':hashlib.sha256(source).hexdigest()}
first=min(x['timestampInMs'] for x in records);last=max(x['timestampInMs'] for x in records)
report={
 'schema':'zodiacs.compute-api.f60-identity-diagnosis.v1',
 'probeCount':len(probe),'exactUniqueExportMatches':len(records),
 'firstPlatformTimestampUtc':dt.datetime.fromtimestamp(first/1000,dt.timezone.utc).isoformat(),
 'lastPlatformTimestampUtc':dt.datetime.fromtimestamp(last/1000,dt.timezone.utc).isoformat(),
 'platformSpanMs':last-first,'statusCounts':dict(collections.Counter(x['status'] for x in records)),
 'functionInstanceCount':len(instances),'functionRegions':sorted({x['region'] for x in records}),
 'observedClientIpFields':identity_fields,'distinctClientIpCount':None,'distinctRateLimitKeyCount':None,'rateLimitDecisionRegionCount':None,
 'countingIdentityConclusion':'Not observable in the supplied export or captured response headers. Unknown, not zero.',
 'sdk':{'package':pkg['name'],'version':pkg['version'],'officialRepository':pkg['repository']['url'],'npmArchive':lock['packages']['node_modules/@vercel/firewall']['resolved'],'installedRateLimitJsSha256':sha(SITE/'node_modules/@vercel/firewall/dist/rate-limit.js'),
 'verifiedSemantics':['Handler passes only headers=req.headers, with no rateLimitKey override','SDK defaults logical key to x-real-ip and throws when it cannot determine that key','SDK adds a deterministic SHA-256 suffix based on logical key, rule ID and configured secret inputs; no timestamp/random/instance ID enters that expression','SDK sends rate-limit ID and derived key headers to a same-host .well-known endpoint; also forwards x-real-ip, x-forwarded-for and original headers under x-rr- names','SDK awaits the GET response: 204 allows, 429 rate-limits, 403 rate-limits with blocked, 404 not-found; handler fails closed on not-found or error'],
 'localSourceLines':{'dist/rate-limit.js':'25-113 (key 51-67, outbound headers 68-86, result 88-113)','handler.ts':'83-93','deployed compute.mjs':'6151-6161'},
 'runtimeSecretsRead':False,'deployedPackageBytesDownloaded':False},
 'sourceProvenance':sources,
 'officialDocs':[
 {'url':'https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk','lastUpdated':'2026-07-23','retrieved':'2026-10-01','finding':'Each distinct key has its own bucket; default key is client IP. Counters are per-region, so one key hitting multiple regions can exceed a single-region threshold in aggregate.'},
 {'url':'https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting','retrieved':'2026-10-01','retrievalLimit':'Search-index page text available; direct open returned internal error. Search text labels last update 2025-09-24.','finding':'Fixed Window supported on Pro; limit is stated for a common source in the selected window. No off-by-one or asynchronous counter tolerance is specified in the inspected text.'}],
 'conclusions':{
 'ipRotation':'Possible because distinct incoming x-real-ip values produce distinct default SDK keys/buckets. Whether rotation occurred is unverified.',
 'counterFailure':'Not proved: the test does not establish one counting identity or the exact rate-limit decision region/window for all 41 requests.',
 'twoInstances':'Two function instances are observed. Instance ID is not part of the SDK key expression, so this alone neither explains nor proves separate counters.',
 'asyncOrOffByOne':'The local SDK awaits its network decision. No inspected official SDK/WAF documentation establishes a sanctioned one-request overrun or SDK fire-and-forget counting. Server internal consistency/rounding cannot be derived from this client code.',
 'fixedWindow':'All application request timestamps are within 5.938 seconds in one UTC minute. The platform export has no bucket reset timestamp or remaining-count field; exact decision-window boundaries are not exported.',
 'globalBudget':'A strict globally aggregated per-address cap is not established by a per-region rate-limit rule.'},
 'minimumAdditionalEvidence':'For these existing probes, obtain only distinct counts of trusted client IP/default key and rate-limit decision region, plus same-key/window counters if available. Do not publish raw IPs, secrets or headers. No further probe or configuration change is authorized by this diagnostic.',
 'inputHashes':{'alignedProbeSha256':sha(probe_path),'privateExportSha256':sha(export_path)},
 'matchedSyntheticProbes':records,
 'baselineArtifactsModified':False,
}
(ROOT/'f60-counting-identity-diagnosis.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ['probeCount','exactUniqueExportMatches','platformSpanMs','statusCounts','functionInstanceCount','distinctClientIpCount','distinctRateLimitKeyCount']},indent=2))
