import type { Chart } from '../../lib/engine/types';
import { houseOf } from '../../lib/engine/houses';
import { formatLongitude, signForLongitude } from '../../lib/signs';
import type { SolarReturnResultData } from './compute';
import { planetsOnlyReturnReading, SR_COPY } from './copy';
import { softenMinor } from '../../lib/reading-guards';

export function guardSolarReturnCopy(text: string, under18?: boolean): string {
  return under18 ? softenMinor(text.replace('romance, play, children', 'play, creativity, projects')) : text;
}

export interface SolarReturnExportModel {
  returnYear: number;
  instantUtc: string;
  title: 'Solar return' | 'Approximate solar return';
  noTime: boolean;
  noPlace: boolean;
  atPole?: boolean;
  engineVersion: string;
  wheel: Pick<Chart, 'bodies' | 'angles' | 'houses' | 'aspects'>;
  reading: Array<{ kind: 'asc' | 'sun-house' | 'planets-only'; text: string }>;
  readingBasis: string[];
  notes: string[];
}

/** A completed return only: birth inputs, names and cast coordinates never enter exports. */
export function solarReturnExportModel(result: SolarReturnResultData): SolarReturnExportModel {
  const { chart, noTime, noPlace } = result;
  const atPole = result.atPole === true;
  const angles = !noTime && !noPlace && !atPole && chart.angles ? { ...chart.angles } : null;
  const houses = !noTime && !noPlace && !atPole && chart.houses
    ? { system: chart.houses.system, cusps: [...chart.houses.cusps] }
    : null;
  const sun = chart.bodies.find((body) => body.body === 'Sun');
  if (!sun) throw new Error('The return chart has no Sun position.');
  const ascSign = angles ? signForLongitude(angles.asc) : null;
  const sunHouse = houses ? houseOf(sun.lon, houses.cusps) : null;
  const reading: SolarReturnExportModel['reading'] = [];
  const readingBasis: string[] = [];
  if (ascSign && angles) {
    reading.push({ kind: 'asc', text: guardSolarReturnCopy(SR_COPY.asc[ascSign.slug as keyof typeof SR_COPY.asc], result.under18) });
    readingBasis.push(`Ascendant ${formatLongitude(angles.asc)}`);
  }
  if (sunHouse) {
    reading.push({ kind: 'sun-house', text: guardSolarReturnCopy(SR_COPY.sunHouse[sunHouse], result.under18) });
    readingBasis.push(`Sun in house ${sunHouse}`);
  }
  if (!reading.length) {
    const planets = planetsOnlyReturnReading(chart.bodies, chart.aspects);
    reading.push({ kind: 'planets-only', text: guardSolarReturnCopy(planets.text, result.under18) });
    readingBasis.push(planets.receipt);
  }
  return {
    returnYear: result.returnYear,
    instantUtc: chart.input.utc.toISOString(),
    title: noTime ? 'Approximate solar return' : 'Solar return',
    noTime, noPlace,
    ...(atPole ? { atPole: true } : {}),
    engineVersion: chart.engineVersion,
    wheel: {
      bodies: chart.bodies.map((body) => ({ ...body })),
      aspects: chart.aspects.map((aspect) => ({ ...aspect })),
      angles, houses,
    },
    reading, readingBasis,
    notes: [
      ...(noTime ? ['The return instant can shift by hours with your exact birth time. Houses and angles are omitted.'] : []),
      ...(noPlace ? ['No stored birthplace is available, so this return is planets-only.'] : []),
      ...(atPole ? ['The rising sign and houses are undefined at a geographic pole, so houses and angles are omitted.'] : []),
      ...(result.clockLimit ? [result.clockLimit] : []),
    ],
  };
}
