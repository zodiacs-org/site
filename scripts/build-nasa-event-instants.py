"""Write src/data/nasa-event-instants.json: the site's sky event times from NASA.

The site's engine places the planets a few arcseconds from NASA JPL's DE441
(Venus up to 20 arcseconds near inferior conjunction, Saturn about 6, Neptune
about 10). For a slow planet that small error becomes minutes or hours in an
event's time. This script solves each event the site publishes on NASA JPL
Horizons instead, and writes one table the pages read
(src/lib/nasa-instants.ts):

  ingresses  every sign entry, retrograde re-entries included, of Mercury to
             Pluto over the daily range (2025-11 to 2031-05) and of Jupiter to
             Pluto over src/data/ingresses.json's long horizons
  stations   every retrograde and direct station of Mercury to Pluto over the
             daily range
  aspects    every exact aspect the monthly catalogs
             (src/data/transits-YYYY-MM.json) publish, solved near the
             catalog's own instant

Each row keeps the NASA instant (UTC, to the second) and the engine instants
it replaces, as the committed data files record them, so a page can find its
row. The Sun and the Moon are left out: the engine already places their
events within a minute of NASA, and the table records how close.

The NASA side reuses the accuracy audit: scripts/accuracy-audit/horizons_fetch.py
fetches the Horizons tables (OBSERVER, QUANTITIES 31: apparent geocentric
ecliptic longitude of date, DE441, TIME_TYPE UT, so UTC from 1962 and UT1
before) and records each query URL, retrieval time and SHA-256 in
docs/accuracy-audit-2026-11/raw/MANIFEST.json; truth.py interpolates them
(nine-point Lagrange) and finds roots by bisection to 1e-9 day. Only the
derived instants are committed, never the raw responses.

Usage:
  python3 scripts/build-nasa-event-instants.py           # fetch if needed, then write the table
  python3 scripts/build-nasa-event-instants.py --check   # rebuild from the kept responses and compare

CI cannot reach NASA, so --check needs the responses on disk (horizons_fetch.py
downloads them again). The offline test is src/lib/nasa-instants.test.ts.
"""
from __future__ import annotations

import datetime
import glob
import hashlib
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, os.pardir))
sys.path.insert(0, os.path.join(HERE, 'accuracy-audit'))

import horizons_fetch as H  # noqa: E402
import truth as T  # noqa: E402

OUT = os.path.join(ROOT, 'src', 'data', 'nasa-event-instants.json')
DATA = os.path.join(ROOT, 'src', 'data')
PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
SLOW = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
TABLES = {
    'Sun': ['dense-sun'],
    'Mercury': ['dense-mercury'], 'Venus': ['dense-venus'], 'Mars': ['dense-mars'],
    'Jupiter': ['dense-jupiter', 'long-jupiter'], 'Saturn': ['dense-saturn', 'long-saturn'],
    'Uranus': ['dense-uranus', 'long-uranus'], 'Neptune': ['dense-neptune', 'long-neptune'],
    'Pluto': ['dense-pluto', 'long-pluto'],
}
ASPECT_ANGLE = {'conjunction': 0, 'sextile': 60, 'square': 90, 'trine': 120, 'opposition': 180}
# An engine record and its NASA event are the same event when they lie this
# close; src/lib/nasa-instants.ts matches with the same window.
MATCH_WINDOW_DAYS = 2.0
FAST_TOLERANCE_S = 60.0


def wrap180(x):
    return (x + 180.0) % 360.0 - 180.0


def iso_second(jd):
    """UTC instant rounded to the second, written without a fraction."""
    base = datetime.datetime(2000, 1, 1, 12, tzinfo=datetime.timezone.utc)
    dt = base + datetime.timedelta(days=jd - T.J2000)
    dt = (dt + datetime.timedelta(microseconds=500_000)).replace(microsecond=0)
    return dt.strftime('%Y-%m-%dT%H:%M:%SZ')


def load(name):
    with open(os.path.join(DATA, name)) as f:
        return json.load(f)


def raw_present():
    return all(os.path.exists(os.path.join(H.STORE, t[0] + '.txt')) for t in H.TABLES)


# --- the site's engine instants ---------------------------------------------------
def engine_records():
    """Every ingress, station and aspect instant the site's data files carry."""
    ingresses, stations, aspects = [], [], []
    for path in sorted(glob.glob(os.path.join(DATA, 'transits-*.json'))):
        t = json.load(open(path))
        src = 'transits-%s.json' % t['month']
        for x in t['ingresses']:
            ingresses.append({'body': x['planet'], 'sign': x['sign'], 'at': x['at'], 'source': src})
        for x in t['stations']:
            stations.append({'body': x['planet'], 'type': x['type'], 'at': x['at'], 'source': src})
        for x in t['aspects']:
            aspects.append({'a': x['a'], 'b': x['b'], 'type': x['type'], 'at': x['at'], 'aSign': x['aSign'], 'source': src})
    ing = load('ingresses.json')
    horizon = {}
    for h in ing['horizons']:
        for p in h['planets']:
            horizon[p] = (h['from'] + 'T00:00:00.000Z', h['to'] + 'T00:00:00.000Z')
    for w in ing['windows']:
        lo, hi = horizon[w['planet']]
        if lo < w['from'] < hi:
            ingresses.append({'body': w['planet'], 'sign': w['sign'], 'at': w['from'], 'source': 'ingresses.json'})
    sky = load('sky.json')
    for r in sky['retrogrades']:
        if r['from'] != sky['from']:
            stations.append({'body': r['planet'], 'type': 'retrograde', 'at': r['from'], 'source': 'sky.json'})
        if r['to']:
            stations.append({'body': r['planet'], 'type': 'direct', 'at': r['to'], 'source': 'sky.json'})
    pub = load('events-publication.json')
    for p in pub['pages']:
        if p['family'] == 'ingress':
            ingresses.append({'body': p['bodies'][0], 'sign': p['signs'][0], 'at': p['anchor'], 'source': 'events-publication.json'})
        elif p['family'] == 'aspect':
            aspect_type = p['id'].split('-')[1]
            aspects.append({'a': p['bodies'][0], 'b': p['bodies'][1], 'type': aspect_type, 'at': p['anchor'],
                            'aSign': p['signs'][0], 'source': 'events-publication.json'})
    program = load('horoscope-program.json')
    for e in program['evidence']:
        if e.get('kind') != 'sky-event':
            continue
        if e.get('eventKind') == 'ingress':
            ingresses.append({'body': e['body'], 'sign': e['sign'], 'at': e['at'], 'source': 'horoscope-program.json'})
        elif e.get('eventKind') == 'station':
            stations.append({'body': e['body'], 'type': e['eventType'], 'at': e['at'], 'source': 'horoscope-program.json'})
        elif e.get('eventKind') == 'aspect':
            aspects.append({'a': e['a'], 'b': e['b'], 'type': e['eventType'], 'at': e['at'], 'aSign': e.get('sign'),
                            'source': 'horoscope-program.json'})
    return ingresses, stations, aspects


# --- NASA events ------------------------------------------------------------------
class Bodies:
    def __init__(self):
        self.b = {name: T.Body(name, tables) for name, tables in TABLES.items()}

    def lon(self, body, jd):
        return self.b[body].lon(jd)

    def speed(self, body, jd):
        return self.b[body].speed(jd)


def nasa_ingresses(bodies, body):
    seen, out = [], []
    for s in bodies.b[body].series:
        for e in T.ingresses_in(s):
            if any(abs(e['jd'] - x) < 0.05 for x in seen):
                continue
            seen.append(e['jd'])
            out.append(e)
    return sorted(out, key=lambda e: e['jd'])


def nasa_stations(bodies, body):
    return T.stations_in(bodies.b[body].series[0])


def aspect_root(bodies, a, b, angle, jd_guess, span=4.0):
    """The exact aspect nearest jd_guess: lon_a - lon_b = +-angle."""
    best = None
    for target in ({angle, -angle} if angle not in (0, 180) else {angle}):
        def f(t):
            return wrap180(bodies.lon(a, t) - bodies.lon(b, t) - target)
        step = 0.05
        t = jd_guess - span
        f0 = f(t)
        while t < jd_guess + span:
            t1 = t + step
            f1 = f(t1)
            if (f0 <= 0 < f1 or f1 <= 0 < f0) and abs(f1 - f0) < 90:
                lo, hi, flo = t, t1, f0
                while hi - lo > 1e-9:
                    mid = 0.5 * (lo + hi)
                    fm = f(mid)
                    if (fm > 0) == (flo > 0):
                        lo, flo = mid, fm
                    else:
                        hi = mid
                r = 0.5 * (lo + hi)
                if best is None or abs(r - jd_guess) < abs(best - jd_guess):
                    best = r
            t, f0 = t1, f1
    return best


def series_bounds(body):
    """[first, last] UT JD the body's tables cover with room for interpolation."""
    lo, hi = None, None
    for name in TABLES[body]:
        rows = T.parse(name)
        a, b = rows[0][0] + 5, rows[-1][0] - 5
        lo = a if lo is None else min(lo, a)
        hi = b if hi is None else max(hi, b)
    return lo, hi


def provenance():
    manifest = H.load_manifest()
    used = sorted({name for names in TABLES.values() for name in names})
    queries = []
    for name in used:
        entry = manifest['responses'][name]
        data = open(os.path.join(H.STORE, entry['file']), 'rb').read()
        digest = hashlib.sha256(data).hexdigest()
        if digest != entry['sha256']:
            raise SystemExit('%s does not match the SHA-256 in MANIFEST.json' % name)
        q = entry['query']
        queries.append({
            'name': name, 'body': entry['body'], 'url': entry['url'],
            'start': q['START_TIME'], 'stop': q['STOP_TIME'], 'step': q['STEP_SIZE'],
            'retrievedUtc': entry['retrievedUtc'], 'bytes': entry['bytes'], 'sha256': digest,
        })
    return {
        'source': 'NASA JPL Horizons API (https://ssd.jpl.nasa.gov/api/horizons.api)',
        'ephemeris': 'DE441',
        'quantity': 'apparent geocentric ecliptic longitude of date (OBSERVER table, QUANTITIES 31, CENTER 500@399, APPARENT AIRLESS, EXTRA_PREC YES)',
        'timeScale': 'TIME_TYPE UT: UTC from 1962, UT1 before',
        'targets': 'Sun 10, Mercury 199, Venus 299, system barycentres 4 to 9 for Mars to Pluto',
        'method': 'nine-point Lagrange interpolation of each table, roots by bisection to 1e-9 day (scripts/accuracy-audit/truth.py, docs/engine-validation/independent-references/tools/series.py); instants rounded to the second',
        'generator': 'scripts/build-nasa-event-instants.py',
        'manifest': 'docs/accuracy-audit-2026-11/raw/MANIFEST.json',
        'queries': queries,
    }


def build():
    if not raw_present():
        for t in H.TABLES:
            H.fetch(*t)
    bodies = Bodies()
    eng_ing, eng_sta, eng_asp = engine_records()
    problems = []

    # ingresses
    ingress_rows = []
    by_body = {}
    for body in PLANETS:
        lo, hi = series_bounds(body)
        evs = [e for e in nasa_ingresses(bodies, body) if lo < e['jd'] < hi]
        by_body[body] = evs
        for e in evs:
            ingress_rows.append({'body': body, 'sign': e['sign'], 'retrograde': e['retrograde'],
                                 'nasa': iso_second(e['jd']), 'jd': e['jd'], 'engine': set()})
    sun_diffs = []
    for r in eng_ing:
        if r['body'] in ('Sun', 'Moon'):
            if r['body'] == 'Sun':
                ev = min(nasa_ingresses(bodies, 'Sun'), key=lambda e: abs(e['jd'] - T.iso_to_jd(r['at'])))
                sun_diffs.append(abs(T.iso_to_jd(r['at']) - ev['jd']) * 86400)
            continue
        j = T.iso_to_jd(r['at'])
        cands = [x for x in ingress_rows if x['body'] == r['body'] and x['sign'] == r['sign']
                 and abs(x['jd'] - j) <= MATCH_WINDOW_DAYS]
        if len(cands) != 1:
            problems.append('ingress %s %s %s (%s): %d NASA matches' % (r['body'], r['sign'], r['at'], r['source'], len(cands)))
            continue
        cands[0]['engine'].add(r['at'])

    # stations
    station_rows = []
    for body in PLANETS:
        for e in nasa_stations(bodies, body):
            station_rows.append({'body': body, 'type': e['type'], 'nasa': iso_second(e['jd']), 'jd': e['jd'],
                                 'sign': e['sign'], 'engine': set()})
    for r in eng_sta:
        j = T.iso_to_jd(r['at'])
        cands = [x for x in station_rows if x['body'] == r['body'] and x['type'] == r['type']
                 and abs(x['jd'] - j) <= MATCH_WINDOW_DAYS]
        if len(cands) != 1:
            problems.append('station %s %s %s (%s): %d NASA matches' % (r['body'], r['type'], r['at'], r['source'], len(cands)))
            continue
        cands[0]['engine'].add(r['at'])

    # aspects, solved near each catalog instant
    aspect_rows = {}
    for r in eng_asp:
        j = T.iso_to_jd(r['at'])
        root = aspect_root(bodies, r['a'], r['b'], ASPECT_ANGLE[r['type']], j)
        if root is None or abs(root - j) > MATCH_WINDOW_DAYS:
            problems.append('aspect %s %s %s %s (%s): no NASA root within %g days' % (r['a'], r['type'], r['b'], r['at'], r['source'], MATCH_WINDOW_DAYS))
            continue
        nasa = iso_second(root)
        key = (r['a'], r['b'], r['type'], nasa)
        row = aspect_rows.get(key)
        if row is None:
            la = bodies.lon(r['a'], root)
            row = aspect_rows[key] = {'a': r['a'], 'b': r['b'], 'type': r['type'], 'nasa': nasa, 'jd': root,
                                      'aSign': T.SIGNS[int(la // 30) % 12], 'engine': set()}
        if r.get('aSign') and r['aSign'] != row['aSign'] and r['source'] != 'horoscope-program.json':
            problems.append('aspect %s %s %s %s: engine puts %s in %s, NASA in %s' % (r['a'], r['type'], r['b'], r['at'], r['a'], r['aSign'], row['aSign']))
        row['engine'].add(r['at'])

    # every row's engine instants must not be claimed by two rows
    for rows, label in ((ingress_rows, 'ingress'), (station_rows, 'station'), (list(aspect_rows.values()), 'aspect')):
        seen = {}
        for x in rows:
            for at in x['engine']:
                k = (x.get('body') or (x['a'], x['b'], x['type']), at)
                if k in seen:
                    problems.append('%s engine instant %s matches two NASA rows' % (label, at))
                seen[k] = x

    if problems:
        raise SystemExit('cannot build the table:\n  ' + '\n  '.join(problems))

    def offset_s(row):
        return [round((T.iso_to_jd(at) - row['jd']) * 86400) for at in sorted(row['engine'])]

    def finish(row, keys):
        out = {k: row[k] for k in keys}
        out['engine'] = sorted(row['engine'])
        return out

    ingress_out = [finish(x, ['body', 'sign', 'retrograde', 'nasa']) for x in sorted(ingress_rows, key=lambda x: (x['jd'], x['body']))]
    station_out = [finish(x, ['body', 'type', 'sign', 'nasa']) for x in sorted(station_rows, key=lambda x: (x['jd'], x['body']))]
    aspect_out = [finish(x, ['a', 'b', 'type', 'aSign', 'nasa']) for x in sorted(aspect_rows.values(), key=lambda x: (x['jd'], x['a'], x['b']))]

    def worst(rows):
        vals = [abs(s) for x in rows for s in offset_s(x)]
        return max(vals) if vals else 0

    coverage = {}
    for body in PLANETS:
        lo, hi = series_bounds(body)
        dense = T.parse(TABLES[body][0])
        coverage[body] = {
            'ingresses': '%s to %s' % (iso_second(lo)[:10], iso_second(hi)[:10]),
            'stations': '%s to %s' % (iso_second(dense[0][0] + 5)[:10], iso_second(dense[-1][0] - 5)[:10]),
        }
    sun_worst = max(sun_diffs) if sun_diffs else 0.0
    if sun_worst > FAST_TOLERANCE_S:
        raise SystemExit('a Sun ingress is %.1f s from NASA; the Sun must join the table' % sun_worst)

    return {
        'schema': 'zodiacs.nasa-event-instants.v1',
        'what': 'Times of the sky events the site prints, solved on NASA JPL Horizons (DE441). Each row keeps the NASA instant (UTC, to the second) and the engine instants it replaces, as the committed data files record them.',
        'matchWindowDays': MATCH_WINDOW_DAYS,
        'provenance': provenance(),
        'coverage': coverage,
        'withinOneMinute': {
            'note': 'Left out of the table: the engine already places these within a minute of NASA',
            'sunIngresses': {'count': len(sun_diffs), 'maxSeconds': round(sun_worst, 1)},
            'lunations': 'every new and full Moon agrees with NASA to the second (docs/accuracy-audit-2026-11/REPORT.md)',
            'moonIngresses': 'every Moon sign change agrees with NASA to the second (docs/accuracy-audit-2026-11/REPORT.md)',
        },
        'largestCorrectionSeconds': {
            'ingresses': worst(ingress_rows), 'stations': worst(station_rows), 'aspects': worst(list(aspect_rows.values())),
        },
        'ingresses': ingress_out,
        'stations': station_out,
        'aspects': aspect_out,
    }


def render(table):
    """One row per line, so a diff reads event by event."""
    head = {k: v for k, v in table.items() if k not in ('ingresses', 'stations', 'aspects')}
    text = json.dumps(head, indent=2, ensure_ascii=False)[:-2]
    for key in ('ingresses', 'stations', 'aspects'):
        rows = ',\n'.join('    ' + json.dumps(r, ensure_ascii=False, separators=(', ', ': ')) for r in table[key])
        text += ',\n  "%s": [\n%s\n  ]' % (key, rows)
    return text + '\n}\n'


def main():
    check = '--check' in sys.argv
    if check and not raw_present():
        raise SystemExit('--check needs the Horizons responses: run python3 scripts/accuracy-audit/horizons_fetch.py first')
    text = render(build())
    if check:
        current = open(OUT).read() if os.path.exists(OUT) else ''
        if current != text:
            raise SystemExit('src/data/nasa-event-instants.json is stale: run python3 scripts/build-nasa-event-instants.py')
        print('src/data/nasa-event-instants.json is current')
        return
    with open(OUT, 'w') as f:
        f.write(text)
    t = json.loads(text)
    print('wrote', os.path.relpath(OUT, ROOT), {k: len(t[k]) for k in ('ingresses', 'stations', 'aspects')}, t['largestCorrectionSeconds'])


if __name__ == '__main__':
    main()
