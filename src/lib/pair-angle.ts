/**
 * The angle between two Sun signs on the zodiac wheel, for the pair pages'
 * "angle between you" plate (src/components/compat/PairAnglePlate.astro).
 * Geometry and shared make-up only, counted sign to sign at 30 degrees a
 * sign, the shorter way round: no reading, so no reading confidence label.
 * Aspect names and spellings follow the Learn aspect pages
 * (src/content/learn/aspects/), which call the two minor ones the
 * semi-sextile and the quincunx.
 *
 * The facts are computed here once; every word comes from
 * src/lib/pair-angle-words.ts, in the page's language (English unless given).
 */
import { SIGN_SLUGS, signBySlug, type Sign } from './signs';
import { PAIR_ANGLE_WORDS, type PairAngleFacts, type PairAngleLocale, type PairAspect } from './pair-angle-words';

export type { PairAngleLocale, PairAspect } from './pair-angle-words';

/** Index by signs apart (0 to 6). */
const ASPECTS: readonly PairAspect[] = ['conjunction', 'semi-sextile', 'sextile', 'square', 'trine', 'quincunx', 'opposition'];
/** The aspects with their own Learn page. */
const LEARN_PAGES = new Set<PairAspect>(['conjunction', 'sextile', 'square', 'trine', 'opposition']);

export interface PairAngle {
  a: Sign;
  b: Sign;
  same: boolean;
  /** Signs apart the shorter way round, 0 to 6. */
  steps: number;
  degrees: number;
  aspect: PairAspect;
  /** The aspect's name in the page's language: "trine", "trígono". */
  aspectName: string;
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
  /** The English Learn path; the plate localizes it, or leaves it out. */
  learn: { href: string; label: string };
  alt: string;
}

/** The angle between two signs, a first in zodiac order as the pair slug has it. */
export function pairAngle(slugA: string, slugB: string, locale: PairAngleLocale = 'en'): PairAngle {
  const words = PAIR_ANGLE_WORDS[locale];
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
  const facts: PairAngleFacts = { a, b, same, steps, degrees, aspect, sharesElement, sharesModality };

  const learn = LEARN_PAGES.has(aspect)
    ? { href: `/learn/aspects/${aspect}/`, label: words.learn(aspect) }
    : { href: '/learn/aspects/', label: words.learnIndex };

  return {
    a,
    b,
    same,
    steps,
    degrees,
    aspect,
    aspectName: words.aspect[aspect],
    share: words.share[steps],
    clockwise: forward <= 6,
    sharesElement,
    sharesModality,
    sharesPolarity,
    elements: words.elementPair(facts),
    modalities: words.modalityPair(facts),
    heading: words.heading(facts),
    lede: words.lede(facts),
    learn,
    alt: words.alt(facts),
  };
}
