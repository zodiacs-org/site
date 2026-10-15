import { SIGNS } from '../lib/signs';

/** Match the site’s BrandMark: twelve dots, in zodiac order and canonical sign hues. */
export const BRAND_RING_DOTS = SIGNS.map((sign, index) => {
  const angle = index / 12 * 2 * Math.PI - Math.PI / 2;
  return { cx: +(12 + 9 * Math.cos(angle)).toFixed(3), cy: +(12 + 9 * Math.sin(angle)).toFixed(3), hue: sign.hue };
});

export const BRAND_RING_SVG = `<svg class="brand-ring" viewBox="0 0 24 24" width="32" height="32" fill="none" aria-hidden="true">${BRAND_RING_DOTS.map(dot => `<circle cx="${dot.cx}" cy="${dot.cy}" r="1.9" fill="${dot.hue}"/>`).join('')}</svg>`;
