/** Pure projection of a complete engine chart into the site's existing shape. */
import type {
  Chart as EngineChart,
  Houses as EngineHouses,
  HouseSystem as EngineHouseSystem,
} from '@zodiacs/engine';
import type { BodyPosition, Chart, ChartInput, Houses, HouseSystem } from './types';

/**
 * The site offers whole-sign and Placidus houses. The engine also computes
 * Porphyry since 0.1.1-rc.7, but only when asked, and nothing here asks:
 * Placidus falls back to whole sign, never to Porphyry.
 */
export function siteHouseSystem(system: EngineHouseSystem): HouseSystem {
  if (system === 'whole' || system === 'placidus') return system;
  throw new RangeError(`${system} houses are not offered on this site.`);
}

/** The same table, typed as the site's once its system is one the site offers. */
export function siteHouses(houses: EngineHouses): Houses {
  siteHouseSystem(houses.system);
  return houses as Houses;
}

export const adaptBody = (position: BodyPosition): BodyPosition => ({
  body: position.body,
  lon: position.lon,
  lat: position.lat,
  speed: position.speed,
  retrograde: position.retrograde,
});

/** Preserve the caller's input identity and the established numerical references. */
export function adaptChart(chart: EngineChart, input: ChartInput): Chart {
  return {
    input,
    bodies: chart.bodies.map(adaptBody),
    angles: chart.angles,
    houses: chart.houses === null ? null : siteHouses(chart.houses),
    aspects: chart.aspects,
    flags: [...chart.flags],
    engineVersion: chart.engineVersion,
    deltaT: chart.deltaT,
    timeScale: chart.timeScale,
  };
}
