"""A Horizons longitude table as a function of time, and what is solved on it.

A uniform table in TT is unwrapped (cumulative longitude) and interpolated
with a centred Lagrange polynomial of nine points; the speed is that
polynomial's derivative. Roots are refined by bisection to a bracket under
1e-9 day (0.09 ms) and extrema by bisection on the speed. Times are TT days
from J2000.0 (JD 2451545.0 TT) throughout.
"""
from __future__ import annotations

import math

J2000 = 2451545.0
ORDER = 9  # points per interpolating polynomial
ROOT_WIDTH_DAYS = 1e-9


class Series:
    def __init__(self, rows):
        """rows: [(jd_tt, lon_deg, ...)] on a uniform grid."""
        self.t = [r[0] - J2000 for r in rows]
        self.h = self.t[1] - self.t[0]
        for a, b in zip(self.t, self.t[1:]):
            if abs((b - a) - self.h) > 1e-9:
                raise ValueError('the table is not uniform')
        lon = [r[1] for r in rows]
        unwrapped = [lon[0]]
        for x in lon[1:]:
            d = ((x - unwrapped[-1]) + 540.0) % 360.0 - 180.0
            unwrapped.append(unwrapped[-1] + d)
        self.v = unwrapped
        self.start, self.stop = self.t[0], self.t[-1]

    def _window(self, t):
        k = int(math.floor((t - self.start) / self.h))
        lo = k - (ORDER // 2 - 1)
        lo = max(0, min(lo, len(self.t) - ORDER))
        if not (self.t[lo] <= t <= self.t[lo + ORDER - 1]):
            raise ValueError('time outside the table: %r' % t)
        return lo

    def at(self, t: float) -> float:
        lo = self._window(t)
        xs, ys = self.t[lo:lo + ORDER], self.v[lo:lo + ORDER]
        total = 0.0
        for i in range(ORDER):
            w = 1.0
            for j in range(ORDER):
                if j != i:
                    w *= (t - xs[j]) / (xs[i] - xs[j])
            total += w * ys[i]
        return total

    def speed(self, t: float) -> float:
        """Degrees per day: the derivative of the interpolating polynomial."""
        lo = self._window(t)
        xs, ys = self.t[lo:lo + ORDER], self.v[lo:lo + ORDER]
        total = 0.0
        for i in range(ORDER):
            denom = 1.0
            for j in range(ORDER):
                if j != i:
                    denom *= xs[i] - xs[j]
            s = 0.0
            for k in range(ORDER):
                if k == i:
                    continue
                p = 1.0
                for j in range(ORDER):
                    if j != i and j != k:
                        p *= t - xs[j]
                s += p
            total += ys[i] * s / denom
        return total

    # --- structure ------------------------------------------------------------
    def extrema(self, a: float, b: float):
        """Turning points of the longitude in (a, b): [(t, value, 'minimum'|'maximum')]."""
        cache = self.__dict__.setdefault('_extrema_cache', {})
        if (a, b) not in cache:
            cache[(a, b)] = self._find_extrema(a, b)
        return cache[(a, b)]

    def _find_extrema(self, a: float, b: float):
        grid = self._grid(a, b)
        out = []
        speeds = [self.speed(t) for t in grid]
        for (t0, s0), (t1, s1) in zip(zip(grid, speeds), zip(grid[1:], speeds[1:])):
            if s0 == 0.0 or (s0 > 0) != (s1 > 0):
                lo, hi = t0, t1
                sign_lo = s0 > 0
                while hi - lo > ROOT_WIDTH_DAYS:
                    mid = 0.5 * (lo + hi)
                    if (self.speed(mid) > 0) == sign_lo:
                        lo = mid
                    else:
                        hi = mid
                t = 0.5 * (lo + hi)
                out.append((t, self.at(t), 'maximum' if sign_lo else 'minimum'))
        return out

    def _grid(self, a, b, per_step=4):
        n = max(2, int(math.ceil((b - a) / (self.h / per_step))) + 1)
        return [a + (b - a) * i / (n - 1) for i in range(n)]

    def branches(self, a: float, b: float):
        """Monotonic pieces of (a, b), split at the turning points."""
        cuts = [a] + [t for t, _, _ in self.extrema(a, b)] + [b]
        return list(zip(cuts, cuts[1:]))

    def solve(self, level: float, lo: float, hi: float) -> float:
        """The root of at(t) = level in [lo, hi], where it changes sign once."""
        f_lo = self.at(lo) - level
        f_hi = self.at(hi) - level
        if f_lo == 0.0:
            return lo
        if f_hi == 0.0:
            return hi
        if (f_lo > 0) == (f_hi > 0):
            raise ValueError('level not bracketed')
        while hi - lo > ROOT_WIDTH_DAYS:
            mid = 0.5 * (lo + hi)
            f = self.at(mid) - level
            if f == 0.0:
                return mid
            if (f > 0) == (f_lo > 0):
                lo, f_lo = mid, f
            else:
                hi = mid
        return 0.5 * (lo + hi)

    def roots(self, level: float, a: float, b: float):
        """Every t in [a, b] with at(t) = level: [(t, branch_lo, branch_hi, direction)]."""
        out = []
        for lo, hi in self.branches(a, b):
            f_lo, f_hi = self.at(lo) - level, self.at(hi) - level
            if f_lo == 0.0 and f_hi == 0.0:
                raise ValueError('flat branch at the level')
            if (f_lo > 0) == (f_hi > 0) and f_lo != 0.0 and f_hi != 0.0:
                continue
            t = self.solve(level, lo, hi)
            if out and abs(out[-1][0] - t) < 1e-6:
                continue
            out.append((t, lo, hi, 1 if self.at(hi) > self.at(lo) else -1))
        return out

    def band(self, level: float, budget: float, root, a: float, b: float):
        """Both ends of the connected set around `root` where the longitude is
        within `budget` of `level`, on the root's monotonic branch. Returns
        (lo, hi, complete); complete is False when a turning point or a query
        end comes first."""
        t, branch_lo, branch_hi, _direction = root
        ends = []
        complete = True
        for side_level in (level - budget, level + budget):
            f_lo, f_hi = self.at(branch_lo) - side_level, self.at(branch_hi) - side_level
            if (f_lo > 0) != (f_hi > 0) or f_lo == 0.0 or f_hi == 0.0:
                ends.append(self.solve(side_level, branch_lo, branch_hi))
            else:
                complete = False
                ends.append(branch_lo if abs(self.at(branch_lo) - level) < abs(self.at(branch_hi) - level) else branch_hi)
        lo, hi = min(ends), max(ends)
        if lo <= a or hi >= b:
            complete = False
        return lo, hi, complete
