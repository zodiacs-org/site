/**
 * The brand lockup, owner-chosen 2026-10-19 for everything the site makes
 * (DESIGN.md, "Brand Lockup"): the tilted twelve-dot ring and ZODIACS · ORG.
 *
 * One source for every renderer: the Astro nav and footer, the static wing
 * pages and their footer, emails, the OG cards, the share and export images
 * (canvas and satori) and the assistant panels. Plain JavaScript, so the
 * plain-node generators import it as it is.
 *
 * The favicon and app icons keep the flat ring (BrandMark.astro,
 * public/assets/app-icons/), and phones keep ZODIACS | ASTROFOLIO in the top
 * bar: the owner's two exceptions.
 */

/**
 * The ring seen tilted, as a carousel on an ellipse (rx 10, ry 4) in a
 * viewBox of -2 4 28 16. Dots nearer the viewer are larger and fully opaque,
 * the far ones small and faint, in deeper tones of the sign hues so the mark
 * reads on dark and light surfaces. Listed back to front, so nearer dots
 * paint over farther ones. The same numbers as the assistant cards' mark.
 */
export const TILTED_RING_VIEWBOX = '-2 4 28 16';
export const TILTED_RING_DOTS = Object.freeze([
  { cx: 12, cy: 8, r: 1.2, fill: '#D9694F', opacity: 0.45 },
  { cx: 17, cy: 8.54, r: 1.33, fill: '#5E9E70', opacity: 0.49 },
  { cx: 7, cy: 8.54, r: 1.33, fill: '#4CA88F', opacity: 0.49 },
  { cx: 3.34, cy: 10, r: 1.67, fill: '#7A57B0', opacity: 0.59 },
  { cx: 20.66, cy: 10, r: 1.67, fill: '#8463BC', opacity: 0.59 },
  { cx: 22, cy: 12, r: 2.15, fill: '#4A8FBD', opacity: 0.73 },
  { cx: 2, cy: 12, r: 2.15, fill: '#7FB24C', opacity: 0.73 },
  { cx: 20.66, cy: 14, r: 2.62, fill: '#CC6C84', opacity: 0.86 },
  { cx: 3.34, cy: 14, r: 2.62, fill: '#CF8B3A', opacity: 0.86 },
  { cx: 17, cy: 15.46, r: 2.97, fill: '#5FA352', opacity: 0.96 },
  { cx: 7, cy: 15.46, r: 2.97, fill: '#3FA0BD', opacity: 0.96 },
  { cx: 12, cy: 16, r: 3.1, fill: '#A764C0', opacity: 1 },
].map((dot) => Object.freeze(dot)));

/**
 * The lockup's proportions, in ems of the type size: the words' tracking,
 * the space on either side of the dot (before tracking, so it sits centred),
 * the ring's width (its height is 4/7 of it) and the space between the ring
 * and the words.
 */
export const LOCKUP = Object.freeze({
  tracking: 0.2,
  dotSpace: 0.2,
  ringWidth: 2.625,
  gap: 0.75,
});

/** The type sizes: 13px in the nav, footers, cards and pages; 20px on 1200 x 630 images. */
export const LOCKUP_SIZE = Object.freeze({ page: 13, image: 20 });

/** The words as images draw them, and the name the live lockup is read by. */
export const LOCKUP_WORDS = Object.freeze({ name: 'ZODIACS', dot: '·', tld: 'ORG' });
export const LOCKUP_LABEL = 'Zodiacs.org';

/** The ring's height for a width: the viewBox is 7:4. */
export const tiltedRingHeight = (width) => Math.round((width * 4) / 7);

/** The ring's width for a type size. */
export const ringWidthFor = (size) => Math.round(size * LOCKUP.ringWidth);

/** The twelve dots as SVG circles. */
export const tiltedRingCircles = () => TILTED_RING_DOTS
  .map((dot) => `<circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${dot.fill}" opacity="${dot.opacity}"/>`)
  .join('');

/** The ring as inline SVG, `width` px wide; decorative, so hidden from assistive technology. */
export function tiltedRingSvg({ width = ringWidthFor(LOCKUP_SIZE.page), className = '' } = {}) {
  const cls = className ? ` class="${className}"` : '';
  return `<svg${cls} viewBox="${TILTED_RING_VIEWBOX}" width="${width}" height="${tiltedRingHeight(width)}" fill="none" aria-hidden="true" focusable="false">${tiltedRingCircles()}</svg>`;
}

/**
 * The live words, written "Zodiacs·org" and capitalised by the stylesheet as
 * in the nav, hidden from assistive technology because the link carries the
 * name. `classes` names the three spans.
 */
export function lockupWordsHtml({ name, sep, tld }) {
  return `<span class="${name}" aria-hidden="true">Zodiacs<span class="${sep}">·</span><span class="${tld}">org</span></span>`;
}

/**
 * The words' declarations for a stylesheet, at `size` px: EB Garamond 400
 * capitals at 0.2em tracking, the dot muted with 0.2em either side, ORG at
 * 500 a step dimmer. `colors` are CSS values for the three parts.
 */
export function lockupWordsCss({ name, sep, tld, size = LOCKUP_SIZE.page, family = "'EB Garamond', Georgia, serif", colors }) {
  return [
    `.${name}{font:400 ${size}px/1 ${family};letter-spacing:${LOCKUP.tracking}em;text-transform:uppercase;color:${colors.name};white-space:nowrap}`,
    `.${sep}{margin:0 ${LOCKUP.dotSpace}em;color:${colors.sep}}`,
    `.${tld}{font-weight:500;color:${colors.tld}}`,
  ].join('\n');
}
