import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = execFileSync('git', ['ls-files', '-z', 'examples/precision-alpha'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter(Boolean);

/*
 * The precision alpha's README says no kernel, no pack and nothing from Swiss
 * Ephemeris is committed. Its tests build synthetic packs at run time, and
 * tools/measure/swiss.py runs Swiss Ephemeris as an instrument from outside.
 */
describe('the precision alpha as committed', () => {
  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('commits no ephemeris kernel or pack', () => {
    expect(files.filter((file) => /\.(?:bsp|bpc|tpc|zeph|eph|se1|se2|440|441)$/iu.test(file))).toEqual([]);
  });

  it('commits nothing from Swiss Ephemeris: no source, header or data file of it', () => {
    expect(files.filter((file) => /(?:^|\/)(?:swe[a-z]*\.[ch]|sweph[a-z]*|sepl_?\d*|semo_?\d*|seas_?\d*)(?:\.|$)/iu.test(file))).toEqual([]);
    const marked = files.filter((file) => /\.(?:c|h|mjs|js|py|json|md|pinned)$/u.test(file)
      && /Astrodienst|swephexp\.h|swephlib\.h/u.test(readFileSync(resolve(root, file), 'utf8')));
    expect(marked).toEqual([]);
  });
});
