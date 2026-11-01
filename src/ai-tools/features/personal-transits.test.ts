import { describe, expect, it } from 'vitest';
import { executeAiTool } from '../tools';
import type { PersonalTransitsData } from './personal-transits';

const on = { occasions: true, coverage: true, now: () => new Date('2026-11-02T05:00:00Z') };
async function transits(args: Record<string, unknown>): Promise<PersonalTransitsData> {
  const result = await executeAiTool('get_personal_transits', args, on);
  if (!result.ok || result.tool !== 'get_personal_transits') throw new Error(JSON.stringify(result));
  return result.data;
}
const MADRID = { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.4168, longitude: -3.7038 };

describe('get_personal_transits', () => {
  it('lists the next 30 days of exact contacts by default, soonest first, with the site’s transit sentences', async () => {
    const data = await transits(MADRID);
    expect(data).toMatchObject({ mode: 'window', from: '2026-11-02', to: '2026-12-02', zone: 'Europe/Madrid', timeKnown: true, placed: true });
    expect(data.scanned.points).toEqual(expect.arrayContaining(['Moon', 'ASC', 'MC']));
    expect(data.contacts.length).toBeGreaterThan(5);
    expect(data.contacts.map((contact) => contact.exactUtc)).toEqual([...data.contacts.map((contact) => contact.exactUtc)].sort());
    for (const contact of data.contacts) {
      expect(contact.exactUtc >= '2026-11-01T23:00:00.000Z' && contact.exactUtc < '2026-12-02T23:00:00.000Z').toBe(true);
      expect(contact.line.startsWith(contact.planet)).toBe(true);
    }
    expect(data.note).toContain('not a guarantee');
  });

  it('leaves out the Moon and the angles without a birth time, and says so', async () => {
    const data = await transits({ birthDate: '1990-05-03', from: '2026-11-01', to: '2026-11-15' });
    expect(data.scanned.points).not.toContain('Moon');
    expect(data.scanned.points).not.toContain('ASC');
    expect(data.contacts.every((contact) => !['Moon', 'ASC', 'MC'].includes(contact.point))).toBe(true);
    expect(data.limits.join(' ')).toContain('No birth time was given');
  });

  it('keeps long windows to the slow planets, up to 366 days', async () => {
    const data = await transits({ birthDate: '1990-05-03', from: '2026-11-01', to: '2027-11-02' });
    expect(data.scanned.planets).toEqual(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);
    expect(data.contacts.every((contact) => data.scanned.planets.includes(contact.planet))).toBe(true);
    expect(data.limits.join(' ')).toContain('only Jupiter, Saturn, Uranus, Neptune and Pluto');
    expect(await executeAiTool('get_personal_transits', { birthDate: '1990-05-03', from: '2026-11-01', to: '2027-11-03' }, on)).toMatchObject({ ok: false, error: { message: 'The window is at most 366 days; to is 367 days after from.' } });
    expect(await executeAiTool('get_personal_transits', { birthDate: '1990-05-03', from: '2026-11-10', to: '2026-11-01' }, on)).toMatchObject({ ok: false, error: { message: 'to must be on or after from.' } });
  });

  it('gives the year ahead: the solar return, Jupiter and Saturn, sign changes in natal houses and eclipses', async () => {
    const data = await transits({ ...MADRID, mode: 'year-ahead' });
    expect(data).toMatchObject({ mode: 'year-ahead', from: '2026-11-02', to: '2027-11-01' });
    const kinds = new Set(data.highlights.map((item) => item.kind));
    expect(kinds).toContain('solar-return');
    expect(kinds).toContain('ingress');
    // Jupiter enters Virgo on 26 July 2027: Virgo is the fourth whole-sign house from a Gemini rising.
    expect(data.highlights.find((item) => item.kind === 'ingress' && item.line.startsWith('Jupiter enters Virgo'))?.house).toEqual({ number: 4, line: 'In your chart, Virgo is your fourth house: home, roots, family, and where you go to be unobserved.' });
    expect(await executeAiTool('get_personal_transits', { ...MADRID, mode: 'year-ahead', from: '2026-11-01' }, on)).toMatchObject({ ok: false, error: { message: 'year-ahead always starts today; leave out from and to.' } });
  });

  it('names a missing birth date and needs a zone with a time', async () => {
    expect(await executeAiTool('get_personal_transits', {}, on)).toMatchObject({ ok: false, error: { message: 'birthDate is required.' } });
    expect(await executeAiTool('get_personal_transits', { birthDate: '1990-05-03', time: '08:30' }, on)).toMatchObject({ ok: false, error: { message: 'A birth time or a place needs its time zone.' } });
  });

  it('never words a contact as a health or money prediction', async () => {
    const data = await transits({ ...MADRID, from: '2026-11-01', to: '2027-01-31' });
    const year = await transits({ ...MADRID, mode: 'year-ahead' });
    const words = JSON.stringify([data.contacts, year.highlights]);
    expect(words).not.toMatch(/\b(illness|disease|surgery|diagnos|invest|stock|lottery|profit|guarantee[sd]?)\b/iu);
  });
});
