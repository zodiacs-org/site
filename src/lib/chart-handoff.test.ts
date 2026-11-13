import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeChartLink, encodeChartLink, type ShareChartInput } from './share';
import * as handoffModule from './chart-handoff';
import {
  HANDOFF_STORAGE_PREFIX,
  compatibilityHandoffPath,
  dateHandoffFromHash,
  followWithHandoff,
  hasChartHandoff,
  hasHandoffOrLegacyDetails,
  mineHandoffFromHash,
  profileChartHandoffFragment,
  profileChartIdFromHash,
  profileHandoffOriginsFromHash,
  sessionHandoffAvailable,
  someoneElseHandoffPath,
  someoneElseProfileHandoffPath,
  stashChartHandoff,
  stashDateHandoff,
  subjectModeFromHash,
  takeChartHandoff,
} from './chart-handoff';

/** An in-memory sessionStorage, as a browser tab has. */
class MemoryStorage {
  private readonly items = new Map<string, string>();
  get length(): number { return this.items.size; }
  clear(): void { this.items.clear(); }
  getItem(key: string): string | null { return this.items.get(key) ?? null; }
  key(index: number): string | null { return [...this.items.keys()][index] ?? null; }
  removeItem(key: string): void { this.items.delete(key); }
  setItem(key: string, value: string): void { this.items.set(key, String(value)); }
}

const PERSON: ShareChartInput = {
  date: '1990-06-15',
  time: '14:30',
  timeKnown: true,
  lat: 40.7128,
  lon: -74.006,
  tz: 'America/New_York',
  name: 'A friend',
  place: 'New York',
  houseSystem: 'whole',
};

const MINE: ShareChartInput = {
  ...PERSON,
  date: '1988-02-03',
  name: undefined,
};
const PROFILE_CHART_ID = '11111111-1111-4111-8111-111111111111';

let storage: MemoryStorage;
const handoffKeys = () => {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key?.startsWith(HANDOFF_STORAGE_PREFIX)) keys.push(key);
  }
  return keys;
};

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('sessionStorage', storage);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('the session handoff', () => {
  it('carries only a random key, reads the chart once and deletes it at once', () => {
    const fragment = stashChartHandoff(PERSON)!;
    const params = new URLSearchParams(fragment);
    expect([...params.keys()]).toEqual(['h']);
    expect(params.get('h')).toMatch(/^[0-9a-f]{32}$/u);
    expect(handoffKeys()).toEqual([`${HANDOFF_STORAGE_PREFIX}${params.get('h')}`]);
    expect(hasChartHandoff(`#${fragment}`)).toBe(true);
    expect(takeChartHandoff(`#${fragment}`)).toEqual({ kind: 'chart', input: PERSON, mine: null });
    expect(handoffKeys()).toEqual([]);
    expect(takeChartHandoff(`#${fragment}`)).toBeNull();
  });

  it('makes a new key every time and keeps only the latest entry', () => {
    const first = stashChartHandoff(PERSON)!;
    const second = stashChartHandoff(MINE)!;
    expect(first).not.toBe(second);
    expect(handoffKeys()).toHaveLength(1);
    expect(takeChartHandoff(`#${first}`)).toBeNull();
    const { name: _unusedName, ...mineWithoutName } = MINE;
    expect(takeChartHandoff(`#${second}`)).toMatchObject({ kind: 'chart', input: mineWithoutName });
  });

  it('keeps subject mode and the visitor\'s own unsaved chart off the link', () => {
    const fragment = stashChartHandoff(PERSON, {
      subjectMode: 'other',
      mine: { kind: 'input', input: MINE },
    })!;
    const params = new URLSearchParams(fragment);
    expect(params.get('subject')).toBe('other');
    expect(params.has('mine')).toBe(false);
    expect(params.has('c')).toBe(false);
    expect(subjectModeFromHash(`#${fragment}`)).toBe('other');
    expect(takeChartHandoff(`#${fragment}`)).toEqual({ kind: 'chart', input: PERSON, mine: MINE });
  });

  it('keeps an opaque saved "mine" id and its profile provenance', () => {
    const profileMine = stashChartHandoff(PERSON, {
      mine: { kind: 'saved', id: PROFILE_CHART_ID },
      mineProfileOrigin: true,
    })!;
    expect(profileHandoffOriginsFromHash(profileMine)).toEqual({ chart: false, mine: true });
    expect(mineHandoffFromHash(profileMine)).toEqual({ kind: 'saved', id: PROFILE_CHART_ID });

    const plainMine = new URLSearchParams(stashChartHandoff(PERSON, { mine: { kind: 'saved', id: 'chart-local-1' } })!);
    expect(plainMine.get('mineId')).toBe('chart-local-1');
    expect(plainMine.has('mineSource')).toBe(false);

    const invalidPrivateMine = new URLSearchParams(stashChartHandoff(PERSON, {
      mine: { kind: 'saved', id: 'not-an-opaque-profile-id' },
      mineProfileOrigin: true,
    })!);
    expect(invalidPrivateMine.has('mineId')).toBe(false);
    expect(invalidPrivateMine.has('mineSource')).toBe(false);
  });

  it('hands over a date without a place', () => {
    const timed = stashDateHandoff('2000-01-01', '08:30')!;
    expect([...new URLSearchParams(timed).keys()]).toEqual(['h']);
    expect(takeChartHandoff(`#${timed}`)).toEqual({ kind: 'date', date: '2000-01-01', time: '08:30' });
    const untimed = stashDateHandoff('2000-01-01', null)!;
    expect(takeChartHandoff(untimed)).toEqual({ kind: 'date', date: '2000-01-01', time: null });
    expect(stashDateHandoff('2000-1-1', null)).toBeNull();
    expect(stashDateHandoff('2000-01-01', '8:30')).toBeNull();
  });

  it('carries the visitor\'s own chart into the someone-else route', () => {
    const path = someoneElseHandoffPath(MINE)!;
    expect(path).toMatch(/^\/birth-chart\/someone-else\/#h=[0-9a-f]{32}$/u);
    expect(takeChartHandoff(path.split('#')[1])).toEqual({ kind: 'mine', input: MINE });
  });

  it('can mark the someone-else mine context as profile-derived', () => {
    const path = someoneElseProfileHandoffPath(PROFILE_CHART_ID)!;
    expect(profileHandoffOriginsFromHash(path.split('#')[1])).toEqual({ chart: false, mine: true });
    expect(mineHandoffFromHash(path.split('#')[1])).toEqual({ kind: 'saved', id: PROFILE_CHART_ID });
  });

  it('prefills compatibility sides by session, or by a saved id in the query', () => {
    const both = compatibilityHandoffPath(PERSON, { kind: 'input', input: MINE })!;
    expect(both).toMatch(/^\/compatibility\/#h=[0-9a-f]{32}$/u);
    expect(takeChartHandoff(both.split('#')[1])).toEqual({ kind: 'pair', a: MINE, b: PERSON });

    const saved = new URL(compatibilityHandoffPath(PERSON, { kind: 'saved', id: 'chart-local-1' })!, 'https://zodiacs.org');
    expect(saved.searchParams.get('a')).toBe('chart-local-1');
    expect([...saved.searchParams.keys()]).toEqual(['a']);
    expect(takeChartHandoff(saved.hash)).toEqual({ kind: 'pair', a: null, b: PERSON });

    const alone = compatibilityHandoffPath(PERSON, null)!;
    expect(takeChartHandoff(alone.split('#')[1])).toEqual({ kind: 'pair', a: PERSON, b: null });
  });

  it('reads nothing from a malformed, duplicated, unknown or corrupt key', () => {
    const fragment = stashChartHandoff(PERSON)!;
    const key = new URLSearchParams(fragment).get('h')!;
    expect(takeChartHandoff('#h=not-a-key')).toBeNull();
    expect(takeChartHandoff(`#h=${key}&h=${key}`)).toBeNull();
    expect(takeChartHandoff(`#h=${key.toUpperCase()}`)).toBeNull();
    expect(takeChartHandoff(`#h=${'0'.repeat(32)}`)).toBeNull();
    expect(takeChartHandoff('')).toBeNull();
    storage.setItem(`${HANDOFF_STORAGE_PREFIX}${'a'.repeat(32)}`, '{not json');
    expect(takeChartHandoff(`#h=${'a'.repeat(32)}`)).toBeNull();
    expect(storage.getItem(`${HANDOFF_STORAGE_PREFIX}${'a'.repeat(32)}`)).toBeNull();
    storage.setItem(`${HANDOFF_STORAGE_PREFIX}${'b'.repeat(32)}`, JSON.stringify({ k: 'chart', c: 'not a token' }));
    expect(takeChartHandoff(`#h=${'b'.repeat(32)}`)).toBeNull();
    storage.setItem(`${HANDOFF_STORAGE_PREFIX}${'c'.repeat(32)}`, JSON.stringify({ k: 'pair' }));
    expect(takeChartHandoff(`#h=${'c'.repeat(32)}`)).toBeNull();
  });

  it('offers no handoff at all when sessionStorage cannot be used', () => {
    vi.stubGlobal('sessionStorage', undefined);
    expect(sessionHandoffAvailable()).toBe(false);
    expect(stashChartHandoff(PERSON)).toBeNull();
    expect(stashDateHandoff('2000-01-01', null)).toBeNull();
    expect(someoneElseHandoffPath(MINE)).toBeNull();
    expect(compatibilityHandoffPath(PERSON, null)).toBeNull();
    expect(takeChartHandoff(`#h=${'a'.repeat(32)}`)).toBeNull();

    const full = new MemoryStorage();
    full.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    vi.stubGlobal('sessionStorage', full);
    expect(sessionHandoffAvailable()).toBe(false);
    expect(stashChartHandoff(PERSON)).toBeNull();
    expect(compatibilityHandoffPath(PERSON, { kind: 'input', input: MINE })).toBeNull();
  });

  it('follows a plain click with the key and leaves other clicks to the plain link', () => {
    const assign = vi.fn();
    vi.stubGlobal('window', { location: { assign } });
    const click = (init: Partial<MouseEvent> = {}) => ({
      defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
      preventDefault: vi.fn(), ...init,
    }) as unknown as MouseEvent;

    const plain = click();
    followWithHandoff(plain, () => '/birth-chart/#h=abc');
    expect(plain.preventDefault).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith('/birth-chart/#h=abc');

    const make = vi.fn(() => '/birth-chart/#h=abc');
    const newTab = click({ metaKey: true });
    followWithHandoff(newTab, make);
    expect(make).not.toHaveBeenCalled();
    expect(newTab.preventDefault).not.toHaveBeenCalled();

    const unavailable = click();
    followWithHandoff(unavailable, () => null);
    expect(unavailable.preventDefault).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledOnce();
  });
});

describe('saved charts and legacy links', () => {
  it('moves a saved chart by its opaque id only', () => {
    const fragment = profileChartHandoffFragment(PROFILE_CHART_ID)!;
    expect(profileChartIdFromHash(fragment)).toBe(PROFILE_CHART_ID);
    expect(profileHandoffOriginsFromHash(fragment)).toEqual({ chart: true, mine: false });
    expect(profileChartHandoffFragment('birth details instead of an opaque id')).toBeNull();
  });

  it('fails closed to public provenance for duplicate or malformed origin markers', () => {
    expect(profileHandoffOriginsFromHash('#profileChartId=a&profileChartId=a'))
      .toEqual({ chart: false, mine: false });
    expect(profileHandoffOriginsFromHash('#mineSource=saved')).toEqual({ chart: false, mine: false });
    expect(profileHandoffOriginsFromHash('#mine=anything&mineSource=profile'))
      .toEqual({ chart: false, mine: false });
  });

  it('defaults unmarked and malformed subject context to self', () => {
    expect(subjectModeFromHash('#c=anything')).toBe('self');
    expect(subjectModeFromHash('#subject=other&subject=self')).toBe('self');
  });

  it('still reads a legacy #mine= link and a legacy #date= link', () => {
    expect(mineHandoffFromHash(`#mine=${encodeChartLink(MINE)}`)).toEqual({ kind: 'input', input: MINE });
    expect(dateHandoffFromHash('#date=2000-01-01&time=08%3A30')).toEqual({ date: '2000-01-01', time: '08:30' });
    expect(dateHandoffFromHash('#date=2000-01-01&time=unknown')).toEqual({ date: '2000-01-01', time: null });
    for (const hash of ['#date=2000-01-01', '#time=unknown', '#date=2000-1-1&time=unknown', '#date=2000-01-01&time=8:30',
      '#date=2000-01-01&date=2000-01-02&time=unknown', '#date=2000-01-01&time=unknown&subject=other', '#c=1.abc&date=2000-01-01', '']) {
      expect(dateHandoffFromHash(hash), hash).toBeNull();
    }
  });

  it('knows which fragments must be stripped', () => {
    for (const hash of ['#c=1.x', '#mine=1.x', '#a=1.x', '#b=1.x', '#date=2000-01-01&time=unknown', `#h=${'a'.repeat(32)}`]) {
      expect(hasHandoffOrLegacyDetails(hash), hash).toBe(true);
    }
    for (const hash of ['', '#profileChartId=x', '#p=2.x', '#invite=abc']) {
      expect(hasHandoffOrLegacyDetails(hash), hash).toBe(false);
    }
  });
});

/*
 * Decision A: no function this module exports may return a string from which
 * a birth date, a birth time, a birthplace or a name can be read or worked
 * back out. Every exported function is called with a distinctive, fictional
 * chart in every argument shape the module's writers take; the results are
 * checked, and the values themselves are never printed.
 */
describe('no exported function writes birth details into a string', () => {
  const FIXTURE: ShareChartInput = {
    date: '1911-04-23',
    time: '05:47',
    timeKnown: true,
    lat: 61.2345,
    lon: -149.8765,
    tz: 'America/Anchorage',
    name: 'Ottoline Vex',
    place: 'Quillhaven',
    houseSystem: 'placidus',
  };
  const OTHER: ShareChartInput = { ...FIXTURE, date: '1913-09-02', name: 'Bramwell Ash', place: 'Gorsemoor' };
  const SECRETS: Record<string, string[]> = {
    date: ['1911', '1913', '04-23', '09-02', '19110423'],
    time: ['05:47', '05%3A47', '0547'],
    place: ['Quillhaven', 'Gorsemoor', '61.2345', '149.8765', 'Anchorage'],
    name: ['Ottoline', 'Vex', 'Bramwell', 'Ash'],
  };

  const KEY = /^[0-9a-f]{32}$/u;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

  function base64Text(value: string): string {
    if (KEY.test(value) || UUID.test(value) || !/^[A-Za-z0-9_+/=.-]{8,}$/u.test(value)) return '';
    try {
      return Buffer.from(value.replace(/^\d+\./u, ''), 'base64url').toString('utf8');
    } catch {
      return '';
    }
  }

  /** Which kinds of detail a string gives away, by name only. */
  function leaks(raw: string): string[] {
    // A random handoff key is checked for its shape, not for digits it may hold by chance.
    const written = raw.replace(/([#&?]|^)h=([0-9a-f]{32})(?=&|$)/gu, '$1h=KEY');
    const views = [written];
    try { views.push(decodeURIComponent(written)); } catch { /* keep the raw view */ }
    const [beforeHash, hash = ''] = written.split('#');
    const query = beforeHash.includes('?') ? beforeHash.split('?')[1] : '';
    const values = [...new URLSearchParams(hash), ...new URLSearchParams(query), ...new URLSearchParams(written)]
      .map(([, value]) => value);
    for (const value of values) views.push(value, base64Text(value));
    const found = Object.entries(SECRETS)
      .filter(([, needles]) => views.some((view) => needles.some((needle) => view.includes(needle))))
      .map(([kind]) => kind);
    if (/(?:^|[=#&?])\d+\.[A-Za-z0-9_-]{8,}/u.test(written)) found.push('share token');
    if ([written, ...values].some((value) => decodeChartLink(value) !== null)) found.push('decodable chart');
    return found;
  }

  const argumentShapes: unknown[][] = [
    [FIXTURE],
    [FIXTURE, { subjectMode: 'other' }],
    [FIXTURE, { subjectMode: 'other', mine: { kind: 'input', input: OTHER } }],
    [FIXTURE, { mine: { kind: 'saved', id: PROFILE_CHART_ID }, mineProfileOrigin: true }],
    [FIXTURE, { kind: 'input', input: OTHER }],
    [FIXTURE, { kind: 'saved', id: PROFILE_CHART_ID }],
    [FIXTURE, null],
    [PROFILE_CHART_ID],
  ];
  /** Date writers take the date and time on their own (a path argument would echo them back). */
  const dateShapes: unknown[][] = [[FIXTURE.date, FIXTURE.time], [FIXTURE.date, null]];

  it('holds for every string any export returns', () => {
    const writers = new Set<string>();
    for (const [exportName, value] of Object.entries(handoffModule)) {
      if (typeof value !== 'function') continue;
      const shapes = /date/iu.test(exportName) ? [...argumentShapes, ...dateShapes] : argumentShapes;
      for (const args of shapes) {
        let result: unknown;
        try {
          result = (value as (...a: unknown[]) => unknown)(...args);
        } catch {
          continue;
        }
        if (typeof result !== 'string') continue;
        if (result.length > 0) writers.add(exportName);
        expect(leaks(result), `${exportName} with argument shape ${shapes.indexOf(args)}`).toEqual([]);
      }
    }
    // The writers that hand charts over were all exercised.
    for (const name of ['stashChartHandoff', 'stashDateHandoff', 'someoneElseHandoffPath', 'compatibilityHandoffPath',
      'profileChartHandoffFragment', 'someoneElseProfileHandoffPath']) {
      expect(writers.has(name), name).toBe(true);
    }
  });

  it('would catch a writer that put a chart token in its result', () => {
    expect(leaks(`/birth-chart/#c=${encodeChartLink(FIXTURE)}`).length).toBeGreaterThan(0);
    expect(leaks('/birth-chart/#date=1911-04-23&time=05%3A47')).toEqual(expect.arrayContaining(['date', 'time']));
  });
});
