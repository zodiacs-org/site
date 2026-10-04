"""Appended after review, not preregistered: how the end-to-end comparison
depends on the instant Swiss is given. The same dump-end-to-end.mjs lines are
compared with Swiss's swe_houses_ex, ascmc[4] to ascmc[7], under three
readings of the UTC instant:

- shared-ut1: Swiss gets the engine's UT1 Julian day (the preregistered
  reading, as in compare-end-to-end.py);
- utc-as-ut1: Swiss gets the UTC instant's Julian day read as UT1, as the
  rc.9 houses record's compare-end-to-end.py did with swe.julday;
- swiss-utc-to-jd: Swiss gets the UT1 of its own swe.utc_to_jd.

Reported, not judged. Prints statistics only; nothing Swiss computed is kept.

    python3 tools/compare-clock-readings.py "$WORK/end-to-end.jsonl" > results/clock-readings.json
"""
import json, sys
from datetime import datetime
import swisseph as swe

POINTS = ['equatorialAscendant', 'kochCoAscendant', 'munkaseyCoAscendant', 'polarAscendant']
READINGS = ['shared-ut1', 'utc-as-ut1', 'swiss-utc-to-jd']
TOLERANCE = 3.0  # arcseconds, M5's end-to-end rule


def gap(a, b):
    return abs((a - b + 180) % 360 - 180) * 3600


def figure(v):
    return float(f'{v:.4g}')


def julian_days(c):
    t = datetime.fromisoformat(c['utc'].replace('Z', '+00:00'))
    seconds = t.second + t.microsecond / 1e6
    return {
        'shared-ut1': c['jdUt1'],
        'utc-as-ut1': swe.julday(t.year, t.month, t.day, t.hour + t.minute / 60 + seconds / 3600),
        'swiss-utc-to-jd': swe.utc_to_jd(t.year, t.month, t.day, t.hour, t.minute, seconds, swe.GREG_CAL)[1],
    }


stats = {}
for line in open(sys.argv[1]):
    c = json.loads(line)
    year = int(c['utc'][:4])
    if 'refused' in c or not 1850 <= year <= 2049:
        continue
    for reading, jd in julian_days(c).items():
        _, ascmc = swe.houses_ex(jd, c['lat'], c['lon'], b'E')
        s = stats.setdefault((reading, c['set']), {'armc': [], **{name: [] for name in POINTS}})
        s['armc'].append(gap(c['armc'], ascmc[2]))
        for k, name in enumerate(POINTS):
            s[name].append(gap(c['points'][k], ascmc[4 + k]))

out = {'swisseph': swe.version, 'unit': 'arcseconds', 'tolerance': TOLERANCE, 'window': '1850-2049',
       'judged': False, 'readings': {}}
for reading in READINGS:
    for name_set in ('ladder', 'broad'):
        s = stats[(reading, name_set)]
        entry = {'compared': len(s['armc']), 'armcMax': figure(max(s['armc']))}
        for name in POINTS:
            e = s[name]
            entry[name] = {'max': figure(max(e)), 'over': sum(1 for v in e if v > TOLERANCE)}
        out['readings'].setdefault(reading, {})[name_set] = entry
print(json.dumps(out, indent=1))
