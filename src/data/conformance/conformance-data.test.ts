/*
 * The vendored conformance summary: the bytes the page renders are the ones
 * the engine repository published at the recorded commit, and the counts the
 * page shows add up.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import source from './source.json';

const bytes = readFileSync(resolve(__dirname, 'summary.json'));
const summary = JSON.parse(bytes.toString('utf8'));

describe('vendored conformance summary', () => {
  it('matches the digest recorded with its source commit', () => {
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);
    expect(source.commit).toMatch(/^[0-9a-f]{40}$/u);
  });

  it('has 500 vectors in three levels', () => {
    expect(summary.levels.map((level: { level: string }) => level.level)).toEqual(['L1', 'L2', 'L3']);
    expect(summary.levels.reduce((sum: number, level: { count: number }) => sum + level.count, 0)).toBe(500);
  });

  it('accounts for every vector in every run', () => {
    for (const run of summary.runs) {
      const total = run.summary.total;
      expect(total.pass + total.fail + total.unsupported + total.error).toBe(total.count);
      expect(total.count).toBe(500);
    }
  });

  it('publishes no per-vector values for Swiss Ephemeris', () => {
    const swiss = summary.runs.find((run: { adapter: { engine: string } }) => run.adapter.engine === 'Swiss Ephemeris');
    expect(swiss.values).toBe('none');
  });
});
