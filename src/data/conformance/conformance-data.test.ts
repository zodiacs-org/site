import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import source from './source.json';
import summary from './summary.json';
import unsupported from './unsupported.json';

const digest = (file: string) => createHash('sha256').update(readFileSync(resolve(__dirname, file))).digest('hex');
const reasons: Record<string, Record<string, string[]>> = unsupported;

describe('published conformance results', () => {
  it('pins the summary and unsupported reasons to the v2.0.0 release', () => {
    expect(source.release).toBe('v2.0.0');
    expect(source.commit).toBe('01432be354d219dbc2d5609e05a9dd0bcfd313e0');
    expect(source.sha256).toBe('7b26115a5507bbd9c705bbbaa99be3a2408711c61be0b5141424535a75eed03f');
    expect(digest('summary.json')).toBe(source.sha256);
    expect(digest('unsupported.json')).toBe(source.unsupportedSha256);
  });

  it('distinguishes full-suite totals from the astronomy-engine position result', () => {
    expect(summary.suiteVersion).toBe('0.3.0');
    expect(summary.levels.map(({ level, count }) => [level, count])).toEqual([
      ['L1', 240], ['L2', 150], ['L3', 110], ['L4', 140],
    ]);
    const standard = summary.runs.find(({ adapter }) => adapter.name === 'zodiacs-engine')!;
    const fallback = summary.runs.find(({ adapter }) => adapter.name === 'zodiacs-engine-astronomy-engine')!;
    expect(standard.summary.total).toEqual({ count: 640, pass: 569, fail: 0, unsupported: 71, error: 0 });
    expect(standard.summary.byLevel.L1.pass).toBe(240);
    expect(fallback.summary.byLevel.L1).toEqual({ count: 240, pass: 48, fail: 192, unsupported: 0, error: 0 });
  });

  it('accounts for every verdict and each distinct unsupported vector in each run', () => {
    for (const run of summary.runs) {
      const total = run.summary.total;
      expect(total.pass + total.fail + total.unsupported + total.error).toBe(total.count);
      const groups = Object.entries(reasons[run.adapter.engine]);
      expect(groups.every(([detail, ids]) => detail.trim() && ids.length)).toBe(true);
      const ids = groups.flatMap(([, ids]) => ids);
      expect(ids).toHaveLength(total.unsupported);
      expect(new Set(ids).size).toBe(total.unsupported);
      for (const [level, bucket] of Object.entries(run.summary.byLevel)) {
        expect(ids.filter((id) => id.startsWith(level + '-'))).toHaveLength(bucket.unsupported);
      }
    }
  });

  it('retains the earlier Swiss Ephemeris run at its original coverage', () => {
    const swiss = summary.runs.find(({ adapter }) => adapter.engine === 'Swiss Ephemeris')!;
    expect(swiss.values).toBe('none');
    expect(swiss.suiteVersion).toBe('0.1.0');
    expect(swiss.summary.total.count).toBe(500);
  });
});
