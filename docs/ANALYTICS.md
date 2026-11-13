# Analytics

The analytics layer is a frozen, cookieless allowlist shim in
`src/layouts/Base.astro`. It forwards events to a Plausible-compatible script
only when `PUBLIC_PLAUSIBLE_SCRIPT_URL` is set. `PUBLIC_PLAUSIBLE_ENDPOINT`
optionally selects a first-party/self-hosted endpoint, and
`PUBLIC_PLAUSIBLE_DOMAIN` optionally supplies the site identifier. With the
script URL unset, the script is absent and `zodiacsAnalytics.track` is a
silent no-op.

The script is also absent from noindex pages, routes marked with Base's
`privateSurface` prop (including `/ask/`), and the account-v2 private preview.
The Guide exclusion is route- and tab-session-scoped rather than a site-wide
kill switch. `/ask/` never loads the remote script. On another consumer page,
opening Guide marks the browser tab private and reloads that document once.
The reloaded page skips the remote script, then reopens Guide, so the analytics
runtime and the private drawer never share a document. The tab remains private
for later pages in the same session. If session storage is unavailable, Guide
opens on the private `/ask/` route instead. Static Registry-wing pages that
host the Guide launcher remain analytics-free.

## Privacy invariant

Events carry fixed enums, counters, and booleans only. No birth data, free
text, identifiers, query strings, URL fragments, chart positions, email
values, or wallet addresses are forwarded. The shim replaces the browser URL
with its canonical path, always sets the outbound referrer to `null`, drops
events and property keys outside the allowlist, and drops string values longer
than 32 characters.

Never add an event or property that could carry a birth date, time, place,
coordinates, pasted address, or anything a visitor typed. A change to the
event list or its closed values needs the owner's dated yes and, when it
changes what is counted, the privacy page's description in the same change. The integration
uses no cookies, pixels, persistent/browser fingerprinting, or session
recording.

## Plausible daily-deduplication decision

Accepted on 2026-08-01, with a deliberately narrow boundary: Plausible may
briefly process the request IP address and User-Agent to derive a salted
site/device/day identifier for same-day aggregate deduplication. Plausible
states that it does not store the raw IP address or full User-Agent, rotates
and deletes the salt every 24 hours, and cannot link the identifier across
days or sites. Zodiacs.org and Growth OS must never receive that identifier or
use analytics to construct visitor journeys.

This is a disclosed exception for ephemeral aggregate counting, not a claim
that analytics involves no IP processing. It remains acceptable only while:

- outbound `payload.r` is `null` and the canonical URL has no query or fragment;
- properties remain allowlisted, coarse, and free of identity or chart data;
- no persistent, cross-day, cross-site, or operator-visible visitor ID exists;
- the public privacy explanation describes the transient IP/User-Agent processing; and
- a provider-method change triggers a new privacy review before deployment.

Provider sources: [Plausible data policy](https://plausible.io/data-policy) and
[Events API reference](https://plausible.io/docs/events-api).

## Vercel Web Analytics (flagged, pageviews only)

Added 2026-09-01 as a second, cookieless pageview counter so the weekly growth
review can report visitor counts from the hosting platform. It is off in
every build until the owner both enables Web Analytics on the Vercel project
and sets `PUBLIC_VERCEL_WEB_ANALYTICS=1`; `src/lib/web-analytics.mjs` is the
single source of that flag, and the English and localized privacy pages
describe the processor only when it is on.

Boundary, in the same terms as the Plausible decision above:

- pageviews only — the directive event taxonomy below still goes to Plausible
  through `zodiacsAnalytics.track`, never to Vercel;
- the loader in `src/layouts/Base.astro` applies the same surface exclusions
  as Plausible (noindex, private surfaces, the encrypted-sync preview, a
  private Guide session) and its `beforeSend` hook removes the query string and
  fragment from every pageview URL before it leaves the browser;
- Vercel identifies a visitor for same-day deduplication with a hash derived
  from the request (IP address and User-Agent) that is discarded after the
  day; no cookie, no persistent identifier, no cross-site identifier;
- the embeds stay analytics-free (`scripts/verify-widgets.mjs` rejects a
  Vercel insights loader as it rejects Plausible).

Turning the flag on is a provider-method change under the rule above and is
recorded in `docs/growth/records/2026/GROWTH-2026-09-01-vercel-web-analytics-flag.md`.

## Directive event taxonomy

| Event | Props | Fired when |
| --- | --- | --- |
| `chart_computed` | `mode`, `source` | A browser-computed or positions-only shared chart renders; `source` is `fresh`, `shared_details`, or `shared_positions` |
| `chart_saved` | `source` | A chart or comparison is saved locally |
| `compat_computed` | `source` | A compatibility comparison renders |
| `email_subscribed` | `placement`, `source` | An anonymous week-ahead opt-in request is accepted; the closed values are under "Growth test events" |
| `share_card_downloaded` | `variant` | A locally rendered PNG is downloaded or shared |
| `widget_embed_copied` | `widget`, `mode` | Embed code is copied from the widget generator |
| `registry_visit` | — | The Registry catalogue loads |
| `verifier_used` | `chain`, `outcome` | Paste-address verification completes |
| `terminal_view_switch` | `surface`, `direction` | A visitor follows the visible Terminal view switch or the saved-preference banner |
| `sdk_click` | `source`, `destination` | A Registry or astrology surface opens SDK documentation |
| `wallet_chart_computed` | `chain`, `holds_registry_asset` | A feature-flagged wallet chart renders |

`verifier_used` never includes the pasted address, and `email_subscribed`
never includes the email or selected sign.

`terminal_view_switch` accepts only `header` or `preference_banner` for
`surface`, and only `consumer_to_pro` or `pro_to_consumer` for `direction`.
It never records the selected sign, destination URL, stored preference, or
banner-dismissal state.

## Growth test events

Approved by the owner on 2026-11-12 (18:27 Bangkok) for the eight growth
tests, T1 to T8 (their pass and fail numbers are in the scoreboard,
`docs/growth/records/2026/GROWTH-2026-11-16-eight-tests.md`, added by P6.2):
a fixed list of events that records no email address, no star sign or Sun
sign, no birth date, time or place, no name and nothing typed. Every property
below has a closed list in `src/lib/analytics-config.mjs`; any other value,
any other property, any string over 32 characters and any unlisted event are
dropped, in `src/lib/analytics.ts` and again in the shim in `Base.astro`.
`src/lib/analytics.test.ts` holds that to be so for each of these events.

**None of the nine new events fires yet** (the two email events already
fire, now with closed placement and source values). The pages that call the
new events arrive in later changes, each of which adds its call and nothing else to this contract.

| Event | Props and closed values | Fires when |
| --- | --- | --- |
| `email_capture_viewed` | `placement`: `chart`, `horoscopes`, `footer`, `note_page`, `good_days`, `year_score`, `birthday_card`; `source`: the arrival list | A sign-up form first comes into view on a page (once per page view) |
| `email_subscribed` | `placement` and `source`, the same lists | The sign-up request is accepted |
| `good_day_check` | `use`: `first`, `second`, `more`; `source`: the arrival list | A good-day check finishes and shows its days |
| `good_day_calendar_add` | `source`: the arrival list | A visitor adds a day the check found to a calendar |
| `year_score_completed` | none | A Year Ahead Score result is shown |
| `year_pack_cta` | `surface`: `year_score`, `year_sky`, `birthday_report`, `birthday_card` | A visitor follows the year pack offer from that page |
| `year_pack_unlocked` | `kind`: `self`, `gift` | A year pack opens, for the buyer or from a gift code |
| `birthday_card_made` | `source`: `direct`, `card` | A birthday sky card link is made; `card` when the maker arrived from someone else's card |
| `birthday_card_arrival` | none | A birthday sky card link is opened |
| `birthday_reminder_added` | none | A birthday reminder is added to a calendar |
| `birthday_gift_cta` | none | A visitor follows the gift offer on a birthday card or report |

The two email events had only an open `placement` before; it is now closed,
and the site's existing forms send `chart`, `horoscopes` and `footer`, which
stay on the list. A form that sends no placement, or another one, is still
counted, without the property.

**Arrival source.** The `source` list is `direct`, `video`, `chatgpt`,
`assistant`, `card`, `app`, `note`. A link the site gives out may end in
`?ref=` and one of the six words after `direct`. The inline script in
`src/layouts/Base.astro` takes `ref` off the address as the page opens (as it
always has) and, when the word is on the list, keeps that word in session
storage (`zodiacs.arrival-source.v1`) for this browser tab only. Any other word
is dropped and never stored. A later page reads it with `readArrivalSource()`
from `src/lib/arrival-source.ts`, which answers `direct` when the tab holds no
listed word. It is a category shared by everyone who followed that kind of
link: no identifier, no free string, and gone when the tab closes.
A shared result page under `/share/` is drawn by the server outside
`Base.astro` and has no script: it accepts the same six words (any other word
opens it without its result), keeps `ref` in the address it was opened with,
and does not pass the word on to its links, so the next page opened from it
counts as `direct`.
`assistant_arrival` is unchanged and still counts only `chatgpt` and
`assistant`.

**Use bucket.** `good_day_check`'s `use` comes from `countGoodDayCheck()` in
`src/lib/use-count.ts`: a count in this browser's local storage
(`zodiacs.good-day-checks.v1`) that stops at 3, so the device holds at most
"a later one", never a history or a date. Only the bucket word goes into the
event. No identifier of any kind is created, and the count is never sent.

### What each test reads

| Test | Its numbers come from |
| --- | --- |
| T1 Monday Note | `email_capture_viewed` and `email_subscribed` by `placement`; result-page viewers from `chart_computed`; confirmations and click rate from the email provider, not analytics |
| T2 2027 calendar | `year_score_completed`, `year_pack_cta` by `surface`, `year_pack_unlocked` by `kind`; landing visits are pageviews |
| T3 Good Day | `good_day_check` (with `use` for the second-use bucket), `good_day_calendar_add`, `email_subscribed` with `placement` `good_days`; page views are pageviews |
| T4 Birthday card loop | `birthday_card_made` (by `source`), `birthday_card_arrival`, `birthday_reminder_added`, `email_subscribed` with `placement` `birthday_card`, `birthday_gift_cta`, `year_pack_unlocked` with `kind` `gift` |
| T5 App Review probe | App Review's answer; not site analytics |
| T6 Thirty testers | TestFlight and the testers' answers; not site analytics |
| T7 Videos to list | `email_subscribed` with `source` `video`; post views from the video platforms |
| T8 Assistant store hook | `assistant_arrival` for referred visits; `email_subscribed` and `good_day_calendar_add` with `source` `chatgpt` or `assistant` |

Counts are totals per event and value. None of them follows a visitor from
one page or one day to the next.

## Existing product vocabulary

The established five-locale product events remain allowlisted for continuity.
New directive code uses the taxonomy above.

| Event | Props | Fired when |
| --- | --- | --- |
| `result_rendered` | `mode` | A calculator renders a result |
| `explorer_interaction` | `mode`, `source` | The chart wheel is used by pointer or keyboard |
| `tour_start`, `tour_complete`, `tour_step` | `variant`, `variant`, `step` | Guided reading activity |
| `lens_change` | `lens` | The wheel changes time lens |
| `transit_search` | `span`, `bodies` | A transit range search runs |
| `srchart_view` | `via` | A solar-return chart renders |
| `composite_view` | — | The composite tab renders on compatibility |
| `grid_select` | — | An aspect-grid cell is selected |
| `chiron_toggle` | `on` | The Chiron overlay is toggled |
| `detail_toggle` | `to` | Birth-chart detail changes between plain/full |
| `chart_name_set` | `via` | A chart name is committed |
| `comm_read_view` | — | A communication reading renders |
| `chart_save` | `source` | Legacy local chart-save event |
| `chart_share` | `variant` | A share link/card is created |
| `search_open`, `search_go` | —, `kind` | Site search |
| `assistant_open`, `assistant_reply` | — | Site assistant |
| `push_prompt`, `push_subscribe` | — | Flag-gated notification scaffold |
| `today_view` | — | The today brief renders |
| `calendar_subscribe` | — | A transit calendar is subscribed |
| `wing_entry` | `source` | Legacy astrology-to-Registry click taxonomy |
| `registry_bridge_impression` | `sign`, `surface`, `locale` | An eligible chart, birthday, or sign-guide Registry bridge renders. The birth chart's bridge sends no `sign`: it is the visitor's own Sun sign |
| `registry_bridge_click` | `sign`, `surface`, `locale` | A visitor follows that Registry bridge; again no `sign` from the birth chart |

Registry bridge properties are closed, aggregate dimensions only: one of the
twelve sign slugs, `birth_chart` / `birthday` / `sign_guide`, and a released UI
locale. Birth date, time, place, coordinates, chart identifiers, URLs, and
free text are not accepted.

## Registry lot events

Registry-lot pages also emit `wing_record_view` and
`wing_acquisition_click`, each with the fixed sign slug only. They never
include wallet addresses or query strings. The Registry verifier and landing
page use the directive taxonomy above.

## Operator runbook

1. Provision Plausible cloud or a compatible self-hosted endpoint.
2. Set `PUBLIC_PLAUSIBLE_SCRIPT_URL`; optionally set
   `PUBLIC_PLAUSIBLE_ENDPOINT` and `PUBLIC_PLAUSIBLE_DOMAIN`.
3. Redeploy and verify the eleven directive events without adding properties.
