import type { VNode } from 'preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  slots: [] as unknown[], cursor: 0,
  effects: [] as Array<{ dependencies: unknown[]; cleanup?: () => void }>,
  effectCursor: 0, pending: [] as Array<() => void>,
  result: null as unknown,
  download: vi.fn(),
}));
// The component's own hooks, run in order on each call, as the return calculators' recovery test runs them.
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
vi.mock('../lib/engine/returns', () => ({ saturnReturns: () => harness.result }));
vi.mock('../lib/ical-download', () => ({ downloadCalendarFile: harness.download }));

import SaturnReturnCalculator from './SaturnReturnCalculator';
import { BirthDateField } from './BirthFields';
import { t } from '../lib/i18n';
import { icalHash } from '../lib/ical';

const crossing = (iso: string, retrograde = false) => ({ at: new Date(iso), retrograde });
const season = (index: number, ...crossings: ReturnType<typeof crossing>[]) => ({
  index, crossings, first: crossings[0].at, last: crossings.at(-1)!.at,
});
const RESULT = {
  natalLon: 286.123456, natalRetrograde: false, rangeClipped: false, searched: null,
  seasons: [
    season(1, crossing('2019-03-21T23:40:12Z'), crossing('2019-08-12T04:05:06Z', true), crossing('2019-12-16T10:00:00Z')),
    season(2, crossing('2048-02-03T15:16:17Z')),
  ],
};

function render(locale: 'en' | 'es' = 'en') {
  harness.cursor = 0; harness.effectCursor = 0;
  const view = SaturnReturnCalculator({ locale });
  harness.pending.splice(0).forEach((effect) => effect());
  return view;
}
function nodes(value: unknown): VNode<Record<string, any>>[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== 'object' || !('props' in value)) return [];
  const node = value as VNode<Record<string, any>>;
  return [node, ...nodes(node.props.children)];
}
const find = (locale: 'en' | 'es', match: (node: VNode<Record<string, any>>) => boolean) => nodes(render(locale)).find(match);
const button = (locale: 'en' | 'es' = 'en') => find(locale, (node) => node.type === 'button' && 'data-saturn-calendar' in node.props);
async function calculate(locale: 'en' | 'es' = 'en') {
  find(locale, (node) => node.type === BirthDateField)!.props.onDateChange('1990-01-04');
  await find(locale, (node) => node.type === 'form')!.props.onSubmit({ preventDefault() {} });
}

beforeEach(() => {
  harness.slots = []; harness.cursor = 0; harness.effects = []; harness.effectCursor = 0; harness.pending = [];
  harness.result = RESULT;
  harness.download.mockReset();
  vi.stubGlobal('window', new EventTarget());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  harness.effects.forEach((effect) => effect.cleanup?.());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Saturn return calendar download', () => {
  it('offers the file once there is a return season, built on the device with no request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(button()).toBeUndefined();
    await calculate();
    const offered = button()!;
    expect(nodes(offered.props.children).find((node) => node.type === 'span')?.props.children).toBe('Download calendar (.ics)');
    await offered.props.onClick();
    await vi.waitFor(() => expect(harness.download).toHaveBeenCalledOnce());
    const [calendar, filename] = harness.download.mock.calls[0];
    expect(filename).toBe('zodiacs-saturn-return.ics');
    expect(calendar).toContain('DTSTART;VALUE=DATE:20190812');
    expect(calendar).toContain('SUMMARY:Saturn return · First return · 2/3 · retrograde pass');
    // A date alone is a noon reading, and the file warns that dates and pass counts can change.
    expect(calendar.replace(/\r\n /g, '')).toContain('Dates computed from a noon reading.');
    expect(calendar.replace(/\r\n /g, '')).toContain('retrograde passes can be added or removed');
    expect(calendar).not.toMatch(/1990|286\.1|Capricorn/);
    expect(fetch).not.toHaveBeenCalled();
    expect(button()!.props.disabled).toBe(false);
    const note = find('en', (node) => 'data-saturn-calendar-note' in node.props)?.props.children as string;
    expect(note).toContain('narrow down your birth date');
    expect(note).toContain('remove the earlier events first');
    expect(note).not.toMatch(/[\u2013\u2014]/);
  });

  it('puts every pass the page lists in the file, two on one UTC date included', async () => {
    harness.result = {
      ...RESULT,
      seasons: [
        season(1, crossing('2027-08-09T12:57:43Z'), crossing('2027-08-09T23:14:33Z', true), crossing('2028-03-27T04:31:06Z')),
        season(2, crossing('2057-05-02T16:04:22Z')),
      ],
    };
    await calculate();
    const listed = nodes(render()).filter((node) => node.type === 'li' && String(node.key).startsWith('2027-08-09'));
    expect(listed).toHaveLength(2);
    await button()!.props.onClick();
    await vi.waitFor(() => expect(harness.download).toHaveBeenCalledOnce());
    const [calendar] = harness.download.mock.calls[0] as [string];
    const lines = calendar.replace(/\r\n /g, '').split('\r\n');
    // Each UID carries the file's schedule tag: every pass's return, number, UTC date and direction, as the events show.
    const tag = icalHash(['1:1:20270809:d', '1:2:20270809:r', '1:3:20280327:d', '2:1:20570502:d']);
    expect(lines.filter((line) => line.startsWith('UID:'))).toEqual([
      `UID:saturn-return-${tag}-1-pass-1-20270809@zodiacs.org`, `UID:saturn-return-${tag}-1-pass-2-20270809@zodiacs.org`,
      `UID:saturn-return-${tag}-1-pass-3-20280327@zodiacs.org`, `UID:saturn-return-${tag}-2-pass-1-20570502@zodiacs.org`,
    ]);
    expect(lines.filter((line) => line === 'DTSTART;VALUE=DATE:20270809')).toHaveLength(2);
    expect(lines.filter((line) => line === 'BEGIN:VALARM')).toHaveLength(4);
    expect(lines).toContain('SUMMARY:Saturn return · First return · 2/3 · retrograde pass');
    const withoutDtstamp = lines.filter((line) => !line.startsWith('DTSTAMP:'));
    expect(lines.filter((line) => line.startsWith('DTSTAMP:'))).toHaveLength(4);
    expect(withoutDtstamp.join('\n')).not.toMatch(/12:57|23:14|T1257|T2314/);
    expect(withoutDtstamp.filter((line) => /\d{8}T\d{6}/.test(line))).toEqual([]);
    expect(button()!.props['aria-describedby']).toBe('sr-calendar-note');
  });

  it('writes the page’s language', async () => {
    await calculate('es');
    const offered = button('es')!;
    expect(nodes(offered.props.children).find((node) => node.type === 'span')?.props.children).toBe('Descargar calendario (.ics)');
    await offered.props.onClick();
    await vi.waitFor(() => expect(harness.download).toHaveBeenCalledOnce());
    expect(harness.download.mock.calls[0][0]).toContain('X-WR-CALNAME:Retorno de Saturno');
  });

  it('offers nothing without a return season', async () => {
    harness.result = { ...RESULT, seasons: [] };
    await calculate();
    expect(find('en', (node) => node.props.class === 'calc__result')).toBeDefined();
    expect(button()).toBeUndefined();
  });

  it('explains a download that could not start, and clears it with new input', async () => {
    harness.download.mockImplementation(() => { throw new Error('blocked'); });
    await calculate();
    await button()!.props.onClick();
    const alert = () => find('en', (node) => 'data-saturn-calendar-error' in node.props);
    await vi.waitFor(() => expect(alert()?.props.children).toBe(t('en', 'chartReceiptError')));
    find('en', (node) => node.type === BirthDateField)!.props.onDateChange('1990-01-05');
    expect(alert()).toBeUndefined();
  });
});
