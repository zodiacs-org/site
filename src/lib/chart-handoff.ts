import { decodeChartLink, encodeChartLink, type ShareChartInput } from './share';

/**
 * Moving a chart between pages on this device (the 9 November 2026 audit,
 * Decision A). A link never carries a birth date, time, place or name, not
 * even after the #, because the whole link is kept in chat apps, notes,
 * bookmarks and browser history.
 *
 * - A chart saved on this device moves by its opaque id
 *   (profileChartHandoffFragment, someoneElseProfileHandoffPath, or the
 *   compatibility page's ?a= saved id).
 * - A chart that is not saved moves through sessionStorage: the details are
 *   stored under zodiacs.handoff.<32 random hex digits>, and the link carries
 *   only h=<that key> (plus subject=other or an opaque saved id where used).
 *   The page that opens it reads the entry once and deletes it at once. The
 *   key tells nobody anything and is useless on another device or tab. When
 *   sessionStorage cannot be used, nothing is stashed, the writers return
 *   null, and no link with details is made instead.
 * - Links people already shared (#c=, #mine=, #a=, #b=, #date=/#time=) are
 *   still read by their pages, which strip them from the address bar first.
 *   Nothing here writes one.
 *
 * Nothing about a handoff is logged or sent.
 */

export type SubjectMode = 'self' | 'other';

export type MineHandoff =
  | { kind: 'input'; input: ShareChartInput }
  | { kind: 'saved'; id: string };

export interface ChartHandoffOptions {
  subjectMode?: SubjectMode;
  mine?: MineHandoff | null;
  /** The optional "mine" context came from the guarded saved-chart library. */
  mineProfileOrigin?: boolean;
}

/** What a session handoff carries, once read. */
export type ChartHandoff =
  /** A chart to open on the birth chart page, with the visitor's own unsaved chart when known. */
  | { kind: 'chart'; input: ShareChartInput; mine: ShareChartInput | null }
  /** A date and optional time without a place (the Moon lookup, a birthday page). */
  | { kind: 'date'; date: string; time: string | null }
  /** The visitor's own unsaved chart, carried to the someone-else page. */
  | { kind: 'mine'; input: ShareChartInput }
  /** Compatibility sides by value; a saved side travels as ?a=<id> instead. */
  | { kind: 'pair'; a: ShareChartInput | null; b: ShareChartInput | null };

/** The wire form kept in sessionStorage. Charts are stored as v1 tokens so the reader reuses decodeChartLink's checks. */
type StoredHandoff =
  | { k: 'chart'; c: string; m?: string }
  | { k: 'date'; d: string; t: string | null }
  | { k: 'mine'; c: string }
  | { k: 'pair'; a?: string; b?: string };

const SAVED_ID_MAX = 128;
const PROFILE_SOURCE = 'profile';
const PROFILE_CHART_ID_PARAM = 'profileChartId';
const MINE_SOURCE_PARAM = 'mineSource';
const PROFILE_CHART_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const HANDOFF_PARAM = 'h';
export const HANDOFF_STORAGE_PREFIX = 'zodiacs.handoff.';
const HANDOFF_KEY = /^[0-9a-f]{32}$/u;
const HANDOFF_KEY_BYTES = 16;

/** Fragment keys of links made before Decision A that carried birth details by value. */
export const LEGACY_DETAIL_PARAMS = ['c', 'mine', 'a', 'b', 'date', 'time'] as const;

function fragmentParams(hash: string): URLSearchParams {
  return new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
}

function validSavedId(value: string): string | null {
  const id = value.trim();
  if (!id || id.length > SAVED_ID_MAX || /[\u0000-\u001f\u007f]/.test(id)) return null;
  return id;
}

function validProfileChartId(value: string): string | null {
  const id = validSavedId(value);
  return id && PROFILE_CHART_ID.test(id) ? id : null;
}

function hasExactProfileSource(params: URLSearchParams, key: string): boolean {
  const values = params.getAll(key);
  return values.length === 1 && values[0] === PROFILE_SOURCE;
}

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

function randomKey(): string | null {
  try {
    const bytes = new Uint8Array(HANDOFF_KEY_BYTES);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

/** Remove every handoff entry this tab still holds. Only one handoff is ever in flight. */
function clearStashedHandoffs(store: Storage): void {
  const stale: string[] = [];
  for (let i = 0; i < store.length; i += 1) {
    const key = store.key(i);
    if (key?.startsWith(HANDOFF_STORAGE_PREFIX)) stale.push(key);
  }
  for (const key of stale) store.removeItem(key);
}

/** Store one entry and return its random key, or null when sessionStorage cannot be used. */
function stash(entry: StoredHandoff): string | null {
  const store = sessionStore();
  const key = randomKey();
  if (!store || !key) return null;
  try {
    clearStashedHandoffs(store);
    store.setItem(HANDOFF_STORAGE_PREFIX + key, JSON.stringify(entry));
    return key;
  } catch {
    try { store.removeItem(HANDOFF_STORAGE_PREFIX + key); } catch { /* nothing was stored */ }
    return null;
  }
}

/** Whether this tab can hold a session handoff. When it cannot, handoff links are not offered. */
export function sessionHandoffAvailable(): boolean {
  const store = sessionStore();
  if (!store) return false;
  const probe = `${HANDOFF_STORAGE_PREFIX}probe`;
  try {
    store.setItem(probe, '1');
    store.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Untrusted provenance only: it decides what must be scrubbed, never what may be read. */
export function profileHandoffOriginsFromHash(hash: string): {
  chart: boolean;
  mine: boolean;
} {
  const params = fragmentParams(hash);
  const mine = mineHandoffFromHash(hash);
  return {
    chart: profileChartIdFromHash(hash) !== null,
    mine: mine?.kind === 'saved' && hasExactProfileSource(params, MINE_SOURCE_PARAM),
  };
}

/** Opaque saved-chart handoff: no birth input is exposed while the next page is locked. */
export function profileChartHandoffFragment(chartId: string): string | null {
  const id = validProfileChartId(chartId);
  if (!id) return null;
  const params = new URLSearchParams();
  params.set(PROFILE_CHART_ID_PARAM, id);
  return params.toString();
}

export function profileChartIdFromHash(hash: string): string | null {
  const values = fragmentParams(hash).getAll(PROFILE_CHART_ID_PARAM);
  return values.length === 1 ? validProfileChartId(values[0]) : null;
}

/**
 * Stash an unsaved chart for the birth chart page and return the fragment
 * that opens it: h=<random key>, subject=other when it is someone else's
 * chart, and a saved "mine" chart's opaque id. Null when sessionStorage
 * cannot be used; the caller then offers no handoff.
 */
export function stashChartHandoff(
  input: ShareChartInput,
  options: ChartHandoffOptions = {},
): string | null {
  const entry: StoredHandoff = { k: 'chart', c: encodeChartLink(input) };
  if (options.mine?.kind === 'input') entry.m = encodeChartLink(options.mine.input);
  const params = new URLSearchParams();
  if (options.mine?.kind === 'saved') {
    if (options.mineProfileOrigin) {
      const id = validProfileChartId(options.mine.id);
      if (id) {
        params.set('mineId', id);
        params.set(MINE_SOURCE_PARAM, PROFILE_SOURCE);
      }
    } else {
      const id = validSavedId(options.mine.id);
      if (id) params.set('mineId', id);
    }
  }
  const key = stash(entry);
  if (!key) return null;
  const fragment = new URLSearchParams();
  fragment.set(HANDOFF_PARAM, key);
  if (options.subjectMode === 'other') fragment.set('subject', 'other');
  for (const [name, value] of params) fragment.set(name, value);
  return fragment.toString();
}

const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const CIVIL_TIME = /^\d{2}:\d{2}$/u;
const DATE_PARAM = 'date';
const TIME_PARAM = 'time';
const UNKNOWN_TIME = 'unknown';

export interface DateHandoff {
  date: string;
  /** HH:MM, or null when the visitor chose no time. */
  time: string | null;
}

/** A place-less handoff (Moon lookup or birthday page to the birth chart): the fragment carries only the key. */
export function stashDateHandoff(date: string, time: string | null): string | null {
  if (!CIVIL_DATE.test(date) || (time !== null && !CIVIL_TIME.test(time))) return null;
  const key = stash({ k: 'date', d: date, t: time });
  if (!key) return null;
  const fragment = new URLSearchParams();
  fragment.set(HANDOFF_PARAM, key);
  return fragment.toString();
}

/** A legacy #date=&time= link: exactly the two date parameters, well formed; anything else is not a date handoff. */
export function dateHandoffFromHash(hash: string): DateHandoff | null {
  const params = fragmentParams(hash);
  if (params.size !== 2 || params.getAll(DATE_PARAM).length !== 1 || params.getAll(TIME_PARAM).length !== 1) return null;
  const date = params.get(DATE_PARAM) ?? '';
  const time = params.get(TIME_PARAM) ?? '';
  if (!CIVIL_DATE.test(date) || (time !== UNKNOWN_TIME && !CIVIL_TIME.test(time))) return null;
  return { date, time: time === UNKNOWN_TIME ? null : time };
}

export function subjectModeFromHash(hash: string): SubjectMode {
  const values = fragmentParams(hash).getAll('subject');
  return values.length === 1 && values[0] === 'other' ? 'other' : 'self';
}

/** The "mine" context of a fragment: a legacy #mine= token or an opaque saved id. */
export function mineHandoffFromHash(hash: string): MineHandoff | null {
  const params = fragmentParams(hash);
  const inputTokens = params.getAll('mine');
  const savedIds = params.getAll('mineId');
  if (inputTokens.length + savedIds.length !== 1) return null;
  if (inputTokens.length === 1) {
    const input = decodeChartLink(inputTokens[0]);
    return input ? { kind: 'input', input } : null;
  }
  const id = validSavedId(savedIds[0]);
  return id ? { kind: 'saved', id } : null;
}

/** Whether a fragment names a session handoff (h=). */
export function hasChartHandoff(hash: string): boolean {
  return fragmentParams(hash).has(HANDOFF_PARAM);
}

/** Whether a fragment holds a key that legacy links used to carry details (or a handoff key). */
export function hasHandoffOrLegacyDetails(hash: string): boolean {
  const params = fragmentParams(hash);
  return params.has(HANDOFF_PARAM) || LEGACY_DETAIL_PARAMS.some((name) => params.has(name));
}

function decodeOptional(token: unknown): ShareChartInput | null | undefined {
  if (token === undefined) return null;
  if (typeof token !== 'string') return undefined;
  return decodeChartLink(token) ?? undefined;
}

function readStored(value: unknown): ChartHandoff | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const entry = value as Record<string, unknown>;
  if (entry.k === 'chart') {
    const input = typeof entry.c === 'string' ? decodeChartLink(entry.c) : null;
    const mine = decodeOptional(entry.m);
    return input && mine !== undefined ? { kind: 'chart', input, mine } : null;
  }
  if (entry.k === 'date') {
    const { d, t } = entry;
    if (typeof d !== 'string' || !CIVIL_DATE.test(d)) return null;
    if (t !== null && (typeof t !== 'string' || !CIVIL_TIME.test(t))) return null;
    return { kind: 'date', date: d, time: t };
  }
  if (entry.k === 'mine') {
    const input = typeof entry.c === 'string' ? decodeChartLink(entry.c) : null;
    return input ? { kind: 'mine', input } : null;
  }
  if (entry.k === 'pair') {
    const a = decodeOptional(entry.a);
    const b = decodeOptional(entry.b);
    if (a === undefined || b === undefined || (!a && !b)) return null;
    return { kind: 'pair', a, b };
  }
  return null;
}

/**
 * Read the session handoff a fragment names (h=<key>), delete it at once,
 * and return it, or null. A missing, malformed, duplicated, already read or
 * unreadable entry is null; the page then shows its normal empty form.
 */
export function takeChartHandoff(hash: string): ChartHandoff | null {
  const keys = fragmentParams(hash).getAll(HANDOFF_PARAM);
  if (keys.length !== 1 || !HANDOFF_KEY.test(keys[0])) return null;
  const store = sessionStore();
  if (!store) return null;
  const storageKey = HANDOFF_STORAGE_PREFIX + keys[0];
  let raw: string | null = null;
  try {
    raw = store.getItem(storageKey);
  } catch {
    raw = null;
  } finally {
    try { store.removeItem(storageKey); } catch { /* nothing more can be done */ }
  }
  if (raw === null) return null;
  try {
    return readStored(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Carry the visitor's own unsaved chart into the someone-else entry flow.
 * Null when sessionStorage cannot be used.
 */
export function someoneElseHandoffPath(
  mine: ShareChartInput,
  path = '/birth-chart/someone-else/',
): string | null {
  const key = stash({ k: 'mine', c: encodeChartLink(mine) });
  if (!key) return null;
  const fragment = new URLSearchParams();
  fragment.set(HANDOFF_PARAM, key);
  return `${path}#${fragment.toString()}`;
}

export function someoneElseProfileHandoffPath(
  chartId: string,
  path = '/birth-chart/someone-else/',
): string | null {
  const params = new URLSearchParams();
  const id = validProfileChartId(chartId);
  if (!id) return null;
  params.set('mineId', id);
  params.set(MINE_SOURCE_PARAM, PROFILE_SOURCE);
  return `${path}#${params.toString()}`;
}

/**
 * Put the visitor's chart in side A and the other person's chart in side B.
 * A saved chart contributes only its opaque, device-local id through the
 * compatibility page's existing query API; unsaved charts go through the
 * session handoff. Null when sessionStorage cannot be used.
 */
export function compatibilityHandoffPath(
  other: ShareChartInput,
  mine: MineHandoff | null,
  path = '/compatibility/',
): string | null {
  const query = new URLSearchParams();
  let entry: StoredHandoff;
  if (mine?.kind === 'input') {
    entry = { k: 'pair', a: encodeChartLink(mine.input), b: encodeChartLink(other) };
  } else if (mine?.kind === 'saved' && validSavedId(mine.id)) {
    query.set('a', validSavedId(mine.id)!);
    entry = { k: 'pair', b: encodeChartLink(other) };
  } else {
    entry = { k: 'pair', a: encodeChartLink(other) };
  }
  const key = stash(entry);
  if (!key) return null;
  const fragment = new URLSearchParams();
  fragment.set(HANDOFF_PARAM, key);
  const search = query.size ? `?${query.toString()}` : '';
  return `${path}${search}#${fragment.toString()}`;
}

/**
 * Click handler for a handoff link whose href is the plain destination. A
 * plain primary click stashes the chart at that moment and opens the page
 * with the key; a modified click (new tab or window) keeps the plain href, so
 * the other tab shows the normal empty form. When nothing can be stashed the
 * plain href is followed too. Stashing on click leaves no entry behind for
 * links that are never used.
 */
export function followWithHandoff(
  event: MouseEvent,
  makeHref: () => string | null,
): void {
  if (event.defaultPrevented || event.button !== 0
    || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const href = makeHref();
  if (!href) return;
  event.preventDefault();
  window.location.assign(href);
}
