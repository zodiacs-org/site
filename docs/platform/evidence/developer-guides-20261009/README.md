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

Results are pending. The complete unchanged Site Check remains a separate
required gate. Actual workflow outputs will be committed after execution;
the descriptions above state the authored checks, not passing observations.

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
