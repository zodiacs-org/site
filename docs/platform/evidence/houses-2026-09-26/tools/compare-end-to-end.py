"""Compare dump-end-to-end.mjs's cusps with Swiss's swe_houses_ex from the same
UTC instant (read as UT1 on both sides), for all of 1800–2199 and for
1850–2050 alone, where Swiss's sidereal time is the IAU one (sidereal.py).
Prints statistics only.

    python3 tools/compare-end-to-end.py "$WORK/end-to-end.jsonl" "$SWISS_EPHE" > results/end-to-end.json
"""
import json, sys
from datetime import datetime
import swisseph as swe

swe.set_ephe_path(sys.argv[2])
CODES = {'whole': 'W', 'placidus': 'P', 'porphyry': 'O', 'equal': 'E', 'vehlow': 'V', 'koch': 'K',
         'regiomontanus': 'R', 'campanus': 'C', 'topocentric': 'T', 'alcabitius': 'B',
         'morinus': 'M', 'meridian': 'X'}


def gap(a, b):
    return abs((a - b + 180) % 360 - 180) * 3600


stats = {}
for line in open(sys.argv[1]):
    case = json.loads(line)
    t = datetime.fromisoformat(case['utc'].replace('Z', '+00:00'))
    jd = swe.julday(t.year, t.month, t.day, t.hour + t.minute / 60 + (t.second + t.microsecond / 1e6) / 3600)
    windows = ['1800-2199'] + (['1850-2049'] if 1850 <= t.year < 2050 else [])
    for name, cusps in case['systems'].items():
        if cusps is None:
            continue
        swiss, _ = swe.houses_ex(jd, case['lat'], case['lon'], CODES[name].encode())
        worst = max(gap(cusps[i], swiss[i]) for i in range(12))
        for window in windows:
            stats.setdefault((window, case['set'], name), []).append(worst)
out = {'swisseph': swe.version, 'unit': 'arcseconds, largest of the twelve cusps per case', 'windows': {}}
for (window, name_set, name), e in sorted(stats.items()):
    e.sort()
    out['windows'].setdefault(window, {}).setdefault(name_set, {})[name] = {
        'compared': len(e), 'max': round(e[-1], 3), 'p95': round(e[int(len(e) * 0.95)], 3),
        'p50': round(e[len(e) // 2], 3), 'over3': sum(1 for x in e if x > 3)}
print(json.dumps(out, indent=1))
