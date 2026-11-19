/**
 * Shared identity for every sky data API payload: origin, license, the
 * field conventions a reader needs to interpret the numbers, and the
 * envelope every file opens with. Within v1 fields are added, never renamed
 * or removed; anything breaking ships under /api/v2/.
 */

export const API_ORIGIN = 'https://zodiacs.org';
export const API_BASE = `${API_ORIGIN}/api/v1`;
export const API_VERSION = 'v1';

export const LICENSE = Object.freeze({
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: `Data: Zodiacs.org — ${API_ORIGIN}`,
});

/** Fields every payload carries, in this order, after `$schema` and `schema`. */
export const COMMON_META = Object.freeze({
  source: `${API_BASE}/index.json`,
  docs: `${API_ORIGIN}/developers/`,
  guide: `${API_BASE}/llms.txt`,
  ...LICENSE,
});

export const CONVENTIONS = Object.freeze({
  positions: 'Apparent geocentric tropical ecliptic longitudes in degrees, 0–360 measured from 0° Aries.',
  degree: 'The degree field is the position within its sign, 0 to 30.',
  position: 'The position field is the same value written as degrees, minutes, and sign name, for example 14°52′ Virgo.',
  retrograde: 'retrograde is true when the body\'s apparent motion against the zodiac is backward at that instant. The Sun and Moon never retrograde.',
  time: 'Every instant is UTC in ISO 8601. Calendar dates are UTC dates.',
  signs: 'Signs are the twelve tropical signs as lowercase slugs (aries … pisces); signName is the English name.',
  engine: `The sky catalogs use DE440. In the browser engine's comparison with NASA JPL Horizons at two dates, 1907 and 2020, the largest difference is 14.8 arcseconds. See ${API_ORIGIN}/methodology/.`,
  versioning: 'Within v1, fields are added, never renamed or removed. A breaking change would ship under /api/v2/ and v1 would keep working.',
});

export const POSITIONS_NOTE = `Apparent geocentric tropical longitudes; methodology at ${API_ORIGIN}/methodology/`;

export function schemaUrl(name: string): string {
  return `${API_BASE}/schema/${name}.v1.json`;
}

export function schemaName(name: string): string {
  return `zodiacs.sky-api.${name}.v1`;
}

/** The opening fields of every payload. */
export function envelope(name: string, generatedAt: string): Record<string, string> {
  return {
    $schema: schemaUrl(name),
    schema: schemaName(name),
    ...COMMON_META,
    generatedAt,
  };
}

export const PLANET_SLUGS = Object.freeze([
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
] as const);

export type PlanetSlug = typeof PLANET_SLUGS[number];

export const PLANET_NAMES: Readonly<Record<PlanetSlug, string>> = Object.freeze({
  sun: 'Sun', moon: 'Moon', mercury: 'Mercury', venus: 'Venus', mars: 'Mars',
  jupiter: 'Jupiter', saturn: 'Saturn', uranus: 'Uranus', neptune: 'Neptune', pluto: 'Pluto',
});

export function planetSlug(name: string): PlanetSlug {
  const slug = name.toLowerCase() as PlanetSlug;
  if (!PLANET_SLUGS.includes(slug)) throw new Error(`Unknown body: ${name}`);
  return slug;
}
