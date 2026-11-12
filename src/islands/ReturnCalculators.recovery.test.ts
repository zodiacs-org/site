import type { VNode } from 'preact';
import type { Profile, SavedChart } from '../lib/profile/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0,
  effects: [] as Array<{ dependencies: unknown[]; cleanup?: () => void }>,
  effectCursor: 0, pending: [] as Array<() => void>,
  writes: vi.fn(), returnsImport: vi.fn(), loadReturns: vi.fn(), solarImport: vi.fn(),
  access: { current: 0 },
  compute: vi.fn(),
  profile: { version: 1, charts: [], settings: { houseSystem: 'whole' } } as Profile,
}));
vi.mock('preact/hooks', () => ({
  useState: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = initial;
    return [harness.slots[slot], (next: unknown) => {
      harness.writes(slot, next);
      harness.slots[slot] = typeof next === 'function' ? next(harness.slots[slot]) : next;
    }];
  },
  useRef: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = { current: initial };
    return harness.slots[slot];
  },
  useMemo: (factory: () => unknown, dependencies: unknown[]) => {
    const slot = harness.cursor++;
    const previous = harness.slots[slot] as { dependencies: unknown[]; value: unknown } | undefined;
    if (!previous || previous.dependencies.length !== dependencies.length
      || dependencies.some((value, index) => !Object.is(value, previous.dependencies[index]))) {
      harness.slots[slot] = { dependencies: [...dependencies], value: factory() };
    }
    return (harness.slots[slot] as { value: unknown }).value;
  },
  useEffect: (effect: () => void | (() => void), dependencies: unknown[]) => {
    const index = harness.effectCursor++;
    const previous = harness.effects[index];
    if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return;
    harness.pending.push(() => {
      previous?.cleanup?.();
      const cleanup = effect();
      harness.effects[index] = { dependencies, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
    });
  },
}));
vi.mock('../lib/hooks/useProfile', () => ({
  useProfile: () => ({ profile: harness.profile, ready: true }),
}));
vi.mock('../lib/profile/read-store', () => ({ loadProfile: () => harness.profile }));
vi.mock('../lib/account-v2/profile-access-reader', () => ({ profileAccessAllowed: () => true }));
vi.mock('../lib/hooks/useProfileAccessGeneration', () => ({ useProfileAccessGeneration: () => harness.access }));
vi.mock('../lib/hooks/useEngine', () => ({ useEngine: () => async () => ({
  computeChart: harness.compute, computeBodies: () => [],
}) }));
vi.mock('../lib/module-load', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/module-load')>();
  return {
    ...actual,
    loadModule: () => actual.loadModule(harness.solarImport),
    createModuleLoader: () => () => harness.loadReturns(),
  };
});

import SaturnReturnCalculator from './SaturnReturnCalculator';
import SolarReturnCalculator from './SolarReturnCalculator';
import TransitTracker from './TransitTracker';
import { BirthDateField, BirthFields } from './BirthFields';
import PlaceSearch from './PlaceSearch';
import CalculationReload, { calculationLoadMessage } from './CalculationReload';

const city = { name: 'London', lat: 51.5, lon: -0.12, tz: 'Europe/London', country: 'GB', admin1: '', pop: 1 };
function render(component: () => VNode<any>) {
  harness.cursor = 0; harness.effectCursor = 0;
  const view = component();
  harness.pending.splice(0).forEach((effect) => effect());
  return view;
}
function nodes(value: unknown): VNode<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as VNode<Record<string, any>>;
  return [node, ...nodes(node.props.children)];
}
const saturn = () => SaturnReturnCalculator({ locale: 'en' });
const solar = () => SolarReturnCalculator();
const transit = () => TransitTracker({ locale: 'en' });
const submit = (component: () => VNode<any>) => nodes(render(component)).find((node) => node.type === 'form')!
  .props.onSubmit({ preventDefault() {} });
const error = (component: () => VNode<any>) => nodes(render(component)).find((node) => node.props.role === 'alert')?.props.children;

beforeEach(async () => {
  harness.slots = []; harness.cursor = 0;
  harness.effects = []; harness.effectCursor = 0; harness.pending = [];
  harness.writes.mockClear(); harness.access.current = 0;
  harness.returnsImport.mockReset(); harness.solarImport.mockReset();
  harness.compute.mockReset();
  harness.profile = { version: 1, charts: [], settings: { houseSystem: 'whole' } };
  vi.stubGlobal('window', new EventTarget());
  const actual = await vi.importActual<typeof import('../lib/module-load')>('../lib/module-load');
  harness.loadReturns.mockReset().mockImplementation(actual.createModuleLoader(harness.returnsImport));
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  harness.effects.forEach((effect) => effect.cleanup?.());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('return calculator file recovery', () => {
  it('observes a failed Saturn warm-up, explains download failure and retries without clearing the date', async () => {
    harness.returnsImport.mockRejectedValueOnce(new Error('warm-up offline'))
      .mockRejectedValueOnce(new Error('still offline'))
      .mockResolvedValue({ saturnReturns: () => ({ natalLon: 90, natalRetrograde: false, seasons: [] }) });
    // The date input is the shared birth date field's, with its calendar control.
    const input = nodes(render(saturn)).find((node) => node.type === BirthDateField)!;
    expect(input.props.id).toBe('sr-date');
    input.props.onDateChange('1990-01-01');
    input.props.onFocus();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await submit(saturn);
    expect(error(saturn)).toBe(calculationLoadMessage('en'));
    expect(nodes(render(saturn)).find((node) => node.type === CalculationReload)?.props.error).toBe(calculationLoadMessage('en'));
    expect(nodes(render(saturn)).find((node) => node.type === BirthDateField)?.props.date).toBe('1990-01-01');
    await submit(saturn);
    expect(error(saturn)).toBeUndefined();
    expect(nodes(render(saturn)).some((node) => node.props.class === 'calc__result')).toBe(true);
    expect(harness.returnsImport).toHaveBeenCalledTimes(3);
  });

  it('does not report a Saturn calculation rejection as a missing module', async () => {
    harness.returnsImport.mockResolvedValue({ saturnReturns: () => { throw new RangeError('invalid date'); } });
    // A date the reader accepts, so the rejection comes from the calculation itself.
    nodes(render(saturn)).find((node) => node.type === BirthDateField)!.props.onDateChange('1990-01-01');
    await submit(saturn);
    expect(error(saturn)).toBeTruthy();
    expect(error(saturn)).not.toBe(calculationLoadMessage('en'));
  });

  it('offers solar-return file recovery, then calculates from the unchanged form', async () => {
    const result = { chart: { input: { utc: new Date('2026-01-01T00:00:00Z') } } };
    const compute = vi.fn(() => result);
    const Result = () => null;
    harness.solarImport.mockRejectedValueOnce(new Error('offline')).mockResolvedValue([
      { computeSolarReturn: compute, prepareLocalTime: async () => {} }, { SolarReturnResult: Result }, { StaticWheel: () => null },
    ]);
    const fields = nodes(render(solar)).find((node) => node.type === BirthFields)!.props;
    fields.onDateChange('1990-01-01'); fields.onTimeChange('12:00'); fields.onCityChange(city);
    await submit(solar);
    expect(error(solar)).toBe(calculationLoadMessage('en'));
    expect(compute).not.toHaveBeenCalled();
    expect(nodes(render(solar)).find((node) => node.type === CalculationReload)?.props.error).toBe(calculationLoadMessage('en'));
    await submit(solar);
    expect(error(solar)).toBeUndefined();
    expect(compute).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ birthDate: '1990-01-01', birthplace: city }));
    expect(nodes(render(solar)).find((node) => node.type === Result)?.props.result).toBe(result);
  });

  it('keeps solar-return calculation errors distinct from download failures', async () => {
    harness.solarImport.mockResolvedValue([
      { computeSolarReturn: () => { throw new RangeError('invalid input'); }, prepareLocalTime: async () => {} },
      { SolarReturnResult: () => null }, { StaticWheel: () => null },
    ]);
    const fields = nodes(render(solar)).find((node) => node.type === BirthFields)!.props;
    fields.onDateChange('1990-01-01'); fields.onTimeChange('12:00'); fields.onCityChange(city);
    await submit(solar);
    expect(error(solar)).toBe('The solar return could not be computed. Check the details and try again.');
  });

  for (const [name, component] of [['solar return', solar], ['transit', transit]] as const) {
    const dependencies = () => {
      const chart = {
        input: { utc: new Date('2026-01-01T00:00:00Z') },
        bodies: [{ body: 'Sun', lon: 30 }], angles: null, houses: null, engineVersion: 'test',
      };
      harness.compute.mockReturnValue(name === 'solar return' ? { chart } : chart);
      return name === 'solar return'
        ? [{ computeSolarReturn: harness.compute, prepareLocalTime: async () => {} }, { SolarReturnResult: () => null }, { StaticWheel: () => null }]
        : { default: () => null };
    };
    const fill = () => {
      const fields = nodes(render(component)).find((node) => node.type === BirthFields)!.props;
      fields.onDateChange('1990-01-01'); fields.onTimeChange('12:00'); fields.onCityChange(city);
    };

    it(`${name} releases a cancelled access request and protects a newer calculation`, async () => {
      const modules = dependencies();
      let resolve!: (value: unknown) => void;
      const pending = new Promise((done) => { resolve = done; });
      harness.solarImport.mockReturnValueOnce(pending).mockResolvedValue(modules);
      fill();
      const stale = submit(component);
      expect(nodes(render(component)).find((node) => node.type === 'form')!.props['aria-busy']).toBe(true);
      harness.access.current += 1;
      window.dispatchEvent(new Event('zodiacs:profile-access'));
      expect(nodes(render(component)).find((node) => node.type === 'form')!.props['aria-busy']).toBe(false);
      await submit(component);
      expect(harness.compute).toHaveBeenCalledOnce();
      const writes = harness.writes.mock.calls.length;
      resolve(modules);
      await stale;
      expect(harness.writes).toHaveBeenCalledTimes(writes);
      expect(harness.compute).toHaveBeenCalledOnce();
    });

    it(`${name} ignores late failures and stale submit handlers after unmount`, async () => {
      let reject!: (cause: unknown) => void;
      harness.solarImport.mockReturnValue(new Promise((_done, fail) => { reject = fail; }));
      fill();
      const handler = nodes(render(component)).find((node) => node.type === 'form')!.props.onSubmit;
      const stale = handler({ preventDefault() {} });
      harness.effects.forEach((effect) => effect.cleanup?.());
      const writes = harness.writes.mock.calls.length;
      reject(new Error('offline'));
      await stale;
      await handler({ preventDefault() {} });
      expect(harness.solarImport).toHaveBeenCalledOnce();
      expect(harness.writes).toHaveBeenCalledTimes(writes);
      expect(harness.compute).not.toHaveBeenCalled();
    });

    it(`${name} shares the pending request across rapid duplicate submissions`, async () => {
      const modules = dependencies();
      let resolve!: (value: unknown) => void;
      harness.solarImport.mockReturnValue(new Promise((done) => { resolve = done; }));
      fill();
      const handler = nodes(render(component)).find((node) => node.type === 'form')!.props.onSubmit;
      const first = handler({ preventDefault() {} });
      await handler({ preventDefault() {} });
      expect(harness.solarImport).toHaveBeenCalledOnce();
      resolve(modules);
      await first;
      expect(harness.compute).toHaveBeenCalledOnce();
    });
  }
});

describe('event transit ownership', () => {
  const instant = '2026-09-16T08:31:12.865Z';
  const Ring = () => null;
  const chart = {
    bodies: [{ body: 'Sun', lon: 30 }, { body: 'Moon', lon: 100 }],
    angles: { asc: 5, mc: 275 }, houses: { system: 'whole', cusps: Array.from({ length: 12 }, (_, i) => i * 30) },
    engineVersion: 'test', flags: [],
  };
  const ring = () => nodes(render(transit)).find((node) => node.type === Ring)!;
  const fill = () => {
    const fields = nodes(render(transit)).find((node) => node.type === BirthFields)!.props;
    fields.onDateChange('1990-01-01'); fields.onTimeChange('12:00'); fields.onCityChange(city);
  };
  beforeEach(() => {
    Object.defineProperty(window, 'location', { value: { search: `?at=${encodeURIComponent(instant)}` } });
    harness.compute.mockReturnValue(chart);
    harness.solarImport.mockResolvedValue({ default: Ring });
  });

  it('opens the exact event instant and resets state independently for Event date, Now and recalculation', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-06T12:00:00Z'));
    fill();
    await submit(transit);
    const first = ring();
    expect(first.props.nowMs).toBe(Date.parse(instant));
    expect(first.props.eventDate.active).toBe(true);
    first.props.eventDate.onNow();
    const now = ring();
    expect(now.props.nowMs).toBe(Date.now());
    expect(now.props.eventDate.active).toBe(false);
    expect(now.key).not.toBe(first.key);
    now.props.eventDate.onSelect();
    const restored = ring();
    expect(restored.props.nowMs).toBe(Date.parse(instant));
    expect(restored.key).not.toBe(now.key);
    expect(restored.props.natal).toBe(first.props.natal);
    await submit(transit);
    expect(ring().key).not.toBe(restored.key);
    expect(ring().props.nowMs).toBe(Date.parse(instant));
  });

  it('invalidates a completed result immediately when birth details change', async () => {
    fill(); await submit(transit);
    expect(ring()).toBeTruthy();
    nodes(render(transit)).find((node) => node.type === BirthFields)!.props.onDateChange('1991-01-01');
    expect(ring()).toBeUndefined();
    await submit(transit);
    expect(harness.compute.mock.calls.at(-1)![0].utc.getUTCFullYear()).toBe(1991);
    expect(ring().props.nowMs).toBe(Date.parse(instant));
  });

  it('does not let a stale input request publish or clear the newer request busy state', async () => {
    let resolveOld!: (value: unknown) => void;
    let resolveNew!: (value: unknown) => void;
    harness.solarImport.mockReset()
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveNew = resolve; }));
    fill();
    const old = submit(transit);
    nodes(render(transit)).find((node) => node.type === BirthFields)!.props.onDateChange('1992-01-01');
    const current = submit(transit);
    resolveOld({ default: Ring }); await old;
    expect(harness.compute).not.toHaveBeenCalled();
    expect(nodes(render(transit)).find((node) => node.type === 'form')!.props['aria-busy']).toBe(true);
    expect(ring()).toBeUndefined();
    resolveNew({ default: Ring }); await current;
    expect(harness.compute).toHaveBeenCalledOnce();
    expect(harness.compute.mock.calls[0][0].utc.getUTCFullYear()).toBe(1992);
    expect(ring().props.nowMs).toBe(Date.parse(instant));
  });

  it('keeps approximate Moon drawing but excludes precise Moon contacts, angles, houses and calendar export for unknown time', async () => {
    fill();
    nodes(render(transit)).find((node) => node.type === BirthFields)!.props.onTimeKnownChange(false);
    await submit(transit);
    const natal = ring().props.natal;
    expect(harness.compute.mock.calls[0][0].timeKnown).toBe(false);
    expect(natal.bodies.some((body: { body: string }) => body.body === 'Moon')).toBe(true);
    expect(natal.minimal.some((body: { body: string }) => body.body === 'Moon')).toBe(false);
    expect(natal.asc).toBeNull(); expect(natal.mc).toBeNull(); expect(natal.cusps).toBeNull();
    expect(natal.calendarPositions).toBeNull();
    expect(ring().props.nowMs).toBe(Date.parse(instant));
  });

  it('uses a captured saved chart and rejects pending results after the saved profile changes', async () => {
    harness.profile.charts = [{
      id: 'saved-event', name: 'Saved chart', createdAt: instant, updatedAt: instant,
      birth: { date: '1990-01-01', time: null, timeKnown: false, place: null },
      summary: { engineVersion: 'test', utcISO: instant, houseSystem: 'whole',
        bodies: chart.bodies.map((body) => ({ ...body, retrograde: false })), angles: chart.angles, flags: [] },
    }];
    render(transit);
    let resolve!: (value: unknown) => void;
    harness.solarImport.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const old = submit(transit);
    harness.profile.charts[0].summary.bodies[0].lon = 75;
    window.dispatchEvent(new Event('zodiacs:profile'));
    resolve({ default: Ring }); await old;
    expect(ring()).toBeUndefined();
    await submit(transit);
    expect(ring().props.natal.bodies[0].lon).toBe(75);
    expect(ring().props.natal.asc).toBeNull();
    expect(ring().props.natal.minimal.map((body: { body: string }) => body.body)).toEqual(['Sun']);
    expect(ring().props.nowMs).toBe(Date.parse(instant));
  });

  it('explains an invalid date and computes the current sky without event controls', async () => {
    window.location.search = '?at=2026-02-30T12%3A00%3A00Z';
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-06T12:00:00Z'));
    fill(); await submit(transit);
    expect(ring().props.nowMs).toBe(Date.now());
    expect(ring().props.eventDate).toBeUndefined();
    expect(nodes(render(transit)).some((node) => node.props.role === 'status'
      && String(node.props.children).includes('invalid date'))).toBe(true);
  });
});

describe('solar-return result ownership', () => {
  const Result = () => null;
  const returned = () => ({ chart: { input: { utc: new Date('2024-07-06T12:00:00Z') } }, returnYear: 2024 });
  const modules = () => [
    { computeSolarReturn: harness.compute, prepareLocalTime: async () => {} }, { SolarReturnResult: Result }, { StaticWheel: () => null },
  ];
  const fill = () => {
    const fields = nodes(render(solar)).find((node) => node.type === BirthFields)!.props;
    fields.onDateChange('1990-01-01'); fields.onTimeChange('12:00'); fields.onCityChange(city);
  };
  const resultNode = () => nodes(render(solar)).find((node) => node.type === Result);
  const savedChart = (): SavedChart => ({
    id: 'saved-one', name: 'Private name', createdAt: '2026-09-06T00:00:00Z', updatedAt: '2026-09-06T00:00:00Z', birth: { date: '1990-01-01', time: '12:00', timeKnown: true, place: city },
    summary: { engineVersion: 'test', utcISO: '1990-01-01T12:00:00Z', flags: [], angles: null, houseSystem: 'whole', bodies: [{ body: 'Sun', lon: 280, retrograde: false }] },
  });

  it('discards an old draft request and leaves a newer result untouched', async () => {
    let resolve!: (value: unknown) => void;
    harness.compute.mockReturnValue(returned());
    harness.solarImport.mockReturnValueOnce(new Promise((done) => { resolve = done; })).mockResolvedValue(modules());
    fill();
    const stale = submit(solar);
    nodes(render(solar)).find((node) => node.type === BirthFields)!.props.onDateChange('1991-02-03');
    expect(nodes(render(solar)).find((node) => node.type === 'form')!.props['aria-busy']).toBe(false);
    await submit(solar);
    expect(harness.compute).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ birthDate: '1991-02-03' }));
    const current = resultNode();
    const writes = harness.writes.mock.calls.length;
    resolve(modules()); await stale;
    expect(harness.writes).toHaveBeenCalledTimes(writes);
    expect(resultNode()?.key).toBe(current?.key);
    expect(harness.compute).toHaveBeenCalledOnce();
  });

  it('clears completed exports on year/time edits and gives same-instant relocation a new result key', async () => {
    harness.compute.mockReturnValue(returned());
    harness.solarImport.mockResolvedValue(modules());
    fill(); await submit(solar);
    const firstKey = resultNode()!.key;
    const toggle = nodes(render(solar)).find((node) => node.type === 'input' && node.props.type === 'checkbox')!;
    toggle.props.onChange({ target: { checked: true } });
    expect(resultNode()).toBeUndefined();
    const relocated = { ...city, name: 'Paris', lat: 48.8566, lon: 2.3522, tz: 'Europe/Paris' };
    nodes(render(solar)).find((node) => node.type === PlaceSearch)!.props.onSelect(relocated);
    await submit(solar);
    expect(harness.compute).toHaveBeenLastCalledWith(expect.objectContaining({ castLocation: relocated }));
    expect(resultNode()!.key).not.toBe(firstKey);
    nodes(render(solar)).find((node) => node.props.id === 'sr-year-mode')!.props.onChange({ target: { value: 'custom' } });
    expect(resultNode()).toBeUndefined();
    nodes(render(solar)).find((node) => node.props['aria-label'] === 'Custom return year')!.props.onInput({ target: { value: '2025' } });
    await submit(solar);
    expect(harness.compute).toHaveBeenLastCalledWith(expect.objectContaining({ year: 2025 }));
    nodes(render(solar)).find((node) => node.type === BirthFields)!.props.onTimeKnownChange(false);
    expect(resultNode()).toBeUndefined();
    await submit(solar);
    expect(harness.compute).toHaveBeenLastCalledWith(expect.objectContaining({ timeKnown: false, castLocation: city }));
  });

  it('cancels at a saved-chart edit event before an old import can commit', async () => {
    harness.profile.charts = [savedChart()];
    harness.compute.mockReturnValue(returned());
    let resolve!: (value: unknown) => void;
    harness.solarImport.mockReturnValueOnce(new Promise((done) => { resolve = done; })).mockResolvedValue(modules());
    render(solar);
    const stale = submit(solar);
    harness.profile = { ...harness.profile, charts: [{ ...savedChart(), birth: { ...savedChart().birth, date: '1992-03-04' } }] };
    window.dispatchEvent(new Event('zodiacs:profile'));
    resolve(modules()); await stale;
    expect(harness.compute).not.toHaveBeenCalled();
    await submit(solar);
    expect(harness.compute).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ birthDate: '1992-03-04' }));
  });

  it('preserves a result through a rename, then clears a deleted selection and restores manual input', async () => {
    harness.profile.charts = [savedChart()];
    harness.compute.mockReturnValue(returned());
    harness.solarImport.mockResolvedValue(modules());
    render(solar); await submit(solar);
    const key = resultNode()!.key;
    harness.profile = { ...harness.profile, charts: [{ ...savedChart(), name: 'Renamed privately' }] };
    window.dispatchEvent(new Event('zodiacs:profile'));
    expect(resultNode()!.key).toBe(key);
    harness.profile = { ...harness.profile, charts: [] };
    window.dispatchEvent(new Event('zodiacs:profile'));
    expect(resultNode()).toBeUndefined();
    expect(nodes(render(solar)).some((node) => node.type === BirthFields)).toBe(true);
    fill(); await submit(solar);
    expect(resultNode()).toBeDefined();
  });

  it('keeps an edited unknown-time saved chart usable when an unfinished relocation becomes hidden', async () => {
    harness.profile.charts = [savedChart()];
    harness.compute.mockReturnValue(returned());
    harness.solarImport.mockResolvedValue(modules());
    render(solar);
    nodes(render(solar)).find((node) => node.type === 'input' && node.props.type === 'checkbox')!
      .props.onChange({ target: { checked: true } });
    // The button stays reachable; pressing it names the missing return location instead.
    expect(nodes(render(solar)).find((node) => node.props.type === 'submit')!.props.disabled).toBe(false);
    await submit(solar);
    expect(harness.compute).not.toHaveBeenCalled();
    expect(nodes(render(solar)).find((node) => node.type === PlaceSearch)!.props.validationError)
      .toBe('Pick the return location from the list.');
    harness.profile = { ...harness.profile, charts: [{ ...savedChart(), birth: { ...savedChart().birth, time: null, timeKnown: false } }] };
    window.dispatchEvent(new Event('zodiacs:profile'));
    expect(nodes(render(solar)).some((node) => node.type === PlaceSearch)).toBe(false);
    expect(nodes(render(solar)).find((node) => node.props.type === 'submit')!.props.disabled).toBe(false);
    await submit(solar);
    expect(harness.compute).toHaveBeenCalledWith(expect.objectContaining({ timeKnown: false }));
    expect(resultNode()).toBeDefined();
  });
});
