"""Compare dump-given.mjs's cusps with Swiss's swe_houses_armc on the same RAMC,
latitude and obliquity. Prints statistics only; nothing Swiss computed is kept.

    python3 tools/compare-given.py "$WORK/given.jsonl" > results/given.json
"""
import json, sys
import swisseph as swe

CODES = {'whole': 'W', 'placidus': 'P', 'porphyry': 'O', 'equal': 'E', 'vehlow': 'V', 'koch': 'K',
         'regiomontanus': 'R', 'campanus': 'C', 'topocentric': 'T', 'alcabitius': 'B',
         'morinus': 'M', 'meridian': 'X'}


def gap(a, b):
    return abs((a - b + 180) % 360 - 180) * 3600


stats = {}
for line in open(sys.argv[1]):
    case = json.loads(line)
    for name, cusps in case['systems'].items():
        s = stats.setdefault((case['set'], name), {'errors': [], 'bothUndefined': 0,
                                                    'onlyEngineUndefined': 0, 'onlySwissUndefined': 0})
        try:
            swiss, _ = swe.houses_armc(case['ramc'], case['lat'], case['eps'], CODES[name].encode())
        except swe.Error:
            swiss = None
        if cusps is None and swiss is None:
            s['bothUndefined'] += 1
        elif cusps is None:
            s['onlyEngineUndefined'] += 1
        elif swiss is None:
            s['onlySwissUndefined'] += 1
        else:
            s['errors'].append(max(gap(cusps[i], swiss[i]) for i in range(12)))
out = {'swisseph': swe.version, 'unit': 'arcseconds, largest of the twelve cusps per case', 'sets': {}}
for (name_set, name), s in sorted(stats.items()):
    e = sorted(s['errors'])
    out['sets'].setdefault(name_set, {})[name] = {
        'compared': len(e),
        'max': float(f'{e[-1]:.3g}') if e else None,
        'p50': float(f'{e[len(e) // 2]:.3g}') if e else None,
        'bothUndefined': s['bothUndefined'],
        'onlyEngineUndefined': s['onlyEngineUndefined'],
        'onlySwissUndefined': s['onlySwissUndefined'],
    }
print(json.dumps(out, indent=1))
