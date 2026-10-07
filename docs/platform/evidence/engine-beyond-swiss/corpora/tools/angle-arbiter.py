"""The ERFA arbiter for brief v1 rules 1b and 1h, without Swiss output.

For grid A of angle-grid-inputs.json it computes the ascendant and midheaven
from ERFA's apparent sidereal time and true obliquity of date; for grid L it
computes Placidus's limit, 90 degrees minus the true obliquity, at each
instant. The clock is the engine's (angle-clock.ts), so a comparison with the
engine isolates the angle model. Since @zodiacs/engine 0.1.1-rc.15 that clock
reads an instant from 1972 to 2027-10-02 as UTC, with TT from the IERS leap
seconds and UT1 from IERS UT1 - UTC, and any other instant as UT1 with the
engine's Delta T model; angle-clock.ts gives the UT1 and TT the engine uses.

  GAST = eraGst06a(UT1, TT), at the engine's UT1 and TT
  eps  = eraObl06(TT) + deps from eraNut06a(TT)
  RAMC = GAST + east longitude
  MC   = atan2(sin RAMC, cos RAMC cos eps)
  ASC  = atan2(cos RAMC, -(sin RAMC cos eps + tan lat sin eps))

The engine audit's verifier spot-checked its claims with the same functions
(pyerfa 2.0.1.5, gst06a, obl06, nut06a, UT1 taken as UTC).

  python3 angle-arbiter.py angle-clock.json > ../angle-grid-erfa.json
"""
import hashlib, json, math, os, sys
import erfa

J2000 = 2451545.0
here = os.path.dirname(os.path.abspath(__file__))
corpus_path = os.path.join(here, '..', 'angle-grid-inputs.json')
corpus_bytes = open(corpus_path, 'rb').read()
corpus = json.loads(corpus_bytes)
clock = json.load(open(sys.argv[1]))
assert len(clock['A']) == len(corpus['A']) and len(clock['L']) == len(corpus['L'])


def true_obliquity(tt):
    return erfa.obl06(J2000, tt) + erfa.nut06a(J2000, tt)[1]


def angles(row, times):
    _, lat, lon, _ = row
    ut, tt = times
    eps = true_obliquity(tt)
    ramc = erfa.gst06a(J2000, ut, J2000, tt) + math.radians(lon)
    mc = math.atan2(math.sin(ramc), math.cos(ramc) * math.cos(eps))
    asc = math.atan2(math.cos(ramc),
                     -(math.sin(ramc) * math.cos(eps) + math.tan(math.radians(lat)) * math.sin(eps)))
    return [round(math.degrees(asc) % 360.0, 9), round(math.degrees(mc) % 360.0, 9)]


def limit(times):
    return round(90.0 - math.degrees(true_obliquity(times[1])), 9)


grid_a = [angles(row, times) for row, times in zip(corpus['A'], clock['A'])]
limits = [limit(times) for times in clock['L']]
computable = sum(1 for row, lim in zip(corpus['L'], limits) if abs(row[1]) < lim)
print(json.dumps({
    'what': 'ERFA ascendant and midheaven for grid A, and Placidus\'s limit (90 degrees minus the true obliquity) for grid L, of angle-grid-inputs.json',
    'corpus': {'file': 'angle-grid-inputs.json', 'sha256': hashlib.sha256(corpus_bytes).hexdigest()},
    'erfa': {'pyerfa': erfa.__version__, 'erfa': erfa.version.erfa_version},
    'clock': 'UT1 and TT of the engine\'s own time basis (@zodiacs/engine %s: 1972 to 2027-10-02 read as UTC, TT from the IERS leap seconds and UT1 from IERS UT1 - UTC; otherwise read as UT1, TT from the engine\'s Delta T model), by tools/angle-clock.ts' % clock['engineVersion'],
    'construction': 'GAST = eraGst06a(UT1, TT); eps = eraObl06(TT) + deps of eraNut06a(TT); RAMC = GAST + east longitude; MC = atan2(sin RAMC, cos RAMC cos eps); ASC = atan2(cos RAMC, -(sin RAMC cos eps + tan lat sin eps))',
    'units': 'degrees, rounded to 1e-9',
    'A': grid_a,
    'L': {'limitDegrees': limits, 'computable': computable, 'refused': len(limits) - computable},
}, separators=(',', ':')))
