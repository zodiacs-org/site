# Reviewer findings on the fix round (ZOD-107)

A new, separate session checked the one fix round on this report ([README.md](README.md), commit `57d7c0ab4`) against the seven should-fix items in [BREAKER.md](BREAKER.md) that Dias approved. Review run: 2026-11-13, about 11:15 to 11:45 ICT. Nothing in the report, the records, the checks, the tools, the product copy, the templates or the prompts was changed. This file is the only addition. `BREAKER.md` is untouched.

## Verdict

**No blocker. All seven approved fixes hold.** The score table, the per-rule line, section 4 and the totals agree with each other. One small new gap was found in the sky table (finding A, should fix, report only), and six notes. None changes a finding or a suggested fix. The one allowed fix round is spent, so nothing here was applied.

| Approved fix | Holds? | How it was checked |
|---|---|---|
| S1. R1 on P1 to P4, consistent with X1 | Yes | The table has P on R1 for P1 to P4 and X1. The reason row says "Pass, all four" and keeps the dated form as a note with S3. The earlier Chromium render of the Scorpio page shows "Today, check the budget" and not "For the November 11". R1 is 6 of 15 (P1 to P4, X1, X4). |
| S2. Hidden text | Yes | P7 R13 labels the three strings as served but hidden and says they are not part of the score. P6 R12 is a pass by the rule used on P1 to P4. Sections 2 and 8 say the saved texts keep hidden and collapsed text. S3 and S10 say who gets it. 41 other quoted strings were searched in the six saved Chromium renders: every quote a score rests on is visible. The only strings not visible are the three now labelled, and receipt degrees used for R4. |
| S3. H1 against R10 | Yes | P9, X2 and X5 are partial on both. Section 1 states the rule. Every R10 partial (P9, X2, X5, X6) is now an H1 partial. H1 is 10 of 16. S12 and S13 list H1. |
| S4. R9 on the dailies | Yes | P1 to P4 and X1 are partial. Recounted from the records: the third sections are 25, 21, 24 and 21 words, as printed, and the other sentences are 12 to 17 words as served. The row says the miss is abstraction and a judgment. |
| S5. G4 marks | Yes, for the rows named | The seven rows are in section 5 and match the records: Saturn 7°55′ and Neptune 1°36′ are in `checks/sky-check-output.txt`; the X5 first-pass dates and pass counts, the X4 element and modality counts and "total 29" are as in the saved responses; X2 has one "From Sat 14 Nov" line. Rows the builder did not compute are credited to the reviewer. Two are marked unchecked. See finding A for one fact the list missed. |
| S6. Method statements | Yes | The live sitemap, fetched again in this review, has 367 `/birthday/` URLs and it is still the largest family. `/year/` (304 bytes) is listed under fetched, not scored. The report says the sitemap was not kept. The fetch log gives 34 seconds from the first scored page to the last, inside the "36 seconds" stated. |
| S7. P6 label | Yes | The sample table says "Localized daily, sampled as the nearest live thing to a translated horoscope. No translated horoscope is live". No other line calls P6 a translation. |

## What else was tried, and what held

| Attack | Result |
|---|---|
| A change outside the report | None. The fix commit changes `README.md` in this folder and nothing else (61 insertions, 32 deletions). `git diff --name-only origin/main...HEAD` lists this folder only. |
| A wrong author, a trailer, a model name | None. All three commits are by Zodiacs Admin <admin@zodiacs.org>, no trailers. The PR description names no model. |
| A merge or a ready PR | None. PR 981 is open and a draft, head `57d7c0ab4`. |
| Totals that do not add up | They add up. The table was tallied again by script: 95 pass, 93 partial, 34 fail, 34 not applicable (256). The per-rule line matches cell for cell. The move from 93, 90, 39, 34 is exactly the 13 changed cells: four R1, one R12, three H1, five R9. |
| A table cell that disagrees with its reason row | None. Every cell of P5 to P9 and X1 to X7 was matched by script to its row in section 4, and P1 to P4 by eye. |
| A partial or fail left without a fix after the edits | None. Every partial and fail row still names at least one of S1 to S18. The two cells that became passes dropped their fix, and S3 and S9 dropped the rules they no longer serve. |
| A finding or a suggested fix quietly changed | No fix changed in substance. S3 and S10 gained a sentence on who gets the hidden wording, and four "Fixes" lists were retallied. Headline finding 3 gained a clause (note F). |
| An em or en dash in the report | None. |
| Product calls acted on | None. Section 7 is unchanged and the eight Dias calls are still open. |

## Findings

### Should fix (in the report only; not applied)

**A. Two `get_sky` longitudes have no check and no mark (G4, by the letter).**
The saved X3 response lists twelve bodies: the ten planets, the North Node (25.63° Aquarius, retrograde) and the South Node (25.63° Leo). The check output (`checks/sky-check-extra-output.txt`) compares ten. Section 4 says "All ten positions" and section 5 says "Ten positions", which is accurate, but the new unchecked row reads "Latitudes and daily speeds of the twelve bodies: only the longitudes, the phase angle and the lit fraction were compared". That implies all twelve longitudes were compared. The two node longitudes are neither checked nor marked.
The first review's finding 5 did not list them either, so this is a gap in that list, not a miss in the approved fix. A rough mean-node figure worked by hand here gives about 325.5°, which is consistent with the printed 325.63° for a true node, but that is not a check. The row should read "ten of the twelve longitudes" and the two node positions should be marked unchecked. No score changes.

### Notes

**B. R6 still counts the words a reader did not see.** Section 2 now says readings are scored on what a reader saw that day, and R1 follows that. R6 gives 101, 93, 98 and 106 words, which are the served, dated form. "For the November 11, 2026 edition," is six words and "Today," is one, so the reader's form is 96, 88, 93 and 101 words, and the row's "four extra words" should be five (that phrase was in the first report). No score needs to move: P1 to P3 pass either way, and P4's partial stands on the repeated clause. But "P4 is 106 words" is no longer the reason; at 101 it is the count P1 passed on.

**C. R1 treats an abstract opener two ways.** For P1 to P4 the abstract openers ("test the larger belief against study, distance, or direct experience") pass R1, with the abstraction "counted under R8 and R9". P5, from the same program, is partial on R1 because "Follow the consequential thread without turning every silence into evidence" does not work on its own. Both are defensible readings of quick check 1. The approved call was P1 to P4 against X1, and that holds; P5 is left as scored.

**D. Three older rows still say "Unchecked" though the first review recomputed them.** The 2026 retrograde starts, "Seven are within three degrees" and the shadow ranges with the two 2028 dates keep the builder's mark, while the new rows say "Checked by the reviewer". The paragraph under the table reconciles the two, so nothing is hidden. The P7, P9 and X4 R4 rows in section 4 also keep their "not checked" wording.

**E. The Portuguese claim is the reviewer's, not the builder's.** The P6 row says "the Spanish and Portuguese pages carry their own four-note reading" and credits only the French and Italian result to the reviewer. Section 2 lists Portuguese under "Not fetched". The claim is true (the first review's saved Portuguese page shows "4 notas lidas a partir das casas solares"), but it rests on that review.

**F. Two small mismatches in the summary lines.** The headline says no finding changed; headline finding 3 gained "and the compatibility result leads with what to notice", which matches X4's R1 pass and changes no score. Section 7, item 8 says "Three defects that are not style" while the headline and the handoff count four (the fourth is the 40% confidence figure, S14). That was in the first report.

**G. The sitemap total cannot be reproduced.** The live sitemap now has 1,902 URLs, not 1,910. The site has published since 11 November and the sitemap was not kept, as the report now says. The 367 birthday URLs are unchanged.

### Still open, not acted on

- The first review's notes 8 to 12: six of sixteen readings share one template; `get_sky` passes R7, R10 and R11 by having no prose; five event minutes on `/today/` were compared with the page's own data file; the "First Quarter" label may come from an older eight-slice rule; S11 names a brief without a file.
- Dias calls 1 to 8 in section 7 of the report and in the builder's handoff: the surfaces that are not live, "a reason to come back" on a timeless page, which event times count as the site's own, whether a Sun-sign page reading needs the confidence label, the "health routines", "shared money" and "the body" wording, the Spanish daily not being a translation, the guide's Scorpio example against the live selection, and the defects that may want their own issues.

## The tests on ZOD-107 after the fix round

| Test | After the fix round |
|---|---|
| G1 Sample and method | Met. Both wording fixes are in. |
| G2 Every reading, every rule | Met. 16 by 16, counts add up, the four scoring fixes are in. |
| G3 Suggestions at the source | Met. Every partial and fail names a fix at a template, table, builder or prompt. |
| G4 Sky facts | Met in substance. The rows the first review asked for are in. Two node longitudes in X3 remain unmarked (finding A). |
| G5 Nothing published | Met. Evidence folder only, draft PR, nothing merged. |

## Not done in this review

- No fresh browser render and no new connector call. Visibility was checked against the six Chromium renders the first review saved on the edition day.
- No sky fact was recomputed with an ephemeris. The new rows were checked against the saved records and the builder's check output only.
- R9 and R13 were not rescored reading by reading.
- No product call was acted on and no further fix pass was started.
