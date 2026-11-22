import { describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { computeChart } from '../../lib/engine/full.js';
import { scanTransitContacts } from '../../lib/engine/transit-scan';
import { TRANSIT_BODY_ORDER } from '../../lib/engine/transit-scan-shared';
import { signIndexForLongitude, SIGNS } from '../../lib/signs';
import { MINOR_NOTE } from '../features/reading-guards';
import { readingConfidence, readingConfidenceLabel, readingDetail } from '../reading-confidence';
import { maxOrb } from '../../lib/personal-day/score';
import { executeAiTool } from '../tools';
import { PERSONAL_DAY_LIMIT, dayScore, personalDay, type PersonalDayData } from './personal-day';
import { castNatal, dateOn, forbiddenClaim, type PersonalToolContext } from './shared';

const clock = createLocalTimeModule();
const NOW = new Date('2026-11-09T09:00:00Z');
const context = (now = NOW): PersonalToolContext => ({ now, localTime: clock, resolveZone: async (name) => name, origin: 'https://zodiacs.org' });
const run = (args: Parameters<typeof personalDay>[0], now = NOW) => personalDay(args, context(now)).then((result) => result.data);
const ON = { occasions: true, coverage: true, personal: true, now: () => NOW };
const ADULT = { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7, currentZone: 'Europe/Madrid' };
const MINUTE = 60_000;
const separation = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);
const ANGLE = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 } as const;
const ROMANCE = /\b(?:romantic|romance|attraction|intimacy|in love|sexual|chemistry|way of loving)\b/iu;

/** The natal chart for scanning, as the tool casts it. */
async function natalFor(args: typeof ADULT) {
  const natal = await castNatal(args, clock);
  return { natal, scan: { bodies: natal.chart.bodies.filter((row) => (TRANSIT_BODY_ORDER as readonly string[]).includes(row.body)).map(({ body, lon }) => ({ body, lon })), angles: natal.angles } };
}

describe('get_personal_day against known answers', () => {
  it('lists the solar return (the Sun on the natal Sun) exact on its day, at the scanner\'s minute, at rank 1 or 2', async () => {
    const { scan } = await natalFor(ADULT);
    const [solarReturn] = scanTransitContacts(scan, new Date('2026-05-01T00:00:00Z'), new Date('2026-05-06T00:00:00Z'), { transitBodies: ['Sun'], natalPoints: ['Sun'], aspects: ['conjunction'] });
    const date = dateOn(new Date(solarReturn.exactUtc), 'Europe/Madrid');
    expect(date).toMatch(/^2026-05-0[2-4]$/u);
    const data = await run({ ...ADULT, date });
    const contact = data.contacts.find((entry) => entry.title === 'Sun conjunction your Sun')!;
    expect(contact).toBeDefined();
    expect(contact.rank).toBeLessThanOrEqual(2);
    expect(Math.abs(Date.parse(contact.exactAt!) - Date.parse(solarReturn.exactUtc))).toBeLessThan(MINUTE);
    expect(contact.exactLocal).toBe(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(solarReturn.exactUtc)));
    expect(contact.orb).toBeLessThan(0.6);
    expect(contact.confidenceLabel).toBe('Reading confidence 75%');
    expect(contact.line).toBe('Sun sits on your sense of self: a few days of spotlight, and for a while it colors everything there. Reading confidence 75%.');
  });

  it('on the birthday, lists the Sun on the natal Sun and shares only the sky date and Sun sign', async () => {
    const { scan } = await natalFor(ADULT);
    const [solarReturn] = scanTransitContacts(scan, new Date('2026-05-01T00:00:00Z'), new Date('2026-05-06T00:00:00Z'), { transitBodies: ['Sun'], natalPoints: ['Sun'], aspects: ['conjunction'] });
    const date = dateOn(new Date(solarReturn.exactUtc), 'Europe/Madrid');
    const data = await run({ ...ADULT, date });
    expect(data.contacts.some((entry) => entry.planet === 'Sun' && entry.point === 'Sun')).toBe(true);
    expect(data.shareUrl).toBe(`https://zodiacs.org/share/your-day/?day=${date}&s=taurus`);
    const url = new URL(data.shareUrl!);
    expect([...url.searchParams.keys()].sort()).toEqual(['day', 's']);
    expect(url.searchParams.get('day')).toBe(date);
    expect(url.searchParams.get('s')).toBe('taurus');
  });

  it('times an exact Mars contact to the minute, and the engine agrees the aspect is exact then', async () => {
    const { natal, scan } = await natalFor(ADULT);
    const [contact] = scanTransitContacts(scan, new Date('2026-11-10T00:00:00Z'), new Date('2027-03-01T00:00:00Z'), { transitBodies: ['Mars'], natalPoints: ['Sun', 'Moon', 'ASC', 'MC'] });
    const data = await run({ ...ADULT, date: dateOn(new Date(contact.exactUtc), 'Europe/Madrid') });
    const listed = data.contacts.find((entry) => entry.planet === 'Mars' && entry.point === contact.natalPoint && entry.aspect === contact.aspect)!;
    expect(listed, `${contact.aspect} ${contact.natalPoint}`).toBeDefined();
    expect(listed.rank).toBeLessThanOrEqual(5);
    expect(Math.abs(Date.parse(listed.exactAt!) - Date.parse(contact.exactUtc))).toBeLessThan(MINUTE);
    // Independent of the scanner: the engine's Mars at that instant sits on the aspect's angle from the natal point.
    const mars = computeChart({ utc: new Date(listed.exactAt!), houseSystem: 'whole', timeKnown: true }).bodies.find((row) => row.body === 'Mars')!.lon;
    const point = contact.natalPoint === 'ASC' ? natal.angles!.asc : contact.natalPoint === 'MC' ? natal.angles!.mc : natal.chart.bodies.find((row) => row.body === contact.natalPoint)!.lon;
    expect(Math.abs(separation(mars, point) - ANGLE[contact.aspect])).toBeLessThan(0.01);
    // Exact inside the day: applying when it is exact after midday, and the orb at midday under half a degree for Mars.
    expect(listed.applying).toBe(Date.parse(listed.exactAt!) > Date.parse(data.middayUtc));
    expect(listed.orb).toBeLessThan(0.5);
  });

  it('gives the Moon sign the engine gives at local noon, and the whole-sign house it passes through', async () => {
    const { natal } = await natalFor(ADULT);
    const data = await run(ADULT);
    // 9 November 2026 in Madrid: local noon is 11:00 UTC.
    expect(data.middayUtc).toBe('2026-11-09T11:00:00.000Z');
    const moon = computeChart({ utc: new Date('2026-11-09T11:00:00Z'), houseSystem: 'whole', timeKnown: true }).bodies.find((row) => row.body === 'Moon')!.lon;
    expect(data.moon.sign).toBe(SIGNS[signIndexForLongitude(moon)].slug);
    const house = ((signIndexForLongitude(moon) - signIndexForLongitude(natal.angles!.asc) + 12) % 12) + 1;
    expect(data.moon.house?.number).toBe(house);
    expect(data.moon.line).toContain(SIGNS[signIndexForLongitude(moon)].name);
  });

  it('notes the Moon changing sign inside the day, at the minute it does', async () => {
    // The Moon crosses into a new sign roughly every two and a half days; find a day it does.
    for (let day = 10; day < 14; day += 1) {
      const data = await run({ ...ADULT, date: `2026-11-${day}` });
      if (!data.moon.entersSign) continue;
      const at = new Date(data.moon.entersSign.atUtc);
      const before = computeChart({ utc: new Date(at.getTime() - MINUTE), houseSystem: 'whole', timeKnown: true }).bodies.find((row) => row.body === 'Moon')!.lon;
      const after = computeChart({ utc: new Date(at.getTime() + MINUTE), houseSystem: 'whole', timeKnown: true }).bodies.find((row) => row.body === 'Moon')!.lon;
      expect(SIGNS[signIndexForLongitude(after)].slug).toBe(data.moon.entersSign.sign);
      expect(signIndexForLongitude(before)).not.toBe(signIndexForLongitude(after));
      expect(data.moon.line).toContain(data.moon.entersSign.atLocal);
      // At midday the Moon is in the sign it enters only when it entered before midday.
      expect(data.moon.sign === data.moon.entersSign.sign).toBe(at.getTime() <= Date.parse(data.middayUtc));
      return;
    }
    throw new Error('No Moon sign change found in four days.');
  });

  it('ranks by the documented score, highest first, the same every time', async () => {
    const first = await run(ADULT);
    const second = await run(ADULT);
    expect(second).toEqual(first);
    expect(first.contacts.length).toBeGreaterThan(0);
    expect(first.contacts.length).toBeLessThanOrEqual(PERSONAL_DAY_LIMIT);
    first.contacts.forEach((contact, index) => {
      const daily = ['Moon', 'Sun', 'Mercury', 'Venus', 'Mars'].includes(contact.planet) || contact.exactAt !== null;
      expect(contact.group).toBe(daily ? 'today' : 'background');
      expect(contact.rank).toBe(index + 1);
      if (index) expect(contact.score).toBeLessThanOrEqual(first.contacts[index - 1].score);
      expect(contact.score).toBeCloseTo(dayScore(contact.planet, contact.point, contact.aspect, contact.orb, contact.exactAt !== null), 0);
      expect(contact.line.endsWith(`${contact.confidenceLabel}.`)).toBe(true);
      expect(contact.confidence).toBe(contact.orb < 1 || contact.exactAt ? 75 : 70);
    });
    expect(first.theme).toContain(first.contacts.find((contact) => contact.group === 'today')!.title);
    // The weights put a tight slow contact to a light above a loose one to an outer planet.
    expect(dayScore('Saturn', 'Sun', 'square', 0.2, false)).toBeGreaterThan(dayScore('Saturn', 'Neptune', 'square', 0.2, false));
    expect(dayScore('Mars', 'Sun', 'conjunction', 0.1, true)).toBeGreaterThan(dayScore('Mars', 'Sun', 'conjunction', 0.1, false));
    expect(dayScore('Pluto', 'Sun', 'trine', 2, false)).toBe(0);
  });
});

describe('daily and background contacts', () => {
  const chart = { birthDate: '1985-01-23', currentZone: 'UTC' };

  it('leads with a daily contact on consecutive days with Pluto within a degree of the natal Sun', async () => {
    const titles: string[] = [];
    for (const date of ['2026-11-09', '2026-11-10']) {
      const data = await run({ ...chart, date });
      const pluto = data.contacts[0];
      expect(pluto).toMatchObject({ planet: 'Pluto', aspect: 'conjunction', point: 'Sun', group: 'background' });
      expect(pluto.orb).toBeLessThan(1);
      expect(data.contacts).toHaveLength(8);
      expect(data.contacts.filter((contact) => contact.group === 'background')).toHaveLength(3);
      const today = data.contacts.find((contact) => contact.group === 'today')!;
      expect(data.theme).toContain(`${today.title}, about ${today.orb.toFixed(1)} degrees from exact`);
      expect(data.theme).not.toContain(pluto.title);
      expect([...new URL(data.shareUrl!).searchParams.keys()].sort()).toEqual(['day', 's']);
      expect(new URL(data.shareUrl!).searchParams.get('day')).toBe(date);
      titles.push(today.title);
    }
    expect(titles[0]).not.toBe(titles[1]);
  });

  it('puts a slow mover in Today on the day it is exact with a birth time', async () => {
    const data = await run({ ...chart, time: '12:00', zone: 'UTC', date: '2026-11-24' });
    const pluto = data.contacts.find((contact) => contact.planet === 'Pluto' && contact.point === 'Sun')!;
    expect(pluto.group).toBe('today');
    expect(pluto.exactLocal).toMatch(/^\d{2}:\d{2}$/u);
    expect(data.theme).toContain(`${pluto.title}, exact at ${pluto.exactLocal}`);
  });

  it('uses the background for the theme when there are no daily contacts, and shares only day and Sun sign', async () => {
    const data = await run({ birthDate: '2010-05-03', currentZone: 'UTC', date: '2026-12-31' });
    expect(data.contacts).toHaveLength(1);
    const [top] = data.contacts;
    expect(top.group).toBe('background');
    expect(data.theme).toBe(`In the background, ${top.title}, about ${top.orb.toFixed(1)} degrees from exact (${top.confidenceLabel}).`);
    const query = new URL(data.shareUrl!).searchParams;
    expect([...query.keys()].sort()).toEqual(['day', 's']);
    expect([query.get('day'), query.get('s')]).toEqual(['2026-12-31', 'taurus']);
  });
});

describe('get_personal_day with fewer details', () => {
  it('leaves out the natal Moon, rising degree and Midheaven without a birth time, and says so', async () => {
    const data = await run({ birthDate: '1990-05-03', zone: 'Europe/Madrid' });
    expect(data.points).not.toContain('Moon');
    expect(data.points).not.toContain('ASC');
    expect(data.points).not.toContain('MC');
    for (const contact of data.contacts) expect(['Moon', 'ASC', 'MC']).not.toContain(contact.point);
    expect(data.moon.house).toBeNull();
    // The moving Moon is still read.
    expect(data.moon.sign).toBeTruthy();
    expect(data.limits.join(' ')).toContain('No birth time was given');
    // No current zone: today is read on the birthplace clock, and the answer says so.
    expect(data.limits.join(' ')).toContain('birthplace clock (Europe/Madrid)');
    for (const contact of data.contacts) expect(contact.confidence).toBeLessThanOrEqual(60);
  });

  it('gives no exact time, exact-day bonus or tight-orb confidence without a birth time', async () => {
    const untimed = { birthDate: '1990-05-03', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7, currentZone: 'Europe/Madrid' };
    const dateOnly = readingConfidence(readingDetail({ hasDate: true, hasTime: false, hasPlace: true }), false);
    const { natal, scan } = await natalFor(untimed as typeof ADULT);
    expect(natal.timeKnown).toBe(false);
    let scannerExact = 0;
    for (const date of ['2026-11-03', '2026-11-09', '2026-11-16', '2026-11-24', '2026-12-02', '2027-01-15']) {
      const data = await run({ ...untimed, date });
      expect(data.contacts.length, date).toBeGreaterThan(0);
      for (const contact of data.contacts) {
        expect(contact.exactLocal, date).toBeNull();
        expect(contact.exactAt, date).toBeNull();
        expect(contact.confidence, date).toBe(dateOnly);
        expect(contact.confidenceLabel, date).toBe(readingConfidenceLabel('date', false));
        // Listed only within orb, and scored without the exact-today bonus.
        expect(contact.orb, date).toBeLessThanOrEqual(maxOrb(contact.planet, contact.aspect));
        expect(contact.score, date).toBeCloseTo(dayScore(contact.planet, contact.point, contact.aspect, contact.orb, false), 0);
        expect(contact.line, date).not.toMatch(/exact at \d/u);
      }
      expect(data.theme, date).not.toMatch(/exact at \d/u);
      expect(data.theme, date).toMatch(/, about \d+\.\d degrees from exact \(/u);
      expect(data.limits, date).toContain('No birth time was given, so the natal Moon, the rising degree and the Midheaven are left out, the chart is cast for midday of the birth date, and no exact times are given: without a birth time a contact can be exact a day or more either side.');
      // The midday chart alone would have put a contact exact on these days: the test is not empty.
      const start = new Date(`${date}T00:00:00+01:00`);
      scannerExact += scanTransitContacts(scan, start, new Date(start.getTime() + 86_400_000 - 1), { transitBodies: TRANSIT_BODY_ORDER, includeMoon: true, natalPoints: data.points }).length;
    }
    expect(scannerExact).toBeGreaterThan(0);
  });

  it('still gives the exact time with a birth time, on a day the Moon is exact on a natal point', async () => {
    const { scan } = await natalFor(ADULT);
    const [moon] = scanTransitContacts(scan, new Date('2026-11-10T00:00:00Z'), new Date('2026-12-10T00:00:00Z'), { transitBodies: ['Moon'], includeMoon: true, natalPoints: ['Moon'], aspects: ['conjunction'] });
    const date = dateOn(new Date(moon.exactUtc), 'Europe/Madrid');
    const data = await run({ ...ADULT, date });
    const contact = data.contacts.find((entry) => entry.title === 'Moon conjunction your Moon');
    expect(contact?.exactLocal).toBe(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(moon.exactUtc)));
    expect(data.contacts.some((entry) => entry.exactLocal !== null)).toBe(true);
  });

  it('keeps the natal Moon but no angles with a time and no place, and reads UTC with no zone at all', async () => {
    const timed = await run({ birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', currentZone: 'Asia/Bangkok' });
    expect(timed.points).toContain('Moon');
    expect(timed.points).not.toContain('ASC');
    expect(timed.zone).toBe('Asia/Bangkok');
    expect(timed.limits.join(' ')).toContain('No birthplace coordinates were given');
    const bare = await run({ birthDate: '1990-05-03' });
    expect(bare.zone).toBe('UTC');
    expect(bare.middayUtc).toBe('2026-11-09T12:00:00.000Z');
  });

  it('refuses a date more than 366 days away or before the birth date', async () => {
    await expect(run({ ...ADULT, date: '2027-11-12' })).rejects.toThrow(RangeError);
    await expect(run({ ...ADULT, date: '2025-11-01' })).rejects.toThrow(RangeError);
    await expect(run({ birthDate: '2026-06-01', date: '2026-05-01' })).rejects.toThrow(/before the birth date/u);
    expect((await run({ ...ADULT, date: '2027-11-09' })).date).toBe('2027-11-09');
  });

  it('shares no Sun sign without a zone when a historical clock puts the birth date across a sign change', async () => {
    // 1835-07-22: the Sun entered Leo late in the day on Manila's clock, then UTC-15:56 (the American date until 1845).
    const sunOf = (data: PersonalDayData) => new URL(data.shareUrl!).searchParams.get('s');
    const early = await run({ birthDate: '1835-07-22', time: '00:00', zone: 'Asia/Manila' });
    const late = await run({ birthDate: '1835-07-22', time: '23:59', zone: 'Asia/Manila' });
    expect([sunOf(early), sunOf(late)]).toEqual(['cancer', 'leo']);
    expect((await run({ birthDate: '1835-07-22' })).shareUrl).toBeNull();
    // A date every clock keeps in one sign still shares it.
    expect(new URL((await run({ birthDate: '1835-07-10' })).shareUrl!).searchParams.get('s')).toBe('cancer');
  });
});

describe('get_personal_day for someone under 18', () => {
  it('leaves romantic and attraction wording out of every line over a month, and says so', async () => {
    const minor = { birthDate: '2010-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7, currentZone: 'Europe/Madrid' };
    let touched = 0;
    for (let day = 1; day <= 30; day += 1) {
      const data: PersonalDayData = await run({ ...minor, date: `2026-11-${String(day).padStart(2, '0')}` });
      expect(data.under18).toBe(true);
      expect(data.limits).toContain(MINOR_NOTE);
      const text = JSON.stringify(data);
      // Every reading, leaving out the limit that names what was left out.
      expect(JSON.stringify({ ...data, limits: [] })).not.toMatch(ROMANCE);
      expect(forbiddenClaim(text)).toBeNull();
      // A timed, placed chart always has a Moon house; for a minor it is left out only in the fifth.
      if (data.moon.house === null) touched += 1;
    }
    // The month includes days whose adult wording would have named romance or pleasure.
    expect(touched).toBeGreaterThan(0);
  }, 60_000);
});

describe('get_personal_day privacy and refusals', () => {
  it('is not offered with the switch off', async () => {
    expect((await executeAiTool('get_personal_day', ADULT, { occasions: true, coverage: true, now: () => NOW })).ok).toBe(false);
    expect((await executeAiTool('get_personal_day', ADULT, { occasions: true, coverage: true, personal: false, now: () => NOW })).ok).toBe(false);
  });

  it('refuses a child under 13 before anything is worked out', async () => {
    for (const birthDate of ['2016-01-01', '2020-05-03', '2027-03-01']) {
      const result = await executeAiTool('get_personal_day', { ...ADULT, birthDate }, ON);
      expect(result).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
      expect(result).not.toHaveProperty('data');
    }
  });

  it('puts no birth detail in a link, and passes the copy rule', async () => {
    const result = await executeAiTool('get_personal_day', ADULT, ON);
    expect(result.ok).toBe(true);
    const text = JSON.stringify(result);
    const urls = text.match(/https:\/\/[^"]+/gu) ?? [];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url).not.toMatch(/1990|05-03|08:30|40\.42|3\.7|Madrid|[?&#](?:d|date|birth|t|time|lat|lon|tz|place|city)=/u);
    expect(forbiddenClaim(text)).toBeNull();
    expect(text).not.toMatch(/[\u2013\u2014]|crypto|token|blockchain|market|invest|stock/iu);
  });

  it('checks the zone before any clock reads it, refusing an unknown one without repeating it and taking a known one in any letter case', async () => {
    for (const zone of ['Mars/Olympus_Mons', 'mars/olympus_mons']) {
      const refused = await executeAiTool('get_personal_day', { ...ADULT, zone }, ON);
      expect(refused).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
      expect(JSON.stringify(refused)).not.toMatch(/mars|olympus/iu);
    }
    const lower = await executeAiTool('get_personal_day', { ...ADULT, zone: 'europe/madrid' }, ON);
    expect(lower.ok).toBe(true);
    expect(lower).toEqual(await executeAiTool('get_personal_day', ADULT, ON));
  });

  it('refuses a time without a zone with the field rule', async () => {
    expect(await executeAiTool('get_personal_day', { birthDate: '1990-05-03', time: '08:30' }, ON)).toMatchObject({ ok: false, error: { message: 'A birth time or a place needs its time zone.' } });
  });
});
