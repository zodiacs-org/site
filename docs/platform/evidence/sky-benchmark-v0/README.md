# The Zodiacs sky-fact benchmark, version 0

Ledger unit B4.a, "Sky benchmark v0: 300 questions, engine ground truth,
scorer, raw answers", whose gate reads: "items, scorer and raw answers
published; check_sky_fact agrees with the engine on every item".

| file | what it holds |
| --- | --- |
| `public/developers/sky-benchmark/v0/items.json` | the 300 questions, word for word, and the form each answer takes |
| `public/developers/sky-benchmark/v0/key.json` | the engine's answer to each, every answer accepted, and the values that decide it |
| `public/developers/sky-benchmark/v0/tool-answers.json` | `check_sky_fact`'s reply to each when v0 was drawn, unchanged, and the counts of facts and entries the test holds it to |
| `public/developers/sky-benchmark/v0/scorer.mjs` | the scorer, with no dependencies |
| `scripts/build-sky-benchmark.mjs` | the generator of the first three |
| `tests/benchmarks/sky-benchmark.test.ts` | the agreement, the generator and the scorer under test |
| `horizons-check.json`, `tools/horizons-check.mjs` | every answer in the key checked against NASA JPL Horizons |
| `scorer-check-replies.jsonl` | the replies the scorer read alike under three versions of Node.js |
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
(mulberry32, seed 20261005, one stream per family), so it draws the same
questions and key on every run, and the test fails if they differ from the
published files.
Version 0 was drawn on 2026-10-05; that date decides only whether a question
says "was" or "will be". Dates are drawn from 1900-01-01 to 2049-12-31; the
latest year a question names is 2048.

Version 0 is frozen. The test pins the SHA-256 of its four files. A version
counts as published once its folder holds any file, `scorer.mjs` among them;
only a folder or file that is not there counts as absent, and a folder that
cannot be read stops the generator.
The generator writes only a version whose folder is empty or missing, refuses
to check a version not yet published, and refuses to check a published
version with one of its files missing, or with an engine or ΔT tables other
than those its files name: `@zodiacs/engine` 0.1.1-rc.16, with the IERS and
model ΔT tables of 2026-09-24 (digests `064d98b4a531053a` and
`6371988c510a1c6c`). It compares only the engine's version and each table's
model, date and digest, so a receipt that writes the same engine and tables
another way, or lists the tables in another order, is not another engine. A change to the engine or the rules is
published as a new version in a new folder, and v0 stays as it is.

The drift test compares the questions and the key byte for byte.
`check_sky_fact`'s replies it compares by what decides them: each request,
its answer, and the facts behind it, with every event within 2 seconds of
where it was; an event whose time is missing or does not read as a time
counts as moved. The receipts beside the replies say how each was made when v0
was drawn, and may differ from today's without failing it.

Once the site takes another engine, the drift test checks the refusal
instead, and the one test that needs v0's own engine, the rules derived again
and held to its instants, does not run. `check_sky_fact` is still held to all
1,986 facts that are answers, which v0's margins keep from turning on the
engine's error, and to every entry into a sign while retrograde in the
ingress questions' periods, which the test finds again in the installed
engine. It holds their number to 18: each is at least 100 hours, and at
least ten times the time its body takes to move 30″, from the edges of the
span the test scans, from 14 hours before the period's first midnight to 12
hours after its last (86 hours and nine times from the period's own edges),
and no station in those periods comes within 133″ of a sign boundary (the
nearest, Mercury's on 2001-06-04, is 133.7″ from Cancer), so an engine within
30″ of v0's finds the same entries. That was simulated on 2026-10-05 in a
throwaway copy, with the installed engine named 0.1.1-rc.17 and then with new
ΔT tables: with the sixth review's fixes, the seventh's, the eighth's and
the ninth's, 21 of the 22 tests passed and the rules test was skipped, each
time, as 20 of the 21 had after the fourth and fifth reviews.

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
question out, since the planet could cross there in the real sky. So does
another entry of the body into the sign within those margins outside the
period, for the Sun and the Moon as for the planets, and, for a lunation,
another of the same phase within 10 minutes outside it. These rules came
from the third review and change nothing in v0: no question it holds meets
them. The ingress and the
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
  the engine's dates too. The test finds the entries again in the installed
  engine, by a scan of its own, and with v0's engine holds them to the key's
  18; so with another engine it still asks about every entry, on the dates
  that hold it a minute either way.

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
  stray "no", "no-one", "no-brainer", "no (direct) way" and "no...
  certainty", "Gemini" naming Google's assistant but not "Gemini 12°",
  "Gemini 3 days later", "Gemini, 1942 to 1949", "read as Gemini, I think",
  "Gemini" before the next item of a list or "Pro tip" on the line below,
  YES and NO before brackets, asides in brackets, dashes, ellipses and a
  table's bars, the answer words listed as choices ("yes or no", "yes/no",
  "yes|no", "YES, NO or DEPENDS", "yes (retrograde) or no (direct)") and a
  "no" before such a list, hedges between YES and NO ("yes and no", "yes...
  and no", "yes (in Tokyo) but no (in London)", "In London, no... in
  Tokyo, yes", and every word the header lists as joining an answer word
  to another case), a "yes" that is no hedge ("No, so a yes would be
  wrong"), line separators, dates written out, two days hedged between, as
  in "18 or 19 March 2041", "The date—18 or 19 March 2041", "2041-03-18/19",
  "2041-03-21 or 20" and "18 and/or 19 March 2041", dates the calendar does
  not have, in every form, and a number that is not a hedge's first or
  second day, as in "UTC+10 – 8 March 2023", "UTC–10 – 8 March 2023" and
  "2041-03-18 – 12.5 h after the new moon". A question with no reply counts
  as unparsed, and so as wrong.
  The test also holds the scorer to reading each of ten replies of 70,000
  characters, built from the runs of spaces, marks and line separators
  behind the slow cases of the sixth and seventh reviews and of a draft of
  the eighth's fixes, in under a second. On 2026-10-05 it took 4 to 12
  milliseconds on each, and the patterns it replaced took 3 to 82 seconds,
  as the fourth, fifth and sixth tables of faults show.
- **The scorer under three versions of Node.js.** On 2026-10-05 the scorer
  as published (SHA-256 `728355f2…`), copied into a folder with
  `items.json` and `key.json`, scored `scorer-check-replies.jsonl` in this
  folder under Node.js 18.20.8, 22.22.2 and 24.21.0 with byte-identical
  output (SHA-256 `2f92cda4d8288437…`) and the same warning. The file holds
  293 replies: 292 to questions, in the forms of the earlier runs, 26 that
  use the rules the sixth review changed, 32 that use the seventh's, 23
  that use the eighth's and 7 that use the ninth's, twelve of them between
  1,500 and 3,400 characters long, strict and lenient, with 8 questions
  left without a reply, and one reply to no question. That is what the
  page's "Node.js 18 or later" rests on; no test runs Node.js 18.

## Deliberate faults

Each fault in the first table was made in a throwaway copy of commit
`21bcfa1f`, with the files regenerated where the generator changed, and the
benchmark's 19 tests of that commit were run on 2026-10-05. The second table
holds the faults run after the fourth review, the third those run after the
fifth, each against the 21 tests of its round, and the fourth those run
after the sixth. The tests are named here by their subjects, as they are
now:

| name | test |
| --- | --- |
| drift | "is what the generator draws, the questions and key byte for byte and check_sky_fact's answers and facts, and with another engine the generator refuses to draw it again" (at `21bcfa1f`, "is what the generator writes, from the engine and from check_sky_fact, and with another engine the generator refuses to draw it again") |
| engine | "names the engine and the ΔT tables it was drawn with, and the generator draws it only with those" |
| frozen | "is never drawn again: not with a file missing, not over the published files, and not once the generator draws another version" (since the fourth review) |
| replies drift | "holds check_sky_fact's replies to what decides them, and not to the receipts beside them" (since the fourth review) |
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
test. At `21bcfa1f` it ran only with the engine v0 was drawn with; since the
fourth review it runs with any engine, and the second table shows it
catching both with a simulated other engine.

After the fourth review, each fault below was made in a throwaway copy of
the tree with its fixes, and the 21 tests were run on 2026-10-05. "rc.17"
means `installedEngine()` was made to name 0.1.1-rc.17, as the next engine
will. The faults in `scorer.mjs` also failed the pins, as any change to its
bytes does.

| fault | where | caught as a wrong question, answer, fact or rule |
| --- | --- | --- |
| the guard comparing the replies' ΔT entries as JSON, as before | generator | engine (the same tables with their fields in another order counted as another engine) |
| the replies compared with their receipts | generator | replies drift (all 300 replies differed by their receipts alone) |
| an event allowed to move a minute | generator | replies drift (an ingress moved 2.001 seconds passed) |
| the generator drawing over the published files | generator | frozen (the draw went ahead) |
| a missing file ignored | generator | frozen (with `items.json` missing it refused for another reason) |
| "Gemini" before any number read as the assistant, as before | `scorer.mjs` | scorer ("…from Taurus into Gemini 3 days later" read as Taurus) |
| YES and NO no longer standing alone before a bracket | `scorer.mjs` | scorer ("No (Mercury was direct all day)." read as nothing) |
| "yes or no" not taken out | `scorer.mjs` | scorer ("Either yes or no." read as NO) |
| "yes or no" naming both, as before | `scorer.mjs` | scorer ("Is it yes or no? No." read as nothing) |
| rc.17, with the compute API's search dropping entries while retrograde | `src/lib/compute-api/endpoints.ts` | entries (in-023 on 1944-12-23) |
| rc.17, with that search looking for the wrong sign boundary while retrograde | `src/lib/compute-api/endpoints.ts` | entries (in-023 on 1944-12-23) |

With rc.17 and nothing else changed, and again with new ΔT tables, 20 of the
21 tests passed and the rules test was skipped. The fault that draws over
the published files first ran against the test's 5-second default, which
caught it only by timing out; the test now allows the time a generator that
draws anyway takes, and a second run caught it on the refusal.

After the fifth review, each fault below undid one of its fixes in a
throwaway copy of the tree with them, and the 21 tests were run on
2026-10-05. The faults in `scorer.mjs` also failed the pins.

| fault | where | caught as a wrong reading, refusal or difference |
| --- | --- | --- |
| a slash no longer joining the answer words into a list of choices | `scorer.mjs` | scorer ("It's not a simple yes/no." read as NO) |
| a slash after YES or NO counted again, anywhere | `scorer.mjs` | scorer ("There is no/little chance it changed." read as NO) |
| the Gemini rule run on the reply joined into one line, as before | `scorer.mjs` | scorer ("It is either", then "1. Gemini" and "2. Cancer" on their own lines, read as Cancer) |
| a bracket or an ellipsis after YES or NO counted anywhere | `scorer.mjs` | scorer ("There is no (direct) way to tell…" read as NO) |
| two days before one month and year read as one date, as before | `scorer.mjs` | scorer ("It falls on 18 or 19 March 2041…" read as the 19th) |
| "As Gemini, I" read as the assistant anywhere | `scorer.mjs` | scorer ("The Sun would be read as Gemini, I think…" read as nothing) |
| "Gemini Advanced" read as the assistant again | `scorer.mjs` | scorer ("Mercury in Gemini advanced to 28° that day." read as nothing) |
| a table's bar no longer a mark | `scorer.mjs` | scorer ("\| Retrograde? \| No \|" read as nothing) |
| an event time missing or unreadable compared as within 2 seconds | generator | replies drift (sd-001's change lost its time and passed) |
| a version published only once a drawn file is there, as before | generator | frozen (with only `scorer.mjs` left, the generator drew v0) |
| `--check` drawing a version not yet published | generator | frozen (it drew v0, then failed on the published replies that were not there, not with the refusal) |
| the ΔT tables compared in their order | generator | engine (the same tables in the other order counted as another engine) |

With rc.17 and nothing else changed, and again with new ΔT tables, 20 of the
21 tests passed, the entries test among them with its 18 entries, and the
rules test was skipped.

After the sixth review, each fault below undid one of its fixes in a
throwaway copy of the tree with them, on 2026-10-05. A fault in `scorer.mjs`
was run against the scorer's six tests, and one in the generator against the
frozen and replies drift tests; the faults in `scorer.mjs` would also have
failed the pins. "Slow" is the test of five long replies, each to be read in
under a second; the time is that of the first reply to fail, where the test
stops.

| fault | where | caught as a wrong reading, refusal, difference or time |
| --- | --- | --- |
| a line's marks taken off one at a time, as before | `scorer.mjs` | slow (". " repeated: 6.3 seconds) |
| a list of choices sought from every word and mark, as before | `scorer.mjs` | slow ("no, " repeated: 12.0 seconds) |
| a list of choices allowed to split one run of spaces two ways, as before | `scorer.mjs` | slow ("No", 70,000 spaces and "x": 6.2 seconds) |
| "As Gemini, I" allowed to split one run of spaces two ways, as before | `scorer.mjs` | slow ("As Gemini", 70,000 spaces and "x": 5.1 seconds) |
| no aside in brackets before the mark | `scorer.mjs` | scorer ("The answer is no (Mercury was direct)." read as nothing) |
| a full stop counted when it begins an ellipsis | `scorer.mjs` | scorer ("I have no... certainty here without an ephemeris." read as NO) |
| an ellipsis that ends the line not counted | `scorer.mjs` | scorer ("The answer is no..." read as nothing) |
| an ellipsis taken as the end of a sentence | `scorer.mjs` | scorer ("There is... no (simple) way to tell." read as NO) |
| two full stops not counted at the start of a line | `scorer.mjs` | scorer ("No... it was direct all day." read as nothing) |
| a list of choices taken out with nothing in its place | `scorer.mjs` | scorer ("There is no yes/no." read as NO) |
| a bar no longer joining the choices | `scorer.mjs` | scorer ("Answer (yes\|no): NO" read as nothing) |
| a bar with spaces around it joining them too | `scorer.mjs` | scorer (a table row "\| NO \| NO \|" read as nothing) |
| a model's name on the next line read as the assistant | `scorer.mjs` | scorer ("The Sun was in Gemini", then "Pro tip: …", read as nothing) |
| a day the month does not have dropped, day first | `scorer.mjs` | scorer ("It falls on 28 or 29 February 2041." read as the 28th) |
| a day the month does not have dropped, month first | `scorer.mjs` | scorer ("February 28 or 29, 2041" read as the 28th) |
| any character but a digit or colon before a hedge's first day, as before | `scorer.mjs` | scorer ("At 14.30 – 19 March 2041." read as nothing) |
| any failure to read the folder taken as an empty folder | generator | frozen (with the folder's path a file, `--check` called v0 unpublished) |
| an event that is not an object read for its fields | generator | replies drift (a null event threw rather than differed) |
| a time lost from the published reply printed as "undefined" | generator | replies drift (sd-001's message) |
| the refusal not naming what an otherwise empty folder holds | generator | frozen (a folder with only `.gitkeep`) |

After the seventh review, each fault below undid one of its fixes in a
throwaway copy of the tree with them, on 2026-10-05, and was run as after
the sixth. "Slow" is now the test of eight long replies.

| fault | where | caught as a wrong reading, refusal, difference or time |
| --- | --- | --- |
| U+2028 and U+2029 read as spaces within a line, as before | `scorer.mjs` | slow (U+2028 70,000 times and "x": 82 seconds) and scorer ("The Sun was in Gemini", U+2028, then "Pro tip: …", read as nothing) |
| an aside in brackets running past a line separator or a carriage return | `scorer.mjs` | scorer ("The answer is no (it was", a carriage return, "direct)." read as NO) |
| the list of choices sought again after a word with an aside | `scorer.mjs` | slow ("no (x), " repeated: 7.1 seconds) |
| no aside allowed in a list of choices | `scorer.mjs` | scorer ("It is not yes (retrograde) or no (direct): it depends." read as nothing) |
| YES before an ellipsis only at the end of a line, as before | `scorer.mjs` | scorer ("The answer is yes... I think." read as nothing) |
| a "no" in a hedge not naming NO beside a YES | `scorer.mjs` | scorer ("No and yes, depending on the zone." read as YES) |
| another "yes" not naming YES beside a NO | `scorer.mjs` | scorer ("The answer is yes (in Tokyo) and no (in London)." read as NO) |
| a "no" before a bracket not a hedge | `scorer.mjs` | scorer ("The answer is no (in London) but yes (in Tokyo)." read as YES) |
| a "no" before an ellipsis not a hedge | `scorer.mjs` | scorer ("In London, no... in Tokyo, yes." read as YES) |
| "before" and "after" not joining a "no" to another case | `scorer.mjs` | scorer ("Yes, before 14:00 UTC; no after." read as YES) |
| a hedge's first day after only a space, a bracket, a quote or emphasis, as before | `scorer.mjs` | scorer ("~18–19 March 2041" read as the 19th) |
| a minus sign allowed before a hedge's first day | `scorer.mjs` | scorer ("In UTC−10 – 8 March 2023." read as nothing) |
| a YYYY-MM-DD date the calendar lacks dropped | `scorer.mjs` | scorer ("2041-02-28 or 2041-02-29" read as the 28th) |
| a reply whose only date is one the calendar lacks read as that date | `scorer.mjs` | scorer ("2041-02-29" read as a date that is never right, not as nothing) |
| no YYYY-MM-DD date with a second day | `scorer.mjs` | scorer ("2041-03-18/19" read as the 18th) |
| any second day after a YYYY-MM-DD date, earlier or later | `scorer.mjs` | scorer ("It enters on 2041-03-18, and 2 days later the Moon follows." read as nothing) |
| a second day that runs on into a time | `scorer.mjs` | scorer ("It enters at 2041-03-18 to 19:00 UTC." read as nothing) |
| a model's name on the next line after a version read as the assistant | `scorer.mjs` | scorer ("The Sun was in Gemini 2", then "Pro tip: …", read as nothing) |
| a version followed only by spaces and a line break not at the end of the reply | `scorer.mjs` | scorer ("The Moon was in Leo, says Gemini 2", spaces and a line break, read as nothing) |
| a reply without a result read for its fields | generator | replies drift (it threw rather than differed) |
| facts that are not an object read for their fields | generator | replies drift (null facts threw) |
| events that are not a list mapped | generator | replies drift (an object in place of the list threw) |
| replies that are not a list counted | generator | replies drift (null replies threw) |
| a reply missing from the published side named as "undefined" | generator | replies drift (si-001's message) |
| a time that is an object printed as it converts to text | generator | replies drift ("[object Object]" in the message) |
| a drawn file that is a link to nothing called only missing | generator | frozen (the refusal for a dangling `items.json`) |
| the links to nothing joined with "and" alone | generator | frozen (three dangling links named as "items.json and key.json and tool-answers.json") |

After the eighth review's probes, each fault below undid one of the fixes
that followed them in a throwaway copy of the tree with them, on
2026-10-05, and was run as after the seventh, except that each fault in the
generator was also run against the engine test; the unchanged copy passed
all 22 tests. "Slow" is now the test of ten long replies. Those marked * put
back one of eight changes the eighth review had made to the scorer with no
test failing.

| fault | where | caught as a wrong reading, refusal, difference or time |
| --- | --- | --- |
| "and/or" no longer joining two days | `scorer.mjs` | scorer ("18th and/or 19th March 2041" read as the 19th) |
| "&" no longer joining two days | `scorer.mjs` | scorer ("18 & 19 March 2041" read as the 19th) |
| "thru" no longer joining two days | `scorer.mjs` | scorer ("18 thru 19 March 2041" read as the 19th) |
| a count, a time or degrees after a YYYY-MM-DD date read as a second day | `scorer.mjs` | scorer ("It enters on 2041-03-18, and 2 days later the Moon follows." read as nothing) |
| a dash after a letter or a digit allowed before a hedge's first day | `scorer.mjs` | scorer ("In UTC–10 – 8 March 2023." read as nothing) |
| only a later day after a YYYY-MM-DD date read as a second day, as before | `scorer.mjs` | scorer ("2041-03-21 or 20, depending on the zone" read as the 21st) |
| no second day after a YYYY/MM/DD date | `scorer.mjs` | scorer ("2041/03/20 or 21" read as the 20th) |
| a second day after a date with a hyphen and a one-digit month or day | `scorer.mjs` | scorer ("It falls on 2041-3-18 or 19." read as the 19th) |
| YES before an ellipsis anywhere, as before | `scorer.mjs` | scorer ("The answer is yes... I think." read as YES) |
| "yes and no" not a rule of its own, as before | `scorer.mjs` | scorer ("Short answer: yes. Long answer: yes and no really." read as YES) |
| no ellipsis after the first word of "yes and no" | `scorer.mjs` | scorer ("Yes… and no really." read as YES) |
| no aside after the first word of "yes and no" | `scorer.mjs` | scorer ("Short answer: yes. Long answer: yes (mostly) and no really." read as YES) |
| the joining words cut back to the seventh review's | `scorer.mjs` | scorer ("Yes, mostly. No unless that, though." read as YES) |
| "but" dropped from the joining words * | `scorer.mjs` | scorer ("Yes, mostly. No but that, though." read as YES) |
| "depending" dropped from the joining words * | `scorer.mjs` | scorer ("Yes, mostly. No depending that, though." read as YES) |
| the other answer word no longer marking a hedge * | `scorer.mjs` | scorer ("Yes, mostly. No yes about it." read as YES) |
| any other "yes" naming YES beside a NO, as before | `scorer.mjs` | scorer ("No. Mercury was direct all day, so a yes would be wrong." read as nothing) |
| no "yes" naming YES beside a NO | `scorer.mjs` | scorer ("Maybe yes… maybe no…" read as NO) |
| no hedge after "but", "though", "although" or "yet" | `scorer.mjs` | scorer ("I think no (it was direct), but yes is possible." read as NO) |
| the look back for a word after "but" or the like run at every character, as in a draft of these fixes | `scorer.mjs` | slow ("Yes, though", 70,000 spaces and "x": 3.3 seconds in the test; "no (", 70,000 quotes and "x" took 18 seconds alone) |
| hedges read on a question about a sign | `scorer.mjs` | scorer ("Yes and no: the Sun was in Leo all day." read as nothing) |
| no aside after a later word of a list of choices * | `scorer.mjs` | scorer ("Of yes (retrograde), no (direct) or depends (a station), the answer is depends." read as nothing) |
| a hyphen allowed before a hedge's first day * | `scorer.mjs` | scorer ("In UTC-10 – 8 March 2023." read as nothing) |
| an aside running past a line feed * | `scorer.mjs` | scorer ("The answer is no (it was", a line feed, "direct)." read as NO) |
| an aside running past U+2029 * | `scorer.mjs` | scorer ("The answer is no (it was", U+2029, "direct)." read as NO) |
| the mark after a version allowed on the next line * | `scorer.mjs` | scorer ("The Sun was in Gemini 2", a line feed, ". The Moon was in Leo." read as Leo) |
| U+2029 read as a space within a line | `scorer.mjs` | slow (U+2029 70,000 times and "x": 26 seconds) and scorer ("The Sun was in Gemini 2", U+2029, "Pro tip: use a table." read as nothing) |
| a file that is not an object taken apart | generator | replies drift (a null file threw) |
| a reply that is not an object read for its id and request | generator | replies drift (the number 5 and the text "x" compared as the same) |
| a reply without a result compared by its result alone, as before | generator | replies drift (the text "x" and the number 7 as replies compared as the same) |
| a list taken as an object with fields | generator | replies drift (an event that is a list printed "undefined is now undefined") |
| a time that is not a string read as one | generator | replies drift (the number 2041 as an event's time on both sides compared as the same) |
| the forms of a malformed reply not told apart | generator | replies drift (a reply missing on one side and one with an empty result on the other compared as the same) |
| the files read for their engine and tables without a check, as before | generator | engine and frozen (a null `tool-answers.json` threw) |
| files that do not name an engine and tables not refused | generator | engine and frozen (the missing tables threw) |
| a drawn file that does not read as JSON not refused | generator | frozen ("Unexpected end of JSON input" in place of the refusal) |
| tables without a model, a table or a digest read as tables | generator | engine (a null table threw) |

After the ninth review, each fault below undid one of its fixes in a
throwaway copy of the tree with them, on 2026-10-05, and was run as after
the eighth; the unchanged copy passed all 22 tests.

| fault | where | caught as a wrong reading, refusal or difference |
| --- | --- | --- |
| a dash after any letter or digit taken for a minus, as before | `scorer.mjs` | scorer ("The date—18 or 19 March 2041—depends on your zone." read as the 19th) |
| no dash taken for a minus | `scorer.mjs` | scorer ("In UTC–10 – 8 March 2023." read as nothing) |
| a dash after GMT not taken for a minus | `scorer.mjs` | scorer ("In GMT–5 – 8 March 2023." read as nothing) |
| a dash after UT not taken for a minus | `scorer.mjs` | scorer ("In UT—3 – 8 March 2023." read as nothing) |
| no decimal part before a unit, as before | `scorer.mjs` | scorer ("It enters on 2041-03-18 – 12.5 h after the new moon." read as nothing) |
| any decimal after a second day taken for a count | `scorer.mjs` | scorer ("2041-03-18 or 19.03.2041" read as the 18th) |
| a file that is not an object wrapped as one, as before | generator | replies drift (`{"file": 5}` and the number 5 compared as the same) |
| an empty engine version taken as one | generator | engine (an empty version named as the engine that drew v0) |
| a drawn file that cannot be read left unnamed, as before | generator | frozen ("EISDIR: illegal operation on a directory, read" in place of the refusal naming `items.json`) |

## Corrections made before publication

Ten independent reviews read this record before publication: two read the
first build, a third read the second, a fourth the third, a fifth the
fourth, a sixth the fifth, a seventh the sixth, an eighth the seventh, a
ninth the eighth's fixes and a tenth the ninth's. The machine the eighth
ran on restarted before it wrote its report, so what is fixed here from it
comes from the probes it had saved, run again. What they found is fixed
here:

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
- **The guard compared how a receipt is written.** It compared the replies'
  ΔT entries as JSON, which the site's code writes, so the same engine and
  tables written in another key order would have refused v0, turned the
  drift test into a check of that refusal and skipped two tests. It now
  compares only what its refusal names: the engine's version and each
  table's model, date and digest.
- **The entries test ran only with v0's engine.** It is the one check of the
  search's path for entries while retrograde, so after the next engine a
  fault there would have passed. It now finds the entries again in the
  installed engine and asks about each on the dates that hold it a minute
  either way.
- **Any change to a receipt would have failed the drift test.** It compared
  `tool-answers.json` byte for byte, so a field added to the compute API's
  receipt would have forced a new version though no answer moved. It now
  compares the replies by what decides them, and the page says the replies
  are as of drawing.
- **The scorer gave false credit again.** "Gemini" before any number without
  a degree mark read as Google's assistant, so "from Taurus into Gemini 3
  days later" read as Taurus, and "Gemini, 1942 to 1949" as nothing. A
  version is now one digit, perhaps with a point and one or two more,
  followed by a model's name or the end of a clause. YES and NO now also
  stand alone before a bracket, an ellipsis, a slash or a double hyphen, and
  "yes or no", which only repeats the question, names neither. The scorer's
  bytes changed, and so did its pin; v0 had not been published.
- **The generator could draw v0 again.** With `key.json` or
  `tool-answers.json` missing it skipped its guard, and raising VERSION, as
  its refusal advises, would have failed the v0 drift test by construction.
  It now writes only a version whose folder is empty, refuses to check a
  published version with a file missing, and checks only the version it
  draws.
- **Wording.** The lunation's rule sat under "a planet stays in one sign, or
  enters a sign once", and the rule on another entry covers the Sun and the
  Moon too; each has its own clause now. The page said "Gemini" is ignored
  wherever it names the assistant; it is ignored in the forms the scorer
  lists.
- **"Yes/no" read as YES.** The fourth review's fixes let YES and NO stand
  alone before a slash, so "a definitive yes/no answer" read as YES, and
  "no simple yes/no answer: it depends on your time zone" as nothing. The
  answer words joined by "or", "nor" or a slash now only list the choices
  and name none of them, as "yes or no" already did, and a slash after YES
  or NO no longer counts.
- **The next item of a list read as a Gemini version.** The scorer joined
  the reply into one line before its Gemini rule ran, so "Gemini" ending one
  item of a numbered list and "2." starting the next read as "Gemini 2.",
  the assistant, and "either Gemini or Cancer" written as a list read as
  Cancer. The rule now reads the reply's own lines, and a version has to be
  on the same line as "Gemini".
- **"No" before a noun read as NO before a bracket or an ellipsis.** "There
  is no (direct) way" read as NO. A bracket or an ellipsis now counts after
  YES or NO only at the start of a line or a sentence.
- **A reply hedging between two dates read as the second.** "It falls on 18
  or 19 March 2041" read as the 19th, so a hedge gained credit on any date
  question that accepts the second date. Two days joined by "or", "and",
  "to", "through", a dash or a slash before one month and year now name two
  dates, and such a reply reads as nothing.
- **A reply whose events lost their times passed the drift test.** A
  missing or unreadable time compared as within 2 seconds. It now counts as
  moved.
- **The generator could still draw v0 again.** With the three drawn files
  gone and only `scorer.mjs` left, it saw no published version, and with
  another engine it would have drawn v0 anew. A version now counts as
  published once its folder holds any file, and `--check` refuses a version
  not yet published rather than report its files as changed.
- **Smaller fixes.** "Neither yes nor no" and a quoted "“yes” or “no”" list
  the choices too. "Read as Gemini, I think" and "Gemini advanced to 28°"
  read as the sign: "As Gemini, I" is the assistant only at the start of a
  line or a sentence, and "Advanced" is no longer one of the names after
  "Gemini" that make it the assistant. A table's "| No |" reads as NO. The
  scorer's header says that space may come between YES or NO and the mark
  after it. The guard compares the ΔT tables in any order. With another
  engine, the entries test holds their number to 18, as above. The test has
  a case where a slash list reads as NO.
- **The scorer could take minutes on a long reply.** The fifth review's
  fixes ran the list of choices and "As Gemini, I" on the reply's own
  lines, where a run of spaces can be long, and both patterns could split
  one run two ways; the list was also sought again from every word of a
  comma list and every character of a run of emphasis marks. The sixth
  review timed replies of 200,000 characters at 54 seconds to almost 4
  minutes, where the scorer after the fourth review took milliseconds, and a
  run of ". " at about 50 seconds in both, because a line's marks were taken
  off one at a time. Each
  pattern now has one way to read a run, a list is sought only from its
  first word, and a line's marks come off in one pass from each end. Every
  one of 227 long replies, 200,000 characters each and of every kind,
  now reads in under 100 milliseconds, and the test holds five of them to a
  second.
- **The bracket rule lost the commonest answers.** "The answer is no
  (Mercury was direct)." read as nothing, because a bracket counted only
  where a line or a sentence starts. An aside in brackets on the same line
  now counts wherever it is followed by one of the marks, so "no (direct)
  way" still reads as nothing.
- **Three full stops still counted anywhere.** "I have no... certainty"
  read as NO, though "no… certainty" did not. A full stop now counts only
  when it does not begin an ellipsis, an ellipsis counts at the end of a
  line, two full stops count like … at the start of a line, and an ellipsis
  no longer ends a sentence, so "There is... no (simple) way" reads as
  nothing.
- **A "no" before a list of choices stood alone.** Taking the list out left
  a space, so "There is no yes/no." read as NO. A word now takes its place.
- **A hedge with a day the month lacks read as the other day.** "28 or 29
  February 2041" read as the 28th, as 2041 has no 29 February. That day now
  still counts as one of the two, and never as a right one.
- **Smaller fixes.** "Gemini" before a model's name is the assistant only
  on the same line, so "Gemini", then "Pro tip" on the next line, is the
  sign. A hedge's first day must start the reply or follow a space, a
  bracket, a quote or emphasis, so "UTC+10 – 8 March 2023" reads as 8
  March. A bar with no space around it joins the choices, as in "(yes|no)",
  while a table's "| NO | NO |" still reads as NO. The generator stops on a
  folder it cannot read rather than take it as empty, names what an
  otherwise empty folder holds, and reports an event that is not an object,
  or a time lost from the published reply, as a difference. The record
  gives the margins of the entries from both spans, and the nearest station
  to a boundary as 133″ rather than 134″, which was 0.3″ too many. The
  replies the scorer read under three versions of Node.js are committed.
- **A run of line separators still made the scorer slow.** U+2028 and
  U+2029 end a line for the patterns that look for the start of one, but
  were also read as spaces within a line, so a run of them was read again
  from each of its characters: the seventh review timed one reply of
  200,000 characters at 11 minutes. They now end a line everywhere in the
  lenient reading, as a line feed or a carriage return does, and the timing
  test holds two such replies to a second.
- **Hedges between YES and NO read as the last answer named.** The sixth
  review's rules for an ellipsis and an aside left "yes" before an ellipsis
  in mid-line, or before an aside and "and", counting for nothing, so "The
  honest answer is yes... and no." and "The answer is yes (in Tokyo) and no
  (in London)." read as NO, and "In London, no... in Tokyo, yes." as YES. A
  hedge now names both: a reply with NO standing alone names YES too if it
  says "yes" anywhere else, and one with YES standing alone names NO too if
  it has a "no" before an ellipsis, a bracket, or a word such as "and",
  "but", "in" or "after" that joins it to another case. "Yes and no" now
  falls under that rule. YES also stands before any ellipsis, since "yes",
  unlike "no", never comes before a noun, so "The answer is yes... I
  think." reads as YES again.
- **Lists of choices with asides lost DEPENDS.** Once an aside could stand
  before a mark, "It is not yes (retrograde) or no (direct): it depends."
  read as nothing. A word in a list of choices may now carry an aside.
- **A hedge's first day had to follow one of a few characters.** So "~18–19
  March 2041" read as the 19th. The first day may now follow anything but a
  letter, a digit, a colon, a full stop, a plus, a hyphen, a minus sign or
  #.
- **A date the calendar lacks counted only in a hedge.** "2041-02-28 or
  2041-02-29" read as the 28th. Such a date now counts as one the reply
  names in every form, and is never right; a reply whose only date is one
  reads as nothing.
- **A YYYY-MM-DD date and a second day read as the first.**
  "2041-03-18/19" and "2041-03-18 or 19" now name two dates, while
  "2041-03-18 to 19:00" still names one.
- **Smaller fixes.** "Gemini" before a version is the assistant only with
  the model's name on the same line. The record counted three long replies
  among the sixth review's where there are four, and the fourth table of
  faults gave the slowest reply's time where the test stops at the first
  to fail. The generator reports a reply with no result, facts that are not
  an object or events that are not a list as a difference rather than
  throwing, shows a time that is not a string as JSON, names a drawn file
  that is a link to nothing, and names the request of a reply missing on
  either side.
- **The seventh review's hedge rules gave false credit, and lost some.**
  With YES standing before any ellipsis, and "yes and no" no longer a rule
  of its own, "Yes… and no really." and "Short answer: yes. Long answer:
  yes and no really." read as YES. With any other "yes" naming YES beside
  a NO, "No. Mercury was direct all day, so a yes would be wrong." read as
  nothing. YES now stands before an ellipsis only where NO does, at the
  end of a line or at the start of a line or a sentence, so "The answer is
  yes... I think." reads as nothing again. "Yes and no" and "no and yes",
  with or without an ellipsis or an aside after the first word, name both
  again, and a "yes" names YES beside a NO only in a hedge, as a "no"
  names NO beside a YES: before an ellipsis, a bracket, the other word or
  a word that joins it to another case, or after "but", "though",
  "although" or "yet". The joining words now take in "unless", "except",
  "by", "while", "whereas", "afterwards", "thereafter", "since", "once",
  "during", "outside", "under", "beyond", "around", "west", "east",
  "though" and "although", so "Yes, until noon; no afterwards." reads as
  nothing.
- **A YYYY-MM-DD date and an earlier day read as the date.** "2041-03-21
  or 20" read as the 21st, since only a later second day counted. Any
  other day of the month now counts, after a YYYY/MM/DD date too, unless a
  unit such as days, hours, h, am or degrees follows it, so "2041-03-18 –
  12 h after the new moon" names one date. Two days joined by "and/or",
  "&" or "thru" now name two dates as well.
- **A minus written as a dash made a hedge's first day.** "UTC–10 – 8
  March 2023" read as nothing, since the 10 after the en dash counted as
  the first of two days. A dash after a letter or a digit now stands for a
  minus.
- **The generator still threw on some malformed files, or missed a
  difference.** A null file, or a reply null on both sides, threw a
  TypeError, as did files that did not say which engine drew them; two
  replies of another form, such as `{"error": "a"}` and `{"error": "b"}`,
  or the number 5 and the text "x", compared as the same; and an event
  that was a list printed "undefined is now undefined". A file, a reply or
  a part of one in another form than the tool's is now compared as it is,
  a reply without a result whole apart from its receipt, and an event that
  is not an object has no time to read, so it differs even from itself. A
  `key.json` or `tool-answers.json` that does not read as JSON, and files
  that do not say which engine and ΔT tables drew them, are refused with a
  message.
- **A dash closed up to a word hid a hedge's first day.** The eighth
  review's fix took any dash after a letter or a digit for a minus, so "The
  date—18 or 19 March 2041—depends on your zone." read as the 19th. A dash
  now stands for a minus only after UTC, GMT or UT.
- **A decimal after a YYYY-MM-DD date read as a second day.** "It enters on
  2041-03-18 – 12.5 h after the new moon." read as nothing, since the 12
  counted as the 12th. A count of time or of degrees may now have a decimal
  part before its unit; "2041-03-18 or 19.03.2041" still names two dates.
- **Smaller fixes.** A file that is not an object no longer compares as the
  same as an object holding it, the generator refuses an empty engine
  version, model, table or digest, and a drawn file or folder it cannot
  read is named in the message. The record said every drawn file that does
  not read as JSON is refused, where only `key.json` and `tool-answers.json`
  are read as JSON and `items.json` is compared byte for byte; it said the
  twelve long check replies were thousands of characters long, where they
  are 1,513 to 3,315; and it gives both times of the slow draft's fault. The
  header says "the word standing alone" for what a hedged word may come
  before.
- **The header's hedge rule was narrower than the scorer.** It said a hedged
  word comes before "the word standing alone", where the scorer takes the
  other word wherever it is, so "No. Yes no-one disputes it." reads as
  nothing. The header now says so, with that example; the code is unchanged.
  The record also says that the eighth's and ninth's faults in the generator
  were run against the engine test, and lists two more dash cases among the
  limits below.

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
  candidates from 0.1.0-rc.16.2 on, which the site serves as archives.
- **The key is public**, so a model may have seen it, and a later model may
  have been trained on it.
- **Three DEPENDS answers turn only on offsets more than 10 hours from
  UTC**, and the questions do not say which offsets count: sd-001 on those
  east of +11:20, sd-037 on UTC+14 alone, and sd-049 on UTC−12:00 alone, an
  offset no inhabited place keeps.
- **The tropical zodiac only, and English only.** The questions ask for a
  fixed answer form, which is not how people usually ask.
- **The lenient reading has known limits**, which the strict score does not
  share. Some replies give false credit: a list written on one line, "1.
  Gemini 2. Cancer", reads as Cancer, since "Gemini 2." reads as a version;
  an abbreviation's full stop starts a sentence, so "e.g. no (known)
  station" reads as NO; a "not" is no hedge, so "Yes, in Tokyo, but not in
  London." reads as YES; a dash after UTC, GMT or UT is taken for a minus
  even where it is only punctuation, so "at 23:50 UTC—18 or 19 March 2041"
  reads as the 19th; and some hedges still read as one answer, among
  them "Yes, at first; no later on." and its mirror, "No, at first; yes
  later on.", "No, and yes too.", "Yes, mostly; no near midnight.",
  "Yes, depending on your time zone.", "No — except in Tokyo, where it is
  retrograde.", "c.18–19 March 2041", "Tuesday 18 or Wednesday 19 March
  2041" and "2041-03-20 (March 21 in Tokyo)". Others lose credit: "Yes /
  retrograde" reads as nothing, since a slash after YES or NO does not
  count; so do "The answer is yes... I think." and "So no... it was not
  retrograde.", since an ellipsis in mid-line is a pause, "the answer is no
  (a) (b).", with two asides, and a table written without spaces,
  "|NO|NO|", which reads as a list; a "yes" or a "no" in a hedge's form
  makes a reply name both, so "I see no (obvious) reason to say otherwise:
  yes.", "Yes, though no station falls on that date.", "Yes, but no more
  than that.", "Yes — there's no in-between." and "Yes. No (other) planet
  stationed that day." read as nothing, as does a
  reply with the other word standing alone anywhere, such as "No. (Yes, I
  checked the ephemeris.)" or "Yes, it was retrograde; no, it did not
  station.", and so do "It depends: in Tokyo, yes; in London, no." and "The
  answer is not yes but no."; a sentence does not start after an ellipsis,
  so "Hmm... As Gemini, I think the Moon was in Leo." names two signs;
  "there is no 29 February 2041; the date is 2041-03-01", "Ingress 2 – 7
  March 2023" and "In EST–5 – 8 March 2023", where a dash is taken for a
  minus only after UTC, GMT or UT, name two dates; and so does a YYYY-MM-DD
  date followed by a number that is not a day in a form the scorer does not
  know, as in "– 12 noon UTC", "– 6 o'clock", "– 14 UTC", "– 12.5-hour
  window", "– 12,5 h", "/ 1st quarter moon", "& 2 more ingresses follow"
  and "and 2 other planets follow".
