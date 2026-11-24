import type { VNode } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTACT_CONFIDENCE_NOTE } from '../lib/reading-confidence-note';
import type { PersonalYear } from '../lib/year-sky/moments';
import type { YearMoment } from '../lib/year-sky/types';
import type { SavedChart } from '../lib/profile/schema';

const SAVED: SavedChart = {
  id: 'chart-1',
  name: 'Test chart',
  relationship: 'self',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  birth: {
    date: '1990-02-07',
    time: '12:00',
    timeKnown: true,
    place: { name: 'London', admin1: 'England', country: 'GB', lat: 51.5, lon: -0.12, tz: 'Europe/London' },
  },
  summary: {
    engineVersion: 'test',
    utcISO: '1990-02-07T12:00:00.000Z',
    houseSystem: 'whole',
    bodies: [{ body: 'Sun', lon: 318, retrograde: false }],
    angles: { asc: 10, mc: 280 },
    flags: [],
  },
};

const PROFILE = { version: 1 as const, settings: { houseSystem: 'whole' as const }, charts: [SAVED] };

const moment: YearMoment = {
  id: 'solar-return',
  kind: 'solar-return',
  body: 'Sun',
  at: '2027-03-20T12:00:00.000Z',
  title: 'Solar return',
  line: 'A test line.',
  detail: 'A test detail.',
  confidence: 70,
  weight: 5,
  dates: [{ at: '2027-03-20T12:00:00.000Z', timed: true }],
  card: 'Sun in Pisces',
};

const PERSONAL: PersonalYear = {
  year: 2027,
  timeKnown: true,
  detail: 'timed-place',
  moments: [moment],
  allYear: [],
  highlights: [moment],
  signs: { sun: 'Pisces', moon: 'Aries', rising: 'Taurus' },
};

const CARD = { blob: new Blob(['card'], { type: 'image/png' }), filename: 'year.png' };

const harness = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  effectCursor: 0,
  effects: [] as Array<{ dependencies: unknown[]; cleanup?: () => void }>,
  pending: [] as Array<() => void>,
  writes: vi.fn(),
  moments: vi.fn(),
  calendar: vi.fn(),
  cards: vi.fn(),
  saver: vi.fn(),
  download: vi.fn(),
}));

vi.mock('preact/hooks', () => ({
  useState: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = typeof initial === 'function' ? (initial as () => unknown)() : initial;
    return [harness.slots[slot], (next: unknown) => {
      harness.writes(slot, next);
      harness.slots[slot] = typeof next === 'function' ? (next as (current: unknown) => unknown)(harness.slots[slot]) : next;
    }];
  },
  useRef: (initial: unknown) => {
    const slot = harness.cursor++;
    if (!(slot in harness.slots)) harness.slots[slot] = { current: initial };
    return harness.slots[slot];
  },
  useMemo: (compute: () => unknown) => compute(),
  useEffect: (effect: () => void | (() => void), dependencies: unknown[]) => {
    const slot = harness.effectCursor++;
    const previous = harness.effects[slot];
    if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return;
    harness.pending.push(() => {
      previous?.cleanup?.();
      const cleanup = effect();
      harness.effects[slot] = { dependencies, cleanup: typeof cleanup === 'function' ? cleanup : undefined };
    });
  },
}));

vi.mock('../lib/module-load', async (original) => {
  const actual = await original<typeof import('../lib/module-load')>();
  return {
    ...actual,
    createModuleLoader: (importModule: () => Promise<unknown>) => {
      const src = importModule.toString();
      if (src.includes('year-sky/moments')) return () => harness.moments();
      if (src.includes('year-sky/calendar')) return () => harness.calendar();
      if (src.includes('year-sky/card')) return () => harness.cards();
      if (src.includes('share-card')) return () => harness.saver();
      if (src.includes('ical-download')) return () => harness.download();
      return () => actual.loadModule(importModule);
    },
  };
});

vi.mock('../lib/hooks/useProfile', () => ({
  useProfile: () => ({ profile: PROFILE, ready: true }),
}));

vi.mock('../lib/hooks/useEngine', () => ({
  useEngine: () => () => Promise.reject(new Error('engine should not load for a saved chart')),
}));

vi.mock('../lib/profile/read-store', async (original) => {
  const actual = await original<typeof import('../lib/profile/read-store')>();
  return { ...actual, loadProfile: () => PROFILE };
});

class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage() {
    queueMicrotask(() => this.onmessage?.({ data: { scan: { contacts: [], natal: { bodies: [] } } } }));
  }
  terminate() {}
}

import YearSky from './YearSky';

function nodes(value: unknown): VNode<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as VNode<Record<string, any>>;
  return [node, ...nodes(node.props.children)];
}

function render(effects = true) {
  harness.cursor = 0;
  harness.effectCursor = 0;
  const tree = YearSky({
    year: 2027,
    eclipses: [],
    ingresses: [],
    retrogrades: [],
    general: [],
    pagePath: '/your-2027-sky/',
  });
  if (effects) harness.pending.splice(0).forEach((effect) => effect());
  return nodes(tree);
}

const marker = (name: string) => render().find((node) => Object.hasOwn(node.props, name));
function noteIsVisible(node: VNode<Record<string, any>>) {
  const style = node.props.style;
  const visibility = style && typeof style === 'object' ? style.visibility : undefined;
  if (typeof visibility === 'string' && visibility.toLowerCase() === 'hidden') return false;
  if (typeof style === 'string' && /visibility\s*:\s*hidden/i.test(style)) return false;
  if (node.props.hidden === true) return false;
  if (node.props['aria-hidden'] === true || node.props['aria-hidden'] === 'true') return false;
  return true;
}
const hasNote = (tree = render()) => tree.some((node) => (
  node.props.class === 'sharing-note' && node.props.children === CONTACT_CONFIDENCE_NOTE && noteIsVisible(node)
));
const hasResult = (tree = render()) => tree.some((node) => Object.hasOwn(node.props, 'data-year-sky-result'));
const hasCalendar = (tree = render()) => tree.some((node) => node.props.class === 'ys-calendar');
const errorText = (tree = render()) => tree.find((node) => node.props.class === 'field__error' && node.props.role === 'alert')?.props.children;

async function readYear() {
  const form = marker('data-year-sky-chooser');
  if (!form) throw new Error('chooser form missing');
  await form.props.onSubmit({ preventDefault() {} });
}

const flush = async () => { for (let step = 0; step < 48; step++) await Promise.resolve(); };

beforeEach(() => {
  harness.slots = [];
  harness.cursor = 0;
  harness.effectCursor = 0;
  harness.effects = [];
  harness.pending = [];
  harness.writes.mockClear();
  harness.moments.mockReset().mockResolvedValue({ personalYear: () => PERSONAL });
  harness.calendar.mockReset().mockResolvedValue({
    yearCalendar: () => 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n',
    calendarMoments: () => [],
    YEAR_SKY_CALENDAR_FILENAME: 'zodiacs-2027-sky.ics',
  });
  harness.cards.mockReset().mockResolvedValue({
    prepareYearCards: async () => ({ square: CARD, story: CARD }),
  });
  harness.saver.mockReset().mockResolvedValue({ savePngBlob: vi.fn().mockResolvedValue('shared') });
  harness.download.mockReset().mockResolvedValue({ downloadCalendarFile: vi.fn() });
  vi.stubGlobal('Worker', FakeWorker);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:year-card');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  render();
});

afterEach(() => {
  harness.effects.forEach((effect) => effect.cleanup?.());
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Year Sky errors keep the personal reading and its confidence note', () => {
  it('still shows the reading and the note when the calendar module fails to load', async () => {
    harness.calendar.mockRejectedValueOnce(new Error('calendar module failed'));
    await readYear();
    await flush();
    expect(hasResult()).toBe(true);
    expect(hasNote()).toBe(true);
    expect(hasCalendar()).toBe(false);
    expect(errorText()).toBe('The year could not be worked out. Check the details and try again.');
  });

  it('still shows the reading and the note when the calendar file fails to build', async () => {
    harness.calendar.mockResolvedValueOnce({
      yearCalendar: () => { throw new Error('calendar build failed'); },
      calendarMoments: () => [],
      YEAR_SKY_CALENDAR_FILENAME: 'zodiacs-2027-sky.ics',
    });
    await readYear();
    await flush();
    expect(hasResult()).toBe(true);
    expect(hasNote()).toBe(true);
    expect(hasCalendar()).toBe(false);
    expect(errorText()).toBe('The year could not be worked out. Check the details and try again.');
  });

  it('keeps the reading and the note visible when sharing the card fails', async () => {
    const savePngBlob = vi.fn().mockRejectedValue(new Error('share failed'));
    harness.saver.mockResolvedValue({ savePngBlob });
    await readYear();
    await flush();
    expect(hasResult()).toBe(true);
    expect(hasNote()).toBe(true);
    await marker('data-year-sky-share-square')!.props.onClick();
    await flush();
    expect(savePngBlob).toHaveBeenCalled();
    expect(hasResult()).toBe(true);
    expect(hasNote()).toBe(true);
    expect(errorText()).toBe('The year could not be worked out. Check the details and try again.');
  });

  it('keeps the reading and the note visible when downloading the calendar fails', async () => {
    const downloadCalendarFile = vi.fn().mockImplementation(() => { throw new Error('download failed'); });
    harness.download.mockResolvedValue({ downloadCalendarFile });
    await readYear();
    await flush();
    expect(hasResult()).toBe(true);
    expect(hasNote()).toBe(true);
    expect(hasCalendar()).toBe(true);
    await marker('data-year-sky-calendar')!.props.onClick();
    await flush();
    expect(downloadCalendarFile).toHaveBeenCalled();
    expect(hasResult()).toBe(true);
    expect(hasNote()).toBe(true);
    expect(hasCalendar()).toBe(true);
    expect(errorText()).toBe('The year could not be worked out. Check the details and try again.');
  });
});
