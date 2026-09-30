#!/usr/bin/env python3
"""Independent references for the engine's tests: NASA JPL Horizons and ERFA.

These replace the Swiss Ephemeris packs removed on 2026-09-28 under
docs/platform/programme/DECISIONS-2026-09-28.md section 3. Each pack keeps its
cases, its predeclared gates and the structure its test reads; only the
arbiter changes. No Swiss Ephemeris code or output is read here.

    python3 tools/build.py select-wrap   # once: the L-wrap birth, from Horizons
    python3 tools/build.py               # every pack, from the kept responses
    python3 tools/build.py --refresh     # fetch every Horizons response again
    python3 tools/build.py --refresh-changed  # only those whose query changed

Run from docs/engine-validation/independent-references/ with pyerfa 2.0.1.5
installed and the repository's node_modules present (tools/engine-clock.ts
reads the engine's clock through vite-node).

Arbiters
  positions  Horizons DE441, apparent geocentric ecliptic longitude of date
             (QUANTITIES 31); Mars to Pluto as system barycentres.
  true node  the ascending node of the Moon's osculating orbit, from Horizons
             DE441 geometric geocentric state vectors: h = r x v, rotated into
             the true ecliptic and equinox of date with ERFA's pnm06a and true
             obliquity, longitude of z x h. Speed: central difference of that
             longitude over +-0.001 day.
  angles     ERFA gst06a (IAU 2006/2000A) at the engine's UT1 for the instant,
             and the true obliquity obl06 + Delta-epsilon of nut06a; ASC, MC
             and Placidus cusps by the conformance suite's L2 construction
             (tools/geometry.py).
  events     roots of the Horizons longitude, interpolated from a uniform TT
             table (tools/series.py), with the predeclared longitude bands.
Clock
  Every instant is evaluated at the engine's own TT and UT1 for it
  (tools/engine-clock.ts), as the ERFA angle arbiter of angle-grid-erfa.json
  already is: a comparison measures positions and angles, not the clock. Since
  engine 0.1.1-rc.15 the engine reads an instant from 1972-01-01 to 2027-10-02
  as UTC (TT from the IERS leap seconds, UT1 from IERS UT1 - UTC) and any other
  instant as UT1 with its Delta T model.
"""
from __future__ import annotations

import bisect as _bisect
import hashlib
import json
import math
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import erfa  # noqa: E402

import geometry  # noqa: E402
import horizons  # noqa: E402
from series import J2000, Series  # noqa: E402

PACK = os.path.normpath(os.path.join(HERE, os.pardir))
ROOT = os.path.normpath(os.path.join(PACK, os.pardir, os.pardir, os.pardir))
FIXTURES = os.path.join(ROOT, 'src', 'lib', 'engine', 'fixtures')
CASES = os.path.join(PACK, 'cases.json')

J2000_MS = 946728000000  # Date.UTC(2000, 0, 1, 12)
DAY_MS = 86400000
BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']
NODE_STEP_DAYS = 0.001
PADDING_MS = 1000


def rel(path):
    return os.path.relpath(path, ROOT).replace(os.sep, '/')


def sha256(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def read_json(path):
    with open(path) as f:
        return json.load(f)


def write_json(path, value):
    text = json.dumps(value, indent=2, ensure_ascii=False) + '\n'
    with open(path, 'w') as f:
        f.write(text)
    print('wrote %s (%d bytes, sha256 %s)' % (rel(path), len(text.encode()), sha256(path)), file=sys.stderr)


def norm360(x):
    return x % 360.0


def wrap180(x):
    return (x + 540.0) % 360.0 - 180.0


# ---------------------------------------------------------------------------
# The engine's clock
# ---------------------------------------------------------------------------

class Clock:
    """The engine's clock, from tools/engine-clock.ts.

    Since engine 0.1.1-rc.15 an instant, the product's millisecond transport,
    from 1972-01-01 to 2027-10-02 is read as UTC: UT1 = UTC + (UT1 - UTC) and
    TT = UTC + (TAI - UTC) + 32.184 s. Any other instant is read as UT1, with
    TT = UT1 + Delta T of the engine's model. The instants of the request come
    with their UT1 and TT. Each range carries, at uniform nodes of the instant
    and on both sides of every change of piece of the basis inside it, UT1 -
    instant and TT - UT1 in seconds, interpolated here linearly in the
    instant. Their sum, TT - instant, is constant within a piece of the IERS
    basis, so TT is exact there; elsewhere this is the interpolation of Delta T
    the references have always used.
    """

    def __init__(self, data):
        self.data = data
        self.instants = data['instants']
        nodes = []
        for r in data['ranges'].values():
            nodes.extend(r['nodes'])
        nodes.sort()
        self.at = [n[0] for n in nodes]
        self.du = [n[1] for n in nodes]
        self.dt = [n[2] for n in nodes]
        self.fallbacks = []

    def tt_of(self, key):
        return self.instants[key]['tt']

    def ut1_of(self, key):
        return self.instants[key]['ut']

    def offsets(self, days):
        """(UT1 - instant, TT - UT1) in seconds at an instant, days from J2000."""
        i = _bisect.bisect_right(self.at, days)
        if i <= 0 or i >= len(self.at):
            raise ValueError('no clock node around %r' % days)
        a0, a1 = self.at[i - 1], self.at[i]
        f = (days - a0) / (a1 - a0)
        return (self.du[i - 1] + f * (self.du[i] - self.du[i - 1]),
                self.dt[i - 1] + f * (self.dt[i] - self.dt[i - 1]))

    def tt_of_days(self, days):
        du, dt = self.offsets(days)
        return days + du / 86400.0 + dt / 86400.0

    def days_of_tt(self, tt):
        """The instant whose TT is tt. The fixed-point iteration converges
        wherever TT is continuous in the instant; inside a leap second, or at a
        change of basis, no instant or two have that TT, and this takes the
        earliest instant at which TT reaches it."""
        days = tt - 69.0 / 86400.0
        for _ in range(6):
            du, dt = self.offsets(days)
            days = tt - (du + dt) / 86400.0
        if abs(self.tt_of_days(days) - tt) <= 1e-10:
            return days
        node_tt = lambda k: self.at[k] + self.du[k] / 86400.0 + self.dt[k] / 86400.0  # noqa: E731
        for k in range(1, len(self.at)):
            t0, t1 = node_tt(k - 1), node_tt(k)
            if t0 <= tt <= t1 and self.at[k] > self.at[k - 1]:
                days = self.at[k - 1] + (tt - t0) / (t1 - t0) * (self.at[k] - self.at[k - 1])
                self.fallbacks.append(iso_of_ms(days * DAY_MS + J2000_MS))
                return days
        raise ValueError('no clock node around TT %r' % tt)

    def ms_of_tt(self, tt):
        return self.days_of_tt(tt) * DAY_MS + J2000_MS

    def tt_of_ms(self, ms):
        return self.tt_of_days((ms - J2000_MS) / DAY_MS)

    def ut1_of_ms(self, ms):
        days = (ms - J2000_MS) / DAY_MS
        du, _ = self.offsets(days)
        return days + du / 86400.0


def ms_of_iso(iso):
    import datetime
    s = iso.replace('Z', '+00:00')
    d = datetime.datetime.fromisoformat(s)
    epoch = datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc)
    delta = d - epoch
    return delta.days * DAY_MS + delta.seconds * 1000 + delta.microseconds // 1000


def iso_of_ms(ms):
    import datetime
    ms = int(round(ms))
    epoch = datetime.datetime(1970, 1, 1, tzinfo=datetime.timezone.utc)
    d = epoch + datetime.timedelta(milliseconds=ms)
    return d.strftime('%Y-%m-%dT%H:%M:%S.') + '%03dZ' % (ms % 1000)


def run_engine_clock(request):
    with tempfile.NamedTemporaryFile('w', suffix='.json', delete=False) as f:
        json.dump(request, f)
        path = f.name
    try:
        out = subprocess.run(
            ['npx', 'vite-node', '--script', rel(os.path.join(HERE, 'engine-clock.ts')), path],
            cwd=ROOT, check=True, capture_output=True, text=True)
    finally:
        os.unlink(path)
    return json.loads(out.stdout)


# ---------------------------------------------------------------------------
# Horizons helpers
# ---------------------------------------------------------------------------

POINTS = {}  # '%.9f' % jd_tt -> {body: lon_deg}
NODES = {}   # '%.9f' % jd_tt -> (lon_deg, speed_deg_per_day)


def key_of(tt):
    return '%.9f' % (tt + J2000)


def prefetch(label, tts, with_nodes):
    """One TLIST query per body (and one vector query for the node) for every
    instant of a batch. Horizons answers a time list in time order; rows are
    matched back by instant."""
    order = sorted(set(key_of(tt) for tt in tts))
    for body in BODIES:
        rows = horizons.observer_points('points-%s-%s' % (label, body.lower()), body, [float(k) for k in order])
        if len(rows) != len(order):
            raise SystemExit('horizons: %s returned %d rows for %d instants' % (body, len(rows), len(order)))
        for (jd, lon, _lat), want in zip(rows, order):
            if abs(jd - float(want)) > 1e-6:
                raise SystemExit('horizons: %s instant %s answered as %r' % (body, want, jd))
            POINTS.setdefault(want, {})[body] = lon
    if not with_nodes:
        return
    wanted = sorted(set('%.9f' % (float(k) + d) for k in order for d in (-NODE_STEP_DAYS, 0.0, NODE_STEP_DAYS)), key=float)
    rows = horizons.moon_vectors('vectors-%s' % label, [float(w) for w in wanted])
    if len(rows) != len(wanted):
        raise SystemExit('horizons: node vectors returned %d rows for %d instants' % (len(rows), len(wanted)))
    lon = {}
    for (jd, st), want in zip(rows, wanted):
        if abs(jd - float(want)) > 1e-6:
            raise SystemExit('horizons: vector instant %s answered as %r' % (want, jd))
        lon[want] = geometry.node_longitude(jd, st)
    for k in order:
        jd = float(k)
        l0, l1, l2 = (lon['%.9f' % (jd + d)] for d in (-NODE_STEP_DAYS, 0.0, NODE_STEP_DAYS))
        NODES[k] = (l1, wrap180(l2 - l0) / (2 * NODE_STEP_DAYS))


def positions_at(tts):
    """{body: [lon_deg per instant]}, from a prefetched batch."""
    return {body: [POINTS[key_of(tt)][body] for tt in tts] for body in BODIES}


def nodes_at(tts):
    """[(lon_deg, speed_deg_per_day)] of the osculating node, from a prefetched batch."""
    return [NODES[key_of(tt)] for tt in tts]


def table(name, body, clock, from_ms, to_ms, step, margin_days):
    """A Series over the TT span of [from_ms, to_ms] plus a margin."""
    a = clock.tt_of_ms(from_ms) - margin_days
    b = clock.tt_of_ms(to_ms) + margin_days
    step_days = {'1 h': 1 / 24, '1 d': 1.0, '2 d': 2.0}[step]
    start = math.floor((a + J2000) / step_days) * step_days
    stop = math.ceil((b + J2000) / step_days) * step_days
    rows = horizons.observer_table(name, body, start, stop, step)
    return Series(rows)


# ---------------------------------------------------------------------------
# Charts
# ---------------------------------------------------------------------------

def charts(specs):
    """specs: [{'key', 'tt', 'ut', 'latitude', 'longitude', 'system'}] ->
    {key: {'positions', 'ascmc', 'cuspsDegrees', 'expectedProductHouseSystem', ...}}"""
    tts = [s['tt'] for s in specs]
    pos = positions_at(tts)
    nodes = nodes_at(tts)
    out = {}
    for i, s in enumerate(specs):
        positions = {body: {'longitudeDegrees': pos[body][i]} for body in BODIES}
        positions['North Node'] = {'longitudeDegrees': round(nodes[i][0], 10),
                                   'speedDegreesPerDay': round(nodes[i][1], 10)}
        angles = geometry.chart_angles(s['ut'] + J2000, s['tt'] + J2000, s['latitude'], s['longitude'], s['system'])
        out[s['key']] = {
            'positions': positions,
            'ascmc': [angles['ascendantDegrees'], angles['midheavenDegrees']],
            'cuspsDegrees': angles['cuspsDegrees'],
            'expectedProductHouseSystem': angles['houseSystem'],
            'trueObliquityDegrees': angles['trueObliquityDegrees'],
            'placidusLimitDegrees': angles['placidusLimitDegrees'],
        }
    return out


# ---------------------------------------------------------------------------
# Events on a Series
# ---------------------------------------------------------------------------

def padded_band(clock, lo_tt, hi_tt):
    return [int(math.floor(clock.ms_of_tt(lo_tt))) - PADDING_MS, int(math.ceil(clock.ms_of_tt(hi_tt))) + PADDING_MS]


def crossings(series, clock, target, a_tt, b_tt, bands, identity=False):
    """Every crossing of target + 360k in (a_tt, b_tt], with a padded band per
    budget: [{'tt', 'ms', 'direction', 'speed', 'bands': {budget: [lo, hi]}}].
    With `identity`, a_tt is the natal instant itself and the root there (the
    identity crossing, found within interpolation error of a_tt) is excluded,
    as the policies require."""
    va, vb = series.at(a_tt), series.at(b_tt)
    lo_v, hi_v = min(va, vb), max(va, vb)
    for t, v, _kind in series.extrema(a_tt, b_tt):
        lo_v, hi_v = min(lo_v, v), max(hi_v, v)
    out = []
    k0 = math.floor((lo_v - target) / 360.0)
    k1 = math.ceil((hi_v - target) / 360.0)
    for k in range(k0, k1 + 1):
        level = target + 360.0 * k
        for root in series.roots(level, a_tt, b_tt):
            t = root[0]
            if not (a_tt < t <= b_tt):
                continue
            if identity and t - a_tt < 1e-4:
                continue
            row = {'tt': t, 'ms': clock.ms_of_tt(t), 'direction': root[3], 'speed': series.speed(t), 'bands': {}}
            for name, budget in bands.items():
                lo, hi, complete = series.band(level, budget, root, a_tt, b_tt)
                if not complete:
                    raise SystemExit('ill-conditioned: the %s band around %s is not complete' % (name, iso_of_ms(row['ms'])))
                row['bands'][name] = padded_band(clock, lo, hi)
            out.append(row)
    out.sort(key=lambda r: r['tt'])
    for x, y in zip(out, out[1:]):
        for name in bands:
            if x['bands'][name][1] >= y['bands'][name][0]:
                raise SystemExit('ill-conditioned: %s bands overlap' % name)
    return out


# ---------------------------------------------------------------------------
# Packs
# ---------------------------------------------------------------------------

def request_for(cases, lunar_policy, eight_policy, windows):
    instants, ranges, returns = {}, {}, {}
    for row in cases['nodePolar']['trueNode'] + cases['nodePolar']['polar'] + cases['houses']:
        instants[row['id']] = row['utc']
    for row in eight_policy['fixedEpochs']:
        instants['epoch:' + row['id']] = row['productDateTransport']
    solar = eight_policy['solar']
    saturn = eight_policy['saturn']
    instants['solar:birth'] = solar['birthUTC']
    instants['saturn:birth'] = saturn['productDateTransport']
    birth_ms = ms_of_iso(saturn['productDateTransport'])
    instants['saturn:birth-1d'] = iso_of_ms(birth_ms - DAY_MS)
    instants['saturn:birth+1d'] = iso_of_ms(birth_ms + DAY_MS)
    for case in lunar_policy['cases']:
        instants['lunar:%s:birth' % case['id']] = case['birthTransport']
        returns['lunar:%s' % case['id']] = {
            'kind': 'lunar', 'birthUtc': case['birthTransport'], 'afterUtc': case['afterTransport'],
            'latitude': case['returnLocation']['latitudeDegrees'], 'longitude': case['returnLocation']['longitudeDegreesEastPositive']}
        after = ms_of_iso(case['afterTransport'])
        ranges['lunar:%s' % case['id']] = {'fromUtc': iso_of_ms(after - 3 * DAY_MS), 'toUtc': iso_of_ms(after + 44 * DAY_MS), 'stepDays': 0.25}
    returns['solar:nearest'] = {'kind': 'solar-nearest', 'birthUtc': solar['birthUTC'], 'afterUtc': solar['nearUTC'],
                                'latitude': solar['latitudeDegrees'], 'longitude': solar['longitudeDegreesEastPositive']}
    returns['solar:most-recent'] = {'kind': 'solar-most-recent', 'birthUtc': solar['birthUTC'], 'afterUtc': solar['currentSelectionAtUTC'],
                                    'latitude': solar['latitudeDegrees'], 'longitude': solar['longitudeDegreesEastPositive']}
    ranges['saturn'] = {'fromUtc': '2015-06-01T00:00:00Z', 'toUtc': '2083-06-01T00:00:00Z', 'stepDays': 5}
    ranges['sun'] = {'fromUtc': '2024-01-01T00:00:00Z', 'toUtc': '2025-10-01T00:00:00Z', 'stepDays': 1}
    ranges['mercury'] = {'fromUtc': '2026-02-20T00:00:00Z', 'toUtc': '2026-04-10T00:00:00Z', 'stepDays': 0.25}
    ranges['slow-2019-2020'] = {'fromUtc': '2018-12-01T00:00:00Z', 'toUtc': '2021-02-01T00:00:00Z', 'stepDays': 1}
    ranges['wrap'] = {'fromUtc': '1999-12-25T00:00:00Z', 'toUtc': '2000-02-10T00:00:00Z', 'stepDays': 0.25}
    for case in windows['cases']:
        for key in ('fromUtc', 'toUtc', 'anchorUtc'):
            instants['window:%s:%s' % (case['id'], key)] = case[key]
    natal = windows['coherentNatalInput']
    instants['window:natal'] = natal['birthUTC']
    return {'instants': instants, 'ranges': ranges, 'returns': returns}


def pack_node_polar(cases, clock, node_policy):
    true_node = []
    rows = cases['nodePolar']['trueNode']
    nodes = nodes_at([clock.tt_of(r['id']) for r in rows])
    for r, (lon, speed) in zip(rows, nodes):
        inst = clock.instants[r['id']]
        true_node.append({
            'id': r['id'],
            'input': {'utc': r['utc'], 'jdTT': round(inst['tt'] + J2000, 10), 'deltaTSeconds': round(inst['deltaTSeconds'], 6)},
            'longitudeDegrees': round(lon, 10),
            'longitudeSpeedDegreesPerDay': round(speed, 10),
        })
    polar = []
    for r in cases['nodePolar']['polar']:
        inst = clock.instants[r['id']]
        a = geometry.chart_angles(inst['ut'] + J2000, inst['tt'] + J2000, r['latitude'], r['longitude'], 'placidus')
        if a['placidusDefined']:
            raise SystemExit('%s is not inside the polar circle' % r['id'])
        polar.append({
            'id': r['id'],
            'input': {'utc': r['utc'], 'jdTT': round(inst['tt'] + J2000, 10), 'deltaTSeconds': round(inst['deltaTSeconds'], 6)},
            'latitudeDegrees': r['latitude'], 'longitudeDegreesEastPositive': r['longitude'],
            'trueObliquityDegrees': a['trueObliquityDegrees'],
            'placidusLimitDegrees': a['placidusLimitDegrees'],
            'placidusDefined': a['placidusDefined'],
            'whole': {'ascendantDegrees': a['ascendantDegrees'], 'midheavenDegrees': a['midheavenDegrees'], 'cuspsDegrees': a['cuspsDegrees']},
        })
    houses = []
    for r in cases['houses']:
        inst = clock.instants[r['id']]
        a = geometry.chart_angles(inst['ut'] + J2000, inst['tt'] + J2000, r['latitude'], r['longitude'], 'placidus')
        if not a['placidusDefined']:
            raise SystemExit('%s is inside the polar circle' % r['id'])
        houses.append({'id': r['id'], 'utc': r['utc'], 'latitude': r['latitude'], 'longitude': r['longitude'],
                       'asc': a['ascendantDegrees'], 'mc': a['midheavenDegrees'], 'cusps': a['cuspsDegrees']})
    return {'trueNode': true_node, 'polar': polar, 'houses': houses}


def pack_eight_cases(clock, policy):
    out = {}
    # Fixed epochs: ten bodies at the engine's TT for each transport.
    keys = ['epoch:' + r['id'] for r in policy['fixedEpochs']]
    pos = positions_at([clock.tt_of(k) for k in keys])
    out['epochs'] = [{'id': r['id'], 'positions': {b: {'longitudeDegrees': pos[b][i]} for b in BODIES}}
                     for i, r in enumerate(policy['fixedEpochs'])]

    # Stations: the extremum of the declared kind, a target 0.1 deg inside it,
    # and both crossings with the fixed-target band.
    band = policy['gates']['fixedTargetLongitudeBandDegrees']
    out['stations'] = []
    for st in policy['stations']:
        from_ms, to_ms = ms_of_iso(st['fromUTC']), ms_of_iso(st['toUTC'])
        if st['body'] == 'Mercury':
            series = table('mercury-2026-03', 'Mercury', clock, from_ms, to_ms, '1 h', 3)
        else:
            series = SATURN
        a, b = clock.tt_of_ms(from_ms), clock.tt_of_ms(to_ms)
        turns = [x for x in series.extrema(a, b) if x[2] == st['kind']]
        if len(turns) != 1:
            raise SystemExit('%s: %d extrema of kind %s' % (st['id'], len(turns), st['kind']))
        t0, v0, _ = turns[0]
        target_v = v0 + st['targetOffsetFromExtremumDegrees']
        roots = crossings(series, clock, norm360(target_v), a, b, {'band': band})

        def fd(t):
            return (series.at(t + 0.25) - series.at(t - 0.25)) / 0.5
        lo, hi = t0 - 2.0, t0 + 2.0
        s_lo = fd(lo) > 0
        while hi - lo > 1e-9:
            mid = 0.5 * (lo + hi)
            if (fd(mid) > 0) == s_lo:
                lo = mid
            else:
                hi = mid
        t_fd = 0.5 * (lo + hi)
        out['stations'].append({
            'id': st['id'],
            'targetLongitudeDegrees': round(norm360(target_v), 10),
            'analyticStationMilliseconds': int(round(clock.ms_of_tt(t0))),
            'analyticStationLongitudeDegrees': round(norm360(v0), 10),
            'finiteDifferenceStationMilliseconds': int(round(clock.ms_of_tt(t_fd))),
            'crossings': [{'expectedMilliseconds': int(round(r['ms'])), 'timeScale': 'UTC', 'allowedMilliseconds': r['bands']['band'],
                           'retrograde': r['speed'] < 0, 'speedDegreesPerDay': round(r['speed'], 10)} for r in roots],
        })

    # Solar return.
    solar = policy['solar']
    band = policy['gates']['birthDerivedReturnLongitudeBandDegrees']
    natal = positions_at([clock.tt_of('solar:birth')])['Sun'][0]
    near = ms_of_iso(solar['nearUTC'])
    current = ms_of_iso(solar['currentSelectionAtUTC'])
    sun = table('sun-2024-2025', 'Sun', clock, ms_of_iso('2024-01-15T00:00:00Z'), ms_of_iso('2025-09-15T00:00:00Z'), '1 d', 5)
    a = clock.tt_of_ms(near - solar['nearestSearchDaysEachSide'] * DAY_MS)
    b = clock.tt_of_ms(near + solar['nearestSearchDaysEachSide'] * DAY_MS)
    found = crossings(sun, clock, natal, a, b, {'band': band})
    nearest = min(found, key=lambda r: abs(r['ms'] - near))
    a = clock.tt_of_ms(current - solar['mostRecentSearchDaysBefore'] * DAY_MS)
    found = [r for r in crossings(sun, clock, natal, a, clock.tt_of_ms(current), {'band': band}) if r['ms'] <= current]
    recent = max(found, key=lambda r: r['ms'])
    independent_ms = int(round(nearest['ms']))
    returned_iso = RETURNS['solar:nearest']
    if RETURNS['solar:most-recent'] != returned_iso:
        raise SystemExit('the product returns different instants for nearest and most recent')
    place = {'latitude': solar['latitudeDegrees'], 'longitude': solar['longitudeDegreesEastPositive'], 'system': 'placidus'}
    specs = []
    for key, ms in (('solar:independent', independent_ms), ('solar:returned', ms_of_iso(returned_iso))):
        tt = clock.tt_of_ms(ms)
        specs.append({'key': key, 'tt': tt, 'ut': clock.ut1_of_ms(ms), **place})
    CHART_SPECS.extend(specs)
    out['solar'] = {
        'natalLongitudeDegrees': natal,
        'nearest': {'expectedMilliseconds': int(round(nearest['ms'])), 'timeScale': 'UTC', 'allowedMilliseconds': nearest['bands']['band']},
        'mostRecent': {'expectedMilliseconds': int(round(recent['ms'])), 'timeScale': 'UTC', 'allowedMilliseconds': recent['bands']['band']},
        'independentChartUTC': iso_of_ms(independent_ms),
        'independentChart': 'solar:independent',
        'returnedChartUTC': returned_iso,
        'returnedChart': 'solar:returned',
    }

    # Saturn return.
    saturn = policy['saturn']
    band = policy['gates']['birthDerivedReturnLongitudeBandDegrees']
    birth = ms_of_iso(saturn['productDateTransport'])
    natal = positions_at([clock.tt_of('saturn:birth-1d'), clock.tt_of('saturn:birth'), clock.tt_of('saturn:birth+1d')])['Saturn']
    a = clock.tt_of_ms(birth + saturn['searchFromUniformDaysAfterBirth'] * DAY_MS)
    b = clock.tt_of_ms(birth + saturn['searchToUniformDaysAfterBirth'] * DAY_MS)
    found = crossings(SATURN, clock, natal[1], a, b, {'band': band})
    seasons = []
    for r in found:
        if seasons and r['ms'] - seasons[-1][-1]['ms'] <= saturn['seasonMaximumAdjacentGapDays'] * DAY_MS:
            seasons[-1].append(r)
        else:
            seasons.append([r])
    out['saturn'] = {
        'natalLongitudeDegrees': natal[1],
        'natalRetrograde': wrap180(natal[2] - natal[0]) < 0,
        'seasons': [{'index': i + 1, 'crossings': [
            {'expectedMilliseconds': int(round(r['ms'])), 'timeScale': 'nominal UT1; Z is product transport only',
             'allowedMilliseconds': r['bands']['band'], 'retrograde': r['direction'] < 0} for r in s]}
            for i, s in enumerate(seasons)],
    }
    return out


def strip_chart(chart):
    return {k: chart[k] for k in ('positions', 'ascmc', 'cuspsDegrees', 'expectedProductHouseSystem')}


def pack_lunar(clock, policy):
    gates = policy['gates']
    cases, returned = [], []
    specs = []
    per_case = {}
    for case in policy['cases']:
        birth_tt = clock.tt_of('lunar:%s:birth' % case['id'])
        natal = positions_at([birth_tt])['Moon'][0]
        after = ms_of_iso(case['afterTransport'])
        upper = after + policy['productScanContract']['horizonUniformDays'] * DAY_MS
        series = MOON_TABLES.setdefault(case['afterTransport'], table('moon-from-%s' % case['afterTransport'][:10], 'Moon', clock, after, upper, '1 h', 1.5))
        identity = case['birthTransport'] == case['afterTransport']
        found = crossings(series, clock, natal, clock.tt_of_ms(after), clock.tt_of_ms(upper), {
            'fixed': gates['fixedTargetTimeBandDegrees'], 'natal': gates['natalDerivedTimeBandDegrees']}, identity=identity)
        found = [r for r in found if after < r['ms'] <= upper]
        if not found or any(r['direction'] < 0 for r in found):
            raise SystemExit('%s: no direct return in the window' % case['id'])
        # The policy's conditioning, checked on the arbiter.
        cond = policy['conditioning']
        lo_n, hi_n = cond['rootsPerCompleteWindowAllowed']
        if not lo_n <= len(found) <= hi_n:
            raise SystemExit('%s: %d roots in the window' % (case['id'], len(found)))
        if found[0]['ms'] - after > cond['maximumFirstReturnUniformDaysInclusive'] * DAY_MS:
            raise SystemExit('%s: first return too late' % case['id'])
        margin = gates['natalDerivedTimeBandDegrees']
        ends = [upper] if case['birthTransport'] == case['afterTransport'] else [after, upper]
        for end in ends:
            if abs(wrap180(series.at(clock.tt_of_ms(end)) - natal)) <= margin:
                raise SystemExit('%s: a search endpoint lies within %g deg of the target' % (case['id'], margin))
        for r in found:
            for key in ('fixed', 'natal'):
                if not (after < r['bands'][key][0] and r['bands'][key][1] <= upper):
                    raise SystemExit('%s: a band is not inside the window' % case['id'])
            if not (cond['sampledSpeedDegreesPerDayStrictlyBetween'][0] < r['speed'] < cond['sampledSpeedDegreesPerDayStrictlyBetween'][1]):
                raise SystemExit('%s: Moon speed out of the conditioned range' % case['id'])
        first = int(round(found[0]['ms']))
        loc = case['returnLocation']
        system = 'placidus'
        specs.append({'key': '%s:independent' % case['id'], 'tt': clock.tt_of_ms(first), 'ut': clock.ut1_of_ms(first),
                      'latitude': loc['latitudeDegrees'], 'longitude': loc['longitudeDegreesEastPositive'], 'system': system})
        if case.get('relocationAtSameInstant'):
            r = case['relocationAtSameInstant']
            specs.append({'key': '%s:independent:relocation' % case['id'], 'tt': clock.tt_of_ms(first), 'ut': clock.ut1_of_ms(first),
                          'latitude': r['latitudeDegrees'], 'longitude': r['longitudeDegreesEastPositive'], 'system': system})
        product = ms_of_iso(RETURNS['lunar:%s' % case['id']])
        specs.append({'key': '%s:main' % case['id'], 'tt': clock.tt_of_ms(product), 'ut': clock.ut1_of_ms(product),
                      'latitude': loc['latitudeDegrees'], 'longitude': loc['longitudeDegreesEastPositive'], 'system': system})
        if case.get('relocationAtSameInstant'):
            r = case['relocationAtSameInstant']
            specs.append({'key': '%s:relocation' % case['id'], 'tt': clock.tt_of_ms(product), 'ut': clock.ut1_of_ms(product),
                          'latitude': r['latitudeDegrees'], 'longitude': r['longitudeDegreesEastPositive'], 'system': system})
        per_case[case['id']] = (natal, found, first, product)
    CHART_SPECS.extend(specs)
    for case in policy['cases']:
        natal, found, first, product = per_case[case['id']]
        time_scale = case['timeScale']
        row = {
            'id': case['id'],
            'natalLongitudeDegrees': natal,
            'independentChartUTC': iso_of_ms(first),
            'chartAtIndependentInstant': '%s:independent' % case['id'],
            'crossings': [{'expectedMilliseconds': int(round(r['ms'])), 'timeScale': time_scale,
                           'fixedExternalTargetAllowedMilliseconds': r['bands']['fixed'],
                           'natalDerivedAllowedMilliseconds': r['bands']['natal'],
                           'retrograde': r['direction'] < 0, 'speedDegreesPerDay': round(r['speed'], 10)} for r in found],
        }
        if case.get('relocationAtSameInstant'):
            row['relocatedChartAtIndependentInstant'] = '%s:independent:relocation' % case['id']
        cases.append(row)
        returned.append({'id': '%s:main' % case['id'], 'caseId': case['id'], 'utc': iso_of_ms(product),
                         'reference': '%s:main' % case['id']})
        if case.get('relocationAtSameInstant'):
            returned.append({'id': '%s:relocation' % case['id'], 'caseId': case['id'], 'utc': iso_of_ms(product),
                             'reference': '%s:relocation' % case['id']})
    return {'cases': cases, 'returnedCharts': returned}


# --- transit windows -----------------------------------------------------------

ORB = 3.0
OFFSETS = {'conjunction': [0], 'sextile': [60, 300], 'square': [90, 270], 'trine': [120, 240], 'opposition': [180]}


def window_geometry(series, clock, base, a, b, budget):
    """Components of |longitude - (base + 360k)| <= 3 deg over [a, b] (TT), for
    every lap k, with bands, exact passes and minima, and the conditioning
    record. `base` is the aspect branch's target in [0, 360)."""
    turns = series.extrema(a, b)
    values = [series.at(a), series.at(b)] + [v for _, v, _ in turns]
    k0 = math.floor((min(values) - ORB - base) / 360.0)
    k1 = math.ceil((max(values) + ORB - base) / 360.0)
    components, warnings = [], []
    for k in range(k0, k1 + 1):
        level = base + 360.0 * k
        f = lambda t, level=level: series.at(t) - level  # noqa: E731
        if min(values) > level + ORB or max(values) < level - ORB:
            continue
        thresholds = []
        for side in (-ORB, ORB):
            for root in series.roots(level + side, a, b):
                if a < root[0] < b:
                    thresholds.append((root, level + side))
        thresholds.sort(key=lambda x: x[0][0])
        edges = [a] + [x[0][0] for x in thresholds] + [b]
        cells = [abs(f(0.5 * (lo + hi))) <= ORB for lo, hi in zip(edges, edges[1:])]
        exact = [r for r in series.roots(level, a, b)]
        i = 0
        while i < len(cells):
            if not cells[i]:
                i += 1
                continue
            j = i
            while j + 1 < len(cells) and cells[j + 1]:
                j += 1
            start, end = edges[i], edges[j + 1]
            entry = thresholds[i - 1] if i > 0 else None
            exit_ = thresholds[j] if j < len(thresholds) else None
            comp = {'start': start, 'end': end, 'entry': entry, 'exit': exit_, 'level': level,
                    'exact': [r for r in exact if start <= r[0] <= end],
                    'turns': [x for x in turns if start < x[0] < end]}
            components.append(comp)
            i = j + 1
        # Conditioning: no turning point or query end within the budget of a level.
        for t, v, _ in turns:
            e = abs(v - level)
            if abs(e - ORB) <= 2 * budget:
                warnings.append('turn at %s is %.6f deg from the %g-deg threshold' % (iso_of_ms(clock.ms_of_tt(t)), abs(e - ORB), ORB))
            if budget < e <= 2 * budget:
                warnings.append('turn at %s is %.6f deg from exact, inside twice the budget' % (iso_of_ms(clock.ms_of_tt(t)), e))
        for t in (a, b):
            e = abs(f(t))
            if abs(e - ORB) <= budget or e <= budget:
                warnings.append('query end %s is within the budget of a level (%.6f)' % (iso_of_ms(clock.ms_of_tt(t)), e))
    components.sort(key=lambda c: c['start'])
    return components, warnings


def region_around(series, clock, level, t0, width, lo_limit, hi_limit):
    """The connected set around the turning point t0 where |longitude - level|
    <= width, on its two adjacent monotonic branches. On each branch the
    longitude runs monotonically away from t0; the set ends where it reaches
    the level +-width on the side the branch ends on (the same side for a near
    miss, the far side after a crossing)."""
    ends = []
    for other in (lo_limit, hi_limit):
        a, b = (other, t0) if other < t0 else (t0, other)
        side = 1.0 if series.at(other) - level > 0 else -1.0
        target = level + side * width
        fa, fb = series.at(a) - target, series.at(b) - target
        if (fa > 0) == (fb > 0):
            raise SystemExit('ill-conditioned: a region around a turning point reaches a turning point or query end')
        ends.append(series.solve(target, a, b))
    return padded_band(clock, min(ends), max(ends))


def minimum_envelope(series, clock, level, t0, e0, budget, lo_limit, hi_limit):
    """The connected set around the turning point t0 where |longitude - level|
    <= e0 + 2B: the closest-approach time envelope."""
    return region_around(series, clock, level, t0, e0 + 2 * budget, lo_limit, hi_limit)


def neighbours(series, t, a, b):
    """The turning points (or query ends) just before and after t."""
    cuts = [a] + [x[0] for x in series.extrema(a, b)] + [b]
    before = max(c for c in cuts if c < t)
    after = min(c for c in cuts if c > t)
    return before, after


def component_record(series, clock, comp, a, b, budget):
    level = comp['level']
    rec = {
        'startUtc': iso_of_ms(clock.ms_of_tt(comp['start'])),
        'endUtc': iso_of_ms(clock.ms_of_tt(comp['end'])),
        'startClipped': comp['entry'] is None,
        'endClipped': comp['exit'] is None,
        'entryBandMs': None, 'exitBandMs': None, 'exactBandsMs': [],
    }
    for key, edge in (('entryBandMs', comp['entry']), ('exitBandMs', comp['exit'])):
        if edge is None:
            continue
        root, edge_level = edge
        lo, hi, complete = series.band(edge_level, budget, root, a, b)
        if not complete:
            raise SystemExit('ill-conditioned: a threshold band is not complete')
        rec[key] = padded_band(clock, lo, hi)
    uncertain = [x for x in comp['turns'] if abs(x[1] - level) <= budget]
    minima = []
    for t, v, kind in comp['turns']:
        signed = v - level
        if (signed > 0 and kind == 'minimum') or (signed < 0 and kind == 'maximum'):
            minima.append((t, abs(signed)))
    if uncertain:
        t0, v0, _ = uncertain[0]
        e0 = abs(v0 - level)
        before, after = neighbours(series, t0, a, b)
        # The smallest orb around the turn: zero when the longitude crosses the
        # level on either side of it (the turn is then a local maximum of the
        # orb, e0 past exact), e0 when it turns short of the level. The
        # possible-minimum region is the connected set within that plus 2B
        # (v6 policy: e <= B possible-exact, e <= 2B possible-minimum).
        crosses = any((series.at(x) - level > 0) != (v0 - level > 0) for x in (before, after))
        e_min = 0.0 if crosses else e0
        rec.update({
            'exactTopology': 'uncertain',
            'globalMinimumKind': 'unresolved-cross-model-count',
            'globalMinimum': None,
            'localMinima': [],
            'turningPointMarginDegrees': round(e0, 9),
            'possibleExactRegionMs': region_around(series, clock, level, t0, budget, before, after),
            'possibleMinimumRegionMs': minimum_envelope(series, clock, level, t0, e_min, budget, before, after),
            'sourceExactCount': len(comp['exact']),
        })
        return rec
    for root in comp['exact']:
        lo, hi, complete = series.band(level, budget, root, a, b)
        if not complete:
            raise SystemExit('ill-conditioned: an exact band is not complete')
        rec['exactBandsMs'].append(padded_band(clock, lo, hi))
    local = []
    for t, e in minima:
        before, after = neighbours(series, t, a, b)
        local.append({'orbDegrees': round(e, 12), 'timeEnvelopeMs': minimum_envelope(series, clock, level, t, e, budget, before, after),
                      'sourceBestUtc': iso_of_ms(clock.ms_of_tt(t))})
    rec['localMinima'] = local
    if comp['exact']:
        rec['globalMinimumKind'] = 'exact'
        rec['globalMinimum'] = None
    elif local:
        rec['globalMinimumKind'] = 'isolated-source-minimum'
        rec['globalMinimum'] = min(local, key=lambda m: m['orbDegrees'])
    else:
        rec['globalMinimumKind'] = 'no-verified-minimum-within-this-portion'
        rec['globalMinimum'] = None
    rec['exactTopology'] = 'resolved'
    return rec


def crop_record(series, clock, label, geometry_id, base, comps, recs, c0_ms, c1_ms, budget):
    c0, c1 = clock.tt_of_ms(c0_ms), clock.tt_of_ms(c1_ms)
    boundaries = []
    for t, ms in ((c0, c0_ms), (c1, c1_ms)):
        e = abs(wrap180(series.at(t) - base))
        in_band = any(r[k] and r[k][0] <= ms <= r[k][1] for r in recs for k in ('entryBandMs', 'exitBandMs'))
        in_exact = any(b[0] <= ms <= b[1] for r in recs for b in r['exactBandsMs']) or any(
            r.get('possibleExactRegionMs') and r['possibleExactRegionMs'][0] <= ms <= r['possibleExactRegionMs'][1] for r in recs)
        boundaries.append({'orbDegrees': e, 'membershipAmbiguousWithinBudget': abs(e - ORB) <= budget or in_band,
                           'exactCountAmbiguousWithinBudget': e <= budget or in_exact})
    portions = []
    for comp in comps:
        s, t = max(comp['start'], c0), min(comp['end'], c1)
        if s > t:
            continue
        portions.append({'startClipped': comp['entry'] is None or c0 > comp['start'],
                         'endClipped': comp['exit'] is None or c1 < comp['end'],
                         'sourceExactCount': sum(1 for r in comp['exact'] if c0 <= r[0] <= c1)})
    return {'label': label, 'geometryId': geometry_id, 'fromUtc': iso_of_ms(c0_ms), 'toUtc': iso_of_ms(c1_ms),
            'boundaries': boundaries, 'portions': portions}


def pack_windows(clock, spec, eight):
    tables = {}
    for body in ('Jupiter', 'Uranus', 'Neptune', 'Pluto'):
        tables[body] = table('%s-2019-2020' % body.lower(), body, clock,
                             ms_of_iso('2019-01-01T00:00:00Z'), ms_of_iso('2020-12-31T00:00:00Z'), '1 d', 10)
    tables['Saturn'] = SATURN
    natal = spec['coherentNatalInput']
    natal_tt = clock.tt_of('window:natal')
    natal_moon = positions_at([natal_tt])['Moon'][0]
    natal_angles = geometry.chart_angles(clock.ut1_of('window:natal') + J2000, natal_tt + J2000,
                                         natal['latitudeDegrees'], natal['longitudeDegreesEastPositive'], 'placidus')
    station = next(s for s in eight['stations'] if s['id'] == 'Sstation')
    out_cases, warnings = [], {}
    for case in spec['cases']:
        kind = case['target']
        if kind['kind'] == 'literal':
            target = kind['longitudeDegrees']
        elif kind['kind'] == 'natal-saturn':
            target = eight['saturn']['natalLongitudeDegrees']
        elif kind['kind'] == 'station-offset':
            target = norm360(station['analyticStationLongitudeDegrees'] + kind['offsetDegrees'])
        elif kind['kind'] == 'coherent-natal':
            target = {'Moon': natal_moon, 'ASC': natal_angles['ascendantDegrees'], 'MC': natal_angles['midheavenDegrees']}[case['natalPoint']]
        else:
            raise SystemExit('unknown target kind')
        series = tables[case['movingBody']]
        from_ms, to_ms, anchor_ms = ms_of_iso(case['fromUtc']), ms_of_iso(case['toUtc']), ms_of_iso(case['anchorUtc'])
        a, b = clock.tt_of_ms(from_ms), clock.tt_of_ms(to_ms)
        budget = case['angularBudgetDegrees']
        crops = [('first-half', from_ms, anchor_ms), ('second-half', anchor_ms, to_ms)]
        if kind['kind'] == 'station-offset':
            crops.append(('station-plus-minus-one-day', station['analyticStationMilliseconds'] - DAY_MS,
                          station['analyticStationMilliseconds'] + DAY_MS))
        geometries, crop_rows, case_warnings = [], [], []
        for aspect in case['aspects']:
            for offset in OFFSETS[aspect]:
                base = norm360(target + offset)
                comps, warn = window_geometry(series, clock, base, a, b, budget)
                case_warnings += ['%s %d: %s' % (aspect, offset, w) for w in warn]
                recs = [component_record(series, clock, c, a, b, budget) for c in comps]
                gid = '%s:%s:%d' % (case['id'], aspect, offset)
                geometries.append({'sourceId': gid, 'aspect': aspect, 'offset': offset, 'components': recs})
                for label, c0, c1 in crops:
                    crop_rows.append(crop_record(series, clock, label, gid, base, comps, recs, c0, c1, budget))
        row = {
            'id': case['id'], 'movingBody': case['movingBody'], 'natalPoint': case['natalPoint'],
            'targetLongitudeDegrees': target, 'targetKind': kind['kind'],
            'angularBudgetDegrees': budget, 'natalComponentBudgetDegrees': case['natalComponentBudgetDegrees'],
            'input': case['input'], 'fromUtc': iso_of_ms(from_ms), 'toUtc': iso_of_ms(to_ms), 'anchorUtc': iso_of_ms(anchor_ms),
            'geometries': geometries, 'crops': crop_rows,
        }
        if case_warnings:
            warnings[case['id']] = case_warnings
        out_cases.append(row)
    return {'coherentNatalInput': natal, 'cases': out_cases}, warnings


# ---------------------------------------------------------------------------

def header(what, clock_data, extra=None):
    h = {
        'schemaVersion': 1,
        'what': what,
        'arbiters': {
            'positions': 'NASA JPL Horizons API 1.2, DE441: observer-centred apparent ecliptic longitude of date (QUANTITIES 31, CENTER 500@399, airless, TIME_TYPE TT); Mars to Pluto as system barycentres (NAIF 4-9).',
            'trueNode': 'Ascending node of the Moon\'s osculating orbit from Horizons DE441 geometric geocentric state vectors (VECTORS, ICRF): h = r x v, rotated with ERFA pnm06a and the true obliquity into the true ecliptic and equinox of date; speed by central difference over +-0.001 day.',
            'angles': 'ERFA 2.0.1 (pyerfa 2.0.1.5): GAST = gst06a at the engine\'s UT1 and TT for the instant; true obliquity = obl06 + Delta-epsilon of nut06a; ASC, MC and Placidus by the conformance suite\'s L2 construction (zodiacs-org/engine 8c4946b1, CC0); whole-sign cusps from the ASC where |latitude| >= 90 deg - true obliquity.',
            'events': 'Roots of the Horizons longitude interpolated from a uniform TT table (nine-point Lagrange), refined to 1e-9 day; each band is the connected set on the root\'s monotonic branch where the longitude is within the predeclared budget of its level, with 1 s of padding each side.',
        },
        'clock': 'Each instant is evaluated at the engine\'s own UT1 and TT for it, as the engine makes astronomy-engine\'s time (tools/engine-clock.ts): from 1972-01-01 to 2027-10-02 the instant is read as UTC, with TT = UTC + (TAI - UTC) + 32.184 s from the IERS leap seconds and UT1 = UTC + (UT1 - UTC) (basis %s, table %s); at any other instant UT1 is the instant and TT = UT1 + Delta T of model %s (table %s). A comparison therefore measures positions and angles, not the clock; the clock is checked against the IERS in docs/platform/evidence/deltat-2026-09-25/.' % (clock_data['iersModel'], clock_data['iersTableDigest'], clock_data['deltaTModel'], clock_data['deltaTTableDigest']),
        'engineClock': {'engineVersion': clock_data['engineVersion'], 'deltaTModel': clock_data['deltaTModel'],
                        'deltaTTable': clock_data['deltaTTable'], 'deltaTTableDigest': clock_data['deltaTTableDigest'],
                        'iersModel': clock_data['iersModel'], 'iersTable': clock_data['iersTable'],
                        'iersTableDigest': clock_data['iersTableDigest']},
        'generator': {
            'command': 'python3 docs/engine-validation/independent-references/tools/build.py',
            'sources': {rel(p): sha256(p) for p in sorted(
                [os.path.join(HERE, n) for n in ('build.py', 'geometry.py', 'series.py', 'horizons.py', 'engine-clock.ts')] + [CASES])},
            'pyerfa': erfa.__version__, 'erfa': erfa.version.erfa_version},
        'horizonsManifest': {'path': rel(horizons.MANIFEST), 'sha256': sha256(horizons.MANIFEST)},
        'noSwiss': 'No Swiss Ephemeris code or output is read or reproduced here.',
    }
    if extra:
        h.update(extra)
    return h


SATURN = None
RETURNS = None
MOON_TABLES = {}
CHART_SPECS = []


def fill_charts(value, filled):
    """Replace every chart key left by a pack with its chart."""
    if isinstance(value, dict):
        return {k: (strip_chart(filled[v]) if isinstance(v, str) and v in filled and k != 'id' and k != 'caseId' else fill_charts(v, filled))
                for k, v in value.items()}
    if isinstance(value, list):
        return [fill_charts(v, filled) for v in value]
    return value


def select_wrap(clock=None):
    """L-wrap's birth: the first instant after 2000-01-01T00:00:00Z at which the
    Horizons Moon's apparent longitude is 0 deg, on the engine's clock, to the
    nearest millisecond."""
    if clock is None:
        request = {'instants': {}, 'ranges': {'wrap': {'fromUtc': '1999-12-25T00:00:00Z', 'toUtc': '2000-02-10T00:00:00Z', 'stepDays': 0.25}}, 'returns': {}}
        clock = Clock(run_engine_clock(request))
    start = ms_of_iso('2000-01-01T00:00:00Z')
    series = table('moon-wrap-selection', 'Moon', clock, start, start + 32 * DAY_MS, '1 h', 1)
    found = crossings(series, clock, 0.0, clock.tt_of_ms(start), clock.tt_of_ms(start + 31 * DAY_MS), {})
    first = found[0]
    iso = iso_of_ms(first['ms'])
    print(json.dumps({'birthTransport': iso, 'rawMilliseconds': first['ms']}), file=sys.stderr)
    return iso


def main(argv):
    global SATURN, RETURNS
    if '--refresh' in argv:
        horizons.REFRESH = True
    elif '--refresh-changed' in argv:
        horizons.REFRESH = 'changed'
    if argv[:1] == ['select-wrap']:
        select_wrap()
        return
    cases = read_json(CASES)
    node_policy_path = os.path.join(FIXTURES, 'swiss-node-polar-policy.json')
    eight_policy_path = os.path.join(FIXTURES, 'swiss-eight-cases-policy.json')
    lunar_policy_path = os.path.join(FIXTURES, 'independent-lunar-return-policy.json')
    node_policy, eight_policy, lunar_policy = read_json(node_policy_path), read_json(eight_policy_path), read_json(lunar_policy_path)
    windows = cases['transitWindows']
    request = request_for(cases, lunar_policy, eight_policy, windows)
    clock_data = run_engine_clock(request)
    clock = Clock(clock_data)
    RETURNS = clock_data['returns']
    SATURN = table('saturn-2016-2082', 'Saturn', clock, ms_of_iso('2016-01-01T00:00:00Z'), ms_of_iso('2082-12-31T00:00:00Z'), '2 d', 30)

    wrap = next(c for c in lunar_policy['cases'] if c['id'] == 'L-wrap')
    selected = select_wrap(clock)
    if wrap['birthTransport'] != selected or lunar_policy['wrapSelection']['frozenSelectedBirthUTC'] != selected:
        raise SystemExit('L-wrap: the policy records %s, the Horizons selection gives %s' % (wrap['birthTransport'], selected))
    answered = lunar_policy['wrapSelection']['horizonsResponse']
    if answered['file'] != rel(os.path.join(horizons.STORE, 'moon-wrap-selection.txt')) \
            or answered['sha256'] != sha256(os.path.join(horizons.STORE, 'moon-wrap-selection.txt')):
        raise SystemExit('L-wrap: the policy names a Horizons response other than the one kept')

    # Batch a: every instant known before any event is solved.
    known = [clock.tt_of(k) for k in clock.instants if not k.startswith('window:') or k == 'window:natal']
    prefetch('a', known, with_nodes=True)
    node_polar = pack_node_polar(cases, clock, node_policy)
    eight = pack_eight_cases(clock, eight_policy)
    lunar = pack_lunar(clock, lunar_policy)
    # Batch b: the chart instants the events gave.
    prefetch('b', [s['tt'] for s in CHART_SPECS], with_nodes=True)
    filled = charts(CHART_SPECS)
    eight = fill_charts(eight, filled)
    lunar = fill_charts(lunar, filled)
    win, warnings = pack_windows(clock, windows, eight)

    gates = lambda path: {'path': rel(path), 'sha256': sha256(path)}  # noqa: E731
    write_json(os.path.join(FIXTURES, 'independent-node-polar.json'), {
        **header('Independent true-node, polar-angle and Placidus references for the cases of the removed Swiss node/polar pack and the five Placidus vectors of engine.test.ts.', clock_data,
                 {'gates': gates(node_policy_path)}),
        **node_polar,
    })
    write_json(os.path.join(FIXTURES, 'independent-eight-cases.json'), {
        **header('Independent references for the eight-case pack: three fixed epochs, two conditioned stations, a solar return with its charts and a Saturn return, on the inputs of swiss-eight-cases-policy.json.', clock_data,
                 {'gates': gates(eight_policy_path)}),
        **eight,
    })
    write_json(os.path.join(FIXTURES, 'independent-lunar-returns.json'), {
        **header('Independent lunar-return references: natal targets, every crossing in the 40-day window with its fixed-target and natal-derived bands, the chart at the independent return instant, and the chart at the instant the product returns.', clock_data,
                 {'gates': gates(lunar_policy_path)}),
        **lunar,
    })
    write_json(os.path.join(FIXTURES, 'transit-window-horizons.json'), {
        **header('Independent transit-window references for the nine A-I cases: 3-degree orb components, threshold and exact bands, closest approaches, crops and D\'s unresolved exact topology.', clock_data,
                 {'conditioningNotes': warnings}),
        **win,
    })
    if warnings:
        print('conditioning notes: ' + json.dumps(warnings, indent=1), file=sys.stderr)
    if clock.fallbacks:
        print('TT roots with no single instant on the engine\'s clock: ' + ', '.join(clock.fallbacks), file=sys.stderr)
    horizons.prune()


if __name__ == '__main__':
    main(sys.argv[1:])
