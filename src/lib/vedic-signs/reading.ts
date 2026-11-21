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
  /** Degrees into the sidereal sign, 0 to 30, to two decimals; null without a birth time, when the day leaves it open. */
  degree: number | null;
  /** The sign the same body is in on the tropical (Western) zodiac; null when an untimed birth day changed it (see tropicalCandidates). */
  tropicalSign: string | null;
  /** The Western signs an untimed birth day passed through, in order, when it changed sign that day; otherwise empty. */
  tropicalCandidates: string[];
  line: string;
}

export interface VedicNakshatra {
  name: string;
  /** 1 for Ashwini to 27 for Revati. */
  number: number;
  /** The quarter of the nakshatra, 1 to 4; null without a birth time, since an untimed day never settles it. */
  pada: number | null;
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

/** Names joined as a list of choices: "A or B", or "A, B or C" for three or more. */
export const listOr = (names: readonly string[]) => names.length < 3
  ? names.join(' or ')
  : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;

/**
 * A sign placement. `timeKnown: false` leaves out the degree, which an untimed
 * day never settles; `tropicalRun` is the Western signs that day passed through,
 * and more than one leaves the Western sign open, as candidates.
 */
function signOf(point: SiderealPoint, line: string, timeKnown = true, tropicalRun: readonly number[] | null = null): VedicSign {
  const index = signIndexForLongitude(point.lon);
  const tropical = tropicalRun ?? [signIndexForLongitude(point.tropical)];
  return {
    sign: SIGNS[index].slug, rashi: RASHIS[index], degree: timeKnown ? Math.min(29.99, round2(point.lon - index * 30)) : null,
    tropicalSign: tropical.length === 1 ? SIGNS[tropical[0]].slug : null,
    tropicalCandidates: tropical.length === 1 ? [] : tropical.map((entry) => SIGNS[entry].slug),
    line,
  };
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

/**
 * Every division a body passed through between the first and last of the day's
 * moments, in order: the Sun and Moon never move backwards, so a day that starts
 * in one sign or nakshatra and ends two along also passed through the one between.
 */
export function forwardRun(first: number, last: number, size: number): number[] {
  const steps = (last - first + size) % size;
  return Array.from({ length: steps + 1 }, (_, step) => (first + step) % size);
}

/** The reading. A placement an untimed day leaves open comes back as candidates, never as a guess. */
export function vedicReading(input: VedicReadingInput): VedicReading {
  const { at, ends } = input;
  const first = ends?.[0] ?? at;
  const last = ends?.[ends.length - 1] ?? at;
  const signRun = (pick: (moment: SiderealMoment) => number) =>
    forwardRun(signIndexForLongitude(pick(first)), signIndexForLongitude(pick(last)), 12);
  const settled = (pick: (moment: SiderealMoment) => number) => {
    const indices = signRun(pick);
    const held = indices.length === 1;
    return { held, candidates: held ? [] : indices.map(label) };
  };
  const sunHold = settled((moment) => moment.sun.lon);
  const moonHold = settled((moment) => moment.moon.lon);
  // The Western sign takes the same forward walk over the day as the sidereal one.
  const sun = sunHold.held ? signOf(at.sun, sunLine(signIndexForLongitude(at.sun.lon)), input.timeKnown, signRun((moment) => moment.sun.tropical)) : null;
  const moon = moonHold.held ? signOf(at.moon, moonLine(signIndexForLongitude(at.moon.lon)), input.timeKnown, signRun((moment) => moment.moon.tropical)) : null;
  const rising = input.timeKnown && input.placed && at.rising ? signOf(at.rising, risingLine(signIndexForLongitude(at.rising.lon))) : null;
  const nakshatraNames = forwardRun(first.nakshatra.index, last.nakshatra.index, 27).map((index) => NAKSHATRA_NAMES[index]);
  const nakshatraHeld = nakshatraNames.length === 1;
  // Without a birth time the pada is never settled: the Moon crosses a pada (3 degrees 20 minutes) in about six hours.
  const moonNakshatra = nakshatraHeld ? { ...nakshatraReading(at.nakshatra), ...(input.timeKnown ? {} : { pada: null }) } : null;
  const limits: string[] = [];
  if (!input.timeKnown) {
    limits.push('No birth time was given, so there is no rising sign (lagna), no degree and no pada, and the Moon sign and nakshatra are given only where the whole birth day keeps them.');
    if (!moonHold.held) limits.push(`The Moon changed sign that day: it was in ${listOr(moonHold.candidates)}. A birth time settles it.`);
    if (!nakshatraHeld) limits.push(`The Moon changed nakshatra that day: it was in ${listOr(nakshatraNames)}. A birth time settles it.`);
    if (!sunHold.held) limits.push(`The Sun changed sign that day: it was in ${listOr(sunHold.candidates)}. A birth time settles it.`);
  } else if (!input.placed) limits.push('No birthplace coordinates were given, so there is no rising sign (lagna).');
  // Jyotish reads the Moon first (ZOD-18): the Moon sign and its nakshatra, then the Sun, then the lagna, as the page shows them.
  const parts = [moon?.line, moonNakshatra?.line, sun?.line, rising?.line].filter((line): line is string => !!line);
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
