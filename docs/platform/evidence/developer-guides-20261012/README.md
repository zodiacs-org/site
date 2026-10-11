# Developer guides: publication on engine 1.0.0

This change publishes the 18 developer guides prepared on
`codex/developer-docs-preparation`
([the preparation record](../developer-guides-20261009/README.md)), with their
index, a Markdown twin for each page, and their listings in `llms.txt`,
`llms-full.txt` and the sitemap. Preparation held them until the core
release was published. `@zodiacs/engine` 1.0.0 has been on npm under `latest`
since 2026-10-11 (zodiacs-org/engine#39, #40), and the site vendors it
(zodiacs-org/site#710).

## What was carried, and what was left behind

Only the guide track's files came across, copied from the branch tip
`9c400b5e`:

- the catalogue (`src/data/developer-guides.json`);
- the two templates under `src/pages/developers/docs/`;
- the four `verify-developer-guide-*.mjs` scripts;
- the guide catalogue hook in `check-developer-authorship.mjs` and its test;
- the workflow, the developer hub's link, the llms listings, the sitemap
  routes and their exact count in `check-dist.mjs`;
- the claim `priv.developer-local-engine-choice` with its three sentences.

The branch's other tracks and its programme-record edits did not come across.
Neither did the preparation's production probe
(`verify-programme-production.mjs`): it checks deployed assets against a fixed
commit, and before a merge production necessarily serves the previous source.

## Changes for 1.0.0

- **Installation.** A published version now installs as published. Each
  installation guide shows `npm install @zodiacs/engine@1.0.0` first, then the
  carrier block as the way to install the same bytes with their digest checked
  first; the engine page does the same. The guides' own steps say "install
  the package" where they said "install the candidate archive".
- **Statements that are no longer true.** Rewritten:
  - "this candidate does not establish a stable npm publication";
  - stable publication "still pending";
  - npm dist-tags differing from the carried candidate;
  - "candidate compatibility" being part of preparation;
  - the status page counting stable npm publication as separate work.

  The changelog guide says 1.0.0 is on npm under `latest` with provenance.
  It also says the site's archive is npm's tarball, and that `next` still
  names an earlier candidate. Engine releases have no git tags apart from
  `v0.1.1-rc.15`, so the guide no longer sends readers to one.
- **Links.** The 22 engine source links point at 1.0.0's source commit
  `ca2c8cef`. The changelog guide's evidence link points at
  `docs/evidence/1.0.0-20261011` on engine main `7307665b`, which holds the
  publication record.
- **Checks.**
  - The examples verifier now also runs the elections recipe; the preparation
    never executed it.
  - The examples verifier installs what the guides say: `@zodiacs/engine@1.0.0`
    from npm by exact version, while a vendored candidate is still installed
    from its archive. It then requires all 74 installed files to equal the
    carried archive's.
  - The workflow pins Deno 2.9.7 and Bun 1.4.2, the versions the preparation
    run recorded, and writes its results outside the checkout.
  - The workflow runs when the engine archive, the candidate record, the
    compute API's examples or a verifier's helper changes.
  - The ledger's guide claim uses `statement`, like every other claim.

## Local results

On macOS arm64, with Node 22.22.2, after `npm run build` (daily freshness,
`check-dist` with the 19 guide routes, schema with 0 errors, and bundle
budgets all pass). The results are in [results-local/](results-local/).

- **Twins.** All 18 guides and the index: the HTML and Markdown twins carry the
  version and the archive digest, and both llms files list every page.
- **Browser.** 38 navigations: the index and 18 guides at 360 and 1280 px in
  Chrome 154. Each had no overflow, no page error and no calculation request.
- **Examples.**
  - Install: `@zodiacs/engine@1.0.0` from npm, whose 74 files equal the
    archive's.
  - Engine examples: node, natal, transits, returns, synastry, crossings,
    conventions, errors and receipts on Node; Deno 2.9.0; Bun 1.3.11.
  - Cloudflare: a Worker-style fetch and the browser-platform bundle, then
    workerd 1.20260730.1 through Miniflare 4.20260730.0.
  - Browser: the browser bundle in Chrome 154.
  - Elections: the hosted recipe, run in Node with its fetch pointed at a
    local fixture of the committed contract. The request it sends must equal
    the compute API's documented example, which the verifier takes from
    `examples.ts` itself, compiled and imported. A 200 must print the committed
    response, and a 429 must stop the program. Both cases pass. With one
    condition changed in the contract, the check fails.
- **Python.** Python 3.9.6 against the hosted contract's fixtures over local
  HTTP: 200, 400, 422, 413 and 429 with Retry-After. The request must equal
  the contract's documented positions example, which, as for elections, is
  taken from the compiled `examples.ts`.

## CI results

The Developer guides workflow ran on Linux with the pinned runtimes (run
38166970251, on the PR's merge with main, head `c043bb40`). Its results are in
[results-ci/](results-ci/):

- **Twins.** All 18 guides and the index.
- **Browser.** 38 of 38 navigations in Chromium 149.0.7827.55.
- **Examples.** 17 of 17, run on Node 22.23.3, Deno 2.9.7 and Bun 1.4.2:
  - Install: `@zodiacs/engine@1.0.0` from npm, whose 74 files equal the
    carried archive's.
  - Cloudflare: workerd through Miniflare.
  - Elections: both fixture cases.
- **Python.** 5 of 5 on Python 3.12.3.

The run before the elections check was added, 38163949561 on `c2b74923`, also
passed.

## Private search

The owner's private birth-data search ran over this change's two commits with
both pattern sets ([history-check.txt](history-check.txt), counts only). The
commits add no birth-data line. Every example is synthetic.

## Remaining scope

P3.10 stays partial. Its brief lists a React Native quickstart and a sunrise-based
panchang recipe, and neither exists yet:

- React Native's runtime is deferred as D14, "Edge and mobile CI".
- A panchang recipe needs sunrise, whose unit (P2.A.rise-set) failed its
  five-second gate on Uranus grazing crossings.

Two pages are narrower than they may sound:

- Local workerd is not a deployed Cloudflare check.
- The Python guide calls the hosted API; it is not a Python port of the engine.

Every example uses synthetic inputs and the public contract's fixtures.
