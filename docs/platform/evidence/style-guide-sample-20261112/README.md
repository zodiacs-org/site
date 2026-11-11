# A sample of live readings scored against the reading style guide (ZOD-107)

One-shot run of ZOD-57, with ZOD-55 as context only. Evidence and suggestions. No product copy, template or prompt is changed on this branch, no cadence is started, and no weekly editor is built.

- Sampled: 2026-11-11, 18:16 to 18:19 UTC (2026-11-12, 01:16 to 01:19 ICT). The live daily edition was the 2026-11-11 UTC edition.
- Repo state read for sources: `origin/main` at `7c7b2d16`.
- Guide: opened in full, see [style-guide.md](style-guide.md).

## Headline result

16 readings were scored against 16 rules (256 scores): 93 pass, 90 partial, 39 fail, 34 not applicable.

1. **No sampled reading ends with a reason to come back.** Rule 3 scores 0 passes out of 16 (11 fails, 5 partials). The daily template has no closing line at all.
2. **Sky terms are not explained at first use.** Rule 2 scores 0 passes out of 16. "Waxing crescent Moon", "Mercury retrograde", "sextile", "decan" and "exact contact" all appear bare.
3. **Advice first holds in the English daily program and nowhere else.** The four English dailies and the connector's daily reading lead with advice. The Spanish daily, `/today/`, the birthday page, the monthly reading and the personal transit lines all lead with sky positions.
4. **The sky facts are sound.** Every position, phase, station, ingress, eclipse and aspect that was checked recomputes to the printed value. Four real defects were found beside that: a "First Quarter" label two days early on the weekly page, a monthly reading whose dates are off by a day for the time zone the caller asked for, a birth chart that says "no planet in fire" while also saying the Moon may be in Leo, and a result that prints a reading-confidence figure for a reading it did not return.
5. **The Spanish daily is a different product, not a translation.** It prints four house notes with no advice, uses different planets from the English reading for the same sign and day, and is 65 words.

Every partial and fail below points to a suggested fix at a template, a lexicon table or a prompt (section 6). None is a rewrite of one reading.

## 1. The guide and the rules used

The guide opened, so the rule list is the guide's own, plus the fourth core rule named on ZOD-57 and ZOD-107 (it is the guide's first "Always" line), plus the three `AGENTS.md` copy rules named in the issue.

| Id | Rule | Where it comes from |
|---|---|---|
| R1 | Advice first: open with one sentence telling the reader what to do or notice today. No sky details before it. The first sentence works on its own. | Guide, core rule 1 and quick check 1 |
| R2 | Plain words: every sky term gets an everyday explanation the first time it appears. If a term can be left out, leave it out. | Guide, core rule 2 and quick check 2 |
| R3 | A reason to come back: end with one line that points to tomorrow or later this week, based on something real in the sky. | Guide, core rule 3 and quick check 4 |
| R4 | Sky facts only from zodiacs.org's own calculations. | Guide, "Always" 1 and quick check 3; core rule 4 on ZOD-57 |
| R5 | Daily shape: hook, why, try it, come back. | Guide, "Shape of a daily reading" |
| R6 | About 80 to 100 words in total. | Guide, "Shape of a daily reading" |
| R7 | Say what astrologers read in the sky, rather than claiming it as certain fact. | Guide, "Always" 2 |
| R8 | Keep actions small and doable today. | Guide, "Always" 3 |
| R9 | Short sentences a 12-year-old could follow. | Guide, "Always" 4 |
| R10 | Never predict health, money, investments or guaranteed outcomes. | Guide, "Never" 1 |
| R11 | Never use fear or doom. | Guide, "Never" 2 |
| R12 | Never stack jargon like degrees, aspects or house numbers without explaining them. | Guide, "Never" 3 |
| R13 | The voice: exact about the real sky, warm and plain about what it means. Never curt or mean, never vague or mystical. | Guide, "The voice" |
| H1 | No betting tips, sports picks, market timing, election forecasts, health predictions or guarantees; the issue asks for no such wording. | `AGENTS.md`, product rules |
| H2 | No em dashes or en dashes in copy. | `AGENTS.md`, product rules |
| H3 | A forecast carries a "Reading confidence NN%" label. | `AGENTS.md`, product rules; `src/ai-tools/reading-confidence.ts` |

How the rules were applied:

- The guide says it covers every reading "wherever a reader meets it", so R1 to R4 and R7 to R13 were applied to every item. R1 and R3 say "today" and "tomorrow or later this week"; on a weekly, monthly, yearly or timeless reading they were read as "open with what to do or notice" and "end with a line that points to what is next in the real sky".
- R5 and R6 are written for a daily reading. They are scored on the six daily readings and marked not applicable elsewhere, with the word count noted.
- **Pass**: the rule holds. **Partial**: it holds in part, or holds with a defect worth fixing at the source. **Fail**: it does not hold. **n/a**: the rule has nothing to apply to in this item. Where a missing element is itself a miss (for example no action at all), the rule that asks for the element carries the fail (R1 or R5), and the rule about its quality (R8) is n/a.
- H1 is scored stricter than R10 on purpose. R10 asks whether a health or money outcome is predicted. H1 follows the issue's "no health wording" reading, so the life-area phrase "health routines" is a partial under H1 even though nothing is predicted.

## 2. The sample and how it was chosen

The sample was fixed before any text was read, from the live sitemap (`https://zodiacs.org/sitemap.xml`, 1,910 URLs) and the surfaces ZOD-46 lists. The aim was spread across surface, sign, time span and language, not the best pages. No item was dropped after reading it.

### Live pages (9 scored)

| Id | URL | Why this one |
|---|---|---|
| P1 | https://zodiacs.org/horoscopes/aries/ | Daily. Fire sign. The URL the issue names. |
| P2 | https://zodiacs.org/horoscopes/gemini/ | Daily. Air sign. Chosen with P1, P3 and P4 by one rule: one sign per element, a different mode where possible (cardinal, mutable, fixed, cardinal). |
| P3 | https://zodiacs.org/horoscopes/scorpio/ | Daily. Water sign. The guide's own example is Scorpio on 11 November, so this is the one live reading that can be set beside the guide's model. It is also the sign the Sun and retrograde Mercury are in. |
| P4 | https://zodiacs.org/horoscopes/capricorn/ | Daily. Earth sign. |
| P5 | https://zodiacs.org/horoscopes/scorpio/weekly/ | A longer span from the same program, same sign as P3, to see whether the misses are in the daily template only. |
| P6 | https://zodiacs.org/es/horoscopes/scorpio/ | Translated daily. Spanish and Portuguese are the two locales with live daily horoscopes; Spanish is the first released. Same sign as P3 so the two can be compared line by line. |
| P7 | https://zodiacs.org/today/ | Required by the issue. |
| P8 | https://zodiacs.org/birthday/november-12/ | Feature reading. The birthday pages are the largest reading family in the sitemap (about 1,100 URLs) and ZOD-46 names the birthday report. The date is the run's own date in ICT, picked by rule, not by quality. |
| P9 | https://zodiacs.org/your-2027-sky/ | Feature reading. The live page closest to the "Year Ahead" surface, since `/year-ahead/` is 404. Only the shared-sky part is static text; the personal part is worked out in the browser from a birth date and was not driven. |

Each page was fetched once with `curl`, saved, and reduced to the text of its `<main>` region by [tools/extract.py](tools/extract.py). The texts are in [records/pages/](records/pages/); [records/pages/fetch-log.txt](records/pages/fetch-log.txt) has the fetch time, status, SHA-256 and size of each raw HTML file. The raw HTML is kept outside git, with the job's run files.

The saved text is what the server sends. Daily pages run a small script (`src/components/EditionFreshnessGuard.astro`, rules in `src/lib/edition-freshness.ts`) that swaps dated wording for relative wording while the edition is the current UTC day. So the saved "For the November 11, 2026 edition, check the budget…" reads "Today, check the budget…" in a browser on 11 November. No browser was run in this job; that form is taken from the source rule and from the connector's copy of the same program, which opens "Today,".

### Connector outputs (7 scored)

All calls were `POST https://zodiacs.org/mcp` (`tools/call`), server version 0.6.6, with invented adult birth dates and no names, places or birth times. Requests and full responses are in [records/connector/](records/connector/), with times and hashes in [records/connector/call-log.txt](records/connector/call-log.txt). The helper is [tools/mcp-call.sh](tools/mcp-call.sh).

| Id | Tool and arguments | Why this one |
|---|---|---|
| X1 | `get_horoscope` `{sign: leo, zone: Asia/Bangkok}` | Required. A sign not among the pages, so five signs are read in English. Bangkok puts the caller on 12 November, which tests the next edition. |
| X2 | `get_horoscope` `{period: week, birthDate: 1990-05-03, zone: Europe/Madrid}` | The personal-forecast branch of the same tool. No sign was passed, to see what the reader gets then. |
| X3 | `get_sky` `{zone: Asia/Bangkok}` | The plain sky tool: the "exact about the real sky" half of the voice. |
| X4 | `get_compatibility` `{a: 1988-02-14, b: 1991-09-30}` | The most-used feature reading with a score and a verdict. |
| X5 | `get_personal_transits` `{birthDate: 1990-05-03, currentZone: Europe/Madrid, from: 2026-11-12, to: 2026-11-25}` | Dated forecast lines, each with a confidence label. |
| X6 | `get_horoscope_period` `{sign: pisces, period: month, zone: America/New_York}` | A long, hand-written reading (the monthly `.mdx` copy) served through the connector, in a zone west of UTC. |
| X7 | `get_natal_chart` `{birthDate: 1990-05-03}` | A timeless reading with no birth time, which tests how unknowns are said. |

One call returned nothing: the first `get_personal_transits` request (`c5-get_personal_transits.request.json`, default 30-day window) came back with HTTP 200 and an empty body. The same request answered normally seconds later when sent again by hand, and X5 is the windowed call that followed. The empty response was not kept.

### Not sampled, and why

- **Not live:** `/year-ahead/` and `/tarot/` are 404. `/year-score/` and `/birthday-report/` answer with a page that redirects to `/404.html`. So the Year Ahead Score, tarot and the birthday report named on ZOD-46 could not be read as pages. This is a limit of the sample.
- **Zodiacs Astrologer bot:** not sampled. It is not part of the site or the connector endpoint this job was pointed at.
- **Fetched, not scored:** `/horoscopes/` (a hub of teasers of the same twelve dailies; kept in the records because it shows the same opening line), `/es/today/`, `/solar-return/`, `/occasions/`, `/numerology/` (fetched while looking for live feature URLs).
- **Not fetched:** love, career, tomorrow, monthly and yearly horoscope pages, Portuguese, French, Italian, Russian and Chinese pages, compatibility pair pages, People pages, and the emails. The thesis page is out of scope (ZOD-47).

## 3. Score table

P = pass, Pa = partial, F = fail, n/a = not applicable.

| Reading | R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | R11 | R12 | R13 | H1 | H2 | H3 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P1 Aries daily | Pa | F | F | P | Pa | P | Pa | Pa | F | P | P | P | Pa | P | P | Pa |
| P2 Gemini daily | Pa | F | F | P | Pa | P | Pa | P | F | P | P | P | Pa | P | P | Pa |
| P3 Scorpio daily | Pa | F | F | P | Pa | P | Pa | Pa | F | P | P | P | Pa | Pa | P | Pa |
| P4 Capricorn daily | Pa | F | F | P | Pa | Pa | Pa | Pa | F | P | P | P | Pa | P | P | Pa |
| P5 Scorpio weekly | Pa | F | F | Pa | n/a | n/a | Pa | Pa | F | P | P | P | Pa | P | P | Pa |
| P6 Escorpio daily (es) | F | Pa | F | P | F | F | Pa | n/a | P | P | P | Pa | Pa | P | P | n/a |
| P7 /today/ | F | Pa | Pa | P | n/a | n/a | P | n/a | Pa | P | P | Pa | Pa | Pa | P | Pa |
| P8 Birthday, 12 November | F | F | F | P | n/a | n/a | F | Pa | F | P | P | Pa | Pa | P | P | n/a |
| P9 Your 2027 sky | Pa | Pa | Pa | P | n/a | n/a | Pa | Pa | P | Pa | P | Pa | P | P | P | Pa |
| X1 get_horoscope, Leo day | P | F | F | P | Pa | P | Pa | P | F | P | P | P | Pa | P | P | P |
| X2 get_horoscope, personal week | F | Pa | Pa | P | n/a | n/a | Pa | n/a | Pa | Pa | Pa | Pa | Pa | P | P | Pa |
| X3 get_sky | n/a | Pa | Pa | P | n/a | n/a | P | n/a | n/a | P | P | F | n/a | P | P | n/a |
| X4 get_compatibility | P | Pa | F | P | n/a | n/a | Pa | n/a | P | P | P | Pa | Pa | P | P | P |
| X5 get_personal_transits | F | Pa | Pa | P | n/a | n/a | Pa | n/a | Pa | Pa | Pa | Pa | Pa | P | P | P |
| X6 get_horoscope_period, Pisces month | F | F | F | Pa | n/a | n/a | Pa | n/a | F | Pa | P | F | Pa | Pa | P | P |
| X7 get_natal_chart | F | Pa | F | Pa | n/a | n/a | Pa | P | Pa | P | P | Pa | Pa | P | P | n/a |

Passes per rule, out of the items the rule applies to: R1 2 of 15, R2 0 of 16, R3 0 of 16, R4 13 of 16, R5 0 of 6, R6 4 of 6, R7 2 of 16, R8 3 of 9, R9 3 of 15, R10 12 of 16, R11 14 of 16, R12 6 of 16, R13 1 of 15, H1 13 of 16, H2 16 of 16, H3 4 of 12.

## 4. Reading by reading

Each entry gives the reason for every score that is not a plain pass, with the words it rests on and the fix it points to (section 6). Quotes are from the saved records.

### P1 to P4. English daily horoscopes (Aries, Gemini, Scorpio, Capricorn)

All four come from one template (`src/lib/horoscope-program.ts`, daily builder near lines 1009 to 1090), so they share most scores. Record: `records/pages/horoscopes__{sign}.txt`, lines 9 to 15.

P3, in full, as served:

> For the November 11, 2026 edition, check the budget of time, attention, and material resources. For Scorpio, depth is useful when it produces a fact, a boundary, or a decision. The waxing crescent Moon puts your money, possessions, and priorities on the day's agenda.
>
> Remove one repeated snag from the routine before adding another promise to the week. In this reading, Saturn retrograde in Aries brings attention to daily work, health routines, and responsibilities.
>
> Connect your money, possessions, and priorities with daily work, health routines, and responsibilities; ask what is known before assigning meaning to what is concealed.

| Rule | Score | Reason | Fix |
|---|---|---|---|
| R1 | Partial, all four | Advice does come first and no sky detail precedes it. But the served text opens with a date clause, "For the November 11, 2026 edition,", and the first sentence leans on abstractions ("test the larger belief against study, distance, or direct experience", P1). In a browser on the edition day the opener is "Today,", which would pass. | S3, S4 |
| R2 | Fail, all four | "The waxing crescent Moon" and "Mercury retrograde in Scorpio" (P1), "Mars in Leo" (P2), "Saturn retrograde in Aries" (P3), "Venus retrograde in Libra" (P4) appear with no everyday explanation. The guide's own example glosses both ("Mercury, the planet of talking and planning, is moving backward"). | S2 |
| R3 | Fail, all four | The reading ends on the third section. There is no line about tomorrow or the week. A "Tomorrow" teaser card sits further down under "More for Scorpio", but it is a link to another reading, not a closing line from the sky. | S1 |
| R4 | Pass, checked | Moon 13.8° Sagittarius, Mercury 5.5° Scorpio retrograde, Mars 23.7° Leo, Saturn 8.7° Aries retrograde, Venus 23.0° Libra retrograde, waxing crescent, 5% lit: all recomputed (section 5). | |
| R5 | Partial, all four | Hook: present. Why: one clause per section, not two or three plain sentences. Try it: present in the second section. Come back: missing. The third section ("Connect X with Y; …") is not one of the guide's four parts. | S1, S4 |
| R6 | Pass for P1 (101 words), P2 (93), P3 (98). Partial for P4 | P4 is 106 words and says the same thing twice: "the useful test is to define the minimum sound structure before adding another duty" closes the first section and "define the minimum sound structure before adding another duty" closes the third. Counts include the four extra words of the dated opener. | S4 |
| R7 | Partial, all four | "The waxing crescent Moon puts … on the day's agenda" states the reading as fact. "In this reading, …" in the second section is the right move, and the footer says "their meaning is an astrological interpretation". | S5 |
| R8 | Pass for P2. Partial for P1, P3, P4 | P2 is concrete: "Write the message plainly, confirm the route, and ask the question that would prevent avoidable confusion." The others mix one doable step with ones that are not: "test the larger belief against study, distance, or direct experience" (P1), "ask what is known before assigning meaning to what is concealed" (P3), "Choose the finished work, standard, or responsibility you are prepared to make visible" (P4). | S4 |
| R9 | Fail, all four | Sentences run to 21 to 25 words and stack abstract nouns: "For Scorpio, depth is useful when it produces a fact, a boundary, or a decision." "Connect travel, learning, beliefs, and long-term plans with shared finances, debts, intimacy, and trust; name the first workable move and leave the grand gesture alone." (P1). A 12-year-old would not follow these. | S4 |
| R10 | Pass, with a note | Money, debts and health appear only as life areas ("shared finances, debts", "your money, possessions, and priorities", "health routines"). No outcome is predicted. | |
| R12 | Pass | No degrees, aspect names or house numbers in the reading. They sit in the collapsed "Behind this reading" block as receipts. | |
| R13 | Partial, all four | Plain enough and never mystical, but the register is a management memo, not a friend: "Follow the consequential thread", "the minimum sound structure", "material resources". | S4 |
| H1 | Pass for P1, P2, P4. Partial for P3 | P3 prints "health routines" twice. It is a life area, not a prediction, so this is a wording call for Dias. | S6 |
| H3 | Partial, all four | The page gives no "Reading confidence NN%". It says the reading is not "a prediction of events", so it may not count as a forecast. But the connector serves the same program's reading with "Reading confidence 40%" (X1). One of the two is out of line with the rule. | S7 |
| R11, H2 | Pass | No fear or doom wording. No em or en dash anywhere in the saved text (scanned for U+2013 and U+2014). | |

A note beside the scores: the guide's example is this same sign and date (Scorpio, 11 November) and builds on the new Moon and on Mercury moving backward through Scorpio. The live Scorpio reading uses the Moon and Saturn and never mentions that Mercury is retrograde in the reader's own sign. That breaks no rule, but it shows the selection logic and the guide's model disagree about what matters most on the day.

### P5. Scorpio weekly

Record: `records/pages/horoscopes__scorpio__weekly.txt`, lines 9 to 20. 239 words in five sections. Template: `src/lib/horoscope-program.ts`, lines 1217 to 1250 and 358 to 369.

| Rule | Score | Reason | Fix |
|---|---|---|---|
| R1 | Partial | Advice is first, but it does not work on its own: "Follow the consequential thread without turning every silence into evidence." | S4 |
| R2 | Fail | "At the exact contact, compare the move you intended with the one you are actually making." Nothing says what the contact is. "The New Moon in Scorpio brings your identity … into focus" has no gloss either. | S2, S8 |
| R3 | Fail | Ends: "the final review is to ask what is known before assigning meaning to what is concealed." Nothing about next week. | S1 |
| R4 | Partial | Four of five facts check: Moon 19.5° Scorpio on 9 November, 25.8° Sagittarius on 12 November, 1.3° Aquarius on 15 November (all noon UTC), new Moon at 16.9° Scorpio on 9 November at 07:02 UTC. The fifth does not: the page labels 15 November "First Quarter". At noon UTC that day the Moon is 68.1° from the Sun and 31% lit; first quarter is 17 November at 11:48 UTC. The site's own rule on `main` (`src/lib/engine/lite.ts`, lines 65 to 80: a quarter only within 12° of 90°) names that angle Waxing Crescent. The label comes from the committed program data (`src/data/horoscope-program.json`, `"moonPhase": "First Quarter"` on the `daily-snapshot:2026-11-15:1200z` receipt). | S8 |
| R5, R6 | n/a | Not a daily reading. | |
| R7 | Partial | "The New Moon in Scorpio brings … into focus" is stated as fact; the footer carries the interpretation line. | S5 |
| R8 | Partial | One good step ("put a number beside the cost, the available capacity, and the value you expect in return"); the rest are abstract. | S4 |
| R9 | Fail | Template seams show: "Give identity and first moves the first concrete move instead of asking one choice to settle all three areas at once." "…then before agreeing to another plan, check what you need at home and make time for it." | S4 |
| R13 | Partial | As the dailies. Also the "turning point" section is dated 9 November but sits after "Midweek", so the week reads out of order. | S4, S8 |
| H3 | Partial | As the dailies. | S7 |
| R10, R11, R12, H1, H2 | Pass | Money appears as a life area only. No degrees in the body. No dashes. | |

### P6. Escorpio daily (Spanish)

Record: `records/pages/es__horoscopes__scorpio.txt`, lines 11 to 21. 65 words. Template: `src/lib/i18n/daily-reading.ts` (note stems at lines 38 to 41).

> La Luna pasa hoy por tu segunda casa: el dinero, las posesiones y lo que te da estabilidad.
> Mercurio activa tu primera casa: tu imagen, tus comienzos y la impresión que causas.
> Venus aporta calidez a tu duodécima casa: el descanso, el retiro y lo que ocurre bajo la superficie.
> Marte impulsa tu décima casa: la carrera, la reputación y lo que ve el público.

| Rule | Score | Reason | Fix |
|---|---|---|---|
| R1 | Fail | Opens with a sky position. There is no advice anywhere in the reading. | S9 |
| R2 | Partial | Each house is glossed in plain words, which is good. The planets are not, and the page's deck leads with "casas solares … y sus comprobantes". | S9, S2 |
| R3 | Fail | No closing line. | S9, S1 |
| R4 | Pass, checked | Moon 13.8° Sagittarius, Mercury 5.5° Scorpio retrograde, Venus 23.0° Libra retrograde, Mars 23.7° Leo, and houses 2, 1, 12 and 10 counted from Scorpio. | |
| R5 | Fail | No hook, no try-it, no come-back. Four "why" lines only. | S9 |
| R6 | Fail | 65 words. | S9 |
| R7 | Partial | "Mercurio activa tu primera casa" is stated as fact; the line below says it is an interpretation. | S5, S9 |
| R8 | n/a | No action is offered. The miss is counted under R1 and R5. | |
| R12 | Partial | Four house placements in a row, then "Luna 13.8° Sagitario · casa 2" and "℞" directly under them. Each house is explained once. | S9 |
| R13 | Partial | Plain, but curt: four position lines and nothing to do with them. | S9 |
| H3 | n/a | No forecast or advice is stated. | |
| R9, R10, R11, H1, H2 | Pass | Short sentences. "El dinero" as a life area only. No dashes. | |

Parity with P3: the English Scorpio reading for the same day draws on the Moon and Saturn, has advice and is 98 words. The Spanish one draws on the Moon, Mercury, Venus and Mars, has none and is 65. ZOD-46 lists "the translated pages" as a surface, but this page is a separate, thinner reading, so fixing the English template will not reach it.

### P7. /today/

Record: `records/pages/today.txt`. Template: `src/pages/today/index.astro`; the sign notes come from `src/lib/daily-publication.ts`.

| Rule | Score | Reason | Fix |
|---|---|---|---|
| R1 | Fail | The page opens "Where every planet is, what each placement traditionally stands for, and what comes next on the calendar", then a strip reading "Sun 19°06′ Scorpio · Moon in Sagittarius · Mercury retrograde · Venus, Saturn, Uranus, Neptune retrograde". No sentence tells the reader what to do or notice. The page says so itself: "Themes to notice, not instructions" and "not advice". | S10 |
| R2 | Partial | The page explains more than any other item: "What retrograde means", "Aspects are the angles between planets", and a plain gloss per planet ("Mercury: Thinking and communication"). But the explanations come long after first use. "Rx", "Mercury retrograde", "Fixed water", "Mutable fire", "stations direct" and "9th house" all appear bare first. | S10 |
| R3 | Partial | "Coming up in the sky" is a real, dated reason to return (Mercury stations direct on 13 November, and so on). It is a table in sky terms, not a line for the reader, and the page does not end on it. | S10 |
| R4 | Pass, checked | All ten noon positions match to the arcminute. Moon 5% lit and 2.2 days past new. The four aspect orbs. The retrograde table. The eleven "coming up" events are on the right dates. Their clock times are the repo's NASA Horizons instants, which the pages print by design and which sit up to eight minutes from the engine's (see section 5 and Dias call 3). Not checked: "Seven are within three degrees of exact", and the retrograde start dates before October 2026. | |
| R5, R6 | n/a | A sky page, not a daily reading. | |
| R8 | n/a | No action is offered; counted under R1. | |
| R9 | Partial | The prose is short and clear. The page is dense with arcminutes and "Rx". | S10 |
| R12 | Partial | The top strip and the sign tiles stack degrees, "Rx" and house numbers ("Aries 9th house") before any explanation. The aspects section explains each aspect well. | S10 |
| R13 | Partial | Exact and calm, but it reads as a data desk. System wording reaches the reader in the served HTML: "Your saved-chart comparison is temporarily unavailable. Your Sun-sign baseline is ready below.", twelve "Sun-sign baseline" blocks, and "The November 11, 2026 edition may draw more attention to …". | S10, S3 |
| H1 | Partial | The Cancer note: "daily work, health routines, and responsibilities". Same phrase as P3. | S6 |
| H3 | Partial | "Today may draw more attention to …" is a soft forecast with no label. Same open question as the dailies. | S7 |
| R7 | Pass | The model for this rule: "what their signs have traditionally stood for", "Astrologers have long read these stretches as a time for review", "read as an opportunity". | |
| R10, R11, H2 | Pass | Money and health appear as life areas only. No dashes. | |

### P8. Birthday page, 12 November

Record: `records/pages/birthday__november-12.txt`. Copy: `src/content/birthdays/november-12.mdx`.

| Rule | Score | Reason | Fix |
|---|---|---|---|
| R1 | Fail | Opens: "November 12 straddles the line between Scorpio's Jupiter and Moon decans." A sky term in the first sentence and no advice. | S11 |
| R2 | Fail | "Decans" is used three times before the body gives a plain version ("Scorpio's middle stretch … and its final stretch"). "Not a cusp date", "the Ascendant", "houses, and aspects" and "noon universal time" are not explained. | S11 |
| R3 | Fail | No closing line. The nearest thing is "Around each birthday the Sun comes back to the degree it held when you were born", which is real sky but points nowhere. See Dias call 2 on how this rule should read for a timeless page. | S11 |
| R4 | Pass, checked | Sun between 19°13′ and 20°37′ Scorpio at noon UTC on 12 November across 1940 to 2030, at least 9.3° inside the sign, and 20°06′ in 2026 with the Moon in Sagittarius: all recomputed. The two named birthdays are not sky facts and were not checked against a source here. | |
| R5, R6 | n/a | Not a daily reading. | |
| R7 | Fail | Claims about people are stated as findings: "Most people born on this date report both channels open at once", "Partners of a November 12 usually receive fluent stretches of both". Nothing supports them, and "astrologers read" is absent from the body. The same "Most people born on this date" wording is in two birthday files. | S11 |
| R8 | Partial | One action, and it is a lifelong one: "saying the thing while it is still a feeling and not yet a ruling". | S11 |
| R9 | Fail | "a judge's mind sharing quarters with a tide table"; "The Jupiter side files feelings as positions; the Moon side files them as weather; either way, the person across the table hears the conclusion weeks after the event." | S11 |
| R12 | Partial | The facts block is careful ("only the degree shifts a little"), but decans and degrees arrive together at the top. | S11 |
| R13 | Partial | Warm, which most items are not, but it leans literary and vague: "The water is equally deep on both shores". | S11 |
| H3 | n/a | "This line is offered for reflection, not as a forecast." | |
| R10, R11, H1, H2 | Pass | "medicine" appears as an example of a job, not a health claim. No dashes. | |

### P9. Your 2027 sky (the shared part)

Record: `records/pages/your-2027-sky.txt`. Copy: `src/lib/year-sky/copy.ts`.

| Rule | Score | Reason | Fix |
|---|---|---|---|
| R1 | Partial | Each entry does what the guide asks, plain meaning first and dates second: "Plans, messages and travel want a second look. Finish, review and repair before you launch." then "February 9 to March 3, in Pisces and Aquarius." The page itself opens by describing the tool. | S12 |
| R2 | Partial | Eclipses are explained well ("A new Moon with extra weight", "penumbral, faint to the eye", "total: the Moon covers the whole Sun"). "Retrograde", "The shadow runs …", "annular" and "solar return" never are. | S12, S2 |
| R3 | Partial | The whole page is forward dates, but nothing tells the reader when to come back; it ends on a link list. | S12 |
| R4 | Pass for what was checked | Checked and correct: where the slow planets spend 2027, Jupiter into Virgo on 26 July, every retrograde start and end date in 2027 and the signs named, the five eclipses with their dates, types and degrees. Not checked: every "shadow runs" range, the Uranus start on 10 September 2026 and end on 12 February 2028, "Jupiter stays in Virgo until August 24, 2028", and the penumbral magnitude 0.0014, which the page credits to NASA. | |
| R5, R6 | n/a | Not a daily reading. | |
| R7 | Partial | Eclipses pass ("Astrologers read solar eclipses as beginnings …"). Retrogrades are stated as fact: "Growth slows down to be checked.", "Energy turns inward.", "The fog lifts a little." | S5, S12 |
| R8 | Partial | Mercury and Mars carry an action; the other entries carry none. | S12 |
| R10 | Partial | "Quiet work on foundations pays off later." is a promised outcome, small as it is. | S12 |
| R12 | Partial | "at 17° Aquarius" on each eclipse and "The shadow runs" on each retrograde, unexplained. | S12 |
| H3 | Partial | Forecast lines with no label on the shared part. Same open question as the dailies. | S7 |
| R9, R11, R13, H1, H2 | Pass | The closest item to the guide's voice in the sample: short, plain, dry and kind. No dashes. | |

Also noted: the dates carry no time zone on the page. The 20 February eclipse peaks at 23:12 UTC, so it falls on 21 February in Asia.

### X1. get_horoscope, Leo, day

Record: `records/connector/c1-get_horoscope-leo-day.response.json`. 91 words. Same program as P1 to P4, served for the caller's date (12 November in Bangkok).

| Rule | Score | Reason | Fix |
|---|---|---|---|
| R1 | Pass | "Today, give play, romance, or creative work a defined place." | |
| R2 | Fail | "The waxing crescent Moon", "Mercury retrograde in Scorpio" with no gloss. The `why.note` does explain solar houses. | S2 |
| R3 | Fail | No closing line. The last reader-facing text is the disclosure, which ends with a routing note meant for the assistant: "For a month, a year, or a love or career week, use get_horoscope_period." | S1, S14 |
| R4 | Pass, checked | "Moon at 25° Sagittarius" and "Mercury at 5° Scorpio" at 7:00 pm Bangkok on 12 November (noon UTC): 25.81° and 5.16°, printed as whole degrees. | |
| R5 | Partial | As P1 to P4: no plain "why", no come-back. | S1, S4 |
| R7 | Partial | As P1 to P4. The `why.note` is good: "These are sky positions we calculate. What they mean is astrological interpretation." | S5 |
| R9 | Fail | "For Leo, presence is strongest when the point is clearer than the performance." "…choose the contribution you would still value without applause." | S4 |
| R13 | Partial | As P1 to P4. | S4 |
| R6, R8, R10, R11, R12, H1, H2, H3 | Pass | "check what you need at home and make time for it" is small and doable. "Reading confidence 40%" is present. | |

### X2. get_horoscope, week, with a birth date and no sign

Record: `records/connector/c2-get_horoscope-personal-week.response.json`. The tool returns `status: choose-sign` and five personal lines. Line builder: `src/lib/transits.ts`, lines 25 to 53; assembly in `src/ai-tools/features/personal-week.ts`.

| Rule | Score | Reason | Fix |
|---|---|---|---|
| R1 | Fail | Five lines, each opening with a planet: "Sun opens a door for your sense of duty: …". No sentence of advice leads them, and the tool tells the assistant to "lead with those personal lines". | S13 |
| R2 | Partial | Each line glosses its aspect with a plain verb ("opens a door for", "flows through", "pushes against") and each natal planet with a plain phrase ("your sense of duty"). The titles still say "sextile", "trine" and "square" bare. | S13 |
| R3 | Partial | Each line has a real date ("From Sat 14 Nov · exact on Tue 17 Nov"). No line says what to watch for next. | S13 |
| R4 | Pass, checked | Sun sextile natal Saturn exact on 17 November; Mercury trine natal Jupiter on 18 November 23:55 UTC; Saturn square natal Uranus (0.74°), Saturn square natal Jupiter (1.32°) and Venus square natal Saturn (2.35°) all in orb this week. | |
| R5, R6 | n/a | Not a daily Sun-sign reading. | |
| R7 | Partial | The lines state outcomes: "help that arrives without being asked", "friction that will not resolve on its own". The note under them says "astrology's forecast for your week, not a guarantee". | S13 |
| R8 | n/a | No action is offered; counted under R1. | |
| R9 | Partial | The joins do not always make sense: "Venus pushes against your sense of duty: a soft stretch of warmth and appetite, friction that will not resolve on its own." | S13 |
| R10 | Partial | "an opening that rewards you if you take it" and "help that arrives without being asked" promise an outcome. | S13 |
| R11 | Partial | "a long season of pressure and accounting, friction that will not resolve on its own" appears twice in five lines. It is not "beware", but it is close to doom and offers nothing to do. | S13 |
| R12 | Partial | Aspect names in every title. | S13 |
| R13 | Partial | Curt and repetitive: three of five lines end on the same clause. | S13 |
| H3 | Partial | Two figures in one result. The personal note says "Reading confidence 55%". The disclosure says "Reading confidence 40%", which belongs to the Sun-sign reading, and no Sun-sign reading was returned. | S14 |
| H1, H2 | Pass | | |

### X3. get_sky

Record: `records/connector/c3-get_sky.response.json`. Not a reading: positions, the Moon's phase and "Astronomical calculations; no personal prediction is supplied."

| Rule | Score | Reason | Fix |
|---|---|---|---|
| R1 | n/a | The tool is astronomy only by design and gives no advice. | |
| R2 | Partial | "Waxing Crescent" and `"retrograde": true` come with no plain line the assistant could pass on. Whether a reader sees plain words depends wholly on the host model. | S15 |
| R3 | Partial | Nothing says what changes next (the next sign change, phase or station), so the assistant has no real-sky line to close with. | S15 |
| R4 | Pass, checked | All ten positions at 18:17:55.962 UTC match an independent run to 0.001°. Phase angle 27.63°, lit 5.7%. | |
| R12 | Fail | The text handed to the assistant is about 6 KB, most of it receipt: longitudes to 15 decimals, `deltaT`, `sigma`, `ut1MinusUtc`, some 20 convention ids and a digest. The server instructions ask the model to keep these back unless asked, so the plain reading rests on the model obeying. | S15 |
| R5, R6, R8, R9, R13, H3 | n/a | No prose, no action, no forecast. | |
| R7, R10, R11, H1, H2 | Pass | | |

### X4. get_compatibility

Record: `records/connector/c4-get_compatibility.response.json`. Gloss table: `src/lib/compat.ts`, lines 179 to 183.

| Rule | Score | Reason | Fix |
|---|---|---|---|
| R1 | Pass | Leads with what to notice: "Attraction is the strongest part of this pairing; communication will take the most work." It offers nothing to do, which the rule allows. | |
| R2 | Partial | Every contact line is in plain words ("Person A's appetite for more flows with Person B's way of loving"). The `aspect` and `orb` fields, "generational" and the label "Crosswind" are not explained, though "Crosswind" has a note. | S17 |
| R3 | Fail | No closing line. See Dias call 2. | S17 |
| R4 | Pass, checked | Both Sun signs and all eight orbs recomputed (0.5°, 0.8°, 1.0°, 1.1°, 1.2°, 1.4°, 1.6°, 2.5°). The counts (29 contacts) and the scores are not checked; the scores are a formula, not a sky fact. | |
| R5, R6 | n/a | Not a daily reading. | |
| R7 | Partial | "This flows naturally and brings out the best in you both." "Expect friction here, especially under stress." Stated as fact, with one note at the end: "Astrology's reading of your two charts, for insight and fun, not a guarantee". | S17 |
| R8 | n/a | No action is offered. | |
| R12 | Partial | Aspect type and orb on every contact; the same gloss sentence three times in eight lines. | S17 |
| R13 | Partial | Plain and fairly warm; formulaic. | S17 |
| R9, R10, R11, H1, H2, H3 | Pass | "Reading confidence 60%" is present, in the headline and in the notes. | |

### X5. get_personal_transits

Record: `records/connector/c5b-get_personal_transits-window.response.json`. Nine dated lines from the same builder as X2.

| Rule | Score | Reason | Fix |
|---|---|---|---|
| R1 | Fail | A list of nine lines, each opening with a planet. No lead sentence. | S13 |
| R2 | Partial | As X2. | S13 |
| R3 | Partial | Every line is a future date from the real sky, which is the point of the tool. The result ends on a disclaimer, not on what comes next. | S13 |
| R4 | Pass, checked | All nine exact times recomputed to the minute, and the Madrid dates follow from them (18 November 23:55 UTC is shown as Thursday 19 November). | |
| R5, R6, R8 | n/a | Not a daily reading; no action offered. | |
| R7 | Partial | As X2. The closing note is good: "not a guarantee, and not a forecast of health or money". | S13 |
| R9 | Partial | Six of nine lines share "a busy stretch for messages and errands"; the Venus line has the same contradiction as in X2. | S13 |
| R10 | Partial | "help that arrives without being asked", "an opening that rewards you if you take it". | S13 |
| R11 | Partial | "friction that will not resolve on its own", once. | S13 |
| R12 | Partial | Aspect names in titles, `pass 3 of 3`, `exactUtc`. | S13 |
| R13 | Partial | Curt and repetitive. | S13 |
| H1, H2, H3 | Pass | Each line carries "Reading confidence 60%". | |

### X6. get_horoscope_period, Pisces, November 2026

Record: `records/connector/c6-get_horoscope_period-pisces-month.response.json`. 337 words. Copy: `src/content/horoscopes/2026-11-pisces.mdx`, written with the prompt in `docs/HOROSCOPE-GENERATION.md`.

| Rule | Score | Reason | Fix |
|---|---|---|---|
| R1 | Fail | Opens with the sky: "Two retrogrades end a day apart this month, Mercury on November 13 and Venus on November 14, and for you they end in adjacent rooms." No advice follows. | S16 |
| R2 | Fail | "retrogrades", "sextiles", "solar eighth house", "stations", "turns direct", "squares", "trines", "your ruler": none explained. | S16 |
| R3 | Fail | Ends: "a plain look at what the work is actually worth." Nothing points to December. | S16 |
| R4 | Partial | Every date and degree in the prose recomputes (16 facts, section 5). But the prose is dated in UTC, and this call asked for New York. The tool's own `sky` list, in the caller's zone, says "Venus turns direct in Libra on Fri 13 Nov"; the prose says "Venus on November 14" and builds its opening on the two ending "a day apart". In New York both end on 13 November. The Sun and Neptune trine is 24 November 00:12 UTC, which is 23 November in New York. | S16 |
| R5, R6, R8 | n/a | Not a daily reading; no action offered. | |
| R7 | Partial | Stated as fact throughout ("the ninth-house question stops circling", "the top of your chart opens for a month"). The disclosure at the end carries the caveat. | S16 |
| R9 | Fail | "On November 24 it trines Neptune at 1.7° Aries, your ruler sitting in your house of earnings, and the full moon at 2.3° Gemini lights your fourth house of home the same day." | S16 |
| R10 | Partial | Money and the body are themes with a forecast attached: "the shared-money conversation resumes a day behind it", "your house of earnings", "the sixth house of work and the body", "what the work is actually worth". No sum or symptom is predicted. | S16 |
| R12 | Fail | Sixteen degrees to a tenth, nine aspect verbs and nine house references in four paragraphs, none explained. This is the pattern the guide names. | S16 |
| R13 | Partial | Exact and dry. Not plain, and not warm. | S16 |
| H1 | Partial | "shared money", "earnings" and "the body". Wording call for Dias, as with "health routines". | S6, S16 |
| R11, H2, H3 | Pass | "Reading confidence 40%" is present. | |

### X7. get_natal_chart

Record: `records/connector/c7-get_natal_chart.response.json`. Copy: `src/lib/natal.ts` and `src/ai-tools/features/natal-chart.ts`.

| Rule | Score | Reason | Fix |
|---|---|---|---|
| R1 | Fail | The first reader-facing text is a character statement: "You are built for consistency: slow to start, nearly impossible to stop". Nothing to do or notice leads the result. | S18 |
| R2 | Partial | Aspects are put in plain words well ("has an open line to", "is fused to", "faces off with"), retrograde gets "a chart that does much of its work on the second pass" and "stellium" is explained in its own sentence. "fixed earth style" and "mutable water style" are not. | S18 |
| R3 | Fail | No closing line. See Dias call 2. | S18 |
| R4 | Partial | All eight placed positions, the four retrograde flags, the eight orbs and "the Moon was in Leo or Virgo" recompute. Two defects. First, the balance lines contradict the unknowns in the same result: "Earth carries 6 of the ten planets" counts the Moon as Virgo and "There is no planet in fire" counts the Moon out of Leo and Venus out of Aries, while the result also says the Moon "was in Leo or Virgo" and Venus is "Pisces or Aries". Second, "Venus changed sign that day" is true only on some clocks: Venus entered Aries at 03:51 UTC on 4 May 1990, so it changed sign on 3 May only for birthplaces about four hours or more west of Greenwich. | S18 |
| R5, R6 | n/a | Not a daily reading. | |
| R7 | Partial | "You are built for consistency" is stated as fact. The closing note is good: "tendencies to reflect on, not a prediction or a fixed destiny". | S18 |
| R9 | Partial | "The self and its narrator share a desk, which makes the account vivid and the distance between you and your own opinions small." | S18 |
| R12 | Partial | Degrees, orbs and "cardinal earth" throughout, and one sign line repeated word for word for three planets. | S18 |
| R13 | Partial | Witty and specific, sometimes obscure: "The chart is load-bearing". | S18 |
| H3 | n/a | No forecast is stated. | |
| R8, R10, R11, H1, H2 | Pass | Two aspect lines carry a small action ("Test a different tool or approach before simply pushing harder."). | |

## 5. Sky facts: what was checked and how

Method: every position, phase, station, ingress, eclipse and aspect the sampled readings assert was recomputed in this job with `astronomy-engine` 2.1.19 (geocentric apparent ecliptic longitude of date), by [checks/sky-check.cjs](checks/sky-check.cjs) and [checks/sky-check-extra.cjs](checks/sky-check-extra.cjs). Outputs: [checks/sky-check-output.txt](checks/sky-check-output.txt), [checks/sky-check-extra-output.txt](checks/sky-check-extra-output.txt). The scripts take the library path as an argument and were run against a copy already installed on this machine.

What kind of check this is: `astronomy-engine` is the ephemeris the site's own engine is built on, so this is an independent run of the site's own calculation with separately written code for stations, ingresses, aspects and phases. It is not a second ephemeris. For the event times `/today/` prints, the comparison is with the repo's `src/data/nasa-event-instants.json`, which holds times solved on NASA JPL Horizons. No fresh Horizons query was made in this job.

| Fact as printed | Where | Recomputed | Result |
|---|---|---|---|
| Sun 19°06′ Scorpio, Moon 13°50′ Sagittarius, Mercury 5°28′ Scorpio Rx, Venus 22°59′ Libra Rx, Mars 23°43′ Leo, Jupiter 25°27′ Leo, Saturn 8°41′ Aries Rx, Uranus 4°16′ Gemini Rx, Neptune 1°53′ Aries Rx, Pluto 3°13′ Aquarius, noon UTC 11 November | P1 to P4, P6, P7 | Same, to the arcminute | Checked, correct |
| Waxing crescent, 5% lit, 2.2 days past new | P1 to P4, P7 | Elongation 24.7°, 4.6% lit, 2.21 days | Checked, correct |
| New Moon 16.9° Scorpio, 9 November 07:02 UTC | P5, P7, X6 | 07:02 UTC, 16°53′ | Checked, correct |
| Moon 19.5° Scorpio (9 Nov), 25.8° Sagittarius (12 Nov), 1.3° Aquarius (15 Nov), noon UTC | P5 | 19.45°, 25.81°, 1.28° | Checked, correct |
| "Nov 15: First Quarter" | P5 | Elongation 68.1°, 31% lit; first quarter 17 November 11:48 UTC | Checked, **wrong label** |
| Mercury stations direct 13 Nov 15:53 UTC, 5°02′ Scorpio | P7, X6 | 15:52 UTC, 5°02′ | Checked, correct (a station is slow; one minute is within method) |
| Venus stations direct 14 Nov 00:27 UTC, 22°51′ Libra | P7 | 00:20 UTC, 22°51′. Repo NASA file: 00:27:28. Connector X6: 00:21:08 | Checked. Page and connector differ by 6 minutes, by design (Dias call 3) |
| Sun enters Sagittarius 22 Nov 07:23; Mars enters Virgo 25 Nov 23:37; Mercury enters Sagittarius 6 Dec 08:33 | P7, X6 | Same | Checked, correct |
| Venus enters Scorpio 4 Dec 08:12 | P7 | 08:14. Repo NASA file: 08:12:42 | Checked, as above |
| Full Moon 24 Nov 14:53, 2°20′ Gemini; new Moon 9 Dec 00:51, 16°56′ Sagittarius | P7, X6 | 14:54, 2°20′; 00:52, 16°57′ | Checked, correct to rounding |
| Uranus trine Pluto 29 Nov 11:22; Saturn direct 10 Dec 23:31; Neptune direct 12 Dec 22:18 | P7 | 11:27; 23:23; 22:13. Repo NASA file: 11:22:49; 23:31:06; 22:18:23 | Checked, as above |
| Retrograde table: Mercury to 13 Nov, Venus to 14 Nov, Mars 10 Jan to 1 Apr 2027, Jupiter 13 Dec to 13 Apr 2027, Saturn to 10 Dec, Uranus to 8 Feb 2027, Neptune to 12 Dec, Pluto ended 16 Oct, Mercury from 24 Oct, Venus from 3 Oct | P7 | Same dates | Checked, correct |
| Retrograde start dates before October 2026 (Saturn 26 Jul, Uranus 10 Sep, Neptune 7 Jul, Pluto 6 May) | P7, P9 | Outside the scan | **Unchecked** |
| Venus sextile Mars 0°43′; Uranus trine Pluto 1°02′; Neptune sextile Pluto 1°20′; Mars conjunction Jupiter 1°44′ from exact | P7 | 0.73°, 1.04°, 1.34°, 1.75° | Checked, correct |
| "Seven are within three degrees of exact" | P7 | Not counted | **Unchecked** |
| Sun at noon UTC on 12 November, 1940 to 2030: 19°13′ to 20°37′ Scorpio; 20°06′ in 2026; at least 9.3° inside the sign | P8 | 19°13′ (1943) to 20°37′ (2028); 20°06′; 9.37° | Checked, correct |
| 2027: Jupiter into Virgo 26 Jul; Mars Rx 10 Jan to 1 Apr (Virgo and Leo); Mercury Rx 9 Feb to 3 Mar, 10 Jun to 4 Jul, 7 Oct to 28 Oct, with signs; Pluto Rx 8 May to 18 Oct; Neptune Rx 9 Jul to 15 Dec; Saturn Rx 9 Aug to 24 Dec; Uranus Rx from 15 Sep; Jupiter direct 13 Apr; Uranus direct 8 Feb | P9 | Same dates and signs | Checked, correct |
| 2027 eclipses: annular solar 6 Feb at 17° Aquarius; penumbral lunar 20 Feb at 1° Virgo; penumbral lunar 18 Jul at 25° Capricorn; total solar 2 Aug at 9° Leo; penumbral lunar 17 Aug at 24° Aquarius | P9 | Same dates, kinds and whole degrees | Checked, correct |
| Every "The shadow runs …" range; Uranus Rx to 12 Feb 2028; Jupiter in Virgo until 24 Aug 2028; NASA penumbral magnitude 0.0014 | P9 | Not recomputed | **Unchecked** |
| Moon at 25° Sagittarius, Mercury at 5° Scorpio, 12 Nov 7:00 pm Bangkok | X1 | 25.81°, 5.16° | Checked, correct (whole degrees, rounded down) |
| Five personal contacts and their dates | X2 | Exact times and orbs as in section 4 | Checked, correct |
| Ten positions at 18:17:55.962 UTC; phase angle 27.63°; lit 5.7% | X3 | Same to 0.001° | Checked, correct |
| Sun signs and eight contact orbs for the invented pair | X4 | Same to 0.1° | Checked, correct |
| Nine dated contacts, 12 to 25 November | X5 | Same to the minute | Checked, correct |
| Sixteen dated events with degrees in the monthly prose (4, 9, 13, 14, 16, 18, 22, 24, 25, 28, 29 and 30 November) | X6 | All dates (UTC) and degrees | Checked, correct in UTC; **two dates wrong for the zone asked for** |
| Eight positions, four retrograde flags, eight orbs, Moon "Leo or Virgo" | X7 | Same; Moon entered Virgo 3 May 1990 07:17 UTC | Checked, correct |
| "Venus changed sign that day" | X7 | Venus entered Aries 4 May 1990 03:51 UTC | Checked, **true only west of about UTC−4** |
| "Earth carries 6 of the ten planets", "There is no planet in fire" | X7 | Holds only if the Moon is in Virgo and Venus in Pisces, which the same result says is unknown | Checked, **contradicts the result's own unknowns** |
| Two named people's birthdays | P8 | Not a sky fact | **Unchecked** |

## 6. Suggested fixes, at the source

Suggestions only, for ZOD-48. None is applied on this branch. Each names the file where the wording is made, so one change reaches every reading of that kind. Line numbers are on `origin/main` at `7c7b2d16`.

| Id | Source | Suggested change | Fixes |
|---|---|---|---|
| S1 | `src/lib/horoscope-program.ts`, daily builder (about lines 1009 to 1090) and weekly close (line 1250) | Add a closing section built from the event catalog the program already holds: the next Moon sign change, phase, station or sign change inside seven days, said in plain words ("The Moon is half lit on Tuesday. Come back then."). Make the verifier fail a daily or weekly reading without one. The connector reads the same program, so X1 follows. | R3 and R5 on P1 to P5, X1 |
| S2 | One shared gloss table (a new lexicon beside `HOUSE_THEME`; `/today/` already has a plain phrase per planet) used by `horoscope-program.ts` lines 1024, 1028 and 1086 | First mention of a planet, a phase or "retrograde" in a reading carries its gloss: "Mercury, the planet of talking and planning, appears to move backward". A term with no gloss in the table cannot be printed. | R2 on P1 to P6, P9, X1 |
| S3 | `src/lib/edition-freshness.ts`, line 54 (`Today,` becomes `For the {date} edition,`) | Keep the verb first in the dated form, for example move the date to the page label that already shows it and drop the clause from the sentence. Line 55 gives "The {date} edition may draw more attention to" on `/today/`; same change. | R1 on P1 to P4, R13 on P7 |
| S4 | `src/lib/horoscope-program.ts`: `SIGN_REGISTER`, the sign `profile.daily` lines, `HOUSE_ACTION`, `HOUSE_DECISION`, and the third "Connect X with Y; …" section | Rewrite the tables to one concrete step each, in sentences of about 15 words or fewer, with no semicolons and no lists of four abstract nouns. Replace the third section with the guide's "Try it" and let S1 add "Come back". Stop the similar-reading separator from appending a clause that the third section then repeats (P4). | R1, R5, R6, R8, R9, R13 on P1 to P5, X1 |
| S5 | The sentence frames in `horoscope-program.ts` ("The {phase} puts {theme} on the day's agenda") and `src/lib/year-sky/copy.ts` | Say who reads it: "Astrologers read {gloss} as a day for {theme}". The second section's "In this reading," already does this; use one frame for all. | R7 on P1 to P6, P9, X1 |
| S6 | `src/lib/daily.ts`, line 142 (`HOUSE_THEME[6]`: "daily work, health routines, and responsibilities"), and the matching glossary entry | Owner wording call: "daily work, habits, and responsibilities" would drop the word. The same call covers "shared money", "earnings" and "the body" in monthly prose. | H1 on P3, P7, X6 |
| S7 | The reading footer on horoscope pages ("Written for {sign} as a Sun sign …"), `/today/` sign notes, `src/lib/year-sky/copy.ts`; label from `src/ai-tools/reading-confidence.ts` | Decide once whether a Sun-sign page reading is a forecast. If yes, the page footer prints the same label the connector prints for the same reading. If no, write that down beside the `AGENTS.md` rule so the pages and the connector stop disagreeing. | H3 on P1 to P5, P7, P9 |
| S8 | `src/data/horoscope-program.json` (from `scripts/build-horoscope-program.ts`) and `horoscope-program.ts` lines 358 to 369 | Name every stored `moonPhase` through `moonPhaseNameFromAngle` in `src/lib/engine/lite.ts` and add a verifier check that a stored name matches it. Replace "At the exact contact" with the event's plain name and date ("When the Moon is new on Monday"), and order the weekly sections by date. | R4, R2, R13 on P5 |
| S9 | `src/lib/i18n/daily-reading.ts` | Give the localized daily the guide's shape: one advice line first (from the Moon's house), the house notes as the "why", one small step, one closing line. Or translate the English program. Either way, pick the planets by the same rule as the English reading so the two agree. | R1, R2, R3, R5, R6, R7, R12, R13 on P6 |
| S10 | `src/pages/today/index.astro` and the sign notes in `src/lib/daily-publication.ts` | Put one plain sentence above the strip, drawn from the day's own facts (the Moon's sign and phase and the nearest station). Gloss "retrograde" where it first appears, or link the strip to "What retrograde means". Close "Coming up in the sky" with one plain line about the nearest event. Keep fallback wording ("Sun-sign baseline", "temporarily unavailable") out of the served HTML. | R1, R2, R3, R9, R12, R13 on P7 |
| S11 | The brief or prompt used to write `src/content/birthdays/*.mdx`, the page template's hero line, and `scripts/independent-copy-verifier.ts` | Brief: open with one thing to notice, gloss "decan" and "cusp" where they first appear, sentences a 12-year-old could follow, and one closing line tied to the sky (see Dias call 2). Verifier: reject unsourced population claims such as "Most people born on this date report". Overlaps ZOD-24. | R1, R2, R3, R7, R8, R9, R12, R13 on P8 |
| S12 | `src/lib/year-sky/copy.ts` | One plain line each for "retrograde" and "shadow" at the top of the section. "pays off later" becomes something read, not promised. One action per entry, as Mercury and Mars already have. A closing line naming the first event ahead. State the time zone of the dates. | R1, R2, R3, R7, R8, R10, R12 on P9 |
| S13 | `src/lib/transits.ts`, lines 25 to 53 (planet phrase joined to aspect gloss), and `src/ai-tools/features/personal-week.ts` | Glosses that predict ("help that arrives without being asked", "an opening that rewards you if you take it", "friction that will not resolve on its own") become what astrologers read plus one small step. Block joins that contradict (a soft planet phrase with a hard aspect gloss). Add a lead advice sentence and a closing "next" line to the personal week and the transit list. Put the plain gloss in the title. | R1, R2, R3, R7, R9, R10, R11, R12, R13 on X2, X5 |
| S14 | The `get_horoscope` result builder in `src/ai-tools/` | When no Sun-sign reading is returned, do not print its confidence figure. Move the routing note ("use get_horoscope_period") out of the reader-facing disclosure. This changes output, not a published tool definition, but check `release-060.test.ts` first. | H3 on X2, R3 on X1 |
| S15 | The `get_sky` result builder in `src/ai-tools/` | Add a short plain summary and a `next` event the assistant can close with, and keep the receipt out of the text block unless asked. Owner check needed: the published tool definitions must stay byte-identical. | R2, R3, R12 on X3 |
| S16 | The drafting prompt in `docs/HOROSCOPE-GENERATION.md`, and `src/ai-tools/features/horoscope-period.ts` | Prompt: open with advice, gloss each term at first use, at most a few degrees per reading, say what astrologers read, end with a line about next month's first event, no money or body forecasts. The current prompt asks for the opposite on degrees ("degree when the JSON provides one") and for matching the existing month. Tool: say that the prose is dated in UTC, or stop pairing UTC-dated prose with zone-dated `sky` lines. | R1, R2, R3, R4, R7, R9, R10, R12, R13, H1 on X6 |
| S17 | `src/lib/compat.ts`, lines 179 to 183, and the `get_compatibility` result builder | Vary the aspect glosses or group contacts that share one. Frame them as what astrologers read. Add one small step and a closing line (see Dias call 2). | R2, R3, R7, R12, R13 on X4 |
| S18 | `src/lib/natal.ts` (balance lines near line 202) and `src/ai-tools/features/natal-chart.ts` (unknowns near lines 298 to 330) | Leave a body out of the element and mode counts when its sign is unknown, or say "at midday". Do not print "no planet in {element}" when an unknown body could be in it. Say "may have changed sign that day, depending on where you were born" when no zone is given. Lead with one thing to notice, and do not repeat one sign line for several planets. | R1, R2, R3, R4, R7, R9, R12, R13 on X7 |

## 7. For Dias

1. **Not every surface on ZOD-46 could be read.** Year Ahead Score, tarot and the birthday report are not live as pages, and the Astrologer bot was outside this job's reach. The sample says nothing about them.
2. **How should "a reason to come back" read on a timeless page?** The guide's rule 3 says "tomorrow or later this week". A birthday page, a birth chart and a compatibility result have no tomorrow. They are scored fail here because they have no closing line at all, but the guide does not say what the line should be for them.
3. **Which times are "our own calculations"?** Pages print event times solved on NASA JPL Horizons; the connector prints the engine's times. For Venus turning direct this week the two are six minutes apart (00:27 and 00:21 UTC on 14 November). Both are deliberate and documented in `CLAUDE.md`, and both are scored pass. The guide's rule could be read either way.
4. **Is a Sun-sign page reading a forecast?** The connector labels the daily reading "Reading confidence 40%"; the page that prints the same reading has no label (S7).
5. **"health routines", "shared money", "the body".** Life-area wording, not predictions. Scored partial under the `AGENTS.md` rule because the issue asks for no health wording (S6).
6. **The Spanish daily is not a translation** of the English one (P6, S9). Fixing the English template will not change it.
7. **The guide's example and the live selection disagree.** For Scorpio on 11 November the guide builds on Mercury moving backward through Scorpio; the live reading never mentions it.
8. **Three defects that are not style:** the early "First Quarter" label (S8), the monthly reading's dates for a zone west of UTC (S16), and the birth chart's fire and earth counts against its own unknowns (S18). They may deserve their own issues.

## 8. Limits of this run

- One moment, one edition: 2026-11-11 UTC. A different day could score differently on R8 and R9, which depend on which table rows the day draws.
- Server text only. No browser was run, so wording that changes in the browser (the "Today," opener, the personal parts of `/today/` and `/your-2027-sky/`) was not captured.
- One reader scored it. R9 and R13 are judgments; the quotes are given so they can be argued with.
- The sky check is an independent run on the same ephemeris the site uses, not a second ephemeris.
- Spanish was read by the scorer, not by a native reviewer.

## 9. The tests on ZOD-107

| Test | Result |
|---|---|
| G1 Sample and method | Met: 4 live dailies of different signs, 1 weekly, 1 Spanish daily, `/today/`, 2 live feature readings, 7 connector outputs including `get_horoscope` twice. Method and reasons in section 2, gaps named. |
| G2 Every reading, every rule | Met: 16 readings by 16 rules in section 3, reasons in section 4. The guide opened, so no rule of it is skipped. |
| G3 Suggestions at the source | Met: every partial and fail in section 4 names a fix in section 6, and each fix is a template, table, builder or prompt. |
| G4 Sky facts | Met: section 5 lists each asserted fact as checked or unchecked. |
| G5 Nothing published | Met: this branch adds only this folder. No copy, template or prompt is changed. Nothing merged. No weekly editor. No engine branch touched. |
