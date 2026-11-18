# Reader levels

One page, three depths. A reader picks how well they know astrology, and the
page opens to match. Every page keeps one address and its full content in the
HTML, so search engines and readers without JavaScript see every depth.

## The three levels

| Level | Who it is for | What opens |
| --- | --- | --- |
| Beginner | "I'm new to it" | The big three and the wheel with signs and planets, each reading under a "What this means for you" line |
| Intermediate | "I know my big three" | Houses, aspect lines, the chart lenses (sky now, progressed, year ahead), patterns and context |
| Advanced | "I read charts myself" | The 3D view, the exact positions table, the receipt and data links |

Beginner is the default. The choice lives in this browser only
(`localStorage` key `zodiacs-level`), never in a link and never on a server.

## Adding levels to a page

1. Put `<LevelSwitch />` once, above anything marked. It sets
   `html[data-level]` before the marked content is parsed, asks the first
   visit question, and shows the switch. Give it an `idPrefix` if a page could
   ever hold two.
2. Mark markup:
   - `data-depth="intermediate"`: shown from Intermediate up.
   - `data-depth="advanced"`: Advanced only.
   - `data-depth-only="beginner"`: Beginner only (for plainer wording that
     deeper levels replace).
3. In an island, read the level with `onLevel()` from `src/lib/level.ts`, for
   state the markup alone cannot carry (the chart calculator closes houses
   and aspect lines for Beginner, for example).

## Rules

- Nothing is hidden until a page has `<LevelSwitch />`. Every hide rule in
  `src/styles/level.css` starts with `html[data-level=...]`.
- No layout shift: the saved level and the first visit question are both
  decided by the inline script before paint. Never unhide anything from a
  bundled script on load.
- `src/styles/level.css` is inlined into the page by `<LevelSwitch />`, never
  bundled: entry pages like /birth-chart/ load their page stylesheet after
  first paint, and a late level.css let the question and the switch appear
  unstyled and then jump (a 0.126 layout shift in Lighthouse).
- Nothing that paints with the hero (the question, the switch) uses the mono
  font. Mono is not otherwise needed above the fold on chart pages, so it
  would add a font download to the first load and slow the largest paint.
- Depth that opens on a switch fades in once, outermost blocks only, 80ms
  apart. It does not rise, because readings stay still (`docs/MOTION.md`), and
  reduced motion shows it at once.
- The switch's wiring (`src/lib/level-switch.ts`) loads on idle or on the
  reader's first touch of the switch, so it stays outside the page's
  first-load script budget. A press made while it loads is replayed once it
  is in. The button for the opening level is marked by a small inline
  script before paint, so the bundled loader only schedules the wiring.
  Only `src/lib/level.ts`, which islands share, loads up front.
- The status line under the switch fills only when the reader changes level,
  so it never moves the page on load and screen readers hear it only then.
- Off the natal chart the lens rail shows at every level, because it is the
  only way back to the natal wheel.
- Moving down to Beginner and back up gives the reader back their own house
  and aspect settings. A shared `?sel=` link to a house or an aspect keeps it
  drawn.
- New English copy lives in `.astro` pages or CSS, not in islands, so
  localized pages are untouched.
- Copy follows the voice guide: plain words, no dashes.
- Browser drives written for the full chart explorer open pages at Advanced
  with `withFullLevel()` from `tests/level-fixture.mjs`. The first visit at
  Beginner is covered by the consumer experience drive (a new visitor's
  journey on a phone), the visual baselines and Lighthouse, which never seed
  a level. A new drive that reads houses, aspects, lenses, the 3D view or
  the details table on /birth-chart/ needs the fixture too.
