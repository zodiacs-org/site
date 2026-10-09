import base64, hashlib, io, json, os, urllib.parse, urllib.request, zipfile
results = []
repo = 'zodiacs-org/site'
samples = [
    (37934060260, 11620251552, 'b9a560203edfb4b079abb46f519dc08b8e734687', 'd1ae5f95cd1d3f9e717280d72735d98894c2fc5603c28d9121e96652b2d9c102'),
    (37905204312, 11605629697, '1d29cfabcf857357bc8a4fd1da0c5df5c06b61ce', 'b85cbc45c3f02c1fa9ad7b6255dbdf41914013c92e5dc5d80e840e107202aa3a'),
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
    return opener.open(req, timeout=60).read()
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
            for key in ['largest-contentful-paint-element', 'lcp-breakdown-insight', 'lcp-discovery-insight', 'render-blocking-insight', 'render-blocking-resources', 'font-display-insight', 'network-dependency-tree-insight', 'unused-css-rules', 'unused-javascript', 'mainthread-work-breakdown', 'unminified-css', 'unminified-javascript', 'document-latency-insight', 'image-delivery-insight']:
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
                trace_info = {'sha256': hashlib.sha256(trace_bytes).hexdigest(), 'lcpEvents': lcps, 'longTasks': sorted(tasks, key=lambda e: e.get('dur', 0), reverse=True)[:12]}
            reports.append({'file': name, 'sha256': hashlib.sha256(data).hexdigest(), 'lcp': audits['largest-contentful-paint']['numericValue'], 'performance': lhr['categories']['performance']['score'], 'cls': audits['cumulative-layout-shift']['numericValue'], 'tbt': audits['total-blocking-time']['numericValue'], 'environment': lhr.get('environment'), 'selectedAudits': selected, 'network': network, 'trace': trace_info})
        fonts = []
        for name in sorted(n for n in names if 'aries-' in n and '.fonts.' in n and n.endswith('.json')):
            data = z.read(name)
            fonts.append({'file': name, 'sha256': hashlib.sha256(data).hexdigest(), 'receipt': json.loads(data)})
    results.append({'source': source, 'runId': run_id, 'artifactId': artifact_id, 'artifactSha256': digest, 'reports': reports, 'ariesFontReceipts': fonts})

report = {'schema': 'zodiacs.retained-thesis-loading.v2', 'producer': {'source': os.environ['GITHUB_SHA'], 'run': os.environ['GITHUB_RUN_ID']}, 'limitations': ['Read-only retained reports; no browser gate rerun and no causality claim'], 'samples': results}
data = (json.dumps(report, indent=2) + '\n').encode()
path = 'docs/platform/evidence/thesis-poster-loading-20261009/inline-footer-retained-diagnosis.json'
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, 'wb') as out:
    out.write(data)
print('PROGRAMME_FILE ' + json.dumps({'path': path, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'base64': base64.b64encode(data).decode()}, separators=(',', ':')))
