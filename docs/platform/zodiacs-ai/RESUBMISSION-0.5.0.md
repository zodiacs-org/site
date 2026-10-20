# Resubmitting Zodiacs 0.5.0

Written 15 October 2026, after an independent review of the withdrawn 0.5.0
package. This is the plan for the resubmission. `HANDOFF-0.5.0.md` covers
the release work done in #758.

## Update, 20 October: share links for the last three cards

`find_chart_twins`, `get_famous_chart` and `get_life_milestones` now return
a `shareUrl` too, so all eight cards can be shared as a picture link with a
story picture, in the directions the owner picked on 18 October:

- chart twins: the Sun sign and a settled Moon sign, never the birth date;
- a famous chart: the person's directory slug;
- a life milestone: the milestone the card leads with, its age and its
  dates, never the birth date.

Each tool's description ends by telling the assistant to give that link
exactly, and the three chat cards lead with it ("Share your chart twins",
"Share this chart", "Share your milestone"). `tools/list` changes for these
three tools: one sentence in each description and a nullable `shareUrl` in
each output schema, so the rescan after the deploy picks them up with the
fixes below. On the chat cards a long pair of names now steps the title
down so the main action stays on the first screen.
`zodiacs-developer-0.3.13.zip` is rebuilt in place; `zodiacs-sky-0.5.0.zip`
is unchanged.

## Update, 20 October: three bugs fixed before the rescan (#797)

Found while rating the plugins for resubmission on 19 October:

- `get_sky_calendar` in Russian answered `calculation-failed`. The runtimes
  are Node bundles built outside Vite, and the Russian copy reads
  `import.meta.env.SSR`; the build now defines it.
  `src/ai-tools/bundle-languages.test.ts` runs the generated bundles in all
  six languages.
- The wedding and occasion line wrote "A Aries Sun"; it now reads "An Aries
  Sun".
- Share links dropped Cyrillic names. The preview renderer now carries EB
  Garamond's Cyrillic, so "Анна and Иван" stays on the link and the picture.

`tools/list` changes in two output schemas: the literal `note` of
`get_compatibility` and of the occasion tools now says "for insight and fun,
not a guarantee …" with a comma, as the share pages do. The rescan after the
deploy picks it up with the other changes. `zodiacs-developer-0.3.13.zip` is
rebuilt in place; `zodiacs-sky-0.5.0.zip` is unchanged.

The listing's About loses its two dashes: "Compare two people's charts,
whether partners, friends or family, and get a compatibility score …"
(1,784 characters). Paste the About from "The listing" below into the draft.

## Update, 19 October: three more share links (#782, draft)

The owner picked keepsake link previews for the birthday, sky calendar and
horoscope cards on 18 October, so those three tools now return a share link,
as `get_occasion_sky` and `get_compatibility` do:

- `get_birthday` returns `shareUrl` with the month and day, never the year.
- `get_sky_calendar` returns one for the next event.
- `get_horoscope` returns one for the reading shown.
- Each tool's description ends by telling the assistant to give that link
  exactly, and the cards lead with it ("Share this birthday", "Share the
  reading"; the sky calendar keeps Subscribe first).

`tools/list` changes for these three tools only: one sentence in each
description and a nullable `shareUrl` in each output schema. `initialize`,
the resources and the capabilities answer keep their bytes, and the flag-off
fixture is captured again from this change. The panel addresses stay
`ui://zodiacs/occasions-v4.html` and `ui://zodiacs/horoscopes-v3.html`.
`integrations/packages/zodiacs-sky-0.5.0.zip` is unchanged. After the deploy,
a rescan, only with the owner's yes, shows the new descriptions.
`zodiacs-developer-0.3.13.zip` is rebuilt in place.

## Update, 18 October: every output schema typed

The owner asked for the hosted tools' output schemas to be fixed before the
resubmission. The MCP Inspector's `--strict` check now finds no untyped part
and no error in any of the 13 tools; it found 14 untyped parts and 3 errors
before.

- The values the compute API returns (a receipt, its backend, a result, ΔT and
  the time scale) carry the schemas the API documents for them in
  `/api/v1/openapi.json`. The capabilities' limits, conventions and coverage
  have exact types.
- The three pairs that were written as tuples are two-item arrays.

`integrations/packages/zodiacs-sky-0.5.0.zip` is unchanged: it carries no
tool schemas, and the portal reads them from `https://zodiacs.org/mcp`. After
the deploy, a rescan, only with the owner's yes, shows the new schemas.
`zodiacs-developer-0.3.13.zip` is rebuilt in place, because its local server
carries the same contracts.

## Update, 15 October: what this release now includes

Besides the predictions below: comparing yourself with a famous person Zodiacs
publishes, the three best days in a date range, a personal forecast for the
week from the person's own chart in the horoscope tool, share links whose
previews show the score or rating as a picture, and a score ring on the cards.
Re-record the demo after these are live (shot list below), and add one shot
of a share link's preview if time allows.

## Update, 15 October: predictions and scores

After #759 merged, the owner chose full predictions, including scores, before
resubmitting. Zodiacs now:

- scores compatibility out of 100, with attraction, communication and
  long-term stability, a verdict and a one-line headline
  (`src/lib/compat-score.ts`);
- rates any date someone names out of 100, with a verdict and plain reasons
  such as Venus retrograde, Mercury retrograde and the Moon's phase and sign
  (`src/lib/occasions/date-score.ts`);
- writes the comparison notes as forecasts, on the plugin card and the
  site's pair pages, in all five languages.

Three lines stay: no investment picks, no health predictions and no
guarantees. The listing, test cases 3 and 5, the tools' instructions, the
skill, the claims ledger and the panel (now `ui://zodiacs/occasions-v4.html`)
changed to match. The Sky package changed too, so
`integrations/packages/zodiacs-sky-0.5.0.zip` must be uploaded again into
the draft. Its version stays 0.5.0 because the draft was never submitted.

## Where it stands

- **Portal.**
  - The owner withdrew the 15 October submission.
  - The owner's review brief that day gives the last verified state as
    Draft / Not submitted / Not published.
  - The plugin identity is unchanged:
    `plugin_asdk_app_6ad073182c5c8191ac05ef000b65058c`.
- **Production.** `https://zodiacs.org/mcp` already offers all 13 tools (#758).
- **Review of the withdrawn package.**
  - Ratings: 5/10 overall, listing 7, positioning 7, demo 3.
  - Blocker 1: the demo was unfinished.
  - Blocker 2: the comparison card's wording contradicted the promise not to
    predict.
  - Blocker 3: the proposed subtitle had 46 characters, over the 30 that
    `scripts/check-ai-integrations.mjs` allows.

## Fixed in the code

| Review finding | What changed |
| --- | --- |
| The comparison card said how relationships go: "starts fights, depending on the week", "Disagreements calcify unless someone blinks by appointment", "pays out" | `src/lib/compat.ts` rewrites every element, mode and polarity note and the five aspect phrases. They now say what astrology reads into a pairing, never how one goes. The site's pair pages use the same notes. Their Spanish, Portuguese, French and Italian versions (`src/lib/compat-i18n.ts`) are rewritten to match. |
| The card's counts didn't add up: 12 + 13 shown, 31 in all | A third tile counts the conjunctions: 12 + 13 + 6 = 31. |
| Raw dates such as "born 1929-05-04" | Dates read "born 4 May 1929". |
| ChatGPT keeps a panel by its address | The panel moves to `ui://zodiacs/occasions-v3.html`. The v2 and v1 addresses stay readable for older conversations. |
| Test case 1 trap: a moment sent with a time zone was refused | `check_sky_fact` now ignores a time zone sent with a moment, because the moment already fixes the time. |
| The scan flagged `get_occasion_sky` (reason not recorded; the likely cause is the optional coordinates and names) | Each optional input of `get_occasion_sky` and `get_compatibility` now says what it is for and that nothing is stored. |
| Famous people's descriptions on screen, such as Charlotte Brontë as "Poet and teacher" | 59 of the 104 published people now lead with what they are chiefly known for: Charlotte Brontë "Novelist and poet", Audrey Hepburn "Film actor", Karl Marx "Philosopher". Every label comes from the person's cached Wikidata occupations. The record is `docs/phase5/people-pilot/editorial-identities-2026-10-15.md`. |
| About text | Rewritten. See the listing below. The subtitle stays "Birth charts & horoscopes". |

All of it is in one pull request, with tests and regenerated panels and
packages. The Sky package `integrations/packages/zodiacs-sky-0.5.0.zip` is
byte-for-byte unchanged at that point. The predictions update below changes
it, so it must be uploaded again. A rescan picks up
the server's new descriptions and panel.

## The listing

The source of truth is `integrations/chatgpt/chatgpt-app-submission.json`.

- **Name:** Zodiacs
- **Subtitle:** Birth charts & horoscopes (25 characters)
- **Category:** Education & Research, as accepted before
- **Website, support, privacy and terms:** the profile's existing verified
  links. Support stays admin@zodiacs.org.
- **Test cases:** the five positive and three negative cases in the
  submission file, unchanged.
- **About** (1,784 characters):

> Explore your birth chart, see how compatible you are with someone close to you, and read your horoscope. Zodiacs calculates the sky for the date and place you give, then tells you what astrology says about it.
>
> Build an interactive birth chart and see your planets' signs. Compare two people's charts, whether partners, friends or family, and get a compatibility score out of 100 for attraction, communication and long-term stability, or see how you match with a famous person Zodiacs publishes. Find famous people who share your Sun or Moon sign, or look up the chart of a famous person Zodiacs publishes.
>
> Read daily and weekly Sun-sign horoscopes and a personal forecast for your week from your own chart, follow Moon phases, retrogrades and planets changing signs, and subscribe to the sky calendar in Google Calendar, Apple Calendar or Outlook.
>
> See the sky on your birthday and when your solar return falls, find milestones such as your Saturn return, or make a keepsake card for a wedding or another day that matters, with a rating of how the stars favour the date, or find the best days in a month for it. Share your score or rating as a picture link. With a place, the card adds sunset, golden hour and the evening sky.
>
> Zodiacs gives clear forecasts, scores and ratings, and always shows the astrology behind them. It doesn't pick investments, make health predictions or guarantee how things will turn out. If a birth time or place is missing, it says what can still be worked out instead of guessing.
>
> No Zodiacs account is needed. Chart Studio calculates your chart inside the panel, and you choose what to share with the assistant. Other tools use the details you give for that answer only; Zodiacs doesn't keep them. The sky calendar is a link you choose whether to add.

**If the portal refuses that length,** use this 792-character version:

> Explore your birth chart, see how compatible you are with someone close to you, and read your horoscope. Zodiacs calculates the sky for the date and place you give, then tells you what astrology says about it.
>
> Get a compatibility score out of 100, find famous people who share your Sun or Moon sign, read daily and weekly Sun-sign horoscopes, follow Moon phases and retrogrades, see your solar return and Saturn return, or rate a wedding or another day that matters and make a keepsake card of its sky.
>
> Zodiacs gives clear forecasts, scores and ratings, and always shows the astrology behind them. It doesn't pick investments, make health predictions or guarantee how things will turn out.
>
> No account is needed. Zodiacs uses the details you give for that answer only and doesn't keep them.

**Reviewer note.** If the portal asks why `get_occasion_sky` needs its
inputs, paste this:

> get_occasion_sky is read-only. Latitude and longitude are optional and are
> used only to work out sunset, golden hour and the evening sky at the place.
> The place name and first names are optional, are only printed on the card,
> and are not used in the calculation. Nothing is stored.

## The demo

- **Who sees it.** The demo is evidence for OpenAI's reviewers. Nothing
  found suggests the directory shows it to users. OpenAI's own description of
  a listing names the app's name, icon, descriptions, categories and optional
  screenshots. So once Zodiacs is approved, the demo does nothing for traffic
  or the brand. Its only job is not to stand in the way of approval.
- **Re-record it: the demo in the portal now contradicts the listing.** It
  shows "Zodiacs does not score relationships" on screen, while the listing
  now promises a compatibility score out of 100 and date ratings. Reviewers
  compare the two.
- **Keep it short and plain.** Polish doesn't matter, because the public
  never sees it. Record only the comparison and the wedding card, with the
  shot list below (about 45 seconds), and replace
  `public/assets/ai/review/zodiacs-sky-0.5.0.mp4`.
- **Unconfirmed: mobile.** Third-party guides say the demo should cover web
  and mobile; OpenAI's own page couldn't be checked. The portal accepted the
  web-only video on 15 October without flagging it. If a reviewer asks, add
  a 20-second phone recording of one card.

### Before recording

- **Wait for the deploy.** Record only after the pull request is merged and
  production has redeployed. Otherwise the old wording and counts appear.
- **Connect ChatGPT to production.**
  - Use a ChatGPT developer-mode connection to `https://zodiacs.org/mcp`,
    with no authentication.
  - Name it **Zodiacs**, not "Zodiacs Preview 0.5.0".
  - Give it the real icon, `plugins/zodiacs-sky/assets/icon.png`, so no
    broken-image icon shows.
  - Turn off the old preview connection.
- **Start a fresh chat.**
  - Collapse the sidebar.
  - Keep account details, other chats, memory notices and browser chrome out
    of frame.
- **Frame for reading.**
  - Show only the conversation column, zoomed so card text is at least 16 px
    in a 1080p export.
  - Use the normal cursor: no cursor effects, captions or overlays on the
    footage.
- **Type each prompt exactly as written below,** with single spaces.

### Shot list (about 45 seconds)

| Time | Prompt | Must be visible | Then |
| --- | --- | --- | --- |
| 0:00–0:03 | none | Title card: "Zodiacs in ChatGPT · live recording · example birth details · waiting trimmed" | none |
| 0:03–0:25 | Compare my chart with my partner's and tell us how compatible we are: I was born 3 May 1990 at 8:30 in Madrid, he was born 10 August 1992. | The score out of 100 and its verdict; attraction, communication and long-term stability; the headline; the forecast notes and closest contacts; "not a guarantee" | Scroll the card top to bottom. |
| 0:25–0:45 | We're getting married on 12 June 2027 at 17:00 in Florence. Is it a good day for it? Make us a card with the sky for that day. | The rating out of 100 and its verdict; the reasons, including Mercury retrograde; Gemini Sun, Libra Moon; golden hour 20:13–20:57, sunset 20:57 | Click the printable card and show Florence, 12 June 2027 and 17:00 kept. |

- **Holds.** Hold each finished card for about 3 seconds.
- **Cuts.** Cut only the waiting while a tool runs, never the middle of a card.
- **Audio.** Remove the audio track: `ffmpeg -i in.mp4 -an -c:v copy out.mp4`.
- **Export.** 1920 × 1080 or 1280 × 720, H.264.
- **Expected values** above come from the current code on 15 October. If
  the recording shows different numbers, stop and check before submitting.

### After recording

- **Publish it.** Replace `public/assets/ai/review/zodiacs-sky-0.5.0.mp4`
  with the new file. The address stays the same, so the plugin package and
  the Claude listing link need no change.
- **Update the record.** In `WALKTHROUGH.md`, add a 0.5.0 entry with its
  SHA-256, length and timeline.
- **Check and merge.** Run `npm run ai:check`, then open a pull request.

## Checks that decide approval

The reviewer runs the eight test prompts live. Running them first costs
about ten minutes; a failure found by the reviewer costs a whole review cycle.
Save screenshots to `docs/platform/zodiacs-ai/evidence/0.5.0/`.

1. **Positive cases.** Run all five, word for word, on production. For each:
   - the right tool runs and the panel renders;
   - links open and carry `?ref=chatgpt`;
   - the comparison shows its score out of 100 and the wedding card its rating;
   - nothing guarantees an outcome, picks an investment or predicts health.
2. **ChatGPT's own words in case 3.** ChatGPT should lead with the score
   and verdict and present them as astrology's reading. If it promises an
   outcome ("you will stay together"), report the exact words so the
   instruction can be tightened before submitting.
3. **Negative cases.** Run all three. ChatGPT should not call Zodiacs.
4. **Scan.** After the deploy, rescan in the portal, only with the owner's
   yes.
   - If `get_occasion_sky` is still flagged, screenshot the detail.
   - Use the reviewer note above.

## Who does what

**The owner**

1. Read the new wording in the pull request and say "merge", or ask for
   changes.
2. After the deploy, record the 45-second demo and run the checks above, or
   watch Codex run them.
3. Read the final listing and video, then authorize the resubmission and
   confirm the attestations.

**Codex**

1. In the portal, under the owner's eye:
   - upload the changed `zodiacs-sky-0.5.0.zip` into the draft;
   - paste the About and the two changed test cases;
   - confirm the subtitle and links;
   - rescan only with the owner's yes;
   - record what the scan says.
2. Update `PORTAL_REVIEW.md` after each portal step.
3. Cut and publish the new demo as described under "After recording".

**Claude, in the session that made these fixes**

- Merge the pull request when the owner says so.
- After the deploy, check production's new wording, counts and dates through
  the live tools.

## Open, not blocking

- **Birthplace labels.**
  - For 7 of the 104 published people, the birthplace is a hospital, street
    or house taken as-is from Wikidata. One example is Audrey Hepburn's
    "Rue Keyenveld - Keienveldstraat".
  - It shows on their pages and in the famous-chart note.
  - The demo shows none of these birthplaces.
  - A town-level label needs sourced evidence through the people pipeline.
- **Country in a description.**
  - It is the birthplace's present-day country, not the person's
    nationality. Sigmund Freud reads "Czech Republic", Florence Nightingale
    "Italy" and George Orwell "India".
  - Immanuel Kant's reads "Prussia", so the rule isn't applied evenly.
  - Changing this means deciding between birthplace and nationality first.
- **People's descriptions.** Sixteen were judgment calls and were left as
  they are. Examples are Florence Nightingale's "Nurse and writer" and
  Sigmund Freud's "Psychoanalyst and essayist". The identity record lists
  each one with the label that would follow its description more closely.
- **Translations.** The rewritten Spanish, Portuguese, French and Italian
  notes have had no native speaker's read.
- **Test-case gaps.** Chart Studio, the birthday tool and the calendar still
  have no OpenAI review case, because of the 5-case limit.
