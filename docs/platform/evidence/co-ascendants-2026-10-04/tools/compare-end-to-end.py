"""Compare dump-end-to-end.mjs with Swiss's swe_houses_ex for the same instant
and place: ascmc[4] to ascmc[7], with the engine's UT1 Julian day read as UT1.
Prints statistics and the gate's verdict (../PREREGISTRATION.md). With a second
argument, also writes the worst ladder case from 1850 to 2049, Swiss's inputs
and points included, to that scratch file for worst-case.mjs; it is never
committed.

    python3 tools/compare-end-to-end.py "$WORK/end-to-end.jsonl" "$WORK/worst-case.json" > results/end-to-end.json
"""
import json, math, sys
import swisseph as swe

POINTS = ['equatorialAscendant', 'kochCoAscendant', 'munkaseyCoAscendant', 'polarAscendant']
WINDOWS = {'1850-2049': (1850, 2049), '1800-2199': (1800, 2199)}
TOLERANCE = 3.0  # arcseconds, M5's end-to-end rule


def gap(a, b):
    return abs((a - b + 180) % 360 - 180) * 3600


def figure(v):
    return float(f'{v:.4g}')


errors, inputs, failed, worst = {}, {}, {}, None
for line in open(sys.argv[1]):
    c = json.loads(line)
    year = int(c['utc'][:4])
    windows = [w for w, (a, b) in WINDOWS.items() if a <= year <= b]
    if 'refused' in c:
        for w in windows:
            failed.setdefault(w, {}).setdefault(c['set'], []).append(f"refused: {c['refused']}")
        continue
    cusps, ascmc = swe.houses_ex(c['jdUt1'], c['lat'], c['lon'], b'E')
    eps = swe.calc_ut(c['jdUt1'], swe.ECL_NUT)[0][0]
    swiss = [ascmc[4 + k] for k in range(4)]
    finite = all(math.isfinite(v) for v in c['points'] + swiss)
    d = [gap(c['points'][k], swiss[k]) if finite else math.inf for k in range(4)]
    for w in windows:
        if not finite:
            failed.setdefault(w, {}).setdefault(c['set'], []).append('not finite')
            continue
        by = errors.setdefault(w, {}).setdefault(c['set'], {})
        for k, name in enumerate(POINTS):
            by.setdefault(name, []).append(d[k])
        i = inputs.setdefault(w, {}).setdefault(c['set'], {'armc': 0.0, 'obliquity': 0.0})
        i['armc'] = max(i['armc'], gap(c['armc'], ascmc[2]))
        i['obliquity'] = max(i['obliquity'], abs(c['obliquity'] - eps) * 3600)
    if finite and c['set'] == 'ladder' and 1850 <= year <= 2049 and (worst is None or max(d) > max(worst['endToEnd'])):
        worst = {'utc': c['utc'], 'lat': c['lat'], 'lon': c['lon'], 'endToEnd': d,
                 'swiss': {'armc': ascmc[2], 'obliquity': eps, 'points': swiss}}

out = {'swisseph': swe.version, 'unit': 'arcseconds', 'tolerance': TOLERANCE, 'windows': {}}
for w in WINDOWS:
    for name_set in ('ladder', 'broad'):
        entry = {'failedCases': len(failed.get(w, {}).get(name_set, []))}
        for name in POINTS:
            e = sorted(errors.get(w, {}).get(name_set, {}).get(name, []))
            if not e:
                continue
            entry[name] = {'compared': len(e), 'p50': figure(e[len(e) // 2]), 'p95': figure(e[int(0.95 * (len(e) - 1))]),
                           'max': figure(e[-1]), 'over': sum(1 for v in e if v > TOLERANCE)}
        i = inputs.get(w, {}).get(name_set)
        if i:
            entry['inputs'] = {'armcMax': figure(i['armc']), 'obliquityMax': figure(i['obliquity'])}
        out['windows'].setdefault(w, {})[name_set] = entry

judged = out['windows']['1850-2049']['ladder']
passed = judged['failedCases'] == 0 and all(judged[name]['over'] == 0 for name in POINTS)
out['gate'] = {'set': 'ladder', 'window': '1850-2049', 'verdict': 'pass' if passed else 'fail'}
print(json.dumps(out, indent=1))

if len(sys.argv) > 2 and worst is not None:
    with open(sys.argv[2], 'w') as f:
        json.dump(worst, f)
