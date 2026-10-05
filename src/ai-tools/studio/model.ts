import { serializeNatalEnvelope } from '@zodiacs/engine/receipt';
import { computePortableChart, type PortableChartCalculation } from '../../lib/engine/portable';
import { houseOf } from '../../lib/engine/houses';
import type { HouseSystem } from '../../lib/engine/types';
import { formatLongitude, signForLongitude } from '../../lib/signs';
import { buildSceneModel } from '../../lib/scene/build';
import { entityId, type EntityRef } from '../../lib/scene/types';

export interface StudioInput {
  date: string;
  time: string;
  timeKnown: boolean;
  latitude: string;
  longitude: string;
  houseSystem: HouseSystem;
}
export const EXAMPLE: StudioInput = { date: '1990-06-15', time: '12:00', timeKnown: true, latitude: '51.5074', longitude: '-0.1278', houseSystem: 'placidus' };
export const houseName = (system: HouseSystem) => system === 'whole' ? 'Whole sign' : 'Placidus';

export function calculateStudio(input: StudioInput): PortableChartCalculation {
  if (!/^(18|19|20|21)\d{2}-\d{2}-\d{2}$/.test(input.date) || (input.timeKnown && !/^\d{2}:\d{2}$/.test(input.time))) throw new Error('Enter a valid UTC date from 1800 to 2199 and a time.');
  if (!['placidus', 'whole'].includes(input.houseSystem)) throw new Error('Choose Placidus or whole-sign houses.');
  const time = input.timeKnown ? input.time : '12:00';
  const utc = `${input.date}T${time}:00.000Z`;
  const date = new Date(utc);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== utc) throw new Error('Enter a real UTC date and time.');
  const hasLat = input.timeKnown && input.latitude.trim() !== '', hasLon = input.timeKnown && input.longitude.trim() !== '';
  if (hasLat !== hasLon) throw new Error('Enter both coordinates, or leave both empty.');
  const latitude = Number(input.latitude), longitude = Number(input.longitude);
  if (hasLat && (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) >= 90 || Math.abs(longitude) > 180)) throw new Error('Latitude must be between −90 and 90, excluding the poles. Longitude must be between −180 and 180.');
  return computePortableChart({ utc, timeKnown: input.timeKnown, houseSystem: input.houseSystem,
    ...(hasLat && input.timeKnown ? { latitude, longitude } : {}) },
  { sourceInstant: utc, reference: input.timeKnown ? 'supplied-instant' : 'utc-noon' });
}

export function compareStudio(current: PortableChartCalculation, other: PortableChartCalculation) {
  return current.chart.bodies.map(body => ({ body: body.body,
    currentHouse: current.chart.houses ? houseOf(body.lon, current.chart.houses.cusps) : null,
    comparedHouse: other.chart.houses ? houseOf(body.lon, other.chart.houses.cusps) : null,
  }));
}

/** The preview and the host receive these same bytes. No names, coordinates or full receipt. */
export function selectionContext(run: PortableChartCalculation, selection: EntityRef | null): string {
  const scene = buildSceneModel(run.chart, { wheelConventions: false });
  const base = { schema: 'zodiacs.chart-studio-selection.v1', engine: run.chart.engineVersion,
    zodiac: 'tropical', timeKnown: run.chart.input.timeKnown,
    reference: run.envelope.receipt.reference, houses: run.envelope.receipt.houses,
    flags: run.chart.flags, selection: selection ? entityId(selection) : null };
  let facts: unknown = { message: 'No chart element selected.' };
  if (selection?.kind === 'body') {
    const b = scene.bodies.find(body => body.body === selection.body);
    if (!b) throw new Error('Choose an element in this chart.');
    facts = { body: b.body, longitude: b.lon, position: formatLongitude(b.lon), house: b.house,
      retrograde: b.retrograde, speedDegreesPerDay: b.speed,
      aspects: scene.aspects.filter(a => a.a === b.body || a.b === b.body) };
  } else if (selection?.kind === 'house') {
    const h = scene.houses?.find(house => house.index === selection.house);
    if (!h) throw new Error('This chart has no houses.');
    facts = { house: h.index, cuspLongitude: h.cuspLon, position: formatLongitude(h.cuspLon), occupants: h.occupants };
  } else if (selection?.kind === 'sign') {
    facts = { sign: selection.sign, bodies: scene.bodies.filter(b => b.sign === selection.sign).map(b => ({ body: b.body, position: formatLongitude(b.lon) })) };
  } else if (selection?.kind === 'aspect') {
    const a = scene.aspects.find(a => entityId({ kind: 'aspect', ...a }) === entityId(selection));
    if (!a) throw new Error('Choose an aspect in this chart.');
    facts = a;
  } else if (selection?.kind === 'angle') {
    const lon = run.chart.angles?.[selection.angle];
    if (lon === undefined) throw new Error('This chart has no angles.');
    facts = { angle: selection.angle, longitude: lon, sign: signForLongitude(lon).name, position: formatLongitude(lon) };
  }
  return JSON.stringify({ ...base, facts }, null, 2);
}
export const recordText = (run: PortableChartCalculation) => serializeNatalEnvelope(run.envelope);
