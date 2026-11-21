# Zodiacs Astrologer: listing copy

The words for the Grok Bot template and for a later marketplace entry. Nothing
is published or submitted without Dias's yes.

## Name

Zodiacs Astrologer

The template page shows the Grok Bot account's display name after "by". Make
it read "by Zodiacs" before publishing.

## One-line description

Used for the template card and the marketplace entry:

```text
Reads your horoscope, the sky, and your birth chart or transits from Zodiacs' live calculations, with a link to zodiacs.org. Set up to keep no birth details and to read nothing for children under 13.
```

## Longer description

For the template page's About text, if it has one, and for a later
marketplace submission:

```text
Zodiacs Astrologer reads the sky with the same calculations as zodiacs.org. Ask whether Mercury is retrograde or read today's horoscope for your sign, with no birth details at all. For a birth chart or the transits ahead, you can choose to give your own birth date, and a time and town if you know them, for that one calculation, or calculate your chart in your own browser on zodiacs.org. Every sign, date and rating comes from Zodiacs, never from guesswork.

Forecasts are stated plainly, each with a Reading confidence label that says how specific your details were, never the odds that something happens. It makes no predictions about health, money, gambling or elections, and promises no outcomes.

The bot is set up to use your birth details only for that one answer, never to save them, never to put them in a link and never to send them anywhere but the Zodiacs calculation. The Zodiacs tools store and log none of them. Details you type pass through Grok, under xAI's own terms. Compatibility readings are for two adults. Zodiacs is not directed at children under 13: the bot collects nothing about a child under 13 and makes no reading for one, even if an adult asks.
```

## Starter prompts

Each is safe to try first, and none carries anyone's birth details:

1. Is Mercury retrograde right now, and what else changes in the sky this week?
2. Show today's horoscope for Leo.
3. How can I see my birth chart?
4. What transits are coming up for me this month?
5. Are Leo and Scorpio compatible?
6. We are getting married next June in Florence. Which days look best?

## Marketplace placement

- Category: Personal, the closest of the marketplace's eight. Check the
  category list again on the day.
- What the template page will list: the memories (the rules in
  `SETUP-MESSAGE.md`) and the six skills in `skills/`. The Zodiacs server is
  not part of a template, because Grok Bot leaves MCP servers out; rule 1
  makes every copy add it from https://zodiacs.org/mcp, with no key.

## Copy checks before publishing

- No em dashes or en dashes, and no crypto, token or market language.
- No predictions, guarantees or outcome claims.
- No promise about what Grok or xAI keeps: say what the bot is set up to do,
  and that details pass through Grok.
- No real person's birth details, and no child's details of any kind, in any
  example or screenshot.
