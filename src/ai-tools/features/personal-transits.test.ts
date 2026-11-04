import { describe, expect, it } from 'vitest';
import { scanTransitContacts } from '../../lib/engine/transit-scan';
import { executeAiTool } from '../tools';
import { numberTransitPasses, type PersonalTransitsData } from './personal-transits';

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
    expect(data).toMatchObject({ mode: 'window', from: '2026-11-02', to: '2026-12-01', zone: 'Europe/Madrid', timeKnown: true, placed: true });
    // Both ends included: 2 November to 1 December is exactly 30 days.
    expect((Date.parse(`${data.to}T00:00:00Z`) - Date.parse(`${data.from}T00:00:00Z`)) / 86_400_000 + 1).toBe(30);
    expect(data.scanned.points).toEqual(expect.arrayContaining(['Moon', 'ASC', 'MC']));
    expect(data.contacts.length).toBeGreaterThan(5);
    expect(data.contacts.map((contact) => contact.exactUtc)).toEqual([...data.contacts.map((contact) => contact.exactUtc)].sort());
    for (const contact of data.contacts) {
      expect(contact.exactUtc >= '2026-11-01T23:00:00.000Z' && contact.exactUtc < '2026-12-01T23:00:00.000Z').toBe(true);
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

  it('refuses a window that starts before the birth date, and a year ahead before the birth', async () => {
    expect(await executeAiTool('get_personal_transits', { birthDate: '1990-05-03', from: '1850-01-01', to: '1850-12-01' }, on)).toMatchObject({ ok: false, error: { code: 'invalid-request', message: 'The window starts before the birth date; give a from date on or after the birth date.' } });
    expect(await executeAiTool('get_personal_transits', { birthDate: '1990-05-03', from: '1990-05-02', to: '1990-05-10' }, on)).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    expect(await executeAiTool('get_personal_transits', { birthDate: '2100-05-03' }, on)).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    expect(await executeAiTool('get_personal_transits', { birthDate: '2100-05-03', mode: 'year-ahead' }, on)).toMatchObject({ ok: false, error: { message: 'year-ahead starts today, which is before the birth date.' } });
    expect((await transits({ birthDate: '1990-05-03', from: '1990-05-03', to: '1990-05-10' })).from).toBe('1990-05-03');
  });

  it('gives a fuller year ahead without a birth time: the slow planets on the personal planets too', async () => {
    const data = await transits({ birthDate: '1990-05-03', mode: 'year-ahead' });
    expect(data.scanned).toEqual({ planets: ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'], points: ['Sun', 'Mercury', 'Venus', 'Mars'] });
    expect(data.highlights.length).toBeGreaterThanOrEqual(6);
    const aspects = data.highlights.filter((item) => item.kind === 'aspect');
    // Uranus squares natal Mars three times from August to October 2027: one entry spanning the passes.
    expect(aspects.find((item) => item.planet === 'Uranus')).toMatchObject({ date: 'Mon 9 Aug 2027', endDate: 'Fri 22 Oct 2027' });
    expect(aspects.find((item) => item.planet === 'Uranus')!.line).toMatch(/^Uranus /u);
    expect(aspects.some((item) => item.planet === 'Jupiter' && item.line.includes('your way of thinking'))).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/[–—]/u);
    const timed = await transits({ ...MADRID, mode: 'year-ahead' });
    expect(timed.scanned.points).toEqual(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'ASC']);
    expect(timed.highlights.length).toBeGreaterThan(data.highlights.length);
  });

  it('counts Mercury and Venus passes across the whole retrograde loop, not only the window', () => {
    const from = new Date('2026-11-04T00:00:00.000Z');
    const to = new Date('2026-12-01T00:00:00.000Z');
    const day = 86_400_000;
    const scan = (lon: number, body: 'Mercury' | 'Venus', pad: number) => {
      const natal = { bodies: [{ body: 'Jupiter' as const, lon }], angles: null };
      const expanded = scanTransitContacts(natal, new Date(from.getTime() - pad * day), new Date(to.getTime() + pad * day), { transitBodies: [body], natalPoints: ['Jupiter'] });
      const numbered = numberTransitPasses(expanded);
      return numbered.filter((contact) => contact.exactUtc >= from.toISOString() && contact.exactUtc <= to.toISOString());
    };
    // 12° Scorpio sits inside the October to November 2026 Mercury retrograde.
    const mercury = scan(222, 'Mercury', 70);
    expect(mercury.length).toBeGreaterThan(0);
    expect(mercury.every((contact) => contact.passCount === 3)).toBe(true);
    expect(mercury.some((contact) => contact.pass > 1)).toBe(true);
    expect(mercury.every((contact) => contact.firstPassUtc < from.toISOString() || contact.pass === 1)).toBe(true);
    // 26° Libra sits inside the autumn 2026 Venus retrograde.
    const venus = scan(206, 'Venus', 100);
    expect(venus.length).toBeGreaterThan(0);
    expect(venus.every((contact) => contact.passCount === 3)).toBe(true);
    expect(venus.some((contact) => contact.pass === 3)).toBe(true);
  });

  it('labels each contact with a reading confidence from the birth details', async () => {
    const dated = await transits({ birthDate: '1990-05-03', from: '2026-11-01', to: '2026-11-20' });
    expect(dated.contacts[0].confidenceLabel).toBe('Reading confidence 60%');
    const placed = await transits({ ...MADRID, from: '2026-11-01', to: '2026-11-20' });
    expect(placed.contacts[0].confidenceLabel).toBe('Reading confidence 75%');
    expect(placed.contacts.every((contact) => contact.pass >= 1 && contact.pass <= contact.passCount)).toBe(true);
    expect(placed.contacts.every((contact) => contact.firstPass <= contact.lastPass)).toBe(true);
  }, 40_000);
});
