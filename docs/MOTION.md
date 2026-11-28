# Entrance motion

One motion language for the whole site, taken from `/thesis/`: calm, one pass,
then still. Every page uses the same module, so nobody tunes timings by hand.

| Verb   | What it does                                        | Timing                  |
| ------ | --------------------------------------------------- | ----------------------- |
| `rise` | a block fades in while rising 10px                  | 440ms                   |
| `draw` | SVG strokes draw on along their length              | 1.1s                    |
| `disc` | a round mark grows from 60% to full size, fading in | 440ms, no overshoot     |

Easing is `cubic-bezier(.23, 1, .32, 1)` throughout. Elements that come into
view together are staggered by 70ms in document order (capped at four steps).

Keep reading copy still. Use discs, figures and rings alongside it, and
keep words and controls outside decorative marks. Avoid glows, pulses,
bounces, shakes, parallax and infinite loops.

## The rule

Marks always arrive. Cards, tiles and rows may rise once on pages people
visit occasionally, and on the horoscope pages. Words, controls, heroes and
results never wait, and Today never moves.

| Thing | Motion |
| --- | --- |
| Discs, rings, lines, wheels, figures, emblems (not the LCP element) | `draw` or `disc`, once, when first seen, on any page except the daily ones; a figure with real data may instead tell a story (below) |
| Cards, tiles and rows, including link cards (`<a>`) and list rows (`<li>`) | `rise`, once, on occasional pages and horoscope pages only (lists below) |
| Paragraphs of reading text, headings | None. Present from the first frame |
| Forms, form controls, buttons, `details` / `summary` | None. Present from the first frame |
| Whole sections and articles | None. Mark the cards and marks inside them instead |
| Hero pictures and hero headings (LCP) | None |
| A result the person just asked for | The 200 ms arrival in `src/styles/base.css` only. |
| Keyboard-driven actions | None |
| Daily pages | No entrance motion at all |

Occasional pages, where cards, tiles and rows may rise: the tools hub, sign
guides, learn pages, sky and event pages, people pages, birthday pages,
compatibility pair pages, life path pages, the numerology page, the seasons
hub, and the sample cards on group charts and chart twins.

Horoscope pages (the horoscope hub and the sign horoscope pages: daily,
weekly, monthly, yearly, love, career and their localized versions) follow
the same rule as occasional pages, by the site owner's choice on 24 November
2026. Their hero, period controls and reading stay still, since a period
switch crossfades the reading in place; the rows, cards and discs around the
reading may move once, and the sky wheel tells its story once (see Stories).

Daily pages, where nothing is marked: Today (`/today/` and its localized
versions).

## Before you mark anything

1. Is the page Today? If so, stop. On a horoscope page, keep the hero, the period controls and the reading still.
2. Is it a mark (disc, ring, line, wheel, figure)? Use `draw` or `disc`, or, for a figure with real data, a story (see Stories).
3. Is it a card, tile or row (a link card, a list row)? It may `rise`, once, on an occasional page.
4. Is it a paragraph, a heading, a form or control, a button, a `details` / `summary`, or a whole section? If so, stop.
5. Is it the page's largest picture or heading (LCP)? If so, stop.
6. Is it a result the person just asked for, or inside one? Keep the result's existing arrival.
7. Keep automatic stagger groups to four steps. The runtime caps them.
8. Is the page's main button still on the first phone screen (390 x 844)?
9. Run `node tests/motion-evidence.mjs --before <url> --after <url> --check` (once that harness has merged) and paste its summary in the PR.

`src/lib/motion-contract.test.ts` enforces the parts of this that can be read
from the source, including the allowed CSS properties, the runtime safeguards
and the checks for marked tags, daily pages and result blocks.

## Not moving, on purpose

- Home hero, sign page mastheads, pair page heroes, horoscope heroes: the picture or heading is the LCP element.
- Today: opened daily, a reader comes for a line of text. Nothing on it is marked, not even cards or discs.
- Horoscope readings, heroes and period controls: the reading crossfades in place when the period changes, so it never also rises.
- Paragraphs, headings, question rows' text, "On this page" lists: words people read.
- Forms, buttons, place autocomplete, tabs, sign pickers, aspect chips, `details` / `summary`: controls people act on, often many times per visit.
- Numerology result cards use the result container's 200 ms arrival. The
  desktop emblem sits beside the hero copy and is capped at 216 px.
- Whole sections and articles: too large; mark the cards and marks inside them.
- Learn figures (AspectWheel, HouseWheel, ZodiacRing): already draw in view with CSS only; left as they are.
- Empty and loading states: calculations finish in under 200 ms.
- Check marked pages during cross-page view transitions, which can snapshot a
  page while its marks are hidden.
- In a sideways scroller, mark the figure, not its items.
- Moon phase and the Moon journal: the Moon readout is a live answer inside an island.
- Sky calendar: the calendar is a control.
- Birthday hub: 366 day chips, too many to move.
- Birthday date pages: the hero picture is the largest paint. (The dial further down tells its story.)
- About, support, methodology, Learn articles and the glossary: reading text.
- Occasions: a form.
- Apps: its own designed landing page.
- Ask: its three topic cards are whole `<section>`s of reading text, each with its heading.
- Translated seasons hubs and every translated sharing page: only the English pages move.
- Compatibility hub: the two ways to start a comparison are the page's main action; an entrance held them back about half a second on a throttled phone, so they paint with the page.
- Inside a story: the headings, sentences, facts, links and controls beside the figure, and on tool pages the calculator and its result. The birth chart page's hero sample wheel and its result wheel match no story rule.

## Stories: a figure that plays once

A story is a figure with real data that arrives in an order that says
something: a ring drawn round in zodiac order, a line drawn through the year,
a cursor through one day. It plays once, in the /thesis/ manner, through the
same runtime as the three verbs, then holds still.

- Use one only where the order of arrival tells the reader something true
  about the data. Otherwise use `draw` or `disc`.
- Prefer making an existing figure tell its story over adding a second
  figure. A new plate is right only when the page has no figure for that
  data.
- Never draw a duplicate of a figure the page already has.
- A general figure takes no birth data. The Saturn return figure marks the
  ages every return falls near, never the reader's own; the calculator above
  it gives the reader's dates.

### Wiring

| Part | Rule |
| --- | --- |
| The page | Has `<Motion />`, as for any marked element. |
| The mark | One `<span class="…-go" data-enter="draw" aria-hidden="true">`: absolute, 1px tall, full width, across the middle of the figure, `pointer-events: none`. It is the only element the runtime sees. |
| The pieces | Later siblings of the mark (the `svg`, the sign discs, the numbered marks), reached with `.…-go ~ …`. One mark may serve two drawings of the same data (desktop and phone). |
| Waiting | Only under `html[data-entrance='on'] .…-go:not(.is-in) ~ …`, inside `@media screen and (prefers-reduced-motion: no-preference)`. |
| Playing | Transitions only under `.…-go:not(.is-done) ~ …` (or `.is-in:not(.is-done)`), so nothing carries a delay once the story is over. |
| Length | The runtime settles every mark at 2.6 s, so a story ends by 2.5 s. |
| Delays | From the data: each piece waits for the moment the leading line (the ring, the year line, the cursor) reaches it, set as `--t` on that piece or in the story's CSS. |
| Ending | One closing beat after the leading line: the piece the page's words point to. |

### What moves

| Thing | In a story |
| --- | --- |
| Strokes, discs, dots, ticks, sign pictures, veils | `opacity`, `transform` and `stroke-dashoffset` only |
| Small labels inside the figure (dates, km, ASC and MC, house numbers) | May fade in, by `opacity` only |
| The number in the middle of a plate | Never |
| Headings, sentences, facts, links, controls, results | Never |

- Pieces the leading line passes (ticks, sign ring, sign discs, bands) rest
  dim while waiting (opacity 0.14 to 0.2), not invisible, so the figure's
  shape is there from the first frame. Pieces that arrive (end dots, the Sun
  mark, discs, the closing beat) start at 0.
- When the finished figure would show through what is still waiting (a
  published image under the story), dim it with a veil in the surface's own
  colour, not by hiding the image: the horoscope wheel's veil uses the card's
  gradient.

### The finished picture

The markup is the finished state. With reduced motion, without JavaScript,
when printing, on a page opened at a fragment or scrolled by the browser, and
after the story, the figure is exactly what the server drew. Whatever the
story's CSS still sets once it is over (a dash the stroke's whole length, a
transform origin) draws the figure exactly as it is without the story.

### Performance

| Rule | Why |
| --- | --- |
| The story's CSS travels in the body, in an inline `<style>` just before the figure, or joins a stylesheet the page already has. Never a new head stylesheet. | The critical CSS inliner counts the head's stylesheets, and a new one there delays the first paint. |
| Nothing new is fetched while the hero loads. The Sun's year plate holds its sign discs (`data-src`) and its mono face until 200 ms after `load`, or until the plate is within 400px of the screen; `<noscript>` restores both. | Eleven discs and a 40 KB face fetched beside the hero cost the sign guides their LCP budget. |
| A story over a lazy image arms itself only if the image loaded while the figure was still below the screen (the horoscope wheel's `.is-armed` script). | The veil must never cover a picture someone is already looking at. |
| Never edit a module a pinned bundle imports (the shared `Wheel.tsx`, built into Chart Studio's pinned panel). Mirror its geometry in the story's own module, and test the mirror against the rendered figure. | `npm run ai:check` fails when the pinned panel's build changes. |

The mirror tests: `src/lib/horoscope-wheel-story.test.ts` reads the wheel
image's frame back from the rendered SVG, and
`src/lib/birth-chart-anatomy-story.test.ts` renders the birth chart page's
anatomy wheel and checks the child order, the counts and the radii its
selectors and delays depend on.

### The sitemap

A new inline SVG or new text in `<main>` changes the page's fingerprint, so
the page must be dated in the sitemap: see
`scripts/sitemap-rendered-changes.mjs`, and the loops in
`src/pages/sitemap.xml.ts` that date a whole family of pages (the sign
guides, the pair pages; the horoscope pages through
`HOROSCOPE_TEMPLATE_LASTMOD`). A story made only of classes, `data-*`
attributes, custom properties and CSS on an existing figure does not change
the fingerprint and needs no new date.

### The stories that exist

| Page | Figure | File | Kind | Leading line | Closing beat |
| --- | --- | --- | --- | --- | --- |
| Sign guides (English, Spanish, French, Italian, Portuguese, Russian) | The Sun's year ring | `src/components/guide/SunYearPlate.astro` | New plate | The year line, drawn round once from the March equinox; each sign lights and this sign's season draws as the line reaches it | The triangle joining the element's three signs, then its corners |
| Compatibility pair pages, English and translated | The angle between the two signs | `src/components/compat/PairAnglePlate.astro` | New plate | The ring, drawn round once; the other signs light as it passes, then the chord runs from the first sign to the second | The angle's arc along the ring (a ring round the one disc for a same-sign pair) |
| Full moon calendar and its 2027 page | A year of full Moons by distance | `src/components/sky/FullMoonYearPlate.astro` | New plate | The line through the full Moons, left to right at one speed; each Moon grows in as the line reaches it | The supermoon rings, then the closest and farthest labels |
| Mercury retrograde | Mercury's year, with its loops | `src/components/sky/MercuryYearPlate.astro` | New plate | The line through the year at one speed in time | The station dots, the date labels, then the shadows |
| Saturn return | Saturn's laps over a life, under "What the return actually is" | `src/pages/saturn-return/_SaturnLapsPlate.astro` (figures and geometry in `_saturn-laps.ts` beside it, tested by `tests/saturn-return-story.test.ts`) | New figure (the page had none for this) | The life line from birth, one arc per lap of 29.4 years at one speed in time; each return's disc and age arrive as the line reaches them | A ring round the first return |
| Sign horoscope pages | The sky wheel image | `src/components/HoroscopeWheelStory.astro` (geometry in `src/lib/horoscope-wheel.ts`) | Existing figure, a veil over the published image | The ring, drawn round from the page's sign in zodiac order, uncovering each sign and planet as it passes | The planets the reading draws on |
| Birthday date pages | The dial under "Where the Sun stands" | `src/components/birthday/BirthdayDial.astro` | Existing figure (it no longer rises) | The ring, drawn round from the top in zodiac order, then the decans, the arc of the noon Sun across the years and the Sun marker | The date's own tick at full strength |
| Rising sign | The one-day strip of risings | `src/pages/rising-sign/index.astro` | Existing figure | A cursor from midnight to midnight at one pace; each band lights and each pin arrives at its minute | The discs of the longest and shortest bands |
| Birth chart | The numbered anatomy wheel under "What you get" | `src/pages/birth-chart/index.astro` with `src/lib/birth-chart-anatomy-story.ts` | Existing figure (the shared `Wheel`, untouched) | The sign ring, drawn round from the rising degree, then the houses, then the planets in zodiac order; each numbered mark arrives with its part | The last aspect chord |

### Before you build one

1. Does the page already have a figure for this data? Make that figure tell
   its story; do not add a second one.
2. Does the order of arrival say something true about the data? If not, use
   `draw` or `disc`.
3. One mark, a 1px line across the figure's middle; pieces are its later
   siblings.
4. Waiting states only under `html[data-entrance='on']` and `:not(.is-in)`;
   transitions only until `.is-done`.
5. Every delay comes from the data; the pass, closing beat included, ends by
   2.5 s.
6. Only `opacity`, `transform` and `stroke-dashoffset`. Words, controls and
   results never move.
7. Check the finished picture with reduced motion, without JavaScript, in
   print and at a fragment.
8. CSS in the body before the figure; nothing new fetched beside the hero.
9. Does it import or change a module a pinned bundle imports? Mirror the
   geometry instead, and test it against the rendered figure.
10. New inline SVG or new text in `<main>`? Date the page in the sitemap.

## Files

- `src/styles/motion.css`: the timings (`--motion-*` custom properties) and the
  three verbs.
- `src/components/Motion.astro`: the runtime. Two small inline scripts: one
  turns motion on (`html[data-entrance="on"]`) before marked elements are parsed,
  the other reveals each one once as it scrolls into view.

## Using it on a page

```astro
---
import Motion from '../components/Motion.astro';
---
<Base ...>
  <section class="section--tight container">
    <Motion />          <!-- once, inside the first section, before anything marked -->
    <svg data-enter="draw" aria-hidden="true">
      <circle class="motion-stroke" pathLength="1" ... />
    </svg>
    <a class="tile" href="/numerology/life-path/7/" data-enter="rise">
      <span data-enter="disc" aria-hidden="true">7</span>
      <span>Life Path 7</span>
    </a>
  </section>
</Base>
```

- Put `<Motion />` inside the first `<section>` or hero wrapper, never before
  it: its script tags would stop that section being `main`'s first child,
  which changes its top padding by 20 px.

- `draw` needs `pathLength="1"` and `class="motion-stroke"` on each stroke.
  A story drives its own strokes and may set `pathLength="1"` on them, or,
  when it must not add attributes to the figure (a shared component, a
  drawing whose sitemap fingerprint must stay), set `stroke-dasharray` and
  `stroke-dashoffset` in CSS from the strokes' real lengths, computed from the
  same geometry (the birth chart wheel, the birthday dial).
- Choreograph by hand with inline `--motion-i` (step index) or
  `--motion-delay` (extra delay).
- An island that adds marks after the page loads (never a result the person
  asked for) can call `window.zodiacsMotion?.scan(root)` after rendering them.

## Guarantees

- Without `<Motion />`, without JavaScript or Intersection Observer, with
  reduced motion and when printing, everything is simply shown. The first Tab
  on a page shows every marked element at once, so keyboard readers never
  wait on an entrance. The same goes for a reader who jumps within the page:
  an address with a `#`, a link to a section on the same page, or Back to one
  shows every marked element at once, so an in-page link always lands on
  content that is there. Any `#` in the address, a share link's included, and
  any script that writes `location.hash`, turns entrances off for the rest of
  that visit. So does a page the browser scrolls by itself before the reader
  has moved it: a search result's text link (`#:~:text=`, which never reaches
  `location.hash`), or a reload or Back that restores the old position.
- Marks already above the screen are shown at once. A jump without a `#`,
  such as End or a script scrolling the page, never leaves a mark it passed
  hidden: the next scroll frame shows it.
- The runtime picks marks up while the document is still parsing, so the
  first ones do not wait for the whole page. Elements show as soon as any
  part of them is on screen (threshold 0, as with `.reveal`), so a tall block
  never sits blank while someone reads it. A story's mark is a 1px line
  across the middle of its figure, so the story starts when that middle is on
  screen. The automatic stagger stops at
  four steps (at most 280 ms).
- If the runtime throws during startup, everything is shown at once. If the
  switch runs and the runtime never starts, it switches off after 3 seconds.
- Only `opacity`, `transform` and `stroke-dashoffset` change: no layout shift.
- Never mark the LCP element: the hero heading, a hero image or poster.
  Decorative inline SVG beside the hero heading (an emblem, a seal) may
  `draw` and `disc`, since it is never the largest paint.
- On `transitionend`, the runtime marks the element `.is-done` so its own
  hover transitions run without the entrance delay. A timer also settles
  draws, whose transitions run on their strokes.
- The attribute is `data-enter`, and the page switch is
  `html[data-entrance]`. `data-motion` belongs to `/thesis/` figures and the
  chart explorer, so it is never used for this.
- A marked element inside another marked element takes its parent's step
  (it inherits `--motion-i`), so a grid staggers by card, not by part.
- `.reveal` in `src/styles/base.css` stays as it is: the small heading
  entrance on pages that already use it.
