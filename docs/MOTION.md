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
  turns motion on (`html[data-motion="on"]`) before marked elements are parsed,
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
  <div data-motion="rise">...</div>
  <svg data-motion="draw">
    <circle class="motion-stroke" pathLength="1" ... />
  </svg>
  <span data-motion="disc">7</span>
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

## Guarantees

- Without `<Motion />`, without JavaScript, with reduced motion, when printing
  and while a keyboard user has focus visible, everything is simply shown.
- Only `opacity`, `transform` and `stroke-dashoffset` change: no layout shift.
- Never mark the LCP element (the hero heading, hero art or poster).
- After its pass an element is marked `.is-done`, so its own hover transitions
  run without the entrance delay.
- `.reveal` in `src/styles/base.css` stays as it is: the small heading
  entrance on pages that already use it.
