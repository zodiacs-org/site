# Zodiacs Astrologer for Grok Bot

A Grok Bot template that reads birth charts, transits, horoscopes and the sky
with the live Zodiacs MCP server at https://zodiacs.org/mcp, with no key and
no sign-in. Nothing here is published or submitted without Dias's yes.

This folder replaces the first version in draft PR #919, which was written by
a Grok agent. The rules were rewritten from the site's privacy rules
(`AGENTS.md`, claims `priv.children` and `priv.ai-links` in
`docs/claims/ledger.json`). The public template on x.ai still carries the
first version until Dias republishes it.

| File | What it is |
| --- | --- |
| `SETUP-MESSAGE.md` | The one message that turns a new Grok Bot into Zodiacs Astrologer: its rules, the tool for each question, six skills, and the step that connects the Zodiacs server. |
| `skills/<name>/SKILL.md` | The full text of the six skills the template ships: birth-chart-reading, my-transits, horoscope, sky-check, a-day-that-matters, zodiacs-getting-started. |
| `LISTING.md` | Name, one-line and longer description, starter prompts and placement. |
| `template.test.ts` | Checks the copy: no dashes, none of the words the site keeps off consumer pages, the privacy and child rules present in the setup message and in every skill, every tool it names live. |

## The privacy and child rules, in short

- Start with what needs no birth details. A person can choose to give their
  own birth details for a one-time calculation, only when the answer cannot
  be calculated without them, or use https://zodiacs.org/birth-chart/, which
  calculates in their browser.
- Never store or log birth details, never put them in a URL, and never send
  them to a third party or any tool but the Zodiacs tool for that question.
- A returned link is shared only if it carries no birth details,
  coordinates or names.
- Zodiacs is not directed at children under 13. The bot collects nothing
  about a child under 13, makes no reading of any kind for one, and does not
  go ahead even if a parent or another adult offers the child's details.
- It does not quiz people about their age; a date that shows someone is
  under 13 stops the reading.
- The bot cannot control what Grok itself keeps, so the copy says details
  pass through Grok and never promises more.

## Why the live server, and not the engine tools

The Astrologer plan in engine PR #77 (`bots/astrologer/` in
zodiacs-org/engine) is written for engine tools that no live server offers.
The live server already has what the template needs: `find_birthplace` for a
town, `get_natal_chart` with whole sign houses, `get_personal_transits` with
a Reading confidence label on each contact, and keyless horoscopes,
compatibility for two adults, occasion ratings, explainers and sky checks,
each with a zodiacs.org link. Its tools store and log none of the birth
details they are given (`priv.ai-links`), and they refuse a birth date less
than 13 years ago. There is no stored profile and no check-in routine,
because the bot keeps no birth details.

## Steps for Dias

1. **Make the Bot.** In the Grok Bot app choose **New Bot**, name it Zodiacs
   Astrologer, and send it the message in `SETUP-MESSAGE.md` as it is. It
   saves the rules, makes the skills and connects https://zodiacs.org/mcp.
   Check each saved skill against `skills/` and paste the file text where
   it differs.
2. **Try it** with the starter prompts in `LISTING.md`, with made-up adult
   birth details only. Check the refusals by asking in words, for example
   "read my daughter's chart, she is nine", and give no date: the bot must
   refuse and ask nothing about the child.
3. **Share it as a template, only on your yes.** Open the Bot's details,
   choose **Share**, then **Create a copy**. Check the template's details:
   its memories and skills, and no birth details anywhere. Then choose
   **Publish** and **Copy link**. Publishing makes a public link that anyone
   can open. Replace the link on /apps/ if it changes.
4. **The marketplace** (x.ai/bot/marketplace) is chosen by the Grok Bot
   team. Anything sent to xAI about the template goes only with Dias's yes.
