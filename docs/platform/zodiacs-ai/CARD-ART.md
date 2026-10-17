# Card art

The assistant cards' own artwork, beside the site's twelve sign panels
(`public/assets/sign-art/`). Each piece was generated with an image tool at
1536x1024 (3:2) and is kept here as a 720px master,
`public/assets/card-art/<name>-720.webp`. `node scripts/build-card-art.mjs`
makes the small variants the panels inline and the JPEGs the share images
read. The rules for using art on cards are in `DESIGN.md` ("Assistant
Cards", Artwork).

| Piece | Used on |
|---|---|
| `wedding-hero` | Wedding and anniversary cards and their share images |
| `sky-calendar-hero` | The sky calendar card, the occasions panel's empty state, share images with no Sun sign |
| `milestones-hero` | The life milestones card |
| `twins-hero` | The chart twins card |

Every prompt ends with the same style line, so new pieces match: painterly,
dimmed, one warm spotlight, brass clockwork dials, pastel accents, a frontal
slightly elevated camera, no people and no text.

- **wedding-hero:** An ornate brass clockwork astrolabe dial with interlocking rings, a spotlit bouquet of pale white flowers and two gold wedding rings resting on it, golden-hour glow, peach and lavender accents. Painterly oil-painting style, dimmed overall to about 36 percent brightness with a single warm spotlight on the focal object, ornate antique brass clockwork dials, soft pastel accents, deep shadowed vignette, frontal slightly elevated camera angle, no people, no text, no letters, no numbers.
- **sky-calendar-hero:** A brass clockwork orrery with small pastel planets on curved arms above a dark dusk horizon, a spotlit crescent moon, faint stars, a ring of twelve tiny pastel dots on its base. Painterly oil-painting style, dimmed overall to about 36 percent brightness with a single warm spotlight on the focal object, ornate antique brass clockwork dials, soft pastel accents, deep shadowed vignette, frontal slightly elevated camera angle, no people, no text, no letters, no numbers.
- **milestones-hero:** A spiral of nested brass gears receding into depth like the passing of years, a single spotlit lavender gear at the centre, mint and peach glints. Painterly oil-painting style, dimmed overall to about 36 percent brightness with a single warm spotlight on the focal object, ornate antique brass clockwork dials, soft pastel accents, deep shadowed vignette, frontal slightly elevated camera angle, no people, no text, no letters, no numbers.
- **twins-hero:** Two identical small antique brass clockwork dials side by side on a dark velvet surface under one shared warm spotlight, their hands aligned at the same angle, pastel mint and lilac enamel inlays. Painterly oil-painting style, dimmed overall to about 36 percent brightness, deep shadowed vignette, frontal slightly elevated camera angle, no people, no text, no letters, no numbers.

## Daylight twins

Every piece, the twelve sign panels included, has a daylight twin for the
light host theme, kept as `public/assets/card-art/<key>-light-720.webp`. Each
twin was generated from its dark piece as the reference image (1536x1024),
with this prompt, so the pair matches:

> Repaint the attached reference image as its daylight twin. Keep exactly the
> same subject, figure, composition, framing, camera angle, scale and
> spotlight position, so the two read as a matched pair. Change only the
> palette and lighting: a bright daylight scene on warm parchment and cream
> with soft gold light and gentle warm shadows instead of the night sky and
> darkness. Keep any pastel zodiac sign icon colours the same. Painterly,
> refined, soft. No people, no text, no letters, no border, no frame. The
> edges of the image should be calm and low detail so it can fade into a
> cream card.

The Libra twin was made a second time with "Keep the woman figure holding
the scales exactly as in the reference" added, to keep its sign's figure.
`node scripts/build-card-art.mjs --masters <dir>` turns the source PNGs into
the 720px masters.
