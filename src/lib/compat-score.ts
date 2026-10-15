/**
 * A compatibility score for two birth charts: 0–100 overall, with
 * attraction, communication and long-term stability, read from the
 * contacts between the charts (synastry) and the Sun signs' elements.
 *
 * Each contact counts by how personal its planets are and how exact it is.
 * Trines and sextiles add, squares subtract, oppositions pull both ways and
 * conjunctions follow the planets involved. Venus–Mars and Sun–Moon contacts
 * count for attraction even when they are hard, as astrology reads them.
 * Pure: the score is a function of the contacts and signs it is given.
 */
import type { InterAspect } from './engine/synastry';
import type { Element } from './signs';

export type CompatArea = 'attraction' | 'communication' | 'stability';

export interface CompatScore {
  overall: number;
  areas: Record<CompatArea, number>;
  verdict: string;
  headline: string;
}

const PERSONAL: Record<string, number> = {
  Sun: 1, Moon: 1, Venus: 1, Mars: 0.9, Mercury: 0.8,
  Jupiter: 0.55, Saturn: 0.6, Uranus: 0.25, Neptune: 0.25, Pluto: 0.3,
};

/** Which areas a planet speaks to, and how strongly. */
const AREA_OF: Record<string, Partial<Record<CompatArea, number>>> = {
  Sun: { attraction: 0.6, communication: 0.4, stability: 0.6 },
  Moon: { attraction: 0.5, communication: 0.5, stability: 0.8 },
  Mercury: { communication: 1 },
  Venus: { attraction: 1, stability: 0.4 },
  Mars: { attraction: 1 },
  Jupiter: { communication: 0.3, stability: 0.4 },
  Saturn: { stability: 1 },
  Uranus: { attraction: 0.3 },
  Neptune: { attraction: 0.3 },
  Pluto: { attraction: 0.5 },
};

const MAX_ORB: Record<InterAspect['type'], number> = { conjunction: 8, opposition: 8, trine: 7, square: 7, sextile: 5 };
const HARD_PLANETS = new Set(['Mars', 'Saturn', 'Pluto', 'Uranus']);
const CHEMISTRY = new Set(['Venus|Mars', 'Mars|Venus', 'Sun|Moon', 'Moon|Sun', 'Venus|Venus', 'Mars|Mars']);

/** How a contact reads, from −1 (strain) to +1 (ease). */
function valence(contact: InterAspect, area: CompatArea): number {
  const pair = `${contact.a}|${contact.b}`;
  const hard = HARD_PLANETS.has(contact.a) || HARD_PLANETS.has(contact.b);
  if (area === 'attraction' && CHEMISTRY.has(pair)) {
    // Chemistry: every contact between these planets is felt as pull.
    return contact.type === 'square' ? 0.6 : contact.type === 'opposition' ? 0.8 : 1;
  }
  switch (contact.type) {
    case 'trine': return 1;
    case 'sextile': return 0.8;
    case 'conjunction': return hard ? (area === 'attraction' ? 0.4 : -0.3) : 0.8;
    case 'opposition': return area === 'attraction' ? 0.3 : -0.6;
    case 'square': return -1;
  }
}

const COMPATIBLE: Record<string, number> = {
  'fire+fire': 6, 'air+air': 5, 'earth+earth': 6, 'water+water': 6,
  'air+fire': 6, 'earth+water': 7,
  'earth+fire': -3, 'fire+water': -4, 'air+earth': -3, 'air+water': -3,
};

/** Map a weighted sum to 0–100, centred so an average pair lands in the low 60s. */
function toScore(sum: number, weight: number, bonus: number): number {
  const mean = weight > 0 ? sum / weight : 0;
  const raw = 62 + mean * 30 + bonus;
  return Math.max(18, Math.min(98, Math.round(raw)));
}

const AREA_WORDS: Record<CompatArea, string> = {
  attraction: 'attraction', communication: 'communication', stability: 'long-term stability',
};

function verdictFor(score: number): string {
  if (score >= 85) return 'An exceptional match';
  if (score >= 72) return 'A strong match';
  if (score >= 58) return 'A good match, with some work to do';
  if (score >= 45) return 'A mixed match';
  return 'A challenging match';
}

export function scoreCompatibility(
  contacts: readonly InterAspect[],
  elements: { a: Element; b: Element } | null,
): CompatScore {
  const sums: Record<CompatArea, number> = { attraction: 0, communication: 0, stability: 0 };
  const weights: Record<CompatArea, number> = { attraction: 0, communication: 0, stability: 0 };
  for (const contact of contacts) {
    if (contact.a === contact.b && (PERSONAL[contact.a] ?? 0) < 0.5 && contact.type === 'conjunction') continue;
    const tight = Math.max(0.2, 1 - contact.orb / MAX_ORB[contact.type]);
    const strength = (PERSONAL[contact.a] ?? 0.3) * (PERSONAL[contact.b] ?? 0.3) * tight;
    for (const area of Object.keys(sums) as CompatArea[]) {
      const share = Math.max(AREA_OF[contact.a]?.[area] ?? 0, AREA_OF[contact.b]?.[area] ?? 0);
      if (share === 0) continue;
      sums[area] += valence(contact, area) * strength * share;
      weights[area] += strength * share;
    }
  }
  const bonus = elements ? COMPATIBLE[[elements.a, elements.b].sort().join('+')] ?? 0 : 0;
  const areas = {
    attraction: toScore(sums.attraction, weights.attraction, bonus),
    communication: toScore(sums.communication, weights.communication, bonus),
    stability: toScore(sums.stability, weights.stability, bonus),
  };
  const overall = Math.round(areas.attraction * 0.35 + areas.communication * 0.3 + areas.stability * 0.35);
  const ranked = (Object.keys(areas) as CompatArea[]).sort((x, y) => areas[y] - areas[x]);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const headline = areas[best] - areas[worst] < 6
    ? `Attraction, communication and stability are evenly matched in this pairing.`
    : `${AREA_WORDS[best][0].toUpperCase()}${AREA_WORDS[best].slice(1)} is the strongest part of this pairing; ${AREA_WORDS[worst]} will take the most work.`;
  return { overall, areas, verdict: verdictFor(overall), headline };
}
