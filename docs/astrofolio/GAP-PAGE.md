# Astrofolio gap page

`/astrofolio/gap/` places dated U.S. astrology awareness and belief percentages
beside the latest archived combined market cap of the twelve official Zodiac
tokens. It lists each sign's market cap and canonical Solana mint, the exact
UTC observation time, sources, and the existing disclosure and zero-value
risk wording. Different units and dates stay separate; there is no audience
conversion, valuation ratio, forecast, price target, or comparison token.

## Sources and review

- `public/astrofolio/gap/audience.json` is hand-authored wing data, marked
  **owner review required**. YouGov's April 21–22, 2022 survey of 3,472 U.S.
  adults reports 90% selecting a zodiac sign and 27% reporting belief in
  astrology. [YouGov's article](https://yougov.com/en-us/articles/42292-one-four-americans-say-they-believe-astrology)
  was published April 26, 2022; its attribution and dates are preserved.
  Owner review must approve source selection and wording. The page is
  `noindex, follow` while review is required; clearing that flag also needs
  an explicit sitemap/publication decision. Awareness is not
  belief, and neither is a count of token owners or investors.
- `public/assets/data/registry-market-history.v1.json` supplies the latest
  DexScreener observation. `public/registry/zodiacs.registry.json` supplies
  canonical identity. Market cap is used only as reported, separately from
  FDV. Missing market cap stays missing; incomplete coverage suppresses the
  combined value and labels the reported subtotal.

## Placement and generation (PR notes)

The generated static wing page follows the public catalogue pattern. Sources
are `scripts/astrofolio-gap-{lib,render}.mjs` and
`scripts/build-astrofolio-gap.mjs`; output is
`public/astrofolio/gap/index.html`. Shared `wing-nav.mjs` and
`renderStaticFooter()` supply navigation and the Celestial Colophon.
This choice leaves `WING_ONLY_SOURCE` unchanged, so no new carve-out requires
owner sign-off. No consumer surface links to the page. An optional Astrofolio
hub link was skipped: that hub's React application replaces its static
fallback, so a lasting link requires more than a one-line public-page change.

Run `node scripts/build-astrofolio-gap.mjs` to regenerate, or add `--check`
to verify bytes. Prebuild and both existing daily market publication paths
run it, and their commit allowlists include its outputs. The existing offline
wing drift job checks it. No workflow, runtime quote fetch, build-time network
request, production setting, or Vercel change is added. The page updates on
the deployment that contains the next archived observation; it does not
silently replace the last observation date with the build date. Audience
figures change only through source review.

OG output is a committed 1200×630 PNG, using pastel sign hues, local fonts,
and `@vercel/og`'s Satori/resvg WASM renderer. Date and image digest form its
URL; prior images stay available for shared links. The generated
`public/assets/og/astrofolio/gap/manifest.json` records its source, timestamp,
coverage and hash. It is separate from the consumer daily-publication
manifest. `scripts/assets/astrofolio-gap/*.woff` are generated font inputs
(ASCII, weight 400) derived from the self-hosted Instrument Sans and
JetBrains Mono fonts by `python3 scripts/build-astrofolio-gap-fonts.py`.
That optional font refresh uses the existing fontTools tooling; normal
builds and drift checks require only Node. SIL OFL licenses remain in
`public/fonts/`. EB Garamond comes from the installed, lockfile-pinned
font package. Source and generated outputs must be included together in
the eventual owner commit; this worktree is left uncommitted.

`package.json` participates in the Phase 1 template receipt. Its build hook
change therefore requires genuine recapture using the current build receipt;
do not hand-update a screenshot hash or alter the daily-publication manifest.

## Local verification

Node 22: the seven gap tests and 25 related market/daily-operation tests pass,
as do the consumer boundary, footer, and protected-scope checks. The OG test
blocks all fetching and compares repeated PNG generation byte for byte.
The standard build cannot write the mounted `node_modules` cache here.
A full npm build passes with a temporary cache-only override in `/tmp`:
4,444 Astro routes, `check-dist` over 5,085 HTML files, schema/locale checks,
bundle budgets and the Phase 1 build receipt. Production configuration and
the daily-publication files are unchanged.

Phase 1 recapture was attempted against a fresh build receipt, but Chromium
exits at launch because this sandbox denies Crashpad's `setsockopt` call.
Existing acceptance screenshots and their manifest were left intact.
`npm run test:phase1:evidence` confirms the stale template digest (four other
checks pass). Recapture and rerun that gate where Chromium can launch before
merging; mobile/desktop browser review of the new page also remains open.
The OG PNG itself was visually inspected.
