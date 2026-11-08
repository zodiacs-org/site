# Returns worked examples (P2.A.timing.returns)

The gate of P2.A.timing.returns asks for fixtures from cited worked examples
of solar and lunar returns. [PREREGISTRATION.md](PREREGISTRATION.md) fixed,
before any search, how they are found, read, given a tolerance and scored.
This folder holds the search, the frozen holdout and the first run.

**Outcome: pass.** 11 of the 13 scored fixtures agree with the vendored engine
1.1.0-rc.2 (Node 22.22.2): 6 of 8 solar, from 4 authors and 4 works, and 5 of 5
lunar. The pass rule asks for at least 5 agreeing solar fixtures, at least 1
agreeing lunar fixture, at least 2 authors and 2 works among the agreeing solar
ones, and at least two thirds of all scored fixtures (9 of 13). The unit is recorded
accepted, release deployed: production serves engine 1.1.0-rc.2, the candidate
the site vendors.

## The scored fixtures

`R` is the stated return instant in UT, read as the rules fix it. `E` is the
engine's instant and `D = E - R`, in seconds. `T` is the tolerance, computed
before the run from the source's printed properties (`tools/tolerance.mjs`).

| Fixture | Body | Native | Source | R | E | D (s) | T (s) | Agrees |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F2-02 | Moon | Loumel Skaife (the author) | Skaife, Astrology (the Astrological Lodge's quarterly), Vol. 16 No. 4 (1942-43), p. 115 | 1939-09-26T15:50:00Z | 1939-09-26T15:52:07.122Z | 127.122 | 1099.758 | yes |
| F2-03 | Moon | Loumel Skaife (the author) | the same, p. 116 | 1940-09-15T13:59:00Z | 1940-09-15T14:00:37.299Z | 97.299 | 1100.084 | yes |
| F2-21 | Sun | Franklin Delano Roosevelt | Alfa Lindanger, American Astrology, Vol. 15 No. 7 (September 1947), p. 65 | 1933-01-31T10:48:00Z | 1933-01-31T10:47:40.622Z | -19.378 | 183.253 | yes |
| F2-22 | Sun | Giuseppe Zangara | the same | 1932-09-06T20:33:00Z | 1932-09-06T20:40:38.141Z | 458.141 | 179.722 | no |
| F2-23 | Sun | Anton Cermak | the same | 1932-05-09T21:06:00Z | 1932-05-09T21:19:31.059Z | 811.059 | 179.946 | no |
| F3-02 | Sun | King George V | M. Vijaya-Raghavulu, Text-Book on Directional Calculations (Madras, 1933), p. 106 | 1909-06-03T16:47:49Z | 1909-06-03T16:48:41.390Z | 52.390 | 129.695 | yes |
| F3-03 | Sun | King George V | the same, p. 107 | 1910-06-03T22:33:18Z | 1910-06-03T22:33:28.671Z | 10.671 | 131.062 | yes |
| F3-04 | Moon | King George V | the same, p. 112 | 1893-06-21T04:49:58Z | 1893-06-21T04:49:21.249Z | -36.751 | 779.973 | yes |
| F3-05 | Moon | King George V | the same, p. 113 | 1910-04-21T19:49:52Z | 1910-04-21T19:50:13.705Z | 21.705 | 773.165 | yes |
| F3-06 | Moon | King George V | the same, p. 113 | 1910-10-02T16:30:44Z | 1910-10-02T16:30:53.725Z | 9.725 | 773.782 | yes |
| F3-13 | Sun | King Edward VII | Alfred J. Pearce, The Text-Book of Astrology, 2nd ed. (1911), p. 220 | 1909-11-09T22:42:00Z | 1909-11-09T22:43:28.933Z | 88.933 | 378.152 | yes |
| F3-14 | Sun | King Edward VII | the same, p. 221 | 1905-11-09T23:20:12Z | 1905-11-09T23:21:06.872Z | 54.872 | 347.281 | yes |
| F3-18 | Sun | Bh. Satyanarayana Rao (the author) | Satyanarayana Rao, A Text Book of Scientific Astrology (1936), p. 283 | 1934-04-01T20:05:00Z | 1934-04-01T20:06:34.109Z | 94.109 | 196.288 | yes |

Every fixture is whole-chain: the source states the birth, and the engine
derives the natal longitude itself (`solarReturn(birth, R)`,
`lunarReturn(birth, R minus 3 days)`). Each term of every `T` is in
[holdout.json](holdout.json) and [results.json](results.json).

A note written after the run, which changes nothing in the verdict: the two
disagreements, F2-22 and F2-23, come from the one passage of the series that
prints no working, and its figures give the Sun to the whole degree. Under the
preregistration's tolerance a radical counts only when a working or a statement
shows the author used it (D3), so these fixtures carry no allowance for it. The
series' printed workings round the natal Sun to the arc-minute, which can move
a return by up to 756 s, and round the noon positions and the motion before the
proportion. No ephemeris is used to excuse either disagreement.

## How the holdout was made

- **Preregistration first.** PREREGISTRATION.md (46a4005d), then
  `ineligible.json` and `search-plan.json` (ad05a5c9), pushed at 00:12:48 ICT on
  8 November 2026, before the search started.
- **The search.** Five searchers, one per family (almanacs; English-language
  periodicals; English-language books; other languages; lunar returns and
  returns after 1960), read 380 sources ([search-log.json](search-log.json),
  whose 483 entries also list their catalogue searches) and recorded 135
  records: 124 candidates, 11 of them found by two searchers. The scored counts
  met the minimums, so no second pass ran.
- **Two blind readings (S3) and the authors' arithmetic (S8).** Ten second
  readers read 83 candidates again from the scans, given only the citation, the
  scan address and the leaves; the other 41, excluded on facts no reading of
  the page changes, were read once (D17). Every field the second readers
  recorded agreed with the first reading. Where the author printed the working,
  they redid the author's own arithmetic; two candidates failed it (F2-12,
  F3-17). 30 candidates have a computed T; the others are excluded on a rule
  that needs none, or on a reading that leaves T unbounded.
- **Exclusions.** 111 candidates are excluded, each with its rule and reason:
  58 by the cap (T over 600 s solar, 900 s lunar step, 1,500 s lunar
  whole-chain, mostly births printed to the hour or radicals used to the
  arc-minute), 31 by W6 (D11, below), 6 by W5, 6 by W7, 5 by W2, 2 by W1,
  2 by S8 and 1 by H3. H1 to H3 decide which candidates are eligible before H4
  and H5 apply, so H3's exclusion of F3-07 leaves Vijaya-Raghavulu's book
  exactly five scored fixtures.
- **An independent review before the freeze.** It recomputed every reading
  and T, and found three blockers, all fixed before the freeze: a clause of D3
  that went beyond the tolerance's text, birth data in the search log, and D11
  recorded as a reading instead of a departure.
- **The freeze.** The frozen holdout (f7e5ed14, holdout.json SHA-256
  `2595133ee86374a9b7a74ac48454c11eed84a565cb1c424b308408aa32970143`, recorded
  in results.json) was pushed at 14:12:28 ICT on 8 November 2026, after the
  privacy search (G1) and the full pre-push list (G2). The first run followed at
  14:12:39 ICT, on 09550244: the freeze with main merged in for the day's
  edition, which changed no engine or package file.
- **The re-read.** Two fresh readers read every scored fixture again from
  04:00 to 04:25 ICT on 8 November: after the first freeze commit (425bee77,
  never pushed), before the final freeze and before the run, so they could see
  no D, T or verdict. Every field agreed: [corrections.json](corrections.json)
  holds no correction. The 13 scored fixtures' fields are the same in every
  version of the freeze.

## Decisions and departures

The search needed readings of the rules where their text did not settle a
case. Each was made before the freeze and before any engine or ephemeris
computed a return for any candidate. They are D1 to D18 in holdout.json.

Three are **departures** from the preregistration's text, disclosed here.
The first two are in holdout.json; the third concerns the re-read, after the
freeze:

- **D11 (W6, S6).** An individual's upload of a work still in copyright to
  archive.org's community collections is not counted as a public scan. This
  excluded 31 records, every post-1960 source the F5 brief named. Their
  readings, natives, authors and titles are withheld (see the privacy search
  below). At least two book records and up to five records of one serial
  looked eligible on their first readings; these are modern computed returns,
  which would more likely agree with the engine than not.
- **D17 (S3).** Candidates excluded on facts no reading of the page changes
  (births before 1800, post-1900 births of unnamed natives, community uploads)
  were read once, not twice: 41 of the 124.
- **The re-read's timing.** The preregistration has every scored fixture read
  again after the run. It was read again before the run, which is stricter on
  blindness and changed nothing.

None was adopted after a result was seen. The owner ratified all three on 8 November 2026, so the unit is recorded accepted rather than validated.

## The privacy search (G1)

The first freeze commit (425bee77, never pushed) added 3 lines matching the
owner's birth-data patterns and 63 matching the name patterns. The work
stopped, and the owner was given the counts only. With the owner's yes, the
community-upload records' readings, natives, authors and titles were withheld
(two rebuilds). That left 0 data lines and 1 name line, which the owner checked
and allowed. On the pushed freeze the tree's count equals main's.

## The development fixtures

The nine fixtures of the 1 November development search are re-run for
regression only. Their differences were seen before this preregistration, so
they are never scored. The original file's SHA-256 is
`bc9bfe582470859e98802595f9bf704052a9079b6f650313b8794b292cd2fe1d`;
[dev-search.json](dev-search.json), the same file with local paths and dashes
replaced, has SHA-256
`f65d0b40595e98890f5e7eb3071e95a38bf7b59fecee17585f7a5558ee9bb46f`.

| Fixture | E | D (s) | 1 November tolerance (s) |
| --- | --- | --- | --- |
| sr-leo-1936-queen-mary-1910 | 1910-05-27T09:39:02.971Z | -1.029 | 30 |
| sr-leo-1936-besant-1907 | 1907-10-02T06:20:15.044Z | 3.044 | 40 |
| sr-green-1905-george-v-1893 | 1893-06-02T19:54:12.901Z | 12.901 | 64 |
| sr-green-1903-edward-vii-1900-step | 1900-11-09T18:10:47.950Z | 20.950 | 60 |
| sr-raphael-1905-edward-vii-1906 | 1906-11-10T05:17:59.682Z | 59.682 | 100 |
| sr-astrolabus-1908-ah-1908 | 1908-05-30T16:44:03.338Z | 3.338 | 60 |
| lr-green-1904-victoria-1901-step | 1901-01-02T01:59:21.894Z | 21.894 | 130 |
| sr-lilly-1647-merchant-1646 | 1646-09-29T20:57:15.393Z | -752.463 | 2217 |
| sr-gadbury-1662-villiers-1648 | 1648-04-11T17:23:18.582Z | -108.151 | 800 |

## Notes

- F3-13 and F3-14 use Buckingham Palace's longitude as printed, 0° 36' W.
  Both readers read that print. It is near 0° 08' W in fact, so the local mean
  time reading moves R by 144 s where the true longitude would give about 34 s,
  and only widens b.
- The George V and Edward VII birth latitudes are the printed geocentric
  values. The engine's return instants come from apparent geocentric
  longitudes, so only the return chart's houses would change.
- F2-02 and F2-03 fall on dates when British Summer Time was the civil time.
  The source states G.M.T. for both instants, which closes the reading.
- Lindanger's Part II (January 1947) works an unnamed "Example 1" with the same
  birth data as F2-21. D3 reads a printed working per passage, and Part II's
  passage does not name the native, so nothing carries to F2-21 from it.
- The full pre-push list passed on every pushed commit except
  `developer-first-use-drive`, whose Firefox half failed the same way on
  ad05a5c9, before the search.

## Files

- [PREREGISTRATION.md](PREREGISTRATION.md), [ineligible.json](ineligible.json),
  [search-plan.json](search-plan.json): the rules, committed before the search.
- [holdout.json](holdout.json): every candidate, with both readings, the
  readings of each instant used and left open, T with its terms, and every
  exclusion; [holdout-planetary.json](holdout-planetary.json): none qualified.
- [search-log.json](search-log.json): the searchers' and readers' briefs and
  logs.
- [results.json](results.json), [corrections.json](corrections.json): the first
  run and the re-read.
- `tools/readings.mjs`, `tools/tolerance.mjs`, `tools/run.mjs`: frozen with the
  holdout.

To repeat the run from the site's root, on Node 22:
`node docs/platform/evidence/returns-worked-examples-20261107/tools/run.mjs`.
`tests/returns-worked-examples.test.ts`, which `npm test` runs, makes the
preregistration's checks C1 to C7, each with its control.
