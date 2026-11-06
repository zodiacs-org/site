"""Audit the sky data the site publishes from (src/data/*.json) against NASA.

Every instant, sign and degree in the published data files is recomputed from
the kept NASA JPL Horizons tables (truth.py) or the NASA Espenak and Meeus
eclipse catalogue, never from the site's engine. Writes
docs/accuracy-audit-2026-11/results/data.json.
"""
from __future__ import annotations

import glob
import json
import math
import os

import common as C

DATA = os.path.join(C.ROOT, 'src', 'data')
PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']


def load(name):
    with open(os.path.join(DATA, name)) as f:
        return json.load(f)


def wrap180(x):
    return (x + 180.0) % 360.0 - 180.0


# --- instants solved on the truth series -------------------------------------
def crossing(body, level, jd_a, jd_b):
    """First instant in [jd_a, jd_b] where the body's longitude crosses `level` (any direction)."""
    b = C.bodies()[body]
    step = 0.25
    t = jd_a
    f0 = wrap180(b.lon(t) - level)
    while t < jd_b:
        t1 = min(t + step, jd_b)
        f1 = wrap180(b.lon(t1) - level)
        if (f0 <= 0 < f1 or f1 <= 0 < f0) and abs(f1 - f0) < 90:
            lo, hi, flo = t, t1, f0
            while hi - lo > 1e-9:
                mid = 0.5 * (lo + hi)
                fm = wrap180(b.lon(mid) - level)
                if (fm > 0) == (flo > 0):
                    lo, flo = mid, fm
                else:
                    hi = mid
            return 0.5 * (lo + hi)
        t, f0 = t1, f1
    return None


def last_crossing(body, level, jd_a, jd_b):
    b = C.bodies()[body]
    step = 0.25
    t = jd_b
    f0 = wrap180(b.lon(t) - level)
    while t > jd_a:
        t1 = max(t - step, jd_a)
        f1 = wrap180(b.lon(t1) - level)
        if (f0 <= 0 < f1 or f1 <= 0 < f0) and abs(f1 - f0) < 90:
            lo, hi, fhi = t1, t, f0
            while hi - lo > 1e-9:
                mid = 0.5 * (lo + hi)
                fm = wrap180(b.lon(mid) - level)
                if (fm > 0) == (fhi > 0):
                    hi, fhi = mid, fm
                else:
                    lo = mid
            return 0.5 * (lo + hi)
        t, f0 = t1, f1
    return None


ASPECT_ANGLE = {'conjunction': 0, 'sextile': 60, 'square': 90, 'trine': 120, 'opposition': 180}


def aspect_exact(a, b, angle, jd_guess, span=4.0):
    """Exact aspect instant nearest jd_guess: |lon_a - lon_b| = angle."""
    A, B = C.bodies()[a], C.bodies()[b]
    best = None
    for target in ({angle, -angle} if angle not in (0, 180) else {angle}):
        def f(t):
            return wrap180(A.lon(t) - B.lon(t) - target)
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


def aspect_tolerance_s(a, b, j):
    rel = abs(C.speed(a, j) - C.speed(b, j))
    if rel < 1e-9:
        return C.TOL_STATION_S
    return min(C.TOL_STATION_S, max(C.TOL_INSTANT_S, 0.0005 / rel * 86400.0))


# --- individual audits ---------------------------------------------------------
def audit_stations(claims, src, planet, kind, at, sign=None, degree=None, statement=None):
    j = C.jd(at)
    ev = C.nearest(C.events()['stations'][planet], j, lambda e: e['type'] == kind)
    d = C.secs(j, ev['jd'])
    ok = abs(d) <= C.TOL_STATION_S
    note = ''
    if sign is not None:
        if sign != ev['sign']:
            ok = False
            note += 'sign differs; '
    if degree is not None:
        dd = (degree - ev['degree']) * 3600
        note += 'degree diff %.1f arcsec; ' % dd
        if abs(dd) > 36:
            ok = False
    claims.add('station', src, statement or '%s stations %s %s' % (planet, kind, at),
               at, ev['at'], '%+.0f s' % d, ok, note.strip())
    return ev


def audit_sky(claims):
    sky = load('sky.json')
    src = 'src/data/sky.json'
    a, b = C.jd(sky['from']), C.jd(sky['to'])
    for r in sky['retrogrades']:
        p = r['planet']
        if r['from'] != sky['from']:
            ev_r = audit_stations(claims, src, p, 'retrograde', r['from'], statement='%s retrograde window starts %s' % (p, r['from']))
        else:
            ev_r = None
        if C.jd(r['to']) < C.bodies()[p].series[0].stop + 2451545.0 - 3:
            ev_d = audit_stations(claims, src, p, 'direct', r['to'], statement='%s retrograde window ends %s' % (p, r['to']))
        else:
            ev_d = None
        if r.get('preShadowStart') and ev_d:
            level = ev_d['lon']
            t = last_crossing(p, level, C.jd(r['from']) - 400, C.jd(r['from']) - 0.01)
            j = C.jd(r['preShadowStart'])
            d = C.secs(j, t)
            claims.add('shadow', src, '%s pre-shadow starts %s' % (p, r['preShadowStart']),
                       r['preShadowStart'], C.iso(t), '%+.0f s' % d, abs(d) <= C.TOL_STATION_S,
                       'instant the planet first reaches its direct-station longitude')
        if r.get('postShadowEnd') and ev_r:
            level = ev_r['lon']
            t = crossing(p, level, C.jd(r['to']) + 0.01, C.jd(r['to']) + 400)
            if t is None:
                continue
            j = C.jd(r['postShadowEnd'])
            d = C.secs(j, t)
            claims.add('shadow', src, '%s post-shadow ends %s' % (p, r['postShadowEnd']),
                       r['postShadowEnd'], C.iso(t), '%+.0f s' % d, abs(d) <= C.TOL_STATION_S,
                       'instant the planet returns to its retrograde-station longitude')
    # completeness: every Horizons station inside [from, to) appears
    starts = {(r['planet'], r['from'][:13]) for r in sky['retrogrades']}
    ends = {(r['planet'], r['to'][:13]) for r in sky['retrogrades']}
    for p in PLANETS:
        for e in C.events()['stations'][p]:
            if not (a <= e['jd'] < b):
                continue
            pool = starts if e['type'] == 'retrograde' else ends
            hit = any(q == p and abs(C.jd(t + ':00:00Z') - e['jd']) < 0.1 for q, t in pool)
            claims.add('completeness', src, '%s station %s on %s is listed' % (p, e['type'], e['at'][:10]),
                       'listed' if hit else 'missing', e['at'], '', hit)
    for m in sky['moons']:
        typ = m['type']
        j = C.jd(m['at'])
        ev = C.nearest(C.events()['lunations'], j, lambda e: e['type'] == typ)
        d = C.secs(j, ev['jd'])
        claims.add('lunation', src, '%s moon %s' % (typ, m['at']), m['at'], ev['at'], '%+.1f s' % d,
                   abs(d) <= C.TOL_INSTANT_S)
    listed = [C.jd(m['at']) for m in sky['moons']]
    for e in C.events()['lunations']:
        if e['type'] in ('new', 'full') and a <= e['jd'] < b:
            hit = any(abs(x - e['jd']) < 0.1 for x in listed)
            claims.add('completeness', src, '%s moon on %s is listed' % (e['type'], e['at'][:10]),
                       'listed' if hit else 'missing', e['at'], '', hit)


def audit_transits(claims):
    for path in sorted(glob.glob(os.path.join(DATA, 'transits-*.json'))):
        src = 'src/data/' + os.path.basename(path)
        t = json.load(open(path))
        month = t['month']
        for ing in t['ingresses']:
            j = C.jd(ing['at'])
            ev = C.nearest(C.events()['ingresses'][ing['planet']], j)
            d = C.secs(j, ev['jd'])
            ok = abs(d) <= C.TOL_INSTANT_S and ev['sign'] == ing['sign'] and ev['retrograde'] == ing['retrograde']
            claims.add('ingress', src, '%s enters %s %s%s' % (ing['planet'], ing['sign'], ing['at'], ' (retrograde)' if ing['retrograde'] else ''),
                       ing['at'], '%s %s' % (ev['at'], ev['sign']), '%+.1f s' % d, ok)
        # completeness for the planets the files carry
        for p in ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']:
            for e in C.events()['ingresses'][p]:
                if e['at'][:7] != month:
                    continue
                hit = any(i['planet'] == p and abs(C.jd(i['at']) - e['jd']) < 0.01 for i in t['ingresses'])
                claims.add('completeness', src, '%s ingress into %s on %s is listed' % (p, e['sign'], e['at'][:10]),
                           'listed' if hit else 'missing', e['at'], '', hit)
        for lu in t['lunations']:
            j = C.jd(lu['at'])
            ev = C.nearest(C.events()['lunations'], j, lambda e: e['type'] == lu['type'])
            d = C.secs(j, ev['jd'])
            dd = (lu['degree'] - ev['degree']) * 3600
            ok = abs(d) <= C.TOL_INSTANT_S and lu['sign'] == ev['sign'] and C.dms_trunc(lu['degree']) == C.dms_trunc(ev['degree'])
            claims.add('lunation', src, '%s moon %s at %s %s' % (lu['type'], lu['at'], C.fmt_dm(lu['degree']), lu['sign']),
                       '%s %s' % (lu['at'], C.fmt_dm(lu['degree'], lu['sign'])), '%s %s' % (ev['at'], C.fmt_dm(ev['degree'], ev['sign'])),
                       '%+.1f s, %+.1f arcsec' % (d, dd), ok)
        for e in C.events()['lunations']:
            if e['type'] in ('new', 'full') and e['at'][:7] == month:
                hit = any(abs(C.jd(x['at']) - e['jd']) < 0.1 for x in t['lunations'])
                claims.add('completeness', src, '%s moon on %s is listed' % (e['type'], e['at'][:10]),
                           'listed' if hit else 'missing', e['at'], '', hit)
        for st in t['stations']:
            ev = audit_stations(claims, src, st['planet'], st['type'], st['at'], st['sign'], st['degree'],
                                '%s stations %s %s at %s' % (st['planet'], st['type'], st['at'], C.fmt_dm(st['degree'], st['sign'])))
            if C.dms_trunc(st['degree']) != C.dms_trunc(ev['degree']):
                claims.add('degree-display', src, '%s %s station shown as %s' % (st['planet'], st['type'], C.fmt_dm(st['degree'], st['sign'])),
                           C.fmt_dm(st['degree'], st['sign']), C.fmt_dm(ev['degree'], ev['sign']),
                           '%+.1f arcsec' % ((st['degree'] - ev['degree']) * 3600), False,
                           'truncated minute differs')
        for p in PLANETS:
            for e in C.events()['stations'][p]:
                if e['at'][:7] == month:
                    hit = any(s['planet'] == p and s['type'] == e['type'] for s in t['stations'])
                    claims.add('completeness', src, '%s station %s on %s is listed' % (p, e['type'], e['at'][:10]),
                               'listed' if hit else 'missing', e['at'], '', hit)
        for asp in t['aspects']:
            j = C.jd(asp['at'])
            ang = ASPECT_ANGLE[asp['type']]
            tx = aspect_exact(asp['a'], asp['b'], ang, j)
            if tx is None:
                claims.add('aspect', src, '%s %s %s %s' % (asp['a'], asp['type'], asp['b'], asp['at']), asp['at'],
                           'no exact aspect within 4 days', '', False)
                continue
            d = C.secs(j, tx)
            tol = aspect_tolerance_s(asp['a'], asp['b'], tx)
            la = C.lon(asp['a'], tx)
            ok = abs(d) <= tol and C.sign_of(la) == asp['aSign']
            claims.add('aspect', src, '%s %s %s %s at %.1f° %s' % (asp['a'], asp['type'], asp['b'], asp['at'], asp['aDegree'], asp['aSign']),
                       asp['at'], '%s, %s at %.2f° %s' % (C.iso(tx), asp['a'], la % 30, C.sign_of(la)),
                       '%+.0f s (tolerance %.0f s)' % (d, tol), ok)


def audit_eclipses(claims):
    ecl = load('eclipses.json')
    nasa = json.load(open(os.path.join(C.ROOT, 'docs', 'engine-validation', 'sky-events-references', 'nasa-eclipses-2025-2030.json')))
    kinds = {'T': 'total', 'A': 'annular', 'H': 'hybrid', 'P': 'partial', 'N': 'penumbral'}
    src = 'src/data/eclipses.json'
    for e in ecl['eclipses']:
        cat = nasa['solar' if e['type'] == 'solar' else 'lunar']
        row = next((r for r in cat if r['date'] == e['peak'][:10]), None)
        if row is None:
            # the NASA date is the TD date of greatest eclipse; try a day either side
            row = min(cat, key=lambda r: abs(C.jd(r['date'] + 'T' + r['greatestEclipseTD'] + 'Z') - C.jd(e['peak'])))
        td = C.jd(row['date'] + 'T' + row['greatestEclipseTD'] + 'Z')
        utc = td - C.TT_MINUS_UTC_S / 86400.0
        d = C.secs(C.jd(e['peak']), utc)
        claims.add('eclipse-instant', src, '%s %s eclipse peak %s' % (e['kind'], e['type'], e['peak']), e['peak'],
                   '%s (NASA greatest eclipse %s TD, TT-UTC 69.184 s)' % (C.iso(utc), row['greatestEclipseTD']),
                   '%+.1f s' % d, abs(d) <= C.TOL_INSTANT_S, 'NASA canon catalogue no. %s' % row['catalog'])
        nk = kinds[row['type'][0]]
        claims.add('eclipse-type', src, '%s %s eclipse on %s' % (e['kind'], e['type'], e['peak'][:10]), e['kind'], nk + ' (NASA type %s)' % row['type'], '',
                   nk == e['kind'] or (nk == 'hybrid' and e['kind'] in ('total', 'annular')))
        body = 'Sun' if e['type'] == 'solar' else 'Moon'
        lon = C.lon(body, utc)
        ok_sign = C.sign_of(lon) == e['sign']
        claims.add('eclipse-sign', src, '%s eclipse %s in %s at %.2f°' % (e['type'], e['peak'][:10], e['sign'], e['lon']),
                   '%s %.2f°' % (e['sign'], e['lon']), '%s %.3f° (%s at NASA greatest eclipse)' % (C.sign_of(lon), lon, body),
                   '%+.3f°' % wrap180(e['lon'] - lon), ok_sign and abs(wrap180(e['lon'] - lon)) < 0.02)
        if e['type'] == 'lunar':
            import nasa_lunar_catalog as NL
            nl = NL.rows().get(row['date'])
            if nl:
                pen_mag, um_mag = float(nl['fields'][1]), float(nl['fields'][2])
                tot = nl['fields'][5]
                if 'totalMinutes' in e:
                    ok = tot != '-' and abs(e['totalMinutes'] - float(tot)) <= 1.0
                    claims.add('eclipse-duration', src, 'total lunar eclipse %s: totality about %d minutes' % (row['date'], e['totalMinutes']),
                               '%d min' % e['totalMinutes'], '%s min (NASA canon, total phase)' % tot,
                               '%+.1f min' % (e['totalMinutes'] - float(tot)) if tot != '-' else '', ok,
                               'within a minute is read as "about"; NASA uses Chauvenet\'s 1/50 shadow enlargement')
                if e['kind'] == 'penumbral' and pen_mag < 0.05:
                    claims.add('eclipse-note', src, 'penumbral lunar eclipse %s listed as an eclipse' % row['date'], 'penumbral',
                               'NASA penumbral magnitude %.4f (type %s): a graze, invisible to the eye' % (pen_mag, nl['type']), '', True,
                               'true, but worth saying it cannot be seen')
        # the published "degree" field is rounded to 0.1; its truncated integer must match
        if int(math.floor(e['degree'])) != int(math.floor(lon % 30)):
            claims.add('degree-display', src, '%s eclipse %s degree field %.1f' % (e['type'], e['peak'][:10], e['degree']),
                       '%.1f -> %d° when truncated' % (e['degree'], math.floor(e['degree'])),
                       '%s (truncates to %d°)' % (C.fmt_dm(lon % 30, C.sign_of(lon)), math.floor(lon % 30)), '', False,
                       'the stored 0.1° rounding crosses a whole degree')


def audit_ingress_windows(claims):
    ing = load('ingresses.json')
    src = 'src/data/ingresses.json'
    horizon = {}
    for h in ing['horizons']:
        for p in h['planets']:
            horizon[p] = (C.jd(h['from'] + 'T00:00:00Z'), C.jd(h['to'] + 'T00:00:00Z'))
    seen = set()
    for w in ing['windows']:
        p = w['planet']
        for edge in ('from', 'to'):
            at = w[edge]
            if (p, at) in seen:
                continue
            seen.add((p, at))
            j = C.jd(at)
            lo, hi = horizon[p]
            if not (lo < j < hi):
                continue
            try:
                ev = C.nearest(C.events()['ingresses'][p], j)
            except Exception:
                continue
            if ev is None or abs(ev['jd'] - j) > 30:
                claims.add('ingress', src, '%s window %s %s' % (p, edge, at), at, 'no Horizons ingress within 30 days', '', False)
                continue
            d = C.secs(j, ev['jd'])
            tol = C.TOL_INSTANT_S
            claims.add('ingress', src, '%s sign window %s %s (%s)' % (p, edge, at, w['sign']), at, '%s %s' % (ev['at'], ev['sign']),
                       '%+.1f s' % d, abs(d) <= tol, 'pre-1962 instants use UT1' if at < '1962' else '')
    # completeness within horizons
    for p, (lo, hi) in horizon.items():
        pts = sorted({C.jd(w['from']) for w in ing['windows'] if w['planet'] == p} | {C.jd(w['to']) for w in ing['windows'] if w['planet'] == p})
        for e in C.events()['ingresses'][p]:
            if lo + 1 < e['jd'] < hi - 1:
                hit = any(abs(x - e['jd']) < 0.05 for x in pts)
                if not hit:
                    claims.add('completeness', src, '%s ingress into %s on %s is listed' % (p, e['sign'], e['at'][:10]),
                               'missing', e['at'], '', False)
                else:
                    claims.add('completeness', src, '%s ingress into %s on %s is listed' % (p, e['sign'], e['at'][:10]),
                               'listed', e['at'], '', True)


def audit_moon_ingresses(claims):
    m = load('aura-moon-ingresses.json')
    src = 'src/data/aura-moon-ingresses.json'
    for x in m['ingresses']:
        j = C.jd(x['at'])
        ev = C.nearest(C.events()['ingresses']['Moon'], j)
        d = C.secs(j, ev['jd'])
        claims.add('moon-ingress', src, 'Moon enters %s %s' % (x['sign'], x['at']), x['at'], '%s %s' % (ev['at'], ev['sign']),
                   '%+.1f s' % d, abs(d) <= C.TOL_INSTANT_S and ev['sign'] == x['sign'])
    a, b = C.jd(m['from']), C.jd(m['to'])
    listed = [C.jd(x['at']) for x in m['ingresses']]
    miss = [e for e in C.events()['ingresses']['Moon'] if a < e['jd'] < b and not any(abs(y - e['jd']) < 0.05 for y in listed)]
    claims.add('completeness', src, 'every Moon ingress %s to %s is listed' % (m['from'][:10], m['to'][:10]),
               '%d listed' % len(listed), '%d missing' % len(miss), '', not miss)


def audit_birthdays(claims):
    bd = load('birthdays.json')
    src = 'src/data/birthdays.json'
    y0, y1 = bd['yearRange']
    import datetime

    def isleap(y):
        return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)

    sun_ing = C.events()['ingresses']['Sun']
    for slug, e in bd['days'].items():
        m, dday = e['month'], e['day']
        years = [y for y in range(y0, y1 + 1) if not (m == 2 and dday == 29 and not isleap(y))]
        lons = []
        for y in years:
            j = C.jd('%04d-%02d-%02dT12:00:00Z' % (y, m, dday))
            lons.append(C.lon('Sun', j))
        ref = lons[0]
        un = [ref + wrap180(x - ref) for x in lons]
        lo, hi = min(un), max(un)
        ok = abs(lo - e['lonMin']) <= 0.006 and abs(hi - e['lonMax']) <= 0.006
        claims.add('birthday-span', src, '%s Sun span at noon UTC %s to %s' % (slug, e['lonMin'], e['lonMax']),
                   '%.2f to %.2f' % (e['lonMin'], e['lonMax']), '%.4f to %.4f' % (lo % 360, hi % 360), '%+.4f / %+.4f' % (e['lonMin'] - lo, e['lonMax'] - hi), ok,
                   'values stored to 0.01°')
        ny = e['now']['year']
        j = C.jd('%04d-%02d-%02dT12:00:00Z' % (ny, m, dday))
        sl = C.lon('Sun', j)
        claims.add('birthday-now', src, '%s %d noon UTC Sun %.2f°' % (slug, ny, e['now']['lon']), '%.2f' % e['now']['lon'], '%.4f' % sl,
                   '%+.4f°' % wrap180(e['now']['lon'] - sl), abs(wrap180(e['now']['lon'] - sl)) <= 0.006)
        ml = C.lon('Moon', j)
        claims.add('birthday-now', src, '%s %d noon UTC Moon sign %s' % (slug, ny, e['now']['moonSign']), e['now']['moonSign'],
                   '%s (%.3f°)' % (C.sign_of(ml), ml), '', C.sign_of(ml) == e['now']['moonSign'],
                   'Moon %.2f° from a sign boundary' % min(ml % 30, 30 - ml % 30))
        if 'sign' in e:
            bad = [y for y in years if C.sign_of(C.lon('Sun', C.jd('%04d-%02d-%02dT00:00:00Z' % (y, m, dday)))) != e['sign']
                   or C.sign_of(C.lon('Sun', C.jd('%04d-%02d-%02dT23:59:59Z' % (y, m, dday)))) != e['sign']]
            claims.add('birthday-sign', src, '%s is %s in every year %d to %d, all day UTC' % (slug, e['sign'], y0, y1), e['sign'],
                       'holds' if not bad else 'fails in %s' % bad[:5], '', not bad)
        else:
            cusp = e['cusp']
            for ystr, v in cusp['years'].items():
                y = int(ystr)
                d0 = C.jd('%04d-%02d-%02dT00:00:00Z' % (y, m, dday))
                d1 = d0 + 1
                s0 = C.sign_of(C.lon('Sun', d0))
                s1 = C.sign_of(C.lon('Sun', d1 - 1e-6))
                if s0 == s1:
                    truth = 'a' if s0 == cusp['a'] else ('b' if s0 == cusp['b'] else s0)
                    ok = v == truth
                    claims.add('birthday-cusp', src, '%s %d: %s' % (slug, y, v), v, truth, '', ok)
                else:
                    ev = C.nearest(sun_ing, d0 + 0.5)
                    hm = C.hhmm_utc(ev['jd'])
                    if v == hm:
                        ok = True
                        diff = ''
                    elif ':' in v:
                        pub = d0 + (int(v[:2]) * 60 + int(v[3:])) / 1440.0
                        diff = '%+.0f s' % C.secs(pub, ev['jd'])
                        ok = abs(C.secs(pub, ev['jd'])) <= C.TOL_INSTANT_S + 60  # minute-truncated value
                    else:
                        diff = ''
                        ok = False
                    claims.add('birthday-cusp', src, '%s %d ingress minute %s UTC' % (slug, y, v), v, '%s (%s)' % (hm, ev['at']), diff, ok,
                               'ingress inside the UTC day')


def audit_daily(claims):
    d = load('daily.json')
    src = 'src/data/daily.json'
    j = C.jd(d['snapshotAt'])
    for b in d['bodies']:
        lon = C.lon(b['body'], j)
        diff = wrap180(b['lon'] - lon) * 3600
        ok = abs(diff) < 36 and C.sign_of(lon) == b['sign']
        if b['body'] not in ('Sun', 'Moon'):
            retro = C.speed(b['body'], j) < 0
            ok = ok and retro == b['retrograde']
        claims.add('position', src, '%s %s at %s' % (b['body'], C.fmt_dm(b['degree'], b['sign']), d['snapshotAt']),
                   '%.4f° %s' % (b['lon'], 'R' if b['retrograde'] else 'D'), '%.4f° %s' % (lon, 'R' if C.speed(b['body'], j) < 0 else 'D'),
                   '%+.1f arcsec' % diff, ok)
        if C.dms_trunc(b['degree']) != C.dms_trunc(lon % 30):
            claims.add('degree-display', src, '%s shown as %s' % (b['body'], C.fmt_dm(b['degree'], b['sign'])), C.fmt_dm(b['degree'], b['sign']),
                       C.fmt_dm(lon % 30, C.sign_of(lon)), '%+.1f arcsec' % diff, False, 'truncated minute differs')
    # illumination from the elongation: k = (1 - cos E) / 2 (phase angle taken as 180 - E)
    sl, ml = C.lon('Sun', j), C.lon('Moon', j)
    el = math.radians((ml - sl) % 360)
    k = (1 - math.cos(el)) / 2
    claims.add('moon-phase', src, 'Moon %s, %.1f%% lit at %s' % (d['moon']['phase'], d['moon']['illumination'] * 100, d['snapshotAt']),
               '%.3f' % d['moon']['illumination'], '%.3f (from Horizons elongation %.2f°)' % (k, math.degrees(el)),
               '%+.3f' % (d['moon']['illumination'] - k), abs(d['moon']['illumination'] - k) < 0.01)


def main():
    claims = C.Claims()
    audit_sky(claims)
    audit_transits(claims)
    audit_eclipses(claims)
    audit_ingress_windows(claims)
    audit_moon_ingresses(claims)
    audit_birthdays(claims)
    audit_daily(claims)
    path = claims.save('data.json')
    import collections
    tot = collections.Counter((r['category'], r['ok']) for r in claims.rows)
    for k in sorted(tot):
        print(k, tot[k])
    print(path)


if __name__ == '__main__':
    main()
