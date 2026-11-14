"""Solve every sky event the 2027 event pages name on NASA JPL Horizons.

Reads ../referenced-events.json (dump-referenced-events.ts) and, for each
event, asks the Horizons API for a short table around the instant the site's
data files give, then solves the event on that table. Nothing is taken from
the site's engine except where to look.

Every query is an OBSERVER table from the geocentre (CENTER 500@399), apparent
position (light-time, gravitational deflection of light, stellar aberration),
ecliptic longitude and latitude of date (QUANTITIES 31; 20 adds the range for
eclipses), EXTRA_PREC YES, TIME_TYPE UT. Horizons prints UT as UTC from 1962
and, for dates after the last announced leap second, holds the last known
leap second constant (TT minus UTC = 69.184 s). Targets: Sun 10, Moon 301,
Mercury 199, Venus 299, and the system barycentres 4 to 9 for Mars to Pluto,
as scripts/accuracy-audit/horizons_fetch.py uses.

How each kind is solved:
  lunation  the root of Moon longitude minus Sun longitude minus 0 or 180
            degrees, on tables at a 1 minute step
  eclipse   lunar: the instant the Moon's centre is closest to the axis of
            Earth's shadow (the line from the Sun through the geocentre);
            solar: the instant the line from the Sun through the Moon passes
            closest to the geocentre. Apparent geocentric positions of the
            Sun and the Moon, 1 minute step
  station   the instant the planet's longitude stops changing, from a least
            squares polynomial through a table either side of it
  shadow    before a retrograde: the instant the planet, moving forward,
            first reaches the longitude of its direct station. After it: the
            instant it passes the longitude of its retrograde station
  ingress   the root of longitude minus the sign boundary
  aspect    the root of the two longitudes' difference minus the aspect angle

Raw responses are kept outside git (RAW, default
/workspace/runs/fable-jobs/job10/horizons-raw); ../horizons-queries.json keeps
each query URL, its retrieval time in UTC, the SHA-256 of the response and the
header lines Horizons printed. A kept response is read from disk and checked
against its SHA-256; --refresh fetches again.

JPL asks automated clients to identify themselves, so each request carries an
application name and a contact address, and requests run one at a time.

Usage: python3 docs/platform/evidence/event-pages-2027-20261113/tools/horizons_event_times.py [--refresh]
"""
from __future__ import annotations

import datetime
import hashlib
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

import numpy as np

API = 'https://ssd.jpl.nasa.gov/api/horizons.api'
USER_AGENT = 'zodiacs.org-event-pages-check/1.0 (+https://zodiacs.org; admin@zodiacs.org)'
HERE = os.path.dirname(os.path.abspath(__file__))
EVIDENCE = os.path.normpath(os.path.join(HERE, os.pardir))
ROOT = os.path.normpath(os.path.join(EVIDENCE, os.pardir, os.pardir, os.pardir, os.pardir))
RAW = os.environ.get('HORIZONS_RAW', '/workspace/runs/fable-jobs/job10/horizons-raw')
QUERIES = os.path.join(EVIDENCE, 'horizons-queries.json')
OUT = os.path.join(EVIDENCE, 'horizons-event-times.json')

TARGETS = {
    'Sun': '10', 'Moon': '301', 'Mercury': '199', 'Venus': '299', 'Mars': '4',
    'Jupiter': '5', 'Saturn': '6', 'Uranus': '7', 'Neptune': '8', 'Pluto': '9',
}
SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra',
         'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']
ASPECT_ANGLE = {'conjunction': 0, 'sextile': 60, 'square': 90, 'trine': 120, 'opposition': 180}
AU_KM = 149597870.700
UTC = datetime.timezone.utc
MINUTE = datetime.timedelta(minutes=1)


def parse_iso(value):
    return datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))


def iso_ms(dt):
    return dt.strftime('%Y-%m-%dT%H:%M:%S.') + '%03dZ' % (dt.microsecond // 1000)


def floor_minute(dt):
    return dt.replace(second=0, microsecond=0)


def wrap180(x):
    return (x + 180.0) % 360.0 - 180.0


# --- Horizons ---------------------------------------------------------------------
def load_queries():
    if os.path.exists(QUERIES):
        with open(QUERIES) as f:
            return json.load(f)
    return {
        'what': 'NASA JPL Horizons API queries behind horizons-event-times.json; the responses are kept outside git',
        'api': API,
        'userAgent': USER_AGENT,
        'responses': {},
    }


def save_queries(q):
    q['responses'] = dict(sorted(q['responses'].items()))
    with open(QUERIES, 'w') as f:
        f.write(json.dumps(q, indent=1, ensure_ascii=False) + '\n')


REFRESH = '--refresh' in sys.argv
_queries = load_queries()


def table(name, body, start, stop, step_minutes, quantities='31'):
    """Rows [(utc datetime, {column: float})] of one Horizons table, start to stop inclusive."""
    os.makedirs(RAW, exist_ok=True)
    params = {
        'format': 'text', 'OBJ_DATA': 'NO', 'MAKE_EPHEM': 'YES',
        'COMMAND': TARGETS[body], 'EPHEM_TYPE': 'OBSERVER', 'CENTER': '500@399',
        'START_TIME': start.strftime('%Y-%m-%d %H:%M'), 'STOP_TIME': stop.strftime('%Y-%m-%d %H:%M'),
        'STEP_SIZE': '%d m' % step_minutes,
        'TIME_TYPE': 'UT', 'QUANTITIES': quantities, 'ANG_FORMAT': 'DEG', 'EXTRA_PREC': 'YES',
        'CAL_FORMAT': 'JD', 'APPARENT': 'AIRLESS', 'CSV_FORMAT': 'YES',
    }
    url = API + '?' + urllib.parse.urlencode({k: (v if k == 'format' else "'%s'" % v) for k, v in params.items()})
    path = os.path.join(RAW, name + '.txt')
    entry = _queries['responses'].get(name)
    data = None
    if os.path.exists(path) and not REFRESH and entry and entry['url'] == url:
        data = open(path, 'rb').read()
        if hashlib.sha256(data).hexdigest() != entry['sha256']:
            raise SystemExit('%s does not match its recorded SHA-256' % name)
    if data is None:
        request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(request, timeout=120) as response:
                    data = response.read()
                break
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(10 * (attempt + 1))
        time.sleep(1.0)
        text = data.decode()
        if '$$SOE' not in text:
            raise SystemExit('no ephemeris in the response to %s:\n%s' % (name, text[:1500]))
        with open(path, 'wb') as f:
            f.write(data)
        header = {}
        for line in text.splitlines():
            for label in ('API VERSION', 'Target body name', 'Center body name', 'Center-site name',
                          'Start time', 'Stop  time', 'Step-size', 'EOP file', 'EOP coverage'):
                if line.startswith(label):
                    header[label] = ' '.join(line.split(':', 1)[1].split())
        _queries['responses'][name] = {
            'body': body, 'url': url, 'query': params,
            'retrievedUtc': datetime.datetime.now(UTC).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'header': header,
        }
        save_queries(_queries)
    text = data.decode()
    lines = text[text.index('$$SOE') + 5:text.index('$$EOE')].strip().splitlines()
    head = [h.strip() for h in text[:text.index('$$SOE')].strip().splitlines()[-2].split(',')]
    rows = []
    for k, line in enumerate(lines):
        cells = [c.strip() for c in line.split(',')]
        at = start + datetime.timedelta(minutes=step_minutes * k)
        jd = float(cells[0])
        # The row's own Julian day (UT) must be the instant counted from the start time.
        expected = 2451545.0 + (at - datetime.datetime(2000, 1, 1, 12, tzinfo=UTC)).total_seconds() / 86400.0
        if abs(jd - expected) > 2e-9:
            raise SystemExit('%s row %d: JD %r is not %r' % (name, k, jd, expected))
        rows.append((at, {h: float(c) for h, c in zip(head, cells) if h and c and h != 'Date_________JDUT'}))
    if rows[-1][0] != stop:
        raise SystemExit('%s: the table ends at %s, not %s' % (name, rows[-1][0], stop))
    return name, rows


def seconds(rows, origin):
    return np.array([(at - origin).total_seconds() for at, _ in rows])


def unwrap(values):
    out = [values[0]]
    for v in values[1:]:
        out.append(out[-1] + wrap180(v - out[-1]))
    return np.array(out)


def fit(ts, ys, degree):
    """Least-squares polynomial in scaled time; returns (poly1d over scaled t, scale, largest residual)."""
    scale = max(abs(ts[0]), abs(ts[-1])) or 1.0
    coeffs = np.polyfit(ts / scale, ys, degree)
    poly = np.poly1d(coeffs)
    return poly, scale, float(np.max(np.abs(poly(ts / scale) - ys)))


def real_root_near(poly, scale, near_s, lo_s, hi_s):
    roots = [r.real * scale for r in poly.roots if abs(r.imag) < 1e-9 and lo_s <= r.real * scale <= hi_s]
    if not roots:
        raise SystemExit('no root inside the table')
    return min(roots, key=lambda r: abs(r - near_s))


# --- solvers ----------------------------------------------------------------------
def solve_lunation(key, engine, detail):
    centre = floor_minute(engine)
    start, stop = centre - 20 * MINUTE, centre + 21 * MINUTE
    tag = 'lunation-%s-%s' % (detail['type'], engine.strftime('%Y%m%dT%H%M'))
    nm, moon = table(tag + '-moon', 'Moon', start, stop, 1)
    ns, sun = table(tag + '-sun', 'Sun', start, stop, 1)
    target = 180.0 if detail['type'] == 'full' else 0.0
    ts = seconds(moon, centre)
    diff = np.array([wrap180(m[1]['ObsEcLon'] - s[1]['ObsEcLon'] - target) for m, s in zip(moon, sun)])
    poly, scale, residual = fit(ts, diff, 3)
    root = real_root_near(poly, scale, 0.0, ts[0], ts[-1])
    at = centre + datetime.timedelta(seconds=root)
    moon_poly, moon_scale, _ = fit(ts, unwrap([m[1]['ObsEcLon'] for m in moon]), 3)
    moon_lon = float(moon_poly(root / moon_scale)) % 360.0
    return at, {
        'queries': [nm, ns], 'stepMinutes': 1, 'fitResidualDeg': residual,
        'moonLongitude': round(moon_lon, 6), 'moonSign': SIGNS[int(moon_lon // 30)],
    }


def ecliptic_vector(row):
    lon, lat = math.radians(row['ObsEcLon']), math.radians(row['ObsEcLat'])
    r = row['delta'] * AU_KM
    return np.array([r * math.cos(lat) * math.cos(lon), r * math.cos(lat) * math.sin(lon), r * math.sin(lat)])


def solve_eclipse(key, engine, detail):
    centre = floor_minute(engine)
    start, stop = centre - 40 * MINUTE, centre + 41 * MINUTE
    tag = 'eclipse-%s-%s' % (detail['type'], engine.strftime('%Y%m%dT%H%M'))
    nm, moon = table(tag + '-moon', 'Moon', start, stop, 1, '20,31')
    ns, sun = table(tag + '-sun', 'Sun', start, stop, 1, '20,31')
    ts = seconds(moon, centre)
    dist = []
    for m, s in zip(moon, sun):
        mv, sv = ecliptic_vector(m[1]), ecliptic_vector(s[1])
        if detail['type'] == 'lunar':
            axis = -sv / np.linalg.norm(sv)
            dist.append(float(np.linalg.norm(mv - np.dot(mv, axis) * axis)))
        else:
            dist.append(float(np.linalg.norm(np.cross(sv, mv)) / np.linalg.norm(sv - mv)))
    dist = np.array(dist)
    k = int(np.argmin(dist))
    lo, hi = max(0, k - 15), min(len(ts), k + 16)
    poly, scale, residual = fit(ts[lo:hi], dist[lo:hi] ** 2, 4)
    root = real_root_near(poly.deriv(), scale, ts[k], ts[lo], ts[hi - 1])
    at = centre + datetime.timedelta(seconds=root)
    least = math.sqrt(max(0.0, float(poly(root / scale))))
    moon_poly, moon_scale, _ = fit(ts[lo:hi], unwrap([m[1]['ObsEcLon'] for m in moon[lo:hi]]), 3)
    moon_lon = float(moon_poly(root / moon_scale)) % 360.0
    sun_poly, sun_scale, _ = fit(ts[lo:hi], unwrap([s[1]['ObsEcLon'] for s in sun[lo:hi]]), 3)
    sun_lon = float(sun_poly(root / sun_scale)) % 360.0
    return at, {
        'moonLongitude': round(moon_lon, 6), 'moonSign': SIGNS[int(moon_lon // 30)],
        'sunLongitude': round(sun_lon, 6), 'sunSign': SIGNS[int(sun_lon // 30)],
        'queries': [nm, ns], 'stepMinutes': 1,
        'leastDistanceKm': round(least, 1),
        'leastDistanceOf': 'the Moon\'s centre from the axis of Earth\'s shadow' if detail['type'] == 'lunar'
        else 'the Moon\'s shadow axis from the geocentre',
        'fitResidualKm2': residual,
    }


FAST = {'Mercury', 'Venus', 'Mars'}


def station_table(body, engine, direction):
    centre = engine.replace(minute=0, second=0, microsecond=0)
    if body in FAST:
        half, step = datetime.timedelta(days=1), 10
    else:
        half, step = datetime.timedelta(days=8), 60
    tag = 'station-%s-%s-%s' % (body.lower(), direction, engine.strftime('%Y%m%dT%H%M'))
    name, rows = table(tag, body, centre - half, centre + half, step)
    return name, rows, centre, step


def solve_station(key, engine, detail, hint=None):
    body = detail['body']
    name, rows, centre, step = station_table(body, hint or engine, detail['direction'])
    ts = seconds(rows, centre)
    lon = unwrap([r[1]['ObsEcLon'] for r in rows])
    poly, scale, residual = fit(ts, lon, 8)
    root = real_root_near(poly.deriv(), scale, ((hint or engine) - centre).total_seconds(), ts[0], ts[-1])
    at = centre + datetime.timedelta(seconds=root)
    station_lon = float(poly(root / scale)) % 360.0
    second = float(poly.deriv().deriv()(root / scale))
    turns = 'retrograde' if second < 0 else 'direct'
    if turns != detail['direction']:
        raise SystemExit('%s: Horizons has the planet turning %s here' % (key, turns))
    return at, {
        'queries': [name], 'stepMinutes': step, 'fitResidualDeg': residual,
        'longitude': round(station_lon, 6), 'sign': SIGNS[int(station_lon // 30)],
    }


def crossing(tag, body, engine, target, half_minutes=45):
    """The instant `body` crosses longitude `target`, near `engine`: a 10 minute pass, then a 1 minute pass."""
    names = []
    centre = engine.replace(minute=(engine.minute // 10) * 10, second=0, microsecond=0)
    name, rows = table(tag + '-wide', body, centre - datetime.timedelta(hours=18), centre + datetime.timedelta(hours=18), 10)
    names.append(name)
    ts = seconds(rows, centre)
    diff = np.array([wrap180(r[1]['ObsEcLon'] - target) for r in rows])
    poly, scale, _ = fit(ts, diff, 5)
    rough = centre + datetime.timedelta(seconds=real_root_near(poly, scale, (engine - centre).total_seconds(), ts[0], ts[-1]))
    fine = floor_minute(rough)
    name, rows = table(tag, body, fine - half_minutes * MINUTE, fine + (half_minutes + 1) * MINUTE, 1)
    names.append(name)
    ts = seconds(rows, fine)
    diff = np.array([wrap180(r[1]['ObsEcLon'] - target) for r in rows])
    poly, scale, residual = fit(ts, diff, 3)
    root = real_root_near(poly, scale, (rough - fine).total_seconds(), ts[0], ts[-1])
    slope = float(poly.deriv()(root / scale)) / scale
    return fine + datetime.timedelta(seconds=root), names, residual, slope


def solve_shadow(key, engine, detail, stations):
    body = detail['body']
    which = 'direct' if detail['edge'] == 'pre' else 'retrograde'
    station_iso = detail['stationDirect'] if detail['edge'] == 'pre' else detail['stationRetrograde']
    station = stations['station:%s:%s:%s' % (body, which, station_iso)]
    target = station['longitude']
    tag = 'shadow-%s-%s-%s' % (body.lower(), detail['edge'], engine.strftime('%Y%m%dT%H%M'))
    at, names, residual, slope = crossing(tag, body, engine, target)
    if slope <= 0:
        raise SystemExit('%s: the planet is not moving forward at the crossing' % key)
    return at, {
        'queries': names, 'stepMinutes': 1, 'fitResidualDeg': residual,
        'crosses': 'the longitude of the %s station, %.6f degrees' % (which, target),
        'stationKey': 'station:%s:%s:%s' % (body, which, station_iso),
    }


def solve_ingress(key, engine, detail, hint):
    body = detail['body']
    target = SIGNS.index(detail['sign']) * 30.0
    tag = 'ingress-%s-%s-%s' % (body.lower(), detail['sign'], engine.strftime('%Y%m%dT%H%M'))
    at, names, residual, slope = crossing(tag, body, hint or engine, target)
    return at, {
        'queries': names, 'stepMinutes': 1, 'fitResidualDeg': residual,
        'crosses': '%d degrees, the start of %s' % (target, detail['sign']),
        'motion': 'direct' if slope > 0 else 'retrograde',
    }


def solve_aspect(key, engine, detail, hint):
    a, b, angle = detail['a'], detail['b'], ASPECT_ANGLE[detail['type']]
    near = hint or engine
    centre = near.replace(minute=0, second=0, microsecond=0)
    half = datetime.timedelta(hours=36)
    tag = 'aspect-%s-%s-%s-%s' % (a.lower(), detail['type'], b.lower(), engine.strftime('%Y%m%dT%H%M'))
    na, rows_a = table(tag + '-a', a, centre - half, centre + half, 10)
    nb, rows_b = table(tag + '-b', b, centre - half, centre + half, 10)
    ts = seconds(rows_a, centre)
    sep = np.array([wrap180(ra[1]['ObsEcLon'] - rb[1]['ObsEcLon']) for ra, rb in zip(rows_a, rows_b)])
    sign = 1.0 if sep[len(sep) // 2] >= 0 else -1.0
    diff = sep - sign * angle
    poly, scale, residual = fit(ts, diff, 5)
    root = real_root_near(poly, scale, (near - centre).total_seconds(), ts[0], ts[-1])
    return centre + datetime.timedelta(seconds=root), {
        'queries': [na, nb], 'stepMinutes': 10, 'fitResidualDeg': residual,
        'separationDeg': angle,
    }


# --- the site's printed NASA instants, used only to centre a slow planet's table --------
def nasa_hints():
    with open(os.path.join(ROOT, 'src', 'data', 'nasa-event-instants.json')) as f:
        t = json.load(f)
    hints = {}
    for family in ('ingresses', 'stations', 'aspects'):
        for row in t[family]:
            for engine in row['engine']:
                hints[(family, row.get('body') or '%s|%s' % (row['a'], row['b']), iso_ms(parse_iso(engine)))] = parse_iso(row['nasa'])
    return hints


def main():
    with open(os.path.join(EVIDENCE, 'referenced-events.json')) as f:
        referenced = json.load(f)
    hints = nasa_hints()
    results = {}
    solves = referenced['solves']
    order = {'station': 0, 'lunation': 1, 'eclipse': 2, 'ingress': 3, 'aspect': 4, 'shadow': 5}
    for item in sorted(solves, key=lambda s: (order[s['kind']], s['engine'])):
        key, kind, detail = item['key'], item['kind'], item['detail']
        engine = parse_iso(item['engine'])
        if kind == 'lunation':
            at, info = solve_lunation(key, engine, detail)
        elif kind == 'eclipse':
            at, info = solve_eclipse(key, engine, detail)
        elif kind == 'station':
            at, info = solve_station(key, engine, detail, hints.get(('stations', detail['body'], iso_ms(engine))))
        elif kind == 'ingress':
            at, info = solve_ingress(key, engine, detail, hints.get(('ingresses', detail['body'], iso_ms(engine))))
        elif kind == 'aspect':
            at, info = solve_aspect(key, engine, detail, hints.get(('aspects', '%s|%s' % (detail['a'], detail['b']), iso_ms(engine))))
        else:
            at, info = solve_shadow(key, engine, detail, results)
        results[key] = {
            'kind': kind, 'detail': detail, 'pages': item['pages'],
            'engine': iso_ms(engine),
            'horizons': iso_ms(at),
            'horizonsMinusEngineSeconds': round((at - engine).total_seconds(), 3),
            **info,
        }
        print('%-62s %s  %+9.1f s' % (key, iso_ms(at), (at - engine).total_seconds()))
    out = {
        'what': 'Sky events named on the in-scope 2027 event pages, solved on NASA JPL Horizons',
        'source': 'NASA JPL Horizons API, OBSERVER tables from the geocentre (500@399), apparent ecliptic longitude and latitude of date (QUANTITIES 31; 20 adds range for eclipses), DE441, EXTRA_PREC YES',
        'timeScale': 'UT as Horizons prints it: UTC, with the last announced leap second held for future dates (TT minus UTC = 69.184 s)',
        'queries': 'horizons-queries.json lists each query URL, retrieval time, response SHA-256 and Horizons header; an event names its queries by key',
        'events': dict(sorted(results.items(), key=lambda kv: (kv[1]['horizons'], kv[0]))),
    }
    with open(OUT, 'w') as f:
        f.write(json.dumps(out, indent=1, ensure_ascii=False) + '\n')
    print('%d events -> %s' % (len(results), OUT))


if __name__ == '__main__':
    main()
