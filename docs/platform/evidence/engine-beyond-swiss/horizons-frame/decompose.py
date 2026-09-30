"""Brief v1, M0 item 3: take Horizons QUANTITIES=31's frame apart.

Horizons labels its apparent ecliptic longitude "IAU76/80 ecliptic-of-date".
Swiss Ephemeris, the engine and the precision runtime use IAU 2006 precession
with IAU 2000 nutation. The engine audit found Horizons minus each of them to
be the same for every body at a given instant (-0.369" at 1851, -0.047" in
2000-2026, +0.346" at 2148) and put it down to the frame. This checks that
with ERFA. Each Horizons direction is carried out of a model of Horizons's
frame and into the IAU 2006/2000A ecliptic of date, and what is left against
Swiss is the remainder. Four models are tried:

  bare        R1(eraObl80 + deps) x eraNutm80 x eraPmat76, as brief v1 wrote it
  bias        the same after the IAU 2006 frame bias (eraBp06)
  eopJpl      bare, with the IAU 1980 nutation corrected by the celestial-pole
              offsets that JPL's EOP2 file of the same day implies (its dX, dY
              are relative to IAU 2006/2000A, so the offsets are the ones that
              put the 1976/1980 pole on that pole)
  eopIers     bare, corrected by the IERS's own IAU 1980 offsets (14 C04 to its
              last day, then finals.all's Bulletin A)

The Horizons manual says it corrects IAU76/80 with the offsets in JPL's EOP
file and holds the last values as constants outside the file. The corpus's
banner names the file. In the first run (results.json) it was
eop.260922.p261219, "DATA-BASED 1962-JAN-20 TO 2026-SEP-22. PREDICTS->
2026-DEC-18", so both EOP models held their offsets at 1962-01-20 and
2026-12-18, and IERS, which predicted its offsets only to 2026-11-23, held
that day's values instead. The span is now read from the banner, so the
models hold wherever the kept responses' EOP file stops.

  venv/bin/python decompose.py <ephe-dir> latest_eop2.long \\
      EOP_14_C04_IAU1980_one_file_1962-now.txt finals.all.iau1980.txt <fetched> > results-<fetched>.json

<fetched> is the day the three EOP files were fetched, which the output
records (2026-09-23 for results.json, the default). The corpus was re-timed
on 2026-09-29 (../corpora/README.md), and results-2026-09-29.json is this
script on the re-timed corpus with the EOP files of that day.

It needs pyswisseph 2.10.03 with the DE441-based .se1 files pinned in
../../swiss-benchmark/CONFIGURATION.md, and pyerfa. Swiss is evaluated at the
corpus's own TT, as the corpus was fetched, in the configuration the audit
called (a) (FLG_SWIEPH | FLG_SPEED; the outer planets are system barycentres,
so they are compared with Horizons's barycentre files). Written: remainders,
frame terms, the offsets used and statistics. No Swiss position is written.
"""
import bisect
import hashlib
import json
import math
import os
import re
import sys

import erfa
import numpy as np
import swisseph as swe

HERE = os.path.dirname(os.path.abspath(__file__))
CORPUS = os.path.join(HERE, '..', 'corpora', 'horizons-24')
MJD0 = 2400000.5
MAS = math.pi / (180 * 3600 * 1000)


def eop_span():
    """The first day and the last prediction of Horizons's EOP file, as MJD, from the corpus banner."""
    banner = open(os.path.join(CORPUS, 'Sun.txt')).read()
    m = re.search(r'EOP coverage\s*:\s*DATA-BASED (\d{4})-([A-Z]{3})-(\d{2}) TO .*?PREDICTS-> (\d{4})-([A-Z]{3})-(\d{2})', banner)
    months = 'JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split()
    mjd = lambda y, mo, d: float(erfa.cal2jd(int(y), months.index(mo) + 1, int(d))[1])
    return mjd(*m.group(1, 2, 3)), mjd(*m.group(4, 5, 6))


EOP_FIRST, EOP_LAST = eop_span()  # 1962-01-20 and, for results.json, 2026-12-18

# Horizons file per body; the outer planets as barycentres, as Swiss answers them.
FILES = {
    'Sun': ('Sun.txt', swe.SUN), 'Moon': ('Moon.txt', swe.MOON), 'Mercury': ('Mercury.txt', swe.MERCURY),
    'Venus': ('Venus.txt', swe.VENUS), 'Mars': ('MarsBary.txt', swe.MARS), 'Jupiter': ('JupiterBary.txt', swe.JUPITER),
    'Saturn': ('SaturnBary.txt', swe.SATURN), 'Uranus': ('UranusBary.txt', swe.URANUS),
    'Neptune': ('NeptuneBary.txt', swe.NEPTUNE), 'Pluto': ('PlutoBary.txt', swe.PLUTO),
}
SOURCES = {
    'eop2': 'https://eop2-external.jpl.nasa.gov/eop2/latest_eop2.long',
    'c04': 'https://datacenter.iers.org/data/latestVersion/EOP_14_C04_IAU1980_one_file_1962-now.txt',
    'finals': 'https://datacenter.iers.org/data/latestVersion/finals.all.iau1980.txt',
}


def horizons_rows(name):
    """The (longitude, latitude) rows of one Horizons file, in degrees."""
    block = open(os.path.join(CORPUS, name)).read().split('$$SOE', 1)[1].split('$$EOE', 1)[0]
    rows = []
    for line in block.strip().splitlines():
        cells = [c.strip() for c in line.split(',')]
        rows.append((float(cells[3]), float(cells[4])))
    return rows


def eop2_series(path):
    """(MJD, dX, dY in mas) from a JPL EOP2 file; its offsets are relative to IAU 2006/2000A."""
    text = open(path).read().split('EOP2=', 1)[1].split('$END', 1)[0]
    series = []
    for line in text.strip().splitlines():
        cells = [c.strip() for c in line.split('$')[0].split(',')]
        series.append((float(cells[0]), float(cells[10]), float(cells[11])))
    return series


def iers_series(c04_path, finals_path):
    """(MJD, dpsi, deps in mas) relative to IAU 1980: 14 C04 to its last day, then finals.all's Bulletin A."""
    series = []
    for line in open(c04_path):
        cells = line.split()
        if len(cells) >= 10 and len(cells[0]) == 4 and cells[0].isdigit():
            series.append((float(cells[3]), float(cells[8]) * 1000, float(cells[9]) * 1000))
    last = series[-1][0]
    for line in open(finals_path):
        if len(line) >= 125 and line[97:106].strip() and float(line[7:15]) > last:
            series.append((float(line[7:15]), float(line[97:106]), float(line[116:125])))
    return series


def at(series, mjd):
    """Linear interpolation in a daily series; the end values outside it."""
    days = [row[0] for row in series]
    if mjd <= days[0]:
        return series[0][1:]
    if mjd >= days[-1]:
        return series[-1][1:]
    i = bisect.bisect_right(days, mjd) - 1
    f = (mjd - days[i]) / (days[i + 1] - days[i])
    return tuple(a + f * (b - a) for a, b in zip(series[i][1:], series[i + 1][1:]))


def tt_parts(mjd_utc):
    """A UTC MJD as a TT two-part Julian date."""
    return erfa.taitt(*erfa.utctai(MJD0, mjd_utc))


def to_ecliptic(eps):
    """Equatorial to ecliptic coordinates: R1(eps)."""
    return erfa.rx(eps, np.identity(3))


def old_equatorial(d1, d2, dpsi, deps, bias):
    """The 1976/1980 GCRS-to-true-equator matrix with nutation offsets (radians), and its true obliquity."""
    dpsi80, deps80 = erfa.nut80(d1, d2)
    epsa = erfa.obl80(d1, d2)
    matrix = erfa.numat(epsa, dpsi80 + dpsi, deps80 + deps) @ erfa.pmat76(d1, d2)
    if bias:
        matrix = matrix @ erfa.bp06(d1, d2)[0]
    return matrix, epsa + deps80 + deps


def old_ecliptic(d1, d2, dpsi=0.0, deps=0.0, bias=False):
    matrix, eps = old_equatorial(d1, d2, dpsi, deps, bias)
    return to_ecliptic(eps) @ matrix


def new_ecliptic(d1, d2):
    return to_ecliptic(erfa.obl06(d1, d2) + erfa.nut06a(d1, d2)[1]) @ erfa.pnm06a(d1, d2)


def implied_offsets(d1, d2, dx_mas, dy_mas):
    """The IAU 1980 offsets (radians) that put the 1976/1980 pole on the 2006/2000A pole plus (dX, dY)."""
    x, y = erfa.bpn2xy(erfa.pnm06a(d1, d2))
    target = np.array([x + dx_mas * MAS, y + dy_mas * MAS])
    pole = lambda c: np.array(erfa.bpn2xy(old_equatorial(d1, d2, c[0], c[1], False)[0]))
    c = np.zeros(2)
    for _ in range(6):
        miss = pole(c) - target
        step = 1e-8
        jacobian = np.column_stack([(pole(c + step * e) - target - miss) / step for e in np.identity(2)])
        c = c - np.linalg.solve(jacobian, miss)
    assert np.max(np.abs(pole(c) - target)) < 1e-6 * MAS
    return c


def unit(lon, lat):
    lon, lat = math.radians(lon), math.radians(lat)
    return np.array([math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)])


def lonlat(v):
    return math.degrees(math.atan2(v[1], v[0])) % 360.0, math.degrees(math.asin(v[2] / np.linalg.norm(v)))


def wrap_arcsec(a, b):
    return ((a - b + 540.0) % 360.0 - 180.0) * 3600.0


def day(mjd):
    y, m, d, _ = erfa.jd2cal(MJD0, mjd)
    return f'{y:04d}-{m:02d}-{d:02d}'


def sha256(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def main():
    ephe, eop2_path, c04_path, finals_path = sys.argv[1:5]
    fetched = sys.argv[5] if len(sys.argv) > 5 else '2026-09-23'
    swe.set_ephe_path(ephe)
    cases = json.load(open(os.path.join(CORPUS, 'corpus-tt.json')))['cases']
    horizons = {body: horizons_rows(name) for body, (name, _) in FILES.items()}
    assert all(len(rows) == len(cases) for rows in horizons.values())
    eop2 = eop2_series(eop2_path)
    iers = iers_series(c04_path, finals_path)
    iers_last = iers[-1][0]

    def offsets(model, d1, d2, mjd):
        """(dpsi, deps) in radians for one model at one instant, and whether they are held end values."""
        if model in ('bare', 'bias'):
            return (0.0, 0.0), False
        if model == 'eopIers':
            clamped = min(max(mjd, EOP_FIRST), iers_last)
            dpsi, deps = at(iers, clamped)
            return (dpsi * MAS, deps * MAS), clamped != mjd
        clamped = min(max(mjd, EOP_FIRST), EOP_LAST)
        dx, dy = at(eop2, clamped)
        if clamped != mjd:
            return tuple(implied_offsets(*tt_parts(clamped), dx, dy)), True
        return tuple(implied_offsets(d1, d2, dx, dy)), False

    models = ('bare', 'bias', 'eopJpl', 'eopIers')
    per_model = {model: [] for model in models}
    residuals = []
    for i, case in enumerate(cases):
        d1, d2 = MJD0, case['jdTt'] - MJD0
        mjd = case['jdUt'] - MJD0
        new = new_ecliptic(d1, d2)
        swiss = {}
        for body, (_, ipl) in FILES.items():
            xx, ret = swe.calc(case['jdTt'], ipl, swe.FLG_SWIEPH | swe.FLG_SPEED)
            if ret < 0 or not ret & swe.FLG_SWIEPH:
                raise SystemExit(f"{case['id']} {body}: Swiss did not answer from its .se1 files (flag {ret})")
            swiss[body] = (xx[0], xx[1])
        residuals.append({body: wrap_arcsec(horizons[body][i][0], swiss[body][0]) for body in FILES})
        for model in models:
            (dpsi, deps), held = offsets(model, d1, d2, mjd)
            carry = new @ old_ecliptic(d1, d2, dpsi, deps, model == 'bias').T
            lon_rem, lat_rem = {}, {}
            for body in FILES:
                lon_h, lat_h = horizons[body][i]
                lon_n, lat_n = lonlat(carry @ unit(lon_h, lat_h))
                lon_rem[body] = wrap_arcsec(lon_n, swiss[body][0])
                lat_rem[body] = (lat_n - swiss[body][1]) * 3600.0
            per_model[model].append({
                'offsetsMas': None if model in ('bare', 'bias') else
                {'dpsi': round(dpsi / MAS, 3), 'deps': round(deps / MAS, 3), 'held': held},
                'lon': lon_rem, 'lat': lat_rem,
            })

    mas = lambda arcsec: round(arcsec * 1000, 2)

    def model_summary(model):
        rows = per_model[model]
        lons = sorted(abs(v) for row in rows for v in row['lon'].values())
        lats = [abs(v) for row in rows for v in row['lat'].values()]
        return {
            'longitudeMas': {'n': len(lons), 'p50': mas(lons[len(lons) // 2]), 'max': mas(lons[-1])},
            'latitudeMaxMas': mas(max(lats)),
        }

    instants = []
    for i, case in enumerate(cases):
        res = residuals[i]
        entry = {
            'id': case['id'], 'utc': case['utc'],
            'horizonsMinusSwissArcsec': {
                'mean': round(sum(res.values()) / len(res), 4),
                'min': round(min(res.values()), 4), 'max': round(max(res.values()), 4),
            },
        }
        for model in models:
            row = per_model[model][i]
            lon = list(row['lon'].values())
            frame = [res[body] - row['lon'][body] for body in FILES]
            entry[model] = {
                'frameTermMeanArcsec': round(sum(frame) / len(frame), 4),
                'remainderLongitudeMas': {'mean': mas(sum(lon) / len(lon)), 'min': mas(min(lon)), 'max': mas(max(lon))},
                'remainderLatitudeMaxMas': mas(max(abs(v) for v in row['lat'].values())),
            }
            if row['offsetsMas']:
                entry[model]['offsetsMas'] = row['offsetsMas']
        instants.append(entry)

    worst = {
        model: max(((case['id'], body, v) for case, row in zip(cases, per_model[model]) for body, v in row['lon'].items()),
                   key=lambda t: abs(t[2]))
        for model in models
    }
    print(json.dumps({
        'what': 'Horizons QUANTITIES=31 apparent ecliptic longitude and latitude against Swiss Ephemeris 2.10.03 (IAU 2006/2000A), '
                'after carrying each Horizons direction out of a model of its IAU 1976/1980 frame into the IAU 2006/2000A one',
        'pyerfa': erfa.__version__,
        'erfa': erfa.version.erfa_version,
        'swissBinding': swe.version,
        'units': 'frame terms and Horizons minus Swiss in arcseconds; remainders (Horizons carried into IAU 2006/2000A, minus Swiss) and offsets in milliarcseconds',
        'models': {
            'bare': 'R1(eraObl80 + deps80) x eraNutm80 x eraPmat76 applied to the ICRF direction as it is',
            'bias': 'the same after the frame bias of eraBp06',
            'eopJpl': 'bare with dpsi, deps added to the IAU 1980 nutation: the offsets that put its pole on the IAU 2006/2000A pole plus JPL EOP2 dX, dY; held at %s and %s' % (day(EOP_FIRST), day(EOP_LAST)),
            'eopIers': 'bare with the IERS IAU 1980 dpsi, deps (14 C04, then finals.all Bulletin A); held at 1962-01-20 and at their last published day',
        },
        'eopSources': {
            name: {'url': SOURCES[name], 'sha256': sha256(path), 'fetched': fetched}
            for name, path in (('eop2', eop2_path), ('c04', c04_path), ('finals', finals_path))
        },
        'eopHeldAt': {'first': day(EOP_FIRST), 'lastJpl': day(EOP_LAST), 'lastIers': day(iers_last)},
        'summary': {
            model: {**model_summary(model), 'worstLongitude': {'id': worst[model][0], 'body': worst[model][1], 'mas': mas(worst[model][2])}}
            for model in models
        },
        'instants': instants,
    }, indent=1))


if __name__ == '__main__':
    main()
