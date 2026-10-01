# Engine rc.16 bounded bundle audit

Measured 2026-10-01 with Node 22.22.2. This audit changes no application code,
budget, installed engine, immutable archive or shared `dist/` output.

## Default-build result

No safe import-graph, duplicate-export or unnecessary eager-site-import trim
was found. The existing 31.6 KiB engine limit still **fails**: the rc.16
seven-chunk static closure is **33,154 bytes gzip**, versus **32,108 bytes**
for the existing rc.15 build, a **1,046-byte** increase. All sixteen route
budgets pass without any route-budget change; none of those initial closures
contains `full.*.js` or either ephemeris fingerprint.

The main increase is the rc.16 IAU 2000B nutation / IAU 2006 frame path. The
77-term coefficient payload and frame functions are required by the retained
body-longitude and chart paths; dropping them would change the adopted
numerical behavior. The package replaces several astronomy-engine frame
helpers rather than shipping a second copy of astronomy-engine.

Production-flags follow-up: [PRODUCTION-COMPATIBILITY.md](PRODUCTION-COMPATIBILITY.md)
records a later 51 B compatibility-route failure and a newly verified
relationship-view ephemeris dependency. The default-build results below
do not imply the production-flags build passes.

## Actual emitted closure accounting

Gzip uses level 9 independently for each chunk, then sums them, exactly like
`scripts/report-bundles.mjs`. These are existing production-shaped build
artifacts, not a claim that both entire sites were rebuilt in this audit.
The source boundary, chart adapter, Astro config, budget gate and toolchain
versions are byte/version-identical in the two checkouts; their hashes and
chunk hashes are recorded in `measurements.json`.

| Role | rc.15 gzip B | rc.16 gzip B | Change |
| --- | ---: | ---: | ---: |
| full boundary | 273 | 273 | 0 |
| dynamic namespace runtime | 154 | 154 | 0 |
| site chart adapter | 304 | 304 | 0 |
| ephemeris / frame | 21,965 | 23,004 | +1,039 |
| shared signs / aspects / version | 1,160 | 1,168 | +8 |
| shared houses | 1,770 | 1,769 | -1 |
| shared time basis / Delta T | 6,482 | 6,482 | 0 |
| **Total** | **32,108** | **33,154** | **+1,046** |

The runtime, chart-adapter and time-basis output files are byte-identical.
The +8 B math change includes the retained `signIndex` and `SIGN_SLUGS`
exports consumed by `techniques.fuIjA2yk.js`; these are not duplicate
implementations. The archived math source itself differs only in the engine
version. The houses source differs only in its imported chunk filename;
its -1 B gzip change is hashed-specifier/minification layout, not a reduction
in the supported house systems. No size-saving claim depends on deleting
exports used elsewhere or moving any dynamic boundary.

## Same-source, same-build comparisons

`audit.mjs` extracts both exact `vendor/` archives into an external temporary working
folder and resolves each package export there. All installed package JS
files match their respective archive bytes. Both runs then bundle the same
unchanged `src/lib/engine/full.ts` and chart adapter from the rc.16 checkout,
with the same installed astronomy-engine and tool versions. No top-level
application graph or source files are swapped.

| Controlled build | rc.15 gzip B | rc.16 gzip B | Change |
| --- | ---: | ---: | ---: |
| Vite 8.1.3 / Rolldown 1.1.4, browser, minified, four exports retained | 31,303 | 32,350 | +1,047 |
| esbuild 0.28.1, browser ESM, minified, four exports retained | 32,707 | 33,777 | +1,070 |

These are **single-entry standalone comparisons**, not replacements for the
seven-chunk budget metric. The Vite audit emits a source-map reference; both
variants use the same options. Chunk sharing, gzip dictionary boundaries and
renaming explain why their absolute sizes and deltas differ from the site.
They independently establish that growth remains when unrelated site inputs
are held constant.

The esbuild metafiles attribute the exact **1,127 uncompressed-byte** net
increase as follows:

- Engine ephemeris/nutation/frame module: 3,414 → 7,528 B, **+4,114 B**
- astronomy-engine retained implementation: 48,102 → 44,999 B, **-3,103 B**
- Houses module, including newly retained `meanObliquity`: 3,998 → 4,114 B,
  **+116 B**
- Time-basis, Delta T, shared math, site adapter and full boundary: **0 B**

Compressed contributions cannot be added per source module, so no artificial
per-function gzip number is claimed. The exact compressed attribution is
at the emitted-chunk and whole controlled-build levels above.

Both controlled import graphs contain the five required package chunks,
one astronomy-engine ESM implementation, and the two site adapter files.
No receipt/geo/timezone database, API/MCP, UI or homepage code is included.
Unused package declination/point APIs are removed by tree shaking. The site
closure similarly contains only the boundary/runtime/adapter and engine
math, houses, time and ephemeris modules. The archive entrypoint's side-effect
reexports do not produce duplicate output modules.

## Gate and budget decision

`original-budget-gate.log` records the unmodified gate's exit-1 result:
engine size is the sole failure. Package-source isolation and homepage
markers are clear; `measurements.json` independently enumerates each
budgeted route closure and confirms every route passes with no engine
fingerprint. The smallest route margin is `/big-three/`: 30,709 of 30,720 B,
just **11 B**; retain that route limit unchanged.

The old engine limit is 31.6 × 1024 = 32,358.4 B, leaving rc.15 250.4 B.
Under the WIP's measured-growth-only exception:

- Minimum limit retaining exactly 250 B of rc.16 headroom: **33,404 B**, or
  **32.62109375 KiB**
- Add exactly the measured 1,046 B growth to the prior limit, preserving its
  exact 250.4 B headroom: **33,404.4 B**, or **32.621484375 KiB**

Recommend the latter if the integrator applies that already-authorized
exception, with this measured explanation. This audit does not apply it.
No route-budget increase or numerical/archival change is needed or proposed.
After any authorized change, rerun the original gate rather than treating
this failed pre-change run as a pass.

## Reproduction and evidence

From the site checkout, with Node 22.22.2:

```sh
node docs/platform/evidence/site-engine-rc16/bundle-audit/audit.mjs reproduction
node scripts/report-bundles.mjs --fail
```

The script expects the unchanged rc.15 comparison checkout at sibling
`../site` for the existing-artifact closure comparison. The controlled
same-source builds use only this checkout plus its two immutable archives.
Extracted package copies and generated JS/maps are materialized under the
system temporary directory and removed after a successful run. No duplicated
runtime bytes are retained in this evidence directory. A run label produces
new label-prefixed JSON/metafile records without overwriting earlier evidence;
without a label, the script chooses a timestamped label.

Retain the scripts, reports, source/archive hash bindings, metafiles, JSON
and logs. `removed-generated-copies.json` records the hashes of the old
redundant copies removed after the external-scratch reproduction matched
both original standalone measurements. `scratch-verification-*` records
that verification. The old paths in original metafiles are historical
source identifiers, not files needed by the scripts. See
[AFTER-DEFERRAL.md](AFTER-DEFERRAL.md) for the final measured graph.

Archive SHA-256:

- rc.15: `24eeb597b0157598c0faa26bb615c0cb5dfaaeac0393d62c73fbd37c5da4d348`
- rc.16: `43a72d30e483d8ff22024e403c4bd0d86d81bb6e1d0ad138f857cd001ab015d8`
