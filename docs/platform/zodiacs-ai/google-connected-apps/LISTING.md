# Google Connected Apps listing

Prepared 1 November 2026 for Google Connected Console. Nothing has been
entered in the console yet; the owner does every console step
([SUBMIT-CHECKLIST.md](SUBMIT-CHECKLIST.md)). Read the blockers in
[GAP.md](GAP.md) first, above all the category.

This mirrors the other two listings, which stay as they are:
[OpenAI](../RESUBMISSION-0.5.0.md) (source of truth
`integrations/chatgpt/chatgpt-app-submission.json`) and
[Claude](../claude-directory/LISTING.md). The wording follows the approved
0.5.1 About text, cut to Google's limits.

## Connection

| Field | Entry |
| --- | --- |
| Connection type (permanent) | **MCP server** |
| MCP server endpoint | `https://zodiacs.org/mcp` |
| Domain verification file | `https://zodiacs.org/.well-known/google-connected-apps` (served from `public/.well-known/google-connected-apps`; token pending) |
| Does your server require authorization? | **No** |
| Test account | Not needed (no sign-in) |

## App details

| Field | Entry |
| --- | --- |
| Connected app name | Zodiacs |
| Category (permanent) | **Undecided: no Google category fits.** See GAP.md, gap 1. |
| Icon | `public/assets/ai/brand/zodiacs-avatar-v2.png` (512 × 512 PNG, 13,463 bytes; the tilted ring profile picture used for the Claude directory icon and the 0.5.1 OpenAI package as `plugins/zodiacs-sky/assets/icon-v2.png`, same bytes). Public copy: `https://zodiacs.org/assets/ai/brand/zodiacs-avatar-v2.png` |
| Terms of Service URL | `https://zodiacs.org/terms/` |
| Policy URL (Privacy Policy) | `https://zodiacs.org/privacy/` (needs Gemini named first; GAP.md, gap 8) |
| Website URL (optional) | `https://zodiacs.org/` |
| Support contact | `admin@zodiacs.org` (no console field is documented; use it wherever Google asks for a contact) |
| Languages | English (`en-US`) only |

### Description

One sentence under 30 words (24 words). Users see it; Google does not use it
as model instructions.

> Explore your birth chart, compare charts, read dated Sun-sign horoscopes and see the sky on days that matter, calculated for your date and place.

Longer wording, if a later console version asks for it (the approved 0.5.1
About, first and fifth paragraphs):

> Explore your birth chart, see how compatible you are with someone close to you, and read your horoscope. Zodiacs calculates the sky for the date and place you give, then tells you what astrology says about it.
>
> Zodiacs gives clear forecasts, scores and ratings, and always shows the astrology behind them. It doesn't pick investments, make health predictions or guarantee how things will turn out. If a birth time or place is missing, it says what can still be worked out instead of guessing.

### Capabilities

One per entry, none starting with a number. Google puts the category's own
capabilities above these.

- Build an interactive birth chart from a birth date, place and, if known, time
- Compare two birth charts with a compatibility score and the closest contacts between them
- Read daily and weekly Sun-sign horoscopes, with a personal week from a birth date
- See the sky on a wedding, birthday or other day that matters, with sunset and golden hour at the place
- Check sky facts such as whether Mercury is retrograde, in your own time zone
- Find famous people who share your Sun or Moon sign
- Find life milestones such as Saturn and Jupiter returns
- Subscribe to the sky calendar of Moon phases and retrogrades in Google Calendar

### Example prompts

Six; four start with `@Zodiacs` and two name Zodiacs mid-sentence. No numbers
at the start and no quotation marks, as the console requires. The birth and
wedding details are the synthetic examples already used in the other
listings' screenshots.

- @Zodiacs show today's horoscope for Leo
- @Zodiacs is Mercury retrograde right now?
- @Zodiacs compare my chart with my partner's: I was born 3 May 1990 at 8:30 in Madrid, my partner was born 10 August 1992
- @Zodiacs show this week's sky calendar for Bangkok
- We're getting married on 12 June 2027 at 17:00 in Florence, can Zodiacs show us the sky for that day?
- Help me read my birth chart with Zodiacs, I don't know my birth time

Testers should also try a plain request without the name ("What's the sky
like this week?") and the boundary cases the other hosts use: "Pick stocks
for me from my horoscope" and "Rate how compatible we are and promise it will
last" must not be answered with a guarantee or investment advice.

## Tools

Synced by the console from the server; nothing is typed in. Generated from
the live `tools/list` of 1 November 2026
([`tools-list.live-2026-11-01.json`](tools-list.live-2026-11-01.json)), which
this branch serves unchanged ([`schema-identity.txt`](schema-identity.txt)).
"Read-only" means `readOnlyHint: true`, `destructiveHint: false` and
`openWorldHint: false`, all declared explicitly.

| # | Tool | Title | Inputs (required in bold) | Annotations | Panel |
| --- | --- | --- | --- | --- | --- |
| 1 | `get_capabilities` | What Zodiacs can do | none | read-only, idempotent | none |
| 2 | `get_sky` | Sky right now | `instant`, `zone`, `bodies` | read-only | none |
| 3 | `get_upcoming_events` | Sky calendar | `from`, `to`, `zone`, `bodies`, `kinds` | read-only | `ui://zodiacs/sky-events-v4.html` |
| 4 | `check_sky_fact` | Check a sky fact | **`kind`**, `body`, `sign`, `phase`, `instant`, `date`, `zone` | read-only, idempotent | none |
| 5 | `get_horoscope` | Horoscopes | `sign`, `period`, `focus`, `date`, `zone`, `birthDate`, `birthTime`, `birthZone` | read-only | `ui://zodiacs/horoscopes-v6.html` |
| 6 | `open_chart_studio` | Chart Studio | none | read-only, idempotent | `ui://zodiacs/chart-studio-v6.html` |
| 7 | `get_occasion_sky` | The sky on a day | **`occasion`**, `date`, `searchFrom`, `searchTo`, `time`, `zone`, `latitude`, `longitude`, `place`, `names` | read-only, idempotent | `ui://zodiacs/occasions-v8.html` |
| 8 | `get_life_milestones` | Life milestones | **`birthDate`**, `time`, `zone`, `longitude` | read-only | `ui://zodiacs/occasions-v8.html` |
| 9 | `get_compatibility` | Compare two charts | **`a`**, **`b`** | read-only, idempotent | `ui://zodiacs/occasions-v8.html` |
| 10 | `find_chart_twins` | Chart twins | **`birthDate`**, `time`, `zone`, `longitude`, `latitude` | read-only, idempotent | `ui://zodiacs/occasions-v8.html` |
| 11 | `get_famous_chart` | A famous birth chart | **`name`** | read-only, idempotent | `ui://zodiacs/occasions-v8.html` |
| 12 | `get_birthday` | Your birthday | `date`, `birthDate`, `time`, `zone`, `longitude`, `year` | read-only | `ui://zodiacs/occasions-v8.html` |
| 13 | `get_sky_calendar` | Sky calendar for your calendar app | `language` | read-only | `ui://zodiacs/occasions-v8.html` |

`get_compatibility`'s `a` and `b` are each one person: a birth date with
optional time, zone, coordinates and first name, or `{ "famous": "<name>" }`.

### Tool panel settings (Availability and tools step)

| Setting | Entry |
| --- | --- |
| Enable tool | All 13 on |
| Additional context | None for every tool. Do not request locale, approximate or precise location: the tools take a time zone argument, and Google warns that over-requesting can fail review. |
| User confirmation required | Off for every tool (none sets `destructiveHint: true`) |
| UI resources tab | Expect the four current panels above; CSP `connectDomains` empty, `resourceDomains` `https://zodiacs.org` for the horoscope and occasions panels |

## Surfaces and availability

| Field | Entry |
| --- | --- |
| Products | Gemini app and Search (AI Mode). Select both if the console offers them; Google's docs do not list the product names. |
| Countries / regions | Where the platform is offered; the owner decides. The tools have no regional limits; the sky calendar has six languages, every other answer is English. |
| Languages | English |

## Screenshots

Google's documented console steps have no screenshot upload. If the preview
programme or a later console version asks for images, reuse the Claude
directory set (app only, dark theme, synthetic personal details, no prompt in
the image) with the prompts recorded in
[`../claude-directory/screenshots.json`](../claude-directory/screenshots.json):

| File | Size | Fits Google? |
| --- | --- | --- |
| `../claude-directory/02-leo-today.png` | 1520 × 1698 | Yes: horoscope panel |
| `../claude-directory/03-sky-this-week.png` | 1520 × 1424 | Yes: sky calendar |
| `../claude-directory/04-chart-studio-start.png` | 1520 × 1768 | Yes: Chart Studio |
| `../claude-directory/05-chart-without-birth-time.png` | 1440 × 1408 | Yes: Chart Studio, no birth time |
| `../claude-directory/07-wedding-card.png` | 1520 × 2134 | Yes: occasion card |
| `../claude-directory/01-choose-your-sign.png` | 1520 × 880 | Only as a supporting image: a sign picker, no answer |
| `../claude-directory/06-comparison-card.png` | 1520 × 3386 | Too tall for a carousel slot unless cropped |
| `../claude-directory/0.5.1/zodiacs-comparison-card-0.5.1.png` | 750 × 1942 | Phone layout; matches the live occasions v8 panel |
| `../claude-directory/0.5.1/zodiacs-wedding-card-0.5.1.png` | 750 × 2084 | Phone layout; matches the live occasions v8 panel |

Google's card guidance asks for carousels of 3 to 8 images of identical size;
the files differ in height, so a carousel would need them cropped or redrawn
to one size. They show the dark theme only; Gemini also has a light theme.

## Testers

Only `@gmail.com` accounts can test. Placeholder, for the owner to fill in
the console (not here, so no personal address is published):

| Tester | Google account |
| --- | --- |
| Owner | (owner's own `@gmail.com`, entered in the console only) |
| Second tester | (to be decided) |

## Reviewer notes

Paste wherever the console or the Google contact asks for testing notes:

> No account or credentials are needed. All 13 tools are read-only and keep nothing the person sends: birth and occasion details are used for that answer only. Try: @Zodiacs show today's horoscope for Leo; @Zodiacs is Mercury retrograde right now?; @Zodiacs compare my chart with my partner's: I was born 3 May 1990 at 8:30 in Madrid, my partner was born 10 August 1992; We're getting married on 12 June 2027 at 17:00 in Florence, can Zodiacs show us the sky for that day? Zodiacs declines requests to schedule things, pick investments, make health predictions or promise how things will turn out.
