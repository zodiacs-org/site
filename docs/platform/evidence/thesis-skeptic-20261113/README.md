# Thesis page skeptic check, rerun on the live page of 13 November 2026

Linear: ZOD-209 (rerun of ZOD-100, parent ZOD-56).
Page under test: https://zodiacs.org/thesis/ , edition Nº 10, "Updated 12 Nov
2026", as served on **2026-11-13T08:54:17Z (13 Nov 2026, 15:54 in Bangkok)**.
SHA-256 of the capture `6db6abf8...8e1615`; it equals
`public/thesis/index.html` at `origin/main` `210622bfe` apart from one
flag-gated link.

This folder is evidence only. Nothing here changes the live page or any
published thesis file. Suggested wording is a proposal for the owner, not an
edit.

## Why a rerun

PR 995 merged on 12 Nov 2026 (17:44 UTC) and redrew three figures: the
know-and-believe bars became two dot grids, the lifespan bars became a field
of 1,868 dots with a ring of twelve beside it, and the one-line attention
chart became twelve "season" ridgelines built from a new data file,
`thesis-seasons.json`. The earlier report,
`../thesis-skeptic-20261111/`, is pinned to the capture of 11 Nov and stays
as the record of that page. This folder is pinned to the 13 Nov capture.

## Files

| File | What it holds |
|---|---|
| `claims.md` | The claim list for the 13 Nov page: 238 live rows, each with a verdict, the source opened in this run and, for every failure, a suggested fix; plus the 17 rows of the old list whose wording is gone, marked GONE. |
| `sources.md` | Every source opened on 13 Nov (R1 to R21): URL, time, the supporting sentence or figure, the recomputed season table, and what could not be opened. |
| `records/live-thesis-20261113.html` | The capture. `live-headers.txt` and `live-fetched-at.txt` sit beside it. |
| `records/live-thesis-extract.txt` | Its text with `aria-label`, `title`, `alt`, `meta` and `ld+json`. |
| `records/live-thesis-rendered.json`, `rendered-*.png` | What a browser draws by script: the "Today" sentence, the twelve per-sign sentences, the four coin-field readouts. |
| `records/` (rest) | Ledger reads, market data, posts, npm, the Internet Archive index, the site's data files, hashes of the twelve Wikimedia responses, the recomputation's output, the fetch log. |
| `records/tools/` | The small scripts used: extractor, source checker, ledger reader, season recomputation, renderer. |

The three reader passes (`../thesis-skeptic-20261111/readers.md`) were not
rerun. Their points about the removed chart (the one-day peak, the
millisecond times) no longer apply; the rest read the same page text that is
live today.

## Result against the ZOD-209 tests

| Test | Result |
|---|---|
| R1. Fresh capture | Fetched 13 Nov 2026, 15:54 Asia/Bangkok, committed in `records/`. Every verdict cites a source opened the same day. |
| R2. Gone text marked | 17 rows are GONE, each with what replaced it: A5, C6, C7, E11, E12, E13, F6, F7, F8, F9, F10, F11, F13, O13, O16, O17, O18. Found by matching every quoted phrase of the 213 old rows against the new capture; the list is the same seventeen the second review named. F4 was kept but its evidence was rewritten, because it had cited the removed hover titles. |
| R3. New chart claims have rows | 25 rows, P1 to P25: every label, caption, screen-reader sentence and script-drawn sentence of the three figures, and the new "Updated" date. The season chart's figures were recomputed here from Wikimedia data fetched in this run. A further 17 rows, Q1 to Q17, cover live sentences that had no row before (not new text). |
| R4. Hold-up and rewording | 238 live rows: **PASS 116, FAIL 72, NOT VERIFIED 23, OPINION 27**. Each of the 72 failures has a suggested fix. |
| R5. Nothing published | The branch adds this folder and one pointer line in the old README. No change to `public/thesis/`, the essay source or any generated file. No merge. Engine PRs 91 and 92 untouched. ZOD-42 not run. |

How the 238 are made up:

| | Rows | PASS | FAIL | NOT VERIFIED | OPINION |
|---|---|---|---|---|---|
| Carried from the 11 Nov list (A to O) | 196 | 85 | 68 | 21 | 22 |
| New after PR 995 (P) | 25 | 22 | 3 | 0 | 0 |
| Live sentences given a row for the first time (Q) | 17 | 9 | 1 | 2 | 5 |
| **Live on 13 Nov** | **238** | **116** | **72** | **23** | **27** |
| GONE, not counted | 17 | (12 were PASS) | (5 were FAIL) | | |

No carried row changed verdict. Five of the old failures left the page with
their charts (E12, F8, F9, O16, O17); four new failures arrived (P2, P3, P9,
Q13).

## The three new figures

1. **The dot grids (know and believe).** The numbers hold (YouGov, 90% and
   27%), the drawing has the right dot counts, and the caption's statement
   that the survey does not report the overlap holds for the article. Two
   rows fail on one phrase, "picked their own sign" (P2, P3): YouGov reports
   that 90% selected one of the twelve, and did not check it was their own.
   The old visible label, "Know their sign", was YouGov's phrase; the new one
   says more. Fix: "picked a sign as theirs".
2. **The coin field.** Every number in it holds: 1,868 dots, 585, 367 and 85
   follow from CoinGecko's 18,675,645 coins and its 68.67%, 80.37% and 4.55%
   (P7, P10 to P13). The comparison that failed before is still drawn (P9):
   "12 of 12 zodiac coins still trading on day 858" stands beside "85 of
   1,868 dots still lit" under "Most memecoins stop trading the day they are
   made." The twelve were not launched on Pump.fun (ledger read again today),
   the two counts measure different things, and a grey dot is 10,000 coins
   where a coloured dot is one. It is better than the old fourth bar: the
   shared scale is gone and the caption says what each dot is. Failures 1 of
   the old README (A1, A2, E5, E10, O15) are unchanged.
3. **The season ridgelines.** This is the strongest new evidence on the page
   and it reproduces. All twelve figures, "45% to 80%", "118 of 120
   sign-years", the curves and the season spans were rebuilt here from
   43,836 daily counts fetched again from Wikimedia and an independent
   solar-longitude formula; all match (P15 to P25, table in `sources.md`
   R20). Three things a hostile reader will press on, none of which changes a
   verdict:
   - The percentages are measured against each year's typical day. Counted
     plainly, as reads a day in season against out of season, the range is
     44% to 72%, not 45% to 80%. The caption names the basis; the headline
     sentence and the screen-reader text do not (P16, P17).
   - "Aquarius gains the most" is true on the page's measure only. By plain
     counts Capricorn leads; by medians Leo does. Gemini is last on all
     three (P23).
   - The two sign-years that miss are Aries 2020 and Aquarius 2016; the page
     does not name them or the rule (P24).

   The millisecond ingress and eclipse times that failed before (F8, F9) are
   off the page. The claims file linked as "Every claim on this page" was not
   updated: it has no entry for any number in this chart (O1).

## What still fails, carried from the 11 Nov report

All of these were reopened today and stand as written there.

1. The survival comparison (A1, A2, E5, E10, O15, and now P9).
2. "The community ... built Zodiacs.org" (H3) and "more than two years making
   the case" (H15).
3. The concentration figure is stale (H10, K4, K9, I9): the site's own
   snapshot of August gives 22.5% to 31.8% and has not been refreshed since
   24 Aug.
4. "We kept the critics too" (G15, G18, G20, and Q13).
5. "Evidence checked 10 Nov 2026" (A6). It now also sits above a chart whose
   own line says "fetched 2026-11-12".
6. "Archive continuity" (I11, I2, I6).
7. "Daily horoscopes in five languages" (H4): French and Italian are still
   placeholders today.
8. "Project treasury: None" with a Verify link (K6, K12, K20) and "No adverse
   figure is omitted" (K15). The twelve coins' market value today is about
   $0.67 million.
9. The small, checkable errors: the Astrofolio.xyz redirect (L3),
   "unaffiliated" (L9), "since the day it was made" (G7), "in review" (H5),
   "wallets" (H2), the cut quotation (G12), "every claim on this page" (O1),
   the "weekly" snapshot (N7).

Of the 29 entries in the claims file, the same 10 fail (`age-of-signs`,
`social-media`, `one-address`, `critics`, `leo-holders`, `community-built`,
`five-languages`, `chatgpt-claude`, `top-ten`, `making-the-case`) and
`no-app` is not verified.

## Corrections to the earlier report made here

The second review of the fix round (`../thesis-skeptic-20261111/BREAKER-FIX.md`)
asked for these; they are applied in this folder's `claims.md` only.

| Item | Change |
|---|---|
| F2 | B4 points to "README, decision 5". |
| F3 | H3's suggested wording is "It is owned and operated by Zodiacs LLC, formed on 11 August 2026." |
| F4 | H4's suggested wording drops "five": the home page lists six languages. |
| N1 | A4: seven more commits by 11 Jun, not four. |
| N2 | O4: "independence" appears three times in the evidence file, not once. |
| N3 | I11: "three captures of this site's home page". |
| N4 | The four unrowed sentences have rows (Q2, Q7, Q9, Q13), with thirteen others found the same way. |

## Open questions for the owner

Unchanged. This run found no new public evidence on any of the three.

1. **Who built Zodiacs.org before Zodiacs LLC existed** (11 Aug 2026)? The
   repository dates from 27 May 2026 and the home page was captured on
   10 Jun. One wallet (`DUK1VN3W...ed13`) paid for all twelve coin creations
   (read again today); the appendix implies the operator deployed them and
   the disclosure page says that is not established (E1, K19, N5, H3).
2. **What was at zodiacs.org in 2024 and 2025?** The Internet Archive's ten
   captures from those years are one parked-domain redirect (I11).
3. **What is "Published 1 Aug 2026" meant to mark?** The page's first commit
   is 10 Jun 2026 and its first archived capture 13 Jul 2026 (A4, O12).

Other decisions, unchanged:

4. Whether to keep the twelve beside the Pump.fun field in any form (P9; was
   "the fourth bar").
5. Whether to publish a dated operator statement that the claims file can
   cite. It names one of 10 Nov 2026; the public ones are 2 and 23 Aug 2026.
6. Whether to restart the distribution snapshot before the concentration
   figure is reprinted.
7. Two things seen in the receipts that the page does not mention, not
   verified here: a thirteenth coin, "$ZODIAC", in the 8 Jul 2024 post the
   page cites; and Jupiter's `devMints` field, which read 24 for each of the
   twelve on 11 Nov and reads 1 for ten of them today.

New, small:

8. Whether the season chart's headline should carry its basis ("against its
   own typical day") or switch to plain counts, and whether the claims file
   should gain entries for the new figures.

## Method and limits

- The live HTML was fetched once. The same extractor was run over the 11 Nov
  and 13 Nov captures and the two texts compared; every quoted phrase in the
  old rows was matched against the new text; every line of the new text of
  five words or more was matched against the new rows. Lines left unmatched
  are headings, link labels, table cells that a row summarises (the
  instrument table, the Unicode plates), sitewide navigation, the gallery
  band and the footer, which are left out as before apart from N14.
- Carried rows: the source behind each was fetched again today and the quoted
  sentence or figure looked for (`records/verify-web-output.txt`). Where a
  figure moved (market data, npm, holder count) the row gives today's value.
  Rows that were NOT VERIFIED stay so; nothing was promoted without a read.
- Not done: the web searches behind the "no qualifying results" rows; pool
  burns and the Base bridge on chain; like-for-like top-ten shares (the RPC
  call was refused again); the Pulse block's live values; an install of the
  SDK; YouGov's full tables.
- The Internet Archive answered HTTP 429 to two of three capture reads. They
  were not retried. I11 says which part rests on the earlier round.
- The season recomputation uses a textbook solar-longitude formula good to a
  few minutes. It decides which days count as in season; a day's difference
  at a boundary could move a figure in the second decimal, and all twelve
  still round to the printed values.
- One builder round. No second pass and no review were run in this session.
