# Entrance motion

One motion language for the whole site, taken from `/thesis/`: calm, one pass,
then still. Every page uses the same module, so nobody tunes timings by hand.

| Verb   | What it does                                        | Timing                  |
| ------ | --------------------------------------------------- | ----------------------- |
| `rise` | a block fades in while rising 10px                  | 440ms                   |
| `draw` | SVG strokes draw on along their length              | 1.1s                    |
| `disc` | a round mark grows from 60% to full size, fading in | 440ms, no overshoot     |

Easing is `cubic-bezier(.23, 1, .32, 1)` throughout. Elements that come into
view together are staggered by 70ms in document order (capped at eight steps).

Never: glows, pulses, bounces, shakes, parallax, infinite loops, or motion on
text while someone reads it. Paragraphs of reading copy stay still; move the
cards, discs, figures and rings around them.

## Files

- `src/styles/motion.css`: the timings (`--motion-*` custom properties) and the
  three verbs.
- `src/components/Motion.astro`: the runtime. Two small inline scripts: one
  turns motion on (`html[data-entrance="on"]`) before marked elements are parsed,
  the other reveals each one once as it scrolls into view.
- `src/lib/motion.ts`: `motionScan(root)` for islands that render marked nodes
  later, and `motion(verb)` to spread the attribute in JSX.

## Using it on a page

```astro
---
import Motion from '../components/Motion.astro';
---
<Base ...>
  <Motion />            <!-- once, before anything marked -->
  <div data-enter="rise">...</div>
  <svg data-enter="draw">
    <circle class="motion-stroke" pathLength="1" ... />
  </svg>
  <span data-enter="disc">7</span>
</Base>
```

- `draw` needs `pathLength="1"` and `class="motion-stroke"` on each stroke.
- Choreograph by hand with inline `--motion-i` (step index) or
  `--motion-delay` (extra delay).
- From an island, after the result is in the DOM:

```tsx
import { motionScan } from '../lib/motion';
useEffect(() => { if (result) motionScan(containerRef.current ?? undefined); }, [result]);
```

  An island on a page that sits right under its first-load budget may call
  `window.zodiacsMotion?.scan(root)` directly instead (BigThreeQuick.tsx does),
  since importing `src/lib/motion.ts` adds a shared chunk.

## Guarantees

- Without `<Motion />`, without JavaScript, with reduced motion and when
  printing, everything is simply shown. The first Tab on a page shows every
  marked element at once, so keyboard readers never wait on an entrance.
  The same goes for a reader who jumps within the page: an address with a
  `#`, a link to a section on the same page, or Back to one shows every marked
  element at once, so an in-page link always lands on content that is there.
  Any `#` in the address, a share link's included, and any script that writes
  `location.hash`, turns entrances off for the rest of that visit. So does a
  page the browser scrolls by itself before the reader has moved it: a search
  result's text link (`#:~:text=`, which never reaches `location.hash`), or a
  reload or Back that restores the old position.
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
- A marked element inside another marked element takes its parent's step
  (it inherits `--motion-i`), so a grid staggers by card, not by part.
- `.reveal` in `src/styles/base.css` stays as it is: the small heading
  entrance on pages that already use it.

## Not moving, on purpose

- Moon phase and the Moon journal: the Moon readout is a live answer inside an island.
- Sky calendar: the calendar is a control.
- Birthday hub: 366 day chips, too many to move.
- Birthday date pages: the hero picture is the largest paint.
- About, support, methodology, Learn articles and the glossary: reading text.
- Occasions: a form.
- Apps: its own designed landing page.
- Ask: its three topic cards are whole `<section>`s of reading text, each with its heading.
- Translated seasons hubs and every translated sharing page: only the English pages move.
