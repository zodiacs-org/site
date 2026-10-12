#!/usr/bin/env python3
"""Run the current site's engine-derived data generators, without refreshing pins."""
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[5]
def data(name):
    return json.loads((ROOT / name).read_text())

commands = [
    ['node', 'scripts/build-sky.mjs', '--generated-at', data('src/data/sky.json')['generatedAt']],
    ['node', 'scripts/build-ingresses.mjs'],
    ['node', 'scripts/build-eclipses.mjs', '--generated-at', data('src/data/eclipses.json')['generatedAt']],
    ['node', 'scripts/build-birthdays.mjs'],
    ['node', 'scripts/build-aura-moon-ingresses.mjs'],
    ['node', 'scripts/build-daily.mjs', data('src/data/daily.json')['date']],
    ['node', 'scripts/build-registry-outlook.mjs'],
    ['npm', 'run', 'editorial:daily:build'],
    ['npm', 'run', 'editorial:horoscopes:build'],
    ['npm', 'run', 'data:events:build'],
]
commands += [['node', 'scripts/build-transits.mjs', path.stem.removeprefix('transits-')]
             for path in sorted((ROOT / 'src/data').glob('transits-*.json'))]
commands += [
    ['node', 'scripts/build-tz-lmt.mjs', '--check'],
    ['node', 'scripts/build-tz-history.mjs', '--check'],
    ['node', 'scripts/build-people-pilot.mjs', '--check'],
    ['node', 'node_modules/vite-node/vite-node.mjs', '--script', 'scripts/build-assistant-context.mjs'],
    ['node', 'node_modules/vite-node/vite-node.mjs', '--script', 'scripts/build-horoscope-window.ts'],
]
for command in commands:
    # The time zone tables and their generators were removed by #723, when the
    # site moved to @zodiacs/engine/geo; at this record's commit they ran.
    if command[0] == 'node' and command[1].startswith('scripts/') and not (ROOT / command[1]).exists():
        print('SKIP', ' '.join(command), '(not in this checkout)', flush=True)
        continue
    print('RUN', ' '.join(command), flush=True)
    subprocess.run(command, cwd=ROOT, check=True)
    if command == ['node', 'scripts/build-aura-moon-ingresses.mjs']:
        # The Registry payload is protected. Retain original creation metadata
        # only after a complete fresh draw has identical numerical content.
        original = subprocess.check_output(['git', 'show',
            '073bde6e27b2d302352ba056f8ee3fd65f03446e:src/data/aura-moon-ingresses.json'], cwd=ROOT)
        path = ROOT / 'src/data/aura-moon-ingresses.json'
        prior, fresh = json.loads(original), json.loads(path.read_bytes())
        prior.pop('generatedAt'); fresh.pop('generatedAt')
        if prior != fresh:
            raise RuntimeError('Protected Registry numerical payload differs; requires review')
        path.write_bytes(original)
