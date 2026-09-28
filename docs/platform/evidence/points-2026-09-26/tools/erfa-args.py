"""Set the engine's lunar mean arguments beside ERFA's iauFal03, iauFaf03 and
iauFaom03 (IERS Conventions 2003, from Simon et al. 1994). This checks that the
engine's coefficients are the published ones.

    python3 tools/erfa-args.py "$WORK/args.jsonl" > results/erfa-args.json
"""
import json, math, sys
import erfa


def gap(a, b):
    return abs((a - b + 180) % 360 - 180) * 3600


worst = {'l': 0.0, 'F': 0.0, 'node': 0.0}
count = 0
for line in open(sys.argv[1]):
    r = json.loads(line)
    t = r['t']
    count += 1
    worst['l'] = max(worst['l'], gap(r['l'], math.degrees(erfa.fal03(t))))
    worst['F'] = max(worst['F'], gap(r['F'], math.degrees(erfa.faf03(t))))
    worst['node'] = max(worst['node'], gap(r['node'], math.degrees(erfa.faom03(t))))
print(json.dumps({'pyerfa': erfa.__version__, 'instants': count, 'span': 'TT centuries -2 to +2',
                  'unit': 'arcseconds, largest difference',
                  'largest': {k: float(f'{v:.3g}') for k, v in worst.items()}}, indent=1))
