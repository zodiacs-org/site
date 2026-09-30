"""Angles, Placidus cusps and the osculating lunar node from ERFA.

The sphere and the Placidus construction below are copied, trimmed, from the
conformance suite's L2 arbiter (zodiacs-org/engine, commit 8c4946b1,
conformance/arbiters/l2/build.py, dedicated to the public domain under CC0
1.0): `Sky`, `ascendant`, `midheaven`, `placidus_equation`, `placidus_cusp`,
`from_quadrants` and the whole-sign rule. That file implements each house
system from its published definition (Holden, The Elements of House Division,
1977) and checks it two ways; only the parts these references need are here.

Earth rotation and the frame come from ERFA (pyerfa 2.0.1.5, ERFA 2.0.1):
GAST = gst06a(UT1, TT), the true obliquity = obl06(TT) + the Delta-epsilon of
nut06a(TT), and the bias-precession-nutation matrix pnm06a(TT). No astrology
engine and no Swiss Ephemeris code is imported.
"""
from __future__ import annotations

import math

import erfa

DJM0 = 2400000.5
J2000 = 2451545.0
DEG = math.pi / 180.0
TAU = 2.0 * math.pi
HALF_PI = 0.5 * math.pi


def anp(a: float) -> float:
    a = math.fmod(a, TAU)
    if a < 0.0:
        a += TAU
    if a >= TAU:
        a -= TAU
    return a


def anpm(a: float) -> float:
    a = anp(a)
    return a - TAU if a >= math.pi else a


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def norm(a):
    return math.sqrt(dot(a, a))


def neg(a):
    return (-a[0], -a[1], -a[2])


def bisect(fn, lo: float, hi: float) -> float:
    """Root of fn on (lo, hi), fn < 0 just above lo and > 0 just below hi."""
    for _ in range(400):
        mid = 0.5 * (lo + hi)
        if mid <= lo or mid >= hi:
            break
        if fn(mid) < 0.0:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def earth_angles(jd_ut1: float, jd_tt: float):
    """(GAST, true obliquity) in radians, IAU 2006/2000A."""
    ut = jd_ut1 - DJM0
    tt = jd_tt - DJM0
    gast = float(erfa.gst06a(DJM0, ut, DJM0, tt))
    eps_mean = float(erfa.obl06(DJM0, tt))
    _dpsi, deps = erfa.nut06a(DJM0, tt)
    return gast, eps_mean + float(deps)


class Sky:
    """RAMC theta, true obliquity eps and latitude phi (radians), with the
    reference points as unit vectors in the true equator-and-equinox-of-date
    frame: K the north ecliptic pole, Z the zenith, E the east point of the
    horizon, N the north point, M the equator point on the upper meridian."""

    def __init__(self, theta: float, eps: float, phi: float):
        self.theta, self.eps, self.phi = theta, eps, phi
        self.ce, self.se = math.cos(eps), math.sin(eps)
        ct, st = math.cos(theta), math.sin(theta)
        cp, sp = math.cos(phi), math.sin(phi)
        self.K = (0.0, -self.se, self.ce)
        self.Z = (cp * ct, cp * st, sp)
        self.E = (-st, ct, 0.0)
        self.N = (-sp * ct, -sp * st, cp)
        self.M = (ct, st, 0.0)

    def lon_of(self, X) -> float:
        return anp(math.atan2(X[1] * self.ce + X[2] * self.se, X[0]))

    def decl(self, lam: float) -> float:
        return math.asin(self.se * math.sin(lam))

    def ra(self, lam: float) -> float:
        return anp(math.atan2(math.sin(lam) * self.ce, math.cos(lam)))

    def meet(self, pole, side):
        """The ecliptic's intersection with the great circle of pole `pole`, on
        the side of `side`."""
        X = cross(self.K, pole)
        nx = norm(X)
        if nx < 1e-12:
            raise ArithmeticError('great circle coincides with the ecliptic')
        s = dot(X, side) / (nx * norm(side))
        if s < 0.0:
            X, s = neg(X), -s
        if s < 1e-9:
            raise ArithmeticError('intersection lies on the deciding line')
        return self.lon_of(X), s


def ascendant(s: Sky) -> float:
    """The ecliptic's intersection with the horizon on the eastern (rising) side."""
    return s.meet(s.Z, s.E)[0]


def midheaven(s: Sky) -> float:
    """The ecliptic's intersection with the upper meridian."""
    return s.meet(s.E, s.M)[0]


QUADRANT_M = (-2, -1, 1, 2)  # cusps 11, 12, 2, 3


def from_quadrants(mc, c11, c12, asc, c2, c3):
    c = [0.0] * 12
    c[9], c[10], c[11], c[0], c[1], c[2] = mc, c11, c12, asc, c2, c3
    for k in (9, 10, 11, 0, 1, 2):
        c[(k + 6) % 12] = anp(c[k] + math.pi)
    return c


def placidus_equation(s: Sky, m: int, lam: float, upper: bool) -> float:
    """RA(lambda) - RAMC - [90 deg + 30 deg*m + (1 - |m|/3) AD(delta(lambda))]."""
    x = math.tan(s.phi) * math.tan(s.decl(lam))
    if abs(x) > 1.0:
        raise ArithmeticError('circumpolar ecliptic point')
    d = s.ra(lam) - s.theta
    d = anpm(d) if upper else anp(d)
    return d - (HALF_PI + m * math.pi / 6.0 + (1.0 - abs(m) / 3.0) * math.asin(x))


def placidus_cusp(s: Sky, asc: float, mc: float, m: int) -> float:
    if m < 0:
        start, arc, upper = mc, anp(asc - mc), True
    else:
        start, arc, upper = asc, anp(mc + math.pi - asc), False
    t = bisect(lambda t: placidus_equation(s, m, start + t * arc, upper), 0.0, 1.0)
    return anp(start + t * arc)


def placidus_cusps(s: Sky, asc: float, mc: float):
    out = {m: placidus_cusp(s, asc, mc, m) for m in QUADRANT_M}
    return from_quadrants(mc, out[-2], out[-1], asc, out[1], out[2])


def whole_sign_cusps(asc: float):
    sign = math.floor((anp(asc) / DEG) / 30.0)
    return [anp((sign + k) * math.pi / 6.0) for k in range(12)]


def degrees(a_rad: float) -> float:
    return round(anp(a_rad) / DEG, 10)


def chart_angles(jd_ut1: float, jd_tt: float, latitude: float, longitude: float, system: str):
    """ASC, MC and the twelve cusps, in degrees, with the Placidus limit.

    Placidus is defined only where |latitude| < 90 deg - true obliquity; there
    `system` 'placidus' gives the Placidus cusps. Outside it the cusps are the
    whole-sign cusps, the fallback the engine documents."""
    gast, eps = earth_angles(jd_ut1, jd_tt)
    theta = anp(gast + longitude * DEG)
    sky = Sky(theta, eps, latitude * DEG)
    asc = ascendant(sky)
    mc = midheaven(sky)
    limit = 90.0 - eps / DEG
    placidus_defined = abs(latitude) < limit
    if system == 'placidus' and placidus_defined:
        cusps = placidus_cusps(sky, asc, mc)
        used = 'placidus'
    else:
        cusps = whole_sign_cusps(asc)
        used = 'whole'
    return {
        'ascendantDegrees': degrees(asc),
        'midheavenDegrees': degrees(mc),
        'cuspsDegrees': [degrees(c) for c in cusps],
        'houseSystem': used,
        'trueObliquityDegrees': round(eps / DEG, 10),
        'placidusLimitDegrees': round(limit, 10),
        'placidusDefined': placidus_defined,
    }


def ecliptic_of_date(jd_tt: float, vector):
    """A GCRS/ICRF vector rotated into the true ecliptic and equinox of date:
    R1(true obliquity) . NPB (pnm06a)."""
    tt = jd_tt - DJM0
    npb = erfa.pnm06a(DJM0, tt)
    _dpsi, deps = erfa.nut06a(DJM0, tt)
    eps = float(erfa.obl06(DJM0, tt)) + float(deps)
    e = [sum(float(npb[i][j]) * vector[j] for j in range(3)) for i in range(3)]
    c, s = math.cos(eps), math.sin(eps)
    return (e[0], c * e[1] + s * e[2], -s * e[1] + c * e[2])


def node_longitude(jd_tt: float, state) -> float:
    """Longitude of the ascending node of the Moon's osculating orbit, in the
    true ecliptic and equinox of date: the ecliptic direction of z x h, with
    h = r x v the geocentric angular momentum (degrees in [0, 360))."""
    r, v = state[:3], state[3:]
    h = cross(r, v)
    x, y, _z = ecliptic_of_date(jd_tt, h)
    return math.degrees(math.atan2(x, -y)) % 360.0
