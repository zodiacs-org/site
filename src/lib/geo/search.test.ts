import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const index = { tz: ['Europe/Paris'], admin1: ['Île-de-France'], countries: ['France'], shards: ['p'] };
const rows = [['Paris', 0, 0, 0, 4886, 235, 0, 2100000]];
const json = (value: unknown) => ({ ok: true, json: () => Promise.resolve(value) });

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('birthplace request recovery', () => {
  it('shares requests and retains successful index and shard data', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(index)).mockResolvedValueOnce(json(rows));
    vi.stubGlobal('fetch', fetcher);
    const { preloadIndex, searchCities } = await import('./search');
    const first = preloadIndex();
    expect(preloadIndex()).toBe(first);
    const [a, b] = await Promise.all([searchCities('Paris'), searchCities('Par')]);
    expect(a).toEqual(b);
    expect(a[0]).toMatchObject({ name: 'Paris', lat: 48.86, lon: 2.35, tz: 'Europe/Paris' });
    await searchCities('Paris');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('evicts a failed index and can later find a city', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(json(index)).mockResolvedValueOnce(json(rows));
    vi.stubGlobal('fetch', fetcher);
    const { searchCities } = await import('./search');
    await expect(searchCities('Paris')).rejects.toThrow('offline');
    await expect(searchCities('Paris')).resolves.toMatchObject([{ name: 'Paris' }]);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      '/data/cities/index.json', '/data/cities/index.json', '/data/cities/p.json',
    ]);
  });

  it.each(['HTTP error', 'invalid JSON'])('evicts a shard after %s without discarding the good index', async (failure) => {
    const bad = failure === 'HTTP error'
      ? { ok: false, status: 503 }
      : { ok: true, json: () => Promise.reject(new SyntaxError('invalid JSON')) };
    const fetcher = vi.fn().mockResolvedValueOnce(json(index)).mockResolvedValueOnce(bad).mockResolvedValueOnce(json(rows));
    vi.stubGlobal('fetch', fetcher);
    const { searchCities } = await import('./search');
    await expect(searchCities('Paris')).rejects.toThrow();
    await expect(searchCities('Paris')).resolves.toMatchObject([{ name: 'Paris' }]);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      '/data/cities/index.json', '/data/cities/p.json', '/data/cities/p.json',
    ]);
  });

  it('observes optional preload rejection, then retries normally without a cache-busting URL', async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(json(index));
    vi.stubGlobal('fetch', fetcher);
    const { preloadIndex } = await import('./search');
    void preloadIndex();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(preloadIndex()).resolves.toEqual(index);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/data/cities/index.json', '/data/cities/index.json']);
  });

  it('aborts a stalled request after 15 seconds and can retry the same shard', async () => {
    vi.useFakeTimers();
    let signal!: AbortSignal;
    const fetcher = vi.fn().mockResolvedValueOnce(json(index))
      .mockImplementationOnce((_url: string, options: RequestInit) => {
        signal = options.signal as AbortSignal;
        return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')), { once: true }));
      }).mockResolvedValueOnce(json(rows));
    vi.stubGlobal('fetch', fetcher);
    const { searchCities } = await import('./search');
    const pending = searchCities('Paris');
    const failure = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(14_999);
    expect(signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await failure;
    expect(signal.aborted).toBe(true);
    await expect(searchCities('Paris')).resolves.toMatchObject([{ name: 'Paris' }]);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      '/data/cities/index.json', '/data/cities/p.json', '/data/cities/p.json',
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the deadline active while the response body is still arriving', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockImplementationOnce((_url: string, options: RequestInit) => ({
      ok: true,
      json: () => new Promise((_, reject) => options.signal!.addEventListener('abort',
        () => reject(new DOMException('Timed out', 'AbortError')), { once: true })),
    })).mockResolvedValueOnce(json(index));
    vi.stubGlobal('fetch', fetcher);
    const { preloadIndex } = await import('./search');
    const failure = expect(preloadIndex()).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(15_000);
    await failure;
    await expect(preloadIndex()).resolves.toEqual(index);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not download for a short query or retry successful empty data', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json(index)).mockResolvedValueOnce(json([]));
    vi.stubGlobal('fetch', fetcher);
    const { searchCities } = await import('./search');
    await expect(searchCities('p')).resolves.toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(searchCities('Paris')).resolves.toEqual([]);
    await expect(searchCities('Paris')).resolves.toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('the whole-index search', () => {
  it('requests the same addresses whatever is typed, with nothing typed in any of them, and still finds the place', async () => {
    const { readFile } = await import('node:fs/promises');
    const served = async (url: string) => json(JSON.parse(await readFile(new URL(`../../../public${url}`, import.meta.url), 'utf8')));
    const shards = JSON.parse(await readFile(new URL('../../../public/data/cities/index.json', import.meta.url), 'utf8')).shards as string[];
    const everything = ['/data/cities/index.json', ...shards.map((key) => `/data/cities/${key}.json`)].sort();
    for (const [typed, found] of [['London', 'London'], ['Tokyo', 'Tokyo'], ['Zürich', 'Zürich'], ['Ålesund', 'Ålesund']] as const) {
      vi.resetModules();
      const fetcher = vi.fn((url: string) => served(url));
      vi.stubGlobal('fetch', fetcher);
      const { searchWholeIndex } = await import('./search');
      const cities = await searchWholeIndex(typed);
      expect(cities[0]?.name, typed).toBe(found);
      const requested = fetcher.mock.calls.map(([url]) => url);
      expect([...requested].sort(), typed).toEqual(everything);
      // A second search fetches nothing more.
      await searchWholeIndex(typed.slice(0, 3));
      expect(fetcher).toHaveBeenCalledTimes(requested.length);
    }
  });

  it('loads the whole index on focus before anything is typed', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({ ...index, shards: ['l', 'p'] })).mockResolvedValue(json(rows));
    vi.stubGlobal('fetch', fetcher);
    const { preloadWholeIndex } = await import('./search');
    await preloadWholeIndex();
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/data/cities/index.json', '/data/cities/l.json', '/data/cities/p.json']);
  });
});
