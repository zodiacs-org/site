import base64, hashlib, io, json, os, urllib.parse, urllib.request, zipfile
results = []
repo = 'zodiacs-org/site'
samples = [
    (37955948277, 11627987119, '548591b7dcbd66d25af1ff785c5897afaa065b0d', 'f05a12ed0dd38ead4b3e35e3e244f906afdebbd7d0ef7419745e1f2b040c3f54'),
]
class ArchiveRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        next_request = super().redirect_request(req, fp, code, msg, headers, newurl)
        if next_request is not None and urllib.parse.urlsplit(newurl).hostname != 'api.github.com':
            next_request.remove_header('Authorization')
        return next_request
opener = urllib.request.build_opener(ArchiveRedirect())
def api(path):
    req = urllib.request.Request('https://api.github.com/repos/' + repo + path, headers={'Authorization': 'Bearer ' + os.environ['GH_TOKEN'], 'Accept': 'application/vnd.github+json'})
    with opener.open(req, timeout=60) as response:
        data = response.read(200000001)
    assert len(data) <= 200000000, 'Response exceeds read bound'
    return data
for run_id, artifact_id, source, digest in samples:
    run = json.loads(api('/actions/runs/' + str(run_id)))
    assert run['head_sha'] == source
    archive = api('/actions/artifacts/' + str(artifact_id) + '/zip')
    assert hashlib.sha256(archive).hexdigest() == digest
    reports = []
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        names = z.namelist()
        homes = sorted(n for n in names if n.endswith(('/thesis-1.json', '/thesis-2.json', '/thesis-3.json')) and '/lighthouse/' in n)
        assert len(homes) == 3, homes
        for name in homes:
            data = z.read(name)
            lhr = json.loads(data)
            audits = lhr['audits']
            selected = {}
            for key in ['metrics', 'diagnostics', 'bootup-time', 'total-byte-weight', 'largest-contentful-paint-element', 'lcp-breakdown-insight', 'lcp-discovery-insight', 'render-blocking-insight', 'render-blocking-resources', 'font-display-insight', 'network-dependency-tree-insight', 'unused-css-rules', 'unused-javascript', 'mainthread-work-breakdown', 'unminified-css', 'unminified-javascript', 'document-latency-insight', 'image-delivery-insight']:
                if key in audits:
                    selected[key] = audits[key].get('details')
            network = audits.get('network-requests', {}).get('details', {}).get('items', [])
            network = [{k: x.get(k) for k in ['url', 'resourceType', 'startTime', 'endTime', 'networkRequestTime', 'networkEndTime', 'finished', 'priority', 'transferSize', 'resourceSize', 'statusCode', 'mimeType']} for x in network]
            trace_name = name[:-5] + '.trace.json'
            trace_info = None
            if trace_name in names:
                trace_bytes = z.read(trace_name)
                trace = json.loads(trace_bytes)
                events = trace.get('traceEvents', trace) if isinstance(trace, dict) else trace
                lcps = [e for e in events if 'largestContentfulPaint' in e.get('name', '')]
                tasks = [e for e in events if 'RunTask' in e.get('name', '') and e.get('ph') == 'X' and e.get('dur', 0) >= 50000]
                before_lcp = []
                if lcps:
                    last_lcp = lcps[-1]
                    selected_names = {'ParseHTML', 'EvaluateScript', 'FunctionCall', 'UpdateLayoutTree', 'Layout', 'Paint', 'CompositeLayers', 'RunTask'}
                    chosen = [e for e in events if e.get('ph') == 'X' and e.get('pid') == last_lcp.get('pid') and e.get('name') in selected_names and e.get('ts', 0) <= last_lcp['ts']]
                    for event in sorted(chosen, key=lambda e: e.get('dur', 0), reverse=True)[:40]:
                        event_data = event.get('args', {}).get('data', {})
                        before_lcp.append({'name': event['name'], 'durationMs': event.get('dur', 0) / 1000, 'deltaToLcpMs': (event.get('ts', 0) - last_lcp['ts']) / 1000,
                            'data': {k: event_data.get(k) for k in ['url', 'scriptName', 'functionName', 'lineNumber', 'columnNumber', 'nodeId'] if k in event_data}})
                trace_info = {'sha256': hashlib.sha256(trace_bytes).hexdigest(), 'lcpEvents': lcps, 'longTasks': sorted(tasks, key=lambda e: e.get('dur', 0), reverse=True)[:12], 'largestCpuEventsBeforeLcp': before_lcp}
            reports.append({'file': name, 'sha256': hashlib.sha256(data).hexdigest(), 'lcp': audits['largest-contentful-paint']['numericValue'], 'performance': lhr['categories']['performance']['score'], 'cls': audits['cumulative-layout-shift']['numericValue'], 'tbt': audits['total-blocking-time']['numericValue'], 'environment': lhr.get('environment'), 'selectedAudits': selected, 'network': network, 'trace': trace_info})
        fonts = []
        for name in sorted(n for n in names if 'aries-' in n and '.fonts.' in n and n.endswith('.json')):
            data = z.read(name)
            fonts.append({'file': name, 'sha256': hashlib.sha256(data).hexdigest(), 'receipt': json.loads(data)})
    results.append({'source': source, 'runId': run_id, 'artifactId': artifact_id, 'artifactSha256': digest, 'reports': reports, 'ariesFontReceipts': fonts})

report = {'schema': 'zodiacs.retained-thesis-loading.v2', 'producer': {'source': os.environ['GITHUB_SHA'], 'run': os.environ['GITHUB_RUN_ID']}, 'limitations': ['Read-only retained reports; no browser gate rerun and no causality claim'], 'checkedOutSource': 'dadc59afab302a70e7a36b3ee475791aca3696ed', 'checkoutBinding': 'Producer workflow pins the checkout and verifies source bytes before parsing every inline classic script; the producer head differs from checkout head.', 'samples': results}
data = (json.dumps(report, indent=2) + '\n').encode()
path = 'docs/platform/evidence/thesis-poster-loading-20261009/first-paint-retained-diagnosis.json'
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, 'wb') as out:
    out.write(data)
print('PROGRAMME_FILE ' + json.dumps({'path': path, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'base64': base64.b64encode(data).decode()}, separators=(',', ':')))
