# Zodiacs 0.6.0 for the OpenAI portal

Prepared 2 November 2026 on branch `feat/mcp-consumer-coverage`. Nothing has
been uploaded, rescanned, attested or submitted. Each portal step needs
Dias's separate yes, and Dias confirms every attestation. The Claude side is
in `claude-directory/RESYNC-0.6.0.md`.

## 0.6.2 update, 4 November 2026

Prepared on branch `feat/listing-text-0-6-2`; nothing uploaded. Dias chose to
package the new listing text (option B of the 4 November listing draft), so
upload `integrations/packages/zodiacs-sky-0.6.2.zip` (98,007 bytes, SHA-256
`993c5428d0a589532bf9a57ed09a2d8fa17a4e7e5933003f94f574fa9574c21d`) instead of
the 0.6.1 ZIP. It carries a new About, the subtitle "Sky, horoscopes & birth
charts", three starter prompts that need no personal details, the
capabilities with the town and time zone lookup, and five review cases, three
of which need no personal details; `find_chart_twins` moves from the cases to
the reviewer prompts. `chatgpt-app-submission.json` carries the same About and
cases and adds `find_birthplace`'s justifications. The server reports 0.6.2;
the 19 tools, their definitions and the panels are unchanged, and the rest
of the 0.6.1 update below still applies.

## 0.6.1 update, 4 November 2026

Prepared on branch `feat/readings-panel-0-6-1`; nothing uploaded. Upload
`integrations/packages/zodiacs-sky-0.6.1.zip` (96,537 bytes, SHA-256
`b52ffc5710100a09ca4b9ab299ca391f91b1f49e7d03f8b76240566b7554956a`) in place
of the 0.6.0 ZIP in step 3 below, and expect 19 tools wherever the steps say
18: the thirteen in review, byte for byte, then the five 0.6.0 tools and
`find_birthplace`. The five 0.6.0 tools now open the inline readings panel
`ui://zodiacs/readings-v3.html`, with no sidebar launch, so a short recording
of it is worth adding if the portal asks for one. Forecasts carry a label such
as "Reading confidence 55%" (how specific the details were, never the odds
that something happens), readings for anyone under 18 leave out romance and
attraction, get_compatibility refuses a pair with someone under 18 and points
to a friendship reading of the two Sun signs, and the server says: Zodiacs
never stores or logs birth details. Links never carry a birth year, time,
place or names; a birthday link carries only the month and day. The About and
the test cases are unchanged.

## Where things stand

- **0.5.1 is in review.** The latest portal record (`PORTAL_REVIEW.md`, 28
  October) shows the app **In review**, metadata and skills version 0.5.1,
  **Not published**. Earlier entries in `RESUBMISSION-0.5.0.md` describe 0.5.1
  as prepared but not uploaded; the 28 October entry supersedes them, though
  when 0.5.1 was submitted is not recorded. Check the portal before step 1.
- **`zodiacs-sky-0.5.1.zip` is unchanged**, SHA-256
  `d6c440e088474773eac16edf2b89fb0520c880af5407ddc3f4ab7136b3066e13`, like
  every earlier ZIP. The packager now refuses to rewrite any existing archive.
- **New package:** `integrations/packages/zodiacs-sky-0.6.0.zip`, 92,867
  bytes, SHA-256
  `27dd5c66570ccfe58af01696980c0db98c19f68666eb5e79f3a90e2260eff03b`
  (members listed in `integrations/packages/manifest.json`).
- **Developer plugin:** `zodiacs-developer-0.3.17.zip`, 3,419,885 bytes,
  SHA-256 `e516233a7ccf82cef665743f6622443221f40dfd75401ac2db39fb2e7e7d13a9`.
  It is not part of the OpenAI submission; its local tools are unchanged. It replaces 0.3.15,
  which keeps its bytes, with the hosted server's corrected placement and
  untimed sign answers.

## What 0.6.0 changes

- Five read-only tools with no sign-in: `get_natal_chart`,
  `get_horoscope_period`, `get_chinese_zodiac`, `get_personal_transits` and
  `explain_astrology`. They are offered only where `ZODIACS_COVERAGE_ENABLED=1`
  joins `ZODIACS_OCCASIONS_ENABLED=1`; until then production lists the
  thirteen tools under review, unchanged except the reported version.
- The thirteen tools' definitions are byte for byte the live ones of
  1 November (`src/ai-tools/release-060.test.ts`), so a rescan would show five
  new definitions and no changed ones.
- **About** (2,529 characters; the plugin's `longDescription` and the
  submission's `app_info.description` are the same text): it now names the
  compatibility score out of 100 and the date rating out of 100 accurately, and
  adds chart readouts, monthly and yearly horoscopes, personal transits, the
  Chinese zodiac and explainers. Subtitle unchanged: "Birth charts &
  horoscopes".
- Five more capabilities, 0.6.0 release notes, the onboarding skill and README
  cover the five tools.
- `integrations/chatgpt/chatgpt-app-submission.json` adds annotations and
  read-only, open-world and destructive justifications for each new tool.
- **Test cases.** The five positive and three negative review cases are
  unchanged: `scripts/check-ai-integrations.mjs` holds the portal to 5 and 3
  (OpenAI's real limit is unconfirmed), and those cases cover the two tools
  the portal flagged for further review. The new tools are covered by sixteen
  cases in `integrations/chatgpt/evaluation-cases.json` (70 in all, 70/70 in
  `npm run ai:eval`). If the portal accepts more cases, add these:

| Prompt | Tool | Expected |
| --- | --- | --- |
| Read my birth chart: born 3 May 1990 at 8:30 in Madrid. | `get_natal_chart` | Taurus Sun, Leo Moon, Gemini rising; planets in signs and houses, closest aspects, element balance, as astrology's reading. |
| What's my chart? I was born on 3 May 1990 but don't know the time. | `get_natal_chart` | No rising sign or houses; says the Moon was in Leo or Virgo that day; does not guess a time. |
| What's my Chinese zodiac sign? I was born 20 January 1990. | `get_chinese_zodiac` | Earth Snake: born before the Lunar New Year of 27 January 1990. |
| What's the monthly horoscope for Leo? | `get_horoscope_period` | The published reading for the current month as written, with the month's sky. |
| What does Mercury retrograde mean? | `explain_astrology` | A short explainer with links to zodiacs.org's retrograde pages. |
| Negative: Give me a tarot reading for this week. | none | Does not call Zodiacs or present a tarot reading as Zodiacs'. |

- **Demo.** `demo_recording_url` still points to the 0.5.1 recording. The new
  tools have no panel, so a new video is optional; if the portal asks for one,
  record the first, third and fourth prompts above.

## Steps for Dias

1. **Decide the timing.** 0.5.1 is in review. Either wait for that review's
   result and upload 0.6.0 as the next version, or withdraw 0.5.1 in the portal
   and replace it. Withdrawing restarts review; waiting keeps the current one.
   This is the owner's choice.
2. **Merge, migrate and switch on** as `claude-directory/RESYNC-0.6.0.md`
   describes (merge, run the usage migration, set `ZODIACS_COVERAGE_ENABLED=1`
   for Production, redeploy, check 18 tools). Upload only after production
   lists the five tools, so the About matches what the server offers.
3. **Upload** in the OpenAI platform portal, signed in as admin@zodiacs.org:
   - open the existing Zodiacs plugin (identity
     `plugin_asdk_app_6ad073182c5c8191ac05ef000b65058c` per
     `RESUBMISSION-0.5.0.md`; an older handoff names
     `plugin_asdk_app_6ac51614dd288191b38dd3b9c0cf191e`, so confirm the one
     the portal shows) and add a **new version**; never create a new plugin;
   - upload `integrations/packages/zodiacs-sky-0.6.0.zip` and check the
     SHA-256 above first (`sha256sum` on the file);
   - check that the imported About matches `app_info.description` in the
     submission file, and that the subtitle, links and test cases are as
     before.
4. **Rescan the MCP server** (separate yes). Expect 18 tools: the thirteen
   with their current definitions and five new ones, all read-only. If a new
   tool is flagged "needs further review", screenshot the detail; the
   justifications in the submission file answer read-only, open-world and
   destructive questions.
5. **Test in ChatGPT** with a developer-mode connection to
   `https://zodiacs.org/mcp` named Zodiacs: run the five positive and three
   negative cases word for word, then the new prompts above. Each must call
   the right tool, keep links with `?ref=chatgpt`, and never guarantee an
   outcome, pick investments or predict health.
6. **Attest and submit** (Dias reads and confirms each attestation).
7. **Record** each portal step with its date in `PORTAL_REVIEW.md`.

## Checks run on this branch

`npm run ai:build`, `npm run ai:package`, `npm run ai:check` and
`npm run ai:eval` (70/70) pass. See the branch's pull request for the full
`npm run check`, `npm test` and build results.
