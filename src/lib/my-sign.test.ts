import { afterEach, describe, expect, it, vi } from 'vitest';
import { MY_SIGN_EVENT, MY_SIGN_KEY, isSignSlug, readMySign, rememberMySign } from './my-sign';

function stubStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
  });
  const events: unknown[] = [];
  vi.stubGlobal('window', { dispatchEvent: (event: { detail: unknown }) => { events.push(event.detail); return true; } });
  vi.stubGlobal('CustomEvent', class { constructor(public type: string, public init: { detail: unknown }) {} get detail() { return this.init.detail; } });
  return { store, events };
}

afterEach(() => vi.unstubAllGlobals());

describe('remember my sign', () => {
  it('keeps only a sign slug in this browser, never a birth date, time or place', () => {
    const { store, events } = stubStorage();
    expect(rememberMySign('leo')).toBe(true);
    expect([...store.entries()]).toEqual([[MY_SIGN_KEY, 'leo']]);
    expect(readMySign()).toBe('leo');
    expect(events).toEqual(['leo']);
    expect(rememberMySign(null)).toBe(true);
    expect(store.size).toBe(0);
    expect(readMySign()).toBeNull();
    expect(MY_SIGN_EVENT).toBe('zodiacs:my-sign');
  });

  it('accepts only the twelve sign slugs', () => {
    stubStorage();
    localStorage.setItem(MY_SIGN_KEY, '1990-04-17');
    expect(readMySign()).toBeNull();
    expect(isSignSlug('virgo')).toBe(true);
    expect(isSignSlug('ophiuchus')).toBe(false);
  });

  it('reports blocked storage instead of throwing', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    });
    expect(readMySign()).toBeNull();
    expect(rememberMySign('leo')).toBe(false);
  });
});
