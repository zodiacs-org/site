/*
 * Every module here that calls astronomy-engine itself runs on the engine's
 * clock.
 *
 * Since @zodiacs/engine 0.1.1-rc.8 a chart's TT is its UT plus observed ΔT
 * (model zodiacs-deltat/1, step 1.4 of the engine brief). astronomy-engine
 * keeps its ΔT in one module-level slot; the engine fills it with the model
 * before each of its own calls, but a module that calls astronomy-engine
 * before the engine does, or in a separate instance of it, reads
 * astronomy-engine's own 2004 polynomial instead: 75.50 s on 2026-09-22,
 * where the model and IERS have 69.20 s. That moves the Moon 3.4″ and a new
 * moon about 6 s, which the generated data and its checks would carry.
 *
 * So each importer either loads scripts/lib/deltat-install.mjs, or installs
 * `deltaT` from @zodiacs/engine/deltat itself, or is listed below with the
 * reason it needs neither.
 *
 * Since 0.1.1-rc.15 the engine reads 1972 to 2027-10-02 as UTC through the
 * leap seconds and IERS UT1 − UTC, which the model cannot express; there the
 * helper's clock differs from the engine's by up to 0.81 s, and
 * scripts/lib/deltat-install.mjs says what that leaves.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { DeltaT_EspenakMeeus, MakeTime } from 'astronomy-engine';
import { deltaT } from '@zodiacs/engine/deltat';
import { describe, expect, it } from 'vitest';
import './lib/deltat-install.mjs';

const root = resolve(import.meta.dirname, '..');
const ROOTS = ['api', 'scripts', 'src', 'tests'];
const EXTENSIONS = /\.(?:[cm]?[jt]sx?|astro)$/u;
const SKIP = new Set(['node_modules', 'dist', '.astro', 'fixtures', '__snapshots__']);

// An import or require of astronomy-engine, or one of its files, not a type-only import.
const IMPORTS_ENGINE = /(?:^|[\s;])(?:import\s+(?!type\b)[^'"`;]*?from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"`]astronomy-engine(?:\/[^'"`]*)?['"`]/mu;
const USES_HELPER = /['"](?:\.{1,2}\/)+(?:[\w.-]+\/)*lib\/deltat-install\.mjs['"]/u;
const INSTALLS_ITSELF = (source) => /from\s*['"]@zodiacs\/engine\/deltat['"]/u.test(source)
  && /SetDeltaTFunction\(\s*deltaT\s*\)/u.test(source);

/** Modules that import astronomy-engine and need no clock, each with the reason. */
const EXEMPT = new Map([
  ['scripts/lib/deltat-install.mjs', 'it is the helper that installs the clock'],
  ['scripts/report-bundles.test.mjs', 'names astronomy-engine only inside string fixtures for the bundle scanner'],
  ['scripts/methodology-accuracy-claim.test.mjs', 'reads DeltaT_EspenakMeeus, a pure function of the date, to check the formula rc.8 replaced; it never reads the clock'],
]);

function walk(directory) {
  const out = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (EXTENSIONS.test(entry.name)) out.push(path);
  }
  return out;
}

const importers = ROOTS.flatMap((top) => walk(resolve(root, top)))
  .map((path) => ({ path: relative(root, path), source: readFileSync(path, 'utf8') }))
  .filter(({ source }) => IMPORTS_ENGINE.test(source));

describe('astronomy-engine and the engine\'s clock', () => {
  it("holds every module that calls astronomy-engine to the engine's clock", () => {
    expect(importers.length).toBeGreaterThan(5);
    const unclocked = importers
      .filter(({ path, source }) => !EXEMPT.has(path) && !USES_HELPER.test(source) && !INSTALLS_ITSELF(source))
      .map(({ path }) => path);
    expect(unclocked, 'import scripts/lib/deltat-install.mjs, or install deltaT from @zodiacs/engine/deltat').toEqual([]);
  });

  it('keeps no exemption for a module that no longer imports astronomy-engine', () => {
    const paths = new Set(importers.map(({ path }) => path));
    expect([...EXEMPT.keys()].filter((path) => !paths.has(path))).toEqual([]);
  });

  it('finds the importers it has to, including one that reaches it through require', () => {
    const paths = importers.map(({ path }) => path);
    for (const path of ['scripts/build-sky.mjs', 'scripts/build-eclipses.mjs', 'src/lib/engine/server-ephemeris.ts']) {
      expect(paths).toContain(path);
    }
  });

  it('installs the model, not the polynomial, when the helper is loaded', () => {
    const utc = new Date('2026-09-22T00:00:00Z');
    const time = MakeTime(utc);
    const seconds = (time.tt - time.ut) * 86_400;
    expect(seconds).toBeCloseTo(deltaT(time.ut), 6);
    expect(Math.abs(seconds - DeltaT_EspenakMeeus(time.ut))).toBeGreaterThan(6);
  });
});
