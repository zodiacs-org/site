import hashlib, io, json, os, urllib.request, zipfile
repo = 'zodiacs-org/site'
samples = [
    (37899456005, 11602473837, '32882c0983f80c2346f37411e05fcc2d4a723489', '8facd9242793d16dc168b5421651dfc26458d9d791b482ce44c2db1f957e2995'),
    (37889961823, 11599577208, '3c848416b96925907ca38c419b77185dbe22081d', 'e00fc87f1b93eb0194f25b9653436a382aba6e815a02de3497482a23a0cae926'),
]
def api(path):
    req = urllib.request.Request('https://api.github.com/repos/' + repo + path, headers={'Authorization': 'Bearer ' + os.environ['GH_TOKEN'], 'Accept': 'application/vnd.github+json'})
    return urllib.request.urlopen(req, timeout=60).read()
for run_id, artifact_id, source, digest in samples:
    run = json.loads(api('/actions/runs/' + str(run_id)))
    assert run['head_sha'] == source
    archive = api('/actions/artifacts/' + str(artifact_id) + '/zip')
    assert hashlib.sha256(archive).hexdigest() == digest
    reports = []
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        names = z.namelist()
        homes = sorted(n for n in names if n.endswith(('/home-1.json', '/home-2.json', '/home-3.json')) and '/lighthouse/' in n)
        assert len(homes) == 3, homes
        for name in homes:
            data = z.read(name)
            lhr = json.loads(data)
            audits = lhr['audits']
            selected = {}
            for key in ['largest-contentful-paint-element', 'lcp-breakdown-insight', 'lcp-discovery-insight', 'render-blocking-insight', 'render-blocking-resources', 'font-display-insight', 'network-dependency-tree-insight']:
                if key in audits:
                    selected[key] = audits[key].get('details')
            network = audits.get('network-requests', {}).get('details', {}).get('items', [])
            network = [{k: x.get(k) for k in ['url', 'resourceType', 'startTime', 'endTime', 'transferSize', 'resourceSize', 'statusCode', 'mimeType']} for x in network]
            trace_name = name[:-5] + '.trace.json'
            trace_info = None
            if trace_name in names:
                trace_bytes = z.read(trace_name)
                trace = json.loads(trace_bytes)
                events = trace.get('traceEvents', trace) if isinstance(trace, dict) else trace
                lcps = [e for e in events if 'largestContentfulPaint' in e.get('name', '')]
                tasks = [e for e in events if e.get('name') == 'RunTask' and e.get('ph') == 'X' and e.get('dur', 0) >= 50000]
                trace_info = {'sha256': hashlib.sha256(trace_bytes).hexdigest(), 'lcpEvents': lcps, 'longTasks': sorted(tasks, key=lambda e: e.get('dur', 0), reverse=True)[:12]}
            reports.append({'file': name, 'sha256': hashlib.sha256(data).hexdigest(), 'lcp': audits['largest-contentful-paint']['numericValue'], 'performance': lhr['categories']['performance']['score'], 'cls': audits['cumulative-layout-shift']['numericValue'], 'tbt': audits['total-blocking-time']['numericValue'], 'environment': lhr.get('environment'), 'selectedAudits': selected, 'network': network, 'trace': trace_info})
    print('PROGRAMME_DIAGNOSTIC ' + json.dumps({'source': source, 'runId': run_id, 'artifactId': artifact_id, 'artifactSha256': digest, 'reports': reports}, separators=(',', ':')))
