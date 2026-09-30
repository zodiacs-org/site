"""The frame-free check (brief v1, M0 item 3): Horizons's geometric geocentric
ICRF positions (DE441, fetched by fetch_vectors.py) against the DE440s kernel
that the precision pack carries, read with jplephem at the JDTDB Horizons
printed for each row. No precession, nutation, light-time or aberration is
involved on either side, so what differs is the two ephemerides.

  venv/bin/python compare_vectors.py path/to/de440s.bsp > results-2026-09-29.json

results.json is the first run, on the corpus as fetched on 2026-09-23; the
corpus was re-timed on 2026-09-29 (../../corpora/README.md), and
results-2026-09-29.json is this script on the responses fetched that day.

DE440s has no Mars body centre (499), only the Mars system barycentre (4), so
Horizons's 499 is compared with the kernel's 4 and Horizons's own 499 minus 4
is reported beside it.
"""
import hashlib
import json
import math
import os
import sys

import jplephem
import numpy as np
from jplephem.spk import SPK

HERE = os.path.dirname(os.path.abspath(__file__))
MAS = 180 * 3600 * 1000 / math.pi


def rows(name):
    """(JDTDB text, position in km) for each row of one Horizons VECTORS file."""
    block = open(os.path.join(HERE, name)).read().split('$$SOE', 1)[1].split('$$EOE', 1)[0]
    out = []
    for line in block.strip().splitlines():
        cells = [c.strip() for c in line.split(',')]
        out.append((cells[0], np.array([float(cells[2]), float(cells[3]), float(cells[4])])))
    return out


def split_jd(text):
    """A JD as two doubles, the whole day and the fraction, read from its printed digits."""
    whole, _, frac = text.partition('.')
    return float(whole), float('0.' + frac)


def angle_mas(a, b):
    return math.atan2(np.linalg.norm(np.cross(a, b)), float(np.dot(a, b))) * MAS


def main():
    path = sys.argv[1]
    kernel = SPK.open(path)
    geocentre = lambda jd: kernel[0, 3].compute(*jd) + kernel[3, 399].compute(*jd)
    moon = lambda jd: kernel[3, 301].compute(*jd) - kernel[3, 399].compute(*jd)
    mars_bary = lambda jd: kernel[0, 4].compute(*jd) - geocentre(jd)

    cases = json.load(open(os.path.join(HERE, '..', '..', 'corpora', 'horizons-24', 'corpus-tt.json')))['cases']
    horizons = {label: rows(f'{label}.txt') for label in ('Moon', 'Mars', 'MarsBary')}
    assert all(len(r) == len(cases) for r in horizons.values())

    instants = []
    for i, case in enumerate(cases):
        jd_text = horizons['Moon'][i][0]
        assert horizons['Mars'][i][0] == jd_text == horizons['MarsBary'][i][0]
        jd = split_jd(jd_text)
        entry = {'id': case['id'], 'utc': case['utc'], 'jdTdb': jd_text}
        for label, mine in (('Moon', moon), ('Mars', mars_bary), ('MarsBary', mars_bary)):
            theirs = horizons[label][i][1]
            ours = mine(jd)
            entry[label] = {
                'angleMas': round(angle_mas(theirs, ours), 4),
                'displacementM': round(float(np.linalg.norm(theirs - ours)) * 1000, 2),
            }
        entry['horizonsMarsBodyMinusBarycentreM'] = round(
            float(np.linalg.norm(horizons['Mars'][i][1] - horizons['MarsBary'][i][1])) * 1000, 2)
        instants.append(entry)

    def summary(label):
        values = [e[label]['angleMas'] for e in instants]
        worst = max(instants, key=lambda e: e[label]['angleMas'])
        return {'maxAngleMas': max(values), 'maxAt': worst['utc'], 'medianAngleMas': sorted(values)[len(values) // 2]}

    print(json.dumps({
        'what': 'Horizons VECTORS (geometric, geocentric, ICRF, DE441) against the DE440s kernel the precision pack carries, same JDTDB',
        'kernel': {'file': os.path.basename(path), 'sha256': hashlib.sha256(open(path, 'rb').read()).hexdigest()},
        'jplephem': jplephem.__version__,
        'horizonsFiles': {label: hashlib.sha256(open(os.path.join(HERE, f'{label}.txt'), 'rb').read()).hexdigest()
                          for label in ('Moon', 'Mars', 'MarsBary')},
        'summary': {label: summary(label) for label in ('Moon', 'Mars', 'MarsBary')},
        'instants': instants,
    }, indent=1))


if __name__ == '__main__':
    main()
