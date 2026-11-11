# DRAFT plain-words tool descriptions. Not published.

**Status: draft for review (ZOD-108). No published tool definition was
changed.** `src/ai-tools/` is untouched on this branch, and the 13 published
definitions stay byte-identical as the house rules require. Nothing here was
sent to a directory. These texts are also not the texts of site draft pull
request 971 (ZOD-58), which this job did not edit or merge.

## What this file is

One description for each tool the live connector lists. The set is what
`tools/list` returned from `https://zodiacs.org/mcp` on 2026-11-11 at 18:16
UTC: server `zodiacs` 0.6.6, 19 tools. `[L-INIT]` `[L-TOOLS]`

Each description has three parts and nothing else:

- **What it does.** What the tool returns.
- **When it fits.** The kind of question it answers.
- **Limits.** What it refuses, leaves out or cannot check.

## The rule these drafts follow

The ZOD-99 dry run failed the live descriptions because they tell the
assistant how to behave. `[J3-REPORT]` (D1) The rule it applied is
Anthropic's connector checklist: "Describe what the tool does, and don't
tell Claude how to behave." `[J3-RULES]` One description (`get_horoscope`)
broke a named rejection rule with "If you can schedule tasks for the person,
offer once, briefly, to send them their horoscope every morning"; the dry
run flagged thirteen more for sentences such as "lead with the score",
"Share the forecast plainly and confidently", "give them the returned
shareUrl exactly", "never make one up" and "do not ask for birth details
first". `[J3-REPORT]` (D1 table; the second session counted fourteen flags,
`[J3-BREAKER]` S3)

So in the drafts below:

- No sentence tells the assistant to do, say, offer, lead with, share,
  present, decline, ask or avoid anything.
- Every sentence states a fact about the tool: what goes in, what comes
  back, what is refused.
- Limits that the dry run found missing are stated: the refusal of a birth
  date less than 13 years ago, and the under-18 rules where the server
  enforces them. `[J3-REPORT]` (D1 item 3, D4)

Bracketed keys are citations for the reviewing session (`SOURCES.md`). They
are not part of the description text.

## Two facts the drafts cannot paper over

1. **`get_horoscope` and under 18.** On 11 November 2026 the live server
   returned a full love reading for synthetic birth dates aged 15 and 17,
   beside a note saying such readings "are left out". `[J3-REPORT]` (D2,
   calls 40 and 41) A general request for the same birth date also carried
   love readings in the panel data. `[J3-BREAKER]` (S2) The fix is site draft
   pull request 970, unmerged. `[J3-REPORT]` (D7) The draft below therefore
   does **not** say that love readings are left out under 18. That sentence
   becomes true only when 970 is live; it is given in a note for then.
2. **Times of slow planets' sign changes.** `check_sky_fact` gave Neptune
   entering Aries at 2026-01-26 14:31:41 UTC, and the live methodology page
   gives 17:35 UTC from NASA JPL Horizons. `[J3-REPORT]` (other findings,
   item 2) `[L-METH]` (line 47) Job 2 measured the same gap, 3.06 hours.
   `[J2-SIGN]` (line 25) The tools that print these times carry that limit
   below. The fix is site draft pull request 975, unmerged. `[J3-REPORT]`

## Shared limits

These hold for more than one tool and are stated once here and named in each
tool they apply to.

- **Under 13.** Each of the eight tools that take a birth date refuses one
  less than 13 years ago, with the message "Zodiacs is not directed at
  children under 13, so it makes no card, chart or reading from a birth date
  less than 13 years ago, or a birthday card for a day in those years."
  `[J3-REPORT]` (D4, calls 50 to 60) The eight are `get_horoscope`,
  `get_life_milestones`, `get_compatibility`, `find_chart_twins`,
  `get_birthday`, `get_natal_chart`, `get_chinese_zodiac` and
  `get_personal_transits`. `[L-TOOLS]` (the tools with a `birthDate` field,
  or a birth date inside `a` and `b`)
- **Dates.** The sky tools cover 1800-01-01 to 2199-12-31. `[L-CAPS]`
  (`limits.from`, `limits.to`)
- **Kind of astrology.** Positions are tropical and geocentric. `[L-CAPS]`
  (`conventions.zodiac`, `limitations[0]`)
- **Storage.** The server's instructions and the privacy policy say birth
  details are used for the answer and not stored or logged. `[L-INIT]`
  `[L-PRIV]` This was not verified from inside the server. `[J3-REPORT]`
  (D3)
- **All tools are read-only.** Each declares `readOnlyHint: true`.
  `[L-TOOLS]`

---

## The 19 tools

### 1. `get_capabilities` (What Zodiacs can do)

- **What it does.** Returns a list of what the connector can do, its limits
  and how it handles privacy. It takes no input and needs no sign-in or
  birth details. `[L-TOOLS]`
- **When it fits.** A question about what Zodiacs can do, or about its
  limits. `[L-TOOLS]`
- **Limits.** It describes the service and calculates nothing. Zodiacs does
  not schedule anything, pick stocks or investments, make health predictions
  or guarantee outcomes. `[L-TOOLS]` Its `tools` field lists 13 of the 19
  tools; the other six are named in its `coverage` and `limitations` text.
  `[L-CAPS]`
- **Live wording left out.** "so do not call it to check before turning
  those requests down". `[J3-REPORT]` (D1, row 1)

### 2. `get_sky` (Sky right now)

- **What it does.** Returns where the Sun, the Moon and the planets are now
  or at a given moment, with the Moon's phase. `[L-TOOLS]`
- **When it fits.** A question about the sky at one moment, with no person's
  chart involved. `[L-TOOLS]`
- **Limits.** Astronomy only; it makes no personal prediction. `[L-TOOLS]`
  Moments from 1800 to 2199. `[L-CAPS]` It takes an optional time zone, and
  without one its times are in UTC. `[L-TOOLS]` (`zone`) It gives positions
  for a moment and no houses or rising sign. `[J3-REPORT]` (D4, call 67)

### 3. `get_upcoming_events` (Sky calendar)

- **What it does.** Lists changes in the sky over a window of up to 92 days:
  planets changing sign, planets turning retrograde or direct, and new and
  full Moons. With no input it covers the next seven days. `[L-TOOLS]`
- **When it fits.** A question about what is coming up in the sky over the
  next days or weeks. `[L-TOOLS]`
- **Limits.** It does not list eclipses or every aspect. `[L-TOOLS]` The
  window is at most 92 days, within 1800 to 2199. `[L-CAPS]` Without a time
  zone its times are in UTC. `[L-TOOLS]` Its times for a slow planet's sign
  change come from the engine and can differ from NASA JPL Horizons by
  hours: for Neptune entering Aries on 26 January 2026 the tool gives
  14:31:41 UTC and Horizons gives 17:35 UTC. `[J2-ACC]` (A10) `[J2-SIGN]`
  (line 25) `[L-METH]` (line 47)

### 4. `check_sky_fact` (Check a sky fact)

- **What it does.** Checks one claim about the sky and answers yes, no, or
  that it depends on the time zone when the answer changes during that day.
  It checks four kinds of claim: a body's sign, whether a planet is
  retrograde, a sign change on a date, and a Moon phase on a date.
  `[L-TOOLS]` (description and the `kind` field)
- **When it fits.** A question such as "Is Mercury retrograde today?" or
  "Did the Sun enter Libra on 23 September?". `[L-TOOLS]`
- **Limits.** Astronomy only; it cannot check a prediction. `[L-TOOLS]`
  Dates from 1800 to 2199. `[L-CAPS]` The same limit on slow planets' sign
  changes as `get_upcoming_events`: it gave 14:31:41 UTC for Neptune entering
  Aries, where Horizons gives 17:35 UTC. `[J3-REPORT]` (other findings,
  item 2) API documentation: `https://zodiacs.org/developers/compute/`.
  `[L-TOOLS]`

### 5. `get_horoscope` (Horoscopes)

- **What it does.** Returns the Sun-sign horoscope Zodiacs publishes for a
  date: general, love or career for a day, or general for the week.
  `[L-TOOLS]` With a birth date it adds a personal forecast for the week from
  that person's own chart. `[L-TOOLS]` `[L-CAPS]` (`limitations[3]`)
- **When it fits.** A request for a daily or weekly horoscope or a
  reflective reading for a sign. `[L-TOOLS]`
- **Limits.** Daily readings exist for the day before, the day of and the
  day after the current edition. `[L-CAPS]` (`limitations[3]`) It is not a
  source of stock picks, investment advice, financial forecasts, health
  predictions or guaranteed outcomes. `[L-TOOLS]` Zodiacs sends no
  notifications. `[L-TOOLS]` It refuses a birth date less than 13 years ago.
  `[J3-REPORT]` (D4) With no birth date it has no way to know the reader's
  age. `[J3-REPORT]` (D2, "Two paths the server cannot check") Its results
  include a link to the sign-up page for the daily email. `[J3-REPORT]`
  (other findings, item 1)
- **Not yet true, so not stated.** "For a birth date under 18 it gives the
  general reading and no love reading." The live server did not behave that
  way on 11 November 2026. `[J3-REPORT]` (D2) Add this sentence when draft
  970 is live.
- **Live wording left out.** "Decline those requests without a tool call";
  "Share the reading as written"; "Lead with those personal lines"; "If you
  can schedule tasks for the person, offer once, briefly, to send them their
  horoscope every morning"; "give them the returned shareUrl exactly";
  "never guess it". `[J3-REPORT]` (D1, row 5) `[L-TOOLS]`

### 6. `open_chart_studio` (Chart Studio)

- **What it does.** Opens Chart Studio, an interactive birth chart that the
  person fills in themselves with a birth date, a place and, if known, a
  time. The chart is calculated inside the panel. It takes no input.
  `[L-TOOLS]`
- **When it fits.** Someone wants to explore their own chart, or has not
  given birth details in the conversation. `[L-TOOLS]` (this description and
  `get_natal_chart`'s, which points here for that case)
- **Limits.** The assistant sees only the parts of the chart the person
  chooses to share. `[L-TOOLS]`
- **Live wording left out.** "do not ask for birth details first".
  `[J3-REPORT]` (D1, row 6)

### 7. `get_occasion_sky` (The sky on a day)

- **What it does.** Describes the sky on a day that matters to someone: the
  Sun and Moon signs, the Moon's phase and any retrograde planets, with a
  card title and short lines. With a place it adds sunset, golden hour, dusk,
  the Moon and the planets visible that evening. It rates the date from 0 to
  100 with a verdict and the astrological reasons (Venus, the Moon's phase
  and sign, retrograde planets). Given a window of up to 92 days it rates
  every day and returns the three best-rated days. `[L-TOOLS]`
- **When it fits.** A wedding, an anniversary, the day two people met, a
  birthday, a pet, a new home, a job, a graduation, a retirement or a
  gathering. `[L-TOOLS]` (`occasion`)
- **Limits.** The rating is astrology's traditional reading; it never
  guarantees how the day will go. `[L-TOOLS]` `[L-CAPS]` (`limitations[5]`)
  A birthday card for a day in the last 13 years is refused. `[J3-REPORT]`
  (D4, call 60) A printable card's link carries the occasion's own day,
  time, zone and rounded coordinates, and no name. `[J3-REPORT]` (D3, call
  19) For a birthday in the past it returned no card link and no share link.
  `[J3-BREAKER]` (N2, probe b10) The place name and first names are printed
  on the card only and are not used in the calculation. `[L-TOOLS]`
  (`place`, `names`)
- **Live wording left out.** "share the rating and its reasons plainly";
  "copy the returned cardUrl exactly ... do not reconstruct it from the
  conversation"; "give them the returned shareUrl exactly". `[J3-REPORT]`
  (D1, row 7)

### 8. `get_life_milestones` (Life milestones)

- **What it does.** Lists astrology's life milestones from a birth date:
  each Jupiter return (about every 12 years), the Saturn returns (around 29,
  58 and 88) and the Uranus opposition (early forties), with dates, ages and
  every pass of a retrograde loop, the next one coming, and counts of the
  full Moons and Mercury retrogrades since birth. `[L-TOOLS]`
- **When it fits.** A question about a Saturn return or another lifetime
  return, from a known birth date. `[L-TOOLS]` `[L-CAPS]` (`limitations[8]`)
- **Limits.** It makes no prediction. `[L-TOOLS]` A birth date is enough; a
  birth time needs the birthplace's time zone. `[L-TOOLS]` (`time`, `zone`)
  It refuses a birth date less than 13 years ago. `[J3-REPORT]` (D4) Its
  share link shows the milestone and never the birth date `[L-TOOLS]`; it
  does carry the age at the next milestone. `[J3-BREAKER]` (N3)
- **Live wording left out.** "give them the returned shareUrl exactly".
  `[J3-REPORT]` (D1, row 8)

### 9. `get_compatibility` (Compare two charts)

- **What it does.** Compares two birth charts: the two people's Sun, Moon
  and rising signs, the closest contacts between their planets with what
  each traditionally means, and how their elements balance. It returns a
  score out of 100, scores for attraction, communication and long-term
  stability, a verdict and a headline. One side can be a famous person whose
  chart Zodiacs publishes. `[L-TOOLS]`
- **When it fits.** A question about compatibility between two adults, or
  between a person and a published famous person. `[L-TOOLS]` `[L-CAPS]`
  (`limitations[6]`)
- **Limits.** The score is astrology's reading of two charts, not a
  guarantee of how a relationship will go. `[L-TOOLS]` `[L-CAPS]`
  (`limitations[6]`) It gives no reading when either birth date is under 18.
  `[J3-REPORT]` (D2, calls 43, 44 and 47) `[L-CAPS]` (`limitations[6]`) It
  refuses a birth date less than 13 years ago. `[J3-REPORT]` (D4) Each person
  needs a birth date; without a birth time and place there is no rising sign.
  `[L-TOOLS]` A famous person's chart is for noon on their birth date, with
  no Moon or rising sign, and an unknown name returns `found: false`.
  `[L-TOOLS]` Its results include a link inviting a partner to compare
  charts on the site. `[J3-REPORT]` (other findings, item 1)
- **Live wording left out.** "never make one up"; "lead with the score and
  verdict in plain words"; "Present it as astrology's reading"; "give them
  the returned shareUrl exactly". `[J3-REPORT]` (D1, row 9)

### 10. `find_chart_twins` (Chart twins)

- **What it does.** Finds famous people, among those Zodiacs publishes
  charts for, whose Sun sign, Moon sign or both match the person's, with a
  link to each chart. `[L-TOOLS]`
- **When it fits.** A question about which famous people share someone's
  sign or chart. `[L-TOOLS]`
- **Limits.** A birth date alone compares the Sun only; the Moon needs the
  birth time and time zone. `[L-TOOLS]` It searches only the people Zodiacs
  publishes. `[L-TOOLS]` It refuses a birth date less than 13 years ago.
  `[J3-REPORT]` (D4) Its share link carries the signs and never the birth
  date. `[L-TOOLS]`
- **Live wording left out.** "give them the returned shareUrl exactly".
  `[J3-REPORT]` (D1, row 10)

### 11. `get_famous_chart` (A famous birth chart)

- **What it does.** Looks up the birth chart of a famous person Zodiacs
  publishes: Sun and Moon signs and the planets' signs for their birth date,
  a short introduction and a link to their page. `[L-TOOLS]`
- **When it fits.** A question about a well-known person's chart or sign.
  `[L-TOOLS]`
- **Limits.** It covers only the people Zodiacs publishes. For anyone else
  it says it has no chart (`found: false`) and returns none. `[L-TOOLS]`
  `[J3-REPORT]` (D4, call 26)
- **Live wording left out.** "never make one up"; "give them the returned
  shareUrl exactly". `[J3-REPORT]` (D1, row 11)

### 12. `get_birthday` (Your birthday)

- **What it does.** Describes the sky on a birthday: the Sun's sign for the
  date, its traditional meaning, the decan, and whether the date is on a
  cusp where the sign depends on the year or time. With a full birth date it
  resolves a cusp date's sign for that year, or calculates a solar return,
  the moment the Sun comes back to its birth position. It links to the
  date's birthday page and names the published famous people born that day.
  `[L-TOOLS]`
- **When it fits.** A question about one birthday. `[L-TOOLS]` `[L-CAPS]`
  (`limitations[8]`)
- **Limits.** It makes no prediction. `[L-TOOLS]` A month and day is enough
  for general facts; the full birth date is needed only for a cusp or a
  solar return. `[L-TOOLS]` The longitude field is for historical dates when
  a birthplace kept local mean time, and has no use for a modern birthday.
  `[L-TOOLS]` (`longitude`) Solar return years run from 1801 to 2199.
  `[L-TOOLS]` (`year`) It refuses a birth date less than 13 years ago.
  `[J3-REPORT]` (D4) Its share link carries the month and day, never the
  year. `[L-TOOLS]`
- **Live wording left out.** "do not request coordinates for modern
  birthdays"; "give them the returned shareUrl exactly". `[J3-REPORT]` (D1,
  row 12)

### 13. `get_sky_calendar` (Sky calendar for your calendar app)

- **What it does.** Returns the link for subscribing to Zodiacs' sky
  calendar in Google Calendar, Apple Calendar or Outlook, with how to add it
  and the next few events. The calendar holds new and full Moons, eclipses
  and retrograde periods and updates itself. `[L-TOOLS]`
- **When it fits.** Someone wants these events in their own calendar.
  `[L-TOOLS]`
- **Limits.** Event titles come in English, Spanish, Portuguese, French,
  Italian or Russian. `[L-TOOLS]` (`language`) It returns a subscription
  link; it adds nothing to anyone's calendar itself and schedules nothing.
  `[L-TOOLS]` `[L-CAPS]` (`limitations[2]`, "No ... reminders or account
  access")
- **Live wording left out.** "give them the returned shareUrl exactly".
  `[J3-REPORT]` (D1, row 13)

### 14. `get_natal_chart` (Birth chart readout)

- **What it does.** Reads one person's birth chart in the conversation: the
  Sun, Moon and rising signs, each planet's sign and degree, its house when
  the birth time and place are known, the closest aspects between the
  planets, and the balance of elements and modes, each with what astrology
  traditionally reads into it. `[L-TOOLS]`
- **When it fits.** Someone has already given their birth date and wants
  the chart read out. `[L-TOOLS]`
- **Limits.** Without a birth time it gives no rising sign and no houses,
  and on a day the Moon changed sign it gives the Moon sign as two
  possibilities. `[L-TOOLS]` The rising sign and houses also need the
  birthplace's latitude, longitude and time zone. `[L-TOOLS]` (`latitude`)
  When the birth time fell in a skipped or repeated hour of a clock change,
  the result's `timeNote` says which instant was used. `[L-TOOLS]` Birth
  dates from 1800 to 2199. `[L-TOOLS]` (`birthDate`) It refuses a birth date
  less than 13 years ago, which also means it refuses a chart for today or
  for a recent moment; for the sky at a moment there is `get_sky`.
  `[J3-REPORT]` (D4, calls 65 to 67) For a birth date under 18 its reading
  comes with a note that romantic and attraction readings are left out.
  `[J3-REPORT]` (D2, call 45) Its `chartUrl` opens the birth chart
  page and carries no birth date, time, place or coordinates. `[L-TOOLS]`
  `[J3-BREAKER]` (N2, probe b20)
- **Live wording left out.** "never guess a birth time"; "tell the person";
  "do not frame the chart as romance or attraction"; "give it as the page to
  open". `[J3-REPORT]` (D1, row 14)

### 15. `get_horoscope_period` (Monthly, yearly and weekly horoscopes)

- **What it does.** Returns the Sun-sign reading Zodiacs publishes for a
  month, a year, or a love or career week, together with that period's sky
  for the sign: planets changing sign, turning retrograde or direct, new and
  full Moons and eclipses, placed in the sign's solar houses. A week adds
  that focus's daily readings. It returns a reading-confidence label with
  the forecast. `[L-TOOLS]`
- **When it fits.** A request for a sign's month or year, or for a love or
  career week. `[L-TOOLS]` `[L-CAPS]` (`limitations[8]`)
- **Limits.** Monthly readings are published from the first of each month,
  and yearly readings exist for 2026 and 2027. `[L-TOOLS]` When a reading is
  not published it says so and still gives the sky. `[L-TOOLS]` A month's sky
  leaves out the Moon's sign changes. `[L-TOOLS]` A week is for love or
  career only; a general week and a single day belong to `get_horoscope`.
  `[L-TOOLS]` It is not a source of stock picks, investment advice, health
  predictions or guaranteed outcomes. `[L-TOOLS]` It takes no birth date, so
  it cannot know a reader's age. `[J3-REPORT]` (D2, "Two paths the server
  cannot check") Its results include a link to the sign-up page for the
  daily email. `[J3-REPORT]` (other findings, item 1) The times it prints
  for a slow planet's sign change carry the same limit as
  `get_upcoming_events`: it gave 14:31:41 UTC for Neptune entering Aries.
  `[J2-BREAKER]` (S1)
- **Live wording left out.** "never write a reading yourself in its place";
  "do not use focus love and do not frame the reading as romance or
  attraction"; "Share the forecast plainly and confidently"; "Do not call it
  for stock picks"; "Never guess the sign". `[J3-REPORT]` (D1, row 15)
  `[L-TOOLS]`

### 16. `get_chinese_zodiac` (Chinese zodiac)

- **What it does.** Gives the Chinese zodiac animal, element and yin or
  yang for a birth date or a year, and the current year's animal. It adds
  the animal's traditional associations and pairings (the harmonious three,
  the six-harmony partner and the opposite animal), with links to the
  animal's page. `[L-TOOLS]`
- **When it fits.** A question about someone's Chinese zodiac animal, or
  the animal of a year. `[L-TOOLS]`
- **Limits.** A birth date before that year's Lunar New Year belongs to the
  previous animal year, and the answer gives the Lunar New Year date it
  used. `[L-TOOLS]` Years 1901 to 2100. `[L-TOOLS]` (`birthDate`, `year`)
  Without a time zone the current year is worked out in UTC, and the answer
  says so. `[L-TOOLS]` It refuses a full birth date less than 13 years ago.
  `[J3-REPORT]` (D4) Given only a year, including a year in the last 13, it
  answers. `[J3-BREAKER]` (S1, call 61)
- **Live wording left out.** None flagged; the dry run noted only that the
  under-13 refusal was missing from the description. `[J3-REPORT]` (D1, row
  16) `[J3-BREAKER]` (S3)

### 17. `get_personal_transits` (Your transits)

- **What it does.** Lists dated transits to one person's birth chart: when
  the moving planets make exact aspects to the natal planets, and to the
  rising degree and Midheaven when the birth time and place are known, each
  with what astrology traditionally reads into it and a reading-confidence
  label. By default it covers the next 30 days. In year-ahead mode it gives
  the year's highlights: the slow planets on the personal planets, the solar
  return, a Saturn return, Jupiter and Saturn changing sign, and eclipses
  near natal planets. `[L-TOOLS]`
- **When it fits.** "My transits", "what is coming up for me" or "my year
  ahead", once a birth date has been given. For a Sun-sign horoscope there
  are `get_horoscope` and `get_horoscope_period`. `[L-TOOLS]`
- **Limits.** A window is at most 366 days, and a window over 92 days keeps
  to Jupiter through Pluto. `[L-TOOLS]` The window cannot start before the
  birth date. `[L-TOOLS]` Without a birth time the Moon, the rising degree
  and the Midheaven are left out. `[L-TOOLS]` (`time`) Without `currentZone`
  dates use the birthplace's clock, or UTC if that is missing too, and the
  answer says which. `[L-TOOLS]` (`currentZone`) Each line is astrology's
  reading, not a guarantee, and not health, financial or medical advice.
  `[L-TOOLS]` It refuses a birth date less than 13 years ago, so it also
  refuses transits to a chart of today. `[J3-REPORT]` (D4, call 68) For a
  birth date under 18 its lines come with a note that romantic and
  attraction readings are left out. `[J3-REPORT]` (D2, calls 46 and 48)
- **Live wording left out.** "never guess a birth time"; "do not frame the
  lines as romance or attraction"; "Present each line plainly and
  confidently as astrology's reading ... never turn a line into health,
  financial or medical advice". `[J3-REPORT]` (D1, row 17) `[L-TOOLS]`

### 18. `explain_astrology` (Astrology explained)

- **What it does.** Explains a basic astrology topic in plain words from
  Zodiacs' own pages, with links to them. It also answers whether two Sun
  signs are compatible, from that sign-pair page. `[L-TOOLS]`
- **When it fits.** A "what does X mean" question: a sign and its traits, a
  planet, a planet in a sign or a house, the houses, aspects, retrogrades,
  Moon phases, the void-of-course Moon, eclipses, the rising sign, the
  Midheaven, the big three, cusps, the Saturn return, the solar return,
  elements, modalities, transits, synastry, Sun-sign pairs or the Chinese
  zodiac. `[L-TOOLS]`
- **Limits.** For tarot, numerology, horary, Vedic astrology or another
  system Zodiacs does not cover, or when nothing matches, it returns
  `found: false` with the topics it does explain. `[L-TOOLS]` `[J3-REPORT]`
  (D4, call 38) A person's own placements belong to `get_natal_chart`.
  `[L-TOOLS]` A Sun-sign pair is answered as a romance reading unless the
  topic includes the word friendship; the friendship answer is the element
  and modality pattern alone. `[L-TOOLS]` `[J3-REPORT]` (D2) It takes no age
  or birth date, so it cannot know a reader's age. `[J3-REPORT]` (D2)
- **Live wording left out.** "do not present an explainer of your own as
  Zodiacs'"; "give the friendship reading and do not frame the pair as
  romance or attraction". `[J3-REPORT]` (D1, row 18)

### 19. `find_birthplace` (Find a birthplace)

- **What it does.** Resolves the name of a town or city to a region, a
  country, coordinates rounded to two decimals, an IANA time zone and the UTC
  offset for an optional date, historical daylight saving included. The
  chart tools take those coordinates and that time zone. `[L-TOOLS]`
- **When it fits.** Someone names a birthplace or a venue as a town or city
  and a chart tool needs its coordinates and time zone. `[L-TOOLS]` (this
  description and those of `get_natal_chart` and `get_personal_transits`)
- **Limits.** Public town and city names only; it does not take a street
  address. `[L-TOOLS]` It searches the GeoNames list of places of 15,000
  people or more, bundled with Zodiacs, so the name is not sent anywhere
  else. `[L-TOOLS]` An unknown place returns "No town or city matches".
  `[J3-REPORT]` (D4, call 78) A place gives no information about a birth
  time. `[L-TOOLS]` Dates for the offset run from 1800 to 2199. `[L-TOOLS]`
  (`date`)
- **Live wording left out.** "Never guess a birth time from a place".
  `[L-TOOLS]` (The dry run passed this sentence as a note on filling in a
  field; its second session noted that draft 971 treats it as a directive.
  `[J3-BREAKER]` S3)

---

## Self-check against L3

- **Every live tool is here.** 19 of 19, in the order `tools/list` returns
  them. `[L-TOOLS]`
- **No instruction to the assistant.** The "What it does", "When it fits"
  and "Limits" lines were searched for the directive forms the dry run
  flagged (do not, never as a command, lead with, share, present, offer,
  decline, tell, give them, ask, pass, copy, use it). The only matches are
  inside the quoted "Live wording left out" lines and in statements of fact
  about the tool ("never the birth date", "never guarantees", "not a source
  of"). The script is `tools/check-drafts.py`; its output is in `README.md`.
- **Limits present.** The under-13 refusal is on each of the eight tools
  that take a birth date, and the under-18 behaviour is stated where the
  server enforces it and withheld where it does not yet.

## Not covered here

- The **server instructions** (the text sent at `initialize`). The dry run
  flagged them as mostly orders. `[J3-REPORT]` (D1, "Server instructions")
  The issue asks for tool descriptions, so no rewrite is drafted.
- The **input field descriptions**, some of which also instruct ("Never
  guess it; ask the person if they have not said"). `[J3-BREAKER]` (S4)
  `[L-TOOLS]`
- Whether to adopt any of this. Changing a description changes a published
  definition, which needs the owner's approval and, for the directories, a
  note to each. `[J3-REPORT]` (D1 "Fix", D5)
