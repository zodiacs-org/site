# zodiacs.org

Free astrology platform (Learn / Tools / Collect) built with Astro, with the
original token registry preserved as the "Collect" wing. Strategy:
`docs/STRATEGY.md`. Frontend design plugin stays enabled:

```json
{
  "enabledPlugins": {
    "frontend-design@anthropics": true
  }
}
```

## Repositories and hosting

The code lives under the `zodiacs-org` GitHub account: `zodiacs-org/site`
(this repo), `zodiacs-org/sdk`, `zodiacs-org/engine` and `zodiacs-org/app`.
`site` and `sdk` moved there from the `ZodiacsOfficial` GitHub organization on
2026-09-24. Vercel deploys production from `zodiacs-org/site` `main` (project
`zodiacs-org`) and the SDK site from `zodiacs-org/sdk` (project `sdk-zodia`).
The Vercel team slug is still `zodiacsofficial`, so preview hostnames keep
`-zodiacsofficial.vercel.app`. That is correct; don't "fix" it.

**Standing owner request:** never delete the `ZodiacsOfficial` organization,
and never create a repository named `site` or `sdk` in it. GitHub's redirects
from the old addresses keep older links working. Those links are in dated
records (`docs/`, `PLAN.md`, thesis evidence), in the immutable archives'
packed metadata, and anywhere else the old name was published. A new
repository with either name would take over its old address and break them.
New links use zodiacs-org. The site-check "stale repo" grep fails on old-org
GitHub URLs in the SDK and Registry pages.

## One design system, two content registers

Since the Part-Q retheme (owner-directed), the WHOLE site — Astro pages in
`src/` AND the registry wing (`public/registry/`, `public/thesis/`,
`public/archive/`, `public/sdk/`, discovery pages) — wears the dark
"Cosmic Void" system: void surfaces, EB Garamond display, Instrument Sans
body (wing pages may use EB Garamond body — museum register), JetBrains
Mono data, self-hosted fonts only (no Google Fonts anywhere), the 12
pastel sign hues as the only chroma. Warm Gilt is retired; do not
reintroduce gold accents anywhere.

The CONTENT boundary survives the visual merge:

1. **New surfaces** (`src/`): consumer astrology. **No token/market/crypto
   language or links.** The sanctioned cross-links into the wing are the
   CollectBand on sign guides (all released locales: EN/ES/FR/IT/PT) and on
   birthday pages, the records line on the birth-chart
   result (`ChartCalculator`, full mode), and the contextual saved-chart link
   to Registry Collection when `PUBLIC_REGISTRY_COLLECTION_ENABLED=1` — all in the records
   register, never market language. The owned, `noindex` social landing at
   `/bio/` may link to the consumer Astrofolio page in plain language; it never
   carries token, market, or acquisition copy. Two carve-outs: the in-`src/` wing lanes
   (canonical registry: `WING_ONLY_SOURCE` in
   `scripts/consumer-boundary-lib.mjs` — `src/pages/registry/`,
   `src/pages/terminal/`, `src/pages/astrofolio/how-to-buy/`, `src/pages/fomo/`
   (the Astrofolio-on-Fomo landing page), `src/exchange/`,
   `src/trade/`, the wallet/aura modules), which carry wing register under the
   scanner's own rules, and the legal pages (Privacy, Terms, Disclosure)
   carry the wallet/provider/market-risk disclosures that the Registry
   features legally require — disclosure language there is compliance text,
   not a boundary breach. The wing's nav label is "Astrofolio" in every
   locale; the owner-approved navigation description names the official Zodiac token
   collection before the click (2026-10-01, exact localized copy checked by the scanner); the footer column heading is "Registry". Wing URL topology (all
   permanent redirects, served by Vercel as 308): deep paths
   `/collect/:path` → `/registry/:path`, but bare `/collect/` →
   `/astrofolio/`; `/registry/exchange` → `/terminal/markets/`;
   `/registry/research` → `/terminal/research/`; `/terminal/pro/` →
   `/terminal/`. `vercel.json` is the authority — verify against it before
   citing a redirect.
2. **Wing** (`public/…` above, plus the in-`src/` wing lanes named by
   `WING_ONLY_SOURCE`): the registry catalogue keeps its museum
   voice, token content, and acquisition links — that register stays in
   the wing. Wing pages style themselves (inline blocks or
   `public/assets/discovery.css`); they still never link the hashed Astro
   bundle of `src/styles/tokens.css` (public HTML can't reference hashed
   assets) — they inline the same token VALUES instead. Don't link
   `discovery.css` into `src/` pages.

## Generated vs source (do not hand-edit generated output)

`public/sdk/index.html` is hand-authored source. Edit its content directly.
The navigation regions on it, `public/thesis/index.html`, and
`public/terminal/markets/index.html` are synchronized from `scripts/wing-nav.mjs`
by `node scripts/sync-wing-navigation.mjs` (predev/prebuild); edit the shared
navigation source and run the synchronizer, leaving the rest hand-authored.

- `public/developers/engine/reference/` ← `node scripts/build-engine-reference.mjs`
  (digest-pinned rc16 archive declarations; `--check` verifies reproducibility;
  never edits the historical `public/sdk/engine/` reference). It retains the
  sanctioned compact TypeDoc sign-rail ending.
- `public/registry/{sign}/index.html` ← `node scripts/build-sign-pages.mjs`
  (data: `scripts/sign-data.mjs` + `public/registry/zodiacs.registry.json`)
- `public/archive/` (+ feeds) ← `node scripts/build-archive.mjs`
- `public/assets/gallery.js` ← `node scripts/build-shelf.mjs`
  (esbuild-bundled Three.js scene for the gallery band on `/registry/`;
  source `src/shelf/`, records baked from `sign-data.mjs` + the registry
  JSON — addresses are fetched live by the card, never baked in. The
  standalone `/registry/gallery/` page is retired; `vercel.json` 308s it
  to `/astrofolio/`)
- `src/shelf/figures.geometry.json` + `public/assets/sculptures/{512,1024}/`
  ← `node scripts/build-figure-assets.mjs` (silhouettes traced from
  `public/assets/nuggets/` and extruded by the gallery; the nuggets
  themselves are never touched). Deliberately NOT in the drift job: the
  traced geometry re-derives identically anywhere and is re-checked by
  `scripts/shelf-figures.test.mjs`, but the webp encodes are libvips output
  and are not byte-stable across platforms — same rule as the cabinet
  materials.
- `public/assets/app.js` ← `node scripts/build-app.mjs` (source `src/app.jsx`)
- `public/registry/index.html` Aura marker region (meta flag + no-JS entry
  between the `registry-aura-entry` comments) ← stamped by
  `scripts/configure-registry-aura.mjs` (predev/prebuild) and
  `scripts/build-app.mjs` from `PUBLIC_REGISTRY_COLLECTION_ENABLED` in the SHELL
  env (plain-node generators don't read `.env` files — set the flag in the
  shell or the Astro/site halves will skew, which `check-dist` fails on).
  The committed state is always flag-OFF (`content="0"`, no entry): the CI
  drift gate regenerates with the flag unset. Never commit flag-on output.
- `public/assets/og/*.png` ← `node scripts/build-og-cards.mjs` (Playwright)
- `public/assets/zodiac-icons/{48,128,400}/` ← `node scripts/build-icons.mjs`
  (sources in `public/assets/sdk/zodiac-icons/circle/` are SDK-public —
  keep byte-identical)
- `public/data/cities/` ← `node scripts/build-cities.mjs` (GeoNames, CC-BY)
- `src/data/sky.json` ← `node scripts/build-sky.mjs`
- `src/data/tz-lmt.json` ← `node scripts/build-tz-lmt.mjs` (when each IANA
  zone's local mean time era ended, from a pinned tzdb release including
  backzone; loaded on demand by `src/lib/time/localToUtc.ts`. Refresh only
  when the pinned release changes)
- `src/data/tz-history/<release>/` ← `node scripts/build-tz-history.mjs`
  (each zone name's offsets before 1970 from the same pinned release with
  backzone, compiled by zic, in 64 name-hashed files plus `excluded.json`;
  loaded on demand by `src/lib/time/tz-history-load.ts`. Needs zic; refresh
  with tz-lmt.json. `--check` re-derives both from the release; CI runs it in
  site-check.yml's `tz-data-drift` job, not the offline drift job)
- `src/data/ingresses.json` ← `node scripts/build-ingresses.mjs` (refresh
  yearly with sky.json)
- `src/data/eclipses.json` ← `node scripts/build-eclipses.mjs` (refresh
  yearly with sky.json)
- `src/data/birthdays.json` ← `node scripts/build-birthdays.mjs` (the
  `now` receipt year — refresh yearly with sky.json)
- `src/data/transits-YYYY-MM.json` ← `node scripts/build-transits.mjs`
  (monthly cron: transits-monthly.yml)
- `src/lib/engine/time-basis.mjs` ← `node scripts/build-time-basis.mjs`
  (the engine package's own compiled time basis, for the calendar
  function's server adapter and its tools, until the package exports one;
  `--check` runs in CI)
- `api/_assistant/context.ts` ← `vite-node --script
  scripts/build-assistant-context.mjs` (committed assistant site guide)
- `plugins/zodiacs-sky/.codex-plugin/plugin.json` and `plugins/zodiacs-sky/.mcp.json` ← `scripts/build-ai-integrations.mjs` from the portable Sky manifest.
- `integrations/generated/chart-studio.mjs` ← `scripts/build-chart-studio.mjs`
  through `npm run ai:build`; standalone browser bundle with inline fonts/icons.
  Its sources are `src/ai-tools/studio/`; never edit the generated HTML string.
- `api/_ai/runtime.mjs`, `plugins/zodiacs-developer/mcp/server.mjs` and the
  developer's portable `plugin.json`/`mcp.json` ← `npm run ai:build` (sources
  `src/ai-tools/` and the compatibility manifest). `integrations/packages/`
  ZIPs and manifest ← `npm run ai:package`. `npm run ai:check` checks drift.
  The hosted MCP defaults off; its exact optional staging hostname is configured
  with `ZODIACS_MCP_STAGING_HOST`. See `docs/platform/zodiacs-ai/LAUNCH.md`.
- `api/_assistant/persona.ts` is Fable-authored source; edit it only via Fable.
- `public/assets/og/v2/` ← `node --experimental-strip-types
  scripts/build-og-void.mjs` (ALL share cards sitewide since Part Q — wing
  pages reference `v2/sign/{slug}.png` + `v2/share.png`; the 13 legacy gilt
  cards at `public/assets/og/*.png` are frozen and unreferenced — leave
  the files alone, don't regenerate or re-reference them)
- `public/assets/og/registry/v3/` ← `node scripts/build-registry-og.mjs`
  (immutable Registry lot cards derived from the established v2 editorial
  plate plus the canonical 1024px pastel icon and gold sculpture sources;
  never overwrite the cached v2 family)
- `public/assets/og/astrofolio/v5/faces.jpg` ← `node
  scripts/build-astrofolio-share-card.mjs` (Astrofolio's one evergreen share
  card, owner-chosen 2026-09-24: Chromium paints the twelve sign frames of
  `public/assets/fomo/fomo-film-av1.mp4` around the wordmark band. A JPEG
  under a 300 KB budget because it is a photograph; `verify-og-cards`
  checks it, and it is not in the drift job because Chromium's decode is not
  byte-stable across platforms. The seasonal `og/astrofolio/v4/{sign}.png`
  cards stay published for links already shared; the season stamp no longer
  rewrites the page's share image)
- `public/assets/pulse.json` / `distribution.json` ← weekly cron workflows
- `docs/phase5/people-pilot/index-demand.json` ← `node
  scripts/build-people-index-demand.mjs --refresh` (pinned twelve-month
  Wikimedia reader-demand proxy; offline drift check uses `--check`)
- `docs/phase5/people-pilot/copy/*.json` and `depth-report.json` ← `node
  docs/phase5/people-pilot/tools/compose-copy.mjs` (released copy is frozen;
  approved article fixes use `--migrate-articles`, and the offline frozen-copy
  invariant/depth-report check uses `--check`)
- `src/data/people.json` ← `node scripts/build-people-pilot.mjs` (sources:
  reviewed manifest, index policy, demand evidence, composed copy and
  computed charts; offline drift check uses `--check`)
- `public/registry/index.html` (the hub shell, beyond the Aura marker
  region above) ← `node scripts/build-registry-hub.mjs` (predev/prebuild;
  `--check` for drift)
- `BUILD-REPORT.md` (repo root) ← `node scripts/build-build-report.mjs` —
  generated output, and a test fixture for
  `scripts/trust-surface-consistency.test.mjs`; several other root docs
  (PLAN.md, SETUP.md, ZODIAC-GAMES.md) are also test-fixture-coupled, so
  never delete or rename a root doc without grepping the test suite first
- `public/precision-preview/{app,worker}.mjs` ← `node
  scripts/build-precision-preview.mjs` (sources `src/precision-preview/`,
  bundling the experimental runtime from `examples/precision-alpha`). Plain
  static files on purpose: nothing in the Astro graph imports them, so no
  consumer page's chunks can move because the preview exists, and
  `report-bundles.mjs` never sees them. `--check` for drift; the site-check
  drift gate runs it
- `i18n-additions.md` (repo root) ← `node scripts/build-i18n-additions.mjs`
- `api/_compute/local-time.mjs` + `local-time.d.mts` ← `node
  scripts/build-compute-local-time.mjs` (the site's local-time resolver from
  `src/lib/compute-api/local-time-source.ts`, bundled with its tables for the
  compute API's function; `--check` for drift, and
  `tests/api/compute-api-local-time.test.ts` rebuilds it byte for byte)
- `api/_compute/compute.mjs` + `compute.d.mts` ← `node
  scripts/build-compute-handler.mjs` (the compute API's handler from
  `src/lib/compute-api/handler.ts`, bundled with the engine and
  astronomy-engine's ESM build so the function loads no engine module at run
  time (F-58); `--check` for drift, and `tests/api/compute-api-bundle.test.ts`
  rebuilds it byte for byte and loads it without module syntax detection)
- `src/lib/compute-api/examples.json` ← `npx vite-node --script
  scripts/build-compute-examples.mjs` (the compute API's documented answers,
  run through the real handler; `tests/api/compute-api-openapi.test.ts` fails
  while it is stale). Its `cite` digests cover receipts that name the
  runtime's tzdb, so generate it on the Node major production runs (24.x)
- `docs/platform/programme/LEDGER.md` ← `node scripts/programme-ledger.mjs`
  (source `docs/platform/programme/acceptance-ledger.json`; `--check` for drift,
  `--summary` for the completion figures)

`public/sw.js` is a PWA worker — the owner approved superseding the old
push-only rule (2026-07-15, WS4 merge decision). Strict invariants: HTML
navigations and wing pages are network-first (a live deploy always wins;
cache is only the offline fallback); `/registry/**.json` identity data is
NEVER served from cache — offline is an honest network failure, not an old
identity verdict; only hashed/immutable assets (`/_astro/`, fonts, icons)
and `/data/` shards are cache-first; caches are versioned per build
(`scripts/build-service-worker.mjs` stamps `CACHE_VERSION` between the
`@build` markers; activate deletes old caches); push stays behind the
build-time flag. Never make any HTML or registry-authority route
cache-first — a caching worker can serve stale static deploys.

CI re-runs the wing generators and fails on drift — always commit regenerated
output together with the source edit.

## Voice rules (new surfaces)

Plain, confident, warm, unadorned — how a literate person actually talks.
Never woo-woo, never salesy, no financial language outside the wing. Say what
the site does, not that it does it "properly"; state computed facts with
degrees and timestamps rather than boasting about them. Banned as smug tells:
"done/computed properly", "shows its work", "like a human", "no mush", "not
vibes", clever sentence-fragment headlines, and mono-caps eyebrow tags on
every section. Chrome should sound like `src/lib/interpretations.ts` — dry,
specific, calm. Canonical labels live in `docs/STRATEGY.md` §4.

## Design system (new surfaces)

"Cosmic Void": near-monochrome cool void + the twelve pastel disc hues as the
ONLY chroma. Display headlines are EB Garamond (`--font-serif`, the `.display`
utility / `.section-head h2`); body/UI is Instrument Sans; data is JetBrains
Mono. No decorative status dots, no gradient/aurora backgrounds, no gold
anywhere (Warm Gilt is retired sitewide). Reserve `.shell`/`.core` bezels
for elevated moments; grids of equal items use the light `.tile`. Kickers are
sentence-case serif-italic (`.kicker`), not mono-caps eyebrows.

### Canonical site ending

Every full page ends with the Celestial Colophon footer. Astro pages inherit
`src/components/SiteFooter.astro` through `src/layouts/Base.astro`; static and
generated wing pages use `renderStaticFooter()` from
`scripts/site-footer.mjs`. The sole CSS source is
`src/styles/site-footer.css`; `npm run footer:sync` publishes its byte-identical
copy for static pages. Do not add bespoke full-page footers, dot-separated
language/legal text rivers, or a second footer stylesheet. Small embeds and
transactional or documentation shells may use the sanctioned
`zfooter--compact` variant. Generated TypeDoc pages retain their compact
`engine-sign-rail` ending, styled by `public/sdk/engine/assets/custom.css`;
that dense API-reference exception must stay visually aligned with the
Celestial Colophon and must not spread to product or editorial pages.
`npm run footer:check` enforces the shared sources, generated output, and the
static CSS copy.

## Engine

`src/lib/engine/` computes charts client-side (astronomy-engine + in-house
houses/aspects). `engine/full.ts` is the only BROWSER module allowed to
import `astronomy-engine` (bundle isolation — the homepage must never load
it). One server-only exception since the #108 hotfix:
`src/lib/engine/server-ephemeris.ts` (the calendar function's Node adapter,
CJS interop via createRequire). `scripts/report-bundles.mjs` enforces both
sides — the exact import allowlist AND a marker check that no browser
chunk ever carries astronomy-engine/createRequire; a CI parity test pins
server and browser ephemeris to 1e-12 agreement.
Accuracy is gated by `vitest` test vectors; run `npm test` after any engine
change. Timezone conversion (`src/lib/time/localToUtc.ts`) resolves legal
offsets via `Intl` from 1970 on, and before 1970 (for a birthplace, i.e. with
a longitude) from the generated `src/data/tz-history/` — never hand-roll
offsets. The one computed clock is a birthplace's own local mean time (240 s
per degree of longitude) before its zone's local mean time era ended, per the
generated `src/data/tz-lmt.json`; any caller that passes a longitude must
`await prepareLocalTime(date, timeZone)` first with the same date and zone
(`src/lib/time/localToUtc-callers.test.ts` checks the call sites).

## Checks

```bash
npm run build && npm run check && npm test
node scripts/check-dist.mjs   # link/artifact integrity over dist/
```
