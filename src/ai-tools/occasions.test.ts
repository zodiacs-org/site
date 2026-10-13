import { describe, expect, it } from 'vitest';
import { ALL_AI_TOOL_NAMES, AI_TOOL_NAMES, OUTPUT_SCHEMAS } from './contracts';
import { executeAiTool, offeredTools } from './tools';

const off = { now: () => new Date('2026-10-11T12:00:00Z') };
const on = { ...off, occasions: true };

describe('occasion tools behind ZODIACS_OCCASIONS_ENABLED', () => {
  it('are neither offered nor run until the switch is on', async () => {
    expect(offeredTools(off)).toEqual(AI_TOOL_NAMES.filter((tool) => tool !== 'get_horoscope'));
    expect(offeredTools(on)).toEqual([...AI_TOOL_NAMES.filter((tool) => tool !== 'get_horoscope'), 'get_occasion_sky', 'get_life_milestones']);
    const hidden = await executeAiTool('get_occasion_sky', { occasion: 'wedding', date: '2027-06-12' }, off);
    expect(hidden).toMatchObject({ ok: false, error: { code: 'unavailable' } });
    const capabilities = await executeAiTool('get_capabilities', {}, on);
    if (capabilities.ok && capabilities.tool === 'get_capabilities') {
      expect(capabilities.data.tools).toContain('get_life_milestones');
      expect(capabilities.data.privacy).toContain('or a birth date');
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
    expect(result.data.cardUrl.startsWith('https://zodiacs.org/occasions/#o=wedding&d=2027-06-12')).toBe(true);
    expect(result.data.cardUrl).not.toContain('?');
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
    const half = await executeAiTool('get_occasion_sky', { occasion: 'wedding', date: '2027-06-12', zone: 'Europe/Rome', latitude: 43.77 }, on);
    expect(half.ok).toBe(false);
  });

  it('lists life milestones, the next one and the sky numbers', async () => {
    const result = await executeAiTool('get_life_milestones', { birthDate: '1997-03-15' }, on);
    expect(result.ok).toBe(true);
    if (!result.ok || result.tool !== 'get_life_milestones') return;
    expect(result.data.timeKnown).toBe(false);
    expect(result.data.next).toMatchObject({ kind: 'saturn-return', name: 'Saturn return', age: 29 });
    expect(result.data.numbers).toEqual({ fullMoons: 366, mercuryRetrogrades: 93, jupiterReturns: 2 });
    expect(result.data.cardUrl).toBe('https://zodiacs.org/occasions/milestones/#b=1997-03-15');
    const future = await executeAiTool('get_life_milestones', { birthDate: '2027-01-01' }, on);
    expect(future).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
  });
});
