# The Zodiacs sky-fact benchmark, version 0

Ledger unit B4.a, "Sky benchmark v0: 300 questions, engine ground truth,
scorer, raw answers", whose gate reads: "items, scorer and raw answers
published; check_sky_fact agrees with the engine on every item".

| file | what it holds |
| --- | --- |
| `public/developers/sky-benchmark/v0/items.json` | the 300 questions, word for word, and the form each answer takes |
| `public/developers/sky-benchmark/v0/key.json` | the engine's answer to each, every answer accepted, and the values that decide it |
| `public/developers/sky-benchmark/v0/tool-answers.json` | `check_sky_fact`'s reply to each, unchanged, and the counts of facts and entries the test holds it to |
| `public/developers/sky-benchmark/v0/scorer.mjs` | the scorer, with no dependencies |
| `scripts/build-sky-benchmark.mjs` | the generator of the first three |
| `tests/benchmarks/sky-benchmark.test.ts` | the agreement, the generator and the scorer under test |
| `horizons-check.json`, `tools/horizons-check.mjs` | every answer in the key checked against NASA JPL Horizons |
| `src/pages/developers/sky-benchmark/index.astro` | the page, `/developers/sky-benchmark/` |

## The readings this record takes

- **"Raw answers".** The phrase comes from the brief's B4 risk line ("the
  benchmark looks self-serving. Publish the items, the scorer and the raw
  answers"), where it means the assistants' answers. DECISIONS-2026-09-28.md
  §9 later sends those to the private baselines repository, and scoring the
  assistants is B4.b. With no assistant run in B4.a, this record publishes
  `check_sky_fact`'s replies in their place. Publishing the tool's own
  replies does not answer the risk that line was written for, so this is a
  reading the owner should confirm before B4.a counts as done. Until the
  owner does, B4.a is recorded as validated, not accepted, from the
  checkpoint after this record is deployed.
- **"Engine ground truth"** is the engine's own longitudes, speeds and Moon
  phase, sampled densely by the generator. It is not the compute API's
  search, so the agreement the gate asks for is between two ways of reading
  the same engine. Separately, every answer in the key was checked against
  NASA JPL Horizons, which does not read the engine at all.

## The name

The brief's working name is "sky benchmark", to be checked for collisions
before publishing. On 2026-10-05, web searches found "sky-bench", Skytable's
database benchmarking tool; SkyPilot's benchmark command; Sky-T1, a NovaSky
model; and Skyfactor's Benchworks, a college assessment. Nothing is called a
sky-fact benchmark. It is published as the **Zodiacs sky-fact benchmark**,
which the owner can rename before assistants are scored on it.

## How the questions were drawn

The generator draws every question from fixed rules with a seeded generator
(mulberry32, seed 20261005, one stream per family), so it writes the same
three files on every run, and the test fails if the published files differ.
Version 0 was drawn on 2026-10-05; that date decides only whether a question
says "was" or "will be". Dates are drawn from 1900-01-01 to 2049-12-31; the
latest year a question names is 2048.

Version 0 is frozen. The test pins the SHA-256 of its four files, and the
generator refuses to draw v0 again with an engine or ΔT tables other than
those its files name: `@zodiacs/engine` 0.1.1-rc.16, with the IERS and model
ΔT tables of 2026-09-24 (digests `064d98b4a531053a` and `6371988c510a1c6c`).
A change to the engine or the rules is published as a new version in a new
folder, and v0 stays as it is. Once the site takes another engine, the drift
test checks that refusal instead, and the two tests that need v0's own engine
(the entries while retrograde, and the rules derived again) do not run;
`check_sky_fact` is still held to all 1,986 facts that are answers, which
v0's margins keep from turning on the engine's error. That was simulated on
2026-10-05 in a throwaway copy, with the installed engine named 0.1.1-rc.17
and then with new ΔT tables: 17 tests passed and those 2 were skipped, both
times.

| family | questions | answers |
| --- | --- | --- |
| a sign at an instant given to the minute in UTC | 60, six for each of the Sun, the Moon and the eight planets | a sign: all twelve occur, Aquarius most often (12) |
| a sign on a date, with no time or zone | 60: 15 about the Moon, 30 about the Sun or a planet on any date, 15 on a date that holds one of the body's sign changes | 29 DEPENDS, 31 a sign |
| whether a planet was retrograde on a date | 60: 30 on any date, 15 on a date the planet is retrograde throughout, 15 on a date it stations; the planet moves on by one each round of eight, so each planet is asked each kind of question | 24 YES, 21 NO, 15 DEPENDS |
| the date a body entered a sign | 60: the Sun 8, the Moon 12, Mercury to Saturn 6 each, Uranus 4, Neptune 3, Pluto 3; in a year, or for the Moon a month, in which it enters that sign exactly once, moving forward | a date |
| the date of a lunation | 60: 20 new moons, 20 full moons, 10 first and 10 last quarters, in a month with exactly one | a date |

**Shortcuts.** One answer for every question scores at most 29 of 60 on the
second family (DEPENDS) and 24 of 60 on the third (YES). Knowing the body
asked about helps a little, as it does in the sky: answering each body's
commonest answer scores 31 and 28 of 60, and the test holds that gain to a
tenth of a family. A question drawn twice is drawn again.

**Dates.** A date with no time or zone is read as the compute API reads one,
with its own constants (`ANY_ZONE_DAY` in `src/lib/compute-api/constants.ts`):
in every UTC offset in use today at once, from 14 hours before its midnight
UTC to 36 hours after, start included. When the body changes sign or stations
within those hours the answer is DEPENDS. For a date answer, every date whose
window holds the event is accepted: two dates for 114 questions and three for
6. "Exactly once" in a year or a month is judged over every date of the
period in every offset, from 14 hours before its first midnight to 12 hours
after the midnight that ends it, so no other date of the period can hold the
event in any offset.

**Margins.** A question is left out when its answer would turn on less than a
margin: a body within 1′ of a sign boundary at the instant asked about, or the
Moon within 30′; an event within 10 minutes of the edge of a date, or within
the time the body takes to move 30″; a station within 6 hours of one. The 30″
is more than the engine's largest measured longitude error for any body from
1900 to 2049: against Swiss Ephemeris every tenth day over those years, 20.4″
(Venus, 2026), at the same UT and at the same TT
(`docs/platform/evidence/site-engine-rc16/accuracy-refresh/multiyear-1800-2199.json`,
by era), and against Horizons at this benchmark's 60 instants, 13.6″. Where the
answer is that a planet stays in one sign on a date, or enters a sign once in
a period, a station within 30″ of that sign's boundaries also leaves the
question out, since the planet could cross there in the real sky; so does
another entry into the sign, or another lunation of the phase, within those
margins outside the period. These two rules came from the third review and
change nothing in v0: no question it holds meets them. The ingress and the
lunation must also be at least two days from either end of the year or month
asked about. ΔT is observed to 2026-09-24, predicted to 2027-10-02 and
extrapolated after that. The engine's 1σ estimate of its uncertainty reaches
11.9 seconds at the end of 2049; an error that size moves an event by as many
seconds, inside the 10-minute margin, and the Moon by under 8″, inside its
30′.

**The key.** Sign changes, stations and lunations are found by sampling the
engine's `bodyLongitude`, `longitudeSpeed` and `moonPhase` every 10 minutes
(the Moon's sign within a date), every hour (other bodies' signs and
stations within a date, the Moon's ingresses in a month, and lunations) or
every 6 hours (other bodies' ingresses and stations over a year), and
narrowed by bisection to the second. `bodyLongitude` and `longitudeSpeed`
return exactly what `positions()` reports, which the test holds for the ten
bodies at 1,500 instants from 1900 to 2049.

## What was established

- **Agreement with the engine.** `check_sky_fact` gives the key's answer on
  all 300 questions, and on 2,022 facts in all:
  - for a question about a sign, each of the twelve signs;
  - for a question about whether a planet was retrograde, that question;
  - for a question whose answer is a date, every accepted date and the date
    either side;
  - for each of the 18 entries into a sign while retrograde in the periods
    the ingress questions name, every date that holds it: 36 dates.

  The first three are 1,986 facts that are answers, which the margins
  protect. The entries while retrograde are not answers, and nothing keeps
  them from the edge of a date: in-025's, Mercury entering Libra at
  2033-11-02T12:08:09Z, is 8 minutes from one, and `check_sky_fact` gives it
  the engine's dates too.

  Its search samples every 5 days, or every day for the Moon, where the key
  samples every 10 minutes to 6 hours. Both read the same engine, so this
  checks the compute API's search and its reading of a date against a dense
  scan of that engine on these questions. It does not prove the search
  misses nothing, and it says nothing about whether the engine is right.
  `tool-answers.json` states the counts, and the test holds them.
- **Agreement with Horizons.** On 2026-10-05 `tools/horizons-check.mjs` asked
  NASA JPL Horizons for each body's apparent geocentric ecliptic longitude of
  date (observer quantity 31) around every question, and worked out each
  answer from Horizons' longitudes alone. All 300 answers agree with the key;
  `horizons-check.json` keeps every result, and the test holds that file, and
  Horizons' own answer in it, to the key published here. For a question
  whose answer is a date, Horizons was sampled within a day of the key's
  event, so it confirms the event's time and dates, while "once in the
  period" rests on the engine. The largest differences:
  - at an instant, 13.6″ between the engine and Horizons, with every body at
    least 109″ from a sign boundary in Horizons' longitudes;
  - for a sign change within a date, 3 hours 43 minutes (sd-044, Neptune
    returning to Libra in 1956 at 0.02° a day, so about 11″), still about 10
    hours inside the date's window;
  - for a station, 16 minutes (rd-036, Pluto in 2043);
  - for an ingress, 1.1 minutes or less for the Sun, the Moon and Mercury to
    Mars; Jupiter 7.1 minutes; Saturn 22.0; Neptune 26.9; Uranus 38.9; and
    Pluto 55.6 (in-058, entering Pisces in 2043), all with the same dates;
  - for a lunation, 0.14 minutes;
  - in Horizons' times, every ingress and lunation is at least 15 minutes
    from the edge of a date, every sign change in a question about a date
    about 13 minutes or more, and every station about 8.5 hours or more.
- **The scorer.** The key's own answers score 300 of 300 under the strict
  reading. In place of each key answer, every other sign or word, and the
  dates either side of the accepted ones, score as wrong: 1,800 replies. The
  test also holds the lenient reading against copies of the question, a
  stray "no", "no-one" and "no-brainer", "Gemini" naming Google's assistant
  but not "Gemini 12°", "yes and no" and dates written out. A question with
  no reply counts as unparsed, and so as wrong. On 2026-10-05 the scorer as
  published (SHA-256 `0519b207…`), copied into a folder with `items.json` and
  `key.json`, scored one file of 268 replies under Node.js 18.20.8 and
  22.22.2 with byte-identical output and the same warning: 267 replies to
  questions in eight forms, strict and lenient, with 33 questions left
  without a reply, and one reply to no question. That is what the page's
  "Node.js 18 or later" rests on; no test runs Node.js 18.

## Deliberate faults

Each fault below was made in a throwaway copy of commit `21bcfa1f`, with the
files regenerated where the generator changed, and the benchmark's 19 tests
were run on 2026-10-05. The tests are named here by their subjects:

| name | test |
| --- | --- |
| drift | "is what the generator writes, from the engine and from check_sky_fact, and with another engine the generator refuses to draw it again" |
| engine | "names the engine and the ΔT tables it was drawn with, and the generator draws it only with those" |
| pins | "keeps the bytes it was published with" |
| questions | "asks 300 distinct questions, 60 of each family, each with a key and a published reply" |
| replies | "publishes check_sky_fact's own reply to each question, which gives the key's answer and the key's events within 2 seconds" |
| answers | "check_sky_fact gives the key's answer to every question, for every sign, and on the dates around each date answer" |
| entries | "check_sky_fact finds every entry into a sign while retrograde in the ingress questions' periods, on every date that holds it" |
| window | "reads a date's window with the compute API's own constants" |
| wording | "says in each question what its key's facts say" |
| rules | "keeps every rule and margin it publishes, derived again by other steps from the engine it was drawn with" |
| shortcut | "lets knowing the body asked about beat one answer for every question by no more than a tenth of a family" |
| Horizons | "was checked against NASA JPL Horizons on every answer, and the check is of the key published here" |
| scorer | "gives no credit for the question repeated, a stray no, or an assistant called Gemini, and reads dates written out" |
| scorer key | "scores the key's own answers as all correct, and every other sign or word, and the dates either side, as wrong" |

Every fault failed at least one test that found a wrong question, answer,
fact or rule. The last column lists the other failures besides the pins:
the drift test; a count, where every fact the test asked agreed but their
number changed; and Horizons, whose committed record no longer matched the
key once the key changed. Horizons was not asked again for any fault.

| fault | where | caught as a wrong question, answer, fact or rule | also failed |
| --- | --- | --- | --- |
| each planet always asked the same kind of retrograde question | generator | shortcut | Horizons |
| "exactly once" judged over the year or month in UTC only | generator | rules (in-010) | Horizons |
| an ingress kept when the body enters the sign more than once | generator | rules (in-019) | entries (a count); Horizons |
| an ingress kept while the body is retrograde | generator | replies (in-040); rules (in-040) | answers and entries (counts); Horizons |
| a lunation question naming the wrong month | generator | wording (lu-001) | |
| an instant question naming the wrong hour | generator | wording (si-001) | |
| a 2″ margin in place of 30″ | generator | rules (the 30″ it holds the generator to) | answers and entries (counts); Horizons |
| the generator's refusal to draw v0 with another engine removed | generator | engine | |
| the compute API's search dropping entries while retrograde | `src/lib/compute-api/endpoints.ts` | entries (in-023) | |
| that search looking for the wrong sign boundary while retrograde | `src/lib/compute-api/endpoints.ts` | entries (in-023) | |
| a date's window starting 13 hours before midnight in place of 14 | `src/lib/compute-api/constants.ts` | answers (first on sd-037); window | drift |
| the full moon sought at 179.5° in place of 180° | `src/lib/compute-api/constants.ts` | answers (lu-026) | drift |
| one NO in the key turned into YES, its accepted answers left as they were | `key.json` | questions; replies; answers; scorer key | drift |
| the same NO turned into YES in its accepted answers too | `key.json` | replies; answers; rules | drift; Horizons |
| the hyphen rule taken out of the scorer | `scorer.mjs` | scorer ("No-one can know that…") | |
| "As Gemini" read as the assistant before any word | `scorer.mjs` | scorer ("…known as Gemini") | |

With a 2″ margin, the rules test fails first on the 30″ it holds the
generator's constant to. Run again without that line, it still fails, on the
margins themselves: in-040's ingress, as drawn with 2″, is closer to the edge
of a date than the time its body takes to move 30″. The answers test passes
every one of its 1,990 facts under that fault, because the key and the tool
read the same engine; a margin protects against the real sky, which only
Horizons, asked again, would show.

The two faults in the compute API's search are caught only by the entries
test, which runs only with the engine v0 was drawn with.

## Corrections made before publication

Three independent reviews read this record before publication: two read
the first build and a third read the second. What they found is fixed here:

- **The margin for slow planets was 2″.** In the first draw, Neptune's entry
  into Scorpio in 1957 came 5 hours 7 minutes later in the engine than in
  Horizons, which moved its accepted dates. The margin is now 30″, and the
  question is no longer drawn.
- **The planet's name gave the retrograde answer away.** Each planet was
  always asked the same kind of question, so answering from the name alone
  scored 56 of 60. The planet now moves on by one each round of eight.
- **"Exactly once" was judged in UTC.** It is now judged over every date of
  the period in every offset, and the test asks `check_sky_fact` about every
  entry into a sign while retrograde in those periods.
- **The scorer gave false credit.** A copy of the question, "no idea", or
  "Gemini" as the name of an assistant could read as an answer. They no
  longer do.
- **Version 0 was called fixed while the drift test would rewrite it.** Its
  files are now pinned by their bytes.
- **Wording.** The agreement is described as a check on these questions, not
  a proof; the licence position is stated; the date span, the sampling and
  ΔT are described as they are.
- **The next engine would have failed the site's tests.** The key and every
  reply name the engine and its ΔT tables, so any engine the site took next,
  the ΔT refresh due before 2 October 2027 among them, would have failed the
  drift test, and redrawing v0 would then have failed the pins. The
  generator now refuses to draw a published version again with another
  engine or other ΔT tables, and the tests run as the section on how the
  questions were drawn says.
- **The scorer still gave false credit.** "No-one" and "no-brainer" read as
  NO, and "Gemini 12°" or "known as Gemini" read as the name of Google's
  assistant, while "Taurus 12°" read as Taurus. A hyphen now leaves YES or NO
  on its own only with a space after it, and "Gemini" is the assistant only
  as "I am Gemini", "As Gemini, I", "Google Gemini", or before a version
  number or a product name, not before a degree.
- **One entry while retrograde went unasked.** The test skipped the one
  within 10 minutes of the edge of a date, while the record and the page
  said every entry was asked. It is asked now, and `check_sky_fact` gives it
  the engine's dates: 18 entries on 36 dates, 2,022 facts in all.
- **Two margins were missing:** a station within 30″ of a sign's boundary
  that never crosses it, and another entry or lunation just outside the
  period. They are kept now; v0 holds no question they would remove.
- **More wording.** The licence sentence said "all rights reserved, like the
  rest of the site", though the engine, the sky data and the conformance
  vectors are openly licensed; the scorer was said to read every reply twice;
  ΔT was said to be extrapolated only after October 2027, a month late, and
  to be covered by the Moon's margin rather than the 10-minute one; Horizons
  was said to answer the date questions alone; rounded minimums were stated
  as exact;
  B4.a was said to be recorded as validated before it was; and the Horizons
  tool said UT is UTC from 1972, not 1962.

## Not done, and not claimed

- **No assistant has been scored.** That is B4.b, with the owner's accounts,
  and its raw answers go to the private baselines repository.
- **No licence has been chosen.** DECISIONS-2026-09-28.md §6 and §7 set
  licences for the engine, the conformance vectors, the public sky data and
  the atlas, and not for a benchmark. Until the owner chooses one, these
  files fall under the site repository's all-rights-reserved notice, and the
  page says so. CC0 1.0, as for the conformance vectors, would let anyone
  rerun and republish it.
- **`check_sky_fact` is not on npm.** It ships only in the MCP adapter's
  candidate 0.1.0-rc.16.2, which the site serves as an archive.
- **The key is public**, so a model may have seen it, and a later model may
  have been trained on it.
- **Three DEPENDS answers turn only on offsets more than 10 hours from
  UTC**, and the questions do not say which offsets count: sd-001 on those
  east of +11:20, sd-037 on UTC+14 alone, and sd-049 on UTC−12:00 alone, an
  offset no inhabited place keeps.
- **The tropical zodiac only, and English only.** The questions ask for a
  fixed answer form, which is not how people usually ask.
