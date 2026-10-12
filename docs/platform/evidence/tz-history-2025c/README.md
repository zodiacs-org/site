# Pinned zone history before 1970, 2026-09-23 (Phase 1 step 1.12)

> On 2026-10-12, #723 moved the site to `@zodiacs/engine/geo`, which ships the
> same release's history, and removed the files, generators and tests this
> record describes. Its commands run from a checkout before that change, such
> as `ec0451ff`.

Browsers resolve historical time zones from the default build of the IANA
time zone database, which merges places whose clocks have agreed since 1970
and so gives them another city's history before then. Node 22.22 (ICU 78.2,
tzdb 2025c), for example, reads a Stockholm birth at noon on 1 July 1947 on
Berlin's summer time (+2:00, 10:00 UTC), where Sweden kept +1:00. The
database keeps each merged zone's older records in its `backzone` file.

`scripts/build-tz-history.mjs` compiles the pinned release (2025c, the same
archive and SHA-256 as `scripts/build-tz-lmt.mjs`) with `backzone` using zic,
and writes each name's offsets before 1970 to `src/data/tz-history/2025c/`,
in 64 files of about a kilobyte gzipped, hashed by the lower-cased name (a
name is matched in any letter case, as Intl matches it). It leaves out 17
names (`excluded.json`): 16 whose pinned history differs from the default
build after 1970 too (the pre-2024 rule-based WET and EET, Harbin and
Chongqing at their own offsets until 1980, and others), so that the
hand-over to the browser at 1970 never jumps, and Asia/Hanoi, which the
default build lacks and browsers do not resolve at all. None of them is in
the city index. Where tzdb writes "-00", a place with no local time yet (the
Kerguelen Islands before 1950, Antarctic stations before they opened), the
offset is stored as null and the browser's applies.

The names resolve by backzone's own rule, "Links in this file point to zones
in this file, superseding links in the file 'backward'", as the Makefile's
`check_zishrink` overlay build applies it. Other builds resolve some names
otherwise: `make PACKRATDATA=backzone` gives twelve names their main-data
target (Arctic/Longyearbyen Berlin's history, for example), and Debian's
build with `PACKRATLIST=zone.tab` makes America/Coral_Harbour a link to
Atikokan.
`src/lib/time/localToUtc.ts` reads these files for a birthplace time before
1970, inside the birthplace clock of step 1.1, and the browser's data after.

## Measured

`index-divergence.json` (by `tools/index-divergence.mjs`) compares the pinned
history with Node's Intl for each of the 356 time zones in the city index,
over the legal time the site reads from it: from 1900, or from the end of
the zone's local mean time era if later, to 1970, leaving out "-00" spans.
It compares by interval, the host's changes bisected to the second, not by
sampling. 85 differ at some point, 55 of them by an hour or more. The
methodology page states those two figures, and
`scripts/claims-bindings.test.mjs` holds it to this file. An AI reviewer's
separate comparison against zic's default build, with glibc's zdump, found
the same 85 before the "-00" spans were left out.

The first version of this measure, sampled at noon each day from 1900 and
counting days inside local mean time eras, gave 89 and 58; the methodology
page stated those until the review.

Tested: the generator's output offline (`scripts/build-tz-history.test.mjs`:
the TZif reader on a synthetic file, "-00" stored as null, 64 buckets hashed
as the resolver hashes and without regard to case, well-formed offsets,
every era of `tz-lmt.json` matched, every city-index zone present, and, on a
host with tzdb 2025c, the same offset as the host at 1970 for every name);
ten divergent places at dated instants, a zone the host already has right,
the 1970 hand-over and 1 January 1970 itself, a name in another letter case,
a "-00" span, an excluded name, and the loading rules, including a failed
download that no caller waits for (`src/lib/time/localToUtc-history.test.ts`);
the birthplace clock at sixteen era ends and at every change of five zones'
pinned history, against a model that reads the same history
(`localToUtc-birthplace-clock.test.ts`). CI re-derives the files from the
pinned release with `--check` (`site-check.yml`, `tz-data-drift`).

Not established: that backzone's records are right. Its maintainers describe
them as less reliable than the main data, and they are used here only where
the main data would otherwise give another place's history.
