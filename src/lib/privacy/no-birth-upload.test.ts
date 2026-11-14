/**
 * No birth details leave the device or are stored. One fixture of values that
 * cannot be mistaken for anything else is driven through every builder that
 * writes to the account or answers a retired link, and every captured value
 * is searched for it: as written, URL decoded, each query or fragment value
 * on its own, base64 and base64url decoded (every token of 8 or more
 * characters, with and without the key before it), and JSON parsed,
 * repeatedly. Numbers are searched too, alone and in lists.
 *
 * It fails on any fixture value in a common form, on a number within a
 * twentieth of a degree of the fixture's latitude or longitude, on a
 * YYYY-MM-DD date outside a short allowlist (the save time, the week's start
 * and days, a non-birth occasion's own day), and on a list of ten or more
 * numbers between 0 and 360 (a positions list, whether plain numbers or
 * placements such as { body, lon }, held as numbers or as numeric strings).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ client: null as unknown }));
const device = vi.hoisted(() => ({ profile: null as unknown, deletions: [] as unknown[] }));

vi.mock('../supabase/client', () => ({
  getSupabaseClient: () => fake.client,
  isSupabaseConfigured: () => true,
}));
vi.mock('../profile/store', () => ({
  loadProfile: () => device.profile,
  replaceProfile: () => true,
}));
vi.mock('../profile/deletions', () => ({
  loadChartDeletions: () => device.deletions,
  replaceChartDeletions: () => true,
  recordChartDeletion: () => true,
}));

import { fakeSupabase, type FakeRequest } from './fake-supabase';
import { syncNow, getChartSaveStatus } from '../profile/sync';
import { comparisonSavedPage } from '../profile/comparison-link';
import { occasionSavedPage } from '../occasions/saved-path';
import {
  PENDING_SAVE_KEY,
  RETIRED_PENDING_SAVE_KEY,
  peekPendingSave,
  savedPageWriteDraft,
  stashPendingSave,
  takePendingSave,
} from '../profile/saved-pages-config';
import { saveSavedPage } from '../profile/saved-pages-cloud';
import { encodeChartLink } from '../share';
import { encodePositionsLink, POSITION_BODY_ORDER } from '../share-positions';
import { saveInput } from '../../ai-tools/accounts/contracts';
import { buildSavedRecord } from '../../ai-tools/accounts/save';
import { savedPageRpcArgs } from '../../ai-tools/accounts/service';
import { handleChartImageRequest, handleChartLinkRequest } from '../../server/chart-preview';
import {
  handleChineseZodiacImageRequest,
  handleChineseZodiacLinkRequest,
  handleChineseZodiacStoryRequest,
  handleCompatibilityImageRequest,
  handleCompatibilityLinkRequest,
  handleCompatibilityStoryRequest,
  handleMilestoneImageRequest,
  handleMilestoneLinkRequest,
  handleMilestoneStoryRequest,
  handleOccasionImageRequest,
  handleOccasionLinkRequest,
  handleOccasionStoryRequest,
} from '../../server/result-preview';

// ── The fixture ──────────────────────────────────────────────────────

const BIRTH = {
  date: '1987-03-14',
  time: '04:27',
  zone: 'Asia/Almaty',
  latitude: 43.2567,
  longitude: 76.9286,
  place: 'Zzyzx Canary',
  names: ['Qwertina', 'Zolvar'] as const,
};

/** Every common form of a fixture value. */
const FORBIDDEN: readonly (string | RegExp)[] = [
  '1987-03-14', '19870314', '14 March 1987', /March\s+14/iu, '04:27', /(?<!\d)4:27/u,
  /almaty/iu, /zzyzx/iu, /qwertina/iu, /zolvar/iu, '43.25', '76.92',
];

/** The save time, set for the whole test. */
const NOW = new Date('2026-10-15T09:00:00.000Z');
const SAVE_DAY = '2026-10-15';
/** A wedding is not a birth occasion: its own day may be kept. */
const WEDDING_DAY = '2027-06-12';

const savedChart = {
  id: '11111111-1111-4111-8111-111111111111',
  name: BIRTH.names[0],
  relationship: 'self',
  createdAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  birth: {
    date: BIRTH.date,
    time: BIRTH.time,
    timeKnown: true,
    place: { name: BIRTH.place, admin1: BIRTH.place, country: 'KZ', lat: BIRTH.latitude, lon: BIRTH.longitude, tz: BIRTH.zone },
  },
  summary: {
    engineVersion: '0.1.0',
    utcISO: `${BIRTH.date}T22:27:00.000Z`,
    houseSystem: 'whole',
    bodies: POSITION_BODY_ORDER.map((body, index) => ({ body, lon: 3.1 + index * 29.7, retrograde: false })),
    angles: { asc: 101.5, mc: 11.5 },
    flags: [],
  },
};

const person = { name: BIRTH.names[0], birthDate: BIRTH.date, time: BIRTH.time, zone: BIRTH.zone, latitude: BIRTH.latitude, longitude: BIRTH.longitude, place: BIRTH.place };
const otherPerson = { ...person, name: BIRTH.names[1] };

// ── The search ───────────────────────────────────────────────────────

const PRINTABLE = /^[\p{L}\p{N}\p{P}\p{S}\p{Zs}\n\r\t]*$/u;

function decodeBase64(token: string, url: boolean): string | null {
  const text = url ? token.replace(/-/gu, '+').replace(/_/gu, '/') : token;
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(text)) return null;
  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(text, 'base64'));
    return decoded.length >= 4 && PRINTABLE.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function inRange(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 360;
}

/** A number, or a finite number written as text such as a form field's "43.26" or String(1e-7)'s "1e-7"; anything else is null. */
function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!/^-?\d+(?:\.\d+)?(?:e[-+]?\d+)?$/iu.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

/** The numbers among a list's items, and among the fields of each item that is itself an object or a list, numbers written as text included. */
function numbersIn(values: readonly unknown[]): number[][] {
  const numeric = (items: readonly unknown[]) => items.map(asNumber).filter((item): item is number => item !== null);
  const own = numeric(values);
  const inner = values.flatMap((item) => (item && typeof item === 'object' ? numeric(Object.values(item)) : []));
  return [own, inner];
}

/** The values of a query or fragment, such as `?payload=...&b=2` or `#state=...`, each on its own. */
function queryValues(value: string): string[] {
  const values: string[] = [];
  for (const part of value.split(/[?#&;]/u)) {
    const at = part.indexOf('=');
    if (at < 0) continue;
    const raw = part.slice(at + 1);
    values.push(raw);
    try { values.push(decodeURIComponent(raw.replace(/\+/gu, ' '))); } catch { /* not URL encoded */ }
  }
  return values;
}

/** Every string reachable from a value, with what each decodes to, every number and every list of numbers. */
function collect(value: unknown, strings: Set<string>, numberLists: number[][], numbers: number[], depth = 0): void {
  if (depth > 12) return;
  if (typeof value === 'number') {
    numbers.push(value);
    // A number's own text, so 19870314 is read as the date it spells.
    collect(String(value), strings, numberLists, numbers, depth + 1);
    return;
  }
  if (typeof value === 'string') {
    if (strings.has(value)) return;
    strings.add(value);
    // A number written as text, such as a form field's "43.26".
    const number = asNumber(value);
    if (number !== null) numbers.push(number);
    const variants = new Set<string>();
    try { variants.add(decodeURIComponent(value)); } catch { /* not URL encoded */ }
    try { variants.add(decodeURIComponent(value.replace(/\+/gu, ' '))); } catch { /* not form encoded */ }
    for (const item of queryValues(value)) variants.add(item);
    // Tokens with '=' kept (base64 padding) and with '=' as a boundary (a key before the value).
    const tokens = new Set([...(value.match(/[A-Za-z0-9+/_=-]{8,}/gu) ?? []), ...(value.match(/[A-Za-z0-9+/_-]{8,}={0,2}/gu) ?? [])]);
    for (const token of tokens) {
      for (const url of [false, true]) {
        const decoded = decodeBase64(token, url);
        if (decoded !== null) variants.add(decoded);
      }
    }
    const trimmed = value.trim();
    if (/^[[{"]/u.test(trimmed)) {
      try { collect(JSON.parse(trimmed), strings, numberLists, numbers, depth + 1); } catch { /* not JSON */ }
    }
    for (const variant of variants) if (variant !== value) collect(variant, strings, numberLists, numbers, depth + 1);
    // A run of numbers in text, such as "12.5, 40.1, ...".
    for (const run of value.match(/-?\d+(?:\.\d+)?(?:[\s,;|]+-?\d+(?:\.\d+)?){9,}/gu) ?? []) {
      numberLists.push(run.split(/[\s,;|]+/u).map(Number));
    }
    return;
  }
  if (Array.isArray(value)) {
    // A list's own numbers, and one level down, such as [{ body, lon }, ...] or [[lon], ...].
    numberLists.push(...numbersIn(value));
    for (const item of value) collect(item, strings, numberLists, numbers, depth + 1);
    return;
  }
  if (value && typeof value === 'object') {
    // An object's own numbers, and one level down, such as { sun: { lon }, moon: { lon }, ... }.
    numberLists.push(...numbersIn(Object.values(value as Record<string, unknown>)));
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      collect(key, strings, numberLists, numbers, depth + 1);
      collect(item, strings, numberLists, numbers, depth + 1);
    }
  }
}

/** Within a twentieth of a degree (about 5 km) of the fixture's latitude or longitude: rounded forms are found too. */
const nearFixture = (value: number) => [BIRTH.latitude, BIRTH.longitude].some((coordinate) => Math.abs(value - coordinate) < 0.05);

/** The problems found in a captured value; empty when it holds no birth detail. */
function birthDetailsIn(value: unknown, allowedDates: readonly string[] = []): string[] {
  const strings = new Set<string>();
  const numberLists: number[][] = [];
  const numbers: number[] = [];
  collect(value, strings, numberLists, numbers);
  const problems: string[] = [];
  for (const number of numbers) if (nearFixture(number)) problems.push(`the number ${number}, the fixture's latitude or longitude`);
  const allowed = new Set([SAVE_DAY, ...allowedDates]);
  for (const text of strings) {
    for (const form of FORBIDDEN) {
      if (typeof form === 'string' ? text.includes(form) : form.test(text)) problems.push(`${String(form)} in ${JSON.stringify(text.slice(0, 160))}`);
    }
    for (const date of text.match(/(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/gu) ?? []) {
      if (!allowed.has(date)) problems.push(`date ${date} in ${JSON.stringify(text.slice(0, 160))}`);
    }
  }
  for (const list of numberLists) {
    const positions = list.filter(inRange);
    if (positions.length >= 10) problems.push(`a list of ${positions.length} numbers between 0 and 360: ${JSON.stringify(list.slice(0, 12))}`);
  }
  return [...new Set(problems)];
}

function expectNoBirthDetails(label: string, value: unknown, allowedDates: readonly string[] = []): void {
  expect(birthDetailsIn(value, allowedDates), label).toEqual([]);
}

/** Days from the week's start, inclusive of the eighth so a week's end is covered. */
function weekDays(from: string): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  return Array.from({ length: 9 }, (_, index) => new Date(start + (index - 1) * 86_400_000).toISOString().slice(0, 10));
}

// ── The search itself finds the fixture ──────────────────────────────

describe('the search', () => {
  it('finds the fixture however it is written', () => {
    const shareLink = `/compatibility/#a=${encodeChartLink({ date: BIRTH.date, time: BIRTH.time, timeKnown: true, lat: BIRTH.latitude, lon: BIRTH.longitude, tz: BIRTH.zone, houseSystem: 'whole' })}`;
    const encoded = encodeURIComponent(JSON.stringify({ title: 'x', at: `${BIRTH.date}T00:00:00Z` }));
    const positions = { bodies: savedChart.summary.bodies.map((body) => body.lon) };
    const base64Name = Buffer.from(JSON.stringify({ n: 'Qwertina' })).toString('base64');
    for (const value of [shareLink, encoded, positions, base64Name, '/occasions/#o=birthday&d=1987-03-14', 'Born 14 March 1987', 'Asia%2FAlmaty', { lat: '43.2567' }, 'at 4:27 am']) {
      expect(birthDetailsIn(value), JSON.stringify(value)).not.toEqual([]);
    }
    expect(birthDetailsIn(['/compatibility/aries-leo/', 'Leo and Aries · compatibility', `${SAVE_DAY}T09:00:00.000Z`, '/share/birthday/?d=03-14'])).toEqual([]);
  });

  it('finds coordinates held as numbers, alone or rounded', () => {
    for (const value of [
      { latitude: BIRTH.latitude, longitude: BIRTH.longitude },
      [BIRTH.latitude, BIRTH.longitude],
      { place: { lat: 43.26, lon: 76.93 } },
      { at: 19870314 },
      { lat: '43.26' },
    ]) {
      expect(birthDetailsIn(value), JSON.stringify(value)).not.toEqual([]);
    }
    expect(birthDetailsIn({ lat: 43.77, lon: 11.26, score: 76, rating: 43 })).toEqual([]);
  });

  it('finds positions held as a list of placements', () => {
    const placements = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']
      .map((body, index) => ({ body, lon: 3.1 + index * 29.7 }));
    expect(placements).toHaveLength(10);
    for (const value of [placements, { bodies: placements }, { chart: { bodies: placements.map(({ lon }) => [lon]) } }]) {
      expect(birthDetailsIn(value), JSON.stringify(value).slice(0, 80)).not.toEqual([]);
    }
  });

  it('finds positions written as numeric strings, alone or in a query payload', () => {
    const bodies = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
    const placements = bodies.map((body, index) => ({ body, lon: String(3.1 + index * 29.7) }));
    const numbered = Array.from({ length: 10 }, (_, index) => ({ body: String(index), lon: String(3.1 + index * 29.7) }));
    const lons = placements.map(({ lon }) => lon);
    const payload = Buffer.from(JSON.stringify({ bodies: placements })).toString('base64url');
    const listPayload = Buffer.from(JSON.stringify(lons)).toString('base64url');
    for (const value of [
      placements,
      { bodies: placements },
      { bodies: numbered },
      `/x/?payload=${Buffer.from(JSON.stringify({ bodies: numbered })).toString('base64url')}`,
      lons,
      { chart: { bodies: lons.map((lon) => [lon]) } },
      Object.fromEntries(placements.map(({ body, lon }) => [body, { lon }])),
      JSON.stringify({ bodies: placements }),
      `/x/?payload=${payload}`,
      `/x/?a=1&p=${listPayload}&b=2`,
      { href: `/x/#state=${payload}` },
    ]) {
      expect(birthDetailsIn(value), JSON.stringify(value).slice(0, 80)).not.toEqual([]);
    }
    // Nine are not a positions list, and neither are ten strings that are not numbers.
    expect(birthDetailsIn(placements.slice(0, 9))).toEqual([]);
    expect(birthDetailsIn(bodies.map((body, index) => ({ body, lon: `${index}th` })))).toEqual([]);
  });

  it('finds positions written in scientific notation, alone or in a query payload', () => {
    const bodies = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
    const placements = bodies.map((body, index) => ({ body, lon: String(index ? 3.1 + index * 29.7 : 1e-7) }));
    expect(placements[0].lon).toBe('1e-7');
    const payload = Buffer.from(JSON.stringify({ bodies: placements })).toString('base64url');
    for (const value of [placements, { bodies: placements }, `/x/?payload=${payload}`, { href: `/x/#state=${payload}` }]) {
      expect(birthDetailsIn(value), JSON.stringify(value).slice(0, 80)).not.toEqual([]);
    }
    for (const text of ['1e-7', '1E-7', '1.2e-3', '-4e+2', String(1e-7), String(1e21), ' 43.26 ']) {
      expect(asNumber(text), text).toBe(Number(text));
    }
    for (const text of ['', ' ', 'e5', '1e', '1e-', '.5e1', '0x10', '0b1', 'Infinity', '-Infinity', 'NaN', '1e400', '12th', '1_000']) {
      expect(asNumber(text), JSON.stringify(text)).toBeNull();
    }
    // Nine in scientific notation are still not a positions list.
    expect(birthDetailsIn(placements.slice(0, 9))).toEqual([]);
  });

  it('finds an encoded name or date in a query value, whatever key comes before it', () => {
    const named = Buffer.from(JSON.stringify({ n: BIRTH.names[0] })).toString('base64url');
    const dated = Buffer.from(JSON.stringify({ d: BIRTH.date, padding: '??>>' })).toString('base64url');
    const plain = Buffer.from(JSON.stringify({ n: BIRTH.names[1] })).toString('base64');
    for (const value of [
      `https://zodiacs.org/x/?payload=${named}`,
      `/x/?a=1&payload=${dated}&b=2`,
      `/x/#state=${named}`,
      `/x/?data=${encodeURIComponent(plain)}`,
      { href: `/x/?payload=${named}` },
    ]) {
      expect(birthDetailsIn(value), JSON.stringify(value)).not.toEqual([]);
    }
  });
});

// ── 1. The old chart sync ────────────────────────────────────────────

describe('the old chart sync', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('reads and deletes only: nothing written to charts, and no birth detail in any write', async () => {
    device.profile = { version: 1, settings: { houseSystem: 'whole' }, charts: [savedChart, { ...savedChart, id: '44444444-4444-4444-8444-444444444444', name: BIRTH.names[1] }] };
    device.deletions = [{ id: '33333333-3333-4333-8333-333333333333', deletedAt: NOW.toISOString() }];
    const db = fakeSupabase({
      profiles: [{ settings: { houseSystem: 'whole' } }],
      charts: [
        { id: savedChart.id, payload: savedChart, updated_at: NOW.toISOString() },
        { id: '33333333-3333-4333-8333-333333333333', payload: { ...savedChart, id: '33333333-3333-4333-8333-333333333333' }, updated_at: '2026-01-01T00:00:00.000Z' },
      ],
      chart_deletions: [],
    });
    fake.client = db.client;

    await expect(syncNow()).resolves.toBe(true);
    expect(getChartSaveStatus()).toBe('paused');

    const writes: FakeRequest[] = db.requests.filter((request) => request.op !== 'select');
    expect(writes.filter((request) => request.table === 'charts' && ['insert', 'upsert', 'update'].includes(request.op))).toEqual([]);
    expect(db.requests.some((request) => request.table === 'charts' && request.op === 'select')).toBe(true);
    expect(writes.some((request) => request.table === 'charts' && request.op === 'delete')).toBe(true);
    expectNoBirthDetails('old sync writes', writes);
  });
});

// ── 2. The site's own saves ──────────────────────────────────────────

describe('the site’s saved pages', () => {
  it('saves a compatibility reading as its two Sun signs only', () => {
    for (const draft of [comparisonSavedPage('pisces', 'pisces'), comparisonSavedPage(null, 'pisces')]) {
      expect(savedPageWriteDraft(draft)).toEqual(draft);
      expectNoBirthDetails('compatibility save', draft);
    }
  });

  it('saves a birthday card as the occasions page, and a wedding card without names or a place', () => {
    const almaty = { tz: BIRTH.zone, lat: BIRTH.latitude, lon: BIRTH.longitude };
    const birthday = occasionSavedPage({ occasion: 'birthday', date: BIRTH.date, time: BIRTH.time, city: almaty }, 'A birthday under a Pisces Sun');
    expect(birthday).toEqual({ kind: 'occasion', title: 'Birthday card', href: '/occasions/' });
    expect(savedPageWriteDraft(birthday)).toEqual(birthday);
    expectNoBirthDetails('birthday save', birthday);
    for (const occasion of ['baby', 'coming-of-age']) {
      const draft = occasionSavedPage({ occasion, date: BIRTH.date, time: BIRTH.time, city: almaty }, 'A card');
      expect(draft.href, occasion).toBe('/occasions/');
      expectNoBirthDetails(`${occasion} save`, draft);
    }
    const florence = { tz: 'Europe/Rome', lat: 43.7696, lon: 11.2558 };
    const wedding = occasionSavedPage({ occasion: 'wedding', date: WEDDING_DAY, time: '17:00', city: florence }, 'A wedding under a Gemini Sun');
    expect(wedding.href).toBe('/occasions/#o=wedding&d=2027-06-12&t=17%3A00&tz=Europe%2FRome&lat=43.77&lon=11.26');
    expect(savedPageWriteDraft(wedding)).toEqual(wedding);
    expectNoBirthDetails('wedding save', wedding, [WEDDING_DAY]);
  });
});

// ── 3. The write rule and the waiting item ───────────────────────────

describe('the write rule', () => {
  const shareToken = (name: string) => encodeChartLink({ date: BIRTH.date, time: BIRTH.time, timeKnown: true, lat: BIRTH.latitude, lon: BIRTH.longitude, tz: BIRTH.zone, name, place: BIRTH.place, houseSystem: 'whole' });
  const oldCompatibility = { kind: 'compatibility' as const, title: `${BIRTH.names[0]} and ${BIRTH.names[1]} · compatibility`, href: `/compatibility/#a=${shareToken(BIRTH.names[0])}&b=${shareToken(BIRTH.names[1])}` };
  const oldBirthday = { kind: 'occasion' as const, title: `${BIRTH.names[0]} · A birthday · 14 March 1987`, href: `/occasions/#o=birthday&d=${BIRTH.date}&n=${BIRTH.names[0]}&t=04%3A27&tz=Asia%2FAlmaty&lat=43.2567&lon=76.9286&place=Zzyzx+Canary` };

  function memoryStorage(seed: Record<string, string> = {}) {
    const map = new Map(Object.entries(seed));
    return {
      map,
      get length() { return map.size; },
      key: (index: number) => [...map.keys()][index] ?? null,
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => { map.set(key, value); },
      removeItem: (key: string) => { map.delete(key); },
    };
  }

  it('refuses a link with both people’s birth details and a birthday link, before any request', async () => {
    for (const draft of [oldCompatibility, oldBirthday]) {
      expect(birthDetailsIn(draft)).not.toEqual([]);
      expect(savedPageWriteDraft(draft)).toBeNull();
      const db = fakeSupabase();
      expect(await saveSavedPage(draft, db.client as never)).toBe('error');
      expect(db.requests).toEqual([]);
      const storage = memoryStorage();
      expect(stashPendingSave(draft, NOW.getTime(), storage)).toBe(false);
      expectNoBirthDetails('waiting item', [...storage.map.entries()]);
    }
  });

  it('ignores and removes a waiting item stashed under the old key', () => {
    const stashed = JSON.stringify({ ...oldCompatibility, at: NOW.getTime() - 1_000 });
    const storage = memoryStorage({ [RETIRED_PENDING_SAVE_KEY]: stashed });
    expect(peekPendingSave(NOW.getTime(), storage)).toBeNull();
    expect(takePendingSave(NOW.getTime(), storage)).toBeNull();
    expect(storage.map.has(RETIRED_PENDING_SAVE_KEY)).toBe(false);
    expect(storage.map.has(PENDING_SAVE_KEY)).toBe(false);
    expectNoBirthDetails('device storage after load', [...storage.map.entries()]);
  });

  it('stores a sign pair save, and only that, in the account', async () => {
    const db = fakeSupabase();
    expect(await saveSavedPage(comparisonSavedPage('pisces', 'leo'), db.client as never)).toBe('saved');
    expect(db.requests.map((request) => `${request.table}:${request.op}`)).toEqual(['saved_pages:insert']);
    expectNoBirthDetails('saved page insert', db.requests);
  });
});

// ── 4. What an assistant saves ───────────────────────────────────────

describe('what an assistant saves', () => {
  const principal = { user: '22222222-2222-4222-8222-222222222222', session: '55555555-5555-4555-8555-555555555555', client: '66666666-6666-4666-8666-666666666666' };
  const cases = [
    ['chart', { kind: 'chart', chart: person }, []],
    ['chart with a label', { kind: 'chart', chart: person, label: 'Mine' }, []],
    ['comparison', { kind: 'comparison', comparison: { a: person, b: otherPerson } }, []],
    ['birthday occasion', { kind: 'occasion', occasion: { occasion: 'birthday', date: BIRTH.date, time: BIRTH.time, zone: BIRTH.zone, latitude: BIRTH.latitude, longitude: BIRTH.longitude, place: BIRTH.place, names: `${BIRTH.names[0]} & ${BIRTH.names[1]}` } }, []],
    ['wedding occasion', { kind: 'occasion', occasion: { occasion: 'wedding', date: WEDDING_DAY, time: '17:00', zone: 'Europe/Rome', latitude: 43.7696, longitude: 11.2558, place: BIRTH.place, names: `${BIRTH.names[0]} & ${BIRTH.names[1]}` } }, [WEDDING_DAY]],
    ['week', { kind: 'week', week: { birthDate: BIRTH.date, birthTime: BIRTH.time, birthZone: BIRTH.zone, zone: 'Europe/Rome' } }, weekDays(SAVE_DAY)],
  ] as const;

  it.each(cases)('stores no birth detail for a %s, in the record or in what the database is sent', async (_label, args, allowedDates) => {
    const input = saveInput.parse(args);
    const record = await buildSavedRecord(input, { now: () => NOW });
    if ('failure' in record) throw new Error(record.failure);
    const sent = savedPageRpcArgs(principal, 'https://zodiacs.org/mcp', record);
    expect(sent.detail).toBe(record);
    expect(sent).toMatchObject({ title: record.title, href: record.href, summary: record.summary });
    const week = record.kind === 'week' ? weekDays(String((record.data as { from: string }).from)) : [];
    expectNoBirthDetails('stored record', record, [...allowedDates, ...week]);
    expectNoBirthDetails('database call', sent, [...allowedDates, ...week]);
    // A saved= link carries a random row id, sent as the row's id: nothing worked out from the record or the call.
    const saved = /saved=([^&]*)$/u.exec(record.href)?.[1];
    if (saved) {
      expect(saved).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
      expect(sent).toMatchObject({ id: saved });
    }
  }, 30_000);
});

// ── 5. Retired links ─────────────────────────────────────────────────

describe('retired links', () => {
  const positionsCode = encodePositionsLink({
    bodies: savedChart.summary.bodies.map(({ body, lon }) => ({ body, lon })),
    angles: { asc: 101.5, mc: 11.5 },
    houseSystem: 'whole',
    engineVersion: '1.2.3',
  })!;
  const names = encodeURIComponent(`${BIRTH.names[0]} & ${BIRTH.names[1]}`);
  const place = encodeURIComponent(BIRTH.place);
  const occasionTail = 'sun=pisces&moon=leo&score=70&v=good';
  const retired: readonly (readonly [string, (request: Request) => Promise<Response>, string, readonly string[]])[] = [
    ['chart image', handleChartImageRequest, `/api/og/chart-image?p=${encodeURIComponent(positionsCode)}`, ['p']],
    ['birthday date link', handleOccasionLinkRequest, `/share/occasion/?o=birthday&d=${BIRTH.date}&n=${names}&p=${place}&${occasionTail}`, ['d', 'n', 'p']],
    ['baby date link', handleOccasionLinkRequest, `/share/occasion/?o=baby&d=${BIRTH.date}&${occasionTail}`, ['d']],
    ['coming of age date link', handleOccasionLinkRequest, `/share/occasion/?o=coming-of-age&d=${BIRTH.date}&${occasionTail}`, ['d']],
    ['birthday picture', handleOccasionImageRequest, `/api/og/occasion-image?o=birthday&d=${BIRTH.date}&${occasionTail}`, ['d']],
    ['birthday story', handleOccasionStoryRequest, `/api/og/occasion-story?o=birthday&d=${BIRTH.date}&${occasionTail}`, ['d']],
    ['wedding link with names and place', handleOccasionLinkRequest, `/share/occasion/?o=wedding&d=${WEDDING_DAY}&n=${names}&p=${place}&${occasionTail}`, ['n', 'p']],
    ['wedding picture with names and place', handleOccasionImageRequest, `/api/og/occasion-image?o=wedding&d=${WEDDING_DAY}&n=${names}&p=${place}&${occasionTail}`, ['n', 'p']],
    ['wedding story with names and place', handleOccasionStoryRequest, `/api/og/occasion-story?o=wedding&d=${WEDDING_DAY}&n=${names}&p=${place}&${occasionTail}`, ['n', 'p']],
    ['compatibility link with names', handleCompatibilityLinkRequest, `/share/compatibility/?a=${BIRTH.names[0]}&as=pisces&b=${BIRTH.names[1]}&bs=leo&score=70&attraction=70&communication=70&stability=70&v=good`, ['a', 'b']],
    ['compatibility picture with names', handleCompatibilityImageRequest, `/api/og/compatibility-image?a=${BIRTH.names[0]}&as=pisces&b=${BIRTH.names[1]}&bs=leo&score=70&attraction=70&communication=70&stability=70&v=good`, ['a', 'b']],
    ['compatibility story with names', handleCompatibilityStoryRequest, `/api/og/compatibility-story?a=${BIRTH.names[0]}&as=pisces&b=${BIRTH.names[1]}&bs=leo&score=70&attraction=70&communication=70&stability=70&v=good`, ['a', 'b']],
    ['milestone with pass days', handleMilestoneLinkRequest, '/share/milestone/?k=saturn-return&i=1&a=29&f=2016-03-14&l=2016-11-02', ['f', 'l']],
    ['milestone picture with pass days', handleMilestoneImageRequest, '/api/og/milestone-image?k=saturn-return&i=1&a=29&f=2016-03-14&l=2016-11-02', ['f', 'l']],
    ['milestone story with pass days', handleMilestoneStoryRequest, '/api/og/milestone-story?k=saturn-return&i=1&a=29&f=2016-03-14&l=2016-11-02', ['f', 'l']],
    ['Chinese zodiac with a year', handleChineseZodiacLinkRequest, '/share/chinese-zodiac/?a=rabbit&y=1987', ['y']],
    ['Chinese zodiac picture with a year', handleChineseZodiacImageRequest, '/api/og/chinese-zodiac-image?a=rabbit&y=1987', ['y']],
    ['Chinese zodiac story with a year', handleChineseZodiacStoryRequest, '/api/og/chinese-zodiac-story?a=rabbit&y=1987', ['y']],
  ];

  it.each(retired)('answers the %s with a 303 whose target holds none of it', async (_label, handle, path, gone) => {
    const response = await handle(new Request(`https://zodiacs.org${path}`));
    expect(response.status).toBe(303);
    const location = response.headers.get('location');
    expect(location).toBeTruthy();
    expect(location!.startsWith('https://zodiacs.org/')).toBe(true);
    expectNoBirthDetails('redirect target', location, [WEDDING_DAY]);
    const target = new URL(location!);
    for (const key of gone) expect(target.searchParams.has(key), key).toBe(key === 'd' && target.pathname === '/share/birthday/');
    expectNoBirthDetails('redirect body', await response.text());
  });

  it('answers the chart link with a positions code with 410 Gone, holding none of it and sending it nowhere', async () => {
    for (const query of [`p=${encodeURIComponent(positionsCode)}`, `p=${positionsCode}&utm_source=share`]) {
      const response = await handleChartLinkRequest(new Request(`https://zodiacs.org/api/og/chart?${query}`));
      expect(response.status).toBe(410);
      expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
      expect(response.headers.get('location')).toBeNull();
      const body = await response.text();
      expect(body).not.toContain(positionsCode.slice(2, 12));
      expect(body).not.toContain('chart-image');
      expectNoBirthDetails('retired chart link page', body);
    }
  });

  it('keeps a birthday’s month and day only', async () => {
    const response = await handleOccasionLinkRequest(new Request(`https://zodiacs.org/share/occasion/?o=birthday&d=${BIRTH.date}&n=${names}&${occasionTail}`));
    expect(response.headers.get('location')).toBe('https://zodiacs.org/share/birthday/?d=03-14');
  });
});
