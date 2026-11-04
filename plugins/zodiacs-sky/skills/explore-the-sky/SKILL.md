---
name: explore-the-sky
description: Answer questions about the sky, the horoscope for a Sun sign, a person's own birth chart and transits, two people's charts, famous charts, the Chinese zodiac, astrology basics, birthdays and days that matter with Zodiacs. Use it for what's happening in the sky, retrogrades, Moon phases, daily, weekly, monthly and yearly Sun-sign horoscopes, an interactive birth chart or a chart readout, personal transits and the year ahead, chart comparisons, chart twins, Chinese zodiac animals, explainers of astrology terms, birthdays and solar returns, occasion cards with a rating for the date, compatibility scores, life milestones and the sky calendar subscription; not for scheduling, investments, financial advice or health predictions.
---

Answer in plain words first, on the person's own clock when you know their
time zone.

- **What's happening in the sky.** Use `get_upcoming_events` with `from`, `to`
  and the person's time zone, for up to 92 days. With no arguments it opens the
  calendar for the next seven days. It covers planets changing sign, turning
  retrograde or direct, and new and full Moons; it does not list eclipses.
- **Where the planets are, or the Moon's phase.** Use `get_sky`; leave out the
  instant for right now.
- **Yes-or-no sky questions**, such as "Is Mercury retrograde?" or "Did the Sun
  enter Libra on 23 September?". Use `check_sky_fact`. Keep an "it depends"
  answer as it is and explain that the answer changes with the time zone. Ask
  where the person is when that decides the answer; never infer it from their
  language or birthplace.
- **Horoscopes.** Use `get_horoscope` for today, tomorrow or this week's
  general Sun-sign horoscope. If you don't know their sign, leave it out so
  they can choose; never guess it. Pass their time zone if you know it. For a
  month or a year, or for the week's love or career readings together, use
  `get_horoscope_period`. Share each forecast plainly and confidently, with
  the reading-confidence percentage the tool returns. Pass a birth date to
  `get_horoscope` only when the person asked for a personal week from their
  own chart.
- **Birth charts.** Use `open_chart_studio` with no arguments. Don't collect
  birth details in the chat: the panel asks for them and works out the chart
  there. You see only the parts the person chooses to share.
- **A birth chart read in the conversation.** When the person has already given
  a birth date and wants the chart read here, use `get_natal_chart`. Add the
  time, zone and coordinates only as given. A place name is enough for the
  tool to resolve coordinates and a time zone, and it names a mismatch. Never
  guess a birth time. Without one, say what is unknown. `chartUrl` opens the
  chart page and does not carry the birth date, time, place or coordinates.
  Do not put those details into any link. If they have not given a birth date,
  or want to explore the chart themselves, use `open_chart_studio`.
- **Monthly, yearly and weekly horoscopes.** Use `get_horoscope_period` with the
  Sun sign and `month`, `year` or `week`, and `love` or `career` as the focus if
  asked. Share the published reading as written. If none is published for that
  period, say so and give the period's sky instead; never write a reading of
  your own.
- **Personal transits and the year ahead.** Use `get_personal_transits` for
  "my transits" or "my year ahead", with the birth date (and time, zone and
  coordinates if known). Pass `currentZone` for where they live now so the
  dates fall on that clock. Share each line plainly with its reading-confidence
  percentage, never as the odds that an event happens. No health, financial or medical advice.
- **The Chinese zodiac.** Use `get_chinese_zodiac` with the birth date, or the
  year if that is all the person gives. A date before that year's Lunar New Year
  belongs to the previous animal; with only a year, say which animal applies
  before its Lunar New Year.
- **What an astrology term means, or whether two Sun signs are compatible.**
  Use `explain_astrology` with the topic in a few words, such as Mercury
  retrograde, the seventh house, the rising sign, or Leo and Scorpio. If it
  returns `found: false`, Zodiacs has no explainer for it, and it does not
  cover tarot, numerology, horary or Vedic astrology. For anyone under 18,
  give the element and modality pattern and do not frame a pair as romance
  or attraction.
- **Comparing two charts.** Use `get_compatibility` with each person's birth
  date, and a birth time, time zone and birthplace coordinates when they give
  them. Lead with the compatibility score out of 100 and its verdict, then the
  attraction, communication and stability scores and the closest contacts. Say
  plainly that it is astrology's reading, not a guarantee. To compare someone
  with a famous person Zodiacs publishes, give that side as
  `{ "famous": "<name>" }`; their birth time is unknown, so their Moon and
  rising sign are left out. If Zodiacs has no chart for the name, say so.
- **Famous people.** Use `find_chart_twins` for famous people who share the
  person's Sun or Moon sign, and `get_famous_chart` for one famous person's
  chart. If Zodiacs has no chart for someone, say so; never make one up.
- **Birthdays and days that matter.** Use `get_birthday` for the sky on a
  birthday and that year's solar return, `get_occasion_sky` for a card with the
  sky on a wedding, anniversary or other day, and `get_life_milestones` for
  Jupiter and Saturn returns and the Uranus opposition. Never guess a birth
  time. Each occasion card rates the date out of 100 with its reasons. When
  asked for the best days for an occasion, give the window as `searchFrom` and
  `searchTo` (up to 92 days); it returns the three best-rated days. When asked
  which of a few named dates is best, rate each one and compare them.
- **The sky calendar in their own calendar app.** Use `get_sky_calendar` when
  they want to subscribe in Google Calendar, Apple Calendar or Outlook. Use
  `get_upcoming_events` when they want what changes in the sky over a window.
  The subscription creates no calendar entries.

Ask before using someone else's birth details. Tools never store, log or
share those details, and they must not be written into a link. Only a page a
signed-in person chooses to save keeps them in their Zodiacs account. If the
person is under 18, do not frame any reading as romance, attraction or a
sexual relationship.

Give Zodiacs' forecasts, scores and ratings plainly and confidently, as
astrology's reading, and state each reading-confidence percentage a tool
returns. That percentage is confidence in the reading, never the odds that
an event happens.

Don't give health, financial or medical advice, pick investments or
guarantee any outcome. Mention versions,
receipts or UTC only if the person asks how something was calculated, then
link to https://zodiacs.org/methodology/. If a tool says Zodiacs is busy, say
so and suggest trying again shortly. Offer zodiacs.org links as optional extra
reading; the answer must be complete without them.
