import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildLensEvents, writeLensEvents } from './build-market-lens-events.mjs';

describe('Market Lens committed sky projection', () => {
  it('is deterministic, fixture-free, and retains authoritative source digests', async () => {
    const first = await buildLensEvents();
    const second = await buildLensEvents();
    expect([...first.artifacts]).toEqual([...second.artifacts]);
    expect(first.manifest.coverage).toEqual({ start: '2026-01-01T00:00:00.000Z', end: '2031-01-01T00:00:00.000Z' });
    expect(first.manifest.months).toHaveLength(60);
    expect(first.events.length).toBeGreaterThan(1000);
    const sample = first.events.find((event) => event.family === 'lunation');
    const source = await readFile(sample.provenance.catalog, 'utf8');
    expect(sample.provenance.sha256).toBe(createHash('sha256').update(source).digest('hex'));
    expect(first.events.every((event) => !event.provenance.catalog.includes('fixture'))).toBe(true);
    expect(first.events.every((event) => event.at >= first.manifest.coverage.start && event.at < first.manifest.coverage.end)).toBe(true);
    expect(new Set(first.events.map((event) => event.id)).size).toBe(first.events.length);
    expect(first.events.some((event) => event.family === 'station' && event.at === first.manifest.coverage.start)).toBe(false);
  });
  it('links every eclipse reciprocally to its corresponding lunation without replacing peak times', async () => {
    const { events } = await buildLensEvents();
    const eclipses = events.filter((event) => event.family === 'eclipse');
    expect(eclipses.length).toBeGreaterThan(20);
    for (const eclipse of eclipses) {
      const lunation = events.find((event) => event.id === eclipse.linkedIds[0]);
      expect(lunation.family).toBe('lunation');
      expect(lunation.subtype).toBe(eclipse.subtype === 'solar' ? 'new' : 'full');
      expect(lunation.linkedIds).toContain(eclipse.id);
      expect(Math.abs(Date.parse(lunation.at) - Date.parse(eclipse.at))).toBeLessThan(6 * 3600_000);
    }
  });
  it('committed projection has no generation drift', async () => {
    await expect(writeLensEvents({ check: true })).resolves.toBeDefined();
  });
});
