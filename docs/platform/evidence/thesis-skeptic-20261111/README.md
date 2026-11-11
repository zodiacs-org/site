# Skeptic rehearsal of the thesis page, 11 November 2026

Linear: ZOD-100 (parent ZOD-56).
Page under test: https://zodiacs.org/thesis/ , edition Nº 10, as served on
2026-11-11T15:56:38Z (repository commit `47fee79f`).

This folder is evidence only. Nothing here changes the live page or any
published thesis file. Suggested wording is a proposal for the owner, not an
edit.

## Files

| File | What it holds |
|---|---|
| `claims.md` | Every factual or comparative sentence on the live page, 186 rows, each with a verdict, the source opened and, for every failure, a suggested fix. |
| `sources.md` | Each source opened in this job: URL, fetch time, the supporting sentence or figure, and the sources that could not be opened. |
| `readers.md` | The hostile-journalist, crypto-skeptic and working-astrologer passes, and the ranked list of problems all three hit. |
| `records/` | Small raw records: the live page's visible text and headers, the ledger reads, market data, the posts, npm, Wayback, Wikimedia, and SHA-256 hashes of all 48 captures. |

## Result against the tests

| Test | Result |
|---|---|
| C1. Complete claim list | 186 rows covering link-preview text, hero, note, essay, four figures, hover titles, the evidence drawer (E1 to E5), the appendix, close and footer. The claims file has 29 entries; 157 rows here are not in it. |
| C2. Raw-source check | Every verdict cites a source opened on 2026-11-11 (`sources.md`). 14 rows are NOT VERIFIED because the cited source refused the fetch or the check was not rerun; none of those is counted as a pass. |
| C3. Hold-up rule | PASS 98, FAIL 54, NOT VERIFIED 14, OPINION 20 (argument, forecast or labelled illustration, not scored). |
| C4. Rewording | Each of the 54 failing rows has a suggested rewording or a recommendation to drop or qualify. |
| C5. Three readers | Written in `readers.md`, each with where they stop believing, what they would quote and what they would share, plus a ranked list of seven shared problems. |
| C6. Nothing published | The branch adds this folder only. No change to `public/thesis/`, the essay source or any generated file. No merge. Engine PRs 91 and 92 untouched. ZOD-42 not run. |

## The failures that matter most

Of the 29 entries in the claims file, 8 fail here: `age-of-signs` (C4),
`social-media` (D5), `one-address` (G7), `critics` (G15), `community-built`
(H3), `chatgpt-claude` (H5), `top-ten` (H10) and `making-the-case` (H15).
The three CoinGecko entries pass as sentences, but the headline built on them
fails on scope (A1, E5, E10). `operator-holds` passes as a statement but
cites a statement date that is not published (B4).

1. **The survival comparison is not like for like** (A1, A2, E5, E10, E12).
   CoinGecko studied coins launched on Pump.fun and counted only trades on
   Pump.fun's bonding curve. The ledger shows the twelve were minted directly
   by one wallet and have traded on Raydium from the first day, so they are
   outside CoinGecko's population, and by CoinGecko's own rule a coin trading
   only on Raydium would count as dead. The link preview, a chart heading and
   the fourth bar all rest on this.
2. **"The community ... built Zodiacs.org"** (H3) is contradicted by the
   site's own About page: Zodiacs LLC, formed 11 August 2026, owns and
   operates it. "More than two years making the case" (H15) is contradicted
   by the page's own history register, which says the registry argument
   arrived in 2026.
3. **The concentration figure is stale** (H10, K4, K9, I9). The site's own
   public snapshot of August 2026 gives 22.5% to 31.8%, not 23% to 31%, and
   the weekly snapshots stopped on 24 August.
4. **"We kept the critics too"** (G15, G18, G20). The receipt for the
   concentration entry is a defender's reply; the "dead" entry is a search
   link.
5. **"Evidence checked 10 Nov 2026"** (A6) covers figures last read in July.
6. **"Project treasury: None"** with a Verify link (K6, K12, K20), and "No
   adverse figure is omitted" (K15), while the operator's holdings and the
   coins' market value (about $0.73 million for all twelve) are not shown.
7. **Small, checkable errors**: Astrofolio.xyz redirects to the home page,
   not to /astrofolio/ (L3); "unaffiliated" trading posts are by a holder
   (L9); "published address since the day it was made" (G7); ChatGPT and
   Claude listings are "in review" (H5); ingress times printed to the
   millisecond are up to a minute off (F8); the Portnoy quotation is cut
   without a mark (G12).

What held up: the YouGov figures, the CoinGecko figures as figures, the
Naylor story, the Portnoy post, its view count and the address match, the
creation date, supply, mint and freeze authority on all twelve, the Leo
holder count, the five languages, the npm and Internet Archive counts, the
Wikipedia peak, the Pew and Unicode facts, and the risk paragraph.

## For the owner to decide

1. Whether the page should say who created the twelve coins. One wallet
   (`DUK1VN3W...ed13`) paid for all twelve creations; the appendix implies the
   operator deployed them; the disclosure page says that is not established.
2. Whether to keep the fourth bar on the survival chart in any form.
3. Whether to publish a dated operator statement that the claims file can
   cite. The file names a statement of 10 Nov 2026; the public ones are dated
   2 and 23 Aug 2026, and the no-fee statement predates the Fomo buy route.
4. What "Published 1 Aug 2026" marks, given the page was public by 23 Jul.
5. Whether the weekly distribution snapshot should be restarted before the
   concentration figure is reprinted.
6. Two things seen in the receipts that the page does not mention, not
   verified here: a thirteenth coin, "$ZODIAC", in the 8 Jul 2024 post the
   page cites, and `devMints: 24` in Jupiter's index for each of the twelve.

## Method and limits

- The live HTML was fetched once and its visible text extracted with a small
  script, including meta tags, SVG text and hover titles. The text was then
  read top to bottom and each factual or comparative sentence given a row.
- Sources were fetched with `curl`, public JSON APIs, public RPC endpoints and
  the GitHub API. X posts were read through X's public syndication endpoint.
- Not done: the web searches behind the two "no qualifying results" rows were
  not rerun; pool-share burns and the Base bridge mechanism were not checked
  on chain; top-ten shares could not be re-read because public RPC endpoints
  refuse that call; values the page draws by script after load were checked
  only against the committed fallback file.
- The three reader passes are rehearsals written by the builder.
