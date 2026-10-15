# Resubmitting Zodiacs 0.5.0

Written 15 October 2026, after an independent review of the withdrawn 0.5.0
package. This is the plan for the resubmission. `HANDOFF-0.5.0.md` covers
the release work done in #758.

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
| Famous people's descriptions on screen, such as Charlotte Brontë as "Poet and teacher" | Corrected through the people pipeline's reviewed identities. See the pull request for the list. |
| About text | Rewritten. See the listing below. The subtitle stays "Birth charts & horoscopes". |

All of it is in one pull request, with tests and regenerated panels and
packages. The Sky package `integrations/packages/zodiacs-sky-0.5.0.zip` is
byte-for-byte unchanged, so nothing needs re-uploading. A rescan picks up
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
- **About** (1,428 characters):

> Explore your birth chart, compare it with someone close to you, and read your horoscope. Zodiacs calculates the sky for the date and place you give, then offers astrology's traditional meanings for reflection.
>
> Build an interactive birth chart and see your planets' signs. Compare two people's charts—partners, friends or family—to see how they relate, without a score. Find famous people who share your Sun or Moon sign, or look up the chart of a famous person Zodiacs publishes.
>
> Read daily and weekly Sun-sign horoscopes, follow Moon phases, retrogrades and planets changing signs, and subscribe to the sky calendar in Google Calendar, Apple Calendar or Outlook.
>
> See the sky on your birthday and when your solar return falls, find milestones such as your Saturn return, or make a keepsake card for a wedding or another day that matters. With a place, the card adds sunset, golden hour and the evening sky.
>
> Zodiacs keeps calculated facts separate from interpretation. It doesn't score relationships, pick or rank dates, or promise how things will turn out. If a birth time or place is missing, it says what can still be worked out instead of guessing.
>
> No Zodiacs account is needed. Chart Studio calculates your chart inside the panel, and you choose what to share with the assistant. Other tools use the details you give for that answer only; Zodiacs doesn't keep them. The sky calendar is a link you choose whether to add.

**If the portal refuses that length,** use this 851-character version. It
is under the 965 characters the portal already accepted.

> Explore your birth chart, compare it with someone close to you, and read your horoscope. Zodiacs calculates the sky for the date and place you give, then offers astrology's traditional meanings for reflection.
>
> Compare two people's charts without a score, find famous people who share your Sun or Moon sign, read daily and weekly Sun-sign horoscopes, follow Moon phases and retrogrades, see your solar return and Saturn return, or make a keepsake card of the sky on a wedding or another day that matters.
>
> Zodiacs keeps calculated facts separate from interpretation. It doesn't score relationships, pick or rank dates, or promise how things will turn out. If a birth time or place is missing, it says what can still be worked out instead of guessing.
>
> No account is needed. Zodiacs uses the details you give for that answer only and doesn't keep them.

**Reviewer note.** If the portal asks why `get_occasion_sky` needs its
inputs, paste this:

> get_occasion_sky is read-only. Latitude and longitude are optional and are
> used only to work out sunset, golden hour and the evening sky at the place.
> The place name and first names are optional, are only printed on the card,
> and are not used in the calculation. Nothing is stored.

## The demo

Its job is to show the reviewer that the listing is true, case by case.

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

### Shot list (about 85 seconds)

| Time | Prompt | Must be visible | Then |
| --- | --- | --- | --- |
| 0:00–0:03 | none | Title card: "Zodiacs in ChatGPT · live recording · example birth details · waiting trimmed" | none |
| 0:03–0:23 | Compare my chart with my partner's: I was born 3 May 1990 at 8:30 in Madrid, he was born 10 August 1992. | Taurus Sun · Leo Moon · Gemini rising and Leo Sun; "Spark and soil" and "Two anchors" notes; the closest contacts; tiles 12, 13 and 6; the note on the missing birth time; "Zodiacs does not score relationships or predict how one will go." | Scroll the card top to bottom. Click "Read this pair on zodiacs.org" and show the Taurus–Leo page for 2 s. |
| 0:23–0:43 | I was born on 3 May 1990. Which famous people share my Sun sign? And what does Frida Kahlo's chart look like? | All twelve Taurus-Sun people, scrolled through; "only your Sun is compared"; Frida Kahlo's card: "Painter · Mexico · 1907–1954 · born 6 Jul 1907", Cancer Sun 13.5°, Moon sign uncertain, "a reference instant, not a birth time" | Click her chart link and show it for 2 s. |
| 0:43–1:03 | We're getting married on 12 June 2027 at 17:00 in Florence. Make us a card with the sky for that day. | Sat 12 Jun 2027, 17:00; Gemini Sun, Libra Moon, First Quarter; Mercury retrograde; golden hour 20:13–20:57, sunset 20:57; Mars and Jupiter after dusk; "Zodiacs does not choose or rank dates" | Click the printable card and show Florence, 12 June 2027 and 17:00 kept. |
| 1:03–1:15 | Show today's horoscope for Leo. Then: Is Mercury retrograde right now, and what else changes in the sky this week? I'm in Bangkok. | The dated Leo reading; a plain yes or no on Mercury, with this week's changes in Bangkok time | none |
| 1:15–1:25 | Rate how compatible we are out of 100. | No score, with the reason | End on that answer. |

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

## Checks only a person in ChatGPT can do

Save screenshots to `docs/platform/zodiacs-ai/evidence/0.5.0/`.

1. **Positive cases.** Run all five, word for word, on production. For each:
   - the right tool runs and the panel renders;
   - links open and carry `?ref=chatgpt`;
   - no score and no date ranking appear.
2. **Negative cases.** Run all three. ChatGPT should not call Zodiacs.
3. **Phone.** Take a 20-second recording of one card on a phone.
4. **Scan.** After the deploy, rescan in the portal, only with the owner's
   yes.
   - If `get_occasion_sky` is still flagged, screenshot the detail.
   - Use the reviewer note above.
5. **Cold viewer.** Show the demo once to someone who has never seen
   Zodiacs. They should be able to say what it does and what it won't do.

## Who does what

**The owner**

1. Read the new wording in the pull request and say "merge", or ask for
   changes.
2. After the deploy, record the demo to the shot list. Or record it and have
   Codex cut it.
3. Run the checks above, or watch Codex run them.
4. Read the final listing and video, then authorize the resubmission and
   confirm the attestations.

**Codex**

1. Cut and publish the video as described under "After recording".
2. In the portal, under the owner's eye:
   - paste the About;
   - confirm the subtitle and links;
   - rescan only with the owner's yes;
   - record what the scan says.
3. Update `PORTAL_REVIEW.md` after each portal step.

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
  - The demo avoids it by using Frida Kahlo.
  - A town-level label needs sourced evidence through the people pipeline.
- **Translations.** The rewritten Spanish, Portuguese, French and Italian
  notes have had no native speaker's read.
- **Test-case gaps.** Chart Studio, the birthday tool and the calendar still
  have no OpenAI review case, because of the 5-case limit.
