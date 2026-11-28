# zodiacs.org

The house rules shared by every coding agent (identity, draft pull requests
only, product rules, quality gates and the shared task board) live in
`AGENTS.md`. Read it first; it is imported here:

@AGENTS.md

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
   not a boundary breach. Owner-approved navigation exception (2026-10-06): every primary navigation,
   including tools and shared-chart receivers, includes Astrofolio in the same
   position. This does not change the content or footer boundary. Desktop
   places Profile and Search before the divider, with Astrofolio alone on the
   right; mobile keeps its established order. The wing's nav label is "Astrofolio" in every
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
  (declarations of the digest-pinned archive the site vendors; `--check` verifies reproducibility;
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
- `src/lib/email/inline-images.ts` ← `node scripts/build-email-inline-images.mjs`
  (the brand ring and the twelve 128px sign discs as base64, attached inline
  by cid: to the confirmation email so it still loads nothing remote;
  `--check` and `scripts/build-email-inline-images.test.mjs` catch drift)
- `public/assets/brand/tilted-ring.svg` + `tilted-ring@3x.png` ← `node
  scripts/build-brand-lockup-assets.mjs` (the lockup's ring as files, from
  `src/lib/brand-lockup.mjs`; the PNG is the email's inline ring. libvips
  output, so not in the drift job; `src/lib/brand-lockup.test.ts` checks the
  SVG. Rerun it, then the email images, when the ring changes)
- `public/registry/index.html` Aura marker region (meta flag + no-JS entry
  between the `registry-aura-entry` comments) ← stamped by
  `scripts/configure-registry-aura.mjs` (predev/prebuild) and
  `scripts/build-app.mjs` from `PUBLIC_REGISTRY_COLLECTION_ENABLED` in the SHELL
  env (plain-node generators don't read `.env` files — set the flag in the
  shell or the Astro/site halves will skew, which `check-dist` fails on).
  The committed state is always flag-OFF (`content="0"`, no entry): the CI
  drift gate regenerates with the flag unset. Never commit flag-on output.
- `public/assets/og/*.png` are the frozen legacy gilt cards (see `og/v2/`
  below). Their generator, `scripts/build-og-cards.mjs`, stays in the repo
  and is not run
- `public/assets/zodiac-icons/{48,128,400}/` ← `node scripts/build-icons.mjs`
  (sources in `public/assets/sdk/zodiac-icons/circle/` are SDK-public —
  keep byte-identical)
- `public/assets/sign-art/{sign}-{720,960,1200}.avif` ← `node
  scripts/build-sign-art-avif.mjs` (AVIF copies of each sign's published
  1200px WebP painting, which stays untouched; the compatibility pair pages
  offer them to screens at 1.5x and above. libaom output is not byte-stable
  across platforms, so they are not in the drift job;
  `scripts/build-sign-art-avif.test.mjs` checks the set)
- `public/assets/birthday/eb-garamond-birthday-date-400-italic.woff2` ← `node
  scripts/build-birthday-date-font.mjs` (the birthday title's date face: the
  EB Garamond italic in `public/fonts/` cut by `pyftsubset` to the code points
  of the 366 dates, every layout feature, name record and hint kept. The page
  preloads it as an optional face ahead of the full italic. Byte-stable for a
  given fontTools and Brotli version (4.69.1 and 1.2.1 made it); `--check`
  rebuilds and compares, and `scripts/build-birthday-date-font.test.mjs` pins
  its digest. Rerun it when the month names or the italic change)
- `public/data/cities/` ← `node scripts/build-cities.mjs` (GeoNames, CC-BY)
- `src/data/astrocartography-land.json` ← `node scripts/build-astrocartography-land.mjs`
  (the 2-degree land dots the /astrocartography/ map draws, from the cities above;
  `--check` for drift, which the site-check drift gate runs)
- `src/data/sky.json` ← `node scripts/build-sky.mjs`
- `src/data/tz-names.json` (the zone names of the tzdb release that
  `@zodiacs/engine/geo` ships, names only, for spelling a name as tzdb does in
  `src/lib/time/zone-names.ts`; no generator. The zone histories and local
  mean time eras are the engine's, not the site's. When the engine moves to
  another release, take the names its history files carry;
  `src/lib/time/zone-case.test.ts` fails until the list matches them)
- `src/data/ingresses.json` ← `node scripts/build-ingresses.mjs` (refresh
  yearly with sky.json)
- `src/data/events-publication.json` and `src/data/events-publication-2028-2030.json`
  ← `npm run data:events:build` (the event pages the site publishes, with
  their readings; `data:events:verify` for drift). The first, 2026 to 2027,
  is bundled byte for byte into the AI tools and the published developer
  plugin, so it keeps its window; the second holds the 2028 to 2030 pages,
  published 2026-11-08. Site pages and scripts read both, joined, through
  `src/lib/events/site-publication.ts` (Node: `scripts/lib/events-publications.mjs`);
  the AI tools read `src/lib/events/publication.ts`. New event cards:
  `npm run data:og -- --only-events`
- `src/data/sun-ingresses.json` ← `node scripts/build-sun-ingresses.mjs`
  (the Sun's sign entries for the season pages, every season that begins
  from 2026 through 2040, by the same calculation as ingresses.json, whose
  Sun windows it matches to the millisecond; ingresses.json is bundled byte
  for byte into the AI runtime and the published developer plugin, so the
  seasons do not extend it. No timestamp, so `--check` catches drift; the
  site-check drift gate runs it)
- `src/data/moon-distances.json` ← `node scripts/build-moon-distances.mjs`
  (each new and full Moon in sky.json with the Moon's geocentric distance in
  whole km and the perigee and apogee on each side; astronomy-engine with one
  measured scale factor, held to JPL DE421 and Horizons by
  `scripts/build-moon-distances.test.mjs` and the fixtures from
  `scripts/moon-distances-de421.py`. It names no rule about close Moons;
  the supermoon rule (owner, 2026-11-12: a full Moon within 10% of its
  orbit's perigee to apogee range from perigee) is `src/lib/supermoon.ts`.
  sky.json stays untouched. No timestamp, so `--check` catches drift; the
  site-check drift gate runs it. Rerun it whenever sky.json is rebuilt)
- `src/data/eclipses.json` ← `node scripts/build-eclipses.mjs` (refresh
  yearly with sky.json)
- `src/data/birthdays.json` ← `node scripts/build-birthdays.mjs` (the
  `now` receipt year — refresh yearly with sky.json). The same run writes
  `src/data/birthdays-precise.json`, the noon-UTC degrees to four decimals
  that the birthday pages print from; birthdays.json is bundled byte for
  byte into the AI tools, so it keeps its two decimals
- `src/data/people-degrees.json` ← `node scripts/build-people-degrees.mjs`
  (each published person's placements recomputed to the full degree, checked
  against every stored value; the People pages print it rounded once, through
  `src/lib/people-degrees.ts`. people.json and the released copy are
  untouched; `--check` for drift)
- `src/data/transits-YYYY-MM.json` ← `node scripts/build-transits.mjs`
  (monthly cron: transits-monthly.yml)
- `api/_assistant/context.ts` ← `vite-node --script
  scripts/build-assistant-context.mjs` (committed assistant site guide)
- `plugins/zodiacs-sky/.codex-plugin/plugin.json` and `plugins/zodiacs-sky/.mcp.json` ← `scripts/build-ai-integrations.mjs` from the portable Sky manifest.
- `integrations/generated/chart-studio.mjs` ← `scripts/build-chart-studio.mjs`
  through `npm run ai:build`; standalone browser bundle with inline fonts/icons.
  Its sources are `src/ai-tools/studio/`; never edit the generated HTML string.
  While the panel is pinned to its published address (`PUBLISHED` in the
  script, `ui://zodiacs/chart-studio-v6.html`), `ai:build` keeps the bytes that
  address was published with, and it and `ai:check` fail when the panel's
  build differs from `SOURCE_SHA256`: a change to the studio's sources, a
  shared module it imports, its fonts or icons, or the engine. End the pin
  with a new address, or record the new build in `SOURCE_SHA256` if the
  change may wait.
- `integrations/generated/horoscopes.mjs` ← `scripts/build-horoscope-panel.mjs`
  through `npm run ai:build`; the get_horoscope panel (sources
  `src/ai-tools/horoscope/`). It carries no reading data.
- `integrations/generated/readings-sky-events.mjs` ← `scripts/build-readings-panel.mjs`
  through `npm run ai:build`; the readings panel offered only with
  `ZODIACS_SKY_EVENTS_ENABLED=1` (`READINGS_SKY_EVENTS_URI`, for get_natal_chart),
  built from the same app with `src/ai-tools/readings-panel/views-sky-events.tsx`
  in place of `./views`, so `integrations/generated/readings.mjs` keeps its bytes.
  Its birth chart lists the lunar nodes, each body with its glyph.
- `integrations/generated/occasions.mjs` ← `scripts/build-occasions-panel.mjs`
  through `npm run ai:build`; the occasion tools' panel (sources
  `src/ai-tools/occasions-panel/`), offered only with `ZODIACS_OCCASIONS_ENABLED=1`.
  It carries no occasion data; `npx vite-node --script tests/ai-occasions-drive.ts` drives it in Chromium.
- `src/ai-tools/features/people-index.json` ← `node scripts/build-ai-people.mjs`
  (also run by `ai:build`, verified by `ai:check`): the compact index of the
  people the site's directory publishes, for the `find_chart_twins` and
  `get_famous_chart` tools; it never includes anyone `INDEXABLE_PEOPLE` leaves out.
- `src/data/horoscope-months.json` ← `node scripts/build-horoscope-months.mjs`
  (the published monthly horoscopes in `src/content/horoscopes/` as plain
  paragraphs, for the hosted `get_horoscope_period` tool, which
  `api/_ai/handler.ts` reads at call time like the window. A month is included
  only when all twelve signs are written, none is a draft and none has an em or
  en dash; rerun it whenever a month is written or edited. `--check` and
  `src/ai-tools/features/horoscope-period.test.ts` catch drift)
- `src/data/lunar-new-year.json` ← `node scripts/build-lunar-new-year.mjs`
  (Lunar New Year dates 1900 to 2101 for `get_chinese_zodiac`, from
  astronomy-engine new Moons and solar terms on China Standard Time, Beijing
  mean time before 1929; `--check` and
  `src/ai-tools/features/chinese-zodiac.test.ts`, which also holds it to
  published dates, catch drift)
- `src/data/horoscope-window.json` ← `vite-node --script
  scripts/build-horoscope-window.ts` (the daily workflow rebuilds it after the
  day's program; `verify-horoscope-window.ts --replay` checks it). It holds the
  editions for the day before, the day of and the day after the committed daily
  date; `api/_ai/handler.ts` reads it when a horoscope is asked for.
- `api/_ai/runtime.mjs`, `plugins/zodiacs-developer/mcp/server.mjs` and the
  developer's portable `plugin.json`/`mcp.json` ← `npm run ai:build` (sources
  `src/ai-tools/` and the compatibility manifest). `integrations/packages/`
  ZIPs and manifest ← `npm run ai:package`. `npm run ai:check` checks drift.
  The hosted MCP at /mcp is switched on in production with
  `ZODIACS_MCP_ENABLED=1` and is the only hosted MCP server; its exact optional
  staging hostname is configured with `ZODIACS_MCP_STAGING_HOST`. See
  `docs/platform/zodiacs-ai/LAUNCH.md`.
- `api/_assistant/persona.ts` is Fable-authored source; edit it only via Fable.
- `public/assets/og/v2/` ← `node --experimental-strip-types
  scripts/build-og-void.mjs` (ALL share cards sitewide since Part Q — wing
  pages reference `v2/sign/{slug}.png` + `v2/share.png`; the 13 legacy gilt
  cards at `public/assets/og/*.png` are frozen and unreferenced — leave
  the files alone, don't regenerate or re-reference them. The People, event
  and Russian families keep 16-colour palettes with the lockup ring laid back
  in its own colours (`compactCard`), which is what holds the 28MB bundle and
  the Russian family's ceiling; after a run, restore the pinned
  `og/v2/registry.png` and `og/v2/registry/` from git)
- `public/assets/card-art/panel/` and `public/assets/card-art/share/` ←
  `node scripts/build-card-art.mjs` (small AVIF variants retained from the
  earlier inline panels, and JPEGs of the dark twins for the share images;
  current chat panels use the larger published art files directly. Sources are the sign panels, the
  cards' own pieces `public/assets/card-art/<name>-720.webp` and the daylight
  twins `public/assets/card-art/<key>-light-720.webp`, which `--masters <dir>`
  writes from 1536px source PNGs, and, for the Chinese zodiac share card,
  `share/chinese-<animal>-1600.jpg` from the animals' 1920px pieces in
  `public/assets/art/chinese-zodiac/` (`--chinese-zodiac` writes only those).
  libvips output, so not in the drift job;
  rerun it when a source changes, then `npm run ai:build`)
- `public/assets/og/registry/v4/` (twelve lot cards, `hub.png` and the
  manifest) ← `npm run data:og -- --only-registry` (Chromium draws each
  lot's text plate and the hub card with the brand lockup;
  `scripts/build-registry-og.mjs` lays the canonical 1024px pastel icon and
  gold sculpture on each plate. The Registry hub and technical pages share
  `hub.png`. Not in the drift job: `verify-registry-og` checks the family,
  its icon and sculpture sources and the pages. The v3 family and the pinned
  v2 cards it was built on stay published, byte for byte, for links already
  shared; never overwrite them)
- `public/assets/og/v7/terminal.png` ← `npm run data:og -- --only-terminal-card`
  (Terminal's card: v6's desk from `build-astrofolio-identity.mjs` with the
  lockup's footer row; v6 stays published)
- `public/assets/og/v8/` (`home-20261019.jpg`, `sign/{slug}.jpg` and
  `horoscope/{slug}[-{surface}].jpg`) ← `npm run data:og -- --only-art-cards`
  (the art share cards, owner-chosen 2026-10-19: the homepage card, which is
  also the site's fallback, cut from the hero poster; the twelve sign guide
  cards on the sign art panels, each laid out as its page's hero with the
  sign's disc large and the names in EB Garamond; and each sign's seven
  horoscope cards in the same layout. JPEGs under 300 KB, the folder under
  12 MiB; paths, words, crop and the heroes' shade live in
  `src/lib/og-art-cards.mjs`, which `og-art-cards.test.ts` holds to the two
  heroes. Not in the drift job (Chromium and libvips output);
  `verify-og-cards` checks them. The v2 homepage, sign and horoscope cards
  stay published for links already shared, and the run rewrites only the v2
  manifest's fallback line)
- `public/assets/og/v8/{es,fr,it,pt}/` (`home.jpg`, `sign/{slug}.jpg`, and
  for Spanish and Portuguese `horoscope/{slug}.jpg`) ← `npm run data:og --
  --only-localized-art-cards` (the same art cards in each locale's own
  words; it never redraws the English ones). Their words come from
  `src/lib/og-art-cards.locales.mjs` ← `npx vite-node --script
  scripts/build-og-art-card-copy.ts` (`--check` for drift), which reads what
  the localized pages print (`src/lib/og-art-cards-copy.ts`);
  `og-art-cards.test.ts` holds both. Not in the drift job; `verify-og-cards`
  checks them, under their own 12 MiB ceiling. Each locale's homepage card is
  also that locale's fallback
- `public/assets/og/v8/tool/chart-twins.jpg` ← `npm run data:og --
  --only-chart-twins-card` (the English /chart-twins/ page's art card,
  owner-chosen 2026-11-26: the page's twin cameos painting
  `public/assets/card-art/twins-hero-1200.webp` on the right in the v8 sign
  cards' filter and shade, a Sun disc in Leo's hue and a Moon disc in
  Cancer's, the kicker, headline and line, and the lockup's footer row;
  `--only-art-cards` draws it with the rest. A JPEG under the art cards'
  300 KB budget, counted in the v8 folder's 12 MiB; words, art placement and
  shade live in `src/lib/og-art-cards.mjs`, which `og-art-cards.test.ts`
  holds to the page. Not in the drift job (Chromium output);
  `verify-og-cards` checks it. The /share/chart-twins/ page shows it when a
  link carries no share (`src/server/result-preview.ts`). The v2
  `og/v2/tool/chart-twins.png` stays published for links already shared)
- `public/assets/og/v8/{es,fr,it,pt,ru}/tool/chart-twins.jpg` ← `npm run
  data:og -- --only-localized-chart-twins-cards` (the same card on the
  Spanish, French, Italian, Portuguese and Russian chart twins pages,
  owner-approved 2026-11-26, with the localized route in the footer;
  `--only-localized-art-cards` draws them with the rest and neither redraws
  the English one. A long headline line steps down to the English card's
  measure. Spanish, French, Italian and Portuguese take the headline and line
  from their `og.tools.chart-twins` card copy, the line without its word for
  "verified"; the kickers and the Russian words are written in
  `src/lib/og-art-cards-copy.ts`, and all reach the generator through
  `og-art-cards.locales.mjs`. The Russian card is a painting, so it sits here
  rather than in the 16-colour `og/v2/ru/` family, set in EB Garamond
  Cyrillic and Golos Text in the Russian frame; `/ru/chart-twins/` reaches it
  through the route's `artCard` in `src/strings/seo.ru.mjs`, and the v2
  `og/v2/ru/tool/chart-twins.png` stays in that family, published for links
  already shared. Counted in the localized cards' 12 MiB; not in the drift
  job; `verify-og-cards` checks them)
- `public/assets/og/v8/thesis.jpg` ← `npm run data:og -- --only-thesis-art-card`
  (the thesis page's art card, owner-chosen 2026-11-27: the page's own
  painting of the old astronomical clock, `public/assets/art/zodiac-clock-1280.jpg`,
  on the right, fading into the void, and on the left the twelve canonical
  sign discs in one row, Aries to Pisces (the icons' 128px tier), the kicker,
  the headline "Why Zodiacs Matter" on two lines, the line, and the lockup's
  footer row; `--only-art-cards` draws it with the rest. The kicker and the
  line are the thesis film's first two sentences word for word, from
  `filmScript()` in `scripts/build-thesis-film.mjs`, and `og-art-cards.test.ts`
  holds them to it; words, art placement, shade and disc row live in
  `src/lib/og-art-cards.mjs`. A JPEG under the art cards' 300 KB budget,
  counted in the v8 folder's 12 MiB. Not in the drift job (Chromium output);
  `verify-og-cards` checks it. `public/thesis/index.html` names it in
  og:image, twitter:image and the Article's image with one alt text. The v2
  `og/v2/thesis.png` stays published, in the v2 family, for links already
  shared)
- `public/assets/og/v8/tool/{key}.jpg` (17 single page cards) ← `npm run
  data:og -- --only-art-page-cards` (owner-delegated decisions, 2026-11-27:
  /birth-chart/ with its someone-else and three-dimensions pages, /today/,
  /rising-sign/, /big-three/, the /birthday/ hub, /tools/, the /learn/ hub
  only, /sky-calendar/, /saturn-return/, /c/ (`compatibility-invite`),
  /baby-zodiac/, /mercury-retrograde/ with its 2027 page, and /transits/;
  owner-chosen from mockups 2026-11-28: /moon-sign/, the /compatibility/ hub,
  the /horoscopes/ hub (the es and pt hubs too) and /numerology/, each with
  the thesis card's row of the twelve canonical sign discs above the kicker.
  Their art: three generated photographs (Higgsfield; a crescent Moon, the
  Venice clocktower's zodiac dial, a silver dial with a dark numbered ring) cut to 1200px
  WebP in `public/assets/art/`, and the compatibility hub's two chart wheels,
  `public/assets/art/compatibility-wheels-1200.webp` ← `npx vite-node --script
  scripts/build-compatibility-wheels-art.ts` (the real `Wheel.tsx` with the
  published People charts of Alan Turing and Ada Lovelace, Chromium output,
  so not in the drift job; rerun it when the wheel or those charts change,
  then redraw the cards). One
  template, `artPageLayout` in `build-og-void.mjs`: the page's own painting on
  the right, a small accent in the sign hues or the canonical discs, kicker,
  two-line headline and line; every card's art, accent, words and alt text
  live in `src/lib/og-art-cards.mjs`, and `og-art-cards.test.ts` holds the
  words to the pages and their v2 cards. Counted in the English cards' 12
  MiB. The es/fr/it/pt pages that showed the English v2 card show the
  English art card; Russian keeps `og/v2/ru/`. `ogImageForPath` reads each
  tool's `artCard` in `seo.en.mjs`; the share fallbacks in
  `src/server/result-preview.ts` copy the paths and alts as literals
  (`SHARE_FALLBACK_ART_CARDS`), held equal by its test)
- `public/assets/og/v8/pair/{a}-{b}.jpg` (78 sign pairs, same-sign included)
  ← `npm run data:og -- --only-pair-art-cards` (2026-11-27: the two sign
  paintings facing each other, the first mirrored, the two discs, "Compatibility,
  {element} with {element}", "{A} and {B}"; its own 10 MiB ceiling)
- `public/assets/og/v8/birthday/{month-day}.jpg` (the 29 cusp dates of
  `birthdays.json`) ← `npm run data:og -- --only-birthday-art-cards`
  (2026-11-27: the birthday hub's sundial, both signs' discs, "{A} or {B}, by
  year", "Born on {date}"; its own 4 MiB ceiling)
- `public/assets/og/v8/learn/chinese-zodiac/{animal}.jpg` (12) ← `npm run
  data:og -- --only-chinese-zodiac-art-cards` (2026-11-27: each animal's own
  painting with the guide's kicker, headline and line from
  `src/data/chinese-zodiac.ts`; its own 2 MiB ceiling; the localized animal
  pages keep their home cards). All four families: JPEGs under the art
  cards' 300 KB budget at the qualities in `ART_PAGE_CARD_QUALITY`, drawn
  with the rest by `--only-art-cards`; not in the drift job (Chromium
  output); `verify-og-cards` checks each family, its folder and its ceiling.
  The v2 `og/v2/tool/*.png` and `og/v2/pair/*.png` cards stay published and
  verified, byte for byte, for links already shared, and the pages not in
  this round (moon sign, eclipses, the learn guides that borrow its card and
  the rest) keep their current cards
- `public/assets/og/year-sky/v1/2027.jpg` ← `npm run data:og -- --only-year-sky-card`
  (the share card for /your-2027-sky/; words in `OG_EN.yearSky`. Not in the
  drift job (Chromium output); `verify-og-cards` checks it)
- `public/assets/og/astrofolio/v6/faces.jpg` ← `node
  scripts/build-astrofolio-share-card.mjs` (Astrofolio's one evergreen share
  card, owner-chosen 2026-09-24: Chromium paints the twelve sign frames of
  `public/assets/fomo/fomo-film-av1.mp4` around the wordmark band, signed
  with the brand lockup since v6. A JPEG under a 300 KB budget because it is
  a photograph; `verify-og-cards` checks it, and it is not in the drift job
  because Chromium's decode is not byte-stable across platforms. v5 and the
  seasonal `og/astrofolio/v4/{sign}.png` cards stay published for links
  already shared; the season stamp no longer rewrites the page's share image)
- `public/assets/brand/end-card/` ← `npm run data:end-card` (the two-second
  1080 × 1920 end card for short videos and its last frame: Chromium draws
  the ring settling into the lockup from `src/lib/brand-lockup.mjs`, and the
  system's ffmpeg encodes it. Not byte-stable, so not in the drift job;
  `scripts/end-card.test.mjs` checks it. Rerun it when the lockup changes)
- `public/assets/thesis/film/` ← `node scripts/build-thesis-film.mjs` (the thesis's
  32-second silent film "Why the zodiac lasts", 1280 × 720 in H.264 and AV1
  with its poster, and a 1080 × 1920 cut ending on the brand end card. Every
  number on screen is read from `public/thesis/thesis-charts.json` and
  `thesis-seasons.json` by `filmScript()`, which refuses to render when a
  sentence stops being true; each scene shows its source. Chromium draws each
  frame from its time alone and the system's ffmpeg encodes it. Not
  byte-stable, so not in the drift job; `scripts/thesis-film.test.mjs` checks
  it. Rerun it when those data files or the sign shapes change)
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
- `src/data/developer-demo.json` ← `npx vite-node --script
  scripts/build-developer-demo.ts` (the answers /developers/demo/ opens with:
  its preset chart and Mercury questions run through the compute API's
  dispatch, and its two sample charts through the hosted `get_compatibility`
  tool; `--check` for drift, and `scripts/developer-demo.test.ts` runs the same
  comparison, accepting only the runtime a receipt names)
- `docs/platform/programme/LEDGER.md` ← `node scripts/programme-ledger.mjs`
  (source `docs/platform/programme/acceptance-ledger.json`; `--check` for drift,
  `--summary` for the completion figures)
- `src/data/natal-aspect-examples.json` ← `node
  scripts/build-natal-aspect-examples.mjs` (the natal planet-pair pages'
  evidence: synthetic UTC instants run through the birth chart calculation,
  two worked examples and all five feasible geometries per pair, hourly
  birth-time spans; `--check` for drift, CI runs it). The pages are released
  (`src/data/natal-aspects-publication.json`, reviewed 2026-10-25);
  `PUBLIC_NATAL_ASPECTS_PREVIEW=1` matters only if that record is withheld
  again; see `docs/natal-aspects/RELEASE.md`
- `src/data/nasa-event-instants.json` ← `python3
  scripts/build-nasa-event-instants.py` (the planets' sign ingresses,
  stations and the monthly catalogs' exact aspects solved on NASA JPL
  Horizons, DE441, to the second, each row with the engine instants it
  replaces, and the query URLs, retrieval times and SHA-256 of the responses;
  Mercury to Pluto 2025-11 to 2031-05, Jupiter to Pluto over ingresses.json's
  long horizons. It fetches the Horizons tables through
  `scripts/accuracy-audit/horizons_fetch.py`, which keeps the raw responses
  out of git; `--check` needs them on disk, so CI runs the offline
  `src/lib/nasa-instants.test.ts` instead. The pages print these times through
  `src/lib/nasa-instants.ts`; the data files, the event pages' ids and
  publication receipt, and the AI tools keep the engine's instants. Rerun it
  whenever a monthly catalog, ingresses.json, sky.json or the horoscope
  program gains an event, and fetch the responses again past 2031-05)

`public/sw.js` is a caching PWA worker (owner-approved 2026-07-15, WS4
merge decision). Strict invariants: HTML
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

The brand signs with one lockup sitewide, the wing included (owner-chosen
2026-10-19): the tilted twelve-dot ring and ZODIACS · ORG, drawn from
`src/lib/brand-lockup.mjs` (DESIGN.md, "Brand Lockup"). Phones keep
ZODIACS | ASTROFOLIO in the top bar, and the favicon and app icons keep the
flat ring (`BrandMark.astro`). No image or lockup draws a sentence-case
"Zodiacs.org" wordmark; published cards under pinned or dated names keep the
design they were published with. On an image made for one person the ring
turns to bring their Sun sign to the front, and only a sign their chart
settles (`tiltedRingDots`, `src/lib/ring-front.ts`); everything else keeps
the brand's own ring, Libra in front.

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
change. Timezone conversion (`src/lib/time/localToUtc.ts`) hands every wall
time to `@zodiacs/engine/geo`, which reads `Intl` from 1970 on and, before
1970, the tzdb history with backzone it ships, with a longitude or without
one; with a longitude, before the zone's local mean time era ended, it reads
the birthplace's own mean time (240 s per degree). Never hand-roll offsets or
keep a copy of the engine's tables. Every caller must
`await prepareLocalTime(date, timeZone)` first with the same date and zone: it
loads the resolver, which no page loads up front, and for a date up to 1970
the zone's history (`src/lib/time/localToUtc-callers.test.ts` checks the call
sites; its one listed exception is the frozen wallet chart, F-83). The compute
API bundles the same resolver (`scripts/build-compute-local-time.mjs`).

## Checks

Sky Watch's private preview lives in `src/ai-tools/watch/`. Its runtime
`integrations/generated/sky-watch.mjs` is generated by `npm run ai:build`;
never edit it manually. It defaults off, requires an authenticated preview
grant and refuses production enablement. See `docs/platform/zodiacs-ai/SKY_WATCH.md`
for lifecycle verification and the remaining OAuth/ChatGPT release gates.

```bash
npm run build && npm run check && npm test
node scripts/check-dist.mjs   # link/artifact integrity over dist/
```
