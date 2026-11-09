# Solar and lunar returns against cited worked examples (P2.A.timing.returns): preregistration

Written on 7 November 2026 (Asia/Bangkok), before the holdout described
below is searched for, and before the engine runs on any holdout candidate.
The branch's first commit adds this file and nothing else.

When it was written:

- Site main was `0ca97d725a85fa1dc5dbd0daf690fbb910d5a30c`. The site
  vendors `@zodiacs/engine` 1.1.0-rc.2 as
  `vendor/zodiacs-engine-1.1.0-rc.2.tgz` (SHA-256
  `c5aef0e3f20a19cf7ffabc99112cf592045199d6803814cf4ef6ea013615351c`).
  The archive exports `solarReturn`, `solarReturnInstant`, `lunarReturn` and
  `lunarReturnInstant` from `@zodiacs/engine/techniques`, and
  `planetaryReturns` from `@zodiacs/engine/timing`. Production serves this
  candidate: the site adopted it in #884, and #900 recorded it in production.
- What has already been seen. On 1 November 2026 the programme searched for
  worked examples of returns. It made 151 search entries, verified 63
  candidates against page images (44 solar, 19 lunar), and ran engine
  1.1.0-rc.1 on them. It then chose nine fixtures after their differences
  from the engine were known. It left out three candidates that fail their
  source-derived budgets: Pearce's 1854 return, Coley's 1678 return and
  Green's Map No. 3 lunar return. The result is the programme's file
  `notes/returns-2026-11-01/returns-search-result.json` (SHA-256
  `bc9bfe582470859e98802595f9bf704052a9079b6f650313b8794b292cd2fe1d`).
  Those candidates are the development data. Nothing in this record is
  scored on them.
- The rules below were written by someone who had seen those results. The
  19 verified entries from after 1800 (18 returns, one of them verified
  twice) differed from the engine by -152.5 s to +799.6 s. The seven chosen
  post-1800 fixtures differed by -1.0 s to +59.7 s. Among those left out,
  Pearce's 1854 return differed by +261.2 s, mostly because his 1819 noon
  Suns are about 14″ low, and Green's Map No. 3 lunar return by -143.5 s.
  The rules are fixed here, before any holdout candidate is found, so they
  cannot be tuned to the holdout.

Anything the work cannot meet as written here is a departure. The pull
request and the evidence README state each departure, with its reason,
before the merge is asked for. A departure or amendment made after any
holdout result is seen, if it changes the scored set, any `T` or the
verdict, makes a pass `validated` until the owner ratifies it.

## The unit and its gate

Ledger unit P2.A.timing.returns, "Solar and lunar returns in the package",
weight 1.5, status `partial`, release `none`. Gate: "fixtures from cited
worked examples; site parity". Its source is the brief's Phase 2 A timing
list ([ENGINE-AND-PLATFORM-BRIEF.md](../../ENGINE-AND-PLATFORM-BRIEF.md) §3),
whose rule reads "fixtures from worked examples in cited sources".

- Site parity is met. Checkpoint 15 (2026-10-05) judged it so, and
  P2.E.returns is accepted: the site imports the package's solar and lunar
  return searches and has no implementation of its own. This record does not
  re-judge parity. It does not change the site's returns code.
- What is missing is the first half: no fixture comes from a cited worked
  example. Checkpoint 15 recorded that USNO's season times and Horizons
  positions are reference values, not worked examples.
- The release state. For an engine capability, the release state is "an
  engine candidate the site vendors and production serves" (the programme
  README, "Status and release"). The fixtures run the vendored 1.1.0-rc.2,
  the candidate production serves, so no new candidate is needed.

## Why the gate is scored on a holdout

[DECISIONS-2026-10-05.md](../../programme/DECISIONS-2026-10-05.md) §4
accepts nothing "on a reading the programme proposed after seeing the
results". The development fixtures were chosen after their differences were
seen. So the gate is scored only on a holdout: candidates found, read twice
and frozen in a commit before the engine, or any other ephemeris, computes a
return for them.

## What counts as a worked example

A candidate is a passage in a printed source that meets all of W1 to W7.

- **W1.** It names a native (a person, or a hypothetical native the source
  fully specifies). It gives either the native's birth instant (date, clock
  time and place) or the radical longitude of the returning body.
- **W2.** It states the instant of the body's return to its radical
  longitude, as a date and a clock time to the minute or finer. The source
  presents the instant as its own computation or prints it in its own
  figure. A time the source quotes from another named source is not a
  candidate of the quoting source. A source that prints conflicting
  instants for the same return is not a candidate for that return.
- **W3.** The returning body is the Sun (a solar return or revolution) or
  the Moon (a lunar return). Returns of other planets are recorded but not
  scored (see "Planetary returns").
- **W4.** The return is tropical. Sidereal returns (Tajika or varshaphal
  years, "precessed" returns), progressed or diurnal figures, ingress
  charts and lunations are not returns here.
- **W5.** The return instant lies between 1800-01-01 and 2026-11-07. For a
  whole-chain fixture (below), so does the birth. This keeps every instant
  inside the engine's reference span (1800 to 2200) and in the past.
- **W6.** The source is cited by author (or pseudonym), title, volume or
  edition, year and page. A public scan of the page exists, and its address
  and leaf or image identifier are recorded.
- **W7.** The native is hypothetical, was born before 1900, or has a death
  date in a public record that the fixture cites. No living person's birth
  data enters the evidence.

## Which sources the holdout may draw on

- **H1.** A work is ineligible if the development data record it (its
  volume, issue or edition) as read, or as the source of any of the 63
  verified candidates. Sources that the development data name but record as
  not read ("identified, not read", "not examined", "NOT READ") are
  eligible, unless a verified candidate came from the same volume or issue.
- **H2.** Another edition or printing of an ineligible work is ineligible
  for any example that work contains.
- **H3.** A return that is a development candidate is ineligible from any
  source: the same native, the same body and the same return. One example
  is George V's 1918 solar return, which The Occult Review printed and which
  Zadkiel's Almanac for 1918 may also hold.
- **H4.** When two or more eligible sources state the same return of the
  same native, the earliest published one is the fixture. The others are
  recorded as corroboration and are not scored.
- **H5.** At most five fixtures come from one work or serial: the five
  earliest by publication date, then by page. Any others are recorded as
  corroboration and are not scored. No one source can carry the gate.
- **The list.** Before the search starts, the branch's second commit adds
  `ineligible.json`. It holds the works H1 and H2 exclude, as the
  development data record them, and the development returns (native, body,
  year). The searchers get this file and the briefs, never the development
  data themselves, which hold the engine's differences.

## How the holdout is searched and read

- **S1. No engine before the freeze.** Before the freeze commit, no one runs
  the engine, the Swiss Ephemeris, JPL Horizons or any other ephemeris for a
  candidate. The only computations allowed are S8's arithmetic, the UT
  conversions of the stated instants (`tools/readings.mjs`), and
  `tools/tolerance.mjs`, which imports only Node built-ins (C4 checks this).
  `tools/readings.mjs` uses the vendored `@zodiacs/engine/geo` for time-zone
  history and the Astronomical Almanac's low-precision solar formulas for
  the equation of time; it computes no longitude of a returning body.
  Searchers transcribe what the page prints, including any working the
  author prints.
- **S2. Every candidate is recorded,** with these fields:
  - the citation, and the scan's address and leaf;
  - the native;
  - the birth date, time, time basis and place, or the radical longitude,
    as printed;
  - the return instant as printed;
  - the time basis as stated, or the author's rule that fixes it;
  - the unit of every printed instant and longitude, and whether the source
    says it truncates;
  - the ephemeris and interpolation the author names or prints, and the
    author's working where printed.
  A searcher does not drop a candidate that meets W1 to W7 for any other
  reason.
- **S3. A blind second reading.** Another reader, not the finder, reads
  every candidate's fields again from the page image, without seeing the
  first reading. Fields that differ are read a third time from the image.
  A field still unresolved excludes the candidate, and the exclusion is
  recorded.
- **S4. The search plan and log.** Each searcher's brief and each family's
  order of sources go into `search-plan.json`, committed with
  `ineligible.json` before the search starts. The search log lists every
  source opened and what was found there, including nothing. It is
  committed with the holdout.
- **S5. The families.** The first pass has up to five searchers, one per
  family:
  - F1, almanacs and annuals, 1800 to 1960 (for example Zadkiel's Almanac,
    Raphael's Prophetic Messenger, and the volumes of Old Moore's not read
    in the development search);
  - F2, English-language periodicals, 1824 to 1960, in the volumes and
    issues not read;
  - F3, English-language books, 1800 to 1960, not read;
  - F4, books and periodicals in other languages, 1800 to 1960;
  - F5, lunar returns in any language, and returns after 1960 whose page
    images are public.
  Each searcher works until its family is exhausted or it has read 80
  sources. If the scored counts would fall below the minimums in "Scoring",
  one second pass of up to three searchers takes the families with the most
  unread leads. The holdout is then frozen whatever it holds.
- **S6. Rules of access.** Searchers use public scans and catalogues only.
  They do not pass bot checks or CAPTCHAs, sign in, pay, or use lending
  copies that need an account. Downloaded page images stay in the session's
  scratch space and are not committed.
- **S7. Copyright.** The evidence records facts (dates, times, longitudes,
  places) and citations. It quotes no more than a few words of any source.
- **S8. The author's arithmetic, before the freeze.** Where the author
  prints the working, the second reader redoes the author's arithmetic with
  the author's own printed figures. If the printed instant does not follow
  from that working by more than the instant's last printed unit, the
  candidate is recorded as a source slip and excluded. This is done for
  every candidate with printed working, before any engine run, so it cannot
  depend on a result.
- **S9. The order of exclusions.** S3, S8, W1 to W7 and the cap apply
  first. H4 and H5 apply to what remains.
- **S10. Pushes.** The first two commits are pushed before the search
  starts, and the freeze commit before the first run. The branch is never
  force-pushed or rebased.

## The fixtures and how each runs

- **Whole-chain.** The source states the birth instant. The engine derives
  the natal longitude itself: `solarReturn(birth, R)` for the Sun (the
  return nearest `R`), and `lunarReturn(birth, R minus 3 days)` for the Moon
  (the first return after it). `R` is the stated return instant in UT.
- **Step.** The source gives no birth instant but states the radical
  longitude. `solarReturnInstant(radical, R)` for the Sun, and
  `lunarReturnInstant(radical, R minus 3 days)` for the Moon.
- A source that states the birth instant gives a whole-chain fixture, even
  if it also prints the radical longitude. A source that gives neither does
  not meet W1.
- **The reading of each instant.** The return and the birth are read in the
  basis the source states, or the one its stated rule fixes. Failing that,
  in the basis it states for its other instants. Failing that, as the civil
  time in force at the place and date, as `resolveLocalToUtc` in the
  vendored `@zodiacs/engine/geo` gives it with the place's longitude (tzdb
  2025c with its history, and the place's own mean time before standard
  time); it computes no position. The place's longitude is as printed, or
  from GeoNames when not printed. The UT of every instant, under the reading
  used and under each combination of the open readings, is recorded in
  `holdout.json` before the freeze by `tools/readings.mjs`, and the other
  tools read those values.
  Pre-1972 instants are passed to the engine as UT1, as it reads them.
- The birth is passed as `{ utc, latitude, longitude }` and nothing else:
  no time scale, no dT and no other option. Search instants are passed as
  `Date` values. No other option is passed to any call.
- The engine is the vendored 1.1.0-rc.2, run with Node 22 (22.22.2 locally;
  CI's Node 22 runs the test). The result `E` is kept to the millisecond.
  The difference is `D = E - R`, in seconds. A fixture whose engine call
  throws disagrees.
- `tools/readings.mjs`, `tools/tolerance.mjs` and `tools/run.mjs` are
  committed in the freeze commit. A change to any of them after the first
  run is a departure, and every version's results are reported.

## The tolerance

A fixture agrees when `|D| <= T`. The tolerance is `T = r + i + b + c + t +
d`, in seconds. Each term comes from the source's recorded properties, or
from a constant fixed here. None comes from the engine or from `D`.

- **r, printing of the return.** Half the last unit in which the return
  instant is printed: 30 s for minutes, 0.5 s for seconds. It is the whole
  unit if the source says it truncates.
- **i, printing of the input.**
  - Step: half the last unit in which the radical longitude is printed,
    converted at 25.2 s per arcsecond for the Sun and 2.1 s per arcsecond
    for the Moon. These are the bodies' slowest daily motions, 0.953° and
    11.75°.
  - Whole-chain: half the last unit in which the birth time is printed (the
    whole unit if truncation is stated), times `f`. `f` is 1.01 for the Sun
    and 1.31 for the Moon, which bound the ratio of the body's speed at
    birth to its speed at the return (for the Moon, 15.39° to 11.76° a
    day). When the source prints the radical longitude its working uses,
    add half that longitude's last printed unit at the step rates.
- **b, the time basis.** Before the freeze, each fixture records the
  readings its source leaves open, besides the one used:
  - local mean time, Greenwich mean time and the civil time in force, where
    the source does not state the basis or a rule that fixes it;
  - apparent time, for an instant before 1880 whose basis the source does
    not state, or when the source uses an ephemeris tabulated for apparent
    noon;
  - summer or standard time, whichever is not used, where summer time was
    in force at the place and date and the source does not say;
  - the civil or the astronomical day, where the source prints hours
    without a.m. or p.m. before 1925;
  - the place's longitude plus or minus 0.1°, when it comes from GeoNames;
  - the equation of time plus or minus 10 s, when apparent time is a
    reading (it comes from the Astronomical Almanac's low-precision solar
    formulas).
  A reading is closed when the author's own printed working fixes it, for
  example a sidereal time worked from the instant. For each combination of
  the open readings, `dR` and `dB` are its changes to `R` and to the birth
  instant (0 for step fixtures), read from the UT values recorded for it.
  Then `b` is the largest, over every combination, of
  `|dR - dB| + |dB| * (f - 1)`, and 0 when none is open.
- **c, the author's interpolation.**
  - Sun: 8 s for linear interpolation between daily positions, 1 s
    otherwise.
  - Moon: 410 s for linear interpolation over 24 hours, 105 s over 12
    hours, 13 s for second differences over 24 hours, and 2 s for hourly
    positions or second differences over 12 hours.
  - When the source does not say, the daily linear value: 8 s for the Sun,
    410 s for the Moon. These are the largest errors of those methods over
    1800 to 2026, measured with astronomy-engine on a daily grid, from peak
    accelerations in longitude of about 0.00066° and 0.52° a day squared.
  - Whole-chain fixtures take this term twice: once for the birth, times
    `f`, and once for the return.
- **t, the author's tables.** An allowance in arcseconds for the era of each
  instant the computation reads. It includes a tabulated ephemeris's own
  rounding, and is converted at 25.2 s per arcsecond for the Sun and 2.1 s
  for the Moon:
  - Sun: 15″ before 1834, 4″ from 1834 to 1859, 1.5″ from 1860 to 1959, and
    0.5″ from 1960;
  - Moon: 30″ before 1862, 20″ from 1862 to 1922 (Hansen's tables in the
    Nautical Almanac), 5″ from 1923 to 1959, and 2″ from 1960.
  - Whole-chain fixtures take the birth's allowance plus the return's; step
    fixtures take the return's only.
- **d, the time scale.** The sources' tables take their time argument as
  mean time, while the engine's instants are UT1. The allowance is
  `|dT(return) - dT(birth)| + 2 s` for whole-chain fixtures, and
  `|dT(return)| + 2 s` for step fixtures. dT comes from the polynomial
  expressions of Espenak and Meeus (2006, "Five Millennium Canon of Solar
  Eclipses", NASA/TP-2006-214141) for 1800 to 2050, evaluated at the
  instant's decimal year. These overstate today's dT by a few seconds, which
  only widens the allowance.
- **The cap.** A fixture whose `T` exceeds 600 s for the Sun, 900 s for a
  lunar step fixture or 1,500 s for a lunar whole-chain fixture is recorded
  as too imprecise to test, and is not scored. The last is higher because
  `c` alone is 947 s for a whole-chain lunar fixture on daily or unstated
  interpolation. `T` is known before the run, so this cannot depend on a
  result.

`tools/tolerance.mjs` computes `T` and its terms from each fixture's
recorded properties. Its results are frozen with the holdout, before the
engine runs.

## Scoring

- **The scored fixtures** are those frozen in `holdout.json` that no
  exclusion removed before the freeze: S3 (an unresolved reading), S8 (a
  source slip), W1 to W7, the cap, then H4 and H5 (corroboration). Every
  exclusion is recorded with its reason.
- **No adjudication after the run.** The verdict uses the frozen fields.
  After the run, every scored fixture is read again by a reader who has
  seen no `D`, `T` or verdict. Errors found go in `corrections.json`, each
  with the verdict it would give. If the corrections would change the
  verdict in either direction, the unit is recorded `validated` until the
  owner rules on them. No ephemeris is used to excuse a disagreement.
- **The pass rule.** The gate passes when all of these hold:
  - (a) at least 5 scored solar-return fixtures agree;
  - (b) at least 1 scored lunar-return fixture agrees;
  - (c) the agreeing solar fixtures come from at least 2 authors and at
    least 2 works or serials, with authors counted by the person where
    known and otherwise by the pseudonym;
  - (d) at least two thirds of all scored fixtures agree, rounded up (for
    example, 5 of 7, or 7 of 10).
- **Why two thirds.** Old worked examples contain errors. In the
  development data, Pearce's 1854 return, printed to the second, sits 261 s
  from the engine, and Simmonite's 1854 return prints three different
  instants. A gross convention error in the engine (a sidereal year, or a
  wrong day, hour or time scale) would make most fixtures disagree. A
  geometric longitude would show only in step fixtures, and a mean one only
  where nutation differs between birth and return. A higher threshold would
  often fail a correct engine on source errors alone. For illustration,
  with 8 fixtures that each agree with probability 0.85, an 80 % threshold
  fails about one time in three, and two thirds about one time in nine.
- **Outcomes.**
  - Pass: P2.A.timing.returns is recorded `accepted`, release `deployed`.
  - Not scored: the scored fixtures, counted before the run, number fewer
    than 5 solar or fewer than 1 lunar, or the solar ones come from fewer
    than 2 authors or fewer than 2 works or serials. The engine still runs
    on them, and the results are reported. The owner is asked one plain
    question: whether the nine development fixtures, chosen after their
    differences were seen, meet the gate. Yes records `accepted`; no leaves
    the unit `partial`.
  - Fail: every other result. The unit is recorded `failed` (version 1),
    with every disagreement reported. Any later attempt is a new,
    preregistered version.
- Every result is reported, agreeing or not, with `D`, `T` and each term of
  `T`.

## The development data

The freeze commit adds `dev-search.json`. It is the development file with
local paths replaced by `<local>`, and its dashes replaced by hyphens; the
README gives both files' digests. All 63 verified entries are reported from
it, with their 1.1.0-rc.1 differences. The nine development fixtures, the
only entries with structured inputs, are re-run on 1.1.0-rc.2 after the
freeze. The test keeps them as regression fixtures with their 1.1.0-rc.2
instants. They are marked development and are never scored.

## Planetary returns

Planetary-return candidates that meet W1, W2 and W4 to W7 are recorded in
`holdout-planetary.json` with the holdout, and the engine does not run on
them here. A later preregistration, written before any run, may score them
for P2.A.timing.planetary-returns (weight 0.75), whose gate asks for cited
worked examples.

## Where the change goes

All the files are under `docs/platform/evidence/returns-worked-examples-20261107/`
unless named otherwise.

- First commit: `PREREGISTRATION.md`, this file, alone.
- Second commit, before the search: `ineligible.json` and
  `search-plan.json`.
- The freeze commit adds:
  - `holdout.json`: the fixtures, their fields, both readings, the readings
    used and left open, and `T` with its terms;
  - `holdout-planetary.json`;
  - `search-log.json`;
  - `dev-search.json`;
  - `tools/readings.mjs`, `tools/tolerance.mjs` and `tools/run.mjs`.
  It adds no engine result for a holdout candidate.
- The run commit adds:
  - `results.json`, which records the SHA-256 of `holdout.json`, and
    `corrections.json`;
  - `README.md`;
  - `tests/returns-worked-examples.test.ts`, which `npm test` runs;
  - the ledger entry, `LEDGER.md` regenerated, and a `STATUS.md` entry.
- No site page, API or package changes.

## Checks, each with a control that must fail

- **C1. This record comes first.** This passes when
  `git rev-list --reverse origin/main..HEAD` before the merge, or
  `git rev-list --reverse <merge>^1..<merge>^2` after it, starts with a
  commit that adds only this file, and that commit's author and commit
  dates are earlier than those of every later commit in that list. The
  merge is a merge commit, so the order stays in main's history.
  *Control:* the same check with its base set to that first commit takes
  the next commit as the first, which adds other files, so it must fail.
- **C2. Frozen before the run.** This passes when:
  - the freeze commit precedes any commit that adds an engine result for a
    holdout candidate;
  - `results.json` records a SHA-256 for `holdout.json` equal to that of the
    frozen file;
  - `tools/readings.mjs`, `tools/tolerance.mjs` and `tools/run.mjs` are
    unchanged since the freeze commit.
  *Controls:* the test, run on a copy of `holdout.json` with one byte
  changed, must fail on the digest; the same check, run on a copy of
  `tools/run.mjs` with one byte changed, must fail.
- **C3. The runs reproduce.** The test runs the vendored engine on every
  fixture, holdout and development. It asserts each recorded `E` to the
  millisecond and each verdict. *Controls:*
  - a copy of an agreeing fixture with `R` moved by `T + 1` s must disagree;
  - a copy of a whole-chain fixture with its birth moved by one day must
    disagree.
- **C4. The tolerance is the formula's.** The test recomputes `T` and its
  terms from each fixture's recorded properties and asserts the frozen
  values. It also asserts that `tools/tolerance.mjs` imports only Node
  built-ins, and that `tools/readings.mjs` imports only Node built-ins and
  `@zodiacs/engine/geo`. *Control:* a copy of a fixture with its return's printed unit
  changed from minutes to seconds must give a different `T`.
- **C5. Two readings.** Every holdout fixture has a scan address, a leaf and
  two blind readings whose fields agree, or a recorded third reading.
  *Control:* a planted fixture whose second reading differs, with no third
  reading, must be rejected.
- **C6. The verdict.** The test applies the pass rule to `results.json` and
  asserts the outcome the ledger records. *Control:* the rule applied to a
  copy in which agreeing fixtures are turned to disagreeing, until fewer
  than two thirds agree, must not pass.
- **C7. Eligibility.** No holdout fixture's work, or return, is in
  `ineligible.json`. *Control:* a planted fixture citing Leo's The
  Progressed Horoscope must fail.
- **Gate G1, privacy.** The private birth-data search, counts only, over
  both of the owner's pattern sets and every commit of the branch, adds no
  matching line or name, and the tree's count equals main's. If a line
  matches, the work stops and the owner is given the counts only.
- **Gate G2, the site's checks.** The handover's full pre-push list passes
  before every push, run one after another under the pinned Node
  toolchain, with any failure stated.

## The production record

The fixtures test the candidate production already serves, so nothing new
is deployed. After the merge, the live check that AGENTS.md asks for is
made. It includes a production page or response that names the engine
version, which must name 1.1.0-rc.2.

## Defaults the owner may change

The owner may change any of these:

- the two-thirds threshold, the minimum counts and the caps;
- the table allowances in `t`;
- the families in S5;
- planetary returns being recorded rather than scored.

A change made after the holdout's results are seen is an amendment. Under
the programme README, a gate that passes only under it counts as
`validated` until the owner ratifies it.
