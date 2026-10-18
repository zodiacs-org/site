/**
 * The brand lockup for the server's share images (satori): the tilted
 * twelve-dot ring and ZODIACS · ORG (DESIGN.md, "Brand Lockup"). The caller
 * registers EB Garamond at 400 and 500 with the renderer.
 */
import { h } from 'preact';
import { LOCKUP, LOCKUP_SIZE, LOCKUP_WORDS, TILTED_RING_DOTS, TILTED_RING_VIEWBOX } from '../lib/brand-lockup.mjs';

/** The dark surfaces' inks: ZODIACS, the muted dot, and ORG a step dimmer. */
export const LOCKUP_IMAGE_INKS = Object.freeze({ name: '#EEF1F7', dot: '#8E96AB', tld: '#C6CCDA' });

/** The ring, then the capitals at 0.2em tracking with the dot centred, at `size` px (20 on a 1200 x 630 image). */
export function lockupImage(size: number = LOCKUP_SIZE.image, inks: { name: string; dot: string; tld: string } = LOCKUP_IMAGE_INKS) {
  const width = Math.round(size * LOCKUP.ringWidth);
  return h('div', { style: { display: 'flex', alignItems: 'center' } },
    h('svg', { width, height: Math.round((width * 4) / 7), viewBox: TILTED_RING_VIEWBOX, style: { marginRight: `${Math.round(size * LOCKUP.gap)}px` } },
      ...TILTED_RING_DOTS.map((dot) => h('circle', { cx: dot.cx, cy: dot.cy, r: dot.r, fill: dot.fill, opacity: dot.opacity }))),
    h('div', { style: { display: 'flex', alignItems: 'center', fontFamily: 'EB Garamond', fontWeight: 400, fontSize: size, lineHeight: 1, letterSpacing: `${size * LOCKUP.tracking}px`, color: inks.name } },
      LOCKUP_WORDS.name,
      h('span', { style: { marginLeft: `${size * LOCKUP.dotSpace}px`, marginRight: `${size * LOCKUP.dotSpace}px`, color: inks.dot } }, LOCKUP_WORDS.dot),
      h('span', { style: { fontWeight: 500, color: inks.tld } }, LOCKUP_WORDS.tld)));
}
