# Second-session review of the ZOD-108 drafts

A separate session tried to break the builder's results against tests L1 to
L6. Run on 11 November 2026 from about 18:40 to 19:10 UTC (12 November,
01:40 to 02:10 Asia/Bangkok), on commit `87f97962`. Nothing was sent,
published, submitted, merged or marked ready. No draft and no other file in
this folder was changed; this file is the only addition.

## Verdict

**The builder's table does not survive as written. L3, L4 and L6 hold. L1
and L5 do not, because of one false sentence. L2 holds on its main points
and is short by a few items.**

There is **one blocker**, **eight should-fix items** and **twelve notes**.
All of them are in the drafts' wording or citations. Nothing was found that
was sent, published or changed outside this folder.

| Test | Builder | After this review |
| --- | --- | --- |
| L1 Letters | Met | **Not met as written.** Three letters, each addressed, with a purpose, facts and citations, each headed as a draft. One factual sentence in the IERS letter is false and its own citation contradicts it (B1). Two NAIF sentences say more than their sources (S1, S2). |
| L2 Lawyer brief | Met | **Holds on the named points, short on coverage.** No legal conclusion. The A&A sentence is correctly reported as commented out. Hipparcos and ESA are left open. Items the licence review raised are missing or understated (S3, S4, S5). |
| L3 Tool descriptions | Met | **Holds.** 19 of 19, no directive wording, no published definition changed. One citation points to the wrong record (S6). |
| L4 How we calculate | Met | **Holds.** None of the five named claims appears. Every accuracy figure is held. The Swiss and Moon/ΔT sentences on the live page are flagged. Two smaller points (S7, S8). |
| L5 Citations | Met as far as a builder can say | **Not met.** Every key is defined, and nearly every quotation was found word for word. B1 is a citation that contradicts its sentence, and S6 lists five more that do not carry their sentence. |
| L6 Nothing sent or published | Holds | **Holds**, as far as it can be seen from outside. |

## What was checked

- **Every quotation from a provider's page** in `SOURCES.md` (the T rows),
  against the builder's copies in the job folder (`raw-terms/`, digests
  checked with `SHA256SUMS`): NAIF rules, contact and kernel listing; the
  SSD FAQ and API policy; the Horizons manual; the C04 header, readme and
  page; the IERS imprint, Data Centre list and record; the Bulletin A page;
  the leap-second list; the CDS home page and both archive copies, read in
  the HTML source; the three ESA pages; the journal page. All found as
  quoted, except the C04 page (B1).
- **Every line citation into the engine repository** (the E rows), with
  `git show origin/main:<file>` at `bc0b5a7`: `LICENSING.md`, `NOTICE`,
  `docs/de440.md`, `conformance/RESULTS.md`, `docs/time.md`, `package.json`,
  `AGENTS.md`, `.zenodo.json`, `README.md`, `src/vedic/ayanamsa.ts`,
  `docs/vedic.md`, the corpus file, the fixed-stars branch and the ZOD-65
  sweep README at `255b615` (read only). The line numbers hold. Two rows are
  loose (S4, S6).
- **Every line citation into the site repository** (the S rows) at
  `7c7b2d16`, the evidence file behind candidate D, and site pull request
  943 and engine pull request 80 with `gh pr view`.
- **The live connector.** `tools/list` fetched again at 18:42 UTC: 150,468
  bytes, SHA-256 `d59dd1ff...ac37f`, the same bytes as the builder's copy
  and as job 3's. All 19 descriptions and input fields were read against
  the 19 drafts. Two calls with no personal input were made (see
  "Requests this session sent").
- **Jobs 1 to 4.** Each cited finding was opened in its worktree: job 1's
  `README.md`, `SWEEP-REVIEW.md` and `BREAKER.md`; job 2's `01-accuracy.md`,
  `03-licences.md`, `BREAKER.md` and `sign-changes/results/summary.md`; job
  3's `REPORT.md`, `BREAKER.md`, `tools/cases.json`, `rules/SOURCES.md` and
  `pages/about.txt`. Call numbers, finding numbers and figures match, apart
  from S6.
- **The live methodology copy** (`raw/pages/methodology.txt`), every line
  the page draft quotes or flags, and a search of the rest of the page.
- **The version the site runs.** Where the page draft cites the engine's
  `main` (1.1.0-rc.3) for something the site does, the same fact was looked
  up in `vendor/zodiacs-engine-1.1.0-rc.2.tgz` (S6).

Not checked: A&A's two policy pages (they refuse automated reading, as the
builder says), the three catalogues' ReadMe files, the Europe PMC, NOVAS,
GeoNames, IANA and ERFA pages that the brief takes from job 2, Astronomy
Engine's own `LICENSE`, the September message to NAIF, the mailbox and the
directory portals.

---

## Blocker

### B1. The IERS letter tells the Centre its page does not name the paper. It does.

`02-letter-iers.md`, "What we carry", last bullet: "On your page today the
"Technical note" link goes to the readme, and neither names that paper."
`README.md`, finding 5: "The Centre's page for C04 no longer names the paper
our notice cites." `SOURCES.md`, row T-C04-PAGE: "neither the page nor the
readme names Bizouard et al. 2019 today."

The builder's own copy of the page says otherwise. In
`iers-eoppc-c04-page.html` (digest `8d42083e...`, the one `SOURCES.md`
records), lines 331 to 335, displayed and not inside a comment:

```
<b><a href="http://hpiers.obspm.fr/iers/eop/eopc04/readme" target="_blank">Technical note</a></b>
<br><br>
<b><a href="https://link.springer.com/article/10.1007/s00190-018-1186-3" target="_blank">
The IERS EOP 14C04 solution for Earth orientation parameters consistent with ITRF 2014
</a></b>
```

That title and DOI are the paper `NOTICE:197-201` cites. The page gives it
by title and link, without the authors' names, which is why a search for
"Bizouard" in the page text finds nothing. The readme does not name it;
that half of the sentence holds.

Why a blocker: it is a factual sentence in a letter, addressed to the
people who keep the page, about what their page says, and the cited source
contradicts it. It is also listed in `README.md` as a discovery.

What the draft should say: the page links the readme as its technical note
and, under it, the 2019 paper on the 14 C04 solution; the series served
today is 20 C04; so the question in the letter (how would you like EOP 20
C04 cited) stands, and finding 5 in `README.md` should be withdrawn.

---

## Should fix

### S1. NAIF letter: "Nothing derived from DE440 is distributed today" is wider than the facts under it

The bullet opens in bold with that sentence and cites `[E-LIC-JPL]` and
`[E-NOTICE-DE440]`, which speak of the published package only ("No value of
a JPL ephemeris, and no coefficient fitted to one, is in the package"). The
next bullet says values computed from the kernel are in "our public
repository". Both repositories are public (`gh repo view`, today), and
`docs/evidence/de440-20261110/oracles/erfa-places.json` holds the places as
plain numbers. A reader at NAIF would see the two bullets disagree. Say: no
pack is distributed and the published package holds no JPL value; values
computed from the kernel at 200 instants are in the public repository as
test evidence.

"One thing computed from the kernel" is also not established. The cited
rows show that the oracle files exist, not that nothing else does. The
ZOD-65 branch on the same public repository holds a day-by-day comparison
with the kernel (differences and statistics), and the site repository has
evidence files that name `de440s.bsp` (the ones opened here hold
statistics). "At least" is what the sources support.

### S2. NAIF letter, question 2: the rule is paraphrased as asking for things it does not ask for

"We would state the producer, the source kernel and its digest, and that the
file is a refit and not JPL's own series, which is what we understand your
rule for a modified kernel to ask. `[T-NAIF-RULES]`"

The page asks, for a modified kernel: replace the original producer's
attribution with "the name and institution of whomever has made the last
modification"; annotate it "with appropriate metadata"; validate it; change
the file name; and keep modifications "limited to appropriate actions". It
does not mention a digest or naming the source kernel. Offer those as what
we would do, and quote what the rule asks separately. The letter also
leaves out two sentences of the page that bear on the question: "SPICE
kernels placed on the NAIF server may be downloaded and used by anyone,
consistent with the other rules found on this web page", and that
modifications "must be limited to appropriate actions".

### S3. The withdrawn IERS sentence is also in the engine repository

The IERS letter ("Open points") and the brief (question 2) say the sentence
survives in "one record in the site repository". Job 2's licence review
(C3) lists a second place, and it is there at `bc0b5a7`:
`python/THIRD_PARTY_NOTICES.md:38-40`, "the International Earth Rotation
and Reference Systems Service (IERS EOP 20 C04 and Bulletin A,
finals2000A.all), which asks that its products be cited". The letter's
"What this draft deliberately does not say" tells the owner that the
engine's record withdrew the sentence. A notice file shipped with the
project's own Python package still makes it. Both drafts should say so.

### S4. Brief, question 10: "one ayanamsa epoch value" is short by one, and the key's wording is off

Job 2 (C2) lists two shipped epoch values whose trail runs through Swiss
Ephemeris's documentation: Krishnamurti (`docs/vedic.md:718-720`) and Lahiri
("as quoted in the Swiss Ephemeris documentation, §2.8.5",
`docs/vedic.md:707-709`, read here), and one evidence file that quotes
values from its appendix E. The brief gives only the first.

`SOURCES.md`, E-VEDIC-SWISS, says the value is shipped "with its source
given as" the Swiss documentation and cites `src/vedic/ayanamsa.ts:140`.
The `source` string in that file reads "22°21′50″ at 1900-01-01, fitted to
KP Reader 1's table (Hand, Dawson)". The Swiss documentation is named in
`docs/vedic.md:719`, beside a second source (the Solar Fire guide).

### S5. Brief: items from the licence review that are not carried

The test fails the brief if "a question from the licence review that this
job's sources raise is omitted". These are in `03-licences.md` and not in
the brief:

- C3, the rest: `CITATION.cff` admits its format reads a list of licences
  as a choice; `python/THIRD_PARTY_NOTICES.md:61` says the geo entry does
  not redistribute the time zone database, which is no longer true of
  `main`.
- C6: `LICENSING.md` states several third parties' terms with no citation
  to the party.
- C8: parts of the engine's provenance rest on the site repository, whose
  `LICENSE` reserves all rights. This bears on question 1.
- C1: another engine branch (`infra/minorbodies`) reads JPL's general site
  notice more guardedly ("Permission to reproduce may be required"). Job 2
  treats it as superseded by the FAQ for SSD data; counsel should still see
  that the repository holds two readings.
- C4: the Python wheel bundles an Astronomy Engine archive and an older
  engine archive.

Either add a line for each under question 11 or say they were left out and
why.

### S6. Citations that do not carry their sentence

- `05-tool-descriptions.md`, `get_upcoming_events`, Limits: "the tool gives
  14:31:41 UTC", cited to `[J2-ACC]` (A10), `[J2-SIGN]` (line 25) and
  `[L-METH]` (line 47). None of the three records this tool's output: they
  are the engine's own instant and the live page. The record that does is
  job 2's second session, N4 ("`get_upcoming_events` gives
  `2026-01-26T14:31:41.087Z`"). A call made here returned
  `2026-01-26T14:31:41.082Z`, so the sentence is true; the key is wrong.
- `04-lawyer-brief.md`, question 1: "The package was adapted from modules
  of the Zodiacs.org site. `[E-LIC-SITE]`". The cited lines (89 to 95) are
  about the DE440 port. The sentence is at `LICENSING.md:24-26`.
- `04-lawyer-brief.md`, question 5: "which the engine's record relies on
  for reuse by anyone. `[E-LIC-SPDX]`". The cited lines give the licence
  expression and say nothing about reuse.
- `04-lawyer-brief.md`, question 6: "a different JPL group" has no source.
- `06-how-we-calculate.md`, Part 1, first sentence: "Every position on
  Zodiacs.org comes from one piece of software, the Zodiacs engine." No
  key. It is the widest claim on the page.
- `06-how-we-calculate.md`, Part 1, cites the engine's `main`
  (`[E-TIME]`, `[E-NOTICE-TIME]`, `[E-LIC-DT]`, all 1.1.0-rc.3) for what the
  site does on 1.1.0-rc.2: the 2 October 2027 table end, the 24 September
  2026 observation date, tzdb 2025c. Checked here in the rc.2 archive's
  `NOTICE` (lines 113, 131, 154, 160, 172) and on the live page (lines 31
  and 51): the facts are the same in rc.2. The citations should point
  there, since the test asks that rc.3 results are not presented as rc.2's.

### S7. Part 3 misses one accuracy statement on the live page

Line 49 of the methodology copy: "In November 2026 we checked 8,891
statements on the built English pages against NASA, from sign dates to
eclipse times, and 8,849 agreed." No job 1 to 4 file mentions it (searched
for the two figures). Part 3 flags line 48 as "Not rechecked by jobs 1 to
4"; by the same standard line 49 belongs in the table. So does the claim on
line 31, "From 1962 on it is within 0.09 seconds of the IERS value on every
day". Neither is a Swiss or Moon/ΔT sentence, so L4 is not failed by this.

### S8. Page draft, "When the birth time is unknown", joins two surfaces

"on a day when the Moon changed sign the Moon's sign is given as uncertain.
`[L-METH]` (line 65) `[L-TOOLS]` (`get_natal_chart`)". The live page says
the site "marks the Moon's sign as unverified, because the Moon can change
sign during the day", with no condition. The connector gives two
possibilities on a day the Moon changed sign. The sentence is the
connector's rule with the site's page as its first citation. Part 3 already
notes (line 65) that the two surfaces use different noons; the draft should
keep them apart here too.

---

## Notes

- **N1. The A&A finding is right.** In the archive copy of 25 October 2026
  the block headed "Data coming from A&A" starts at source line 92 inside
  `<!-- -->`, and in the copy the archive dates 4 September 2021 at line
  91, also commented. What is displayed is the two links to A&A's pages.
  The issue and job 2's second session describe a displayed entry; the
  letter and the brief correct that and ask, which is what L2 wants.
- **N2. Hipparcos and ESA are left open.** The three ESA quotations were
  found as quoted. Neither the letter nor the brief says the terms "are
  non-commercial" for the values carried.
- **N3. Part 2, candidate A: "It is the only candidate on a merged
  branch."** Candidate D's evidence file is on the site's `main` and is
  printed on the live page. A is the only one on the engine's `main`.
- **N4. `README.md` gives the session as "18:16 to about 19:30 UTC".** The
  commit is stamped 18:37 UTC (01:37 Asia/Bangkok).
- **N5. NAIF addressee.** The contact page the letter cites opens
  "Supported customers may contact any of the NAIF staff". The Rules page
  itself says "If you have any questions about these rules please contact
  the NAIF Manager", which is the better support for the addressee and for
  writing at all.
- **N6. IERS letter, "lists the same series".** The file's header says
  "consistent with ITRF 2020"; the Data Centre's record says "ITRF
  2020-u2024" and titles it "for 1964 - now". That they are one series is
  assumed in "Which series we mean" and asked in question 5.
- **N7. Brief, question 10, the Swiss count.** The record says 44,071
  values "left" their files, of which 40,597 are gone and 3,474 still
  appear elsewhere. "44,071 were removed; 3,474 were kept" reads as two
  separate sets.
- **N8. `get_compatibility`.** The live capabilities text adds that from 13
  to 17 the tool points to a friendship reading of the two Sun signs. The
  draft says only that it gives no reading. Not an error.
- **N9. Sentences taken from job 2 alone.** Question 9 (Europe PMC),
  question 11 (NOVAS, the CC BY-SA branch) and the "confirmed" list
  (GeoNames, IANA, Astronomy Engine, ERFA) were not re-opened by the
  builder, who says so, and were not re-opened here either.
- **N10. The first NAIF message.** Its text is in neither repository, so
  whether the follow-up is consistent with it cannot be checked.
- **N11. Model name.** The commit, the pull request text and the files
  carry none. One quotation of a directory's rule contains the assistant's
  product name; it is a quotation. The branch name was set by the
  coordinator.
- **N12. Fetch count.** The log has 36 lines for 30 addresses, six of them
  second attempts, as `README.md` says. One address in the log (a NAIF
  readme, 404) is not in `SOURCES.md`; nothing rests on it.

---

## L3 in detail

- **Coverage.** The 19 names and their order in the draft equal the live
  list fetched here.
- **Directive wording.** Each "What it does", "When it fits" and "Limits"
  line was read. None tells the assistant to do, say, offer, lead with,
  share, present, decline or ask. Sentences such as "It is not a source of
  stock picks" and "for the sky at a moment there is `get_sky`" state a
  fact or a neighbouring tool. A wider word search (should, must, always,
  please) finds nothing in those lines.
- **Against the live definitions.** Every stated input, range and default
  was found in the live description or schema: the 92-day and 366-day
  windows, the seven-day and 30-day defaults, 1800 to 2199, 1901 to 2100,
  solar return years 1801 to 2199, the six calendar languages, the ten
  occasions, the 15,000-people place list.
- **Against job 3's calls.** The cited call numbers match
  `tools/cases.json`: 14, 19, 26, 38, 43 to 48, 50 to 62, 65 to 68, 78. The
  eight tools named for the under-13 refusal are the eight of calls 50 to
  57. Two limits were tried live today and hold: a bare year 2020 to
  `get_chinese_zodiac` is answered, and `get_upcoming_events` gives
  14:31:41 UTC for Neptune.
- **Not stated because not yet true.** The draft withholds "no love reading
  under 18" for `get_horoscope`, which is right: job 3's calls 40 and 41
  show the live server still returns one.
- **Published definitions.** `git diff origin/main...HEAD` touches only
  this folder. `src/ai-tools/` is unchanged.

## L4 in detail

| Claim the page must not make | In the draft? |
| --- | --- |
| The hosted API or the site "uses DE440" | No. Part 1 names Astronomy Engine 2.1.19 as the only source in use and says the DE440 path "does not answer on this site or in the connector at present". The live capabilities answer and the open draft 943 support that. The engine guide's present-tense sentence is flagged. |
| "Passes all 240 position vectors" | No. Candidate A gives 48 within and 192 outside, as `conformance/RESULTS.md:37-38`; the 240 row is under "Swiss Ephemeris 2.10.03". |
| Horizons as a reference for a future clock time | No. Part 1 and candidate F both carry the manual's sentence about the constant value. |
| The 30″ bound applied to the true node | No. Candidate C gives 32.64″ on its own and says B does not cover it. |
| A stale Swiss or Moon/ΔT sentence left unflagged | Lines 25, 27 to 29, 30 and 32 are flagged. |
| Accuracy figures treated as approved | No. The section is a placeholder; A to F are held. |
| rc.3 tests presented as rc.2 measurements | Part 2 says which build each figure is from. In Part 1 the local-time sentences are also supported by the live page (lines 51 to 53) and the live capabilities answer, which are rc.2. See S6 for the keys. |

The figures in Part 2 were each found in their source: 2.083″ and 18.774″;
146,097 instants, 29.19″, 0.81″ of margin, 32.64″; 29.69″ and 30.32″;
91,201, 1.96 and 22.886 (Venus, 1878-03-03), 29.108 (Pluto, 2199-12-25);
2.46 h, 9.51 h, 1.77 h, 31.54 h; 36.23″, 56.65 s, 2.94″.

## L6

- `git diff origin/main...HEAD`: 29 files, all under this folder.
- Commit `87f97962`: author and committer Zodiacs Admin
  `<admin@zodiacs.org>`, no trailer.
- Pull request 982: open, draft, one commit.
- Site drafts 968, 970, 971, 972, 975, 979 and 980 and engine drafts 91 to
  94 are open drafts at the heads the earlier jobs recorded, each last
  updated before this job began (the latest at 17:29 UTC).
- The live server's tool definitions are unchanged (same digest).
  `/how-we-calculate/` was 404 in the builder's fetch.
- Not checkable here: that no email was sent. The mailbox was not opened.

## Requests this session sent

- `tools/list` to `https://zodiacs.org/mcp`, once.
- Two tool calls with no personal input: `get_upcoming_events` for 25 to
  28 January 2026 (Neptune, ingress), and `get_chinese_zodiac` with
  `year: 2020`.
- `gh` reads of pull requests and repository visibility.
- No request to any provider (NAIF, JPL, IERS, CDS, ESA, a journal), no
  Horizons query, no email, no form.

## For the builder's one pass

1. B1: correct the sentence in the IERS letter, the row in `SOURCES.md` and
   finding 5 in `README.md`.
2. S1 and S2: narrow the two NAIF sentences.
3. S3, S4 and S5: add the engine's Python notice, the second epoch value
   and the missing review items to the brief (and S3 to the IERS letter's
   open points).
4. S6: fix the six citations.
5. S7 and S8: add line 49 (and line 31's claim) to Part 3, and split the
   unknown-birth-time sentence by surface.

What stays with Dias is unchanged from the builder's list.
