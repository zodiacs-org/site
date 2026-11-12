import type { VNode } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0,
  effects: [] as Array<{ dependencies: unknown[] }>, effectCursor: 0,
}));
vi.mock('preact/hooks', () => ({
  useState: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = initial;
    return [harness.slots[slot], (next: unknown) => {
      harness.slots[slot] = typeof next === 'function' ? next(harness.slots[slot]) : next;
    }];
  },
  useRef: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = { current: initial };
    return harness.slots[slot];
  },
  useMemo: (make: () => unknown) => make(),
  useEffect: (effect: () => void, dependencies: unknown[]) => {
    const index = harness.effectCursor++;
    const previous = harness.effects[index];
    if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return;
    harness.effects[index] = { dependencies };
    effect();
  },
}));
vi.mock('../lib/hooks/useProfile', () => ({
  useProfile: () => ({ profile: { version: 1, charts: [], settings: { houseSystem: 'whole' } }, ready: true }),
}));
vi.mock('../lib/hooks/useProfileAccessGeneration', () => ({ useProfileAccessGeneration: () => ({ current: 0 }) }));

import SomeoneElseChart from './SomeoneElseChart';
import { BirthFields } from './BirthFields';

function nodes(value: unknown): VNode<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as VNode<Record<string, any>>;
  return [node, ...nodes(node.props.children)];
}
const view = () => {
  harness.cursor = 0; harness.effectCursor = 0;
  return nodes(SomeoneElseChart());
};
const byId = (id: string) => view().find((node) => node.props.id === id);
const fields = () => view().find((node) => node.type === BirthFields)!.props;
const assign = vi.fn();
let focused: string[] = [];

beforeEach(() => {
  harness.slots = []; harness.cursor = 0; harness.effects = []; harness.effectCursor = 0;
  focused = [];
  assign.mockReset();
  vi.stubGlobal('window', { location: { hash: '', pathname: '/birth-chart/someone-else/', search: '', origin: 'https://zodiacs.org', assign } });
  vi.stubGlobal('history', { replaceState: vi.fn() });
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { callback(); return 0; });
  vi.stubGlobal('document', { getElementById: (id: string) => ({ focus: () => focused.push(id) }) });
});
afterEach(() => vi.unstubAllGlobals());

describe('someone-else form errors', () => {
  it('keeps the actions reachable and names each missing detail in their words', async () => {
    expect(view().some((node) => node.type === 'button' && node.props.disabled)).toBe(false);
    await view().find((node) => node.type === 'form')!.props.onSubmit({ preventDefault() {} });
    expect(focused).toEqual(['other-birth-date']);
    expect(fields()).toMatchObject({
      dateError: 'Enter their birth date.',
      timeError: 'Enter their birth time, or choose “I don’t know it”.',
      placeError: 'Pick their birthplace from the list.',
    });
    expect(assign).not.toHaveBeenCalled();
  });

  it('identifies an unticked permission box and keeps the chart closed until it is ticked', async () => {
    fields().onDateChange('2000-01-01');
    fields().onTimeKnownChange(false);
    fields().onCityChange({ name: 'Placeholder', admin1: '', country: '', lat: 0, lon: 0, tz: 'UTC', pop: 0 });
    expect(byId('other-permission')!.props['aria-required']).toBe('true');
    expect(byId('other-permission')!.props['aria-invalid']).toBeUndefined();
    await view().find((node) => node.type === 'form')!.props.onSubmit({ preventDefault() {} });
    expect(focused).toEqual(['other-permission']);
    expect(assign).not.toHaveBeenCalled();
    expect(byId('other-permission')!.props).toMatchObject({
      'aria-invalid': 'true', 'aria-describedby': 'other-permission-error',
    });
    expect(byId('other-permission-error')!.props.children).toContain('Tick the box');
    expect(fields().dateError).toBeUndefined();

    byId('other-permission')!.props.onChange({ currentTarget: { checked: true } });
    expect(byId('other-permission-error')).toBeUndefined();
    await view().find((node) => node.type === 'form')!.props.onSubmit({ preventDefault() {} });
    expect(assign).toHaveBeenCalledOnce();
  });

  it('points a Big Three reading at the missing Sun sign first', () => {
    view().find((node) => node.type === 'button' && node.props['aria-pressed'] === false
      && JSON.stringify(node.props.children).includes('Big Three'))!.props.onClick();
    view().find((node) => node.type === 'button' && JSON.stringify(node.props.children).includes('Read their chart'))!.props.onClick();
    expect(focused).toEqual(['other-sun']);
    expect(view().find((node) => node.props.id === 'other-sun' && node.props.label)!.props.error).toBe('Choose their Sun sign.');
    expect(byId('other-permission')!.props['aria-invalid']).toBe('true');
  });
});
