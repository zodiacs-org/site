# Review of the thesis copy fix round (ZOD-219)

A new review session, not a resume of the builder. 13 Nov 2026, 18:38 to
18:48 in Bangkok (11:38 to 11:48 UTC). It checks the builder's commits
`61e6f054a` (page copy) and `7bd445e82` (report) on
`audit/fable-job4-thesis-skeptic` against tests F1 to F5 of ZOD-219.

Evidence and a review of drafted copy only. Nothing was published, merged,
tagged or marked ready. No builder file was edited: this file and
`records/breaker-copyfix/` are the only additions.

## Verdict

| Test | Holds? | In one line |
|---|---|---|
| F1 | Yes, with one correction owed (S1) | The hero line and every part of the Pulse block have rows, and the figures reproduce from my own fetches. One row (T3) and one source note (R25) quote a live total the drafted page did not print in the builder's own render record or in mine. |
| F2 | Yes | "The strongest token article" is gone from the drafted page. The new sentence is about a named set of four, Bitcoin is named as left out with its figure, and the page and rows T10, T11 and U9 agree. One wording point (S2). |
| F3 | Yes | No top or bottom sign in the caption, the generator or the manuscript. P23 is FAIL and withdrawn. |
| F4 | Yes on the page; one sentence left in a thesis data file (S3) | The drafted page prints no "Published" date, no sentence on who built the site, and no claim about what the domain held in 2024 and 2025. |
| F5 | Yes | Changes are only on this branch. The live page is byte for byte the 13 Nov capture. PR 980 is a draft. Engine PRs 91 and 92 are untouched. |

**No blockers.** Five should-fix items and some notes follow. None of them
is a reason to redo the round; S1 and S3 are the two I would want settled
before this report is relied on or the copy merges.

## What I checked, and how

All of it in this session, from sources I opened myself. Scripts and raw
answers are in `records/breaker-copyfix/`.

| Check | Source | Result |
|---|---|---|
| Per-sign reads, 10 Oct to 8 Nov 2026 | Wikimedia pageviews API, 12 sign articles, fetched 11:41 UTC (`pulse-refetch-output.txt`, `wikimedia/snapshot-*.json`) | All twelve match `pulse.json` and row T9. Total 422,675, 14,089 a day. |
| The four comparisons | Same API, same 30 days | Dogecoin 314, Ethereum 705, Solana 278, Shiba Inu 70. Multiples 44.9, 20.0, 50.7, 201.3: the page's 45, 20, 51, 201 (T5 to T8). |
| Median | Same data | Sixth and seventh values 976 and 1,052, median 1,014. 1,014 / 705 = 1.44, printed 1.4. The seventh value alone gives 1.49, the old 1.5 (T10). |
| Bitcoin | Same API, same 30 days | 97,139 reads, 3,238 a day. Most read sign article, Sagittarius, 2,101 a day (U9). |
| Live window, 14 Oct to 12 Nov | Same API | Where an article returned all 30 days my figures equal the builder's saved answers day for day. Two articles returned 29 days to my script and seven to the browser a minute later: see S1. |
| Hero line today | The drafted page in Chromium at 11:42 UTC (`rendered-draft-breaker.json`) | "Scorpio season · day 22 of 30". |
| Sun's entry into Scorpio and Sagittarius | NASA JPL Horizons, apparent geocentric ecliptic longitude, one-minute steps (`horizons-sun-scorpio-2026-breaker.txt`) | 210 degrees at 09:37:57 UTC on 23 Oct 2026 and 240 degrees at 07:23:22 UTC on 22 Nov 2026, by interpolation. The page's table has 09:38:21 and 07:23:27: 24 and 5 seconds later (T1). |
| The day-count rule | The page's 24-row table, computed, then the drafted page with the clock set one minute each side of every boundary in the table (48 instants) | Old rule: the day passes the total in 12 of 24 seasons (T2). Drafted rule: never. The table is 6.0 to 6.9 seconds from `src/data/sun-ingresses.json`, as the new comment says. |
| Drafted page, whole text | Chromium, `public/` of this branch on localhost | No "strongest", "Gold line", "gains the most", "the least (", "Published", `datePublished`, `published_time`, "community" or "since 2024" anywhere in the text or the head. No script errors. |
| Internet Archive index | CDX API, one request, HTTP 200, 11:43 UTC (`wayback-cdx-breaker.json`) | 13 rows. Ten from 2024-07-26 to 2025-07-19 share digest `7HMQKXUY...`; three in 2026 (10 Jun, 10 Jul, 11 Oct) each have their own. Gaps 30 and 93 days (U7). |
| Repository start | `git log --reverse`, `gh repo view` | First commit `6370da541`, 2026-05-27 15:35 in Bangkok. Repository public, created 2026-05-27 (U7). |
| Thesis checks | `vitest run tests/thesis-contract.test.mjs scripts/technical-audit-remediation.test.mjs`, `build-thesis-figures.mjs --check`, `bake-thesis-disclosure-static.mjs --check` | 54 tests pass; both generators report no drift. Run with dependencies linked from another worktree with the same lockfile; link removed afterwards. |
| Row count | Recount of `claims.md` | 262 live rows: PASS 122, FAIL 77, NOT VERIFIED 36, OPINION 27. Matches the README. |
| Live site | `curl https://zodiacs.org/thesis/` at 11:44 UTC | HTTP 200, SHA-256 `6db6abf8...8e1615`, the same as `records/live-thesis-20261113.html`. It still prints "Published 1 Aug 2026", "strongest token article" and "gains the most", as it should until a merge. |
| PR and engine | `gh pr view` | PR 980: open, draft, head `7bd445e82` before my push. Engine PR 91: draft, head `ce4ba826c` of 11 Nov. Engine PR 92: draft, head `255b615b0` of 11 Nov. Neither has a commit from 13 Nov. `origin/main` has no thesis change since the merge base. |

## F1. Rows for the hero line and the Pulse block

Holds. I went through every string the Pulse block can print, static and
script-drawn, and looked for its row: the total (T3), the header (T4, U8),
the four cells (T5 to T8), the per-sign bars (T9), the sentence and its
hidden alternative (T10, U9), the note (T11, U9), the search heading and
twelve rows (T12 to T24), the four-term search block (M4), the method note
(M5), the estimates (M6, M7), the subhead (O23) and the appendix sentence
(N7). The hero line has T1 and T2. Nothing factual is left without a row.
The only unrowed strings are the block's title, "Loading…", and the two
fallback headers ("Attention data unavailable", and "Source: Wikimedia ·
captured 2026-11-09" when the live request fails), none of which is wrong.

Thirteen of the 24 rows are NOT VERIFIED because Google Trends refused the
builder's one request. It refused mine too (HTTP 429 at 11:45 UTC, one
request, not retried). I agree with NOT VERIFIED: the rows match the site's
file and nothing more can be said today.

## F2. Pulse wording

Holds. The data support the choice. A claim about "the strongest token
article" needs every token article; a claim about "the four token articles
compared here" needs four, and I fetched the four. Ethereum is the most
read of them, and the median sign article is at 1.44 times it. Leaving
Bitcoin out is said on the page, with a figure I reproduced exactly.

I also agree the alternative (adding Bitcoin to the set) is more than a
wording change: the set is in `scripts/build-pulse.mjs`, and the Registry
hub prints the same block from the same file.

## F3. Season caption

Holds. The caption reads "The bright stretch is the sign's season. The lift
shows in 118 of 120 sign-years. This measures curiosity, not demand for the
coins." The generator no longer computes a top or bottom sign and its check
passes. The manuscript has no such sentence. P23 is FAIL, withdrawn, and
the earlier optional rewording is withdrawn with it.

One thing stays that a reader could mistake for the same claim, and I think
it is within the call: the line above the chart and the chart's label still
give the range, "Every sign is read 45% to 80% more while the Sun is in
it", and each sign's own figure shows on hover. No sign is named as first
or last. The second review showed the two ends of that range depend on the
measure, so rows P16, P17 and P19 remain the place to settle it.

## F4. History the owner cannot answer

Holds on the page. I listed every drafted sentence that mentions a year, an
archive, building, launching or "since", and read each one. What remains is
about the coins and is on the public ledger or in a dated post: created
5 July 2024, "in their third year", "more than two years on", Portnoy's
post of 17 Feb 2025. Nothing says who built the site, what the domain held
before 2026, or when the page was first published. The head has only
`article:modified_time` and `dateModified`. No other file in the repository
carries the thesis's 1 Aug date.

## F5. Drafts only

Holds. See the last two lines of the table above.

## Should fix

**S1. The live total. Row T3 and source note R25 quote "14.3K"; the drafted
page printed "14.1K" in the builder's own render record and in mine.**
`sources.md` R25 says the render showed "14.3K / day". The record it cites,
`records/copyfix/rendered-draft.json`, has "14.1K / day" under "SOURCE:
WIKIMEDIA · TOTAL LIVE". My render at 11:42 UTC printed 14.1K too, and I
recorded why: Wikimedia answered the page's twelve requests with 30 days
for five articles and 29 for seven (12 Nov missing). The script adds the
articles up by date and divides by the number of dates, so a day that only
some articles have is counted short. (429,109 less 7,439) / 30 = 14,056,
drawn "14.1K". With all days present the figure is 14,304, "14.3K", which
is what the earlier review saw at 09:26 UTC and what T3 quotes.

So under the new header "total live" the page showed a total 1.7% low, and
by chance equal to the committed figure it was meant to replace. This is
the live page's behaviour too, not something the draft introduced.

- Report: correct R25 to what the record says, and add to T3 that the line
  read 14.1K at 11:25 and 11:42 UTC, with the reason.
- Page, if the owner wants it: drop the last date from the live sum unless
  all twelve articles returned it. A one-line guard in the same script.

**S2. The Bitcoin sentence can be read two ways, and one of them is
false.** "Its article had 3,238 reads a day from 10 Oct to 8 Nov 2026, more
than any single sign article in those 30 days." As averages it is right
(3,238 against 2,101). Day by day it is not: on 18 Oct the Gemini article
had 1,987 reads to Bitcoin's 1,983, and on 24 Oct the Scorpio article had
2,234 to Bitcoin's 2,012. Suggested: "Bitcoin is not among them: its
article averaged 3,238 reads a day from 10 Oct to 8 Nov 2026, against 2,101
for the most read sign article."

**S3. One history sentence is still in a thesis data file.**
`public/thesis/thesis-history.json`, entry `framing-shift`, says the registry
register "arrived later, with zodiacs.org. Both eras archived." The page links this file as "Receipts for every node".
It says when the site arrived relative to the coins and leans on the
Archive page's nine entries dated 2024 and 2025, which is the unanswered
history. The builder reworded the entry next to it (`registry-live`) for
the same reason and listed this one as left alone. It is not printed on the
page, so F4 as written holds; but it is in the folder this round edited,
and it should go the same way: cut "with zodiacs.org. Both eras archived"
or the entry's reliance on `/archive/`.

**S4. "13 captures of the domain" should be "of the home page".** The index
query in `thesis-candidacy-evidence.json` is for the address `zodiacs.org`
alone, and all 13 rows are the home page. Other pages of the domain have
their own captures (the thesis page has some). The earlier review's note N3
already asked for "home page". Affects the scoreboard row (U7) and the
evidence file's `result`.

**S5. Two fixed pieces of text will need a hand at the next data refresh.**
The Bitcoin sentence is written into the script with its dates, while the
figures beside it follow `pulse.json`, which the weekly job last refreshed
on 9 Nov. After the next refresh the note will give Ethereum's figure for
one window and Bitcoin's for another. It stays true because it carries its
dates, but it will read oddly, and "Bitcoin is not among them" turns false
the day Bitcoin is added to the set. The builder says this; I am recording
that I agree and that nothing checks it.

## Notes

- **The Registry hub still says it.** `src/app.jsx` prints "the strongest
  token article" and "Gold line" from the same data. The builder disclosed
  this and the call was about the thesis page. After a merge the two pages
  would disagree about the same block.
- **PR 1024** (`admin/thesis-edition-11`, draft) still rewrites the same
  page and still carries all three withdrawn sentences. Whichever merges
  second needs these calls applied again.
- **"Updated 13 Nov 2026"** is the day the copy was drafted, on a page that
  is not live. It needs setting to the merge day (hero, two metadata
  fields, sitemap, two tests). Disclosed by the builder.
- **"Counted as this site"** rests on two of the three 2026 captures being
  opened by the builder. I did not open the third (10 Jul) either.
- **U4** ("still has the Solana address it was created with on 5 July
  2024") rests on the ledger read of 09:02 UTC, not repeated by the builder
  or by me.
- **"Our Libra"** in the Portnoy sentence (row G10, PASS) and "Nº 10" have
  no history row. I read "our" as the registry's coin today, not as a claim
  about who held what in February 2025, and did not check what the edition
  number counts. Dias may want to look at both with the three questions in
  mind.
- The three script fixes beyond the four calls (day total rounded up, the
  header naming what is live, the true median) are each correct on my
  numbers and each small. I would keep them.
- The builder's 15 failing files in the full local test run were not
  rerun here. CI is the answer.

## What I did not do

- Did not re-argue the 238 rows carried from before this round.
- Did not rerun the full build, `npm run check` or the whole test suite.
- Did not read the chain.
- Made no fix to any builder file and started no builder pass.

## Things that went wrong

- One TLS error from JPL Horizons on the second query; it answered on the
  next try.
- Google Trends: HTTP 429, one request, not retried.
- No HTTP 429, spend limit or 403 from the model service.
