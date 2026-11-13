# Skeptic rehearsal of the thesis page, 11 November 2026

Linear: ZOD-100 (parent ZOD-56).
Page under test: https://zodiacs.org/thesis/ , edition Nº 10, as served on
2026-11-11T15:56:38Z (repository commit `47fee79f`).

**The live page changed after this capture.** PR 995 (merged 12 Nov 2026)
redrew three figures, so 17 rows here quote text that is no longer live. The
rerun pinned to the page of 13 Nov 2026 is in `../thesis-skeptic-20261113/`
(ZOD-209); use its `claims.md` for the live page. This folder stays as the
record of the 11 Nov capture.

This folder is evidence only. Nothing here changes the live page or any
published thesis file. Suggested wording is a proposal for the owner, not an
edit.

The report was written on 11 November, reviewed by a second session
(`BREAKER.md`), and corrected once on 13 November. The corrections are listed
under "Fix round" below.

## Files

| File | What it holds |
|---|---|
| `claims.md` | Every factual or comparative sentence on the live page, 213 rows, each with a verdict, the source opened and, for every failure, a suggested fix. |
| `sources.md` | Each source opened: URL, fetch time, the supporting sentence or figure, and the sources that could not be opened. S19 holds the fix round's fetches. |
| `readers.md` | The hostile-journalist, crypto-skeptic and working-astrologer passes, and the ranked list of problems all three hit. |
| `BREAKER.md` | The second session's review of the first pass. Unchanged. |
| `records/` | Small raw records: the live page's visible text and headers, the ledger reads, market data, the posts, npm, Wayback, Wikimedia. `SHA256SUMS-committed.txt` covers the files in this folder. |

## Result against the tests

| Test | Result |
|---|---|
| C1. Complete claim list | 213 rows covering link-preview text, structured data, hero, note, essay, four figures with their hover titles and screen-reader descriptions, the evidence drawer (E1 to E5), the appendix, close and footer. The claims file has 29 entries. Sitewide navigation text (sign date ranges, tool descriptions, the gallery band) is left out. |
| C2. Raw-source check | Every verdict cites a source opened on 11 or 13 November (`sources.md`). 21 rows are NOT VERIFIED because the cited source refused the fetch or the check was not rerun; none is counted as a pass. |
| C3. Hold-up rule | PASS 97, FAIL 73, NOT VERIFIED 21, OPINION 22 (argument, forecast or labelled illustration, not scored). First pass: 98, 54, 14, 20 over 186 rows. |
| C4. Rewording | Each of the 73 failing rows has a suggested rewording or a recommendation to drop or qualify. Three first-pass suggestions that the sources contradicted are withdrawn and replaced (A4, H3, I11). |
| C5. Three readers | Written in `readers.md`, each with where they stop believing, what they would quote and what they would share, plus a ranked list of seven shared problems. |
| C6. Nothing published | The branch adds this folder only. No change to `public/thesis/`, the essay source or any generated file. No merge. Engine PRs 91 and 92 untouched. ZOD-42 not run. |

## The failures that matter most

Of the 29 entries in the claims file, 10 fail here: `age-of-signs` (C4),
`social-media` (D5), `one-address` (G7), `critics` (G15), `leo-holders` (H2),
`community-built` (H3), `five-languages` (H4), `chatgpt-claude` (H5),
`top-ten` (H10) and `making-the-case` (H15). `no-app` (H11) is not verified.
The three CoinGecko entries pass as sentences, but the headline built on them
fails on scope (A1, E5, E10). `operator-holds` passes as a statement but
cites a statement date that is not published (B4).

1. **The survival comparison is not like for like** (A1, A2, E5, E10, E12,
   O15, O17). CoinGecko studied coins launched on Pump.fun and counted only
   trades on Pump.fun's bonding curve. The ledger shows the twelve were minted
   directly by one wallet and have traded on Raydium from the first day, so
   they are outside CoinGecko's population. The link preview, a chart heading,
   the fourth bar and the chart's screen-reader text all rest on this.
2. **"The community ... built Zodiacs.org"** (H3) has no public support: the
   About page names Zodiacs LLC, formed 11 August 2026, as owner and operator,
   and the site was already live in June. "More than two years making the
   case" (H15) is contradicted by the page's own history register.
3. **The concentration figure is stale** (H10, K4, K9, I9). The site's own
   public snapshot of August 2026 gives 22.5% to 31.8%, not 23% to 31%, and
   the snapshots stopped on 24 August.
4. **"We kept the critics too"** (G15, G18, G20). The receipt for the
   concentration entry is a defender's reply; the "dead" entry is a search
   link.
5. **"Evidence checked 10 Nov 2026"** (A6) covers figures last read in July.
6. **"Archive continuity"** (I11, I2, I6). The public repository begins on
   27 May 2026, and ten of the thirteen Internet Archive captures the page
   counts are a parked-domain redirect. Three captures are of this site, the
   first on 10 June 2026.
7. **"Daily horoscopes in five languages"** (H4). The French and Italian
   horoscope pages are untranslated placeholders. Daily horoscopes exist in
   English, Spanish and Portuguese.
8. **"Project treasury: None"** with a Verify link (K6, K12, K20), and "No
   adverse figure is omitted" (K15), while the operator's holdings and the
   coins' market value (about $0.73 million for all twelve) are not shown.
9. **Small, checkable errors**: Astrofolio.xyz redirects to the home page,
   not to /astrofolio/ (L3); "unaffiliated" trading posts are by a holder
   (L9); "published address since the day it was made" (G7); ChatGPT and
   Claude listings are "in review" (H5); "wallets" for token accounts (H2);
   ingress and eclipse times printed to the millisecond (F8, F9); the Portnoy
   quotation is cut without a mark (G12); "every claim on this page" links a
   file of 29 (O1); a "weekly" snapshot last refreshed after an eleven-week
   gap (N7).

What held up: the YouGov figures, the CoinGecko figures as figures, the
Naylor story, the Portnoy post, its view count and the address match, the
creation date, supply, mint and freeze authority on all twelve, the Leo
holder count as a count of accounts, the npm download count, the Wikipedia
peak as a number (it is a one-day spike on one article, F7), the Pew and
Unicode facts, the no-fee statement (now also on the Fomo page), and the risk
paragraph.

## Open questions for the owner

Three questions the sources cannot answer. They are left open, and the
suggested wording in `claims.md` is written so that it does not depend on the
answers.

1. **Who built Zodiacs.org before Zodiacs LLC existed** (11 Aug 2026)? The
   repository dates from 27 May 2026 and the site was live by 10 June. No
   source opened here says who. Related: one wallet (`DUK1VN3W...ed13`) paid
   for all twelve coin creations; the appendix implies the operator deployed
   them; the disclosure page says that is not established (E1, K19, N5).
2. **What was at zodiacs.org in 2024 and 2025?** The Internet Archive shows a
   parked-domain redirect. The "archive continuity" row needs rewriting
   either way (I11).
3. **When was the thesis first published?** The repository shows the page
   first committed on 10 Jun 2026; the page says "Published 1 Aug 2026" (A4).
   The first deploy date was not established here.

Other decisions, unchanged from the first pass:

4. Whether to keep the fourth bar on the survival chart in any form.
5. Whether to publish a dated operator statement that the claims file can
   cite. The file names a statement of 10 Nov 2026; the public ones are dated
   2 and 23 Aug 2026. The Fomo page's no-referral statement covers the Fomo
   route but carries no date.
6. Whether the distribution snapshot should be restarted before the
   concentration figure is reprinted.
7. Two things seen in the receipts that the page does not mention, not
   verified here: a thirteenth coin, "$ZODIAC", in the 8 Jul 2024 post the
   page cites, and `devMints: 24` in Jupiter's index for each of the twelve.

## Fix round, 13 November 2026

One round, reports only, against the breaker review.

| Item | What changed |
|---|---|
| B1 | 23 rows added (section O): "Every claim on this page", "complete receipts", the two Appendix C sentences, the Appendix D disclosure-register sentence, the network-fees sentence and its neighbours, E2 "one tap", the three test questions, the E2 card note, the structured data, the charts' screen-reader descriptions, and "Plain-language candidacy snapshot, July 2026". |
| B2 | H4 is now FAIL: French and Italian daily horoscopes are placeholders (pages reopened 13 Nov). |
| B3 | I11 rewritten: ten of thirteen captures are a parked-domain redirect; three are of this site, first on 10 Jun 2026. I2 and I6 corrected to match. |
| B4 | H3: the suggestion "This year we, Zodiacs LLC, built Zodiacs.org" is withdrawn. Replacement states only what the sources support. Who built the site earlier is open question 1. |
| B5 | A4: the suggestion "First published July 2026" is withdrawn. The repository shows the first commit on 10 Jun 2026 (`b2811600`). Open question 3. |
| S1 | H2 is now FAIL ("wallets" for token accounts). |
| S2 | N7 is now FAIL ("weekly" snapshot; refresh history read). |
| S3 | H11 is now NOT VERIFIED, with the scoped wording the evidence supports. |
| S4 | K5 is NOT VERIFIED; K10, K24, K26 and N11 are split so unverified halves stand alone (K28, K29, K30, N15); N1 is FAIL. |
| S5 | F8's pointer to a file with no Sun rows is withdrawn; F9 is FAIL on precision. |
| S6 | C4 and C5 suggestions now say "a 2022 U.S. survey" and "picked". |
| S7 | M11 suggests dropping the carrier; I9 no longer asks anyone to count snapshots; the commit count is corrected to eight. |
| S8 | F7 carries the Virgo caveat; the astrologer no longer shares the peak; the journalist quotes it. |
| S9 | Jupiter's same-day top-holder field is mentioned in H10 and S12, with why it is not used. |
| S10 | B5 now cites the Fomo page; decision 5 asks for a date, not coverage. |
| Notes | A5 no longer cites the `last-modified` header; the claims file's `reviewedAt` is corrected in `sources.md`; E12's second reason is reworded; hashes of the committed records are added; the method note says what is left out. |

## Method and limits

- The live HTML was fetched once and its visible text extracted with a small
  script. That script skipped `<script>` blocks and dropped tags holding only
  attributes, so the structured data and the charts' `aria-label` text were
  missed in the first pass; they were read from the saved capture in the fix
  round. Sitewide navigation and footer chrome is not listed, apart from the
  footer lines in N14.
- Sources were fetched with `curl`, public JSON APIs, public RPC endpoints and
  the GitHub API. X posts were read through X's public syndication endpoint.
- Not done: the web searches behind the "no qualifying results" rows were not
  rerun; pool-share burns and the Base bridge mechanism were not checked on
  chain; top-ten shares could not be re-read like for like; values the page
  draws by script after load were checked only against the committed fallback
  file; the SDK was not installed or run.
- The fix round reopened only the sources behind the breaker's findings. Rows
  the breaker did not name were not rechecked.
- The three reader passes are rehearsals written by the builder.
