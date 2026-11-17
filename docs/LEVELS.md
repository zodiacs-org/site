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
- Depth that opens on a switch fades in once, outermost blocks only, 80ms
  apart. It does not rise, because readings stay still (`docs/MOTION.md`), and
  reduced motion shows it at once.
- The status line under the switch fills only when the reader changes level,
  so it never moves the page on load and screen readers hear it only then.
- Off the natal chart the lens rail shows at every level, because it is the
  only way back to the natal wheel.
- Moving down to Beginner and back up gives the reader back their own house
  and aspect settings. A shared `?sel=` link keeps what it points at drawn.
- New English copy lives in `.astro` pages or CSS, not in islands, so
  localized pages are untouched.
- Copy follows the voice guide: plain words, no dashes.
