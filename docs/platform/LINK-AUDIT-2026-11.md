# Link audit, November 2026 (ZOD-114, plan key P6.9)

Read at `origin/main` 1853a6814 on 12 November 2026. This is a report only:
nothing in the site was changed, switched or deployed for it.

## The question

The house rule is that no link carries a birth detail. The site makes many
kinds of link. This report lists every kind found in the code, says what
each one carries, whether that data sits in the query (sent to the server)
or after the `#` (kept in the browser), whether a server or a log can see
it, and whether the site still offers it. Rows that carry a birth detail, or
positions that give one back, are flagged with the smallest fix.

## The rule for new work

**A card link carries a card ID or a Sun sign only.** A card ID is an
opaque, random or digest value that names something the site already holds
(a saved result, an invitation, a published person's slug); it is never
derived from, and never decodes to, a birth date, time, place, name or chart
positions. Anything else a card shows is drawn from the site's own data or
from what the person enters on their own device, not from the link.

Every row below is measured against the house rule (no birth detail) and,
in the last column, against this rule for new work.

## How to read the table

- **Data in.** *Query* means the part after `?`, or a path segment; the
  browser sends it to the server with the request. *Fragment* means the part
  after `#`; browsers never send it to a server, never put it in a
  `Referer` header, and link preview bots never see it. A fragment can
  still sit in the sender's chat history, the receiver's browser history
  and any browser extension's view of the address bar.
- **Server or log sees it.** Whether the data reaches a Zodiacs server
  function, the host's request logs or the CDN cache key. A query always
  does; a fragment never does unless the page itself sends it on.
- **Positions.** Where a row says the positions "give back" the birth date
  and time: the v2 code keeps the twelve bodies to 0.001 degrees at the
  chart's UTC instant rounded to the whole minute, so the birth date and
  time can be solved from it to the minute; a chart without a birth time
  carries the sky at 12:00 UTC on the birth date, which gives the date.
  ASC and MC at the whole degree narrow the birthplace to a band. This is
  stated in the code itself (`src/lib/share-positions.ts`, lines 160 to
  175, and `api/calendar/transits.ts`, lines 1 to 4).
- Placeholders only: `YYYY-MM-DD`, `HH:MM`, `MM-DD`, `<code>`, `<sign>`.

## The table

Legend for *Carries*: **D** birth date, **T** birth time, **P** birthplace
(coordinates, zone or label), **N** names, **X** chart positions that give
back D and T, **S** Sun sign (or other signs), **O** an occasion date,
**ID** an opaque identifier. "None" means no personal data.

### Chart links

| # | Link kind (shape) | Where it is made | Data in | Carries | Server or log sees it | Still offered | Flag |
|---|---|---|---|---|---|---|---|
| 1 | v1 chart link with birth details: `/birth-chart/#c=1.<code>` (optional `&subject=other`) | `src/islands/ChartShareDialog.tsx` "Copy link with birth details" (`detailsUrl`, built by `shareUrl()` in `src/islands/ChartCalculator.tsx` through `chartHandoffFragment`, codec `src/lib/share.ts`) | Fragment | D, T (when known), P (zone, coordinates to 4 decimals, place label up to 40 characters), N (up to 24 characters), house system | No. The calculator reads it and clears the fragment on arrival | Yes, as the second button in the share dialog, labelled as including birth details | **FLAG** |
| 2 | v1 in-site hand-off: `/birth-chart/#c=1.<code>` as a link or navigation | `ChartCalculator.tsx` "Get your birth chart" link (short modes); `BigThreeQuick.tsx`; `MoonPhaseTool.tsx` (with a place); `WelcomeBack.tsx` (reopen a saved chart); `SomeoneElseChart.tsx` | Fragment | D, T, P (with place label); N on `WelcomeBack` (the saved chart's name) and `SomeoneElseChart` | No. Cleared on arrival, but the address can stay in browser history on that device, and the visible link can be copied | Yes | **FLAG** |
| 3 | "Someone else" hand-off: `/birth-chart/someone-else/#mine=1.<code>` | `someoneElseHandoffPath` in `src/lib/chart-handoff.ts`, used by `ChartCalculator.tsx` | Fragment | D, T, P, N of the person's own chart | No. Cleared by `SomeoneElseChart.tsx` on arrival | Yes | **FLAG** |
| 4 | Two-person compatibility hand-off: `/compatibility/#a=1.<code>&b=1.<code>`, or `/compatibility/?a=<saved id>#b=1.<code>` | `compatibilityHandoffPath` in `src/lib/chart-handoff.ts`, used by `ChartCalculator.tsx` and `SomeoneElseChart.tsx` | Fragment for the birth inputs; query for an opaque saved chart id | D, T, P, N for one or two people; the query part is ID only | Fragment: no. Query: the saved id only | Yes | **FLAG** |
| 5 | Date hand-off: `/birth-chart/#date=YYYY-MM-DD&time=HH:MM` (or `time=unknown`) | `dateHandoffFragment` (`MoonPhaseTool.tsx` without a place); the birthday page form `src/components/birthday/BirthdayChartForm.astro` builds the same two keys | Fragment | D, T | No. Cleared on arrival | Yes | **FLAG** |
| 6 | v2 positions link: `/birth-chart/#p=2.<code>` (localized receivers too) | `ChartShareDialog.tsx` "Copy positions link" (the primary share link), `encodeSharedPositionsLink` in `src/lib/share-positions.ts`; also as in-site navigation from `SomeoneElseChart.tsx` (`&subject=other`) and `ProfilePeople.tsx` | Fragment | X (12 bodies at 0.001 degrees, ASC and MC to the whole degree when timed), house system, engine version. No D, T, P or N field, but the positions give D and T back and narrow P | No. Cleared on arrival | Yes, the primary chart share link | **FLAG** |
| 7 | Chart preview link: `/api/og/chart?sun=&moon=&rising=&houses=` with `#p=2.<code>`; older form `/api/og/chart?p=2.<code>`; image `/api/og/chart-image?...` | `src/server/chart-preview.ts`, `src/lib/share-preview.ts` (rewritten in `vercel.json` to `/api/compatibility?__zodiacs_og_route=link`) | Query (whole-degree Sun, Moon, rising); the older form puts the full v2 code in the query | Newer: whole-degree Sun, Moon and rising, which narrow D to a short list of dates and narrow T. Older: X in full | Yes, both forms reach the server function and its request logs | No producer left in `src/`; the server still answers both forms | **FLAG** (inbound, older links) |
| 8 | Two-chart send-back: `/compatibility/#s=s1.<code>` | `src/islands/synastry/SendBackExperience.tsx`, codec `src/lib/share-synastry.ts` | Fragment | X for two people, two labels (N, up to 24 characters each), time-known bits | No. Cleared by `SynastryCalculator.tsx` on arrival | Yes | **FLAG** |
| 9 | Private compatibility invite: `/compatibility/#p=2.<code>` | `src/islands/PrivateCompatibilityInvite.tsx`, `src/islands/PrivateInviteResultControl.tsx`, `privateInviteToken` in `src/lib/sharing/private-invite.ts` | Fragment | X of the inviting person | No | Yes | **FLAG** |
| 10 | Chart card: `/profile/#card=c1.<code>` | `src/islands/ProfileIdentity.tsx`, codec `src/lib/profile/card-link.ts` | Fragment | X, a label (N), time-known bit | No. `ProfileCardInbox.tsx` strips it and stores it only on the receiving device if the reader adds it | Yes | **FLAG** |
| 11 | Server-held invitation: `/c/<43 random characters>/`, which answers 303 to `/compatibility/#invite=<handle>` | `src/lib/invite/routes/invites.ts`; copied by `synastry/InviteExperience.tsx` and `ProfileInvites.tsx`; exchange in `src/lib/invite/routes/invite-exchange.ts` | Path (the random value); fragment (the handle) | ID only in the link. The server holds the invitation's label, Sun sign, positions and expiry (`src/lib/invite/validate.ts`) | The random value reaches the server and its logs (it is the lookup key). The positions are held server-side until expiry | Behind `COMPAT_INVITES_ENABLED` | Link fits both rules. **Note** on server-held positions |
| 12 | Transit calendar feed (retired): `/api/calendar/transits?token=2.<code>` | Formerly `CalendarSubscribe.tsx`; handler `api/calendar/transits.ts` | Query | X (the v2 code) | Yes. Every refresh from a calendar app that subscribed before retirement still sends the code in the query, so it can reach the host's request logs. The handler answers 410 to everything and logs nothing itself | No. The UI now offers a `.ics` file built in the browser instead (a file, not a link) | **FLAG** (inbound, retired) |

### Occasion links

| # | Link kind (shape) | Where it is made | Data in | Carries | Server or log sees it | Still offered | Flag |
|---|---|---|---|---|---|---|---|
| 13 | Occasion card link from the site: `/occasions/#o=<kind>&d=YYYY-MM-DD&n=<names>&t=HH:MM&tz=<zone>&lat=&lon=&place=<label>` | `cardLink` in `src/islands/OccasionSky.tsx` ("Copy the card's link") | Fragment | O with year, names (up to 60 characters), time, zone, coordinates to 4 decimals, place label. For the three birth occasions in `BIRTH_OCCASIONS` (`src/lib/occasions/saved-path.ts`) the date is a birth date, so this is D, T, P and N | No | Yes, for every occasion kind, including the birth occasions | **FLAG** |
| 14 | Occasion card link from the assistant, and a saved occasion page: `/occasions/#o=<kind>&d=YYYY-MM-DD&t=HH:MM&tz=<zone>&lat=&lon=` | `occasionCardUrl` in `src/ai-tools/tools.ts`; `savedOccasionPath` in `src/lib/occasions/saved-path.ts` | Fragment (but see next column) | O, time, zone, coordinates to 2 decimals. Never names or a place label. No link at all for a birth occasion | The link itself: no. A saved occasion is stored as this address in the account's saved pages, so the account server holds it | Yes | Fits the house rule. Outside the new-work rule (carries an occasion date and place) |
| 15 | Occasion share: `/share/occasion/?o=<kind>&d=YYYY-MM-DD&sun=&moon=&score=&v=&c=` and its images | `occasionShareUrl` in `src/lib/share-results.ts`, called from `src/ai-tools/tools.ts` for non-birth occasions only | Query | O, signs, score. Older links also carried `n` (names) and `p` (place), and could name a birth occasion | Yes. Older links' names, place and a birth occasion's date reach the server and its logs before the 303 in `retiredLinkRedirect` (`src/server/result-preview.ts`) clears them | Yes (new form) | New form fits the house rule. **FLAG** older inbound links |

### Share pages with a preview (`/share/...`, server rendered)

All of these are query links read by `src/server/result-preview.ts` through
the rewrites in `vercel.json`. Each key is checked against a fixed list, so
an unknown key makes the link invalid. The server and its logs see every
value.

| # | Link kind (shape) | Where it is made | Data in | Carries | Server or log sees it | Still offered | Flag |
|---|---|---|---|---|---|---|---|
| 16 | Compatibility: `/share/compatibility/?as=&bs=&score=&attraction=&communication=&stability=&v=&c=` | `compatibilityShareUrl` (`src/lib/share-results.ts`), from `src/ai-tools/features/compatibility.ts` | Query | S for two people, scores. Older links carried first names (`a`, `b`) | Yes. Older names arrive before the 303 drops them | Yes | New form fits. **FLAG** older inbound (N) |
| 17 | Birthday: `/share/birthday/?d=MM-DD&s=<sign>` | `birthdayShareUrl` (`src/ai-tools/share-links.ts`), from `src/ai-tools/features/birthday.ts`; also the 303 target for an older birthday occasion link | Query | Month and day, never a year; the sign only for a cusp date | Yes | Yes | Allowed by the house rule ("a birthday link carries only the month and day"). Outside the new-work rule |
| 18 | Big three: `/share/big-three/?s=&m=&r=` | `bigThreeShareUrl`, from `src/ai-tools/features/natal-chart.ts` | Query | S (Sun; Moon and rising only when settled) | Yes | Yes | Fits |
| 19 | Chart twins: `/share/chart-twins/?s=&m=` | `chartTwinsShareUrl` | Query | S | Yes | Yes | Fits |
| 20 | Famous chart: `/share/famous-chart/?p=<slug>` | `famousChartShareUrl` | Query | ID (a published person's directory slug) | Yes | Yes | Fits |
| 21 | Life milestone: `/share/milestone/?k=&i=&a=` | `milestoneShareUrl` | Query | Kind, ordinal, age. Older links carried `f` and `l`, the first and last days of the passes, which lead back to the birth date | Yes. Older `f` and `l` arrive before the 303 drops them | Yes (new form) | New form fits the house rule. **FLAG** older inbound |
| 22 | Chinese zodiac: `/share/chinese-zodiac/?a=<animal>` | `chineseZodiacShareUrl` | Query | The animal only. Older links carried `y`, a year that could be a birth year | Yes. Older `y` arrives before the 303 drops it | Yes (new form) | New form fits. **FLAG** older inbound |
| 23 | Invite preview: `/share/invite/?s=&p=` | `inviteShareUrl` | Query | S for up to two people | Yes | Yes | Fits |
| 24 | Sky calendar: `/share/sky-calendar/?k=&b=&d=YYYY-MM-DD` | `skyCalendarShareUrl` | Query | A public sky event and its date | Yes | Yes | Fits (no personal data) |
| 25 | Horoscope: `/share/horoscope/?s=&d=` (or `w=`, `m=`, `y=`, optional `f=`) | `horoscopeShareUrl`, `horoscopePeriodShareUrl` | Query | S and a publication date | Yes | Yes | Fits |
| 26 | Year Ahead Score: `/share/year-score/?s=&v=` or `?p=<slug>` | `src/lib/year-score/share.ts`, from `YearScoreCalculator.tsx` and `src/ai-tools/features/year-score.ts` | Query | S and score, or a published figure's slug | Yes | Yes | Fits |
| 27 | Birthday report: `/share/birthday-report/?s=&v=&t=` | `src/lib/birthday-report/share.ts`, from `BirthdayReport.tsx` | Query | S, score, and `t`, the tarot year card. The module's own comment says the card "narrows the birthday to a few dates within the sign". `py` is refused | Yes | Yes | **FLAG** (narrows D) |
| 28 | Solar return: `/share/solar-return/?s=&y=&r=&j=` | `src/lib/solar-return/share.ts`, from `SolarReturnResult.tsx` and `src/ai-tools/features/solar-return.ts` | Query | S, the return's year, the return chart's rising sign and Jupiter's sign | Yes | Yes | Fits the house rule; outside the new-work rule (more than a Sun sign). Not flagged |

### Identifier and sign links

| # | Link kind (shape) | Where it is made | Data in | Carries | Server or log sees it | Still offered | Flag |
|---|---|---|---|---|---|---|---|
| 29 | Saved result: `/birth-chart/#saved=<16 hex>`, `/occasions/#saved=...`, `/compatibility/<pair>/#saved=...`, `/horoscopes/#week=YYYY-MM-DD&saved=...`, forwarded to `/profile/#saved=<16 hex>` | `src/ai-tools/accounts/save.ts`; `src/lib/profile/saved-result-link.ts` | Fragment | ID (a digest); the week's start date is a publication date | No | Yes | Fits |
| 30 | Saved chart hand-off: `#profileChartId=<uuid>`, `#mineId=<id>&mineSource=profile`, `/compatibility/?a=<id>` | `src/lib/chart-handoff.ts`; `ProfileManager.tsx`, `LearningSavedEntry.tsx`, `ProfilePeople.tsx`, `ChartCalculator.tsx` | Fragment, except the compatibility `?a=` query | ID | The `?a=` id only | Yes | Fits |
| 31 | Sign query: `?sun=<sign>` on the profile, `?sign1=&sign2=` on compatibility | `ProfileSunSignCapture.tsx`, `PrefilledPairNotice.tsx` (the readers) | Query | S | Yes | Yes | Fits |
| 32 | Email: `/api/email/confirm?token=<opaque>`, `/api/unsubscribe?token=<opaque>` | `api/email/`, `api/unsubscribe.ts` | Query | ID | Yes | Yes | Fits |
| 33 | Public sky calendar file: `/sky-calendar.ics` (and localized copies) | Static file, headers in `vercel.json` | None | None | Ordinary request | Yes | Fits |

### Fragments the site reads but never makes

| # | Link kind (shape) | Read by | Data in | Carries | Server or log sees it | Still offered | Flag |
|---|---|---|---|---|---|---|---|
| 34 | Milestones page arrival: `/occasions/milestones/#b=YYYY-MM-DD`; and the expected-date page `src/islands/BabyShowerSky.tsx` reading `#due=YYYY-MM-DD&n=<names>` | `src/islands/LifeMilestones.tsx`, `src/islands/BabyShowerSky.tsx` | Fragment | `#b=`: D. `#due=`: a date and names | No. Neither page clears the fragment after reading it, so it stays in the address bar | No producer found in the site or the assistant tools; the pages still accept them | **FLAG** (`#b=` only) |

## Flagged rows and the smallest fix

Every fix below is a recommendation for a later ticket. None was made here.

1. **Row 1, v1 "Copy link with birth details".** The only share button that
   puts the full birth input, the name and the place label into a link on
   purpose. Smallest fix: remove the button from `ChartShareDialog.tsx`
   (stop passing `detailsUrl`). Keep `decodeChartLink` so links already sent
   still open.
2. **Rows 2 to 5, in-site hand-offs carrying v1 codes or a date and time.**
   They exist to move a chart from one page to the next, and each receiver
   clears the fragment, but the address is a real link: it can be copied,
   and it can stay in browser history. Smallest fix: one shared hand-off
   helper that writes the input to `sessionStorage` under a random one-time
   key and puts only `#h=<random>` in the address, read once and deleted;
   the same pattern `profileChartId` already uses for saved charts. The four
   callers in `chart-handoff.ts` and `BirthdayChartForm.astro` switch to it.
3. **Row 6, the v2 positions link (the primary chart share).** It has no
   birth field, but its positions give the birth date and time back to the
   minute and narrow the birthplace. Smallest fix: make the dialog's link
   button copy the big three share link (row 18) built from the chart's
   settled signs (`bigThreeShareUrl` already exists). Keep the `#p=` receiver
   for links already sent.
4. **Row 7, the chart preview route.** Nothing in the site makes it any
   more. Smallest fix: add `chart` to the retired families so
   `/api/og/chart` answers 303 to `/birth-chart/` with the query dropped
   (fragment kept, as today), and the image route answers 303 to the default
   share image, as `retiredLinkRedirect` already does for other families.
5. **Rows 8, 9 and 10, two-chart send-back, private invite and chart card.**
   Each carries positions that give back the birth date and time, and rows 8
   and 10 a name label. Smallest fix: route each through a card ID. Row 11
   already does this for invitations (a random path value, positions held by
   the server until expiry), so the private invite and the send-back can
   reuse it where the invite flag is on; the chart card can carry the Sun
   sign and label only, with the receiver adding positions from their own
   entry. Until then, stop putting the label in the send-back and card codes.
6. **Row 12, the retired transit calendar feed.** The site no longer offers
   it and the handler answers 410, but calendar apps that subscribed earlier
   keep sending the code in the query on every refresh. Nothing in a link
   can change this. Smallest fix: confirm the host's request log retention
   and that no log drain forwards query strings; optionally answer the path
   with 410 in `vercel.json` so the request never reaches a function log.
7. **Row 13, the site's occasion card link.** The largest open gap. For a
   birth occasion the fragment holds the full birth date with the year, the
   time, coordinates to 4 decimals, the place label and the names, and the
   button is offered. The assistant (row 14) and the saved path already
   refuse this. Smallest fix in `cardLink` in `OccasionSky.tsx`: for a kind in
   `BIRTH_OCCASIONS` copy the bare `/occasions/` address; for every kind drop
   `n` and `place` and round coordinates to 2 decimals, matching
   `occasionCardUrl`. Then stop reading `n` and `place` in `readLink`.
8. **Rows 15, 16, 21 and 22, older inbound share links.** The server already
   303s these to an address without the retired keys, but the first request
   with the names, place, pass days or year has already reached the server
   and its request log. No link change can stop old links arriving. Smallest
   fix: the same log check as item 6.
9. **Row 27, the birthday report share.** The Sun sign with the tarot year
   card narrows the birth date to a few dates. Smallest fix: drop `t` from
   the link and draw the shared card from the sign and score only.
10. **Row 34, `#b=` on the milestones page.** The site makes no such link,
    but the page accepts a birth date in the fragment and leaves it in the
    address bar. Smallest fix: stop reading `#b=`, or clear the fragment
    with `history.replaceState` right after reading it, as the calculator
    does.

Count: 34 rows. Flagged: rows 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 15,
16, 21, 22, 27 and 34 (18 rows). Of these, rows 7, 12, 15, 16, 21 and 22 are
inbound only: the site no longer makes that form, but the server still
receives it. Row 11 fits the link rule but is noted because the server holds
positions until the invitation expires.

## Rows outside the new-work rule but not breaches

Row 14 (occasion date, time and rounded coordinates), row 17 (month and
day, which the house rule allows) and row 28 (the return year and two more
signs) carry more than a card ID or a Sun sign. They carry no birth detail
under the current rules, so they are not flagged. New work should not copy
their pattern.

## What was checked, and what was not

- Read in full: `src/lib/share.ts`, `src/lib/share-positions.ts`,
  `src/lib/share-positions-noon.ts`, `src/islands/ChartShareDialog.tsx`,
  `api/calendar/transits.ts`, `src/islands/CalendarSubscribe.tsx`,
  `src/lib/occasions/saved-path.ts`, `src/islands/OccasionSky.tsx`,
  `src/ai-tools/share-links.ts`, `src/lib/share-results.ts`,
  `src/lib/chart-handoff.ts`, `src/lib/share-synastry.ts`,
  `src/lib/profile/card-link.ts`, `src/lib/sharing/private-invite.ts`,
  `src/lib/profile/saved-result-link.ts`, and the rewrites in `vercel.json`.
- Searched `src/` and `api/` for `location.hash`, `location.search`,
  `#p=`, `#c=`, `encodeChartLink(`, `encodeSharedPositionsLink(`, clipboard
  writes, and every `...ShareUrl` builder, then read each caller.
- Generated bundles (`api/_ai/runtime.mjs`, the developer plugin's
  `server.mjs`) were not audited line by line; they are built from the
  `src/ai-tools/` sources read above.
- Files that are not links are out of scope: the chart images from the share
  dialog (with birth details shown only when the person turns off "hide
  birth details") and the browser-built `.ics` download, whose note already
  says its times give back the birth time.
- Request bodies are out of scope: the hosted assistant tools and the
  compute API (`POST` only) take birth details in the body, not in a link.
- The wing's endpoints carry no personal birth detail and were not listed.
- Not verified here: what the host actually keeps in its request logs, and
  for how long. The "Server or log sees it" column says what can reach them.
- Open, outside links: commit #963 kept older saved-page and chart sync rows
  readable. Saved pages made before it may still hold addresses of the kinds
  in rows 13 and 14; that is a stored-data question for a separate ticket.
- `src/islands/CalendarSubscribe.tsx` still takes `positions` and
  `birthDate` props and documents the retired feed, though it now only
  builds the file download. Harmless, but the comments describe a link the
  site no longer makes.
