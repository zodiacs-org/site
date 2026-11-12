import { describe, expect, it, vi } from 'vitest';
import {
  PROFILE_ACCESS_CHUNK_PLACEHOLDER,
  PROFILE_ACCESS_EAGER_ROUTES,
  PROFILE_ACCESS_LOADER_BODY,
  profileAccessBootstrapEager,
  profileAccessLoaderScript,
  profileAccessMarkerKeys,
} from './profile-access-loader.mjs';
import { ACCOUNT_V2_LOCAL_OWNER_KEY, ACCOUNT_V2_RETAINED_OWNER_KEY } from './storage-identity';
import { ACCOUNT_BOUNDARY_PROFILE_KEYS } from './profile-boundary';
import { supabaseAuthStorageKey, supabaseAuthStorageKeyName } from '../profile/saved-pages-config';

const CHUNK = '/_astro/profile-access-autostart.AbC123.js';
const KEYS = profileAccessMarkerKeys({
  supabaseAuthKey: supabaseAuthStorageKeyName('https://synthetic-ref.supabase.co'),
  ownerKey: ACCOUNT_V2_LOCAL_OWNER_KEY,
  retainedOwnerKey: ACCOUNT_V2_RETAINED_OWNER_KEY,
  profileKeys: [...ACCOUNT_BOUNDARY_PROFILE_KEYS, 'zodiacs:today-sun-sign:v1'],
});

/** Storage whose values can never be read: the loader may only list names. */
function namesOnlyStorage(names: string[]) {
  const forbidden = vi.fn(() => { throw new Error('A stored value was read.'); });
  return {
    forbidden,
    storage: {
      get length() { return names.length; },
      key: (index: number) => names[index] ?? null,
      getItem: forbidden,
      setItem: forbidden,
      removeItem: forbidden,
    },
  };
}

function run(names: string[], src = CHUNK) {
  const win = new EventTarget() as EventTarget & { localStorage?: unknown };
  const doc = new EventTarget();
  const { storage, forbidden } = namesOnlyStorage(names);
  win.localStorage = storage;
  const load = vi.fn(async (_url: string) => ({}));
  new Function('window', 'document', 'src', 'keys', 'load', PROFILE_ACCESS_LOADER_BODY)(win, doc, src, KEYS, load);
  const entry = { closest: (selector: string) => (selector === '[data-account-entry]' ? {} : null) };
  const elsewhere = { closest: () => null };
  const open = (type: 'pointerdown' | 'click', target: unknown = entry) => {
    const event = new Event(type);
    Object.defineProperty(event, 'target', { value: target });
    doc.dispatchEvent(event);
  };
  const storageEvent = (key: string | null) => {
    const event = new Event('storage');
    Object.defineProperty(event, 'key', { value: key });
    win.dispatchEvent(event);
  };
  return { load, forbidden, open, storageEvent, elsewhere };
}

const settle = async () => { for (let index = 0; index < 4; index += 1) await Promise.resolve(); };

describe('profile access presence loader', () => {
  it('imports nothing for an empty browser with no trigger', async () => {
    const page = run([]);
    page.open('click', page.elsewhere);
    page.storageEvent('unrelated.key');
    await settle();
    expect(page.load).not.toHaveBeenCalled();
  });

  it('imports nothing when only unrelated keys are stored', async () => {
    const page = run(['theme', 'zodiacs.first-visit', 'sb-other-auth-token']);
    await settle();
    expect(page.load).not.toHaveBeenCalled();
  });

  it.each([
    ['the Supabase auth entry', 'sb-synthetic-ref-auth-token'],
    ['the local owner key', ACCOUNT_V2_LOCAL_OWNER_KEY],
    ['the retained owner key', ACCOUNT_V2_RETAINED_OWNER_KEY],
    ['the saved charts key', 'zodiacs.profile.v1'],
    ['the saved comparisons key', 'zodiacs.pairs.v1'],
    ['the Sun-sign preference', 'zodiacs:today-sun-sign:v1'],
  ])('imports the bootstrap once when %s exists, reading names only', async (_label, key) => {
    const page = run(['theme', key]);
    await settle();
    expect(page.load).toHaveBeenCalledTimes(1);
    expect(page.load).toHaveBeenCalledWith(CHUNK);
    expect(page.forbidden).not.toHaveBeenCalled();
  });

  it.each(['pointerdown', 'click'] as const)('imports once when the account entry point is opened (%s)', async (type) => {
    const page = run([]);
    page.open(type);
    page.open(type);
    page.open('click');
    await settle();
    expect(page.load).toHaveBeenCalledTimes(1);
  });

  it('imports once when another tab writes a marker key', async () => {
    const page = run([]);
    page.storageEvent('theme');
    await settle();
    expect(page.load).not.toHaveBeenCalled();
    page.storageEvent('sb-synthetic-ref-auth-token');
    page.storageEvent(ACCOUNT_V2_LOCAL_OWNER_KEY);
    await settle();
    expect(page.load).toHaveBeenCalledTimes(1);
  });

  it('is idempotent across a marker and later triggers', async () => {
    const page = run(['zodiacs.profile.v1']);
    page.open('pointerdown');
    page.storageEvent(ACCOUNT_V2_LOCAL_OWNER_KEY);
    await settle();
    expect(page.load).toHaveBeenCalledTimes(1);
  });

  it('tries again on the next trigger after a failed import', async () => {
    const page = run([]);
    page.load.mockRejectedValueOnce(new Error('offline'));
    page.open('click');
    await settle();
    page.open('click');
    await settle();
    expect(page.load).toHaveBeenCalledTimes(2);
  });

  it('never imports from an unstamped page', async () => {
    const page = run(['zodiacs.profile.v1'], PROFILE_ACCESS_CHUNK_PLACEHOLDER);
    page.open('click');
    await settle();
    expect(page.load).not.toHaveBeenCalled();
  });

  it('builds a classic script that parses and names exactly the chunk', () => {
    const script = profileAccessLoaderScript({ src: CHUNK, keys: KEYS });
    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain(JSON.stringify(CHUNK));
    expect(script).toContain('import(url)');
    expect(script).not.toMatch(/^\s*import\s/mu);
    expect(script).not.toContain('getItem');
  });

  it('lists the exact marker names for the build', () => {
    expect(KEYS[0]).toBe('sb-synthetic-ref-auth-token');
    expect(KEYS).toEqual(expect.arrayContaining([ACCOUNT_V2_LOCAL_OWNER_KEY, ACCOUNT_V2_RETAINED_OWNER_KEY, ...ACCOUNT_BOUNDARY_PROFILE_KEYS]));
    expect(profileAccessMarkerKeys({ supabaseAuthKey: null, ownerKey: 'a', retainedOwnerKey: 'b', profileKeys: ['c'] })).toEqual(['a', 'b', 'c']);
    // The name is the one the session reader itself recognises.
    for (const url of ['https://synthetic-ref.supabase.co', 'http://127.0.0.1:54321']) {
      const name = supabaseAuthStorageKeyName(url)!;
      expect(supabaseAuthStorageKey(url, ['theme', name])).toBe(name);
    }
    expect(supabaseAuthStorageKeyName(undefined)).toBeNull();
  });

  it('loads eagerly only on the profile pages and the two main calculators', () => {
    for (const path of ['/profile/', '/es/profile/', '/ru/profile/', '/birth-chart/', '/pt/birth-chart/', '/compatibility/', '/fr/compatibility/']) {
      expect(profileAccessBootstrapEager(path), path).toBe(true);
    }
    for (const path of ['/', '/aries/', '/today/', '/big-three/', '/moon-sign/', '/compatibility/aries-taurus/', '/birth-chart/someone-else/', '/almanac/']) {
      expect(profileAccessBootstrapEager(path), path).toBe(false);
    }
    expect(PROFILE_ACCESS_EAGER_ROUTES).toHaveLength(18);
  });
});
