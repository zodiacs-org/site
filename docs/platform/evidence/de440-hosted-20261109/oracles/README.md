# Oracles of rule (viii) and check C4 (step S2)

Made on 9 November 2026 at 23:32 (Asia/Bangkok), after the preregistration
(`../PREREGISTRATION.md`, commit 5305fc74, pushed at 23:32:34) and before any
backend code, by the chain the preregistration fixes ("The chain of (viii)"):

    venv/bin/python -I tools/erfa_chain.py <de440.bsp> oracles

with Python 3.11.16, numpy 2.4.6, pyerfa 2.0.1.5 (ERFA 2.0.1) and
`de440.bsp` (119,799,808 bytes, SHA-256
`a4ce9bf9b3282becc9f4b2ac3cebe03a2ae7599981aabd7265fd8482fff7c4b5`), read by
`tools/spk_exact.py` in exact rational arithmetic. The run took 5.7 s.

| file | what | SHA-256 |
| --- | --- | --- |
| `erfa-places.json` | rule (viii): the 200 instants by 10 bodies, apparent geocentric ecliptic longitude and latitude of date, degrees | `7d56d6ea938cd90df04a5b902f3ff3fddd5d3535efc886d2dac1fd9dc58831cd` |
| `erfa-nodes.json` | C4: the North Node's longitude at the same 200 instants, degrees | `f8091b4dff24507486af2bfeee56af55f389671db5c96ecf3a9f788408db7213` |
| `self-check-readers.json` | the chain's reader against the research reader (`precision-2026-09-20/numerics/src/spk2.mjs`, Node v22.22.2): 2,400 states, worst relative difference 2.0e-16 in position and 2.1e-16 in velocity, against limits of 1e-14 and 1e-12: pass | `7537b14b0706473b73e059a8106df6f3e77d00f6f5b0184f018024b8165de519` |
| `self-check-moon.json` | each Moon row from the rounded epoch against the exact one, within the Moon's barycentric speed times the rounding over its distance: pass (largest difference 7.25e-6″) | `6e3a0deb142a2c18de679b9ca071d047d94877420d57c5acfeadfde64f742c8b` |
| `c3-unchanged-alpha.json` | C3, run once: rule (viii)'s gate on the research runtime before any change (`tools/c3-unchanged-alpha.mjs`) | `6d3d3e43dd2bfe0c2560b9eab4acaff2b423964f3a4d95369e130c2406ef762e` |

C3 came out as the preregistration expected: the gate fails for the Moon
(93 of 200 rows over 1e-6″, the largest 7.62e-6″), and every other body is
within 4.44e-7″, the size of the gravitational term of `eraAb` that the
runtime leaves out. The Moon's excess is the rounding of the emission epoch
t − τ to a double, times the Earth-Moon barycentre's speed (audit finding
alpha-reduction-math-8); the planned geocentric-Moon change removes it.

These files are inputs of the evaluation and are not edited. The engine's
tier-B tests use copies, checked against the digests above.
