# Developer-guide preparation rebuilt from GitHub

This preparation rebuilds the supported scope of the previous executor's
unpublished guides from the candidate's public declarations and the existing
Compute API contract fixtures. It does not claim to recover the former local
commits, private files or test results.

The 18-guide catalogue renders HTML and Markdown twins and lists every guide
in both llms documents. Installation blocks use the existing archive helper
and the exact candidate manifest, not an unverified registry dist-tag.

## Reproducible preparation checks

After `npm ci`, installing Chromium and `npm run build`, the read-only
`developer-guides.yml` workflow runs:

- `node scripts/verify-developer-guide-twins.mjs`: actual built HTML,
  Markdown, installation identity and discovery listings.
- `node scripts/verify-developer-guide-browser.mjs`: the index and all
  18 guides at mobile and desktop widths, with overflow, browser-error
  and unexpected-calculation checks.
- `node scripts/verify-developer-guide-examples.mjs`: isolated installation
  of the digest-checked carried archive; Node, Deno and Bun examples;
  Chromium browser execution; Worker-style fetch and browser bundling;
  actual local workerd execution through pinned Miniflare 4.20260730.0.
- `node scripts/verify-developer-guide-python.mjs`: the actual documented
  Python snippet against existing public success, 400, 422, 413 and 429
  fixtures over local HTTP, checking request shape, response metadata,
  failure exits and Retry-After.

The additional `verify-programme-production.mjs` probe checks canonical public
engine asset bytes against the build and sends one fixed synthetic positions
request. Its expected source commit must be joined to a separately verified
Vercel production deployment; HTTP responses alone do not establish the
deployment source.

The preparation checks passed in [run 37895777038](https://github.com/zodiacs-org/site/actions/runs/37895777038)
on PR head `b002dc96535ff60fb78c122f05d04f3310a02f8f`, checked out as
`db4eca31da06187103254ad8e3c2b1cd27189c8d`. The complete unchanged Site
Check on the final evidence carrier remains a separate required gate. The six actual exported results are committed under `results/` with byte
counts, verified SHA-256 digests and producer identities in
`validation.json`. They establish 18 twins, 38 browser navigations, 14
runtime checks, five Python HTTP cases, seven matching production assets,
33,193 gzip bytes and the matching served OpenAPI contract.

## Publication and remaining scope

This draft must not merge or publish before the core publication
prerequisites, final validation and privacy checks are satisfied.
Stable release preparation is tracked in
[engine #32](https://github.com/zodiacs-org/engine/issues/32).

P3.10 remains partial: React Native runtime validation and a complete
sunrise-based panchang recipe remain outstanding. Local workerd is not a
deployed Cloudflare check. Python hosted positions is not an offline Python
port. Elections uses the existing hosted contract rather than claiming a
new local election solver. Reproduction and shape checks do not establish
independent numerical accuracy.

Examples use synthetic requests and existing public fixtures only.
Private birth-data search inputs from the previous executor are unavailable;
no new private release search is claimed. Full affected release-range and
staged-evidence searches remain required before publication.

## Recorded preparation failure

[Run 37893899060](https://github.com/zodiacs-org/site/actions/runs/37893899060)
on source `64948973b2dd05e5db2e3dd5cf09ebab0d1e82c3` failed the
unchanged build/dist gate: all 19 new guide HTML pages were absent from the
custom sitemap. No runtime-example success is claimed for this attempt.
The fix adds the same catalogue's routes and controlled last-modified date
to the existing sitemap endpoint, updates the edited developer hub date,
and checks the built guide sitemap entries in the twin verifier.
The Phase 1 capture boundary and all existing checks remain unchanged.

The first sitemap registration source `fa8df91d3b7780750668bb354ae8b41d0a112602`
then failed the same dist gate's coordinated count: 1,802 routes versus the
previous 1,783. The existing baseline now adds exactly the catalogue's
19 routes and requires their exact set. Every previous family's count,
canonical requirement, noindex rule and locale count remains enforced.
This registers new intended routes; no tolerance was widened or assertion
removed.

[Run 37894678363](https://github.com/zodiacs-org/site/actions/runs/37894678363)
then passed the build, actual twins and all 38 browser navigations, but the
new example verifier incorrectly asserted `chart.ascendant`. The packed
rc.2 declarations define `Chart.angles` with `asc/mc/dsc/ic`; the verifier
now requires all four to be finite longitudes in [0, 360), the whole-sign
house system and the same 12-body count. The documented Node snippet itself
completed calculation. This runner mistake is retained; no complete
example-run success is claimed for that attempt.

[Run 37895207530](https://github.com/zodiacs-org/site/actions/runs/37895207530)
completed the eleven runtime recipes and Worker-style fetch, then local
workerd refused the verifier's compatibility date 2026-10-09: its binary
supports dates only through 2026-08-06. The local check now uses the pinned
Miniflare release's 2026-07-30 date and records the actual workerd version.
The documented Worker source and all calculation assertions are unchanged.
No complete Worker/browser-example success is claimed for that failed attempt.

The public production probe also compares the served OpenAPI document
with the actual build and preserves its exact public bytes, providing a
source-bound contract for subsequent client generation.
