import { describe, it, expect, vi } from 'vitest';
import { positions, ENGINE_VERSION } from '@zodiacs/engine';
import { computeEvents } from '../lib/compute-api/endpoints';
import { parseEventsRequest } from '../lib/compute-api/validate';
import { executeAiTool, type AiCallContext } from './tools';
import { AI_TOOL_NAMES } from './contracts';
import committedWindow from '../data/horoscope-window.json';
import { addDays, type HoroscopeWindow } from './horoscope/window';
const dependencies = { now: () => new Date('2026-10-01T06:00:00Z') };

describe('public AI tools', () => {
  it('advertises the published engine and bounded tool surface', async () => {
    const result = await executeAiTool('get_capabilities', {}, dependencies);
    expect(result.ok).toBe(true);
    if (result.ok && result.tool === 'get_capabilities') {
      expect(result.data.engine.version).toBe(ENGINE_VERSION);
      expect(result.data.tools).toEqual(AI_TOOL_NAMES.filter(tool => tool !== 'get_horoscope'));
      expect(result.data.limits.eventWindowDays).toBe(92);
    }
    const withHoroscopes = await executeAiTool('get_capabilities', {}, { ...dependencies, horoscopeWindow: async () => committedWindow as HoroscopeWindow });
    if (withHoroscopes.ok && withHoroscopes.tool === 'get_capabilities') expect(withHoroscopes.data.tools).toEqual(AI_TOOL_NAMES);
  });
  it('calculates now rather than the noon daily snapshot with numerical parity', async () => {
    const result = await executeAiTool('get_sky', { zone: 'Asia/Bangkok' }, dependencies);
    expect(result.ok).toBe(true);
    if (result.ok && result.tool === 'get_sky') {
      expect(result.data.mode).toBe('current-instant');
      expect(result.data.time.utc).toBe('2026-10-01T06:00:00.000Z');
      expect(result.data.time.display).toContain('13:00:00');
      expect(result.data.calculation.result.instants[0].bodies).toEqual(positions(dependencies.now()));
      expect(result.data.calculation.cite.version).toBe(ENGINE_VERSION);
    }
  });
  it('preserves event results, receipts and unproven completeness in a local timezone', async () => {
    const args = { from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z', kinds: ['lunation' as const], zone: 'America/New_York' };
    const result = await executeAiTool('get_upcoming_events', args, dependencies);
    const expected = computeEvents(parseEventsRequest({ from: args.from, to: args.to, kinds: args.kinds }));
    expect(result.ok).toBe(true);
    if (result.ok && result.tool === 'get_upcoming_events') {
      expect(result.data.calculation).toEqual(expected);
      expect(result.data.events.map(({ localAt: _local, ...event }) => event)).toEqual(expected.result.events);
      expect(result.data.completeness).toBe('tested-not-proven');
    }
  });
  it('retains timezone ambiguity instead of changing depends to true', async () => {
    const result = await executeAiTool('check_sky_fact', { kind: 'ingress', body: 'Sun', sign: 'libra', date: '2026-09-23' }, dependencies);
    expect(result.ok).toBe(true);
    if (result.ok && result.tool === 'check_sky_fact') expect(result.data.answer).toBe('depends');
  });
  it('opens native entrypoints with an exact seven-day UTC window and keeps explicit bounds mandatory', async () => {
    const result = await executeAiTool('get_upcoming_events', {}, dependencies);
    expect(result.ok).toBe(true);
    if (result.ok && result.tool === 'get_upcoming_events') {
      expect(result.data.from).toBe('2026-10-01T06:00:00.000Z');
      expect(result.data.to).toBe('2026-10-08T06:00:00.000Z');
      expect(result.data.zone).toBe('UTC');
    }
    for (const input of [{ zone: 'Asia/Bangkok' }, { from: '2026-10-01T00:00:00Z' }, { birth: 'private-canary' }]) {
      const refusal = await executeAiTool('get_upcoming_events', input, dependencies);
      expect(refusal.ok).toBe(false); expect(JSON.stringify(refusal)).not.toContain('private-canary');
    }
  });
  it.each([
    ['get_sky', { instant: '2026-02-30T00:00:00Z' }],
    ['get_sky', { zone: 'Not/AZone' }],
    ['get_sky', { instant: '2026-10-01T00:00:00' }],
    ['get_upcoming_events', { from: '2026-10-01T00:00:00Z', to: '2027-01-15T00:00:00Z' }],
    ['get_upcoming_events', { from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z', kinds: ['eclipse'] }],
    ['check_sky_fact', { kind: 'prediction', date: '2026-10-01' }],
    ['get_sky', { birthDetails: 'private-canary-1985' }],
  ] as const)('refuses %s malformed or unsupported arguments without echoing values', async (tool, input) => {
    const result = await executeAiTool(tool, input, dependencies);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain('private-canary');
  });
  it('fails closed under the events limiter and produces no logs or fetches', async () => {
    const log = vi.spyOn(console, 'log'); const error = vi.spyOn(console, 'error'); const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const result = await executeAiTool('get_upcoming_events', { from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z' }, { ...dependencies, allowEvents: async () => 'unavailable' });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('rate-limit-unavailable');
      expect(log).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled(); expect(fetchSpy).not.toHaveBeenCalled();
    } finally { vi.restoreAllMocks(); }
  });
  it('resolves a date-only fact within its requested civil timezone', async () => {
    const result = await executeAiTool('check_sky_fact', { kind: 'ingress', body: 'Sun', sign: 'libra', date: '2026-09-23', zone: 'Asia/Bangkok' }, dependencies);
    expect(result.ok).toBe(true);
    if (result.ok && result.tool === 'check_sky_fact') expect(result.data.answer).toBe('true');
  });
});

describe('horoscopes', () => {
  const window = committedWindow as HoroscopeWindow;
  const centre = window.generatedFor;
  const at = (instant: string) => ({ now: () => new Date(instant), horoscopeWindow: async () => window });
  async function read(input: Record<string, unknown>, instant: string, context: AiCallContext = {}) {
    const result = await executeAiTool('get_horoscope', input, at(instant), context);
    if (!result.ok || result.tool !== 'get_horoscope') throw new Error(JSON.stringify(result));
    return result.data;
  }
  const passagesOf = (date: string, sign: string, surface: 'today' | 'love' | 'career') =>
    window.editions.find(edition => edition.anchorDate === date)!.signs[sign as 'leo'][surface].passages.map(passage => passage.text);

  it('gives a reader in Bangkok, already in tomorrow, the edition written for that day', async () => {
    const data = await read({ sign: 'leo', zone: 'Asia/Bangkok' }, `${centre}T22:30:00Z`);
    expect(data.status).toBe('available');
    expect(data.date).toBe(addDays(centre, 1));
    expect(data.reading!.paragraphs.map(paragraph => paragraph.text)).toEqual(passagesOf(addDays(centre, 1), 'leo', 'today'));
    const love = await read({ sign: 'leo', zone: 'Asia/Bangkok', focus: 'love' }, `${centre}T22:30:00Z`);
    expect(love.status).toBe('available');
    expect(love.reading!.paragraphs.map(paragraph => paragraph.text)).toEqual(passagesOf(addDays(centre, 1), 'leo', 'love'));
  });
  it('gives readers in the Americas, still in yesterday, the edition for their own date', async () => {
    const newYork = await read({ sign: 'virgo', zone: 'America/New_York', focus: 'career' }, `${addDays(centre, 1)}T01:30:00Z`);
    expect(newYork.date).toBe(centre);
    expect(newYork.reading!.paragraphs.map(paragraph => paragraph.text)).toEqual(passagesOf(centre, 'virgo', 'career'));
    const losAngeles = await read({ sign: 'virgo', zone: 'America/Los_Angeles' }, `${centre}T03:00:00Z`);
    expect(losAngeles.date).toBe(addDays(centre, -1));
    expect(losAngeles.status).toBe('available');
  });
  it('says plainly when a date is not published yet or no longer kept', async () => {
    const later = await read({ sign: 'aries', date: addDays(centre, 2) }, `${centre}T12:00:00Z`);
    expect(later.status).toBe('unavailable');
    expect(later.message).toContain("isn't published yet");
    const earlier = await read({ sign: 'aries', date: addDays(centre, -2) }, `${centre}T12:00:00Z`);
    expect(earlier.message).toContain('no longer kept here');
    expect(earlier.available!.map(item => item.date)).toEqual(window.editions.map(edition => edition.anchorDate));
  });
  it('asks for a sign instead of guessing one', async () => {
    const data = await read({}, `${centre}T12:00:00Z`);
    expect(data.status).toBe('choose-sign');
    expect(data.reading).toBeUndefined();
  });
  it('uses the assistant time zone hint, ignores a bad hint and refuses a bad explicit zone', async () => {
    expect((await read({ sign: 'leo' }, `${centre}T12:00:00Z`, { hostZone: 'Asia/Tokyo' })).zoneSource).toBe('assistant');
    const fallback = await read({ sign: 'leo' }, `${centre}T12:00:00Z`, { hostZone: 'Mars/Olympus' });
    expect(fallback.zone).toBe('UTC'); expect(fallback.zoneSource).toBe('default');
    const refused = await executeAiTool('get_horoscope', { sign: 'leo', zone: 'Mars/Olympus' }, at(`${centre}T12:00:00Z`));
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe('invalid-timezone');
  });
  it('keeps weekly readings to the week containing the reader\'s date', async () => {
    const data = await read({ sign: 'pisces', period: 'week', focus: 'love' }, `${centre}T12:00:00Z`);
    expect(data.status).toBe('available');
    expect(data.focus).toBe('general');
    expect(data.dateLabel.startsWith('Week of')).toBe(true);
  });
  it('sends the panel every reading for the sign, and shows people no UTC or time-zone IDs', async () => {
    const context: AiCallContext = {};
    const data = await read({ sign: 'capricorn', zone: 'Europe/London' }, `${centre}T12:00:00Z`, context);
    expect(context.horoscopePanel!.days.map(day => day.date)).toEqual(window.editions.map(edition => edition.anchorDate));
    expect(context.horoscopePanel!.weeks.length).toBeGreaterThan(0);
    const visible = JSON.stringify({ title: data.reading, why: data.why, label: data.dateLabel });
    expect(visible).not.toMatch(/UTC|Europe\/London|\d{4}-\d{2}-\d{2}T/);
    expect(data.zoneLabel).toBe('London');
  });
});
