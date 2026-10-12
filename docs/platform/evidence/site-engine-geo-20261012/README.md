# Site local times through `@zodiacs/engine/geo`

This change makes the site read every local birth time with the engine's own
resolver, `@zodiacs/engine/geo` from `@zodiacs/engine` 1.0.0. That covers the
calculators, the compute API, the chart studio and the AI tools. It removes
the site's copy of the same logic. This is the adoption that units P1.01b
(birthplace local mean time in the engine package) and P1.12b (the
backzone-complete tzdb inside the engine) wait for.

## What changed

- **The resolver.** `src/lib/time/localToUtc.ts` keeps the site's
  signatures, input checks and error messages, and hands every conversion to
  the engine:
  - `prepareLocalTime(date, zone)` loads the engine's geo entry on first use,
    and for a date up to 1970 the zone's history. No page carries the engine
    resolver in its initial script.
  - `resolveLocalToUtc` maps the engine's answer onto the site's fields.
  - A longitude the site cannot place is ignored, as before.
  - An unsupported zone gives a fixed error that never repeats the zone given.
  - `prepareLocalTime` rejects only when a download fails, as before. A date
    that is not a real YYYY-MM-DD loads nothing, so resolving it fails with
    the input error. The engine's own preparation refuses such a date with a
    `RangeError`, which the calculators would otherwise have shown as a
    failed download.
  - `offsetAt` and `localDateContainsUtc` still read the host's Intl data:
    they answer questions about the host's clock, not about a birth.
- **Removed.** The site's own birthplace clock (`birthplace-clock.ts`), its
  history loader (`tz-history-load.ts`), the pinned tables
  (`src/data/tz-history/2025c/`, 65 files, and `src/data/tz-lmt.json`), their
  two generators and tests, and the "Time zone data drift" job of Site Check.
  The engine ships the same release, tzdata 2025c with its backzone file, in
  16 files that only its geo entry loads.
- **Zone names.** `src/lib/time/zone-names.ts` spells a name given in any
  letter case as tzdb does. It now reads `src/data/tz-names.json`, the 598
  names of that release (names only), instead of the tables. A test resolves
  every one of them through the engine.
- **Callers.** Every production call now awaits `prepareLocalTime` for the
  same date and zone first, and a test reads the source to hold that.
  - The wallet chart is frozen Registry code, which this change leaves as it
    was. Its page serves only a redirect while no wallet chain is
    configured, as in production. Its owner comparison resolves without
    preparing, so with the engine's resolver it would refuse every owner
    time. The fix is one line, which waits for the owner's scope allowance
    (FINDINGS F-83).
  - The learning-source check of a stored record no longer converts at all
    (`isResolvableLocalTime`).
- **The compute API.**
  - **Bundle.** `api/_compute/local-time.mjs` is the engine's resolver,
    bundled with the histories it loads (232,897 bytes, down from 275,756).
    Each request evaluates its own copy, and `dispose()` empties the engine's
    maps of histories, pending loads and formatters when the request ends.
    The private-state test audits those three maps on success, refusal and
    failure, and while two resolvers interleave.
  - **Receipts.** `zoneHistory` is `pinned` when the engine's history answered
    (`zone.source === 'tzdb'`), and `zoneUncertain` marks a date up to 1970 it
    did not, except in a fixed-offset zone. A receipt's `timeResolution` names
    `@zodiacs/engine/geo`, and the release with its archive digest, and no
    longer says the history needs a longitude.
  - **Fixed offsets.** The engine reads UTC, Etc/GMT±N and their other names
    from Intl at every date, where the two cannot differ.
    `src/lib/time/fixed-zones.ts` names them with the engine's own pattern; a
    test holds the two together and checks every such name of the release. A
    1950 time in UTC has `zoneHistory` `runtime` and is not uncertain. With a
    longitude, main read it on its table and reported `pinned`. Before 2005,
    Antarctica/Troll, where tzdb records no local time, is still uncertain.
    The chart studio applies the same rule.
  - **Text.** The OpenAPI description of `/time`, the `/time` sentence of
    `llms-full.txt` and a comment in `endpoints.ts` still named the site's own
    resolver. Like the compute page, they now name the engine's.
  - **Examples.** The documented examples were regenerated on Node 24.21.0
    (tzdata 2026c), as for the 1.0.0 adoption. Two node speeds that macOS arm64
    computes differently in the last bits keep CI's x86-64 values (F-82).
- **The chart studio** (`src/ai-tools/studio/local-time.ts`) records the
  engine's own resolution, its `localResolution`, in the receipt.
- **The MCP adapter 0.1.0-rc.21.** The adapter bundles the compute API's
  code, so it was rebuilt. It resolves no time zone, so the changed code
  never runs in it.
  - rc.20, cut with the first commit of this change, was withdrawn before
    release when the fixed-offset rule changed the bundle again. It was never
    served.
  - [`mcp-rc19-rc21.json`](mcp-rc19-rc21.json): rc.19 and rc.21 answer the same
    278 calls (10 of them refusals), the tool list and both resources
    identically once versions and digests are taken out.
  - The protocol drive (106 of 106), the host drive (Claude Code 2.1.296, 7 of
    7) and the benchmark (18 of 18 scenarios, 112 assertions) were run again on
    it.
- **The developer plugin 0.3.9** bundles the AI tools, whose sky tools resolve
  a day's zone and whose chart studio applies the fixed-offset rule, so it was
  rebuilt and packaged. 0.3.8, the earlier cut, was withdrawn with rc.20.
- **Copy.** The compute API page describes the new reading. Both llms files
  name adapter rc.21. The sitemap dates both pages 2026-10-12. Five claims
  were restated, nine ledger sentences updated, and two added.

## What it changes in the answers

[`tools/parity.ts`](tools/parity.ts) compared the site's own resolver with the
engine's at the base, on 2,746,260 synthetic wall times from 1800 to 2199 in
every zone of the runtime (Node 22.22.2, tzdata 2025c), each with and without
a birthplace longitude ([`parity.json`](parity.json)).

- **With a longitude, as every calculator resolves**, the two gave the same
  instant, offset and flags in all 915,420 cases but one, which differed in its
  metadata only: Qatar on 1920-01-01 at 00:30, a wall time in the gap at the
  end of the local mean time era. The engine reports the birthplace mean time
  that the gap shift is measured from, as its documentation says; the site's
  resolver reported none.
- **From 1970 on**, they agreed in every case, with a longitude or without.
- **Before 1970 without a longitude**, they differ:
  - **Instants.** Without a longitude, the site's resolver read the host's
    default tzdb build, which gives many places another city's history. The
    engine reads the history it ships with backzone, as the calculators
    already did with a longitude. Instants differ in 127,408 of the 1,156,608
    cases without a longitude, in 97 zones; the largest difference, 88,000
    seconds, is where a place changed sides of the date line.
  - **Offsets and flags.** Seven gaps differ in offset only. The engine
    also flags `lmt` where the zone's own mean time read the time (224,209
    cases differ only in flags); the site's resolver claimed it only with a
    longitude.

  Without a longitude, the site resolves the compute API's local times when
  no longitude is sent, and its day windows for a date and zone. These now
  read the engine's history. The wallet chart's owner time would too, once
  it prepares (F-83); its page is not served.

## Checks

At `36468281`, main merged in after the daily edition of 2026-10-12, on
macOS arm64 with Node 22.22.2:

- **Unit tests.** The whole suite: 7,047 pass and 5 are skipped. One fails,
  the Phase 1 capture digest; the Browser Evidence workflow retakes those
  captures because the library sources changed. The suite includes:
  - the time module's tests, the parity test with the engine over every city
    index zone (300,000-odd cases), and the all-zone round trip on the
    engine's own clock;
  - the fixed-offset test, over every such name of the release;
  - the compute API's tests, the AI tools' (`ai:test`) and the claims tests.

  The tests that held the site's own birthplace clock are the engine's now
  (`src/geo/birthplace-clock.test.ts` in the engine), and were removed here.
- **Build.**
  - `astro check` passes, and so do the build, `check-dist` (5,109 HTML files)
    and every bundle budget.
  - The initial script of `/birth-chart/` is 66.9 KB gzipped, against 67.1 KB
    on main, because no page loads the engine resolver up front.
  - The build ran after that day's daily edition, with every check, the two
    of the edition's age included.
- **Bundles.** The compute bundle, the AI bundles and the MCP bundle are what
  their sources build to (`--check`). The adapter archive and the plugin
  package are packed and verified.
- **Phase 1 captures.** The library sources changed, and main brought #724,
  so the merged head needed captures for its own digest. Browser Evidence
  run 38211859904 on `f985be12` took them for digest `85a9b9fa`. Its 19
  capture hashes match the committed files, and its build, visual comparison,
  Lighthouse and explorer drive all passed
  ([`browser-evidence-provenance.json`](browser-evidence-provenance.json)).
- **Private search.** [`history-check.txt`](history-check.txt) records it,
  counts only: no line this change adds matches a person the base did not.

## Acceptance

P1.01b and P1.12b both ask for the engine's function released (1.0.0, on
npm) and adopted. The site now calls `prepareLocalTime` and
`resolveLocalToUtc` with its own conversion removed, and the parity is
recorded. Acceptance waits for the change to be deployed and checked in
production.
