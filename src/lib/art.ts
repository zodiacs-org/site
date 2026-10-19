/**
 * The painted pieces made for one place each on the consumer pages (the
 * birth chart's closing panel, the Learn cover, the orrery on Today and so
 * on), in the hero film's enamel-and-brass style. Each is a WebP at two
 * widths under public/assets/art/, cropped for the frame it fills. None of
 * them is ever a page's largest first-screen picture except the Learn
 * cover, which also ships as AVIF for that reason.
 *
 * The two profile pieces (the keepsake case for an empty set of saved charts
 * and the pocket orreries for an empty list of invitations) are 3:2 and sit
 * inside their panels behind a soft mask, so no edge of the picture shows on
 * any background.
 *
 * The four element medallions are round, transparent-edged WebPs at 128 and
 * 256 pixels, cut from one sheet.
 */
import type { Element } from './signs';

export const ART_WIDTHS = [720, 1200] as const;

export const ART = {
  'birth-chart-astrolabe': { width: 1200, height: 675 },
  'birthday-sundial': { width: 1200, height: 525 },
  'learn-atlas': { width: 1200, height: 900 },
  'pocket-orrery': { width: 1200, height: 750 },
  'profile-invitation': { width: 1200, height: 800 },
  'profile-keepsake': { width: 1200, height: 800 },
  'rising-horizon': { width: 1200, height: 675 },
  'today-orrery': { width: 1200, height: 675 },
  'tools-lens': { width: 1200, height: 750 },
} as const;

export type ArtName = keyof typeof ART;

export function artSrc(name: ArtName, width: (typeof ART_WIDTHS)[number] = 720, format: 'webp' | 'avif' = 'webp'): string {
  return `/assets/art/${name}-${width}.${format}`;
}

export function artSrcset(name: ArtName, format: 'webp' | 'avif' = 'webp'): string {
  return ART_WIDTHS.map((width) => `${artSrc(name, width, format)} ${width}w`).join(', ');
}

export const ELEMENT_MEDALLION_WIDTHS = [128, 256] as const;

export function elementMedallionSrc(element: Element, width: (typeof ELEMENT_MEDALLION_WIDTHS)[number] = 128): string {
  return `/assets/art/element-${element}-${width}.webp`;
}

export function elementMedallionSrcset(element: Element): string {
  return ELEMENT_MEDALLION_WIDTHS.map((width) => `${elementMedallionSrc(element, width)} ${width}w`).join(', ');
}
