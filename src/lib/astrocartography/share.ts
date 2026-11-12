/**
 * The astrocartography share link: one line of the person's map, as the
 * planet and the angle, and nothing else. Never the birth date, time or place,
 * and never a town or city they checked: the card says what the line is
 * traditionally read as, not where it runs. Read by the share page and its
 * images in src/server/result-preview.ts, and built by the /astrocartography/
 * page and the get_astrocartography tool.
 *
 * Each value comes from a fixed vocabulary; a query with anything else is not
 * a share. Pure: no network, storage or logging.
 */
import { ACG_ANGLES, ACG_BODIES, type AcgAngle, type AcgBody } from './lines.js';

export const ASTROCARTOGRAPHY_SHARE_PATH = '/share/astrocartography/';
export const ASTROCARTOGRAPHY_SHARE_IMAGE_PATH = '/api/og/astrocartography-image';
export const ASTROCARTOGRAPHY_SHARE_STORY_PATH = '/api/og/astrocartography-story';
export const ASTROCARTOGRAPHY_SHARE_KEYS: readonly string[] = Object.freeze(['p', 'a', 'ref']);

export interface AstrocartographyShare {
  planet: AcgBody;
  angle: AcgAngle;
  ref: 'chatgpt' | 'assistant' | null;
}

const PLANET_SLUG = (planet: AcgBody) => planet.toLowerCase();
const ANGLE_SLUG = (angle: AcgAngle) => angle.toLowerCase();

export function astrocartographyQuery(share: AstrocartographyShare, withRef = false): string {
  const params = new URLSearchParams({ p: PLANET_SLUG(share.planet), a: ANGLE_SLUG(share.angle) });
  if (withRef && share.ref) params.set('ref', share.ref);
  return params.toString();
}

export function astrocartographyShareUrl(origin: string, line: { planet: AcgBody; angle: AcgAngle }): string {
  return `${origin}${ASTROCARTOGRAPHY_SHARE_PATH}?${astrocartographyQuery({ ...line, ref: null })}`;
}

export function parseAstrocartographyShare(params: URLSearchParams): AstrocartographyShare | null {
  const seen = new Map<string, string>();
  for (const [key, value] of params) {
    if (!ASTROCARTOGRAPHY_SHARE_KEYS.includes(key) || seen.has(key)) return null;
    seen.set(key, value);
  }
  const planet = ACG_BODIES.find((body) => PLANET_SLUG(body) === seen.get('p'));
  const angle = ACG_ANGLES.find((entry) => ANGLE_SLUG(entry) === seen.get('a'));
  const ref = seen.get('ref');
  if (!planet || !angle) return null;
  if (ref !== undefined && ref !== 'chatgpt' && ref !== 'assistant') return null;
  return { planet, angle, ref: (ref as AstrocartographyShare['ref']) ?? null };
}
