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

## Brand Lockup

One lockup wherever the brand signs its work (owner-chosen 2026-10-19): the
tilted twelve-dot ring and ZODIACS · ORG. Its numbers live in
`src/lib/brand-lockup.mjs`, and every surface draws from them.

- The ring: the twelve sign dots seen tilted, as a carousel on an ellipse,
  nearer dots larger and opaque, far ones small and faint, in deeper tones of
  the sign hues so it reads on dark and light surfaces (viewBox
  `-2 4 28 16`). It is 2.625 times the type size wide (7:4) and sits three
  quarters of the type size before the words. The signs go round it in
  zodiac order, Libra at the front and Aries at the back. It is still.
- Your sign at the front: on an image or card made for one person the ring
  turns to bring that person's Sun sign to the front, keeping the zodiac
  order, so the opposite sign sits at the back (`tiltedRingDots(front)`).
  That is the chart cards and sheet, the solar return, the chart link
  preview, the compatibility card and preview (the first person's sign) and
  a Zodiac Games card (its sign); and in the assistant, the birthday,
  horoscope, two-chart, chart-twin and famous-chart cards and the birthday,
  horoscope and compatibility link previews. Only a sign the chart settles is used
  (`src/lib/ring-front.ts`): a chart without a birth time born near a sign
  boundary keeps the brand's own ring. Everything else, the nav, footers,
  OG cards and every image not made for one person, keeps Libra in front.
- The words: ZODIACS · ORG in EB Garamond 400 capitals at 0.2em tracking and
  line height 1. Live text is written "Zodiacs·org" and capitalised by the
  stylesheet, and its link is named "Zodiacs.org"; images draw the capitals.
  The dot (U+00B7) is muted, with 0.2em on either side so it sits centred
  between the words; ORG is weight 500, a step dimmer than ZODIACS.
- Sizes: 13px in the nav, on the cards and on the share pages; 16px in the
  footer; 20px on 1200 × 630 images and on the portrait export cards. Other
  formats scale from these.
- Everywhere, the wing included: the desktop nav, the footers, the share
  pages, every share and export image, the OG cards, emails and the assistant
  cards. Two exceptions, by the owner's choice: on phones the top bar keeps
  ZODIACS | ASTROFOLIO, and the favicon, the app icons and the bio page's
  orbit emblem keep the flat ring (`BrandMark.astro`), which reads better
  small. Cards already published under a pinned or dated name keep the
  design they were published with, and a new family takes the lockup: the
  Registry's v4 lot and hub cards, Astrofolio's v6 Faces card and
  Terminal's v7 card (2026-10-19) replace the v3, v2, v5 and v6 files on the
  pages, and those stay published for links already shared. The homepage and
  the sign guides moved to the art cards below.
- In motion: the end card for short videos (`npm run data:end-card`), two
  seconds at 1080 × 1920 in which the ring spins, slows to the brand's own
  front and settles beside the words, a little above the middle of the
  frame, clear of the apps' side buttons.
- The dot belongs to the mark, so the rule against middle dots in copy does
  not apply to it. No image or lockup uses a sentence-case "Zodiacs.org"
  wordmark; in running text the name stays Zodiacs, or Zodiacs.org.

## Art Share Cards

The homepage and the twelve sign guides share as art cards (owner-chosen
2026-10-19): each is laid out the way its page opens, with the names and the
homepage headline in EB Garamond and the lockup in the footer row.

- The homepage card cuts the hero film's poster at full size, the sign discs
  from Virgo to Aquarius running across the top, under the hero's scrim, with
  the hero's headline and the first half of its caption. Every page without a
  card of its own shows it too.
- A sign guide's card is its hero: the sign's art panel on the right in the
  hero's shade, and on the left the sign's disc and kicker ("The first sign of
  the zodiac"), the name, its one line and "The Sun sign for birthdays from
  …", the words the guide prints.
- JPEGs under 300 KB, because the art fills the picture, in
  `/assets/og/v8/` (`npm run data:og -- --only-art-cards`). Their paths,
  words, crop and the heroes' art and shade live in `src/lib/og-art-cards.mjs`,
  and a test holds them to the two heroes. The v2 homepage and sign cards stay
  published for links already shared.

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
