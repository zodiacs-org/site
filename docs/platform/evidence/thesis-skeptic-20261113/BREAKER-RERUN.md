# Review of the 13 November rerun (ZOD-209)

A new session, not a continuation of the builder's. It read the builder's
commit `27c385605`, fetched the live page again, opened the sources behind the
rows it challenged and recomputed the season chart from Wikimedia data.
Nothing in the builder's files was edited. This file and `records/breaker/`
are the only additions.

Reviewed on 13 November 2026, from 16:23 in Bangkok.

## Result

| Test | Holds? | In one line |
|---|---|---|
| R1. Fresh capture | Yes | My own fetch at 16:23 Bangkok time is byte for byte the builder's capture. |
| R2. Gone text marked | Yes | All 17 GONE rows are gone, and every row marked LIVE is on the page. I found no eighteenth. |
| R3. Every live sentence has a row | **No, narrowly** | The three new figures are fully covered and their numbers reproduce. Two older, script-drawn parts of the page have no row: the hero's season line and the comparison sentences in the Pulse block (B1). |
| R4. Verdicts and rewordings | **Mostly** | Counts are right and all 72 failures carry a fix. One new pass does not survive a further check, and its suggested rewording is not supported either (S1). |
| R5. Nothing published | Yes | The branch touches only the two evidence folders. PR 980 is an open draft. Engine PRs 91 and 92 are untouched. The three owner questions are still listed as open. |

One blocker under the letter of R3 (B1). Three should-fix items (S1 to S3).
Five notes.

## What I checked and how

- **Live page.** `curl` at 2026-11-13T09:23:49Z: HTTP 200, 422,437 bytes,
  SHA-256 `6db6abf8...8e1615`, the same hash as
  `records/live-thesis-20261113.html` (`cmp` reports no difference). Its text
  matches `public/thesis/index.html` at `origin/main` `210622bfe` except for
  the "View a wallet collection" link; the served file is minified, so the
  bytes differ and only the text is equal. `thesis-seasons.json`,
  `thesis-charts.json` and `thesis-claims.json` as served match `origin/main`.
- **Rows against the page.** A script of my own
  (`records/breaker/tools/r2.py`) took every quoted phrase from the 255 rows
  and looked for it in the live text, attributes, structured data and the
  text a browser draws. Tally: 116 PASS, 72 FAIL, 23 NOT VERIFIED, 27 OPINION,
  17 GONE, as the builder reports. The 25 LIVE rows the script could not
  match were read by hand: all are on the page (the mismatches are formatting:
  a label the row joins with a colon, or a row that quotes no full sentence).
- **Page against the rows.** The reverse (`r3.py`): every sentence a browser
  shows with the drawers open and the page scrolled to the end, and every
  `aria-label`, `title`, `alt`, `desc` and `meta` value, looked for in the
  claims file. Output in `records/breaker/unrowed-lines-output.txt`.
- **PR 995.** I took the 246 lines that PR 995 added to the page and listed
  every label, caption, `aria-label`, `desc` and button in them. Each one has
  a row in P1 to P25.
- **Sources opened for the rows I challenged.**
  - YouGov article, and the question page it links for its tables: the 90%
    and 27% sentences, 3,472 adults, 21 to 22 April 2022. The linked tables
    split by age, gender, politics, race and region, not by belief against
    knowing a sign, so P6 holds.
  - CoinGecko: 68.67%, 80.37%, 4.55%, table total 18,675,645, "Updated June
    23 2026", and the Raydium caveat. P7 and P10 to P13 hold.
  - Solana ledger, one creation transaction (Libra,
    `5JYYmNkV...qhokfjF`, 2024-07-05 18:02:35 UTC): programs System,
    Associated Token, SPL Token and Metaplex; no Pump.fun program; fee payer
    `DUK1VN3W...ed13`. This is what P9's first reason rests on.
  - Wikimedia: ten years of daily counts for four sign articles (Aquarius,
    Gemini, Capricorn, Aries) fetched again, 3,653 days each, no difference
    from the raw file in the repository; and thirty days for five token
    articles (see B1).
  - GitHub: PR 995 merged 2026-11-12T17:44:03Z as `f9f3f5f15` (P1); PR 980
    `isDraft: true`, `OPEN`; engine PR 92 last updated 11 Nov, engine PR 91
    last updated 2026-11-13T03:49Z, five hours before the builder began.
- **Season chart.** Recomputed with my own script and a different
  solar-longitude formula (`records/breaker/tools/seasons2.py`): 45.19 to
  80.15, all twelve round to the printed figures, 118 of 120 sign-years. The
  builder's reproduction is sound. Then two checks the builder did not run:
  each year on its own, and each article in every sign's window
  (`s3.py`). These produce S1.

## Blocker

### B1. Two script-drawn parts of the live page have no row (R3)

Neither is new: both were on the 11 Nov page and were missed by every round.
Neither is in the three new figures. R3 fails on "a live sentence has no
row", so they are listed as a blocker; the fix is five or six rows.

**(a) The hero's season line.** The hero prints, by script:

> Scorpio season · day 21 of 30

It is visible (`records/breaker/rendered-hero-and-pulse.json`). It is a
dated factual statement and has no row. It holds today: the page's own table
puts the Sun's entry into Scorpio at 2026-10-23 09:38 UTC and into
Sagittarius at 2026-11-22 07:23 UTC, so 13 Nov 09:25 UTC is the 21st day of a
span that rounds to 30. The script that draws it carries its own table of
sign entries for 2026 and 2027 written to the millisecond; the table is not
displayed. Row P20 describes only the season chart's table ("to the minute")
and does not mention this second one.

**(b) The Pulse block's comparisons.** The builder's browser capture never
scrolled to the Pulse block, so its text stayed "Loading", and row M4 marks
the whole block NOT VERIFIED with the reason that the values are drawn after
load. Scrolled into view, the block prints these, none of which has a row:

- "vs Dogecoin 45×", "vs Ethereum 20×", "vs Solana 51×", "vs Shiba Inu
  201×", each with "N / day · single article"
- "One on one: the median sign reads at 1.5× the strongest token article."
- "Reads per day, one disambiguated article per sign. Gold line: the
  strongest token article in the same window (Ethereum, 705 / day). Token
  articles: Dogecoin 314 · Ethereum 705 · Solana 278 · Shiba Inu 70."
- Twelve search rows, "aries horoscope 0.4×" to "pisces horoscope 0.4×",
  every one below the reference line ("dogecoin" = 1), range 0.3× to 0.5×.

These are comparative sentences and they can be checked from a source the
builder already used. I fetched the four token articles for the block's
window (10 Oct to 8 Nov 2026): 314, 705, 278 and 70 reads a day, as printed.
What a row would have to say:

- The four multiples set the sum of twelve articles against one article.
  The cells do say "single article".
- "The strongest token article" is the strongest of four that the site
  chose. The Bitcoin article had 3,238 reads a day in the same window, more
  than any single sign article (the highest, Sagittarius, had 2,101) and 4.6
  times Ethereum. Against Bitcoin the median sign reads at 0.3×, not 1.5×.
  Under the hold-up rule this sentence fails on a missing qualifier.
  Suggested wording the source supports: "the median sign article reads at
  1.5× the Ethereum article, the most read of the four token articles
  compared here."
- The script holds a second sentence for the case where the weakest sign
  beats the strongest token: "No aggregation needed: every sign, alone,
  out-reads every token article." It is not shown today (Cancer, 612, is
  below Ethereum, 705), but it would be false for Bitcoin whenever shown.
- "Gold line" names a colour; the line is drawn in the page's pale grey
  (`--gold` is set to `#C6CCDA`). Small.
- The search rows are an adverse figure the page prints: every "sign
  horoscope" query is searched less than "dogecoin". Worth a row because
  K15 ("No adverse figure is omitted") is already failed and this is one
  the page does show.

## Should fix

### S1. P23 is passed, and both it and its suggested rewording fail a further check (R4)

Row P23, "Aquarius gains the most (80% more reads), Gemini the least (45%)",
is PASS with an optional rewording: "The winter signs and Leo gain the most
(about 70% to 80%), Gemini the least (about 45%)." The row says "Gemini is
lowest on every measure tried."

The builder tried three measures of one sign against itself. Two checks on
the same data (`records/breaker/seasons-recheck-output.txt` and
`seasons-cross-window-output.txt`):

1. **One year carries Aquarius.** Year by year, Aquarius's lift runs from 1%
   (2016) to 201% (2025); its middle year is 70.5%. Pisces runs 12% to 167%,
   Capricorn 45% to 137%, each highest in 2025. Across all 120 sign-years
   the lift runs from minus 15% (Aries 2020) to 201%.
2. **Early 2025 lifted every sign's article, not only the sign in season.**
   In 2025 all twelve articles were read more while the Sun was in Capricorn
   (7% to 93% more, apart from Capricorn's own 137%) and in Aquarius (12% to
   70% more, apart from Aquarius's own 201%). Leo's article was read 60% more
   in Aquarius's window than in the rest of 2025, which is more than its
   lift in its own season that year (50%). That is a general rise in
   traffic in the first weeks of 2025, and the page's measure counts it as
   the winter signs' season.
3. **With general traffic taken out, the order changes.** Measuring each
   article as a share of the twelve articles' total that day, the lift in
   season is 51% to 68%. Leo is first (68.1), then Virgo (65.9), Pisces
   (65.4) and Scorpio (65.1). Aquarius is seventh (59.9), Capricorn tenth
   (55.6). Aries is last (51.0), not Gemini (55.4).

What this does and does not change:

- The chart's main claim gets stronger, not weaker: every sign is read at
  least half as much again in its own season on a measure that cannot be
  moved by a general rise in traffic. P15 and P24 stand.
- "Aquarius gains the most" and "Gemini the least" both depend on the
  measure, and the 80% is partly one winter's general traffic. Under the
  rule the builder applied to P3 (a label that says more than the source
  measured) and C5, P23 should be FAIL, or at least its fix should not be
  optional.
- The suggested rewording, "The winter signs and Leo gain the most", is
  not supported either: with general traffic taken out, Capricorn and
  Aquarius are in the lower half. A wording all four measures support:
  "Every sign's article is read about half as much again, or more, in its
  own season. Which sign gains most depends on how it is measured."
- The same applies, less sharply, to the range in P16, P17 and P19: 45% to
  80% on the page's measure, 44% to 72% by plain counts, 51% to 68% as a
  share of the twelve. The builder flagged these four passes as a judgement
  call in the handoff. My reading: P16, P17 and P19 can stay PASS with the
  basis added as a required fix, since the caption states the basis; P23
  should not stay PASS.

### S2. One more loose end from PR 995 for row P25

Row O1 rightly says the claims file has no entry for the season chart. One
more thing a hostile reader will find in the same place: the raw file's own
comment says it is "reduced by scripts/build-thesis-seasons.mjs", and the
reduced file says it was made by "scripts/build-thesis-figures.mjs
--reduce". Only the second script exists on `main`. This is in the linked
evidence, not on the page, so it changes no verdict; it belongs in the P25
row, which describes both files.

### S3. The handoff's times run ahead of the clock

The builder handoff gives the session as "15:50 to 16:32 ICT" and says the
PR was "read after the push at 16:30 ICT". The handoff file was last written
at 16:22:30 Bangkok time and this review began at 16:23, so those two times
had not yet happened when they were written. The capture time (15:54), the
commit time (16:16) and the status line (16:22) are consistent with the
clock. Nothing in the report depends on the two wrong times, but a dated
record should not carry them.

## Notes

- **N1. The HTTP 429.** The Internet Archive refused two reads and the
  builder did not retry, finished the write-up and committed. The handoff
  says so plainly. The brief's stop rule reads as being about the model
  service, and all third-party fetching was already done; I would have made
  the same call. I11 says which part rests on the earlier round. I did not
  query the Archive.
- **N2. Source ids.** `claims.md` says "Ids R1 to R21"; `sources.md` has no
  R18 or R19. No row cites either.
- **N3. P6 was passed on the article alone.** The builder says so. I opened
  the linked question page: its breakdowns are demographic only. The pass
  stands.
- **N4. P18.** "Each sign's line peaks in its own season" is PASS although,
  as drawn, the highest five-day step for Aries and for Leo begins three
  days before the season does. The row says this. By day, the peak is inside
  the season for all twelve. I agree with the pass.
- **N5. README wording.** "It equals `public/thesis/index.html` ... apart
  from one flag-gated link" is true of the text. The served bytes differ
  throughout, because the deploy minifies the page.

## R5 in detail

- `git diff --name-only origin/main...HEAD` lists only files under
  `docs/platform/evidence/thesis-skeptic-20261111/` and
  `docs/platform/evidence/thesis-skeptic-20261113/`. The builder's commit
  changed one file in the older folder, its README, by six added lines.
  `BREAKER.md` and `BREAKER-FIX.md` are unchanged.
- The live page's hash is the same before and after the builder's session
  and equals what `main` deploys. The newest commit to `public/thesis/` on
  `origin/main` is PR 995's.
- PR 980: draft, open, head `27c385605` before this review's commit.
- Engine PRs 91 and 92: open drafts, no update during either session.
- The three owner questions (who built the site before Zodiacs LLC; what
  was at zodiacs.org in 2024 and 2025; what "Published 1 Aug 2026" marks)
  are listed as open in the README and the handoff, with no new evidence
  claimed. I found none either.
- The commit is by Zodiacs Admin `<admin@zodiacs.org>`, with no model name
  and no co-author line.

## Not done in this review

- The 196 carried rows were checked for being live and for their tally, not
  re-argued one by one; the earlier two reviews did that.
- No web searches, no Internet Archive reads, no Solscan, Basescan or Google
  Trends.
- One creation transaction of twelve was read on the ledger, and four sign
  articles of twelve were fetched again in full.
- No fix was made to the builder's rows. B1 and S1 to S3 are for a builder
  round if the owner wants one.
