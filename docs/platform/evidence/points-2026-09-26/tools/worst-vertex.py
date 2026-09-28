"""Find the largest end-to-end Vertex difference from 1850 to 2049 and print
Swiss's own sidereal time, obliquity and latitude there, for worst-vertex.mjs.
Swiss's Vertex is kept in the scratch file only, never in results/.

    python3 tools/worst-vertex.py "$WORK/end-to-end.jsonl" "$SWISS_EPHE" > "$WORK/worst-vertex-inputs.json"
"""
import json, sys
from datetime import datetime
import swisseph as swe

swe.set_ephe_path(sys.argv[2])


def gap(a, b):
    return abs((a - b + 180) % 360 - 180) * 3600


def jd_ut(iso):
    d = datetime.fromisoformat(iso.replace('Z', '+00:00'))
    return swe.julday(d.year, d.month, d.day, d.hour + d.minute / 60 + (d.second + d.microsecond / 1e6) / 3600)


worst = None
for line in open(sys.argv[1]):
    c = json.loads(line)
    if not 1850 <= int(c['utc'][:4]) <= 2049:
        continue
    jd = jd_ut(c['utc'])
    _, ascmc = swe.houses_ex(jd, c['lat'], c['lon'], b'D')
    e = gap(c['vertex'], ascmc[3])
    if worst is None or e > worst['endToEndArcsec']:
        eps = swe.calc_ut(jd, swe.ECL_NUT)[0][0]
        worst = {'utc': c['utc'], 'latitude': c['lat'], 'longitude': c['lon'], 'endToEndArcsec': round(e, 3),
                 'swiss': {'armc': ascmc[2], 'obliquity': eps, 'vertex': ascmc[3]}}
print(json.dumps(worst))
