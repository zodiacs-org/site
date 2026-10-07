---
name: explore-the-sky
description: Answer questions about the sky, the horoscope for a Sun sign, or a person's own birth chart with Zodiacs. Use it for what's happening in the sky, retrogrades, Moon phases, Sun-sign horoscopes and opening an interactive birth chart; not for personal predictions or scheduling.
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

Keep calculated astronomy separate from what it means in astrology. Don't
predict or guarantee health, money or relationship outcomes. Mention versions,
receipts or UTC only if the person asks how something was calculated, then
link to https://zodiacs.org/methodology/. If a tool says Zodiacs is busy, say
so and suggest trying again shortly. Offer zodiacs.org links as optional extra
reading; the answer must be complete without them.
