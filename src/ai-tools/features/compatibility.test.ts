import { afterAll, describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { decodeChartLink } from '../../lib/share';
import {
  COMPATIBILITY_NOTE,
  compatibilityData,
  compatibilityInput,
  computeCompatibility,
  type CompatibilityData,
} from './compatibility';

const localTime = createLocalTimeModule();
afterAll(() => localTime.dispose());

/** Verdicts, scores and predictions the tool must never produce. */
const FORBIDDEN = /\bscores?\b|\bpercent|%|soul ?mates?|\bdoomed\b|\b(?:in)?compatible\b|\bwill\b|\bmatch(?:es)?\b|\bperfect\b|\bdestined\b/iu;

function stringsOf(data: CompatibilityData): string {
  // The fixed note states the policy itself ("does not score ... how one will go"); everything else is checked.
  const { note, ...rest } = data;
  expect(note).toBe(COMPATIBILITY_NOTE);
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
