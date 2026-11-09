/**
 * The sidereal (Vedic) boundary: @zodiacs/engine/vedic's pure functions over
 * the chart engine's tropical longitudes of date. The ayanamsa is read at the
 * chart's own instant on the engine's time basis, as the engine's
 * siderealChart reads it, and subtracted with siderealLongitude; nakshatraOf
 * places the Moon. Like ./full it carries the ephemeris. In the browser it is
 * reached only inside the /vedic-signs/ page's worker
 * (src/islands/vedic-signs/vedic.worker.ts), a bundle of its own, because
 * @zodiacs/engine/vedic shares the engine's internal chunks: imported in the
 * page's own module graph it would split the engine chunk every chart page
 * loads past its budget. The /vedic-signs/ page and the get_vedic_signs tool
 * both come through here (src/lib/vedic-signs/compute.ts).
 */
import { ayanamsa, nakshatraOf, siderealLongitude } from '@zodiacs/engine/vedic';
import type { VedicAyanamsa } from '../vedic-signs/wording';

export interface SiderealPoint {
  /** Sidereal longitude of date, degrees in [0, 360). */
  lon: number;
  /** The tropical longitude of date it came from. */
  tropical: number;
}

export interface SiderealMoment {
  /** The true ayanamsa subtracted, degrees. */
  ayanamsa: number;
  sun: SiderealPoint;
  moon: SiderealPoint;
  rising: SiderealPoint | null;
  /** The Moon's nakshatra: index 0 (Ashwini) to 26 (Revati), its pada and its Vimshottari lord. */
  nakshatra: { index: number; pada: 1 | 2 | 3 | 4; lord: string };
}

/** The sidereal Sun, Moon and rising degree at one instant, from the tropical longitudes of date the chart engine gave. */
export function siderealMoment(utc: Date, tropical: { sun: number; moon: number; asc: number | null }, name: VedicAyanamsa): SiderealMoment {
  const value = ayanamsa(name, utc);
  const point = (lon: number): SiderealPoint => ({ lon: siderealLongitude(lon, value).lon, tropical: lon });
  const moon = siderealLongitude(tropical.moon, value);
  const position = nakshatraOf(moon);
  return {
    ayanamsa: value.true,
    sun: point(tropical.sun),
    moon: { lon: moon.lon, tropical: tropical.moon },
    rising: tropical.asc === null ? null : point(tropical.asc),
    nakshatra: { index: position.index, pada: position.pada, lord: position.lord },
  };
}
