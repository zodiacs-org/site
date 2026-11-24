import { readFileSync } from 'node:fs';
import { createServer, request, type Server } from 'node:http';
import { afterAll, describe, expect, it, vi } from 'vitest';
import * as geometry from '../../lib/astrocartography/lines';
import { skyEvents } from '@zodiacs/engine/sky';
import { computeChart } from '../../lib/engine/full.js';
import { meanObliquity } from '../../lib/engine/houses';
import { ACG_BODIES, distanceKm, distanceToMeridianKm, eclipticToEquatorial, horizonLine, horizonLongitude, lineDistances, mcLongitude, ramcFromMc, wrapLongitude } from '../../lib/astrocartography/lines';
import { LINE_MEANING, MINOR_NOTE } from '../../lib/astrocartography/meanings';
import { ageCheckDate, coverageInputRefusal, executeAiTool } from '../tools';
import { createAiNodeHandler } from '../http';
import { INPUT_SCHEMAS, UNDER_13_REFUSAL } from '../contracts';
import { loadPlaceTable } from '../features/place-table';
import { coordinateText, placeId, placeLabelText, rowPoint } from '../../lib/geo/place-label';
import { astrocartographyInput, astrocartographyTool, COUNTRY_ALIASES, countryNameMatches, equatorialBodies, greenwichSiderealDegrees, resolvePlace } from './astrocartography';
import { forbiddenClaim } from './shared';
import { parseAstrocartographyShare } from '../../lib/astrocartography/share';
import { astrocartographyCardModel, astrocartographyStoryAddress, handleResultShareNodeRequest } from '../../server/result-preview';
import { requestOrigin } from '../../server/chart-preview';

const BIRTH = new Date('1990-05-03T07:30:00Z');
const PAGE_FLAG = 'PUBLIC_ASTROCARTOGRAPHY_ENABLED';
const ON = { occasions: true, coverage: true, personal: true, now: () => new Date('2026-11-09T09:00:00Z'), placeTable: async () => loadPlaceTable(), sitePageOn: (flag: string) => flag === PAGE_FLAG };
const bodies = equatorialBodies(BIRTH);
const gast = greenwichSiderealDegrees(BIRTH);
const minutesFrom = (at: Date) => Math.abs(at.getTime() - BIRTH.getTime()) / 60_000;

/** The engine's own rise, set and transit search (@zodiacs/engine/sky), geometric horizon, the body's centre. */
function eventsAt(body: string, latitude: number, longitude: number) {
  const result = skyEvents(body as never, { latitude, longitude }, new Date(BIRTH.getTime() - 3 * 3_600_000), new Date(BIRTH.getTime() + 3 * 3_600_000), { limb: 'centre', refraction: 'none' });
  if (result.status !== 'complete') throw new Error('refused');
  return result.events;
}

describe('astrocartography lines against the engine\'s own rise, set and transit times', () => {
  it('puts every planet on its Midheaven line exactly at its upper transit, and on its IC line at its lower transit', () => {
    for (const entry of bodies.filter((row) => row.body !== 'Moon')) {
      for (const latitude of [-35, 0, 40, 60]) {
        const mc = mcLongitude(entry, gast);
        const upper = eventsAt(entry.body, latitude, mc).find((event) => event.kind === 'upper-transit')!;
        expect(minutesFrom(upper.at), `${entry.body} MC at ${latitude}`).toBeLessThan(0.5);
        const lower = eventsAt(entry.body, latitude, wrapLongitude(mc + 180)).find((event) => event.kind === 'lower-transit')!;
        expect(minutesFrom(lower.at), `${entry.body} IC at ${latitude}`).toBeLessThan(0.5);
      }
    }
  });

  it('puts every planet on its Ascendant line as it rises and on its Descendant line as it sets', () => {
    for (const entry of bodies.filter((row) => row.body !== 'Moon')) {
      for (const latitude of [-40, -10, 25, 51.5]) {
        for (const [angle, kind] of [['ASC', 'rise'], ['DSC', 'set']] as const) {
          const longitude = horizonLongitude(entry, gast, latitude, angle);
          if (longitude === null) continue;
          const event = eventsAt(entry.body, latitude, longitude).find((row) => row.kind === kind);
          expect(event, `${entry.body} ${angle} at ${latitude}`).toBeDefined();
          // Geocentric lines against a topocentric search: a planet's parallax is seconds of time at most.
          expect(minutesFrom(event!.at), `${entry.body} ${angle} at ${latitude}`).toBeLessThan(1);
        }
      }
    }
  });

  it('keeps the Moon within its parallax (about a degree, a few minutes of time) of the topocentric search', () => {
    const moon = bodies.find((row) => row.body === 'Moon')!;
    const event = eventsAt('Moon', 30, mcLongitude(moon, gast)).find((row) => row.kind === 'upper-transit')!;
    expect(minutesFrom(event.at)).toBeLessThan(5);
  });

  it('agrees with the relocated chart: on the Sun\'s Ascendant line the chart\'s rising degree is the Sun\'s longitude', () => {
    const sun = bodies.find((row) => row.body === 'Sun')!;
    for (const latitude of [-30, 10, 48]) {
      const longitude = horizonLongitude(sun, gast, latitude, 'ASC')!;
      const chart = computeChart({ utc: BIRTH, latitude, longitude, houseSystem: 'whole', timeKnown: true });
      const sunLon = chart.bodies.find((row) => row.body === 'Sun')!.lon;
      expect(Math.abs(wrapLongitude(chart.angles!.asc - sunLon))).toBeLessThan(0.01);
      // And on its Midheaven line, the chart's Midheaven is the Sun's longitude.
      const atMc = computeChart({ utc: BIRTH, latitude, longitude: mcLongitude(sun, gast), houseSystem: 'whole', timeKnown: true });
      expect(Math.abs(wrapLongitude(atMc.angles!.mc - sunLon))).toBeLessThan(0.01);
    }
  });

  it('puts the Sun overhead at the longitude of solar noon: 66.7 degrees east at 07:30 UTC on 3 May 1990', () => {
    // Apparent noon at 07:30 UTC is 4.5 hours east of Greenwich, 67.5 degrees, less the equation of time (+3.2 minutes, 0.8 degrees).
    expect(mcLongitude(bodies.find((row) => row.body === 'Sun')!, gast)).toBeCloseTo(66.72, 1);
  });

  it('reads Greenwich sidereal time and the Sun\'s right ascension and declination at J2000 as published', () => {
    // 2000-01-01 12:00 UT: Greenwich sidereal time 280.46 degrees (18h 41m 50s); the Sun at
    // right ascension 281.29 degrees (18h 45m 09s), declination -23.03 degrees (Astronomical Almanac 2000).
    const j2000 = new Date('2000-01-01T12:00:00Z');
    expect(greenwichSiderealDegrees(j2000)).toBeCloseTo(280.46, 1);
    const sun = equatorialBodies(j2000).find((row) => row.body === 'Sun')!;
    expect(sun.ra).toBeCloseTo(281.29, 1);
    expect(sun.dec).toBeCloseTo(-23.03, 1);
  });
});

describe('astrocartography geometry', () => {
  it('measures great-circle distances: London to Paris is about 344 km', () => {
    expect(distanceKm({ lat: 51.5074, lon: -0.1278 }, { lat: 48.8566, lon: 2.3522 })).toBeCloseTo(344, -1);
    // A meridian 1 degree away at the equator is 111 km; at 60 degrees north it is half that.
    expect(distanceToMeridianKm({ lat: 0, lon: 0 }, 1)).toBeCloseTo(111.2, 0);
    expect(distanceToMeridianKm({ lat: 60, lon: 0 }, 1)).toBeCloseTo(55.6, 0);
    expect(distanceToMeridianKm({ lat: 60, lon: 0 }, 179)).toBeCloseTo(30 * 111.195, -1);
  });

  it('stops a rising line where the planet only grazes the horizon, and draws it as a meridian on the equator', () => {
    const line = horizonLine({ ra: 90, dec: 23.44 }, 0, 'ASC');
    expect(Math.max(...line.map((point) => Math.abs(point.lat)))).toBeLessThanOrEqual(85);
    expect(horizonLongitude({ ra: 90, dec: 23.44 }, 0, 70, 'ASC')).toBeNull();
    expect(new Set(horizonLine({ ra: 90, dec: 0 }, 0, 'ASC').map((point) => point.lon))).toEqual(new Set([0]));
  });

  it('keeps the rising and setting lines whole for a declination near zero, close to an equinox', () => {
    // At 07:30 UTC on 20 March 2000 the Sun's declination is about -0.0014 degrees: every hour-angle step fell past 85 degrees, so both lines were empty.
    const at = new Date('2000-03-20T07:30:00Z');
    const equinox = equatorialBodies(at);
    const equinoxGast = greenwichSiderealDegrees(at);
    const sun = equinox.find((row) => row.body === 'Sun')!;
    expect(Math.abs(sun.dec)).toBeLessThan(0.01);
    const drawn = geometry.mapLines(equinox, equinoxGast).find((row) => row.body === 'Sun')!;
    for (const [angle, line] of [['ASC', drawn.asc], ['DSC', drawn.dsc]] as const) {
      expect(line.length, angle).toBeGreaterThan(300);
      expect(line[0].lat, angle).toBeCloseTo(-85, 6);
      expect(line.at(-1)!.lat, angle).toBeCloseTo(85, 6);
      for (let index = 1; index < line.length; index += 1) {
        expect(line[index].lat - line[index - 1].lat, `${angle} at ${line[index].lat}`).toBeGreaterThan(0);
        expect(line[index].lat - line[index - 1].lat, `${angle} at ${line[index].lat}`).toBeLessThanOrEqual(0.5 + 1e-9);
      }
      for (const point of line) expect(Math.abs(wrapLongitude(point.lon - horizonLongitude(sun, equinoxGast, point.lat, angle)!)), `${angle} at ${point.lat}`).toBeLessThan(1e-9);
      // A place on the line is found on it, so the distance a city is read at is not lost.
      const place = { lat: 10, lon: horizonLongitude(sun, equinoxGast, 10, angle)! };
      const row = lineDistances(place, equinox, equinoxGast).find((entry) => entry.body === 'Sun' && entry.angle === angle)!;
      expect(row.km, angle).toBeLessThan(1);
    }
    // And for any small declination, either side of zero: whole, in order, and no stretch of latitude left wider than a step.
    for (const dec of [1e-6, -1e-4, 0.01, -0.1, 0.5, 2, -3.4]) {
      for (const angle of ['ASC', 'DSC'] as const) {
        const line = horizonLine({ ra: 30, dec }, 100, angle);
        const reach = Math.min(85, 90 - Math.abs(dec));
        expect(line[0].lat, `${dec} ${angle}`).toBeLessThanOrEqual(-reach + 0.5);
        expect(line.at(-1)!.lat, `${dec} ${angle}`).toBeGreaterThanOrEqual(reach - 0.5);
        for (let index = 1; index < line.length; index += 1) expect(line[index].lat - line[index - 1].lat, `${dec} ${angle}`).toBeLessThanOrEqual(0.5 + 1e-9);
      }
    }
  });

  it('finds a place on a line at distance zero, and lists the nearest first', () => {
    const venus = bodies.find((row) => row.body === 'Venus')!;
    const lon = horizonLongitude(venus, gast, 20, 'DSC')!;
    const rows = lineDistances({ lat: 20, lon }, bodies, gast);
    expect(rows[0]).toMatchObject({ body: 'Venus', angle: 'DSC' });
    expect(rows[0].km).toBeLessThan(1);
    expect(rows.map((row) => row.km)).toEqual([...rows.map((row) => row.km)].sort((a, b) => a - b));
    expect(rows).toHaveLength(40);
  });

  it('has a reading for every planet on every angle, inside the copy rule', () => {
    for (const body of ACG_BODIES) for (const text of Object.values(LINE_MEANING[body])) expect(forbiddenClaim(text), text).toBeNull();
  });
});

describe('get_astrocartography', () => {
  it('names the nearest lines to the cities asked for, and puts neither the cities nor the birth details in a link', async () => {
    const result = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: ['New York', 'Lisbon', 'Paris, France', 'Qwxzv'] }, ON) as { ok: true; data: any; links: { url: string }[] };
    expect(result.ok).toBe(true);
    expect(result.data.instantUtc).toBe('1990-05-03T07:30:00.000Z');
    expect(result.data.cities.map((city: { name: string }) => city.name)).toEqual(['New York City', 'Lisbon', 'Paris']);
    expect(result.data.unmatched).toEqual(['Qwxzv']);
    const newYork = result.data.cities[0];
    expect(newYork.closest[0]).toMatchObject({ planet: 'Mars', angle: 'ASC', strength: 'strong' });
    expect(newYork.closest[0].distanceKm).toBeLessThan(100);
    expect(newYork.closest[0].line).toMatch(/Reading confidence \d+%\.$/u);
    for (const city of result.data.cities) {
      expect(city.closest.length).toBeGreaterThanOrEqual(3);
      for (const row of city.closest) expect(row.distanceKm % 10).toBe(0);
    }
    const text = JSON.stringify(result);
    expect(forbiddenClaim(text)).toBeNull();
    for (const url of text.match(/https:\/\/[^"]+/gu) ?? []) expect(url).not.toMatch(/1990|08:30|London|New|Lisbon|Paris/u);
    expect(result.data.lines).toHaveLength(10);
  });

  it('reads the city asked for when its whole name is in the index, not a longer name that starts with it', async () => {
    const result = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: ['Kerman, Iran', 'Dali, China', 'Kerman', 'Dali'] }, ON) as { ok: true; data: any };
    expect(result.ok).toBe(true);
    expect(result.data.cities.map((city: { name: string; country: string }) => `${city.name}, ${city.country}`)).toEqual(['Kerman, Iran', 'Dali, China', 'Kerman, Iran', 'Dali, China']);
    // Kerman is at about 30.3 N 57.1 E (Kermanshah 34.3 N 47.1 E); Dali about 25.6 N 100.2 E (Dalian 38.9 N 121.6 E).
    expect(result.data.cities[0]).toMatchObject({ latitude: expect.closeTo(30.3, 0), longitude: expect.closeTo(57.1, 0) });
    expect(result.data.cities[1]).toMatchObject({ latitude: expect.closeTo(25.6, 0), longitude: expect.closeTo(100.2, 0) });
  });

  it('reads the place whose whole name was asked for in the country given, and asks when several share it', async () => {
    const result = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: ['Aparecida, Brazil', 'Belmont, United States', 'Kerman, Iran', 'Dali, China'] }, ON) as { ok: true; data: any };
    expect(result.ok).toBe(true);
    // Aparecida (Sao Paulo, about 22.8 S 45.2 W), not Aparecida de Goiânia (16.8 S 49.2 W); Kerman, not Kermanshah; Dali, not Dalian.
    expect(result.data.cities.map((city: { name: string; region: string; country: string }) => `${city.name}, ${city.region}, ${city.country}`)).toEqual(['Aparecida, Sao Paulo, Brazil', 'Kerman, Kerman, Iran', 'Dali, Yunnan, China']);
    expect(result.data.cities[0]).toMatchObject({ latitude: expect.closeTo(-22.8, 0), longitude: expect.closeTo(-45.2, 0) });
    // Two towns are called Belmont in the United States: no guess, and never Belmont Cragin.
    expect(result.data.ambiguous).toEqual([{ asked: 'Belmont, United States', places: [
      { id: expect.stringMatching(/^p[0-9a-z]{11}$/u), name: 'Belmont', region: 'California', country: 'United States', label: 'Belmont, California, United States' },
      { id: expect.stringMatching(/^p[0-9a-z]{11}$/u), name: 'Belmont', region: 'Massachusetts', country: 'United States', label: 'Belmont, Massachusetts, United States' },
    ] }]);
    expect(result.data.unmatched).toEqual([]);
    expect(result.data.limits).toContain('More than one town or city matches Belmont, United States: Belmont, California, United States; Belmont, Massachusetts, United States. Add the region or country after a comma to choose one, such as Belmont, California, United States.');
    expect(JSON.stringify(result.data.cities)).not.toMatch(/Cragin|Goi|Kermanshah|Dalian/u);
    // The choice, written as offered, reads that one place.
    const chosen = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: ['Belmont, Massachusetts, United States', 'Belmont, California', 'Aparecida de Goiânia, Brazil'] }, ON) as { ok: true; data: any };
    expect(chosen.data.cities.map((city: { name: string; region: string }) => `${city.name}, ${city.region}`)).toEqual(['Belmont, Massachusetts', 'Belmont, California', 'Aparecida de Goiânia, Goias']);
    expect(chosen.data.ambiguous).toEqual([]);
  });

  it('asks rather than guesses when the name alone fits several places, and leaves find_birthplace\'s own list as it was', async () => {
    const result = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: ['Mexico', 'Aparecida', 'Belmont', 'Nara, Japan', 'New York'] }, ON) as { ok: true; data: any };
    expect(result.data.cities.map((city: { name: string }) => city.name)).toEqual(['Nara-shi', 'New York City']);
    expect(result.data.ambiguous.map((entry: { asked: string; places: { name: string; country: string }[] }) => [entry.asked, entry.places.map((place) => `${place.name}, ${place.country}`)])).toEqual([
      ['Mexico', ['Mexico City, Mexico', 'Mexico, Philippines']],
      ['Aparecida', ['Aparecida de Goiânia, Brazil', 'Aparecida, Brazil']],
      ['Belmont', ['Belmont, United States', 'Belmont, United States']],
    ]);
    // A whole name read alone: the largest place when every other sharing it is under a tenth of its size.
    const alone = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: ['Kerman', 'Dali', 'Saint Louis', 'London', 'Lisbon'] }, ON) as { ok: true; data: any };
    expect(alone.data.cities.map((city: { name: string; country: string }) => `${city.name}, ${city.country}`)).toEqual(['Kerman, Iran', 'Dali, China', 'St. Louis, United States', 'London, United Kingdom', 'Lisbon, Portugal']);
    expect(alone.data.ambiguous).toEqual([]);
    const table = await loadPlaceTable();
    expect(resolvePlace(table, 'Kerman, China')).toMatchObject({ suggestions: [{ name: 'Kerman', country: 'Iran' }] });
    expect(resolvePlace(table, 'Qwxzv, China')).toBeNull();
    expect(resolvePlace(table, 'London, Canada')).toMatchObject({ place: { name: 'London', region: 'Ontario', country: 'Canada' } });
    expect(resolvePlace(table, 'Springfield, United States')).toMatchObject({ choices: expect.arrayContaining([expect.objectContaining({ region: 'Missouri' })]) });
    const listed = await executeAiTool('find_birthplace', { place: 'Kerman', country: 'Iran' }, ON) as { ok: true; data: any };
    expect(listed.data.places.map((place: { name: string }) => place.name)).toEqual(['Kermanshah', 'Kerman']);
  });

  it('never lets a country read over the region typed: a region no place of the name is in gets suggestions, not another region', async () => {
    const result = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: ['London, Scotland', 'Cardiff, England', 'Cardiff, Wales', 'London, England', 'London, Ontario, Canada'] }, ON) as { ok: true; data: any };
    expect(result.ok).toBe(true);
    // Scotland and England are regions of the United Kingdom in the index, not other names for it.
    expect(result.data.cities.map((city: { asked: string; name: string; region: string; country: string }) => [city.asked, `${city.name}, ${city.region}, ${city.country}`])).toEqual([
      ['Cardiff, Wales', 'Cardiff, Wales, United Kingdom'],
      ['London, England', 'London, England, United Kingdom'],
      ['London, Ontario, Canada', 'London, Ontario, Canada'],
    ]);
    expect(result.data.cities[2]).toMatchObject({ latitude: expect.closeTo(42.98, 1), longitude: expect.closeTo(-81.23, 1) });
    expect(result.data.didYouMean.map((entry: { asked: string; places: { label: string }[] }) => [entry.asked, entry.places.map((place) => place.label)])).toEqual([
      ['London, Scotland', ['London, England, United Kingdom', 'London, Ontario, Canada']],
      ['Cardiff, England', ['Cardiff, Wales, United Kingdom']],
    ]);
    expect(result.data.ambiguous).toEqual([]);
    expect(result.data.unmatched).toEqual([]);
    expect(result.data.limits).toContain('No town or city in the index matches London, Scotland. Did you mean London, England, United Kingdom; London, Ontario, Canada? Ask which one is meant, then give its id in placeIds.');
    expect(result.data.limits).toContain('No town or city in the index matches Cardiff, England. Did you mean Cardiff, Wales, United Kingdom? Ask which one is meant, then give its id in placeIds.');
    const table = await loadPlaceTable();
    for (const [text, region] of [['London, United Kingdom', 'England'], ['London, UK', 'England'], ['London, England, United Kingdom', 'England'], ['Glasgow, Scotland', 'Scotland'], ['Belfast, Northern Ireland', 'Northern Ireland'], ['Paris, France', 'Ile-de-France'], ['Belmont, California', 'California']] as const) {
      expect(resolvePlace(table, text)).toMatchObject({ place: { region } });
    }
    // A region must be the place's own: Ontario is not England, and the last part names the country.
    expect(resolvePlace(table, 'London, England, Canada')).toMatchObject({ suggestions: expect.any(Array) });
    expect(resolvePlace(table, 'London, Ontario, United Kingdom')).toMatchObject({ suggestions: expect.any(Array) });
    expect(resolvePlace(table, 'Cardiff, Scotland')).toMatchObject({ suggestions: [{ name: 'Cardiff', region: 'Wales' }] });
  });

  it('matches a country by its whole name or a known other name, never by part of one, and asks when the country named has no such place', async () => {
    const result = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: ['Apia, American Samoa', 'Apia, Samoa'] }, ON) as { ok: true; data: any };
    expect(result.ok).toBe(true);
    // Samoa is part of American Samoa's name, but no Apia is in American Samoa: no reading for Apia, Samoa in its place.
    expect(result.data.cities.map((city: { asked: string; name: string; country: string }) => [city.asked, `${city.name}, ${city.country}`])).toEqual([['Apia, Samoa', 'Apia, Samoa']]);
    expect(result.data.didYouMean).toEqual([{ asked: 'Apia, American Samoa', places: [{ id: expect.stringMatching(/^p[0-9a-z]{11}$/u), name: 'Apia', region: 'Tuamasaga', country: 'Samoa', label: 'Apia, Tuamasaga, Samoa' }] }]);
    expect(result.data.limits).toContain('No town or city in the index matches Apia, American Samoa. Did you mean Apia, Tuamasaga, Samoa? Ask which one is meant, then give its id in placeIds.');
    const table = await loadPlaceTable();
    const read = (text: string) => {
      const resolved = resolvePlace(table, text);
      return resolved && 'place' in resolved ? `${resolved.place.name}, ${resolved.place.region}, ${resolved.place.country}` : null;
    };
    const suggested = (text: string) => {
      const resolved = resolvePlace(table, text);
      return resolved && 'suggestions' in resolved ? resolved.suggestions.map((place) => `${place.name}, ${place.country}`) : null;
    };
    // The country, or a region with that whole name: Georgia the US state and Georgia the country are each read as named.
    expect(read('Atlanta, Georgia')).toBe('Atlanta, Georgia, United States');
    expect(read('Tbilisi, Georgia')).toBe('Tbilisi, Tbilisi, Georgia');
    expect(read('Atlanta, Georgia, United States')).toBe('Atlanta, Georgia, United States');
    expect(suggested('Tbilisi, Georgia, United States')).toEqual(['Tbilisi, Georgia']);
    expect(suggested('Atlanta, Georgia, Georgia')).toEqual(['Atlanta, United States']);
    // Guinea is not Papua New Guinea, Equatorial Guinea or Guinea-Bissau, and none of them is Guinea.
    expect(read('Conakry, Guinea')).toBe('Conakry, Conakry, Guinea');
    expect(read('Port Moresby, Papua New Guinea')).toBe('Port Moresby, National Capital, Papua New Guinea');
    expect(read('Bata, Equatorial Guinea')).toBe('Bata, Litoral, Equatorial Guinea');
    expect(suggested('Port Moresby, Guinea')).toEqual(['Port Moresby, Papua New Guinea']);
    expect(suggested('Malabo, Guinea')).toEqual(['Malabo, Equatorial Guinea']);
    expect(suggested('Bissau, Guinea')?.[0]).toBe('Bissau, Guinea-Bissau');
    expect(suggested('Conakry, Papua New Guinea')).toEqual(['Conakry, Guinea']);
    expect(suggested('Conakry, Equatorial Guinea')).toEqual(['Conakry, Guinea']);
    // Niger is not Nigeria, nor Niger State in Nigeria unless that region is named whole.
    expect(read('Niamey, Niger')).toBe('Niamey, Niamey, Niger');
    expect(suggested('Niamey, Nigeria')).toEqual(['Niamey, Niger']);
    expect(suggested('Maradi, Nigeria')).toEqual(['Maradi, Niger']);
    expect(suggested('Lagos, Niger')).toContain('Lagos, Nigeria');
    expect(suggested('Minna, Niger')).toEqual(['Minna, Nigeria']);
    expect(read('Minna, Niger State, Nigeria')).toBe('Minna, Niger State, Nigeria');
    // Dominica is not the Dominican Republic.
    expect(read('Roseau, Dominica')).toBe('Roseau, Saint George Parish, Dominica');
    expect(read('Santo Domingo, Dominican Republic')).toBe('Santo Domingo, Nacional, Dominican Republic');
    expect(suggested('Roseau, Dominican Republic')).toEqual(['Roseau, Dominica']);
    expect(suggested('Santo Domingo, Dominica')).toContain('Santo Domingo, Dominican Republic');
    // Sudan is not South Sudan; and a longer name in the country named (Jubayt, Sudan) is not read for Juba.
    expect(read('Khartoum, Sudan')).toBe('Khartoum, Khartoum, Sudan');
    expect(read('Juba, South Sudan')).toBe('Juba, Central Equatoria, South Sudan');
    expect(suggested('Khartoum, South Sudan')).toEqual(['Khartoum, Sudan']);
    expect(suggested('Juba, Sudan')?.[0]).toBe('Juba, South Sudan');
    // Ireland is not Northern Ireland; known other names still read.
    expect(suggested('Belfast, Ireland')).toContain('Belfast, United Kingdom');
    expect(read('Dublin, Ireland')).toBe('Dublin, Leinster, Ireland');
    for (const [text, country] of [['London, UK', 'United Kingdom'], ['New York, USA', 'United States'], ['Amsterdam, Netherlands', 'The Netherlands'], ['Amsterdam, Holland', 'The Netherlands'], ['Seoul, Korea', 'South Korea'], ['Kinshasa, DRC', 'Democratic Republic of the Congo']] as const) {
      expect(resolvePlace(table, text), text).toMatchObject({ place: { country } });
    }
    expect(suggested('Pyongyang, Korea')).toEqual(['Pyongyang, North Korea']);
    expect(suggested('Kinshasa, Congo')).toEqual(['Kinshasa, Democratic Republic of the Congo']);
  });

  it('folds a country alias the way it folds the typed country, so apostrophes, hyphens and full stops read alike', async () => {
    const table = await loadPlaceTable();
    const country = (text: string) => {
      const resolved = resolvePlace(table, text);
      return resolved && 'place' in resolved ? `${resolved.place.name}, ${resolved.place.country}` : null;
    };
    // The curly apostrophe, the straight one, none, a space, a hyphen and capitals all name Ivory Coast.
    for (const text of ['Abidjan, Côte d’Ivoire', "Abidjan, Cote d'Ivoire", 'Abidjan, Cote dIvoire', 'Abidjan, Cote d Ivoire', "Abidjan, Côte-d'Ivoire", "Abidjan, CÔTE D'IVOIRE", 'Abidjan, Ivory Coast']) {
      expect(country(text), text).toBe('Abidjan, Ivory Coast');
    }
    // Full stops and hyphens in the other aliases, and in the index's own names, fold the same way.
    for (const [text, expected] of [
      ['London, U.K.', 'London, United Kingdom'], ['London, U.K', 'London, United Kingdom'], ['New York, U.S.A.', 'New York City, United States'],
      ['New York, U.S.', 'New York City, United States'], ['Dubai, U.A.E.', 'Dubai, United Arab Emirates'],
      ['Kinshasa, D.R. Congo', 'Kinshasa, Democratic Republic of the Congo'], ['Kinshasa, Congo-Kinshasa', 'Kinshasa, Democratic Republic of the Congo'],
      ['Kinshasa, Congo Kinshasa', 'Kinshasa, Democratic Republic of the Congo'], ['Brazzaville, Congo-Brazzaville', 'Brazzaville, Republic of the Congo'],
      ['Dili, East Timor', 'Dili, Timor Leste'], ['Dili, Timor-Leste', 'Dili, Timor Leste'], ['Istanbul, Türkiye', 'Istanbul, Turkey'],
      ['Bissau, Guinea Bissau', 'Bissau, Guinea-Bissau'], ['Charlotte Amalie, US Virgin Islands', 'Charlotte Amalie, U.S. Virgin Islands'],
      ['Charlotte Amalie, U.S. Virgin Islands', 'Charlotte Amalie, U.S. Virgin Islands'],
    ] as const) {
      expect(country(text), text).toBe(expected);
    }
    // Every alias is stored folded, names a country in the index, and is found again from its own folded spelling.
    const fold = (text: string) => ` ${text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/gu, ' ').trim()} `.trim().replace(/^the /u, '');
    const indexCountries = new Set(table.index.countries.map(fold));
    for (const [alias, name] of Object.entries(COUNTRY_ALIASES)) {
      expect(fold(alias), alias).toBe(alias);
      expect(indexCountries.has(name), `${alias} names ${name}`).toBe(true);
      expect(countryNameMatches(table.index.countries.find((entry) => fold(entry) === name)!, alias), alias).toBe(true);
    }
    // An alias is looked up as its own key only: a country typed as Constructor is not an alias.
    expect(countryNameMatches('United States', 'constructor')).toBe(false);
    expect(resolvePlace(table, 'Paris, Constructor')).not.toMatchObject({ place: expect.anything() });
  });

  it('gives each place an id and a label that tells same-named places apart, and reads the place an id names', async () => {
    const base = { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London' };
    const result = await executeAiTool('get_astrocartography', { ...base, cities: ['Udaipur, Rajasthan, India'] }, ON) as { ok: true; data: any };
    expect(result.ok).toBe(true);
    expect(result.data.cities).toEqual([]);
    const [entry] = result.data.ambiguous;
    expect(entry.asked).toBe('Udaipur, Rajasthan, India');
    // Two towns of 15,000 or more are called Udaipur in Rajasthan, about 400 km apart. The index has no district, so
    // their coordinates tell them apart.
    expect(entry.places.map((place: { label: string }) => place.label)).toEqual([
      'Udaipur, Rajasthan, India (24.59° N, 73.71° E)',
      'Udaipur, Rajasthan, India (27.72° N, 75.47° E)',
    ]);
    const ids = entry.places.map((place: { id: string }) => place.id);
    expect(new Set(ids).size).toBe(2);
    expect(result.data.limits).toContain('More than one town or city matches Udaipur, Rajasthan, India: Udaipur, Rajasthan, India (24.59° N, 73.71° E); Udaipur, Rajasthan, India (27.72° N, 75.47° E). Some share a name, region and country, so choose one by its id in placeIds.');
    // The plain label asks again; the label with its coordinates, or the id, reads exactly that place.
    expect(resolvePlace(await loadPlaceTable(), entry.places[1].label)).toMatchObject({ place: { id: ids[1] } });
    const chosen = await executeAiTool('get_astrocartography', { ...base, placeIds: [ids[1]] }, ON) as { ok: true; data: any };
    expect(chosen.ok).toBe(true);
    expect(chosen.data.ambiguous).toEqual([]);
    expect(chosen.data.cities).toHaveLength(1);
    expect(chosen.data.cities[0]).toMatchObject({ asked: ids[1], id: ids[1], name: 'Udaipur', region: 'Rajasthan', country: 'India', latitude: 27.72, longitude: 75.47 });
    expect(chosen.data.cities[0].closest.length).toBeGreaterThan(0);
    // An id comes back with the place it names, and names it again.
    const again = await executeAiTool('get_astrocartography', { ...base, cities: ['Lisbon'], placeIds: [ids[0]] }, ON) as { ok: true; data: any };
    expect(again.data.cities.map((city: { name: string; latitude: number }) => [city.name, city.latitude])).toEqual([['Lisbon', 38.73], ['Udaipur', 24.59]]);
    const lisbon = again.data.cities[0].id;
    const viaId = await executeAiTool('get_astrocartography', { ...base, placeIds: [lisbon] }, ON) as { ok: true; data: any };
    expect(viaId.data.cities[0]).toMatchObject({ id: lisbon, name: 'Lisbon', country: 'Portugal' });
    // An id the index does not have is refused, without repeating it; and the two lists together hold five places at most.
    const unknown = await executeAiTool('get_astrocartography', { ...base, placeIds: ['pzzzzzzzzzzz'] }, ON) as { ok: boolean };
    expect(unknown.ok).toBe(false);
    expect(JSON.stringify(unknown)).not.toContain('pzzzzzzzzzzz');
    const tooMany = await executeAiTool('get_astrocartography', { ...base, cities: ['Lisbon', 'Paris', 'Rome'], placeIds: ids.concat(lisbon) }, ON) as { ok: boolean };
    expect(tooMany.ok).toBe(false);
    expect(astrocartographyInput.safeParse({ ...base, cities: ['Lisbon', 'Paris', 'Rome'], placeIds: ids }).success).toBe(true);
  });

  it('reads a region only by its whole name, never by words inside a longer one: Virginia is not West Virginia', async () => {
    const table = await loadPlaceTable();
    const read = (text: string) => {
      const resolved = resolvePlace(table, text);
      return resolved && 'place' in resolved ? `${resolved.place.name}, ${resolved.place.region}, ${resolved.place.country}` : null;
    };
    const suggested = (text: string) => {
      const resolved = resolvePlace(table, text);
      return resolved && 'suggestions' in resolved ? resolved.suggestions.map((place) => `${place.name}, ${place.region}`) : null;
    };
    // The index has no Charleston in Virginia: the Charlestons it has are suggestions, never West Virginia's as the answer.
    for (const text of ['Charleston, Virginia', 'Charleston, Virginia, US', 'Charleston, Virginia, United States', ' charleston ,  VIRGINIA ']) {
      expect(read(text), text).toBeNull();
      expect(suggested(text), text).toEqual(expect.arrayContaining(['Charleston, West Virginia', 'Charleston, South Carolina']));
    }
    for (const text of ['Charleston, West Virginia', 'Charleston, West Virginia, US', 'Charleston, west virginia, United States']) expect(read(text), text).toBe('Charleston, West Virginia, United States');
    expect(read('Charleston, South Carolina')).toBe('Charleston, South Carolina, United States');
    // Carolina is a region of Puerto Rico, not part of North or South Carolina; Dakota is no region at all.
    for (const text of ['Wilmington, Carolina', 'Jacksonville, Carolina', 'Charleston, Carolina', 'Fargo, Dakota', 'Sioux Falls, Dakota', 'Fargo, Dakota, US']) {
      expect(read(text), text).toBeNull();
      expect(suggested(text), text).not.toBeNull();
    }
    expect(read('Carolina, Carolina')).toBe('Carolina, Carolina, Puerto Rico');
    expect(read('Wilmington, North Carolina')).toBe('Wilmington, North Carolina, United States');
    expect(read('Jacksonville, North Carolina, United States')).toBe('Jacksonville, North Carolina, United States');
    expect(read('Fargo, North Dakota')).toBe('Fargo, North Dakota, United States');
    expect(read('Sioux Falls, South Dakota')).toBe('Sioux Falls, South Dakota, United States');
    expect(suggested('Fargo, South Dakota')).toEqual(['Fargo, North Dakota']);
    // Sudan and South Sudan with a region before the country; and a region's whole name only (Equatoria is not Central Equatoria).
    expect(read('Khartoum, Khartoum, Sudan')).toBe('Khartoum, Khartoum, Sudan');
    expect(read('Juba, Central Equatoria, South Sudan')).toBe('Juba, Central Equatoria, South Sudan');
    expect(suggested('Khartoum, Khartoum, South Sudan')).toEqual(['Khartoum, Khartoum']);
    expect(suggested('Juba, Central Equatoria, Sudan')?.[0]).toBe('Juba, Central Equatoria');
    expect(suggested('Juba, Equatoria')?.[0]).toBe('Juba, Central Equatoria');
    expect(suggested('Juba, Equatoria, South Sudan')?.[0]).toBe('Juba, Central Equatoria');
    // Through the tool: the Charlestons come back to ask about, and no reading is given for one the person did not name.
    const result = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: ['Charleston, Virginia', 'Charleston, West Virginia'] }, ON) as { ok: true; data: any };
    expect(result.data.cities.map((city: { asked: string; region: string }) => [city.asked, city.region])).toEqual([['Charleston, West Virginia', 'West Virginia']]);
    expect(result.data.didYouMean.map((entry: { asked: string }) => entry.asked)).toEqual(['Charleston, Virginia']);
    expect(result.data.didYouMean[0].places.map((place: { label: string }) => place.label)).toContain('Charleston, West Virginia, United States');
  });

  it('reads a name with commas in it whole, and reads back every label and id an answer lists as the same place', async () => {
    const table = await loadPlaceTable();
    // Every place in the index whose name, region or country has a comma in it.
    const withCommas = Object.values(table.shards).flat().map((row) => rowPoint(table.index, row)).filter((point) => [point.name, point.admin1, point.country].some((part) => part.includes(',')));
    expect(withCommas.map((point) => point.name)).toEqual(expect.arrayContaining(['Mianzhu, Deyang, Sichuan', 'Misato, Saitama', 'Kralendijk']));
    for (const point of withCommas) {
      const id = placeId(point);
      for (const text of [point.name, placeLabelText(point), `${placeLabelText(point)} (${coordinateText(point.lat, point.lon)})`, id, ` ${placeLabelText(point).toUpperCase()} `]) {
        expect(resolvePlace(table, text), text).toMatchObject({ place: { id } });
      }
    }
    expect(resolvePlace(table, 'Mianzhu, Deyang, Sichuan')).toMatchObject({ place: { name: 'Mianzhu, Deyang, Sichuan', region: 'Sichuan', country: 'China' } });
    expect(resolvePlace(table, 'Mianzhu,Deyang,Sichuan, China')).toMatchObject({ place: { name: 'Mianzhu, Deyang, Sichuan', country: 'China' } });
    expect(resolvePlace(table, 'Kralendijk, Bonaire, Saint Eustatius and Saba')).toMatchObject({ place: { name: 'Kralendijk' } });
    // A country no such place is in: the suggestion's label and id each read back as the place suggested.
    const asked = ['Mianzhu, Deyang, Sichuan, Japan', 'Misato, Saitama, Korea', 'Udaipur, Rajasthan, India', 'Belmont', 'Charleston, Virginia', 'London, Scotland', 'Springfield, United States', 'Kralendijk, Aruba'];
    let listed = 0;
    for (const text of asked) {
      const answer = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: [text] }, ON) as { ok: true; data: any };
      const places: { id: string; label: string }[] = [...answer.data.ambiguous, ...answer.data.didYouMean].flatMap((entry: { places: { id: string; label: string }[] }) => entry.places);
      expect(places.length, text).toBeGreaterThan(0);
      for (const place of places) {
        listed += 1;
        expect(resolvePlace(table, place.label), place.label).toMatchObject({ place: { id: place.id } });
        expect(resolvePlace(table, place.id), place.label).toMatchObject({ place: { id: place.id } });
      }
    }
    expect(listed).toBeGreaterThan(12);
    // Through the tool: the name, its label and its id each read the same place.
    const mianzhu = withCommas.find((point) => point.name === 'Mianzhu, Deyang, Sichuan')!;
    const answer = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: ['Mianzhu, Deyang, Sichuan', placeLabelText(mianzhu)], placeIds: [placeId(mianzhu)] }, ON) as { ok: true; data: any };
    expect(answer.data.cities.map((city: { id: string }) => city.id)).toEqual([placeId(mianzhu), placeId(mianzhu), placeId(mianzhu)]);
    expect(answer.data.ambiguous).toEqual([]);
    expect(answer.data.didYouMean).toEqual([]);
    expect(answer.data.unmatched).toEqual([]);
  });

  it('links to the page and its line cards only while the website page is switched on', async () => {
    expect(astrocartographyTool.pageFlag).toBe(PAGE_FLAG);
    const args = { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', latitude: 51.51, longitude: -0.13, cities: ['Lisbon', 'New York'] };
    const linked = (result: Awaited<ReturnType<typeof executeAiTool>>) => {
      if (!result.ok) throw new Error('refused');
      const data = result.data as { pageUrl: string | null; cities: { closest: { shareUrl: string | null }[] }[] };
      return { data, shares: data.cities.flatMap((city) => city.closest.map((row) => row.shareUrl)), urls: JSON.stringify(result).match(/https:\/\/[^"]+/gu) ?? [] };
    };
    // The MCP switches on and the page on: the page, and a card for each line near a place.
    const on = linked(await executeAiTool('get_astrocartography', args, ON));
    expect(on.data.pageUrl).toBe('https://zodiacs.org/astrocartography/');
    expect(on.shares.length).toBeGreaterThan(0);
    for (const share of on.shares) expect(share).toMatch(/^https:\/\/zodiacs\.org\/share\/astrocartography\//u);
    expect(on.urls).toContain('https://zodiacs.org/astrocartography/');
    // The MCP switches on and the page off (or no page switch read at all): neither, so no link is a 404.
    for (const dependencies of [{ ...ON, sitePageOn: () => false }, { ...ON, sitePageOn: undefined }]) {
      const off = linked(await executeAiTool('get_astrocartography', args, dependencies));
      expect(off.data.pageUrl).toBeNull();
      expect(off.shares.length).toBe(on.shares.length);
      expect(off.shares.every((share) => share === null)).toBe(true);
      expect(off.urls.filter((url) => url.includes('/astrocartography/') || url.includes('/share/'))).toEqual([]);
      // The rest of the answer is the same reading.
      expect({ ...off.data, pageUrl: null, cities: null }).toEqual({ ...on.data, pageUrl: null, cities: null });
    }
  });

  it.each([
    [3002, '3,000'], [800.1, '800'],
  ] as const)('gives only the nearest measurement when all lines are beyond the noticeable range (%s km)', async (km, printed) => {
    const distances = vi.spyOn(geometry, 'lineDistances').mockReturnValueOnce([
      { body: 'Venus', angle: 'DSC', side: 'west', km },
      { body: 'Sun', angle: 'MC', side: 'east', km: 3500 },
    ]);
    try {
      const answer = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'UTC', cities: ['Lisbon'] }, ON);
      const summary = `No line within 800 km; the nearest is the Venus Descendant line, ${printed} km.`;
      expect(answer).toMatchObject({ ok: true, data: { cities: [{ summary, closest: [{
        distanceKm: Math.round(km / 10) * 10, strength: 'faint', line: summary,
      }] }] } });
    } finally {
      distances.mockRestore();
    }
  });

  it('needs a birth time and its zone, and refuses a child', async () => {
    expect(await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', zone: 'Europe/London' }, ON)).toMatchObject({ ok: false, error: { message: 'time is required.' } });
    expect(await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30' }, ON)).toMatchObject({ ok: false, error: { message: 'zone is required.' } });
    expect(await executeAiTool('get_astrocartography', { birthDate: '2019-05-03', time: '08:30', zone: 'Europe/London' }, ON)).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    expect(await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: ['a', 'b', 'c', 'd', 'e', 'f'].map((c) => `${c}${c}`) }, ON)).toMatchObject({ ok: false });
  });

  it('draws nothing for a child\'s birth date written with spaces around it, and does not repeat it back', async () => {
    const positions = await import('../../lib/astrocartography/positions');
    const moment = vi.spyOn(positions, 'equatorialMoment');
    try {
      for (const birthDate of [' 2020-01-01', '2020-01-01 ', '\t2020-01-01', '2020-01-01\n']) {
        const answer = await executeAiTool('get_astrocartography', { birthDate, time: '08:30', zone: 'Europe/London' }, ON) as { ok: boolean; data?: unknown; error?: { code: string; message: string } };
        expect(answer, JSON.stringify(birthDate)).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
        expect(answer.data, JSON.stringify(birthDate)).toBeUndefined();
        expect(answer.error!.message).not.toContain('2020');
      }
      expect(moment).not.toHaveBeenCalled();
      // The spy sees the calculation when it runs.
      expect(await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London' }, ON)).toMatchObject({ ok: true });
      expect(moment).toHaveBeenCalled();
    } finally {
      moment.mockRestore();
    }
  });

  it('reads the age on the arguments as the tool parses them, as well as on what was sent', () => {
    const source = readFileSync(new URL('../tools.ts', import.meta.url), 'utf8');
    const branch = source.slice(source.indexOf('if (isPersonalTool(tool)) {'));
    expect(branch).toMatch(/childBirthDateRefusal\(tool, input, now, context\.hostZone\) \?\? childBirthDateRefusal\(tool, parsed\.data, now, context\.hostZone\)/u);
    expect(branch.indexOf('childBirthDateRefusal(')).toBeLessThan(branch.indexOf('definition.run('));
  });

  describe('reads the age as the /astrocartography/ page does, on the calendar date at UTC-12', () => {
    // Born 10 November 2008 in Kiritimati (UTC+14), living in Los Angeles. At 2026-11-10T02:00Z it is already the
    // 10th on the birthplace clock, but still the 9th at UTC-12 and in Los Angeles: the person is 17.
    const BORN = { birthDate: '2008-11-10', time: '08:30', zone: 'Pacific/Kiritimati', cities: ['Los Angeles'] };
    const LOVE = LINE_MEANING.Venus.DSC;
    const at = (iso: string) => ({ ...ON, now: () => new Date(iso) });
    async function venusNearby(args: Record<string, unknown>, iso: string) {
      // Los Angeles sits on the Venus Descendant line, so the reading the place gets is that line's.
      const distances = vi.spyOn(geometry, 'lineDistances').mockReturnValueOnce([
        { body: 'Venus', angle: 'DSC', side: 'east', km: 40 },
        { body: 'Sun', angle: 'MC', side: 'west', km: 900 },
        { body: 'Moon', angle: 'IC', side: 'west', km: 1200 },
      ]);
      try {
        const answer = await executeAiTool('get_astrocartography', args, at(iso)) as { ok: true; data: any };
        expect(answer.ok).toBe(true);
        return answer.data;
      } finally {
        distances.mockRestore();
      }
    }

    it('gives no love-and-partnership reading to a 17-year-old whose birthplace clock has passed the 18th birthday', async () => {
      for (const args of [BORN]) {
        const data = await venusNearby(args, '2026-11-10T02:00:00Z');
        const text = JSON.stringify(data);
        expect(text, JSON.stringify(args)).not.toContain(LOVE);
        expect(text).not.toMatch(/\b(?:love|romance|partner(?:ship)?s?)\b/iu);
        expect(data.limits).toContain(MINOR_NOTE);
        expect(data.readings.DSC).toBe('Descendant lines (setting).');
        expect(data.cities[0].closest[0]).toMatchObject({ planet: 'Venus', angle: 'DSC' });
      }
      // Still 17 one second before the 18th birthday begins at UTC-12.
      expect(JSON.stringify(await venusNearby(BORN, '2026-11-10T11:59:59Z'))).not.toContain(LOVE);
    });

    it('gives the adult reading once the 18th birthday has begun everywhere', async () => {
      const data = await venusNearby(BORN, '2026-11-10T12:00:00Z');
      expect(data.cities[0].summary).toContain(LOVE);
      expect(data.limits).not.toContain(MINOR_NOTE);
      // No line about which clock "today" was read on: the age is read on the same day everywhere.
      expect(data.limits.join(' ')).not.toMatch(/Today is read/u);
    });

    it('takes no current zone, since the age does not depend on where the person is now', async () => {
      expect(Object.keys(astrocartographyInput.shape)).not.toContain('currentZone');
      expect(JSON.stringify(astrocartographyTool.description)).not.toMatch(/where the person is now|own clock/iu);
      for (const currentZone of ['Asia/Bangkok', 'Mars/Olympus_Mons']) {
        expect(await executeAiTool('get_astrocartography', { ...BORN, currentZone }, at('2026-11-10T12:00:00Z'))).toMatchObject({ ok: false, error: { message: 'Leave out fields this tool does not take.' } });
      }
    });

    it('is marked clock dependent, since a repeat call across the 18th birthday changes the reading', () => {
      expect(astrocartographyTool.clockDependent).toBe(true);
    });
  });

  it('reads its confidence from the details given, as the shared rule does: 55% without the birthplace coordinates, 70% with them', async () => {
    const CITY = ['Lisbon'];
    const untimed = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: CITY }, ON) as { ok: true; data: any };
    expect(untimed.data).toMatchObject({ confidence: 55, confidenceLabel: 'Reading confidence 55%' });
    for (const row of untimed.data.cities[0].closest) if (row.strength !== 'faint') expect(row.line).toMatch(/Reading confidence 55%\.$/u);
    expect(JSON.stringify(untimed)).not.toContain('Reading confidence 70%');
    const placed = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', latitude: 51.51, longitude: -0.13, cities: CITY }, ON) as { ok: true; data: any };
    expect(placed.data).toMatchObject({ confidence: 70, confidenceLabel: 'Reading confidence 70%' });
    for (const row of placed.data.cities[0].closest) if (row.strength !== 'faint') expect(row.line).toMatch(/Reading confidence 70%\.$/u);
    expect(JSON.stringify(placed)).not.toContain('Reading confidence 55%');
  });

  it('links a line\'s share card only when the reading\'s confidence is the one the card prints', async () => {
    const CITY = ['Lisbon'];
    const card = astrocartographyCardModel({ planet: 'Venus', angle: 'DSC', ref: null });
    expect(card.confidence).toBe('Reading confidence 70%');
    const untimed = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', cities: CITY }, ON) as { ok: true; data: any };
    expect(untimed.data.confidence).toBe(55);
    expect(untimed.data.cities[0].closest.length).toBeGreaterThan(0);
    for (const row of untimed.data.cities[0].closest) expect(row.shareUrl).toBeNull();
    expect(JSON.stringify(untimed)).not.toContain('/share/astrocartography/');
    // The page link stays: the page draws its own 70% map from a birthplace the person picks.
    expect(untimed.data.pageUrl).toBe('https://zodiacs.org/astrocartography/');
    const placed = await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', latitude: 51.51, longitude: -0.13, cities: CITY }, ON) as { ok: true; data: any };
    expect(placed.data.confidence).toBe(70);
    for (const row of placed.data.cities[0].closest) {
      expect(row.shareUrl).toMatch(/^https:\/\/zodiacs\.org\/share\/astrocartography\/\?p=[a-z]+&a=(?:asc|dsc|mc|ic)$/u);
      const model = astrocartographyCardModel(parseAstrocartographyShare(new URL(row.shareUrl).searchParams)!);
      expect(model.confidence).toBe(placed.data.confidenceLabel);
    }
  });

  it('refuses a child\'s birth date before it names any missing field', async () => {
    for (const args of [{ birthDate: '2020-01-01' }, { birthDate: '2020-01-01', zone: 'Europe/London' }, { birthDate: '2020-01-01', time: '8:30' }, { birthDate: '2020-01-01', cities: 'Lisbon' }]) {
      expect(await executeAiTool('get_astrocartography', args, ON), JSON.stringify(args)).toMatchObject({ ok: false, error: { code: 'invalid-request', message: UNDER_13_REFUSAL } });
    }
    // An adult's date with the same fields missing is still asked for them.
    expect(await executeAiTool('get_astrocartography', { birthDate: '1990-05-03' }, ON)).toMatchObject({ ok: false, error: { message: 'time is required. zone is required.' } });
  });

  it('refuses a child\'s birth date written with spaces around it, with no other argument, before it names any missing field', async () => {
    for (const birthDate of [' 2020-01-01', '2020-01-01 ', '\t2020-01-01', '2020-01-01\n', '  2015-06-01  ']) {
      const answer = await executeAiTool('get_astrocartography', { birthDate }, ON);
      expect(answer, JSON.stringify(birthDate)).toMatchObject({ ok: false, error: { code: 'invalid-request', message: UNDER_13_REFUSAL } });
      expect(JSON.stringify(answer)).not.toMatch(/is required|2020|2015/u);
    }
    // An adult's padded date alone gets the tool's own field sentences, not the age refusal.
    const adult = await executeAiTool('get_astrocartography', { birthDate: ' 1990-05-03 ' }, ON) as { ok: false; error: { message: string } };
    expect(adult.ok).toBe(false);
    expect(adult.error.message).not.toBe(UNDER_13_REFUSAL);
    expect(adult.error.message).toMatch(/time is required\. zone is required\./u);
  });

  it('refuses a child\'s birth date written unpadded or with slashes or dots before it names the date\'s form or any missing field', async () => {
    // ON's clock is 2026-11-09T09:00Z: 2026-11-08 at UTC-12, so 2013-11-08 is the latest birth date accepted.
    const childForms = ['2020-1-1', '2020/01/01', '2020.1.1', ' 2020/1/1 ', '\t2020.01.1\n', '2015/6/1', '2013.11.9', '2013/11/09'];
    for (const birthDate of childForms) {
      for (const extra of [{}, { zone: 'Europe/London' }, { time: '08:30' }, { time: '08:30', zone: 'Europe/London', cities: ['Lisbon'] }]) {
        const answer = await executeAiTool('get_astrocartography', { birthDate, ...extra }, ON);
        expect(answer, JSON.stringify({ birthDate, ...extra })).toMatchObject({ ok: false, error: { code: 'invalid-request', message: UNDER_13_REFUSAL } });
        expect(JSON.stringify(answer)).not.toMatch(/is required|must be a date|2020|2015|2013/u);
      }
    }
    // An adult's date in the same forms gets the replies it got before: the date's form, then the fields still missing.
    for (const birthDate of ['1990-5-3', '1990/05/03', '1990.5.3', ' 1990/5/3 ', '2013/11/8', '2013.11.08']) {
      const alone = await executeAiTool('get_astrocartography', { birthDate }, ON) as { ok: false; error: { message: string } };
      expect(alone.error.message, birthDate).toBe('birthDate must be a date such as 1994-05-14. time is required. zone is required.');
      const timed = await executeAiTool('get_astrocartography', { birthDate, time: '08:30', zone: 'Europe/London' }, ON) as { ok: false; error: { message: string } };
      expect(timed.error.message, birthDate).toBe('birthDate must be a date such as 1994-05-14.');
    }
    // A value that is not a calendar date keeps the date sentence, never the age refusal.
    for (const birthDate of ['2020/13/01', '2020/02/30', '2021.2.29', '2020-01/01', '20/01/2020', 'soon']) {
      const answer = await executeAiTool('get_astrocartography', { birthDate }, ON) as { ok: false; error: { message: string } };
      expect(answer.error.message, birthDate).toBe('birthDate must be a date such as 1994-05-14. time is required. zone is required.');
    }
    expect(['2020-1-1', '2020/01/01', '2020.1.1', ' 2020/1/1 ', '2016.2.29', '2017.2.29', 'x'].map(ageCheckDate)).toEqual(['2020-01-01', '2020-01-01', '2020-01-01', '2020-01-01', '2016-02-29', '2017.2.29', 'x']);
  });

  it('tells the assistant to check the age before it asks for a birth time or birthplace', () => {
    expect(astrocartographyTool.description).toMatch(/not directed at children under 13: check the birth date first, and ask for no birth time or birthplace when it is less than 13 years ago/u);
    expect(astrocartographyTool.description.indexOf('under 13')).toBeLessThan(astrocartographyTool.description.indexOf('A birth time is required'));
  });

  it('is not offered with the switch off', async () => {
    expect((await executeAiTool('get_astrocartography', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London' }, { occasions: true, coverage: true })).ok).toBe(false);
  });
});

describe('get_astrocartography on the hosted server', () => {
  const servers: Server[] = [];
  afterAll(async () => { await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve())))); });
  async function serve() {
    let handle: (req: unknown, res: unknown) => Promise<void> = async () => {};
    const server = createServer((req, res) => { void handle(req, res); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    servers.push(server);
    const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
    handle = createAiNodeHandler({ env: { ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1', ZODIACS_PERSONAL_TOOLS_ENABLED: '1' }, allowedHosts: [host],
      rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed', countUsage: async () => {}, dependencies: { now: ON.now, placeTable: ON.placeTable } });
    return host;
  }
  function call(host: string, name: string, args: unknown) {
    return new Promise<any>((resolve, reject) => {
      const req = request(`http://${host}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' } }, (res) => {
        let text = ''; res.setEncoding('utf8');
        res.on('data', (chunk) => { text += chunk; });
        res.on('end', () => {
          const body = text.includes('data: ') ? text.split('\n').find((line) => line.startsWith('data: '))!.slice(6) : text;
          resolve(JSON.parse(body).result);
        });
      });
      req.on('error', reject);
      req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }));
    });
  }

  it('answers a call with only a child\'s birth date with the age refusal, not the fields still missing', async () => {
    const host = await serve();
    for (const args of [{ birthDate: '2020-01-01' }, { birthDate: '2015-06-01', zone: 'Europe/London' }]) {
      const result = await call(host, 'get_astrocartography', args);
      expect(result.isError, JSON.stringify(args)).toBe(true);
      expect(result.structuredContent).toMatchObject({ ok: false, tool: 'get_astrocartography', error: { code: 'invalid-request', message: UNDER_13_REFUSAL } });
      expect(JSON.stringify(result)).not.toMatch(/is required/u);
      expect(JSON.stringify(result)).not.toMatch(/2020-01-01|2015-06-01/u);
    }
    // An adult's date alone is still asked for the birth time and its zone.
    expect((await call(host, 'get_astrocartography', { birthDate: '1990-05-03' })).structuredContent).toMatchObject({ ok: false, error: { message: 'time is required. zone is required.' } });
  });

  it('answers a child\'s birth date written with spaces around it, with no other argument, with the age refusal', async () => {
    const host = await serve();
    for (const birthDate of [' 2020-01-01', '2020-01-01 ', '\t2020-01-01', '2020-01-01\n']) {
      const result = await call(host, 'get_astrocartography', { birthDate });
      expect(result.isError, JSON.stringify(birthDate)).toBe(true);
      expect(result.structuredContent, JSON.stringify(birthDate)).toMatchObject({ ok: false, tool: 'get_astrocartography', error: { code: 'invalid-request', message: UNDER_13_REFUSAL } });
      expect(JSON.stringify(result)).not.toMatch(/is required|2020-01-01|birth time|timezone/iu);
    }
  });

  it('answers a child\'s birth date written unpadded or with slashes or dots with the age refusal, and an adult\'s as before', async () => {
    const host = await serve();
    for (const birthDate of ['2020-1-1', '2020/01/01', '2020.1.1', ' 2020/1/1 ', '2015/6/1', '2013.11.9']) {
      for (const extra of [{}, { zone: 'Europe/London' }, { time: '08:30', zone: 'Europe/London' }]) {
        const result = await call(host, 'get_astrocartography', { birthDate, ...extra });
        expect(result.isError, JSON.stringify(birthDate)).toBe(true);
        expect(result.structuredContent, JSON.stringify({ birthDate, ...extra })).toMatchObject({ ok: false, tool: 'get_astrocartography', error: { code: 'invalid-request', message: UNDER_13_REFUSAL } });
        expect(JSON.stringify(result)).not.toMatch(/is required|must be a date|2020|2015|2013|birth time|timezone/iu);
      }
    }
    for (const birthDate of ['1990-5-3', '1990/05/03', '1990.5.3', ' 1990/5/3 ', '2013/11/8']) {
      const alone = await call(host, 'get_astrocartography', { birthDate });
      expect(alone.structuredContent, birthDate).toMatchObject({ ok: false, error: { message: 'birthDate must be a date such as 1994-05-14. time is required. zone is required.' } });
    }
    expect((await call(host, 'get_astrocartography', { birthDate: '2020/02/30' })).structuredContent.error.message).toBe('birthDate must be a date such as 1994-05-14. time is required. zone is required.');
  });

  it('links the page and its line cards on the staging site when the call comes in on the staging host', async () => {
    const STAGING = 'zodiacs-mcp-staging.vercel.app';
    const env = { ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1', ZODIACS_PERSONAL_TOOLS_ENABLED: '1', ZODIACS_MCP_STAGING_HOST: STAGING, [PAGE_FLAG]: '1' };
    // The default host list: zodiacs.org, www.zodiacs.org and the configured staging host.
    const handle = createAiNodeHandler({ env, rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed', countUsage: async () => {}, dependencies: { now: ON.now, placeTable: ON.placeTable } });
    const server = createServer((req, res) => { void handle(req, res); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    servers.push(server);
    const port = (server.address() as { port: number }).port;
    const callOn = (host: string, path: string) => new Promise<any>((resolve, reject) => {
      const req = request({ host: '127.0.0.1', port, path, method: 'POST', headers: { Host: host, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' } }, (res) => {
        let text = ''; res.setEncoding('utf8');
        res.on('data', (chunk) => { text += chunk; });
        res.on('end', () => resolve(JSON.parse(text.includes('data: ') ? text.split('\n').find((line) => line.startsWith('data: '))!.slice(6) : text).result));
      });
      req.on('error', reject);
      req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_astrocartography', arguments: { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', latitude: 51.51, longitude: -0.13, cities: ['Lisbon'] } } }));
    });
    const pageLinks = (result: any) => (JSON.stringify(result.structuredContent).match(/https:\/\/[^"]+/gu) ?? []).filter((url) => url.includes('/astrocartography/'));
    for (const path of ['/mcp', '/mcp/de440']) {
      const staged = await callOn(STAGING, path);
      expect(staged.structuredContent?.ok, path).toBe(true);
      expect(staged.structuredContent.data.pageUrl).toBe(`https://${STAGING}/astrocartography/`);
      const links = pageLinks(staged);
      expect(links.some((url) => url.includes('/share/astrocartography/')), path).toBe(true);
      expect(links.every((url) => url.startsWith(`https://${STAGING}/`)), links.join(' ')).toBe(true);
    }
    const live = await callOn('zodiacs.org', '/mcp');
    expect(live.structuredContent.data.pageUrl.startsWith('https://zodiacs.org/astrocartography/')).toBe(true);
    expect(pageLinks(live).every((url) => url.startsWith('https://zodiacs.org/'))).toBe(true);
  });

  it('opens a share issued on a configured custom staging host on that host: its picture, its redirect and its story address', async () => {
    const STAGING = 'staging.example.org';
    const env = { ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1', ZODIACS_PERSONAL_TOOLS_ENABLED: '1', ZODIACS_MCP_STAGING_HOST: STAGING, [PAGE_FLAG]: '1' };
    const handle = createAiNodeHandler({ env, rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed', countUsage: async () => {}, dependencies: { now: ON.now, placeTable: ON.placeTable } });
    const server = createServer((req, res) => { void handle(req, res); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    servers.push(server);
    const port = (server.address() as { port: number }).port;
    const callOn = (host: string) => new Promise<{ status: number; result: any }>((resolve, reject) => {
      const req = request({ host: '127.0.0.1', port, path: '/mcp/de440', method: 'POST', headers: { Host: host, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' } }, (res) => {
        let text = ''; res.setEncoding('utf8');
        res.on('data', (chunk) => { text += chunk; });
        res.on('end', () => {
          const body = text.includes('data: ') ? text.split('\n').find((line) => line.startsWith('data: '))!.slice(6) : text;
          resolve({ status: res.statusCode ?? 0, result: body.startsWith('{') ? JSON.parse(body).result : null });
        });
      });
      req.on('error', reject);
      req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'get_astrocartography', arguments: { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/London', latitude: 51.51, longitude: -0.13, cities: ['Lisbon'] } } }));
    });
    const staged = await callOn(STAGING);
    expect(staged.result.structuredContent?.ok).toBe(true);
    const shareUrl = new URL(staged.result.structuredContent.data.cities[0].closest[0].shareUrl);
    expect(shareUrl.origin).toBe(`https://${STAGING}`);

    // The share function, as vercel.json's rewrite calls it, on the host the link names.
    const open = async (host: string, query: Record<string, string>) => {
      const headers = new Map<string, string>();
      const res = { statusCode: 0, body: Buffer.alloc(0) as Buffer, setHeader(name: string, value: string) { headers.set(name.toLowerCase(), value); }, end(body?: Buffer) { this.body = body ?? Buffer.alloc(0); } };
      await handleResultShareNodeRequest({ method: 'GET', headers: { host }, query: { __zodiacs_share: 'astrocartography-link', ...query } }, res, 'astrocartography-link');
      return { status: res.statusCode, location: headers.get('location'), html: res.body.toString('utf8') };
    };
    const query = Object.fromEntries(shareUrl.searchParams);
    vi.stubEnv(PAGE_FLAG, '1');
    vi.stubEnv('ZODIACS_MCP_STAGING_HOST', STAGING);
    try {
      const page = await open(shareUrl.host, query);
      expect(page.status).toBe(200);
      expect(page.html).toContain(`<meta property="og:image" content="https://${STAGING}/api/og/astrocartography-image?${shareUrl.search.slice(1).replace(/&/gu, '&amp;')}"`);
      expect(page.html).not.toContain('https://zodiacs.org/');
      // A key the share does not use is cleared by a redirect to the same host.
      const cleared = await open(shareUrl.host, { ...query, utm_source: 'chat' });
      expect(cleared.status).toBe(303);
      expect(cleared.location).toBe(shareUrl.href);
      // The story prints the map page on the host the share was opened on.
      expect(astrocartographyStoryAddress(`${requestOrigin({ headers: { host: STAGING } })}/api/og/astrocartography-story`)).toBe(`${STAGING}/astrocartography`);
    } finally {
      vi.unstubAllEnvs();
    }

    // With no staging host configured, the same host is not trusted: the MCP refuses it, and a share opened there
    // builds its addresses on production.
    vi.stubEnv(PAGE_FLAG, '1');
    vi.stubEnv('ZODIACS_MCP_STAGING_HOST', '');
    try {
      const unconfigured = createAiNodeHandler({ env: { ...env, ZODIACS_MCP_STAGING_HOST: undefined }, rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed', countUsage: async () => {}, dependencies: { now: ON.now, placeTable: ON.placeTable } });
      const refused = { statusCode: 0, setHeader() {}, end() {} };
      await unconfigured({ method: 'POST', url: '/mcp/de440', headers: { host: STAGING, 'content-type': 'application/json' }, query: {} }, refused);
      expect(refused.statusCode).toBe(403);
      const page = await open(STAGING, query);
      expect(page.html).toContain(`<meta property="og:image" content="https://zodiacs.org/api/og/astrocartography-image?`);
      expect(page.html).not.toContain(STAGING);
      expect((await open(STAGING, { ...query, utm_source: 'chat' })).location).toBe(`https://zodiacs.org${shareUrl.pathname}${shareUrl.search}`);
      expect(astrocartographyStoryAddress(`${requestOrigin({ headers: { host: STAGING } })}/api/og/astrocartography-story`)).toBe('zodiacs.org/astrocartography');
      // A configured value that is not a valid hostname is not trusted either.
      expect(requestOrigin({ headers: { host: 'Staging.Example.org' } }, { ZODIACS_MCP_STAGING_HOST: 'Staging.Example.org' })).toBe('https://zodiacs.org');
      expect(requestOrigin({ headers: { host: 'staging.example.org.evil.test' } }, { ZODIACS_MCP_STAGING_HOST: STAGING })).toBe('https://zodiacs.org');
      expect(requestOrigin({ headers: { host: STAGING } }, { ZODIACS_MCP_STAGING_HOST: STAGING })).toBe(`https://${STAGING}`);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('leaves every other tool\'s reply to arguments its schema refuses as it was', async () => {
    const host = await serve();
    const args = { birthDate: '2020-01-01', time: '8:30' };
    const expected = coverageInputRefusal('get_natal_chart', args, INPUT_SCHEMAS.get_natal_chart);
    expect(expected?.error.message).not.toBe(UNDER_13_REFUSAL);
    expect((await call(host, 'get_natal_chart', args)).structuredContent).toEqual(expected);
  });
});
