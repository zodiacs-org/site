# Reviewer findings on the style guide sample (ZOD-107)

A second, separate session tried to break the report in this folder ([README.md](README.md), commit `11fd6150`) against tests G1 to G5 on ZOD-107. Review run: 2026-11-11, 18:30 to 18:55 UTC (2026-11-12, 01:30 to 01:55 ICT), while the 11 November edition was still live. Nothing in the report, the records, the product copy, the templates or the prompts was changed. This file is the only addition.

## Verdict

**No blocker. The builder's G1 to G5 table survives, with seven things to fix in the report.** None of them changes a finding or a suggested fix. One of them (finding 5) is a gap in G4 by the letter: a few specific sky facts in the saved connector output carry neither a check nor an "unchecked" mark. They were recomputed here and are all correct, so the gap is in the table, not in the facts.

| Test | Builder | After review |
|---|---|---|
| G1 Sample and method | Met | Survives. Two wording fixes (findings 6 and 7). |
| G2 Every reading, every rule | Met | Survives. 16 by 16, counts add up, guide matches. Four scoring fixes (findings 1 to 4). |
| G3 Suggestions at the source | Met | Survives. Every partial and fail names a fix, and every fix is at a template, table, builder or prompt. |
| G4 Sky facts | Met | Survives in substance. A gap by the letter until the rows in finding 5 are added. |
| G5 Nothing published | Met | Survives. |

## What was tried, and what held

| Attack | Result |
|---|---|
| Edits outside the evidence folder, a merge, a ready PR, a model name or a wrong author | None. `git diff --name-only origin/main...HEAD` lists this folder only. One commit, author Zodiacs Admin, no trailer. PR 981 is open and a draft. |
| Saved records that do not match what was fetched | They match. All 19 raw HTML files hash to the values in `records/pages/fetch-log.txt`. Running `tools/extract.py` again on the raw HTML gives the ten saved texts byte for byte. The seven connector responses hash to `call-log.txt`. |
| Live pages that differ from the saved ones | Six pages were opened again in headless Chromium (Scorpio daily, Scorpio weekly, Spanish Scorpio daily, `/today/`, the birthday page, the 2027 page). The reading text is the same. Differences are only text the browser hides or swaps (findings 1 and 2). |
| A connector output that cannot be reproduced | `get_horoscope` for Leo, Bangkok, sent again: the response is byte-identical to the saved one (SHA-256 `093bd697…`). The default-window `get_personal_transits` call that the builder says came back empty once answered normally three times out of three (HTTP 200, 14,547 bytes). |
| A style guide that was not really opened | It was. The document was opened again through the document connector (revision 1, one tab). `style-guide.md` matches it word for word. No rule in it is missing from R1 to R13. The three `AGENTS.md` rules the issue names are H1 to H3. |
| Counts that do not add up | They add up. The score table tallies to 93 pass, 90 partial, 39 fail, 34 not applicable (256), and each per-rule line in section 3 matches the table. |
| A failing score with no fix, or a table cell with no reason | None. Every one of the 256 cells has a row in section 4, and every partial and fail names at least one of S1 to S18. |
| A fix that points at a file or line that is not there | All checked references exist on `origin/main`: `edition-freshness.ts` line 54, `engine/lite.ts` lines 65 to 80, `daily.ts` line 142, `compat.ts` lines 179 to 183, `transits.ts` lines 25 to 53, `i18n/daily-reading.ts` lines 38 to 41, the `"moonPhase": "First Quarter"` receipt in `horoscope-program.json`, the "degree when the JSON provides one" line in `docs/HOROSCOPE-GENERATION.md`, and "Most people born on this date" in two birthday files. |
| An em or en dash in a saved text | None, in the page texts or the connector responses (literal and `\u` forms both searched). |
| A word count that is wrong | All six daily counts recount to the report's figures (101, 93, 98, 106, 91, 65), and the monthly to 337. |
| A sky fact marked checked that does not recompute | None found. See the sky section below. |
| A defect claimed without a check | All four hold. See the sky section below. |
| A page treated as a translation that is not one | The report says itself that the Spanish daily is not a translation. The label in its sample table still says "Translated daily" (finding 7). |

## Findings

### Should fix (in the report only)

**1. R1 on the four English dailies is scored on wording a reader did not see that day.**
The report scores P1 to P4 partial because the served text opens "For the November 11, 2026 edition,". It says the "Today," form was "taken from the source rule" and not seen. Two things settle it. The saved raw HTML already carries the reader's form in an attribute: `data-edition-current="Today, check the budget of time, attention, and material resources. …"`. And a live Chromium render at 18:36 UTC on the edition day shows `data-edition-state="current"` and the paragraph "Today, check the budget of time, attention, and material resources." That is the same opener as X1, which is scored pass.
So the caveat does not hide a fail. It runs the other way: four partials are harsher than what readers saw. Either score P1 to P4 pass on R1 (R1 becomes 6 of 15, and the totals 97 pass, 86 partial), or keep the partial for the second reason given ("leans on abstractions") and then score X1 partial too, since "give play, romance, or creative work a defined place" is the same kind of sentence. S3 still stands for readers without JavaScript and for a page read after its day.

**2. Some quoted evidence is text a browser does not show.**
`tools/extract.py` keeps hidden and collapsed text. Three places where that reaches a score:
- P7, R13: "Your saved-chart comparison is temporarily unavailable. Your Sun-sign baseline is ready below.", the twelve "Sun-sign baseline" blocks and "The November 11, 2026 edition may draw more attention to …" are none of them visible in the Chromium render of `/today/` for a visitor with no saved chart. The visible notes read "Today may draw more attention to …". The partial can stand on "reads as a data desk", but these three quotes should go, or be labelled as served but hidden. The last clause of S10 ("Keep fallback wording … out of the served HTML") and the line 55 remark in S3 then describe what a crawler or a reader without JavaScript gets, and should say so.
- P6, R12: the partial counts "Luna 13.8° Sagitario · casa 2" and "℞", which sit in a collapsed "Por qué esta lectura" block. On P1 to P4 the same kind of collapsed receipt block is the reason R12 passes. One rule should be applied both ways. What is left for P6 is four house numbers, each explained in the same sentence.
- The limits section should say that the saved texts include hidden and collapsed text, not only that no browser was run.

**3. H1 and R10 disagree on three readings.**
Section 1 says H1 is scored stricter than R10, and H1 covers guarantees. P9 ("pays off later"), X2 and X5 ("an opening that rewards you if you take it", "help that arrives without being asked") are partial on R10 for a promised outcome and pass on H1. Either those three H1 cells are partial (H1 becomes 10 of 16), or section 1 should say H1 was applied to the named topics only and promised outcomes were counted under R10 alone.

**4. The R9 evidence on the dailies is overstated.**
"Sentences run to 21 to 25 words" is true of one sentence in each reading: the third section, joined by a semicolon (25, 21, 24 and 21 words in P1 to P4, 22 in X1). The other sentences are 8 to 17 words. The fail therefore rests on the abstract nouns, which is a judgment, and partial is as easy to defend as fail. The row should give the real spread so the judgment can be argued with.

**5. Sky facts in the saved outputs with no check and no "unchecked" mark (G4).**
Section 5 does not list these, and section 4 scores R4 pass on the readings that carry them:
- X5: `pass 3 of 3` and the `firstPass` date on seven of the nine contacts.
- X2: "From Sat 14 Nov" on the Sun and Saturn line.
- X4: the element and modality counts for both charts. (Section 4 says the 29 contacts and the scores were not checked; section 5 does not repeat it.)
- X3: the latitudes and speeds. Only the longitudes, the phase angle and the lit fraction were compared.
- P7: "The Sun is in the middle third of the sign", and the degrees printed for the Saturn and Neptune stations (they are in the check output, not in the table).

Recomputed in this review, same ephemeris as the builder used, separate code:

| Fact | Recomputed | Result |
|---|---|---|
| X5 first passes: Mercury trine Jupiter 6 Oct, trine Mars 8 Oct, sextile Uranus 8 Oct, opposite Sun 11 Oct, opposite Mercury 11 Oct, sextile Neptune 12 Oct; Venus square Saturn 3 Sep; three passes each | Same dates, three crossings each; one crossing each for the two Sun contacts | Correct |
| X2 "From Sat 14 Nov" | The Sun comes within 3° of the sextile on 14 November at 17:00 UTC | Correct for a 3° orb |
| X4 elements and modalities, Moon left out | 4, 2, 2, 1 and 4, 3, 2 for the first chart; 1, 3, 4, 1 and 5, 3, 1 for the second | Correct |
| P7 "middle third" | Sun at 19°06′, between 10° and 20° | Correct |
| X4 "29 contacts", X3 latitudes and speeds | Not recomputed here either | Unchecked |

No score changes. The rows need adding to section 5, the last one as unchecked.

**6. Two statements about the method are not backed by the records.**
- "The birthday pages are the largest reading family in the sitemap (about 1,100 URLs)". The live sitemap has 1,910 `<loc>` entries, as the report says, and 367 of them are under `/birthday/`. It is still the largest family; the figure is wrong by a factor of three (1,101 is what you get by counting each page's three hreflang lines).
- "The sample was fixed before any text was read, from the live sitemap". The sitemap was not saved with the records, so this rests on the builder's word. The fetch log is consistent with it: the whole scored sample was fetched in 36 seconds, the two feature pages before the 404 probes, and the later probes (18:19 UTC) added nothing to the scored set. The report should say the sitemap was not kept. Also `/year/` appears in the fetch log (a 304-byte redirect stub) and is not named under "Not sampled".

**7. P6 is labelled "Translated daily" in the sample table.**
The report's own finding is that it is not a translation. For G1 the report should say plainly: no translated horoscope is live. Checked here: `/fr/horoscopes/scorpio/` and `/it/horoscopes/scorpio/` answer 200 with a "not yet translated" notice, `/ru/` and `/zh/` are 404, the Spanish weekly and monthly are 404, and `/pt/horoscopes/scorpio/` is the same four-note reading as the Spanish page. P6 was sampled as the nearest live thing. G1 says "if live", so the test is met either way.

### Notes

**8. Six of the sixteen readings are one template.** P1 to P5 and X1 all come from `horoscope-program.ts`. Lines such as "R3: 0 passes of 16" are true, but six of those sixteen are one cause. The love, career, tomorrow and monthly horoscope pages (all live), compatibility pair pages, People pages and event pages were not read; the report says so. G1's minimum is met.

**9. X3 passes by absence.** `get_sky` has no prose, so its passes on R7, R10 and R11 mean "nothing there to break the rule". Not applicable would be as fair, and would take three from the pass total.

**10. The minute of five event times was checked against the page's own source.** `/today/` prints times solved on NASA Horizons from `src/data/nasa-event-instants.json`. The builder's own recompute lands 2 to 10 minutes away for the three stations, the Venus ingress and the Uranus and Pluto trine, and the rows are marked checked against that same file. The values are in the file as quoted (00:27:28, 08:12:42, 11:22:49, 23:31:06, 22:18:23). The report is open about this, and G4 accepts the site's own calculation. It is still a comparison of the page with its own data, not a second source, for those five minutes.

**11. The "First Quarter" label is confirmed, with one caution.** The site's own engine, asked through the connector's `check_sky_fact` (first quarter, 2026-11-15), answers false. This review's recompute gives 68.15° at noon UTC. One caution on the cause: 68.15° falls in the first-quarter slice if the circle is cut into eight equal 45° slices (67.5° to 112.5°), so the stored label may come from that older rule and not from an error in the angle. That was not traced here. The disagreement with `engine/lite.ts` stands either way.

**12. S11 names a prompt without a file.** "The brief or prompt used to write `src/content/birthdays/*.mdx`" does not point at a file. The verifier it also names (`scripts/independent-copy-verifier.ts`) is real, so the fix is still at the source.

## Sky facts recomputed in this review

Method: `astronomy-engine` 2.1.19, geocentric apparent longitude of date, with search code written for this review (not the builder's scripts), plus one call to the live connector's `check_sky_fact`. Like the builder's check, this is a second run of the site's own ephemeris, not a second ephemeris. The scripts and outputs are with the job's run files, outside git.

Items the builder marked **unchecked**, now checked:

| Fact as printed | Recomputed | Result |
|---|---|---|
| Retrograde starts in 2026: Saturn 26 Jul, Uranus 10 Sep, Neptune 7 Jul, Pluto 6 May (P7, P9) | 26 Jul 19:57, 10 Sep 18:40, 7 Jul 11:20, 6 May 15:44 UTC | Correct |
| "Seven are within three degrees of exact" (P7) | Seven: Mercury square Pluto 2.25°, Venus sextile Mars 0.73°, Venus sextile Jupiter 2.48°, Mars conjunct Jupiter 1.75°, Uranus sextile Neptune 2.38°, Uranus trine Pluto 1.04°, Neptune sextile Pluto 1.34° | Correct |
| Uranus retrograde to 12 February 2028 (P9) | Direct 12 Feb 2028, 23:40 UTC | Correct |
| "Jupiter stays in Virgo until August 24, 2028" (P9) | Enters Libra 24 Aug 2028, 05:04 UTC | Correct |
| All ten "The shadow runs …" ranges (P9) | Mercury 25 Jan to 23 Mar, 26 May to 19 Jul, 17 Sep to 13 Nov; Mars 5 Nov 2026 to 8 Jun; Jupiter 17 Sep 2026 to 11 Jul; Saturn 4 May to 27 Mar 2028; Uranus 25 May 2026 to 26 May, and 30 May to 29 May 2028; Neptune 18 Mar to 4 Apr 2028; Pluto 13 Jan to 9 Feb 2028 | All ten correct |
| Sun Yat-sen and Grace Kelly born on 12 November (P8) | Not a sky fact; both dates are as commonly recorded (1866 and 1929). No source was opened here | Still unchecked |
| NASA penumbral magnitude 0.0014 (P9) | No NASA source opened | Still unchecked |

Items the builder marked **checked**, sampled again:

| Fact | Recomputed | Result |
|---|---|---|
| Moon on 15 November, noon UTC: "First Quarter" (P5) | 68.15° from the Sun; the site's engine says no first quarter on that date | Defect confirmed |
| Venus direct: page 00:27, connector 00:21 (P7, X6) | 00:20:48 UTC by speed crossing zero; repo NASA value 00:27:28 | As reported |
| X6 in New York: Venus direct and Sun trine Neptune fall a day earlier | 00:21 UTC on 14 Nov is 19:21 on 13 Nov; 00:12 UTC on 24 Nov is 19:12 on 23 Nov. The other dated events keep their date in New York | Defect confirmed; exactly two dates |
| X7: four planets retrograde; Venus "changed sign that day" | Saturn turned retrograde on 4 May 1990 at 22:46 UTC, outside any 3 May birth, so four is right. Venus entered Aries on 4 May at 03:51 UTC | As reported |
| X7: fire 0, earth 6 | Needs the Moon in Virgo and Venus in Pisces, both listed as unknown in the same result | Defect confirmed |
| X2: "Reading confidence 40%" with no Sun-sign reading returned | `status: choose-sign`, two figures in one result | Defect confirmed |
| X5: nine exact times | Same to the minute | Correct |
| House numbers counted from the sign (P6, P7, X1, X6) | All as printed | Correct |

## Not done in this review

- R9 and R13 were not rescored reading by reading. The quotes were read against the records and are accurate; the scores are one reader's judgment, as the report says.
- No fresh NASA Horizons query was made.
- The Spanish was read by the reviewer, not by a native reviewer.
- The builder's Dias calls and the owner calls on jobs 1 to 4 were not acted on.
