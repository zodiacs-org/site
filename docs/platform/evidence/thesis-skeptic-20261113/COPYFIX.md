# Fix round on the thesis page, 13 November 2026 (ZOD-219)

One builder session, begun at about 18:10 in Bangkok (11:10 UTC) on 13 Nov 2026 and ended by its commit, after
the owner's calls of 13 Nov 2026, 18:09 in Bangkok. It adds the rows the
second review asked for and drafts the owner's four calls as changes to the
page copy on this branch. Nothing is live: the page at zodiacs.org is
unchanged until this PR merges under the merge rule.

## The calls and what was done

| Call | Done |
|---|---|
| 1. Rows and checks for the hero season line and the Pulse block | `claims.md`, section T: 24 rows. Sources R22 to R25 and R28 in `sources.md`. |
| 2. Pulse: count Bitcoin, or drop "the strongest token article" | The phrase is dropped and the comparison set is named. Reasons below. |
| 3. Season caption: no top and bottom sign | The ranking sentence is cut from the caption and the generator. P23 is FAIL and withdrawn; nothing replaces it. |
| 4. History answers not available: reword or cut | Six places cut or reworded. No answer invented. Table below. |

## The Pulse choice: drop the phrase

The data opened in this round (R22) for the block's own 30 days, 10 Oct to
8 Nov 2026:

| Article | Reads a day | Median sign article against it |
|---|---|---|
| Bitcoin | 3,238 | 0.3× |
| Ethereum | 705 | 1.4× |
| Tether | 602 | 1.7× |
| $Trump | 431 | 2.4× |
| Dogecoin | 314 | 3.2× |
| Solana | 278 | 3.6× |
| Shiba Inu | 70 | 14.5× |
| Median sign article | 1,014 | |
| Most read sign article (Sagittarius) | 2,101 | |

Why the phrase goes and Bitcoin does not go into the set:

1. **"The strongest token article" is a claim about every token article, and
   no fetch can close it.** Bitcoin is above Ethereum, so the live sentence is
   false. Putting Bitcoin in would make it true of the articles checked here,
   but three of the 22 other titles tried returned nothing and a coin in the
   news can pass Bitcoin for a month. What the data does support is a
   sentence about a named set.
2. **The set is not only the thesis page's.** It is fixed in
   `scripts/build-pulse.mjs` and its output, `public/assets/pulse.json`,
   feeds the twelve Registry sign pages and the Registry hub, and has a
   search half (Google Trends) with no Bitcoin term. Changing the set is a
   change to a weekly data job and to thirteen other pages, which is more
   than a wording fix to this one.
3. **Dropping the phrase does not hide Bitcoin.** The drafted note says the
   set leaves Bitcoin out and prints its figure with dates, so the adverse
   number is on the page either way.

If the owner would rather count Bitcoin, the change is one line in
`COMPARISONS`, a rerun of the Pulse job, and a rebuild of the Registry pages;
the drafted sentence would then read "0.3× the Bitcoin article, the most
read of the five token articles compared here" with no further edit.

## Drafted copy, before and after

All in `public/thesis/index.html` unless another file is named.

| Row | Live on 13 Nov | Drafted |
|---|---|---|
| A4, O12 | Hero: "Published 1 Aug 2026 · Updated 12 Nov 2026 · Evidence checked 10 Nov 2026". Closing line begins "Published 1 Aug 2026 ·". `article:published_time` and `datePublished` 2026-08-01. | Hero: "Updated 13 Nov 2026 · Evidence checked 10 Nov 2026". Closing line begins "Evidence checked 10 Nov 2026 ·". Both metadata fields removed. |
| P1 | "Updated 12 Nov 2026", `article:modified_time` and `dateModified` 2026-11-12 | 2026-11-13 in all three and in the sitemap (`src/pages/sitemap.xml.ts`). To be set to the merge day if later. |
| P23 | "The bright stretch is the sign's season. Aquarius gains the most (80% more reads), Gemini the least (45%), and the lift shows in 118 of 120 sign-years." | "The bright stretch is the sign's season. The lift shows in 118 of 120 sign-years." Source: `scripts/build-thesis-figures.mjs`; the figure was regenerated and `--check` passes. |
| G7 | "Each of these coins has had one published address since the day it was made, and nobody can make more of them, including us." | "Each of these coins still has the Solana address it was created with on 5 July 2024, and nobody can make more of them, including us." |
| H3 | "More than two years on, about 2,800 wallets hold Leo alone, and the community that formed around these coins in 2024 is still building. This year it built Zodiacs.org, a free astrology site with ..." | "More than two years on, about 2,800 wallets hold Leo alone. Zodiacs.org is a free astrology site with ..." |
| H15 | "... and we have spent more than two years making the case that it should be this set." | "... and we are making the case that it should be this set." |
| I2 | "The markets and archive are still present." | "The markets are still present." |
| I6 | "Markets and archive: All twelve tracked pools were live, and the project archive remained continuous." | "Markets: All twelve tracked pools were live." |
| I11 | "own version archive continuous in the public repository since 2024 · Internet Archive: 13 captures since 2024-01-01, latest 2026-10-11, largest gap 326 days", as of 2026-11-10 | "public repository history begins 2026-05-27 · Internet Archive: 13 captures of the domain since 2024-01-01, of which the 3 from 2026 are counted as this site (first 2026-06-10, latest 2026-10-11, largest gap 93 days) · the 10 from 2024 and 2025 share one content digest and are not counted", as of 2026-11-13. Source: `thesis-candidacy.json`, baked into the page by `scripts/bake-thesis-disclosure-static.mjs`. |
| N5 | "... existing liquidity venues, and the operator's existing infrastructure at deployment time." | "... consumer wallet availability, and existing liquidity venues." |
| T2 | Hero line's total: the season's length rounded to the nearest day | Rounded up, so the day shown never passes it |
| T4 | "Source: Wikimedia · live" | "Source: Wikimedia · total live · comparisons captured 2026-11-09" |
| T10 | "One on one: the median sign reads at 1.5× the strongest token article." | "One on one: the median sign article reads at 1.4× the Ethereum article, the most read of the four token articles compared here." |
| T10 (not shown today) | "No aggregation needed: every sign, alone, out-reads every token article. The quietest sign runs N× the strongest token." | "Every sign article, alone, out-reads each of the four token articles compared here. The quietest sign runs N× the Ethereum article, the most read of the four token articles compared here." |
| T11 | "Gold line: the strongest token article in the same window (Ethereum, 705 / day). Token articles: Dogecoin 314 · Ethereum 705 · Solana 278 · Shiba Inu 70." | "The line marks the Ethereum article in the same window (705 / day). Token articles compared: Dogecoin 314 · Ethereum 705 · Solana 278 · Shiba Inu 70. Bitcoin is not among them: its article had 3,238 reads a day from 10 Oct to 8 Nov 2026, more than any single sign article in those 30 days." |

## Files that moved with the copy

| File | Change |
|---|---|
| `public/thesis/thesis-claims.json` | `community-built` and `making-the-case` removed (their sentences are gone); `one-address` rewritten for the new sentence and checked 2026-11-13; `reviewedAt` 2026-11-13. 27 entries. |
| `public/thesis/thesis-candidacy.json` | The archive row's value and date. |
| `public/thesis/thesis-candidacy-evidence.json` | The archive criterion's definition, exclusions, result and sources reworded to match; the thirteen raw rows unchanged. |
| `public/thesis/thesis-history.json` | `registry-live` no longer says it proves "a continuous archive". |
| `zodiacs-thesis-v4.md` | The manuscript's three sentences and its date line follow the page. |
| `scripts/build-thesis-figures.mjs` | The caption; the top and bottom sign are no longer computed. |
| `src/pages/sitemap.xml.ts` | The thesis page's date. |
| `tests/thesis-contract.test.mjs`, `scripts/technical-audit-remediation.test.mjs` | The date expectations; the contract test now fails if a "Published" date or `datePublished` comes back. |

## Checks run on the draft

- `tests/thesis-contract.test.mjs` (47 tests), `scripts/technical-audit-remediation.test.mjs`,
  `src/lib/disclosure.test.ts`, `scripts/build-thesis-disclosure.test.mjs`,
  `scripts/inline-thesis-footer.test.mjs`, `scripts/trust-surface-consistency.test.mjs`,
  the sitemap and search-index tests: all pass.
- `node scripts/build-thesis-figures.mjs --check`, `node scripts/bake-thesis-disclosure-static.mjs --check`,
  `node scripts/check-thesis-links.mjs`, `npm run footer:check`: all pass.
- The drafted page drawn in a browser (R25): no script errors; the hero,
  the Pulse block, the caption, the closing line and the archive row read as
  in the table above.
- Not run here: the full build, `npm run check`, the whole test suite and the
  browser drive (`tests/thesis-qa-drive.mjs`). CI runs them.

## Left alone

- The 63 other failing rows (the survival comparison, "wallets", "five
  languages", "Evidence checked 10 Nov 2026", the concentration figure and
  the rest). The owner's calls did not cover them.
- The Registry hub's copy of the two Pulse sentences (`src/app.jsx`).
- The Archive page's entries dated 2024 and 2025, and `thesis-history.json`'s
  `framing-shift` entry.
- `public/assets/pulse.json` and the comparison set.
- P16, P17 and P19: the review suggested making the "typical day" basis a
  required fix; they stay PASS with an optional fix, since the call was about
  the ranking sentence only.

## What went wrong in the session

- Two TLS errors on first tries (JPL Horizons on a repeat call, the registry
  file); see R24 and R27. One more try each or a saved answer was used.
- Google Trends answered HTTP 429 to the one request made. Not retried.
- A first draft of row U9 gave Bitcoin's 30-day total from memory of the
  daily figure; it was checked against the raw file and corrected to 97,139
  before commit.
- No HTTP 429, spend limit or 403 from the model service.
