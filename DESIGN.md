# Zodiacs.org Design Contract

This file is the brand contract for Open Design / Claude visual polish work on
the new Astro surfaces: homepage, learn, sign guides, calculators, horoscopes,
profile, and tools. The legacy Collect wing has its own handoff in
`DESIGNER_HANDOFF.md` and should not be restyled from this file.

## Core Feeling

Zodiacs.org should feel like a precise celestial tool with editorial restraint:
quiet, dark, literate, trustworthy, and slightly cinematic. It is not a crypto
landing page, not a generic astrology app, and not a loud SaaS funnel.

The approved homepage opening now follows the Ploy-style pattern:
one rounded cinematic video surface, a very large headline over the footage, a
short caption, and two clear buttons.

## Visual System

- Background: cool near-black void, not blue-slate, purple, beige, brown, or
  gold.
- Chroma: the twelve pastel zodiac sign discs are the accent system. Avoid
  adding new accent families.
- Typography: Instrument Sans for UI and large sans hero display, EB Garamond
  for editorial section headings, JetBrains Mono only for computed data.
- Surfaces: use thin hairlines and restrained depth. Avoid nested cards,
  decorative blobs, aurora gradients, and ornamental status dots.
- Motion: slow, functional, and behind `prefers-reduced-motion`. Motion should
  never become the message.
- Imagery: real zodiac/celestial artifacts, chart surfaces, sign icons, and
  computed-result previews. No vague stock mysticism.

## Brand Nameplate

One mark, one nameplate, everywhere the brand speaks:

- The mark: twelve dots in a ring, one per sign hue, drawn inline
  (`src/components/BrandMark.astro`) — the same mark as the favicon and
  the share cards. On hover of its parent link it makes one slow
  revolution; reduced motion stills it.
- The nameplate: "Zodiacs" set in EB Garamond 500 (the masthead voice),
  with ".org" as a small JetBrains Mono tag seated on the baseline.
- Used identically in the nav pill and the footer. Never a plain sans
  wordmark; never a new logo per surface.

## Voice

Plain, calm, warm, and specific.

Use:
- "Get your free birth chart"
- "See your forecasts"
- "private in your browser"
- "birth date, time, and place"
- "what it means"

Avoid:
- "whole chart" as the emotional lead
- technical sky phrasing on consumer pages
- insider profile terminology in visible product copy
- crypto or market language outside `/registry/`
- hype, urgency, scarcity, financial framing
- "vibes", "mush", "like a human", "done properly", "shows its work"
- decorative mono-caps eyebrow labels on every section

## Homepage Polish Direction

Preserve the approved top hero structure:

1. Fixed nav pill above the hero.
2. Large rounded video frame using `/assets/hero/zodiacs-hero.mp4`.
3. Poster fallback at `/assets/hero/zodiacs-hero-poster.jpg`.
4. H1: "Explore the stars behind your story."
5. Caption: "Free birth charts, moon signs, compatibility, and horoscopes —
   accurate, private, and easy to understand."
6. Primary button to `/birth-chart/`.
7. Secondary button to `/horoscopes/`.
8. The sky ticker remains visible immediately after the hero.

Polish may refine spacing, type scale, contrast, crop, responsive rhythm,
button treatment, and section-to-section flow. Do not replace the hero concept
with a split layout or a generic marketing section.

## Assistant Cards

The cards Zodiacs draws inside ChatGPT and Claude (the occasions panel's
seven cards in `src/ai-tools/occasions-panel/` and the horoscope panel in
`src/ai-tools/horoscope/`) are one family, built from the shared kit in
`src/ai-tools/card-kit/` (`parts.tsx`, `card.css`, `hue.ts`, `words.ts`).
Many people meet Zodiacs through a screenshot of one, so every card has to
read as Zodiacs on its first screen and stay legible at phone size.

Anatomy, top to bottom (use only the parts a card needs, in this order):

1. The nameplate: the twelve-dot ring, "Zodiacs" in EB Garamond 500 and a
   small JetBrains Mono ".org", linking to zodiacs.org. Always first, inside
   the card, so a cropped screenshot still says where it came from.
2. The head: an italic EB Garamond kicker in the card's sign hue ("Two charts
   compared", "Life milestones"), a large serif title (names when the person
   gave them, otherwise the card's own title) and one muted meta line, beside
   the hero art (see Artwork below). A date, time and place in the meta line
   read as a sentence ("Saturday, 12 June 2027 at 17:00 in Florence,
   Italy"), with the time and place in ink, exactly as the person gave them.
   Without a time the card says how the sky was read ("No time given, so the
   sky is read at noon UTC.").
3. The hero row, between two hairlines: an italic serif verdict and one
   muted line, beside a figure when the card has a number. A score is a 126px
   ring (102px at 530px and below) filled to the score with a conic sweep
   from the first sign's hue to the second's, the number in serif and "out
   of 100" under it, and the label "60 out of 100" for assistive technology.
   An age sits in a plain ring. Cards without a number show the verdict
   alone; the art carries the picture.
4. Sign chips (pastel disc, name, one detail line), two across, stacked at
   530px. The small pastel icon discs stay the mark for chips and list rows;
   they are never replaced by artwork.
5. Number tiles: up to three, flat tone, label under a serif number. No bars
   and no filled tracks.
6. Words: a serif insight line; reasons as a list between hairlines with
   small dots in the card's hue; facts as label and value rows with hairlines
   between rows only. Clock times and degrees are set in JetBrains Mono.
   Long lists show the first few rows and fold the rest behind a disclosure
   ("4 more contacts").
7. Actions as underlined text in the card's order: "Share the reading",
   "Open printable card" or "Open both charts", then "Copy the card". The
   sky calendar's subscribe link is the one filled button in the family.
8. The fine print in small muted text, then, outside the card, the panel's
   one-line privacy footer.

Artwork:

- The cards reuse the website redesign's sign panels: the twelve spotlit
  figures on clockwork dials in `public/assets/sign-art/<sign>-720.webp`.
  The chart comparison shows both people's Sun signs, the left panel mirrored
  so the two figures face each other; birthday, famous chart, horoscope and
  occasions other than weddings show the Sun sign's panel; a cusp birthday
  shows both signs.
- Where a sign panel does not fit, the cards use their own pieces, in
  `public/assets/card-art/<name>-720.webp`: `wedding-hero` (weddings and
  anniversaries), `sky-calendar-hero` (the sky calendar and the panel's empty
  state), `milestones-hero` and `twins-hero`. New pieces follow the same
  style: painterly, dimmed, one warm spotlight on the subject, ornate brass
  clockwork dials, the pastel sign palette as the only accents, a hero camera
  angle (frontal, slightly elevated), 3:2, no people, no text, letters or
  numbers. Prompts for the four pieces are in
  `docs/platform/zodiacs-ai/CARD-ART.md`.
- Light and dark twins: every piece, sign panels included, has a daylight
  twin with the same subject, figure, framing, camera and spotlight, painted
  on warm parchment and cream instead of the night: the dark one shows in
  the dark host theme and the daylight twin in the light theme. The twins'
  720px masters are `public/assets/card-art/<key>-light-720.webp` (sign
  panels and the cards' own pieces alike). The card carries both twins and
  the stylesheet shows one by the same host-theme rules as the colour tokens
  (`data-theme` from the host, else `prefers-color-scheme`), so nothing
  swaps after paint and the hidden twin is never decoded. A piece without a
  light twin keeps its dark picture in both themes, which is allowed only
  while its twin is being made.
- Faded edges, no frame: the picture fades into the card on every side in
  both themes, through two crossed linear masks with an eased ramp
  (`mask-image` with the `-webkit-` prefix, `mask-composite: intersect`).
  There is no plate, radius, hairline, shadow or vignette around the art,
  and no edge of a picture shows. The ramps are set per layout with
  `--fade-l`, `--fade-r`, `--fade-t` and `--fade-b` (shares of the width and
  height): about a quarter on each side for a single panel; for a pair the
  outer sides fade wider and the two panels meet across a narrow soft seam,
  the left one mirrored so the figures face each other. The dark twin is
  shown at saturate .92 and brightness .86, the daylight twin at saturate
  .94. It is decorative (empty alt, hidden from assistive technology) and
  nothing is ever set over it. On desktop it sits beside the head at 272px
  wide (3:2), or as two 4:5 panels in 300px for a pair; at 530px and below
  it goes above the kicker, full width, at 16:9 (two square panels for a
  pair).
- Size budgets: the panels make no image requests, so the art is inlined,
  both twins of every piece. `node scripts/build-card-art.mjs` makes 400px
  and 480px AVIF variants of each twin (quality 36; AVIF because both twins
  must fit and at the same size it is about half the bytes of WebP) and
  640px JPEGs of the dark twins for the share images (the image renderer
  cannot read WebP or AVIF). The occasions panel inlines the sign panels at
  400px and its own four pieces at 480px; the horoscope panel inlines the
  sign panels at 480px. Each panel stays under its 600 KB build budget
  (occasions about 572 KB, horoscope about 531 KB). Every image has its
  width and height set and decodes asynchronously. A host browser without
  AVIF shows the card without its picture, never a broken frame.
- Adding art: generate the dark piece at 1536x1024 (3:2) in the style
  above, then its daylight twin from it with the same subject, framing and
  camera, edges calm and low in detail so they fade cleanly. Name them
  `<key>-source.png` and `<key>-light-source.png`, run
  `node scripts/build-card-art.mjs --masters <dir>` for the 720px masters,
  add the key to `CARD_ART_PIECES` in `scripts/build-card-art.mjs` and to the
  panel that uses it, run `node scripts/build-card-art.mjs`, then
  `npm run ai:build`, and check both panels stay under budget. Record the
  prompts in `docs/platform/zodiacs-ai/CARD-ART.md`.
- Share images are dark cards, so they use the dark twins. The art sits in
  a 560px panel on the right, faded into the card on every side (a pair
  stacks the two sign panels, each faded top and bottom, so no seam shows),
  with the score ring in its lower corner on a dark disc so the number
  never sits on busy art.

Colour and theme:

- Dark host theme: the Cosmic Void card, `#16191f` on `#0d0f13`, a 1px
  `#34394a` hairline, 18px radius (16px at 530px), 24px padding (20px/18px
  on phones), ink `#eef1f7`, muted `#a0a8ba`. The kicker and markers use the
  pastel hue itself.
- Light host theme: the same layout on white with `#d8dbe4` hairlines, ink
  `#161922`, muted `#565e72`. Kicker text uses a deeper tone of the same hue,
  computed in `hue.ts` to read at 4.5:1 or better on white; rings, discs and
  dots keep the pastels.
- A card's hue is its subject's sign: the Sun sign (two charts: the first
  person's Sun, then the second's), the sign a milestone's planet rules,
  Scorpio and Cancer for the sky calendar. No other chroma in the interface
  and no gold accents; the artwork's own brass stays inside the picture. The
  only gradients are the score ring's sweep and the art's edge fades.

Words: plain and specific, as on the site. Scores, ratings and forecasts are
stated plainly as astrology's reading; never a guarantee, and nothing about
money or health. No em or en dashes and no middle-dot separators in card
copy: ranges read "20:13 to 20:57", lists use commas. Text a card shows but
does not own (published people copy, sign table ranges, tool notes) passes
through `plain()` in `words.ts` at display time; the tools' output and the
released contract stay byte-for-byte. No zone IDs or ISO dates on a card.

Share images: `/api/og/compatibility-image` and `/api/og/occasion-image`
(`src/server/result-preview.ts`) draw the same dark card at 1200x630: the
nameplate top left, the kicker in the first sign's hue, the serif title,
the italic verdict, sign chips and score tiles on the left, and the art
panel with the score ring on the right.

Checks before a card change ships: `node scripts/build-card-art.mjs` when
art changes, then `npm run ai:build`, `npm run ai:package`,
`npm run ai:check`, `npm run ai:test`, both browser drives
(`tests/ai-occasions-drive.ts`, `tests/ai-horoscope-drive.ts`),
`tests/ai-cards-qa.ts` (contrast, art in the theme's twin, faded on every
side, with no text over it, overflow,
keyboard, reduced motion), and full-length captures of every card at 760px
and 390px in both themes with `tests/ai-cards-capture.ts` (share images:
`tests/ai-share-images-capture.ts`). Each panel stays self-contained (no
network requests) and under its 600 KB build budget; motion stops under
`prefers-reduced-motion`.

## Guardrails

- Keep `src/lib/engine/full.ts` as the only direct `astronomy-engine` importer.
  The homepage must not load the ephemeris bundle.
- Do not edit generated output directly.
- Do not pull legacy Collect styling into new Astro pages.
- Do not introduce a third-party visual framework for this polish pass.
- Preserve accessibility: one H1, keyboard-visible buttons, readable contrast,
  reduced-motion behavior, and no content trapped inside decorative media.

## Verification

Run these before handoff:

```bash
npm run check
npm run build
npm test
node scripts/check-dist.mjs
node scripts/report-bundles.mjs
```

Also visually inspect:

- Desktop: 1280 x 720 and 1440 x 900.
- Mobile: 390 x 844 and 430 x 932.
- Reduced motion enabled.
- Homepage first viewport with the next section peeking below.
