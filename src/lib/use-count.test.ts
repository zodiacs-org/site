import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ANALYTICS_EVENT_VALUES } from './analytics';
import { GOOD_DAY_CHECKS_KEY, USE_BUCKETS, bucketForCount, countGoodDayCheck } from './use-count';

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, String(value)); },
  };
}

describe('good-day use count', () => {
  it('gives only the buckets good_day_check accepts', () => {
    expect(USE_BUCKETS).toEqual(['first', 'second', 'more']);
    expect(ANALYTICS_EVENT_VALUES.good_day_check.use).toEqual(USE_BUCKETS);
    expect([0, 1, 2, 3, 4, 100].map(bucketForCount)).toEqual(['first', 'first', 'second', 'more', 'more', 'more']);
  });

  it('counts first, second, then more, and stops at 3 on the device', () => {
    const store = memoryStore();
    expect(countGoodDayCheck(store)).toBe('first');
    expect(countGoodDayCheck(store)).toBe('second');
    expect(countGoodDayCheck(store)).toBe('more');
    expect(countGoodDayCheck(store)).toBe('more');
    expect(countGoodDayCheck(store)).toBe('more');
    // One key, holding a small number and nothing else.
    expect([...store.data]).toEqual([[GOOD_DAY_CHECKS_KEY, '3']]);
  });

  it('treats a missing, unreadable or tampered count as a first check', () => {
    expect(countGoodDayCheck(null)).toBe('first');
    expect(countGoodDayCheck({
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    })).toBe('first');
    const tampered = memoryStore({ [GOOD_DAY_CHECKS_KEY]: 'abc' });
    expect(countGoodDayCheck(tampered)).toBe('first');
    expect(tampered.data.get(GOOD_DAY_CHECKS_KEY)).toBe('1');
    const huge = memoryStore({ [GOOD_DAY_CHECKS_KEY]: '999999' });
    expect(countGoodDayCheck(huge)).toBe('more');
    expect(huge.data.get(GOOD_DAY_CHECKS_KEY)).toBe('3');
  });

  it('still answers when the store cannot be written', () => {
    const readOnly = { getItem: () => '1', setItem: () => { throw new Error('full'); } };
    expect(countGoodDayCheck(readOnly)).toBe('second');
  });

  it('creates no identifier of any kind', () => {
    const source = readFileSync(new URL('./use-count.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/crypto\.|randomUUID|Math\.random|Date\.now|new Date|document\.cookie|sessionStorage/u);
  });
});
