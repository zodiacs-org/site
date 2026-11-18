"""Write src/data/nasa-event-times-2027.json from horizons-event-times.json.

The table the 2027 event pages print from (src/lib/nasa-event-times-2027.ts):
each 2027 full Moon and eclipse, and each shadow edge of the 2027 Mercury and
Mars retrogrades, with NASA's instant beside the engine instant it replaces.
Stations, sign changes and aspects are not written here: the pages already
print those from src/data/nasa-event-instants.json. New Moons and the events
of other years keep the engine's instant, as their own pages do. compare.py
holds every one of them to the solved set.

Usage: python3 docs/platform/evidence/event-pages-2027-20261113/tools/write_site_table.py [--check]
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EVIDENCE = os.path.normpath(os.path.join(HERE, os.pardir))
ROOT = os.path.normpath(os.path.join(EVIDENCE, os.pardir, os.pardir, os.pardir, os.pardir))
OUT = os.path.join(ROOT, 'src', 'data', 'nasa-event-times-2027.json')

with open(os.path.join(EVIDENCE, 'horizons-event-times.json')) as f:
    solved = json.load(f)

lunations, eclipses, shadows = [], [], []
for key, event in solved['events'].items():
    row = {'engine': event['engine'], 'nasa': event['horizons']}
    in_2027 = event['engine'].startswith('2027')
    if event['kind'] == 'lunation' and in_2027 and event['detail']['type'] == 'full':
        lunations.append({'type': event['detail']['type'], **row})
    elif event['kind'] == 'eclipse' and in_2027:
        eclipses.append({'type': event['detail']['type'], **row})
    elif event['kind'] == 'shadow':
        shadows.append({'body': event['detail']['body'], 'edge': event['detail']['edge'], **row})

table = {
    'schema': 'zodiacs.nasa-event-times-2027.v1',
    'what': 'The 2027 full Moons, eclipse peaks and retrograde shadow edges, solved on NASA JPL Horizons (DE441); each row keeps the engine instant it replaces',
    'source': solved['source'],
    'timeScale': solved['timeScale'],
    'evidence': 'docs/platform/evidence/event-pages-2027-20261113/horizons-event-times.json',
    'lunations': sorted(lunations, key=lambda r: r['engine']),
    'eclipses': sorted(eclipses, key=lambda r: r['engine']),
    'shadows': sorted(shadows, key=lambda r: r['engine']),
}
text = json.dumps(table, indent=1, ensure_ascii=False) + '\n'
if '--check' in sys.argv:
    if open(OUT).read() != text:
        raise SystemExit('src/data/nasa-event-times-2027.json is stale; run write_site_table.py')
    print('nasa-event-times-2027.json matches the solved set')
else:
    with open(OUT, 'w') as f:
        f.write(text)
    print('%d lunations, %d eclipses, %d shadow edges -> %s' % (len(lunations), len(eclipses), len(shadows), OUT))
