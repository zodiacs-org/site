# DRAFT letter to the IERS Earth Orientation Centre. Not sent. Do not send without the owner's yes.

**Status: draft for review (ZOD-108). Nothing has been sent to the IERS, to
Paris Observatory or to the US Naval Observatory by this job.**

The bracketed keys are citations for the reviewing session. They point to
`SOURCES.md` and come out before anything is sent.

---

**To:** IERS Earth Orientation Centre, Paris Observatory. The series' own
file gives a contact address in its third header line `[T-C04-HEADER]`, and
the IERS Data Centre's record of the series gives services.iers@obspm.fr as
its contact. `[T-IERS-DC-META]`

**From:** Zodiacs.org (Zodiacs LLC), admin@zodiacs.org `[J3-ABOUT]`

**Subject:** Terms of use and preferred citation for the EOP 20 C04 series

Dear colleagues at the Earth Orientation Centre,

**What we are asking**

Under what terms the EOP 20 C04 series may be redistributed, in part and as
values derived from it, and how you would like it cited. We use a small part
of the series in open-source software `[E-LIC-UT1]` and could not find a
statement of terms for it. `[E-LIC-IERS]`

**Which series we mean**

The file `eopc04.1962-now` served at
`https://hpiers.obspm.fr/iers/eop/eopc04/`, whose header calls it "EOP (IERS)
20 C04 TIME SERIES consistent with ITRF 2020 - sampled at 0h UTC".
`[T-C04-HEADER]` The IERS Data Centre lists the same series as "EOP 20u24 C04
(IAU2000A, dX, dY) 0hUTC - one file (1962-now)" and names the IERS Earth
Orientation Centre as its creator and publisher. `[T-IERS-DC]`
`[T-IERS-DC-META]`

**What we have read**

On 11 November 2026 we read the file's header, its readme, your page for the
C04 series (which says "Page updated on 2026, February 21"), the Data
Centre's record of the series, and the IERS web site's legal page.
`[T-C04-HEADER]` `[T-C04-README]` `[T-C04-PAGE]` `[T-IERS-DC-META]`
`[T-IERS-IMPRINT]` We found no statement of terms, licence or copyright for
the series in any of them. `[T-C04-HEADER]` `[T-C04-README]` `[T-C04-PAGE]`
`[T-IERS-DC-META]` The legal page names the site's operator, the Federal
Agency for Cartography and Geodesy, and limits its liability; it gives no
terms for IERS data. `[T-IERS-IMPRINT]` Our own licence record reached the
same result on 29 September 2026: "No statement of terms or licence was
found for EOP 20 C04." `[E-LIC-IERS]`

**What we carry**

- Our package is `@zodiacs/engine`, open source, with the licence expression
  `MIT AND CC-BY-4.0`. `[E-LIC-SPDX]` The CC BY part covers 32 values from
  Stephenson, Morrison and Hohenkerk (2016), not IERS data. `[E-LIC-SPDX]`
- We retrieved `eopc04.1962-now` on 29 September 2026 (Last-Modified
  2026-09-28T13:21:06Z). `[E-LIC-UT1]`
- **In our public source repository:** the file's six header lines and its
  367 rows from 1972-01-01 to 1973-01-01, unchanged. `[E-LIC-UT1]`
- **In the published package:** only values derived from those rows, namely
  UT1 − TAI on 1972-01-01 and on every third day from 1972-01-02, in whole
  milliseconds, with the largest formal error of those days. `[E-LIC-UT1]`
- The package's ΔT table also holds, from 1941 on, 91 values in units of
  0.01 s that were derived from US Naval Observatory files and from IERS
  Earth-orientation data (EOP 20 C04 and Bulletin A). `[E-LIC-DT]`
  `[E-NOTICE-DT]`
- Our notice file names the Earth Orientation Centre at Paris Observatory as
  the source of the 1972 values and cites Bizouard, Lambert, Gattano, Becker
  and Richard, J. Geod. 93, 621-633 (2019). `[E-NOTICE-TIME]` Our record of
  29 September gives that paper as the technical note on your page for the
  series. `[E-LIC-IERS]` Your page today links the readme as its "Technical
  note" and, under it, that paper by title, "The IERS EOP 14C04 solution for
  Earth orientation parameters consistent with ITRF 2014" (doi
  10.1007/s00190-018-1186-3). `[T-C04-PAGE]` The readme itself names no
  paper. `[T-C04-README]` The paper describes the 14 C04 solution, and the
  series served today is 20 C04, which is why we ask below how you would
  like it cited. `[T-C04-PAGE]` `[T-C04-HEADER]`

For completeness, two other IERS products reach the package, and we are not
asking you about them:

- The leap-second list, `leap-seconds.list`, which we carry unchanged and
  whose header says "This file is in the public domain." `[T-LEAP]`
  `[E-LIC-LEAP]`
- UT1 − UTC from 1973-01-02, sampled from `finals2000A.all` (Bulletin A) of
  2026-09-24, a product of the IERS Rapid Service/Prediction Centre at the US
  Naval Observatory. `[E-LIC-UT1]` `[E-NOTICE-TIME]` That table holds
  predictions as well as observed values: it is observed through 2026-09-24
  and predicted to 2027-10-02. `[E-TIME]` The Observatory's page for Bulletin
  A ends "Distribution Statement A. Approved for public release: distribution
  unlimited." `[T-USNO-BULA]`

**Our questions**

1. May we keep the 367 unchanged rows of 1972, with the file's header lines,
   in a public source repository?
2. May values derived from the series (the sampled UT1 values of 1972, and
   ΔT values that used the series) be distributed inside an open-source
   package whose code is under the MIT licence, which lets anyone reuse it,
   commercially or not?
3. If either needs terms beyond citation, what are they, and is there a page
   we should point our users to?
4. How would you like EOP 20 C04 cited? The paper we cite now describes the
   14 C04 solution. `[E-NOTICE-TIME]`
5. Should we use the name "EOP 20 C04" or "EOP 20u24 C04" for what we
   retrieved in September 2026? `[T-C04-HEADER]` `[T-IERS-DC]`

Thank you for the series and for keeping it openly available.

Yours sincerely,

[name], for Zodiacs.org
admin@zodiacs.org

---

## What this draft deliberately does not say

- It does not say that the IERS "asks only for citation" or distributes its
  data "free of charge". The engine's licence record withdrew that sentence
  because no IERS page was found that says it. `[E-LIC-IERS]`
- It does not treat the three products as one. The open question is EOP 20
  C04 only. `[E-LIC-STATUS]` `[J2-LIC]` (letters section, item 2)
- It does not say the package redistributes the series. The package carries
  derived values; the repository carries 367 rows. `[E-LIC-UT1]`

## Open points for the owner

- Which address to write to. The file header's contact is a named person
  `[T-C04-HEADER]`; the Data Centre's record gives a service address
  `[T-IERS-DC-META]`. A copy to the IERS Central Bureau is an option; this
  job did not look up its address.
- One record in the **site** repository still carries the withdrawn
  sentence: three entries of
  `docs/platform/evidence/deltat-2026-09-25/sources.json` say "IERS product,
  free to use with citation of the IERS". `[S-DELTAT]` It is dated evidence
  and was not changed here; the lawyer brief lists it (question 2).
- The **engine** repository still carries it too, in a notice file of the
  project's Python package: "the International Earth Rotation and Reference
  Systems Service (IERS EOP 20 C04 and Bulletin A, finals2000A.all), which
  asks that its products be cited". `[E-PY-NOTICE]` So "the engine's licence
  record withdrew that sentence" is true of `LICENSING.md` and not yet of
  every file. Not changed here.
- Whether to send before or after the lawyer has seen the brief.
