# Owner decisions of 2026-10-06

The handoff records the owner's answer, “i go with your recommendations”,
to these three recommendations. This file carries those decisions forward;
it grants no publication approval and accepts no programme unit.

## 1. Package contents: 1,000,000 bytes

The engine's unpacked package cap rises from 950,000 to 1,000,000 bytes.
The 1.0 declarations document the public API and the package keeps its full
changelog. Engine commit `77a16c2` applies this decision. The rc.2 archive
contains 989,528 unpacked bytes, leaving 10,472 bytes under the approved cap.

## 2. The geo entry: 35,500 bytes

The engine's geo budget rises from 35,000 to 35,500 bytes so `calendarNote`
validates its arguments in 1.0. Adding those refusals later would change
which calls 1.0 answers. Engine commits `d57eb2c` and `f9428a2` apply it.
No site route or engine-chunk budget changes.

## 3. F-80: an epoch anywhere in EPHEMERIS_SPAN

The first clause of P3.2 permits a caller's precession-carried ayanamsa
(the counterpart of `SE_SIDM_USER`) from an epoch anywhere in
`EPHEMERIS_SPAN`, and requires refusal beyond it. The engine's comparison
with ERFA grows outside the span: 0.0051 arcseconds for an epoch a century
before it, 0.35 arcseconds from JD 1,000,000, 10.6 arcseconds from JD 0.5,
and 139 degrees at the first day a JavaScript Date holds.

Evidence: [the engine's epoch comparison](https://github.com/zodiacs-org/engine/tree/ff4457be15338fb463e1a379de586b0523ae4844/docs/evidence/calc-epochs-2026-10-06).
P3.2 stays validated until a candidate implementing this reading is served
in production and judged against the complete gate. F-80 is not closed by
a local adoption or this decision record.
