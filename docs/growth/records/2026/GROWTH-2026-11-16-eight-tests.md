---
record_id: GROWTH-2026-11-16-eight-tests
record_type: experiment
status: approved
owner: site owner (Dias)
created: 2026-11-12
updated: 2026-11-12
decision_due: 2026-12-16
source_window: 2026-09-01..2026-11-15
source_locations:
  - https://zodiacs.org/
  - https://zodiacs.org/birth-chart/
  - docs/ANALYTICS.md
  - src/lib/web-analytics.mjs
  - src/layouts/Base.astro
  - src/lib/analytics-config.mjs
  - docs/growth/state/README.md
  - docs/growth/records/2026/GROWTH-2026-09-01-vercel-web-analytics-flag.md
  - portfolio audit, final-audit.md, section 4 (Tests) and section 5 (eight-week plan)
related_urls:
  - https://zodiacs.org/your-2027-sky/
related_records:
  - GROWTH-2026-09-01-vercel-web-analytics-flag
  - GROWTH-2026-08-01-private-aggregate-measurement
evidence_quality: low
privacy_class: aggregate-only
decision: pending
next_action: Dias supplies the baseline exports and decides the analytics settings and Proposal A before Mon 16 Nov 2026
---

# Eight tests: scoreboard, 16 Nov 2026 to 10 Jan 2027

**The rule.** If a test gets too few people to judge, the verdict is "reach
problem", and the fix is traffic, not the offer.

**How the kill numbers are applied.** Each condition in a kill number is
applied exactly as written and on its own. Where a condition names a volume
("after 1,500 result-page viewers", "with 1,000 landing visits"), that
condition is judged only once its own volume is reached. Where it names none,
it is judged as written, whatever the volume. One condition's volume never
gates another condition.

| Test | Kill conditions, each judged separately | Volume named in the condition |
|---|---|---|
| T1 | (a) "Fewer than 40 confirmed after 1,500 result-page viewers"; (b) "a click rate under 4% in weeks 3 and 4" | (a) 1,500 result-page viewers; (b) none |
| T2 | (a) "Under 1% buying after 500 completers"; (b) "fewer than 8 orders by day 30 with 1,000 landing visits" | (a) 500 completers; (b) 1,000 landing visits by day 30 |
| T3 | (a) "Fewer than 80 checks after 1,000 page views"; (b) "calendar adds under 5%" | (a) 1,000 page views; (b) none |
| T4 | One joint condition: "Under 0.05 per card after 150 cards, and fewer than 3 paid" | 150 cards |
| T5 | "Two 4.3(b) rejections and a failed appeal by 31 Jan 2027" | none |
| T6 | "Fewer than 6 of 30 active in week 3" | none (record how many of the 30 installed) |
| T7 | One joint condition: "A median under 150 views and under 15 signups after 60 posts" | 60 posts |
| T8 | "Under 1% after 300 referred visits" | 300 referred visits |

"Too few people to judge" means: by the verdict date the success number is
not met, no kill condition has been met, and at least one kill condition could
not be judged because its own volume was not reached. That verdict is "reach
problem". A condition whose inputs cannot be measured at all (a `null` by
design, see Proposal A) is written "not measurable", which is a measurement
problem, not a reach problem.

Every number on this page was written down on 12 Nov 2026, before any test
starts. Unknown values are written as `null`, never as zero. A `null` cell in a
weekly table means "not yet read" or "could not be measured", not "nothing
happened". All counts on this page are aggregate. This scoreboard and the
analytics events it reads hold no visitor identifier, visitor journey, email
address, sign or birth detail. (The email provider does keep each confirmed
contact's address, and may keep the sign they chose, in order to send the
note; this page only takes its total count.)

## Key dates

| Date | What happens |
|---|---|
| Mon 16 Nov 2026 | Planned start of T1, T3, T4, T7 (and T2 if it is ready; the audit says "ideally 20 Nov to 20 Dec"). Only T1 is expected to start that day. T3 waits for the good day finder to be merged and switched on, T4 for its page (plan: week 3), T7 for its first post (plan: week 2). Week 1 of the plan: "Switch analytics on and take a fresh baseline." |
| Mon 30 Nov 2026 | T5: submit by this date |
| Mon 7 Dec 2026 | Three-week read of T1 to T4 for any of them that started 16 Nov (16 Nov to 6 Dec). A test that started later is read on its own start plus 21 days. T6 starts by this date |
| Wed 16 Dec 2026 | Verdict date for every 30-day test that started 16 Nov. A test that started later gets its verdict on its own day 30 (start date plus 30 days) |
| Mon 28 Dec 2026 | T6 day 21, if it starts on 7 Dec |
| Sun 10 Jan 2027 | Owned reach count. Target 500, floor 150 |
| Sun 31 Jan 2027 | T5's kill deadline, as written in its kill number |

## 1. Is analytics running? Live check, 12 Nov 2026

Fetched at 11:35 UTC (18:35 Bangkok) on 12 Nov 2026 with `curl`, reading the
public HTML only. No secret, `.env` file or dashboard was read.

| Page | HTTP | Plausible loader (inline block that builds `window.zodiacsAnalytics` with `transformRequest` and appends the remote script marked `data-zodiacs-remote-analytics`) | Vercel pageview loader (`window.va('beforeSend', ...)` and `/_vercel/insights/script.js`) | `data-guide-analytics-boundary` on `<html>` | `data-account-sync-v2` on `<html>` |
|---|---|---|---|---|---|
| https://zodiacs.org/ | 200 | absent | absent | absent | present |
| https://zodiacs.org/birth-chart/ | 200 | absent | absent | absent | present |
| https://zodiacs.org/moon-phase/ (content page, not an account surface; fetched 11:50 UTC) | 200 | present, with a Plausible script address | absent | n/a | present |
| https://zodiacs.org/your-2027-sky/ (fetched 11:50 UTC; a `privateSurface` page, see Proposal A) | 200 | absent | absent | n/a | present |

The home, birth chart and 2027 sky pages carry only the always-present stub
`window.zodiacsAnalytics = ... Object.freeze({ track: function () {} })`, which
is a silent no-op. No request leaves those pages for Plausible or Vercel.

**What this does and does not show.** The home and birth chart pages are marked `accountSurface` in
the source (`src/pages/index.astro:105`, `src/pages/birth-chart/index.astro:129`),
and the live `data-account-sync-v2` attribute shows account sync v2 is built on.
`src/layouts/Base.astro:153` then excludes both loaders from these pages,
whatever the environment holds. So on these two pages analytics is off by
design, and the fetch cannot tell whether `PUBLIC_PLAUSIBLE_SCRIPT_URL` or
`PUBLIC_VERCEL_WEB_ANALYTICS` is set for the rest of the site. To settle that,
a follow-up fetch of a content page that is not an account surface
(/moon-phase/) found the Plausible loader with a Plausible script address, so
`PUBLIC_PLAUSIBLE_SCRIPT_URL` is set in production. No Vercel pageview loader
was found on any page, so Vercel Web Analytics is not on.

Supporting evidence from the repository: the Vercel record
`GROWTH-2026-09-01-vercel-web-analytics-flag` is still `status: proposed`,
which means the owner's switch-on steps were not recorded as done. The final
audit says the only traffic exports are dated 28 to 30 Sep 2026, covering July
and August, and "I do not know whether analytics is still switched on."

**Result for week 1: Plausible is running on content pages; Vercel Web
Analytics is off.** The pages most of the tests depend on cannot report: home,
birth chart and the other account surfaces while account sync v2 is on, and
the `privateSurface` year pages (`/year-score/`, `/your-2027-sky/`) always; see
Proposal A.

### Settings Dias would set (not set by this ticket)

`PUBLIC_PLAUSIBLE_SCRIPT_URL` is already set (seen live on 12 Nov). The rest stay as they are unless Dias decides otherwise.
All are build-time `PUBLIC_` variables in the Vercel project `zodiacs-org`,
production environment, and need a redeploy to take effect.

| Setting | Value | Required |
|---|---|---|
| `PUBLIC_PLAUSIBLE_SCRIPT_URL` | The script address Plausible gives for the site (Plausible > zodiacs.org > Site settings > Site installation) | Yes, for every product event in this scoreboard |
| `PUBLIC_PLAUSIBLE_ENDPOINT` | The event endpoint, only if a first-party or self-hosted endpoint is used | Optional |
| `PUBLIC_PLAUSIBLE_DOMAIN` | The site identifier as registered in Plausible (normally `zodiacs.org`) | Optional |
| `PUBLIC_VERCEL_WEB_ANALYTICS` | `1`, and Web Analytics enabled on the project (Vercel > zodiacs-org > Analytics > Enable). Then the four steps in `GROWTH-2026-09-01-vercel-web-analytics-flag`, including the privacy pages' "last updated" date | Optional; pageviews only, never product events |

After switch-on, the runbook step in `docs/ANALYTICS.md` applies: redeploy and
verify the events without adding properties. Each event below must also be
added as a goal in Plausible (Site settings > Goals, custom event), with its
property keys added where Plausible asks for them, or it will not show in the
dashboard.

## 2. Pass and fail numbers, word for word from the final audit, section 4

Copied without edits. Where these cells say "buying", they mean paid orders
for the personal 2027 calendar.

| Test | Start | Duration | Success number | Kill number | Three-week read | Verdict date |
|---|---|---|---|---|---|---|
| T1 Monday Note | Mon 16 Nov 2026 | 30 days | 150 confirmed subscribers and a week-4 click rate of 10% or more | Fewer than 40 confirmed after 1,500 result-page viewers, or a click rate under 4% in weeks 3 and 4 | Mon 7 Dec 2026 | Wed 16 Dec 2026 |
| T2 2027 calendar | When it goes on sale (target 20 Nov 2026; null until known) | 30 days, ideally 20 Nov to 20 Dec | 25 paid orders and 2.5% or more of score completers buying | Under 1% buying after 500 completers, or fewer than 8 orders by day 30 with 1,000 landing visits | Start plus 21 days (7 Dec only if it starts 16 Nov) | Day 30 (20 Dec 2026 if it starts 20 Nov) |
| T3 Good Day | Planned Mon 16 Nov 2026; actual null until the finder is merged and on | 30 days | 300 completed checks (site plus hosted tool), 20% added to a calendar, 25 note signups from the page | Fewer than 80 checks after 1,000 page views, or calendar adds under 5% | Mon 7 Dec 2026 if it starts 16 Nov, otherwise start plus 21 days | Wed 16 Dec 2026, or day 30 if it starts later |
| T4 Birthday card loop | Planned Mon 16 Nov 2026; actual null until the page is live (plan: week 3) | 30 days | 200 cards made; 0.15 new makers or subscribers per card; 10 paid gift codes | Under 0.05 per card after 150 cards, and fewer than 3 paid | Mon 7 Dec 2026 if it starts 16 Nov, otherwise start plus 21 days | Wed 16 Dec 2026, or day 30 if it starts later |
| T5 App Review probe | Submission date (by 30 Nov 2026) | Submit by 30 Nov; expect 1 to 3 weeks | Approved within two submissions | Two 4.3(b) rejections and a failed appeal by 31 Jan 2027: ship the web version first | Not applicable | First approval, or 31 Jan 2027 |
| T6 Thirty testers | By Mon 7 Dec 2026 | 21 days of use, starting by 7 Dec | 12 of 30 open it on 4 or more days in week 3; 40% say "very disappointed" without it; 5 tap to start the annual trial | Fewer than 6 of 30 active in week 3 | Not applicable | Day 21 (28 Dec 2026 if it starts 7 Dec) |
| T7 Videos to list | Planned Mon 16 Nov 2026; actual null until the first post (plan: week 2) | 30 days | A median of 500 views a post by week 4 and 75 note signups tagged to video | A median under 150 views and under 15 signups after 60 posts | Mon 7 Dec 2026 if it starts 16 Nov, otherwise start plus 21 days | Wed 16 Dec 2026, or day 30 if it starts later |
| T8 Assistant store hook | The day either listing is approved (null until then) | 30 days after either listing is approved | 5% of referred visits subscribe or add a calendar | Under 1% after 300 referred visits | Start plus 21 days | Day 30 |

The source rows in the audit start "All start Monday 16 Nov 2026 unless noted",
so a start date above that differs from 16 Nov comes from the row's own
duration cell or from the eight-week plan. "Planned" dates are provisional:
when a test actually starts, write its start date here and shift its
three-week read, verdict date and weekly table dates to match.

## 3. Owned reach on Sun 10 Jan 2027

"500 people reachable without Google, X or Apple (confirmed email plus calendar
plus testers). Floor: 150. These are goals to judge against, not forecasts."

| Part | Where it is counted | Start (16 Nov 2026) | 10 Jan 2027 |
|---|---|---|---|
| Confirmed email subscribers | The email provider's contact list (Resend), confirmed contacts only | null | null |
| Calendar subscribers and imported calendars | `calendar_subscribe`, `calendar_download`, `good_day_calendar_add` and `year_pack_unlocked` count actions, not people; record them as an upper bound | null | null |
| Testers | TestFlight testers with the build installed | null | null |
| **Total** | Sum of the three | null | null |
| Target / floor | | | 500 / 150 |

## 4. Weekly tables

Events are the P6.1 names (being added on a separate branch) plus the existing
`assistant_arrival`. Their closed values: placements `note_page`, `good_days`,
`year_score`, `birthday_card`, `chart`, `horoscopes`, `footer`; sources
`direct`, `video`, `chatgpt`, `assistant`, `card`, `app`, `note`. Weeks run
Monday to Sunday and are read on the Sunday, as in the eight-week plan. For
Plausible counts, write both the event total and its unique visitors; unique
visitors are deduplicated per day only, so a weekly unique figure can count one
person more than once.

### T1 Monday Note

Feeds the numbers:
- Capture shown: `email_capture_viewed` by `placement` (`chart`, `horoscopes`, `footer`, `note_page`).
- Signups: `email_subscribed` by `placement` and `source`. This counts accepted opt-in requests, not confirmations.
- Confirmed subscribers: the email provider's confirmed contact count (not an analytics event).
- Result-page viewers (kill number denominator): unique visitors on `chart_computed` with `source` `fresh`. Blocked while Proposal A stands.
- Click rate: the provider's broadcast report for each Monday note.

| Week | Dates | `email_capture_viewed` (chart / horoscopes / footer / note_page) | `email_subscribed` (chart / horoscopes / footer / note_page) | Confirmed, cumulative | Result-page viewers, cumulative | Note click rate |
|---|---|---|---|---|---|---|
| 1 | 16 to 22 Nov | null | null | null | null | null |
| 2 | 23 to 29 Nov | null | null | null | null | null |
| 3 | 30 Nov to 6 Dec | null | null | null | null | null |
| 4 | 7 to 13 Dec | null | null | null | null | null |
| Close | 14 to 16 Dec | null | null | null | null | null |

### T2 2027 calendar

Feeds the numbers:
- Score completers: `year_score_completed`. **Not measurable while Proposal A stands**: `/year-score/` is a `privateSurface` page, so Base.astro never loads analytics there.
- Offer clicks: `year_pack_cta` by `surface` (`year_score`, `year_sky`, `birthday_report`, `birthday_card`). **Not measurable** for `year_score` (`/year-score/`), `year_sky` (`/your-2027-sky/`, all locales, `privateSurface` through `YearSkyPage.astro`) and `birthday_report` (`/birthday-report/`, `privateSurface`). Only `birthday_card` can count, and only if that page, not yet built, loads analytics.
- Paid orders: the payment provider's count of paid orders, which is authoritative. `year_pack_unlocked` by `kind` (`self`, `gift`) counts only if it fires on a page that loads analytics; on the two year pages it would not.
- Landing visits: pageviews of the landing page path. **Not measurable** if the landing page is `/year-score/` or `/your-2027-sky/`: neither Plausible nor Vercel loads there.
- Signups from the score: `email_subscribed` with `placement` `year_score`. **Not measurable** on `/year-score/`.

So both T2 kill conditions and the "2.5% or more of score completers" half of
its success number are "not measurable" as the site stands. Only "25 paid
orders" can be read, from the payment provider. See Proposal A for the options.

Start date: null. The table counts days from the actual start.

| Week | Dates | `year_score_completed` (not measurable) | `year_pack_cta` by surface (only `birthday_card` measurable) | `year_pack_unlocked` (self / gift) | Paid orders (provider) | Landing visits (not measurable on the year pages) | Paid orders / completers (not measurable) |
|---|---|---|---|---|---|---|---|
| 1 | days 1 to 7 | null | null | null | null | null | null |
| 2 | days 8 to 14 | null | null | null | null | null | null |
| 3 | days 15 to 21 | null | null | null | null | null | null |
| 4 | days 22 to 28 | null | null | null | null | null | null |
| Close | days 29 to 30 | null | null | null | null | null | null |

### T3 Good Day

Feeds the numbers:
- Completed checks on the site: `good_day_check`, with the device-kept `use` bucket (`first`, `second`, `more`) and `source`.
- Completed checks in the hosted tool: the hosted tool's call count (not a site event). Its source is to be named when the finder ships; null until then.
- Calendar adds: `good_day_calendar_add` by `source`.
- Note signups from the page: `email_subscribed` with `placement` `good_days`.
- Page views: pageviews of the good day page.

Start date: null until the finder is merged and switched on. The dates in the
table are provisional (a 16 Nov start); shift them to the actual start. The
good day page is not built yet: its events count only if the page is built
without `privateSurface` or `accountSurface`, which also decides whether T8 can
credit its calendar adds.

| Week | Dates | `good_day_check` (first / second / more) | Hosted tool checks | `good_day_calendar_add` | Calendar adds / checks | `email_subscribed` good_days | Page views |
|---|---|---|---|---|---|---|---|
| 1 | days 1 to 7 (provisional: 16 to 22 Nov) | null | null | null | null | null | null |
| 2 | days 8 to 14 (provisional: 23 to 29 Nov) | null | null | null | null | null | null |
| 3 | days 15 to 21 (provisional: 30 Nov to 6 Dec) | null | null | null | null | null | null |
| 4 | days 22 to 28 (provisional: 7 to 13 Dec) | null | null | null | null | null | null |
| Close | days 29 to 30 (provisional: 14 to 16 Dec) | null | null | null | null | null | null |

### T4 Birthday card loop

Feeds the numbers:
- Cards made: `birthday_card_made` by `source` (`direct`, `card`).
- New makers per card: `birthday_card_made` with `source` `card`, divided by all cards made.
- New subscribers per card: `email_subscribed` with `placement` `birthday_card` or `source` `card`.
- Arrivals from a card: `birthday_card_arrival`.
- Reminders: `birthday_reminder_added`.
- Gift interest and paid gift codes: `birthday_gift_cta`, then `year_pack_unlocked` with `kind` `gift`. The payment provider's count of paid gift codes is authoritative.

Start date: null until the page is live. The dates in the table are
provisional (a 16 Nov start); shift them to the actual start. The card page is
not built yet: its events count only if it is built without `privateSurface` or
`accountSurface`.

| Week | Dates | `birthday_card_made` (direct / card) | `birthday_card_arrival` | `email_subscribed` (birthday_card or source card) | (new makers + subscribers) / cards | `birthday_reminder_added` | `birthday_gift_cta` | Paid gift codes |
|---|---|---|---|---|---|---|---|---|
| 1 | days 1 to 7 (provisional: 16 to 22 Nov) | null | null | null | null | null | null | null |
| 2 | days 8 to 14 (provisional: 23 to 29 Nov) | null | null | null | null | null | null | null |
| 3 | days 15 to 21 (provisional: 30 Nov to 6 Dec) | null | null | null | null | null | null | null |
| 4 | days 22 to 28 (provisional: 7 to 13 Dec) | null | null | null | null | null | null | null |
| Close | days 29 to 30 (provisional: 14 to 16 Dec) | null | null | null | null | null | null | null |

### T5 App Review probe

Feeds the numbers: no site event. Source: App Store Connect review status and
messages.

| Week | Dates | Submissions to date | Status | 4.3(b) rejections to date | Appeal filed / outcome |
|---|---|---|---|---|---|
| 1 | 23 to 29 Nov | null | null | null | null |
| 2 | 30 Nov to 6 Dec | null | null | null | null |
| 3 | 7 to 13 Dec | null | null | null | null |
| 4 | 14 to 20 Dec | null | null | null | null |
| Later | to 31 Jan 2027 | null | null | null | null |

### T6 Thirty testers

Feeds the numbers: no site event. Installs from TestFlight; days opened from a
count kept on each tester's device (never an identifier); the "how
disappointed" answers from the day-21 survey; trial taps from the app. Leads
from the note list can be seen in `email_subscribed` with `source` `app` or
`note` only as a count.

Start date: null (by 7 Dec 2026).

| Week of use | Dates | Testers installed | Active on 4 or more days this week | "Very disappointed" (of answers) | Trial taps |
|---|---|---|---|---|---|
| 1 | days 1 to 7 | null | null | null | null |
| 2 | days 8 to 14 | null | null | null | null |
| 3 | days 15 to 21 | null | null | null | null |

### T7 Videos to list

Feeds the numbers:
- Views per post: TikTok and Instagram's own post analytics (not a site event).
- Note signups tagged to video: `email_subscribed` with `source` `video`.
- Capture shown to video arrivals: `email_capture_viewed` with `source` `video`.

Start date: null until the first post (plan: week 2). The dates in the table
are provisional (a 16 Nov start); shift them to the actual start.

| Week | Dates | Posts (TikTok / Instagram) | Posts, cumulative | Median views a post | `email_capture_viewed` source video | `email_subscribed` source video, cumulative |
|---|---|---|---|---|---|---|
| 1 | days 1 to 7 (provisional: 16 to 22 Nov) | null | null | null | null | null |
| 2 | days 8 to 14 (provisional: 23 to 29 Nov) | null | null | null | null | null |
| 3 | days 15 to 21 (provisional: 30 Nov to 6 Dec) | null | null | null | null | null |
| 4 | days 22 to 28 (provisional: 7 to 13 Dec) | null | null | null | null | null |
| Close | days 29 to 30 (provisional: 14 to 16 Dec) | null | null | null | null | null |

### T8 Assistant store hook

Feeds the numbers:
- Referred visits: `assistant_arrival` by `assistant` (`chatgpt`, `assistant`).
- Subscribes: `email_subscribed` with `source` `chatgpt` or `assistant`.
- Calendar adds: `good_day_calendar_add` with `source` `chatgpt` or `assistant`. The older `calendar_subscribe` and `calendar_download` carry no source and cannot be credited to T8.

Start date: null until either listing is approved.

| Week | Dates | `assistant_arrival` (chatgpt / assistant) | `email_subscribed` (chatgpt / assistant) | `good_day_calendar_add` (chatgpt / assistant) | (subscribes + calendar adds) / referred visits |
|---|---|---|---|---|---|
| 1 | days 1 to 7 | null | null | null | null |
| 2 | days 8 to 14 | null | null | null | null |
| 3 | days 15 to 21 | null | null | null | null |
| 4 | days 22 to 28 | null | null | null | null |
| Close | days 29 to 30 | null | null | null | null |

## 5. Baseline, 1 Sep to 15 Nov 2026

To be filled from the exports Dias provides (section 6). Every value starts as
`null`. Write the source and the export date beside each value. If a tool has
no data for part of the window because its loader was off, write `null` and say
so; do not write zero.

| Measure | Plausible | Vercel Web Analytics | Google Search Console |
|---|---|---|---|
| Unique visitors, whole window | null | null | not applicable |
| Unique visitors by month (Sep / Oct / 1 to 15 Nov) | null | null | not applicable |
| Pageviews, whole window | null | null | not applicable |
| Top 10 sources | null (see Proposal B) | null | not applicable |
| Top 20 pages | null | null | null (by clicks) |
| Search clicks | not applicable | not applicable | null |
| Search impressions | not applicable | not applicable | null |
| Average click-through rate | not applicable | not applicable | null |
| Average position | not applicable | not applicable | null |
| Top 20 queries by clicks | not applicable | not applicable | null |
| Days in the window the tool was collecting | null | null | null |

For comparison only, the final audit's figures for July and August 2026
(confirmed in its section 9): 220 visitors in July and 415 in August, summed
by month; 53 from X, 5 from Instagram, 8 from search, all from Yandex; Search
Console showed one click. The repository does not record which tool produced
those exports.

## 6. What Dias needs to provide

Only tools the code or docs show in use are listed. The code supports Plausible
(`src/layouts/Base.astro`, `docs/ANALYTICS.md`) and Vercel Web Analytics
(`src/lib/web-analytics.mjs`); the final audit cites a Search Console export.
Each line names the export and a read-only way to give access instead. Either
is enough. Exports and links stay private; nothing here is posted.

1. **Plausible** (live: the loader is on content pages such as /moon-phase/).
   - Export: Plausible > zodiacs.org > Dashboard > date picker > Custom range,
     1 Sep 2026 to 15 Nov 2026 > Export (the download control on the
     dashboard; it gives a CSV zip with visitors, sources, pages, countries,
     devices, goals and properties).
   - Read-only alternative: a shared link (Site settings > Visibility > Shared
     links > New link, with a password), or a Viewer seat (Site settings >
     People > Invite member, role Viewer).
   - Also say: whether the site is still subscribed, and which goals exist.
2. **Vercel Web Analytics** (team `zodiacsofficial`, project `zodiacs-org`).
   - Export: Vercel > zodiacsofficial > zodiacs-org > Analytics tab, date range
     1 Sep 2026 to 15 Nov 2026, or the longest range the plan allows (write
     down which). Use the export control if the tab offers one; otherwise
     full-page screenshots of the Visitors and Page Views totals and the Pages
     and Referrers panels.
   - Read-only alternative: a team seat with the Viewer role, if the team's
     plan allows extra members.
   - Also say: whether the tab shows Web Analytics as enabled on the project
     (one of the two switch-on conditions).
3. **Google Search Console** (the zodiacs.org property, domain or URL prefix,
   whichever exists).
   - Export: Search Console > zodiacs.org > Performance > Search results >
     Date > Custom, 1 Sep 2026 to 15 Nov 2026 > Export > Download CSV (a zip
     with Queries, Pages, Countries, Devices, Search appearance and Dates).
     Search Console data lags by about two days, so the export is complete
     from about 17 Nov.
   - Read-only alternative: Settings > Users and permissions > Add user, with
     the Restricted permission.
4. **The July and August exports.** If they came from a tool other than the
   three above, name it, so section 5 can add a column for it.

## 7. Tracking settings that look wrong (proposals only; nothing changed)

**Proposal A. The pages T1, T2 and T8 depend on are excluded from
analytics.** `Base.astro:153` keeps both loaders off two kinds of page:

- Every `accountSurface` page while account sync v2 is on (live since #990):
  the home pages in every locale, the birth chart, moon sign, rising sign,
  transits, today, learn, solar and lunar return, compatibility pairs and the
  horoscope sign pages.
- Every `privateSurface` page, always: among them `/year-score/`
  (`src/pages/year-score/index.astro:39`), `/your-2027-sky/` in every locale
  (`src/components/year-sky/YearSkyPage.astro:63`; the live fetch above
  confirms no loader), `/birthday-report/`, the profile pages and `/ask/`.

What that removes from this scoreboard ("not measurable" until it changes):
- T1: the `chart` and `horoscopes` placements of `email_capture_viewed` and
  `email_subscribed`, and the kill-number volume "1,500 result-page viewers"
  (from `chart_computed`). T1 kill condition (a) is not measurable; condition
  (b), the click rate, still is, from the email provider.
- T2: `year_score_completed`, `year_pack_cta` on the `year_score`, `year_sky`
  and `birthday_report` surfaces, `email_subscribed` with placement
  `year_score`, `year_pack_unlocked` if it fires on either year page, and
  pageviews of either year page as "landing visits". Both T2 kill conditions
  and the completer share in its success number are not measurable; only the
  paid order count is, from the payment provider.
- T8: any `assistant_arrival` when an assistant link lands on one of these
  pages, so referred visits are undercounted.
- T3 and T4: their pages are not built yet. Their events count only if those
  pages are built without either flag.

The exclusion is a deliberate privacy boundary (a saved chart or a typed birth
date never shares a page with an analytics script), so it should not be
loosened casually. Options for Dias, before 16 Nov:
- (a) run T1 on the placements that can be counted (`footer` on content pages,
  `note_page`), write the excluded placements as "not measurable", and judge
  T2 on paid orders alone;
- (b) count the few numbers the tests need (accepted signups per placement,
  score completions, offer clicks, year page visits) on the server, as one
  aggregate number per day, with no remote script on the page and nothing
  from the visitor's birth details;
- (c) a privacy review of a narrower exclusion.

Recommendation: (a) for 16 Nov, and decide (b) before T2 goes on sale, since
without it T2 cannot reach a verdict on its kill numbers.

**Proposal B. Plausible's Sources report will read "Direct / None" for every
visit.** The shim sets the referrer to `null` and replaces the page address
with its canonical path, which also drops any UTM tags (`Base.astro`,
`transformRequest`). This is the accepted privacy decision of 1 Aug 2026 and
should stay. The consequence: sources for the tests come only from the closed
`source` value in the P6.1 events, and the baseline's "sources" row cannot come
from Plausible. Read sources from Vercel or Search Console only.

**Proposal C. Check what Vercel Web Analytics sends before it is switched on.**
The Vercel record says the counter receives "page path only; no query string,
fragment, referrer-derived visitor data". The `beforeSend` hook strips only the
query and fragment from the URL. Vercel's dashboard has a Referrers panel, so
confirm whether its script sends the referring page. If it does, either update
`GROWTH-2026-09-01-vercel-web-analytics-flag` and the privacy pages to say so,
or keep the flag off.

**Proposal D. `docs/ANALYTICS.md` describes events that cannot fire.** It says
Registry lot pages emit `wing_record_view` and `wing_acquisition_click`, and in
the same file that static wing pages "remain analytics-free". The lot pages
call `window.plausible` only when it already exists, and no loader is on them,
so those events never send. The same table omits `assistant_arrival`, which is
on the allowlist (`src/lib/analytics-config.mjs:18`) and fired from
`Base.astro`. Correct the document; no code change needed.

**Proposal E. Add the Plausible goals before 16 Nov.** Each P6.1 event and
`assistant_arrival` has to exist as a custom-event goal in Plausible, with its
property keys, before the first event arrives, or the weekly tables cannot be
read from the dashboard.
