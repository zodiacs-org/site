import type { VNode } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateCalendarFeedResult, KeptCalendarFeed } from '../lib/calendar-feed/client';
import type { CalendarPositionsSource } from './CalendarSubscribe';

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effects: [] as Array<{ dependencies: unknown[]; cleanup?: () => void }>,
  effectCursor: 0,
  pendingEffects: [] as Array<() => void>,
  changed: false,
  realClient: false,
  persisted: [] as KeptCalendarFeed[],
  create: vi.fn(),
  remove: vi.fn(),
  timed: vi.fn(),
  untimed: vi.fn(),
  track: vi.fn(),
}));

vi.mock('../lib/calendar-feed/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/calendar-feed/client')>();
  return {
    ...original,
    createCalendarFeed: (...args: Parameters<typeof original.createCalendarFeed>) =>
      harness.realClient ? original.createCalendarFeed(...args) : harness.create(...args),
    removeCalendarFeed: (...args: Parameters<typeof original.removeCalendarFeed>) =>
      harness.realClient ? original.removeCalendarFeed(...args) : harness.remove(...args),
    readKeptCalendarFeeds: () => harness.realClient ? original.readKeptCalendarFeeds() : [...harness.persisted],
    readAvailableCalendarFeeds: () => harness.realClient ? original.readAvailableCalendarFeeds() : [...harness.persisted],
  };
});
// Synthetic position codes keep these tests about request ownership, not ephemeris work.
vi.mock('../lib/share-positions', () => ({
  encodeSharedPositionsLink: (positions: CalendarPositionsSource) => `synthetic-${positions.bodies[0]?.lon}`,
}));
vi.mock('../lib/share-positions-untimed', () => ({
  loadTimedSharedPositions: harness.timed,
  loadUntimedSharedPositions: harness.untimed,
}));
vi.mock('preact/hooks', () => ({
  useState: (initial: unknown) => {
    const slot = harness.cursor++;
    const slots = harness.slots;
    if (!(slot in slots)) slots[slot] = initial;
    return [slots[slot], (value: unknown) => {
      const next = typeof value === 'function' ? value(slots[slot]) : value;
      if (slots === harness.slots) harness.changed ||= !Object.is(next, slots[slot]);
      slots[slot] = next;
    }];
  },
  useRef: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = { current: initial };
    return harness.slots[slot];
  },
  useMemo: (compute: () => unknown, dependencies: unknown[]) => {
    const slot = harness.cursor++;
    const prior = harness.slots[slot] as { value: unknown; dependencies: unknown[] } | undefined;
    if (!prior || !dependencies.every((value, index) => Object.is(value, prior.dependencies[index]))) {
      harness.slots[slot] = { value: compute(), dependencies };
    }
    return (harness.slots[slot] as { value: unknown }).value;
  },
  useEffect: (effect: () => void | (() => void), dependencies: unknown[]) => {
    const index = harness.effectCursor++;
    const prior = harness.effects[index];
    if (prior && dependencies.every((value, i) => Object.is(value, prior.dependencies[i]))) return;
    harness.effects[index] = { dependencies, cleanup: prior?.cleanup };
    harness.pendingEffects.push(() => {
      prior?.cleanup?.();
      const cleanup = effect();
      harness.effects[index].cleanup = typeof cleanup === 'function' ? cleanup : undefined;
    });
  },
}));

import CalendarSubscribe from './CalendarSubscribe';

const first: CalendarPositionsSource = {
  bodies: [{ body: 'Sun', lon: 30 }], angles: { asc: 120, mc: 30 },
  houseSystem: 'whole', engineVersion: 'test', utc: '2000-01-01T12:00:00.000Z',
};
const second: CalendarPositionsSource = { ...first, bodies: [{ body: 'Sun', lon: 90 }] };
let props: Parameters<typeof CalendarSubscribe>[0];
const feed = (letter: string): KeptCalendarFeed => ({
  id: `${letter.repeat(21)}A`, secret: `${letter.repeat(42)}A`,
  url: `https://zodiacs.org/api/calendar/feeds/${letter.repeat(21)}A`, madeAt: 1_780_000_000_000,
});
const firstFeed = feed('a');
const secondFeed = feed('b');

function render(flushEffects = true) {
  let result: ReturnType<typeof CalendarSubscribe>;
  let passes = 0;
  do {
    harness.changed = false;
    harness.cursor = 0;
    harness.effectCursor = 0;
    result = CalendarSubscribe(props);
    if (flushEffects) harness.pendingEffects.splice(0).forEach((effect) => effect());
    if (++passes > 10) throw new Error('Unexpected render loop');
  } while (flushEffects && harness.changed);
  return result;
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
const find = (attribute: string) => nodes(render()).find((node) => attribute in node.props);
const own = () => nodes(render()).find((node) => typeof node.type === 'function' && 'feed' in node.props)?.props.feed;
const others = () => nodes(render()).filter((node) => 'data-calendar-remove-other' in node.props);
const message = () => nodes(render()).filter((node) => node.props.role === 'alert' || node.props.role === 'status').map(text).join(' ');
async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  render();
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function pendingCreation() {
  const pending = deferred<CreateCalendarFeedResult>();
  harness.create.mockImplementationOnce(async () => {
    const result = await pending.promise;
    if (result.state === 'created' && result.kept) harness.persisted.unshift(result.feed);
    return result;
  });
  return pending;
}
async function create(feed: KeptCalendarFeed, kept = true) {
  const pending = pendingCreation();
  find('data-calendar-subscribe')!.props.onClick();
  pending.resolve({ state: 'created', feed, kept });
  await settle();
}

beforeEach(() => {
  harness.slots = []; harness.cursor = 0; harness.effects = []; harness.effectCursor = 0;
  harness.pendingEffects = []; harness.changed = false; harness.persisted = []; harness.realClient = false;
  harness.create.mockReset().mockResolvedValue({ state: 'unavailable' });
  harness.remove.mockReset().mockImplementation(async (removed: KeptCalendarFeed) => {
    harness.persisted = harness.persisted.filter((entry) => entry.id !== removed.id);
    return 'removed';
  });
  harness.timed.mockReset().mockResolvedValue(first);
  harness.untimed.mockReset().mockResolvedValue(first);
  harness.track.mockReset();
  props = { locale: 'en', positions: first };
  vi.stubGlobal('window', { zodiacsAnalytics: { track: harness.track } });
});
afterEach(() => {
  harness.effects.forEach((effect) => effect.cleanup?.());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('calendar subscription request recovery', () => {
  it('starts only one subscription before a rerender', async () => {
    const pending = pendingCreation();
    const click = find('data-calendar-subscribe')!.props.onClick;
    click();
    click();
    expect(harness.create).toHaveBeenCalledOnce();
    pending.resolve({ state: 'created', feed: firstFeed, kept: true });
    await settle();
    expect(own()).toEqual(firstFeed);
  });

  it('starts only one removal before a rerender', async () => {
    harness.persisted = [firstFeed];
    const pending = deferred<'removed'>();
    harness.remove.mockReturnValueOnce(pending.promise);
    const click = others()[0].props.onClick;
    click();
    click();
    expect(harness.remove).toHaveBeenCalledOnce();
    harness.persisted = [];
    pending.resolve('removed');
    await settle();
    expect(others()).toHaveLength(0);
  });

  it.each(['subscribe', 'remove'])('serializes subscribe and remove when %s starts first', async (firstAction) => {
    harness.persisted = [firstFeed];
    const add = find('data-calendar-subscribe')!.props.onClick;
    const remove = others()[0].props.onClick;
    if (firstAction === 'subscribe') { add(); remove(); }
    else { remove(); add(); }
    expect(harness.create).toHaveBeenCalledTimes(firstAction === 'subscribe' ? 1 : 0);
    expect(harness.remove).toHaveBeenCalledTimes(firstAction === 'remove' ? 1 : 0);
    await settle();
  });

  it.each([true, false])('retains a late successful feed without assigning it to the next chart (stored: %s)', async (kept) => {
    const pending = pendingCreation();
    find('data-calendar-subscribe')!.props.onClick();
    props = { ...props, positions: second };
    render();
    pending.resolve({ state: 'created', feed: firstFeed, kept });
    await settle();
    expect(own()).toBeUndefined();
    expect(find('data-calendar-subscribe')?.props.disabled).toBe(false);
    expect(others()).toHaveLength(1);
    others()[0].props.onClick();
    await settle();
    expect(harness.remove).toHaveBeenCalledWith(firstFeed);
    expect(others()).toHaveLength(0);
  });

  it('retains all unstored removal keys across charts and later storage refreshes', async () => {
    await create(firstFeed, false);
    expect(message()).toContain('before you leave the page');
    props = { ...props, positions: second };
    render();
    expect(own()).toBeUndefined();
    expect(others()).toHaveLength(1);
    await create(secondFeed, false);
    expect(own()).toEqual(secondFeed);
    expect(others()).toHaveLength(1);
    find('data-calendar-remove')!.props.onClick();
    await settle();
    expect(others()).toHaveLength(1);
    others()[0].props.onClick();
    await settle();
    expect(harness.remove.mock.calls.map(([entry]) => entry)).toEqual([secondFeed, firstFeed]);
    expect(others()).toHaveLength(0);
  });

  it('preserves an unstored creation that finishes before the initial storage-read effect', async () => {
    const pending = pendingCreation();
    nodes(render(false)).find((node) => 'data-calendar-subscribe' in node.props)!.props.onClick();
    pending.resolve({ state: 'created', feed: firstFeed, kept: false });
    await settle();
    props = { ...props, positions: second };
    expect(others()).toHaveLength(1);
    others()[0].props.onClick();
    await settle();
    expect(harness.remove).toHaveBeenCalledWith(firstFeed);
  });

  it('retains an older unstored key after a later creation successfully writes to storage', async () => {
    await create(firstFeed, false);
    props = { ...props, positions: second };
    await create(secondFeed);
    expect(own()).toEqual(secondFeed);
    expect(others()).toHaveLength(1);
    expect(harness.persisted).toEqual([secondFeed]);
    others()[0].props.onClick();
    await settle();
    expect(harness.remove).toHaveBeenCalledWith(firstFeed);
    expect(own()).toEqual(secondFeed);
  });

  it('does not revive request ownership when the user leaves a chart and returns to it', async () => {
    const pending = pendingCreation();
    find('data-calendar-subscribe')!.props.onClick();
    props = { ...props, positions: second };
    render();
    props = { ...props, positions: first };
    render();
    pending.resolve({ state: 'created', feed: firstFeed, kept: false });
    await settle();
    expect(own()).toBeUndefined();
    expect(others()).toHaveLength(1);
    expect(find('data-calendar-subscribe')?.props.disabled).toBe(false);
  });

  it('ignores an obsolete subscribe callback after another chart renders', () => {
    const click = find('data-calendar-subscribe')!.props.onClick;
    props = { ...props, positions: second };
    render(false);
    click();
    expect(harness.create).not.toHaveBeenCalled();
  });

  it('does not display the old chart’s feed even before its change effect runs', async () => {
    await create(firstFeed);
    props = { ...props, positions: second };
    const next = nodes(render(false));
    expect(next.find((node) => typeof node.type === 'function' && 'feed' in node.props)).toBeUndefined();
    render();
  });

  it('does not offer the previous untimed positions while new positions are loading', async () => {
    props = { ...props, birthDate: '2000-01-01' };
    render();
    await settle();
    expect(find('data-calendar-subscribe')?.props.disabled).toBe(false);
    const pending = deferred<CalendarPositionsSource>();
    harness.untimed.mockReturnValueOnce(pending.promise);
    props = { ...props, birthDate: '2000-01-02' };
    const next = nodes(render(false)).find((node) => 'data-calendar-subscribe' in node.props)!;
    expect(next.props.disabled).toBe(true);
    next.props.onClick();
    expect(harness.create).not.toHaveBeenCalled();
    render();
    pending.resolve(second);
    await settle();
    await create(secondFeed);
    expect(harness.create).toHaveBeenCalledWith('synthetic-90');
  });

  it('releases the request guard after a failed subscription so the same callback can retry', async () => {
    harness.create.mockResolvedValueOnce({ state: 'offline' });
    const click = find('data-calendar-subscribe')!.props.onClick;
    click();
    await settle();
    expect(message()).toContain('offline');
    click();
    await settle();
    expect(harness.create).toHaveBeenCalledTimes(2);
    expect(find('data-calendar-subscribe')?.props.disabled).toBe(false);
  });

  it('preserves an unstored key after failed removal and allows a retry', async () => {
    await create(firstFeed, false);
    harness.remove.mockResolvedValueOnce('offline');
    const click = find('data-calendar-remove')!.props.onClick;
    click();
    await settle();
    expect(own()).toEqual(firstFeed);
    expect(message()).toContain('offline');
    click();
    await settle();
    expect(harness.remove).toHaveBeenCalledTimes(2);
    expect(own()).toBeUndefined();
  });
});

describe('calendar subscriptions across real client unmount and remount', () => {
  let fetcher: ReturnType<typeof vi.fn>;
  let refuse: boolean;
  let stored: Map<string, string>;
  function unmount() {
    harness.effects.forEach((effect) => effect.cleanup?.());
    harness.slots = []; harness.effects = []; harness.pendingEffects = [];
  }
  function remount() {
    props = { ...props, positions: second };
    render();
  }
  async function finishRequest() {
    // Response.json() adds microtasks beyond the hook-only client fixtures.
    await vi.waitFor(() => expect(find('data-calendar-subscribe')?.props.disabled).toBe(false));
  }
  beforeEach(() => {
    harness.realClient = true;
    refuse = false;
    stored = new Map();
    vi.spyOn(Date, 'now').mockReturnValue(firstFeed.madeAt);
    vi.stubGlobal('document', new EventTarget());
    vi.stubGlobal('window', Object.assign(new EventTarget(), { zodiacsAnalytics: { track: harness.track } }));
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: unknown, run: () => unknown) => run() } });
    vi.stubGlobal('localStorage', {
      get length() { return stored.size; },
      key: (index: number) => [...stored.keys()][index] ?? null,
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (refuse) throw new Error('Storage refused');
        stored.set(key, value);
      },
      removeItem: (key: string) => stored.delete(key),
    });
    Object.assign(window, { localStorage });
    fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
  });

  it.each([true, false])('keeps an already created feed removable after remount (stored: %s)', async (kept) => {
    refuse = !kept;
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify(firstFeed), { status: 201 }));
    find('data-calendar-subscribe')!.props.onClick();
    await vi.waitFor(() => expect(own()).toEqual(firstFeed));
    unmount();
    remount();
    expect(own()).toBeUndefined();
    expect(others()).toHaveLength(1);
    if (!kept) expect(message()).toContain('before you leave the page');
    fetcher.mockResolvedValueOnce(new Response('{"removed":true}', { status: 200 }));
    others()[0].props.onClick();
    await vi.waitFor(() => expect(others()).toHaveLength(0));
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe(`Bearer ${firstFeed.secret}`);
  });

  it.each([true, false])('shows and removes a creation completed after remount (stored: %s)', async (kept) => {
    refuse = !kept;
    const pending = deferred<Response>();
    fetcher.mockReturnValueOnce(pending.promise);
    find('data-calendar-subscribe')!.props.onClick();
    unmount();
    remount();
    pending.resolve(new Response(JSON.stringify(firstFeed), { status: 201 }));
    await finishRequest();
    await vi.waitFor(() => expect(others()).toHaveLength(1));
    expect(own()).toBeUndefined();
    if (!kept) expect(message()).toContain('before you leave the page');
    fetcher.mockResolvedValueOnce(new Response('{"removed":true}', { status: 200 }));
    others()[0].props.onClick();
    await vi.waitFor(() => expect(others()).toHaveLength(0));
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe(`Bearer ${firstFeed.secret}`);
  });

  it.each([true, false])('keeps a creation completed while no island is mounted (stored: %s)', async (kept) => {
    refuse = !kept;
    const pending = deferred<Response>();
    fetcher.mockReturnValueOnce(pending.promise);
    find('data-calendar-subscribe')!.props.onClick();
    unmount();
    pending.resolve(new Response(JSON.stringify(firstFeed), { status: 201 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    remount();
    expect(own()).toBeUndefined();
    expect(others()).toHaveLength(1);
    fetcher.mockResolvedValueOnce(new Response('{"removed":true}', { status: 200 }));
    others()[0].props.onClick();
    await vi.waitFor(() => expect(others()).toHaveLength(0));
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe(`Bearer ${firstFeed.secret}`);
  });

  it('blocks a second creation across remount until the first request finishes', async () => {
    const pending = deferred<Response>();
    fetcher.mockReturnValueOnce(pending.promise);
    find('data-calendar-subscribe')!.props.onClick();
    unmount();
    remount();
    const add = find('data-calendar-subscribe')!;
    add.props.onClick();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    expect(add.props.disabled).toBe(true);
    pending.resolve(new Response(JSON.stringify(firstFeed), { status: 201 }));
    await finishRequest();
    expect(others()).toHaveLength(1);
  });

  it('clears the primary feed in another still-mounted instance after accepted removal', async () => {
    refuse = true;
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify(firstFeed), { status: 201 }));
    find('data-calendar-subscribe')!.props.onClick();
    await vi.waitFor(() => expect(own()).toEqual(firstFeed));
    const firstInstance = { slots: harness.slots, effects: harness.effects, props };
    // Mount another island without running the first island's cleanup.
    harness.slots = []; harness.effects = []; harness.pendingEffects = [];
    remount();
    expect(others()).toHaveLength(1);
    fetcher.mockResolvedValueOnce(new Response('{"removed":true}', { status: 200 }));
    others()[0].props.onClick();
    await vi.waitFor(() => expect(others()).toHaveLength(0));
    unmount();
    harness.slots = firstInstance.slots; harness.effects = firstInstance.effects; props = firstInstance.props;
    expect(own()).toBeUndefined();
    expect(others()).toHaveLength(0);
    expect(find('data-calendar-subscribe')?.props.disabled).toBe(false);
  });

  it('does not reinsert a late created feed into a still-mounted view after clear-all', async () => {
    const { clearAllZodiacsDataFromDevice } = await import('../lib/account-v2/profile-boundary');
    refuse = true;
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify(firstFeed), { status: 201 }));
    find('data-calendar-subscribe')!.props.onClick();
    await vi.waitFor(() => expect(own()).toEqual(firstFeed));
    props = { ...props, positions: second };
    const pending = deferred<Response>();
    fetcher.mockReturnValueOnce(pending.promise);
    find('data-calendar-subscribe')!.props.onClick();
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    window.dispatchEvent(new Event('zodiacs:profile-lease-revoke'));
    refuse = false;
    expect(clearAllZodiacsDataFromDevice(localStorage, localStorage).ok).toBe(true);
    expect(others()).toHaveLength(0);
    pending.resolve(new Response(JSON.stringify(secondFeed), { status: 201 }));
    await finishRequest();
    expect(own()).toBeUndefined();
    expect(others()).toHaveLength(0);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every(([, init]) => init.method === 'POST')).toBe(true);
    expect(stored.has('zodiacs.calendar-feeds.v1')).toBe(false);
  });

  it('also fences a result cleared between client completion and the awaiting view callback', async () => {
    const { clearAllZodiacsDataFromDevice } = await import('../lib/account-v2/profile-boundary');
    const { watchCalendarFeeds, calendarFeedRequestPending, readAvailableCalendarFeeds } = await import('../lib/calendar-feed/client');
    render();
    let cleared = false;
    const stop = watchCalendarFeeds(() => {
      if (!cleared && calendarFeedRequestPending() === null && readAvailableCalendarFeeds().length > 0) {
        cleared = true;
        expect(clearAllZodiacsDataFromDevice(localStorage, localStorage).ok).toBe(true);
      }
    });
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify(firstFeed), { status: 201 }));
    find('data-calendar-subscribe')!.props.onClick();
    await vi.waitFor(() => expect(cleared).toBe(true));
    stop();
    expect(own()).toBeUndefined();
    expect(others()).toHaveLength(0);
    expect(stored.has('zodiacs.calendar-feeds.v1')).toBe(false);
  });
});
