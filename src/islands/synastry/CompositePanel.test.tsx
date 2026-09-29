import type { VNode } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0,
  effects: [] as Array<{ dependencies: unknown[]; cleanup?: () => void }>,
  effectCursor: 0, pending: [] as Array<() => void>, writes: vi.fn(),
  importCard: vi.fn(), prepare: vi.fn(), share: vi.fn(), download: vi.fn(),
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
// Control the dependency boundary; the shared loader's caching/eviction has its own tests.
vi.mock('../../lib/module-load', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/module-load')>();
  return { ...actual, createModuleLoader: () => () => actual.loadModule(harness.importCard) };
});
import { CompositePanel } from './CompositePanel';
import AspectPatternFeature from '../aspect-patterns/AspectPatternFeature';
import { buildAspectPatternModel, selectedPatternCard } from '../../lib/aspect-pattern-model';
import CalculationReload, { calculationLoadMessage } from '../CalculationReload';
import { COMPOSITE_COPY } from './compositeCopy';
import { buildCompositeTabData, compositeAspectId, compositeBodyId } from './relationshipData';

const points = [{ body: 'Sun', lon: 0 }, { body: 'Moon', lon: 120 }, { body: 'Venus', lon: 60 }];
const data = buildCompositeTabData(points, points, { aTimeKnown: true, bTimeKnown: true });
const prepared = { blob: new Blob(['png'], { type: 'image/png' }), filename: 'zodiacs-composite.png' };
const module = { prepareCompositeCard: harness.prepare, shareCompositeCard: harness.share, downloadCompositeCard: harness.download };
const selected = vi.fn();
let props: Parameters<typeof CompositePanel>[0];
function render(changes: Partial<typeof props> = {}) {
  props = { ...props, ...changes };
  harness.cursor = 0; harness.effectCursor = 0;
  const view = CompositePanel(props);
  harness.pending.splice(0).forEach((effect) => effect());
  return view;
}
function nodes(value: unknown): VNode<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as VNode<Record<string, any>>;
  return [node, ...nodes(node.props.children)];
}
function find(hook: string, view = render()) {
  const result = nodes(view).find((node) => Object.hasOwn(node.props, hook));
  if (!result) throw new Error(`Missing ${hook}`);
  return result;
}
function strings(value: unknown): string {
  if (Array.isArray(value)) return value.map(strings).join(' ');
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && 'props' in value) return strings((value as VNode).props.children);
  return '';
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (value: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const unmount = () => harness.effects.forEach((effect) => effect.cleanup?.());
beforeEach(() => {
  harness.slots = []; harness.effects = []; harness.pending = [];
  harness.writes.mockClear(); harness.importCard.mockReset().mockResolvedValue(module);
  harness.prepare.mockReset().mockResolvedValue(prepared);
  harness.share.mockReset().mockResolvedValue('shared'); harness.download.mockReset().mockResolvedValue('downloaded');
  selected.mockReset();
  props = { locale: 'en', data, sourceKey: 'first pair', sourceTimesKnown: true, selectedId: null, onSelect: selected };
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:composite');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});
afterEach(() => { unmount(); vi.restoreAllMocks(); });

describe('composite selection and uncertainty', () => {
  it.each([false, true].flatMap(sourceTimesKnown => [false, true].map(hasMoon => ({ sourceTimesKnown, hasMoon }))))(
    'keeps pattern reading/export tied to source times ($sourceTimesKnown), with Moon present: $hasMoon',
    ({ sourceTimesKnown, hasMoon }) => {
      const cross = [
        { body: 'Mercury', lon: 0 }, { body: 'Venus', lon: 90 },
        { body: 'Mars', lon: 180 }, { body: 'Jupiter', lon: 270 },
        ...(hasMoon ? [{ body: 'Moon', lon: 45 }] : []),
      ];
      const partial = buildCompositeTabData(cross, cross, { aTimeKnown: sourceTimesKnown, bTimeKnown: true });
      const view = render({ data: partial, sourceTimesKnown });
      const feature = nodes(view).find(node => node.type === AspectPatternFeature)!;
      expect(partial.moonProvisional).toBe(hasMoon && !sourceTimesKnown);
      expect(feature.props.timeKnown).toBe(sourceTimesKnown);
      const model = buildAspectPatternModel(feature.props as unknown as Parameters<typeof buildAspectPatternModel>[0]);
      expect(model.roots.some(pattern => pattern.kind === 'grand-cross')).toBe(true);
      const card = selectedPatternCard(model, model.roots[0].id);
      if (sourceTimesKnown) expect(card?.pattern.kind).toBe('grand-cross');
      else {
        expect(model.scope).toContain('one or both birth times unknown');
        expect(card).toBeNull();
      }
    },
  );

  it('offers every actual point/contact as a native pressed control linked to its live receipt', () => {
    const view = render();
    const all = nodes(view);
    const bodies = all.filter((node) => Object.hasOwn(node.props, 'data-composite-point'));
    const aspects = all.filter((node) => Object.hasOwn(node.props, 'data-composite-aspect'));
    expect(bodies.map((node) => node.props['data-composite-longitude'])).toEqual([0, 120, 60]);
    expect(aspects.map((node) => node.props['data-composite-aspect'])).toEqual(data.aspects.map(compositeAspectId));
    for (const control of [...bodies, ...aspects]) {
      expect(control.type).toBe('button'); expect(control.props.type).toBe('button');
      expect(control.props['aria-controls']).toBe('composite-selected-detail');
      expect(control.props['aria-pressed']).toBe(false);
      control.props.onClick();
    }
    expect(selected.mock.calls.map(([id]) => id)).toEqual([...data.points.map((point) => compositeBodyId(point.body)), ...data.aspects.map(compositeAspectId)]);
    expect(harness.importCard).not.toHaveBeenCalled();
  });

  it.each(['en', 'es', 'pt', 'fr', 'it', 'ru'] as const)('withholds unknown Moon advice but keeps a factual receipt in %s', (locale) => {
    const unknown = { ...data, moonProvisional: true };
    for (const id of [compositeBodyId('Moon'), compositeAspectId(data.aspects.find((aspect) => aspect.a === 'Moon' || aspect.b === 'Moon')!)]) {
      const view = render({ locale, data: unknown, selectedId: id });
      const detail = find('data-composite-detail', view);
      expect(strings(detail)).toContain(COMPOSITE_COPY[locale].moonTimeNotice);
      expect(nodes(detail).some((node) => Object.hasOwn(node.props, 'data-composite-reading'))).toBe(false);
      expect(nodes(detail).filter((node) => node.type === 'button' || node.type === 'a')).toHaveLength(1);
      expect(find('data-composite-clear', detail).type).toBe('button');
    }
    const knownRole = render({ locale, data: unknown, selectedId: compositeBodyId('Sun') });
    expect(find('data-composite-reading', knownRole).props.lang).toBe('en');
    if (locale !== 'en') expect(strings(knownRole)).toContain(COMPOSITE_COPY[locale].englishNarrative);
  });

  it('returns keyboard focus to the selected receipt before removing the clear control', () => {
    const view = render({ selectedId: compositeBodyId('Sun') });
    const focus = vi.fn(); const querySelector = vi.fn(() => ({ focus }));
    (find('data-composite-panel', view).ref as { current: unknown }).current = { querySelector };
    find('data-composite-clear', view).props.onClick();
    expect(querySelector).toHaveBeenCalledWith('button[aria-pressed="true"]');
    expect(focus).toHaveBeenCalledOnce(); expect(selected).toHaveBeenCalledWith(null);
  });
});

describe('composite export ownership and recovery', () => {
  it('loads only on intent, deduplicates creation and preserves the valid view after an import failure', async () => {
    const pending = deferred<typeof module>();
    harness.importCard.mockReturnValueOnce(pending.promise);
    const click = find('data-composite-export').props.onClick;
    const first = click(); void click();
    expect(harness.importCard).toHaveBeenCalledOnce();
    pending.reject(new TypeError('offline'));
    await first;
    const failed = render();
    expect(strings(failed)).toContain(calculationLoadMessage('en'));
    expect(nodes(failed).find((node) => node.type === CalculationReload)?.props.error).toBe(calculationLoadMessage('en'));
    expect(find('data-composite-point', failed)).toBeDefined();
    expect(find('data-composite-export', failed).props.children).toBe(COMPOSITE_COPY.en.retry);
    await find('data-composite-export', failed).props.onClick();
    expect(find('data-composite-image').props.src).toBe('blob:composite');
    // Without people the picture is the page's composite; both times known, no notice.
    expect(harness.prepare).toHaveBeenCalledWith(data, 'en', { noTime: false });
  });

  it.each(['close', 'replace', 'unmount'])('discards a late prepared image after %s', async (action) => {
    const pending = deferred<typeof prepared>(); harness.prepare.mockReturnValueOnce(pending.promise);
    const oldClick = find('data-composite-export').props.onClick;
    const pendingClick = oldClick(); await flush();
    if (action === 'close') find('data-composite-export-close').props.onClick();
    else if (action === 'replace') render({ sourceKey: 'replacement pair' });
    else unmount();
    const writes = harness.writes.mock.calls.length;
    pending.resolve(prepared); await pendingClick;
    expect(harness.writes).toHaveBeenCalledTimes(writes);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    if (action !== 'close') { await oldClick(); expect(harness.writes).toHaveBeenCalledTimes(writes); }
  });

  it('ignores an old finally while a replacement export remains pending', async () => {
    const old = deferred<typeof prepared>(); const next = deferred<typeof prepared>();
    harness.prepare.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const first = find('data-composite-export').props.onClick(); await flush();
    render({ sourceKey: 'replacement pair' });
    const second = find('data-composite-export').props.onClick(); await flush();
    old.resolve(prepared); await first;
    expect(find('data-composite-export-status').props.children).toBe(COMPOSITE_COPY.en.shareBusy);
    next.resolve(prepared); await second;
    expect(find('data-composite-image')).toBeDefined();
  });

  it.each(['shared', 'downloaded', 'cancelled'] as const)('reports the actual %s transport outcome without discarding the prepared image', async (outcome) => {
    harness.share.mockResolvedValueOnce(outcome);
    await find('data-composite-export').props.onClick();
    await find('data-composite-share').props.onClick();
    expect(find('data-composite-export-status').props.children).toBe(COMPOSITE_COPY.en[outcome]);
    expect(find('data-composite-image')).toBeDefined();
    await find('data-composite-download').props.onClick();
    expect(harness.download).toHaveBeenCalledWith(prepared);
    expect(find('data-composite-export-status').props.children).toBe(COMPOSITE_COPY.en.downloaded);
  });

  it('deduplicates a repeated native tap, allows retry after delivery failure and releases its object URL', async () => {
    await find('data-composite-export').props.onClick();
    const pending = deferred<string>(); harness.share.mockReturnValueOnce(pending.promise);
    const click = find('data-composite-share').props.onClick;
    const first = click(); void click();
    expect(harness.share).toHaveBeenCalledOnce();
    pending.reject(new Error('share failure')); await first;
    expect(strings(render())).toContain(COMPOSITE_COPY.en.shareError);
    await find('data-composite-share').props.onClick();
    expect(find('data-composite-export-status').props.children).toBe(COMPOSITE_COPY.en.shared);
    find('data-composite-export-close').props.onClick();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:composite');
    expect(nodes(render()).some((node) => Object.hasOwn(node.props, 'data-composite-image'))).toBe(false);
  });

  it('does not attach an old successful transport status to replacement inputs', async () => {
    await find('data-composite-export').props.onClick();
    const pending = deferred<string>(); harness.share.mockReturnValueOnce(pending.promise);
    const first = find('data-composite-share').props.onClick();
    render({ sourceKey: 'replacement pair' });
    const writes = harness.writes.mock.calls.length;
    pending.resolve('shared'); await first;
    expect(harness.writes).toHaveBeenCalledTimes(writes);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:composite');
  });
});
