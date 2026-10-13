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
  tests hold the bundled shards to the served files row for row, and, for 75
  queries at three limits each, the tool's places to those the site's search
  lists, in the same order.
- `get_capabilities` adds a `time` and a `places` section.
- The developer plugin's server imports the chart tools and with them the
  capabilities reply. The time tool and the place constants live in modules
  of their own, so the plugin's bundle does not carry the index, and its
  `get_local_chart_capabilities` now leaves out the adapter's sky, time and
  place sections, their limits and their citation sentence, which describe
  tools the plugin does not register.

## 0.1.0-rc.24 and plugin 0.3.12

- The archive `public/examples/zodiacs-mcp-server-0.1.0-rc.24.tgz` is 910,032
  bytes, SHA-256
  `2d27439075bd29548b85d248933f843c63e02ce0774621f241813ea90d46587a`, built
  from commit `0310cdae9ae3ea58fc0c0f3dc22c8d7743cbd658`. Its `server.mjs` is
  2,460,956 bytes, SHA-256
  `d90de2807a965feffa0c04f6e6ca72b0ed82ba34a422d91906bcb875464b3d9b`: the build
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
  atlas as the exception to "no town-level clock records".
- `integrations/packages/zodiacs-developer-0.3.12.zip` is 1,850,094 bytes. It
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
capture digest covers, so CI took the 18 captures again. Browser Evidence run
38460766572 took them on `4fee71ac`, this branch merged with main at
`848e6087` (#740), with Chromium 149.0.7827.55 at 2026-10-13T20:15:16Z, for
the 2026-10-13 edition, bound to template source digest `96847a88…`. Its
build, acceptance captures, receipt, visual comparison, Lighthouse and
explorer drive passed ([browser-evidence-provenance.json](browser-evidence-provenance.json)
is the run's own record).

## Not changed

The hosted assistant tools and the remote MCP at zodiacs.org keep their own
contracts; their bundles are rebuilt because they inline the compute API, but
no tool they list changes.
