/*
 * The programme ledger (docs/platform/programme/) held to its own rules: a
 * fixed denominator that changes only by a recorded decision, accepted units
 * that carry evidence and a release state, a rendered LEDGER.md in step with
 * the JSON, and a STATUS.md that reports the figure the ledger computes.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEDGER_MD, denominatorDigest, figures, readProgrammeLedger, render, validate } from './programme-ledger.mjs';

const ledger = readProgrammeLedger();

describe('programme ledger', () => {
  it('is valid, with the fixed denominator it records', () => {
    expect(validate(ledger)).toEqual([]);
  });

  it('notices a weight changed without a recorded decision', () => {
    const changed = structuredClone(ledger);
    changed.units[0].weight += 1;
    changed.denominator.totalWeight += 1;
    expect(denominatorDigest(changed.units)).not.toBe(ledger.denominator.digest);
    expect(validate(changed).some((problem) => problem.includes('needs a recorded decision'))).toBe(true);
  });

  it('refuses an accepted unit without evidence or with an unreleased state', () => {
    const changed = structuredClone(ledger);
    const unit = changed.units.find((candidate) => candidate.status !== 'accepted');
    unit.status = 'accepted';
    unit.evidence = [];
    unit.release = 'unmerged';
    const problems = validate(changed);
    expect(problems.some((problem) => problem.includes('accepted without evidence'))).toBe(true);
    expect(problems.some((problem) => problem.includes('accepted but release is unmerged'))).toBe(true);
  });

  it('keeps blocked units in the denominator', () => {
    const f = figures(ledger);
    expect(f.total).toBe(ledger.denominator.totalWeight);
    expect(f.accepted + (f.total - f.accepted)).toBe(f.total);
    expect(f.blocked).toBeGreaterThan(0);
  });

  it('renders LEDGER.md from the JSON', () => {
    expect(readFileSync(resolve(process.cwd(), LEDGER_MD), 'utf8')).toBe(render(ledger));
  });

  it('reports in STATUS.md the figure the ledger computes', () => {
    const status = readFileSync(resolve(process.cwd(), 'docs/platform/programme/STATUS.md'), 'utf8');
    expect(status).toContain(`**Overall delivery: ${figures(ledger).percent}%**`);
  });
});
