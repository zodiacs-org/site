# Zodiacs plugin

The public Zodiacs plugin: one onboarding skill and a remote MCP connection to
`https://zodiacs.org/mcp`, which is live.

## What it offers

| Tool | Title people see | Panel |
|---|---|---|
| `get_upcoming_events` | Sky calendar | Sky calendar, up to 92 days |
| `get_sky` | Sky right now | — |
| `check_sky_fact` | Check a sky fact | — |
| `get_horoscope` | Horoscopes | Horoscopes for the reader's own day or week |
| `open_chart_studio` | Chart Studio | An interactive birth chart the person fills in |
| `get_capabilities` | What Zodiacs can do | — |

No account or birth details are sent as tool arguments. Horoscopes come from
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
