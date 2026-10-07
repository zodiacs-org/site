import { parseCivilDate, parseCivilTime } from '../../lib/time/civil-date';
import { prepareLocalTime, resolveLocalToUtc } from '../../lib/time/localToUtc';
import { canonicalZoneName } from '../../lib/time/zone-names';
import { loadZoneHistory } from '../../lib/time/tz-history-load';
import { tzdb } from '../../data/tz-lmt.json';
import { calculateStudio, type StudioInput } from './model';

export interface LocalDraft { date: string; time: string; zone: string; latitude: string; longitude: string }
export interface StudioCity { label: string; search: string; latitude: string; longitude: string; zone: string }
export const foldCity = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function findStudioCities(cities: readonly StudioCity[], text: string) {
  const words = foldCity(text.trim()).split(/\s+/);
  return text.trim().length < 2 ? [] : cities.filter(city => words.every(word => city.search.includes(word))).slice(0, 6);
}

/** Same historical clock as the website; all tables are bundled in the panel. */
export async function localStudioInput(draft: LocalDraft, houseSystem: StudioInput['houseSystem']) {
  const date = parseCivilDate(draft.date);
  if (!date || date.year < 1800 || date.year > 2199 || !parseCivilTime(draft.time)) throw new Error('Enter a real local date from 1800 to 2199 and a time.');
  const place = { lat: Number(draft.latitude), lon: Number(draft.longitude) };
  if (!draft.latitude.trim() || !draft.longitude.trim() || !Number.isFinite(place.lat) || !Number.isFinite(place.lon) || Math.abs(place.lat) >= 90 || Math.abs(place.lon) > 180) throw new Error('Choose a city, or enter valid coordinates and its time zone.');
  const zone = await canonicalZoneName(draft.zone.trim());
  if (!zone) throw new Error('Choose a city or enter a supported IANA time zone, such as Europe/London.');
  await prepareLocalTime(draft.date, zone);
  const resolved = resolveLocalToUtc(draft.date, draft.time, zone, { longitude: place.lon });
  const early = draft.date <= '1970-01-01';
  const pinned = early && (await loadZoneHistory(zone)) !== null;
  const gapShiftMinutes = (resolved.utc.getTime() + resolved.offsetMinutes * 60_000 - Date.parse(`${draft.date}T${draft.time}:00Z`)) / 60_000;
  const utc = resolved.utc.toISOString();
  const input: StudioInput = { date: utc.slice(0, 10), time: utc.slice(11, 23), timeKnown: true,
    latitude: draft.latitude, longitude: draft.longitude, houseSystem,
    local: { flags: resolved.flags, resolution: { date: draft.date, time: draft.time, timeZone: zone,
      offsetMinutes: resolved.offsetMinutes, gapShiftMinutes,
      policy: { fold: 'earlier', gap: 'shift-forward' }, calendar: 'gregorian',
      tzdbVersion: pinned ? tzdb : null,
      dataForm: pinned ? 'main+backzone' : 'host',
      clock: resolved.localMeanTime ? 'local-mean-time' : 'legal', localMeanTime: resolved.localMeanTime ?? null } } };
  // Checks conversion bounds and that the receipt faithfully preserves its provenance.
  calculateStudio(input);
  return { input, utc, zoneUncertain: early && !pinned };
}
