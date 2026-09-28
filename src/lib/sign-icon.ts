/**
 * Sign pictures for a chart. Fetching only the signs a chart shows would give
 * our host its Sun, Moon and rising signs, so the first picture of a size a
 * page renders asks for all twelve pictures of that size, in zodiac order,
 * and keeps them for the page: the requests are then the same for every
 * chart, and the picture shown reuses the one already held. Only the WebP is
 * used; an AVIF <source> would be fetched for the shown sign alone.
 */
import { SIGNS } from './signs';

const held: { [size: number]: HTMLImageElement[] } = {};
const path = (size: number, slug: string) => `/assets/zodiac-icons/${size}/${slug}.webp`;

/** The picture of one sign from a chart; call it while rendering. */
export function signIcon(size: 48 | 128, slug: string): string {
  if (typeof Image !== 'undefined' && !held[size]) {
    held[size] = SIGNS.map((sign) => {
      const image = new Image();
      image.src = path(size, sign.slug);
      return image;
    });
  }
  return path(size, slug);
}
