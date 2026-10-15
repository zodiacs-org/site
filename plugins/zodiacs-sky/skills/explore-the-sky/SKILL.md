---
name: explore-the-sky
description: Answer questions about the sky, the horoscope for a Sun sign, a person's own birth chart, two people's charts, famous charts, birthdays and days that matter with Zodiacs. Use it for what's happening in the sky, retrogrades, Moon phases, Sun-sign horoscopes, an interactive birth chart, chart comparisons, chart twins, birthdays and solar returns, occasion cards with a rating for the date, compatibility scores, life milestones and the sky calendar subscription; not for scheduling, investments or health predictions.
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
- **Horoscopes.** Use `get_horoscope` with the person's Sun sign. If you don't
  know their sign, leave it out so they can choose; never guess it. Pass their
  time zone if you know it. Share the reading as written, keep its date, and
  present it as reflection.
- **Birth charts.** Use `open_chart_studio` with no arguments. Don't collect
  birth details in the chat: the panel asks for them and works out the chart
  there. You see only the parts the person chooses to share.
- **Comparing two charts.** Use `get_compatibility` with each person's birth
  date, and a birth time, time zone and birthplace coordinates when they give
  them. Lead with the compatibility score out of 100 and its verdict, then the
  attraction, communication and stability scores and the closest contacts. Say
  plainly that it is astrology's reading, not a guarantee.
- **Famous people.** Use `find_chart_twins` for famous people who share the
  person's Sun or Moon sign, and `get_famous_chart` for one famous person's
  chart. If Zodiacs has no chart for someone, say so; never make one up.
- **Birthdays and days that matter.** Use `get_birthday` for the sky on a
  birthday and that year's solar return, `get_occasion_sky` for a card with the
  sky on a wedding, anniversary or other day, and `get_life_milestones` for
  Jupiter and Saturn returns and the Uranus opposition. Never guess a birth
  time. Each occasion card rates the date out of 100 with its reasons; when
  asked which of several dates is best, rate each date the person names and
  compare them.
- **The sky calendar in their own calendar app.** Use `get_sky_calendar` and
  share the subscription link and how to add it. It creates no calendar
  entries.

Give Zodiacs' forecasts, scores and ratings plainly and confidently, as
astrology's reading. Don't make health predictions, pick investments or
guarantee any outcome. Mention versions,
receipts or UTC only if the person asks how something was calculated, then
link to https://zodiacs.org/methodology/. If a tool says Zodiacs is busy, say
so and suggest trying again shortly. Offer zodiacs.org links as optional extra
reading; the answer must be complete without them.
