import { SHARING_COPY } from '../lib/sharing/copy';
import type { VNode } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { City } from '../lib/geo/search';
import type { Chart } from '../lib/engine/types';
import type { PreparedChartCard } from '../lib/share-card';

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as Array<{ dependencies: unknown[]; cleanup?: () => void }>,
  effectCursor: 0,
  writes: vi.fn(),
  loadEngine: vi.fn(),
  computeChart: vi.fn(),
  loadCard: vi.fn(),
  prepare: vi.fn(),
  save: vi.fn(),
  track: vi.fn(),
}));

vi.mock('../lib/geo/search', () => ({ preloadIndex: vi.fn().mockResolvedValue({}) }));
vi.mock('../lib/hooks/useEngine', () => ({ useEngine: () => harness.loadEngine }));
vi.mock('../lib/share-card', () => ({ prepareBigThreeCard: harness.prepare, savePreparedChartCard: harness.save }));
vi.mock('../lib/module-load', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/module-load')>();
  return { ...original, loadModule: (load: () => Promise<unknown>) => original.loadModule(() => harness.loadCard(load)) };
});
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
    if (prior && dependencies.every((value, i) => Object.is(value, prior.dependencies[i]))) return;
    prior?.cleanup?.();
    const cleanup = effect();
    harness.effects[index] = { dependencies, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
  },
}));

import BigThreeQuick from './BigThreeQuick';
import { BirthFields } from './BirthFields';
import CalculationReload, { calculationLoadMessage } from './CalculationReload';
import { ModuleLoadError } from '../lib/module-load';

const paris: City = { name: 'Paris', admin1: '', country: 'France', lat: 48.86, lon: 2.35, tz: 'Europe/Paris', pop: 2000000 };
const chart = {
  input: { utc: new Date('1989-12-12T12:00:00Z'), timeKnown: true },
  bodies: [{ body: 'Sun', lon: 261 }, { body: 'Moon', lon: 42 }],
  angles: { asc: 120, mc: 30 },
  engineVersion: 'test',
} as Chart;
const prepared: PreparedChartCard = { blob: new Blob(['card']), filename: 'big-three.png' };

function render() {
  harness.cursor = 0;
  harness.effectCursor = 0;
  return BigThreeQuick({ copy: SHARING_COPY.en });
}
function nodes(value: unknown): VNode<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as VNode<Record<string, any>>;
  return [node, ...nodes(node.props.children)];
}
function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join('');
  if (value && typeof value === 'object' && 'props' in value) return text((value as VNode).props.children);
  return typeof value === 'string' ? value : '';
}
const find = (attribute: string) => nodes(render()).find((node) => attribute in node.props)!;
const alerts = () => nodes(render()).filter((node) => node.props.role === 'alert').map(text).join(' ');
function fill(date = '1989-12-20') {
  const fields = nodes(render()).find((node) => node.type === BirthFields)!;
  fields.props.onDateChange(date);
  fields.props.onTimeChange('11:30');
  fields.props.onCityChange(paris);
}
function submit(): Promise<void> {
  return nodes(render()).find((node) => node.type === 'form')!.props.onSubmit({ preventDefault: vi.fn() });
}
async function settle() {
  await vi.dynamicImportSettled();
  await Promise.resolve();
  await Promise.resolve();
}
const unmount = () => harness.effects.forEach((effect) => effect.cleanup?.());
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  harness.slots = [];
  harness.cursor = 0;
  harness.effects = [];
  harness.effectCursor = 0;
  harness.writes.mockClear();
  harness.loadEngine.mockReset().mockResolvedValue({ computeChart: harness.computeChart });
  harness.computeChart.mockReset().mockReturnValue(chart);
  harness.loadCard.mockReset().mockImplementation((load: () => Promise<unknown>) => load());
  harness.prepare.mockReset().mockResolvedValue(prepared);
  harness.save.mockReset().mockResolvedValue('shared');
  harness.track.mockReset();
  vi.stubGlobal('window', { zodiacsAnalytics: { track: harness.track } });
  vi.stubGlobal('requestAnimationFrame', vi.fn());
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }));
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });

describe('Big Three optional card recovery', () => {
  it('makes the valid result available and ends computing while its card is still preparing', async () => {
    const pending = deferred<PreparedChartCard>();
    harness.prepare.mockReturnValueOnce(pending.promise);
    fill();
    await submit();
    await settle();
    expect(find('data-big-three-result')).toBeDefined();
    expect(find('data-big-three-full').props.href).toMatch(/^\/birth-chart\/#/);
    expect(find('data-big-three-submit').props.disabled).toBe(false);
    expect(find('data-big-three-share').props.disabled).toBe(true);
    expect(text(find('data-big-three-share'))).toContain('Preparing your card');
    pending.resolve(prepared);
    await settle();
    expect(find('data-big-three-share').props.disabled).toBe(false);
  });

  it('preserves placements and handoff after renderer failure and retries the same chart without recomputing', async () => {
    harness.prepare.mockRejectedValueOnce(new RangeError('canvas failed'));
    fill();
    await submit();
    const href = find('data-big-three-full').props.href;
    await settle();
    expect(find('data-big-three-result')).toBeDefined();
    expect(find('data-big-three-full').props.href).toBe(href);
    expect(alerts()).toContain('The card could not be prepared or saved');
    expect(alerts()).not.toContain('date or time');
    const retry = find('data-big-three-share');
    expect(retry.props.disabled).toBe(false);
    expect(text(retry)).toContain('Try again');
    retry.props.onClick();
    await settle();
    expect(harness.computeChart).toHaveBeenCalledOnce();
    expect(harness.prepare).toHaveBeenCalledTimes(2);
    expect(harness.prepare.mock.calls[1]).toEqual(harness.prepare.mock.calls[0]);
    expect(find('data-big-three-full').props.href).toBe(href);
    expect(alerts()).toBe('');
    expect(find('data-big-three-share').props.disabled).toBe(false);
  });

  it('clears results and rejects the old share action as soon as the form changes', async () => {
    fill(); await submit(); await settle();
    const share = find('data-big-three-share');
    fill('1990-01-01');
    expect(find('data-big-three-result')).toBeUndefined();
    share.props.onClick(); await settle();
    expect(harness.save).not.toHaveBeenCalled();
    expect(harness.computeChart).toHaveBeenCalledOnce();
  });

  it('wraps missing card code as a module failure, keeps the chart, and offers retry plus explicit reload', async () => {
    harness.loadCard.mockRejectedValueOnce(new TypeError('chunk unavailable'));
    fill();
    await submit();
    await settle();
    expect(find('data-big-three-result')).toBeDefined();
    expect(alerts()).toContain(calculationLoadMessage('en'));
    const recovery = nodes(render()).find((node) => node.type === CalculationReload && node.props.error)!;
    expect(CalculationReload({ error: recovery.props.error, locale: recovery.props.locale })).not.toBeNull();
    expect(harness.prepare).not.toHaveBeenCalled();
    find('data-big-three-share').props.onClick();
    await settle();
    expect(harness.computeChart).toHaveBeenCalledOnce();
    expect(harness.prepare).toHaveBeenCalledOnce();
    expect(alerts()).toBe('');
  });

  it.each(['reject', 'throw'])('allows another share without rendering or computing again after a %s', async (failure) => {
    if (failure === 'reject') harness.save.mockRejectedValueOnce(new Error('download blocked'));
    else harness.save.mockImplementationOnce(() => { throw new Error('save failed'); });
    fill();
    await submit();
    await settle();
    find('data-big-three-share').props.onClick();
    // The prepared save is called within the click, before any await.
    expect(harness.save).toHaveBeenCalledOnce();
    await settle();
    expect(find('data-big-three-result')).toBeDefined();
    expect(alerts()).toContain('could not be prepared or saved');
    const retry = find('data-big-three-share');
    expect(retry.props.disabled).toBe(false);
    retry.props.onClick();
    expect(harness.save).toHaveBeenCalledTimes(2);
    await settle();
    expect(harness.prepare).toHaveBeenCalledOnce();
    expect(harness.computeChart).toHaveBeenCalledOnce();
    expect(alerts()).toBe('');
    expect(text(find('data-big-three-share'))).toContain('Shared');
  });

  it('keeps a cancelled share available without showing an error', async () => {
    harness.save.mockResolvedValueOnce('cancelled');
    fill();
    await submit();
    await settle();
    find('data-big-three-share').props.onClick();
    await settle();
    expect(alerts()).toBe('');
    expect(find('data-big-three-share').props.disabled).toBe(false);
    expect(text(find('data-big-three-share'))).toContain('Share your big three');
  });

  it.each(['new chart', 'unmount'])('does not start card rendering after a late import following %s', async (boundary) => {
    const pending = deferred<unknown>();
    harness.loadCard.mockReturnValueOnce(pending.promise);
    fill();
    await submit();
    if (boundary === 'new chart') { fill('1990-01-01'); await submit(); await settle(); }
    else unmount();
    const writes = harness.writes.mock.calls.length;
    const renders = harness.prepare.mock.calls.length;
    pending.resolve({ prepareBigThreeCard: harness.prepare });
    await settle();
    expect(harness.writes).toHaveBeenCalledTimes(writes);
    expect(harness.prepare).toHaveBeenCalledTimes(renders);
  });

  it.each([
    ['new chart', 'resolve'], ['new chart', 'reject'], ['unmount', 'resolve'], ['unmount', 'reject'],
  ])('ignores late card-render %s / %s', async (boundary, outcome) => {
    const pending = deferred<PreparedChartCard>();
    harness.prepare.mockReturnValueOnce(pending.promise);
    fill();
    await submit();
    await settle();
    if (boundary === 'new chart') { fill('1990-01-01'); await submit(); await settle(); }
    else unmount();
    const writes = harness.writes.mock.calls.length;
    if (outcome === 'resolve') pending.resolve(prepared);
    else pending.reject(new Error('late render failure'));
    await settle();
    expect(harness.writes).toHaveBeenCalledTimes(writes);
  });

  it.each([
    ['new chart', 'resolve'], ['new chart', 'reject'], ['unmount', 'resolve'], ['unmount', 'reject'],
  ])('ignores late share completion %s / %s', async (boundary, outcome) => {
    const pending = deferred<string>();
    harness.save.mockReturnValueOnce(pending.promise);
    fill();
    await submit();
    await settle();
    find('data-big-three-share').props.onClick();
    expect(find('data-big-three-share').props.disabled).toBe(true);
    if (boundary === 'new chart') { fill('1990-01-01'); await submit(); await settle(); }
    else unmount();
    const writes = harness.writes.mock.calls.length;
    if (outcome === 'resolve') pending.resolve('shared');
    else pending.reject(new Error('late save failure'));
    await settle();
    expect(harness.writes).toHaveBeenCalledTimes(writes);
    expect(harness.track).not.toHaveBeenCalledWith('share_card_downloaded', expect.anything());
  });

  it('rejects an old share handler after another chart becomes current', async () => {
    fill();
    await submit();
    await settle();
    const oldShare = find('data-big-three-share').props.onClick;
    fill('1990-01-01');
    await submit();
    await settle();
    oldShare();
    expect(harness.save).not.toHaveBeenCalled();
  });

  it('retains calculation failure recovery without attempting an optional card', async () => {
    harness.loadEngine.mockRejectedValueOnce(new ModuleLoadError('engine missing'));
    fill();
    await submit();
    await settle();
    expect(find('data-big-three-result')).toBeUndefined();
    expect(alerts()).toContain(calculationLoadMessage('en'));
    expect(harness.loadCard).not.toHaveBeenCalled();
    expect(find('data-big-three-submit').props.disabled).toBe(false);
  });
});
