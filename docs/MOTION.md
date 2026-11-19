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
visit occasionally. Words, controls, heroes and results never wait, and the
daily pages never move.

| Thing | Motion |
| --- | --- |
| Discs, rings, lines, wheels, figures, emblems (not the LCP element) | `draw` or `disc`, once, when first seen, on any page except the daily ones |
| Cards, tiles and rows, including link cards (`<a>`) and list rows (`<li>`) | `rise`, once, on occasional pages only (list below) |
| Paragraphs of reading text, headings | None. Present from the first frame |
| Forms, form controls, buttons, `details` / `summary` | None. Present from the first frame |
| Whole sections and articles | None. Mark the cards and marks inside them instead |
| Hero pictures and hero headings (LCP) | None |
| A result the person just asked for | The 200 ms arrival in `src/styles/base.css`. Big Three keeps its shipped card and disc entrances. |
| Keyboard-driven actions | None |
| Daily pages | No entrance motion at all |

Occasional pages, where cards, tiles and rows may rise: the tools hub, sign
guides, learn pages, sky and event pages, people pages, birthday pages,
compatibility pair pages, life path pages and the numerology page.

Daily pages, where nothing is marked: Today (`/today/` and its localized
versions), the horoscope hub and the sign horoscope pages (daily, weekly,
monthly, yearly, love, career and their localized versions).

## Before you mark anything

1. Is the page a daily one (Today, the horoscope hub, a sign horoscope)? If so, stop.
2. Is it a mark (disc, ring, line, wheel, figure)? Use `draw` or `disc`.
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
- Today, the horoscope hub and sign horoscope pages: opened daily, a reader comes for a line of text. Nothing on them is marked, not even cards or discs.
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
  <Motion />            <!-- once, before anything marked -->
  <svg data-enter="draw" aria-hidden="true">
    <circle class="motion-stroke" pathLength="1" ... />
  </svg>
  <a class="tile" href="/numerology/life-path/7/" data-enter="rise">
    <span data-enter="disc" aria-hidden="true">7</span>
    <span>Life Path 7</span>
  </a>
</Base>
```

- `draw` needs `pathLength="1"` and `class="motion-stroke"` on each stroke.
- Choreograph by hand with inline `--motion-i` (step index) or
  `--motion-delay` (extra delay).
- An island that adds marks after the page loads can call
  `window.zodiacsMotion?.scan(root)` after rendering them. Big Three uses this
  call for its existing result entrances without importing a shared chunk.

## Guarantees

- Without `<Motion />`, JavaScript or Intersection Observer, and with reduced
  motion or when printing, everything is shown immediately.
- The first Tab, a same-page fragment link, or navigation to a nonempty
  fragment shows all marks immediately and skips entrances for the rest of
  the visit. A page opened with a nonempty fragment starts still.
- Marks already above the viewport are shown immediately. On a scroll jump
  without a fragment, such as End or scroll restoration, the next scroll
  frame shows any waiting marks the jump passed.
- The runtime scans while the document is parsing. Entrances trigger when
  any part of a mark reaches the viewport (threshold 0, as with `.reveal`).
  The automatic stagger adds at most 280 ms.
- If the runtime throws during startup, everything is shown immediately. If
  the initial switch runs and the runtime never starts, it switches off
  after 3 seconds.
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
