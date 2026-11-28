# Connector directory dry run, 11 November 2026 (ZOD-99)

A dry run of the Zodiacs connector against the directories' rules as they are
published today and against the live server at `https://zodiacs.org/mcp`, read as
a strict reviewer would. Parent issue: ZOD-58.

**Result: the dry run fails. D1, D2, D4, D5 and D6 fail; D3 passes; D8 holds.** One
more live-rule failure sits outside the six tests as written and is listed with them:
results carry more than the answer (R1).
Nothing was submitted, saved in a portal, emailed, merged or marked ready. No
product code or tool description was changed; each fix below is a proposal.

| Test | Result | In one line |
|---|---|---|
| D1 Tool names and descriptions | **Fail** | Names pass. `get_horoscope` breaks a named rejection rule; 14 more descriptions are flagged (13 tell the assistant how to behave, and `get_chinese_zodiac` refuses under 13 without saying so); the age limits are missing from the descriptions of the tools that enforce them. |
| D2 Safety wording | **Fail** | `get_horoscope` still returns a love reading for a birth date under 18, and its panel data carries love readings even when the general reading was asked for. No betting, investment or health framing found. |
| D3 Privacy | Pass | No link in 76 recorded calls carries a birth date, year, time, place, coordinate or name that was sent. The live privacy policy supports the claim. |
| D4 Errors and age rules | **Fail** | The under-13 refusal holds for every full birth date and every birthday card; a bare birth year is answered. A chart for right now is refused with wording about a child (ZOD-62), and the refusal is not in the tool descriptions or the developer page. |
| D5 Earlier review notes | **Fail** | The live server matches the portal (0.6.6, 19 tools), but nine things reviewers hold are contradicted or out of date and none has been withdrawn. |
| D6 Developer and support pages | **Fail** | The live developer page describes about five tools, says there are no predictions, and has no limits, troubleshooting or support contact. |
| R1 Results carry more than the answer | **Fail** (outside D1 to D6 as written) | Sky results carry receipts, versions and digests, one result carries a server timestamp, every result is sent twice, and `tools/list` is 150 KB. No draft covers it. |
| D7 Draft fixes | Informational | 968, 970, 971 and 972 are open, unmerged drafts. Together they would fix most of D2, D6 and most of D1 and D5. They do not fix ZOD-62, R1 or the links inside results. |
| D8 Nothing submitted | Holds | See the end of this report. |

## What was checked, and how

- **Live server.** `initialize` and `tools/list` at 15:56 UTC on 11 November 2026:
  server `zodiacs`, version **0.6.6**, protocol 2025-06-18, **19 tools**, no
  sign-in. Records: `raw/mcp/00-initialize.*`, `raw/mcp/01-tools-list.*`.
- **Sampled calls.** 76 requests, synthetic input only (invented dates such as
  1990-05-03, the names "Ana" and "Ben", the published famous chart the tool's own
  description names). Every one of the 19 tools was called at least once with valid
  input, then under-18, under-13, "right now" and error cases. One file per call in
  `raw/mcp/calls/`, listed in `tools/cases.json`; `raw/mcp/scan.txt` lists every
  link and flagged word per call.
- **Live pages.** `/developers/ai/`, `/developers/mcp/`, `/developers/support/`,
  `/developers/`, `/privacy/`, `/terms/`, `/methodology/`, `/about/`: text copies and
  digests in `pages/`.
- **Live rules.** Fetched in this job, digests and the exact lines cited in
  `rules/SOURCES.md`. The labels below (A-2B, AC-inject, O-desc and so on) point
  there. A is Anthropic's Software Directory Policy, AC its connector checklist, AS
  its submission pages, O OpenAI's plugin guidelines, OR OpenAI's "Remote MCP server
  review requirements" (added in the fix round, fetched 13 November 2026).
- **Records.** `docs/platform/zodiacs-ai/` and `integrations/chatgpt/` on
  `origin/main` at `47fee79f`; ZOD-58 with its 10 and 11 November comments, ZOD-62,
  ZOD-63; draft pull requests 968, 970, 971, 972, 975 and 943 read with `gh`.

**Fix round, 13 November 2026.** A second session reviewed this report
(`BREAKER.md`): no result flipped, and it asked for one finding to move into the fail
list (now R1) and seven corrections. They are applied here from the calls already on
record; the only new fetch is the OpenAI review page. The link and word scan in
`raw/mcp/scan.txt` leaves out each result's `_meta` block; the horoscope results'
`_meta` was read by hand for D2 and D3.

**Not checked at source.** I had no access to the Claude or OpenAI portals or to the
admin mailbox. What reviewers were told (D5) is taken from the repository's records
and from draft 968's reading of them. "Never stored or logged" (D3) cannot be seen
from outside the server; it rests on the privacy policy and on the response headers.

---

## D1. Tool names and descriptions: fail

All 19 live tools were checked; the sentence-by-sentence listing is
`raw/mcp/descriptions-check.txt`.

**Names, titles and annotations pass.** Names are unique, plain, verb-first and 7 to
21 characters long (A-5C, O-names). Every tool has a `title` and explicit
`readOnlyHint: true`, `destructiveHint: false` and `openWorldHint: false` (A-5E,
AC-annot, O-annot). `check_sky_fact` links its API documentation.

**Descriptions fail, on three counts.**

1. **`get_horoscope` breaks a named rejection rule.** Its description says: "If you
   can schedule tasks for the person, offer once, briefly, to send them their
   horoscope every morning". That tells the assistant to use another tool the person
   did not ask for and to promote a recurring service (AC-inject, first and fifth
   items; A-2D; O-independent; O-intent). The same description also says "Decline
   those requests without a tool call", "Share the reading as written" and "Lead with
   those personal lines".
2. **Thirteen more descriptions tell the assistant how to behave** (a fourteenth,
   `get_chinese_zodiac`, is flagged under item 3 only), against the
   opening line of AC-inject ("Describe what the tool does, and don't tell Claude how
   to behave"). None of these is as clear a breach as item 1; a strict reviewer flags
   them, a lenient one may not.
3. **Limits are missing where they apply** (O-desc asks for "any relevant
   limitations"; A-2B and AC-desc ask the description to match behaviour). All eight
   tools that take a birth date refuse one less than 13 years old, and none of their
   descriptions says so. `get_compatibility` refuses when either birth date is under
   18 (calls 43, 44, 47) while its description offers it for "a partner, friend or
   family member" with no age limit. `get_horoscope`'s description lists "general,
   love or career" with no under-18 limit.

| # | Tool | Verdict | Wording at issue (live) |
|---|---|---|---|
| 1 | get_capabilities | Flag | "do not call it to check before turning those requests down" |
| 2 | get_sky | Pass | |
| 3 | get_upcoming_events | Pass | |
| 4 | check_sky_fact | Pass | |
| 5 | get_horoscope | **Fail** | the scheduling offer; "Decline those requests"; "Share the reading as written"; "Lead with those personal lines"; no under-18 or under-13 limit |
| 6 | open_chart_studio | Flag | "do not ask for birth details first" |
| 7 | get_occasion_sky | Flag | "share the rating and its reasons plainly"; "copy the returned cardUrl exactly ... do not reconstruct it"; "give them the returned shareUrl exactly"; no word that a birthday in the last 13 years is refused |
| 8 | get_life_milestones | Flag | "give them the returned shareUrl exactly"; no under-13 limit |
| 9 | get_compatibility | Flag | "lead with the score and verdict in plain words"; "Present it as astrology's reading"; "never make one up"; no under-18 or under-13 limit |
| 10 | find_chart_twins | Flag | "give them the returned shareUrl exactly"; no under-13 limit |
| 11 | get_famous_chart | Flag | "never make one up"; "give them the returned shareUrl exactly" |
| 12 | get_birthday | Flag | "do not request coordinates for modern birthdays"; "give them the returned shareUrl exactly"; no under-13 limit |
| 13 | get_sky_calendar | Flag | "give them the returned shareUrl exactly" |
| 14 | get_natal_chart | Flag | "tell the person"; "do not frame the chart as romance or attraction"; "give it as the page to open"; no under-13 limit |
| 15 | get_horoscope_period | Flag | "Share the forecast plainly and confidently"; "never write a reading yourself in its place"; "Do not call it for stock picks" |
| 16 | get_chinese_zodiac | Flag | no under-13 limit, although it refuses a full birth date under 13 (call 56); it answers a bare birth year (call 61, see D4) |
| 17 | get_personal_transits | Flag | "Present each line plainly and confidently as astrology's reading"; no under-13 limit |
| 18 | explain_astrology | Flag | "do not present an explainer of your own as Zodiacs'"; "give the friendship reading and do not frame the pair as romance or attraction" |
| 19 | find_birthplace | Pass | ("Never guess a birth time from a place" is counted as a note on filling in a field; draft 971 rewrites it as a fact all the same, so a stricter reader could flag it) |

One fail, fourteen flags, four passes. I counted as acceptable the sentences that
say when to use a tool or how to fill in a field ("Use it when someone asks ...",
"Pass the person's time zone if you know it"), because A-2A and O-desc ask for
exactly that.

**Server instructions** (the text every assistant reads first, in
`raw/mcp/00-initialize.response.txt`): most sentences are orders, among them "Answer
in plain words first" and "Share the scores, ratings and astrological forecasts
plainly and confidently". AC-inject is written about tool descriptions, so at
Anthropic this is a flag. At OpenAI it is inside the review: the portal's scan imports
"MCP server instructions" with the tool metadata (OR-scan), and the guidelines' fair
play rule covers "other model-readable fields, at either the tool or plugin level".
Treat the instructions as part of the D1 fail for the OpenAI directory.

**Fix.** Rewrite the descriptions and the server instructions as statements of what
each tool does, when to use it, what it returns and its limits; drop the scheduling
offer; put the under-13 refusal and the under-18 limits in the descriptions of the
tools that enforce them, `get_chinese_zodiac` included. Draft 971 does most of this
for 15 of the 19; what it leaves is listed under D7. Any such
change alters published definitions, so it needs Dias's approval.

## D2. Safety wording: fail

**Fail: a love reading for a birth date under 18.** The 10 November finding is still
live.

- Call `40-u18-get_horoscope-love-15` (`focus: "love"`, synthetic birth date
  2011-06-15, age 15) and call `41-u18-get_horoscope-love-17` (2009-06-15, age 17)
  both returned the full love reading: title "Gemini · Wednesday 11 November · Love",
  text including "Venus brings creativity, romance, children, and enjoyment into the
  relationship foreground", and a share link ending `f=love`.
- The same result's personal note says "This birth date is under 18, so romantic and
  attraction readings are left out", which is not true of the answer it sits in.
- Calls 40, 41 and 42 (a general reading for the same 15-year-old) end by pointing to
  "a love or career week, use get_horoscope_period".
- **The panel data carries love readings whatever was asked.** Each `get_horoscope`
  result has a `_meta["zodiacs/horoscope"]` block that feeds the horoscope panel:
  three days, each with the general, love and career readings. So call 42, a
  **general** request for the synthetic 15-year-old, also delivers three love readings
  and three share links ending `f=love` to the panel, where the Love button shows
  them. The first version of this report missed it because the scan leaves out
  `_meta`.

Rules: the server's own stated rule ("If a person or a birth date is under 18, do not
frame the reading as romance, attraction or a sexual relationship, and say that
Zodiacs does not give that framing for anyone under 18"), which the server itself
breaks; A-2B and O-desc, because the published text and the behaviour disagree;
O-appropriate, because the audience includes users aged 13 to 17. No directory rule
bans a love horoscope for a 16-year-old outright; the failure is that Zodiacs tells
reviewers it gives none and then gives one.

**Fix.** For a birth date under 18, return the general reading with a plain note in
place of a love reading, leave the love readings out of the panel data, and do not
point to a love week. Draft 970's description says it does all three (the panel's
Love button would stay and show "There's no love reading here yet"). That was read,
not run: 970 is not deployed.

**Two paths the server cannot check**, to tell reviewers plainly: `get_horoscope`
with `focus: "love"` and no birth date, and `get_horoscope_period` with
`focus: "love"` (it takes no birth date). There the rule rests on the assistant.
`explain_astrology` answers a Sun-sign pair as a romance reading unless the word
friendship is used, also with no age input.

**Passed.**

- Under 18 elsewhere: `get_compatibility` refuses when either birth date is under 18
  (calls 43, 44, 47); `get_natal_chart` and `get_personal_transits` return a reading
  with the note that romantic and attraction readings are left out, and the word scan
  finds no romance wording in them apart from that note (calls 45, 46, 48).
- Betting, investment, health: no such framing in the 19 descriptions or the server
  instructions (they state these as limits), and none in the sampled results. The
  word scan's hits are disclaimers ("not a forecast of health or money") or areas of
  life named by a horoscope ("daily work, health routines, and responsibilities").
- One borderline line for Dias to know about, not a fail: the 2026 yearly reading for
  Leo (call 33) says "Mark March 3, 2026 for a review of your money, possessions, and
  priorities". It names a house topic and a date, not an investment or a trade.

## D3. Privacy: pass

- **Links.** `tools/scan-results.py` compared every link in all 76 results with every
  birth date, birth year, time, place name, coordinate and name sent in that request.
  No link carries any of them. The scan's eight matches are all the documented
  cases: a wedding card link carries the wedding's day, time, zone and rounded
  coordinates (call 19, as the privacy policy says); an occasion share link carries
  the day and the rating; a birthday share link carries the month and day only (call
  27); famous-chart links name the published person. The names "Ana" and "Ben" and
  the place "Madrid, Spain" sent to `get_compatibility`, `get_occasion_sky` and
  `get_natal_chart` appear in no link (calls 19, 22, 30).
- **Policy.** The live privacy policy (last updated 7 November 2026, `pages/privacy.txt`,
  section "AI integration candidates") says the tools "calculate from them for that
  answer and save none of it. Zodiacs never stores or logs birth details. Links never
  carry a birth year, a birth time, a birthplace or the names you give; a birthday
  link carries only the month and day", names the host's 30-day request logs, and
  says the site "is not directed at children under 13" (A-3A, O-privacy).
- **Headers.** The recorded `initialize` and `tools/list` answers carry
  `cache-control: no-store` (headers were not kept for the 76 calls).

Two notes, neither a fail. The section is still headed "AI integration candidates"
although its last sentence says the server is live. And the claim "never stored or
logged" was not verified from inside the server in this job.

## D4. Errors and age rules: fail

**Under-13 refusal: holds for a full birth date and a birthday card.** All eight
tools that take a birth date refused the synthetic date 2016-02-02 (calls 50 to 57),
as did a birthday card for 2020-05-03 (call 60). The boundary is right: 2013-11-13 is refused, 2013-11-09 is answered
(calls 58, 59). The message is the same each time and is clear: "Zodiacs is not
directed at children under 13, so it makes no card, chart or reading from a birth
date less than 13 years ago, or a birthday card for a day in those years. ..."

**Two paths it does not cover, both by design, both visible to a reviewer.**

- **A bare birth year.** `get_chinese_zodiac` with `year: 2020` and no birth date
  returns a full reading (call 61: "Metal Rat", associations and pairings). The
  field is described as for "when the person gives only a year", so it can be a
  seven-year-old's birth year. The server's rule as written ("they refuse a birth
  date less than 13 years ago") is not broken by a year. Whether a birth year under
  13 should be refused is an open call for Dias; this report does not decide it.
- **The refusal goes by the label on the date, not the date.** `get_occasion_sky`
  with `occasion: "pet"` and 2024-08-01 (call 62), and `get_sky` with any instant
  (call 67), return the sky of a day in the last 13 years. A reviewer who relabels a
  child's birth date gets an answer, without a chart or a reading of a person.

**Error messages: clear, with four small notes.** An impossible date, a time without
a zone, a missing field, a bad sign, a window over 92 days, a year out of range, an
unknown zone and a window before the birth date each get a sentence that names the
problem (calls 70 to 84). Not-found cases answer normally and say so: `found: false` for an unknown famous
person or topic (calls 26, 38, 79), "No town or city matches. Try another spelling"
for an unknown place (call 78). Malformed JSON gets HTTP 400 with "Parse error: the body is not
valid JSON" (call 91). The notes, against A-5A and AC-quality:

- an unknown tool name gets "The MCP request does not match a supported operation or
  schema", which does not say the tool is unknown (call 74);
- an unknown argument gets a message that does not name the argument (call 75);
- an out-of-range `instant` is reported as `instants[0]`, a field the tool does not
  have (call 77);
- a GET gets HTTP 405 with "Zodiacs could not accept this request" (call 92).

**Fail: a chart for right now (ZOD-62).** Asking `get_natal_chart` for today
(2026-11-11 22:00 Asia/Bangkok, call 65) or for a recent moment (2020-01-01, call
66), and `get_personal_transits` for today (call 68), is refused with the under-13
sentence above. For someone asking about a moment, not a person, that message is
misleading: it speaks of a child, tells them to "give their own birth date", and
does not say that `get_sky` gives the sky for any moment (call 67 shows it does,
without houses or a rising sign). Rules: A-5A ("helpful feedback"), AC-quality
("actionable error messages"), O-quality ("clear messaging or fallback behaviors").
ZOD-62 is confirmed as written. The second session called this part arguable: the
refusal is specific, not generic, and the field is named `birthDate`; a lenient
reader calls it a flag. D4 fails either way on the documentation gap below.

**Fail: the refusal is not documented where a reviewer looks.** The under-13 rule is
in the server instructions, in `get_capabilities` and on the privacy page. It is in
none of the eight tool descriptions and not on the live developer page (D1 item 3,
D6). Draft 971 would add it to seven of the eight; `get_chinese_zodiac` is one of
the four descriptions it leaves alone.

**Fix.** Keep the under-13 refusal exactly as it is for births. For ZOD-62, the
smallest change is to the refusal text: add one sentence saying that for the sky at
a moment, not a person's birth, `get_sky` gives the positions. A separate "chart for
a moment" call that takes no birth details is the larger change ZOD-62 proposes; it
is a new tool, so it needs Dias's decision and a new review. Add the under-13 line
to the descriptions (draft 971, which still needs `get_chinese_zodiac` added) and to
the developer page (draft 972). No open draft changes the "right now" refusal or the
birth-year path.

## D5. Earlier review notes: fail

Live today: version **0.6.6**, **19 tools**, no name in any link (D3).

| What reviewers hold (from the repository's records) | Against the live server | State |
|---|---|---|
| Claude portal, reviewer notes saved 8 November: 0.6.6, 19 tools, links never carry names | Matches | Current |
| OpenAI portal: Zodiacs 0.6.6 submitted 7 November | Matches | Current |
| Email of 7 November on ticket #145701231: names 0.6.5 | Server reports 0.6.6 | Stale; no email names 0.6.6 or the under-13 refusal of 8 November |
| Email of 6 November: the thirteen reviewed tools are unchanged | 0.6.5 changed `get_occasion_sky` the next day | Contradicted (the 7 November note says so) |
| Email of 15 October, 18:01 UTC: "share links carry only first names, signs, scores and an occasion's date and place" | No link carries a name (calls 19 and 22 sent names; none came back in a link) | **Contradicted and never withdrawn** |
| The directory description on file, which `LISTING.md` says "still says Zodiacs makes no personal predictions" | Server instructions: "Share the scores, ratings and astrological forecasts plainly and confidently" | **Contradicted; not resubmitted** |
| The same Claude listing description: "Zodiacs does not list eclipses" | `get_capabilities` (call 10): "Eclipses are listed by get_sky_calendar, get_horoscope_period and get_personal_transits (year-ahead)" | **Contradicted; not resubmitted** |
| The same description, "The assistant sees only what you choose to share", and the listing's authentication entry, "Everything the server returns is public data or is worked out inside the person's own panel" | `get_natal_chart`, `get_personal_transits`, `get_compatibility` and others compute on the server from birth details the assistant sends (calls 22, 30, 35) | **Contradicted; not resubmitted** |
| The Claude portal's saved copy of the tools, 8 November, "with a portal note that some items were left out to fit its size limits" (`LISTING.md`) | `tools/list` is 150,468 bytes | Incomplete: reviewers there do not see all of what the server lists (see R1) |
| OpenAI submission: demo recording `zodiacs-sky-0.5.1.mp4` (`plugins/zodiacs-sky/plugin.json`) | The submission is 0.6.6 with six tools the 0.5.1 recording cannot show | Out of date |
| OpenAI read-only justification for `get_horoscope`: "Reads the published, dated horoscope edition for a Sun sign; nothing is stored." (`integrations/chatgpt/chatgpt-app-submission.json`) | It also computes a personal weekly forecast from a birth date (calls 17, 40 to 42) | Incomplete |

So a reviewer who reads the email thread sees 0.6.5 and first names in links, and a
reviewer who reads the listing description sees "no personal predictions", "does not
list eclipses" and "sees only what you choose to share" beside a server that gives
forecasts, lists eclipses and computes charts from birth details it is sent. One
thing on file was checked and still holds: the second session ran the submitted
OpenAI test case for two published famous charts and the live server returned
exactly the expected scores (`BREAKER.md`, probe b40). The test fails when such a statement stands and the dry
run does not say so. This report says so; the statements still stand, so I mark the
test failed for the purpose of resubmitting, not passed on a technicality.

Also out of date, and visible to anyone reading the repository:
`integrations/chatgpt/README.md` still says card links "carry those details after
the `#`"; `get_capabilities` lists 13 tools in its `tools` field and explains the
other six in prose; the live terms say nothing on the site "should be treated as a
prediction of future events" while the connector is told to share forecasts
"plainly and confidently".

**Fix.** One note to each directory that states the current behaviour once and
withdraws the stale statements by date; a new listing description for the Claude
portal without the three contradicted sentences; a current demo recording and a
corrected `get_horoscope` justification for OpenAI; and a tool copy in the Claude
portal that is not cut short, which depends on R1 (A-3H requires telling Anthropic of material
changes). Draft 968 holds such a note, marked not sent, and corrects the records; it covers
the four email and version statements, not the five added in the fix round.
Send it only after the description and under-18 changes are live, with the version
the server then reports: draft 971 now moves the server to 0.6.7, so the 0.6.6 in
968's note and records would be wrong on the day 971 merges. Sending anything is
Dias's call.

## D6. Developer and support pages: fail

The Claude listing's documentation address is `https://zodiacs.org/developers/ai/`
(`LISTING.md`). Live, at 15:57 UTC (`pages/developers-ai.txt`):

- **Tools.** No list of tools. The page describes positions at an instant, events in
  a 92-day window, fact checks, horoscopes and Chart Studio, about five of the 19.
  It says "The server offers no birth-chart storage, scheduling, eclipse search or
  predictions of personal outcomes", while `tools/list` has `get_natal_chart`,
  `get_personal_transits`, `get_compatibility` with a score, and three tools that
  include eclipses. It also says "Public directory listings remain release gates".
- **Limits.** Nothing on under 13, under 18, or betting, investment and health.
- **Troubleshooting.** None.
- **Support contact.** None on the page. It links to `/developers/support/`, which
  has no connector section, sends reports to GitHub issues and says "There is no
  published long-term support or response-time guarantee".
- **Examples.** Three prompts are there, so A-3E is met.

Rules: A-3B, A-3C, AS-docs, AC-docs, O-support. `admin@zodiacs.org` is on `/about/`
(the support address in the OpenAI package), `/privacy/` and `/terms/`, so a contact
exists, but not on the documentation page a reviewer is sent to.

One more thing a reviewer could trip on: `/developers/mcp/` documents a different,
local server with eight differently named tools (`calculate_natal_chart`,
`find_events` and others). It says it is local, but nothing on it points to the
hosted connector's page.

**Fix.** List all 19 tools, the limits, troubleshooting, example prompts and
`admin@zodiacs.org` on `/developers/ai/`, and add a connector section to
`/developers/support/`. Draft 972 does this.

## D7. The draft fixes (informational)

Details in `DRAFT-PRS.md`. All four are open drafts with green checks, and none is
merged or deployed: the live server and page still show the old behaviour (D2, D6).

| Draft | Would fix | Still needs Dias |
|---|---|---|
| 970, no love horoscope under 18 | The D2 fail, the panel data included by its own description (read, not run) | Whether the server reports a new version when it goes live. Merge first. |
| 971, descriptions describe the tool | The D1 `get_horoscope` fail and most of the flags in 15 descriptions and the server instructions; adds the age limits to seven of the eight birth-date tools. It leaves `get_chinese_zodiac`, every input field description ("Never guess it", "Do not request coordinates for modern birthdays", the en dashes) and the server instructions' under-13 sentence as they are, and it makes descriptions longer, which works against R1 | Approval to change 10 of the 13 published definitions (its text says this was given, with a bump to 0.6.7; I could not confirm that outside the pull request). Telling both directories. The sign-up and invite links in results, which it leaves in. Rerunning OpenAI's negative test cases after it: they expect "Does not invoke Zodiacs" for stock picks, scheduling and a guaranteed outcome, which today rests on the directive sentences 971 rewrites as facts. |
| 972, developer page | The D6 fail | The support address; merge after 970 so its under-18 line is true. |
| 968, listing and version records | The D5 record gaps; holds the reviewer note | Whether and when to send the note. Its 0.6.6 must become 0.6.7 if 971 merges. |

Not fixed by any of the four: R1 (what results carry), the "right now" refusal
wording (ZOD-62), the birth-year path, the five reviewer-held statements added to D5,
the small error messages, and the other findings below.

## D8. Nothing submitted or published

No portal was opened or saved. No email or message was sent. No pull request was
merged or marked ready. The branches of drafts 968, 970, 971 and 972, ZOD-65 with
engine pull request 92, and engine pull request 91 were not touched; the site drafts
were read with `gh pr view` and `gh pr diff` only. The only requests sent to the live
server were `initialize`, `tools/list`, `resources/list`, `prompts/list` and calls to
tools that all declare themselves read-only. This job's only changes are the files in
this directory.

---

## R1. Results carry more than the answer: fail

This was item 5 under "Other findings" in the first version, with no fix. It is a
named rejection reason on the live pages, so it belongs in the fail list. It is
outside D1 to D6 as the issue wrote them, which is why it has its own label.

**Rules.** O-minimal ("Do not include diagnostic, telemetry, or internal
identifiers" such as timestamps "unless they are strictly required"); OR-extraneous
and OR-audit, from OpenAI's list of common rejection reasons; A-5B ("frugal with
their use of tokens ... options to exclude unnecessary text"); AC-size ("Keep
responses reasonably sized for the task").

**What the live server does, from the recorded calls.**

- **Receipts, versions and digests.** `get_sky` (call 11) returns a `receipt` with a
  schema name, the engine and ephemeris versions (`@zodiacs/engine` `1.1.0-rc.2`,
  `astronomy-engine` `2.1.19`), convention lists, table digests and a coverage
  block, then a `backend` block that repeats the versions and a `cite` block with a
  `sha256:` receipt digest: 3,195 of the 6,558 characters of the structured result.
  For `check_sky_fact` (call 13) it is 3,916 of 5,371. The server's own instructions
  say "Mention calculation details such as versions, receipts or UTC only if the
  person asks how something was calculated", which concedes the answer does not need
  them. The engine named is a release candidate, which a reviewer may also ask about.
- **A server timestamp.** `get_life_milestones` (call 21) returns `asOf` to the
  millisecond.
- **Everything twice.** In all 44 successful tool results on record, the text part
  is the structured part again as JSON (the yearly horoscope, call 33, is about
  14,600 characters each way).
- **No way to ask for less.** No tool has an input that shortens its answer.
- **A 150 KB tool list.** `tools/list` is 150,468 bytes, about 115,000 of them
  output schemas. `LISTING.md` records that on 8 November the Claude portal saved its
  copy of the tools "with a portal note that some items were left out to fit its size
  limits".
- Nothing is cut off today: the second session's largest probe, a 92-day
  `get_upcoming_events` window, came to 43,431 characters, inside Claude's published
  limits. The failure is the diagnostic content and the duplication, not a hard limit.

**Proposed fix (not made here; a product change for Dias to approve).** Leave the
receipt, backend and cite blocks and the `asOf` stamp out of tool results unless
asked for, for example behind a `detail` input, which would also meet A-5B's
"options to exclude"; send each result once in full, with a short text summary in
place of the second JSON copy; and trim the output schemas so `tools/list` fits the
Claude portal's copy. This changes what the 13 published tools return, though not
their names or descriptions, and a `detail` input would change input schemas. It
needs its own draft and both directories told. **Whether to trim what results carry
is an open call for Dias; this report does not decide it.**

---

## Other findings a strict reviewer could raise

These are outside D1 to D6 as written and weaker than R1. None changes a result above.

1. **Sign-up and invite links inside results.** `get_horoscope` and
   `get_horoscope_period` results carry a link titled "The Leo horoscope by email
   each morning" (calls 15, 16, 17, 31, 32, 33, and even 81 and 82, where no reading
   was available); `get_compatibility` carries "Invite your partner to compare charts
   on Zodiacs" (call 22). Rules: O-intent ("Do not insert unrelated content, attempt
   to redirect the interaction"), A-4C. The connector is not "primarily" promotional,
   so this is a flag. No draft removes them; 971 lists them for Dias.
2. **Two times for one event (ZOD-63), still live.** `check_sky_fact` gives Neptune
   entering Aries at 2026-01-26 14:31:41 UTC (call 14); the live methodology page
   gives 17:35 UTC. O-quality asks for accurate results, so of the findings in this list it is the
   nearest to a fail. Draft 975 is the fix.
3. **The token wing.** A-4A: "We do not generally allow cryptocurrency software in
   our directory". The connector has no token tool, and none of the 76 results links
   to Astrofolio, the Registry or the Terminal. But every zodiacs.org page a result
   links to, the documentation page included, carries the footer line "Zodiacs.org
   also operates Astrofolio, the Zodiac token collection" and the Astrofolio link in
   the navigation (O-crypto is the nearest OpenAI rule). The response headers of `/mcp` itself
   (`raw/mcp/00-initialize.headers.txt`) also carry the site-wide content security
   policy, which names `api.jup.ag`, `api.dexscreener.com` and
   `api.geckoterminal.com`, so a reviewer reading headers sees market data hosts on
   the connector's endpoint. A reviewer may ask. Whether to say something first is
   Dias's call.
4. **Location fields.** O-location asks plugins to avoid "raw location fields (for
   example, city or coordinates)". Eight tools take a birthplace or venue as a place
   name, coordinates or a longitude. They are not the user's own location, and the
   records show OpenAI's scan has already held `get_occasion_sky` and
   `get_compatibility` for further review. Have a one-line reason ready.
5. **Dashes.** Input field descriptions in five tools write the year range 1800 to
   2199 with an en dash (`raw/mcp/descriptions-check.txt`). That is the house rule,
   not a directory rule; changing them changes published definitions.
6. **Share links and the privacy wording.** The milestone share link carries the age
   at the next milestone (`a=44` in call 21): not a birth year, but an age band the
   privacy policy's list of what links carry does not mention. And the policy says
   both "a birthday link carries only the month and day" and "A birthday gets no card
   or share link"; `get_birthday` returns a share link (calls 27, 28). The second
   sentence means birthday cards from the occasion tool but does not say so. D3 still
   passes: no link carries anything that was sent.
7. **Near-duplicate titles.** `get_upcoming_events` is titled "Sky calendar" and
   `get_sky_calendar` "Sky calendar for your calendar app"; `get_sky` is titled "Sky
   right now" though it answers for any moment (O-names asks for "specific").

## Open calls for Dias (not decided here)

1. Whether a bare birth year under 13 should be refused (`get_chinese_zodiac`, D4).
2. Whether to trim what results carry (R1), which changes what the published tools
   return.
3. Draft 971's change to published definitions and the 0.6.7 version, and whether
   `get_chinese_zodiac` and the input field descriptions join it.
4. Whether and when to send the reviewer note, replace the listing description and
   the demo recording, and rescan at OpenAI.
5. ZOD-62: one sentence in the refusal, or a separate tool for a chart of a moment.
6. The sign-up and invite links inside results.
7. Whether to tell reviewers about the token wing first.
