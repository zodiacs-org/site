---
record_id: GROWTH-2026-11-16-awareness-tests
record_type: experiment
status: approved
owner: site owner (Dias)
created: 2026-11-13
updated: 2026-11-13
decision_due: 2026-12-14
source_window: 2026-11-01..2026-11-12
source_locations:
  - Vercel observability, project zodiacs-org, metric vercel.request.count
  - npm downloads API, @zodiacs/engine and @zodiacs/sdk
  - GitHub, zodiacs-org/engine stars
  - GitHub Insights, Traffic (zodiacs-org/engine referring sites and views)
  - Google Search Console (once verified)
related_urls:
  - https://zodiacs.org/mercury-retrograde/2027/
  - https://zodiacs.org/full-moon-calendar/2027/
  - https://zodiacs.org/eclipses/2027/
  - https://zodiacs.org/birthday/
  - https://zodiacs.org/developers/engine/
  - https://zodiacs.org/mcp
related_records:
  - GROWTH-2026-11-16-eight-tests
  - GROWTH-2026-08-19-full-marketing-audit
evidence_quality: low
privacy_class: aggregate-only
decision: pending
next_action: Dias verifies Search Console and decides each submission and post; read week 4 on Mon 14 Dec 2026
---

# Awareness tests A, B and C: scoreboard, 16 Nov 2026 to 10 Jan 2027

Three tests of how people find zodiacs.org, run beside the eight product tests
in [GROWTH-2026-11-16-eight-tests](GROWTH-2026-11-16-eight-tests.md). These
test reach (how many arrive); the eight tests judge what happens after. The
same rule applies: too few people to judge is a reach problem.

Linear: ZOD-179 (plan), ZOD-180 (Test A), ZOD-181 (Test B), ZOD-182 (Test C).

Every number below is an aggregate count (requests, impressions, stars,
downloads or views), never a list of people, and nothing about any visitor
is stored to read it.

## Baselines (1 to 12 Nov 2026)

| Source | What was counted | Value |
| --- | --- | --- |
| Vercel logs | Googlebot requests, all paths, 1 to 12 Nov | 543 |
| Vercel logs | Bingbot requests, 1 to 12 Nov | 3,786 |
| Vercel logs | Requests from Claude users (`bot_name` claude-user), 6 to 12 Nov | about 5,200 (own testing included, share unknown) |
| Vercel logs | Claude user requests a day | about 60 (1 to 4 Nov), about 1,000 (10 to 12 Nov) |
| npm | Downloads in the month to 11 Nov | engine 675, sdk 564 |
| GitHub | zodiacs-org/engine stars, 13 Nov | 0 |
| Search Console | Impressions | not available (not verified) |

## Test A: Google search

**Change.** Four existing pages upgraded: Mercury retrograde 2027, full moon
calendar 2027, eclipses 2027 and the birthday pages. Each gets event times in
several time zones, a visible updated date, a fuller FAQ and its accuracy
check stated. No new pages. Dias verifies Search Console and submits the
sitemap.

**Read.** Week 4 is Mon 7 Dec to Sun 13 Dec 2026, read on Mon 14 Dec. Changed
pages can take 4 to 12 weeks to move in search, so a "too early" result is
read again on Sun 10 Jan 2027. The rows are checked in order and the first
that holds is the result.

| Result | Condition |
| --- | --- |
| Not measurable | Search Console still unverified on 14 Dec (crawls are then reported, with no verdict) |
| Pass | At least 1,000 Search Console impressions in week 4 for the four pages together, and at least 1,500 Googlebot requests site-wide in week 4 |
| Fail | Under 200 impressions for the four pages in week 4, and under 1,000 Googlebot requests site-wide |
| Too early | Anything else |

Impressions carry the verdict. Crawls are a supporting sign only: PR #1023
re-dates about 370 sitemap entries, which alone can raise crawling.

**Query.** Vercel observability, `vercel.request.count`, project
`prj_nRTO3q3aNYLfaM3dotAowOc028fO`, grouped by `bot_name`, daily, summed over
the week. Search Console: Performance, Pages, filtered to the four paths.

## Test B: AI assistants (reach only)

**Change.** The connector is already in the official MCP Registry
(`io.github.zodiacs-org/zodiacs`, published 8 Nov, see PR #925), which several
directories copy from. Three hand-made listings are drafted and wait on Dias's
yes for each: the awesome-remote-mcp-servers list on GitHub, PulseMCP and
mcp.so. The Claude directory and ChatGPT listings continue as before. Whether
assistant visitors subscribe is T8's question, not this one.

**Read.** Week 4 is 7 to 13 Dec, read on 14 Dec.

Rows are checked in order; the first that holds is the result. The fail line
sits at the 6 to 12 Nov baseline, which still includes our own testing, so it
is a cautious line: falling below it even after our calls are taken out is a
clear miss.

| Result | Condition |
| --- | --- |
| Not measurable | Week 4 holds a large burst of Claude user requests in an hour no log line covers |
| Pass | At least 8,000 Claude user requests in week 4, after taking out our own tests |
| Fail | Under 5,200 in week 4, after taking out our own tests |
| Too early | Anything else |

**Our own test calls.** The logs cannot tell our calls from anyone else's:
every Claude user request comes from the same kind of address. So every
session of ours that calls the Zodiacs connector (our agent sessions and
manual checks) adds a line to the log below with its UTC window. At the read,
requests inside logged windows are taken out using the hourly counts
(`vercel.request.count`, `bot_name` claude-user, hourly granularity).

| Date (UTC) | Window (UTC) | Who | Roughly how many tool calls |
| --- | --- | --- | --- |
| | | | |

## Test C: developer launch of the engine

**Change.** A short "Why this engine" comparison goes into the engine README
with the next release candidate (README.md is a packed file: ordinary pull
requests cannot change it while the current archive is carried). Then one
Show HN post and one r/javascript Showoff Saturday comment, both written by
Dias, linking to the GitHub repository, so visitors land where stars and
GitHub's own traffic report count them.

**Read.** Four weeks from the day of the Show HN post.

| Result | Condition |
| --- | --- |
| Pass | At least 20 new engine stars, or at least 100 repository views referred by news.ycombinator.com or reddit.com |
| Fail | Under 5 new stars and under 25 such referred views |
| Too few to judge | Anything else |

**How it is counted.** Stars from the GitHub API. Referred views from the
engine repository's Insights, Traffic, "Referring sites" (owner access; GitHub
keeps only 14 days, so it is read and written down weekly, and once on day 3
after the post). npm weekly downloads are recorded beside them as a supporting
sign.

**Why not the site's own analytics.** The site's Plausible shim sends every
pageview with a null referrer by design (docs/ANALYTICS.md), so it cannot see
Hacker News or GitHub as a source, and the closed `?ref=` list tags later
events in the tab, not pageviews. Neither is changed for this test.

## Readout

- Week 4 read (14 Dec):
- Reread (10 Jan):
- Decision: keep / change / stop, per test
- Human decision owner and date:
