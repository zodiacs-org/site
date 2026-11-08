# Zodiacs in Meta's Muse: connector submission

The answers for the Muse Connector Platform form at https://platform.muse.ai
("Submit a connector"), prepared on 8 November 2026. Muse is Meta's personal
AI agent. It is live in the US only, and Dias is on the consumer waitlist in
Thailand, but the developer site opens from Thailand, so the connector can be
submitted now. Nothing is submitted without Dias's yes, and the sign-in, the
account's date of birth, Meta's terms and the final confirmations are his.

The connector is the live server the ChatGPT app, the Claude connector and
the Grok Bot template already use: https://zodiacs.org/mcp, 19 read-only
tools, no sign-in. Nothing new is built for Muse.

## Step 1, Overview

| Field | Answer |
| --- | --- |
| Connector name | Zodiacs |
| Company or developer | Zodiacs LLC |
| Product website | https://zodiacs.org/ |
| Connector icon (512 by 512, PNG or SVG) | `plugins/zodiacs-sky/assets/icon-v3.png`, the twelve sign glyphs, also at https://zodiacs.org/assets/ai/brand/zodiacs-avatar-v3.png. A copy is in Dias's Downloads as `zodiacs-icon-512.png` for the upload. |
| Payments | Does not accept payments |
| Your name | Dias types his own; Meta sees it, the directory does not show it |
| Work email | admin@zodiacs.org |
| Support email or URL | admin@zodiacs.org |
| Privacy policy URL | https://zodiacs.org/privacy/ |
| Terms of service URL | https://zodiacs.org/terms/ |

Example prompts, one per line (the birth details are made up):

```text
Is Mercury retrograde right now, and what else changes in the sky this week?
Show today's horoscope for Leo.
Read my birth chart: I was born on 3 May 1990 at 8:30 in Madrid.
What transits are coming up for me this month?
Are Leo and Scorpio compatible?
We are getting married next June in Florence. Which days look best?
```

Anything else:

```text
Zodiacs is an astrology and sky app. Its MCP server calculates the sky itself and answers with a plain reading and a link to the matching page on zodiacs.org: sky facts such as whether Mercury is retrograde, what changes in the sky in the person's time zone, daily to yearly Sun-sign horoscopes, a birth chart and dated transits from a birth date (a birth time and town are optional, and find_birthplace turns a town into coordinates and a time zone), compatibility for two adults, ratings of a day that matters, famous people's charts, the Chinese zodiac and short explainers. The same server is in review for the ChatGPT app directory and the Claude connector directory, and is published as a Grok Bot template.

Birth details are used for that one answer and never stored or logged, and links never carry a birth year, a birth time, a birthplace or the names given. The server refuses any birth date less than 13 years ago, and compatibility readings are for two adults. Forecasts carry a "Reading confidence NN%" label. Zodiacs gives no health, money, gambling or election predictions and guarantees no outcome.

To test, no account is needed: "Is Mercury retrograde right now?", "Show today's horoscope for Leo", then "Read my birth chart: born 3 May 1990 at 8:30 in Madrid" (made-up details).
```

## Step 2, Technical specs

| Field | Answer |
| --- | --- |
| Connection type | Existing MCP |
| Hosted MCP endpoint | https://zodiacs.org/mcp |
| Documentation | https://zodiacs.org/developers/ai/ |
| Authentication methods | Other: none. The server is public and read-only, with no sign-in or key. |

Access requirements:

```text
None. No account, sign-in or key is needed, and all 19 tools are read-only. MCP over streamable HTTP (protocol 2025-06-18). Rate limits apply per calling address: 40 requests a minute, and 10 a minute for event searches and transit scans. Over a limit the server answers 429 with Retry-After: 60, and a tool result says "Zodiacs is busy. Try again in a minute."
```

## Step 3, Review (Dias)

Three confirmations, each Dias's own: that we are authorized to submit the
connector and its brand assets, that submitting does not guarantee approval
or promotion, and that we agree to the Muse Connector Terms. Then Submit for
review.

## Before and after review

- Meta tests end to end. If its calls are refused with "origin-not-allowed",
  the server needs Muse's origin added to the list in `src/ai-tools/http.ts`,
  as a reviewed change.
- Many Muse users may reach the server from the same few Meta addresses, so
  the per-address limits above may need raising for them once the connector
  is approved and the traffic is visible.
- Meta wrote to early applicants that review comes in waves over weeks
  (reported 24 September 2026). Approval and editorial placement are logged
  in #879.
