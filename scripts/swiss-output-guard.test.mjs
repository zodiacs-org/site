/**
 * Swiss Ephemeris output stays out of the tree.
 *
 * DECISIONS-2026-09-28 §3 (audit finding F-22) removed Swiss's raw output from
 * the current tree, and DECISIONS-2026-09-29 §2 set what that covers: no Swiss
 * Ephemeris source code anywhere; no per-case Swiss value kept as data
 * anywhere, including a value that arithmetic on what remains gives back; no
 * Swiss value in src/ in any form. docs/engine-validation/SWISS-OUTPUT-REMOVAL.md
 * is the written record, and docs/engine-validation/swiss-output-removal/
 * holds what strip.py made: the manifest of every file and field removed or
 * replaced, with the SHA-256 of what left, and value-digests.json, the digests
 * of every distinctive number and timestamp that left.
 *
 * The guard reads the tree by content, not by name. It fails on
 *   - a removed or replaced file's bytes under any name or in any archive;
 *   - a removed value in any data or code file, or anywhere under src/;
 *   - a Swiss provenance marker under src/, beyond the kept policies and the
 *     conformance suite's summary;
 *   - Swiss Ephemeris source code in any data or code file, or a patch in a
 *     swisseph commit receipt;
 * and, as before, on a removed file at its old path or a removed field back in
 * a stripped file. When a Swiss comparison is wanted, regenerate Swiss's
 * values outside the repository and commit statistics only.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeText, lineAt, sha256, textTokens, tokenDigest, walkTree } from './lib/swiss-output-scan.mjs';

const root = process.cwd();
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const RECORD = 'docs/engine-validation/swiss-output-removal/';
const manifest = JSON.parse(read(`${RECORD}manifest.json`));
const digests = JSON.parse(read(`${RECORD}value-digests.json`));
const DECISIONS = {
  '2026-09-28': 'docs/platform/programme/DECISIONS-2026-09-28.md §3',
  '2026-09-29': 'docs/platform/programme/DECISIONS-2026-09-29.md §2',
};
const SCAN_TIMEOUT = 300_000;

/** Swiss provenance: its Python binding, the library's name, its ephemeris flag, a call on the swe module. */
const PROVENANCE = /pyswisseph|swisseph|swieph|\bswe\.[a-z_]+/giu;
/** Swiss Ephemeris source code: its headers, its internal functions, swetest's usage text, its copyright holder. */
const SOURCE = new RegExp(['swephexp\\.h', 'sweodef\\.h', 'swephlib\\.h', 'swejpl\\.h', 'swedate\\.h', 'swehouse\\.h', 'swecl\\.h',
  'sweph\\.h', '\\bswi_[a-z0-9_]+\\s*\\(', ['Astrodienst', 'AG'].join(' '), 'static char \\*infocmd'].join('|'), 'gu');

/**
 * The files under src/ that may name Swiss. The packs' acceptance policies
 * describe how Swiss was called and hold cases, gates, inputs and digests but
 * no value it returned; the engine tests are still judged by them, and they
 * are pinned here so that any change to them is reviewed.
 */
const KEPT_POLICIES = new Map([
  ['src/lib/engine/fixtures/swiss-eight-cases-policy.json', '9dfc069be7c6854da1f0dff578c0b213e64624e720d21e27c6301b7612fd79a4'],
  ['src/lib/engine/fixtures/swiss-node-polar-policy.json', '7742cb2bc7cd0932a344ddcb708e45dad07b91cb653ea1f55538c2d73fa18e96'],
]);
/** The conformance suite's summary names the pyswisseph run it measured; that run may carry statistics only. */
const CONFORMANCE = 'src/data/conformance/summary.json';

function conformanceProblems(source) {
  const summary = JSON.parse(source);
  const swiss = summary.runs.filter((run) => run.adapter?.engine === 'Swiss Ephemeris');
  const problems = swiss.filter((run) => run.values !== 'none').map((run) => `${CONFORMANCE}: the ${run.adapter.name} run carries values`);
  const rest = JSON.stringify({ ...summary, runs: summary.runs.filter((run) => !swiss.includes(run)) });
  for (const match of rest.matchAll(PROVENANCE)) problems.push(`${CONFORMANCE}: "${match[0]}" outside the Swiss run`);
  return problems;
}

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

/** Any key named `patch`, however deep. */
const hasPatch = (value) => value !== null && typeof value === 'object'
  && (Object.hasOwn(value, 'patch') || Object.values(value).some(hasPatch));

/** One pass over the tree, shared by the content checks below. */
let found;
function scan() {
  if (found) return found;
  const forbidden = new Map([
    ...manifest.removedFiles.map((entry) => [entry.sha256, `the removed ${entry.path}`]),
    ...manifest.replacedFiles.map((entry) => [entry.before.sha256, `${entry.path} as it gave Swiss's values back`]),
  ]);
  const sizes = new Set([...manifest.removedFiles.map((e) => e.bytes), ...manifest.replacedFiles.map((e) => e.before.bytes)]);
  const gone = new Set(digests.gone);
  found = { files: 0, bytes: [], values: [], provenance: [], source: [], patches: [] };
  found.files = walkTree(root, (entry) => {
    if (entry.path.startsWith(RECORD)) return;
    const where = entry.member ? `${entry.path}!${entry.member}` : entry.path;
    if (sizes.has(entry.bytes.length)) {
      const what = forbidden.get(sha256(entry.bytes));
      if (what) found.bytes.push(`${where} is ${what}`);
    }
    if (!entry.scanned) return;
    const text = decodeText(entry.bytes);
    for (const { token, text: written, index } of textTokens(text)) {
      if (gone.has(tokenDigest(token))) found.values.push(`${where}:${lineAt(text, index)}   [${written}]`);
    }
    for (const match of text.matchAll(SOURCE)) found.source.push(`${where}:${lineAt(text, match.index)}`);
    if (entry.name.endsWith('.json') && text.includes('aloistr/swisseph')) {
      try {
        if (hasPatch(JSON.parse(text))) found.patches.push(where);
      } catch {
        found.patches.push(`${where} (not JSON; a commit receipt must be)`);
      }
    }
    if (entry.member === null && entry.path.startsWith('src/') && text.search(PROVENANCE) >= 0) {
      if (KEPT_POLICIES.has(entry.path)) {
        if (sha256(entry.bytes) !== KEPT_POLICIES.get(entry.path)) found.provenance.push(`${entry.path} changed: review it and its pin here`);
      } else if (entry.path === CONFORMANCE) {
        found.provenance.push(...conformanceProblems(text));
      } else {
        for (const match of text.matchAll(PROVENANCE)) found.provenance.push(`${entry.path}:${lineAt(text, match.index)}`);
      }
    }
  });
  return found;
}

const REGENERATE = 'regenerate Swiss output outside the repository and commit statistics only; see docs/engine-validation/SWISS-OUTPUT-REMOVAL.md';

describe('Swiss Ephemeris output stays out of the tree', () => {
  it('is recorded against both decisions, with a regeneration command for everything removed', () => {
    expect(manifest.base).toMatch(/^[0-9a-f]{40}$/u);
    expect(manifest.rounds).toEqual(Object.entries(DECISIONS).map(([on, under]) => ({ on, under })));
    for (const under of Object.values(DECISIONS)) expect(manifest.what).toContain(under);
    expect(manifest.removedFiles).toHaveLength(10);
    expect(manifest.strippedFiles).toHaveLength(131);
    expect(manifest.replacedFiles).toHaveLength(21);
    for (const entry of [...manifest.removedFiles, ...manifest.strippedFiles, ...manifest.replacedFiles]) {
      expect(entry.regenerate, entry.path).toMatch(/\S/u);
    }
    for (const entry of manifest.removedFiles) {
      expect(entry.sha256, entry.path).toMatch(/^[0-9a-f]{64}$/u);
      expect(entry.lastCommitWithTheFile, entry.path).toBe(manifest.base);
    }
    expect(manifest.valueDigests.gone).toBe(digests.gone.length);
    expect(manifest.valueDigests.kept).toBe(digests.kept.length);
    expect(manifest.valueDigests.sha256).toBe(sha256(readFileSync(resolve(root, manifest.valueDigests.path))));
  });

  it('is checked in CI: strip.py --check on the full history, and the offline reference rebuild', () => {
    const workflow = read('.github/workflows/site-check.yml');
    const start = workflow.indexOf('\n  swiss-output-removal:\n');
    expect(start, 'the swiss-output-removal job in site-check.yml').toBeGreaterThan(0);
    const rest = workflow.slice(start + 1);
    const next = rest.search(/\n {2}[a-z0-9-]+:\n/u);
    const job = next < 0 ? rest : rest.slice(0, next);
    expect(job).toContain('fetch-depth: 0');
    expect(job).toContain('python docs/engine-validation/swiss-output-removal/strip.py --check');
    expect(job).toContain('python docs/engine-validation/independent-references/tools/build.py');
    expect(job).toContain('git diff --exit-code -- src/lib/engine/fixtures/');
    expect(job).toContain('--require-hashes');
  });

  it('keeps every removed file out of the tree', () => {
    const back = manifest.removedFiles.map((entry) => entry.path).filter((path) => existsSync(resolve(root, path)));
    expect(back, REGENERATE).toEqual([]);
  });

  it('keeps the removed fields out of every stripped file, which says what left it', () => {
    for (const entry of manifest.strippedFiles) {
      const value = JSON.parse(read(entry.path));
      for (const removed of entry.removed) {
        expect(valuesAt(value, removed.path), `${entry.path} ${removed.path}`).toEqual([]);
        if (removed.on) expect(removed.under, `${entry.path} ${removed.path}`).toBe(DECISIONS[removed.on]);
      }
      const marker = value.swissOutputRemoved;
      expect(marker, `${entry.path} says what left it`).toBeTruthy();
      expect(DECISIONS[marker.on], entry.path).toBe(marker.under);
      expect(marker.removed, entry.path).toEqual(entry.removed);
      expect(marker.lastCommitWithTheValues, entry.path).toBe(manifest.base);
    }
  });

  it('keeps each replaced file as its independent rebuild left it', () => {
    for (const entry of manifest.replacedFiles) {
      expect(entry.under, entry.path).toBe(DECISIONS[entry.on]);
      expect(entry.after.sha256, entry.path).not.toBe(entry.before.sha256);
      expect(sha256(readFileSync(resolve(root, entry.path))), `${entry.path}: rebuild it as its manifest entry says`).toBe(entry.after.sha256);
    }
  });

  it('reads a token as strip.py does', () => {
    // strip.py wrote these digests from the same texts; a difference means the
    // two readers disagree and the value scan below would miss.
    for (const { text, digests: expected } of digests.calibration) {
      expect([...new Set([...textTokens(text)].map(({ token }) => tokenDigest(token)))].sort(), text).toEqual(expected);
    }
  });

  it("finds no removed or replaced file's bytes under any name, archive members included", { timeout: SCAN_TIMEOUT }, () => {
    const { files, bytes } = scan();
    expect(files).toBeGreaterThan(1000);
    expect(bytes, REGENERATE).toEqual([]);
  });

  it('finds no removed value in any data or code file, or anywhere under src/', { timeout: SCAN_TIMEOUT }, () => {
    // A match is a distinctive number or timestamp that left the tree. If it
    // is an input or a statistic rather than a Swiss value, the removal record
    // says how it is listed as kept.
    expect(scan().values, REGENERATE).toEqual([]);
  });

  it('finds no Swiss provenance under src/ beyond the kept policies and the conformance summary', { timeout: SCAN_TIMEOUT }, () => {
    expect(scan().provenance, REGENERATE).toEqual([]);
  });

  it('finds no Swiss Ephemeris source code in the tree, and no patch in a swisseph commit receipt', { timeout: SCAN_TIMEOUT }, () => {
    const { source, patches } = scan();
    expect(source, 'Swiss Ephemeris is AGPL or commercially licensed, and this repository is all rights reserved').toEqual([]);
    expect(patches, 'a commit receipt keeps the commit, not its diff').toEqual([]);
  });

  it('leaves no Swiss reference fixture in the engine tests, only the policies it was judged by', () => {
    // The policies hold gates, inputs and digests, and no value Swiss returned.
    const named = [];
    const walk = (dir) => {
      for (const entry of readdirSafe(dir)) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(path);
        else if (/swiss/iu.test(entry.name)) named.push(path);
      }
    };
    walk('src');
    expect(named.sort()).toEqual([
      'src/lib/engine/fixtures/swiss-eight-cases-policy.json',
      'src/lib/engine/fixtures/swiss-lunar-fixed-target-applicability.json',
      'src/lib/engine/fixtures/swiss-node-polar-policy.json',
    ]);
  });
});

function readdirSafe(dir) {
  try {
    return readdirSync(resolve(root, dir), { withFileTypes: true });
  } catch {
    return [];
  }
}
