# Engine rc.7 site adoption evidence

The site installs the exact archive
[zodiacs-engine-0.1.1-rc.7.tgz](https://raw.githubusercontent.com/zodiacs-org/engine/f37dcdd628b637e5d3785a288a2bc89ceebb9e6a/artifacts/zodiacs-engine-0.1.1-rc.7.tgz),
SHA-256 `49b2b03f50fea8a625d443d4fd0f6d03ffc22831e54009fd09c49d07c8698f90`,
from `vendor/`. It was packed from the root of
[zodiacs-org/engine](https://github.com/zodiacs-org/engine) at source commit
`6e14f3f7c5e3475fefce973a65ce4fc5d846ad85`; the artifact carrier is
`f37dcdd628b637e5d3785a288a2bc89ceebb9e6a`. Two separate clean clones packed
the same bytes. An anonymous read of that address on 2026-09-24 returned HTTP
200 and the same 39,252 bytes, with 23 archive members. The package is an
unpublished candidate: `npm view @zodiacs/engine` returns 404.

## What rc.7 changes

The engine's changelog lists six changes. Four of them move numbers the site
shows:

- The ascendant and midheaven use the true obliquity of date, the one that
  matches apparent sidereal time. On the preregistered 3,128-case grid against
  ERFA the ascendant's largest error falls from 506.8″ to 6.36″, and the
  midheaven's from 2.25″ to 0.20″ (`scripts/angles-grid.test.mjs` holds the
  site to both).
- Placidus falls back to whole sign at 90° minus the obliquity, 66.53° to
  66.59° over 1800–2200, instead of at 66°. Between the two, the site now
  shows Placidus cusps.
- An aspect is applying while its orb shrinks, judged from the two bodies'
  relative speed at the instant. The old rule stepped both bodies 0.02 day
  ahead and read every aspect as separating in the last 14.4 minutes before
  exact.
- Speeds are central differences over ±0.001 day, ±0.25 day for the true node.
  `src/lib/engine/server-ephemeris.ts` takes speeds the same way, and its test
  holds the server and browser values to 12 decimal places.

Planetary longitudes are unchanged. rc.7 also offers Porphyry houses and
records the new conventions in its receipts, while rc.3 to rc.6 receipts stay
readable and replay as before.

## Records

[node22-parity.json](node22-parity.json) and
[node24-parity.json](node24-parity.json) are `scripts/platform-engine-report.mjs`
run against the vendored archive on Node 22.22.2 (tzdata 2025c) and Node
24.21.0 (tzdata 2026c). Both passed on the frozen Swiss node and polar pack:
6.07″ in node longitude, 0.00035°/day in node speed, 1.58″ in the polar angles
and exact whole-sign cusps. Engine 0.1.0 measured 1.57″ in the same polar cases
when the pack was frozen. This is a finite corpus, not an error bound.

[public-candidate-consumer.log](public-candidate-consumer.log) records the
engine repository's own `scripts/verify-packed-consumer.mjs`, at the source
commit, run against the vendored archive on both Node versions. Each run
installs the archive into a fresh directory and uses only the root, geo and
receipt exports and the archive's declarations, with TypeScript 5.9.3. All 15
checks passed. It is an automated check run by the integrator, not an
independent review.

## Limits

There is no separate browser record for rc.7 like rc.6's Chrome 152 run; the
site's own Chromium checks run the vendored package in CI. Exact geographic
poles and ecliptic-horizon coincidences remain outside verified angle scope.
Signed fixed-offset receipt syntax is still a declared limitation.

## Swiss output removed, 2026-09-28

Under [DECISIONS-2026-09-28 §3](../../programme/DECISIONS-2026-09-28.md) the two parity reports here lost their per-case differences from
the Swiss node/polar fixture (`nodes` and `polar`). Their maxima, which the
figures above quote, stay, and each report records the SHA-256 of what it
lost under `swissOutputRemoved`; the Node 22 and Node 24 digests are equal,
as the values were. Commit `2ca93d41` still has the reports whole.
`scripts/platform-engine-report.mjs` now measures against the NASA JPL
Horizons and ERFA references
([`../../../engine-validation/independent-references/`](../../../engine-validation/independent-references/README.md));
run it at `2ca93d41` to measure against the Swiss fixture again. The record
of everything removed is [`../../../engine-validation/SWISS-OUTPUT-REMOVAL.md`](../../../engine-validation/SWISS-OUTPUT-REMOVAL.md).
