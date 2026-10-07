# Local packaged function verification, 1 October 2026

Vercel CLI 62.0.0 packaged twelve Node 22 functions from the current source,
using a functions-only fixture, disposable HOME and empty local environment.
No environment values were pulled or decrypted and no auth variables were
inherited. See `validation.json` for the configuration and source bindings.
The compatibility function contains the exact generated rc.16 compute bundle.

With Node 22.22.2 and `--no-experimental-detect-module`, all six documented
synthetic examples returned 200 twice in each of ten fresh processes:
**60 processes / 120 successful responses**. Firewall fetch is stubbed to 204;
there is no network in the probe. The unchanged probe source is bound by hash.
`cold-start.json` records local process/import/request timings, excluding
platform provisioning. These are not production cold-start or cost figures.

The CLI exits 0 but emits existing unrelated TypeScript NodeNext import and
typing diagnostics. `build.log` preserves them; packaging success does not
represent a clean typecheck. The normal Astro check is recorded separately.
The CLI's optional-dependency lockfile reconciliation was restored byte for
byte from the pre-build source; no package-lock delta is retained.

This verifies the rc.16 artifact's server packaging, not deployment, live
Firewall behavior or acceptance of P3.3.
