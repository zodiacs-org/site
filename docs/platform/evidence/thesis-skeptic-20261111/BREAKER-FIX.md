# Breaker review of the fix round

Linear: ZOD-100. Reviewed: commit `d0ae4f14c` on
`audit/fable-job4-thesis-skeptic` (draft PR 980), the one reports-only fix
round made against `BREAKER.md`. Review run 2026-11-13, 04:10 to 04:30 UTC
(11:10 to 11:30 ICT), in a new session that did not see the builder's working.

This file is evidence only. It changes nothing on the live page, in any
published thesis file, or in the builder's report. `BREAKER.md` is unchanged.
Row numbers point into `claims.md`, source ids into `sources.md`.

## Verdict

**The approved fixes hold.** B1 to B5 are fixed in the report as Dias approved
them, and S1 to S10 are applied. No blocker was found in the fix round itself.
The three owner questions are still listed as open and nothing in the report
answers them.

One finding is new and is not the fix round's doing, but the report should not
reach the owner without a line about it: **the live thesis page changed on
12 November**, between the first review and the fix round. Three of its four
charts were replaced. About seventeen rows now quote text that is no longer
live, and the new charts' sentences have no rows (F1 below).

| Class | Count | Items |
|---|---|---|
| Blocker | 0 | |
| Should-fix | 4 | F1 the live page moved on; F2 a stale pointer to an owner decision; F3 "Since 11 August 2026" in the H3 wording; F4 "five languages" in the H4 wording |
| Note | 7 | N1 to N7 |

## The approved calls, checked

Each was checked against a source reopened in this session, not against the
builder's account.

| # | Approved call | Holds? | What was reopened here |
|---|---|---|---|
| B1 | Missing live-sentence rows added | Yes, for the page as captured on 11 Nov | Section O has 23 rows, O1 to O23. Every sentence `BREAKER.md` listed has a row: "Every claim on this page" (O1), "complete receipts" (O2), the two Appendix C sentences (O3, O4), the Appendix D sentence (O5), the network-fees sentence (O6), E2 "one tap" (O9), the card note (O11), the structured data (O12 to O15), the chart descriptions (O16 to O18, O20 to O22) and "candidacy snapshot, July 2026" (O19). The saved capture (SHA-256 `29d2e802...1c5c2`) was run through a fresh extractor that keeps `aria-label`, `title`, `alt`, `meta` and `ld+json`, and every line of six words or more was matched against `claims.md`. What is left without a row is sitewide navigation, which the method note now says is left out, and a few restatements (N4). See F1 for the page as it is today. |
| B2 | H4 is FAIL; French and Italian horoscopes are placeholders | Yes | Fetched 04:18 UTC. `/fr/horoscopes/`: title "Contenu en anglais", `noindex`. `/it/horoscopes/`: title "Contenuto in inglese", "non è ancora tradotta", `noindex`. `/es/horoscopes/` and `/pt/horoscopes/` carry the horoscopes of 13 November. |
| B3 | I11 rewritten; parked-domain captures | Yes | CDX rerun with digest and length: 13 rows, identical to `records/wayback-cdx-digests.json`. Ten share the digest `7HMQKXUY...`. The captures of 2026-07-10 and 2026-10-11, which the builder did not open, were opened here: both are titled "Zodiacs.org, Free Birth Charts, Sign Guides & Astrology Tools" (the dash in the title is written here as a comma). Three captures of this site, first on 10 Jun 2026, is right. "Holds exactly" is gone from every file; I2 and I6 are corrected; the README's "what held up" list no longer has the Internet Archive count. |
| B4 | H3: LLC-date contradiction, without inventing who built the site | Yes | "This year we, Zodiacs LLC, built Zodiacs.org" survives only as a quoted, withdrawn suggestion (H3 and the README's fix table). No file says who built the site. /about/ fetched: "formed on August 11, 2026. Zodiacs LLC owns and operates this website". Repository first commit `6370da541`, 2026-05-27. One wording point on the replacement: F3. |
| B5 | A4: first-commit date | Yes | `git log -- thesis/index.html`: first commit `b28116008`, 2026-06-10T13:04:42Z, "Add thesis page, astronomical clock artwork, and Astrofolio glyph integration". CDX for `/thesis/`: first capture 20260713122037. "First published July 2026" is withdrawn; the row claims a commit date and no deploy date. One count is off (N1). |

| # | Should-fix from `BREAKER.md` | Applied? | Check |
|---|---|---|---|
| S1 | H2 FAIL on "wallets" | Yes | Row read. |
| S2 | N7 FAIL on "weekly" | Yes | `git log -- public/assets/pulse.json`: "Refresh pulse data" on 13 Jul, 27 Jul, 10 Aug, 24 Aug and 9 Nov 2026. Matches. |
| S3 | H11 NOT VERIFIED | Yes | Row read. |
| S4 | Unverified halves split out | Yes | K5 NOT VERIFIED; K28, K29, K30, N15 added; N1 FAIL. |
| S5 | F8 pointer withdrawn; F9 FAIL | Yes | `src/data/nasa-event-instants.json`: 498 ingress rows, none with body "Sun". `src/data/sun-ingresses.json` holds 2026-06-21T08:25:14.559Z. |
| S6 | C4, C5 wording | Yes | "In a 2022 U.S. survey ... picked one of the twelve as theirs." |
| S7 | M11, I9 wording; commit count | Yes | `git log -- public/assets/distribution.json`: eight commits, 5 Jul to 24 Aug 2026. Matches. |
| S8 | F7 caveat; readers | Yes | Caveat in F7; removed from the astrologer's shares; added to the journalist's quotes. |
| S9 | Jupiter's top-holder field | Yes | Mentioned in H10 and S12 with why it is not used. |
| S10 | B5 cites the Fomo page | Yes | /fomo/ fetched 04:18 UTC: "no referral deal with fomo and earns nothing when you trade there" and "adds nothing and receives nothing". |

**Counts.** Recounted by script from the tables: 213 rows, PASS 97, FAIL 73,
NOT VERIFIED 21, OPINION 22. No duplicate row ids. All 73 failures have a
fix cell. 186 first-pass rows, plus 23 in section O, plus four splits, is 213.
The README, `claims.md`, the handoff and the PR body agree.

**The three owner questions.** All three are in the README under "Open
questions for the owner", unanswered: (1) who built Zodiacs.org before Zodiacs
LLC existed, (2) what was at zodiacs.org in 2024 and 2025, (3) when the thesis
was first published. The H3, I11 and A4 rows each point to them, and the
suggested wording does not depend on the answers. Something that belongs with
question 1: the disclosure page carries an operator attestation dated
2 Aug 2026, nine days before the company was formed.

**Nothing published.** The branch differs from `origin/main` (`46d49a53f`) by
25 added files, all under `docs/platform/evidence/thesis-skeptic-20261111/`.
No change to `public/thesis/`. PR 980 is open, a draft, unmerged, head
`d0ae4f14c`. All four commits are by Zodiacs Admin and name no model.

## Should-fix

None of these needs another builder pass. Each is one or two lines the
coordinator or the owner can take into account when reading the report.

### F1. The live page changed on 12 November; the report is of the page before that

PR 995, "Thesis graphics: people as dots, the coin field, and each sign's own
season", merged at 2026-11-12T17:44Z, ten hours before the fix round. The
live page fetched here at 04:17 UTC is 422,437 bytes and no longer matches the
builder's capture. The README does say the page under test is the one served
on 2026-11-11 at commit `47fee79f`, so no row is false. But the report does
not say the page has moved, the fix round calls section O's text "live", and
its top-of-README list sends the owner to things that are gone.

Text extracted from both versions and compared:

- **Gone from the live page**, with rows that still read as live: the two
  survey bars and their description (C6, C7), the survival bars, fourth bar
  and caption (E11, E12 as worded, E13 in part), the whole daily-reads chart
  (F6, F7, F10, F11, F13), all ten ingress and four eclipse hover times (F8,
  F9), the three old screen-reader sentences (O16, O17, O18), and "Updated
  11 Nov 2026" (A5, O13; the page now says 12 Nov). The README's "false
  precision" item and the readers' shared problem 7 rest on F8 and F9 alone.
- **New on the live page, with no row**: "Every sign is read 45% to 80% more
  while the Sun is in it"; "Each sign is looked up most in its own season";
  twelve per-sign figures (Gemini 45% to Aquarius 80%); "the lift shows in
  118 of 120 sign-years"; "2016 to 2025"; "fetched 2026-11-12"; "1,868 dots,
  one for every 10,000 coins. 85 are still lit after ninety days"; "Each
  coloured dot is one of the twelve zodiac coins"; "zodiac coins still
  trading on day 858"; four new screen-reader descriptions; a new published
  file, `thesis-seasons.json`. None of this was checked by anyone on this job.
  (85 of 1,868 is 4.55%, which agrees with CoinGecko's figure; nothing else
  was tested here.)
- **Still live and still covered**: the link-preview sentence, both chart
  headings (C5, E10), "Published 1 Aug 2026", "Evidence checked 10 Nov 2026",
  the H paragraph (wallets, community built, five languages, 23% to 31%), "13
  captures since 2024-01-01", "Every claim on this page", "complete
  receipts", edition Nº 10. The README's failures 1 to 8 all still apply.
- **Two defects carried into the new charts**: the survival comparison (E12)
  now puts the twelve as coloured dots in the same field as the Pump.fun
  dots; and "picked their own sign", which O16 failed in a screen-reader
  label, is now also visible text under the first chart.

Change: add a dated line at the top of the README saying the page was
revised on 12 Nov (PR 995), naming the rows that describe removed charts, and
saying the three new charts were not rehearsed. Whether to rehearse them is a
call for the coordinator or the owner; this review did not start one.

### F2. B4 points the owner to the wrong decision

Row B4 ends "See Dias item 3." In the first pass item 3 was the dated
operator statement. The fix round renumbered the README: item 3 is now the
first publication date, and the operator statement is decision 5. Rows K19
and N5 say "Dias item 1", which still lands on the right question. Change:
B4 should read "README, decision 5".

### F3. "Since 11 August 2026" goes one step past the About page

The replacement for H3 reads "Since 11 August 2026 it has been owned and
operated by Zodiacs LLC." The About page says the company was formed on that
date and owns and operates the site now. It does not say ownership began on
the day of formation. The wording came from `BREAKER.md`, so this is a
correction to the first review as much as to the fix. Safer, and fully
sourced: "Zodiacs.org launched this year. It is owned and operated by Zodiacs
LLC, formed on 11 August 2026." It still says nothing about who built the
site.

### F4. The H4 wording keeps "five languages" without a count

The replacement reads "a free astrology site in five languages, with birth
charts, compatibility readings and daily horoscopes in English, Spanish and
Portuguese". Checked here: the French and Italian birth-chart and
compatibility pages are translated and indexable, so that half holds. But
`/ru/` is also live and indexable with a Russian title, and `sources.md` (S8)
already lists six `hreflang` values. "Five" was carried over from the page,
not counted. Change: drop the number ("a free astrology site in several
languages ...") or have the owner say whether Russian counts as released.

## Notes

- N1. A4 and S19d say the thesis page had "four more commits by 11 Jun".
  `git log -- thesis/index.html` shows eight commits up to 11 June, so seven
  more (`BREAKER.md` said three). The first-commit hash and date are right
  and the row's conclusion is unchanged.
- N2. S19 says the candidacy evidence file has "one occurrence of
  'independence'". It has three: the key `independencePolicy` and two
  sentences of prose. No observation carries an independence field and
  "economic" does not appear at all, so O4's verdict holds.
- N3. I11's replacement says "three captures of this site". The CDX query is
  for the home page only; `/thesis/` has its own captures from 13 Jul 2026.
  "Three captures of the home page" is exact.
- N4. A few sentences in the 11 Nov capture have no row of their own and
  restate rows that exist: "Receipts for every node:
  /thesis/thesis-history.json" (same defect as L14), "every available receipt
  remain directly below" (L7), "one claim per wallet · sybil exclusions
  preregistered" (J3 quotes the thresholds but not this), and the rule
  "Only strangers count" (I12 in substance). Not worth a recount.
- N5. F8 says the site "holds no checked Sun ingress". True of the ingress
  rows. The same file's provenance does list a Horizons table for the Sun
  (`dense-sun`, 6-hour step), used for aspects, so re-solving the Sun's
  ingresses would not need a new source. Moot while F1 stands: the hover
  times are off the live page.
- N6. The FIX-HANDOFF says the PR body was updated; it was, and it still
  describes "the live thesis page of 11 Nov 2026", which is accurate.
- N7. `HANDOFF.md`, `BREAKER-HANDOFF.md` and `STATUS.md` in the worktree are
  untracked and were not part of the fix commit, as intended.

## Limits of this review

- This checked the fix round against `BREAKER.md` and the approved calls. It
  is not a third pass over all 213 rows. Rows neither review named were not
  reopened.
- Reopened here: the four locale horoscope pages, the French and Italian
  birth-chart and compatibility pages, `/ru/`, `/fomo/`, `/about/`,
  `/disclosure/`, the Internet Archive CDX for the home page and `/thesis/`,
  two archive captures, the repository history of five files, and the two
  ephemeris data files. Not reopened: CoinGecko, YouGov, Wikimedia, the
  ledger reads, the X posts.
- The new charts from PR 995 were listed, not checked.
- No fix was made to the builder's files and no second fix pass was started.
