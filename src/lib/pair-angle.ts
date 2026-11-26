/**
 * The angle between two Sun signs on the zodiac wheel, for the pair pages'
 * "angle between you" plate (src/components/compat/PairAnglePlate.astro).
 * Geometry and shared make-up only, counted sign to sign at 30 degrees a
 * sign, the shorter way round: no reading, so no reading confidence label.
 * Aspect names and spellings follow the Learn aspect pages
 * (src/content/learn/aspects/), which call the two minor ones the
 * semi-sextile and the quincunx.
 */
import { ELEMENT_LABEL, MODALITY_LABEL, SIGN_SLUGS, signBySlug, type Sign } from './signs';

export type PairAspect = 'conjunction' | 'semi-sextile' | 'sextile' | 'square' | 'trine' | 'quincunx' | 'opposition';

/** Index by signs apart (0 to 6). */
const ASPECTS: readonly PairAspect[] = ['conjunction', 'semi-sextile', 'sextile', 'square', 'trine', 'quincunx', 'opposition'];
/** Share of the wheel the angle spans, by signs apart. */
const SHARE = ['the same point', 'a twelfth of the wheel', 'a sixth of the wheel', 'a quarter of the wheel', 'a third of the wheel', 'five twelfths of the wheel', 'half the wheel'];
const COUNT = ['none', 'one', 'two', 'three', 'four', 'five', 'six'];
/** The aspects with their own Learn page. */
const LEARN_PAGES = new Set<PairAspect>(['conjunction', 'sextile', 'square', 'trine', 'opposition']);

const lower = (value: string) => value.charAt(0).toLowerCase() + value.slice(1);
const polarityWord = (sign: Sign) => (sign.polarity === 'day' ? 'outgoing' : 'private');

export interface PairAngle {
  a: Sign;
  b: Sign;
  same: boolean;
  /** Signs apart the shorter way round, 0 to 6. */
  steps: number;
  degrees: number;
  aspect: PairAspect;
  /** "a third of the wheel". */
  share: string;
  /** True when the shorter way from a to b runs clockwise (with the zodiac). */
  clockwise: boolean;
  sharesElement: boolean;
  sharesModality: boolean;
  sharesPolarity: boolean;
  /** "Both fire" / "Fire and air". */
  elements: string;
  /** "Both cardinal" / "Cardinal and fixed". */
  modalities: string;
  heading: string;
  lede: string;
  learn: { href: string; label: string };
  alt: string;
}

/** The angle between two signs, a first in zodiac order as the pair slug has it. */
export function pairAngle(slugA: string, slugB: string): PairAngle {
  const a = signBySlug(slugA);
  const b = signBySlug(slugB);
  const ia = SIGN_SLUGS.indexOf(a.slug);
  const ib = SIGN_SLUGS.indexOf(b.slug);
  const forward = (ib - ia + 12) % 12;
  const steps = Math.min(forward, 12 - forward);
  const degrees = steps * 30;
  const aspect = ASPECTS[steps];
  const same = a.slug === b.slug;
  const sharesElement = a.element === b.element;
  const sharesModality = a.modality === b.modality;
  const sharesPolarity = a.polarity === b.polarity;
  const el = (s: Sign) => ELEMENT_LABEL[s.element];
  const mo = (s: Sign) => MODALITY_LABEL[s.modality];
  const elementWord = lower(el(a));
  const modalityWord = lower(mo(a));
  const polarity = polarityWord(a);
  const pair = `${a.name} and ${b.name}`;

  const heading = [
    `${a.name} and ${a.name} share one sign`,
    `${pair} are next-door signs`,
    `${pair} are two signs apart`,
    `${pair} are three signs apart`,
    `${pair} are four signs apart`,
    `${pair} are five signs apart`,
    `${pair} sit opposite each other`,
  ][steps];

  const lede = [
    `Both Suns sit in ${a.name}, at the same point on the wheel, the angle astrology calls a conjunction. You share everything a sign is made of: the element (${elementWord}), the modality (${modalityWord}) and the polarity (${polarity}).`,
    `Next-door signs are 30 degrees apart, a semi-sextile. ${pair} share no element, no modality and no polarity: all three change from one sign to the next.`,
    `Two signs apart is 60 degrees, a sextile, a sixth of the wheel. ${pair} share a polarity, both ${polarity}, but not an element or a modality.`,
    `Three signs apart is 90 degrees, a square, a quarter of the wheel. ${pair} share a modality, both ${modalityWord}, and differ in element and polarity.`,
    `Four signs apart is 120 degrees, a trine, a third of the wheel. ${pair} share an element, both ${elementWord}, and a polarity, and differ in modality.`,
    `Five signs apart is 150 degrees, a quincunx. Like next-door signs, ${pair} share no element, no modality and no polarity.`,
    `Six signs apart is 180 degrees, an opposition, half the wheel. ${pair} share a modality, both ${modalityWord}, and a polarity, both ${polarity}, and differ only in element.`,
  ][steps];

  const learn = LEARN_PAGES.has(aspect)
    ? { href: `/learn/aspects/${aspect}/`, label: `The ${aspect} in a birth chart` }
    : { href: '/learn/aspects/', label: 'The five major aspects' };

  const alt = same
    ? `A zodiac wheel of twelve signs with Aries at the top. ${a.name} is ringed: both Suns sit in the same sign, 0 degrees apart, a conjunction.`
    : `A zodiac wheel of twelve signs with Aries at the top. A line joins ${a.name} and ${b.name}, ${COUNT[steps]} ${steps === 1 ? 'sign' : 'signs'} and ${degrees} degrees apart, a ${aspect}.`;

  return {
    a,
    b,
    same,
    steps,
    degrees,
    aspect,
    share: SHARE[steps],
    clockwise: forward <= 6,
    sharesElement,
    sharesModality,
    sharesPolarity,
    elements: sharesElement ? `Both ${elementWord}` : `${el(a)} and ${lower(el(b))}`,
    modalities: sharesModality ? `Both ${modalityWord}` : `${mo(a)} and ${lower(mo(b))}`,
    heading,
    lede,
    learn,
    alt,
  };
}
