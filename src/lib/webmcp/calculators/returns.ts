/**
 * The return pages' tools. /solar-return/ and /lunar-return/ calculate with their islands' own compute modules, which
 * these call as the pages do; /saturn-return/ reads its birth instant as SaturnReturnCalculator does
 * (returns.test.ts runs the island's code beside this).
 */
import { computeLunarReturn } from '../../../islands/lunar-return/compute';
import { computeSolarReturn } from '../../../islands/solar-return/compute';
import { saturnReturns } from '../../engine/returns';
import { houseOf } from '../../engine/houses';
import type { Chart, HouseSystem } from '../../engine/types';
import { prepareLocalTime, resolveLocalToUtc } from '../../time/localToUtc';
import { ENGINE, pageUrl, position } from './format';
import type { Birth, Place } from './input';

const asPagePlace = (place: Place) => ({ name: '', lat: place.latitude, lon: place.longitude, tz: place.timeZone });

/** A return chart as the result pages list it: each body with its house, and the angles when the chart has a place. */
function returnChart(chart: Chart) {
  return {
    instant: chart.input.utc.toISOString(),
    houseSystem: chart.houses?.system ?? null,
    bodies: chart.bodies.map((body) => ({
      body: body.body,
      ...position(body.lon),
      retrograde: body.retrograde,
      house: chart.houses ? houseOf(body.lon, chart.houses.cusps) : null,
    })),
    angles: chart.angles ? {
      ascendant: position(chart.angles.asc),
      midheaven: position(chart.angles.mc),
    } : null,
  };
}

/**
 * /saturn-return/: natal Saturn and each return season through the third, with every pass. With a place the birth is
 * read at the place's local time (noon without a time); without one, at noon UTC.
 */
export async function saturnReturnResult(date: string, time: string | null, place: Place | null, now: Date) {
  if (place) await prepareLocalTime(date, place.timeZone);
  const utc = place
    ? resolveLocalToUtc(date, time ?? '12:00', place.timeZone, { longitude: place.longitude }).utc
    : new Date(`${date}T12:00:00Z`);
  const result = saturnReturns(utc);
  return {
    computedUtc: utc.toISOString(),
    basis: place ? (time ? 'birth-time' as const : 'local-noon' as const) : 'utc-noon' as const,
    natalSaturn: { ...position(result.natalLon), retrograde: result.natalRetrograde },
    seasons: result.seasons.map((season) => ({
      return: season.index,
      first: season.first.toISOString(),
      last: season.last.toISOString(),
      status: season.last.getTime() < now.getTime() ? 'past' as const
        : season.first.getTime() > now.getTime() ? 'upcoming' as const : 'active' as const,
      passes: season.crossings.map((crossing) => ({ at: crossing.at.toISOString(), retrograde: crossing.retrograde })),
    })),
    rangeClipped: result.rangeClipped,
    engine: ENGINE,
    page: pageUrl('/saturn-return/'),
  };
}

/**
 * /solar-return/ (SolarReturnCalculator from a typed birth): the return for a year, or the one in force now, cast at
 * the birthplace or at another place. Without a birth time the natal Sun is read at noon UTC on the birth date and
 * the chart has no place.
 */
export async function solarReturnResult(
  birth: Birth,
  year: 'current' | number,
  castPlace: Place | null,
  houseSystem: HouseSystem,
  now: Date,
) {
  await prepareLocalTime(birth.date, birth.place.timeZone);
  const birthplace = asPagePlace(birth.place);
  const data = computeSolarReturn({
    birthDate: birth.date,
    birthTime: birth.time,
    timeKnown: birth.time !== null,
    birthplace,
    savedSunLon: null,
    savedUtc: null,
    houseSystem,
    castLocation: castPlace ? asPagePlace(castPlace) : birthplace,
    year,
  }, now);
  return {
    returnYear: data.returnYear,
    timeKnown: !data.noTime,
    ...returnChart(data.chart),
    engine: ENGINE,
    page: pageUrl('/solar-return/'),
  };
}

/**
 * /lunar-return/ (LunarReturnCalculator from a typed birth): the first return after an instant, cast at the birthplace
 * or at another place. It needs the birth time, unambiguous on the local clock.
 */
export async function lunarReturnResult(birth: Birth, after: Date, castPlace: Place | null, houseSystem: HouseSystem) {
  await prepareLocalTime(birth.date, birth.place.timeZone);
  const data = computeLunarReturn({
    birthDate: birth.date,
    birthTime: birth.time,
    timeKnown: birth.time !== null,
    birthplace: asPagePlace(birth.place),
    houseSystem,
    castLocation: castPlace ? asPagePlace(castPlace) : null,
  }, after);
  return {
    after: data.referenceUtc,
    natalLocalMeanTime: data.natalLocalMeanTime,
    ...returnChart(data.chart),
    engine: ENGINE,
    page: pageUrl('/lunar-return/'),
  };
}
