/**
 * Returns worked examples (P2.A.timing.returns): the preregistration's checks C1 to C7, each with the
 * control that must fail (docs/platform/evidence/returns-worked-examples-20261107/PREREGISTRATION.md,
 * "Checks, each with a control that must fail").
 *
 * The holdout was frozen in commit f7e5ed14 before any engine computed a return for it; results.json is
 * the first run's record. This test runs the vendored engine again on every scored fixture and every
 * development fixture, through the frozen tools/run.mjs, and asserts what results.json recorded.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tolerance } from '../docs/platform/evidence/returns-worked-examples-20261107/tools/tolerance.mjs';
import { DEVELOPMENT, runDevelopment, score, verdict } from '../docs/platform/evidence/returns-worked-examples-20261107/tools/run.mjs';

const FOLDER = 'docs/platform/evidence/returns-worked-examples-20261107';
const PREREGISTRATION = `${FOLDER}/PREREGISTRATION.md`;
const FREEZE = 'f7e5ed14bddf306f0b141b6388fa85ec6d44cfcd';
const TOOLS = ['tools/readings.mjs', 'tools/tolerance.mjs', 'tools/run.mjs'];
const DAY_MS = 86400000;

const bytes = (path: string) => readFileSync(path);
const json = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 26 }).trim();
/** A file's bytes at a commit, exactly. */
const gitBytes = (rev: string, path: string) => execFileSync('git', ['show', `${rev}:${path}`], { maxBuffer: 1 << 26 });
const isAncestor = (a: string, b: string) => { try { execFileSync('git', ['merge-base', '--is-ancestor', a, b]); return true; } catch { return false; } };

const holdout = json(`${FOLDER}/holdout.json`);
const results = json(`${FOLDER}/results.json`);
const scored = holdout.fixtures.filter((fx: any) => fx.status === 'scored');

// ---------------------------------------------------------------------------------------------------
// C1. This record comes first.

/** The commits the record's branch adds, oldest first: origin/main..HEAD before the merge, M^1..M^2 after. */
function branchCommits(): string[] {
  const prereg = git('log', '--diff-filter=A', '--format=%H', '--', PREREGISTRATION).split('\n').filter(Boolean).pop()!;
  const own = git('rev-list', '--reverse', 'origin/main..HEAD').split('\n').filter(Boolean);
  if (own.includes(prereg)) return own;
  for (const merge of git('rev-list', '--merges', '--first-parent', 'HEAD').split('\n').filter(Boolean)) {
    const range = git('rev-list', '--reverse', `${merge}^1..${merge}^2`).split('\n').filter(Boolean);
    if (range.includes(prereg)) return range;
  }
  throw new Error('the preregistration commit is in no range of this history');
}

/** Problems with "starts with a commit that adds only the preregistration, dated before every later one". */
function recordFirstProblems(commits: string[]): string[] {
  if (commits.length === 0) return ['no commits'];
  const [first, ...rest] = commits;
  const problems: string[] = [];
  const files = git('show', '--format=', '--name-status', first).split('\n').filter(Boolean);
  if (files.length !== 1 || files[0] !== `A\t${PREREGISTRATION}`) problems.push(`${first.slice(0, 8)} adds ${files.join(', ')}`);
  const [a0, c0] = git('show', '-s', '--format=%at %ct', first).split(' ').map(Number);
  for (const c of rest) {
    const [a, ct] = git('show', '-s', '--format=%at %ct', c).split(' ').map(Number);
    if (!(a0 < a && c0 < ct)) problems.push(`${c.slice(0, 8)} is not dated after ${first.slice(0, 8)}`);
  }
  return problems;
}

describe('C1: this record comes first', () => {
  it('the range starts with a commit that adds only PREREGISTRATION.md, dated before every later commit', () => {
    expect(recordFirstProblems(branchCommits())).toEqual([]);
  });
  it('control: based at that first commit, the next commit (which adds other files) is first and fails', () => {
    expect(recordFirstProblems(branchCommits().slice(1)).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------------
// C2. Frozen before the run.

/** Problems with the freeze: digest recorded, tools unchanged since the freeze, results added after it. */
function freezeProblems(holdoutBytes: Buffer, toolBytes: Record<string, Buffer>): string[] {
  const problems: string[] = [];
  if (results.holdoutSha256 !== sha256(holdoutBytes)) problems.push('holdout.json digest differs from results.json');
  if (sha256(holdoutBytes) !== sha256(gitBytes(FREEZE, `${FOLDER}/holdout.json`))) problems.push('holdout.json differs from the freeze commit');
  for (const t of TOOLS) {
    if (sha256(toolBytes[t]) !== sha256(gitBytes(FREEZE, `${FOLDER}/${t}`))) problems.push(`${t} changed since the freeze`);
  }
  return problems;
}

describe('C2: frozen before the run', () => {
  const toolBytes = Object.fromEntries(TOOLS.map((t) => [t, bytes(`${FOLDER}/${t}`)]));
  it('results.json records the frozen holdout digest and the tools are unchanged since the freeze', () => {
    expect(freezeProblems(bytes(`${FOLDER}/holdout.json`), toolBytes)).toEqual([]);
  });
  it('the freeze commit precedes the commit that adds results.json, the first engine result', () => {
    const added = git('log', '--diff-filter=A', '--format=%H', '--', `${FOLDER}/results.json`).split('\n').filter(Boolean).pop()!;
    expect(isAncestor(FREEZE, added)).toBe(true);
    expect(added).not.toBe(FREEZE);
  });
  it('control: a copy of holdout.json with one byte changed fails on the digest', () => {
    const copy = Buffer.from(bytes(`${FOLDER}/holdout.json`));
    copy[100] = copy[100] === 0x20 ? 0x21 : 0x20;
    expect(freezeProblems(copy, toolBytes)).toContain('holdout.json digest differs from results.json');
  });
  it('control: a copy of tools/run.mjs with one byte changed fails', () => {
    const copy = Buffer.from(toolBytes['tools/run.mjs']);
    copy[10] = copy[10] === 0x20 ? 0x21 : 0x20;
    expect(freezeProblems(bytes(`${FOLDER}/holdout.json`), { ...toolBytes, 'tools/run.mjs': copy })).toContain('tools/run.mjs changed since the freeze');
  });
});

// ---------------------------------------------------------------------------------------------------
// C3. The runs reproduce.

describe('C3: the runs reproduce', () => {
  const rows = scored.map((fx: any) => score(fx));
  it('every scored fixture gives the recorded E to the millisecond, and the recorded agreement', () => {
    expect(rows.map((r: any) => [r.id, r.E, r.agrees])).toEqual(results.fixtures.map((r: any) => [r.id, r.E, r.agrees]));
  });
  it('the verdict reproduces', () => {
    expect(verdict(rows)).toEqual(results.verdict);
  });
  it('every development fixture gives its recorded E (regression only, never scored)', () => {
    expect(DEVELOPMENT.map((fx: any) => [fx.id, runDevelopment(fx).E])).toEqual(results.development.map((r: any) => [r.id, r.E]));
  });
  it('control: an agreeing fixture with R moved T + 1 s away from E disagrees', () => {
    const row = rows.find((r: any) => r.agrees);
    if (!row) { expect(results.verdict.outcome).not.toBe('pass'); return; }
    const fx = scored.find((f: any) => f.id === row.id);
    const away = row.D >= 0 ? -1 : 1;
    const moved = { ...fx, return: { utc: new Date(Date.parse(fx.return.utc) + away * (row.T + 1) * 1000).toISOString() } };
    const result = score(moved);
    expect(result.agrees).toBe(false);
    expect(result.E).toBe(row.E);
    expect(Math.abs(result.D)).toBeGreaterThan(result.T);
  });
  it('control: a whole-chain fixture with its birth moved by one day disagrees', () => {
    const fx = scored.find((f: any) => f.form === 'whole-chain');
    const moved = { ...fx, birth: { ...fx.birth, utc: new Date(Date.parse(fx.birth.utc) + DAY_MS).toISOString() } };
    const result = score(moved);
    expect(result.agrees).toBe(false);
    expect(Math.abs(result.D)).toBeGreaterThan(result.T);
  });
});

// ---------------------------------------------------------------------------------------------------
// C4. The tolerance is the formula's.

const importsOf = (path: string) => [...readFileSync(path, 'utf8').matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);

describe('C4: the tolerance is the formula\'s', () => {
  it('T and every term recompute from each fixture\'s recorded properties', () => {
    const withT = holdout.fixtures.filter((fx: any) => fx.spec);
    expect(withT.length).toBeGreaterThanOrEqual(scored.length);
    for (const fx of withT) expect([fx.id, tolerance(fx)]).toEqual([fx.id, fx.tolerance]);
  });
  it('tools/tolerance.mjs imports only Node built-ins; tools/readings.mjs only Node built-ins and @zodiacs/engine/geo', () => {
    expect(importsOf(`${FOLDER}/tools/tolerance.mjs`).every((m) => m.startsWith('node:'))).toBe(true);
    expect(importsOf(`${FOLDER}/tools/readings.mjs`).every((m) => m.startsWith('node:') || m === '@zodiacs/engine/geo')).toBe(true);
  });
  it('control: a fixture with its return\'s printed unit changed from minutes to seconds gives a different T', () => {
    const fx = scored.find((f: any) => f.units.returnSec === 60);
    expect(tolerance({ ...fx, units: { ...fx.units, returnSec: 1 } }).T).not.toBe(fx.tolerance.T);
  });
});

// ---------------------------------------------------------------------------------------------------
// C5. Two readings.

/** Problems with "a scan address, a leaf and two blind readings whose fields agree, or a recorded third". */
function twoReadingsProblems(fx: any): string[] {
  const problems: string[] = [];
  const scan = JSON.stringify(fx.scan ?? {});
  if (!/https?:\/\//.test(scan)) problems.push(`${fx.id}: no scan address`);
  if (!/lea(f|ves)|page|PA\d|n\d/i.test(scan)) problems.push(`${fx.id}: no leaf`);
  if (!fx.firstReading) problems.push(`${fx.id}: no first reading`);
  if (!(fx.secondReading?.length >= 1)) problems.push(`${fx.id}: no second reading`);
  const agree = /\bagrees? on every field\b|\bagrees\b/i.test(fx.readingsCompared ?? '') && !/\bdiffers?\b/i.test(fx.readingsCompared ?? '');
  if (!agree && !(fx.thirdReading?.length >= 1)) problems.push(`${fx.id}: readings differ and no third reading`);
  return problems;
}

describe('C5: two readings', () => {
  it('every scored fixture has a scan address, a leaf and two agreeing blind readings', () => {
    expect(scored.flatMap(twoReadingsProblems)).toEqual([]);
  });
  it('control: a planted fixture whose second reading differs, with no third reading, is rejected', () => {
    const planted = { ...scored[0], readingsCompared: 'The second reading differs on the clock time.', thirdReading: [] };
    expect(twoReadingsProblems(planted).length).toBeGreaterThan(0);
    expect(twoReadingsProblems({ ...scored[0], secondReading: [] }).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------------
// C6. The verdict.

const ledger = json('docs/platform/programme/acceptance-ledger.json');
const unit = JSON.stringify(ledger).includes('P2.A.timing.returns') ? findUnit(ledger, 'P2.A.timing.returns') : null;
function findUnit(node: any, id: string): any {
  if (node && typeof node === 'object') {
    if (node.id === id) return node;
    for (const v of Object.values(node)) { const f = findUnit(v, id); if (f) return f; }
  }
  return null;
}
const EXPECTED: Record<string, string> = { accepted: 'pass', failed: 'fail', partial: 'not-scored', validated: 'pass' };

describe('C6: the verdict', () => {
  it('the pass rule applied to results.json gives the outcome the ledger records', () => {
    expect(unit).not.toBeNull();
    expect(verdict(results.fixtures).outcome).toBe(EXPECTED[unit.status]);
  });
  it('control: with agreeing fixtures turned to disagreeing until fewer than two thirds agree, it does not pass', () => {
    const rows = results.fixtures.map((r: any) => ({ ...r }));
    const need = Math.ceil((2 * rows.length) / 3);
    for (const r of rows) {
      if (rows.filter((x: any) => x.agrees).length < need) break;
      if (r.agrees) r.agrees = false;
    }
    expect(verdict(rows).outcome).not.toBe('pass');
  });
});

// ---------------------------------------------------------------------------------------------------
// C7. Eligibility.

const ineligible = json(`${FOLDER}/ineligible.json`);
const norm = (s: string) => s.toLowerCase().replace(/[‘’'"]/g, '').replace(/\s+/g, ' ').trim();
/** Title prefixes of the development data's verified sources (before any comma, colon or parenthesis). */
const VERIFIED_TITLES = [...new Set(ineligible.verifiedCandidateSources.map((v: any) => norm(v.title).split(/[,(:]/)[0].trim()).filter((t: string) => t.split(' ').length >= 2))];
/** A distinctive pattern for each scored work, and what an ineligible.json entry naming it must say. */
const WORK_PATTERNS: ReadonlyArray<readonly [RegExp, (e: string) => boolean, string]> = [
  [/raghavulu|directional calculations/i, () => false, 'no entry names it'],
  [/pearce.*text-?book|text-?book.*pearce/i, (e) => /no preview|no scan|blocked|http 403|no full-view|catalogue and bookseller|unreachable/i.test(e), 'named only as not reached (the read Pearce work is The Science of the Stars)'],
  [/satyanarayana/i, () => false, 'no entry names it'],
  [/american astrology|lindanger/i, () => false, 'no entry names it'],
  [/astrology quarterly|astrological lodge|76386|skaife/i, (e) => /not examined/i.test(e) || !/vol\.? ?16|76386/i.test(e), 'named only for other volumes, or as not examined'],
];

/** Problems with "no holdout fixture's work, or return, is in ineligible.json" (H1 to H3). */
function eligibilityProblems(fx: any): string[] {
  const problems: string[] = [];
  const work = norm(fx.work ?? '');
  for (const t of VERIFIED_TITLES) if (work.includes(t as string)) problems.push(`${fx.id}: work is a verified development source (${t})`);
  const year = Number(String(fx.return?.utc ?? '').slice(0, 4));
  for (const d of ineligible.developmentReturns) {
    const native = norm(d.native);
    if (native.includes(norm(fx.nativeKey ?? fx.native)) && d.body === fx.body && d.years.includes(year)) problems.push(`${fx.id}: a development return`);
  }
  return problems;
}

describe('C7: eligibility', () => {
  it('no scored fixture\'s work is a development source, and no scored return is a development return', () => {
    expect(scored.flatMap(eligibilityProblems)).toEqual([]);
  });
  it('each scored work is named in ineligible.json only as unread, or for other volumes', () => {
    const works = [...new Set(scored.map((fx: any) => `${fx.work} ${fx.author}`))] as string[];
    for (const w of works) {
      const pattern = WORK_PATTERNS.find(([re]) => re.test(w));
      expect(pattern, w).toBeDefined();
      const [re, ok] = pattern!;
      for (const e of ineligible.searchEntries.filter((x: string) => re.test(x))) expect([w, e, ok(e)]).toEqual([w, e, true]);
    }
  });
  it('control: a planted fixture citing Leo\'s The Progressed Horoscope fails', () => {
    expect(eligibilityProblems({ ...scored[0], id: 'planted', work: 'Alan Leo, The Progressed Horoscope (1936)' }).length).toBeGreaterThan(0);
  });
  it('control: a planted fixture holding a development return fails', () => {
    const gv = scored.find((fx: any) => fx.nativeKey === 'George V' && fx.body === 'Sun');
    expect(eligibilityProblems({ ...gv, id: 'planted', return: { utc: '1893-06-02T19:53:52.000Z' } }).length).toBeGreaterThan(0);
  });
});

// The folder the README and the ledger cite.
it('the evidence folder holds the files the preregistration lists', () => {
  for (const f of ['PREREGISTRATION.md', 'ineligible.json', 'search-plan.json', 'holdout.json', 'holdout-planetary.json', 'search-log.json', 'dev-search.json', 'results.json', 'corrections.json', 'README.md', ...TOOLS]) {
    expect(() => readFileSync(join(FOLDER, f))).not.toThrow();
  }
});
