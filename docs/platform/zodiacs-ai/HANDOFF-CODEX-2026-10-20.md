# Handoff to Codex, 20 October 2026

Written by Claude at the end of the session that built the share images,
the brand lockup, the localized art cards, the story pictures and the
resubmission fixes. It says exactly what is left and how to do it. Read it
whole before you start, then read `CLAUDE.md` and `DESIGN.md`; both are
binding.

## Who you are working for

Dias Malayev owns zodiacs.org and is not a coder. Report to him in plain
words: what you did, what he will see, and the one thing he has to do, if
any. Do the work yourself; never hand him commands to run. Ask him before
anything that cannot be undone and before every step in the OpenAI portal.

## Rules that bite

Everything in `CLAUDE.md` applies. These are the ones this work runs into:

- **Copy.** No dashes in copy (no em or en dash used as punctuation; number
  ranges such as 1800–2199 are fine). No middle dots in copy; the lockup's
  dot in ZODIACS · ORG is the one exception. Scores and ratings are fine;
  never guarantee an outcome; no health or investment claims. The reference
  mockups below break these rules in places ("14 · famous people …"); the
  rules win.
- **Match the site.** Dias's standing instruction: "Match the site's
  outcome exactly. Don't invent a separate card style. If the site doesn't
  do something, the cards don't either." Where a mockup and the site
  differ, follow the site, as the built previews already do (see "Link
  previews follow the site" in `DESIGN.md`).
- **No token, market or crypto words** on any consumer surface, the share
  pages and pictures included.
- **Generated files.** Never hand-edit generated output. After any change
  under `src/ai-tools/`, run `npm run ai:build`, then `npm run ai:package`,
  then `npm run ai:check`, and commit the regenerated runtimes and the
  rebuilt `integrations/packages/zodiacs-developer-0.3.13.zip` with the
  source. When `tools/list` changes, recapture the flag-off fixture with
  `CAPTURE_FLAG_OFF_FIXTURE=1 npx vitest run src/ai-tools/accounts/flag-off.test.ts`.
- **Pinned files.** Never overwrite a published file under a pinned or
  dated name (OG card families v2 to v8, Registry v3 and v4, Astrofolio v4
  to v6, `zodiacs-sky-0.5.0.zip`). New versions get new names.
- **Fonts.** Self-hosted only. The share renderer (`@vercel/og`) fetches a
  font from Google whenever a glyph is missing from the fonts it was given;
  the tests forbid `fetch`, so a missing glyph fails a test. That is why the
  story arrow is drawn as SVG and why EB Garamond's Cyrillic is bundled.
  Instrument Sans is not in the renderer; its body text is Noto (Latin).
- **Functions.** All share routes go through `api/compatibility.ts` and its
  `__zodiacs_share` dispatcher (`isResultShareRoute`,
  `handleResultShareNodeRequest` in `src/server/result-preview.ts`), with a
  rewrite in `vercel.json`. Do not add a new file under `api/`.
- **Commits.** Commit regenerated output with its source. Open pull
  requests against `main`; Dias says "merge" or has said all next steps are
  approved, so merge when CI is green, then check production.

## Where things stand

Filled in at handoff; check it against GitHub before acting, since the
daily horoscope workflow commits to `main` every day at about 00:00 UTC.

<!-- STATE -->

## Task 1: finish any pull request still open from this session

Skip a PR that is already merged. For each one still open, in this order:

1. **#796 Story pictures** (`design/share-stories`). Server-only; it needs no
   Phase 1 recapture. Bring it up to date with `main` (GitHub's "Update
   branch" or a merge), wait for CI, merge.
2. **#795 Inline script minifier** (`perf/inline-scripts-2026-10`). It
   changes `package.json`, a Phase 1 template source, so the Phase 1
   evidence must be recaptured on top of the current `main` (procedure
   below). Fill the "FULL_SUITE" placeholder in its PR description with the
   full-suite result before merging.
3. **#797 Resubmission fixes** (`fix/resubmission-bugs-2026-10`). It changes
   `src/lib/share-results.ts`, also a Phase 1 template source: recapture as
   for #795, after #795 is in `main`. Then mark it ready for review, wait
   for CI, merge.

**Phase 1 recapture**, from the branch with `main` merged in and
`node_modules` installed by `npm ci` (not symlinked: 11 path-sensitive tests
fail on a symlinked copy):

```bash
# Pin "now" to noon UTC on the daily edition's date (src/data/daily.json "date").
CLOCK=2026-10-20T12:00:00Z   # use the date in src/data/daily.json
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chromium CHROMIUM_PATH=/path/to/chromium
ZODIACS_FROZEN_CLOCK=$CLOCK NODE_OPTIONS="--import=$PWD/scripts/frozen-clock.mjs --max-old-space-size=6144" npm run build
ZODIACS_FROZEN_CLOCK=$CLOCK NODE_OPTIONS="--import=$PWD/scripts/frozen-clock.mjs" node tests/phase1-acceptance-drive.mjs
npx vitest run scripts/phase1-acceptance-evidence.test.mjs
```

If the merge conflicts in `docs/acceptance/phase1/screenshots/manifest.json`,
take `main`'s copy first; the drive rewrites it and the screenshots. Commit
the manifest and every changed screenshot under
`docs/acceptance/phase1/screenshots/`. Never run `playwright install`; use
the Chromium the environment has.

**Phase 1 scope guard.** `scripts/phase1-scope-guard.mjs` fails any change
under its protected paths (the Registry wing, the SDK, the English sign
guides, Learn, `src/pages/{es,pt,fr,it}/`, `src/lib/i18n`, locale catalogs).
None of the three PRs touches them. If your own work must, add a one-time
`.github/phase1-scope-allowance.json` (`version`, `id`, `baseCommit`,
`protectedPaths`) whose `baseCommit` is `main`'s tip at the moment of merge;
if `main` moves first, update `baseCommit` and push again.

**CI notes.**

- "Build & Check" takes about 45 minutes; Lighthouse alone is about 12.
- Known flakes, rerun once before investigating: the I18n route-boundary
  check on `/es/learn/` (fixed by #790 for branches that contain it), CLS on
  the Russian calculator (0.0076), tiny CLS on Today's dated block, and CLS
  on `/ru/birth-chart/` in Browser Evidence.
- Visual baselines: when a visual check fails only by text antialiasing,
  take the CI "Browser Evidence" candidates (Chromium 149) as the new
  baselines; never regenerate them on another Chromium.
- After every merge, `main`'s own push run must be green. If its scope guard
  fails because `main` moved during the merge, dispatch "Site Check" with
  `scope_base` set to the commit before the merge.

**After each merge, check production** (Vercel deploys `main`, project
`zodiacs-org`):

- #796: open a share page such as `/share/horoscope/?s=leo&d=<today>`; the
  page offers "Save the picture for your story", and
  `/api/og/horoscope-story?s=leo&d=<today>` is a 1080 × 1920 JPEG.
- #797: on `https://zodiacs.org/mcp`, `get_sky_calendar` with
  `language: "ru"` answers with Russian titles; `get_occasion_sky` for a
  wedding with an Aries Sun writes "An Aries Sun"; `get_compatibility` with
  names Анна and Иван returns a `shareUrl` that keeps both names, and its
  preview image draws them.

## Task 2: share links, link previews and stories for the last three cards

Five chat cards have a share link with a link preview and a story picture
(compatibility, a date, a birthday, the sky calendar, a horoscope). Chart
twins, the famous chart and life milestones have none. Build them the way
the five were built, in the directions Dias picked on 18 October:

| Card | Link preview | Story |
| --- | --- | --- |
| Chart twins | B, the line as a quote | C, the keepsake |
| Famous chart | A, the name as a trophy | A |
| Life milestones | A, the number as a trophy | C, the keepsake |

The mockups are in `docs/owner-review/share-picks-2026-10-18/` (the six
pictures for these three cards). They are the picks; the built previews
already show how a pick was carried into the site's system (the art across
the picture under the void's shade, the lockup top left at 20px, the discs,
the serif-italic kicker in the card's hue, EB Garamond titles, one Noto
line). Use the existing frame, art layer, overlay, discs, lockup, story
layout and fitting helpers in `src/server/result-preview.ts`; add layouts,
not a new system.

### What each link carries

A share link carries only what its picture shows, never a birth date, time
or place (`src/lib/share-results.ts` and `src/ai-tools/share-links.ts` hold
the rule: each key once, only its own keys, every value from a fixed
vocabulary or pattern; anything else is not a share and gets 400).

- **Chart twins** (`/share/chart-twins/`): the person's Sun sign and Moon
  sign when settled (`you.sun`, `you.moon`), the first twin's directory slug
  and what they share (`twins[0].shares`), and `total`. The slug must be one
  the directory publishes (`src/ai-tools/features/people-index.json`); look
  the name up server-side, never put a name in the link.
- **Famous chart** (`/share/famous-chart/`): the person's slug only. The
  page and picture read the name, Sun sign and degree and the lede from the
  same published data the tool uses.
- **Life milestones** (`/share/milestones/`): the milestone shown (`next`,
  else the first), as its `kind` and `index`, its `age`, and its `first` and
  `last` days. Nothing else.

Add `shareUrl: z.url().nullable()` to the three output schemas in
`src/ai-tools/contracts.ts` and `src/ai-tools/features/people.ts`, fill it in
the tools, and end each tool's description with the sentence the others
use: "If they want to share it, give them the returned shareUrl exactly."
Give the three chat cards (`src/ai-tools/occasions-panel/views.tsx`) the
share action as the others have it: the share link first ("Share your chart
twins", "Share this chart", "Share your milestone"), the existing action
second.

### What each picture says

Words come from the tool's own data and the site's own copy; check every
line against the copy rules.

- **Chart twins, preview (B).** The twins piece (`twins-hero`) on the right,
  the shade on the left. The discs of the shared signs. Kicker "Your chart
  twins". The quote in EB Garamond italic behind a 3px rule in the Sun
  sign's hue, as the sky calendar story's quote: "Audrey Hepburn shares your
  Sun." (or "your Moon", "your Sun and Moon"). The line: "14 famous people
  share your Sun or Moon" (no middle dot).
- **Chart twins, story (C).** As the birthday story: the piece across the
  top, the discs, kicker "Chart twins", title "Your chart twins", the quote
  as the line, "Find your chart twins" and `zodiacs.org/chart-twins`.
- **Famous chart, preview (A).** The person's Sun sign panel. The Sun
  sign's disc. Kicker "A famous birth chart". The name as the title. An
  italic line "Cancer Sun at 13.5°" (one decimal, as the tool gives it).
  The lede in Noto. The lockup ring turns to the person's Sun sign
  (`tiltedRingDots`).
- **Famous chart, story (A).** As the mockup: the panel across the top, the
  disc, the name large, the italic Sun line, the lede, "Compare your chart
  with Frida" and `zodiacs.org/people/<slug>`. The first name is the part
  before the first space of the published name.
- **Life milestones, preview (A).** The hourglass (`milestones-hero`). The
  age in the score ring the compatibility story uses, labelled "your age".
  Kicker "Life milestones" in the hue of the sign the milestone's planet
  rules (`MILESTONE_SIGN` in `views.tsx`: Saturn, Capricorn; Jupiter,
  Sagittarius; Uranus, Aquarius), title "Your sky milestones", an italic
  line in the panel's own words (`lead` and `milestoneName` in
  `views.tsx`): "Now: your first Saturn return, at 29". The picture is drawn
  when the link is opened, so take "Next:" before `first`, "Now:" from
  `first` to `last`, and no prefix after `last` ("Your first Saturn return,
  at 29"). The dates in Noto, as the panel's `span`: "23 April to 31
  December 2026". No sign disc: milestones name no sign.
- **Life milestones, story (C).** The hourglass across the top, kicker,
  title, the ring with the age small beside the milestone line (as the
  wedding story keeps its score small), "When is yours?" and
  `zodiacs.org/occasions/milestones`.

### Checks for Task 2

Follow the existing tests in `src/server/result-preview.test.ts`,
`src/lib/share-results.test.ts` and the tools' tests:

- Every new preview is a 1200 × 630 JPEG and every story a 1080 × 1920 JPEG,
  over 40 KB and under 300 KB, rendered with `fetch` forbidden.
- The routes refuse unknown keys, repeated keys, unknown slugs, birth data
  and anything outside the vocabulary, with 400; the pictures are
  uncacheable and `noindex`, like the others.
- Text contrast at least 4.5:1 against the art behind it, measured as the
  existing contrast test does, across all twelve signs for the famous chart.
- Long names fit: test "Maximilien Robespierre" and the longest name in
  `people-index.json`.
- Add the three to `tests/ai-share-images-capture.ts` and look at every
  picture yourself before you commit. Put a contact sheet in
  `docs/owner-review/share-last-three-<date>/` for Dias.
- `vercel.json` gets the six rewrites; `node scripts/check-dist.mjs` passes.
- `DESIGN.md` ("Story pictures" and the link preview notes) and
  `RESUBMISSION-0.5.0.md` get a dated update: `tools/list` changes for these
  three tools, so the ChatGPT draft needs a rescan after the deploy.

## Task 3: long names push the chat card's main button down

On the chat cards (`src/ai-tools/occasions-panel/`), a very long pair of
names wraps the title over several lines and pushes the main button below
the first screen of the card. Fit the title the way the share renderer's
`fit()` does: step the title's size down to a floor so the longest line
fits the column, then let it wrap, so the button stays on the first screen.
Test with "Maximilien Robespierre and Wilhelmina Featherstonehaugh" in the
compatibility and wedding cards, dark and light, at 360px and 760px, with
`npx vite-node --script tests/ai-cards-qa.ts`, and keep the existing QA
passing. Then `npm run ai:build`, `ai:package`, `ai:check`.

## Task 4: the OpenAI portal, with Dias watching

Only after Tasks 1 to 3 are merged and deployed, and only with Dias's yes
for each step (`RESUBMISSION-0.5.0.md`, "Who does what", is the plan):

1. Rescan the draft so it reads the new tool descriptions and schemas.
2. Paste the About from "The listing" in `RESUBMISSION-0.5.0.md` (it lost
   its two dashes on 20 October).
3. Record what the scan says in `PORTAL_REVIEW.md`.
4. When Dias has recorded the 45-second demo (shot list in
   `RESUBMISSION-0.5.0.md`), cut it as described there and publish it at
   `public/assets/ai/review/zodiacs-sky-0.5.0.mp4`.
5. Dias authorizes the submission and confirms the attestations himself.

## Not to do without Dias

These were found during the work and are his decisions:

- Whether the chat cards keep the site's fonts and colours or follow
  ChatGPT's and Claude's own design rules (ChatGPT says not to use custom
  fonts; Claude prefers host colour tokens).
- The compatibility card's "Open both charts" link carries both people's
  full birth details in its address. It works as designed; whether to
  shorten it is a privacy choice.
- Redoing the Famous chart reveal (built for B; the story pick is A).
- A Cyrillic italic for the share renderer: no kicker is in Cyrillic today,
  so nothing needs it yet.
- The prime mark (′): Instrument Sans has none, so degree minutes fall back
  to another font on the site.
- Removing the `*.blob.core.windows.net` download allowance from Claude's
  environment settings (Dias added it so CI baselines could be downloaded).

## Definition of done

- Every PR above merged, `main` green, production checked as described.
- `npm run build && npm run check && npm test`, `node scripts/check-dist.mjs`
  and `npm run ai:check` pass on `main`.
- A short report to Dias in plain words: what is live, what he will see,
  and the portal steps waiting for his yes.
