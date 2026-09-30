/**
 * Bundles the vendored engine's own time basis into a module with no imports:
 * `src/lib/engine/time-basis.mjs`, with its declarations beside it.
 *
 *   node scripts/build-time-basis.mjs            # write the module
 *   node scripts/build-time-basis.mjs --check    # fail on drift (CI)
 *
 * Since @zodiacs/engine 0.1.1-rc.15 a chart reads an instant from 1972 to
 * 2027-10-02 as UTC: TT from the IERS leap seconds, UT1 from IERS UT1 − UTC.
 * Outside those years it reads the instant as UT1 with the ΔT model, as before.
 * The package applies this inside its ephemeris and does not export the
 * function that does it, `timeBasis`. Code that calls astronomy-engine
 * directly needs it to run on the engine's clock: the calendar function's
 * server adapter (`src/lib/engine/server-ephemeris.ts`), which CLAUDE.md holds
 * to the browser ephemeris within 1e-12°, and the tools that evaluate
 * independent references at the engine's own instants.
 *
 * So this takes the package's compiled `timeBasis` and `elapsedDays` from the
 * installed `dist/` and bundles them, with the ΔT model they call, as they are:
 * nothing here re-derives a leap second, a UT1 value or a line of the
 * algorithm. Before writing, it checks the bundle against the package's public
 * API: for every instant of a corpus, `timeBasis(t, "utc")` must give the
 * `deltaT` and `timeScale` that `natalChart` reports for that instant, value
 * for value. When the engine exports its time basis, this module goes.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import * as esbuild from 'esbuild';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PACKAGE = resolve(ROOT, 'node_modules/@zodiacs/engine');
const OUT = resolve(ROOT, 'src/lib/engine/time-basis.mjs');
const DECLARATIONS = resolve(ROOT, 'src/lib/engine/time-basis.d.mts');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** The dist chunk that defines and exports both functions and the ephemeris span. */
async function sourceChunk() {
  const dist = join(PACKAGE, 'dist');
  const found = [];
  for (const name of (await readdir(dist)).filter((file) => file.endsWith('.js')).sort()) {
    const text = await readFile(join(dist, name), 'utf8');
    const exported = /\nexport \{([^}]*)\};\s*$/u.exec(text)?.[1] ?? '';
    const names = new Set(exported.split(',').map((entry) => entry.trim()));
    if (/\nfunction timeBasis\(/u.test(text) && /\nfunction elapsedDays\(/u.test(text)
      && ['timeBasis', 'elapsedDays', 'EPHEMERIS_SPAN'].every((name) => names.has(name))) found.push(join(dist, name));
  }
  if (found.length !== 1) {
    throw new Error(`expected one dist chunk that defines and exports timeBasis, elapsedDays and EPHEMERIS_SPAN; found ${found.length}`);
  }
  return found[0];
}

/** The instants the bundle is checked at: every tenth day 1800–2199 at noon, and the edges of the basis. */
function checkInstants() {
  const DAY = 86_400_000;
  const instants = [];
  for (let t = Date.UTC(1800, 0, 1, 12); t < Date.UTC(2200, 0, 1); t += 10 * DAY) instants.push(t);
  // Every leap second of the list and the ends of the IERS table, to the millisecond on each side.
  const edges = [Date.UTC(1972, 0, 1), Date.UTC(1973, 0, 2), Date.UTC(2027, 9, 2), Date.UTC(2027, 5, 28)];
  for (const [year, month] of [[1972, 6], [1973, 0], [1974, 0], [1975, 0], [1976, 0], [1977, 0], [1978, 0],
    [1979, 0], [1980, 0], [1981, 6], [1982, 6], [1983, 6], [1985, 6], [1988, 0], [1990, 0], [1991, 0],
    [1992, 6], [1993, 6], [1994, 6], [1996, 0], [1997, 6], [1999, 0], [2006, 0], [2009, 0], [2012, 6],
    [2015, 6], [2017, 0]]) edges.push(Date.UTC(year, month, 1));
  for (const edge of edges) instants.push(edge - 1_000, edge - 1, edge, edge + 1, edge + 1_000);
  return instants;
}

export async function buildTimeBasis() {
  const manifest = JSON.parse(await readFile(join(PACKAGE, 'package.json'), 'utf8'));
  const site = JSON.parse(await readFile(resolve(ROOT, 'package.json'), 'utf8'));
  const archive = site.dependencies['@zodiacs/engine'].replace(/^file:/u, '');
  const archiveSha256 = sha256(await readFile(resolve(ROOT, archive)));
  const chunk = await sourceChunk();
  const result = await esbuild.build({
    stdin: {
      contents: `export { timeBasis, elapsedDays, EPHEMERIS_SPAN } from ${JSON.stringify(`./${relative(ROOT, chunk).split('\\').join('/')}`)};\n`,
      resolveDir: ROOT,
      sourcefile: 'time-basis-entry.mjs',
      loader: 'js',
    },
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    write: false,
    legalComments: 'none',
    charset: 'utf8',
    logLevel: 'error',
  });
  const body = result.outputFiles[0].text;
  if (/\bimport\b[\s\S]*?\bfrom\b|\bimport\(|\brequire\(/u.test(body)) {
    throw new Error('the bundle must not import anything at run time');
  }
  const header = [
    '// Generated by scripts/build-time-basis.mjs. Do not edit.',
    `// @zodiacs/engine ${manifest.version}'s own timeBasis, elapsedDays and EPHEMERIS_SPAN,`,
    `// bundled unchanged from its dist/ with the ΔT model they call. Package archive:`,
    `// ${archive}, SHA-256 ${archiveSha256}.`,
    '//',
    '// The package applies this time basis inside its ephemeris and does not export',
    '// it; the calendar function\'s server adapter and the reference tools need it to',
    '// run on the engine\'s clock. The generator checks it against natalChart first.',
    '//',
    `// The code is the package's, licensed ${manifest.license}; its NOTICE, in the`,
    '// archive above, gives every source in full. The ΔT model holds 32 values of',
    '// Table S15 of Stephenson, Morrison & Hohenkerk 2016, Proc. R. Soc. A 472:',
    '// 20160404, doi:10.1098/rspa.2016.0404, under CC BY 4.0',
    '// (https://creativecommons.org/licenses/by/4.0/), rounded to 0.01 s, and values',
    '// from USNO and IERS (https://www.iers.org/). TAI − UTC is from the IERS',
    '// leap-seconds.list (public domain); UT1 − UTC from IERS EOP 20 C04 for 1972 and',
    '// IERS finals2000A.all (Bulletin A) from 1973-01-02.',
    '',
  ].join('\n');
  const code = `${header}${body}`;
  const declarations = [
    '// Generated by scripts/build-time-basis.mjs. Do not edit.',
    '// Declarations for the bundle beside this file: the engine\'s own time basis.',
    "import type { DeltaT } from '@zodiacs/engine/deltat';",
    "import type { TimeScale, TimeScaleName } from '@zodiacs/engine';",
    '',
    '/** An instant\'s UT1 and TT, days since 2000-01-01T12:00 on each scale, with the record a chart carries. */',
    'export interface TimeBasis {',
    '  /** The UTC instant, ms; where the civil instant is read as UT1, that instant. */',
    '  utcMs: number;',
    '  ut1Days: number;',
    '  ttDays: number;',
    '  deltaT: DeltaT;',
    '  timeScale: TimeScale;',
    '}',
    '',
    '/** UT1 and TT for an instant (ms) on `scale`; a pin is a caller\'s ΔT (TT − UT1) in seconds. */',
    'export declare function timeBasis(ms: number, scale?: TimeScaleName, pin?: number): TimeBasis;',
    '',
    '/**',
    ' * The time between two samples taken `days` apart on an input\'s scale, in days:',
    ' * `days` where both lie in one piece of the time basis, else the TT between them.',
    ' */',
    'export declare function elapsedDays(before: TimeBasis, after: TimeBasis, days: number): number;',
    '',
    '/** The span astronomy-engine tabulates, as the root entry exports it: TT days from J2000.0, inclusive. */',
    'export declare const EPHEMERIS_SPAN: Readonly<{',
    '  timeScale: \'TT\';',
    '  daysFromJ2000: Readonly<{ from: number; to: number }>;',
    '  fromTT: string;',
    '  toTT: string;',
    '}>;',
    '',
  ].join('\n');

  // The check: the bundle, loaded from a temporary file, against natalChart.
  const work = await mkdtemp(join(tmpdir(), 'zodiacs-time-basis-'));
  try {
    const file = join(work, 'time-basis.mjs');
    await writeFile(file, code);
    const bundled = await import(pathToFileURL(file).href);
    const { natalChart, EPHEMERIS_SPAN } = await import(pathToFileURL(join(PACKAGE, 'dist/index.js')).href);
    if (!isDeepStrictEqual(bundled.EPHEMERIS_SPAN, EPHEMERIS_SPAN)) throw new Error('the bundled EPHEMERIS_SPAN differs from the package\'s');
    const instants = checkInstants();
    for (const ms of instants) {
      const basis = bundled.timeBasis(ms, 'utc');
      const chart = natalChart({ utc: new Date(ms), timeKnown: false });
      if (!isDeepStrictEqual(basis.deltaT, chart.deltaT) || !isDeepStrictEqual(basis.timeScale, chart.timeScale)) {
        throw new Error(`the bundled time basis differs from natalChart at ${new Date(ms).toISOString()}`);
      }
    }
    return { code, declarations, checked: instants.length, version: manifest.version };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { code, declarations, checked, version } = await buildTimeBasis();
  if (process.argv.includes('--check')) {
    const [committed, committedDeclarations] = await Promise.all([
      readFile(OUT, 'utf8').catch(() => ''),
      readFile(DECLARATIONS, 'utf8').catch(() => ''),
    ]);
    if (committed !== code || committedDeclarations !== declarations) {
      console.error('src/lib/engine/time-basis.mjs is stale: run node scripts/build-time-basis.mjs');
      process.exit(1);
    }
    console.log(`time-basis.mjs is current (engine ${version}; checked against natalChart at ${checked} instants)`);
  } else {
    await writeFile(OUT, code);
    await writeFile(DECLARATIONS, declarations);
    console.log(`wrote src/lib/engine/time-basis.mjs (${Buffer.byteLength(code)} bytes; engine ${version}; checked against natalChart at ${checked} instants)`);
  }
}
