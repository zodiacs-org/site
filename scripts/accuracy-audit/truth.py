"""Events derived only from the kept NASA JPL Horizons tables.

Interpolation and root finding reuse the engine-validation arbiter's
`series.py` (nine-point Lagrange on a uniform table, bisection to 1e-9 day),
so the audit and the engine references solve the same way. Times here are
Julian days in UT (UTC from 1962), as the tables were requested.

Writes docs/accuracy-audit-2026-11/truth-events.json:
  ingresses  every sign entry of every body (retrograde re-entries included)
  stations   every retrograde and direct station, Mercury to Pluto
  lunations  every new, first quarter, full and last quarter Moon
"""
from __future__ import annotations

import datetime
import json
import math
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, os.pardir, os.pardir))
sys.path.insert(0, os.path.join(ROOT, 'docs', 'engine-validation', 'independent-references', 'tools'))
from series import Series, J2000  # noqa: E402

RAW = os.path.join(ROOT, 'docs', 'accuracy-audit-2026-11', 'raw')
OUT = os.path.join(ROOT, 'docs', 'accuracy-audit-2026-11', 'truth-events.json')

SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra',
         'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']
BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']


def parse(name):
    text = open(os.path.join(RAW, name + '.txt')).read()
    body = text[text.index('$$SOE') + 5:text.index('$$EOE')]
    rows = []
    for line in body.strip().splitlines():
        tok = line.split()
        nums = [t for t in tok if re.fullmatch(r'-?\d+(?:\.\d+)?', t)]
        rows.append((float(tok[0]), float(nums[-2]), float(nums[-1])))
    return rows


def jd_to_iso(jd):
    base = datetime.datetime(2000, 1, 1, 12, tzinfo=datetime.timezone.utc)
    dt = base + datetime.timedelta(days=jd - J2000)
    return dt.strftime('%Y-%m-%dT%H:%M:%S.') + '%03dZ' % (dt.microsecond // 1000)


def iso_to_jd(iso):
    s = iso.replace('Z', '+00:00')
    dt = datetime.datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    base = datetime.datetime(2000, 1, 1, 12, tzinfo=datetime.timezone.utc)
    return J2000 + (dt - base).total_seconds() / 86400.0


class Body:
    """Longitude of one body from its dense table, with the long table as fallback."""

    def __init__(self, name, tables):
        self.name = name
        self.series = [Series(parse(t)) for t in tables]

    def pick(self, t):
        for s in self.series:
            if s.start + 0.5 * 4 * s.h < t < s.stop - 0.5 * 4 * s.h:
                return s
        raise ValueError('%s: no table covers JD %.3f' % (self.name, t + J2000))

    def lon(self, jd):
        return self.pick(jd - J2000).at(jd - J2000) % 360.0

    def speed(self, jd):
        return self.pick(jd - J2000).speed(jd - J2000)


TABLE_SETS = {
    'Sun': ['dense-sun', 'long-sun'],
    'Moon': ['dense-moon-a', 'dense-moon-b'],
    'Mercury': ['dense-mercury'], 'Venus': ['dense-venus'], 'Mars': ['dense-mars'],
    'Jupiter': ['dense-jupiter', 'long-jupiter'], 'Saturn': ['dense-saturn', 'long-saturn'],
    'Uranus': ['dense-uranus', 'long-uranus'], 'Neptune': ['dense-neptune', 'long-neptune'],
    'Pluto': ['dense-pluto', 'long-pluto'],
}


def load_bodies():
    return {b: Body(b, TABLE_SETS[b]) for b in BODIES}


def ingresses_in(series, a=None, b=None):
    a = series.start + 5 * series.h if a is None else a
    b = series.stop - 5 * series.h if b is None else b
    lo_v, hi_v = series.at(a), series.at(b)
    vmin, vmax = min(lo_v, hi_v), max(lo_v, hi_v)
    for t, v, _ in series.extrema(a, b):
        vmin, vmax = min(vmin, v), max(vmax, v)
    out = []
    k0 = math.floor(vmin / 30.0)
    k1 = math.ceil(vmax / 30.0)
    for k in range(k0, k1 + 1):
        level = 30.0 * k
        for t, _blo, _bhi, direction in series.roots(level, a, b):
            if direction > 0:
                sign = SIGNS[k % 12]
            else:
                sign = SIGNS[(k - 1) % 12]
            out.append({'jd': t + J2000, 'sign': sign, 'retrograde': direction < 0})
    out.sort(key=lambda e: e['jd'])
    return out


def stations_in(series):
    a = series.start + 5 * series.h
    b = series.stop - 5 * series.h
    out = []
    for t, v, kind in series.extrema(a, b):
        lon = v % 360.0
        out.append({'jd': t + J2000, 'type': 'retrograde' if kind == 'maximum' else 'direct',
                    'lon': lon, 'sign': SIGNS[int(lon // 30)], 'degree': lon % 30})
    return out


def elong(bodies, jd):
    return (bodies['Moon'].lon(jd) - bodies['Sun'].lon(jd)) % 360.0


def lunations(bodies, jd_a, jd_b):
    """New (0), first quarter (90), full (180), last quarter (270)."""
    names = {0: 'new', 90: 'first-quarter', 180: 'full', 270: 'last-quarter'}
    out = []
    step = 0.25
    jd = jd_a
    prev = elong(bodies, jd)
    while jd + step <= jd_b:
        nxt_jd = jd + step
        nxt = elong(bodies, nxt_jd)
        for target in (0, 90, 180, 270):
            d0 = (prev - target + 180) % 360 - 180
            d1 = (nxt - target + 180) % 360 - 180
            if d0 < 0 <= d1 and abs(d1 - d0) < 90:
                lo, hi = jd, nxt_jd
                while hi - lo > 1e-9:
                    mid = 0.5 * (lo + hi)
                    dm = (elong(bodies, mid) - target + 180) % 360 - 180
                    if dm < 0:
                        lo = mid
                    else:
                        hi = mid
                t = 0.5 * (lo + hi)
                mlon = bodies['Moon'].lon(t)
                out.append({'jd': t, 'type': names[target], 'moonLon': mlon,
                            'sign': SIGNS[int(mlon // 30)], 'degree': mlon % 30})
        jd, prev = nxt_jd, nxt
    return out


def build():
    bodies = load_bodies()
    ingresses = {}
    stations = {}
    for name, b in bodies.items():
        seen = []
        evs = []
        for s in b.series:
            for e in ingresses_in(s):
                if any(abs(e["jd"] - x) < 0.05 for x in seen):
                    continue
                seen.append(e['jd'])
                evs.append(e)
        evs.sort(key=lambda e: e['jd'])
        ingresses[name] = [{'at': jd_to_iso(e['jd']), 'jd': e['jd'], 'sign': e['sign'],
                            'retrograde': e['retrograde']} for e in evs]
        if name not in ('Sun', 'Moon'):
            sv = []
            for e in stations_in(b.series[0]):
                sv.append(dict(e, at=jd_to_iso(e['jd'])))
            stations[name] = sv
    moon = bodies['Moon'].series
    lun = lunations(bodies, moon[0].start + J2000 + 1, moon[-1].stop + J2000 - 1)
    for e in lun:
        e['at'] = jd_to_iso(e['jd'])
    out = {
        'what': 'Events solved on NASA JPL Horizons apparent geocentric ecliptic longitudes of date (QUANTITIES 31), times UTC',
        'method': 'nine-point Lagrange interpolation of the kept tables, roots by bisection to 1e-9 day (docs/engine-validation/independent-references/tools/series.py)',
        'ingresses': ingresses,
        'stations': stations,
        'lunations': lun,
    }
    with open(OUT, 'w') as f:
        json.dump(out, f, indent=0)
    return out


def load():
    with open(OUT) as f:
        return json.load(f)


if __name__ == '__main__':
    o = build()
    print({k: len(v) for k, v in o['ingresses'].items()}, {k: len(v) for k, v in o['stations'].items()}, len(o['lunations']))
