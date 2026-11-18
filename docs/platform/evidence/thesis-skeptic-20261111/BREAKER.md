# Breaker review of the skeptic rehearsal

Linear: ZOD-100. Reviewed: commits `ed4c56af` and `8bd7366f` on
`audit/fable-job4-thesis-skeptic` (draft PR 980). Review run
2026-11-11, 17:15 to 17:30 UTC (12 Nov, 00:15 to 00:30 ICT), in a new session
that did not see the builder's working.

This file is evidence only. It changes nothing on the live page or in any
published thesis file. Row numbers point into `claims.md`, source ids into
`sources.md`.

## Verdict on the builder's table

| Test | Builder's result | After this review |
|---|---|---|
| C1 Complete claim list | Done, 186 rows | **Does not survive.** At least seven factual sentences on the live page have no row, and the text extractor dropped the chart descriptions read to screen readers and the structured data (B1). |
| C2 Raw-source check | Done | Survives with three exceptions: H4 was passed on an HTTP status alone (B2), N7 was passed with "the schedule was not checked" (S2), H11 was passed on searches that were not rerun (S3). No verdict rests on a claims-file status. |
| C3 Hold-up rule | PASS 98, FAIL 54, NOT VERIFIED 14, OPINION 20 | The counts match the table, but the result changes: H4, H2, N7, N1 and F9 should not be passes, several passes carry an unverified half, and the missed sentences add rows. |
| C4 Rewording | Every failure has a fix | No fix cell is empty. Four fixes would themselves be unsupported if printed: H3, A4, I11 (blockers B3 to B5) and the pointer in F8 (S5). Two more say so themselves (M11, I9). |
| C5 Three readers | Done | Survives. Each reader has the three parts and the ranked list is there. One factual slip in the astrologer's notes (S8). |
| C6 Nothing published | Held | **Survives.** Checked below. |

The builder's headline findings (the survival comparison, "the community
built", the stale concentration figure, "we kept the critics", "Evidence
checked 10 Nov") all held when I reopened the sources. The breaks are at the
edges: sentences not listed, a handful of soft passes, and suggested wording
that goes further than the sources.

## Blockers

Fix these in the report before it goes to the owner.

### B1. Live factual sentences with no row (C1)

The page text was re-read against `claims.md` line by line. These are on the
live page and are not in the list. Each was checked here.

| Live text | Where | Check made in this review | Would be |
|---|---|---|---|
| "Every claim on this page, with its source" (the link to `thesis-claims.json`) | Top of the evidence drawer | The file has 29 entries and its own comment limits it to "the essay". The builder's list has 186 rows, 157 of them not in the file. | FAIL. "The essay's numbered claims, with their sources." |
| "Evidence & disclosures: Definitions, tests, risks, and complete receipts" | Drawer summary | The "dead bag" entry has no receipt (G20, L14). | FAIL. Drop "complete". |
| "The candidacy scoreboard and the one-tap test read their committed JSON registers, which carry measurement definitions, capture times, exclusions, and raw captures in the published evidence file. Every observation carries an independence classification (...) and an economic-interest classification; only unsolicited-unaffiliated observations count toward pass conditions, and each exclusion decision is recorded." | Appendix C, the sentence before N8 | `thesis-candidacy-evidence.json` read: each of the five criteria has a definition, method, capture time and exclusions. No observation in it carries an independence or economic-interest field; the classes appear once, as a policy. Raw captures are repository paths (`docs/thesis-evidence/2026-11-10/`), not in the published file, apart from the thirteen archive rows. | FAIL for "every observation carries" and "raw captures in the published evidence file". |
| "The disclosure register carries the operator statements." | Appendix D | /disclosure/ fetched 17:23 UTC: statements dated 2 Aug and 23 Aug 2026 only. The claims file cites "Statement by the operator, 10 Nov 2026" twice. The builder found this (B4, H3, S18) but never set it against this sentence. | FAIL until the 10 Nov statement is published or the claims file cites the dated ones. |
| "Network fees, confirmation behavior, and bridge assumptions are documented in the technical appendix and dated disclosure." | Appendix B, "network definitions" fold | /disclosure/ contains no text on network fees, confirmation or Wormhole. The appendix names them as selection factors and documents none. | FAIL. Drop, or link the Solana pages it already lists as the documentation. |
| "So the complexity will be removed: one tap, clear language, and no need to understand a blockchain first." | E2, under the missed-deadline notice | A promise, printed two paragraphs below "we never built that" and "this page makes no new promise about dates". Same defect as J2. | FAIL, as J2. |
| "The thresholds above are unchanged and will carry into the redesigned test." | E2 card note | `thesis-test.json` read at commit `99a2c2eb` (23 Jul 2026) and today: thresholds, baseline and exclusions are identical. | PASS for "unchanged"; the rest is a commitment. |

Text the extractor never showed the builder. `extract.py` skips every
`<script>` and its last line deletes tags that hold no text, so charts whose
description sits in `aria-label` vanished from `records/live-thesis.txt`:

- Structured data (`application/ld+json`): `datePublished` 2026-08-01 (same
  defect as A4), author and publisher "Zodiacs.org" as an Organization,
  breadcrumb "Zodiacs Registry".
- First chart, read aloud as: "90% of U.S. adults picked their own sign when
  shown the twelve." YouGov says they "select one of them" (the note the
  builder made at C2 applies here with more force).
- Survival chart, read aloud as one sentence that sets the Pump.fun shares
  beside "All twelve zodiac coins traded in the 30 days before 10 November
  2026, on day 858" (E12 again, for a reader who cannot see the caption).
- Scoreboard tiles labelled "Plain-language candidacy snapshot, July 2026",
  over rows dated 2026-11-10. A new dated claim, and it conflicts.

### B2. H4 is a pass the source contradicts (C3)

"daily horoscopes in five languages" was passed because `/fr/horoscopes/`
and `/it/horoscopes/` return HTTP 200. Opened here (17:23 UTC), both are
placeholders:

- French: title "Contenu en anglais", body "Cette page n'est pas encore
  traduite. Disponible en anglais", `noindex`.
- Italian: title "Contenuto in inglese", body "Questa pagina non è ancora
  tradotta", `noindex`.
- Spanish and Portuguese pages carry today's horoscopes
  ("Horóscopos de hoy, 11 de noviembre de 2026").

Daily horoscopes exist in three languages. The site's chrome and tools are
in five. H4 should be FAIL. Supportable wording: "a free astrology site in
five languages, with birth charts, compatibility readings and daily
horoscopes" (horoscopes in English, Spanish and Portuguese). The claims file
marks this entry "checked".

### B3. The Internet Archive count is of a parked domain (I11, I2, I6)

The builder wrote that the Internet Archive half of I11 "holds exactly" and
listed "the npm and Internet Archive counts" under what held up. The count
is right. The captures are not of this project.

- The CDX query was rerun with lengths and digests. The ten captures from
  2024-07-26 to 2025-07-19 share one digest (`7HMQKXUY...`) and are 114 bytes.
- Five of them were opened. Each is the same page:
  `<script>window.onload=function(){window.location.href="/lander"}</script>`,
  a parked-domain redirect.
- Only three captures show the Zodiacs site: 2026-06-10 ("Zodiacs · The
  Twelve."), 2026-07-10 and 2026-10-11.

So "Internet Archive: 13 captures since 2024-01-01 ... largest gap 326 days"
under "Archive continuity" counts ten captures of someone's parking page.
The evidence file excludes "pre-2024 captures (the domain had unrelated prior
history)" and then counts 2024 and 2025 captures that are just as unrelated.
The builder's suggested rewording for I11 keeps the figure. It should read:
"Internet Archive: three captures of this site, the first on 10 Jun 2026."
I2 ("The markets and archive are still present") and the fix for I6 need the
same correction, and the README's "what held up" list should lose the
Internet Archive count.

### B4. The suggested wording for H3 is contradicted by the builder's own sources (C4)

Suggested: "This year we, Zodiacs LLC, built Zodiacs.org." S8 says Zodiacs
LLC was formed on 11 Aug 2026. S17 says the repository began on 27 May 2026;
npm shows the SDK published on 5 Jun 2026 (S14); the Internet Archive shows
the registry site live on 10 Jun 2026 (B3). The company did not exist when
the site was built. Supportable: "Zodiacs.org launched this year. Since 11
August 2026 it has been owned and operated by Zodiacs LLC." Who built it
before that date is a question for the owner (it belongs with item 1 of the
builder's list).

### B5. The suggested wording for A4 is contradicted by the repository (C4)

Suggested: "First published July 2026." The builder looked at the history of
`public/thesis/index.html` only. The page lived at `thesis/index.html` before
the July restructure: its first commit is `b2811600`, 2026-06-10, "Add thesis
page ...", with three more commits by 11 Jun. The first Internet Archive
capture of `/thesis/` is 2026-07-13. "July" is not supported; "June 2026" is
supported for the repository, and the owner should confirm the first deploy.
The FAIL on A4 stands and gets stronger.

## Should-fix

| # | Row | What is wrong | Evidence | Change |
|---|---|---|---|---|
| S1 | H2 | PASS on "about 2,800 wallets hold Leo" while the row itself says the count is token accounts, pool and dust included, and offers a fix. N2 and K9 fail on the same wallets-for-accounts wording. The cited source (Solscan, 2,786 in the claims file) was not opened; the figure is Jupiter's 2,819. | `records/jup-tokens.json`; S11 method note | FAIL (needed qualifier). Keep the suggested "accounts". |
| S2 | N7 | PASS on "a weekly committed snapshot" with "The schedule was not checked." | GitHub history of `public/assets/pulse.json`: refreshed 13 Jul, 27 Jul, 10 Aug, 24 Aug, then nothing until 9 Nov 2026. Fortnightly from mid July, then one gap of eleven weeks. | FAIL. "with a committed snapshot as fallback, last refreshed 9 Nov 2026." |
| S3 | H11 | PASS on "No outside app has adopted them yet" although "the underlying web searches were not rerun". I3, I4 and I8 are NOT VERIFIED for the same reason. The evidence file adds "no code-search source was queried". | `thesis-candidacy-evidence.json` | NOT VERIFIED, or pass only the scoped wording "we have found none". |
| S4 | K5, K24, K26, K10, N1, N11 | Passes that carry a half the builder did not verify, or a defect failed elsewhere. K5 passes "bridged" (K11 is NOT VERIFIED). K24 and K26 pass "Pool shares burned" and "cannot be redeemed" (K22, K25 NOT VERIFIED). K10 is one FAIL row hiding twelve NOT VERIFIED per-sign values. N1 passes a legend that promises "total and circulating", "LP ownership and any locks" and "custody model", none of which the table prints, while N2 and N3 fail for the same mismatch. N11 passes "the SDK reads it all programmatically" on npm metadata alone. | The rows themselves | Split the rows or mark them NOT VERIFIED or FAIL, then recount. |
| S5 | F8, F9 | F8's fix says to print "from the Horizons-solved instants the site already holds (`src/data/nasa-event-instants.json`)". That file has 498 ingress rows and none for the Sun. The page's times come from `src/data/sun-ingresses.json`, which holds the same 08:25:14.559. The example "08:24 UTC" is USNO's figure, not the site's. Separately, F9 is PASS while its own note says "the millisecond digits are still false precision", the reason F8 fails, and the ranked list cites F9 as a problem. | Both files read here | F8 fix: "print to the minute; the Cancer time needs re-solving first, the site holds no NASA-solved Sun ingress." F9: FAIL on precision, or drop that ground from F8. |
| S6 | C4, C5 fixes | "In the United States today, nine adults in ten can name their own" presents an April 2022 survey as current and repeats "can name", which the builder questioned at C2. | S2 | "In a 2022 U.S. survey, nine adults in ten picked one of the twelve as theirs." |
| S7 | M11, I9 fixes | M11 proposes a new historical claim "after checking a source"; no source was opened, so the fix is not supportable as written. I9 proposes "Seven public snapshots" and asks someone to count them. The file has eight commits (5 Jul to 24 Aug 2026; S17 lists seven), and snapshot dates differ from commit dates. | GitHub API | M11: recommend dropping the first carrier. I9: "Snapshots ran from 29 Jun to 24 Aug 2026; none since." |
| S8 | F6, F7, readers | The peak the chart labels, 38,090 reads on 23 Mar 2026, is one article. `records/wikimedia-20260323.txt` shows Virgo at 22,543 of the 38,090. Rechecked here: Virgo had 1,095 to 1,775 reads on 20 to 22 Mar, 22,543 on 23 Mar, 5,626 on 24 Mar. Without the spike the day is ordinary. The astrologer's notes call the peak "three days after the Aries ingress ... a real and pleasing detail". | Wikimedia API, 17:26 UTC | Add the caveat to F7 and to the journalist's quotes; remove the line from the astrologer's shares. The number itself passes. |
| S9 | H10, K4, K9 | sources.md says top-ten shares "could not be re-read". The committed Jupiter record carries a same-day reading, `topHoldersPercentage`, 17.4% to 23.3% across the twelve on 11 Nov. Its definition was not checked here; it appears to leave out the pool, which would fit the August figures less the 6% to 10% pools. | `records/jup-tokens.json` | Mention it with that caveat, or say why it is not comparable. The FAIL (stale, undated) stands. |
| S10 | B5, owner item 3 | The builder could not open /fomo/ (TLS error) and told the owner the no-fee statement "predates the Fomo buy route". Opened here: "It is not part of Zodiacs.org, which has no referral deal with fomo and earns nothing when you trade there" and "Zodiacs.org adds nothing and receives nothing." Undated, but public and specific to the route. | https://zodiacs.org/fomo/ , 17:23 UTC | B5 stays PASS, with this as its source. Amend item 3: the gap is a date on the statement, not its coverage. |

## Notes

- A5: the `last-modified` header is not a modification date. On my fetch it
  equalled the response time (17:20:10 GMT). The commit date still supports
  "Updated 11 Nov 2026".
- sources.md S1c gives the claims file's `reviewedAt` as 2026-11-10. The
  file, live and in the builder's raw capture, says 2026-11-11.
- J3 and the J2 fix: the builder had not read the 23 Jul wording. I did
  (`99a2c2eb`). The thresholds were public that day. Both hold. The file's
  first commit, 11 Jul 2026, had status "pending" and no thresholds.
- E12, reason 2: "by CoinGecko's own rule a coin trading only on Raydium
  would count as dead" overstates. A coin never launched on Pump.fun is not
  in the data at all. Reason 1 carries the failure on its own.
- `records/SHA256SUMS.txt` lists 48 files by scratch-folder name; most are
  not in `records/`, so the list cannot be checked from the committed folder.
- `HANDOFF.md` still reads "CI: CI_RESULT_PLACEHOLDER".
- Sitewide navigation text (sign date ranges, tool descriptions) has no rows.
  Reasonable to leave out; say so in the method note.

## What survived

- **Counts.** 186 rows; PASS 98, FAIL 54, NOT VERIFIED 14, OPINION 20,
  recounted by script from the tables. All 54 failures have a fix cell. The
  eight failing claims-file entries named in the README map to failing rows.
- **NOT VERIFIED rows.** None of the fourteen is counted as a pass in the
  totals. The leak is the other way: unverified halves inside PASS rows (S3,
  S4).
- **Sampled sources, reopened here.** CoinGecko (68.67%, 4.55%, 80.37%,
  18.67M, "Updated June 23 2026", the Raydium caveat), YouGov (90%, 27%,
  3,472 adults, April 2022), USNO seasons for 2026, /about/ (Zodiacs LLC,
  11 Aug 2026), /apps/ ("Directory listing in review", twice), /disclosure/
  (the 2 Aug and 23 Aug statements), and `astrofolio.xyz` (301 to the home
  page, also for a deep path). All as the builder quoted them.
- **Records.** Recomputed from the committed files: distribution 22.53% to
  31.80%, median 27.3; Dexscreener twelve Raydium pairs, $687.59 in 24
  hours, 52 trades, $731,962 market value; Wikimedia sum 38,090; day 858.
- **C6.** The branch adds 22 files, all under
  `docs/platform/evidence/thesis-skeptic-20261111/`. `origin/main` is still
  `47fee79f`. The live page fetched at 17:20:12 UTC has the same SHA-256 as
  the builder's capture (`29d2e802...1c5c2`). Six of the eight published
  thesis JSON files were fetched and match the repository byte for byte (the
  other two fetches hit a TLS error and were not compared live). PR 980 is
  open, a draft, unmerged. Both commits are by Zodiacs Admin and name no
  model.

## Limits of this review

- A sample, not a second full pass: about twenty rows and every fix that
  introduces a new fact were reopened. Rows not named here were not
  rechecked.
- Not reopened: Smithsonian, Pew, Unicode, NASA, the X posts, the ledger
  reads. The builder's quotes for those were compared with the committed
  records only.
- The definition of Jupiter's `topHoldersPercentage` was not looked up.
- No fresh counts were made for the adjusted totals. Once the rows above are
  added, split or flipped, the totals need recounting.
