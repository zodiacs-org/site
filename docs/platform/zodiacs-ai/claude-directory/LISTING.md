# Claude directory listing — draft

Prepared 7 October 2026 from Anthropic's [connector submission guide], [plugin
submission guide] and [publishing overview]. Nothing has been submitted. The
owner chooses the account, answers the data-handling and compliance questions,
and clicks Submit.

[connector submission guide]: https://claude.com/docs/connectors/building/submission
[plugin submission guide]: https://claude.com/docs/plugins/submit
[publishing overview]: https://claude.com/docs/directory/publish

## Order

Decided 7 October 2026: submit now, with the live server as it is.

**Submitted 7 October 2026, about 16:25 UTC,** from the Zodiacs-org account
(admin@zodiacs.org, Pro). Codex filled in the form and the owner submitted it.
The portal shows "In review", and the reviewer emails the primary contact if
they need anything. Categories chosen: Media & Entertainment, Education (the
portal has no Lifestyle category).

1. Submit from the paid admin@zodiacs.org Claude account (Pro; Free can't
   submit). The listing belongs to the organization you submit from.
2. Submit the server as an **MCP connector**. A **plugin bundle** for
   `plugins/zodiacs-sky` is optional and can follow.
3. After OpenAI's review of 0.4.0 ends, re-test this branch's panels in ChatGPT
   on staging, then merge. Claude users then get the two panel fixes
   automatically, with no resubmission: panels grow to fit their content
   instead of scrolling inside a short frame, and links open through Claude.

Claude's review doesn't require those fixes. It scans each submission
automatically and lists it as a Community connector by default.

Submit at https://claude.ai/directory/manage → **Submit new** → **MCP connector**.

## Connection

- Server URL: `https://zodiacs.org/mcp`
- Users connect to one URL.

## Tools

The portal reads these from the server. Checked against the live server on
7 October 2026: six tools, each with a title, `readOnlyHint: true`,
`destructiveHint: false` and `openWorldHint: false`. All six returned results.

The portal's Tools step then flagged two things this check missed: each tool
also needs `annotations.title`, not only a top-level `title`, and it wanted an
API documentation link in `check_sky_fact`'s description. Codex fixed both in
[#687](https://github.com/zodiacs-org/site/pull/687), merged and live at
16:16 UTC, before submitting. This changed the live tool metadata while OpenAI
was reviewing 0.4.0. Names, schemas and behavior are unchanged.

| Tool | Title | Panel |
| --- | --- | --- |
| `get_capabilities` | What Zodiacs can do | — |
| `get_sky` | Sky right now | — |
| `get_upcoming_events` | Sky calendar | Sky calendar |
| `check_sky_fact` | Check a sky fact | — |
| `get_horoscope` | Horoscopes | Horoscope panel |
| `open_chart_studio` | Chart Studio | Chart Studio |

## Listing

| Field | Entry |
| --- | --- |
| Server name (100 max) | Zodiacs |
| One-liner (200 max) | Check what's happening in the sky, read the horoscope for your sign, and explore your own birth chart. |
| Categories (1–5) | The closest the portal offers to Lifestyle, then Education |
| Documentation URL | https://zodiacs.org/developers/ai/ |
| Privacy policy URL | https://zodiacs.org/privacy/ |
| Support contact | admin@zodiacs.org |
| Icon | `plugins/zodiacs-sky/assets/icon.png` (512 × 512 PNG) |
| URL slug | `zodiacs` (permanent once published) |
| Allowed link URIs | `https://zodiacs.org` |

Description (1,082 of 2,000 characters). This is the wording already approved
for the ChatGPT listing, minus its last sentence, which pointed to links on the
ChatGPT profile. Anthropic can't edit it after submission.

> Developed by Zodiacs LLC, the operator of Zodiacs.org. See what's changing in the sky this week, check whether a planet is retrograde, read the horoscope for your sign, and explore your own birth chart. No account is needed.
>
> Zodiacs calculates the sky; what it means in astrology is offered as interpretation, for reflection. Horoscopes are dated Sun-sign readings written for your own day, in your time zone. Chart Studio asks for your birth date, place and, if you know it, time, and works out the chart inside the panel without saving it. The assistant sees only what you choose to share. Without a birth time, it shows what can still be known and says which parts it can't show, rather than guessing.
>
> The sky calendar covers planets changing sign, turning retrograde or direct, and new and full Moons, up to 92 days at a time. Zodiacs does not list eclipses, set reminders or make personal predictions.
>
> Official website: https://zodiacs.org/ . Company and contact: https://zodiacs.org/about/ . Support: admin@zodiacs.org . How we calculate: https://zodiacs.org/methodology/ .

## Carousel screenshots

Five PNGs in this folder, made by `tests/claude-directory-shots.ts` from this
branch's panels with live answers from the server: dark theme, Bangkok time,
1,440–1,520 pixels wide, the app only, no prompt in the image. The birth date
in 05 is made up.

| File | Paired prompt |
| --- | --- |
| `01-choose-your-sign.png` | Show my horoscope for today |
| `02-leo-today.png` | Show today's horoscope for Leo. |
| `03-sky-this-week.png` | Use Zodiacs to show this week's sky calendar for Bangkok. |
| `04-chart-studio-start.png` | Help me read my birth chart. |
| `05-chart-without-birth-time.png` | Help me read my birth chart. I don't know my birth time. |

Re-run the script just before submitting so the readings and dates are current.

## Use cases

- Primary use cases: what changes in the sky this week, in the person's own
  time zone; yes-or-no sky checks, such as whether Mercury is retrograde;
  today's, tomorrow's or this week's horoscope for a Sun sign; exploring one's
  own birth chart in Chart Studio.
- What users need first: nothing. No account, plan or setup.
- Reads or writes: reads only.

## Company

- Company: Zodiacs LLC
- Website: https://zodiacs.org/
- Primary contact for review updates: admin@zodiacs.org

## Authentication

No authentication. Everything the server returns is public data or is worked
out inside the person's own panel.

## Data handling — owner to confirm

Suggested answers, based on how the server works. They are disclosures, so the
owner confirms each one.

- Underlying API: our own. Zodiacs computes and serves everything itself.
- Personal health data: no.
- Sponsored content: no.

## Test & launch

Paste into the reviewer instructions:

> No account or credentials are needed. Add `https://zodiacs.org/mcp` as a custom connector (Customize → Connectors), then try:
>
> 1. "Use Zodiacs to show this week's sky calendar for Bangkok." Shows the sky calendar with times in Bangkok.
> 2. "Is Mercury retrograde right now, and where is it?" Answers yes or no with dates and Mercury's current sign.
> 3. "Show today's horoscope for Leo." Shows the horoscope panel with today's dated reading.
> 4. "Help me read my birth chart." Opens Chart Studio, which asks for a birth date and place; a made-up date works. "I don't know my birth time" makes a chart without houses.
> 5. "What can Zodiacs check for me?" Lists what Zodiacs can and can't do.
>
> Zodiacs declines requests to schedule things, pick investments or promise personal outcomes.

In Claude, name Zodiacs in the calendar prompt. Asked plainly "What's
happening in the sky this week?", Claude read it as stargazing and searched
the web instead.

The portal also asks you to confirm you ran every tool yourself. Every tool was
run against the live server on 7 October 2026. In Claude, through a custom
connector, the horoscope panel, a Mercury question, Chart Studio and the sky
calendar were tried the same day. The calendar showed in full, with no
scrolling inside its frame.

## Compliance

Seven acknowledgments: directory guidelines, first-party API use, financial
transactions, AI media generation, prompt injection, conversation data
collection and public documentation. The owner reads and ticks them.

## Plugin bundle (optional, later)

- Repository `zodiacs-org/site`, plugin path `plugins/zodiacs-sky`, branch `main`.
- `claude plugin validate plugins/zodiacs-sky` must pass on Claude Code 2.1.281
  or later. Older versions reject the directory fields (`icon`,
  `documentationUrl`, `supportUrl`, `privacyPolicyUrl`, `termsOfServiceUrl`).
  Without those fields, it passes on 2.1.81.
- The portal needs a GitHub account with push access connected on claude.ai.
- After publishing, every merge to `main` that touches `plugins/zodiacs-sky`
  becomes a new version, checked by the directory before it goes live. Keep the
  default where a reviewer publishes each version.
- Its data-handling step asks whether the plugin reads or stores personal data,
  sends data to services other than its declared connectors, how long it keeps
  data, and whether it's meant for people under 18. The owner answers these.

## After submitting

Anthropic scans the connector automatically and lists it as a Community
connector by default; a reviewer may also test each tool. Status and feedback
appear at https://claude.ai/directory/manage. Escalations go to
mcp-review@anthropic.com.
