# Reader levels

One page, three depths. A reader picks how well they know astrology, and the
page opens to match. Every page keeps one address and its full content in the
HTML, so search engines and readers without JavaScript see every depth.

## The three levels

| Level | Who it is for | What opens |
| --- | --- | --- |
| Beginner | "I'm new to it" | Plain words, the key parts first, a "What this means for you" line, tap any term for a one line definition |
| Intermediate | "I know my big three" | Houses, aspects and transits |
| Advanced | "I read charts myself" | Exact degrees, the 3D view, the receipt and data links |

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
- Depth that opens later rises in through the shared motion module
  (`docs/MOTION.md`), once, and reduced motion shows it at once.
- New English copy lives in `.astro` pages or CSS, not in islands, so
  localized pages are untouched.
- Copy follows the voice guide: plain words, no dashes.
