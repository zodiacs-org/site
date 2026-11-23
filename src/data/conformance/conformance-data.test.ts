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

  it('has 640 vectors in four levels', () => {
    expect(summary.suiteVersion).toBe('0.3.0');
    expect(summary.levels.map((level: { level: string }) => level.level)).toEqual(['L1', 'L2', 'L3', 'L4']);
    expect(summary.levels.reduce((sum: number, level: { count: number }) => sum + level.count, 0)).toBe(640);
  });

  it('accounts for every vector in every run', () => {
    for (const run of summary.runs) {
      const total = run.summary.total;
      expect(total.pass + total.fail + total.unsupported + total.error).toBe(total.count);
      expect(total.count).toBe(run.suiteVersion === '0.3.0' ? 640 : 500);
    }
  });

  it('includes @zodiacs/engine 2.1.0 default DE440 and astronomy-engine runs', () => {
    const de440 = summary.runs.find(
      (run: { file: string }) => run.file === 'results/zodiacs-engine.json',
    );
    const fallback = summary.runs.find(
      (run: { file: string }) => run.file === 'results/zodiacs-engine-astronomy-engine.json',
    );
    expect(de440.adapter.engineVersion).toBe('2.1.0');
    expect(de440.summary.byLevel.L1.pass).toBe(240);
    expect(de440.summary.byLevel.L4).toMatchObject({ count: 140, pass: 140, fail: 0, unsupported: 0, error: 0 });
    expect(de440.summary.total).toMatchObject({ count: 640, pass: 639, fail: 0, unsupported: 1, error: 0 });
    expect(fallback.adapter.engineVersion).toBe('2.1.0');
    expect(fallback.summary.byLevel.L1.pass).toBe(48);
    expect(fallback.summary.byLevel.L4).toMatchObject({ count: 140, pass: 85, fail: 55, unsupported: 0, error: 0 });
    expect(fallback.summary.total).toMatchObject({ count: 640, pass: 392, fail: 247, unsupported: 1, error: 0 });
  });

  it('publishes no per-vector values for Swiss Ephemeris', () => {
    const swiss = summary.runs.find((run: { adapter: { engine: string } }) => run.adapter.engine === 'Swiss Ephemeris');
    expect(swiss.values).toBe('none');
  });
});
