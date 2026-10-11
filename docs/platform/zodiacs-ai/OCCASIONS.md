# Occasions: "The sky on…" and life-cycle milestones

Status: spec, 11 October 2026. Owner direction the same day: build all of it,
consolidated into the existing Zodiacs Sky plugin rather than separate plugins.

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
3. After OpenAI approves the current version, the setting is switched on in
   production and Zodiacs Sky 0.5.0 goes to both stores as one update.

Remembrance ships last in each step, after the owner has read its wording.

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
