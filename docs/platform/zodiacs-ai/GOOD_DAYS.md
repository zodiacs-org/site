# Good day finder (`find_good_days` and `/good-days/`)

Status: built, behind a switch that is off. Nothing changes for the published
plugins until the owner switches it on for the next release.

## What it does

Given a goal and a window of up to 366 days (2026 to 2030, the years of the
eclipse table), it reads every day by the traditional rules of electional
astrology and returns the best days, ranked, each with a score, a one-line
reason, every reason found and a reading-confidence label, plus the days to
avoid with a reason each and the retrograde periods and eclipses in the window.

Goals: `launch`, `contract`, `move`, `relationship`, `travel`, `job` and
`wedding`. Each goal's rules are one
table in `src/lib/good-days/goals.ts`.

What a day is read from (`src/lib/good-days/find.ts`):

- the Moon's phase and sign at local noon (`@zodiacs/engine`);
- the void-of-course Moon over the waking hours (08:00 to 20:00 local), under
  the same rule and to the same second as `/void-of-course-moon/`;
- Mercury, Venus and Mars retrograde, and their station days;
- eclipses from `src/data/eclipses.json` (the day itself and three days either
  side);
- the Moon's exact aspects that day to the planets the goal leans on, and to
  Mars and Saturn;
- optionally the person's own chart (`src/lib/good-days/personal.ts`): the
  Moon's sign against the natal Sun's, and exact contacts from Venus, Mars,
  Jupiter and Saturn to the natal Sun and Venus (and the Moon with a birth
  time).

No language model is called. Every sentence is pre-written in those two files.

## Where it runs

- Site: `/good-days/` (`src/islands/GoodDayFinder.tsx`) runs the finder in the
  browser. The site form takes a birth date only, never a time, place or name.
  Results show the ranked days with every reason, the days to avoid, the
  retrograde periods and eclipses, and a share card (the top three days) with
  Copy the link, Share and Print. The link is
  `/good-days/#g=<goal>&f=<from>&t=<to>`: the goal and dates after the #, never
  a birth date or a name; opening it runs the general reading for those dates.
  The page is on the tools hub ("Through the year", with its own icon) and is
  linked from `/occasions/` and `/void-of-course-moon/`.
- Layout shift: results fill a slot that reserves a full screen of height from
  the click, or from first paint for a shared link (a head script sets
  `gd-shared` before paint), so nothing on screen moves.
  `npm run test:good-days:browser` (after `npm run build`) checks zero CLS on
  first load, on submit and on a shared link at 360px and 1280px, the privacy
  rules in a real browser, and the links to the page; `--screenshots` writes
  `docs/platform/zodiacs-ai/evidence/good-days/`.
- MCP: `find_good_days` on `zodiacs.org/mcp`, offered only while
  `ZODIACS_GOOD_DAYS_ENABLED=1` joins `ZODIACS_OCCASIONS_ENABLED=1` and
  `ZODIACS_COVERAGE_ENABLED=1`. It comes last in `tools/list`, after
  `search_sky_events` when that switch is on too. Off, every reply is byte for
  byte what main answers (`src/ai-tools/good-days.test.ts` against
  `accounts/flag-off.fixture.json`); the thirteen published definitions keep
  their bytes either way. While on, the server instructions gain one sentence
  (`GOOD_DAYS_INSTRUCTION`) and `get_capabilities` one privacy and one
  limitation sentence.

## Privacy and safety

- A birth date (with an optional time and birthplace zone on the MCP tool) is
  used for that one request: never stored, logged, counted, returned or put in
  a link. The answer carries only the natal Sun sign.
- A birth date less than 13 years ago, or still to come, gets the fixed
  under-13 refusal before anything is worked out (the hosted
  `childBirthDateRefusal`, and the finder itself on the site).
- Relationship and wedding readings are refused for a birth date under 18.
- Copy follows the owner's rule of 9 November 2026: money, career, wellbeing
  and legal themes are read as astrology traditionally reads them ("a good
  window to sign contracts"), with no mandatory "for reflection" note. It
  never makes a price, stock or crypto call or a buy or sell signal, never
  diagnoses or times anything medical, never predicts a death and never says
  who will win or lose a legal matter. There is no procedure goal: medical
  timing is ruled out, and a goal that asks for it (`procedure`, `surgery`,
  `medical procedure` and the like, `MEDICAL_GOAL_WORDS`) gets the fixed
  `NO_MEDICAL_TIMING` sentence rather than the list of goals.

## Decisions (9 November 2026, delegated by the owner)

- **Procedure goal: dropped.** Medical timing is ruled out, and a "not
  medical" goal would still be the nearest match for a medical request, as the
  baby occasion was for a child's birthday; a medical goal now gets a fixed
  sentence instead.
- **Share image: its own card**, `public/assets/og/good-days/v1/card.jpg`
  (`npm run data:og -- --only-good-days-card`), drawn like the v8 art cards
  (the lockup, the display serif, the pastel discs, the art cards' byte
  budget) in its own folder, as Your 2027 sky's card is, so the published v8
  family keeps its bytes; `verify-og-cards` checks it.
- **Browser drive: in CI**, as a step of `site-check.yml` after the events
  drive, so zero CLS and the page's privacy rules are held on every PR.
- **Dates past 2030: not yet.** The window stays inside the eclipse table
  (2026 to 2030) and says so; the bound follows the table, so it moves forward
  when the table is refreshed with sky.json, and nothing is read from years
  the eclipse data does not cover.

## Release steps (owner)

1. Review this draft PR and the copy in `goals.ts`.
2. Apply `supabase/migrations/20261109120000_zodiacs_mcp_usage_good_days.sql`
   so the anonymous daily counter accepts the name (until then counting it
   fails quietly; replies are never affected).
3. Set `ZODIACS_GOOD_DAYS_ENABLED=1` on preview first, then production, when
   the next plugin version is ready for review.

Recommended order: merge this PR with the switch off; apply the migration
(additive, logged in #879); switch preview on and check `tools/list`, one call
per goal and the under-13 refusal against the preview `/mcp`; then switch
production on in the same change that submits the next plugin version, so the
directories review the tool as it goes live. Both stay off in this PR.
