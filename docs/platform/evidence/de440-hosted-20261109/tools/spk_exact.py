"""An SPK reader for JPL's DE kernels (type-2 Chebyshev segments only) that
evaluates in exact rational arithmetic: every coefficient, epoch and record
bound is a double, read as the exact rational it denotes, and the Chebyshev
series and its derivative are summed as fractions. A result is rounded to a
double only when the caller asks for one. Written for PREREGISTRATION.md's
rule (viii) chain and C4's node oracle; it shares no code with the runtime's
readers (examples/precision-alpha/tools/spk-backend.mjs, the pack compiler).

    from spk_exact import Kernel
    k = Kernel('de440.bsp')
    pos, vel = k.state(target, center, et)   # Fractions, km and km/s, J2000 (ICRF) axes

Standard library only."""
import mmap
import struct
from fractions import Fraction

RECORD = 1024


class Segment:
    def __init__(self, data, fmt, start_et, end_et, target, center, frame, kind, start, end):
        if kind != 2:
            raise ValueError(f'segment {center} -> {target} is type {kind}; only type 2 is read')
        if frame != 1:
            raise ValueError(f'segment {center} -> {target} is in frame {frame}, not J2000')
        self.data, self.fmt = data, fmt
        self.start_et, self.end_et = start_et, end_et
        self.target, self.center = target, center
        self.start, self.end = start, end
        init, intlen, rsize, n = self.doubles(end - 3, 4)
        self.init, self.intlen, self.rsize, self.n = init, intlen, int(rsize), int(n)
        self.ncoef = (self.rsize - 2) // 3
        if 2 + 3 * self.ncoef != self.rsize:
            raise ValueError('record size is not 2 + 3n')

    def doubles(self, address, count):
        """`count` doubles from 1-based word `address`."""
        offset = (address - 1) * 8
        return struct.unpack_from(f'{self.fmt}{count}d', self.data, offset)

    def record(self, et):
        """The record that covers `et` (a float), as the SPK rules choose it."""
        index = int((et - self.init) // self.intlen)
        if index == self.n:
            index -= 1
        if index < 0 or index >= self.n:
            raise ValueError(f'{et} is outside segment {self.center} -> {self.target}')
        words = self.doubles(self.start + index * self.rsize, self.rsize)
        return words

    def state(self, et):
        """Exact position (km) and velocity (km/s) at `et` (a double, or an exact
        Fraction), as Fractions."""
        words = self.record(float(et))
        mid, radius = Fraction(words[0]), Fraction(words[1])
        exact = et if isinstance(et, Fraction) else Fraction(et)
        s = (exact - mid) / radius
        n = self.ncoef
        # T_k(s) and T'_k(s) by the three-term recurrences, exactly.
        t = [Fraction(1), s]
        dt = [Fraction(0), Fraction(1)]
        for k in range(2, n):
            t.append(2 * s * t[k - 1] - t[k - 2])
            dt.append(2 * t[k - 1] + 2 * s * dt[k - 1] - dt[k - 2])
        pos, vel = [], []
        for axis in range(3):
            coef = words[2 + axis * n: 2 + (axis + 1) * n]
            p = sum((Fraction(c) * t[k] for k, c in enumerate(coef)), Fraction(0))
            v = sum((Fraction(c) * dt[k] for k, c in enumerate(coef)), Fraction(0)) / radius
            pos.append(p)
            vel.append(v)
        return pos, vel


class Kernel:
    def __init__(self, path):
        f = open(path, 'rb')
        self.data = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
        idword = self.data[:8].decode('ascii')
        if not idword.startswith('DAF/SPK'):
            raise ValueError(f'not an SPK file: {idword!r}')
        locfmt = self.data[88:96].decode('ascii')
        self.fmt = {'LTL-IEEE': '<', 'BIG-IEEE': '>'}[locfmt]
        nd, ni = struct.unpack_from(f'{self.fmt}ii', self.data, 8)
        fward, = struct.unpack_from(f'{self.fmt}i', self.data, 76)
        if (nd, ni) != (2, 6):
            raise ValueError('not an SPK summary format')
        self.segments = []
        record = fward
        size = nd + (ni + 1) // 2
        while record:
            base = (record - 1) * RECORD
            nxt, _prev, count = struct.unpack_from(f'{self.fmt}3d', self.data, base)
            for i in range(int(count)):
                off = base + 24 + i * size * 8
                start_et, end_et = struct.unpack_from(f'{self.fmt}2d', self.data, off)
                target, center, frame, kind, start, end = struct.unpack_from(f'{self.fmt}6i', self.data, off + 16)
                self.segments.append(Segment(self.data, self.fmt, start_et, end_et, target, center, frame, kind, start, end))
            record = int(nxt)

    def segment(self, target, center, et):
        for seg in self.segments:
            if seg.target == target and seg.center == center and seg.start_et <= et <= seg.end_et:
                return seg
        raise ValueError(f'no segment {center} -> {target} covers {et}')

    def state(self, target, center, et):
        return self.segment(target, center, et).state(et)


def to_float(vector):
    """Round each exact component to the nearest double."""
    return [float(x) for x in vector]
