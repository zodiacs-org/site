import type { VNode } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0,
  effects: [] as Array<{ dependencies: unknown[]; cleanup?: () => void }>,
  effectCursor: 0, pending: [] as Array<() => void>,
  writes: vi.fn(), returnsImport: vi.fn(), loadReturns: vi.fn(), lunarImport: vi.fn(),
  access: { current: 0 },
  profile: { version: 1, charts: [], settings: { houseSystem: 'whole' } } as any,
  compute: vi.fn(),
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
    loadModule: () => actual.loadModule(harness.lunarImport),
    createModuleLoader: () => () => harness.loadReturns(),
  };
});

import LunarReturnCalculator from './LunarReturnCalculator';
import { BirthFields } from './BirthFields';
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
const lunar = () => LunarReturnCalculator();
const submit = (component: () => VNode<any>) => nodes(render(component)).find((node) => node.type === 'form')!
  .props.onSubmit({ preventDefault() {} });
const error = (component: () => VNode<any>) => nodes(render(component)).find((node) => node.props.role === 'alert')?.props.children;

beforeEach(async () => {
  harness.slots = []; harness.cursor = 0;
  harness.effects = []; harness.effectCursor = 0; harness.pending = [];
  harness.writes.mockClear(); harness.access.current = 0;
  harness.profile = { version: 1, charts: [], settings: { houseSystem: 'whole' } };
  harness.returnsImport.mockReset(); harness.lunarImport.mockReset();
  harness.compute.mockReset();
  vi.stubGlobal('window', new EventTarget());
  const actual = await vi.importActual<typeof import('../lib/module-load')>('../lib/module-load');
  harness.loadReturns.mockReset().mockImplementation(actual.createModuleLoader(harness.returnsImport));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-01T00:00:00Z'));
});

const Result = () => null;
const returned = () => ({ chart: { input: { utc: new Date('2026-03-20T12:00:00Z') } }, referenceUtc: '2026-03-01T00:00:00.000Z', natalTimeFlags: [], natalLocalMeanTime: false });
const modules = () => [{ computeLunarReturn: harness.compute, prepareLocalTime: async () => {} }, { LunarReturnResult: Result }, { StaticWheel: () => null }];
const fields = () => nodes(render(lunar)).find((node) => node.type === BirthFields)!.props;
const fill = () => { fields().onDateChange('1990-02-01'); fields().onTimeChange('12:00'); fields().onCityChange(city); };
/** Records the ids the form moves focus to (runs the next frame at once). */
const trackFocus = () => {
  const focused: string[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { callback(); return 0; });
  vi.stubGlobal('document', { getElementById: (id: string) => ({ focus: () => focused.push(id) }) });
  return focused;
};
const resultNode = () => nodes(render(lunar)).find((node) => node.type === Result);
const savedChart = () => ({ id: 'private-id', name: 'Private name', birth: { date: '1990-02-01', time: '12:00', timeKnown: true, place: city }, summary: { houseSystem: 'whole', engineVersion: 'old', bodies: [{ body: 'Moon', lon: 999 }] } });
beforeEach(() => { harness.compute.mockReturnValue(returned()); harness.lunarImport.mockResolvedValue(modules()); });
afterEach(() => { harness.effects.forEach((effect) => effect.cleanup?.()); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('lunar calculator reference and source ownership', () => {
  it('captures the reference before imports and retains it across module retry', async () => {
    harness.lunarImport.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(modules());
    fill(); await submit(lunar);
    expect(error(lunar)).toBe(calculationLoadMessage('en'));
    expect(fields().date).toBe('1990-02-01');
    vi.setSystemTime(new Date('2026-03-02T00:00:00Z'));
    await submit(lunar);
    expect(harness.compute).toHaveBeenCalledWith(expect.anything(), new Date('2026-03-01T00:00:00Z'));
    expect(resultNode()).toBeDefined();
    await submit(lunar);
    expect(harness.compute).toHaveBeenLastCalledWith(expect.anything(), new Date('2026-03-02T00:00:00Z'));
  });
  it('retains the reference on calculation failure and resets it after an edit', async () => {
    harness.compute.mockImplementationOnce(() => { throw new RangeError('Check the original birth time.'); }).mockReturnValue(returned());
    fill(); await submit(lunar);
    expect(error(lunar)).toBe('Check the original birth time.');
    vi.setSystemTime(new Date('2026-03-02T00:00:00Z')); await submit(lunar);
    expect(harness.compute).toHaveBeenLastCalledWith(expect.anything(), new Date('2026-03-01T00:00:00Z'));
    fields().onDateChange('1991-02-01'); expect(resultNode()).toBeUndefined(); await submit(lunar);
    expect(harness.compute).toHaveBeenLastCalledWith(expect.objectContaining({ birthDate: '1991-02-01' }), new Date('2026-03-02T00:00:00Z'));
  });
  it('supplies saved original input without cached positions, private names or IDs', async () => {
    harness.profile.charts = [savedChart()]; render(lunar); await submit(lunar);
    expect(harness.compute).toHaveBeenCalledWith({ birthDate: '1990-02-01', birthTime: '12:00', timeKnown: true, birthplace: city, houseSystem: 'whole', castLocation: null }, expect.any(Date));
    const json = JSON.stringify(harness.compute.mock.calls[0][0]);
    expect(json).not.toMatch(/summary|999|Private name|private-id/);
  });
  it.each([
    { timeKnown: false, time: null }, { place: null }, { place: { ...city, tz: '' } },
  ])('blocks incomplete saved birth input %j and offers manual entry', async (invalid) => {
    harness.profile.charts = [{ ...savedChart(), birth: { ...savedChart().birth, ...invalid } }]; render(lunar);
    const view = nodes(render(lunar));
    // The button stays reachable; pressing it moves focus to the note that says what is missing.
    expect(view.find((n) => n.props.type === 'submit')!.props.disabled).toBe(false);
    expect(view.some((n) => n.props['data-lr-incomplete'] !== undefined)).toBe(true);
    expect(view.find((n) => n.props.id === 'lr-incomplete')!.props.tabIndex).toBe(-1);
    const focused = trackFocus();
    await submit(lunar); expect(harness.compute).not.toHaveBeenCalled();
    expect(focused).toEqual(['lr-incomplete']);
    view.find((n) => n.type === 'button' && n.props.children === 'Enter complete birth details')!.props.onClick();
    expect(fields()).toBeDefined();
  });
  it('blocks unknown manual time and removes stale result/actions', async () => {
    fill(); await submit(lunar); expect(resultNode()).toBeDefined();
    fields().onTimeKnownChange(false); expect(resultNode()).toBeUndefined();
    const focused = trackFocus();
    await submit(lunar); expect(harness.compute).toHaveBeenCalledOnce();
    expect(focused).toEqual(['lr-incomplete']);
  });
  it('names each missing manual field and focuses the first one instead of disabling the button', async () => {
    expect(nodes(render(lunar)).find((n) => n.props.type === 'submit')!.props.disabled).toBe(false);
    expect(fields().dateError).toBeUndefined();
    const focused = trackFocus();
    await submit(lunar);
    expect(harness.compute).not.toHaveBeenCalled();
    expect(focused).toEqual(['lr-date']);
    expect(fields()).toMatchObject({
      dateError: 'Enter your birth date.', timeError: 'Enter your birth time.', placeError: 'Pick your birthplace from the list.',
    });
    fields().onDateChange('2000-01-01');
    expect(fields().dateError).toBeUndefined();
    expect(fields().timeError).toBe('Enter your birth time.');
  });
  it('names a missing return location when casting for a different place', async () => {
    fill(); render(lunar);
    nodes(render(lunar)).find((n) => n.type === 'input' && n.props.type === 'checkbox')!.props.onChange({ currentTarget: { checked: true } });
    const focused = trackFocus();
    await submit(lunar);
    expect(harness.compute).not.toHaveBeenCalled();
    expect(focused).toEqual(['lr-cast-place']);
    expect(nodes(render(lunar)).find((n) => n.type === PlaceSearch && n.props.id === 'lr-cast-place')!.props.validationError)
      .toBe('Pick the return location from the list.');
  });
  it('invalidates relocation immediately and gives the recast result its own lifetime', async () => {
    fill(); await submit(lunar); const key = resultNode()!.key;
    nodes(render(lunar)).find((n) => n.type === 'input' && n.props.type === 'checkbox')!.props.onChange({ currentTarget: { checked: true } });
    expect(resultNode()).toBeUndefined();
    nodes(render(lunar)).find((n) => n.type === PlaceSearch)!.props.onSelect({ ...city, name: 'Paris', lat: 48.85, lon: 2.35 });
    await submit(lunar); expect(resultNode()!.key).not.toBe(key);
  });
  it('ignores a stale module completion after input change without altering a newer result', async () => {
    let resolve!: (value: unknown) => void;
    harness.lunarImport.mockReturnValueOnce(new Promise((done) => { resolve = done; })).mockResolvedValue(modules());
    fill(); const stale = submit(lunar); fields().onDateChange('1991-03-04'); await submit(lunar);
    const key = resultNode()!.key; const writes = harness.writes.mock.calls.length;
    resolve(modules()); await stale;
    expect(harness.writes).toHaveBeenCalledTimes(writes); expect(resultNode()!.key).toBe(key); expect(harness.compute).toHaveBeenCalledOnce();
  });
  it('preserves rename, ignores summary-position churn, and clears a deleted chart', async () => {
    harness.profile.charts = [savedChart()]; render(lunar); await submit(lunar); const key = resultNode()!.key;
    harness.profile.charts = [{ ...savedChart(), name: 'Renamed', summary: { ...savedChart().summary, bodies: [] } }];
    window.dispatchEvent(new Event('zodiacs:profile')); expect(resultNode()!.key).toBe(key);
    harness.profile.charts = []; window.dispatchEvent(new Event('zodiacs:profile')); expect(resultNode()).toBeUndefined(); expect(fields()).toBeDefined();
  });
  it('cancels a pending saved request synchronously when original birth input changes', async () => {
    let resolve!: (value: unknown) => void;
    harness.lunarImport.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    harness.profile.charts = [savedChart()]; render(lunar); const stale = submit(lunar);
    harness.profile.charts = [{ ...savedChart(), birth: { ...savedChart().birth, time: '13:00' } }];
    window.dispatchEvent(new Event('zodiacs:profile')); resolve(modules()); await stale;
    expect(harness.compute).not.toHaveBeenCalled();
    expect(nodes(render(lunar)).find((n) => n.type === 'form')!.props['aria-busy']).toBe(false);
  });
  it('clears completed results on an access event even when profile inputs are unchanged', async () => {
    fill(); await submit(lunar); harness.access.current += 1;
    window.dispatchEvent(new Event('zodiacs:profile-access')); expect(resultNode()).toBeUndefined();
    await submit(lunar); expect(resultNode()).toBeDefined();
  });
  it('releases cancelled access work and protects a newer calculation', async () => {
    let resolve!: (value: unknown) => void;
    harness.lunarImport.mockReturnValueOnce(new Promise((done) => { resolve = done; })).mockResolvedValue(modules());
    fill(); const stale = submit(lunar); harness.access.current += 1; window.dispatchEvent(new Event('zodiacs:profile-access'));
    expect(nodes(render(lunar)).find((n) => n.type === 'form')!.props['aria-busy']).toBe(false);
    await submit(lunar); const writes = harness.writes.mock.calls.length; resolve(modules()); await stale;
    expect(harness.writes).toHaveBeenCalledTimes(writes); expect(harness.compute).toHaveBeenCalledOnce();
  });
  it('ignores late failure and stale submit after unmount', async () => {
    let reject!: (cause: unknown) => void;
    harness.lunarImport.mockReturnValue(new Promise((_done, fail) => { reject = fail; }));
    fill(); const handler = nodes(render(lunar)).find((n) => n.type === 'form')!.props.onSubmit;
    const pending = handler({ preventDefault() {} }); harness.effects.forEach((effect) => effect.cleanup?.());
    const writes = harness.writes.mock.calls.length; reject(new Error('late failure')); await pending; await handler({ preventDefault() {} });
    expect(harness.writes).toHaveBeenCalledTimes(writes); expect(harness.lunarImport).toHaveBeenCalledOnce();
  });
  it('shares one pending request across rapid duplicate submissions', async () => {
    let resolve!: (value: unknown) => void;
    harness.lunarImport.mockReturnValue(new Promise((done) => { resolve = done; }));
    fill(); const one = submit(lunar); await submit(lunar); expect(harness.lunarImport).toHaveBeenCalledOnce();
    resolve(modules()); await one; expect(harness.compute).toHaveBeenCalledOnce();
  });
});
