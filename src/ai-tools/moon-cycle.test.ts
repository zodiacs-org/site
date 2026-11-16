import { describe, expect, it } from 'vitest';
import { moonPhase } from '@zodiacs/engine';
import { displayTime, executeAiTool } from './tools';
import { localIso, moonCycle, moonCycleTimes, moonPhaseLabel } from './clear-time';
import { computePositions, phaseCrossings, SampleBudget } from '../lib/compute-api/endpoints';
import { parsePositionsRequest } from '../lib/compute-api/validate';
import { PHASES } from '../lib/compute-api/constants';
import nasa2027 from '../data/nasa-event-times-2027.json';

/**
 * ZOD-64: get_sky's moonPhase also gives the last and next new Moon and the last and next full Moon, as four optional
 * fields after the three it has always given. Each is UTC to the minute (at), with the zone's clock at that minute
 * (localAt, ISO 8601 with its offset) when the request names a zone. Nothing that get_sky gave before changes.
 */
const ISO_MINUTE_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/u;
const ISO_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00[+-]\d{2}:\d{2}$/u;
const FOUR = ['lastNewMoon', 'nextNewMoon', 'lastFullMoon', 'nextFullMoon'] as const;
const MINUTE = 60_000;
type Lunation = { at: string; localAt?: string };
type SkyData = { mode: string; time: { utc: string; zone: string; display: string }; calculation: unknown; moonPhase: Record<string, unknown>; interpretation: string };

async function sky(args: Record<string, unknown>) {
  const result = await executeAiTool('get_sky', args, { now: () => new Date('2026-11-16T03:20:00Z') });
  if (!result.ok || result.tool !== 'get_sky') throw new Error(JSON.stringify(result));
  return { result, data: result.data as unknown as SkyData };
}

/** get_sky's answer as it was before ZOD-64, built the way it was built then. */
function before(args: { instant?: string; zone?: string; bodies?: string[] }, now = '2026-11-16T03:20:00Z') {
  const zone = args.zone ?? 'UTC';
  const calculation = computePositions(parsePositionsRequest({ instants: [args.instant ?? now], ...(args.bodies ? { bodies: args.bodies } : {}) }));
  const utc = calculation.result.instants[0].instant;
  const phase = moonPhase(new Date(utc));
  return { mode: args.instant ? 'requested-instant' : 'current-instant', time: { utc, zone, display: displayTime(utc, zone) }, calculation, moonPhase: { name: moonPhaseLabel(phase.angle), angle: phase.angle, illumination: phase.illumination }, interpretation: 'Astronomical calculations; no personal prediction is supplied.' };
}

const withoutCycle = (data: SkyData) => ({ ...data, moonPhase: Object.fromEntries(Object.entries(data.moonPhase).filter(([key]) => !(FOUR as readonly string[]).includes(key))) });

describe('get_sky keeps everything it gave before', () => {
  const requests: { instant?: string; zone?: string; bodies?: string[] }[] = [
    {},
    { instant: '2026-11-10T08:35:46Z', zone: 'Asia/Bangkok', bodies: ['Moon'] },
    { instant: '2027-03-22T10:43:00Z' },
    { instant: '1800-01-01T00:00:00Z', zone: 'Europe/London' },
    { instant: '2199-12-31T23:59:59Z', zone: 'America/New_York', bodies: ['Sun', 'Moon'] },
  ];

  it('in the same fields, order and values, with the four lunations after illumination and nothing else added', async () => {
    for (const request of requests) {
      const { data } = await sky(request);
      const was = before(request);
      expect(JSON.stringify(withoutCycle(data)), JSON.stringify(request)).toBe(JSON.stringify(was));
      expect(Object.keys(data)).toEqual(Object.keys(was));
      expect(Object.keys(data.moonPhase)).toEqual(['name', 'angle', 'illumination', ...FOUR]);
    }
  });
});

describe('the last and next new and full Moons in get_sky', () => {
  it('are UTC to the minute either side of the moment, with the zone\'s clock only when a zone is named', async () => {
    const zoned = (await sky({ instant: '2026-11-16T03:20:00Z', zone: 'Asia/Bangkok' })).data.moonPhase as Record<string, Lunation>;
    const plain = (await sky({ instant: '2026-11-16T03:20:00Z' })).data.moonPhase as Record<string, Lunation>;
    const at = Date.parse('2026-11-16T03:20:00Z');
    for (const key of FOUR) {
      expect(zoned[key].at, key).toMatch(ISO_MINUTE_UTC);
      expect(zoned[key].localAt, key).toMatch(ISO_LOCAL);
      expect(zoned[key].localAt, key).toBe(localIso(zoned[key].at, 'Asia/Bangkok'));
      expect(Date.parse(zoned[key].localAt!), key).toBe(Date.parse(zoned[key].at));
      expect(plain[key], key).toEqual({ at: zoned[key].at });
      expect(Date.parse(zoned[key].at) <= at, key).toBe(key.startsWith('last'));
    }
    expect(zoned.lastNewMoon.localAt!.endsWith('+07:00')).toBe(true);
    // The moments moonCycle finds, the same search get_upcoming_events lists lunations from.
    const cycle = moonCycle(new Date(at), moonPhase(new Date(at)).angle);
    expect([zoned.lastNewMoon.at, zoned.nextNewMoon.at, zoned.lastFullMoon.at, zoned.nextFullMoon.at]).toEqual([cycle.lastNew, cycle.nextNew, cycle.lastFull, cycle.nextFull]);
  });

  it('keep a lunation just before or after the moment on its own side when rounded', () => {
    const crossings = phaseCrossings(PHASES.new, new Date('2026-06-01T00:00:00Z'), new Date('2027-06-01T00:00:00Z'), new SampleBudget('events.samples')).map((crossing) => crossing.at.getTime());
    // One that rounds up and one that rounds down to its minute, each by more than the two seconds tried either side.
    const up = crossings.find((time) => Math.round(time / MINUTE) * MINUTE > time + 5000)!;
    const down = crossings.find((time) => Math.round(time / MINUTE) * MINUTE < time - 5000)!;
    expect(up).toBeDefined();
    expect(down).toBeDefined();
    for (const lunation of [up, down]) {
      for (const at of [new Date(lunation + 2000), new Date(lunation - 2000)]) {
        const times = moonCycleTimes(at, moonPhase(at).angle, 'UTC') as Record<string, Lunation>;
        expect(Date.parse(times.lastNewMoon.at)).toBeLessThanOrEqual(at.getTime());
        expect(Date.parse(times.nextNewMoon.at)).toBeGreaterThan(at.getTime());
        expect(times.lastNewMoon.at).toMatch(ISO_MINUTE_UTC);
        expect(times.nextNewMoon.at).toMatch(ISO_MINUTE_UTC);
        // Within a minute of the lunation itself, whichever side it shows on.
        const shown = at.getTime() > lunation ? times.lastNewMoon.at : times.nextNewMoon.at;
        expect(Math.abs(Date.parse(shown) - lunation)).toBeLessThan(MINUTE);
      }
    }
  });

  it('agree with NASA JPL Horizons\' 2027 full Moons to within a minute (src/data/nasa-event-times-2027.json)', async () => {
    const full = nasa2027.lunations.filter((row) => row.type === 'full');
    expect(full.length).toBe(12);
    for (const [index, row] of full.entries()) {
      // A moment two days before each full Moon names it as the next one, and two days after as the last.
      const nasa = Date.parse(row.nasa);
      const ahead = (await sky({ instant: new Date(nasa - 2 * 86_400_000).toISOString() })).data.moonPhase as Record<string, Lunation>;
      const behind = (await sky({ instant: new Date(nasa + 2 * 86_400_000).toISOString() })).data.moonPhase as Record<string, Lunation>;
      expect(Math.abs(Date.parse(ahead.nextFullMoon.at) - nasa), `${index} ${row.nasa}`).toBeLessThanOrEqual(MINUTE);
      expect(behind.lastFullMoon.at, row.nasa).toBe(ahead.nextFullMoon.at);
    }
  }, 60_000);
});
