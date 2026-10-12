import { describe, expect, it } from 'vitest';
import {
  ASPECTS,
  ASPECT_TYPES,
  aspectMotion,
  matchAspect,
  positions,
  separation,
  type AspectType,
  type BodyName,
  type BodyPosition,
} from '@zodiacs/engine';
import { BUDGETS, EVENT_BODIES, type ComputeEndpoint } from '../../src/lib/compute-api/constants';
import { createComputeApiHandler } from '../../src/lib/compute-api/handler';
import * as localTime from '../../src/lib/compute-api/local-time-source';
import { run } from '../../scripts/lib/compute-api-harness';

const handler = createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed' });
const call = (endpoint: ComputeEndpoint, body: unknown) => run(handler, { endpoint, body });
const answer = (body: object) => call('sky-fact', body).then((response) => {
  expect(response.status, JSON.stringify(body)).toBe(200);
  return response.json;
});
const fact = (body: object) => answer(body).then((json) => json.result);

const MINUTE = 60_000;
const DAY = 86_400_000;

/** A seeded generator, so a failure names a case that can be run again. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const row = (rows: readonly BodyPosition[], body: BodyName) => rows.find((candidate) => candidate.body === body)!;

/** positions() at an instant, kept for the scan in progress: the scan reads each instant up to three times. */
const scanned = new Map<number, BodyPosition[]>();
function rowsAt(ms: number): BodyPosition[] {
  let rows = scanned.get(ms);
  if (!rows) {
    rows = positions(new Date(ms));
    scanned.set(ms, rows);
  }
  return rows;
}

/** The question a chart's aspect list answers: matchAspect names this aspect between the two bodies. */
function holdsAt(ms: number, body: BodyName, other: BodyName, aspect: AspectType): boolean {
  const rows = rowsAt(ms);
  return matchAspect(body, row(rows, body).lon, other, row(rows, other).lon)?.definition.type === aspect;
}

/** The relative longitude's offset from a target, on (−180, 180]. */
function offsetAt(ms: number, body: BodyName, other: BodyName, target: number): number {
  const rows = rowsAt(ms);
  const relative = row(rows, body).lon - row(rows, other).lon;
  const difference = (((relative - target) % 360) + 360) % 360;
  return difference > 180 ? difference - 360 : difference;
}

/** Bisects a change of a predicate between two instants to the millisecond. */
function bisect(low: number, high: number, side: (ms: number) => boolean): number {
  const start = side(low);
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (side(middle) === start) low = middle;
    else high = middle;
  }
  return high;
}

/**
 * Every instant in [from, to) at which the aspect begins or ends, and every
 * instant it is exact, found by reading the engine every few minutes and
 * bisecting each change: a scan that shares nothing with the endpoint's search.
 */
function scan(from: number, to: number, body: BodyName, other: BodyName, aspect: AspectType, step: number) {
  scanned.clear();
  const { angle } = ASPECTS.find((definition) => definition.type === aspect)!;
  const targets = [...new Set([angle, (360 - angle) % 360])];
  const changes: Array<{ at: number; holds: boolean }> = [];
  const exact: number[] = [];
  const last = to - 1;
  let previous = from;
  let held = holdsAt(from, body, other, aspect);
  const offsets = targets.map((target) => offsetAt(from, body, other, target));
  for (let ms = Math.min(from + step, last); ; ms = Math.min(ms + step, last)) {
    const holds = holdsAt(ms, body, other, aspect);
    if (holds !== held) {
      changes.push({ at: bisect(previous, ms, (t) => holdsAt(t, body, other, aspect)), holds });
      held = holds;
    }
    targets.forEach((target, index) => {
      const offset = offsetAt(ms, body, other, target);
      if (Math.sign(offset) !== Math.sign(offsets[index]) && Math.abs(offset) < 90 && Math.abs(offsets[index]) < 90) {
        exact.push(bisect(previous, ms, (t) => offsetAt(t, body, other, target) > 0));
      }
      offsets[index] = offset;
    });
    if (ms === last) break;
    previous = ms;
  }
  return { start: holdsAt(from, body, other, aspect), changes, exact: exact.sort((a, b) => a - b) };
}

/** The engine's orb for a pair: matchAspect accepts a separation this far from the angle and refuses any further. */
function engineOrb(body: BodyName, other: BodyName, aspect: AspectType): number {
  const { angle, orb, luminaryOrb } = ASPECTS.find((definition) => definition.type === aspect)!;
  const accepts = (distance: number) => matchAspect(body, 0, other, distance)?.definition.type === aspect;
  const widest = [orb, luminaryOrb].filter((candidate) => {
    const edge = angle === 180 ? angle - candidate : angle + candidate;
    return accepts(edge);
  });
  return Math.max(...widest);
}

describe('compute API aspect facts: requests', () => {
  async function refusal(body: unknown) {
    const response = await call('sky-fact', body);
    expect(response.status, JSON.stringify(body)).toBe(400);
    expect(response.json.error.code).toBe('invalid-request');
    return response.json.error as { pointer: string; message: string };
  }

  it("names a body, another body and one of the engine's five aspects, at an instant or on a date", async () => {
    const base = { kind: 'aspect', body: 'Moon', other: 'Saturn', aspect: 'square' };
    expect(await refusal({ ...base, instant: '2026-10-12T00:00:00Z', other: 'Moon' })).toMatchObject({ pointer: '/other' });
    expect(await refusal({ ...base, instant: '2026-10-12T00:00:00Z', other: 'North Node' })).toMatchObject({ pointer: '/other' });
    expect(await refusal({ ...base, instant: '2026-10-12T00:00:00Z', aspect: 'quincunx' })).toMatchObject({ pointer: '/aspect' });
    expect(await refusal({ ...base, instant: '2026-10-12T00:00:00Z', aspect: 'Square' })).toMatchObject({ pointer: '/aspect' });
    expect(await refusal({ ...base, instant: '2026-10-12T00:00:00Z', body: 'Chiron' })).toMatchObject({ pointer: '/body' });
    expect(await refusal({ ...base, instant: '2026-10-12T00:00:00Z', date: '2026-10-12' })).toMatchObject({ pointer: '' });
    expect(await refusal({ ...base, instant: '2026-10-12T00:00:00Z', zone: 'Asia/Tokyo' })).toMatchObject({ pointer: '/zone' });
    expect(await refusal({ ...base, instant: '2026-10-12T00:00:00Z', orb: 3 })).toMatchObject({ pointer: '' });
    expect(await refusal({ ...base })).toMatchObject({ pointer: '' });
    for (const missing of ['other', 'aspect'] as const) {
      const { [missing]: _, ...rest } = base;
      expect((await refusal({ ...rest, date: '2026-10-12' })).pointer).toBe(`/${missing}`);
    }
    const { message } = await refusal({ ...base, instant: '2026-10-12T00:00:00Z', aspect: 'quincunx' });
    expect(message).toBe(`Must be one of: ${ASPECT_TYPES.join(', ')}.`);
    for (const aspect of ASPECT_TYPES) {
      expect((await call('sky-fact', { ...base, aspect, date: '2026-10-12' })).status).toBe(200);
    }
  });

  it('echoes the fact as read', async () => {
    const instant = await fact({ kind: 'aspect', body: 'Venus', other: 'Mars', aspect: 'trine', instant: '2026-10-12T09:30:00+07:00' });
    expect(instant.fact).toEqual({ kind: 'aspect', body: 'Venus', other: 'Mars', aspect: 'trine', instant: '2026-10-12T02:30:00.000Z', date: null, zone: null });
    const day = await fact({ kind: 'aspect', body: 'Venus', other: 'Mars', aspect: 'trine', date: '2026-10-12', zone: 'asia/bangkok' });
    expect(day.fact).toEqual({ kind: 'aspect', body: 'Venus', other: 'Mars', aspect: 'trine', instant: null, date: '2026-10-12', zone: 'Asia/Bangkok' });
  });
});

describe('compute API aspect facts: answers', () => {
  it('at an instant: true exactly when matchAspect names the aspect, with the values that decide it', async () => {
    const next = random(20261012);
    let held = 0;
    for (let index = 0; index < 160; index += 1) {
      const ms = Date.UTC(1800, 0, 1) + Math.floor(next() * (Date.UTC(2199, 11, 31) - Date.UTC(1800, 0, 1)));
      const body = EVENT_BODIES[Math.floor(next() * EVENT_BODIES.length)];
      const others = EVENT_BODIES.filter((candidate) => candidate !== body);
      const other = others[Math.floor(next() * others.length)];
      const rows = positions(new Date(ms));
      // Ask about the aspect nearest the separation, so that about half hold.
      const apart = separation(row(rows, body).lon, row(rows, other).lon);
      const nearest = [...ASPECTS].sort((a, b) => Math.abs(apart - a.angle) - Math.abs(apart - b.angle))[0];
      const aspect = next() < 0.8 ? nearest.type : ASPECT_TYPES[Math.floor(next() * ASPECT_TYPES.length)];
      const instant = new Date(ms).toISOString();
      const result = await fact({ kind: 'aspect', body, other, aspect, instant });
      const holds = holdsAt(ms, body, other, aspect);
      held += holds ? 1 : 0;
      expect(result.answer, `${body} ${aspect} ${other} at ${instant}`).toBe(holds ? 'true' : 'false');
      const { angle } = ASPECTS.find((definition) => definition.type === aspect)!;
      expect(result.facts.separation).toBe(apart);
      expect(result.facts.orb).toBe(Math.abs(apart - angle));
      expect(result.facts.allowedOrb).toBe(engineOrb(body, other, aspect));
      expect(result.facts.orb <= result.facts.allowedOrb).toBe(holds);
      expect(result.facts.motion).toBe(aspectMotion(row(rows, body), row(rows, other), angle));
      expect(result.facts.body.lon).toBe(row(rows, body).lon);
      expect(result.facts.other.speed).toBe(row(rows, other).speed);
    }
    expect(held).toBeGreaterThan(20);
    expect(held).toBeLessThan(140);
  });

  it('on a date: depends exactly when the aspect begins or ends in the day, at the instants a minute scan finds', async () => {
    const next = random(1012);
    const zones = [null, null, 'Asia/Bangkok', 'America/New_York', 'Europe/London', 'Pacific/Auckland'];
    const answers = new Map<string, number>();
    let changesSeen = 0;
    let exactSeen = 0;
    for (let index = 0; index < 48; index += 1) {
      const day = Date.UTC(1900, 0, 1) + Math.floor(next() * 300 * 365.2425) * DAY;
      const date = new Date(day).toISOString().slice(0, 10);
      // Half the cases ask about the Moon, whose aspects begin and end within a day.
      const body: BodyName = next() < 0.5 ? 'Moon' : EVENT_BODIES[Math.floor(next() * EVENT_BODIES.length)];
      const others = EVENT_BODIES.filter((candidate) => candidate !== body);
      const other = others[Math.floor(next() * others.length)];
      const rows = positions(new Date(day + DAY / 2));
      const apart = separation(row(rows, body).lon, row(rows, other).lon);
      const aspect = [...ASPECTS].sort((a, b) => Math.abs(apart - a.angle) - Math.abs(apart - b.angle))[0].type;
      const zone = zones[Math.floor(next() * zones.length)];
      const request = { kind: 'aspect', body, other, aspect, date, ...(zone ? { zone } : {}) };
      const { result, receipt } = await answer(request);
      const label = JSON.stringify(request);
      const from = Date.parse(result.window.from);
      const to = Date.parse(result.window.to);
      const expected = scan(from, to, body, other, aspect, body === 'Moon' || other === 'Moon' ? 5 * MINUTE : 30 * MINUTE);
      answers.set(result.answer, (answers.get(result.answer) ?? 0) + 1);

      expect(result.answer, label).toBe(expected.changes.length > 0 ? 'depends' : expected.start ? 'true' : 'false');
      expect(result.facts.changes.map((change: { holds: boolean }) => change.holds), label).toEqual(expected.changes.map((change) => change.holds));
      result.facts.changes.forEach((change: { at: string }, position: number) => {
        expect(Math.abs(Date.parse(change.at) - expected.changes[position].at), label).toBeLessThan(1000);
      });
      expect(result.facts.exact.length, label).toBe(expected.exact.length);
      result.facts.exact.forEach((exact: { at: string; body: { lon: number }; other: { lon: number } }, position: number) => {
        expect(Math.abs(Date.parse(exact.at) - expected.exact[position]), label).toBeLessThan(1000);
        const { angle } = ASPECTS.find((definition) => definition.type === aspect)!;
        expect(Math.abs(separation(exact.body.lon, exact.other.lon) - angle), label).toBeLessThan(1e-3);
      });
      expect(result.facts.allowedOrb).toBe(engineOrb(body, other, aspect));
      const start = positions(new Date(from));
      expect(result.facts.atStart.body.lon).toBe(row(start, body).lon);
      expect(result.facts.atStart.separation).toBe(separation(row(start, body).lon, row(start, other).lon));
      const end = positions(new Date(to - 1));
      expect(result.facts.atEnd.other.lon).toBe(row(end, other).lon);
      expect(receipt.search.samples).toBeLessThanOrEqual(BUDGETS['sky-fact.samples']);
      changesSeen += result.facts.changes.length;
      exactSeen += result.facts.exact.length;
    }
    expect(answers.get('depends')).toBeGreaterThan(5);
    expect(answers.get('true')).toBeGreaterThan(5);
    expect(answers.get('false')).toBeGreaterThan(2);
    expect(changesSeen).toBeGreaterThan(10);
    expect(exactSeen).toBeGreaterThan(5);
  }, 600_000);

  it('reads a conjunction and an opposition across 0° of relative longitude', async () => {
    // New moon at 15:50 UTC on 10 October 2026, full moon at 04:12 UTC on 26 October.
    const newMoon = await fact({ kind: 'aspect', body: 'Moon', other: 'Sun', aspect: 'conjunction', date: '2026-10-10', zone: 'UTC' });
    expect(newMoon.answer).toBe('true');
    expect(newMoon.facts.exact).toHaveLength(1);
    const reversed = await fact({ kind: 'aspect', body: 'Sun', other: 'Moon', aspect: 'conjunction', date: '2026-10-10', zone: 'UTC' });
    expect(reversed.facts.exact.map((exact: { at: string }) => exact.at)).toEqual(newMoon.facts.exact.map((exact: { at: string }) => exact.at));
    expect(reversed.answer).toBe(newMoon.answer);
    const full = await fact({ kind: 'aspect', body: 'Moon', other: 'Sun', aspect: 'opposition', date: '2026-10-26', zone: 'UTC' });
    expect(full.facts.exact).toHaveLength(1);
    expect(Math.abs(Date.parse(full.facts.exact[0].at) - Date.parse('2026-10-26T04:12:00Z'))).toBeLessThan(10 * MINUTE);
  });
});
