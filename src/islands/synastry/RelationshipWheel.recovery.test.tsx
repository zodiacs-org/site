import type { VNode } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0,
  effects: [] as Array<{ dependencies: unknown[]; cleanup?: () => void }>,
  effectCursor: 0, pending: [] as Array<() => void>,
  writes: vi.fn(), importSphere: vi.fn(),
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
  useMemo: (compute: () => unknown) => compute(),
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
vi.mock('../../lib/module-load', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/module-load')>();
  return { ...actual, loadModule: () => actual.loadModule(harness.importSphere) };
});

import RelationshipWheel, { type WheelPerson } from './RelationshipWheel';
import { CompositePanel } from './CompositePanel';
vi.mock('../../lib/aspect-reference', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/aspect-reference')>();
  return { ...actual, aspectReference: (context: string, a: string, b: string, geometry: string) => actual.aspectReference(context, a, b, geometry, true) };
});
import CalculationReload, { calculationLoadMessage } from '../CalculationReload';
import { summarizePair } from '../../lib/engine/synastry';

const a: WheelPerson = {
  label: 'Chart A', bodies: [{ body: 'Sun', lon: 90 }, { body: 'Moon', lon: 30 }],
  asc: null, mc: null, cusps: null, timeKnown: false,
};
const b: WheelPerson = { ...a, label: 'Chart B', bodies: [{ body: 'Sun', lon: 180 }, { body: 'Moon', lon: 20 }] };
const sphere = { default: () => null };
function render(personA = a, personB = b) {
  harness.cursor = 0;
  harness.effectCursor = 0;
  const view = RelationshipWheel({ locale: 'en', a: personA, b: personB, summary: summarizePair(personA.bodies, personB.bodies) });
  harness.pending.splice(0).forEach((effect) => effect());
  return view;
}
function nodes(value: unknown): VNode<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as VNode<Record<string, any>>;
  return [node, ...nodes(node.props.children)];
}
function choose(tab: string) {
  nodes(render()).find((node) => node.props['data-relationship-tab'] === tab)!.props.onClick();
  return render();
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
beforeEach(() => {
  harness.slots = []; harness.cursor = 0;
  harness.effects = []; harness.effectCursor = 0; harness.pending = [];
  harness.writes.mockClear(); harness.importSphere.mockReset();
});
afterEach(() => harness.effects.forEach((effect) => effect.cleanup?.()));

describe('relationship 3D download recovery', () => {
  it('leaves 2D views available, explains a failed 3D download and retries on request', async () => {
    harness.importSphere.mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue(sphere);
    render();
    expect(harness.importSphere).not.toHaveBeenCalled();
    choose('depth');
    await flush();
    const failed = nodes(render());
    expect(failed.find((node) => node.props.role === 'alert')?.props.children).toBe(calculationLoadMessage('en'));
    expect(failed.find((node) => node.type === CalculationReload)?.props.error).toBe(calculationLoadMessage('en'));
    expect(failed.filter((node) => node.props.role === 'tab')).toHaveLength(4);
    failed.find((node) => node.type === 'button' && node.props.children === 'Try again')!.props.onClick();
    render();
    await flush();
    expect(nodes(render()).some((node) => node.type === sphere.default)).toBe(true);
    expect(harness.importSphere).toHaveBeenCalledTimes(2);
  });

  it.each(['tab change', 'unmount'])('ignores a late rejection after %s', async (leave) => {
    let reject!: (cause: Error) => void;
    harness.importSphere.mockReturnValue(new Promise((_resolve, fail) => { reject = fail; }));
    choose('depth');
    if (leave === 'tab change') choose('wheel');
    else harness.effects.forEach((effect) => effect.cleanup?.());
    const writes = harness.writes.mock.calls.length;
    reject(new Error('late network failure'));
    await flush();
    expect(harness.writes).toHaveBeenCalledTimes(writes);
  });
});


describe('composite selection belongs to the comparison inputs', () => {
  const panel = (view = render()) => nodes(view).find((node) => node.type === CompositePanel)!;

  it.each([false, true].flatMap(aTimeKnown => [false, true].flatMap(bTimeKnown =>
    [false, true].map(hasMoon => ({ aTimeKnown, bTimeKnown, hasMoon })))))(
    'passes actual source certainty for A:$aTimeKnown B:$bTimeKnown, with Moon present: $hasMoon',
    ({ aTimeKnown, bTimeKnown, hasMoon }) => {
      choose('composite');
      const points = (person: WheelPerson) => person.bodies.filter(point => hasMoon || point.body !== 'Moon');
      const actual = panel(render(
        { ...a, bodies: points(a), timeKnown: aTimeKnown },
        { ...b, bodies: points(b), timeKnown: bTimeKnown },
      ));
      expect(actual.props.data.moonProvisional).toBe(hasMoon && !(aTimeKnown && bTimeKnown));
    },
  );

  it('keeps the independent composite selection across tabs and presentation-only ring swaps', () => {
    const first = panel(choose('composite'));
    first.props.onSelect('composite:body:Sun');
    expect(panel().props.selectedId).toBe('composite:body:Sun');
    choose('grid'); choose('composite');
    expect(panel().props.selectedId).toBe('composite:body:Sun');
    const wheel = choose('wheel');
    nodes(wheel).find((node) => Object.hasOwn(node.props, 'data-swap'))!.props.onClick();
    expect(panel(choose('composite')).props.selectedId).toBe('composite:body:Sun');
    expect(panel().props.sourceKey).toBe(first.props.sourceKey);
  });

  it('clears selection for replacement source positions even when all their midpoints are identical', () => {
    const first = panel(choose('composite'));
    first.props.onSelect('composite:body:Sun');
    const replacementA = { ...a, bodies: a.bodies.map((point) => ({ ...point, lon: point.lon + 1 })) };
    const replacementB = { ...b, bodies: b.bodies.map((point) => ({ ...point, lon: point.lon - 1 })) };
    const next = panel(render(replacementA, replacementB));
    expect(next.props.data).toEqual(first.props.data);
    expect(next.props.sourceKey).not.toBe(first.props.sourceKey);
    expect(next.props.selectedId).toBeNull();
    expect(panel(render()).props.selectedId).toBeNull();
  });

  it('invalidates selected Moon when birth-time certainty changes', () => {
    const knownA = { ...a, timeKnown: true }; const knownB = { ...b, timeKnown: true };
    choose('composite');
    const known = panel(render(knownA, knownB));
    known.props.onSelect('composite:body:Moon');
    expect(panel(render(knownA, knownB)).props.selectedId).toBe('composite:body:Moon');
    const unknown = panel(render(knownA, b));
    expect(unknown.props.selectedId).toBeNull();
    expect(unknown.props.data.moonProvisional).toBe(true);
  });
});


it('uses canonical visible reference names and Moon uncertainty in top and exact contacts', () => {
  const first: WheelPerson = { ...a, bodies: [{ body: 'Moon', lon: 0 }], timeKnown: false };
  const second: WheelPerson = { ...b, bodies: [{ body: 'Sun', lon: 0 }], timeKnown: true };
  const text = (value: any): string => Array.isArray(value) ? value.map(text).join('') : value?.props ? text(value.props.children) : typeof value === 'string' ? value : '';
  for (const known of [false, true]) {
    const anchors = nodes(render({ ...first, timeKnown: known }, second)).filter((node) => node.type === 'a' && node.props.class === 'syn__reference');
    expect(anchors).toHaveLength(2);
    for (const anchor of anchors) {
      const visible = text(anchor);
      expect(visible).toBe(`Read Sun-Moon conjunction in synastry${known ? '' : ' (Moon time uncertain)'}`);
      expect(anchor.props.href).toBe('/compatibility/aspects/sun-moon/#conjunction');
      expect(anchor.props['aria-label']).toBe(`${visible} (Moon in chart A, Sun in chart B)`);
    }
  }
});

it('names chart roles correctly when the assignment is reversed', () => {
  const first: WheelPerson = { ...a, bodies: [{ body: 'Sun', lon: 0 }], timeKnown: true };
  const second: WheelPerson = { ...b, bodies: [{ body: 'Moon', lon: 0 }], timeKnown: true };
  const anchors = nodes(render(first, second)).filter((node) => node.type === 'a' && node.props.class === 'syn__reference');
  expect(anchors).toHaveLength(2);
  for (const anchor of anchors) {
    expect(anchor.props['aria-label']).toBe('Read Sun-Moon conjunction in synastry (Sun in chart A, Moon in chart B)');
    expect(anchor.props['aria-label']).not.toContain('undefined');
  }
});
