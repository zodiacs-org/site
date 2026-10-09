import base64, hashlib, io, json, os, urllib.parse, urllib.request, zipfile
from PIL import Image, ImageChops
samples = [
  (37915273972, 11610541360, '254014f3a72475157c1d27dca0e97d1784ccfc79', '77671b5b0e7990977c052b6c658d8c5428530946157b2cab2ca7a5b805e9c1f5'),
  (37914739783, 11610731356, 'ac09a5fab7e6674039876e15f4db4bc29b09e79f', '4d8fc69453acc8a7480316f831c36ce1ee1f059c794d8bf85fa8a910ca9bbd66'),
]
class ArchiveRedirect(urllib.request.HTTPRedirectHandler):
  def redirect_request(self, req, fp, code, msg, headers, newurl):
    next_request = super().redirect_request(req, fp, code, msg, headers, newurl)
    if next_request is not None and urllib.parse.urlsplit(newurl).hostname != 'api.github.com':
      next_request.remove_header('Authorization')
    return next_request
opener = urllib.request.build_opener(ArchiveRedirect())
def api(path):
  req = urllib.request.Request('https://api.github.com/repos/zodiacs-org/site' + path, headers={'Authorization': 'Bearer ' + os.environ['GH_TOKEN'], 'Accept': 'application/vnd.github+json'})
  return opener.open(req, timeout=60).read()
def emit(path, content):
  print('PROGRAMME_FILE ' + json.dumps({'path':path,'size':len(content),'sha256':hashlib.sha256(content).hexdigest(),'base64':base64.b64encode(content).decode()}, separators=(',', ':')))
summary = []
for run_id, artifact_id, source, digest in samples:
  run = json.loads(api('/actions/runs/' + str(run_id)))
  assert run['head_sha'] == source
  archive = api('/actions/artifacts/' + str(artifact_id) + '/zip')
  assert hashlib.sha256(archive).hexdigest() == digest
  item = {'run':run_id,'source':source,'artifact':artifact_id,'archiveSha256':digest,'images':[]}
  with zipfile.ZipFile(io.BytesIO(archive)) as z:
    for path in sorted(z.namelist()):
      if '/visual/' not in path or 'aries-' not in path or not path.endswith('.actual.png'):
        continue
      actual_bytes = z.read(path)
      stem = path.split('/')[-1].replace('.actual.png','')
      baseline_path = 'tests/visual/baselines/linux/' + stem + '.png'
      req = urllib.request.Request('https://raw.githubusercontent.com/zodiacs-org/site/' + source + '/' + baseline_path)
      expected_bytes = urllib.request.urlopen(req, timeout=30).read()
      actual = Image.open(io.BytesIO(actual_bytes)).convert('RGB')
      expected = Image.open(io.BytesIO(expected_bytes)).convert('RGB')
      assert actual.size == expected.size
      differences = ImageChops.difference(actual, expected)
      bands = []
      for y in range(0,actual.height,100):
        rectangle = (0,y,actual.width,min(actual.height,y+100))
        raw = differences.crop(rectangle).getdata()
        changed = sum(1 for pixel in raw if max(pixel)>25)
        if changed:
          bands.append({'fromY':y,'toY':rectangle[3],'pixelsRgbDifferenceOver25':changed})
      item['images'].append({'stem':stem,'dimensions':actual.size,'actualSha256':hashlib.sha256(actual_bytes).hexdigest(),'baselineSha256':hashlib.sha256(expected_bytes).hexdigest(),'rgbDifferenceBoundingBox':differences.getbbox(),'bands':bands})
      emit(str(run_id)+'-'+stem+'.actual.png',actual_bytes)
      emit(str(run_id)+'-'+stem+'.baseline.png',expected_bytes)
      diff_path = path.replace('.actual.png','.diff.png')
      if diff_path in z.namelist(): emit(str(run_id)+'-'+stem+'.diff.png',z.read(diff_path))
  summary.append(item)
emit('aries-retained-visual-diagnosis.json',(json.dumps({'schema':'zodiacs.aries-retained-visual-diagnosis.v1','producer':{'source':os.environ['GITHUB_SHA'],'run':os.environ['GITHUB_RUN_ID']},'readOnlyRetainedArtifacts':True,'samples':summary},indent=2)+'\n').encode())
