# Zodiacs Astrologer for Grok Bot

A Grok Bot template that reads birth charts, transits, horoscopes and the sky
with the live Zodiacs MCP server at https://zodiacs.org/mcp: the same 19
read-only tools the ChatGPT app and the Claude connector use, with no key and
no sign-in. Nothing here is published or submitted without Dias's yes.

| File | What it is |
| --- | --- |
| `SETUP-MESSAGE.md` | The one message that turns a new Grok Bot into Zodiacs Astrologer: its rules, the tool for each question, five skills, and the step that connects the Zodiacs server. |
| `LISTING.md` | Name, one-line and longer description, starter prompts and placement. |
| `live-check.mjs` | Makes the calls the skills make, against the live server, with made-up adult details and a made-up baby. `node integrations/grok-bot/live-check.mjs` |
| `template.test.ts` | Checks the copy: no dashes, no crypto words, the child and privacy rules present, every tool it names live. |

## Why the live server, and not the engine tools

The Astrologer plan in engine PR #77 (`bots/astrologer/` in
zodiacs-org/engine, merged on 28 October) is written for engine tools that no
live server offers: place lookup, `resolve_civil_time`, `reading_facts`,
`natal_chart`, `transits_at` and `event_search`. As built it cannot calculate
anything. Its own plan lists nine launch blockers, starting with hosting
those tools (B1), and about 23 working days.

Since then the live server has gained what a launch needs:

- `find_birthplace` turns a town into coordinates and a time zone (the plan's
  B3).
- `get_natal_chart` reads a chart with whole sign houses, and says when a
  clock change made the birth time skip or repeat (B2 for the chart).
- `get_personal_transits` gives dated contacts to the person's chart for up
  to a year, each with a Reading confidence label (B4 for transits).
- Horoscopes, compatibility for two adults, occasion ratings, explainers and
  sky checks, all keyless (B7), each result with a zodiacs.org link (B8).
- The server itself refuses a child's birth date and keeps nothing it is
  sent. OpenAI and Anthropic are reviewing it now.

So the template is rebuilt on those tools, and it can launch as soon as Dias
says yes. Left for later, if the engine tools are ever hosted: Placidus
houses, Chiron, and station and eclipse search (all built, behind the sky
events switch), and the plan's fact sheet with its automatic checks. Two
things are left out on purpose. There is no stored profile and no 90-day
check-in routine, because the bot keeps no birth details. There is no blind
rating by astrologers either.

## Steps for Dias

1. **Make the Bot.** In the Grok Bot app choose **New Bot**, name it Zodiacs
   Astrologer, and send it the message in `SETUP-MESSAGE.md` as it is. It
   saves the rules, makes the skills and connects https://zodiacs.org/mcp.
2. **Try it** with the starter prompts in `LISTING.md`, and with made-up
   birth details only.
3. **Share it as a template, only on your yes.** Open the Bot's details,
   choose **Share**, then **Create a copy**. Check the template's details:
   its memories and skills, and no birth details anywhere. Then choose
   **Publish** and **Copy link**. Publishing makes a public link that anyone
   can open. Done on 8 November: https://x.ai/bot/e0DWoivlUkNRrhEcvBX8G.
4. **The marketplace** (x.ai/bot/marketplace) is chosen by the Grok Bot
   team. Its path for suggesting a template is still to be found. That step
   is a submission, so it also waits for your yes.

## Checked

- 8 November 2026: `live-check.mjs` passed all 17 checks against the live
  server, 0.6.6 (`docs/platform/zodiacs-ai/grok-bot/LIVE-TEST.md`).
- The same day, inside Grok Bot, a private test Bot took the setup message, connected https://zodiacs.org/mcp (19 tools), read a made-up adult's chart with its zodiacs.org link, refused a made-up baby, and kept no birth details (same file).
