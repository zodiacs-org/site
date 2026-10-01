import { createHash } from 'node:crypto';
import { h } from 'preact';
import render from 'preact-render-to-string';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CalendarSubscribe, { calendarToken } from '../../islands/CalendarSubscribe';
import { POSITION_BODY_ORDER } from '../share-positions';
import {
  CALENDAR_FEEDS_STORAGE_KEY,
  createCalendarFeed,
  calendarFeedRequestPending,
  hasUnstoredCalendarFeeds,
  readAvailableCalendarFeeds,
  readKeptCalendarFeeds,
  removeCalendarFeed,
  watchCalendarFeeds,
} from './client';

// Synthetic positions: no real birth.
const BODIES = POSITION_BODY_ORDER.map((body, index) => ({ body, lon: Number(((index * 23.19) % 360).toFixed(3)) }));
const CODE = calendarToken({ bodies: BODIES, angles: { asc: 101.2, mc: 12.8 }, houseSystem: 'whole', engineVersion: '1.0.0' })!;
const ID = 'Zq3xPq0Jr9Vb_Tm2-Ka5sA';
const OTHER_ID = 'Ab3xPq0Jr9Vb_Tm2-Ka5sQ';
const SECRET = `${'k'.repeat(42)}A`;
const URL_OF = (id: string) => `https://zodiacs.org/api/calendar/feeds/${id}`;

class MemoryStorage {
  values = new Map<string, string>();
  refuse = false;
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) {
    if (this.refuse) throw new DOMException('quota', 'QuotaExceededError');
    this.values.set(key, value);
  }
  removeItem(key: string) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function created(id = ID) {
  return vi.fn(async () => new Response(JSON.stringify({ id, url: URL_OF(id), secret: SECRET }), { status: 201 }));
}

/** A synthetic feed id for the n-th feed: 21 characters and a final one that carries two bits. */
function idOf(n: number) {
  return `${String(n).padStart(21, '0')}A`;
}

const answer = (status: number, body: string) => vi.fn(async () => new Response(body, { status }));

describe('the page side of calendar feeds', () => {
  it('sends the positions code once, in the body, and keeps the id, address and key under one zodiacs key', async () => {
    const fetcher = created();
    const result = await createCalendarFeed(CODE, fetcher as unknown as typeof fetch);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [path, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe('/api/calendar/feeds');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ positions: CODE });
    expect(path).not.toContain(CODE.slice(2, 12));

    expect(result).toEqual({
      state: 'created',
      kept: true,
      feed: {
        id: ID,
        url: URL_OF(ID),
        secret: SECRET,
        madeAt: expect.any(Number),
      },
    });
    expect([...storage.values.keys()]).toEqual([CALENDAR_FEEDS_STORAGE_KEY]);
    expect(CALENDAR_FEEDS_STORAGE_KEY.startsWith('zodiacs.')).toBe(true);
    expect(readKeptCalendarFeeds()).toEqual([result.state === 'created' ? result.feed : null]);
  });

  it('keeps the address, the key and when the feed was made, and nothing about the chart', async () => {
    await createCalendarFeed(CODE, created() as unknown as typeof fetch);
    const stored = storage.getItem(CALENDAR_FEEDS_STORAGE_KEY)!;
    expect(JSON.parse(stored)).toEqual({
      version: 1,
      feeds: [{ id: ID, url: URL_OF(ID), secret: SECRET, madeAt: expect.any(Number) }],
    });
    // Neither the code nor any digest of it, which for a chart without a
    // birth time could be matched against every date.
    expect(stored).not.toContain(CODE);
    expect(stored).not.toContain(createHash('sha256').update(CODE).digest('hex'));
    expect(stored).not.toMatch(/[0-9a-f]{64}/u);
  });

  it('keeps every key it is given, however many feeds this browser made', async () => {
    const made: string[] = [];
    for (let n = 0; n < 40; n += 1) {
      made.push(idOf(n));
      vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000 + n);
      const result = await createCalendarFeed(`${CODE}${n}`, created(idOf(n)) as unknown as typeof fetch);
      expect(result.state === 'created' && result.kept).toBe(true);
    }
    vi.restoreAllMocks();
    expect(readKeptCalendarFeeds().map((feed) => feed.id)).toEqual([...made].reverse());
  });

  it('keeps nothing when the server does not make a feed', async () => {
    for (const [status, state] of [[429, 'rate-limited'], [400, 'unavailable'], [503, 'unavailable']] as const) {
      const result = await createCalendarFeed(CODE, vi.fn(async () => new Response('{}', { status })) as unknown as typeof fetch);
      expect(result).toEqual({ state });
    }
    const odd = await createCalendarFeed(CODE, vi.fn(async () => new Response(JSON.stringify({ id: 'x', url: 'https://example.com/', secret: SECRET }), { status: 201 })) as unknown as typeof fetch);
    expect(odd).toEqual({ state: 'unavailable' });
    expect(storage.values.size).toBe(0);
  });

  it('still returns a feed this browser would not keep', async () => {
    storage.refuse = true;
    const result = await createCalendarFeed(CODE, created() as unknown as typeof fetch);
    expect(result.state === 'created' && result.kept).toBe(false);
    expect(readKeptCalendarFeeds()).toEqual([]);
  });

  it('removes a feed with its key as a bearer and forgets it; a feed our API no longer has counts as removed', async () => {
    await createCalendarFeed(CODE, created(ID) as unknown as typeof fetch);
    await createCalendarFeed(`${CODE}x`, created(OTHER_ID) as unknown as typeof fetch);
    const [newest, oldest] = readKeptCalendarFeeds();
    expect([newest.id, oldest.id]).toEqual([OTHER_ID, ID]);

    const fetcher = vi.fn(async () => new Response('{"removed":true}', { status: 200 }));
    expect(await removeCalendarFeed(oldest, fetcher as unknown as typeof fetch)).toBe('removed');
    const [path, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(path).toBe(`/api/calendar/feeds/${ID}`);
    expect(init.method).toBe('DELETE');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${SECRET}`);
    expect(init.body).toBeUndefined();
    expect(readKeptCalendarFeeds().map((feed) => feed.id)).toEqual([OTHER_ID]);

    expect(await removeCalendarFeed(newest, answer(404, '{"error":"not_found"}') as unknown as typeof fetch))
      .toBe('removed');
    expect(storage.values.size).toBe(0);
  });

  it('keeps the key unless our API says the feed is gone', async () => {
    await createCalendarFeed(CODE, created() as unknown as typeof fetch);
    const [feed] = readKeptCalendarFeeds();
    for (const [status, body] of [
      [404, ''],
      [404, '<!doctype html><title>404: NOT_FOUND</title>'],
      [404, '{}'],
      [404, '{"error":"not_found","extra":true}'],
      [404, '{"error":"forbidden"}'],
      [200, ''],
      [200, '{"removed":false}'],
      [200, '<html>captive portal</html>'],
      [403, '{"error":"forbidden"}'],
      [410, '{"error":"not_found"}'],
    ] as const) {
      expect(await removeCalendarFeed(feed, answer(status, body) as unknown as typeof fetch), `${status} ${body}`)
        .toBe('unavailable');
      expect(readKeptCalendarFeeds()).toEqual([feed]);
    }
  });

  it('keeps the key when a removal fails', async () => {
    await createCalendarFeed(CODE, created() as unknown as typeof fetch);
    const [feed] = readKeptCalendarFeeds();
    expect(await removeCalendarFeed(feed, vi.fn(async () => new Response('{}', { status: 503 })) as unknown as typeof fetch))
      .toBe('unavailable');
    expect(await removeCalendarFeed(feed, vi.fn(async () => { throw new TypeError('network'); }) as unknown as typeof fetch))
      .toBe('unavailable');
    expect(readKeptCalendarFeeds()).toEqual([feed]);
  });

  it('drops malformed stored entries rather than trusting them, and any chart digest an entry carried', () => {
    storage.setItem(CALENDAR_FEEDS_STORAGE_KEY, JSON.stringify({
      version: 1,
      feeds: [
        { id: ID, url: URL_OF(ID), secret: SECRET, chart: 'a'.repeat(64), madeAt: 1 },
        { id: ID, url: URL_OF(OTHER_ID), secret: SECRET, madeAt: 2 },
        { id: OTHER_ID, url: URL_OF(OTHER_ID), secret: 'short', madeAt: 3 },
        { id: OTHER_ID, url: `http://zodiacs.org/api/calendar/feeds/${OTHER_ID}`, secret: SECRET, madeAt: 4 },
        'nonsense',
      ],
    }));
    expect(readKeptCalendarFeeds()).toEqual([{ id: ID, url: URL_OF(ID), secret: SECRET, madeAt: 1 }]);
    storage.setItem(CALENDAR_FEEDS_STORAGE_KEY, '{not json');
    expect(readKeptCalendarFeeds()).toEqual([]);
  });
});

describe('document-scoped calendar capabilities', () => {
  beforeEach(() => {
    vi.stubGlobal('document', new EventTarget());
    vi.stubGlobal('window', Object.assign(new EventTarget(), { localStorage: storage }));
    vi.stubGlobal('navigator', { locks: { request: async (_name: string, _options: unknown, run: () => unknown) => run() } });
  });

  it('retains only the returned feed record when storage refuses it, then forgets it on confirmed removal', async () => {
    storage.refuse = true;
    const result = await createCalendarFeed(CODE, created() as unknown as typeof fetch);
    expect(result.state).toBe('created');
    if (result.state !== 'created') return;
    expect(readKeptCalendarFeeds()).toEqual([]);
    expect(readAvailableCalendarFeeds()).toEqual([result.feed]);
    expect(Object.keys(readAvailableCalendarFeeds()[0]).sort()).toEqual(['id', 'madeAt', 'secret', 'url']);
    expect(hasUnstoredCalendarFeeds()).toBe(true);
    expect(await removeCalendarFeed(result.feed, answer(503, '{}') as unknown as typeof fetch)).toBe('unavailable');
    expect(readAvailableCalendarFeeds()).toEqual([result.feed]);
    expect(await removeCalendarFeed(result.feed, answer(200, '{"removed":true}') as unknown as typeof fetch)).toBe('removed');
    expect(readAvailableCalendarFeeds()).toEqual([]);
    expect(hasUnstoredCalendarFeeds()).toBe(false);
  });

  it('notifies all mounted readers about accepted creation and removal', async () => {
    storage.refuse = true;
    const first = vi.fn(() => readAvailableCalendarFeeds());
    const second = vi.fn(() => readAvailableCalendarFeeds());
    const stop = watchCalendarFeeds(first);
    watchCalendarFeeds(second);
    const result = await createCalendarFeed(CODE, created() as unknown as typeof fetch);
    if (result.state !== 'created') throw new Error('Expected synthetic feed');
    expect(first.mock.results.at(-1)?.value).toEqual([result.feed]);
    expect(second.mock.results.at(-1)?.value).toEqual([result.feed]);
    stop();
    const calls = first.mock.calls.length;
    await removeCalendarFeed(result.feed, answer(200, '{"removed":true}') as unknown as typeof fetch);
    expect(first).toHaveBeenCalledTimes(calls);
    expect(second.mock.results.at(-1)?.value).toEqual([]);
  });

  it('serializes creation and deletion even when invoked by independent callers', async () => {
    let finish!: (response: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const pending = createCalendarFeed(CODE, fetcher as unknown as typeof fetch);
    expect(calendarFeedRequestPending()).toBe('adding');
    expect(await createCalendarFeed(CODE, fetcher as unknown as typeof fetch)).toEqual({ state: 'busy' });
    const fixture = { id: ID, url: URL_OF(ID), secret: SECRET, madeAt: 1 };
    expect(await removeCalendarFeed(fixture, fetcher as unknown as typeof fetch)).toBe('busy');
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
    finish(new Response(JSON.stringify(fixture), { status: 201 }));
    await pending;
    expect(calendarFeedRequestPending()).toBeNull();
  });

  it('does not carry volatile capabilities or pending requests into another document', async () => {
    storage.refuse = true;
    await createCalendarFeed(CODE, created() as unknown as typeof fetch);
    expect(readAvailableCalendarFeeds()).toHaveLength(1);
    vi.stubGlobal('document', new EventTarget());
    vi.stubGlobal('window', new EventTarget());
    expect(readAvailableCalendarFeeds()).toEqual([]);
    expect(calendarFeedRequestPending()).toBeNull();
  });

  it('clears existing volatile keys and fences late responses even before reload', async () => {
    const { clearAllZodiacsDataFromDevice } = await import('../account-v2/profile-boundary');
    storage.refuse = true;
    await createCalendarFeed(CODE, created(OTHER_ID) as unknown as typeof fetch);
    expect(readAvailableCalendarFeeds()).toHaveLength(1);
    storage.refuse = false;
    let finish!: (response: Response) => void;
    const pending = createCalendarFeed(CODE, (() => new Promise<Response>((resolve) => { finish = resolve; })) as typeof fetch);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    window.dispatchEvent(new Event('zodiacs:profile-lease-revoke'));
    expect(clearAllZodiacsDataFromDevice(storage, new MemoryStorage()).ok).toBe(true);
    expect(readAvailableCalendarFeeds()).toEqual([]);
    finish(new Response(JSON.stringify({ id: ID, url: URL_OF(ID), secret: SECRET }), { status: 201 }));
    const result = await pending;
    expect(result).toEqual({ state: 'cancelled' });
    expect(storage.getItem(CALENDAR_FEEDS_STORAGE_KEY)).toBeNull();
    expect(readAvailableCalendarFeeds()).toEqual([]);
    window.dispatchEvent(new Event('pagehide'));
    vi.stubGlobal('document', new EventTarget());
    vi.stubGlobal('window', new EventTarget());
    expect(readAvailableCalendarFeeds()).toEqual([]);
  });

  it('keeps volatile keys on ordinary lease revocation and retains its late success without persistence', async () => {
    storage.refuse = true;
    await createCalendarFeed(CODE, created(OTHER_ID) as unknown as typeof fetch);
    let finish!: (response: Response) => void;
    const pending = createCalendarFeed(CODE, (() => new Promise<Response>((resolve) => { finish = resolve; })) as typeof fetch);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    window.dispatchEvent(new Event('zodiacs:profile-lease-revoke'));
    expect(readAvailableCalendarFeeds()).toHaveLength(1);
    storage.refuse = false;
    finish(new Response(JSON.stringify({ id: ID, url: URL_OF(ID), secret: SECRET }), { status: 201 }));
    const result = await pending;
    expect(result.state === 'created' && result.kept).toBe(false);
    expect(readAvailableCalendarFeeds()).toHaveLength(2);
    expect(readKeptCalendarFeeds()).toEqual([]);
  });

  it('releases request ownership and notifies other readers if one listener throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    watchCalendarFeeds(() => { throw new Error('View failed'); });
    const other = vi.fn();
    watchCalendarFeeds(other);
    expect((await createCalendarFeed(CODE, created() as unknown as typeof fetch)).state).toBe('created');
    expect(calendarFeedRequestPending()).toBeNull();
    expect(other).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it('does not let an unloaded document write a late response back to storage', async () => {
    let finish!: (response: Response) => void;
    const pending = createCalendarFeed(CODE, (() => new Promise<Response>((resolve) => { finish = resolve; })) as typeof fetch);
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    window.dispatchEvent(new Event('pagehide'));
    finish(new Response(JSON.stringify({ id: ID, url: URL_OF(ID), secret: SECRET }), { status: 201 }));
    await pending;
    expect(readAvailableCalendarFeeds()).toEqual([]);
    expect(storage.getItem(CALENDAR_FEEDS_STORAGE_KEY)).toBeNull();
  });

  it('does not resurrect a removed feed when storage cleanup failed', async () => {
    const result = await createCalendarFeed(CODE, created() as unknown as typeof fetch);
    if (result.state !== 'created') throw new Error('Expected synthetic feed');
    const spy = vi.spyOn(storage, 'removeItem').mockImplementationOnce(() => { throw new Error('Storage refused'); });
    await removeCalendarFeed(result.feed, answer(200, '{"removed":true}') as unknown as typeof fetch);
    expect(readKeptCalendarFeeds()).toHaveLength(1);
    expect(readAvailableCalendarFeeds()).toEqual([]);
    spy.mockRestore();
    await createCalendarFeed(CODE, created(OTHER_ID) as unknown as typeof fetch);
    expect(readKeptCalendarFeeds().map((feed) => feed.id)).toEqual([OTHER_ID]);
  });
});

describe('the subscription block', () => {
  it('offers to add the calendar and says what that stores, with no address before anyone subscribes', () => {
    const markup = render(h(CalendarSubscribe, {
      locale: 'en',
      positions: { bodies: BODIES, angles: { asc: 101.2, mc: 12.8 }, houseSystem: 'whole', engineVersion: '1.0.0', utc: '2001-01-01T12:34:00Z' },
    }));
    expect(markup).toContain('data-calendar-subscribe');
    expect(markup).toContain('Add to your calendar');
    expect(markup).toContain('Subscribing saves this chart’s positions on our server under a random address that carries nothing else.');
    expect(markup).toContain('The feed keeps the Ascendant and Midheaven to the whole degree, so its contacts to those two points are approximate');
    expect(markup).toContain('This browser keeps the address and the key that removes it until you remove the calendar here or clear this site’s data.');
    expect(markup).not.toContain('webcal:');
    expect(markup).not.toContain('token=');
    expect(markup).not.toContain('data-calendar-remove');
  });

  it('says what a chart without a birth time stores', () => {
    const markup = render(h(CalendarSubscribe, {
      locale: 'fr',
      positions: { bodies: BODIES, angles: null, houseSystem: 'whole', engineVersion: '1.0.0', utc: '2001-01-01T11:00:00Z' },
      birthDate: '2001-01-01',
    }));
    expect(markup).toContain('le ciel de 12:00 UTC à ta date de naissance');
    expect(markup).toContain('Lien de calendrier indisponible');
  });
});

describe('what the block says after a removal', () => {
  it('says the address stops working within the hour, in every locale', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync(new URL('../../islands/CalendarSubscribe.tsx', import.meta.url), 'utf8');
    const removed = [...source.matchAll(/^\s+removed: '([^']+)',$/gmu)].map((match) => match[1]);
    expect(removed).toEqual([
      'Removed. The address stops working within the hour; delete the calendar in your calendar app too.',
      'Quitado. La dirección deja de funcionar en menos de una hora; borra también el calendario en tu app de calendario.',
      'Removido. O endereço deixa de funcionar em menos de uma hora; apague também o calendário no seu app de calendário.',
      'Retiré. L’adresse cesse de fonctionner dans l’heure ; supprime aussi le calendrier dans ton app de calendrier.',
      'Rimosso. L’indirizzo smette di funzionare entro un’ora; elimina il calendario anche nella tua app di calendario.',
      'Удалено. Адрес перестанет работать в течение часа; удалите календарь и в приложении календаря.',
    ]);
  });
});
