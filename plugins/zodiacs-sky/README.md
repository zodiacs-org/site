# Zodiacs plugin

The public Zodiacs plugin: one onboarding skill and a remote MCP connection to
`https://zodiacs.org/mcp`, which is live.

## What it offers

| Tool | Title people see | Panel |
|---|---|---|
| `get_upcoming_events` | Sky calendar | Sky calendar, up to 92 days |
| `get_sky` | Sky right now | None |
| `check_sky_fact` | Check a sky fact | None |
| `get_horoscope` | Horoscopes | Horoscopes for the reader's own day or week |
| `open_chart_studio` | Chart Studio | An interactive birth chart the person fills in |
| `get_capabilities` | What Zodiacs can do | None |
| `get_compatibility` | Compare two charts | Occasions panel |
| `find_chart_twins` | Chart twins | Occasions panel |
| `get_famous_chart` | A famous birth chart | Occasions panel |
| `get_birthday` | Your birthday | Occasions panel |
| `get_occasion_sky` | The sky on a day | Occasions panel |
| `get_life_milestones` | Life milestones | Occasions panel |
| `get_sky_calendar` | Sky calendar for your calendar app | Occasions panel |
| `get_natal_chart` | Birth chart readout | Readings panel, inline |
| `get_horoscope_period` | Monthly, yearly and weekly horoscopes | Readings panel, inline |
| `get_chinese_zodiac` | Chinese zodiac | Readings panel, inline |
| `get_personal_transits` | Your transits | Readings panel, inline |
| `explain_astrology` | Astrology explained | Readings panel, inline |
| `find_birthplace` | Find a birthplace | None |

Seven were introduced in 0.5.0. They share the current panel
`ui://zodiacs/occasions-v8.html` and are offered where
`ZODIACS_OCCASIONS_ENABLED=1`. Production has them enabled. The comparison,
chart-twin, birthday, occasion and milestone tools
take the dates, times and places a person gives in the conversation, calculate
from them for that call and keep none of them; the famous-chart and calendar
tools take no personal details.

The five after them were introduced in 0.6.0 and are offered where
`ZODIACS_COVERAGE_ENABLED=1` joins the occasions switch; until the owner sets it,
production lists the thirteen above. From 0.6.1 they open the inline readings
panel `ui://zodiacs/readings-v3.html`, with no sidebar launch. The natal chart,
transit and Chinese zodiac tools take a birth date (and, for the first two, an
optional time, time zone and coordinates) for that call only and keep none of
it; the period horoscope and explainer tools take no personal details.
The `find_birthplace` tool is offered with them: it turns a town or city name
into coordinates and a time zone from the GeoNames list bundled with Zodiacs.

Zodiacs never stores or logs birth details. Links never carry a birth year,
a birth time, a birthplace or the names you give; a birthday link carries
only the month and day. Ask before using someone else's birth details.

No account is needed. Horoscopes come from
`src/data/horoscope-window.json`, which the daily publication rebuilds each
night with the editions for the day before, the day of and the day after, so
every time zone has its own "today".

## Packaging and testing

From the site checkout, `npm run ai:build` regenerates the server bundle and
panels, `npm run ai:check` verifies them and `npm run ai:package` creates the
review ZIP (root `plugin.json`, `mcp.json`, the skill, icon and notices).
Credentials and domain-verification tokens belong outside the ZIP.

Before submitting a version, test it in ChatGPT developer mode against an
HTTPS staging deployment, then record the walkthrough the review needs. The
history of earlier review candidates is in `docs/platform/zodiacs-ai/`.
