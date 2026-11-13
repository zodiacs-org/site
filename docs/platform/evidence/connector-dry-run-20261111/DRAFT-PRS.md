# The draft fixes, as read on 11 November 2026

Read with `gh pr view` and `gh pr diff` only, at about 16:00 UTC. Nothing was pushed
to their branches, and none was merged or marked ready. They are proposals: the live
server (0.6.6) and the live developer page still behave as `REPORT.md` describes.

| Draft | Branch | Head when read | State | Checks |
|---|---|---|---|---|
| [968](https://github.com/zodiacs-org/site/pull/968) Listing and version records | `admin/zod-58-listing-version` | `ff45eba8` | open, draft, mergeable | 22 passed, 1 skipped |
| [970](https://github.com/zodiacs-org/site/pull/970) No love horoscope under 18 | `admin/zod-58-under18-love` | `b4bbe571` | open, draft, mergeable | 23 passed, 2 skipped |
| [971](https://github.com/zodiacs-org/site/pull/971) Descriptions describe the tool | `admin/zod-58-tool-descriptions` | `915c990f` | open, draft, mergeable | 23 passed, 2 skipped |
| [972](https://github.com/zodiacs-org/site/pull/972) Developer page | `admin/zod-58-developer-page` | `fbbc2394` | open, draft, mergeable | 24 passed, 1 skipped |

## 970: no love horoscope for a birth date under 18

- **Fixes:** the D2 fail, and by its description the panel data too (it empties the
  panel's love readings for a birth date under 18; read, not run). With a birth date under 18, a love request gets the general
  reading and the note "This birth date is under 18, and Zodiacs does not give love
  or romance readings for anyone under 18, so this is the general reading", and the
  pointer to a love week goes. No tool definition changes.
- **Does not fix:** a love request with no birth date, and `get_horoscope_period`
  with a love focus, which cannot see an age. The panel's Love button stays visible
  for an under-18 birth date.
- **For Dias:** whether the server reports a new version when this goes live (the
  draft keeps 0.6.6). It should merge first; 971 and 972 both lean on it.

## 971: tool descriptions describe the tool

- **Fixes:** the D1 fail on `get_horoscope` (the scheduling offer is removed) and the
  most of the flags; it rewrites 15 of the 19 live descriptions and the server
  instructions as statements, and adds the under-13 refusal and the under-18 limits
  to the descriptions of seven of the eight tools that take a birth date. The four
  it leaves alone are `get_sky`, `get_upcoming_events`, `check_sky_fact` and
  `get_chinese_zodiac`; the last of these refuses a birth date under 13 without
  saying so and is a flag in this dry run, so it should join the change.
- **Does not fix:** `get_chinese_zodiac`; any input field description (it leaves
  them on purpose, so "Never guess it", "Do not request coordinates for modern
  birthdays" and the en dashes stay); the server instructions' under-13 sentence,
  "do not send a child's name, birth date or birthplace to its tools"; the sign-up
  and invite links inside results (it lists them for Dias); the "right now" refusal
  text. It makes descriptions longer, which works against R1 in `REPORT.md`.
- **Check after it:** OpenAI's negative test cases on file expect "Does not invoke
  Zodiacs" for stock picks, scheduling and a guaranteed outcome. Today that rests on
  the directive sentences this draft rewrites as facts, so rerun those cases in
  ChatGPT before resubmitting.
- **For Dias:** it changes 10 of the 13 published definitions, which the house rule
  keeps byte-identical. Its description says the owner approved the change with a
  version bump on 11 November and the branch now reports **0.6.7**; I could not
  confirm that approval anywhere outside the pull request, so it is listed as needing
  Dias's confirmation. Both directories reviewed the old wording, so both need
  telling (Anthropic's policy 3.H; OpenAI rescans the server and holds changed tools
  until approved). It contains 970's change and must merge after it.

## 972: developer page and support contact

- **Fixes:** the D6 fail. `/developers/ai/` would list all 19 tools, the limits,
  troubleshooting (including a refused recent birth date), six example prompts and
  `admin@zodiacs.org`; `/developers/support/` would gain a connector section. This
  also puts the under-13 refusal on the documentation page (half of the D4
  documentation gap).
- **Does not fix:** `/developers/mcp/`, which still describes the local eight-tool
  server with no pointer to the hosted connector's page.
- **For Dias:** the support address (it uses `admin@zodiacs.org`); its line that no
  romance framing is given under 18 is true only once 970 is live, so merge after 970.

## 968: listing and version records

- **Fixes:** the D5 record gaps. `LISTING.md` would state the current facts once, the
  stale sentences would get dated notes, and a single reviewer note
  (`REVIEWER-NOTE-DRAFT.md`, marked "Draft, not sent") would withdraw the 15 October
  sentence about first names in links, the 6 November "thirteen unchanged" and the
  7 November 0.6.5.
- **Does not cover:** the five further statements `REPORT.md` D5 lists (no eclipses,
  "sees only what you choose to share", the portal's shortened tool copy, the 0.5.1
  demo recording, the `get_horoscope` justification).
- **Does not fix by itself:** anything a reviewer sees. That needs the note sent and
  the listing description resubmitted, which are Dias's to do.
- **For Dias:** whether and when to send the note, and whether to save a newer
  listing description in the portal (the last one on record is the 0.5.1 wording,
  which still says no personal predictions). The draft says 0.6.6 throughout; if 971
  merges, the server reports 0.6.7 and this note and these records must say 0.6.7
  before anything is sent.

## Not covered by any draft

R1 in `REPORT.md` (receipts, versions, digests and a timestamp in results, every
result sent twice, a 150 KB tool list), the "right now" refusal (ZOD-62), a bare
birth year under 13, and the links inside results. Each needs Dias's decision first.

## Also read

- **[975](https://github.com/zodiacs-org/site/pull/975)** (ZOD-63, open draft, checks
  green): the connector would give Neptune's entry into Aries at NASA's 17:35:23 UTC,
  as the methodology page does. Live today it gives 14:31:41 (call 14). It rebuilds
  the same generated bundles as 970 and 971, so the three need an agreed order.
- **[943](https://github.com/zodiacs-org/site/pull/943)** (DE440 as the hosted
  backend, open draft, two failing checks, conflicts with `main`): the longer fix for
  the same times. Nothing in it changes what a reviewer sees today.

## A workable order

970, then 971 (with Dias's yes on the definitions and the version), then 972, then
968 with the version corrected; then, and only with Dias's yes, the reviewer note,
the portal's tool sync and listing description, and the OpenAI rescan.
