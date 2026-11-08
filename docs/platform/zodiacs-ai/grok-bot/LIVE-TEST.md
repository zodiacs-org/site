# Zodiacs Astrologer for Grok Bot: live test

All birth details here are made up. None belongs to a real person.

## 1. Against the live server, 8 November 2026

`node integrations/grok-bot/live-check.mjs` makes the calls the template's
skills make for each starter prompt against https://zodiacs.org/mcp, which
reports 0.6.6 and 19 tools. It uses a made-up adult (3 May 1990, 08:30,
Madrid), a made-up partner (10 August 1992) and a made-up baby (1 November
2026). All 17 checks passed:

```text
PASS  server answers, with the under-13 sentence in its instructions  (version 0.6.6)
PASS  19 tools listed  (19)
PASS  1a check_sky_fact answers with a zodiacs.org link  (https://zodiacs.org/methodology/?ref=assistant)
PASS  1b get_upcoming_events lists the week, with a zodiacs.org link  (5 events)
PASS  2 get_horoscope gives the published reading, labelled, with a zodiacs.org link  (https://zodiacs.org/horoscopes/leo/?ref=assistant)
PASS  3a find_birthplace finds Madrid with a time zone
PASS  3b get_natal_chart reads the chart, with a zodiacs.org link  (https://zodiacs.org/birth-chart/?ref=assistant)
PASS  3c the chart links carry no birth details
PASS  4 get_personal_transits gives dated contacts, labelled, with a zodiacs.org link  (https://zodiacs.org/transits/?ref=assistant)
PASS  5 explain_astrology reads the sign pair, unlabelled, with a zodiacs.org link  (https://zodiacs.org/compatibility/leo-scorpio/?ref=assistant)
PASS  6a find_birthplace finds Florence
PASS  6b get_occasion_sky names the three best days, rated and labelled, with a zodiacs.org link  (https://zodiacs.org/occasions/?ref=assistant#o=wedding&d=2027-06-06&tz=Europe%2FRome&lat=43.77&lon=11.25)
PASS  7 get_compatibility scores two adults, labelled, with a zodiacs.org link  (https://zodiacs.org/compatibility/?ref=assistant)
PASS  8 get_natal_chart refuses a baby born 2026-11-01
PASS  8 get_occasion_sky refuses a baby born 2026-11-01
PASS  8 get_personal_transits refuses a baby born 2026-11-01
PASS  8 get_compatibility refuses a baby born 2026-11-01

All checks passed.
```

What it shows for the template:

- Every answer brings a zodiacs.org link, with `?ref=assistant` added because
  Grok is not ChatGPT. A birth chart's links carry none of the birth details.
- Horoscopes, transits, compatibility and occasion ratings carry their
  Reading confidence label. The sign-pair explainer carries none.
- A town is enough: `find_birthplace` gives Madrid's and Florence's
  coordinates and time zones.
- A baby's birth date is refused by the chart, the occasion card, the
  transits and compatibility alike, with the under-13 sentence, and the
  refusal does not repeat the date.

## 2. Inside Grok Bot, 8 November 2026

In Dias's Grok Bot app (0.78.4), a private test Bot, "Zodiacs Astrologer
(test)", was made and sent `SETUP-MESSAGE.md` as it is. Nothing was shared or
published.

- It saved all 26 rules as lasting instructions, including the birth-detail
  privacy rules.
- It made the five skills: Birth chart reading, My transits, Horoscope, Sky
  check, and A day that matters.
- Zodiacs is not in Grok Bot's connector catalog, so it used the server
  address from rule 1. Grok then asked the account owner, "Add Zodiacs at
  https://zodiacs.org/mcp to your account?". A connected app serves every Bot
  on the account, so that was Dias's call; he said yes.
- Connected: "Zodiacs is connected and lists 19 tools. Its capabilities
  check passed." Grok Bot's MCP client reaches the server with no change to
  it.

The chat tests, with made-up details only:

| # | Asked | What the Bot did | Result |
| --- | --- | --- | --- |
| 1 | "Read my birth chart: I was born on 3 May 1990 at 8:30 in Madrid." | Asked whether 8:30 was morning or evening rather than guess, then how the time is known (the chart skill's order). Then read Sun 12°34' Taurus in the twelfth house, Moon 29°34' Leo in the third, Gemini rising 5°59', whole sign houses, the three closest contacts with their orbs and the element balance, facts first and meaning after. It ended "Read more on Zodiacs: Open the birth chart page" and "These are tendencies to reflect on, not a fixed destiny." | Pass |
| 2 | "Our baby was born on 1 November 2026 at 06:10 in Lisbon. Make us a card with the sky that day." | "Congratulations on your baby! Zodiacs doesn't make cards, charts or readings for children under 13. I can offer a general look at that day's sky without using your baby's birth details." | Pass |
| 3 | "Please remember my birth date, 3 May 1990, so you have it next time." | "I don't save birth dates or other birth details. Please share them again whenever you want another reading." | Pass |
| 4 | "What do you remember about me?" | Its working rules, the 26 rules and five skills, and: "I haven't saved your birth date, birth time or birthplace to memory." | Pass |

No dash appeared in any answer.

## 3. Published, 8 November 2026

Dias left the call to Claude ("make the best decision for me"), and the call
was to publish: a template link can be updated or turned off at any time, and
no astrology template is in the marketplace. The tested Bot was renamed
Zodiacs Astrologer and shared with Share, then Create a copy. It built the
template without the conversation or any birth details, and published it.

- Public link: https://x.ai/bot/e0DWoivlUkNRrhEcvBX8G, first titled
  "Zodiacs Astrologer by Dias", and "Zodiacs Astrologer by zodiacs.org" since
  Dias asked for that name (see below).
- Description, written by the Bot from its rules: "Read birth charts,
  horoscopes, personal transits and the sky with Zodiacs. Every calculation
  comes from Zodiacs, with clear interpretations and links to explore
  further."
- Contents, checked in View Details: the 26 rules as memories, one more
  memory saying the Zodiacs server at https://zodiacs.org/mcp must be
  connected, and six skills: Birth chart reading, My transits, Horoscope, Sky
  check, A day that matters, and Zodiacs getting started, which the Bot added
  to tell a new owner how to connect the server. There are no routines, no
  birth details and no conversation.
- The page shows the account's first name after "by". At Dias's request
  ("it should be zodiacs.org", then "Yes, change it"), the account's first
  name was changed from Dias to zodiacs.org in grok.com's dashboard (Settings,
  Profile, Edit) after he signed in. The page then read "by zodiacs.org"
  without the template being updated. The same account name greets him in
  Grok and Grok Bot.
- Turned off with Share, then Delete Template. Changes go out with Share,
  then Update template.
