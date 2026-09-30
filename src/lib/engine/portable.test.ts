import { build } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { natalChart, type BirthInput, type Chart as EngineChart } from '@zodiacs/engine';
import {
  createNatalEnvelope,
  natalReplayInput,
  parseNatalEnvelope,
  serializeNatalEnvelope,
  type NatalEnvelopeContext,
} from '@zodiacs/engine/receipt';
import { adaptChart, siteHouseSystem } from './chart-adapter';
import { computeChart } from './full';
import { computePortableChart, PortableChartError } from './portable';
import type { ChartInput } from './types';

// Observe calls and values while executing the actual installed rc.5 functions.
vi.mock('@zodiacs/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@zodiacs/engine')>();
  return { ...actual, natalChart: vi.fn(actual.natalChart) };
});
vi.mock('@zodiacs/engine/receipt', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@zodiacs/engine/receipt')>();
  return { ...actual, createNatalEnvelope: vi.fn(actual.createNatalEnvelope) };
});

const base: BirthInput = {
  utc: '2001-12-21T08:30:00-00:00', latitude: 78.2232, longitude: 15.6267,
  houseSystem: 'placidus', timeKnown: true,
};

function allFrozen(value: unknown): boolean {
  return value === null || typeof value !== 'object' || (
    Object.isFrozen(value) && Object.values(value).every(allFrozen)
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('optional portable calculation boundary', () => {
  it.each([true, false])('retains requested houses and the 08:30 reference (time known: %s)', (timeKnown) => {
    const result = computePortableChart({ ...base, timeKnown }, { sourceInstant: String(base.utc) });
    const native = vi.mocked(natalChart).mock.results[0].value as EngineChart;
    expect(natalChart).toHaveBeenCalledTimes(1);
    expect(createNatalEnvelope).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createNatalEnvelope).mock.calls[0][0]).toBe(native);
    expect(result.envelope.receipt).toMatchObject({
      instant: '2001-12-21T08:30:00.000Z', sourceInstant: base.utc,
      timeKnown, reference: 'supplied-instant', localResolution: null, provenance: null,
      houses: { requested: 'placidus', actual: timeKnown ? 'whole' : null,
        absenceReason: timeKnown ? null : 'unknown-time' },
    });
    expect(result.inputSnapshot).toEqual(natalReplayInput(result.envelope));
    expect(result.chart.input.houseSystem).toBe('placidus');
    expect(result.chart.input.utc.toISOString()).toBe('2001-12-21T08:30:00.000Z');
    expect(result.chart.houses?.system ?? null).toBe(timeKnown ? 'whole' : null);
    expect(result.chart.flags).toEqual([timeKnown ? 'polar-fallback' : 'no-time']);
    expect(result.chart).toEqual({ ...native, input: { ...native.input, flags: [] },
      bodies: native.bodies.map(({ body, lon, lat, speed, retrograde }) => ({ body, lon, lat, speed, retrograde })) });
    const serialized = serializeNatalEnvelope(result.envelope);
    expect(parseNatalEnvelope(serialized)).toEqual({ ok: true, envelope: result.envelope });
  });

  it('records actual absence for missing location without inventing time context', () => {
    const { envelope, inputSnapshot, chart } = computePortableChart({ utc: base.utc, houseSystem: 'placidus' });
    expect(envelope.receipt).toMatchObject({ sourceInstant: null, reference: 'supplied-instant',
      localResolution: null, provenance: null, coordinates: null,
      houses: { requested: 'placidus', actual: null, absenceReason: 'missing-location' } });
    expect(inputSnapshot).toEqual({ utc: '2001-12-21T08:30:00.000Z', houseSystem: 'placidus',
      timeKnown: true, flags: [] });
    expect(chart.angles).toBeNull();
    expect(chart.houses).toBeNull();
  });

  it('captures defaults and canonical flags from the validated result', () => {
    const { chart, inputSnapshot, envelope } = computePortableChart({ utc: base.utc,
      timeKnown: false, flags: ['dst-fold', 'no-time', 'dst-fold', 'no-time'] });
    expect(inputSnapshot).toEqual({ utc: '2001-12-21T08:30:00.000Z', houseSystem: 'whole',
      timeKnown: false, flags: ['dst-fold'] });
    expect(chart.input.flags).toEqual(['dst-fold']);
    expect(chart.flags).toEqual(['dst-fold', 'no-time']);
    expect(envelope.receipt.inputFlags).toEqual(['dst-fold']);
    expect(envelope.receipt.localResolution).toBeNull();
  });

  it('reads each raw birth setting once and does not reread getters for the snapshot', () => {
    // The site never pins ΔT or gives an instant on another scale than UTC, so
    // `deltaT` and `timeScale` (engine 0.1.1-rc.15 on) are the birth fields it
    // does not pass.
    const fields: Required<Omit<BirthInput, 'deltaT' | 'timeScale'>> = { ...base, utc: base.utc, latitude: 78.2232,
      longitude: 15.6267, houseSystem: 'placidus', timeKnown: false, flags: ['dst-fold', 'no-time'] };
    const reads = new Map<string, number>();
    const input = Object.fromEntries([]) as BirthInput;
    for (const [key, value] of Object.entries(fields)) {
      Object.defineProperty(input, key, { get() {
        const count = (reads.get(key) ?? 0) + 1;
        reads.set(key, count);
        if (count !== 1) throw new Error('private second read');
        return value;
      } });
    }
    const result = computePortableChart(input);
    expect([...reads.entries()].sort()).toEqual(Object.keys(fields).sort().map((key) => [key, 1]));
    expect(result.inputSnapshot).toEqual({ ...fields, utc: '2001-12-21T08:30:00.000Z', flags: ['dst-fold'] });
    expect(result.chart.input).not.toBe(input);
  });

  it('keeps the captured request when a later UTC getter changes the caller object', () => {
    const input: BirthInput = { ...base, flags: ['dst-fold'] };
    Object.defineProperty(input, 'utc', { get() {
      input.latitude = 0;
      input.houseSystem = 'whole';
      input.timeKnown = false;
      (input.flags as string[]).push('lmt');
      return base.utc;
    } });
    const result = computePortableChart(input);
    expect(result.inputSnapshot).toEqual({ utc: '2001-12-21T08:30:00.000Z',
      latitude: 78.2232, longitude: 15.6267, houseSystem: 'placidus', timeKnown: true,
      flags: ['dst-fold'] });
    expect(result.envelope.receipt.houses).toEqual({ requested: 'placidus', actual: 'whole', absenceReason: null });
    expect(result.chart.input).toEqual({ ...result.inputSnapshot, utc: new Date(result.inputSnapshot.utc) });
  });

  it('captures explicit context after calculation rather than claiming an atomic entry snapshot', () => {
    const context: NatalEnvelopeContext = { provenance: { runtime: { name: 'before' } } };
    const input = { ...base };
    Object.defineProperty(input, 'utc', { get() {
      context.provenance!.runtime!.name = 'at receipt creation';
      return base.utc;
    } });
    const result = computePortableChart(input, context);
    expect(result.envelope.receipt.provenance).toEqual({ status: 'claimed',
      runtime: { name: 'at receipt creation' } });
    context.provenance!.runtime!.name = 'after';
    expect(result.envelope.receipt.provenance?.runtime?.name).toBe('at receipt creation');
  });

  it('does not infer a noon convention from an unknown-time noon instant', () => {
    const { envelope } = computePortableChart({ utc: '2001-12-21T12:00:00Z', timeKnown: false });
    expect(envelope.receipt).toMatchObject({ reference: 'supplied-instant', sourceInstant: null,
      localResolution: null, provenance: null });
  });

  it('does not inspect, stringify or retain a private thrown value', () => {
    const leak = vi.fn(() => { throw new Error('private diagnostic read'); });
    const input = Object.defineProperty({}, 'utc', { get() {
      throw new Proxy({}, { get: leak, getOwnPropertyDescriptor: leak, ownKeys: leak });
    } }) as BirthInput;
    expect(() => computePortableChart(input)).toThrow(new PortableChartError());
    expect(leak).not.toHaveBeenCalled();
  });

  it('rejects cycles and non-JSON context values without an exportable result', () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    for (const value of [cycle, { value: undefined }, { value: new Date() }, { value: () => 'private' }]) {
      expect(() => computePortableChart(base, { extensions: value } as NatalEnvelopeContext))
        .toThrow(new PortableChartError());
    }
  });

  it('detaches and recursively freezes the receipt and JSON snapshot while leaving the chart mutable', () => {
    const date = new Date('2001-12-21T08:30:00Z');
    const flags = ['dst-fold'] as const;
    const input: BirthInput = { ...base, utc: date, flags: [...flags] };
    const context: NatalEnvelopeContext = {
      sourceInstant: String(base.utc),
      provenance: { runtime: { name: 'test-runtime', version: 'synthetic' } },
      extensions: { note: { values: ['private label', { value: 17 }] } },
    };
    const result = computePortableChart(input, context);
    const before = serializeNatalEnvelope(result.envelope);
    expect(allFrozen(result.envelope)).toBe(true);
    expect(allFrozen(result.inputSnapshot)).toBe(true);
    expect(JSON.parse(JSON.stringify(result.inputSnapshot))).toEqual(result.inputSnapshot);
    expect(result.envelope.receipt.provenance?.status).toBe('claimed');
    expect(Object.isFrozen(result.chart)).toBe(false);
    expect(Object.isFrozen(date)).toBe(false);
    expect(Object.isFrozen(context.extensions)).toBe(false);
    date.setUTCFullYear(2020);
    input.latitude = 0;
    (input.flags as string[]).push('lmt');
    context.provenance!.runtime!.name = 'changed';
    context.extensions!.note = 'changed';
    result.chart.input.utc.setUTCFullYear(1999);
    result.chart.input.flags!.push('lmt');
    result.chart.input.latitude = -33;
    result.chart.bodies[0].lon = 1;
    result.chart.flags.push('lmt');
    result.chart.houses!.cusps[0] = 2;
    result.chart.angles!.asc = 3;
    result.chart.aspects[0].orb = 4;
    expect(serializeNatalEnvelope(result.envelope)).toBe(before);
    expect(result.inputSnapshot).toEqual({ utc: '2001-12-21T08:30:00.000Z', latitude: 78.2232,
      longitude: 15.6267, houseSystem: 'placidus', timeKnown: true, flags: ['dst-fold'] });
    expect(Reflect.set(result.envelope.receipt.houses, 'requested', 'whole')).toBe(false);
    expect(Reflect.set(result.envelope.result.bodies[0], 'lon', 42)).toBe(false);
    expect(Reflect.set(result.inputSnapshot.flags, '0', 'lmt')).toBe(false);
  });

  it('preserves explicitly supplied local resolution and does not consult current Intl', () => {
    const context: NatalEnvelopeContext = {
      localResolution: { date: '2001-12-21', time: '08:30', timeZone: 'Etc/UTC',
        offsetMinutes: 0, gapShiftMinutes: 0, policy: { fold: 'earlier', gap: 'shift-forward' } },
    };
    const format = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => { throw new Error('unexpected Intl'); });
    try {
      const result = computePortableChart(base, context);
      expect(result.envelope.receipt.localResolution).toEqual(context.localResolution);
      expect(format).not.toHaveBeenCalled();
    } finally { format.mockRestore(); }
  });

  it('performs no network or persistent storage work', () => {
    const forbidden = vi.fn(() => { throw new Error('unexpected side effect'); });
    for (const key of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource']) vi.stubGlobal(key, forbidden);
    const storage = new Proxy({}, { get: forbidden, set: forbidden });
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('sessionStorage', storage);
    vi.stubGlobal('indexedDB', storage);
    computePortableChart(base, { extensions: { url: 'https://example.invalid/private' } });
    expect(forbidden).not.toHaveBeenCalled();
    expect(natalChart).toHaveBeenCalledTimes(1);
  });

  it('rejects context accessors without reading them or exposing private diagnostics', () => {
    const getter = vi.fn(() => { throw new Error('private birth and location'); });
    const context = Object.defineProperty({}, 'sourceInstant', { enumerable: true, get: getter });
    let error: unknown;
    try { computePortableChart(base, context); } catch (caught) { error = caught; }
    expect(getter).not.toHaveBeenCalled();
    expect(error).toBeInstanceOf(PortableChartError);
    expect(String(error)).toBe('PortableChartError: Unable to prepare a portable chart.');
    expect(error).not.toHaveProperty('cause');
    expect(JSON.stringify(error)).not.toContain('private');
    expect(natalChart).toHaveBeenCalledTimes(1);
  });

  it.each([
    { input: { utc: 'private invalid birth' }, context: undefined },
    { input: { ...base, flags: ['no-time'] }, context: undefined },
    { input: base, context: { sourceInstant: '1900-01-01T00:00:00Z' } },
    { input: base, context: { reference: 'utc-noon' } },
    { input: base, context: { extensions: { note: 'x'.repeat(65_537) } } },
  ])('returns one fixed failure for rejected inputs/context (%#)', ({ input, context }) => {
    expect(() => computePortableChart(input as BirthInput, context as NatalEnvelopeContext))
      .toThrow(new PortableChartError());
  });
});

describe('shared compact chart projection', () => {
  it('retains the original full.ts input identity and numerical shape', () => {
    const input: ChartInput = { utc: new Date(String(base.utc)), latitude: 51.5074, longitude: -0.1278,
      houseSystem: 'placidus', timeKnown: true, flags: ['dst-fold'] };
    const legacy = computeChart(input);
    const native = natalChart(input);
    expect(legacy.input).toBe(input);
    expect(legacy).toEqual({ ...native, input, bodies: native.bodies.map(({ sign, degree, ...body }) => body) });
    const projected = adaptChart(native, input);
    expect(projected.input).toBe(input);
    expect(projected.bodies).not.toBe(native.bodies);
    expect(projected.flags).not.toBe(native.flags);
    expect(projected.angles).toBe(native.angles);
    expect(projected.houses).toBe(native.houses);
    expect(projected.aspects).toBe(native.aspects);
    expect(projected.bodies.some((body) => 'sign' in body || 'degree' in body)).toBe(false);
  });

  it('refuses a house system the site does not offer instead of passing it on', () => {
    const input: ChartInput = { utc: new Date(String(base.utc)), latitude: 51.5074, longitude: -0.1278,
      houseSystem: 'placidus', timeKnown: true, flags: [] };
    const porphyry = natalChart({ ...input, houseSystem: 'porphyry' });
    expect(porphyry.houses?.system).toBe('porphyry');
    expect(() => adaptChart(porphyry, input)).toThrow(RangeError);
    expect(siteHouseSystem('whole')).toBe('whole');
    expect(siteHouseSystem('placidus')).toBe('placidus');
  });

  it('keeps the new boundary optional and the shared adapter free of runtime dependencies', async () => {
    for (const entry of ['chart-adapter', 'full', 'types', 'houses', 'aspects', 'portable']) {
      const result = await build({ entryPoints: [`src/lib/engine/${entry}.ts`], bundle: true,
        platform: 'browser', format: 'esm', write: false, metafile: true, logLevel: 'silent' });
      const paths = Object.keys(result.metafile!.inputs);
      expect(paths.some((path) => path.includes('/receipt.js'))).toBe(entry === 'portable');
      expect(paths.some((path) => path.includes('/astronomy-engine/'))).toBe(['full', 'portable'].includes(entry));
      expect(paths.some((path) => path.includes('/geo.js') || path.includes('@zodiacs/sdk'))).toBe(false);
      if (entry !== 'portable') expect(paths.some((path) => path.endsWith('/portable.ts'))).toBe(false);
      if (entry === 'chart-adapter') expect(paths).toEqual(['src/lib/engine/chart-adapter.ts']);
    }
  });
});
