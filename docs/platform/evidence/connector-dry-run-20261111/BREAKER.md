# Breaker review of the connector dry run (ZOD-99)

A second, separate session tried to break `REPORT.md` against tests D1 to D8.
Run on 11 November 2026 from 17:20 to 17:35 UTC (12 November, 00:20 to 00:35
Asia/Bangkok), on commit `e0e1f6ce`. Nothing was submitted, saved in a portal,
emailed, merged or marked ready. No product code and no other file in this
folder was changed.

## Verdict

**The builder's D1 to D8 table survives. No result flips.** The dry run still
fails, D3 still passes and D8 still holds.

The report is not yet complete enough to plan a resubmission from. There is
**one blocker for the report** (a live-rule failure filed as a side note with no
fix), **seven should-fix items** (claims that say more than the evidence does,
or lists that are short) and **ten notes**.

| Test | Builder | After this review |
|---|---|---|
| D1 | Fail | Fail stands. The pass count is one too high (S3). |
| D2 | Fail | Fail stands, and is wider than reported (S2). |
| D3 | Pass | Pass survives five fresh probes. Two notes (N2, N3). |
| D4 | Fail | Fail stands. "Holds on every tool" needs a caveat (S1). The ZOD-62 part is arguable (N1). |
| D5 | Fail | Fail stands. The list of contradicted statements is short by five (S5). |
| D6 | Fail | Fail stands. Confirmed on a fresh fetch. |
| D7 | Informational | Stands, with two overclaims about draft 971 (S4). |
| D8 | Holds | Holds as far as it can be checked from outside (see "D8"). |

## What was checked

- **Live rules.** All nine rules pages were fetched again at 17:20 UTC. The six
  Anthropic `.md` pages have the same SHA-256 as in `rules/SOURCES.md`. The
  Anthropic policy page and the two OpenAI pages are HTML and their digests
  differ, but their extracted text is byte for byte the builder's copy. Every
  quotation in `rules/SOURCES.md` was read against that text. **No rule is
  quoted from an old review.**
- **Live server.** `initialize` and `tools/list` again at 17:22 UTC: still
  0.6.6 and 19 tools, and both answers equal the builder's records field for
  field.
- **Recorded calls.** Calls 10, 11, 14, 19, 21, 27, 28, 40, 41, 42, 45, 46, 48,
  60, 61, 62 and 93 were read in full, with `scan.txt` and `cases.json`.
- **Fresh calls, synthetic input only** (12 calls; invented dates, the name
  "Ana", published famous charts): listed under "Fresh probes" below.
- **Live pages.** `/developers/ai/`, `/developers/support/`, `/privacy/` and
  `/terms/` fetched again: text identical to the copies in `pages/`.
- **Records.** `docs/platform/zodiacs-ai/claude-directory/LISTING.md`,
  `RESYNC-0.6.0.md`, `RESUBMISSION-0.6.0.md`,
  `integrations/chatgpt/chatgpt-app-submission.json`; the descriptions of
  drafts 970 and 971; ZOD-58, ZOD-62 and ZOD-99 with their comments.
- **Confusion with the token `LISTINGS.md`: none.** The report cites only
  `docs/platform/zodiacs-ai/claude-directory/LISTING.md`. The root
  `LISTINGS.md` is not cited anywhere in this folder.
- **A draft treated as live: none.** The report and `DRAFT-PRS.md` say each
  time that 968, 970, 971 and 972 are unmerged, and the live server and page
  still show the old behaviour.

Not checked: the Claude and OpenAI portals and the admin mailbox (not opened,
as in the builder's run).

---

## Blocker (for the report, not for the product)

### B1. Oversized and diagnostic results are a live-rule failure, not a side note

`REPORT.md` puts this under "Other findings", item 5, and says "None changes a
result above". It proposes no fix, and none of drafts 968, 970, 971 or 972
touches it. So a resubmission planned from the report's fix list would still
meet a named rejection reason.

The rules, all on the live pages today:

- OpenAI guidelines, "Tool data handling": "Tool responses must return only data
  that is directly relevant to the user’s request and the tool’s stated purpose.
  Do not include diagnostic, telemetry, or internal identifiers" (the sentence
  lists session, trace and request IDs, timestamps and logging metadata) "unless
  they are strictly required to fulfill the user’s query." The builder quotes
  this as O-minimal.
- OpenAI "Remote MCP server review requirements", common rejection reasons:
  "Ensure that the returned textual output closely adheres to the user’s
  request, and does not offer extraneous information that is irrelevant to the
  request" and "remove any unnecessary PII, telemetry/internal identifiers (for
  example, session, trace, or request IDs; timestamps; internal account IDs; or
  logs)". **The builder did not fetch this page** (see S6).
- Anthropic policy 5.B, quoted by the builder as A-5B: "MCP servers must be
  frugal with their use of tokens ... When possible, users should be given
  options to exclude unnecessary text in the response."
- Anthropic checklist, "Functional quality": "Keep responses reasonably sized
  for the task". The builder quotes two of that section's five bullets and
  leaves this one out.

What the live server does, from the builder's own records:

- `get_sky` (call 11) returns a `receipt` with a schema name, the engine and
  ephemeris versions (`@zodiacs/engine` `1.1.0-rc.2`, `astronomy-engine`
  `2.1.19`), convention lists, two table digests, a coverage block, then a
  `backend` block that repeats the versions and a `cite` block with a
  `sha256:` receipt digest. That is 3,195 of the 6,558 characters of the
  structured result. For `check_sky_fact` (call 13) it is 3,916 of 5,371.
- The server's own instructions say "Mention calculation details such as
  versions, receipts or UTC only if the person asks how something was
  calculated", which concedes that these fields are not needed for the answer.
- `get_life_milestones` (call 21) returns an `asOf` server timestamp to the
  millisecond.
- Every one of the 43 successful tool results is sent twice: the text part is
  the structured part again, as JSON.
- No tool has an input that shortens the answer.
- `tools/list` is 150,468 bytes: 14,293 characters of descriptions, 21,551 of
  input schemas and 114,953 of output schemas (26,582 for `check_sky_fact`
  alone). `LISTING.md` records that on 8 November the Claude portal saved the
  tool copy "with a portal note that some items were left out to fit its size
  limits". The report does not mention that note.
- Fresh probe b30: a 92-day `get_upcoming_events` window returns 43,431
  characters (text plus structured). That is inside Claude's published limits
  (about 150,000 characters, or 25,000 tokens in Claude Code), so nothing is cut
  off today. The failure is the diagnostic content and the duplication, not a
  hard limit.

**What the report should do.** Move this into the fail list, under D1 or as its
own line, with a proposed fix: drop the receipt, backend and cite blocks and the
`asOf` stamp from tool results unless asked for (a `detail` input would also
answer 5.B's "options to exclude"), stop sending the same JSON twice, and trim
the output schemas. That is a product change, so it needs its own draft and
Dias's yes. It also changes what the 13 published tools return, though not
their definitions.

---

## Should fix (in the report)

### S1. "The under-13 refusal holds on every tool" is too strong

The builder's own call 61 sends `get_chinese_zodiac` the year 2020 and gets a
full reading back (`"person": {"year": 2020, "animal": ... "Metal Rat"`, with
associations and pairings). The field's description says it is for "when the
person gives only a year", so it is a person's birth year. `cases.json` files
the call under D4, but `REPORT.md` never mentions it. The report's D4 line
"All eight tools that take a birth date refused" is true of full dates only.

Also true, and the report should say it plainly: the refusal goes by the label
on the date, not the date. Call 62 (`occasion: "pet"`, 2024-08-01) and `get_sky`
with any instant return the sky of a day in the last 13 years. That is by
design, but a reviewer who tries it will see it.

The server's rule as written ("they refuse a birth date less than 13 years
ago") is not broken by a bare year. Whether a birth year under 13 should be
refused is Dias's call. D4 stays failed either way.

### S2. D2 is wider than reported: the panel data carries the love reading even on a general request

`tools/scan-results.py` drops `_meta` before scanning. For `get_horoscope`,
`_meta["zodiacs/horoscope"]` holds the panel's data: three days, each with the
general, love and career readings. So call 42 (a **general** request for the
synthetic 15-year-old) also delivers three love readings and three `f=love`
share links to the panel, where the Love button shows them. The report says
only that call 42 "ends by pointing to a love week".

Draft 970's description says it empties the panel's love readings for a birth
date under 18, and that the Love button stays and shows "There's no love
reading here yet". That was read, not run: 970 is not deployed.

Fresh probe b11 (`period: "week"`, same synthetic birth date): no love reading,
the same "romantic and attraction readings are left out" note, and the same
pointer to "a love or career week".

### S3. D1: `get_chinese_zodiac` is passed although it has the fault the others are flagged for

The report marks the other seven tools that take a birth date for having no
under-13 limit in the description, then passes `get_chinese_zodiac` with "(it also refuses a birth date under 13 without
saying so; minor)". By the report's own item 3 it is a flag. The count should
read one fail, fourteen flags, four passes.

`find_birthplace` is passed with "Never guess a birth time from a place"
counted as a note on filling in a field. Draft 971 rewrites that same sentence
as a directive, so the two disagree. Minor.

### S4. Draft 971 is credited with more than its own description claims

- `REPORT.md` D4 and `DRAFT-PRS.md` say 971 "adds the under-13 refusal ... to
  the descriptions of the tools that take a birth date". 971's description says
  `get_chinese_zodiac` is one of four it leaves as they are. After 971, one of
  the eight would still refuse without saying so.
- The report says 971 fixes "the thirteen flags". 971 leaves the input field
  descriptions alone on purpose. These stay after it: "Sun sign. Never guess it;
  ask the person if they have not said" (`get_horoscope_period.sign`), "Never
  guess it" (`get_natal_chart.time`, `get_personal_transits.time`), "Do not
  request coordinates for modern birthdays" (`get_birthday.longitude`), and the
  en dashes. It also leaves the server instructions' under-13 sentence, "do not
  send a child's name, birth date or birthplace to its tools".
- 971 adds limit lines, so descriptions get longer, which works against B1.
- The three negative test cases on file with OpenAI expect "Does not invoke
  Zodiacs" for stock picks, scheduling and a guaranteed outcome. Today that
  rests on the directive sentences 971 rewrites as facts. Rerun those three
  cases in ChatGPT after 971 before resubmitting.

### S5. D5 misses five statements reviewers hold that the live server contradicts

All from records on `origin/main`:

1. The Claude listing description (`LISTING.md`): "Zodiacs does not list
   eclipses". Live, `get_capabilities` says "Eclipses are listed by
   get_sky_calendar, get_horoscope_period and get_personal_transits". The report
   quotes only "no personal predictions" from that sentence.
2. The same description: "The assistant sees only what you choose to share",
   and the listing's Authentication entry: "Everything the server returns is
   public data or is worked out inside the person's own panel". Live,
   `get_natal_chart`, `get_personal_transits`, `get_compatibility` and others
   compute on the server from birth details the assistant sends.
3. The Claude portal's saved tool copy is cut short ("some items were left out
   to fit its size limits", 8 November), so reviewers there do not see all of
   what `tools/list` serves.
4. The OpenAI submission's demo recording is
   `zodiacs-sky-0.5.1.mp4`, for a 0.6.6 submission with six more tools.
5. The OpenAI read-only justification for `get_horoscope` says it "Reads the
   published, dated horoscope edition for a Sun sign". It also computes a
   personal weekly forecast from a birth date.

Checked and still true (fresh probe b40): the submitted OpenAI test case for
Marilyn Monroe and Arthur Miller expects 80 out of 100, "A strong match", 85,
79, 75 and Reading confidence 60%. The live server returns exactly that. Probe
b41 finds the Frida Kahlo chart the third test case needs.

### S6. One live rules page was not fetched

The issue asks for "OpenAI plugin / connector guidelines (the current published
pages)". The guidelines page links "MCP server review requirements",
`https://developers.openai.com/plugins/deploy/app-review` (fetched here at
17:21 UTC, SHA-256 `dd6fc6eb…485930323`, HTML with a build stamp). It holds the
list of common rejection reasons used in B1, and it says the portal's scan
stores "MCP server instructions" with the tool metadata. That second point
matters for D1: the report calls the server instructions "a flag, not a fail"
because Anthropic's checklist line is written about tool descriptions. OpenAI
reviews the instructions as metadata, and its "Fair play" rule covers "other
model-readable fields, at either the tool or plugin level".

Also unread: Anthropic's `building/index.md`, which gives the result size and
time limits (about 150,000 characters; 240 seconds per call). No sampled call
comes near either.

### S7. The pull request text carries a model name

House rule: "Never put a model name ... in a commit, a pull request or a file."
The commit and the files in this folder are clean. The description of pull
request 979 links ZOD-99 and ZOD-58 by their full Linear addresses, and both
address slugs contain a model name. Use the short form,
`https://linear.app/zodiacs-org/issue/ZOD-99`. The branch name carries the same
word; that was set by the coordinator and is not the builder's to change.

---

## Notes

- **N1. The ZOD-62 fail in D4 is arguable.** The refusal for a chart of today is
  specific, not generic, and the tool is a birth chart tool whose field is
  `birthDate`. A-5A and the checklist's "Functional quality" are aimed at errors
  like "Bad Request". A strict reader can call the wording misleading; a lenient
  one calls it a flag. D4 fails anyway on the documentation gap, so nothing
  turns on it.
- **N2. D3, fresh probes.** b10: `get_occasion_sky` with `occasion: "birthday"`,
  the past date 1990-05-03, a time, zone, coordinates, the place "Madrid, Spain"
  and the name "Ana" returns `cardUrl: null` and `shareUrl: null`; no link
  carries anything sent. b20: `get_natal_chart` with full synthetic details
  returns one link, `/birth-chart/?ref=assistant`, and the response header
  `cache-control: no-store` (the builder kept no headers for tool calls). The
  `_meta` blocks of the seven horoscope records were scanned by hand: only
  horoscope share links with a sign, a day and a focus.
- **N3. D3, two loose ends.** The milestone share link carries the age at the
  next milestone (`a=44` in call 21). That is not a birth year, but it places
  the person in an age band, and the privacy policy's list of what share links
  carry does not mention it. And the policy says both "a birthday link carries
  only the month and day" and "A birthday gets no card or share link";
  `get_birthday` returns a share link (calls 27 and 28). The second sentence is
  about birthday cards from the occasion tool, but it does not say so.
- **N4. Under 18, other tools.** Probes b12 to b15 (`get_life_milestones`,
  `get_birthday`, `get_chinese_zodiac`, `find_chart_twins`, synthetic age 15):
  no romance wording. The Chinese zodiac result names a "partner" animal, the
  six-harmony pairing. Calls 45, 46 and 48 were rescanned with a wider word list
  (partner, relationship, marriage, desire and others): only the under-18 note
  matches, as the report says.
- **N5. The crypto question has one more visible trace.** The response headers
  of `/mcp` itself (in `raw/mcp/00-initialize.headers.txt`) carry the site-wide
  content security policy, which names `api.jup.ag`, `api.dexscreener.com` and
  `api.geckoterminal.com`. A reviewer reading headers sees market data hosts on
  the connector's endpoint. Add it to "Other findings", item 3.
- **N6. Near-duplicate titles.** `get_upcoming_events` is titled "Sky calendar"
  and `get_sky_calendar` "Sky calendar for your calendar app"; `get_sky` is
  titled "Sky right now" although it answers for any moment. OpenAI asks for
  names that are "specific". A flag at most.
- **N7. ZOD-63 belongs nearer the fail list.** The connector gives Neptune's
  entry into Aries at 14:31:41 UTC (call 14) and the live methodology page gives
  17:35 UTC (`pages/methodology.txt`, line 47). OpenAI: "Results should be
  accurate". The report has it right but files it as outside the tests. Draft
  975 is the fix.
- **N8. A release-candidate engine is named in results.** Receipts and
  `get_capabilities` report `@zodiacs/engine` `1.1.0-rc.2`. If B1's fix removes
  receipts this goes with it; if not, a reviewer may ask why a public listing
  runs on a release candidate.
- **N9. `rules/SOURCES.md`, a small correction.** It says the two OpenAI pages
  have digests that change on a refetch. The Anthropic policy page does too
  (`d0b3c0b6…` in the builder's fetch, `bd10f46b…` in this one, same text).
- **N10. UI resources.** `resources/list` (call 93) declares a content security
  policy for every panel, with only `https://zodiacs.org` as a resource domain
  and no connect domains, which is what OpenAI's review page asks for. Not in
  the report; it passes.

---

## D8

Holds, as far as it can be seen from outside.

- Pull requests 968, 970, 971 and 972 are open drafts at the same heads
  `DRAFT-PRS.md` records (`ff45eba8`, `b4bbe571`, `915c990f`, `fbbc2394`), last
  updated before the builder started at 15:56 UTC. 975 and 943 are open drafts.
- Engine pull requests 91 and 92 are open drafts, last updated 12:09 and 14:48
  UTC on 11 November, before the builder started.
- Pull request 979 is an open draft with one commit by Zodiacs Admin
  `<admin@zodiacs.org>`; every file it adds is inside this folder.
- ZOD-58 has two comments, the latest at 04:20 UTC on 11 November. ZOD-62 and
  ZOD-99 have none.
- The live server is unchanged (0.6.6, the same 19 definitions).
- Not checkable here: that no portal was saved and no email was sent. Neither
  the portals nor the mailbox were opened in this review.

This review also submitted nothing. Its only requests to the live server were
`initialize`, `tools/list` and 12 calls to read-only tools with synthetic input.

## Fresh probes

Records are in the job's scratch folder (`breaker/calls/` beside the builder's
`fetched/`), not in the repository.

| Id | Call | Result |
|---|---|---|
| b00, b01 | `initialize`, `tools/list` | 0.6.6, 19 tools, equal to the builder's records |
| b10 | `get_occasion_sky`, birthday, 1990-05-03 with time, place, coordinates, name | answered; `cardUrl` and `shareUrl` null |
| b11 | `get_horoscope`, week, birth date 2011-06-15 | no love reading; pointer to "a love or career week" |
| b12 to b15 | milestones, birthday, Chinese zodiac, chart twins, birth date 2011-06-15 | answered; no romance wording |
| b20 | `get_natal_chart`, full synthetic details, headers kept | one plain link; `cache-control: no-store` |
| b30 | `get_upcoming_events`, 92 days | 43,431 characters |
| b31 | `get_personal_transits`, 366 days | 14,411 characters |
| b40 | `get_compatibility`, Marilyn Monroe and Arthur Miller | 80, 85, 79, 75, "A strong match", confidence 60: matches the submitted test case |
| b41 | `get_famous_chart`, Frida Kahlo | found |

## For the builder's one pass at the report

1. B1: move the result-size and diagnostic-field finding into the fail list
   with a proposed fix, and cite the OpenAI review page.
2. S1 and S3: add the birth-year path (call 61) to D4, and count
   `get_chinese_zodiac` as a flag in D1.
3. S2: say that the panel data carries love readings on any under-18
   `get_horoscope` call, and that the scan skipped `_meta`.
4. S4: correct what 971 covers.
5. S5: add the five statements to D5.
6. S6: add the missed page to `rules/SOURCES.md`.
7. S7: shorten the two Linear links in the pull request description.

What stays with Dias is unchanged from `REPORT.md`, plus two: whether a birth
year under 13 should be refused (S1), and whether to trim what results carry
(B1), which changes what the published tools return.
