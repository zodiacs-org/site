"""Each published event instant against Swiss Ephemeris (SWIEPH files, apparent geocentric).

Adapted from events-vs-swiss-2026-09-23/tools/compare.py.
Only aggregate statistics and the site's own event IDs/instants are written.
Usage: python3 compare-events-swiss.py catalog.json ephe-dir out.json
"""
import json, sys, math, hashlib, platform
from pathlib import Path
from importlib.metadata import version
from datetime import datetime, timezone
import swisseph as swe

catalog = json.load(open(sys.argv[1]))
expected = {
    'sepl_18.se1': ('ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66', 484061),
    'semo_18.se1': ('1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7', 1304771),
}
ephe_files = []
for name, (digest, size) in expected.items():
    data = (Path(sys.argv[2]) / name).read_bytes()
    if len(data) != size or hashlib.sha256(data).hexdigest() != digest:
        raise ValueError(f'{name}: does not match pinned Swiss configuration')
    ephe_files.append({'name': name, 'bytes': size, 'sha256': digest,
                       'source': 'https://raw.githubusercontent.com/aloistr/swisseph/master/ephe/' + name})
if swe.version != '2.10.03' or version('pyswisseph') != '2.10.3.2':
    raise ValueError('Swiss binding/library version does not match pinned configuration')
swe.set_ephe_path(sys.argv[2])
FLAGS = swe.FLG_SWIEPH | swe.FLG_SPEED
BODY = {'Sun': swe.SUN, 'Moon': swe.MOON, 'Mercury': swe.MERCURY, 'Venus': swe.VENUS, 'Mars': swe.MARS,
        'Jupiter': swe.JUPITER, 'Saturn': swe.SATURN, 'Uranus': swe.URANUS, 'Neptune': swe.NEPTUNE, 'Pluto': swe.PLUTO}
SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']
fallbacks = 0


def jd(iso):
    t = datetime.fromisoformat(iso.replace('Z', '+00:00'))
    return swe.julday(t.year, t.month, t.day, t.hour + t.minute / 60 + (t.second + t.microsecond / 1e6) / 3600)


def calc(body, t):
    global fallbacks
    x, flags = swe.calc_ut(t, BODY[body], FLAGS)
    if not flags & swe.FLG_SWIEPH:
        fallbacks += 1
    return x


def lon(body, t):
    return calc(body, t)[0]


def speed(body, t):
    return calc(body, t)[3]


def wrap(d):
    return (d + 180) % 360 - 180


def root(f, t0, span):
    """The sign change of f nearest t0 within ±span days, to 1e-8 day."""
    step = span / 200
    best = None
    for k in range(-200, 200):
        a, b = t0 + k * step, t0 + (k + 1) * step
        fa, fb = f(a), f(b)
        if fa == 0:
            c = a
        elif fa * fb < 0 and abs(fa) < 90 and abs(fb) < 90:
            lo, hi = a, b
            for _ in range(80):
                mid = (lo + hi) / 2
                if f(lo) * f(mid) <= 0:
                    hi = mid
                else:
                    lo = mid
            c = (lo + hi) / 2
        else:
            continue
        if best is None or abs(c - t0) < abs(best - t0):
            best = c
    return best


rows = []
for e in catalog:
    fam, t0 = e['family'], e.get('at')
    if fam == 'retrograde' or not t0:
        continue  # the cycles' ends are the station events
    t = jd(t0)
    swiss = None
    if fam == 'lunation':
        target = 180 if e['subtype'] == 'full' else 0
        swiss = root(lambda x: wrap(lon('Moon', x) - lon('Sun', x) - target), t, 1)
    elif fam == 'eclipse':
        if e['subtype'] == 'solar':
            _, tret = swe.sol_eclipse_when_glob(t - 3, FLAGS, 0, False)
        else:
            _, tret = swe.lun_eclipse_when(t - 3, FLAGS, 0, False)
        swiss = tret[0]
    elif fam == 'station':
        b = e['bodies'][0]
        swiss = root(lambda x: speed(b, x), t, 5)
    elif fam == 'ingress':
        b = e['bodies'][0]
        to, frm = SIGNS.index(e['signs'][0]), SIGNS.index(e['fromSign'])
        edge = to * 30 if (frm + 1) % 12 == to else ((to + 1) % 12) * 30
        swiss = root(lambda x: wrap(lon(b, x) - edge), t, 5)
    elif fam == 'aspect':
        a, b = e['bodies']
        angle = {'conjunction': 0, 'sextile': 60, 'square': 90, 'trine': 120, 'opposition': 180}[e['aspectType']]
        if angle in (0, 180):
            swiss = root(lambda x: wrap(lon(a, x) - lon(b, x) - angle), t, 10)
        else:
            swiss = root(lambda x: abs(wrap(lon(a, x) - lon(b, x))) - angle, t, 10)
    if swiss is None:
        rows.append({'id': e['id'], 'family': fam, 'published': t0, 'swiss': None})
        continue
    delta = (t - swiss) * 86400
    rows.append({'id': e['id'], 'family': fam, 'subtype': e.get('subtype'), 'bodies': e['bodies'], 'published': t0,
                 'deltaSeconds': round(delta, 3)})

summary = {}
for fam in ['lunation', 'eclipse', 'ingress', 'aspect', 'station']:
    ds = [r['deltaSeconds'] for r in rows if r['family'] == fam and 'deltaSeconds' in r]
    missing = [r['id'] for r in rows if r['family'] == fam and 'deltaSeconds' not in r]
    summary[fam] = {'events': len(ds), 'unmatched': missing, 'maxAbsSeconds': max(abs(d) for d in ds) if ds else None,
                    'meanSeconds': round(sum(ds) / len(ds), 3) if ds else None}
stations = {}
for r in rows:
    if r['family'] == 'station' and 'deltaSeconds' in r:
        b = r['bodies'][0]
        stations[b] = max(stations.get(b, 0), abs(r['deltaSeconds']))
summary['stationMaxAbsSecondsByPlanet'] = stations
summary['swisseph'] = swe.version
summary['swissFileFallbacks'] = fallbacks
if fallbacks:
    raise ValueError(f'{fallbacks} Swiss calls fell back from SWIEPH')
slow = {}
for r in rows:
    if r['family'] not in ('ingress', 'aspect') or 'deltaSeconds' not in r:
        continue
    outer = any(body in ('Uranus', 'Neptune', 'Pluto') for body in r['bodies'])
    label = r['family'] + (' with Uranus, Neptune or Pluto' if outer else ' of Jupiter and Saturn only')
    slow[label] = max(slow.get(label, 0), abs(r['deltaSeconds']))
summary['slowEventMaxAbsSeconds'] = slow
summary['catalogSha256'] = hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest()
summary['measuredOn'] = '2026-10-01'
summary['engine'] = '0.1.1-rc.16'
output = {
    'schema': 'zodiacs-events-swiss-statistics.v1',
    'summary': summary,
    'provenance': {'python': platform.python_version(), 'pyswisseph': version('pyswisseph'),
        'ephemerisFiles': ephe_files, 'referenceConfiguration': 'docs/platform/evidence/swiss-benchmark/CONFIGURATION.md',
        'engineArchiveSha256': '43a72d30e483d8ff22024e403c4bd0d86d81bb6e1d0ad138f857cd001ab015d8',
        'toolSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'conventions': 'Published ISO UTC instants treated as UT by the historical compare.py; apparent geocentric tropical ecliptic of date; FLG_SWIEPH | FLG_SPEED',
        'limits': 'Catalogue event-time statistics only, not same-UT1 residuals or an observational-accuracy claim. No per-event Swiss value, residual or reference instant is written.'},
    'deltas': [{'id': r['id'], 'family': r['family'], 'published': r['published']} for r in rows],
}
Path(sys.argv[3]).write_text(json.dumps(output, indent=1) + '\n')
print(json.dumps(summary, indent=1))
