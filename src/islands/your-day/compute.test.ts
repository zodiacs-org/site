import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ZONE_PER_HISTORY_FILE } from '../../lib/time/every-zone-history';
import { computeYourDay, prepareEveryZoneHistory, prepareLocalTime } from './compute';

describe('your-day browser zone history preloading', () => {
  it('starts all 16 zone history downloads uniformly without blocking modern readings on stalled shards', async () => {
    expect(typeof prepareEveryZoneHistory).toBe('function');
    const source = readFileSync(new URL('./compute.ts', import.meta.url), 'utf8');
    expect(source).not.toContain('Promise.allSettled');
    expect(source).not.toContain('await prepareLocalTime(input.birthDate');

    const started: string[] = [];
    const reading = await computeYourDay(
      {
        birthDate: '1990-05-03',
        time: '08:30',
        birthZone: 'UTC',
        latitude: 51.5072,
        longitude: -0.1276,
        date: '2026-11-28',
        zone: 'UTC',
        today: '2026-11-28',
        now: new Date('2026-11-28T12:00:00Z'),
      },
      (date, zone) => {
        started.push(`${date}:${zone}`);
        if (date === '2026-01-01') return prepareLocalTime(date, zone);
        // Simulate all 16 unused history downloads hanging indefinitely.
        return new Promise<void>(() => {});
      },
    );

    expect(reading.sunSign).toBe('taurus');
    expect(started).toEqual(['2026-01-01:UTC', ...ZONE_PER_HISTORY_FILE.map((zone) => `1900-01-01:${zone}`)]);
  });

  it('awaits only the needed shard for pre-1970 births and fails without retrying if that shard rejects', async () => {
    const parisReading = await computeYourDay(
      {
        birthDate: '1965-05-03',
        time: '08:30',
        birthZone: 'Europe/Paris',
        latitude: 48.8566,
        longitude: 2.3522,
        date: '2026-11-28',
        zone: 'UTC',
        today: '2026-11-28',
        now: new Date('2026-11-28T12:00:00Z'),
      },
      (date, zone) => {
        if (date === '2026-01-01' || zone === 'Europe/Paris') return prepareLocalTime(date, zone);
        // Every other shard stalls forever.
        return new Promise<void>(() => {});
      },
    );
    expect(parisReading.sunSign).toBe('taurus');

    const shardError = new Error('paris-shard-failed');
    await expect(computeYourDay(
      {
        birthDate: '1965-05-03',
        time: '08:30',
        birthZone: 'Europe/Paris',
        latitude: 48.8566,
        longitude: 2.3522,
        date: '2026-11-28',
        zone: 'UTC',
        today: '2026-11-28',
        now: new Date('2026-11-28T12:00:00Z'),
      },
      (date, zone) => {
        if (date === '2026-01-01') return prepareLocalTime(date, zone);
        if (zone === 'Europe/Paris') return Promise.reject(shardError);
        return new Promise<void>(() => {});
      },
    )).rejects.toBe(shardError);
  });
});
