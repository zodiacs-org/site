/*
 * The composite picture draws each person as their link carries them. The
 * page's composite of a chart without a birth time uses its noon at the
 * birthplace: with the other chart known, the midpoints printed to the
 * arcminute put that noon within about three and a half minutes (Kathmandu,
 * Kolkata), and so the time zone.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { computeBodies, computeChart } from '../../lib/engine/full';
import { prepareLocalTime, resolveLocalToUtc } from '../../lib/time/localToUtc';
import { compositePictureData } from './CompositePanel';
import { buildCompositeTabData } from './relationshipData';

const other = computeChart({ utc: new Date('1987-03-14T05:42:00Z'), latitude: 45.764, longitude: 4.8357, houseSystem: 'whole', timeKnown: true });
const otherPerson = { bodies: other.bodies.map(({ body, lon }) => ({ body, lon })), timeKnown: true, utc: other.input.utc };
const date = '2013-06-15';
const places = [
  { zone: 'Asia/Kathmandu', lat: 27.72, lon: 85.32 },
  { zone: 'Asia/Kolkata', lat: 22.57, lon: 88.36 },
];

beforeAll(async () => {
  for (const place of places) await prepareLocalTime(date, place.zone);
  await prepareLocalTime('1870-06-15', 'America/New_York');
});

describe('a composite picture', () => {
  it('draws a person without a birth time at 12:00 UTC on the date, without the Moon: one picture per date', async () => {
    const pictures = new Set<string>();
    const pages = new Set<string>();
    for (const place of places) {
      const resolved = resolveLocalToUtc(date, '12:00', place.zone, { longitude: place.lon });
      const chart = computeChart({ utc: resolved.utc, latitude: place.lat, longitude: place.lon, houseSystem: 'whole', timeKnown: false, flags: resolved.flags });
      const person = { bodies: chart.bodies.map(({ body, lon }) => ({ body, lon })), timeKnown: false, untimedDate: date };
      const page = buildCompositeTabData(person.bodies, otherPerson.bodies, { aTimeKnown: false, bTimeKnown: true });
      pages.add(JSON.stringify(page.points));
      const picture = await compositePictureData(page, { a: person, b: otherPerson });
      expect(picture.points.some((point) => point.body === 'Moon')).toBe(false);
      expect(picture.moonProvisional).toBe(false);
      const noon = computeBodies(new Date(`${date}T12:00:00Z`)).filter(({ body }) => body !== 'Moon');
      expect(picture).toEqual(buildCompositeTabData(noon, otherPerson.bodies, { aTimeKnown: false, bTimeKnown: true }));
      pictures.add(JSON.stringify(picture));
    }
    expect(pages.size).toBe(2);
    expect(pictures.size).toBe(1);
  });

  it('leaves out the Moon of a person without a birth time whose positions arrived in a link', async () => {
    const received = { bodies: computeBodies(new Date(`${date}T12:00:00Z`)).map(({ body, lon }) => ({ body, lon })), timeKnown: false };
    const page = buildCompositeTabData(received.bodies, otherPerson.bodies, { aTimeKnown: false, bTimeKnown: true });
    expect(page.points.some((point) => point.body === 'Moon')).toBe(true);
    const picture = await compositePictureData(page, { a: received, b: otherPerson });
    expect(picture.points.some((point) => point.body === 'Moon')).toBe(false);
  });

  it('draws a person with a birth time at the whole minute: one picture for every instant in it', async () => {
    const pictures = new Set<string>();
    for (const second of [-30, -3, 0, 12, 29.9]) {
      const utc = new Date(Date.parse('1870-06-15T19:46:00Z') + second * 1000);
      const chart = computeChart({ utc, latitude: 42.8864, longitude: -78.8784, houseSystem: 'whole', timeKnown: true });
      const person = { bodies: chart.bodies.map(({ body, lon }) => ({ body, lon })), timeKnown: true, utc };
      const page = buildCompositeTabData(person.bodies, otherPerson.bodies, { aTimeKnown: true, bTimeKnown: true });
      pictures.add(JSON.stringify(await compositePictureData(page, { a: person, b: otherPerson })));
    }
    expect(pictures.size).toBe(1);
    // Two charts on whole minutes: the picture is the page's composite.
    const page = buildCompositeTabData(otherPerson.bodies, otherPerson.bodies, { aTimeKnown: true, bTimeKnown: true });
    expect(await compositePictureData(page, { a: otherPerson, b: otherPerson })).toBe(page);
  });
});
