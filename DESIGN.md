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

Every card is a keepsake (owner-chosen 2026-10-18, direction C of the share
moments review, "the art as a keepsake"): its first screen is the art, the
signs, the title and the verdict with one action, and the rest folds away.
Anatomy, top to bottom (use only the parts a card needs, in this order):

1. The nameplate: the tilted twelve-dot mark (owner-chosen 2026-10-18: the
   ring seen as a carousel on an ellipse, nearer dots larger and opaque, far
   ones small and faint, in deeper tones of the sign hues so it reads on both
   cards; `card-kit/mark.tsx`), "Zodiacs" in EB Garamond 500 and a small
   JetBrains Mono ".org", linking to zodiacs.org. Always first, inside the
   card, so a cropped screenshot still says where it came from. The mark is
   still: nothing on the card moves on its own.
2. The keepsake head: the hero art large across the top (see Artwork below),
   the pastel sign discs of the signs the card is about set on its lower
   edge (one disc per sign, no outline and no shadow, 52px, 46px at 530px
   and below), then centred under them an italic EB Garamond kicker in the
   card's sign hue ("Two charts compared", "Life milestones"), a large serif
   title (names when the person gave them, otherwise the card's own title)
   and one muted meta line. A date, time and place in the meta line read as
   a sentence ("Saturday, 12 June 2027 at 17:00 in Florence, Italy"), with
   the time and place in ink, exactly as the person gave them. Without a time
   the card says how the sky was read ("No time given, so the sky is read at
   noon UTC."). A card about no sign (life milestones, the sky calendar)
   shows no disc, and a Moon that changes sign that day shows none.
3. The hero row, centred: a figure when the card has a number, beside an
   italic serif verdict, and one muted line centred under them. A score is a
   104px ring (92px at 530px and below) filled to the score with a conic
   sweep from the first sign's hue to the second's, the number in serif and
   "out of 100" under it, and the label "60 out of 100" for assistive
   technology. An age sits in a plain ring. Cards without a number show the
   verdict alone. The best days of a date search sit above the hero row,
   outside the fold, because they are the answer.
4. The fold: one disclosure between hairlines, "More from this reading",
   with a muted line saying what it holds ("Both charts, the score in three
   parts, the 8 closest contacts and a copy of the card") and a plus that
   turns into a minus when open. It holds everything past the first screen,
   in this order where the card has them:
   - Sign chips (pastel disc, name, one detail line), two across, stacked at
     530px. The small pastel icon discs stay the mark for chips and list
     rows; they are never replaced by artwork.
   - Number tiles: up to three, flat tone, label under a serif number. No
     bars and no filled tracks.
   - Words: a serif insight line; reasons as a list between hairlines with
     small dots in the card's hue; facts as label and value rows with
     hairlines between rows only. Clock times and degrees are set in
     JetBrains Mono. Long lists show the first few rows and fold the rest
     behind their own disclosure ("4 more contacts").
   - Links to people's pages, then "Copy the card" as an underlined text
     button with its status line.
   The horoscope keeps its day and focus controls and its reading open on
   the card, with its own "Why this reading?" disclosure, and "Copy reading"
   above its action.
5. Actions, never more than two in view: the main one as a pill in ink with
   a small arrow in a circle ("Share the reading", "Share this birthday",
   "Open printable card", "Subscribe in your calendar app"), and a second as
   underlined text with an arrow ("Open both charts", "Open the 3 May page",
   "Share the sky calendar"). Both open on zodiacs.org. A card with a share
   link leads with it, except the sky calendar, whose first job is the
   subscription; its page link moves into the fold. The horoscope's share
   link follows the day, focus or week on screen.
6. The fine print in small muted text, then, outside the card, the panel's
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
  state), `milestones-hero` and `twins-hero`. The last three were replaced
  on 2026-10-18 with the owner's picks from three new options each: Twin
  cameos (two cameo portraits facing each other in gold frames, the one
  piece with faces), Hourglass (an hourglass of pastel sand inside Saturn's
  gold ring) and Sky dial (a dial with pastel stones round the rim and a
  crescent Moon for a hand), made as portrait pieces and cropped to 3:2 for
  the masters. New pieces follow the same
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
  no text is ever set over it; only the sign discs overlap its faded foot.
  In the keepsake head it runs across the top: on desktop up to 540px wide,
  centred, at 3:2 (a pair as two 5:6 panels); at 530px and below it runs to
  the card's edges at 4:3 (a pair as two 4:5 panels). It fades about a
  sixth on the sides and top and a third at the foot, where the discs sit.
- Size budgets: the panels make no image requests, so the art is inlined,
  both twins of every piece. `node scripts/build-card-art.mjs` makes 400px
  and 480px AVIF variants of each twin (quality 36; AVIF because both twins
  must fit and at the same size it is about half the bytes of WebP) and
  JPEGs of the dark twins for the share images, from the largest sources
  there are (the sign panels' 1200px originals, the pieces' 720px masters)
  with the cards' dimming baked in (the image renderer cannot read WebP or
  AVIF). The occasions panel inlines the sign panels at
  400px and its own four pieces at 480px; the horoscope panel inlines the
  sign panels at 480px. Each panel stays under its 600 KB build budget
  (occasions about 572 KB, horoscope about 534 KB). Every image has its
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
- Share images are dark, so they use the dark twins. Since the owner's
  2026-10-18 pick the art runs across the whole picture: one piece, or the
  two sign panels side by side, the left one mirrored so the figures face
  each other, meeting across a soft dark seam. Each panel keeps the site's
  oval spotlight (ArtFrame's radial vignette), and a shade from the left
  (.94 of the void at the edge, .72 at 42% of the width, .1 from three
  quarters on) carries the words. This is the one place type sits over
  art: every line measures 5:1 or better against the art behind it, across
  all twelve sign panels and both pieces, with the longest kickers.

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

Share images: `src/server/result-preview.ts` draws five cards' keepsakes at
1200x630, as the owner picked on 2026-10-18 (direction C for each): the art
across the whole picture, the nameplate top left (the tilted mark,
"Zodiacs" and a small ".org", as on the cards), and at the bottom left the
pastel sign discs, the kicker in the first sign's hue, the serif title and
one line.

| Card | Image | Kicker, title, line |
| --- | --- | --- |
| Two charts | `/api/og/compatibility-image` | "Two charts compared", "Ana and Luis", "60 out of 100. A good match, with some work to do" |
| A date | `/api/og/occasion-image` | "Our wedding", "Ana & Luis", "69 out of 100. A good day for it" |
| A birthday | `/api/og/birthday-image` | "A birthday", "3 May birthdays", "Taurus Sun" (a cusp date: both signs, "On the cusp of Aries and Taurus") |
| Sky calendar | `/api/og/sky-calendar-image` | "Sky calendar", "The sky in your calendar", "Mercury retrograde, Sat 24 Oct to Fri 13 Nov." (no disc: it names no sign, as on its card) |
| A horoscope | `/api/og/horoscope-image` | "Horoscope for Saturday 17 October", "Leo", the reading's own line for the sign ("For Leo, …") |

Their links (`src/lib/share-results.ts`, `src/ai-tools/share-links.ts`)
carry only what the picture shows, and the server checks the last three
against the site's data before drawing: the birthday table (a link naming
a sign the date never has is refused), the sky calendar's events, and the
published horoscope window, whose line it quotes, so no text travels in a
link. A birthday's link carries the month and day, never the year. A
horoscope that has left the window keeps its picture with the sign's dates
as the line; a link to a day or week after the window's latest is refused,
since nothing is published for it yet, and a week's link names its Monday.
The scores' parts, the date's place and a reading's first passage stay on
the share page and in the link's title and description. They are sent as
JPEG at quality 90, about 90 to 130 KB: as PNG the full-width
art comes to 650 to 850 KB, over WhatsApp's 600 KB limit for a link preview
image. Every line measures 5:1 or better against the art behind it, across
all twelve signs.

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
