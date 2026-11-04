import { describe, expect, it } from 'vitest';
import { ALL_AI_TOOL_NAMES, AI_TOOL_NAMES, COVERAGE_TOOL_NAMES, OCCASION_TOOL_NAMES, OUTPUT_SCHEMAS } from './contracts';
import { executeAiTool, offeredTools } from './tools';

const off = { now: () => new Date('2026-10-11T12:00:00Z') };
const on = { ...off, occasions: true };

describe('occasion tools behind ZODIACS_OCCASIONS_ENABLED', () => {
  it('are neither offered nor run until the switch is on', async () => {
    expect(offeredTools(off)).toEqual(AI_TOOL_NAMES.filter((tool) => tool !== 'get_horoscope'));
    expect(offeredTools(on)).toEqual([...AI_TOOL_NAMES.filter((tool) => tool !== 'get_horoscope'), ...OCCASION_TOOL_NAMES]);
    // The 0.6.0 tools need their own switch as well, and the period horoscope its three sources.
    expect(offeredTools({ ...off, coverage: true })).toEqual(offeredTools(off));
    expect(offeredTools({ ...on, coverage: true })).toEqual([...offeredTools(on), ...COVERAGE_TOOL_NAMES.filter((tool) => tool !== 'get_horoscope_period'), 'find_birthplace']);
    expect(await executeAiTool('get_natal_chart', { birthDate: '1990-05-03' }, on)).toMatchObject({ ok: false, error: { code: 'unavailable' } });
    const hidden = await executeAiTool('get_occasion_sky', { occasion: 'wedding', date: '2027-06-12' }, off);
    expect(hidden).toMatchObject({ ok: false, error: { code: 'unavailable' } });
    const capabilities = await executeAiTool('get_capabilities', {}, on);
    if (capabilities.ok && capabilities.tool === 'get_capabilities') {
      expect(capabilities.data.tools).toContain('get_life_milestones');
      expect(capabilities.data.privacy).toContain('birth dates with an optional time');
    }
    const plain = await executeAiTool('get_capabilities', {}, off);
    if (plain.ok && plain.tool === 'get_capabilities') expect(plain.data.privacy).not.toContain('occasion');
    expect([...ALL_AI_TOOL_NAMES].slice(0, AI_TOOL_NAMES.length)).toEqual([...AI_TOOL_NAMES]);
  });

  it('gives a wedding evening in Florence on the place’s clock', async () => {
    const result = await executeAiTool('get_occasion_sky', {
      occasion: 'wedding', date: '2027-06-12', time: '19:00', zone: 'Europe/Rome',
      latitude: 43.7696, longitude: 11.2558, place: 'Florence, Italy', names: 'Ana & Luca',
    }, on);
    expect(result.ok).toBe(true);
    if (!result.ok || result.tool !== 'get_occasion_sky') return;
    const sign = (body: string) => result.data.sky.bodies.find((row) => row.body === body)?.sign;
    expect([sign('Sun'), sign('Moon')]).toEqual(['gemini', 'libra']);
    expect(result.data.sky.retrograde).toContain('Mercury');
    expect(result.data.instant).toEqual({ utc: '2027-06-12T17:00:00.000Z', local: 'Sat 12 Jun 2027, 19:00' });
    expect(result.data.instantIs).toBe('given-time');
    // Sunset 18:57 UTC and golden hour from 18:13 UTC (occasions.test.ts) read as 20:57 and 20:13 in Rome.
    expect(result.data.evening?.sunset?.local).toBe('Sat 12 Jun 2027, 20:57');
    expect(result.data.evening?.goldenHour?.start.local).toBe('Sat 12 Jun 2027, 20:13');
    expect(result.data.evening?.planetsAfterDusk).toEqual(expect.arrayContaining(['Mars', 'Jupiter']));
    expect(result.data.card.title.length).toBeGreaterThan(0);
    expect(result.data.cardUrl?.startsWith('https://zodiacs.org/occasions/#o=wedding&d=2027-06-12')).toBe(true);
    expect(result.data.cardUrl).not.toContain('?');
    expect(result.data.cardUrl).toContain('tz=Europe%2FRome');
    // The share link has the names, the day, the place name, the signs and the rating; no time, zone or coordinates.
    const verdict = result.data.rating.verdict.split('. ')[0] as 'An excellent day for it' | 'A good day for it' | 'A fair day, with a few cautions' | 'A challenging day for it';
    expect(result.data.rating.verdict).toContain('Reading confidence');
    expect(result.data.cardUrl).not.toContain('Ana');
    expect(result.data.cardUrl).toContain('lat=43.77');
    // A time and a place: the reading confidence is 70, as the rating's own label says.
    expect(result.data.rating.verdict).toContain('Reading confidence 70%');
    expect(result.data.shareUrl).toBe(`https://zodiacs.org/share/occasion/?o=wedding&d=2027-06-12&sun=gemini&moon=libra&score=${result.data.rating.score}&v=${{ 'An excellent day for it': 'excellent', 'A good day for it': 'good', 'A fair day, with a few cautions': 'fair', 'A challenging day for it': 'challenging' }[verdict]}&c=70`);
    expect(result.data.shareUrl).not.toContain('Ana');
    expect(OUTPUT_SCHEMAS.get_occasion_sky.safeParse(result).success).toBe(true);
  });

  it('reads a date alone at noon UTC, and refuses a time without its zone', async () => {
    const result = await executeAiTool('get_occasion_sky', { occasion: 'baby', date: '2026-10-23' }, on);
    if (!result.ok || result.tool !== 'get_occasion_sky') throw new Error('expected a card');
    expect(result.data.instantIs).toBe('utc-noon');
    expect(result.data.evening).toBeNull();
    expect(result.data.moonSignChange).toEqual({ from: 'pisces', to: 'aries' });
    const refused = await executeAiTool('get_occasion_sky', { occasion: 'wedding', date: '2027-06-12', time: '19:00' }, on);
    expect(refused).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
    // The page reads a zone only with coordinates, so a time and zone alone get no card link.
    const zoneOnly = await executeAiTool('get_occasion_sky', { occasion: 'wedding', date: '2027-06-12', time: '19:00', zone: 'Europe/Rome' }, on);
    if (!zoneOnly.ok || zoneOnly.tool !== 'get_occasion_sky') throw new Error('expected a card');
    expect(zoneOnly.data.cardUrl).toBeNull();
    expect(OUTPUT_SCHEMAS.get_occasion_sky.safeParse(zoneOnly).success).toBe(true);
    const half = await executeAiTool('get_occasion_sky', { occasion: 'wedding', date: '2027-06-12', zone: 'Europe/Rome', latitude: 43.77 }, on);
    expect(half.ok).toBe(false);
  });

  it('keeps a birth date out of every link: a birthday, a baby or a coming of age has no card or share link, and the answer links the page', async () => {
    for (const occasion of ['baby', 'birthday', 'coming-of-age']) {
      const result = await executeAiTool('get_occasion_sky', { occasion, date: '2026-05-03', time: '08:15', zone: 'Europe/London', latitude: 51.5074, longitude: -0.1278, place: 'London' }, on);
      if (!result.ok || result.tool !== 'get_occasion_sky') throw new Error('expected a card');
      // The published description says to use a returned page link when cardUrl is null.
      expect(result.data.cardUrl).toBeNull();
      expect(result.data.shareUrl).toBeNull();
      expect(result.links.map((link) => link.url)).toContain('https://zodiacs.org/occasions/');
      const links = JSON.stringify(result.links);
      for (const detail of ['2026-05-03', '05-03', '08:15', '08%3A15', '51.5', '-0.1', 'London']) expect(links).not.toContain(detail);
      expect(result.links.map((link) => link.title)).not.toContain('Open the printable card');
      expect(OUTPUT_SCHEMAS.get_occasion_sky.safeParse(result).success).toBe(true);
    }
    // Untimed and without a place, the same.
    const untimed = await executeAiTool('get_occasion_sky', { occasion: 'birthday', date: '2010-04-02' }, on);
    if (!untimed.ok || untimed.tool !== 'get_occasion_sky') throw new Error('expected a card');
    expect(untimed.data.cardUrl).toBeNull();
    expect(untimed.data.shareUrl).toBeNull();
    expect(JSON.stringify(untimed.links)).not.toContain('2010');
    // A wedding is not a birth date, so its card still opens on that day.
    const wedding = await executeAiTool('get_occasion_sky', { occasion: 'wedding', date: '2027-06-12', time: '19:00', zone: 'Europe/Rome', latitude: 43.77, longitude: 11.25 }, on);
    if (!wedding.ok || wedding.tool !== 'get_occasion_sky') throw new Error('expected a card');
    expect(wedding.data.cardUrl).toContain('#o=wedding&d=2027-06-12');
    expect(wedding.data.shareUrl).toContain('2027-06-12');
  });

  it('lists life milestones, the next one and the sky numbers', async () => {
    const result = await executeAiTool('get_life_milestones', { birthDate: '1997-03-15' }, on);
    expect(result.ok).toBe(true);
    if (!result.ok || result.tool !== 'get_life_milestones') return;
    expect(result.data.timeKnown).toBe(false);
    expect(result.data.next).toMatchObject({ kind: 'saturn-return', name: 'Saturn return', age: 29 });
    expect(result.data.numbers).toEqual({ fullMoons: 366, mercuryRetrogrades: 93, jupiterReturns: 2 });
    expect(result.data.cardUrl).toBe('https://zodiacs.org/occasions/milestones/');
    expect(result.data.cardUrl).not.toContain('1997');
    // The page's link holds the date only, so a timed answer gets no link that would recompute it differently.
    const timed = await executeAiTool('get_life_milestones', { birthDate: '1997-03-15', time: '08:30', zone: 'Europe/Rome' }, on);
    if (!timed.ok || timed.tool !== 'get_life_milestones') throw new Error('expected milestones');
    expect(timed.data.cardUrl).toBeNull();
    expect(OUTPUT_SCHEMAS.get_life_milestones.safeParse(timed).success).toBe(true);
    const future = await executeAiTool('get_life_milestones', { birthDate: '2027-01-01' }, on);
    expect(future).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
  });
});
