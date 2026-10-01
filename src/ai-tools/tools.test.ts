import { describe, it, expect, vi } from 'vitest';
import { positions, ENGINE_VERSION } from '@zodiacs/engine';
import * as localTime from '../../api/_compute/local-time.mjs';
import { computeEvents } from '../lib/compute-api/endpoints';
import { parseEventsRequest } from '../lib/compute-api/validate';
import { executeAiTool } from './tools';
import { AI_TOOL_NAMES } from './contracts';
const dependencies = { localTime, now: () => new Date('2026-10-01T06:00:00Z') };

describe('public AI tools', () => {
  it('advertises the published engine and bounded five-tool surface', async () => {
    const result = await executeAiTool('get_capabilities', {}, dependencies);
    expect(result.ok).toBe(true);
    if (result.ok && result.tool === 'get_capabilities') {
      expect(result.data.engine.version).toBe(ENGINE_VERSION);
      expect(result.data.tools).toEqual(AI_TOOL_NAMES);
      expect(result.data.limits.eventWindowDays).toBe(31);
    }
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
    ['get_upcoming_events', { from: '2026-10-01T00:00:00Z', to: '2026-12-01T00:00:00Z' }],
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
  it('returns relevant, fixed consumer links without personal URL data', async () => {
    const result = await executeAiTool('search_zodiacs', { query: 'Moon sign' }, dependencies);
    expect(result.ok).toBe(true);
    if (result.ok && result.tool === 'search_zodiacs') {
      expect(result.data.results[0].url).toBe('https://zodiacs.org/moon-sign/');
      for (const entry of result.data.results) { expect(new URL(entry.url).search).toBe(''); expect(entry.url).not.toContain('canary'); }
    }
    const malicious = await executeAiTool('search_zodiacs', { query: 'Moon sign private-canary-1985' }, dependencies);
    expect(JSON.stringify(malicious)).not.toContain('canary');
  });
});
