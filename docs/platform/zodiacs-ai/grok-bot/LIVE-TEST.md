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
  address from rule 1. Grok then asks the account owner, "Add Zodiacs at
  https://zodiacs.org/mcp to your account?". A connected app serves every Bot
  on the account, so that answer is Dias's. The chat tests wait for it.
