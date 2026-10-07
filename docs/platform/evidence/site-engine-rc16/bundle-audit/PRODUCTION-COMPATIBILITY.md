# Production-flags compatibility follow-up

2026-10-01. Read-only audit of the parent's completed production-flags
`dist/`, after the separately authorized engine-only allowance. No source,
budget, archive or shared `dist/` files were changed by this audit.

## Blocker

`/compatibility/` measures **36,915 B gzip**, against the unchanged **36,864 B**
limit: **51 B over**. The original gate fails for this route alone. The
engine allowance now passes, and the other fifteen routes pass. No
full/ephemeris module is in the compatibility **initial** closure.

There is also a more consequential transitive lazy-graph regression:
opening the relationship view now requires an ephemeris-bearing chunk.
The old saved-chart comparison path could open that view without loading
the ephemeris. The source comment in `SynastryCalculator.tsx` still promises
that property.

No safe site-adapter/import-only trim was found that keeps the current
composite package adoption, its exact published entry point, behavior and
old lazy dependency graph all at once. The 51-byte route failure is not a
reason to raise a route budget or accept the saved-chart graph regression.

## Route accounting

- Recorded rc.15 production-flags baseline: **36,747 B**, 117 B below limit
- Current rc.16 production-flags build: **36,915 B**, **+168 B**
- Existing rc.15 default artifact: **36,295 B**
- Previously captured rc.16 default artifact: **36,460 B**, **+165 B**
- Flag-related difference: rc.15 +452 B; rc.16 +455 B

The current default and production closures reference the same 24 other
chunks and differ only in their `SynastryCalculator` output filename. Thus
the rc.16 default main chunk is 11,605 B (derived from the captured total),
versus rc.15's existing 11,453 B: **+152 B**. The remaining +13 B is:

- `useEngine`: +2 B
- `useProfile`: +2 B
- `read-store`: +1 B
- Shared engine math/sign/version chunk: +8 B

`SynastryCalculator.tsx` is unchanged from the rc.15 comparison checkout.
Its new emitted dependency map names the techniques and ephemeris-related
chunks introduced below. This is lazy-preload metadata growth, not new
initial ephemeris execution or new UI code. The rc.15 production baseline
is recorded evidence; this audit does not claim to possess or rebuild that
older production-flags chunk snapshot.

## Lazy relationship-view graph

The static closure rooted at each emitted `RelationshipWheel.*.js` is:

| Build | Chunks | gzip B | Ephemeris fingerprint |
| --- | ---: | ---: | --- |
| rc.15 existing default artifact | 22 | 52,000 | Absent |
| rc.16 current production artifact | 30 | 96,188 | Present |
| Change | +8 | +44,188 | Newly required |

The particular rc.16 lazy path is:

```text
RelationshipWheel.BELnvFfu.js
  → compositeCopy.69O0mxS0.js
  → techniques.fuIjA2yk.js
  → chunk-WOU7JVD3.pnw1-4va.js
```

The last chunk is 23,004 B gzip, contains both ephemeris fingerprints, and
itself statically imports the shared math, house and time-basis chunks. The
techniques chunk serves the package's return/search and composite exports
used across the site; the composite adapter's named imports do not create
an independent lightweight entry at the final multi-entry chunk boundary.

Source path: `RelationshipWheel` → its composite view/data →
`src/lib/composite.ts` → `@zodiacs/engine/techniques`. Before the port,
`src/lib/composite.ts` used the existing lightweight aspect/math adapter.
The archive exposes these composite operations through `./techniques`;
there is no supported lighter composite subpath in this immutable version.

This is a verified static dependency comparison, not a browser/network run.
The 44,188 B is the full lazy-root closure difference, not necessarily all
incremental transfer on every interaction, because some chunks may already
be cached from another path.

## Scope-preserving decision needed

A package-entry alias that resolves to the same `./techniques` file does
not remove these dependencies. Removing array-copy wrappers changes the
site's mutable-array contract and does not address the graph. Ignoring Vite
preloads only masks part of the initial byte cost: ordinary ESM loading
would still traverse the ephemeris imports. Broad preload policy changes,
new lazy seams, archive edits, and UI rewrites were not attempted.

The integrator needs a decision about the composite migration itself. A
follow-on engine artifact with a lightweight composite entry, or explicitly
deferring that one port and retaining the pre-existing lightweight site
implementation, could preserve the old view boundary. Neither option is
applied or claimed to pass here; both need separate authorization/verification
against the adoption requirements. Leave the production build blocked until
a supported resolution passes the unchanged route limit and restores the
saved-chart lazy contract.

## Reproduction

Run while the production-flags `dist/` is present:

```sh
node docs/platform/evidence/site-engine-rc16/bundle-audit/measure-production.mjs
node docs/platform/evidence/site-engine-rc16/bundle-audit/attribute-compatibility.mjs
node scripts/report-bundles.mjs --fail
```

Evidence: `production-route-measurements.json`,
`compatibility-attribution.json`, `production-budget-gate.log`. The scripts
read the rc.15 default comparison at sibling `../site` and the previously
captured rc.16 default `measurements.json`. No rebuild occurs.
