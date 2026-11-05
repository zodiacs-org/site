/**
 * Sect: whether a chart belongs to the day or to the night.
 *
 * It is the oldest division in the tradition and one the wheel cannot show,
 * because it needs a horizon: the Sun above it at birth makes a diurnal
 * chart, below it a nocturnal one. Everything after that follows by table.
 * The Sun, Jupiter and Saturn are the diurnal planets; the Moon, Venus and
 * Mars the nocturnal ones. Whichever half matches the chart is said to be
 * in sect, and the chart's own luminary (the Sun by day, the Moon by night)
 * is its sect light.
 *
 * Mercury takes no side of its own. It goes with the half it rises in:
 * with the day when it comes up ahead of the Sun as a morning star, with
 * the night when it trails behind as an evening star.
 *
 * Uranus, Neptune and Pluto have no place in the scheme, which was settled
 * long before anyone saw them, so they appear on neither list.
 *
 * The altitude that decides all this is geometry, computed from the birth
 * minute and place. Only the reading that follows is a matter of doctrine.
 * Since engine 1.1.0-rc.2 that reading is the engine's own, `sectReading`
 * of `@zodiacs/engine/lite` under its altitude convention; this module keeps
 * the site's names and shapes over it.
 */
import {
  DIURNAL_PLANETS,
  NOCTURNAL_PLANETS,
  orientality as packageOrientality,
  sectReading,
} from '@zodiacs/engine/lite';

export { DIURNAL_PLANETS, NOCTURNAL_PLANETS };

export type Sect = 'day' | 'night';

/** Whether a body rises ahead of the Sun (oriental) or behind it. */
export type Orientality = 'oriental' | 'occidental';

export interface SectReading {
  sect: Sect;
  /** Degrees of the Sun above the horizon; negative is below. */
  sunAltitude: number;
  /** The luminary of the chart's own half. */
  light: 'Sun' | 'Moon';
  /** Null when Mercury's longitude was not supplied. */
  mercury: Orientality | null;
  /** Planets whose own half matches the chart's, Mercury included. */
  inSect: string[];
  outOfSect: string[];
}

/**
 * Whether a body rises before the Sun or after it.
 *
 * The ascendant sweeps the zodiac in increasing longitude, so a body
 * standing earlier in zodiacal order than the Sun reaches the horizon
 * first: the morning star the tradition calls oriental. A body exactly on
 * the Sun rises with it and is counted occidental.
 */
export function orientality(bodyLon: number, sunLon: number): Orientality {
  return packageOrientality(bodyLon, sunLon);
}

/**
 * The chart's sect from the Sun's altitude. The Sun exactly on the horizon
 * counts to the day, the way sunrise starts one rather than ending the
 * night. The engine refuses with a RangeError an altitude outside -90 to 90
 * degrees or a longitude that is not a finite number.
 */
export function sectOf(input: {
  /** Degrees of the Sun above the horizon; negative is below. */
  sunAltitude: number;
  sunLon: number;
  mercuryLon?: number | null;
}): SectReading {
  const reading = sectReading({
    convention: 'altitude',
    sunAltitude: input.sunAltitude,
    sunLon: input.sunLon,
    mercuryLon: input.mercuryLon ?? null,
  });
  return {
    sect: reading.sect,
    sunAltitude: input.sunAltitude,
    light: reading.light,
    mercury: reading.mercury,
    inSect: [...reading.inSect],
    outOfSect: [...reading.outOfSect],
  };
}
