/**
 * The Vedic signs reading, put together from sidereal positions: the Sun, Moon
 * and rising signs (rashis), the Moon's nakshatra, what an untimed birth day
 * leaves open, the limits and the reading-confidence label. The /vedic-signs/
 * page (astronomy-engine in the browser) and the get_vedic_signs tool (DE440
 * on the server) both build their answer here; placements right on a boundary
 * carry an explicit boundary-uncertainty limit. Pure: no engine, network,
 * storage or logging.
 */
import { SIGNS, signIndexForLongitude } from '../signs';
import { readingConfidence, readingConfidenceText } from '../../ai-tools/reading-confidence';
import { MINOR_NOTE, softenMinor } from '../reading-guards';
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
  /** True when a timed placement sits close enough to a sign boundary that birth-time precision or ayanamsa convention can flip it. */
  cusp?: boolean;
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
  /** True when a timed Moon sits close enough to a nakshatra boundary that birth-time precision or ayanamsa convention can flip it. */
  cusp?: boolean;
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
  atGeographicPole?: boolean;
  timeKnown: boolean;
  placed: boolean;
  ayanamsa: VedicAyanamsa;
  /** True when the birth date is under 18 today (UTC-12), so affectionate/charm wording is softened. */
  minor?: boolean;
  /** The positions at the birth instant (local noon for an untimed birth). */
  at: SiderealMoment;
  /** For a timed placed birth, the sidereal ascendant sampled across birthUtc +/- 1 minute, to detect cusps, rapid Arctic sweeps, or polar flips. */
  risingBracket?: readonly number[] | { samples: readonly number[]; polarCircle: boolean } | null;
  /** For an untimed birth, the positions at the two ends of the birth day; null with a birth time. */
  ends: readonly SiderealMoment[] | null;
}

export const POLAR_RISING_LIMIT = 'The rising sign (lagna) is undefined at a geographic pole because there is no unique direction of east.';

/** Within 0.02 degrees of a rashi or nakshatra border, minute-level birth time or ayanamsa differences can cross it. */
const BOUNDARY_MARGIN_DEG = 0.02;
const NAKSHATRA_SPAN_DEG = 40 / 3;

function softenVedicMinor(text: string): string {
  return softenMinor(text
    .replace('Warm, charming and fond of beauty', 'Warm, welcoming and fond of beauty')
    .replace('Warm and pleasure loving; read as rest, creativity, affection', 'Warm and creative; read as rest, creativity, kindness'));
}

function boundaryPair(lon: number, span: number, count: number): [number, number] | null {
  const norm = ((lon % 360) + 360) % 360;
  const idx = Math.floor(norm / span) % count;
  const offset = norm - idx * span;
  if (offset < BOUNDARY_MARGIN_DEG) return [(idx + count - 1) % count, idx];
  if (span - offset < BOUNDARY_MARGIN_DEG) return [idx, (idx + 1) % count];
  return null;
}

/** Signed shortest angular step from a to b in (-180, 180]. */
const signedStep = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;

type RisingBoundary =
  | { kind: 'cusp'; pair: [number, number] }
  | { kind: 'rapid'; signs: number[] }
  | { kind: 'flip' };

const MAX_RESOLVED_STEP_DEG = 20;

function risingBoundary(
  lon: number,
  bracket?: readonly number[] | { samples: readonly number[]; polarCircle: boolean } | null,
): RisingBoundary | null {
  const isObj = bracket !== null && bracket !== undefined && !Array.isArray(bracket);
  const rawSamples: readonly number[] | null = isObj ? (bracket as { samples: readonly number[] }).samples : (bracket ?? null);
  const polarCircle = isObj ? (bracket as { polarCircle: boolean }).polarCircle : false;
  if (!rawSamples || rawSamples.length < 2) {
    const direct = boundaryPair(lon, 30, 12);
    return direct ? { kind: 'cusp', pair: direct } : null;
  }
  const samples = rawSamples.length === 2 ? [rawSamples[0], lon, rawSamples[1]] : [...rawSamples];
  // Inside/on the polar circle (|lat| >= 90 - obliquity), any step that remains unresolved (> 20 deg) after adaptive
  // bisection indicates an abrupt polar discontinuity or sub-second multi-sign swing; use a non-exhaustive warning.
  if (polarCircle) {
    for (let i = 0; i < samples.length - 1; i++) {
      if (Math.abs(signedStep(samples[i], samples[i + 1])) > MAX_RESOLVED_STEP_DEG) {
        return { kind: 'flip' };
      }
    }
  }
  // Continuous motion across the 2-minute window: walk every refined step so fast Arctic Circle sweeps include every crossed sign.
  const visited: number[] = [];
  const push = (sign: number) => { if (!visited.includes(sign)) visited.push(sign); };
  for (let i = 0; i < samples.length - 1; i++) {
    const step = signedStep(samples[i], samples[i + 1]);
    const fromSign = signIndexForLongitude(samples[i]);
    const toSign = signIndexForLongitude(samples[i + 1]);
    if (fromSign === toSign) { push(fromSign); continue; }
    // Outside the polar circle, ascendant motion is strictly forward; inside, it can run backward on continuous segments.
    const forward = !polarCircle || step >= 0;
    const run = forward
      ? forwardRun(fromSign, toSign, 12)
      : forwardRun(toSign, fromSign, 12).reverse();
    for (const sign of run) push(sign);
  }
  if (visited.length >= 3) return { kind: 'rapid', signs: visited };
  if (visited.length === 2) return { kind: 'cusp', pair: [visited[0], visited[1]] };
  const direct = boundaryPair(lon, 30, 12);
  return direct ? { kind: 'cusp', pair: direct } : null;
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

export const sunLine = (index: number, boundary: [number, number] | null = null) => (
  boundary
    ? `Provisional, on the ${label(boundary[0])} or ${label(boundary[1])} boundary, this calculation places your Vedic Sun in ${RASHIS[index]}, ${SIGNS[index].name} in the sidereal zodiac. In Jyotish the Sun is the soul and the sense of self: ${RASHI_LINE[index]}`
    : `Your Vedic Sun is in ${RASHIS[index]}, ${SIGNS[index].name} in the sidereal zodiac. In Jyotish the Sun is the soul and the sense of self: ${RASHI_LINE[index]}`
);
export const moonLine = (index: number, boundary: [number, number] | null = null) => (
  boundary
    ? `Provisional, on the ${label(boundary[0])} or ${label(boundary[1])} boundary, this calculation places your Moon sign (rashi) in ${RASHIS[index]}, ${SIGNS[index].name}. Vedic astrology reads the Moon sign first, as the mind and the emotional nature: ${RASHI_LINE[index]}`
    : `Your Moon sign (rashi) is ${RASHIS[index]}, ${SIGNS[index].name}. Vedic astrology reads the Moon sign first, as the mind and the emotional nature: ${RASHI_LINE[index]}`
);
export const risingLine = (index: number, edge: RisingBoundary | null = null) => {
  if (!edge) return `Your lagna (rising sign) is ${RASHIS[index]}, ${SIGNS[index].name}. The lagna is the body and the path through life, and it sets the first house: ${RASHI_LINE[index]}`;
  const reason = edge.kind === 'cusp'
    ? `on the ${label(edge.pair[0])} or ${label(edge.pair[1])} boundary`
    : edge.kind === 'rapid'
      ? `moving rapidly across ${listOr(edge.signs.map(label))} at this latitude`
      : 'time-sensitive at this latitude';
  return `Provisional, ${reason}, this calculation places your lagna (rising sign) in ${RASHIS[index]}, ${SIGNS[index].name}. The lagna is the body and the path through life, and it sets the first house: ${RASHI_LINE[index]}`;
};

export function nakshatraReading(position: SiderealMoment['nakshatra'], boundary: [number, number] | null = null): VedicNakshatra {
  const name = NAKSHATRA_NAMES[position.index];
  const lore = NAKSHATRA_LORE[name];
  const lead = boundary
    ? `Provisional, on the ${NAKSHATRA_NAMES[boundary[0]]} or ${NAKSHATRA_NAMES[boundary[1]]} boundary, this calculation places your Moon in ${name}`
    : `Your Moon was in ${name}`;
  return {
    name, number: position.index + 1, pada: position.pada, lord: position.lord, deity: lore.deity, symbol: lore.symbol,
    line: `${lead}, the ${nakshatraOrdinal(position.index + 1)} nakshatra, ruled by ${position.lord}, with ${lore.deity} as its deity and ${lore.symbol} as its symbol. ${lore.line}`,
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
  const moonPair = input.timeKnown ? boundaryPair(at.moon.lon, 30, 12) : null;
  const sunPair = input.timeKnown ? boundaryPair(at.sun.lon, 30, 12) : null;
  const risingEdge = input.timeKnown && input.placed && at.rising ? risingBoundary(at.rising.lon, input.risingBracket) : null;
  const sun = sunHold.held
    ? { ...signOf(at.sun, sunLine(signIndexForLongitude(at.sun.lon), sunPair), input.timeKnown, signRun((moment) => moment.sun.tropical)), ...(sunPair ? { cusp: true } : {}) }
    : null;
  const moon = moonHold.held
    ? { ...signOf(at.moon, moonLine(signIndexForLongitude(at.moon.lon), moonPair), input.timeKnown, signRun((moment) => moment.moon.tropical)), ...(moonPair ? { cusp: true } : {}) }
    : null;
  const rising = input.timeKnown && input.placed && at.rising
    ? { ...signOf(at.rising, risingLine(signIndexForLongitude(at.rising.lon), risingEdge)), ...(risingEdge ? { cusp: true } : {}) }
    : null;
  const nakshatraNames = forwardRun(first.nakshatra.index, last.nakshatra.index, 27).map((index) => NAKSHATRA_NAMES[index]);
  const nakshatraHeld = nakshatraNames.length === 1;
  const nakPair = input.timeKnown ? boundaryPair(at.moon.lon, NAKSHATRA_SPAN_DEG, 27) : null;
  // Without a birth time, or right on a nakshatra boundary where the two candidates imply different padas (4 vs 1), the pada is unsettled.
  const rawNakshatra = nakshatraHeld ? { ...nakshatraReading(at.nakshatra, nakPair), ...(input.timeKnown && !nakPair ? {} : { pada: null }), ...(nakPair ? { cusp: true } : {}) } : null;
  const moonNakshatra = rawNakshatra && input.minor ? { ...rawNakshatra, line: softenVedicMinor(rawNakshatra.line) } : rawNakshatra;
  const limits: string[] = [];
  if (input.minor) limits.push(MINOR_NOTE);
  if (!input.timeKnown) {
    limits.push('No birth time was given, so there is no rising sign (lagna), no degree and no pada, and the Moon sign and nakshatra are given only where the whole birth day keeps them.');
    if (!moonHold.held) limits.push(`The Moon changed sign that day: it was in ${listOr(moonHold.candidates)}. A birth time settles it.`);
    if (!nakshatraHeld) limits.push(`The Moon changed nakshatra that day: it was in ${listOr(nakshatraNames)}. A birth time settles it.`);
    if (!sunHold.held) limits.push(`The Sun changed sign that day: it was in ${listOr(sunHold.candidates)}. A birth time settles it.`);
  } else {
    if (input.atGeographicPole) limits.push(POLAR_RISING_LIMIT);
    else if (!input.placed) limits.push('No birthplace coordinates were given, so there is no rising sign (lagna).');
    if (nakPair) limits.push(`The Moon sits right on the boundary between ${NAKSHATRA_NAMES[nakPair[0]]} and ${NAKSHATRA_NAMES[nakPair[1]]}, so a small difference in birth time or ayanamsa convention can place it in either nakshatra.`);
    if (moonPair) limits.push(`The sidereal Moon sits right on the boundary between ${label(moonPair[0])} and ${label(moonPair[1])}, so a small difference in birth time or ayanamsa convention can place it in either sign.`);
    if (sunPair) limits.push(`The sidereal Sun sits right on the boundary between ${label(sunPair[0])} and ${label(sunPair[1])}, so a small difference in birth time or ayanamsa convention can place it in either sign.`);
    if (risingEdge?.kind === 'cusp') {
      limits.push(`The sidereal rising sign sits right on the boundary between ${label(risingEdge.pair[0])} and ${label(risingEdge.pair[1])}, so a small difference in birth time or ayanamsa convention can place it in either sign.`);
    } else if (risingEdge?.kind === 'rapid') {
      limits.push(`At this latitude the sidereal rising sign moves rapidly across ${listOr(risingEdge.signs.map(label))} within a minute of this birth time, so a small difference in birth time can place it in any of those signs.`);
    } else if (risingEdge?.kind === 'flip') {
      limits.push('At this latitude the sidereal rising sign jumps abruptly near this birth time, so a small difference in birth time can place it in a different sign altogether.');
    }
  }
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

export { isUnder13 } from '../reading-guards';
/** The page's words for a birth date less than 13 years ago, after the tools' UNDER_13_REFUSAL (src/ai-tools/contracts.ts). */
export const UNDER_13_MESSAGE = 'Zodiacs is not directed at children under 13, so it works out no signs or reading from a birth date less than 13 years ago. For someone 13 or older, enter their own birth date.';
