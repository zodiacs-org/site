/**
 * Client-side birthplace search over the sharded GeoNames index.
 * Shards load on demand (first keystroke per letter) and stay cached.
 */

import { foldedQuery, rankCities, shardKey, type City, type CityIndex, type Row } from './rank';

export type { City } from './rank';

let indexPromise: Promise<CityIndex> | null = null;
const shardCache = new Map<string, Promise<Row[]>>();

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`fetch ${url}: ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function preloadIndex(): Promise<CityIndex> {
  if (!indexPromise) {
    const pending = fetchJson<CityIndex>('/data/cities/index.json');
    indexPromise = pending;
    void pending.catch(() => {
      if (indexPromise === pending) indexPromise = null;
    });
  }
  return indexPromise;
}

function shard(key: string): Promise<Row[]> {
  const cached = shardCache.get(key);
  if (cached) return cached;
  const pending = fetchJson<Row[]>(`/data/cities/${key}.json`);
  shardCache.set(key, pending);
  void pending.catch(() => {
    if (shardCache.get(key) === pending) shardCache.delete(key);
  });
  return pending;
}

export async function searchCities(query: string, limit = 8): Promise<City[]> {
  const q = foldedQuery(query);
  if (!q) return [];

  const index = await preloadIndex();
  const key = shardKey(q);
  if (!index.shards.includes(key)) return [];
  return rankCities(index, await shard(key), q, limit);
}
