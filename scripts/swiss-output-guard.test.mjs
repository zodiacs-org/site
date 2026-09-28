/**
 * Swiss Ephemeris output stays out of the tree.
 *
 * DECISIONS-2026-09-28 §3 (audit finding F-22) removed Swiss's raw output from
 * the current tree: ten files, and the per-case fields of 74 more. Each is in
 * docs/engine-validation/swiss-output-removal/manifest.json with the SHA-256
 * of what was removed, the commit that still has it and the command that
 * regenerates it; docs/engine-validation/SWISS-OUTPUT-REMOVAL.md is the
 * written record. This holds the tree to it: a removed file or field that
 * comes back fails here, and so does a Swiss fixture under src/. When a Swiss
 * comparison is wanted, regenerate Swiss's values outside the repository and
 * commit statistics only.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const manifest = JSON.parse(read('docs/engine-validation/swiss-output-removal/manifest.json'));

/**
 * Every value at a manifest path. `.a.b` descends, `[]` takes every element
 * of an array, `x|y` is either key and `<name>` is any key.
 */
function valuesAt(value, path) {
  let nodes = [value];
  for (const segment of path.slice(1).split('.')) {
    const each = segment.endsWith('[]');
    const name = each ? segment.slice(0, -2) : segment;
    const next = [];
    for (const node of nodes) {
      if (node === null || typeof node !== 'object' || Array.isArray(node)) continue;
      const keys = /^<[^>]+>$/u.test(name) ? Object.keys(node) : name.split('|');
      for (const key of keys) {
        if (!Object.hasOwn(node, key)) continue;
        if (!each) next.push(node[key]);
        else if (Array.isArray(node[key])) next.push(...node[key]);
      }
    }
    nodes = next;
  }
  return nodes;
}

describe('Swiss Ephemeris output removed on 2026-09-28', () => {
  it('is recorded against the decision, with a regeneration command for everything removed', () => {
    expect(manifest.base).toMatch(/^[0-9a-f]{40}$/u);
    expect(manifest.what).toContain('DECISIONS-2026-09-28.md §3');
    expect(manifest.removedFiles).toHaveLength(10);
    expect(manifest.strippedFiles).toHaveLength(74);
    for (const entry of [...manifest.removedFiles, ...manifest.strippedFiles]) {
      expect(entry.regenerate, entry.path).toMatch(/\S/u);
    }
    for (const entry of manifest.removedFiles) {
      expect(entry.sha256, entry.path).toMatch(/^[0-9a-f]{64}$/u);
      expect(entry.lastCommitWithTheFile, entry.path).toBe(manifest.base);
    }
  });

  it('keeps every removed file out of the tree', () => {
    const back = manifest.removedFiles.map((entry) => entry.path).filter((path) => existsSync(resolve(root, path)));
    expect(back, 'regenerate Swiss output outside the repository; see SWISS-OUTPUT-REMOVAL.md').toEqual([]);
  });

  it('keeps the removed fields out of every stripped file, which says what left it', () => {
    for (const entry of manifest.strippedFiles) {
      const value = JSON.parse(read(entry.path));
      for (const removed of entry.removed) {
        expect(valuesAt(value, removed.path), `${entry.path} ${removed.path}`).toEqual([]);
      }
      expect(value.swissOutputRemoved?.under, entry.path).toBe('docs/platform/programme/DECISIONS-2026-09-28.md §3');
      expect(value.swissOutputRemoved.removed, entry.path).toEqual(entry.removed);
      expect(value.swissOutputRemoved.lastCommitWithTheValues, entry.path).toBe(manifest.base);
    }
  });

  it('leaves no Swiss reference fixture in the engine tests, only the policies it was judged by', () => {
    // The policies hold gates, inputs and digests, and no value Swiss returned.
    const swiss = readdirSync(resolve(root, 'src/lib/engine/fixtures')).filter((name) => /swiss/iu.test(name));
    expect(swiss.sort()).toEqual([
      'swiss-eight-cases-policy.json',
      'swiss-lunar-fixed-target-applicability.json',
      'swiss-node-polar-policy.json',
    ]);
  });
});
