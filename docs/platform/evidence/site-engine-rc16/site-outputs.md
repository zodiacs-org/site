# rc.15 → rc.16 site output attribution

This is an engine-adoption comparison, not an external accuracy result. It
neither accepts nor changes P1.03, P2.A.house.koch, or any numerical ledger gate.
It makes no claim that a finite sample proves completeness.

## Result

The complete Node 22.22.2 run passed: **574,961 calls, 34,189,944 compared
values, 10,131,398 changed values, zero unexplained values, and zero mechanism
failures**. All original section call counts are retained. The validator also
passes the source/archive bindings and the seven negative controls.

- 2,826,300 longitude pairs and 2,828,160 speed pairs were replayed exactly
  on both sides; 2,650,980 latitude pairs also replayed exactly
- 175,504 located-chart angle and house pairs were exactly reconstructed
  through each package's `internal/math`
- Largest actual longitude shift: **0.256927719″**; maximum Δψ shift including
  all speed-endpoint witness instants: **0.257219207″**
- Largest actual ASC/DSC shift: **0.985385357″**, at Tromsø; MC/IC:
  **0.254163868″**; Placidus cusp: **0.395241687″**
- Largest speed shift: **0.0000210567066°/day** (0.075804144″/day)
- Largest observed longitude-minus-Δψ residual: **2.9338e-13°**; largest
  endpoint-witness residual: 3.3793e-13°. Largest latitude arithmetic change:
  3.2419e-14°. Largest speed-minus-Δψ-finite-difference residual:
  1.2518e-10°/day
- No body sign, ascendant sign, or whole-sign cusp changes were observed
- One midheaven sign-boundary case is counted twice for the two requested
  house systems: Tromsø, `1935-10-31T12:00:00.000Z`, moving from
  240.00001171761429° to 239.99999823549848°
- Eleven body/instant retrograde flags change across eight grid instants,
  producing 165 changed flags when repeated chart/unknown-time calls are
  counted. Every one is derived from an exactly replayed Δψ-adjusted speed
- Progression Date mapping and invalid-date behavior remain identical

These are maxima of this comparison corpus, not new public accuracy bounds.
The larger value count than the historic rc.14 → rc.15 report is not extra
sampling: call coverage is identical, but this comparison has both sides on
the expanded rc.15-era time-scale record.

## Scope and inputs

The old side is `src/lib/engine/` from site commit
`ed55dacb449ada6e4893676c80bd0d9ba73db576`, bundled against the exact
`vendor/zodiacs-engine-0.1.1-rc.15.tgz`. The new side is this isolated adoption
checkout's adapter, bundled against the installed immutable rc.16. The
comparison calls the two unmodified bundles in one process, with their own
astronomy-engine instances, in the same order. It compares numbers with
`Object.is`, dates by milliseconds, and errors by type and message.

`site-outputs-source-binding.json` records the two archive hashes and confirms
that all 69 installed rc.16 files match the archive byte-for-byte.
`site-outputs.json` also records the adapter and measurement-tool hashes.

The original rc.15 corpus is retained: 14,610 ten-day instants from 1800 through
2199; twelve bodies; six places; whole-sign and Placidus charts; unknown-time
charts; the existing node/polar inputs; original ordinary synthetic benchmark
cases; leap-second/time-basis edges; secondary progressions; Date-range mapping;
and invalid dates. The benchmark module's historic `HOLDOUT` identifier is
only its ordinary chart-comparison inputs. No Moon-enclosure or P4.5 holdout
was read or rerun. No Swiss ephemeris, raw Swiss values, DE440 data, or remote
service is used.

## How a difference earns an explanation

`tools/output-mechanisms.mjs` builds separate proof bundles so witness
calculations cannot alter the compared bundles' astronomy-engine caches. It
uses the immutable packages' own dist functions and `internal/math` exports.
An entry receives a cause only after its numerical witnesses pass; the final
command fails if any difference is unexplained or any witness fails.

1. At each relevant instant, including both endpoints of every speed sample,
   the old and new time bases must match exactly. The old five-term tilt and
   the new full IAU 2000B tilt are evaluated at that same TT.
2. Planets use the same EQJ vector. The old true-ecliptic rotation and the new
   mean-ecliptic rotation plus Δψ are replayed separately. The Moon replays
   the old `EclipticGeoMoon` route and the new `GeoMoon` route. Nodes replay
   the angular-momentum vector and each version's exact rotation/order of
   operations. Each observed longitude and latitude must replay exactly.
3. Every observed longitude shift must match `(Δψ_rc16 − Δψ_rc15) / 3600`
   modulo 360°, within a predeclared 1e-9-degree arithmetic-residual limit.
   Latitude is invariant under this longitude-axis rotation; its equivalent
   floating-point arithmetic is checked within 1e-10 degrees, while both
   individual latitude replays are exact.
4. Speeds are independently reconstructed from both measured endpoint
   longitudes with the exact central-difference step and elapsed-time rule:
   ±0.001 day for the ten bodies, ±0.25 day for nodes. Both observed speeds
   must replay exactly. Their change must match the finite difference of
   the two Δψ changes, allowing only the longitude arithmetic residual
   divided by the actual elapsed days, including clock edges.
5. Old and new GAST use the same Earth-rotation and precession terms with
   their respective equations of the equinoxes. rc.16's equation includes
   the two IERS complementary terms. GAST's change is checked against that
   equation change. Both angles and houses are then recomputed through each
   package's `computeAngles`/`computeHouses` from `internal/math`, with their
   respective GAST, true obliquity, and recomputed angles. The complete
   reconstructed angle/house objects must match the observed objects exactly.
6. A counterfactual changes GAST first, then obliquity. The report records
   the two angle/cusp contributions separately, including whole-sign steps.
   Their maxima may occur in different cases and must not be added together.
7. Aspects, including orb arithmetic and ordering, are replayed exactly with
   `findAspects` on the already-verified bodies. Retrograde follows verified
   speed. The version string is explained only for the exact rc.15 → rc.16
   transition. Unknown fields and failed witnesses remain unexplained.

These arithmetic-residual checks are instrumentation checks, not replacements
for the programme's independent accuracy tolerances. `site-outputs-controls.json`
records seven negative controls: artificial changes to longitude, latitude,
speed, angle, cusp, aspect, and version are all refused, as is unknown metadata.

The first full attempt stopped at a bookkeeping `ReferenceError` in the sign
counter. Its log is preserved in `site-outputs-attempt1.log`; it produced no
completed numerical result. The counter was corrected, and smoke, controls,
and the complete corpus were rerun. No engine implementation or tolerance
changed to resolve that measurement-tool error.

## Reproduction

From the site root, with the immutable rc.16 installed and Node 22.22.2:

```sh
node docs/platform/evidence/site-engine-rc16/tools/compare-site-outputs.mjs \
  ed55dacb449ada6e4893676c80bd0d9ba73db576 \
  vendor/zodiacs-engine-0.1.1-rc.15.tgz \
  > docs/platform/evidence/site-engine-rc16/site-outputs.json \
  2> docs/platform/evidence/site-engine-rc16/site-outputs.log
node docs/platform/evidence/site-engine-rc16/tools/test-output-mechanisms.mjs \
  > docs/platform/evidence/site-engine-rc16/site-outputs-controls.json
node docs/platform/evidence/site-engine-rc16/tools/check-output-evidence.mjs \
  > docs/platform/evidence/site-engine-rc16/site-outputs-validation.json
```

The optional `RC16_OUTPUT_SMOKE=1` mode truncates only the 14,610-instant grid
to eight instants and labels the result `smokeOnly: true`; the evidence
validator explicitly refuses it as the full result.
