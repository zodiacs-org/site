import { afterAll, describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { decodeChartLink } from '../../lib/share';
import { NOT_FOUND_NOTE } from './people';
import {
  COMPATIBILITY_NOTE,
  compatibilityData,
  compatibilityInput,
  compatibilityMissing,
  computeCompatibility,
  famousNote,
  type CompatibilityData,
} from './compatibility';

const localTime = createLocalTimeModule();
afterAll(() => localTime.dispose());

/** Guarantees and fated outcomes the tool must never state; scores and forecasts are allowed. */
const FORBIDDEN = /soul ?mates?|\bdoomed\b|\bdestined\b|\bguarantee|\bwill (?:last|stay together|break up|divorce|marry)\b|\bforever\b/iu;

function stringsOf(data: CompatibilityData): string {
  // The fixed note names the limit itself ("not a guarantee"); everything else is checked.
  const { note, ...rest } = data;
  expect(note).toBe(COMPATIBILITY_NOTE);
  for (const value of [rest.score.overall, ...Object.values(rest.score.areas)]) {
    expect(Number.isInteger(value) && value >= 0 && value <= 100).toBe(true);
  }
  expect(rest.score.verdict).toMatch(/match\b/u);
  return JSON.stringify(rest);
}

describe('computeCompatibility', () => {
  it('compares two untimed dates without the Moon and links the Sun-sign pair page', async () => {
    const args = compatibilityInput.parse({ a: { birthDate: '1992-08-05' }, b: { birthDate: '1990-04-10' } });
    const { data, links } = await computeCompatibility(args, localTime);
    expect(compatibilityData.parse(data)).toEqual(data);

    expect(data.a).toMatchObject({ name: null, label: 'Person A', timeKnown: false, placed: false, sun: 'leo', moon: null, rising: null });
    expect(data.b).toMatchObject({ sun: 'aries', moon: null, rising: null });
    expect(data.contacts.length).toBeGreaterThan(0);
    expect(data.contacts.every((row) => row.aBody !== 'Moon' && row.bBody !== 'Moon')).toBe(true);
    expect(data.elements.a.fire + data.elements.a.earth + data.elements.a.air + data.elements.a.water).toBe(9);
    expect(data.notes.filter((note) => note.includes('the Moon is left out'))).toHaveLength(2);
    expect(data.signPair?.slug).toBe('aries-leo');
    expect(data.pageUrl).toBe('https://zodiacs.org/compatibility/aries-leo/');
    expect(data.cardUrl).toBeNull();
    // The share link carries Person A/B's Sun signs and the scores only.
    const share = new URL(data.shareUrl!);
    expect(`${share.origin}${share.pathname}`).toBe('https://zodiacs.org/share/compatibility/');
    expect(Object.fromEntries(share.searchParams)).toEqual({
      as: 'leo', bs: 'aries', score: String(data.score.overall), attraction: String(data.score.areas.attraction),
      communication: String(data.score.areas.communication), stability: String(data.score.areas.stability), v: expect.stringMatching(/^[a-z]+$/u),
    });
    expect(links).toEqual([
      { title: 'Compatibility on Zodiacs', url: 'https://zodiacs.org/compatibility/' },
      { title: 'How we calculate', url: 'https://zodiacs.org/methodology/' },
    ]);
    expect(stringsOf(data)).not.toMatch(FORBIDDEN);
  });

  it('gives the rising sign, named contact lines and a prefilled card for two timed, placed people', async () => {
    const args = compatibilityInput.parse({
      a: { name: 'Ana', birthDate: '1991-02-14', time: '08:30', zone: 'Europe/Madrid', latitude: 40.4168, longitude: -3.7038, place: 'Madrid, Spain' },
      b: { name: 'Ben', birthDate: '1989-11-03', time: '22:15', zone: 'America/New_York', latitude: 40.7128, longitude: -74.006 },
    });
    const { data } = await computeCompatibility(args, localTime, 'https://example.test');
    expect(compatibilityData.parse(data)).toEqual(data);

    expect(data.a).toMatchObject({ name: 'Ana', timeKnown: true, placed: true, sun: 'aquarius' });
    expect(data.b).toMatchObject({ name: 'Ben', timeKnown: true, placed: true, sun: 'scorpio' });
    expect(data.a.rising).not.toBeNull();
    expect(data.b.rising).not.toBeNull();
    expect(data.a.moon).not.toBeNull();
    expect(data.notes).toEqual([]);
    expect(data.pageUrl).toBe('https://example.test/compatibility/scorpio-aquarius/');
    // Names and Sun signs go in the share link; birth dates, times, zones and places never do.
    expect(data.shareUrl).toMatch(/^https:\/\/example\.test\/share\/compatibility\/\?a=Ana&as=aquarius&b=Ben&bs=scorpio&score=\d+&attraction=\d+&communication=\d+&stability=\d+&v=[a-z]+$/u);
    expect(data.shareUrl).not.toMatch(/1991|1989|08|22%3A|Madrid|Europe|America|40\.|74/u);

    expect(data.cardUrl).toMatch(/^https:\/\/example\.test\/compatibility\/#a=1\.[\w-]+&b=1\.[\w-]+$/u);
    const fragment = new URLSearchParams(new URL(data.cardUrl!).hash.slice(1));
    expect(decodeChartLink(fragment.get('a')!)).toMatchObject({ date: '1991-02-14', time: '08:30', tz: 'Europe/Madrid', name: 'Ana', place: 'Madrid, Spain' });
    expect(decodeChartLink(fragment.get('b')!)).toMatchObject({ date: '1989-11-03', time: '22:15', tz: 'America/New_York', name: 'Ben' });

    expect(data.contacts.length).toBe(8);
    for (const row of data.contacts) {
      expect(row.line.startsWith('Ana’s ')).toBe(true);
      expect(row.line).toContain('Ben’s');
      expect(Number.isInteger(row.orb * 10)).toBe(true);
    }
    expect(data.counts.total).toBeGreaterThanOrEqual(data.counts.easeful + data.counts.charged);
    expect(stringsOf(data)).not.toMatch(FORBIDDEN);
  });

  it('defaults the card link to zodiacs.org', async () => {
    const args = compatibilityInput.parse({
      a: { birthDate: '1991-02-14', time: '08:30', zone: 'Europe/Madrid', latitude: 40.4168, longitude: -3.7038 },
      b: { birthDate: '1989-11-03', time: '22:15', zone: 'America/New_York', latitude: 40.7128, longitude: -74.006 },
    });
    const { data } = await computeCompatibility(args, localTime);
    expect(data.cardUrl?.startsWith('https://zodiacs.org/compatibility/#')).toBe(true);
    expect(data.contacts[0].line.startsWith('Person A’s ')).toBe(true);
  });

  it('leaves out the sign pair when an untimed Sun sits on a sign boundary', async () => {
    const args = compatibilityInput.parse({ a: { birthDate: '1990-03-20', zone: 'Europe/London' }, b: { birthDate: '1990-04-10' } });
    const { data } = await computeCompatibility(args, localTime);
    expect(data.a.sun).toBeNull();
    expect(data.signPair).toBeNull();
    expect(data.pageUrl).toBeNull();
    expect(data.notes.some((note) => note.includes('the Sun changed sign'))).toBe(true);
    expect(stringsOf(data)).not.toMatch(FORBIDDEN);
  });

  it('keeps the Moon for a timed person without a place, but no rising sign', async () => {
    const args = compatibilityInput.parse({ a: { birthDate: '1985-07-01', time: '06:00', zone: 'Asia/Tokyo' }, b: { birthDate: '1987-01-20', time: '18:45', zone: 'Australia/Sydney' } });
    const { data } = await computeCompatibility(args, localTime);
    expect(data.a.moon).not.toBeNull();
    expect(data.a.rising).toBeNull();
    expect(data.cardUrl).toBeNull();
    expect(data.notes.filter((note) => note.includes('rising sign and houses are left out'))).toHaveLength(2);
    expect(data.elements.a.fire + data.elements.a.earth + data.elements.a.air + data.elements.a.water).toBe(10);
  });

  it('refuses inputs the calculation cannot take', async () => {
    expect(compatibilityInput.safeParse({ a: { birthDate: '1990-01-01', time: '10:00' }, b: { birthDate: '1990-01-01' } }).success).toBe(false);
    expect(compatibilityInput.safeParse({ a: { birthDate: '1990-01-01', zone: 'UTC', latitude: 10 }, b: { birthDate: '1990-01-01' } }).success).toBe(false);
    expect(compatibilityInput.safeParse({ a: { birthDate: '1990-01-01', name: '<b>Ana</b>' }, b: { birthDate: '1990-01-01' } }).success).toBe(false);
    expect(compatibilityInput.safeParse({ a: { birthDate: '1990-01-01', name: 'x'.repeat(41) }, b: { birthDate: '1990-01-01' } }).success).toBe(false);
    expect(compatibilityInput.safeParse({ a: { birthDate: '1990-01-01', extra: 1 }, b: { birthDate: '1990-01-01' } }).success).toBe(false);
    await expect(computeCompatibility({ a: { birthDate: '1990-02-30' }, b: { birthDate: '1990-01-01' } }, localTime)).rejects.toThrow(RangeError);
    await expect(computeCompatibility({ a: { birthDate: '1990-01-01', time: '10:00', zone: 'Nowhere/Atlantis' }, b: { birthDate: '1990-01-01' } }, localTime)).rejects.toThrow(RangeError);
  });
});

describe('computeCompatibility with a famous person', () => {
  it('compares someone with a published famous chart, scored, with the person marked and linked', async () => {
    const args = compatibilityInput.parse({ a: { name: 'Sam', birthDate: '1994-02-01' }, b: { famous: 'frida kahlo' } });
    expect(compatibilityMissing(args)).toBeNull();
    const { data, links } = await computeCompatibility(args, localTime);
    expect(compatibilityData.parse(data)).toEqual(data);
    expect(data.a).toMatchObject({ label: 'Sam', famous: false, url: null });
    expect(data.b).toMatchObject({ name: 'Frida Kahlo', label: 'Frida Kahlo', birthDate: '1907-07-06', famous: true, timeKnown: false, moon: null, rising: null, sun: 'cancer', url: 'https://zodiacs.org/people/frida-kahlo/' });
    expect(data.contacts.length).toBeGreaterThan(0);
    expect(data.contacts.every((row) => row.aBody !== 'Moon' && row.bBody !== 'Moon')).toBe(true);
    expect(data.contacts[0].line).toContain('Frida Kahlo’s');
    expect(data.notes).toContain(famousNote({ name: 'Frida Kahlo', birthplace: 'Coyoacán' }));
    expect(data.cardUrl).toBeNull();
    expect(links[0]).toEqual({ title: "Frida Kahlo's chart on Zodiacs", url: 'https://zodiacs.org/people/frida-kahlo/' });
    expect(stringsOf(data)).not.toMatch(FORBIDDEN);
  });

  it('uses the published noon placements for both sides when both are famous', async () => {
    const { data } = await computeCompatibility(compatibilityInput.parse({ a: { famous: 'Ada Lovelace' }, b: { famous: 'Alan Turing' } }), localTime);
    expect(data.a).toMatchObject({ sun: 'sagittarius', famous: true });
    expect(data.b.famous).toBe(true);
    expect(data.notes).toHaveLength(2);
    expect(stringsOf(data)).not.toMatch(FORBIDDEN);
  });

  it('says plainly when the directory has no such person and never builds a chart', async () => {
    const args = compatibilityInput.parse({ a: { birthDate: '1994-02-01' }, b: { famous: 'Nobody Anybody Zzyzx' } });
    expect(compatibilityMissing(args)).toEqual({ found: false, side: 'b', query: 'Nobody Anybody Zzyzx', directoryUrl: 'https://zodiacs.org/people/', note: NOT_FOUND_NOTE });
    await expect(computeCompatibility(args, localTime)).rejects.toThrow(RangeError);
  });

  it('takes a famous name alone, never with birth details', () => {
    expect(compatibilityInput.safeParse({ a: { birthDate: '1990-01-01' }, b: { famous: 'Frida Kahlo', birthDate: '1907-07-06' } }).success).toBe(false);
    expect(compatibilityInput.safeParse({ a: { birthDate: '1990-01-01' }, b: { famous: 'Frida Kahlo', name: 'Frida' } }).success).toBe(false);
    expect(compatibilityInput.safeParse({ a: { birthDate: '1990-01-01' }, b: {} }).success).toBe(false);
    expect(compatibilityInput.safeParse({ a: { famous: '<script>' }, b: { birthDate: '1990-01-01' } }).success).toBe(false);
  });
});

describe('computeCompatibility with generational contacts', () => {
  it('keeps the outer-planet contacts two people born days apart share behind every personal contact', async () => {
    // Born ten days apart: Uranus, Neptune and Pluto sit on top of each other
    // in both charts, at orbs tighter than any personal contact.
    const args = compatibilityInput.parse({ a: { birthDate: '1990-01-10' }, b: { birthDate: '1990-01-20' } });
    const { data } = await computeCompatibility(args, localTime);
    expect(compatibilityData.parse(data)).toEqual(data);
    const outer = new Set(['Uranus', 'Neptune', 'Pluto']);
    expect(data.counts.byAspect.conjunction).toBeGreaterThanOrEqual(3);
    expect(data.contacts).toHaveLength(8);
    for (const contact of data.contacts) {
      expect(contact.generational, contact.line).toBe(false);
      expect(outer.has(contact.aBody) && outer.has(contact.bBody), contact.line).toBe(false);
    }
  });
});
