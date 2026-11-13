# DRAFT brief for counsel: open licence questions. Not sent.

**Status: draft for review (ZOD-108). It has not been sent to any lawyer or
anyone else.**

**What this is.** A statement of facts and of the questions they leave open,
for a lawyer to answer. It contains **no legal conclusion**. Where a
provider's own words are quoted, they are quoted as facts about what the
provider wrote, not as a reading of what they permit. Where this brief says
something "is not settled", it means the texts that were read do not say,
not that either answer is likely.

**Who is asking.** Zodiacs.org is the website of Zodiacs LLC, a New Mexico
limited liability company formed on 11 August 2026. `[J3-ABOUT]`

**What is at issue.** An open-source astronomy package, `@zodiacs/engine`,
with the licence expression `MIT AND CC-BY-4.0`. `[E-LIC-SPDX]` Its own
licence record gives its status as "GO ... subject to the repository
operator having authority to publish the Zodiacs.org-authored TypeScript
under the MIT license, and with three questions left open for the owner".
`[E-LIC-STATUS]` Reviews on 11 November 2026 added more. `[J2-LIC]`
`[J2-BREAKER]` All of them are below.

Bracketed keys point to `SOURCES.md`, which gives each address, file and
line, the date read and the words relied on.

---

## The questions, in the order we would like them answered

### 1. Authority to publish the code under the MIT licence

Facts:

- The package was adapted from modules of the Zodiacs.org site.
  `[E-LIC-PROV]`
- The site repository's licence file begins "Copyright (c) Zodiacs.org. All
  rights reserved." and grants no licence "except where a file or directory
  states other terms". `[S-LICENSE]` The same file names the engine as one
  such part: "The chart engine, @zodiacs/engine, is MIT AND CC-BY-4.0".
  `[S-LICENSE]`
- The engine's record makes its status conditional on "the repository
  operator having authority to publish the Zodiacs.org-authored TypeScript
  under the MIT license". `[E-LIC-STATUS]` `[E-LIC-SITE]`
- Zodiacs LLC was formed on 11 August 2026. `[J3-ABOUT]`
- Job 2's review quotes the engine master plan as naming a further risk:
  "the MIT grant weak because many commits are AI-written with no contributor
  agreement". `[J2-LIC]` (second pass; the plan is the document artifact
  `814TqL6h6Nu3bjrD3FJBRy`, which this job did not open.)

Questions:

- Who holds the rights in the code, and is the MIT grant validly made in
  that holder's name?
- Does anything need to be signed or recorded (an assignment to the LLC, a
  contributor statement) for work done before the LLC existed, or for code
  written with AI tools?

### 2. IERS EOP 20 C04: no statement of terms was found

Facts:

- The public repository carries the series file's six header lines and 367
  unchanged rows (1972-01-01 to 1973-01-01). `[E-LIC-UT1]` The published
  package carries only values derived from them (UT1 − TAI every third day
  of 1972, in whole milliseconds). `[E-LIC-UT1]` The package's ΔT table holds
  91 values from 1941 on that were derived in part from this series and from
  Bulletin A. `[E-LIC-DT]` `[E-NOTICE-DT]`
- No statement of terms, licence or copyright was found for the series: not
  in the file's header, its readme, the Centre's page, the IERS Data Centre's
  record, or the IERS site's legal page. Read on 2026-09-29 by the engine's
  record `[E-LIC-IERS]` and again on 2026-11-11 in this job. `[T-C04-HEADER]`
  `[T-C04-README]` `[T-C04-PAGE]` `[T-IERS-DC-META]` `[T-IERS-IMPRINT]`
- An earlier version of the engine's record said that IERS distributes these
  data free of charge and asks users to cite them. It was withdrawn because
  no IERS page was found that says so. `[E-LIC-IERS]`
- The site repository still has that sentence in one dated evidence file:
  "IERS product, free to use with citation of the IERS". `[S-DELTAT]`
- The engine repository still has it in the notice file of its Python
  package: the IERS "asks that its products be cited". `[E-PY-NOTICE]`
- For the related product, Bulletin A (`finals2000A.all`), the US Naval
  Observatory's page ends "Distribution Statement A. Approved for public
  release: distribution unlimited." `[T-USNO-BULA]` The repository carries
  four columns of 19,997 of its rows; the package carries derived values.
  `[E-LIC-UT1]`
- The leap-second list says of itself "This file is in the public domain."
  `[T-LEAP]`

Questions:

- With no terms stated, may the 367 rows stay in a public repository, and
  may values derived from the series ship in a package under the MIT
  licence?
- Does it matter that the provider is a French public observatory acting
  for an international service?
- Is "Distribution Statement A" enough for the use made of Bulletin A?
- Should the stale sentence in the site's evidence file and in the engine's
  Python notice file be corrected, or, for the dated record, left with a
  note?

A draft letter to the Earth Orientation Centre is in `02-letter-iers.md`.
It has not been sent.

### 3. The CDS: 20 single values obtained through VizieR and SIMBAD

Facts:

- Two entries of the package carry 22 single published values for four
  objects (three stars and Sgr A*). `[E-LIC-STARS]` Twenty came through
  VizieR and SIMBAD, from the Hipparcos new reduction (VizieR I/311),
  Gontcharov 2006 (III/252), Famaey et al. 2005 (J/A+A/430/165) and SIMBAD.
  `[E-NOTICE-STARS]` No catalogue file or table is redistributed.
  `[E-LIC-STARS]` The notice file cites each source. `[E-NOTICE-STARS]`
- The CDS's two legal pages return 404 today and its site reports a
  security incident. `[T-CDS-404]` `[T-CDS-HOME]` Their text is taken from
  Internet Archive copies of 9 September and 25 October 2026. `[T-WB-LEGALS]`
  `[T-WB-VIZIER]`
- The General Terms say "The Data Sets must be cited in any work or product
  that uses them", and that datasets containing only public information "are
  distributed under an Open Licence or ODbL ... or CC-BY", while a dataset
  under a contributor's own licence shows it on the dataset's page.
  `[T-WB-LEGALS]`
- The VizieR rules say the data "are free of usage in a scientific context"
  and "The commercial usage of the data is subject to rules depending of the
  origin". `[T-WB-VIZIER]`
- **The A&A "scientific usage" sentence.** The archived VizieR page's source
  contains: "Tabular data, spectra or images coming from A&A (J/A+A) are free
  for a scientific usage." `[T-WB-VIZIER]` That sentence is inside an HTML
  comment, so the page does not display it; it was already commented out in
  the archive's copy of 4 September 2021. `[T-WB-VIZIER-2021]` What the page
  displays for A&A catalogues is links to A&A's open-access policy and
  copyright pages. `[T-WB-VIZIER]` Those two pages refused automated reading
  in this job and were not read. `[T-AANDA]` One of the three catalogues,
  Famaey et al. 2005, is `J/A+A/430/165`; one value (the radial velocity of
  delta Cnc) comes from it. `[E-NOTICE-STARS]` The engine's record does not
  mention the sentence. `[E-LIC-CDS]` Job 2's second session reported it as a
  displayed rule `[J2-BREAKER]` (S3); the page source read here shows it is
  not displayed.
- The engine's record says none of the three catalogues' ReadMe files states
  a licence (read 2026-09-29). `[E-LIC-CDS]` They were not read again in this
  job.
- The engine's own conclusion is: "The attribution in `NOTICE` meets the CDS
  citation terms; whether a commercial use needs more than attribution is
  not settled by these sources." `[E-LIC-CDS]`

Questions:

- Is the use of 20 single values as constants in MIT-licensed software a
  use "in a scientific context" in the CDS's sense, given that the licence
  lets anyone reuse the software commercially?
- Do single measured values (a position, a proper motion, a radial velocity)
  attract any right that needs a licence at all, in France, the EU or the
  US, as opposed to a catalogue or table?
- What weight, if any, does a sentence carry that is present in a page's
  source but commented out and not shown?
- For the one value from an A&A catalogue, what do A&A's own policy pages
  require? (They need to be read by a person; see `[T-AANDA]`.)

A draft letter to the CDS is in `03-letter-cds.md`. It has not been sent.

### 4. Hipparcos and ESA (an open question, not a finding)

Facts:

- The positions, proper motions and parallaxes of the three stars are from
  F. van Leeuwen's 2007 new reduction of the Hipparcos data, taken from
  VizieR catalogue I/311. `[E-NOTICE-STARS]` `[E-LIC-STARS]`
- ESA's page for the original catalogues says they "were released in June
  1997" and: "The Hipparcos and Tycho Catalogues are distributed under the CC
  BY-NC 3.0 IGO licence and the Terms and Conditions for the use of these
  data require users to acknowledge ESA using "Credit: ESA"." `[T-ESA-HIP]`
- ESA's terms for its Space Science Archives apply "If you access, download,
  or use data from the ESA Space Science Archives". They say data hosted
  there "are distributed under the CC BY-NC 3.0 IGO licence", and: "Prior to
  any commercial use by the User of any Data or Data Product, including any
  use or application that directly or indirectly generates a financial gain,
  a detailed request for authorisation/licence shall be made by the User by
  sending email to data.licences@esa.int." `[T-ESA-TERMS]`
- ESA's page for the new reduction states no licence. It says the data is
  available in ESA's legacy archive and "is also available from CDS in
  VizieR". `[T-ESA-HIP2]`
- The engine's values were taken from VizieR, not from ESA's archive.
  `[E-NOTICE-STARS]`
- The engine's licence record does not mention ESA. `[E-LIC-CDS]`
- Job 2's review first headed this "ESA's terms for Hipparcos are
  non-commercial"; its second session corrected that: what the texts support
  is a question that is not in the record, "not a finding that the terms are
  non-commercial" for these values. `[J2-LIC]` (C9) `[J2-BREAKER]` (S4)

Questions:

- Do ESA's terms, or the CC BY-NC 3.0 IGO licence of the 1997 catalogues,
  reach values that come from the 2007 reduction and were obtained through
  VizieR?
- If they do, is the use described in question 5 below a "commercial use"
  that needs ESA's authorisation?
- Does the answer differ for a handful of single values and for a
  catalogue of about 411 stars? An unmerged draft branch would add one, and describes
  these sources as "each free to use with acknowledgement".
  `[E-STARS-BRANCH]`

No letter to ESA has been drafted.

### 5. Is the use "commercial"?

This runs through questions 3, 4 and 6. Facts counsel will need:

- The package's code is under the MIT licence. `[E-LIC-SPDX]`
- The site says its calculators are free. `[J3-ABOUT]` (line 37)
- The site's footer says: "Zodiacs.org also operates Astrofolio, the Zodiac
  token collection." `[L-METH]` (line 89)
- The site is owned and operated by a limited liability company.
  `[J3-ABOUT]`

Question: for the purposes of the CDS's, ESA's and NAIF's texts, is the
engine's use of this data, or the site's, a commercial use? We ask this
without a view of our own.

### 6. NAIF: a pack refitted from `de440.bsp`, and values computed from it

Facts:

- The package has an optional entry that reads a "pack" the caller supplies.
  A pack is a refit of NAIF's `de440.bsp` as quantised Chebyshev series in
  the project's own format; it "is not DE440's own series". `[E-DE440-PACK]`
- No pack is distributed and none is committed: "Whether a pack derived from
  DE440 may be redistributed is a question put to NAIF; until it is answered,
  no pack is distributed". `[E-DE440-PACK]` `[S-NAIF-HELD]` The published
  package holds no JPL ephemeris value. `[E-LIC-JPL]` `[E-NOTICE-DE440]`
- A question was sent to NAIF on 2026-09-30 and has not been answered.
  `[S-NAIF-SENT]`
- NAIF's rules say: "Redistribution of SPICE kernels distributed by NAIF is
  permitted as long as they have not been modified", set conditions for a
  modified kernel (the last modifier's name; a changed file name), and say
  "Use of SPICE components in commercial products is allowed ... No fees or
  licensing are required." `[T-NAIF-RULES]` The page has no sentence about
  data derived from a kernel. `[T-NAIF-RULES]` It calls its rules a "SPICE
  Software License" and does not use the words "public domain".
  `[T-NAIF-RULES]` The site's own record makes the same point.
  `[S-PA-NOTICE]`
- The public repository holds, as test evidence, places and lunar nodes
  computed from `de440.bsp` at 200 instants. `[E-DE440-200]` `[E-HZ-FILES]`
  They are not in the published package. `[E-DE440-ORACLES]`
- JPL's Solar System Dynamics site, at a different address from NAIF's,
  says of its own site: "No permissions are needed. The data provided on this site are
  considered public domain." `[T-SSD-FAQ]`

Questions:

- Is a refit a "modified kernel" under NAIF's rules, something else the
  rules do not cover, or free of them?
- May the 200 instants of derived values stay in a public repository while
  NAIF has not answered?
- Does the Solar System Dynamics sentence bear on a kernel served by NAIF?

A draft follow-up letter to NAIF is in `01-letter-naif.md`. It has not been
sent, and the site's record says of the first message "Do not resend it".
`[S-NAIF-SENT]`

### 7. JPL Horizons responses kept as evidence, and how they were requested

Facts:

- The engine repository keeps verbatim Horizons responses as evidence (167
  files in one folder and 18 in another). `[E-HZ-FILES]` They are not in the
  published package. `[E-LIC-JPL]` The engine's record calls them "public"
  and cites no page. `[E-HZ-FILES]`
- JPL's FAQ says "No permissions are needed. The data provided on this site
  are considered public domain", recommends a source citation with the
  retrieval date, and says "If the data obtained is subsequently modified,
  that modification should be made clear." `[T-SSD-FAQ]`
- JPL's API fair-use policy says: "Applications making automated connections
  must provide a valid, application-specific User-Agent request header that
  includes correct product name, version, and contact information."
  `[T-SSD-API]`
- On 11 November 2026 two review sessions sent Horizons requests that did
  not meet that policy: 176 with a default header, and 12 that named an
  application and gave no contact. `[J2-BREAKER]` (S8, resting on
  `[T-SSD-API]`) Whether to rerun them under the project's name and contact
  is an owner decision that has not been taken. `[J2-BREAKER]` (S8)

Questions:

- Is the FAQ's sentence a sufficient basis for keeping verbatim responses in
  a public repository, with the citation JPL recommends?
- Does anything follow from requests made outside the fair-use policy,
  beyond rerunning them properly?

### 8. Reid and Brunthaler's two values

Facts:

- The proper motion of Sgr A* (two values) is from M. J. Reid and
  A. Brunthaler 2004, ApJ 616, 872, table 2, not from the CDS.
  `[E-NOTICE-STARS]` The engine's record says "no terms for them were read".
  `[E-LIC-CDS]`
- The journal's page for the article reads "© 2004. The American Astronomical
  Society. All rights reserved." `[T-IOP]`

Question: do two measured values, cited to their paper, need permission
from the publisher or the authors?

### 9. The ΔT values (the CC BY 4.0 part of the licence expression)

Facts:

- The package carries 32 values of Table S15 of Stephenson, Morrison and
  Hohenkerk 2016, rounded to 0.01 s. `[E-LIC-DT]`
- Job 2 read the article's full text at Europe PMC (PMC5247521): "Published
  by the Royal Society under the terms of the Creative Commons Attribution
  License http://creativecommons.org/licenses/by/4.0/". `[J2-LIC]` (second
  pass table; confirmed by `[J2-BREAKER]`, N1) Table S15 is in the electronic
  supplement, for which job 2 found no separate licence statement: the
  licence holds for the supplement "by inclusion only". `[J2-LIC]` The
  publisher's own page refused automated reading. `[J2-LIC]` This job did not
  fetch these pages again.

Question: does the article's CC BY 4.0 licence cover a table published only
in its electronic supplement?

### 10. Swiss Ephemeris: values that reached the repositories

Facts:

- The engine's rule is "No Swiss Ephemeris code, binaries, ephemeris files,
  tables, fixtures or per-case output in the repository". `[E-SWISS-RULE]`
  Its licence record says "no Swiss Ephemeris code, data file or output is
  committed". `[E-LIC-SWISS]`
- One committed file says of its 24 instants: "TT was taken as UT + Swiss's
  deltaT, recorded here as a clock value". `[E-SWISS-TT]`
- The package ships two ayanamsa epoch values whose trail, in the engine's
  guide, runs through Swiss Ephemeris's documentation. For Krishnamurti, the
  guide gives "The value 22.363889° at 1900: Swiss Ephemeris documentation
  §2.8.6", beside a second source (the Solar Fire user guide); the `source`
  string in the code itself names KP Reader 1's table. For Lahiri, the guide
  cites the Indian Astronomical Ephemeris for 1989 "as quoted in the Swiss
  Ephemeris documentation, §2.8.5". `[E-VEDIC-SWISS]` These are published
  constants read from documentation, not program output. `[J2-LIC]` (C2)
- Job 2 also lists one evidence file that says its values before 2021 "are
  quoted from the Swiss Ephemeris documentation, appendix E". `[J2-LIC]` (C2;
  underlying file `docs/evidence/vedic-2026-09-28/results/primary-tables.json:65`,
  not re-read here.)
- In the site repository, 44,071 values generated with Swiss Ephemeris left
  their files on 2026-09-29. Of those 44,071, 40,597 are gone from the
  working tree and 3,474 still appear there "as inputs, statistics or
  reference values". "Git history was not rewritten". `[S-SWISS-REMOVAL]`
- Swiss Ephemeris's licence terms were not opened in this job.

Questions:

- Do 24 ΔT values returned by Swiss Ephemeris, two constants read from its
  documentation, or values that remain in a public repository's history,
  create any obligation under Swiss Ephemeris's licence?
- If so, what is the least that puts it right?

### 11. Smaller points in the record

Each is a fact from job 2's review and a plain question: does it matter,
and what should be corrected? Where a key other than `[J2-LIC]` follows,
the file was opened in this job; otherwise the line says it was not.

- `.zenodo.json` gives the licence as `"mit"` alone, where the package is
  `MIT AND CC-BY-4.0`. `[E-ZENODO]` `[E-LIC-SPDX]`
- Job 2 lists parts of the repository with no licence statement of their own
  (`skills/`, `bots/`, `api/`) and differences between `NOTICE` and
  `LICENSING.md`. `[J2-LIC]` (C4, C5; underlying files in the engine
  repository, not re-read here.)
- A second unmerged branch would take star data from a database under
  CC BY-SA 4.0. `[J2-LIC]` (C7; underlying file
  `infra/fixedstars:fixedstars/package.json`, not re-read here.)
- `CITATION.cff` lists the two licences and says in a comment that its
  format "reads a list of licences as a choice between them (OR); that is
  not meant here". `[E-CITATION]` `[J2-LIC]` (C3)
- The Python package's notice file says the geo entry "does not
  redistribute the IANA Time Zone Database". `[E-PY-NOTICE]` The engine's
  `main` does ship zone histories compiled from it. `[E-NOTICE-TIME]`
  `[J2-LIC]` (C3)
- The Python package's build includes bundled archives
  (`_vendor/*.tgz`). `[E-PYPROJECT]` Job 2 names them as an Astronomy Engine
  archive and an older engine archive. `[J2-LIC]` (C4; the archives were not
  opened here.)
- `LICENSING.md` states several third parties' terms with no address, file
  or quotation from the party: among them that Horizons responses are
  "public", that ERFA is BSD 3-Clause, that GeoNames files are CC BY 4.0,
  that tzdata is in the public domain, and that the classical authors are in
  the public domain with no jurisdiction or edition named. `[J2-LIC]` (C6;
  job 2's second pass then found the provider's own text for most of them.)
- Parts of the engine's provenance are recorded only in the site
  repository, whose licence file reserves all rights: the ΔT derivation, the
  research runtime's MIT declaration, the generator of the DE440 oracles and
  the pack's digests. `[J2-LIC]` (C8) `[E-LIC-DT]` `[E-LIC-DE440]`
  `[S-LICENSE]` This bears on question 1.
- **Two readings of JPL's terms are in the engine repository.** For question
  7: `main` calls Horizons responses "public". `[E-HZ-FILES]` Another branch
  says JPL's pages "do not supply a blanket licence for numerical API
  output" and assigns no licence to the responses it keeps.
  `[E-MINORBODIES]` Job 2 treats that reading as superseded, for Solar
  System Dynamics data, by the FAQ sentence quoted in question 7; counsel
  should see both. `[J2-LIC]` (C1)
- The US Naval Observatory's NOVAS page says "If you use NOVAS, please send
  us an email that outlines your application", and the repository does not
  record one. `[J2-LIC]` (second pass table; underlying page
  `https://aa.usno.navy.mil/software/novas_faq`, not re-read here.)

---

## What has been confirmed and is not being asked

These were read on the provider's own page by job 2 on 2026-11-11 and are
listed so counsel can see the whole picture; this job re-read the first
only. `[J2-LIC]` (second pass table)

- The leap-second list: "This file is in the public domain." `[T-LEAP]`
- GeoNames: CC BY 4.0 (`https://download.geonames.org/export/dump/readme.txt`).
- The IANA time zone database: public domain
  (`https://data.iana.org/time-zones/tzdb/LICENSE`).
- astronomy-engine: MIT (its `LICENSE`).
- ERFA: BSD 3-Clause (its `LICENSE`).

## What this brief does not do

- It reaches no conclusion on any question above.
- It does not say that ESA's, the CDS's or NAIF's terms "are
  non-commercial", "allow" or "forbid" the engine's use.
- It proposes no change to any licence file. Changes wait for counsel's
  answers and the owner's decision.

## Not read in this job (so counsel is not misled about coverage)

The CDS pages at their own address; A&A's policy pages; the three
catalogues' ReadMe files; the Royal Society's and Europe PMC's pages; Swiss
Ephemeris's licence; the message sent to NAIF on 2026-09-30; the engine
master plan. See `SOURCES.md`, "What was not opened".
