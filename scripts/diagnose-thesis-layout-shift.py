import base64, hashlib, io, json, os, urllib.parse, urllib.request, zipfile
results = []
repo = 'zodiacs-org/site'
samples = [(37959585608,11630658336,'6d9f40be5f12b448bcb20b74d667e06baf9bdd66','3a5b53beaa74b6937d4c17eae24dd3c9a12e721fb190e907914059a53f463dc5')]
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
        selected = sorted(n for n in names if n.endswith(('/thesis-1.json','/thesis-2.json','/thesis-3.json')) and 'lighthouse/' in n)
        assert len(selected) == 3
        for name in selected:
            data = z.read(name); lhr = json.loads(data); audits = lhr['audits']
            trace_data = z.read(name[:-5] + '.trace.json')
            trace = json.loads(trace_data)
            events = trace.get('traceEvents', trace) if isinstance(trace, dict) else trace
            shifts = [e for e in events if 'LayoutShift' in e.get('name','')]
            insights = {k:v for k,v in audits.items() if any(t in k for t in ['cls','layout-shift','font-display'])}
            reports.append({'file':name,'sha256':hashlib.sha256(data).hexdigest(),'cls':audits['cumulative-layout-shift']['numericValue'],'insights':insights,'traceSha256':hashlib.sha256(trace_data).hexdigest(),'layoutShifts':shifts})
    results.append({'run':run_id,'source':source,'artifact':artifact_id,'artifactSha256':digest,'reports':reports})
report = {'schema':'zodiacs.retained-layout-shift.v1','producer':{'source':os.environ['GITHUB_SHA'],'run':os.environ['GITHUB_RUN_ID']},'checkedOutSource':'eefaae0e33e744329d850142addc1c53a48469e9','samples':results,'limitations':['Read-only extraction from retained evidence; no browser rerun or gate change.']}
data = (json.dumps(report,indent=2)+'\n').encode()
path = 'docs/platform/evidence/thesis-poster-loading-20261009/layout-shift-diagnosis.json'
os.makedirs(os.path.dirname(path),exist_ok=True)
with open(path,'wb') as out:out.write(data)
print('PROGRAMME_FILE '+json.dumps({'path':path,'size':len(data),'sha256':hashlib.sha256(data).hexdigest(),'base64':base64.b64encode(data).decode()},separators=(',',':')))
