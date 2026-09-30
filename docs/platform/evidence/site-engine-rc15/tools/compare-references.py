"""How far each value of the independent references moved when they were rebuilt
on engine rc.15's clock: the base commit's fixtures against this checkout's.

    python3 docs/platform/evidence/site-engine-rc15/tools/compare-references.py <base commit> > reference-moves.json

For each fixture and each field (array indices folded), the number of values
that moved and the largest move, in arcseconds for angles and longitudes
(speeds in arcseconds per day), in milliseconds for instants and
millisecond fields, and raw otherwise, with the case it was largest at.
Fields that record how a file was built (generator, manifests, the engine
clock) are left out.
"""
import datetime
import json
import re
import subprocess
import sys

FILES = ['independent-node-polar', 'independent-eight-cases', 'independent-lunar-returns', 'transit-window-horizons']
SKIP = ('generator', 'horizonsManifest', 'clock', 'engineClock', 'arbiters', 'gates')
ISO = re.compile(r'^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$')
base = sys.argv[1]


def load(commit, name):
    path = 'src/lib/engine/fixtures/%s.json' % name
    if commit is None:
        return json.load(open(path))
    return json.loads(subprocess.run(['git', 'show', '%s:%s' % (commit, path)], capture_output=True, text=True, check=True).stdout)


def ms(iso):
    return datetime.datetime.fromisoformat(iso.replace('Z', '+00:00')).timestamp() * 1000


def walk(old, new, path, out, case):
    if isinstance(old, dict) and isinstance(new, dict):
        for key in ('id', 'utc', 'key'):
            if isinstance(new.get(key), str):
                case = new[key]
        for key in sorted(set(old) | set(new)):
            if key in SKIP:
                continue
            if key not in old or key not in new:
                out.setdefault('%s.%s (added or removed)' % (path, key), []).append((None, case))
                continue
            walk(old[key], new[key], '%s.%s' % (path, key), out, case)
    elif isinstance(old, list) and isinstance(new, list):
        if len(old) != len(new):
            out.setdefault('%s (length %d, then %d)' % (path, len(old), len(new)), []).append((None, case))
            return
        for a, b in zip(old, new):
            walk(a, b, path + '[]', out, case)
    elif isinstance(old, (int, float)) and isinstance(new, (int, float)) and not isinstance(old, bool):
        if 'Degrees' in path or 'Longitude' in path or path.endswith(('.asc', '.mc', '.ascmc[]', '.cusps[]')):
            key = path + ' [arcsec]'
            move = abs((old - new + 540.0) % 360.0 - 180.0) * 3600
        elif 'Milliseconds' in path or path.endswith('.ms'):
            key = path + ' [ms]'
            move = abs(old - new)
        else:
            key = path + ' [raw]'
            move = abs(old - new)
        out.setdefault(key, [])
        if move:
            out[key].append((move, case))
    elif isinstance(old, str) and isinstance(new, str):
        if old != new:
            if ISO.match(old) and ISO.match(new):
                out.setdefault(path + ' [ms]', []).append((abs(ms(old) - ms(new)), case))
            else:
                out.setdefault(path + ' [text]', []).append((None, case))
    elif old != new:
        out.setdefault(path + ' [other]', []).append((None, case))


report = {'schema': 'zodiacs-independent-reference-moves/v1', 'base': base, 'files': {}}
for name in FILES:
    out = {}
    walk(load(base, name), load(None, name), '', out, '')
    fields = {}
    for field in sorted(out):
        rows = out[field]
        if not rows:
            continue
        numbers = [row for row in rows if row[0] is not None]
        if numbers:
            worst = max(numbers, key=lambda row: row[0])
            fields[field] = {'moved': len(numbers), 'largest': float('%.6g' % worst[0]), 'at': worst[1]}
        else:
            fields[field] = {'changed': len(rows), 'at': rows[0][1]}
    report['files'][name + '.json'] = fields
print(json.dumps(report, indent=1, ensure_ascii=False))
