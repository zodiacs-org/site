import type { BodyName } from './engine/types';
import { requireCatalogLocale, t, type Locale } from './i18n';
import { SIGNS, signForLongitude, signName } from './signs';

export interface MoonPresentation {
  bodies: readonly { body: BodyName; lon: number }[];
  angles?: unknown | null;
  moonSignCandidates?: readonly string[];
}

/** Never reconstruct a local-day range from a reference longitude alone. */
export function moonCandidates(chart: MoonPresentation): readonly string[] {
  if (chart.moonSignCandidates !== undefined) {
    const candidates = [...new Set(chart.moonSignCandidates)];
    return candidates.length <= 2 && candidates.every((slug) => SIGNS.some((sign) => sign.slug === slug))
      ? candidates : [];
  }
  if (chart.angles === null) return [];
  const moon = chart.bodies.find((body) => body.body === 'Moon');
  return moon ? [signForLongitude(moon.lon).slug] : [];
}

export function moonIsUncertain(chart: MoonPresentation): boolean {
  return moonCandidates(chart).length !== 1;
}

/** A chart or its scene, with what says whether it had a birth time: its input, or the engine's no-time flag. */
export interface MoonAspectPresentation extends MoonPresentation {
  input?: { timeKnown?: boolean };
  flags?: readonly string[];
}

/**
 * Only a birth time gives the Moon's degree. A sign verified across the birth
 * date leaves the Moon anywhere in the 12 to 15 degrees it moved that day, so
 * without a birth time the result names the sign alone, and the reference
 * moment's degree stays with the reference positions.
 */
export function moonDegreeUnsettled(chart: MoonAspectPresentation): boolean {
  return moonIsUncertain(chart) || chart.input?.timeKnown === false || chart.flags?.includes('no-time') === true;
}

/**
 * The Moon's aspects need its degree, so without a birth time they are the
 * reference moment's, and no reading names them as the chart's.
 */
export function moonAspectsUnsettled(chart: MoonAspectPresentation): boolean {
  return moonDegreeUnsettled(chart);
}

/**
 * The no-time notice's Moon sentence: both signs of a date the Moon changed
 * sign on, which the date's limits verified, or no sign verified at all.
 */
export function moonNoticeKey(chart: MoonPresentation): 'moonAmbiguousNotice' | 'moonUnverifiedNotice' | null {
  const count = moonCandidates(chart).length;
  return count === 1 ? null : count === 2 ? 'moonAmbiguousNotice' : 'moonUnverifiedNotice';
}

export function moonLabel(chart: MoonPresentation, locale: Locale = 'en'): string {
  const catalogLocale = requireCatalogLocale(locale);
  const candidates = moonCandidates(chart);
  return candidates.length
    ? candidates.map((slug) => signName(SIGNS.find((sign) => sign.slug === slug)!, locale)).join(' / ')
    : t(catalogLocale, 'needsBirthTime');
}
