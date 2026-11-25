import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VNode } from 'preact';
import type { City } from '../lib/geo/search';

/**
 * The map drawn for one set of birth details is withdrawn as soon as the details change, and a draw still running
 * when they change never publishes. Rendered through a small hook harness, as PlaceSearch.recovery.test.ts is.
 */
const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as Array<{ dependencies?: unknown[]; cleanup?: () => void }>,
  effectCursor: 0,
  pending: [] as Array<() => void>,
  compute: vi.fn(),
  calendar: vi.fn(async () => ({})),
}));

vi.mock('preact/hooks', () => ({
  useState: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = initial;
    return [harness.slots[slot], (value: unknown) => {
      harness.slots[slot] = typeof value === 'function' ? (value as (prior: unknown) => unknown)(harness.slots[slot]) : value;
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
vi.mock('../lib/module-load', async (importOriginal) => ({
  ...await importOriginal<object>(),
  loadModule: async () => ({ computeAstrocartography: harness.compute, nearestLines: () => [] }),
}));

vi.mock('./BirthFields', async (importOriginal) => ({
  ...await importOriginal<object>(),
  loadBirthCalendar: harness.calendar,
}));

import AstrocartographyMap, { AcgBirthFields } from './AstrocartographyMap';

const LONDON: City = { name: 'London', admin1: 'England', country: 'United Kingdom', lat: 51.51, lon: -0.13, tz: 'Europe/London', pop: 8_000_000 };
const DRAWN = { land: { cells: [], cellDegrees: 2 }, lines: [], flags: [], jumpMinutes: null };

/** Every element in a rendered tree, without expanding child components. */
function nodes(node: unknown): VNode<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const vnode = node as VNode<Record<string, unknown>>;
  return [vnode, ...nodes(vnode.props.children)];
}
function render() {
  harness.cursor = 0;
  harness.effectCursor = 0;
  const tree = nodes(AstrocartographyMap());
  harness.pending.splice(0).forEach((run) => run());
  const fields = tree.find((node) => (node.type as unknown) === AcgBirthFields)!.props as unknown as { onDateChange: (date: string) => void; onTimeChange: (time: string) => void; onCityChange: (city: City | null) => void; check: unknown };
  const form = tree.find((node) => node.type === 'form')!;
  return {
    fields,
    submit: () => (form.props.onSubmit as (event: { preventDefault: () => void }) => Promise<void>)({ preventDefault: () => {} }),
    mapShown: tree.some((node) => node.props.class === 'acg__result'),
    busy: !!form.props['aria-busy'],
  };
}
async function filledIn() {
  render().fields.onDateChange('1990-05-03');
  render().fields.onTimeChange('08:30');
  render().fields.onCityChange(LONDON);
  return render();
}

beforeEach(() => {
  harness.slots = []; harness.effects = []; harness.pending = [];
  harness.compute.mockReset();
  harness.calendar.mockClear();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('the astrocartography map after the birth details change', () => {
  it('withdraws the drawn map and its place readings when the date is edited to one the form refuses', async () => {
    harness.compute.mockResolvedValue(DRAWN);
    await (await filledIn()).submit();
    expect(render().mapShown).toBe(true);
    render().fields.onDateChange('2020-01-01');
    const after = render();
    expect(after.mapShown).toBe(false);
    expect(after.fields.check).toMatchObject({ error: expect.any(String) });
  });

  it.each(['date', 'time', 'birthplace'] as const)('withdraws the drawn map when the %s changes', async (field) => {
    harness.compute.mockResolvedValue(DRAWN);
    await (await filledIn()).submit();
    expect(render().mapShown).toBe(true);
    const { fields } = render();
    if (field === 'date') fields.onDateChange('1991-05-03');
    else if (field === 'time') fields.onTimeChange('09:30');
    else fields.onCityChange(null);
    expect(render().mapShown).toBe(false);
  });

  it('never publishes a draw that was still running when the date changed', async () => {
    let finish: (value: unknown) => void = () => {};
    harness.compute.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const drawing = (await filledIn()).submit();
    await vi.waitFor(() => expect(harness.compute).toHaveBeenCalled());
    expect(render().busy).toBe(true);
    render().fields.onDateChange('2020-01-01');
    finish(DRAWN);
    await drawing;
    const after = render();
    expect(after.mapShown).toBe(false);
    expect(after.busy).toBe(false);
  });
});

describe('the calendar module on the astrocartography page', () => {
  it('loads with the page, before any date, and no date on either side of 1924 asks for it again', () => {
    render();
    expect(harness.calendar).toHaveBeenCalledTimes(1);
    for (const date of ['1990-05-03', '1923-12-31', '1924-01-01', '1920-05-03']) {
      render().fields.onDateChange(date);
      render();
    }
    expect(harness.calendar).toHaveBeenCalledTimes(1);
  });
});
