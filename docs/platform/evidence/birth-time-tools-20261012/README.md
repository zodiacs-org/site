# resolve_birth_time and search_places (A1.c), 2026-10-12

The brief's Track A1 asks for `resolve_birth_time`, "local time and place to
UTC, with flags (DST gap or fold, the local mean time basis, uncertain zone
history, the calendar)", and `search_places`, "GeoNames candidates with
coordinates and zone". The local MCP adapter gains both in 0.1.0-rc.24, and
the compute API's time endpoint gains the calendar input they need.

## The time endpoint

`POST /api/v1/time` already read a local time with `@zodiacs/engine/geo` and
flagged a skipped (`dst-gap`) or repeated (`dst-fold`) time, a time read on a
local mean time (`lmt`), and a date before 1970 read on the runtime's data
where the release records no local time (`zoneUncertain`). It now also takes:

- `calendar: "julian"`: a date written in the Julian calendar, the Old Style,
  from 1800-01-01 to 1923-12-31, as the birth forms take one. It is converted
  with the forms' own calendar code (`src/lib/time/calendar.ts`) before the
  time is read, and the answer gives the date as written and as read.
- `country`, an ISO 3166-1 alpha-2 code: the answer gives the row of the birth
  forms' adoption table for that country, and for a date written before 1924
  the forms' note, `old-style`, `new-style` or `other-calendar`.

Where the pinned history (tzdb 2025c with backzone) answered, the answer also
gives `intlOffsetMinutes`, the zone's offset at the same instant in the
runtime's own data, tzdb's default build, and adds the flag
`zone-history-disputed` where the two differ. A time read on the place's own
mean time is compared by the zone's clock. At noon on 1 July 1947 Stockholm is
+1:00 in the release and +2:00 in the default build, as the engine's
`docs/time.md` records; the endpoint's tests assert that answer.

Checks, in `tests/api/compute-api.test.ts`:

- the existing parity cases now also check each answer's flags and
  `intlOffsetMinutes` against the engine's own reading;
- a Julian date gives the instant the engine's own Julian reading gives
  (`resolveLocalToUtc` with `calendar: "julian"`), for Moscow on
  1917-10-25 (Old Style), which is 1917-11-07;
- each note: `old-style` for 1917-10-25 written as Gregorian in Russia,
  `new-style` for 1918-02-14 written as Julian there, `other-calendar` for
  Japan in 1850, and none for a code the table does not date or a date from
  1924;
- refusals: a Julian date from 1924, before 1800 or not in the calendar; a
  calendar other than the two; a country code that is not two capitals.

The OpenAPI document describes the new inputs and fields, and its examples add
`time.julian`; the examples were regenerated on Node 24.21.0 with the
committed nodal speeds kept, as before.

## The adapter tools

- `resolve_birth_time` runs the compute API's own time parser and function,
  with the engine's resolver and the zone histories it loads built into
  `server.mjs`. `src/mcp/time-places.test.ts` runs 130 synthetic requests (96
  seeded across 18 zones and the accepted years, a sixth of them in the Julian
  calendar, 9 chosen to reach each flag, both zone histories and each calendar
  note, and 25 at the time atlas's places, which
  [`../time-atlas-reading-20261012/`](../time-atlas-reading-20261012/)
  describes) through the tool and through the compute API's handler, and
  holds every result to the handler's body, apart from `cite.url`, and to the
  tool's output schema, the JSON Schema a host reads and the OpenAPI response.
  Six refused requests get the handler's own sentences.
- `search_places` runs the site's birthplace search over the index the site's
  calculators fetch (`public/data/cities/`, GeoNames cities15000 under CC BY
  4.0, 33,934 places), built into `server.mjs`. The ranking moved to
  `src/lib/geo/rank.ts`, which the browser search and the tool share. The
  tests hold the bundled shards to the served files row for row, and, for 80
  queries at three limits each, the tool's places to those the site's search
  lists, in the same order.
- A place matches by its GeoNames name or its ASCII name, each folded as the
  query is: accents, letter case and apostrophes set aside, dashes written as
  hyphens, and ł, ø, ß, ə and the other letters NFD leaves whole written in
  ASCII. Before #742's reviews the search compared a query only with the
  ASCII name, which GeoNames writes with ue, oe and ae for ü, ö and ä in many
  German, Swiss, Swedish and Turkish names, so "Zürich", "Zurich",
  "Düsseldorf" and "Dusseldorf" found nothing, on the site's birth forms and
  in the tool; Łódź and Əhmədbəyli chose shard `0`; and "Arkhangelsk" did not
  find Arkhangel’sk. Each is found now (`src/mcp/time-places.test.ts`).
- The index files a place under the first letter of its ASCII name, so 62
  places are filed under another letter than one of their names begins
  with: GeoNames writes Đ as GJ in some Vietnamese and Croatian ASCII names
  (Đồng Hới, GJong Hoi), begins some with an apostrophe (‘Ibrī), and gives a
  few places names in two languages (Donostia / San Sebastián). The index
  lists them under each such letter (`also` in
  `public/data/cities/index.json`, from `scripts/build-cities-also.ts`), and a
  query reads them with its letter's shard, so no other shard is fetched.
  `src/lib/geo/rank.test.ts` holds the list to the shards and reaches every
  place of the index by either of its names.
- The contains tier finds only names that begin with the query's first
  letter: "york" finds York but not New York City. The documents say so, and
  F-94 records it, with names the index does not give a place (Cologne for
  Köln), as open; the reviews' other findings it records are fixed.
- `get_capabilities` adds a `time` and a `places` section.
- The developer plugin's server imports the chart tools and with them the
  capabilities reply. The time tool and the place constants live in modules
  of their own, so the plugin's bundle does not carry the index, and its
  `get_local_chart_capabilities` now leaves out the adapter's sky, time and
  place sections, their limits and their citation sentence, which describe
  tools the plugin does not register.

## 0.1.0-rc.24 and plugin 0.3.12

- The archive `public/examples/zodiacs-mcp-server-0.1.0-rc.24.tgz` is 911,940
  bytes, SHA-256
  `23445637af974fa1ad77ed8f49b4807cc164e1f6572819ebae5ad8d295fffe49`, built
  from commit `52c74477579acd49b934703d6e4a876b7b11fadd`. Its `server.mjs` is
  2,468,640 bytes, SHA-256
  `c61f6cac0b4f1bc059b1e6125405b57d424e660a844fa1828b9ef4b105123416`: the build
  inlines every JSON table as a string parsed at its first import, as the
  compute API's local-time bundle does, so the zone-name table carries no
  CommonJS shim. It was first cut from `f148a386`, which also adds the time
  atlas (B3.b, [`../time-atlas-reading-20261012/`](../time-atlas-reading-20261012/));
  packed again on 2026-10-13 after the merge of A1.b's re-cut, because its
  `candidate.json` said it superseded 0.1.0-rc.19 (it now names 0.1.0-rc.23,
  the latest archive the site served before it, as
  `scripts/mcp-artifact.test.mjs` requires); and packed again after #742's
  review, which found that `resolve_birth_time` accepted an `atlasPlace` in
  another zone than `local.zone`, and that its stated limits denied the atlas.
  The parser now refuses such a place (`/atlasPlace`), and the limits name the
  atlas as the exception to "no town-level clock records". It was packed again
  after the second review, which found that tzdb's reading used the zone
  reference city's mean time, or another town's longitude, beside the atlas's
  reading of the place's own: tzdb now reads the place's longitude when none
  is sent, and another longitude is refused (`/longitude`). Its change note
  names the rule, and the search's documents name the shard (above). It was
  packed again after the third review, with the search that matches either
  name (above), and after the fourth, which found that a `country` other than
  the atlas place's put another country's calendar history beside the place's
  clock: it is refused (`/country`), so the zone, the longitude and the
  country a request names are all the atlas place's; and after the fifth,
  with the index's list of places filed under another letter (above).
- `integrations/packages/zodiacs-developer-0.3.12.zip` is 1,851,656 bytes. It
  also carries Chart Studio's fix for a birth date without a time (F-91),
  which came with A1.b. Its release note first said it "bundles MCP adapter
  0.1.0-rc.24"; the plugin registers only the adapter's chart tools, beside
  the hosted tools, and the note now says so.
- [`../mcp-adapter/mcp-rc23-rc24.json`](../mcp-adapter/mcp-rc23-rc24.json)
  drives rc.23 and rc.24 with the same 278 tool calls, 10 of them refusals,
  after versions and digests are written out. One answer differs:
  `get_capabilities`, which adds the two sections and names the two tools in
  its limits and citation text. The tool list differs in 13 places: the two
  new tools, the capabilities reply's schema, and the wording of
  `check_sky_fact`'s description and date argument. The methodology resource
  gains a section on local times and places.
- The comparison, the protocol drive (114 of 114 checks), the host drive with
  Claude Code 2.1.296 (7 of 7) and the comparison benchmark (18 of 18 cases and
  112 of 112 assertions) ran again on this `server.mjs`, with the same counts
  ([`../mcp-adapter/`](../mcp-adapter/)); the archive's own `verify.mjs` passes
  25 of 25 in `scripts/mcp-artifact.test.mjs`.

## Phase 1 captures

The time endpoint and the time atlas change `src/lib`, which the Phase 1
capture digest covers, so CI took the 18 captures again.

- **Committed captures.** Browser Evidence run 38498881497 took them on
  `f30d7f4c`, after #742's five reviews changed the time request parser and
  the place search (`src/lib/geo/`) and the branch merged main's 2026-10-14
  edition, with Chromium 149.0.7827.55 at 2026-10-14T02:06:05Z, bound to
  template source digest `9644c29a…`. Its build, acceptance captures,
  receipt, visual comparison, Lighthouse and explorer drive passed
  ([browser-evidence-provenance.json](browser-evidence-provenance.json) is the
  run's own record). Twelve of the 18 images, the pages that show the day's
  edition (today, tomorrow, daily, love, career and the horoscopes hub, at
  both widths), differ from the captures before because they show the
  2026-10-14 edition; the weekly, monthly and yearly images are unchanged.
- **Superseded runs.** Run 38460766572 on `4fee71ac`, before the reviews,
  took them for digest `96847a88…`, and run 38478006905 on `2efc0a63`, after
  the first, for digest `93a9f716…` and the 2026-10-13 edition; their
  provenance is kept as `browser-evidence-provenance-4fee71ac.json` and
  `browser-evidence-provenance-2efc0a63.json`.

## Not changed

The hosted assistant tools and the remote MCP at zodiacs.org keep their own
contracts; their bundles are rebuilt because they inline the compute API, but
no tool they list changes.
