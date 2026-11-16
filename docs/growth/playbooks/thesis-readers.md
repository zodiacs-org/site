# Thesis readers

How to tell whether more people read the essay at `/thesis/` (ZOD-43).

## Baseline

Requests to each address in the week of 3 to 9 November 2026, from the
hosting platform's own logs. These are requests, not people, and they
include crawlers and our own checks.

| Address | Requests |
| --- | --- |
| `/` (home) | about 11,700 over 8 days |
| `/astrofolio/` | 144 over 8 days |
| `/thesis/` | 47 over 7 days |
| `/fomo/` | 35 over 8 days |

## Weekly requests to the thesis

Run this against the hosting platform's observability data (not the site's
analytics) once a week, and add the total to the weekly growth review as
"thesis requests this week".

```
metric:  vercel.request.count      aggregation: sum
scope:   project zodiacs-org
filter:  request_path eq '/thesis/'
range:   the last 7 full UTC days, daily buckets
```

Count `/thesis/` only: `/thesis` without the trailing slash redirects. A
30-day window with a group-by timed out on 10 November 2026; single-path,
7-day queries return in under a second.

## Where to read `thesis_click`

`thesis_click` is a site analytics event with one property, `source`, whose
only values are `astrofolio` and `fomo` (`src/lib/analytics-config.mjs`,
`docs/ANALYTICS.md`). Read it in the site's analytics dashboard under custom
events, split by `source`.

Today only the Fomo door can send it. `/astrofolio/` loads the Guide
assistant, so the build strips analytics from that page
(`scripts/configure-legacy-analytics.mjs`), and its new link text cannot be
counted there. Judge the Astrofolio change by the weekly request count above.

## Limits

1. Requests are not people. They include crawlers, previews and our own
   checks, so read the trend, not the number.
2. The thesis page itself carries no analytics and must stay that way: it
   hosts the Guide assistant, and no page that loads the assistant loads an
   analytics script.
