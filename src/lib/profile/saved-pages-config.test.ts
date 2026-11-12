import { describe, expect, it } from 'vitest';
import {
  PENDING_SAVE_KEY,
  PENDING_SAVE_TTL_MS,
  RETIRED_PENDING_SAVE_KEY,
  SAVED_PAGE_HREF_MAX,
  SAVED_PAGE_TITLE_MAX,
  accountSavesEnabled,
  cleanSavedPageTitle,
  hasStoredAuthSession,
  parseSavedPageRow,
  peekPendingSave,
  settlePendingSave,
  savedPageDraft,
  savedPageHref,
  savedPageWriteDraft,
  stashPendingSave,
  supabaseAuthStorageKey,
  takePendingSave,
} from './saved-pages-config';

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

const ORIGIN = 'https://zodiacs.org';
const occasion = { kind: 'occasion' as const, title: 'The sky on your wedding day', href: '/occasions/#o=wedding&d=2027-06-12' };

describe('accountSavesEnabled', () => {
  it('is off unless the flag is exactly "1"', () => {
    expect(accountSavesEnabled({})).toBe(false);
    expect(accountSavesEnabled({ PUBLIC_ACCOUNT_SAVES_ENABLED: 'true' })).toBe(false);
    expect(accountSavesEnabled({ PUBLIC_ACCOUNT_SAVES_ENABLED: '1' })).toBe(true);
  });
});

describe('savedPageHref', () => {
  it('keeps a same-site path for its kind', () => {
    expect(savedPageHref('occasion', '/occasions/#d=2027-06-12')).toBe('/occasions/#d=2027-06-12');
    expect(savedPageHref('compatibility', '/compatibility/#a=1.x&b=1.y')).toBe('/compatibility/#a=1.x&b=1.y');
    expect(savedPageHref('compatibility', '/es/compatibility/#a=1.x')).toBe('/es/compatibility/#a=1.x');
  });

  it('turns a same-origin address into a path', () => {
    expect(savedPageHref('occasion', `${ORIGIN}/occasions/#d=2027-06-12`, ORIGIN)).toBe('/occasions/#d=2027-06-12');
  });

  it.each([
    ['occasion', 'https://evil.example/occasions/#d=1'],
    ['occasion', '//evil.example/occasions/'],
    ['occasion', '/compatibility/#a=1'],
    ['compatibility', '/occasions/#d=1'],
    ['occasion', '/occasions/#n=two words'],
    ['occasion', '/occasions/\\x'],
    ['occasion', `/occasions/#${'d'.repeat(SAVED_PAGE_HREF_MAX)}`],
    ['occasion', ''],
  ] as const)('refuses %s %s', (kind, href) => {
    expect(savedPageHref(kind, href, ORIGIN)).toBeNull();
  });

  it('refuses an absolute address without an origin to compare', () => {
    expect(savedPageHref('occasion', `${ORIGIN}/occasions/`)).toBeNull();
  });
});

describe('titles and drafts', () => {
  it('cleans control characters and shortens long titles', () => {
    expect(cleanSavedPageTitle('  Ana\u0000 and\n Ben ')).toBe('Ana and Ben');
    const long = cleanSavedPageTitle('x'.repeat(400));
    expect([...long!].length).toBe(SAVED_PAGE_TITLE_MAX);
    expect(long!.endsWith('…')).toBe(true);
    expect(cleanSavedPageTitle('   ')).toBeNull();
  });

  it('accepts only known kinds', () => {
    expect(savedPageDraft(occasion)).toEqual(occasion);
    expect(savedPageDraft({ ...occasion, kind: 'chart' })).toBeNull();
    expect(savedPageDraft(null)).toBeNull();
  });

  it('parses a database row and refuses a bad one', () => {
    const row = { id: '6b3a3f0e-1c2d-4e5f-8a9b-0c1d2e3f4a5b', saved_at: '2026-10-15T09:00:00+00:00', ...occasion };
    expect(parseSavedPageRow(row)).toEqual({ ...occasion, id: row.id, savedAt: row.saved_at, source: 'site', summary: null });
    expect(parseSavedPageRow({ ...row, id: 'x' })).toBeNull();
    expect(parseSavedPageRow({ ...row, saved_at: 'never' })).toBeNull();
    expect(parseSavedPageRow({ ...row, href: 'https://evil.example/' })).toBeNull();
  });

  it('lists what an assistant saved, with its summary, and trusts chart and week rows only from the server', () => {
    const base = { id: '6b3a3f0e-1c2d-4e5f-8a9b-0c1d2e3f4a5b', saved_at: '2026-10-15T09:00:00+00:00' };
    const week = { ...base, kind: 'week', title: 'Your week from 2026-10-15', href: '/horoscopes/#week=2026-10-15&saved=0123456789abcdef', source: 'assistant', summary: 'Venus meets your Sun.\u0007' };
    expect(parseSavedPageRow(week)).toMatchObject({ kind: 'week', source: 'assistant', summary: 'Venus meets your Sun.' });
    expect(parseSavedPageRow({ ...base, kind: 'chart', title: 'Frida Kahlo', href: '/people/frida-kahlo/', source: 'assistant', summary: 'Sun in Cancer' })).toMatchObject({ kind: 'chart' });
    expect(parseSavedPageRow({ ...week, source: 'site' })).toBeNull();
    expect(parseSavedPageRow({ ...week, href: '/occasions/#x' })).toBeNull();
    expect(parseSavedPageRow({ ...base, ...occasion, summary: 'ignored for a site row' })).toMatchObject({ source: 'site', summary: null });
    // A browser still cannot draft an assistant kind.
    expect(savedPageDraft({ kind: 'week', title: 'x', href: '/horoscopes/' })).toBeNull();
  });
});

describe('pending save', () => {
  it('waits for sign-in once, and only for a day', () => {
    const storage = memoryStorage();
    expect(stashPendingSave(occasion, 1_000, storage)).toBe(true);
    expect(peekPendingSave(2_000, storage)).toEqual(occasion);
    expect(takePendingSave(2_000, storage)).toEqual(occasion);
    expect(storage.map.has(PENDING_SAVE_KEY)).toBe(false);
    expect(takePendingSave(3_000, storage)).toBeNull();

    stashPendingSave(occasion, 1_000, storage);
    expect(takePendingSave(1_000 + PENDING_SAVE_TTL_MS + 1, storage)).toBeNull();
    expect(storage.map.has(PENDING_SAVE_KEY)).toBe(false);
  });

  it('keeps the waiting page until it is saved, so a full profile or a failure does not lose it', async () => {
    const storage = memoryStorage();
    stashPendingSave(occasion, 1_000, storage);
    for (const failure of ['full', 'error', 'signed-out'] as const) {
      expect(await settlePendingSave(async () => failure, 2_000, storage)).toEqual({ draft: occasion, outcome: failure });
      expect(peekPendingSave(2_000, storage)).toEqual(occasion);
    }
    expect(await settlePendingSave(async () => { throw new Error('offline'); }, 2_000, storage)).toEqual({ draft: occasion, outcome: 'error' });
    expect(peekPendingSave(2_000, storage)).toEqual(occasion);
    expect(await settlePendingSave(async () => 'saved' as const, 2_000, storage)).toEqual({ draft: occasion, outcome: 'saved' });
    expect(storage.map.has(PENDING_SAVE_KEY)).toBe(false);
    expect(await settlePendingSave(async () => 'saved' as const, 3_000, storage)).toBeNull();

    stashPendingSave(occasion, 1_000, storage);
    expect(await settlePendingSave(async () => 'exists' as const, 2_000, storage)).toEqual({ draft: occasion, outcome: 'exists' });
    expect(storage.map.has(PENDING_SAVE_KEY)).toBe(false);
  });

  it('ignores tampered storage', () => {
    const storage = memoryStorage({ [PENDING_SAVE_KEY]: JSON.stringify({ ...occasion, href: '//evil.example/', at: 1 }) });
    expect(takePendingSave(2, storage)).toBeNull();
    storage.setItem(PENDING_SAVE_KEY, '{not json');
    expect(takePendingSave(2, storage)).toBeNull();
  });

  it('refuses to stash an invalid draft', () => {
    expect(stashPendingSave({ ...occasion, href: 'https://evil.example/' }, 1, memoryStorage())).toBe(false);
  });
});

describe('the write rule: no birth details in a new save', () => {
  const compatibility = { kind: 'compatibility' as const, title: 'Leo and Aries · compatibility', href: '/compatibility/aries-leo/' };

  it('accepts the sign pair page and the occasion rule exactly', () => {
    expect(savedPageWriteDraft(compatibility)).toEqual(compatibility);
    expect(savedPageWriteDraft({ ...compatibility, href: '/compatibility/' })).toMatchObject({ href: '/compatibility/' });
    expect(savedPageWriteDraft(occasion)).toEqual(occasion);
    for (const href of [
      '/occasions/',
      '/occasions/#o=wedding&d=2027-06-12&t=16%3A30',
      '/occasions/#o=wedding&d=2027-06-12&t=16%3A30&tz=Europe%2FRome&lat=43.77&lon=11.25',
      '/occasions/#o=home&d=2027-06-12&tz=Asia%2FAlmaty&lat=-43.26&lon=-76.93',
    ]) expect(savedPageWriteDraft({ ...occasion, href }), href).not.toBeNull();
  });

  it.each([
    ['compatibility', '/compatibility/#a=1.eyJkIjoiMTk4Ny0wMy0xNCJ9&b=1.x'],
    ['compatibility', '/compatibility/?a=Qwertina'],
    ['compatibility', '/compatibility/aries-leo/#saved=0123456789abcdef'],
    ['occasion', '/occasions/#o=birthday&d=1987-03-14'],
    ['occasion', '/occasions/#o=baby&d=2026-03-14'],
    ['occasion', '/occasions/#o=coming-of-age&d=2008-03-14'],
    ['occasion', '/occasions/#o=wedding&d=2027-06-12&n=Qwertina'],
    ['occasion', '/occasions/#o=wedding&d=2027-06-12&tz=Asia%2FAlmaty&lat=43.2567&lon=76.9286'],
    ['occasion', '/occasions/#o=wedding&d=2027-06-12&tz=Asia%2FAlmaty&lat=43.26&lon=76.93&place=Zzyzx+Canary'],
    ['occasion', '/occasions/#o=wedding&d=2027-06-12&tz=Asia%2FAlmaty'],
    ['occasion', '/occasions/#d=2027-06-12'],
    ['occasion', '/occasions/#o=wedding&o=wedding&d=2027-06-12'],
    ['occasion', '/occasions/?o=wedding&d=2027-06-12'],
    ['occasion', '/occasions/#saved=0123456789abcdef'],
  ] as const)('refuses to write %s %s', (kind, href) => {
    const draft = { kind, title: 'A save', href };
    expect(savedPageDraft(draft)).not.toBeNull();
    expect(savedPageWriteDraft(draft)).toBeNull();
    const storage = memoryStorage();
    expect(stashPendingSave(draft, 1, storage)).toBe(false);
    expect(storage.map.size).toBe(0);
  });

  it('still lists and removes rows saved before the rule', () => {
    const row = { id: '6b3a3f0e-1c2d-4e5f-8a9b-0c1d2e3f4a5b', saved_at: '2026-10-15T09:00:00+00:00', kind: 'compatibility', title: 'Ana and Ben · compatibility', href: '/compatibility/#a=1.x&b=1.y' };
    expect(parseSavedPageRow(row)).toMatchObject({ href: row.href, source: 'site' });
  });

  it('never reads a waiting item stashed in the old form, and drops one already waiting', () => {
    const legacy = JSON.stringify({ ...occasion, href: '/occasions/#o=birthday&d=1987-03-14&n=Qwertina', at: 1_000 });
    expect(PENDING_SAVE_KEY).toBe('zodiacs.account-saves.pending.v2');
    expect(RETIRED_PENDING_SAVE_KEY).toBe('zodiacs.account-saves.pending.v1');
    const peeked = memoryStorage({ [RETIRED_PENDING_SAVE_KEY]: legacy });
    expect(peekPendingSave(2_000, peeked)).toBeNull();
    expect(peeked.map.has(RETIRED_PENDING_SAVE_KEY)).toBe(false);
    const taken = memoryStorage({ [RETIRED_PENDING_SAVE_KEY]: legacy });
    expect(takePendingSave(2_000, taken)).toBeNull();
    expect(taken.map.has(RETIRED_PENDING_SAVE_KEY)).toBe(false);
    // An old-form draft under the new key is refused too.
    const current = memoryStorage({ [PENDING_SAVE_KEY]: legacy });
    expect(peekPendingSave(2_000, current)).toBeNull();
  });
});

describe('stored session', () => {
  const url = 'https://abcdefghijklmnopqrst.supabase.co';
  it('finds Supabase’s default storage key for this project only', () => {
    const keys = ['zodiacs.profile.v1', 'sb-otherprojectref0000-auth-token', 'sb-abcdefghijklmnopqrst-auth-token'];
    expect(supabaseAuthStorageKey(url, keys)).toBe('sb-abcdefghijklmnopqrst-auth-token');
    expect(supabaseAuthStorageKey(url, ['sb-abcdefghijklmnopqrst-auth-token-code-verifier'])).toBeNull();
    expect(supabaseAuthStorageKey(undefined, keys)).toBeNull();
    expect(supabaseAuthStorageKey('not a url', keys)).toBeNull();
  });

  it('reads whether a session is stored, without the library', () => {
    expect(hasStoredAuthSession(memoryStorage(), url)).toBe(false);
    expect(hasStoredAuthSession(memoryStorage({ 'sb-abcdefghijklmnopqrst-auth-token': '{"refresh_token":"r"}' }), url)).toBe(true);
    expect(hasStoredAuthSession(memoryStorage({ 'sb-abcdefghijklmnopqrst-auth-token': 'null' }), url)).toBe(false);
    expect(hasStoredAuthSession(memoryStorage({ 'sb-abcdefghijklmnopqrst-auth-token': '{' }), url)).toBe(false);
    expect(hasStoredAuthSession(memoryStorage({ 'sb-abcdefghijklmnopqrst-auth-token': '{"refresh_token":"r"}' }), undefined)).toBe(false);
  });
});
