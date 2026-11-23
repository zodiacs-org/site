import type { VNode } from 'preact';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { City } from '../lib/geo/search';

/**
 * The gated fields' effects, run by a small hook harness (no DOM): a refused date clears a time and birthplace
 * already entered, and a date written another way is checked only once it is converted.
 */
const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as Array<{ dependencies?: unknown[] }>,
  effectCursor: 0,
  pending: [] as Array<() => void>,
  search: vi.fn(),
}));

vi.mock('../lib/geo/search', () => ({ searchCities: harness.search, preloadIndex: vi.fn() }));
vi.mock('preact/hooks', () => ({
  useState: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = initial;
    return [harness.slots[slot], (value: unknown) => { harness.slots[slot] = typeof value === 'function' ? value(harness.slots[slot]) : value; }];
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
    harness.pending.push(() => { effect(); harness.effects[index] = { dependencies }; });
  },
}));

import { GatedBirthFields, useBirthDateCheck, type BirthDateCheck } from './GatedBirthFields';
import { UNDER_13_SENTENCE } from '../lib/birth-date-policy';

const LISBON: City = { name: 'Lisbon', admin1: '', country: 'Portugal', lat: 38.72, lon: -9.14, tz: 'Europe/Lisbon', pop: 500000 };
const flush = () => harness.pending.splice(0).forEach((run) => run());
const reset = () => { harness.slots = []; harness.effects = []; harness.pending = []; harness.cursor = 0; harness.effectCursor = 0; harness.search.mockReset(); };
const refuse = (birthDate: string) => (birthDate > '2013-11-09' ? UNDER_13_SENTENCE : null);

function mount(check: BirthDateCheck, time: string, city: City | null) {
  const onTimeChange = vi.fn();
  const onCityChange = vi.fn();
  harness.effectCursor = 0;
  harness.cursor = 0;
  const view = GatedBirthFields({
    locale: 'en', dateId: 'd', timeId: 't', placeId: 'p', date: '2020-01-01', calendar: 'gregorian', check, time, timeKnown: true, city,
    onDateChange: vi.fn(), onCalendarChange: vi.fn(), onTimeChange, onTimeKnownChange: vi.fn(), onCityChange,
  }) as unknown as VNode[];
  flush();
  return { view, onTimeChange, onCityChange };
}

describe('the gated birth fields, as the date changes', () => {
  beforeEach(reset);

  it('clear a time and birthplace entered for an earlier date once the date is refused', () => {
    const accepted = mount({ date: '1990-05-03' }, '08:30', LISBON);
    expect(accepted.onTimeChange).not.toHaveBeenCalled();
    expect(accepted.onCityChange).not.toHaveBeenCalled();
    const refused = mount({ error: UNDER_13_SENTENCE }, '08:30', LISBON);
    expect(refused.onTimeChange).toHaveBeenCalledWith('');
    expect(refused.onCityChange).toHaveBeenCalledWith(null);
    // Nothing is searched for a refused date: the birthplace search is not there to send a request.
    expect(harness.search).not.toHaveBeenCalled();
  });

  it('leave an empty form alone', () => {
    const empty = mount({ error: UNDER_13_SENTENCE }, '', null);
    expect(empty.onTimeChange).not.toHaveBeenCalled();
    expect(empty.onCityChange).not.toHaveBeenCalled();
  });

  it('hold a date written another way unchecked (locked) until it is converted, then check the converted date', async () => {
    harness.cursor = 0; harness.effectCursor = 0;
    expect(useBirthDateCheck(' 2020-01-01', 'gregorian', refuse)).toBeNull();
    flush();
    await vi.waitFor(() => expect((harness.slots[0] as { check: BirthDateCheck } | null)?.check).toEqual({ error: UNDER_13_SENTENCE }));
    harness.cursor = 0; harness.effectCursor = 0;
    expect(useBirthDateCheck(' 2020-01-01', 'gregorian', refuse)).toEqual({ error: UNDER_13_SENTENCE });
    // A Gregorian date is checked at once.
    reset();
    expect(useBirthDateCheck('1990-05-03', 'gregorian', refuse)).toEqual({ date: '1990-05-03' });
  });
});
