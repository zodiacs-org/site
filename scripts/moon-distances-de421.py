"""Write scripts/fixtures/moon-distances/de421-reference.json: JPL DE421's Moon distances.

The reference that scripts/build-moon-distances.test.mjs holds
src/data/moon-distances.json to. For each new and full Moon in
src/data/sky.json it gives DE421's geocentric distance, centre of the Earth to
centre of the Moon, geometric, at the catalog instant; for each apsis in
moon-distances.json it gives DE421's own perigee or apogee nearest it (the
extremum of the distance within 12 hours either side, golden section search to
a few milliseconds) with its instant and distance.

DE421 is JPL's public planetary and lunar ephemeris (1900 to 2050). It is not
in the repository; download it once from
https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de421.bsp and pass its path.
The file is read directly (DAF/SPK, Chebyshev type 2 segments 301 and 399
about the Earth-Moon barycentre), so only numpy is needed. Instants are UTC;
DE421 runs on TDB, taken here as UTC + 69.184 s (37 leap seconds plus 32.184 s,
right while no leap second is added; TDB minus TT stays under 2 ms, a few
metres of Moon motion). Against the two JPL Horizons DE441 responses in
scripts/fixtures/moon-distances/horizons/ this reader agrees to 1 metre.

Usage:
  python3 scripts/moon-distances-de421.py /path/to/de421.bsp           # write the fixture
  python3 scripts/moon-distances-de421.py /path/to/de421.bsp --check   # compare with it
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import struct
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SKY = ROOT / "src/data/sky.json"
DISTANCES = ROOT / "src/data/moon-distances.json"
OUT = ROOT / "scripts/fixtures/moon-distances/de421-reference.json"
DE421_URL = "https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de421.bsp"
TT_MINUS_UTC = 69.184
J2000 = dt.datetime(2000, 1, 1, 12, tzinfo=dt.timezone.utc)


class Spk:
    def __init__(self, path: Path):
        self.data = path.read_bytes()
        nd, ni = struct.unpack("<ii", self.data[8:16])
        fward = struct.unpack("<i", self.data[76:80])[0]
        self.segments = {}
        record = fward
        while record:
            base = (record - 1) * 1024
            nxt, _prev, count = struct.unpack("<ddd", self.data[base : base + 24])
            size = nd + (ni + 1) // 2
            for i in range(int(count)):
                at = base + 24 + i * size * 8
                ints = struct.unpack(f"<{ni}i", self.data[at + nd * 8 : at + nd * 8 + ni * 4])
                target, centre, _frame, kind, first, last = ints
                if kind == 2:
                    words = np.frombuffer(self.data[(first - 1) * 8 : last * 8], dtype="<f8")
                    self.segments[(target, centre)] = words
            record = int(nxt)

    def position(self, target: int, centre: int, et: float) -> np.ndarray:
        words = self.segments[(target, centre)]
        init, length, size, count = words[-4:]
        size, count = int(size), int(count)
        i = min(int((et - init) // length), count - 1)
        rec = words[i * size : (i + 1) * size]
        mid, radius = rec[0], rec[1]
        n = (size - 2) // 3
        x = (et - mid) / radius
        t = np.zeros(n)
        t[0], t[1] = 1.0, x
        for j in range(2, n):
            t[j] = 2 * x * t[j - 1] - t[j - 2]
        return np.array([t @ rec[2 + c * n : 2 + (c + 1) * n] for c in range(3)])


def parse(iso: str) -> dt.datetime:
    return dt.datetime.fromisoformat(iso.replace("Z", "+00:00"))


def iso_second(moment: dt.datetime) -> str:
    rounded = (moment + dt.timedelta(microseconds=500_000)).replace(microsecond=0)
    return rounded.strftime("%Y-%m-%dT%H:%M:%SZ")


def distance(spk: Spk, moment: dt.datetime) -> float:
    et = (moment - J2000).total_seconds() + TT_MINUS_UTC
    v = spk.position(301, 3, et) - spk.position(399, 3, et)
    return float(np.linalg.norm(v))


def extremum(spk: Spk, seed: dt.datetime, kind: str) -> tuple[dt.datetime, float]:
    sign = 1.0 if kind == "perigee" else -1.0
    f = lambda s: sign * distance(spk, seed + dt.timedelta(seconds=s))
    a, b = -43200.0, 43200.0
    g = (5 ** 0.5 - 1) / 2
    for _ in range(80):
        c, d = b - g * (b - a), a + g * (b - a)
        if f(c) < f(d):
            b = d
        else:
            a = c
    s = (a + b) / 2
    return seed + dt.timedelta(seconds=s), sign * f(s)


def build(path: Path) -> str:
    spk = Spk(path)
    sky = json.loads(SKY.read_text())
    seeds = {}
    for lunation in json.loads(DISTANCES.read_text())["lunations"]:
        for kind in ("perigee", "apogee"):
            for side in ("before", "after"):
                apsis = lunation[kind][side]
                seeds[apsis["at"]] = kind
    apsides = []
    for at in sorted(seeds):
        moment, km = extremum(spk, parse(at), seeds[at])
        apsides.append({"kind": seeds[at], "seed": at, "at": iso_second(moment), "distanceKm": round(km, 3)})
    payload = {
        "source": "scripts/moon-distances-de421.py",
        "ephemeris": {
            "name": "JPL DE421",
            "url": DE421_URL,
            "sha256": hashlib.sha256(spk.data).hexdigest(),
        },
        "distance": "geocentric, centre of the Earth to centre of the Moon, geometric, km",
        "timeScale": f"UTC; TDB taken as UTC + {TT_MINUS_UTC} s",
        "lunations": [
            {"type": m["type"], "at": m["at"], "distanceKm": round(distance(spk, parse(m["at"])), 3)}
            for m in sky["moons"]
        ],
        "apsides": apsides,
    }
    return json.dumps(payload, indent=2) + "\n"


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        print(__doc__)
        return 2
    text = build(Path(args[0]))
    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text() != text:
            print("moon-distances-de421: the fixture is stale; rerun without --check", file=sys.stderr)
            return 1
        print("moon-distances-de421: fixture up to date")
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text)
    print(f"moon-distances-de421: wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
