"""Compare dump-mean.mjs with Swiss's mean node and mean apogee (SE_MEAN_NODE,
SE_MEAN_APOG) at the engine's own TT, true equinox of date with nutation (the
default), speeds included. Prints statistics only.

    python3 tools/compare-mean.py "$WORK/mean.jsonl" "$SWISS_EPHE" > results/mean.json
"""
import json, sys
import swisseph as swe

swe.set_ephe_path(sys.argv[2])
J2000 = 2451545.0
FLAGS = swe.FLG_SWIEPH | swe.FLG_SPEED


def gap(a, b):
    return abs((a - b + 180) % 360 - 180) * 3600


def summary(values):
    v = sorted(values)
    return {'compared': len(v), 'max': float(f'{v[-1]:.3g}'), 'p50': float(f'{v[len(v) // 2]:.3g}')}


rows = [json.loads(line) for line in open(sys.argv[1])]
node_lon, node_speed, lil_lon, lil_lat, lil_speed = [], [], [], [], []
for r in rows:
    jd = J2000 + r['tt']
    n, _ = swe.calc(jd, swe.MEAN_NODE, FLAGS)
    a, _ = swe.calc(jd, swe.MEAN_APOG, FLAGS)
    node_lon.append(gap(r['node'][0], n[0]))
    node_speed.append(abs(r['node'][1] - n[3]) * 3600)
    lil_lon.append(gap(r['lilith'][0], a[0]))
    lil_lat.append(abs(r['lilith'][1] - a[1]) * 3600)
    lil_speed.append(abs(r['lilith'][2] - a[3]) * 3600)
print(json.dumps({
    'swisseph': swe.version,
    'span': [rows[0]['utc'], rows[-1]['utc']],
    'unit': 'arcseconds; speeds in arcseconds per day',
    'meanNode': {'longitude': summary(node_lon), 'speed': summary(node_speed)},
    'blackMoonLilith': {'longitude': summary(lil_lon), 'latitude': summary(lil_lat), 'speed': summary(lil_speed)},
}, indent=1))
