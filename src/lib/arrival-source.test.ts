import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { ANALYTICS_EVENT_VALUES } from './analytics';
import {
  ARRIVAL_REFS,
  ARRIVAL_SOURCES,
  ARRIVAL_SOURCE_SESSION_KEY,
  arrivalRefFrom,
  readArrivalSource,
  rememberArrivalRef,
} from './arrival-source';

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, String(value)); },
  };
}

const throwingStore = {
  getItem: () => { throw new Error('blocked'); },
  setItem: () => { throw new Error('blocked'); },
};

describe('arrival source', () => {
  it('is the closed list the events accept', () => {
    expect(ARRIVAL_SOURCES).toEqual(['direct', 'video', 'chatgpt', 'assistant', 'card', 'app', 'note']);
    expect(ARRIVAL_REFS).toEqual(ARRIVAL_SOURCES.filter((source) => source !== 'direct'));
    for (const event of ['email_capture_viewed', 'email_subscribed', 'good_day_check', 'good_day_calendar_add']) {
      expect(ANALYTICS_EVENT_VALUES[event].source).toEqual(ARRIVAL_SOURCES);
    }
  });

  it('reads ref only when it is on the list', () => {
    for (const ref of ARRIVAL_REFS) expect(arrivalRefFrom(`?ref=${ref}`)).toBe(ref);
    expect(arrivalRefFrom('?x=1&ref=video')).toBe('video');
    for (const search of ['', '?', '?ref=', '?ref=VIDEO', '?ref=video%20', '?ref=tiktok', '?ref=direct',
      '?ref=leo', '?ref=visitor%40example.com', `?ref=${'video'.repeat(10)}`, '?utm_source=video']) {
      expect(arrivalRefFrom(search), search).toBeNull();
    }
  });

  it('keeps a listed word for the tab and never a free string', () => {
    const store = memoryStore();
    expect(rememberArrivalRef('?ref=video', store)).toBe('video');
    expect([...store.data]).toEqual([[ARRIVAL_SOURCE_SESSION_KEY, 'video']]);
    expect(readArrivalSource(store)).toBe('video');

    // Another word, or none, leaves what the tab holds.
    expect(rememberArrivalRef('?ref=someone-else', store)).toBeNull();
    expect(rememberArrivalRef('', store)).toBeNull();
    expect([...store.data]).toEqual([[ARRIVAL_SOURCE_SESSION_KEY, 'video']]);

    // A later listed word replaces it.
    expect(rememberArrivalRef('?ref=note', store)).toBe('note');
    expect(readArrivalSource(store)).toBe('note');
    expect(store.data.size).toBe(1);
  });

  it('answers direct when the tab holds nothing listed', () => {
    expect(readArrivalSource(memoryStore())).toBe('direct');
    expect(readArrivalSource(memoryStore({ [ARRIVAL_SOURCE_SESSION_KEY]: 'tampered-value' }))).toBe('direct');
    expect(readArrivalSource(memoryStore({ [ARRIVAL_SOURCE_SESSION_KEY]: 'direct' }))).toBe('direct');
    expect(readArrivalSource(null)).toBe('direct');
    expect(readArrivalSource(throwingStore)).toBe('direct');
    expect(rememberArrivalRef('?ref=card', throwingStore)).toBeNull();
    expect(rememberArrivalRef('?ref=card', null)).toBeNull();
  });

  it('uses session storage, so the word lasts for this tab only', () => {
    const source = readFileSync(new URL('./arrival-source.ts', import.meta.url), 'utf8');
    expect(source).toContain('window.sessionStorage');
    expect(source).not.toContain('localStorage');
    expect(source).not.toMatch(/document\.cookie|crypto\.|randomUUID|Math\.random/u);
  });
});

describe('the page-open script in Base.astro', () => {
  const base = readFileSync(new URL('../layouts/Base.astro', import.meta.url), 'utf8');
  const match = base.match(
    /<script is:inline define:vars=\{\{ arrivalRefs: ARRIVAL_REF_VALUES, arrivalSessionKey: ARRIVAL_SOURCE_SESSION_KEY \}\}>([\s\S]*?)<\/script>/u,
  );

  function open(href: string) {
    const store = memoryStore();
    const replaced: string[] = [];
    const window: Record<string, unknown> = {};
    const location = new URL(href);
    runInNewContext(`(function (arrivalRefs, arrivalSessionKey) {${match![1]}})(refs, key);`, {
      refs: [...ARRIVAL_REFS],
      key: ARRIVAL_SOURCE_SESSION_KEY,
      window,
      location: { href: location.href },
      URL,
      Object,
      sessionStorage: store,
      history: { state: null, replaceState: (_state: unknown, _title: string, url: string) => replaced.push(url) },
    });
    return { store, replaced, window };
  }

  it('is found with the closed list and key passed in', () => {
    expect(match).not.toBeNull();
  });

  it('keeps a listed word for the tab and takes ref off the address', () => {
    const video = open('https://zodiacs.org/good-days/?ref=video#top');
    expect(video.store.getItem(ARRIVAL_SOURCE_SESSION_KEY)).toBe('video');
    expect(video.replaced).toEqual(['/good-days/#top']);
    expect(video.window.zodiacsArrival).toBeNull();
  });

  it('drops any other word without storing it', () => {
    const other = open('https://zodiacs.org/good-days/?ref=newsletter-1234&x=1');
    expect(other.store.data.size).toBe(0);
    expect(other.replaced).toEqual(['/good-days/?x=1']);
    const none = open('https://zodiacs.org/good-days/');
    expect(none.store.data.size).toBe(0);
    expect(none.replaced).toEqual([]);
  });

  it('still marks assistant arrivals as before', () => {
    const chatgpt = open('https://zodiacs.org/birth-chart/?ref=chatgpt');
    expect(chatgpt.window.zodiacsArrival).toBe('chatgpt');
    expect(chatgpt.store.getItem(ARRIVAL_SOURCE_SESSION_KEY)).toBe('chatgpt');
    expect(open('https://zodiacs.org/?ref=assistant').window.zodiacsArrival).toBe('assistant');
    expect(base).toContain(
      "if (window.zodiacsArrival) window.zodiacsAnalytics.track('assistant_arrival', { assistant: window.zodiacsArrival });",
    );
  });
});
