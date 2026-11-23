import { describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { wholeSignHouseFromAsc } from '../../lib/daily';
import { SIGNS, signIndexForLongitude } from '../../lib/signs';
import { UNDER_13_REFUSAL } from '../contracts';
import { MINOR_NOTE } from '../features/reading-guards';
import { executeAiTool } from '../tools';
import { RETROGRADE_ASK, RETROGRADE_LINE, retrogradeForMe, retrogradeForMeTool, retrogradeLoops } from './retrograde-for-me';
import { castNatal, forbiddenClaim } from './shared';

const clock = createLocalTimeModule();
const NOW = new Date('2026-11-09T09:00:00Z');
const context = (now = NOW) => ({ now, localTime: clock, resolveZone: async (name: string) => name, origin: 'https://zodiacs.org', pageOn: true });
const run = (args: Parameters<typeof retrogradeForMe>[0], now = NOW) => retrogradeForMe(args, context(now)).then((result) => { if ('refused' in result) throw new Error(result.refused); return result.data; });
const PAGE_FLAG = 'PUBLIC_RETROGRADES_FOR_YOU_ENABLED';
const ON = { occasions: true, coverage: true, personal: true, now: () => NOW, sitePageOn: (flag: string) => flag === PAGE_FLAG };
const HOUR = 3_600_000;
const near = (actual: string, published: string, within = HOUR) => expect(Math.abs(Date.parse(actual) - Date.parse(published)), `${actual} against ${published}`).toBeLessThanOrEqual(within);
const MADRID = { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 };

describe('get_retrograde_for_me against published stations', () => {
  it('reports Mercury and Venus retrograde on 9 November 2026 with their stations, and Mars next in January 2027', async () => {
    const data = await run({ birthDate: '1990-05-03', currentZone: 'UTC' });
    const [mercury, venus, mars] = data.periods;
    // NASA JPL Horizons (src/data/nasa-event-instants.json): 2026-10-24 07:12:42 and 2026-11-13 15:53:52 UTC.
    expect(mercury).toMatchObject({ planet: 'Mercury', retrogradeNow: true, status: 'retrograde' });
    near(mercury.stationRetrograde.utc, '2026-10-24T07:12:42Z');
    near(mercury.stationDirect.utc, '2026-11-13T15:53:52Z');
    expect(mercury.stationRetrograde).toMatchObject({ sign: 'scorpio', date: '2026-10-24' });
    expect(mercury.stationRetrograde.degree).toBeCloseTo(20.98, 0);
    expect(mercury.stationDirect).toMatchObject({ sign: 'scorpio', date: '2026-11-13' });
    expect(mercury.stationDirect.degree).toBeCloseTo(5.03, 0);
    expect(mercury.signs).toEqual(['scorpio']);
    // The /retrogrades/ page's shadows (src/data/sky.json): 2026-10-04 09:10 and 2026-11-30 06:17 UTC.
    near(mercury.preShadowStart!.utc, '2026-10-04T09:10:55Z');
    near(mercury.postShadowEnd!.utc, '2026-11-30T06:17:00Z');
    // NASA: 2026-10-03 07:15:55 and 2026-11-14 00:27:28 UTC, about 8 Scorpio to 22 Libra.
    expect(venus).toMatchObject({ planet: 'Venus', retrogradeNow: true, status: 'retrograde', signs: ['libra', 'scorpio'] });
    near(venus.stationRetrograde.utc, '2026-10-03T07:15:55Z');
    near(venus.stationDirect.utc, '2026-11-14T00:27:28Z');
    expect(venus.stationRetrograde).toMatchObject({ sign: 'scorpio', position: "8°29' Scorpio" });
    expect(venus.stationDirect).toMatchObject({ sign: 'libra', position: "22°51' Libra" });
    // Mars: not retrograde in 2026, but already in the pre-shadow of the loop from about 10 Virgo (2027-01-10) to 2027-04-01.
    expect(mars).toMatchObject({ planet: 'Mars', retrogradeNow: false, status: 'pre-shadow', signs: ['leo', 'virgo'] });
    near(mars.stationRetrograde.utc, '2027-01-10T13:00:54Z');
    near(mars.stationDirect.utc, '2027-04-01T14:11:20Z');
    expect(mars.stationRetrograde.sign).toBe('virgo');
    expect(mars.stationRetrograde.degree).toBeCloseTo(10.4, 0);
    near(mars.preShadowStart!.utc, '2026-11-05T15:33:34Z');
    expect(mars.reading).toContain('Mars is not retrograde now. It next turns retrograde on Sun 10 Jan 2027');
    expect(data.summary).toContain('Mercury is retrograde now.');
  });

  it('finds the 2026 Pisces and Cancer loops from inside each, searching back for the retrograde station', () => {
    // NASA: 2026-02-26 06:48:10 at about 22 Pisces to 2026-03-20 19:32:50 at about 8 Pisces.
    const pisces = retrogradeLoops('Mercury', new Date('2026-03-10T00:00:00Z'));
    expect(pisces.retrogradeNow).toBe(true);
    near(pisces.current.stationRetrograde.at.toISOString(), '2026-02-26T06:48:10Z');
    near(pisces.current.stationDirect.at.toISOString(), '2026-03-20T19:32:50Z');
    expect(SIGNS[signIndexForLongitude(pisces.current.stationRetrograde.lon)].slug).toBe('pisces');
    expect(pisces.current.stationRetrograde.lon - 330).toBeCloseTo(22.57, 0);
    expect(pisces.current.stationDirect.lon - 330).toBeCloseTo(8.49, 0);
    // NASA: 2026-06-29 17:35:55 at about 26 Cancer to 2026-07-23 22:57:51 at about 16 Cancer.
    const cancer = retrogradeLoops('Mercury', new Date('2026-07-01T00:00:00Z'));
    near(cancer.current.stationRetrograde.at.toISOString(), '2026-06-29T17:35:55Z');
    near(cancer.current.stationDirect.at.toISOString(), '2026-07-23T22:57:51Z');
    expect(cancer.current.stationRetrograde.lon - 90).toBeCloseTo(26.26, 0);
    expect(cancer.current.stationDirect.lon - 90).toBeCloseTo(16.32, 0);
    // Before the loop starts, the same loop is the next one.
    expect(retrogradeLoops('Mercury', new Date('2026-06-20T00:00:00Z'))).toMatchObject({ retrogradeNow: false });
    near(retrogradeLoops('Mercury', new Date('2026-06-20T00:00:00Z')).current.stationRetrograde.at.toISOString(), '2026-06-29T17:35:55Z');
  });

  it('reads the post-shadow after a direct station from the loop that just ended, with the next loop on a line of its own', async () => {
    const data = await run({ birthDate: '1990-05-03', planets: ['Mercury'], currentZone: 'UTC' }, new Date('2026-11-20T12:00:00Z'));
    expect(data.periods).toHaveLength(1);
    const [mercury] = data.periods;
    expect(mercury).toMatchObject({ retrogradeNow: false, status: 'post-shadow', signs: ['scorpio'] });
    expect(mercury.stationRetrograde.date).toBe('2026-10-24');
    expect(mercury.stationDirect.date).toBe('2026-11-13');
    expect(mercury.next!.stationRetrograde.startsWith('2027-02-09')).toBe(true);
    expect(mercury.reading).toContain('Mercury turned direct on Fri 13 Nov 2026 at');
    expect(mercury.reading).toContain('is in the post-shadow until Mon 30 Nov 2026, going back over the degrees it covered while retrograde.');
    expect(mercury.reading.match(/post-shadow/gu)).toHaveLength(1);
    expect(mercury.shareUrl).toContain('s=2026-10-24');
  });
});

describe('get_retrograde_for_me and the hosted event budget', () => {
  it('asks the event admission guard before its station and shadow searches, and searches nothing when refused', async () => {
    for (const [verdict, refused] of [['limited', 'rate-limited'], ['unavailable', 'rate-limit-unavailable']] as const) {
      let asked = 0;
      const result = await retrogradeForMe({ birthDate: '1990-05-03', currentZone: 'UTC' }, { ...context(), allowEvents: async () => { asked += 1; return verdict; } });
      expect(asked).toBe(1);
      expect(result).toEqual({ refused });
    }
    let asked = 0;
    const allowed = await retrogradeForMe({ birthDate: '1990-05-03', currentZone: 'UTC' }, { ...context(), allowEvents: async () => { asked += 1; return 'allowed'; } });
    expect(asked).toBe(1);
    if ('refused' in allowed) throw new Error(allowed.refused);
    expect(allowed.data.periods).toHaveLength(3);
  });

  it('refuses through the tool call as the other searching tools do', async () => {
    const result = await executeAiTool('get_retrograde_for_me', { birthDate: '1990-05-03', currentZone: 'UTC' }, { ...ON, allowEvents: async () => 'limited' });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).toContain('rate-limited');
  });
});

describe('get_retrograde_for_me in the birth chart', () => {
  it('places each loop in the whole-sign house from the natal rising sign, with the natal points it passes over', async () => {
    const natal = await castNatal(MADRID, clock);
    const rising = SIGNS[signIndexForLongitude(natal.angles!.asc)].slug;
    const data = await run({ ...MADRID, currentZone: 'Europe/Madrid' });
    expect(data.timeKnown && data.placed).toBe(true);
    for (const period of data.periods) {
      expect(period.housesCountedFrom).toBe('rising sign');
      expect(period.houses.map((entry) => entry.sign)).toEqual(period.signs);
      for (const entry of period.houses) {
        expect(entry.house).toBe(wholeSignHouseFromAsc(entry.sign, rising));
        expect(entry.line).toContain(RETROGRADE_ASK[period.planet]);
      }
      expect(period.confidenceLabel).toBe('Reading confidence 70%');
      expect(period.reading).toContain(RETROGRADE_LINE[period.planet]);
    }
    // Natal Pluto at 16 Scorpio sits inside Mercury's loop (5 to 21 Scorpio); the timed Moon at 29 Leo inside Mars's.
    expect(data.periods[0].contacts.map((entry) => entry.point)).toEqual(['Pluto']);
    expect(data.periods[2].contacts.map((entry) => entry.point)).toContain('Moon');
  });

  it('counts the houses from the Sun sign without a birth time, says so, and gives a lower confidence', async () => {
    const data = await run({ birthDate: '1990-05-03' });
    const [mercury] = data.periods;
    // Sun in Taurus: Scorpio is the seventh sign from it.
    expect(mercury.housesCountedFrom).toBe('Sun sign');
    expect(mercury.houses).toMatchObject([{ house: 7, sign: 'scorpio' }]);
    expect(mercury.houses[0].line).toContain('the seventh house counted from your Sun sign');
    expect(mercury.confidenceLabel).toBe('Reading confidence 55%');
    expect(mercury.contacts.map((entry) => entry.point)).not.toContain('Moon');
    expect(data.limits.join(' ')).toContain('counted from your Sun sign');
    expect(data.limits.join(' ')).toContain('UTC');
  });

  it('gives no houses when an untimed birth day saw the Sun change sign', async () => {
    // The Sun entered Gemini on 21 May 1990.
    const data = await run({ birthDate: '1990-05-21' });
    expect(data.periods.every((period) => period.houses.length === 0 && period.housesCountedFrom === null)).toBe(true);
    expect(data.limits.join(' ')).toContain('the Sun changed sign on the birth day');
  });

  it('leaves romantic wording out under 18', async () => {
    // Sun in Gemini: Venus's loop in Libra falls in the fifth sign from it, whose theme names romance.
    const data = await run({ birthDate: '2010-06-05', planets: ['Venus'] });
    const [venus] = data.periods;
    expect(venus.houses[0]).toMatchObject({ house: 5, sign: 'libra' });
    expect(venus.reading).not.toMatch(/romance|romantic/iu);
    expect(venus.houses[0].line).toContain('play');
    expect(data.limits).toContain(MINOR_NOTE);
    const adult = await run({ birthDate: '1990-06-05', planets: ['Venus'] });
    expect(adult.periods[0].reading).toContain('romance');
    expect(adult.limits).not.toContain(MINOR_NOTE);
  });

  it('keeps every pre-written line clear of forbidden claims and dashes', () => {
    for (const text of [...Object.values(RETROGRADE_LINE), ...Object.values(RETROGRADE_ASK)]) expect(forbiddenClaim(text), text).toBeNull();
  });
});

describe('get_retrograde_for_me privacy and refusals', () => {
  it('is not offered with the switch off, refuses a child, and puts no birth detail in a link', async () => {
    expect((await executeAiTool('get_retrograde_for_me', { birthDate: '1990-05-03' }, { occasions: true, coverage: true })).ok).toBe(false);
    expect(await executeAiTool('get_retrograde_for_me', { birthDate: '2016-05-03' }, ON)).toMatchObject({ ok: false, error: { code: 'invalid-request', message: UNDER_13_REFUSAL } });
    const result = await executeAiTool('get_retrograde_for_me', { ...MADRID, currentZone: 'Europe/Madrid' }, ON);
    expect(result.ok).toBe(true);
    const text = JSON.stringify(result);
    for (const url of text.match(/https:\/\/[^"]+/gu) ?? []) expect(url).not.toMatch(/1990|05-03|08:30|40\.42|3\.7|Madrid/u);
    if (result.ok) {
      const shareUrls = (result.data as { periods: { shareUrl: string | null }[] }).periods.map((entry) => entry.shareUrl).filter(Boolean) as string[];
      expect(shareUrls.length).toBeGreaterThan(0);
      for (const shareUrl of shareUrls) {
        const params = new URL(shareUrl).searchParams;
        expect([...params.keys()].sort()).toEqual(['p', 's', 'sun']);
        expect(params.get('sun')).toBe('taurus');
      }
    }
    expect(forbiddenClaim(text)).toBeNull();
    expect(text).not.toMatch(/[\u2013\u2014]/u);
  });

  it('links to the page and its share cards only while the website page is switched on', async () => {
    expect(retrogradeForMeTool.pageFlag).toBe(PAGE_FLAG);
    const linked = (result: Awaited<ReturnType<typeof executeAiTool>>) => {
      if (!result.ok) throw new Error('refused');
      const data = result.data as { pageUrl: string | null; periods: { shareUrl: string | null }[] };
      return { data, urls: JSON.stringify(result).match(/https:\/\/[^"]+/gu) ?? [] };
    };
    // The MCP switches on and the page on: the page, and a share card for each published window.
    const on = linked(await executeAiTool('get_retrograde_for_me', { ...MADRID, currentZone: 'Europe/Madrid' }, ON));
    expect(on.data.pageUrl).toBe('https://zodiacs.org/retrogrades/for-you/');
    expect(on.data.periods.some((period) => period.shareUrl?.startsWith('https://zodiacs.org/share/retrograde-for-you/?'))).toBe(true);
    expect(on.urls).toContain('https://zodiacs.org/retrogrades/for-you/');
    // The MCP switches on and the page off (or no page switch read at all): neither, so no link is a 404.
    for (const dependencies of [{ ...ON, sitePageOn: () => false }, { occasions: true, coverage: true, personal: true, now: () => NOW }]) {
      const off = linked(await executeAiTool('get_retrograde_for_me', { ...MADRID, currentZone: 'Europe/Madrid' }, dependencies));
      expect(off.data.pageUrl).toBeNull();
      expect(off.data.periods.every((period) => period.shareUrl === null)).toBe(true);
      expect(off.urls.filter((url) => url.includes('/retrogrades/for-you/') || url.includes('/share/'))).toEqual([]);
      // The published retrogrades tables stay linked: they are live pages on main.
      expect(off.urls.some((url) => url.startsWith('https://zodiacs.org/retrogrades/'))).toBe(true);
    }
    // Called directly, anything but pageOn: true links neither.
    for (const pageOn of [false, undefined]) {
      const result = await retrogradeForMe({ ...MADRID, currentZone: 'Europe/Madrid' }, { ...context(), pageOn });
      if ('refused' in result) throw new Error(result.refused);
      expect(result.data.pageUrl).toBeNull();
      expect(result.data.periods.every((period) => period.shareUrl === null)).toBe(true);
      expect(result.links.map((link) => link.url).filter((url) => url.includes('/retrogrades/for-you/'))).toEqual([]);
    }
  });

  it('refuses a time without a zone and an unknown planet', async () => {
    expect(await executeAiTool('get_retrograde_for_me', { birthDate: '1990-05-03', time: '08:30' }, ON)).toMatchObject({ ok: false });
    expect(await executeAiTool('get_retrograde_for_me', { birthDate: '1990-05-03', planets: ['Jupiter'] }, ON)).toMatchObject({ ok: false });
  });
});
