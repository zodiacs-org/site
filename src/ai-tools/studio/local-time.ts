import { prepareLocalTime, resolveLocalToUtc } from '@zodiacs/engine/geo';
import { parseCivilDate, parseCivilTime } from '../../lib/time/civil-date';
import { canonicalZoneName } from '../../lib/time/zone-names';
import { calculateStudio, type StudioInput } from './model';

export interface LocalDraft { date: string; time: string; zone: string; latitude: string; longitude: string }
export interface StudioCity { label: string; search: string; latitude: string; longitude: string; zone: string }
export const foldCity = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function findStudioCities(cities: readonly StudioCity[], text: string) {
  const words = foldCity(text.trim()).split(/\s+/);
  return text.trim().length < 2 ? [] : cities.filter(city => words.every(word => city.search.includes(word))).slice(0, 6);
}

/**
 * The website's historical clock: the engine's resolver, @zodiacs/engine/geo,
 * whose histories before 1970 are bundled in the panel. Its own record of the
 * resolution goes into the receipt as it stands.
 */
export async function localStudioInput(draft: LocalDraft, houseSystem: StudioInput['houseSystem']) {
  const date = parseCivilDate(draft.date);
  if (!date || date.year < 1800 || date.year > 2199 || !parseCivilTime(draft.time)) throw new Error('Enter a real local date from 1800 to 2199 and a time.');
  const place = { lat: Number(draft.latitude), lon: Number(draft.longitude) };
  if (!draft.latitude.trim() || !draft.longitude.trim() || !Number.isFinite(place.lat) || !Number.isFinite(place.lon) || Math.abs(place.lat) >= 90 || Math.abs(place.lon) > 180) throw new Error('Choose a city, or enter valid coordinates and its time zone.');
  const zone = await canonicalZoneName(draft.zone.trim());
  if (!zone) throw new Error('Choose a city or enter a supported IANA time zone, such as Europe/London.');
  await prepareLocalTime(draft.date, zone);
  const resolved = resolveLocalToUtc(draft.date, draft.time, zone, { longitude: place.lon });
  const utc = resolved.utc.toISOString();
  const input: StudioInput = { date: utc.slice(0, 10), time: utc.slice(11, 23), timeKnown: true,
    latitude: draft.latitude, longitude: draft.longitude, houseSystem,
    local: { flags: [...resolved.flags], resolution: resolved.localResolution } };
  // Checks conversion bounds and that the receipt faithfully preserves its provenance.
  calculateStudio(input);
  // Before 1970 the shipped history answers, except where it records no local time.
  return { input, utc, zoneUncertain: draft.date <= '1970-01-01' && resolved.zone.source !== 'tzdb' };
}
