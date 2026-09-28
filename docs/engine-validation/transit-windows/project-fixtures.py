"""Offline compact projection from immutable reviewed source receipts; no provider imports."""
import hashlib
import json
import argparse
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('source_archive_root', type=Path, help='Root of the extracted zodiacs-wave24-qualified-source-2026-09-07.zip')
# No default: the projection holds Swiss's per-case values, which left the tree
# on 2026-09-28 (docs/platform/programme/DECISIONS-2026-09-28.md §3). Write it
# to a scratch path outside the repository when a Swiss comparison is wanted.
parser.add_argument('--output', type=Path, required=True, help='Where to write the projection, outside the repository')
args = parser.parse_args()
ROOT = args.source_archive_root
INPUTS = [
    ('v2', ROOT / 'recovered-evidence/wave24-v2/wave24-orb-windows.v2.partial.json', '3c48a6f13c5b0ea080e4b298418422d4b76a9405aeb767f25b61963e085c579b'),
    ('v3', ROOT / 'recovered-evidence/wave24/wave24-orb-windows.v3.partial.json', '8faab02e91e8dc1e96652118802e97d5d6a567e9475e5ebe18ed54f80118f62f'),
    ('v6', ROOT / 'wave24-d-qualified-v6-receipt/wave24-d-qualified.v6.receipt.json', '2776acbc5b15fb80e0ecc9ce2cc63dc19b9a835a080461da8adee9b5f7c2485c'),
]
sources = {}
for name, path, expected in INPUTS:
    assert hashlib.sha256(path.read_bytes()).hexdigest() == expected
    sources[name] = json.loads(path.read_text())


def minimum(row):
    return {'orbDegrees': row['sourceMinimumOrbDegrees'], 'timeEnvelopeMs': row['allowedProductMilliseconds'], 'sourceBestUtc': row['sourceMinimumTime']['productDateTransport']}


def crop(row):
    return {'label': row.get('label', row.get('name')), 'geometryId': row.get('geometryId'),
            'fromUtc': row['boundaries'][0]['instant']['productDateTransport'], 'toUtc': row['boundaries'][1]['instant']['productDateTransport'],
            'boundaries': [{k: x[k] for k in ['orbDegrees', 'membershipAmbiguousWithinBudget', 'exactCountAmbiguousWithinBudget']} for x in row['boundaries']],
            'portions': [{**{k: x[k] for k in ['startClipped', 'endClipped']}, 'sourceExactCount': len(x.get('exactRootIdsBySourceEstimate', x.get('sourceExactRootIdsByEstimate', [])))} for x in row['portions']]}


cases = []
for bundle in ['v2', 'v3']:
    for name, case in sources[bundle]['cases'].items():
        if name.startswith('D-'):
            continue
        spec = case['input']
        track = sources[bundle]['trajectories'][case['trajectoryId']]
        natal_point = spec.get('natalPoint', spec['movingBody'])
        geometries = []
        for geometry in case['geometries']:
            by_id = {x['id']: x for x in geometry['roots']}
            components = []
            for component in geometry['components']:
                entry = by_id.get(component['entryRootId'])
                exit_ = by_id.get(component['exitRootId'])
                gm = component['globalMinimum']
                components.append({'sourceId': component['id'], 'startUtc': component['start']['productDateTransport'], 'endUtc': component['end']['productDateTransport'],
                    'startClipped': component['startClipped'], 'endClipped': component['endClipped'],
                    'entryBandMs': entry['band']['allowedProductMilliseconds'] if entry else None,
                    'exitBandMs': exit_['band']['allowedProductMilliseconds'] if exit_ else None,
                    'exactBandsMs': [x['band']['allowedProductMilliseconds'] for x in component['exactPasses']],
                    'localMinima': [minimum(x) for x in component['nonExactLocalMinima']],
                    'globalMinimumKind': gm['kind'], 'globalMinimum': minimum(gm['candidates'][0]) if gm.get('candidates') else None,
                    'exactTopology': 'resolved'})
            geometries.append({'sourceId': geometry['id'], 'aspect': geometry['aspect'], 'offset': geometry['offsetDegrees'], 'components': components})
        cases.append({'id': name, 'sourceBundle': bundle, 'sourcePointer': '/cases/' + name, 'movingBody': spec['movingBody'],
            'natalPoint': natal_point, 'targetLongitudeDegrees': case['targetLongitudeDegrees'], 'angularBudgetDegrees': spec['angularBudgetDegrees'],
            'natalComponentBudgetDegrees': spec['natalComponentBudgetDegrees'], 'input': spec,
            'fromUtc': spec.get('from', spec.get('fromNumericTransport')), 'toUtc': spec.get('to', spec.get('toNumericTransport')),
            'geometries': geometries, 'crops': [crop(x) for x in case['crops']]})

d = sources['v6']['qualifiedD']
assert sources['v6']['status'] == 'qualified-source-complete-awaiting-root-review'
assert sources['v6']['originalPackStatus'] == 'failed-incomplete'
components = []
for i, component in enumerate(d['components']):
    components.append({'sourceId': component['id'], 'startUtc': component['start']['productDateTransport'], 'endUtc': component['end']['productDateTransport'],
        'startClipped': False, 'endClipped': False, 'entryBandMs': component['entry']['band']['allowedProductMilliseconds'], 'exitBandMs': component['exit']['band']['allowedProductMilliseconds'],
        'exactBandsMs': [d['envelopes']['firstConditionedExactBand']['allowedProductMilliseconds']] if i == 0 else [],
        'possibleExactRegionMs': d['envelopes']['secondPossibleExactRegion']['allowedProductMilliseconds'] if i else None,
        'possibleMinimumRegionMs': d['envelopes']['secondPossibleMinimumRegion']['allowedProductMilliseconds'] if i else None,
        'sourceExactCount': len(component['sourceExactRootIds']), 'exactTopology': 'resolved' if i == 0 else 'uncertain',
        'globalMinimumKind': 'exact' if i == 0 else 'unresolved-cross-model-count', 'globalMinimum': None, 'localMinima': []})
spec = sources['v6']['policy']['case']
cases.append({'id': spec['id'], 'sourceBundle': 'v6', 'sourcePointer': '/qualifiedD', 'movingBody': 'Uranus', 'natalPoint': 'Uranus', 'targetLongitudeDegrees': spec['targetLongitudeDegrees'], 'angularBudgetDegrees': 0.05, 'natalComponentBudgetDegrees': None, 'input': spec, 'fromUtc': spec['from'], 'toUtc': spec['to'], 'geometries': [{'sourceId': 'qualified-D-conjunction', 'aspect': 'conjunction', 'offset': 0, 'components': components}], 'crops': [crop(x) for x in d['crops']]})
result = {'schemaVersion': 1, 'originalPackStatus': 'failed-incomplete', 'qualifiedDSourceAcceptedByRoot': True,
    'sourceHashes': {name: expected for name, path, expected in INPUTS}, 'coherentNatalInput': sources['v2']['policy']['coherentNatalInput'],
    'cases': sorted(cases, key=lambda x: x['id']),
    'limits': ['Finite independent source vectors, not a global ephemeris-error theorem.', 'D remains mandatory qualified uncertainty coverage, not a passed original exact-topology vector.', 'Source clocks and crop-count exclusions remain attached.']}
out = args.output
out.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'path': str(out), 'sha256': hashlib.sha256(out.read_bytes()).hexdigest(), 'cases': len(cases), 'geometries': sum(len(x['geometries']) for x in cases)}))
