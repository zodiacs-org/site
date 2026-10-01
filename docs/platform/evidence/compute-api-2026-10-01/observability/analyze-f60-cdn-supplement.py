#!/usr/bin/env python3
"""Read existing redacted UI evidence and source; emit no IP/header/secret values."""
from pathlib import Path
import json, hashlib, subprocess, re
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parent
SITE = ROOT.parent / 'site'
SHA = '9cfafa3e742de943062c9174338472781724a4b5'
DEPLOYMENT = 'dpl_6uGzGxdgxboMZ5jeFwQMTL24demr'
START, END = 1790835840000, 1790835900000
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def git(path): return subprocess.check_output(['git', 'show', SHA + ':' + path], cwd=SITE)

preserved = [ROOT / x for x in ['f60-counting-identity-diagnosis.json', 'f60-counting-identity-diagnosis.md', 'vercel-baseline-matched.json', 'vercel-baseline-summary.json', 'vercel-baseline-methodology.md']]
before = {p.name: digest(p) for p in preserved}
old = json.loads((ROOT / 'f60-counting-identity-diagnosis.json').read_text())
ids = {r['requestId'] for r in old['matchedSyntheticProbes']}
export = json.loads((ROOT / 'vercel-logs-private.json').read_text())
window = [r for r in export if START <= r['timestampInMs'] < END]
assert len(window) == len(ids) == 41
assert {r['requestId'] for r in window} == ids
assert all(r['requestPath'] == 'zodiacs.org/api/v1/time' and r['deploymentId'] == DEPLOYMENT and r['responseStatusCode'] == 200 for r in window)
inputs = {}
for filename, dims in [
    ('vercel-general-test-ip-count.txt', 'clientIp,requestPath'),
    ('vercel-general-test-ip-deployment-count.txt', 'clientIp,requestPath,deploymentId,httpStatus')]:
    path = ROOT / filename
    data = json.loads(path.read_text()); query = parse_qs(urlparse(data['url']).query)
    assert query['by'] == [dims]
    assert query['range'] == ['1790835840-1790835900']
    assert query['time'] == ['2026-10-01T06:24:00.000Z/2026-10-01T06:25:00.000Z']
    assert query['search'] == ['/api/v1/time']
    rows = re.findall(r'^\s+- row "(\[source-IP-1\].+)":$', data['snapshot'], flags=re.M)
    assert len(rows) == 1 and rows[0].endswith(' 41')
    assert '/api/v1/time Copy Filter Exclude' in rows[0]
    assert 'generic: Requests' in data['snapshot'] and 'generic: Count' in data['snapshot'] and 'generic: Sum' in data['snapshot']
    if 'deploymentId' in dims:
        assert DEPLOYMENT in rows[0] and ' 200 Copy Filter Exclude 41' in rows[0]
    inputs[filename] = {'sha256': digest(path), 'url': data['url'], 'displayedDataRows': 1, 'redaction': data['redaction']}
path = ROOT / 'vercel-general-limiter-no-decisions.txt'
rule = json.loads(path.read_text()); query = parse_qs(urlparse(rule['url']).query)
assert query['range'] == ['1790835840-1790835900']
assert query['filter'] == ['rule_zodiacs_compute_api_kEzTOq']
assert 'paragraph: No Data' in rule['snapshot'] and 'Allowed -' in rule['snapshot']
inputs[path.name] = {'sha256': digest(path), 'url': rule['url'], 'observation': 'No Data; action counters display dashes, not numeric zero'}
path = ROOT / 'vercel-general-limiter-sdk-decisions.txt'
sdk_query = json.loads(path.read_text()); query = parse_qs(urlparse(sdk_query['url']).query)
sdk_path = '/.well-known/vercel/rate-limit-api/zodiacs-compute-api'
assert query['range'] == ['1790835840-1790835900']
assert query['time'] == ['2026-10-01T06:24:00.000Z/2026-10-01T06:25:00.000Z']
assert query['by'] == ['requestPath,deploymentId,httpStatus,edgeNetworkRegion,wafAction,wafRuleId']
assert query['search'] == [sdk_path]
sdk_rows = re.findall(r'^\s+- row "(/\.well-known/.+)":$', sdk_query['snapshot'], flags=re.M)
assert sdk_rows == [f'{sdk_path} Copy Filter Exclude {DEPLOYMENT} Copy Filter Exclude 204 Copy Filter Exclude iad1 Copy Filter Exclude allow Copy Filter Exclude not set Copy Filter Exclude 41']
assert 'generic: Requests' in sdk_query['snapshot'] and 'generic: Count' in sdk_query['snapshot'] and 'generic: Sum' in sdk_query['snapshot']
inputs[path.name] = {'sha256': digest(path), 'url': sdk_query['url'], 'displayedDataRows': 1, 'observation': '41 SDK-path requests; 204; iad1; allow; WAF Rule ID not set'}
path = ROOT / 'vercel-compute-rule.txt'
rule_text = path.read_text()
for marker in ['textbox "Rate limit ID": zodiacs-compute-api', 'searchbox "rule type @vercel/firewall": "@vercel/firewall"', 'button "Rate limit algorithm Fixed Window"', 'textbox "request rate limit": "40"', '"1 Keys: IP Address"', 'Too Many Requests (429)', 'seconds (min: 10, max: 600)"\': "60"']:
    assert marker in rule_text, marker
inputs[path.name] = {'sha256': digest(path), 'observation': 'Matching SDK ID condition; Fixed Window; 60 seconds; 40 requests; IP Address key; 429 action. Active/no-bypass verification supplied separately by parent.'}
sources = {}
for path in ['api/compatibility.ts', 'api/_compute/handler.ts', 'api/_compute/compute.mjs', 'src/lib/compute-api/handler.ts', 'src/lib/compute-api/constants.ts', 'vercel.json']:
    value = git(path)
    sources[path] = {'sourceSha': SHA, 'sha256': hashlib.sha256(value).hexdigest()}
entry = git('api/_compute/handler.ts').decode(); bundle = git('api/_compute/compute.mjs').decode()
assert 'createComputeApiHandler({ localTime })' in entry
assert 'const rateLimit = options.rateLimit ?? firewallVerdict;' in bundle
assert 'const verdict = await rateLimit(req, endpoint);' in bundle
assert 'const result = await checkRateLimit(id, { headers: req.headers });' in bundle
replay = json.loads((ROOT / 'f60-sdk-local-replay.json').read_text())
assert replay['productionBundleSha256'] == sources['api/_compute/compute.mjs']['sha256']
assert replay['networkCalls'] == 0 and replay['realEnvironmentRead'] is False
report = {
    'schema': 'zodiacs.compute-api.f60-cdn-identity-supplement.v1',
    'scope': 'Supplement only; earlier export-level unknowns remain historical evidence. No unrelated export rows or raw IP/header/secret values included.',
    'windowUtc': {'startInclusive': '2026-10-01T06:24:00Z', 'endExclusive': '2026-10-01T06:25:00Z'},
    'cdnQueryObservation': {'metric': 'Requests Count', 'aggregation': 'Sum', 'distinctDisplayedIpCount': 1, 'requestPath': '/api/v1/time', 'deploymentId': DEPLOYMENT, 'httpStatus': 200, 'count': 41, 'additionalDisplayedRows': 0, 'inputIsParentRedacted': True},
    'populationReconciliation': {'exactRequestIdSetEqualityOfPrivateExportWindowAndProbe': True, 'exportWindowRequests': 41, 'probeRequests': 41, 'matchingCdnAggregateCount': 41, 'perRequestCdnIpJoinAvailable': False, 'method': 'Request-ID equality validates export/probe population; CDN aggregate reconciles by exact window/path/deployment/status/count. CDN snapshot contains no per-request IDs.'},
    'sdkIncomingDistinctIpCount': None, 'effectiveSdkDerivedKeyCount': None, 'sdkDecisionRegionCount': None,
    'sdkPathCdnObservation': {'requestPath': sdk_path, 'deploymentId': DEPLOYMENT, 'count': 41, 'httpStatus': 204, 'cdnRegions': ['iad1'], 'distinctCdnRegionCount': 1, 'wafAction': 'allow', 'wafRuleIdDisplay': 'not set', 'individualSubrequestToApplicationRequestJoinAvailable': False, 'limit': 'CDN region is observed for the SDK path. Internal counter-shard/decision-region and per-key/window values are not exposed. Aggregate correspondence has no per-request trace join.'},
    'ruleConfigurationSnapshot': {'sdkCondition': '@vercel/firewall', 'rateLimitId': 'zodiacs-compute-api', 'algorithm': 'Fixed Window', 'windowSeconds': 60, 'requestLimit': 40, 'countingKeysDisplay': ['IP Address'], 'actionDisplay': 'Too Many Requests (429)', 'configurationMismatchFound': False},
    'ruleFilteredUi': {'ruleId': 'rule_zodiacs_compute_api_kEzTOq', 'observed': 'No Data', 'numericDecisionCount': None, 'limit': 'No inspected source establishes complete allowed-SDK-call coverage for this rule-filtered view; dashes cannot prove zero SDK calls or failed counter increments.'},
    'productionSourceFindings': [
        'The compute route dispatches before other compatibility routes. api/_compute/handler.ts supplies only localTime, with no injected rateLimit override.',
        'Generated production-source bundle awaits firewallVerdict before body parsing/dispatch. time uses the zodiacs-compute-api rate-limit ID.',
        'NODE_ENV other than production, a missing key/rule, unexpected response or exception fails closed. Under the inspected installed SDK, the production allow branch follows a 204 response.',
        'SDK uses x-real-ip by default; same headers and fixed environment yield a deterministic derived key. Function instance ID is not a key input.',
        'Source imports SDK externally. Production lockfile selects 1.2.1; exact deployed SDK package bytes and runtime secret inputs were not inspected.',
        'vercel.json has no rewrite matching the default SDK .well-known path; the general slash redirect explicitly excludes .well-known.'
    ],
    'localReplay': {'artifact': 'f60-sdk-local-replay.json', 'sha256': digest(ROOT / 'f60-sdk-local-replay.json'), 'syntheticSequentialChecks': 41, 'interceptedFetchCalls': 41, 'distinctDerivedKeys': 1, 'decisionAwaited': True, 'statusVerdicts': replay['statusVerdicts'], 'limit': 'Mocked local behavior only; no live root cause or live 204 observation established.'},
    'updatedConclusions': {
        'rotation': 'No rotation is observed in CDN clientIp: one displayed source covers the matching 41-request aggregate. Along with documented x-real-ip/client-IP semantics, this materially weakens rotating client egress as an explanation. Runtime SDK header/key equality is still not directly captured.',
        'failure': 'The configured 40/60 rule has not been demonstrated to block this 41-success population. Exact cause remains unresolved. One CDN IP alone does not identify every internal SDK counting key/region/window or establish a platform counter defect.',
        'noData': 'Rule-filtered No Data cannot mean no SDK calls here: the unfiltered SDK-path table contains 41 HTTP 204/allow records. WAF Rule ID not set does not by itself establish whether a rate-limit counter matched or incremented.',
        'source': 'No source-level skip, per-instance key ingredient, or unawaited SDK decision was found in the inspected production-source path.',
        'sdkResponse': 'The same-window/deployment SDK-path aggregate directly records 41 HTTP 204/allow responses. This corroborates the production-source allow path. No per-request trace join was provided.',
        'regions': 'All 41 observed SDK-path CDN records are in iad1. This weakens cross-CDN-region splitting as an explanation; internal counter routing is not separately exposed.',
        'configuration': 'The rule snapshot has the exact SDK condition/ID, 40/60 fixed window, IP Address key and 429 action. No obvious condition/ID/threshold mismatch was found. Counter association and window state remain unresolved.'
    },
    'smallestRemainingReadOnlyCheck': {
        'completedCheck': 'Existing SDK-path CDN query now establishes 41 HTTP 204/allow records in iad1, with WAF Rule ID not set.',
        'remainingEvidence': 'For those existing SDK requests: effective key distinct count and counter/rule/window association, including the rule configuration revision active during the probe if available.',
        'purpose': 'Distinguish identity/window/configuration association from a platform counter problem without guessing from UI rule-ID attribution.',
        'ifUnavailable': 'The supplied exports and aggregates do not expose those fields. Record this limit; provider-side existing-request trace/key/window correlation would be needed. No production probe, logging change, rule change or secret read is justified by this supplement.'
    },
    'officialDocs': [
        {'url': 'https://vercel.com/docs/headers/request-headers', 'retrieved': '2026-10-01', 'lastUpdated': '2025-12-13', 'sections': ['x-forwarded-for', 'x-real-ip'], 'finding': 'x-forwarded-for is the client public IP; Vercel ordinarily overwrites it to prevent spoofing. x-real-ip is documented as identical to x-forwarded-for. This is header semantics, not a captured header value for these requests.'},
        {'url': 'https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting-sdk', 'retrieved': '2026-10-01', 'finding': 'Each unique key gets its own bucket; default key client IP; counters per region. No allowed-SDK traffic-log completeness guarantee found.'},
        {'url': 'https://vercel.com/changelog/improved-analytics-experience-now-available-on-the-vercel-firewall', 'published': '2025-11-20', 'retrieved': '2026-10-01', 'finding': 'Traffic supports grouping and allowed/logged/denied/challenged/rate-limited filters. It does not specify a complete SDK decision ledger.'}
    ],
    'retrievalLimits': ['The dedicated Firewall Observability documentation page failed direct retrieval twice; SDK docs and official changelog do not settle allowed SDK decision completeness. Documentation-search connector returned no more specific coverage statement.'],
    'inputs': inputs, 'sourceProvenance': sources,
    'preservedArtifactHashes': before,
    'safety': {'productionRequestsSent': 0, 'configurationChanges': 0, 'runtimeSecretsRead': False, 'rawIpsIncluded': False, 'overviewTotalUsed': False}
}
(ROOT / 'f60-cdn-identity-supplement.json').write_text(json.dumps(report, indent=2) + '\n')
assert before == {p.name: digest(p) for p in preserved}
print(json.dumps({'cdnIpCount': 1, 'cdn200Count': 41, 'exportProbeExactSetMatch': True, 'ruleView': 'No Data', 'earlierArtifactsUnchanged': True}, indent=2))
