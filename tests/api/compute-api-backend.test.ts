/**
 * The compute API's `backend` field (P4.1,
 * docs/platform/evidence/de440-hosted-20261109/PREREGISTRATION.md): which
 * endpoints take it, the refusals, the fallback, and that each request is
 * answered from the source it names (C11 and C12 in part). The DE440 source
 * here is a synthetic pack in the format the engine reads, with made-up
 * linear motions, so its positions mean nothing: these tests check the
 * plumbing, never accuracy. The deploy's pack is checked by the harness and
 * by the tier B job.
 */
import { createHash } from 'node:crypto';
import { openDe440Pack, type De440Source } from '@zodiacs/engine/de440';
import { describe, expect, it, vi } from 'vitest';
import { DE440_PACK_SHA256 } from '../../src/lib/compute-api/backend';
import { createComputeApiHandler, de440FromFile, type ComputeHandlerOptions } from '../../src/lib/compute-api/handler';
import * as localTime from '../../src/lib/compute-api/local-time-source';
import { run } from '../../scripts/lib/compute-api-harness';
import { RADIUS, syntheticPack } from './helpers/synthetic-de440-pack';

const PACK = syntheticPack();
const DIGEST = createHash('sha256').update(PACK).digest('hex');
const opened: De440Source[] = [];
const precision = async () => {
  const source = await openDe440Pack(PACK, { expectDigest: DIGEST });
  opened.push(source);
  return source;
};
const handlerWith = (options: Partial<ComputeHandlerOptions> = {}) =>
  createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed', ...options });
const withPack = handlerWith({ precision });
const without = handlerWith();

const UTC = '2026-09-29T12:00:00Z';
const PLACE = { latitude: 51.4779, longitude: -0.0015 };
const AE_MOON = 'astronomy-engine-geo-moon;no-light-time;no-aberration';
const DE440_MOON = 'ephemeris-geocentric-moon;light-time;solar-deflection;relativistic-aberration';

describe('the backend field', () => {
  it('is taken by the five endpoints that give positions, and refused elsewhere and when it names no backend', async () => {
    const bodies: Record<string, unknown> = {
      chart: { utc: UTC, ...PLACE },
      positions: { instants: [UTC] },
      events: { from: UTC, to: '2026-10-09T12:00:00Z' },
      'sky-fact': { kind: 'phase', phase: 'full', date: '2026-10-07' },
      elections: { from: UTC, to: '2026-10-01T12:00:00Z', conditions: [{ kind: 'phase', phase: 'waxing' }] },
    };
    for (const [endpoint, body] of Object.entries(bodies)) {
      const named = await run(without, { endpoint: endpoint as never, body: { ...(body as object), backend: 'astronomy-engine' } });
      const omitted = await run(without, { endpoint: endpoint as never, body });
      expect(named.status, endpoint).toBe(200);
      expect(named.json, endpoint).toEqual(omitted.json);
      for (const backend of ['DE440', 'swiss', '', null, 1, ['de440']]) {
        const refused = await run(without, { endpoint: endpoint as never, body: { ...(body as object), backend } });
        expect(refused.status, `${endpoint} ${JSON.stringify(backend)}`).toBe(400);
        expect(refused.json.error, endpoint).toMatchObject({ code: 'invalid-request', pointer: '/backend' });
      }
    }
    for (const [endpoint, body] of [
      ['houses', { utc: UTC, ...PLACE }],
      ['time', { local: { date: '2026-09-29', time: '12:00', zone: 'Europe/London' } }],
    ] as const) {
      const refused = await run(withPack, { endpoint, body: { ...body, backend: 'astronomy-engine' } });
      expect(refused.status, endpoint).toBe(400);
      expect(refused.json.error.code, endpoint).toBe('invalid-request');
    }
  });

  it('refuses de440 with a typed 503 where no pack opens, and says so when DE440 is the default (C11)', async () => {
    const refused = await run(without, { endpoint: 'positions', body: { instants: [UTC], backend: 'de440' } });
    expect(refused.status).toBe(503);
    expect(refused.json.error.code).toBe('backend-unavailable');
    expect(refused.headers.has('retry-after')).toBe(false);
    const none = await run(handlerWith({ precision: async () => null }), { endpoint: 'chart', body: { utc: UTC, ...PLACE, backend: 'de440' } });
    expect(none.status).toBe(503);
    const fallback = await run(handlerWith({ precision: async () => null, defaultBackend: 'de440' }), { endpoint: 'chart', body: { utc: UTC, ...PLACE } });
    expect(fallback.status).toBe(200);
    expect(fallback.json.backend.fallback).toEqual({ from: 'de440', reason: 'pack-unavailable' });
    expect(fallback.json.backend.ephemeris.name).toBe('astronomy-engine');
    expect(fallback.json.receipt.conventions.moonPosition).toBe(AE_MOON);
    // Control: with the pack present the 503 does not occur, and the default answers from DE440.
    expect((await run(withPack, { endpoint: 'positions', body: { instants: [UTC], backend: 'de440' } })).status).toBe(200);
    const defaulted = await run(handlerWith({ precision, defaultBackend: 'de440' }), { endpoint: 'chart', body: { utc: UTC, ...PLACE } });
    expect(defaulted.json.backend.ephemeris).toEqual({ name: 'jpl-de440', version: DIGEST });
    expect(defaulted.json.backend.fallback).toBeUndefined();
  });

  it('names the source in the response, in both kinds of receipt and in the cite', async () => {
    const chart = await run(withPack, { endpoint: 'chart', body: { utc: UTC, ...PLACE, backend: 'de440' } });
    expect(chart.status).toBe(200);
    expect(chart.json.backend).toMatchObject({ name: '@zodiacs/engine', ephemeris: { name: 'jpl-de440', version: DIGEST }, pack: { sha256: DIGEST, startEtSecTdb: -RADIUS, stopEtSecTdb: RADIUS } });
    expect(chart.json.receipt.engine.ephemeris).toEqual({ name: 'jpl-de440', version: DIGEST });
    expect(chart.json.receipt.conventions.moonPosition).toBe(DE440_MOON);
    const positions = await run(withPack, { endpoint: 'positions', body: { instants: [UTC], backend: 'de440' } });
    expect(positions.json.receipt.engine).toEqual(positions.json.backend);
    expect(positions.json.receipt.conventions.moonPosition).toBe(DE440_MOON);
    for (const response of [chart, positions]) {
      expect(response.json.cite.receipt).toMatch(/^sha256:[0-9a-f]{64}$/u);
    }
    // Control: the same requests on astronomy-engine name it, and their cites differ.
    const plain = await run(withPack, { endpoint: 'chart', body: { utc: UTC, ...PLACE } });
    expect(plain.json.backend.ephemeris.name).toBe('astronomy-engine');
    expect(plain.json.backend.pack).toBeUndefined();
    expect(plain.json.receipt.conventions.moonPosition).toBe(AE_MOON);
    expect(plain.json.cite.receipt).not.toBe(chart.json.cite.receipt);
  });

  it("gives /chart the bodies /positions gives at the same instant, bit for bit, on each backend (C8 (b) in part)", async () => {
    for (const backend of ['astronomy-engine', 'de440']) {
      const chart = await run(withPack, { endpoint: 'chart', body: { utc: UTC, ...PLACE, backend } });
      const positions = await run(withPack, { endpoint: 'positions', body: { instants: [UTC], backend } });
      const rows = positions.json.result.instants[0].bodies;
      for (const body of chart.json.result.bodies) {
        const row = rows.find((candidate: { body: string }) => candidate.body === body.body);
        expect({ lon: body.lon, lat: body.lat, speed: body.speed }, `${backend} ${body.body}`).toEqual({ lon: row.lon, lat: row.lat, speed: row.speed });
      }
    }
    // Control: against the other backend's /positions, the equality fails.
    const chart = await run(withPack, { endpoint: 'chart', body: { utc: UTC, ...PLACE, backend: 'de440' } });
    const other = await run(withPack, { endpoint: 'positions', body: { instants: [UTC], backend: 'astronomy-engine' } });
    const sun = (rows: { body: string; lon: number }[]) => rows.find((row) => row.body === 'Sun')!.lon;
    expect(sun(chart.json.result.bodies)).not.toBe(sun(other.json.result.instants[0].bodies));
  });

  it('answers interleaved requests that name different backends each from its own source (C12)', async () => {
    const requests: { endpoint: 'chart' | 'positions' | 'events'; body: Record<string, unknown> }[] = [
      { endpoint: 'chart', body: { utc: UTC, ...PLACE, backend: 'de440' } },
      { endpoint: 'chart', body: { utc: UTC, ...PLACE } },
      { endpoint: 'positions', body: { instants: [UTC, '1850-01-01T00:00:00Z'], backend: 'de440' } },
      { endpoint: 'positions', body: { instants: [UTC, '1850-01-01T00:00:00Z'], backend: 'astronomy-engine' } },
      { endpoint: 'events', body: { from: UTC, to: '2026-10-29T12:00:00Z', backend: 'de440' } },
      { endpoint: 'events', body: { from: UTC, to: '2026-10-29T12:00:00Z' } },
      { endpoint: 'chart', body: { local: { date: '1990-06-15', time: '14:30', zone: 'Europe/Paris' }, latitude: 48.8566, longitude: 2.3522, backend: 'de440' } },
      { endpoint: 'chart', body: { local: { date: '1990-06-15', time: '14:30', zone: 'Europe/Paris' }, latitude: 48.8566, longitude: 2.3522 } },
    ];
    /** The check: interleaved answers equal the answers given one request at a time, each from the backend it names. */
    async function problems(answer: (request: (typeof requests)[number]) => Promise<{ json: any }>): Promise<string[]> {
      const found: string[] = [];
      const oneAtATime = [];
      for (const request of requests) oneAtATime.push((await answer(request)).json);
      const interleaved = await Promise.all(requests.map((request) => answer(request)));
      interleaved.forEach((response, index) => {
        if (JSON.stringify(response.json) !== JSON.stringify(oneAtATime[index])) found.push(`${index}: differs from its answer alone`);
        const wanted = requests[index]!.body.backend === 'de440' ? 'jpl-de440' : 'astronomy-engine';
        if (response.json.backend.ephemeris.name !== wanted) found.push(`${index}: answered from ${response.json.backend.ephemeris.name}`);
      });
      return found;
    }
    expect(await problems((request) => run(withPack, request))).toEqual([]);
    // Control: a double that keeps the DE440 source in place for every request fails the check.
    const leaking = (request: (typeof requests)[number]) => run(withPack, { ...request, body: { ...request.body, backend: 'de440' } });
    expect((await problems(leaking)).length).toBeGreaterThan(0);
  });
});

describe('the deployed opener, de440FromFile', () => {
  it('reads the pack once, opens a new source for every request, and refuses any pack but the pinned one', async () => {
    const read = vi.fn(async () => PACK);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const open = de440FromFile(read);
      // The synthetic pack is not the deploy's: refused, with one warning that carries no request data.
      expect(await open()).toBeNull();
      expect(await open()).toBeNull();
      expect(read).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]![0])).toBe('compute API: the DE440 pack did not open (digest-mismatch); backend de440 answers backend-unavailable');
      warn.mockClear();
      const missing = de440FromFile(async () => null);
      expect(await missing()).toBeNull();
      expect(await missing()).toBeNull();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]![0])).toBe('compute API: no DE440 pack in this deployment; backend de440 answers backend-unavailable');
    } finally {
      warn.mockRestore();
    }
    expect(DE440_PACK_SHA256).not.toBe(DIGEST);
  });

  it('gives each request a source of its own (the sources keep request-derived records)', async () => {
    const before = opened.length;
    await run(withPack, { endpoint: 'chart', body: { utc: UTC, ...PLACE, backend: 'de440' } });
    await run(withPack, { endpoint: 'chart', body: { utc: UTC, ...PLACE, backend: 'de440' } });
    expect(opened.length - before).toBe(2);
    expect(opened.at(-1)).not.toBe(opened.at(-2));
  });
});
