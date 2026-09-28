"""Compare dump-given.mjs with Swiss's swe_houses_armc on the same RAMC, latitude
and obliquity: the 'D' (equal, from the midheaven) cusps, and the Vertex and
equatorial ascendant Swiss returns beside them. Prints statistics only; nothing
Swiss computed is kept.

    python3 tools/compare-given.py "$WORK/given.jsonl" > results/given.json
"""
import json, sys
import swisseph as swe


def gap(a, b):
    return abs((a - b + 180) % 360 - 180) * 3600


errors = {}
for line in open(sys.argv[1]):
    case = json.loads(line)
    cusps, ascmc = swe.houses_armc(case['ramc'], case['lat'], case['eps'], b'D')
    for name, value in (('equal-mc', max(gap(case['equalMc'][i], cusps[i]) for i in range(12))),
                        ('vertex', gap(case['vertex'], ascmc[3])),
                        ('eastPoint', gap(case['eastPoint'], ascmc[4]))):
        errors.setdefault(case['set'], {}).setdefault(name, []).append(value)
out = {'swisseph': swe.version, 'unit': 'arcseconds; for equal-mc the largest of the twelve cusps per case', 'sets': {}}
for name_set, by in sorted(errors.items()):
    for name, e in sorted(by.items()):
        e = sorted(e)
        out['sets'].setdefault(name_set, {})[name] = {
            'compared': len(e), 'max': float(f'{e[-1]:.3g}'), 'p50': float(f'{e[len(e) // 2]:.3g}')}
print(json.dumps(out, indent=1))
