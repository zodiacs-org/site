import type { z } from 'zod';
import { SIGN_SLUGS } from '../../lib/compute-api/constants';
import { instantAt } from '../../lib/compute-api/validate';
import { computeChart } from '../../lib/engine/full';
import { houseOf } from '../../lib/engine/houses';
import { signIndexForLongitude } from '../../lib/signs';
import type { momentChartInput, momentChartData } from './moment-chart-contract';

export function castMomentChart(args: z.infer<typeof momentChartInput>, now: Date): z.infer<typeof momentChartData> {
  const { date: utc } = instantAt(args.instant ?? now.toISOString(), '/instant');
  const chart = computeChart({ utc, latitude: args.latitude, longitude: args.longitude,
    houseSystem: args.houseSystem === 'placidus' ? 'placidus' : 'whole', timeKnown: true });
  const { angles, houses } = chart;
  if (!angles || !houses) throw new Error('The sky chart requires angles and houses.');
  return {
    kind: 'moment', instant: utc.toISOString(), angles,
    houses: { system: houses.system === 'whole' ? 'whole-sign' : houses.system, cusps: houses.cusps, polarFallback: chart.flags.includes('polar-fallback') },
    positions: chart.bodies.map(({ body, lon, retrograde }) => ({
      body, longitude: lon, sign: SIGN_SLUGS[signIndexForLongitude(lon)], house: houseOf(lon, houses.cusps), retrograde,
    })),
    aspects: chart.aspects,
  };
}
