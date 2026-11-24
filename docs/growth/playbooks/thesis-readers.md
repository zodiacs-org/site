# Thesis readers

## Baseline

Vercel Observability recorded these requests in the November 2026 baseline.
The thesis window ran from 3 to 9 November, inclusive. The other totals
cover eight days, so keep their window lengths when comparing them.

| Request path | Requests | Days |
| --- | ---: | ---: |
| `/` | about 11,700 | 8 |
| `/astrofolio/` | 144 | 8 |
| `/thesis/` | 47 | 7 |
| `/fomo/` | 35 | 8 |

## Weekly request count

In Vercel Observability, run this query and add the seven daily buckets
to the weekly growth review as “thesis requests this week”.

```text
metric:  vercel.request.count      aggregation: sum
scope:   project zodiacs-org
filter:  request_path eq '/thesis/'
range:   the last 7 full UTC days, daily buckets
```

The exact path excludes requests to `/thesis`, which redirects. On 10
November 2026, a 30-day query with a group-by timed out. Single-path,
seven-day queries returned in under a second.

## Link clicks

In the Plausible dashboard for zodiacs.org, select the `thesis_click`
custom event under Goals, read total conversions, and break them down by
`source`. The allowed values are `astrofolio` and `fomo`. Only Fomo can
currently send the event. Astrofolio loads the Guide assistant, so its
build omits analytics. An empty Astrofolio row gives no evidence about how
often visitors used that link.

## Limits

1. Vercel counts requests, including repeat visits, crawlers and our own
   checks. The total cannot identify individual readers or attribute a visit
   to either link.
2. Keep `/thesis/` free of analytics. A source-page click measures intent to
   open the essay. Reading time, scroll depth and completion are unmeasured.
