# Link audit, November 2026 (ZOD-114, plan key P6.9)

Read at `origin/main` 1853a6814 on 12 November 2026, revised the same day
after review, and again after `7d005c477` (pull request 985) landed later that
day. This is a report only: nothing in the site was changed, switched or
deployed for it. Revised on 13 November 2026 for two later fixes: row 30's
saved result links now carry a random row id (the row was wrong to say a
digest of the saved result fit the rule), and row 7's older form answers
410.

## The question

The house rule is that no link carries a birth detail. The site makes many
kinds of link. This report lists every kind found in the code, says what
each one carries, whether that data sits in the query (sent to the server)
or after the `#` (kept in the browser), whether a server, a log or a third
party can see it, and whether the site still offers it. Rows that carry a
birth detail, or positions that give one back, are flagged with the
smallest fix.

## The rule for new work

**A card link carries a card ID or a Sun sign only.** A card ID is an
opaque, random or digest value that names something the site already holds
(a saved result, an invitation, a published person's slug); it is never
derived from, and never decodes to, a birth date, time, place, name or chart
positions. Anything else a card shows is drawn from the site's own data or
from what the person enters on their own device, not from the link.

Every recommended fix below leaves a link that carries a card ID, a Sun
sign, or nothing personal.

## How to read the table

- **Data in.** *Query* means the part after `?`, or a path segment; the
  browser sends it to the server with the request. *Fragment* means the part
  after `#`; browsers never send it to a server, never put it in a
  `Referer` header, and link preview bots never see it. A fragment can
  still sit in the sender's chat history, the receiver's browser history
  and any browser extension's view of the address bar. A fragment can also
  reach a server another way: a server that builds a link knows its
  fragment and may store it (row 30), and a page may copy a fragment value
  into a later request's query (row 11).
- **Seen by.** Whether the data reaches a Zodiacs server function, the
  host's request logs or the CDN cache key, or a third party (an email
  provider, a sign-in provider, a social app).
- **House rule.** *FLAG* when the link carries a birth detail or positions
  that give one back. *FLAG (inbound)* when the site no longer makes that
  form but the server still receives it. *OK* otherwise.
- **New-work rule.** *Fits* when the link carries a card ID, a Sun sign or
  nothing personal. *Outside* when it carries more without breaking the
  house rule. *n/a* for links that are not card or share links (sign-in,
  email, embeds).
- **Positions.** Where a row says the positions "give back" the birth date
  and time: the v2 code keeps the twelve bodies to 0.001 degrees at the
  chart's UTC instant rounded to the whole minute, so the birth date and
  time can be solved from it to the minute; a chart without a birth time
  carries the sky at 12:00 UTC on the birth date, which gives the date.
  ASC and MC at the whole degree narrow the birthplace to a band. This is
  stated in the code itself (`src/lib/share-positions.ts`, lines 160 to
  175, and `api/calendar/transits.ts`, lines 1 to 4).
- Placeholders only: `YYYY-MM-DD`, `HH:MM`, `MM-DD`, `<code>`, `<sign>`,
  `<id>`.

Legend for *Carries*: **D** birth date, **T** birth time, **P** birthplace
(coordinates, time zone or label), **N** names, **X** chart positions that
give back D and T, **S** Sun sign (or other signs), **O** an occasion
date, **ID** an opaque identifier.

## How the server reads share links

This corrects the first version of this report, which said an unknown key
makes every share link invalid. In the deployed Node entry
(`handleResultShareNodeRequest` in `src/server/result-preview.ts`):

- A route with retired keys (compatibility, occasion, milestone, Chinese
  zodiac) is answered first from the whole raw query: a retired key, or a
  birth occasion, gets a 303 to an address without it.
- **Share pages skip keys they do not use** (for example `fbclid` or
  `utm_source` added by an app), so the page still opens. The skipped key
  still arrived with the request, so it reaches the function and the
  request log, and it stays in the address bar. A repeated known key opens
  the page without a result.
- **Image and story routes refuse** an unknown or repeated key with 400.
- The birthday report's retired `py` key is refused on both: the image
  answers 400, the page opens without a result.

So a share page will open with any extra key attached, including one that
someone has added by hand with a birth detail in it. The site does not make
such links, but it does not refuse them either.

## The table

### Chart links

| # | Link kind (shape) | Where it is made | Data in | Carries | Seen by | Still offered | House rule | New-work rule |
|---|---|---|---|---|---|---|---|---|
| 1 | v1 chart link with birth details: `/birth-chart/#c=1.<code>` (optional `&subject=other`) | `src/islands/ChartShareDialog.tsx` "Copy link with birth details" (`detailsUrl`, built by `shareUrl()` in `src/islands/ChartCalculator.tsx` through `chartHandoffFragment`, codec `src/lib/share.ts`) | Fragment | D, T (when known), P (zone, coordinates to 4 decimals, place label up to 40 characters), N (up to 24 characters), house system | No server. The calculator reads it and clears the fragment on arrival | Yes, the second button in the share dialog, labelled as including birth details | **FLAG** | Outside |
| 2 | v1 in-site hand-off: `/birth-chart/#c=1.<code>` as a link or navigation | `ChartCalculator.tsx` "Get your birth chart" link (short modes); `BigThreeQuick.tsx`; `MoonPhaseTool.tsx` (with a place); `WelcomeBack.tsx` (reopen a saved chart); `SomeoneElseChart.tsx` | Fragment | D, T, P (with place label); N on `WelcomeBack` (the saved chart's name) and `SomeoneElseChart` | No server. Cleared on arrival, but the address can stay in browser history on that device, and the visible link can be copied | Yes | **FLAG** | Outside |
| 3 | "Someone else" hand-off: `/birth-chart/someone-else/#mine=1.<code>` | `someoneElseHandoffPath` in `src/lib/chart-handoff.ts`, used by `ChartCalculator.tsx` | Fragment | D, T, P, N of the person's own chart | No server. Cleared by `SomeoneElseChart.tsx` on arrival | Yes | **FLAG** | Outside |
| 4 | Two-person compatibility hand-off: `/compatibility/#a=1.<code>&b=1.<code>`, or `/compatibility/?a=<id>#b=1.<code>` | `compatibilityHandoffPath` in `src/lib/chart-handoff.ts`, used by `ChartCalculator.tsx` and `SomeoneElseChart.tsx` | Fragment for the birth inputs; query for an opaque saved chart id | D, T, P, N for one or two people; the query part is ID only | Fragment: no server. Query: the saved id only | Yes | **FLAG** | Outside |
| 5 | Date hand-off: `/birth-chart/#date=YYYY-MM-DD&time=HH:MM` (or `time=unknown`) | `dateHandoffFragment` (`MoonPhaseTool.tsx` without a place); the birthday page form `src/components/birthday/BirthdayChartForm.astro` builds the same two keys | Fragment | D, T | No server. Cleared on arrival | Yes | **FLAG** | Outside |
| 6 | v2 positions link: `/birth-chart/#p=2.<code>` (localized receivers too) | `ChartShareDialog.tsx` "Copy positions link" (the primary share link), `encodeSharedPositionsLink` in `src/lib/share-positions.ts`; also as in-site navigation from `SomeoneElseChart.tsx` (`&subject=other`) and `ProfilePeople.tsx` | Fragment | X (12 bodies at 0.001 degrees, ASC and MC to the whole degree when timed), house system, engine version. No D, T, P or N field, but the positions give D and T back and narrow P | No server. Cleared on arrival | Yes, the primary chart share link | **FLAG** | Outside |
| 7 | Chart preview link: `/api/og/chart?sun=&moon=&rising=&houses=` with `#p=2.<code>`; older form `/api/og/chart?p=2.<code>`; image `/api/og/chart-image?...` | `src/server/chart-preview.ts`, `src/lib/share-preview.ts` (rewritten in `vercel.json` to `/api/compatibility?__zodiacs_og_route=link`) | Query (whole-degree Sun, Moon, rising); the older form puts the full v2 code in the query | Newer: whole-degree Sun, Moon and rising, which narrow D to a short list of dates and narrow T. Older: X in full | Server function and request log, both forms. Since 13 November 2026 the older form is retired: any request with `p` gets 410 Gone (no-store) and a short page linking to `/birth-chart/`; the code is not decoded, drawn, put in an `og:image` address or passed on. The image route already answered `p` with a 303 to the default share picture | No producer left in `src/`; the server answers the newer form, and the older form only with 410 | **FLAG (inbound)** | Outside |
| 8 | Two-chart send-back: `/compatibility/#s=s1.<code>` | `src/islands/synastry/SendBackExperience.tsx`, codec `src/lib/share-synastry.ts` | Fragment | X for two people, two labels (N, up to 24 characters each), time-known bits | No server. Cleared by `SynastryCalculator.tsx` on arrival | Yes | **FLAG** | Outside |
| 9 | Private compatibility invite: `/compatibility/#p=2.<code>` | `src/islands/PrivateCompatibilityInvite.tsx`, `src/islands/PrivateInviteResultControl.tsx`, `privateInviteToken` in `src/lib/sharing/private-invite.ts` | Fragment | X of the inviting person | No server | Yes | **FLAG** | Outside |
| 10 | Chart card: `/profile/#card=c1.<code>` | `src/islands/ProfileIdentity.tsx`, codec `src/lib/profile/card-link.ts` | Fragment | X, a label (N), time-known bit | No server. `ProfileCardInbox.tsx` strips it and stores it only on the receiving device if the reader adds it | Yes | **FLAG** | Outside |
| 11 | Server-held invitation: `/c/<43 random characters>/`, which answers 303 to `/compatibility/#invite=<handle>` | `src/lib/invite/routes/invites.ts`; copied by `synastry/InviteExperience.tsx` and `ProfileInvites.tsx`; exchange in `src/lib/invite/routes/invite-exchange.ts` | Path (the random value); fragment (the handle), then query: `src/islands/synastry/inviteClient.ts` sends the handle on as `/api/compatibility/invite-session?session=<handle>` and `/api/compatibility/invite-complete?session=<handle>` (a `POST` with an empty body) | ID only, in every step. The server holds the invitation's label, Sun sign, positions and expiry (`src/lib/invite/validate.ts`) | The random value and the handle both reach the server and its request log: the server issues the handle in the 303, and the page sends it back in a query. The positions are held server-side until expiry | Behind `COMPAT_INVITES_ENABLED` | OK (note: the server holds positions) | Fits |
| 12 | Saved comparison: `/compatibility/?a=<id>&b=<id>`, `/compatibility/?pair=<id>` | `savedCompareHref` and `openCardComparison` in `src/lib/profile/people-compare.ts` | Query | ID only (device-local saved chart and saved pair ids). The pair itself, kept on the device, is not in the link | Server and request log see the ids only | Yes | OK | Fits |
| 13 | Transit calendar feed (retired): `/api/calendar/transits?token=2.<code>` | Formerly `CalendarSubscribe.tsx`; handler `api/calendar/transits.ts` | Query | X (the v2 code) | Every refresh from a calendar app that subscribed before retirement still sends the code in the query, so it can reach the host's request log. The handler answers 410 to everything and logs nothing itself | No. The UI now offers a `.ics` file built in the browser instead (a file, not a link) | **FLAG (inbound)** | Outside |

### Occasion links

| # | Link kind (shape) | Where it is made | Data in | Carries | Seen by | Still offered | House rule | New-work rule |
|---|---|---|---|---|---|---|---|---|
| 14 | Occasion card link from the site: `/occasions/#o=<kind>&d=YYYY-MM-DD&n=<names>&t=HH:MM&tz=<zone>&lat=&lon=&place=<label>` | `cardLink` in `src/islands/OccasionSky.tsx` ("Copy the card's link") | Fragment | O with year, names (up to 60 characters), time, zone, coordinates to 4 decimals, place label. For the three birth occasions in `BIRTH_OCCASIONS` (`src/lib/occasions/saved-path.ts`) the date is a birth date, so this is D, T, P and N | No server | Yes, for the occasions the picker still offers, including a birthday. As of pull request 985, a new baby or a coming of age is not in the picker (`PICKER_OCCASION_KINDS` in `src/lib/occasions/picker.ts`). An old link that names one is cleared from the address bar and makes no card | **FLAG** | Outside |
| 15 | Occasion card link from the assistant, and a saved occasion page: `/occasions/#o=<kind>&d=YYYY-MM-DD&t=HH:MM&tz=<zone>&lat=&lon=` | `occasionCardUrl` in `src/ai-tools/tools.ts`; `savedOccasionPath` in `src/lib/occasions/saved-path.ts` | Fragment | O, time, zone, coordinates to 2 decimals. Never names or a place label. No link at all for a birth occasion | No navigation request carries it. But the assistant builds it on the server, and a saved occasion is stored as this whole address, fragment included, in the account's saved pages (see row 30) | Yes | OK | Outside |
| 16 | Occasion share: `/share/occasion/?o=<kind>&d=YYYY-MM-DD&sun=&moon=&score=&v=&c=` and its images | `occasionShareUrl` in `src/lib/share-results.ts`, called from `src/ai-tools/tools.ts` for non-birth occasions only | Query | O, signs, score. Older links also carried `n` (names) and `p` (place), and could name a birth occasion | Server and request log. Older links' names, place and a birth occasion's date arrive before the 303 in `retiredLinkRedirect` clears them | Yes (new form) | New form OK. **FLAG (inbound)** for older links | Outside |

### Share pages with a preview (`/share/...`, server rendered)

All of these are query links read by `src/server/result-preview.ts` through
the rewrites in `vercel.json`, so the server and its request log see every
value. See "How the server reads share links" above for what happens to a
key a route does not use.

| # | Link kind (shape) | Where it is made | Data in | Carries | Seen by | Still offered | House rule | New-work rule |
|---|---|---|---|---|---|---|---|---|
| 17 | Compatibility: `/share/compatibility/?as=&bs=&score=&attraction=&communication=&stability=&v=&c=` | `compatibilityShareUrl` (`src/lib/share-results.ts`), from `src/ai-tools/features/compatibility.ts` | Query | S for two people, scores. Older links carried first names (`a`, `b`) | Server and log. Older names arrive before the 303 drops them | Yes | New form OK. **FLAG (inbound)** for older links (N) | Outside |
| 18 | Birthday: `/share/birthday/?d=MM-DD&s=<sign>` | `birthdayShareUrl` (`src/ai-tools/share-links.ts`), from `src/ai-tools/features/birthday.ts`; also the 303 target for an older birthday occasion link | Query | Month and day, never a year; the sign only for a cusp date | Server and log | Yes | OK (the house rule allows a birthday link to carry the month and day) | Outside |
| 19 | Big three: `/share/big-three/?s=&m=&r=` | `bigThreeShareUrl`, from `src/ai-tools/features/natal-chart.ts` | Query | S (Sun; Moon and rising only when settled) | Server and log | Yes | OK | Outside when `m` or `r` is present; Fits with `s` alone |
| 20 | Chart twins: `/share/chart-twins/?s=&m=` | `chartTwinsShareUrl` | Query | S (Sun; Moon when settled) | Server and log | Yes | OK | Outside when `m` is present |
| 21 | Famous chart: `/share/famous-chart/?p=<slug>` | `famousChartShareUrl` | Query | ID (a published person's directory slug) | Server and log | Yes | OK | Fits |
| 22 | Life milestone: `/share/milestone/?k=&i=&a=` | `milestoneShareUrl` | Query | Kind, ordinal, age. Older links carried `f` and `l`, the first and last days of the passes, which lead back to the birth date | Server and log. Older `f` and `l` arrive before the 303 drops them | Yes (new form) | New form OK. **FLAG (inbound)** for older links | Outside |
| 23 | Chinese zodiac: `/share/chinese-zodiac/?a=<animal>` | `chineseZodiacShareUrl` | Query | The animal only. Older links carried `y`, a year that could be a birth year | Server and log. Older `y` arrives before the 303 drops it | Yes (new form) | New form OK. **FLAG (inbound)** for older links | Outside |
| 24 | Invite preview: `/share/invite/?s=&p=` | `inviteShareUrl` | Query | S for up to two people | Server and log | Yes | OK | Fits |
| 25 | Sky calendar: `/share/sky-calendar/?k=&b=&d=YYYY-MM-DD` | `skyCalendarShareUrl` | Query | A public sky event and its date | Server and log | Yes | OK | Fits (nothing personal) |
| 26 | Horoscope: `/share/horoscope/?s=&d=` (or `w=`, `m=`, `y=`, optional `f=`) | `horoscopeShareUrl`, `horoscopePeriodShareUrl` | Query | S and a publication date | Server and log | Yes | OK | Fits |
| 27 | Year Ahead Score: `/share/year-score/?s=&v=` or `?p=<slug>` | `src/lib/year-score/share.ts`, from `YearScoreCalculator.tsx` and `src/ai-tools/features/year-score.ts` | Query | S and score, or a published figure's slug | Server and log | Behind `PUBLIC_YEAR_SCORE_ENABLED` | OK | Outside (`v`, the score); Fits with `p` |
| 28 | Birthday report: `/share/birthday-report/?s=&v=&t=` | `src/lib/birthday-report/share.ts`, from `BirthdayReport.tsx` | Query | S, score, and `t`, the tarot year card. The module's own comment says the card "narrows the birthday to a few dates within the sign" | Server and log | Behind `PUBLIC_BIRTHDAY_REPORT_ENABLED` | **FLAG** (narrows D) | Outside |
| 29 | Solar return: `/share/solar-return/?s=&y=&r=&j=` | `src/lib/solar-return/share.ts`, from `SolarReturnResult.tsx` and `src/ai-tools/features/solar-return.ts` | Query | S, the return's year, the return chart's rising sign and Jupiter's sign | Server and log | Behind `PUBLIC_SOLAR_RETURN_SHARE_ENABLED` | OK | Outside |

### Identifier, sign and site links

| # | Link kind (shape) | Where it is made | Data in | Carries | Seen by | Still offered | House rule | New-work rule |
|---|---|---|---|---|---|---|---|---|
| 30 | Saved result: `/birth-chart/#saved=<id>`, `/occasions/#saved=<id>`, `/compatibility/<pair>/#saved=<id>`, `/horoscopes/#week=YYYY-MM-DD&saved=<id>`, forwarded to `/profile/#saved=<id>` | Built on the server by the assistant's save tool (`src/ai-tools/accounts/save.ts`); pattern in `src/lib/profile/saved-result-link.ts` | Fragment | ID: the saved row's own id, a random UUID, since 13 November 2026 (migration `20261113091500_saved_link_row_ids.sql`). Corrected: before that the value was the first 16 hex digits of an unkeyed SHA-256 of the stored record, and a saved week's record is worked out from the birth date, so someone holding the link could test guessed birth dates against it; that was Outside, not Fits. The migration rewrites those old 16 hex values (and no other `saved=` value) to the row id in stored links and in the stored record's copy, leaving a field unchanged only where a UUID would push that field past its size limit (so `href` can change while an oversized record copy keeps the old value) (counted by `docs/platform/accounts/saved-link-ids-verify.sql`), and an old 16 hex value now opens only the plain profile page. The week's start date is a publication date | Two different things. **Stored:** the server builds the whole address, fragment included, and stores it as `href` in the account's saved pages (`savedPageRpcArgs` in `src/ai-tools/accounts/service.ts`); a saved occasion stores the row 15 address the same way. **Logged on a visit:** a later navigation to the link sends no fragment, so a request log sees only the path | Yes | OK | Fits |
| 31 | Saved chart hand-off: `#profileChartId=<uuid>`, `#mineId=<id>&mineSource=profile` | `src/lib/chart-handoff.ts`; `ProfileManager.tsx`, `LearningSavedEntry.tsx`, `ProfilePeople.tsx`, `ChartCalculator.tsx` | Fragment | ID | No server | Yes | OK | Fits |
| 32 | Sign and selection query: `?sun=<sign>` on the profile, `?sign1=&sign2=` on compatibility, `?sel=<element>` on the birth chart | `ProfileSunSignCapture.tsx`, `PrefilledPairNotice.tsx` (the readers); `ChartCalculator.tsx` writes `sel` (a body, sign, house or aspect name) into the address | Query | S; `sel` names one element of the chart on screen | Server and log, on a reload or a copied address | Yes | OK | Fits (`sel` is not a card link) |
| 33 | Event transits: `/transits/?at=<ISO instant>` | `eventTransitHref` in `src/lib/events/transit-link.ts`, from `src/components/events/EventPageLayout.astro`; read by `TransitTracker.tsx` | Query | The instant of a published sky event, never the visitor's | Server and log | Yes | OK | Fits (nothing personal) |
| 34 | Developer playground: `/developers/playground/?example=<id>` or `?endpoint=<name>`, and with the option on, `#request=<base64url request>` | `shareLink` in `src/lib/developer-playground.ts`, from `src/islands/DeveloperPlayground.tsx` ("Put the request in the link", off by default) | Query for the example or endpoint; fragment for the request | With the option on, the whole compute request as typed, which for a chart is D, T and P (coordinates, zone). The page reads it with `readLink` and does not clear the fragment | No server for the fragment | Yes, as an opt-in checkbox | **FLAG** | n/a |
| 35 | Widget embeds: `/embed/<moon or sky or chart>/?theme=&accent=` | `widgetEmbedUrl`, `iframeEmbedCode`, `scriptEmbedCode` in `src/lib/widgets.ts` | Query | Theme and an accent colour. The chart widget (`MiniBirthChartWidget.tsx`) computes inside the frame and makes no link with what is typed; its outbound "powered by" link carries only `utm_` campaign keys | Server and log; the host site whose page embeds the widget, and its visitors' browsers | Yes | OK | n/a |
| 36 | Social share: `https://x.com/intent/post?text=`, `https://wa.me/?text=`, `https://t.me/share/url?url=&text=`, `mailto:?subject=&body=` | `src/components/ShareRow.astro`, on sign guides, birthday pages, horoscope pages, published People pages and published Year Ahead figures | Query (of the third party's address) | The page's public address and a line of page text, both fixed at build time. A birthday page address is the month and day; a People page names a published public figure. No visitor input | The third party (X, WhatsApp, Telegram, the mail client) | Yes | OK | Fits |
| 37 | Sign-in return: `redirectTo` = `/auth/callback/?next=<same-site path>`; the provider returns to `/auth/callback/?next=...&code=<one-time code>` (an error may come as `error` in the query or the fragment) | `oauthRedirectTo` and `readOAuthCallback` in `src/lib/auth/oauth-config.ts`, started by `continueWithProvider` (`src/lib/auth/oauth.ts`) from `OAuthButtons.tsx` | Query | `next` is a same-site path; the only caller passes `/profile/`. `code` is a one-time code | Supabase and the sign-in provider (Google or Apple) see `redirectTo`; the callback page's request log sees `next` and `code` | Behind `PUBLIC_AUTH_GOOGLE` and `PUBLIC_AUTH_APPLE` (off unless set) | OK (note below) | n/a |

### Email links

All of these sit in the query of a link inside an email, so the email
provider that sends the message, the recipient's mail service and the
server's request log see the whole link.

| # | Link kind (shape) | Where it is made | Data in | Carries | Seen by | Still offered | House rule | New-work rule |
|---|---|---|---|---|---|---|---|---|
| 38 | Weekly email confirmation: `/api/email/confirm?token=v2.<iv>.<ciphertext>.<tag>` | `src/lib/email/provider.ts`, value from `src/lib/email/opt-in-token.ts` | Query | Encrypted (AES-256-GCM) claim holding the email address, an optional Sun sign and an expiry. The older readable signed form was accepted only until 2026-08-31 | Email provider, mail service, server and log; only the server can read the claim | Yes | OK | n/a |
| 39 | Daily Sun-sign email confirmation: `/api/email/confirm?token=<encrypted>` | `src/lib/email/provider.ts`, value from `src/lib/email/daily-sun-token.ts` | Query | Encrypted (AES-256-GCM) claim holding the email address, the Sun sign and an expiry | As row 38 | Yes | OK | n/a |
| 40 | Daily chart email confirmation: `/api/email/confirm?token=<payload>.<signature>` | `src/lib/email/daily-resend.ts`, value from `createDailyChartOptInToken` in `src/lib/email/daily-chart-token.ts` (called by `api/email/chart-preference.ts`) | Query | **Readable** base64url JSON, signed but not encrypted: user id, saved chart id, recipient hash, the delivery time zone (`z`) and an expiry. The time zone choices offered in `ProfileManager.tsx` include each saved chart's birthplace zone, so `z` can be the birthplace's time zone | Email provider, mail service, server and log, and anyone who reads the link | Yes | **FLAG** (P, when the delivery zone is the birth zone) | n/a |
| 41 | Daily email unsubscribe: `/api/email/unsubscribe?token=<payload>.<signature>` | `dailyUnsubscribeUrl` in `src/lib/email/daily-unsubscribe-token.ts` | Query | Readable signed JSON: the list kind (Sun or chart), a contact id or user id, and the recipient hash | As row 40 | Yes | OK | n/a |
| 42 | Weekly digest unsubscribe: `/api/unsubscribe?token=<43 random characters>` | `scripts/send-weekly-digest.ts`; handler `api/unsubscribe.ts` | Query | ID (a random value looked up by the database) | Email provider, mail service, server and log | Yes | OK | n/a |
| 43 | Public sky calendar file: `/sky-calendar.ics` (and localized copies) | Static file, headers in `vercel.json` | None | Nothing personal | Ordinary request | Yes | OK | Fits |

### Fragments the site reads but never makes

| # | Link kind (shape) | Read by | Data in | Carries | Seen by | Still offered | House rule | New-work rule |
|---|---|---|---|---|---|---|---|---|
| 44 | Milestones page arrival: `/occasions/milestones/#b=YYYY-MM-DD` | `src/islands/LifeMilestones.tsx` | Fragment | D. The page does not clear the fragment after reading it, so it stays in the address bar | No server | No producer found in the site or the assistant tools; the page still accepts it | **FLAG** | Outside |
| 45 | Baby shower page arrival: `/occasions/baby-shower/#due=YYYY-MM-DD&n=<names>` | `src/islands/BabyShowerSky.tsx` | Fragment | A date and names (up to the page's name limit). The page fills the names in and does not clear the fragment | No server | No producer found; the page still accepts it. As of pull request 985 the page is noindex and nofollow, and is out of the sitemap and navigation, but it stays reachable at this address | **FLAG** (N) | Outside |

## Flagged rows and the smallest fix

Every fix below is a recommendation for a later ticket. None was made here.
Each one leaves a link that carries a card ID, a Sun sign, or nothing
personal.

1. **Row 1, v1 "Copy link with birth details".** The only share button that
   puts the full birth input, the name and the place label into a link on
   purpose. Smallest fix: remove the button from `ChartShareDialog.tsx`
   (stop passing `detailsUrl`). Keep `decodeChartLink` so links already sent
   still open.
2. **Rows 2 to 5, in-site hand-offs carrying v1 codes or a date and time.**
   They move a chart from one page to the next, and each receiver clears the
   fragment, but the address is a real link: it can be copied and can stay
   in browser history. Smallest fix: one hand-off helper that writes the
   input to `sessionStorage` under a random one-time key and puts only
   `#h=<random>` in the address, read once and deleted; the pattern
   `profileChartId` already uses for saved charts. The callers in
   `chart-handoff.ts` and `BirthdayChartForm.astro` switch to it.
3. **Row 6, the v2 positions link (the primary chart share).** It has no
   birth field, but its positions give the birth date and time back to the
   minute and narrow the birthplace. Smallest fix: make the dialog's link
   button copy a link that carries the Sun sign only. The big three share
   page already opens with `s` alone (`/share/big-three/?s=<sign>`, no `m`
   and no `r`). Keep the `#p=` receiver for links already sent.
4. **Row 7, the chart preview route.** Nothing in the site makes it any
   more. Smallest fix: add `chart` to the retired families so
   `/api/og/chart` answers 303 to `/birth-chart/` with the query dropped,
   and the image route answers 303 to the default share image, as
   `retiredLinkRedirect` already does for other families. Done for the
   older form on 13 November 2026, the way the transit calendar feed was
   retired: `/api/og/chart` with `p` answers 410 Gone, no-store, with a
   short page linking to `/birth-chart/` and nothing from the request
   (`retiredChartLink` in `src/server/chart-preview.ts`); the image route
   keeps its 303. Each old link still reaches the request log once per
   open, as item 6 says for the calendar feed.
5. **Rows 8, 9 and 10, two-chart send-back, private invite and chart card.**
   Each carries positions that give back the birth date and time, and rows
   8 and 10 a name label. Smallest fix: each link carries a card ID only.
   Row 11 already works this way (a random path value; the server holds the
   positions until the invitation expires), so the private invite and the
   send-back can reuse it. The chart card becomes a card ID the same way, or
   a Sun sign only, with no label in the link: the receiver names the card
   on their own device.
6. **Row 13, the retired transit calendar feed.** The site no longer offers
   it and the handler answers 410, but calendar apps that subscribed earlier
   keep sending the code in the query on every refresh. Nothing in a link
   can change this. Smallest fix: confirm the host's request log retention
   and that no log drain forwards query strings; optionally answer the path
   with 410 in `vercel.json` so the request never reaches a function log.
7. **Row 14, the site's occasion card link.** The largest open gap. For a
   birth occasion the fragment holds the full birth date with the year, the
   time, coordinates to 4 decimals, the place label and the names, and the
   button is offered. As of pull request 985 the picker no longer offers a
   new baby or a coming of age, and an inbound link that names one is
   cleared from the address bar and makes no card. A birthday is still
   offered, and its copied link still carries those birth details.
   Smallest fix in `cardLink` in `OccasionSky.tsx`: for
   every occasion kind, copy a card ID (row 15 and row 30 show the
   stored-address pattern), a Sun sign only, or the bare `/occasions/`
   address, which carries nothing. Stop reading birth details, names,
   occasion dates, times, zones and coordinates from the fragment. This
   meets the rule for new work for every occasion kind.
8. **Rows 16, 17, 22 and 23, older inbound share links.** The server already
   303s these to an address without the retired keys, but the first request
   with the names, place, pass days or year has already reached the server
   and its request log. No link change can stop old links arriving.
   Smallest fix: the same log check as item 6.
9. **Row 28, the birthday report share.** The Sun sign with the tarot year
   card narrows the birth date to a few dates. Smallest fix: the link
   carries the Sun sign only (drop `t` and `v`); the shared page draws from
   the sign.
10. **Row 34, the developer playground's "Put the request in the link".**
    A chart request typed there holds a birth date, time and place, and the
    option puts all of it after the `#`. Smallest fix: remove the option
    and the `#request=` reader, so the link names the example or endpoint
    only.
11. **Row 40, the daily chart email confirmation.** Its readable payload
    can name the birthplace's time zone. The server already stores the
    pending time zone with the confirmation's hash
    (`replacePendingDailyChartPreference` in `api/email/chart-preference.ts`),
    but today the confirm handler still reads `z` from the link: it requires
    the stored zone to equal the link's (`matchesPendingChartRequest`,
    `api/email/_confirm.ts` line 176) and passes the link's zone to
    `consumePendingDailyChartPreference` (line 397). Smallest fix: drop `z`
    from the payload (the remaining fields are ids and a hash) and have the
    confirm handler take the zone from the pending row it already finds by
    the token's hash. The alternative is to make the confirmation a random
    value looked up by its hash, like row 42. Links already sent with `z`
    expire within 48 hours (`DAILY_CHART_OPT_IN_TTL_MS`).
12. **Row 44, `#b=` on the milestones page.** Smallest fix: stop reading
    `#b=`; if it stays, clear it with `history.replaceState` right after
    reading, as the calculator does.
13. **Row 45, `#n=` on the baby shower page.** The page is hidden from
    discovery as of pull request 985, but it still accepts the fragment.
    Smallest fix: stop reading `n`, so no link can put names on that page.
    No other change is recommended for that page.

Count: 45 rows. Flagged: rows 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 14, 16,
17, 22, 23, 28, 34, 40, 44 and 45 (21 rows). Of these, rows 7, 13, 16, 17,
22 and 23 are inbound only: the site no longer makes that form, but the
server still receives it.

## Notes on rows that are not flagged

- **Row 11, the server-held invitation.** The links carry only random
  values, but they are not fragment-only: the handle travels on in the
  `session` query. The server holds the inviting person's positions until
  the invitation expires and is swept.
- **Row 30 and row 15, stored addresses.** A saved address is stored whole
  in the account's saved pages, fragment included. For saved results that is
  the row's own random id (a digest of the saved result until 13 November
  2026, see row 30); for a saved non-birth occasion it is the date, time, zone and
  two-decimal coordinates. Commit #963 kept older saved-page rows readable,
  so rows made before it may still hold addresses of the kind in row 14;
  that is a stored-data question for a separate ticket. If such a stored
  address names a new baby or a coming of age, opening it now shows the
  picker's notice and clears the fragment (`isHiddenOccasion` in
  `OccasionSky.tsx`).
- **Row 37, sign-in.** `safeReturnPath` keeps the query and the fragment of
  `next`. Today the only caller passes `/profile/`, so nothing leaks. If a
  later caller passed the current page address, a fragment such as row 14's
  would move into a query that Supabase, the sign-in provider and the
  request log all see. A later ticket could strip the fragment from `next`.
- **Rows 14 and 45 after pull request 985.** The picker no longer offers
  a new baby or a coming of age. An old card link that names one is
  cleared and makes no card. The baby shower page, the baby zodiac pages
  and the Almanac article on reading a child's chart stay built and
  reachable, marked noindex and nofollow, and are left out of the
  sitemap, the tools hub, the occasions list, the Almanac lists and the
  assistant guide (`src/data/hidden-child-pages.mjs`). None of that adds
  or removes a link kind in this table. Row 14 stays flagged because a
  birthday card link is still offered with birth details. Row 45 stays
  flagged because the baby shower page still reads names from the
  fragment.
- **Rows outside the new-work rule but not breaches.** Rows 15, 16 (new
  form), 17 (new form), 18, 19 and 20 (with a Moon or rising sign), 22 and
  23 (new forms), 27 (with a score) and 29 carry more than a card ID or a
  Sun sign but no birth detail under the current rules, so they are not
  flagged. New work should not copy their pattern.

## What was checked, and what was not

- Read in full: `src/lib/share.ts`, `src/lib/share-positions.ts`,
  `src/lib/share-positions-noon.ts`, `src/islands/ChartShareDialog.tsx`,
  `api/calendar/transits.ts`, `src/islands/CalendarSubscribe.tsx`,
  `src/lib/occasions/saved-path.ts`, `src/lib/occasions/picker.ts`,
  `src/data/hidden-child-pages.mjs`, `src/islands/OccasionSky.tsx`,
  `src/ai-tools/share-links.ts`, `src/lib/share-results.ts`,
  `src/lib/chart-handoff.ts`, `src/lib/share-synastry.ts`,
  `src/lib/profile/card-link.ts`, `src/lib/sharing/private-invite.ts`,
  `src/lib/profile/saved-result-link.ts`, `src/lib/profile/people-compare.ts`,
  `src/lib/events/transit-link.ts`, `src/lib/auth/oauth-config.ts`,
  `src/lib/widgets.ts`, `src/components/ShareRow.astro`,
  `src/lib/developer-playground.ts`, `src/lib/email/daily-chart-token.ts`,
  `src/lib/email/daily-unsubscribe-token.ts`, the Node entry of
  `src/server/result-preview.ts`, and the rewrites in `vercel.json`.
- Searched `src/` and `api/` for `location.hash`, `location.search`,
  `searchParams.set(`, `new URLSearchParams({`, `#p=`, `#c=`,
  `encodeChartLink(`, `encodeSharedPositionsLink(`, clipboard writes, and
  every `...ShareUrl` builder, then read each caller. The `searchParams`
  calls in `src/lib/daily-email/` and `src/lib/account-api/` build
  server-to-database requests, not links a person sees, so they are not
  rows.
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
  for how long. The "Seen by" column says what can reach them.
- `src/islands/CalendarSubscribe.tsx` still takes `positions` and
  `birthDate` props and documents the retired feed, though it now only
  builds the file download. Harmless, but the comments describe a link the
  site no longer makes.
