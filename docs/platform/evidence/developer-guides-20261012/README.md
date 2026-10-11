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
    from its archive. It then requires the installed package to hold exactly
    the carried archive's 74 files, byte for byte. With an extra file added,
    it fails.
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

## Production

#713 merged as `8e2dd7840f514f8e30fc870d2b3aca91ba613c67`. Vercel
`dpl_4zLgJubt6qa74W817DSbeJevyxem` built it for production and was READY at
2026-10-11T20:30:45Z.

[tools/verify-production.mjs](tools/verify-production.mjs) then checked
canonical production against a local build of the merge. The build used Node
22.22.2 with the feature flags unset, as CI's main build does. Before and after
the run, the zodiacs.org alias named that deployment, built from the merge,
with an unchanged `updatedAt`. Those reads went through the Vercel connector,
which reports no read time. All 25 checks pass
([production/production.json](production/production.json)):

- **Twins and listings.** The 19 Markdown twins, `llms.txt` and
  `llms-full.txt` are the build's bytes. Both llms files list every guide and
  its twin.
- **Pages.** Each page's guide article is the build's bytes. Its text has the
  content the twins verifier requires of the build: the version, and for
  installation guides the archive digest and `npm install
  @zodiacs/engine@1.0.0`.
- **The rest of each page.** It holds the build's page in order. Production's
  flags insert only three things:
  - the analytics script;
  - the footer's daily-email signup;
  - two attributes on `<html>`.
- **Sitemap.** Production serves every `<url>` entry of the build unchanged,
  the 19 guide pages among them. Production has three entries the build lacks:
  `/registry/collection/`, `/race/` and `/games/history/`. Its
  `PUBLIC_REGISTRY_COLLECTION_ENABLED` and `PUBLIC_ZODIAC_GAMES_ENABLED` flags
  add them (`src/pages/sitemap.xml.ts`).
- **Browser.** Chromium 154 opened every page at 360 and 1280 px: 38
  navigations. Each was a 200 with its heading and twin link, and none had
  overflow, a page error or a calculation request. Its 38 requests to
  analytics were aborted, so the check added no visit to the site's
  analytics.

The controls are in [production/controls.json](production/controls.json). They
ran against production with the build or the alias reads altered, and each
failed the check it targets and no other:

- **Build files.**
  - One byte appended to a twin.
  - One word changed inside an article.
  - An attribute added outside an article.
  - A tag removed from a built page, so production's copy reads as an
    unexplained insertion.
  - One sitemap lastmod changed.
  - One newline appended to `llms.txt`.
- **Alias reads.**
  - A before-read naming another commit failed the alias check.
  - An after-read with a later `updatedAt` failed the unchanged-alias check.
  - An after-read without a deployment was refused.

No whole page is the build's bytes (`wholePageIdentical` is false for each),
because of those insertions. Main's post-merge Site Check is recorded in
STATUS.md.

## The llms files' developer section

This record's change also gives the developer platform its own section in
both llms files. F-21 found the engine filed under the Registry's heading,
and A5 asks for a developer-platform section. Only headings were added or
renamed; every paragraph moved verbatim.

- **`llms-full.txt`.** "Astrofolio, Terminal, Registry, and Developer Wing"
  is split in two:
  - "Astrofolio, Terminal, Registry, and SDK": the entity boundary,
    Astrofolio, the Terminal, the registry, the SDK and the read-only posture.
  - "Developer platform": the sky data API, the engine, the local MCP server,
    the compute API, the sky-fact benchmark and the widget package.
- **`llms.txt`.** The pointer to `llms-full.txt` and the read-only posture
  now come straight after the consumer lines. A "Developer platform" heading
  follows, over the sky data API (with its OpenAPI link), the engine and its
  reference, the MCP server, the compute API, the conformance suite and the
  benchmark. The guide section follows.

The consumer lines still come first. The boundary test still finds no
Registry wording before the pointer, and the pointer and the posture
paragraph still appear once each. The claims ledger restates one record,
`priv.local-tools`: its paragraph no longer ends with the pointer line. The
claims check finds no unlisted sentence and no orphan. The build passes
`check-dist`, the twins verifier and the boundary, trust-surface, claims,
sky-API and authorship tests.

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
