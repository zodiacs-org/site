"""The oracles of rules (viii) and C4 (PREREGISTRATION.md, "The chain of
(viii)" and C4): apparent geocentric ecliptic places of date for ten bodies,
and the Moon's osculating ascending node, at 200 TT instants, from de440.bsp
read by spk_exact.py in exact arithmetic and reduced by pyerfa.

    venv/bin/python -I erfa_chain.py <de440.bsp> <out-dir>

Writes <out-dir>/erfa-places.json, erfa-nodes.json and self-check.json. Run
once, after the preregistration is pushed and before any backend code.
"""
import hashlib
import json
import math
import os
import subprocess
import sys
import time
from fractions import Fraction

import erfa
import numpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from spk_exact import Kernel  # noqa: E402

AU_KM = 149597870.700
LIGHT_TIME_AU = 499.004783836
C_KM_S = AU_KM / LIGHT_TIME_AU
DAY = 86400
J2000_MS = 946728000000          # 2000-01-01T12:00:00 on the TT scale, ms from 1970-01-01T00:00:00 of the same scale
FROM_MS = -5364662400000         # 1800-01-01T00:00:00
SPAN_DAYS = 146097
ITERS, TOL = 12, 1e-11
DLIM = 1e-14
RAD2ARCSEC = 180 * 3600 / math.pi

BODIES = [('Sun', 10), ('Moon', None), ('Mercury', 1), ('Venus', 2), ('Mars', 4), ('Jupiter', 5),
          ('Saturn', 6), ('Uranus', 7), ('Neptune', 8), ('Pluto', 9)]


def instants():
    """PREREGISTRATION.md: d = SHA-256('p41-erfa/<i>'), u = first 6 bytes big-endian / 2^48,
    TT = 1800-01-01T00:00:00 TT + u * 146,097 days, rounded to the millisecond."""
    out = []
    for i in range(200):
        d = hashlib.sha256(f'p41-erfa/{i}'.encode('ascii')).digest()
        u = Fraction(int.from_bytes(d[:6], 'big'), 2 ** 48)
        ms = FROM_MS + round(u * SPAN_DAYS * DAY * 1000)
        out.append((i, int(ms)))
    return out


def tdb_minus_tt(jd_tt):
    """The runtime's tdbMinusTt (reduce.mjs), same terms and order."""
    g = (357.53 + 0.9856003 * (jd_tt - 2451545.0)) * math.pi / 180
    l = (246.11 + 0.90251792 * (jd_tt - 2451545.0)) * math.pi / 180
    return 0.001658 * math.sin(g) + 0.000014 * math.sin(2 * g) + 0.0000224 * math.sin(l)


class Chain:
    def __init__(self, kernel):
        self.k = kernel

    def ssb(self, code, et):
        """Exact SSB state of a body code at the double et."""
        if code == 'earth':
            p0, v0 = self.k.state(3, 0, et)
            p1, v1 = self.k.state(399, 3, et)
        elif code == 'moon':
            p0, v0 = self.k.state(3, 0, et)
            p1, v1 = self.k.state(301, 3, et)
        else:
            return self.k.state(code, 0, et)
        return [a + b for a, b in zip(p0, p1)], [a + b for a, b in zip(v0, v1)]

    def target(self, name, code, et):
        return self.ssb('moon' if name == 'Moon' else code, et)[0]

    def place(self, name, code, tt_ms, exact_epoch=True):
        """The chain's place. `exact_epoch` evaluates the target at the exact
        rational et - tau (the preregistered chain); False evaluates it at
        the double the runtime forms, for the self-check only."""
        tt_days = (tt_ms - J2000_MS) / 86400000
        jd_tt = tt_days + 2451545.0
        et = tt_days * DAY + tdb_minus_tt(jd_tt)

        def emission(tau):
            return Fraction(et) - Fraction(tau) if exact_epoch else et - tau

        earth_p, earth_v = self.ssb('earth', et)
        tau = 0.0
        geo = [float(a - b) for a, b in zip(self.target(name, code, et), earth_p)]
        converged = False
        for _ in range(ITERS):
            nxt = (math.sqrt(sum(x * x for x in geo)) / AU_KM) * LIGHT_TIME_AU
            if abs(nxt - tau) < TOL:
                tau = nxt
                converged = True
                break
            tau = nxt
            geo = [float(a - b) for a, b in zip(self.target(name, code, emission(tau)), earth_p)]
        emit = emission(tau)
        p = numpy.array(geo) / math.sqrt(sum(x * x for x in geo))
        sun_recv = self.ssb(10, et)[0]
        if name != 'Sun':
            e_vec = [float(a - b) for a, b in zip(earth_p, sun_recv)]
            em = math.sqrt(sum(x * x for x in e_vec)) / AU_KM
            e = numpy.array(e_vec) / math.sqrt(sum(x * x for x in e_vec))
            sun_emit = self.ssb(10, emit)[0]
            q_vec = [float(a - b) for a, b in zip(self.target(name, code, emit), sun_emit)]
            q = numpy.array(q_vec) / math.sqrt(sum(x * x for x in q_vec))
            p = erfa.ld(1.0, p, q, e, em, DLIM)
        s_au = math.sqrt(sum(float(a - b) ** 2 for a, b in zip(earth_p, sun_recv))) / AU_KM
        v = numpy.array([float(x) for x in earth_v]) / C_KM_S
        bm1 = math.sqrt(1 - float(v @ v))
        p = erfa.ab(p, v, s_au, bm1)
        lon, lat = self.ecliptic(tt_days, p)
        return lon, lat, tau, converged, geo, emit

    def frame(self, tt_days):
        gamb, phib, psib, epsa = erfa.pfw06(2451545.0, tt_days)
        dpsi, deps = erfa.nut00b(2451545.0, tt_days)
        t = tt_days / 36525
        fj2 = -2.7774e-6 * t
        dpsi = dpsi + dpsi * (0.4697e-6 + fj2)
        deps = deps + deps * fj2
        rbpn = erfa.fw2m(gamb, phib, psib + dpsi, epsa + deps)
        return rbpn, epsa + deps

    def ecliptic(self, tt_days, vector):
        rbpn, eps = self.frame(tt_days)
        x, y, z = rbpn @ numpy.asarray(vector, dtype=float)
        c, s = math.cos(eps), math.sin(eps)
        ye, ze = c * y + s * z, -s * y + c * z
        lon = math.degrees(math.atan2(ye, x)) % 360.0
        lat = math.degrees(math.atan2(ze, math.hypot(x, ye)))
        return lon, lat

    def node(self, tt_ms):
        tt_days = (tt_ms - J2000_MS) / 86400000
        jd_tt = tt_days + 2451545.0
        et = tt_days * DAY + tdb_minus_tt(jd_tt)
        rm, vm = self.k.state(301, 3, et)
        re, ve = self.k.state(399, 3, et)
        r = [a - b for a, b in zip(rm, re)]
        v = [a - b for a, b in zip(vm, ve)]
        h = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]]
        rbpn, eps = self.frame(tt_days)
        x, y, z = rbpn @ numpy.array([float(c) for c in h])
        c, s = math.cos(eps), math.sin(eps)
        ye = c * y + s * z
        return math.degrees(math.atan2(x, -ye)) % 360.0


PINNED_NODE = '/Users/chiburashka/Developer/zodiacs-programme-20261011/toolchain/node-v22.22.2-darwin-arm64/bin/node'
SEGMENTS = [(10, 0), (1, 0), (2, 0), (3, 0), (4, 0), (5, 0), (6, 0), (7, 0), (8, 0), (9, 0), (301, 3), (399, 3)]


def reader_check(chain, kernel_path, out_dir):
    """Self-check (a): every state the chain reads at a double epoch (each
    instant's et, where it reads every segment) equals the research reader's
    to 1e-14 of the position's size and 1e-12 of the velocity's."""
    queries = []
    for _i, ms in instants():
        tt_days = (ms - J2000_MS) / 86400000
        et = tt_days * DAY + tdb_minus_tt(tt_days + 2451545.0)
        queries.extend([t, c, et] for t, c in SEGMENTS)
    qpath = os.path.join(out_dir, 'self-check-queries.json')
    spath = os.path.join(out_dir, 'self-check-spk2.json')
    with open(qpath, 'w') as f:
        json.dump(queries, f)
    here = os.path.dirname(os.path.abspath(__file__))
    node = os.environ.get('NODE', PINNED_NODE)
    node_version = subprocess.run([node, '--version'], check=True, capture_output=True, text=True).stdout.strip()
    if node_version != 'v22.22.2':
        raise SystemExit(f'the reader check needs Node v22.22.2, got {node_version} from {node}')
    spk2 = os.path.join(here, '..', '..', 'precision-2026-09-20', 'numerics', 'src', 'spk2.mjs')
    spk2_digest = hashlib.sha256(open(spk2, 'rb').read()).hexdigest()
    subprocess.run([node, os.path.join(here, 'spk2-states.mjs'), kernel_path, qpath, spath], check=True)
    theirs = json.load(open(spath))
    worst_p = worst_v = 0.0
    ok = True
    for (t, c, et), other in zip(queries, theirs):
        p, v = chain.k.state(t, c, et)
        p, v = [float(x) for x in p], [float(x) for x in v]
        dp = max(abs(a - b) for a, b in zip(p, other[:3]))
        dv = max(abs(a - b) for a, b in zip(v, other[3:]))
        np_, nv = math.sqrt(sum(x * x for x in p)), math.sqrt(sum(x * x for x in v))
        worst_p, worst_v = max(worst_p, dp / np_), max(worst_v, dv / nv)
        ok = ok and dp <= 1e-14 * np_ and dv <= 1e-12 * nv
    os.remove(qpath)
    os.remove(spath)
    with open(os.path.join(out_dir, 'self-check-readers.json'), 'w') as f:
        json.dump({'reader': 'docs/platform/evidence/precision-2026-09-20/numerics/src/spk2.mjs', 'readerSha256': spk2_digest,
                   'node': node_version, 'states': len(queries),
                   'worstRelativePosition': worst_p, 'worstRelativeVelocity': worst_v,
                   'limits': {'position': 1e-14, 'velocity': 1e-12}, 'pass': ok}, f, indent=1)
        f.write('\n')
    return ok


def angle_arcsec(lon1, lat1, lon2, lat2):
    """The angle between two directions, atan2(|u x w|, u . w), in arcseconds."""
    def unit(lon, lat):
        lo, la = math.radians(lon), math.radians(lat)
        return numpy.array([math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)])
    u, w = unit(lon1, lat1), unit(lon2, lat2)
    return math.atan2(float(numpy.linalg.norm(numpy.cross(u, w))), float(u @ w)) * RAD2ARCSEC


def main():
    kernel_path, out_dir = sys.argv[1], sys.argv[2]
    digest = hashlib.sha256(open(kernel_path, 'rb').read()).hexdigest()
    if digest != 'a4ce9bf9b3282becc9f4b2ac3cebe03a2ae7599981aabd7265fd8482fff7c4b5':
        raise SystemExit(f'kernel digest {digest} is not de440.bsp')
    chain = Chain(Kernel(kernel_path))
    rows, nodes, moon_checks = [], [], []
    t0 = time.time()
    for i, ms in instants():
        for name, code in BODIES:
            lon, lat, tau, converged, geo, _emit = chain.place(name, code, ms)
            rows.append({'i': i, 'ttMs': ms, 'body': name, 'lon': repr(lon), 'lat': repr(lat),
                         'lightTimeSec': repr(tau), 'converged': converged})
            if name == 'Moon':
                # Self-check (b): the place from the double epoch the runtime would
                # form differs from the exact one by no more than the Moon's
                # barycentric speed times that epoch's rounding, over its distance.
                lon_r, lat_r, _t, _c, _g, emit_r = chain.place(name, code, ms, exact_epoch=False)
                tt_days = (ms - J2000_MS) / 86400000
                et = tt_days * DAY + tdb_minus_tt(tt_days + 2451545.0)
                exact = Fraction(et) - Fraction(tau)
                rounding = abs(float(Fraction(emit_r) - exact))
                vel = chain.ssb('moon', et)[1]
                speed = math.sqrt(sum(float(x) ** 2 for x in vel))
                dist = math.sqrt(sum(x * x for x in geo))
                bound = speed * rounding / dist * RAD2ARCSEC
                seen = angle_arcsec(lon, lat, lon_r, lat_r)
                moon_checks.append({'i': i, 'roundingSec': rounding, 'boundArcsec': bound, 'differenceArcsec': seen,
                                    'pass': seen <= bound * 1.01 + 1e-9})
        nodes.append({'i': i, 'ttMs': ms, 'northNodeLon': repr(chain.node(ms))})
    meta = {
        'rule': 'PREREGISTRATION.md, rule (viii) and C4',
        'kernel': {'file': 'de440.bsp', 'bytes': os.path.getsize(kernel_path), 'sha256': digest},
        'python': sys.version.split()[0], 'numpy': numpy.__version__, 'pyerfa': erfa.__version__,
        'erfa': erfa.version.erfa_version, 'seconds': round(time.time() - t0, 1),
    }
    os.makedirs(out_dir, exist_ok=True)
    readers = reader_check(chain, kernel_path, out_dir)
    moon_pass = all(c['pass'] for c in moon_checks)
    worst = max(c['differenceArcsec'] for c in moon_checks)
    with open(os.path.join(out_dir, 'self-check-moon.json'), 'w') as f:
        json.dump({**meta, 'pass': moon_pass, 'worstDifferenceArcsec': worst, 'margin': '1 % and 1e-9 arcsec',
                   'rows': moon_checks}, f, indent=0)
        f.write('\n')
    print(f'reader self-check pass={readers}; moon epoch self-check pass={moon_pass} (worst {worst:.3e} arcsec); '
          f'{meta["seconds"]} s')
    if not (readers and moon_pass):
        raise SystemExit('a self-check failed: no oracle file written')
    with open(os.path.join(out_dir, 'erfa-places.json'), 'w') as f:
        json.dump({**meta, 'rows': rows}, f, indent=0)
        f.write('\n')
    with open(os.path.join(out_dir, 'erfa-nodes.json'), 'w') as f:
        json.dump({**meta, 'rows': nodes}, f, indent=0)
        f.write('\n')
    print(f'{len(rows)} places and {len(nodes)} nodes written')


if __name__ == '__main__':
    main()
