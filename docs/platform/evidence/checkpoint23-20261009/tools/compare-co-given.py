"""Given-input gate A, derived from engine houses-extra compare-swiss.py.
Swiss is an instrument; output contains aggregate residuals only."""
import json, math, sys
import swisseph as swe
names = ['equatorialAscendant', 'kochCoAscendant', 'munkaseyCoAscendant', 'polarAscendant']
errors = {}
for line in open(sys.argv[1]):
    c = json.loads(line)
    _, ascmc = swe.houses_armc(c['ramc'], c['lat'], c['eps'], b'E')
    for i, name in enumerate(names):
        a, b = c['points'][i], ascmc[4+i]
        d = abs((a-b+180) % 360 - 180) * 3600 if math.isfinite(a) and math.isfinite(b) else math.inf
        errors.setdefault(c['set'], {}).setdefault(name, []).append(d)
out = {'swisseph': swe.version, 'unit': 'arcseconds', 'tolerance': 0.01, 'sets': {}}
for group, points in errors.items():
    out['sets'][group] = {}
    for name, values in points.items():
        values.sort()
        out['sets'][group][name] = {'n': len(values), 'median': float(f'{values[len(values)//2]:.3g}'), 'p95': float(f'{values[int(.95*len(values))]:.3g}'), 'max': float(f'{values[-1]:.3g}'), 'over': sum(not x <= .01 for x in values)}
out['verdict'] = 'pass' if all(e['over'] == 0 for points in out['sets'].values() for e in points.values()) else 'fail'
print(json.dumps(out, indent=2))
