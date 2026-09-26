"""Find the Koch case, 1850–2050 on the ladder, where the engine end to end is
furthest from swe_houses_ex, and write Swiss's RAMC and true obliquity there so
worst-koch.mjs can feed them to the engine. Those two inputs are all it keeps.

    python3 tools/worst-koch.py "$WORK/end-to-end.jsonl" "$SWISS_EPHE" > "$WORK/worst-koch-inputs.json"
"""
import json, sys
from datetime import datetime
import swisseph as swe

swe.set_ephe_path(sys.argv[2])
gap = lambda a, b: abs((a - b + 180) % 360 - 180) * 3600
worst = None
for line in open(sys.argv[1]):
    case = json.loads(line)
    t = datetime.fromisoformat(case['utc'].replace('Z', '+00:00'))
    cusps = case['systems']['koch']
    if case['set'] != 'ladder' or not (1850 <= t.year < 2050) or cusps is None:
        continue
    jd = swe.julday(t.year, t.month, t.day, t.hour + t.minute / 60 + (t.second + t.microsecond / 1e6) / 3600)
    swiss, ascmc = swe.houses_ex(jd, case['lat'], case['lon'], b'K')
    difference = max(gap(cusps[i], swiss[i]) for i in range(12))
    if worst is None or difference > worst['endToEndArcsec']:
        worst = {'utc': case['utc'], 'latitude': case['lat'], 'longitude': case['lon'],
                 'endToEndArcsec': round(difference, 3), 'swissRamc': ascmc[2],
                 'swissTrueObliquity': swe.calc_ut(jd, swe.ECL_NUT)[0][0], 'swissCusps': list(swiss)}
print(json.dumps(worst))
