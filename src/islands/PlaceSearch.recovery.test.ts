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
  wholeSearch: vi.fn(),
  wholePreload: vi.fn(),
  load: vi.fn(),
}));

vi.mock('../lib/geo/search', () => ({ searchCities: harness.search, preloadIndex: harness.preload, searchWholeIndex: harness.wholeSearch, preloadWholeIndex: harness.wholePreload }));
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
function render(selected: City | null = null, deferEffects = false, wholeIndex = false) {
  harness.cursor = 0;
  harness.effectCursor = 0;
  const view = PlaceSearch({ onSelect, selected, ...(wholeIndex ? { wholeIndex } : {}) });
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
  harness.wholeSearch.mockReset();
  harness.wholePreload.mockReset().mockResolvedValue({});
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

  it('with distinctLabels, shows each same-named option with its coordinates and keeps them on the choice; without it, options read as before', async () => {
    const udaipur: City = { name: 'Udaipur', admin1: 'Rajasthan', country: 'India', lat: 24.59, lon: 73.71, tz: 'Asia/Kolkata', pop: 451100 };
    const tripura: City = { name: 'Udaipur', admin1: 'Tripura', country: 'India', lat: 23.53, lon: 91.48, tz: 'Asia/Kolkata', pop: 32758 };
    const shekhawati: City = { name: 'Udaipur', admin1: 'Rajasthan', country: 'India', lat: 27.72, lon: 75.47, tz: 'Asia/Kolkata', pop: 30264 };
    harness.wholeSearch.mockResolvedValue([udaipur, tripura, shekhawati]);
    const view = (selected: City | null, distinctLabels: boolean) => {
      harness.cursor = 0;
      harness.effectCursor = 0;
      const rendered = PlaceSearch({ onSelect, selected, wholeIndex: true, ...(distinctLabels ? { distinctLabels } : {}) });
      flushEffects();
      return nodes(rendered);
    };
    const text = (node: VNode<Record<string, any>>) => nodes(node.props.children).filter((child) => child.type === 'span').map((child) => [child.props.children].flat().join('')).join(' | ');
    view(null, true).find((node) => node.props.role === 'combobox')!.props.onInput({ target: { value: 'Udaipur' } });
    await vi.advanceTimersByTimeAsync(120);
    await vi.dynamicImportSettled();
    await flush();
    const options = view(null, true).filter((node) => node.props.role === 'option');
    expect(options.map(text)).toEqual([
      'Udaipur | Rajasthan, India (24.59° N, 73.71° E)',
      'Udaipur | Tripura, India',
      'Udaipur | Rajasthan, India (27.72° N, 75.47° E)',
    ]);
    const items = view(null, true).filter((node) => node.type === 'li' && node.props.role === 'none');
    const ids = items.map((node) => node.props['data-place-id']);
    expect(ids.every((id) => /^p[0-9a-z]{11}$/u.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(3);
    expect(items.map((node) => node.key)).toEqual(ids);
    // The chosen Udaipur keeps the coordinates that told it apart.
    options[2].props.onClick();
    expect(onSelect).toHaveBeenLastCalledWith(shekhawati);
    const chip = view(shekhawati, true).find((node) => node.type === 'input')!;
    expect(chip.props.value).toBe('Udaipur · Rajasthan, India (27.72° N, 75.47° E)');
    // Off (every other page): the same options and chip as before, with no coordinates and no place id.
    harness.slots = [];
    view(null, false).find((node) => node.props.role === 'combobox')!.props.onInput({ target: { value: 'Udaipur' } });
    await vi.advanceTimersByTimeAsync(120);
    await flush();
    const plain = view(null, false);
    expect(plain.filter((node) => node.props.role === 'option').map(text)).toEqual(['Udaipur | Rajasthan, India', 'Udaipur | Tripura, India', 'Udaipur | Rajasthan, India']);
    expect(plain.filter((node) => node.type === 'li').every((node) => node.props['data-place-id'] === undefined)).toBe(true);
    expect(view(shekhawati, false).find((node) => node.type === 'input')!.props.value).toBe('Udaipur · Rajasthan, India');
  });

  it('with wholeIndex, loads the whole index on focus and searches it, never the letter-by-letter search', async () => {
    harness.wholeSearch.mockResolvedValue([paris]);
    const input = nodes(render(null, false, true)).find((node) => node.props.role === 'combobox')!;
    input.props.onFocus();
    await vi.dynamicImportSettled();
    expect(harness.wholePreload).toHaveBeenCalledOnce();
    input.props.onInput({ target: { value: 'Paris' } });
    await vi.advanceTimersByTimeAsync(120);
    expect(harness.wholeSearch).toHaveBeenCalledWith('Paris');
    expect(harness.search).not.toHaveBeenCalled();
    expect(harness.preload).not.toHaveBeenCalled();
    expect(nodes(render(null, false, true)).some((node) => node.type === 'button' && node.props.role === 'option')).toBe(true);
  });
});
