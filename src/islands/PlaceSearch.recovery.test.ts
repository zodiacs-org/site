import type { VNode } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { City } from '../lib/geo/search';

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as Array<{ dependencies?: unknown[]; cleanup?: () => void }>,
  effectCursor: 0,
  pending: [] as Array<() => void>,
  writes: vi.fn(),
  search: vi.fn(),
  preload: vi.fn(),
  load: vi.fn(),
}));

vi.mock('../lib/geo/search', () => ({ searchCities: harness.search, preloadIndex: harness.preload }));
vi.mock('../lib/module-load', async (importOriginal) => ({
  ...await importOriginal<object>(),
  loadModule: (load: () => Promise<unknown>) => harness.load(load),
}));
vi.mock('preact/hooks', () => ({
  useState: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = initial;
    return [harness.slots[slot], (value: unknown) => {
      harness.writes(slot, value);
      harness.slots[slot] = typeof value === 'function' ? value(harness.slots[slot]) : value;
    }];
  },
  useRef: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = { current: initial };
    return harness.slots[slot];
  },
  useEffect: (effect: () => void | (() => void), dependencies: unknown[]) => {
    const index = harness.effectCursor++;
    const prior = harness.effects[index];
    if (prior?.dependencies && dependencies.every((value, i) => Object.is(value, prior.dependencies![i]))) return;
    harness.pending.push(() => {
      prior?.cleanup?.();
      const cleanup = effect();
      harness.effects[index] = { dependencies, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
    });
  },
}));

import PlaceSearch from './PlaceSearch';
import CalculationReload, { calculationLoadMessage } from './CalculationReload';
import { ModuleLoadError } from '../lib/module-load';

const paris: City = { name: 'Paris', admin1: '', country: 'France', lat: 48.86, lon: 2.35, tz: 'Europe/Paris', pop: 2000000 };
const onSelect = vi.fn();
const flushEffects = () => harness.pending.splice(0).forEach((run) => run());
function render(selected: City | null = null, deferEffects = false) {
  harness.cursor = 0;
  harness.effectCursor = 0;
  const view = PlaceSearch({ onSelect, selected });
  if (!deferEffects) flushEffects();
  return view;
}
function nodes(value: unknown): VNode<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as VNode<Record<string, any>>;
  return [node, ...nodes(node.props.children)];
}
function query(value: string) {
  const input = nodes(render()).find((node) => node.props.role === 'combobox')!;
  input.props.onInput({ target: { value } });
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

beforeEach(() => {
  vi.useFakeTimers();
  harness.slots = [];
  harness.cursor = 0;
  harness.effects = [];
  harness.effectCursor = 0;
  harness.pending = [];
  harness.writes.mockClear();
  harness.search.mockReset();
  harness.preload.mockReset().mockResolvedValue({});
  harness.load.mockReset().mockImplementation((load: () => Promise<unknown>) => load());
  onSelect.mockClear();
});
afterEach(() => {
  harness.effects.forEach((effect) => effect.cleanup?.());
  vi.useRealTimers();
});

describe('birthplace search recovery and request ownership', () => {
  it('leaves the search code unloaded until the field is used', async () => {
    const input = nodes(render()).find((node) => node.props.role === 'combobox')!;
    expect(harness.load).not.toHaveBeenCalled();
    input.props.onFocus();
    await vi.dynamicImportSettled();
    expect(harness.load).toHaveBeenCalledOnce();
    expect(harness.preload).toHaveBeenCalledOnce();
    expect(harness.search).not.toHaveBeenCalled();
  });

  it('distinguishes missing search code from an empty index and offers reload', async () => {
    harness.load.mockRejectedValueOnce(new ModuleLoadError('offline'));
    query('Paris');
    await vi.advanceTimersByTimeAsync(120);
    const view = nodes(render());
    const alert = view.find((node) => node.props.role === 'alert')!;
    expect(alert.props.children).toBe(calculationLoadMessage('en'));
    const recovery = view.find((node) => node.type === CalculationReload)!;
    expect(CalculationReload({ error: recovery.props.error, locale: recovery.props.locale })).not.toBeNull();
    expect(view.some((node) => node.props.role === 'listbox')).toBe(false);
    expect(harness.search).not.toHaveBeenCalled();
  });

  it('announces loading, offers retry after failure, then exposes successful options', async () => {
    harness.search.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([paris]);
    query('Paris');
    expect(nodes(render()).some((node) => node.props.role === 'status')).toBe(true);
    await vi.advanceTimersByTimeAsync(120);
    let view = nodes(render());
    expect(view.some((node) => node.props.role === 'alert')).toBe(true);
    expect(view.some((node) => node.props.role === 'listbox')).toBe(false);
    const input = view.find((node) => node.props.role === 'combobox')!;
    const focus = vi.fn();
    (input.ref as { current: unknown }).current = { focus };
    const retry = view.find((node) => node.type === 'button' && node.props.children === 'Try again')!;
    retry.props.onClick();
    expect(focus).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(120);
    view = nodes(render());
    expect(view.some((node) => node.props.role === 'alert')).toBe(false);
    expect(view.some((node) => node.props.role === 'option' && node.type === 'button')).toBe(true);
    expect(harness.search).toHaveBeenNthCalledWith(2, 'Paris');
  });

  it('shows the no-results guidance only after a successful empty search', async () => {
    harness.search.mockResolvedValue([]);
    query('Paris');
    await vi.advanceTimersByTimeAsync(120);
    const view = nodes(render());
    expect(view.some((node) => node.props.role === 'option' && node.props['aria-disabled'] === true)).toBe(true);
    expect(view.some((node) => node.props.role === 'alert')).toBe(false);
  });

  it('ignores a stale result after the query changes', async () => {
    let resolve!: (cities: City[]) => void;
    harness.search.mockImplementationOnce(() => new Promise<City[]>((done) => { resolve = done; })).mockResolvedValueOnce([]);
    query('Paris');
    await vi.advanceTimersByTimeAsync(120);
    query('Prague');
    await vi.advanceTimersByTimeAsync(120);
    const writesBeforeOldResult = harness.writes.mock.calls.length;
    resolve([paris]);
    await flush();
    expect(harness.writes).toHaveBeenCalledTimes(writesBeforeOldResult);
    expect(nodes(render()).some((node) => node.type === 'button' && node.props.role === 'option')).toBe(false);
  });

  it('clears a pending debounce on unmount', async () => {
    query('Paris');
    harness.effects.forEach((effect) => effect.cleanup?.());
    await vi.advanceTimersByTimeAsync(120);
    expect(harness.search).not.toHaveBeenCalled();
  });

  it('does not start a city request after a late code load on an unmounted field', async () => {
    let resolve!: (value: unknown) => void;
    harness.load.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    query('Paris');
    await vi.advanceTimersByTimeAsync(120);
    harness.effects.forEach((effect) => effect.cleanup?.());
    const writesBeforeUnmount = harness.writes.mock.calls.length;
    resolve({ searchCities: harness.search });
    await flush();
    expect(harness.search).not.toHaveBeenCalled();
    expect(harness.writes).toHaveBeenCalledTimes(writesBeforeUnmount);
  });

  it.each(['resolve', 'reject'])('suppresses a late %s after unmount', async (outcome) => {
    let resolve!: (cities: City[]) => void;
    let reject!: (reason: unknown) => void;
    harness.search.mockImplementationOnce(() => new Promise<City[]>((done, fail) => { resolve = done; reject = fail; }));
    query('Paris');
    await vi.advanceTimersByTimeAsync(120);
    harness.effects.forEach((effect) => effect.cleanup?.());
    const writesBeforeUnmount = harness.writes.mock.calls.length;
    if (outcome === 'resolve') resolve([paris]);
    else reject(new Error('offline'));
    await flush();
    expect(harness.writes).toHaveBeenCalledTimes(writesBeforeUnmount);
  });

  it('invalidates the query when an external chart supplies a selected birthplace', async () => {
    let resolve!: (cities: City[]) => void;
    harness.search.mockImplementationOnce(() => new Promise<City[]>((done) => { resolve = done; }));
    query('Paris');
    await vi.advanceTimersByTimeAsync(120);
    render(paris);
    const writesBeforeOldResult = harness.writes.mock.calls.length;
    resolve([paris]);
    await flush();
    expect(harness.writes).toHaveBeenCalledTimes(writesBeforeOldResult);
  });

  it('keeps a fast Change→typing query when passive effects run after the input event', async () => {
    harness.search.mockResolvedValue([paris]);
    render(paris);
    // The selected chip has been replaced with the editable input, but this
    // render's passive effects have not run yet. This is a real browser gap.
    const editable = nodes(render(null, true)).find((node) => node.props.role === 'combobox')!;
    editable.props.onInput({ target: { value: 'Paris' } });
    expect(harness.pending.length).toBeGreaterThan(0);
    flushEffects();
    await vi.advanceTimersByTimeAsync(120);
    expect(harness.search).toHaveBeenCalledWith('Paris');
    const view = nodes(render());
    expect(view.some((node) => node.props.role === 'status')).toBe(false);
    expect(view.some((node) => node.type === 'button' && node.props.role === 'option')).toBe(true);
  });

  it('returns focus to the search field after "Change birthplace" removes the chip', () => {
    const clear = nodes(render(paris)).find((node) => node.type === 'button' && node.props.class === 'place__clear')!;
    clear.props.onClick();
    expect(onSelect).toHaveBeenLastCalledWith(null);
    const focus = vi.fn();
    const combobox = nodes(render(null, true)).find((node) => node.props.role === 'combobox')!;
    (combobox.ref as { current: unknown }).current = { focus };
    flushEffects();
    expect(focus).toHaveBeenCalledOnce();
    // A later render without a clear leaves focus where the reader put it.
    render(paris);
    render(null);
    expect(focus).toHaveBeenCalledOnce();
  });

  it('reads the help under the field after the pick hint or error, in both states', () => {
    const describe = (selected: City | null, validationError?: string) => {
      harness.cursor = 0;
      harness.effectCursor = 0;
      const view = nodes(PlaceSearch({ onSelect, selected, id: 'p', describedBy: 'p-help', validationError }));
      flushEffects();
      return view.find((node) => node.type === 'input')!.props['aria-describedby'];
    };
    expect(describe(null)).toBe('p-help');
    expect(describe(null, 'Pick your birthplace from the list.')).toBe('p-pick-hint p-help');
    expect(describe(paris)).toBe('p-help');
  });
});
