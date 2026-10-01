import type { VNode } from 'preact';
import { readFileSync } from 'node:fs';
import type { Profile, SavedChart } from '../../lib/profile/schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  profile: { profile: {} as Profile, ready: false },
  slots: [] as unknown[],
  cursor: 0,
  memos: [] as Array<{ dependencies: unknown[]; value: unknown }>,
  memoCursor: 0,
  effects: [] as Array<{ dependencies: unknown[]; cleanup?: () => void }>,
  effectCursor: 0,
  pending: [] as Array<() => void>,
  writes: vi.fn(),
  load: vi.fn(),
  loadContacts: vi.fn(),
  track: vi.fn(),
  savedHint: false,
}));

vi.mock('../../lib/hooks/useProfile', () => ({ useProfile: () => harness.profile }));
vi.mock('preact/hooks', () => ({
  useState: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = initial;
    return [harness.slots[slot], (value: unknown) => {
      harness.writes(slot, value);
      harness.slots[slot] = typeof value === 'function' ? value(harness.slots[slot]) : value;
    }];
  },
  useMemo: (compute: () => unknown, dependencies: unknown[]) => {
    const index = harness.memoCursor++;
    const prior = harness.memos[index];
    if (prior && dependencies.length === prior.dependencies.length
      && dependencies.every((value, i) => Object.is(value, prior.dependencies[i]))) return prior.value;
    const value = compute();
    harness.memos[index] = { dependencies, value };
    return value;
  },
  useEffect: (effect: () => void | (() => void), dependencies: unknown[]) => {
    const index = harness.effectCursor++;
    const prior = harness.effects[index];
    if (prior && dependencies.length === prior.dependencies.length
      && dependencies.every((value, i) => Object.is(value, prior.dependencies[i]))) return;
    harness.pending.push(() => {
      prior?.cleanup?.();
      const cleanup = effect();
      harness.effects[index] = { dependencies, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
    });
  },
}));

type TodayBriefComponent = typeof import('./TodayBrief')['default'];
let TodayBrief: TodayBriefComponent;

const moduleValue = {
  TRANSIT_ORB: 3,
  transitLine: () => 'Fixture contact reading.',
  contactReceipt: () => 'Fixture contact receipt.',
};
const readings = Object.fromEntries([
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
].map((sign) => [sign, { text: `${sign} edition note.`, receipt: 'Fixture receipt.' }]));

function chart(id: string): SavedChart {
  return {
    id,
    name: `Chart ${id}`,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    birth: { date: '1990-01-01', time: '12:00', timeKnown: true, place: null },
    summary: {
      engineVersion: 'fixture', utcISO: '1990-01-01T12:00:00.000Z', houseSystem: 'whole',
      bodies: [{ body: 'Sun', lon: id === 'A' ? 100 : 200, retrograde: false }],
      angles: null, flags: [],
    },
  };
}

function profile(charts: SavedChart[], ready = true) {
  harness.profile = {
    profile: { version: 1, settings: { houseSystem: 'whole' }, charts },
    ready,
  };
}

function render(overrides: Partial<Parameters<TodayBriefComponent>[0]> = {}) {
  harness.cursor = 0;
  harness.memoCursor = 0;
  harness.effectCursor = 0;
  const view = TodayBrief({
    editionDate: '2026-09-11',
    bodies: [{ body: 'Sun', lon: 168.5, retrograde: false }, { body: 'Moon', lon: 42, retrograde: false }],
    sunSignReadings: readings,
    generatorVersion: 'fixture',
    ...overrides,
  });
  harness.pending.splice(0).forEach((effect) => effect());
  return view;
}

function nodes(value: unknown): VNode<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as VNode<Record<string, any>>;
  return [node, ...nodes(node.props.children)];
}

function textContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textContent).join('');
  if (value && typeof value === 'object' && 'props' in value) return textContent((value as VNode).props.children);
  return '';
}

function comparisonUnavailable(view: unknown): boolean {
  const fallback = nodes(view).find((node) => 'comparisonUnavailable' in node.props);
  return fallback?.props.comparisonUnavailable === true;
}

function deferredLoad() {
  let resolve!: (value: typeof moduleValue) => void;
  let reject!: (cause: Error) => void;
  harness.load.mockReturnValue(new Promise<typeof moduleValue>((done, fail) => {
    resolve = done;
    reject = fail;
  }));
  return { resolve: () => resolve(moduleValue), reject: () => reject(new Error('offline')) };
}

async function started() {
  await vi.waitFor(() => expect(harness.load).toHaveBeenCalledOnce());
}

beforeEach(async () => {
  vi.resetModules();
  harness.slots = [];
  harness.cursor = 0;
  harness.memos = [];
  harness.memoCursor = 0;
  harness.effects = [];
  harness.effectCursor = 0;
  harness.pending = [];
  harness.savedHint = false;
  harness.writes.mockClear();
  harness.load.mockReset().mockResolvedValue(moduleValue);
  harness.loadContacts.mockReset().mockResolvedValue(undefined);
  harness.track.mockClear();
  profile([], false);
  const stored = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    },
    zodiacsAnalytics: { track: harness.track },
  });
  vi.stubGlobal('document', {
    documentElement: { hasAttribute: (name: string) => name === 'data-today-saved-chart' && harness.savedHint },
  });
  vi.doMock('../../lib/transits', () => harness.load());
  vi.doMock('../../lib/engine/aspects', async (importOriginal) => {
    await harness.loadContacts();
    return importOriginal();
  });
  vi.doMock('../../lib/living-chart/forecast-snapshot', () => ({ createLivingForecastSnapshot: (value: unknown) => value }));
  vi.doMock('../living-chart/LivingMomentCapture', () => ({
    default: () => null,
    possibleContactLine: () => 'Possible fixture contact.',
    reflectionForContact: () => null,
  }));
  TodayBrief = (await import('./TodayBrief')).default;
});

afterEach(() => {
  harness.effects.forEach((effect) => effect.cleanup?.());
  vi.doUnmock('../../lib/transits');
  vi.doUnmock('../../lib/engine/aspects');
  vi.doUnmock('../../lib/living-chart/forecast-snapshot');
  vi.doUnmock('../living-chart/LivingMomentCapture');
  vi.unstubAllGlobals();
});

describe('Today saved-chart transit loading', () => {
  it('keeps transit code unloaded for an empty profile while recording the visit once', async () => {
    render();
    profile([]);
    const view = render();
    render();
    await vi.dynamicImportSettled();
    expect(harness.load).not.toHaveBeenCalled();
    expect(harness.loadContacts).not.toHaveBeenCalled();
    expect(view.props['data-today-state']).toBe('empty');
    expect(comparisonUnavailable(view)).toBe(false);
    expect(harness.track).toHaveBeenCalledExactlyOnceWith('today_view', {});
    const streak = JSON.parse(window.localStorage.getItem('zodiacs.today.v1')!);
    expect(streak.count).toBe(1);
  });

  it('waits for profile readiness even when a chart is already present', async () => {
    profile([chart('A')], false);
    render();
    await vi.dynamicImportSettled();
    expect(harness.load).not.toHaveBeenCalled();
    expect(harness.loadContacts).not.toHaveBeenCalled();
    profile([chart('A')]);
    render();
    await vi.dynamicImportSettled();
    expect(harness.load).toHaveBeenCalledOnce();
    expect(harness.loadContacts).toHaveBeenCalledOnce();
    expect(render().props['data-today-state']).toBe('chart');
  });

  it('starts contact arithmetic while transit phrasing is still loading', async () => {
    const pending = deferredLoad();
    profile([chart('A')]);
    render();
    await started();
    await vi.waitFor(() => expect(harness.loadContacts).toHaveBeenCalledOnce());
    // Both dependencies start together; the view still waits for the whole
    // calculation/phrasing pair before showing a personalized reading.
    expect(render().props['data-today-state']).not.toBe('chart');
    pending.resolve();
    await vi.dynamicImportSettled();
    expect(render().props['data-today-state']).toBe('chart');
  });

  it('starts personalization when a saved chart arrives after an empty first render', async () => {
    profile([]);
    render();
    await vi.dynamicImportSettled();
    expect(harness.load).not.toHaveBeenCalled();
    profile([chart('A')]);
    render();
    await vi.dynamicImportSettled();
    const view = render();
    expect(view.props['data-today-state']).toBe('chart');
    expect(nodes(view).some((node) => node.props['aria-label'] === 'For Chart A')).toBe(true);
    expect(harness.track).toHaveBeenCalledOnce();
  });

  it('reuses the pending module when the selected chart changes from A to B', async () => {
    const pending = deferredLoad();
    profile([chart('A')]);
    render();
    await started();
    profile([chart('B')]);
    render();
    pending.resolve();
    await vi.dynamicImportSettled();
    const view = render();
    expect(harness.load).toHaveBeenCalledOnce();
    expect(view.props['data-today-state']).toBe('chart');
    expect(nodes(view).some((node) => node.props['aria-label'] === 'For Chart B')).toBe(true);
    expect(nodes(view).some((node) => node.props['aria-label'] === 'For Chart A')).toBe(false);
  });

  it.each([
    ['cleared profile', true],
    ['revoked profile access', false],
  ] as const)('ignores a late module after %s', async (_reason, ready) => {
    const pending = deferredLoad();
    profile([chart('A')]);
    render();
    await started();
    profile([], ready);
    render();
    const writes = harness.writes.mock.calls.length;
    pending.resolve();
    await vi.dynamicImportSettled();
    expect(harness.writes).toHaveBeenCalledTimes(writes);
    const view = render();
    expect(view.props['data-today-state']).not.toBe('chart');
    expect(comparisonUnavailable(view)).toBe(false);
  });

  it.each(['resolve', 'reject'] as const)('ignores a late %s after unmount', async (outcome) => {
    const pending = deferredLoad();
    profile([chart('A')]);
    render();
    await started();
    harness.effects.forEach((effect) => effect.cleanup?.());
    const writes = harness.writes.mock.calls.length;
    pending[outcome]();
    await vi.dynamicImportSettled();
    expect(harness.writes).toHaveBeenCalledTimes(writes);
  });

  it('shows an import failure only for a chart that needs it, without a retry loop', async () => {
    const pending = deferredLoad();
    profile([chart('A')]);
    expect(comparisonUnavailable(render())).toBe(false);
    await started();
    pending.reject();
    await vi.dynamicImportSettled();
    expect(comparisonUnavailable(render())).toBe(true);
    render();
    render();
    await vi.dynamicImportSettled();
    expect(harness.load).toHaveBeenCalledOnce();
    profile([]);
    expect(comparisonUnavailable(render())).toBe(false);
    profile([chart('B')]);
    // A later chart must not inherit the previous failure for one paint while
    // its new passive loading effect is still waiting to run.
    expect(comparisonUnavailable(render())).toBe(false);
    await vi.dynamicImportSettled();
  });

  it('shows the same fallback when contact arithmetic fails to load, without a retry loop', async () => {
    harness.loadContacts.mockRejectedValue(new Error('contact chunk unavailable'));
    profile([chart('A')]);
    expect(comparisonUnavailable(render())).toBe(false);
    await vi.dynamicImportSettled();
    expect(comparisonUnavailable(render())).toBe(true);
    render();
    await vi.dynamicImportSettled();
    expect(harness.loadContacts).toHaveBeenCalledOnce();
    profile([]);
    expect(comparisonUnavailable(render())).toBe(false);
  });

  it('preserves the malformed-profile DOM-hint fallback without loading transit code', async () => {
    profile([{ id: 'malformed', name: 'Incomplete chart' } as SavedChart]);
    harness.savedHint = true;
    const view = render();
    await vi.dynamicImportSettled();
    expect(harness.load).not.toHaveBeenCalled();
    expect(view.props['data-today-state']).toBe('empty');
    expect(comparisonUnavailable(view)).toBe(true);
  });

  it.each([
    { timeKnown: true, active: false },
    { timeKnown: false, active: false },
    { timeKnown: true, active: true },
    { timeKnown: false, active: true },
  ])('keeps a saved-chart Sun baseline only for known time and validates its snapshot (known=$timeKnown, active=$active)', async ({ timeKnown, active }) => {
    const saved = chart('A');
    saved.id = '10000000-0000-4000-8000-000000000001';
    saved.relationship = 'self';
    saved.birth.timeKnown = timeKnown;
    saved.birth.time = timeKnown ? '12:00' : null;
    // The active fixture has an exact Sun contact; 10° has no contact within 3°.
    saved.summary.bodies[0].lon = active ? 168.5 : 10;
    const before = JSON.stringify(saved);
    profile([saved]);
    render({ livingChartEnabled: true });
    await vi.dynamicImportSettled();
    const view = render({ livingChartEnabled: true });
    const rows = nodes(view);
    expect(rows.some(node => node.type === 'p' && textContent(node) === 'Aries Sun-sign baseline')).toBe(timeKnown && !active);
    expect(rows.some(node => typeof node.props.children === 'string'
      && node.props.children.includes('the Sun sign has not been checked across the whole birth date'))).toBe(!timeKnown);
    const forecast = rows.find(node => node.props.forecast)?.props.forecast;
    expect(forecast).toBeTruthy();
    expect(forecast.lines.some((line: { id: string }) => line.id.startsWith('sun-sign:'))).toBe(timeKnown && !active);
    expect(forecast.lines[0].text.includes('This comparison uses one time on your birth date')).toBe(!timeKnown);
    expect(forecast.lines[0].receipt).toBe(active ? 'Fixture contact receipt.' : 'Nearest checked contact · Fixture contact receipt.');
    const { createLivingForecastSnapshot, parseLivingForecastSnapshot } = await vi.importActual<typeof import('../../lib/living-chart/forecast-snapshot')>('../../lib/living-chart/forecast-snapshot');
    const accepted = createLivingForecastSnapshot(forecast);
    expect(accepted).not.toBeNull();
    expect(accepted?.source).toBe(active ? 'personalized' : 'quiet');
    expect(accepted?.lines).toEqual(forecast.lines);
    expect(parseLivingForecastSnapshot(JSON.parse(JSON.stringify(accepted)))).toEqual(accepted);
    expect(JSON.stringify(saved)).toBe(before);
  });

  it('uses reference wording when an unknown-time saved comparison cannot load', async () => {
    const saved = chart('A');
    saved.birth.timeKnown = false;
    saved.birth.time = null;
    profile([saved]);
    harness.load.mockRejectedValue(new Error('offline'));
    render();
    await vi.dynamicImportSettled();
    const rows = nodes(render());
    const status = rows.find(node => typeof node.props.class === 'string' && node.props.class.includes('today-returning-chart-status'));
    expect(status?.props.children).toContain('This comparison uses one time on your birth date');
    expect(status?.props.children).not.toContain('Your Sun-sign baseline is ready');
  });
});

describe('Today prehydration saved-Sun hint', () => {
  it.each([true, false, undefined])('requires explicit known time without changing the manual Sun preference: %s', timeKnown => {
    const source = readFileSync(new URL('../../pages/today/index.astro', import.meta.url), 'utf8');
    const start = source.indexOf('    /* Private return-state hint.');
    const script = source.slice(start, source.indexOf('</script>', start));
    expect(start).toBeGreaterThan(0);
    const saved = chart('A');
    saved.birth.timeKnown = timeKnown as boolean;
    const values = new Map([['zodiacs.profile.v1', JSON.stringify({ version: 1, charts: [saved] })], ['zodiacs:today-sun-sign:v1', 'leo']]);
    const attributes = new Map<string, string>();
    const events = new EventTarget();
    const document = { documentElement: {
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      removeAttribute: (name: string) => attributes.delete(name),
      hasAttribute: (name: string) => attributes.has(name),
    }, addEventListener() {} };
    new Function('localStorage', 'document', 'window', 'livingChartEnabled', script)(
      { getItem: (key: string) => values.get(key) ?? null }, document, events, false,
    );
    expect(attributes.has('data-today-saved-chart')).toBe(true);
    expect(attributes.get('data-today-chart-sun-sign')).toBe(timeKnown === true ? 'cancer' : undefined);
    expect(attributes.get('data-today-sun-sign')).toBe('leo');
    // A Leo quick-read preference differs from the chart's Cancer Sun only when that Sun is verified.
    expect(attributes.has('data-today-sign-mismatch')).toBe(timeKnown === true);
    saved.birth.timeKnown = false;
    values.set('zodiacs.profile.v1', JSON.stringify({ version: 1, charts: [saved] }));
    events.dispatchEvent(new Event('zodiacs:profile'));
    expect(attributes.has('data-today-chart-sun-sign')).toBe(false);
    expect(attributes.has('data-today-sign-mismatch')).toBe(false);
    expect(attributes.get('data-today-sun-sign')).toBe('leo');
  });
});
