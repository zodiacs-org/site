"""Compare dump-end-to-end.mjs with Swiss's swe_houses_ex for the same instant
and place, the instant read as UT1 on both sides: the 'D' cusps, the Vertex and
the equatorial ascendant. Windows 1850-2049, where the two programs' sidereal
times agree (houses-2026-09-26), and 1800-2199. Prints statistics only.

    python3 tools/compare-end-to-end.py "$WORK/end-to-end.jsonl" "$SWISS_EPHE" > results/end-to-end.json
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


out = {'swisseph': swe.version, 'unit': 'arcseconds; for equal-mc the largest of the twelve cusps per case', 'windows': {}}
windows = {'1850-2049': (1850, 2049), '1800-2199': (1800, 2199)}
errors = {}
for line in open(sys.argv[1]):
    c = json.loads(line)
    year = int(c['utc'][:4])
    cusps, ascmc = swe.houses_ex(jd_ut(c['utc']), c['lat'], c['lon'], b'D')
    values = {'equal-mc': max(gap(c['equalMc'][i], cusps[i]) for i in range(12)),
              'vertex': gap(c['vertex'], ascmc[3]), 'eastPoint': gap(c['eastPoint'], ascmc[4])}
    for window, (a, b) in windows.items():
        if a <= year <= b:
            for name, v in values.items():
                errors.setdefault(window, {}).setdefault(c['set'], {}).setdefault(name, []).append(v)
for window, sets in errors.items():
    for name_set, by in sets.items():
        for name, e in by.items():
            e = sorted(e)
            out['windows'].setdefault(window, {}).setdefault(name_set, {})[name] = {
                'compared': len(e), 'max': round(e[-1], 3), 'p95': round(e[int(0.95 * (len(e) - 1))], 3),
                'p50': round(e[len(e) // 2], 3)}
print(json.dumps(out, indent=1))
