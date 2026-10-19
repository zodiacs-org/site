# Occasions: "The sky on…" and life-cycle milestones

The design below began on 11 October 2026. Owner direction: keep these
features in the Zodiacs plugin rather than create separate plugins.

## Current release — 15 October 2026

Version 0.5.0 is enabled in production. The anonymous usage migration was
applied and verified before staging. Merged-main staging passed 18 checks
and 14 tool calls; the natural-language host checks passed in both web hosts,
and the owner accepted the iPhone functional checks. Pastel sign icons and the
twelve-color ring were checked in the refreshed cards.

`ZODIACS_OCCASIONS_ENABLED=1` is set for Production only. The rebuilt public
server offers thirteen read-only tools, all seven new tools returned results,
the updated privacy disclosure is live, and anonymous production counts
were verified for the seven new tool names.

The current shared panel is `ui://zodiacs/occasions-v3.html` (15 October: the
comparison counts add up and famous people's dates read as dates); the v2 and v1
addresses remain readable for existing conversations. Calendar, horoscope and Chart
Studio resource addresses were also refreshed to prevent stale host branding.

The public name is **Zodiacs**, with **Birth charts & horoscopes** as its
subtitle. The owner confirmed that the previous OpenAI plugin was deleted
and directed a new public plugin submission. The existing directory connector
remains the target for the other host. The replacement OpenAI listing is now
in review, and the existing connector's reviewer has been notified of all seven
added tools. `PORTAL_REVIEW.md` and `claude-directory/LISTING.md` record the
submission and notification; directory approval is still pending.

The dated specification and 14 October status below are historical context.
Remembrance and personal yearly reminders are still outside this release.

## What it is

People reach for astrology at life's events: a wedding, a birthday, a baby on
the way, a new home, a loss. Zodiacs answers with the sky itself, computed for
the date and place, plus astrology offered as interpretation, and a keepsake
card people can print or share.

It follows the 8 October rule: **no predictions.** Zodiacs never picks,
ranks or recommends a date, and never promises how a marriage, a child or a
year will turn out. For "which date is best?" it gives the facts for each date
the person names and says plainly that it doesn't choose dates.

## The pieces

### 1. `get_occasion_sky`: the sky on a day (MCP tool, website pages)

Input: `date` (required), `time` (optional, local), `place` (optional:
name or latitude/longitude plus IANA zone), `occasion` (one of the list
below), `names` (optional, at most two short first names for the card, never
stored).

Output:

- **The sky:** Sun, Moon and planet signs, Mercury and other retrogrades,
  the Moon's phase and how lit it is, and exact alignments within a day.
- **The evening sky** (only when a place is given): sunset, golden hour (Sun
  6° down to the horizon), civil dusk (Sun 6° below), moonrise and moonset,
  how high the Moon stands at the event time, and which bright planets are
  above the horizon after dusk.
- **Lines to use:** three or four short sentences the assistant can turn into
  a toast, card message or invitation line, written for the occasion.
- **Keepsake card:** a panel in ChatGPT and Claude, a printable page on the
  site, and a share image. The link carries the date in the URL; nothing is
  stored.
- **Guest link** (weddings, met-day, showers): a page where each guest enters
  only their birthday and sees their Sun sign beside the couple's sky. It
  computes in the browser and stores nothing.

Occasions and their framing:

| Occasion | Card title | Notes |
| --- | --- | --- |
| `wedding` | The sky on your wedding day | Evening planner is most useful here. |
| `anniversary` | The sky on the day you married | Pairs with the yearly reminder. |
| `met` | The sky the night you met | Side by side with the wedding card. |
| `birthday` | Your birthday sky | Adds that year's Sun return time. |
| `baby` | The sky the day you arrived | Newborn keepsake, from the birth time if known. |
| `due-window` | The sky around your due date | Facts across a window; see below. |
| `pet` | The sky on [name]'s day | Birthday or adoption day. |
| `home` | The sky the day you got the keys | Also new job, graduation, retirement. |
| `coming-of-age` | The sky on your 18th | Also 21st, quinceañera; plain wording. |
| `remembrance` | The sky the night they were born | Quiet wording, no "celebrate", built last, copy shown to the owner first. |
| `gathering` | Tonight's sky | Eclipse, meteor-shower or full-moon evenings, linked from upcoming events. |

**Due-date windows** state facts, not odds: "Between 14 October and 11
November the Sun is in Libra until 23 October, then Scorpio." No "most
likely" sign and no sex assumptions.

### 2. `get_life_milestones`: astrology's own milestones (MCP tool, website)

Input: `birthDate` (required), optional time and zone.

Output:

- **Returns:** Jupiter returns (about every 12 years), Saturn returns (about
  29, 58, 88), the Uranus opposition (about 42), with every pass when a
  retrograde loop makes a return three passes long.
- **Sky numbers:** full moons, Mercury retrogrades and Jupiter returns lived
  through, as of today.
- **Next milestone:** the nearest upcoming one, with its dates.

### 3. Yearly reminders

The existing sky calendar feed gains personal dates. The person adds a
birthday or anniversary, and the feed gets one event a year, with that
year's sky facts. The date lives in the feed URL, not in our database.

### 4. Website

Pages under `/occasions/`: weddings, birthdays, baby showers, Saturn return,
the evening-sky planner, and the guest page. Each has its own search intent;
all run on one module, `src/lib/occasions/`.

## How it is built

- One module, `src/lib/occasions/`, computes everything server-side with the
  engine already vendored:
  - positions, phase and retrogrades from the compute API functions;
  - rise, set and transits from `@zodiacs/engine/sky`;
  - golden hour and civil dusk through astronomy-engine's altitude search, in
    a server-only adapter like `server-ephemeris.ts`;
  - returns from `src/lib/engine/returns.ts`.
- Two new tools in `src/ai-tools/contracts.ts` and `tools.ts`, shown only
  when `ZODIACS_OCCASIONS_ENABLED=1` (a new filter in `offeredTools`). The
  production setting stays off until the current ChatGPT review ends.
- One new self-contained panel, `occasions-v1`, built like the horoscope
  panel. The share image comes from the existing `@vercel/og` card renderer.
- A new usage-counts migration adds the two tool names. The ChatGPT
  submission file, evaluation cases and drives are updated in the release
  pull request that turns the setting on.

## Release order

1. The module, the website pages and the printable cards go live on the site.
   The plugin is unchanged.
2. The tools and panel are built behind the setting and checked on staging.
3. The owner applies the usage-count migration, the setting is switched on in
   production, and Zodiacs Sky 0.5.0 goes to both stores as one update.

On 14 October the owner chose one larger release over restoring the deleted
0.4.0 review (OpenAI case 17133838): 0.5.0 carries everything below and is
submitted as a new version of the existing Zodiacs plugin. Remembrance ships
last, after the owner has read its wording; it is not in 0.5.0.

## Status, 14 October 2026

- **Step 1 is done.** The module (#712) and the three pages (#720:
  `/occasions/`, `/occasions/milestones/`, `/occasions/baby-shower/`) are live.
- **Step 2 is built.** Behind `ZODIACS_OCCASIONS_ENABLED=1` the hosted server
  offers seven tools beyond 0.4.0, all sharing the `occasions-v1` panel
  (`src/ai-tools/occasions-panel/`):
  - `get_occasion_sky` and `get_life_milestones` (#734, panel #739);
  - `get_compatibility`: two charts compared, the closest contacts with the
    site's own wording, element and mode balance; never a score or verdict
    (`src/ai-tools/features/compatibility.ts`);
  - `find_chart_twins` and `get_famous_chart`: the 104 people the site's
    directory publishes, from a compact index that `ai:build` writes and
    `ai:check` verifies (`scripts/build-ai-people.mjs`); a name Zodiacs does
    not publish gets `found: false`, never an invented chart;
  - `get_birthday`: the birthday page's facts (sign, decan, cusp by year) and,
    with a full birth date, that year's solar return;
  - `get_sky_calendar`: the subscribe links for the published `.ics` feeds and
    how to add them in Google, Apple and Outlook.
  - `get_birthday`, `get_sky_calendar` and `get_horoscope` also return a
    `shareUrl` (`src/ai-tools/share-links.ts`), as `get_occasion_sky` and
    `get_compatibility` do: a birthday's month and day (never the year), the
    calendar's next event, or the reading's sign, date and focus. The
    horoscope panel carries one per day, focus and week it can show. Their
    pages and preview images are in `src/server/result-preview.ts`
    (DESIGN.md, "Share images").
- **Switched off**, the server lists and runs none of them, and capabilities,
  privacy text and the privacy page keep their public-sky wording.
  **Switched on**, capabilities add what the tools take, and the privacy page
  (built with the same variable) says what they take and that they store
  nothing (claim `priv.ai-occasion-tools`).
- **Links:** every zodiacs.org link the tools return ends in `?ref=chatgpt` or
  `?ref=assistant`. The page records an allowlisted `assistant_arrival` event
  with only that name and removes it from the address (claim
  `priv.assistant-arrival`). Calendar feed addresses stay untagged.
- **Usage counts: built, not applied.** The migration
  `20261013144500_zodiacs_mcp_usage_occasion_tools.sql` now lists all seven
  names. The owner applies it in the Supabase SQL editor before the switch
  goes on; until then counting those calls fails quietly and never affects a
  reply.

### Switch-on, in order

1. The owner applies the migration in production.
2. `ZODIACS_OCCASIONS_ENABLED=1` is set for Production in Vercel and the site
   redeployed, so the server and the privacy page change together.
3. The submission (0.5.0 package, test cases and screenshots) goes to OpenAI
   and Claude; the owner or Codex submits.

## Samples (real computed facts)

**Wedding, Florence, 12 June 2027, 19:00.** Sun in Gemini, Moon in Libra,
first-quarter Moon 64% lit. Venus in Gemini; Mercury is retrograde in Cancer
that day. Golden hour 20:13–20:57, sunset 20:57, civil dusk 21:33. The Moon
rose at 14:25 and is highest at 20:14, so it stands over the evening.
Jupiter (in Leo) and Mars (in Virgo) are up after dark; Venus has set (19:31).

**Saturn-return birthday, born 15 March 1997.** Sun in Pisces. Saturn returns
to its birth position on 23 April 2026, passes back over it on 19 November
2026 and finishes on 31 December 2026. Next Saturn return 2055–56. Jupiter
returns: February 2009, February 2021, January 2033. As of 11 October 2026:
366 full moons and 93 Mercury retrogrades lived through.

**Due window, due 28 October 2026 (14 October – 11 November).** Sun in Libra
until 23 October, Scorpio from 23 October.
