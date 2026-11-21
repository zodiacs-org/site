# Review of the one fix round (ZOD-108)

A new session, separate from the builder's, checked the fix round against
the findings in [BREAKER.md](BREAKER.md) that the owner approved for fixing:
B1 and S1 to S8. Run on 13 November 2026, about 04:00 to 04:15 UTC (11:00 to
11:15 Asia/Bangkok), on commit `c46b5f844`. Nothing was sent, published,
submitted, merged or marked ready. No draft was edited; this file is the
only addition. `BREAKER.md` is unchanged.

## Verdict

**The approved fixes hold. B1 is fixed in all three files. S1 to S8 are each
fixed as asked.** No blocker was found.

The round introduced **one new should-fix** (F1, a sentence in the page
draft that the round itself rewrote) and this review found **one more
should-fix** in an item the round added to the brief (F2). There are
**seven notes**. None of them is in a letter's statement to a provider.

No further fix pass was started. F1 and F2 are for whoever next edits these
drafts, before the page draft or the brief is used.

| Finding | Asked | After the round |
| --- | --- | --- |
| B1 | IERS letter, `SOURCES.md`, `README.md` stop saying the C04 page does not name the paper | **Holds.** |
| S1 | NAIF letter: narrow "Nothing derived from DE440 is distributed" and "One thing" | **Holds.** |
| S2 | NAIF letter, question 2: quote what the rule asks; offer the rest as our own | **Holds.** |
| S3 | Say the withdrawn IERS sentence is also in the engine's Python notice | **Holds.** |
| S4 | Brief question 10: two epoch values; correct the key's wording | **Holds.** |
| S5 | Brief: carry C3 (rest), C4 (wheel), C6, C8 and the second reading in C1 | **Holds**, with F2 on the C1 line. |
| S6 | Six citations | **Holds** for all six, with F1 on one rewritten sentence. |
| S7 | Part 3 gains live lines 49 and 31 | **Holds.** |
| S8 | Split the unknown-birth-time sentence by surface | **Holds.** |

## What was checked, and against what

- **The diff** `fa9c42015..c46b5f844`: seven files, all in this folder.
  Every changed sentence was read.
- **The builder's copies of the providers' pages**
  (`/workspace/runs/fable-jobs/job6/raw-terms/`, kept outside the
  repository): the C04 page (digest `8d42083e3e58429b`), the C04 readme and
  header, the NAIF Rules page (digest `ae85f851646e7c4f`), the SSD FAQ.
- **The engine repository at `bc0b5a7`** with `git show`: `NOTICE`,
  `LICENSING.md`, `python/THIRD_PARTY_NOTICES.md`, `CITATION.cff`,
  `python/pyproject.toml`, `src/vedic/ayanamsa.ts`, `docs/vedic.md`; the
  `infra/minorbodies` branch's `minorbodies/LICENSING.md`; and the ZOD-65
  sweep folder at `255b615`, read only.
- **The site repository**: `vendor/zodiacs-engine-1.1.0-rc.2.tgz`
  (`package/NOTICE`), `docs/engine-validation/SWISS-OUTPUT-REMOVAL.md`,
  `src/lib/engine/full.ts`, and this folder's `raw/pages/methodology.txt`
  and `raw/mcp/tools-list.descriptions.txt`.
- **Job 2's files at `ee3638f`**: `03-licences.md` (C1 to C8 and the second
  pass table) and `BREAKER.md` (N4).
- `python3 tools/check-drafts.py`: every key defined, 19 of 19 tools in
  order, no directive wording. A search of the seven changed files for em
  and en dashes finds none.
- Pull request 982 with `gh pr view`: open, draft, head `c46b5f844`, four
  commits. Its description does not carry the withdrawn finding.

No request was sent to any provider, to Horizons or to the live connector.

---

## The approved fixes, one by one

### B1. Holds

The page copy, lines 331 to 335, shows the "Technical note" link to the
readme and under it the link to doi 10.1007/s00190-018-1186-3 titled "The
IERS EOP 14C04 solution for Earth orientation parameters consistent with
ITRF 2014". That is the paper at `NOTICE:197-201`.

- `02-letter-iers.md`, "What we carry": the letter now says the page "links
  the readme as its "Technical note" and, under it, that paper by title",
  that "The readme itself names no paper" (a search of the readme for the
  author, the DOI, the journal and "14 C04" finds nothing), and that the
  paper is on 14 C04 while the file's header says 20 C04. Each half is
  carried by its key. Question 4 is unchanged and still follows.
- `SOURCES.md`, T-C04-PAGE: says what the page shows, with the lines.
- `README.md`, finding 5: withdrawn in place, with the reason.

A search of the folder (leaving `BREAKER.md` aside), the two handoff files
and the pull request's description for "neither names" and "no longer names"
finds only the withdrawal note itself.

### S1. Holds

The bold sentence is now "No pack is distributed today, and the published
package holds no JPL value", which is what `[E-LIC-JPL]`,
`[E-NOTICE-DE440]` and `[E-DE440-PACK]` say. The next bullet says "At least
these" and names the draft branch's comparison. The ZOD-65 folder at
`255b615` holds a report, tables, eight era files and a `summary.json` of
differences and statistics, so "as differences and statistics" is right.
The two bullets no longer disagree. See note 1 for the brief.

### S2. Holds

All four quotations added to the letter were found word for word in the
Rules page copy: "may be downloaded and used by anyone, consistent with the
other rules found on this web page"; "must be limited to appropriate
actions"; "annotated with appropriate metadata"; "If you have any questions
about these rules please contact the NAIF Manager". The page has no mention
of a digest or of naming a source kernel, and question 2 now offers those
"of our own accord". The page says a modified kernel "should be annotated
... and validated"; the letter's "asks" fits that.

### S3. Holds

`python/THIRD_PARTY_NOTICES.md:38-40` at `bc0b5a7` reads as quoted in the
IERS letter's open points and in brief question 2. The letter keeps "The
engine's licence record withdrew that sentence" under "What this draft
deliberately does not say" and qualifies it two paragraphs later. That is
enough for an owner's note.

### S4. Holds

`src/vedic/ayanamsa.ts:138-142` and `docs/vedic.md:707-709` and `:718-721`
read as E-VEDIC-SWISS now quotes them. The brief gives both values, says
what the code's `source` string names and what the guide names, and carries
job 2's "published constants read from documentation, not program output"
with its key. The Swiss count now reads as one set of 44,071 split into
40,597 and 3,474, which is what `SWISS-OUTPUT-REMOVAL.md:36-44` says.

### S5. Holds, with F2

Each added line under question 11 was read against its source:

- `CITATION.cff:7-10`: as quoted.
- `python/THIRD_PARTY_NOTICES.md:61`: as quoted; `NOTICE` on `main` does
  ship zone histories.
- `python/pyproject.toml:34`: as quoted. The archives' names are job 2's
  and the line says they were not opened.
- C6: the five examples are in job 2's list; four of the five are confirmed
  in job 2's second pass table, so "for most of them" is fair.
- C8: the four items are job 2's four.
- C1: the branch's words are quoted exactly. See F2 for what is left out.

### S6. Holds for all six, with F1

1. `get_upcoming_events`: job 2's `BREAKER.md` N4 at `ee3638f` records the
   tool giving `2026-01-26T14:31:41.087Z`. Live line 47 gives 17:35 UTC.
2. E-LIC-PROV: the sentence is at `LICENSING.md:26-27` under the heading on
   line 24. Cited as 24 to 26; close enough.
3. "relies on for reuse by anyone" is gone.
4. "a different JPL group" is gone; "at a different address from NAIF's" is
   plain from the two addresses.
5. The page draft's first sentence is narrowed and keyed. See note 2.
6. The rc.2 archive's `NOTICE` was opened: lines 111 to 113 (32 values of
   Table S15), 152 to 155 (tzdb 2025c with backzone), 158 to 159 (leap
   seconds), 169 to 170 (Bulletin A of 2026-09-24). Live lines 31 and 54
   say the rest. No rc.3 key is left on a sentence about what the site
   does. See F1 for one sentence that the rewrite made narrower than its
   source.

### S7. Holds

Live lines 49 and 31 read as quoted in the two new rows. The rows sit after
row 48 and before row 62, so 31 is out of order; the content is right.

### S8. Holds

Live line 65 carries the site's rule as now stated. Job 2's N4 records
`"basis":"utc-noon"` for a birth date given alone. The live description of
`get_natal_chart` says "on a day the Moon changed sign, the Moon sign, which
it gives as the two possibilities". The two surfaces are now kept apart.

---

## New findings

### F1 (should fix). Page draft: UT1 − UTC is said to come from one IERS file. The archive names two.

`06-how-we-calculate.md`, Part 1, "Time": "From 1972 to 2 October 2027 ...
the Earth's rotation from the IERS values of UT1 − UTC. Those values come
from the IERS file of 24 September 2026, which holds measurements and
predictions. `[S-RC2-NOTICE]` `[L-METH]` (line 31)"

The rc.2 archive's `NOTICE`, lines 164 to 171, says: "It carries UT1 - UTC
for 1972 derived from the IERS EOP 20 C04 series, eopc04.1962-now of
2026-09-28 ... and UT1 - UTC from 1973-01-02 from IERS finals2000A.all
(Bulletin A) of 2026-09-24". So the values of 1972 come from a second file,
of 28 September, from a different IERS centre. The sentence was written in
this round. The S-RC2-NOTICE row in `SOURCES.md` cites lines 168 to 173 and
quotes only the Bulletin A half.

It matters more than its size because the 1972 values are the subject of
the IERS letter in this same folder, which states the two sources correctly.
"which holds measurements and predictions" is carried by live line 31 ("the
IERS measurements of UT1 and their predictions"), not by the archive.

What the sentence should say: from 1973 the values come from IERS Bulletin
A of 24 September 2026, which holds measurements and predictions; the
values of 1972 come from the EOP 20 C04 series. The row should cite lines
164 to 171.

### F2 (should fix). Brief, question 11: the second reading of JPL's terms is of the same FAQ, and the brief does not say so

The added line says another branch holds that JPL's pages "do not supply a
blanket licence for numerical API output", and that job 2 treats that
reading as superseded "by the FAQ sentence quoted in question 7". A reader
takes it that the branch read some other page.

`origin/infra/minorbodies:minorbodies/LICENSING.md:30-33` says: "The SSD
publication FAQ (`https://ssd.jpl.nasa.gov/faq.html#publish`) asks users to
obtain permission for republishing site information and points to JPL's
copyright notice." The builder's copy of that FAQ, fetched on 11 November
2026, answers the same question with "No permissions are needed. The data
provided on this site are considered public domain."

So the engine repository holds a record, dated 2026-10-15, that reads the
very page the brief quotes as saying the opposite. Either the page changed
between 15 October and 11 November or the branch misread it. Counsel should
be told that, since the brief's point is that two readings exist. Job 2's
own description of the branch's reading ("of JPL's general site notice") is
also narrower than the branch's text; the brief does not repeat it, which
is right. E-MINORBODIES in `SOURCES.md` quotes lines 33 to 35 and should
take in lines 30 to 33.

Whether the page changed cannot be told from the copies held. No archive
copy was fetched in this review.

---

## Notes

1. **The brief does not carry S1's addition.** Question 6 still names only
   the 200 instants as kernel-derived material in the public repository.
   The NAIF letter now also names the draft branch's day-by-day comparison.
   S1 was about the letter, so this was not asked for; the two drafts now
   differ on the same fact.
2. **The page draft's first sentence** ("The charts on Zodiacs.org and the
   answers of its connector ... are calculated by one piece of software")
   is keyed to `[S-PKG]` and `[L-CAPS]`. `[S-PKG]` shows that the site
   depends on the engine archive, not that its charts are calculated by
   it. `src/lib/engine/full.ts:4` and `:13` show that ("The implementation
   lives in the exact vendored @zodiacs/engine package"), so the sentence
   is true; a key for that file would carry it better. "The answers of its
   connector" is wide for a connector that also returns written
   horoscopes; "the calculated answers" would be exact.
3. **J2-BREAKER's row in `SOURCES.md`** still describes what S3, S4 and S8
   of that file rest on. Two sentences now cite its N4; the parentheses in
   the drafts say so, the row does not.
4. **Items of the licence review still not in the brief**, none of which
   `BREAKER.md` asked for: the fourth bullet of C3 (`clients/python/NOTICE.md`
   cites a file that exists only under `clients/typescript/`) and the rest
   of C4 beyond the wheel (`python/`, `clients/`, `tools/` are not named in
   `LICENSING.md`; `tools/cli` packs `conformance/**`). The brief mentions
   `skills/`, `bots/` and `api/` at line 365.
5. **`README.md` still shows the builder's own "Met" table**, with the
   sentence that the tests have not been judged again. That is accurate.
   This file is the second judgement: see "L1 to L6 after the round".
6. **`README.md` says "from `origin/main` at `7c7b2d16`".** The branch was
   since rebased onto `46d49a53f`. The S rows were read at `7c7b2d16`; the
   files checked here read the same on the rebased branch.
7. **Not re-opened, as the builder says:** the wheel's archives, the
   evidence file quoting Swiss appendix E, Europe PMC, NOVAS, the CC BY-SA
   branch, A&A's two policy pages, the first NAIF message, the mailbox.

---

## L1 to L6 after the round

| Test | After `BREAKER.md` | After the fix round |
| --- | --- | --- |
| L1 Letters | Not met as written (B1; S1, S2) | **Met.** The false sentence is gone and the two NAIF sentences match their sources. The CDS letter was not changed and was not in question. |
| L2 Lawyer brief | Holds, short on coverage | **Holds.** The missing items are in. F2 is one fact short on a line the round added. |
| L3 Tool descriptions | Holds | **Holds.** One key corrected; no description's meaning changed; no published definition touched. |
| L4 How we calculate | Holds | **Holds.** None of the five named claims appears; the accuracy figures are still held. F1 is a sourcing error in a non-accuracy sentence. |
| L5 Citations | Not met | **Met but for F1.** B1 and the six citations of S6 are corrected. F1 is one sentence wider than its key. |
| L6 Nothing sent or published | Holds | **Holds**, as far as it can be seen from outside: seven files in this folder, author and committer `Zodiacs Admin <admin@zodiacs.org>`, no trailer, pull request 982 open and a draft. The mailbox was not opened. |

## Still open for the owner (unchanged; none decided here)

1. Whether any letter is sent, to whom and when. NAIF: the site's record
   says "Do not resend it". CDS: its site is degraded.
2. Whether the brief goes to a lawyer, and which.
3. Whether a letter to ESA is wanted. None is drafted.
4. Whether these tool descriptions, site draft 971's, or neither become the
   published definitions.
5. Which accuracy sentence, if any (candidates A to F), a public page may
   carry; whether the flagged lines of the live methodology page are
   corrected; where the page would live.
6. Someone should read A&A's two policy pages in a browser.
7. The owner calls from jobs 1 to 4 were not acted on.
8. New, from this review: whether F1 and F2 are corrected before the page
   draft or the brief is used. The one fix round is spent, so this review
   did not correct them.
