import type { BirthWindow, BirthWindowInput } from '@zodiacs/engine/window';
import type { PortableChartCalculation } from '../../lib/engine/portable';
import { circularDelta } from '../../lib/compare/angles';
import { houseOf } from '../../lib/engine/houses';
import { signForLongitude } from '../../lib/signs';
import { calculateStudio, type StudioInput } from './model';

export function shiftStudio(input: StudioInput, minutes: number): StudioInput {
  if (![15, 60, 1440].includes(Math.abs(minutes))) throw new Error('Choose a 15-minute, one-hour or one-day step.');
  if (!input.timeKnown && Math.abs(minutes) !== 1440) throw new Error('With unknown time, move by whole days. Each chart uses noon UTC as a reference.');
  const current = calculateStudio(input);
  const shifted = new Date(Date.parse(current.inputSnapshot.utc) + minutes * 60_000);
  if (shifted.getUTCFullYear() < 1800 || shifted.getUTCFullYear() > 2199) throw new Error('Stay within 1800–2199.');
  const iso = shifted.toISOString();
  return { ...input, date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export function timeChanges(anchor: PortableChartCalculation, current: PortableChartCalculation) {
  return current.chart.bodies.map(body => {
    const before = anchor.chart.bodies.find(b => b.body === body.body)!;
    const fromHouse = anchor.chart.houses ? houseOf(before.lon, anchor.chart.houses.cusps) : null;
    const toHouse = current.chart.houses ? houseOf(body.lon, current.chart.houses.cusps) : null;
    const fromSign = signForLongitude(before.lon).name, toSign = signForLongitude(body.lon).name;
    return { body: body.body, fromSign, toSign, fromHouse, toHouse,
      delta: circularDelta(before.lon, body.lon), motionChanged: before.retrograde !== body.retrograde,
      changed: fromSign !== toSign || fromHouse !== toHouse || before.retrograde !== body.retrograde };
  });
}

export interface WindowDraft { start: string; end: string; latitude: string; longitude: string; houseSystem: 'placidus' | 'whole' }
export function initialWindow(input: StudioInput): WindowDraft {
  const at = Date.parse(`${input.date}T${input.timeKnown ? input.time : '12:00'}:00Z`);
  const half = input.timeKnown ? 15 * 60_000 : 12 * 3600_000;
  return { start: new Date(at - half).toISOString().slice(0, 16), end: new Date(at + half).toISOString().slice(0, 16),
    latitude: input.timeKnown ? input.latitude : '', longitude: input.timeKnown ? input.longitude : '',
    houseSystem: input.houseSystem === 'whole' ? 'whole' : 'placidus' };
}
export function windowRequest(draft: WindowDraft): BirthWindowInput {
  const parse = (text: string) => {
    if (!/^(18|19|20|21)\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) throw new Error('Enter both UTC times within 1800–2199.');
    const iso = `${text}:00.000Z`, ms = Date.parse(iso);
    if (!Number.isFinite(ms) || new Date(ms).toISOString() !== iso) throw new Error('Enter real UTC dates and times.');
    return ms;
  };
  const start = parse(draft.start), end = parse(draft.end);
  if (end <= start || end - start > 48 * 3600_000) throw new Error('The end must follow the start, by at most 48 hours.');
  const latitude = Number(draft.latitude), longitude = Number(draft.longitude);
  if (!draft.latitude.trim() || !draft.longitude.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) >= 90 || Math.abs(longitude) > 180) throw new Error('Supply both coordinates: latitude strictly between −90 and 90, longitude from −180 to 180.');
  if (!['placidus', 'whole'].includes(draft.houseSystem)) throw new Error('Choose Placidus or whole-sign houses.');
  return { start: new Date(start), end: new Date(end), latitude, longitude, houseSystem: draft.houseSystem };
}

export function windowSummary(result: BirthWindow) {
  const bodies = Object.keys(result.cells[0].features.signs) as (keyof typeof result.cells[0]['features']['signs'])[];
  return bodies.map(body => {
    const signs = [...new Set(result.cells.map(cell => cell.features.signs[body]))];
    const houses = [...new Set(result.cells.map(cell => cell.features.houses[body]))];
    return { body, signs, houses, stable: signs.length === 1 && signs[0] !== null && houses.length === 1 && houses[0] !== null };
  });
}
