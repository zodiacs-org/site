import { describe, expect, it } from 'vitest';
import {
  PENDING_SAVE_KEY,
  PENDING_SAVE_TTL_MS,
  SAVED_PAGE_HREF_MAX,
  SAVED_PAGE_TITLE_MAX,
  accountSavesEnabled,
  cleanSavedPageTitle,
  hasStoredAuthSession,
  parseSavedPageRow,
  peekPendingSave,
  savedPageDraft,
  savedPageHref,
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
