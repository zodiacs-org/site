/**
 * The Vedic signs reading, put together from sidereal positions: the Sun, Moon
 * and rising signs (rashis), the Moon's nakshatra, what an untimed birth day
 * leaves open, the limits and the reading-confidence label. The /vedic-signs/
 * page and the get_vedic_signs tool both build their answer here, from the
 * same positions (./compute.ts), so the two always agree. Pure: no engine,
 * network, storage or logging.
 */
import { SIGNS, signIndexForLongitude } from '../signs';
import { readingConfidence, readingConfidenceText } from '../../ai-tools/reading-confidence';
import type { SiderealMoment, SiderealPoint } from '../engine/vedic';
import { AYANAMSA_NAME, NAKSHATRA_LORE, NAKSHATRA_NAMES, RASHIS, RASHI_LINE, VEDIC_NOTE, nakshatraOrdinal, type VedicAyanamsa } from './wording';

export interface VedicSign {
  /** The Western sign name for the sidereal sign, such as aries. */
  sign: string;
  rashi: typeof RASHIS[number];
  /** Degrees into the sidereal sign, 0 to 30, to two decimals. */
  degree: number;
  /** The sign the same body is in on the tropical (Western) zodiac. */
  tropicalSign: string;
  line: string;
}

export interface VedicNakshatra {
  name: string;
  /** 1 for Ashwini to 27 for Revati. */
  number: number;
  pada: number;
  lord: string;
  deity: string;
  symbol: string;
  line: string;
}

export interface VedicReading {
  timeKnown: boolean;
  placed: boolean;
  ayanamsa: { name: VedicAyanamsa; label: string; degrees: number };
  sun: VedicSign | null;
  sunCandidates: string[];
  moon: VedicSign | null;
  moonCandidates: string[];
  rising: VedicSign | null;
  moonNakshatra: VedicNakshatra | null;
  nakshatraCandidates: string[];
  summary: string;
  confidence: number;
  confidenceLabel: string;
  limits: string[];
  note: string;
}

export interface VedicReadingInput {
  timeKnown: boolean;
  placed: boolean;
  ayanamsa: VedicAyanamsa;
  /** The positions at the birth instant (local noon for an untimed birth). */
  at: SiderealMoment;
  /** For an untimed birth, the positions at the two ends of the birth day; null with a birth time. */
  ends: readonly SiderealMoment[] | null;
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const label = (index: number) => `${SIGNS[index].name} (${RASHIS[index]})`;

function signOf(point: SiderealPoint, line: string): VedicSign {
  const index = signIndexForLongitude(point.lon);
  return { sign: SIGNS[index].slug, rashi: RASHIS[index], degree: Math.min(29.99, round2(point.lon - index * 30)), tropicalSign: SIGNS[signIndexForLongitude(point.tropical)].slug, line };
}

export const sunLine = (index: number) => `Your Vedic Sun is in ${RASHIS[index]}, ${SIGNS[index].name} in the sidereal zodiac. In Jyotish the Sun is the soul and the sense of self: ${RASHI_LINE[index]}`;
export const moonLine = (index: number) => `Your Moon sign (rashi) is ${RASHIS[index]}, ${SIGNS[index].name}. Vedic astrology reads the Moon sign first, as the mind and the emotional nature: ${RASHI_LINE[index]}`;
export const risingLine = (index: number) => `Your lagna (rising sign) is ${RASHIS[index]}, ${SIGNS[index].name}. The lagna is the body and the path through life, and it sets the first house: ${RASHI_LINE[index]}`;

export function nakshatraReading(position: SiderealMoment['nakshatra']): VedicNakshatra {
  const name = NAKSHATRA_NAMES[position.index];
  const lore = NAKSHATRA_LORE[name];
  return {
    name, number: position.index + 1, pada: position.pada, lord: position.lord, deity: lore.deity, symbol: lore.symbol,
    line: `Your Moon was in ${name}, the ${nakshatraOrdinal(position.index + 1)} nakshatra, ruled by ${position.lord}, with ${lore.deity} as its deity and ${lore.symbol} as its symbol. ${lore.line}`,
  };
}

/** The reading. A placement an untimed day leaves open comes back as candidates, never as a guess. */
export function vedicReading(input: VedicReadingInput): VedicReading {
  const { at, ends } = input;
  const settled = (pick: (moment: SiderealMoment) => number) => {
    if (!ends) return { held: true, candidates: [] as string[] };
    const indices = [...new Set(ends.map((end) => signIndexForLongitude(pick(end))))];
    return { held: indices.length === 1, candidates: indices.length === 1 ? [] : indices.map(label) };
  };
  const sunHold = settled((moment) => moment.sun.lon);
  const moonHold = settled((moment) => moment.moon.lon);
  const sun = sunHold.held ? signOf(at.sun, sunLine(signIndexForLongitude(at.sun.lon))) : null;
  const moon = moonHold.held ? signOf(at.moon, moonLine(signIndexForLongitude(at.moon.lon))) : null;
  const rising = input.timeKnown && input.placed && at.rising ? signOf(at.rising, risingLine(signIndexForLongitude(at.rising.lon))) : null;
  const nakshatraNames = ends ? [...new Set(ends.map((end) => NAKSHATRA_NAMES[end.nakshatra.index]))] : [];
  const nakshatraHeld = !ends || nakshatraNames.length === 1;
  const moonNakshatra = nakshatraHeld ? nakshatraReading(at.nakshatra) : null;
  const limits: string[] = [];
  if (!input.timeKnown) {
    limits.push('No birth time was given, so there is no rising sign (lagna), and the Moon sign and nakshatra are given only where the whole birth day keeps them.');
    if (!moonHold.held) limits.push(`The Moon changed sign that day: it was in ${moonHold.candidates.join(' or ')}. A birth time settles it.`);
    if (!nakshatraHeld) limits.push(`The Moon changed nakshatra that day: it was in ${nakshatraNames.join(' or ')}. A birth time settles it.`);
    if (!sunHold.held) limits.push(`The Sun changed sign that day: it was in ${sunHold.candidates.join(' or ')}. A birth time settles it.`);
  } else if (!input.placed) limits.push('No birthplace coordinates were given, so there is no rising sign (lagna).');
  const parts = [sun?.line, moon?.line, rising?.line, moonNakshatra?.line].filter((line): line is string => !!line);
  const confidence = readingConfidence(input.timeKnown && input.placed ? 'timed-place' : 'date');
  const confidenceLabel = readingConfidenceText(confidence);
  return {
    timeKnown: input.timeKnown, placed: input.placed,
    ayanamsa: { name: input.ayanamsa, label: AYANAMSA_NAME[input.ayanamsa], degrees: Math.round(at.ayanamsa * 10_000) / 10_000 },
    sun, sunCandidates: sunHold.candidates, moon, moonCandidates: moonHold.candidates, rising, moonNakshatra, nakshatraCandidates: nakshatraHeld ? [] : nakshatraNames,
    summary: `${parts.join(' ')} ${confidenceLabel}.`.trim(), confidence, confidenceLabel, limits, note: VEDIC_NOTE,
  };
}

export { isUnder13 } from '../../ai-tools/features/reading-guards';
/** The page's words for a birth date less than 13 years ago, after the tools' UNDER_13_REFUSAL (src/ai-tools/contracts.ts). */
export const UNDER_13_MESSAGE = 'Zodiacs is not directed at children under 13, so it works out no signs or reading from a birth date less than 13 years ago. For someone 13 or older, enter their own birth date.';
