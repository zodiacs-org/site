# Claude directory: re-sync for Zodiacs 0.6.0 and 0.6.1

Prepared 2 November 2026 on branch `feat/mcp-consumer-coverage` for 0.6.0, and
brought up to date on 4 November 2026 for 0.6.1 (branch
`feat/readings-panel-0-6-1`). Nothing has been synced, uploaded or sent. Every
step below that touches production, the portal or email needs Dias's separate
yes.

## 0.6.5 update, 7 November 2026

0.6.5 changes one of the thirteen reviewed tools. `get_occasion_sky` no
longer offers the `baby` and `coming-of-age` occasions, after OpenAI's
review found that the baby occasion, with names, a place and coordinates,
could collect details about a child under 13
(`../RESUBMISSION-0.6.0.md`). Its description, its occasion field and the
occasion enum in its input and output schemas change; the other 18 tools
are unchanged, and the server reports 0.6.5. The 6 November reply to
mcp-review@anthropic.com (ticket #145701231) said the thirteen were
unchanged, so a short note goes to the same thread, once Dias says yes:

> A short update on the Zodiacs connector at https://zodiacs.org/mcp (slug
> zodiacs, ticket #145701231). Version 0.6.5 changes one tool,
> get_occasion_sky ("The sky on a day"): it no longer offers the baby's
> arrival and coming-of-age occasions, to keep children's details out of
> it. Its description, its occasion field and the occasion enum in its input
> and output schemas change, and a request for a removed occasion is
> refused. The other 18 tools are unchanged, and the connector stays
> read-only with no sign-in.

## What 0.6.1 changes

- **Version.** The hosted server reports 0.6.1 in `initialize` and in
  `get_capabilities`; the consumer package is `zodiacs-sky` 0.6.1.
- **Nineteen tools with both switches on.** `find_birthplace` (0.6.0 on `main`,
  4 November) follows the five 0.6.0 tools: it turns a town or city name into
  coordinates and a time zone from the GeoNames list bundled with Zodiacs. Its
  usage counter is `supabase/migrations/20261104103000_zodiacs_mcp_usage_birthplace.sql`.
- **The readings panel.** The five 0.6.0 tools open the inline panel
  `ui://zodiacs/readings-v3.html` (no sidebar launch; registered only while
  they are offered). `readings-v1` and `readings-v2` were staging builds and
  are recorded as retired in `src/ai-tools/panel-fingerprints.json`.
- **Forecast rule (4 November).** Forecasts are shared plainly and
  confidently, each with a label written exactly "Reading confidence NN%": 40
  for a Sun sign alone, 55 for a date without both a clock time and a place, 70
  for a date with both, and 5 more when a named contact's orb is under 1
  degree, never past 95 (`src/ai-tools/reading-confidence.ts`). An explainer
  carries no label.
- **Under 18.** Compatibility readings are for two adults: when either birth
  date is under 18, `get_compatibility` gives no reading (an `invalid-request`
  refusal that points to `explain_astrology`'s friendship reading of the two Sun
  signs), because the published panel shows an Attraction score on every
  result. The natal chart, transit and personal week readings leave romantic
  and attraction wording out.
- **Privacy.** Zodiacs never stores or logs birth details. Links never carry a
  birth year, time, place or names; a birthday link carries only the month and
  day. A birthday, a baby's arrival or a coming of age gets no card link and no
  share link, and a life milestone's share link carries its kind, ordinal and
  age only (older links with the pass dates still open, without them).
- **The thirteen tools are unchanged.** Their definitions, `_meta` included,
  still match the live snapshot byte for byte (`src/ai-tools/release-060.test.ts`).
  The server instructions and the `get_capabilities` text change.

The sections below are the 0.6.0 record, with the counts, checks and texts
brought up to 0.6.1.

## What changed

- **Version.** The hosted server reports 0.6.0 in `initialize` (`serverInfo`)
  and in `get_capabilities`.
- **Five new tools, behind their own switch.** They are offered only where
  `ZODIACS_COVERAGE_ENABLED=1` joins the existing `ZODIACS_OCCASIONS_ENABLED=1`.
  Until Dias sets the new variable, `https://zodiacs.org/mcp` lists exactly the
  thirteen tools now in review. The switch exists because both the Claude
  listing and the OpenAI app (0.5.1, In review per `PORTAL_REVIEW.md`, 28
  October) read the same live server: merging alone changes nothing they see.
- **The thirteen tools are unchanged.** Names, titles, descriptions, input
  schemas, output schemas, annotations, `_meta` and icons match the live
  `tools/list` of 1 November 2026 byte for byte
  (`docs/platform/zodiacs-ai/evidence/0.6.0/tools-list.live-2026-11-01.json`,
  held by `src/ai-tools/release-060.test.ts`). With the new switch off, every
  response in the flag-off fixture equals main's except the version string.
  `get_capabilities` keeps its published output schema, so its `tools` list
  still names the thirteen; the new tools appear in `tools/list` only.
- **No panel, resource or sign-in change.** The new tools answer in text and
  structured content. All are read-only, `openWorldHint: false`,
  `destructiveHint: false`, with `annotations.title`, and anonymous (`noauth`).
- **Privacy.** With the switch on, `/privacy/` names the birth chart, transit
  and Chinese zodiac tools among those that take dates for one answer and keep
  nothing. The usage counter's widening is a new migration,
  `supabase/migrations/20261101181545_zodiacs_mcp_usage_060_tools.sql`, not
  applied anywhere.

## The tool list after the switch (19)

| # | Tool | Title | Status | Takes personal details |
| --- | --- | --- | --- | --- |
| 1 | `get_capabilities` | What Zodiacs can do | unchanged | no |
| 2 | `get_sky` | Sky right now | unchanged | no |
| 3 | `get_upcoming_events` | Sky calendar | unchanged | no |
| 4 | `check_sky_fact` | Check a sky fact | unchanged | no |
| 5 | `get_horoscope` | Horoscopes | unchanged | optional birth date |
| 6 | `open_chart_studio` | Chart Studio | unchanged | in the panel only |
| 7 | `get_occasion_sky` | The sky on a day | unchanged | dates, optional place and names |
| 8 | `get_life_milestones` | Life milestones | unchanged | birth date |
| 9 | `get_compatibility` | Compare two charts | unchanged | two birth dates |
| 10 | `find_chart_twins` | Chart twins | unchanged | birth date |
| 11 | `get_famous_chart` | A famous birth chart | unchanged | no |
| 12 | `get_birthday` | Your birthday | unchanged | month and day, optional birth date |
| 13 | `get_sky_calendar` | Sky calendar for your calendar app | unchanged | no |
| 14 | `get_natal_chart` | Birth chart readout | new | birth date, optional time, zone, coordinates |
| 15 | `get_horoscope_period` | Monthly, yearly and weekly horoscopes | new | no |
| 16 | `get_chinese_zodiac` | Chinese zodiac | new | birth date or year |
| 17 | `get_personal_transits` | Your transits | new | birth date, optional time, zone, coordinates |
| 18 | `explain_astrology` | Astrology explained | new | no |
| 19 | `find_birthplace` | Find a birthplace | new on 4 November | a town or city name |

What the new ones do:

- `get_natal_chart`: Sun, Moon and rising signs, each planet's sign, degree and
  whole-sign house, the closest aspects and the element and mode balance, in
  the site's wording. Without a birth time it gives no rising sign or houses
  and, on a day the Moon changed sign, both possible Moon signs.
- `get_horoscope_period`: the published monthly reading (from the first of the
  month), the 2027 yearly reading and the current week's reading, with the
  week's love or career dailies, beside the period's sky in the sign's solar
  houses. When nothing is published it says so; it never writes a reading.
- `get_chinese_zodiac`: animal, element, yin or yang and the traditional
  pairings. A birth before that year's Lunar New Year belongs to the previous
  year (generated table, 1900 to 2101, checked against published dates).
- `get_personal_transits`: exact aspects from the planets to the natal chart
  for up to 366 days (30 by default), or the year ahead.
- `explain_astrology`: short explainers from the site's glossary with links to
  real pages; `found: false` for anything else, including tarot, numerology,
  horary and Vedic astrology.

## Before re-syncing, in order

1. **Merge** the pull request for this branch (Dias decides; agents only open
   drafts). Production redeploys with the switch off: still thirteen tools.
2. **Database.** In the Supabase SQL editor for production, run the whole of
   `supabase/migrations/20261101181545_zodiacs_mcp_usage_060_tools.sql`. It is
   safe to run twice and keeps existing rows. Until it is applied, counting the
   five new names fails quietly; replies are never delayed or failed by it.
3. **Staging (recommended).** On a deployment of `main` set deployment-only
   `ZODIACS_MCP_ENABLED=1`, `ZODIACS_MCP_STAGING_HOST=<alias>`,
   `ZODIACS_OCCASIONS_ENABLED=1` and `ZODIACS_COVERAGE_ENABLED=1`, as
   `LAUNCH.md` describes, then run
   `ZODIACS_STAGING_COVERAGE=1 ZODIACS_STAGING_MCP_URL=<alias>/mcp ZODIACS_STAGING_COOKIE_FILE=<file> node tests/ai-staging-drive.mjs`.
   It expects nineteen tools, calls each new one once and reads the readings
   panel.
4. **Production switch-on.** In Vercel (team `zodiacsofficial`, project
   `zodiacs-org`) add `ZODIACS_COVERAGE_ENABLED=1` for **Production** only and
   redeploy (the privacy page is prerendered, so it needs the rebuild). Roll
   back by removing the variable and redeploying.
5. **Check production** (no credentials needed):
   - `tools/list` at `https://zodiacs.org/mcp` lists 19 tools, the first
     thirteen as before. `node /workspace/repos/mcp051-tools/compare-tools.mjs`
     against the committed live snapshot will now report 19 versus 13; compare
     the first thirteen entries, as `release-060.test.ts` does.
   - `initialize` reports `0.6.1`, and `resources/list` includes
     `ui://zodiacs/readings-v3.html`.
   - `/privacy/` reads "Its occasion, compatibility, chart-twin, birthday,
     birth chart, transit and Chinese zodiac tools take the dates you give
     them".
   - One call to each new tool succeeds.

## Re-sync at claude.ai/directory/manage/zodiacs

From the Zodiacs-org account (admin@zodiacs.org, Pro), only after step 5. The
screen names below are the ones recorded in `LISTING.md` on 28 October.

1. Open https://claude.ai/directory/manage, choose the **Zodiacs** listing
   (slug `zodiacs`, status In review) and open the full editor.
2. In **Tools**, select **Sync from server**. Check that nineteen tools are
   listed, all marked read-only. If it still shows thirteen, the production
   switch or redeploy is missing; stop there.
3. **Description** (2,000 characters at most). The ChatGPT About is 2,529
   characters, so use this 1,620-character version:

   > Explore your birth chart, see how compatible you are with someone close to you, and read your horoscope. Zodiacs calculates the sky for the date and place you give, then tells you what astrology says about it.
   >
   > Build an interactive birth chart, or get a readout of your chart: Sun, Moon and rising signs, the planets in their signs and houses, the closest aspects and the balance of elements. Compare two charts and get a compatibility score out of 100 for attraction, communication and long-term stability, or compare with a famous person Zodiacs publishes.
   >
   > Read daily, weekly, monthly and yearly Sun-sign horoscopes, see your personal transits and the highlights of your year ahead, follow Moon phases and retrogrades, and subscribe to the sky calendar. Find your Chinese zodiac animal with the Lunar New Year boundary worked out, or ask what Mercury retrograde or the rising sign means.
   >
   > See the sky on your birthday and your solar return, find milestones such as your Saturn return, or make a keepsake card for a wedding or another day that matters, with a rating out of 100 for the date or the best-rated days in a month.
   >
   > Zodiacs gives clear forecasts, scores and ratings, each forecast with a reading confidence, and always shows the astrology behind them. It doesn't pick investments, make health predictions or guarantee how things will turn out. If a birth time or place is missing, it says what can still be worked out instead of guessing.
   >
   > No account is needed. Zodiacs never stores or logs birth details. Links never carry a birth year, time, place or names; a birthday link carries only the month and day.

4. **Additional notes for reviewers**: add

   > 0.6.1 offers six read-only tools beyond the thirteen in review, with no sign-in: get_natal_chart, get_horoscope_period, get_chinese_zodiac, get_personal_transits and explain_astrology, which open an inline readings panel with no sidebar launch, and find_birthplace, which turns a town or city name into coordinates and a time zone. The thirteen earlier tools are unchanged. Forecasts carry a label such as "Reading confidence 55%", which says how specific the details were, never the odds that something happens. Readings for anyone under 18 leave out romance and attraction. The natal chart, transit and Chinese zodiac tools use a birth date (and optional time, time zone and coordinates) for that answer only. Zodiacs never stores or logs birth details. Links never carry a birth year, time, place or names; a birthday link carries only the month and day. Try: "Read my birth chart: born 3 May 1990 at 8:30 in Madrid." / "What's the monthly horoscope for Leo?" / "What's my Chinese zodiac sign? I was born 20 January 1990." / "What transits are coming up for me? Born 3 May 1990." / "Are Leo and Scorpio compatible?"

5. Leave the one-liner, categories, carousel and the **Self-tested** box as
   they are, unless Dias has run all nineteen tools in Claude.
6. Save with **Save and update submission**. On 28 October the captured
   snapshot date did not change after a sync; record what the page shows and
   do not claim the snapshot was refreshed unless it says so.
7. Add a dated entry to `LISTING.md` with what was synced, saved and sent.

## Draft update note to mcp-review@anthropic.com

`LISTING.md` records that a correction of the 15 October note was already sent
that day at 18:01 UTC as a reply on ticket #145701231. This draft restates
that correction, in case a reviewer works from the first note, and announces
0.6.1. Send it only with Dias's yes, from admin@zodiacs.org, as a reply on the
same ticket, after the production switch-on.

> Subject: Re: Zodiacs connector (zodiacs.org/mcp): 0.6.1 tools and a correction
>
> Hello,
>
> An update on the Zodiacs connector at https://zodiacs.org/mcp, which is in review under the slug zodiacs.
>
> First, a correction that stands for this review. Our note of 15 October said that Zodiacs never chooses or ranks dates, scores relationships or predicts outcomes. That is not accurate for the live tools, and we corrected it the same day: get_compatibility gives a compatibility score out of 100 with scores for attraction, communication and long-term stability, and get_occasion_sky rates a date out of 100 and can list the three best-rated days in a range of up to 92 days. Every result gives its astrological reasons and presents itself as astrology's reading, not a guarantee. Zodiacs does not pick investments, make health predictions or guarantee outcomes.
>
> Second, version 0.6.1 is now live and offers six read-only tools beyond the thirteen, with no sign-in: get_natal_chart (a birth chart readout), get_horoscope_period (monthly, yearly and weekly horoscopes from our published readings), get_chinese_zodiac, get_personal_transits and explain_astrology (short explainers with links to our pages, including Sun-sign pairs), which open an inline readings panel with no sidebar launch, and find_birthplace (a town or city name to coordinates and a time zone, from a list bundled with Zodiacs). The thirteen earlier tools are unchanged; their definitions are byte for byte the ones you scanned. Forecasts now carry a reading-confidence label, which says how specific the details were, never the odds that something happens, and readings for anyone under 18 leave out romance and attraction. We have synced the tool list in the directory editor.
>
> Data handling: the natal chart, transit and Chinese zodiac tools use a birth date (and an optional time, time zone and coordinates) for that answer only. Zodiacs never stores or logs birth details. Links never carry a birth year, time, place or names; a birthday link carries only the month and day. Anonymous daily usage totals hold only the tool name, the day and the assistant family.
>
> Privacy policy: https://zodiacs.org/privacy/
> Documentation: https://zodiacs.org/developers/ai/
>
> Thank you,
> Zodiacs LLC
> admin@zodiacs.org

## Google Connected Apps

`docs/platform/zodiacs-ai/google-connected-apps/` does not exist on this
branch; it is on `feat/google-connected-apps` (local commit `9dfe7cdc` in
`/workspace/repos/site-google`, not pushed). Its live snapshot is the one this
branch copies into `evidence/0.6.0/`. When both branches are on `main` and the
switch is on, update that folder's `LISTING.md` tool list with the five rows
above and recapture its `tools-list` snapshot; its `schema-identity.txt`
whole-list comparison will then show 19 against 13, and only the first
thirteen entries should be held identical.
