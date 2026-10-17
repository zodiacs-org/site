/** Synthetic births for the calculator tools' tests: no real person's details. */
import type { City } from '../../src/lib/geo/search';
import type { Birth } from '../../src/lib/webmcp/calculators/input';

export const LONDON = { latitude: 51.5074, longitude: -0.1278, timeZone: 'Europe/London' };
export const TOKYO = { latitude: 35.6762, longitude: 139.6503, timeZone: 'Asia/Tokyo' };
export const PARIS = { latitude: 48.8566, longitude: 2.3522, timeZone: 'Europe/Paris' };
export const SYDNEY = { latitude: -33.8688, longitude: 151.2093, timeZone: 'Australia/Sydney' };
export const LONGYEARBYEN = { latitude: 78.2232, longitude: 15.6267, timeZone: 'Arctic/Longyearbyen' };
export const TORONTO = { latitude: 43.6532, longitude: -79.3832, timeZone: 'America/Toronto' };
export const APIA = { latitude: -13.8333, longitude: -171.7513, timeZone: 'Pacific/Apia' };

export const BIRTHS: Array<[string, Birth]> = [
  ['a timed birth', { date: '1990-06-15', time: '14:30', place: LONDON }],
  ['an untimed birth', { date: '1985-03-02', time: null, place: TOKYO }],
  ['local mean time before standard time', { date: '1880-05-02', time: '06:00', place: PARIS }],
  ['a clock-change gap', { date: '2021-03-28', time: '01:30', place: LONDON }],
  ['a clock-change fold', { date: '2021-10-31', time: '01:30', place: LONDON }],
  ['the southern hemisphere', { date: '2003-11-20', time: '23:59', place: SYDNEY }],
  ['the far north', { date: '2001-12-21', time: '08:30', place: LONGYEARBYEN }],
  ['an untimed date near an early clock change', { date: '1919-03-31', time: null, place: TORONTO }],
  ['an untimed date the clock skipped', { date: '2011-12-30', time: null, place: APIA }],
  ['a skipped date', { date: '2011-12-30', time: '08:30', place: APIA }],
  ['the last day', { date: '2199-12-31', time: null, place: SYDNEY }],
];

/** A place as the pages' place search gives it. */
export const city = ({ place }: Pick<Birth, 'place'>): City => ({
  name: 'Synthetic', admin1: '', country: '', pop: 0, lat: place.latitude, lon: place.longitude, tz: place.timeZone,
});
