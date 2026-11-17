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

Never: glows, pulses, bounces, shakes, parallax, infinite loops, or motion on
text while someone reads it. Paragraphs of reading copy stay still; move the
cards, discs, figures and rings around them.

## The rule

Marks arrive. Words and controls never wait.

| Thing | Motion |
| --- | --- |
| Discs, rings, lines, figures, emblems (not the LCP element) | `draw` or `disc`, once, when first seen |
| A figure that is a picture, not text (a diagram, a key) | `rise`, once |
| Headings, paragraphs, question rows, link tiles, cards of text, forms, buttons | None. Present from the first frame |
| A result the person asked for | The settled 200 ms arrival in base.css, nothing added |
| Keyboard-driven actions | None |
| Pages opened daily: Today, horoscope pages, the horoscope hub | No entrance motion |
| Hero pictures and hero headings (LCP) | None |

## Before you mark anything

1. Is it a mark (disc, ring, line, figure)? If it is words or a control, stop.
2. Is it the page's largest picture or heading? If so, stop.
3. Is the page opened daily (Today, horoscopes)? If so, stop.
4. Does its container already have an entrance (a result block, a disclosure)? If so, stop.
5. Is the page's main button still on the first phone screen (390 x 844)?
6. Run `npm run test:motion:evidence` (once that harness has merged) and paste its summary in the PR.

## Not moving, on purpose

- Home hero, sign page mastheads, pair page heroes, horoscope heroes: the picture is the LCP element.
- Today, the horoscope hub and horoscope pages: opened daily, a reader comes for a line of text.
- Question rows, "On this page", link tiles, tool cards: words and controls that people scan.
- Result cards on every calculator: they already arrive in 200 ms; a second layer would be two entrances.
- Sign discs inside result cards: the card already arrives. One entrance per container.
- Learn figures (AspectWheel, HouseWheel, ZodiacRing): already draw in view with CSS only; left as they are.
- Event and sky pages: text only, no marks to move.
- Place autocomplete, tabs, sign pickers, aspect chips: used many times per visit, or typed.
- Empty and loading states: calculations finish in under 200 ms.
- Cross-page view transitions (ZOD-231, not built) must be checked against marked pages, because a page would be snapshotted while its marks are hidden.
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
  <figure data-enter="rise">...</figure>
  <svg data-enter="draw">
    <circle class="motion-stroke" pathLength="1" ... />
  </svg>
  <span data-enter="disc">7</span>
</Base>
```

- `draw` needs `pathLength="1"` and `class="motion-stroke"` on each stroke.
- Choreograph by hand with inline `--motion-i` (step index) or
  `--motion-delay` (extra delay).

## Guarantees

- Without `<Motion />`, without JavaScript, with reduced motion and when
  printing, everything is simply shown. The first Tab on a page shows every
  marked element at once, so keyboard readers never wait on an entrance.
- An element already above the screen (a reload lower down, a link to a
  section) is shown at once, so scrolling up finds it in place.
- A group that comes into view together staggers by at most 4 steps, so the
  last item never waits more than 280ms.
- If the runtime script fails or never runs, everything is shown after 3 s.
- Elements show as soon as any part of them is on screen (threshold 0, as with
  `.reveal`), so a tall block never sits blank while someone reads it.
- Only `opacity`, `transform` and `stroke-dashoffset` change: no layout shift.
- Never mark the LCP element: the hero heading, a hero image or poster.
  Decorative inline SVG beside the hero heading (an emblem, a seal) may
  `draw` and `disc`, since it is never the largest paint.
- After its pass an element is marked `.is-done`, so its own hover transitions
  run without the entrance delay.
- Move cards, discs, figures and rings. Never mark controls people act on
  (buttons, form fields, `<details>` summaries): they are there at once.
- The attribute is `data-enter`, and the page switch is
  `html[data-entrance]`. `data-motion` belongs to `/thesis/` figures and the
  chart explorer, so it is never used for this.
- A marked element inside another marked element in the same pass takes its
  parent's step, so a grid staggers by card, not by part.
- `.reveal` in `src/styles/base.css` stays as it is: the small heading
  entrance on pages that already use it.
