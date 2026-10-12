# The engine references in the claims ledger, 2026-10-12

The claims ledger now reads the engine references the site serves: the 1.0.0 API
reference under `public/developers/engine/reference/`, with the README,
LICENSING and NOTICE of the release it documents, and the archived 0.1.1-rc.1
reference and SDK pages under `public/sdk/` (F-23). Each of their 465 selected
sentences is held to a claim or exempted. Eleven claims are overstated, and
`docs/claims/ledger.json` gives each one its resolution:

- nine are F-89, wording the engine's next release corrects;
- one is F-90, the Swiss ΔT values the engine's conformance corpus records,
  which the owner decides;
- one is the rc.1 footer, which the Phase 1 freeze keeps.

## The blind band of a 5-day scan

The engine's README and its crossing search's documentation say a plain scan at
a 5-day step loses both crossings when a Saturn station falls within 0.0103° of
the target, or a Jupiter station within 0.0205°. `tools/blind-band.mjs` measures
it on the engine's own longitudes (`@zodiacs/engine` 1.0.0, as the site
installs it), at the 12 Saturn and 11 Jupiter stations from 2019 to 2024:

- the second derivative of longitude, f″, by a central difference over ±1 day:
  1.61–1.78·10⁻³ °/day² for Saturn and 3.09–3.51·10⁻³ °/day² for Jupiter;
- the band f″h²/8 within which both crossings can fall inside one 5-day cell:
  0.0050–0.0056° for Saturn and 0.0097–0.0110° for Jupiter;
- a plain sign-change scan, run at each of 100 phases of the 5-day grid, for
  targets placed short of the station. For Saturn at 0.003° depth it misses
  both crossings at 23 to 27 phases, at 0.005° at 1 to 5, and at 0.0103° at
  none. For Jupiter at 0.0103° depth it misses at 0 to 3 phases, and at 0.0205°
  at none.

So the published figures are twice the band. The engine audit's finding
`production-event-search-4`, where they come from, gives the Saturn curvature
correctly but leaves out the half in the depth of the parabola. The 1.0.0
search's curvature test is not affected, since it finds the turn and does not
use the figures.

    node docs/platform/evidence/claims-engine-references-20261012/tools/blind-band.mjs

writes `blind-band.json`.
