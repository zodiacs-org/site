# Muse connector candidate, 28 October 2026

Status: prepared for a private host test. Not submitted, approved or listed.
The owner is on the Muse waitlist, so no Muse session, custom connection or
host test has been completed. No terms were accepted and no account was created.

## Candidate

Use the existing public server, `https://zodiacs.org/mcp`, release 0.5.1,
with no authentication for the thirteen current read-only tools. Reuse the
chosen tilted-ring icon, approved About text and 41-second demo from the Sky
0.5.1 release. Do not upload the OpenAI ZIP as if Muse had the same bundle
format. Do not change a tool name, input or panel address for this candidate.

Muse's [connector guidelines](https://platform.muse.ai/docs), checked on
28 October 2026, allow read-only connectors when the information is the
outcome and require value beyond a browser wrapper. Zodiacs returns computed
positions, bounded event searches and structured readings directly, with
calculation receipts and an explicit boundary between calculation and
astrological interpretation. The existing endpoint is the candidate, not
proof of compatibility inside Muse.

Meta's [connector platform](https://platform.muse.ai/) describes a separate
submission and review process. Its public guidance asks for business and data
processing information, tool documentation, reviewer access and a demo. An
owner must review the actual intake and terms before any submission. The
public guidance does not establish that Muse renders MCP Apps HTML resources.

## Direct protocol preflight

Run from this checkout on Node 22:

```sh
node tests/muse-connector-preflight.mjs --out /tmp/zodiacs-muse-preflight
```

This uses public HTTP only. It initializes with an empty capability object,
sends the initialized notification, compares all thirteen tool names and input
schemas with the repository's account-off fixture, and calls each tool with
synthetic details. It validates inputs and structured outputs, checks text
content and read-only annotations, reads all four existing HTML resources and
checks a refused unknown input. Requests are paced. A failed request stops the
probe. HTTP 429 responses receive at most two retries, each after the server’s
Retry-After delay. The probe never bypasses admission limits or changes production settings.

`preflight.json` records the completed protocol result. Full synthetic answers
and resource HTML are kept outside the repository. The check does not certify
Muse's tool selection, investment refusal, permission handling or rendering.
Studio follows its existing 2 MB repository resource budget; the other panels
follow their existing 600 KB budgets. Those are repository budgets, not
published Muse limits.

The current resources remain:

- `ui://zodiacs/sky-events-v4.html`
- `ui://zodiacs/chart-studio-v6.html`
- `ui://zodiacs/occasions-v8.html`
- `ui://zodiacs/horoscopes-v6.html`

## Private Muse test, once access is available

Use a private connection if Muse offers one to this account. Inspect its actual
setup first. If only a public submission is available, stop with the candidate
materials ready for the owner; do not substitute a public submission for a test.
Keep the production endpoint and all tool definitions unchanged.

| Test | Exact prompt | Acceptance |
| --- | --- | --- |
| Tool scope | What can Zodiacs do, and does it save what I ask? | Describes the current read-only scope and privacy from get_capabilities. |
| Public sky | Use Zodiacs to tell me where the Sun and Moon are on 28 October 2026 at 12:00 UTC. | Calculated answer, with interpretation distinguished and no invented positions. |
| Events | Use Zodiacs to find new and full Moons from 28 October to 4 November 2026, in Bangkok time. | Bounded search and honest empty result if none match. |
| Horoscope | Use Zodiacs to show today's horoscope for Leo in Bangkok. | Correct local date and published reading, first display without retry. |
| Comparison | Use Zodiacs to compare our charts. I was born 3 May 1990 at 8:30 in Madrid. My partner was born 10 August 1992, time unknown. | Correct synthetic inputs; unknown time preserved; no relationship guarantee. |
| Occasion | Use Zodiacs to make a wedding card for 12 June 2027 at 17:00 in Florence, Italy. Tell us what the sky means in astrology. | Date, time and place retained, result useful in the conversation and no guaranteed outcome. |
| Chart Studio | Open Zodiacs Chart Studio so I can explore my birth chart. | Panel opens and calculates inside the browser. If Muse cannot render it, record the failure; do not claim this workflow works. |
| Investment boundary | Tell me which stock will rise based on my horoscope. | Declines astrology-based investment suggestions without a Zodiacs call or astrology-themed investments. |
| Scheduling boundary | Use Zodiacs to remind me when Mercury goes retrograde. | Explains Zodiacs cannot schedule reminders. |

For each positive case record the actual tool and arguments, first-load result,
text quality and card behavior. For every returned card link, verify the full
query and fragment survive and the owned page opens. Test allow and deny
controls only as offered by Muse. Never disable its approval controls.

Text results and HTML resources available over MCP do not prove a native Muse
card works. If the host cannot render an offered workflow, prepare a concrete
local remedy or propose a narrower submission scope for owner review. Do not
silently hide, rename or alter tools in the public server.

## Prepared listing material

Name: Zodiacs

One-liner: Explore your birth chart, compatibility, horoscopes and the sky on
days that matter.

Product and documentation: `https://zodiacs.org/apps/` is a draft showcase in
this PR. Until it is published, use the live documentation at
`https://zodiacs.org/developers/ai/`; never give reviewers a localhost URL.

Icon: `https://zodiacs.org/assets/ai/brand/zodiacs-avatar-v2.png`

Demo: `https://zodiacs.org/assets/ai/review/zodiacs-sky-0.5.1.mp4`

Privacy: `https://zodiacs.org/privacy/#ai-integrations`

Terms: `https://zodiacs.org/terms/`

Support and business identity should be copied from the approved company
metadata when the actual intake is available. Do not invent a security contact
or promise a support response time. No credentials are needed for the current
public read-only scope; explain that accurately if an intake asks for a test
account. Account saving, authentication, Sky Watch and transactions are outside
this candidate.
