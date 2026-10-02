/**
 * Bundles the vendored engine's own time basis and frame of date into a module
 * with no imports: `src/lib/engine/time-basis.mjs`, with its declarations
 * beside it.
 *
 *   node scripts/build-time-basis.mjs            # write the module
 *   node scripts/build-time-basis.mjs --check    # fail on drift (CI)
 *
 * Since @zodiacs/engine 0.1.1-rc.15 a chart reads an instant from 1972 to
 * 2027-10-02 as UTC: TT from the IERS leap seconds, UT1 from IERS UT1 − UTC.
 * Outside those years it reads the instant as UT1 with the ΔT model, as before.
 * Since 0.1.1-rc.16 it turns astronomy-engine's vectors to the ecliptic of date
 * itself, with astronomy-engine's precession and its own IAU 2000B nutation,
 * where astronomy-engine's rotation keeps 5 of the series' 77 terms. The
 * package applies both inside its ephemeris and exports neither: not
 * `timeBasis`, and not `tilt`, `eclipticFrame`, `meanEcliptic` or
 * `eclipticOfDate`. Code that calls astronomy-engine directly needs them to
 * compute what the engine computes: the calendar function's server adapter
 * (`src/lib/engine/server-ephemeris.ts`), which CLAUDE.md holds to the browser
 * ephemeris within 1e-12°, and the tools that evaluate independent references
 * at the engine's own instants.
 *
 * So this takes the package's compiled code from the installed `dist/` and
 * bundles it as it is: `timeBasis`, `elapsedDays` and `EPHEMERIS_SPAN` from the
 * chunk that defines them, with the ΔT model they call; and the nutation and
 * frame modules (`src/nutation.ts`, `src/frame.ts`), cut at their source
 * markers from the ephemeris chunk, whose astronomy-engine import they do not
 * use, with the two functions they import (the mean obliquity and
 * `normalizeLongitude`). Nothing here re-derives a leap second, a UT1 value, a
 * nutation term or a line of the algorithm. Before writing, it checks the
 * bundle against the package's public API: for every instant of a corpus,
 * `timeBasis(t, "utc")` must give the `deltaT` and `timeScale` that
 * `natalChart` reports for that instant, value for value, and astronomy-
 * engine's vectors turned by the bundled frame must give every body's
 * longitude that `natalChart` reports, bit for bit. When the engine exports
 * these, this module goes.
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

const FRAME_EXPORTS = ['tilt', 'eclipticFrame', 'meanEcliptic', 'eclipticOfDate'];
const FRAME_MODULES = ['src/nutation.ts', 'src/frame.ts'];

/**
 * The package's compiled nutation and frame modules, as a module of their own:
 * the ephemeris chunk's imports of other package chunks, which esbuild keeps
 * only where the two modules use them, then the two modules' text, cut at the
 * `// src/…` markers esbuild writes before each module, then their exports.
 */
async function frameModule() {
  const dist = join(PACKAGE, 'dist');
  const found = [];
  for (const name of (await readdir(dist)).filter((file) => file.endsWith('.js')).sort()) {
    const text = await readFile(join(dist, name), 'utf8');
    const exported = /\nexport \{([^}]*)\};\s*$/u.exec(text)?.[1] ?? '';
    const names = new Set(exported.split(',').map((entry) => entry.trim()));
    if (FRAME_EXPORTS.every((entry) => names.has(entry) && new RegExp(`\\nfunction ${entry}\\(`, 'u').test(text))) {
      found.push({ path: join(dist, name), text });
    }
  }
  if (found.length !== 1) {
    throw new Error(`expected one dist chunk that defines and exports ${FRAME_EXPORTS.join(', ')}; found ${found.length}`);
  }
  const [{ path, text }] = found;
  const sections = FRAME_MODULES.map((module) => {
    const start = text.indexOf(`\n// ${module}\n`);
    if (start < 0 || text.indexOf(`\n// ${module}\n`, start + 1) >= 0) {
      throw new Error(`expected one ${module} marker in ${relative(ROOT, path)}`);
    }
    const next = text.indexOf('\n// src/', start + 1);
    if (next < 0) throw new Error(`${module} is the last module of ${relative(ROOT, path)}; expected another after it`);
    const section = text.slice(start + 1, next + 1);
    if (/^\s*(?:import|export)\b/mu.test(section)) throw new Error(`${module} carries an import or export statement`);
    return section;
  });
  // The chunk's own imports of the package's other chunks, rewritten to paths
  // from the repository root; astronomy-engine's is left out, and nothing in
  // the two modules may use it (the bundle is checked for imports below).
  const imports = [...text.matchAll(/^import \{([^}]*)\} from "(\.\/[^"]+)";$/gmu)].map(([, names, from]) =>
    `import {${names}} from ${JSON.stringify(`./${relative(ROOT, join(dist, from)).split('\\').join('/')}`)};`);
  if (!imports.length) throw new Error(`found no imports of other package chunks in ${relative(ROOT, path)}`);
  return {
    chunk: path,
    contents: `${imports.join('\n')}\n${sections.join('')}export { ${FRAME_EXPORTS.join(', ')} };\n`,
  };
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
  const frame = await frameModule();
  const FRAME_ENTRY = 'engine-frame-of-date.mjs';
  const result = await esbuild.build({
    stdin: {
      contents: [
        `export { timeBasis, elapsedDays, EPHEMERIS_SPAN } from ${JSON.stringify(`./${relative(ROOT, chunk).split('\\').join('/')}`)};`,
        `export { ${FRAME_EXPORTS.join(', ')} } from ${JSON.stringify(FRAME_ENTRY)};`,
        '',
      ].join('\n'),
      resolveDir: ROOT,
      sourcefile: 'time-basis-entry.mjs',
      loader: 'js',
    },
    plugins: [{
      name: 'engine-frame-of-date',
      setup(build) {
        // The path names what the module is cut from; esbuild prints it above the code.
        build.onResolve({ filter: /^engine-frame-of-date\.mjs$/ }, () => ({
          path: `${relative(ROOT, frame.chunk).split('\\').join('/')}, ${FRAME_MODULES.join(' and ')}`,
          namespace: 'cut',
        }));
        build.onLoad({ filter: /.*/, namespace: 'cut' }, () => ({
          contents: frame.contents,
          resolveDir: ROOT,
          loader: 'js',
        }));
      },
    }],
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
    '// bundled unchanged from its dist/ with the ΔT model they call, and its own',
    '// nutation and frame of date (tilt, eclipticFrame, meanEcliptic, eclipticOfDate),',
    '// cut unchanged from its ephemeris chunk with the mean obliquity and',
    `// normalizeLongitude they call. Package archive:`,
    `// ${archive}, SHA-256 ${archiveSha256}.`,
    '//',
    '// The package applies these inside its ephemeris and exports none of them; the',
    '// calendar function\'s server adapter and the reference tools need them to run',
    '// on the engine\'s clock and in its frame. The generator checks them against',
    '// natalChart first.',
    '//',
    `// The code is the package's, licensed ${manifest.license}; its NOTICE, in the`,
    '// archive above, gives every source in full. The ΔT model holds 32 values of',
    '// Table S15 of Stephenson, Morrison & Hohenkerk 2016, Proc. R. Soc. A 472:',
    '// 20160404, doi:10.1098/rspa.2016.0404, under CC BY 4.0',
    '// (https://creativecommons.org/licenses/by/4.0/), rounded to 0.01 s, and values',
    '// from USNO and IERS (https://www.iers.org/). TAI − UTC is from the IERS',
    '// leap-seconds.list (public domain); UT1 − UTC from IERS EOP 20 C04 for 1972 and',
    '// IERS finals2000A.all (Bulletin A) from 1973-01-02. The nutation is IAU 2000B',
    '// (McCarthy & Luzum 2003, Celest. Mech. Dyn. Astr. 85, 37-49), transcribed by',
    '// the package from NOVAS C 3.1 (a work of the US Government), with two',
    '// complementary terms of the equation of the equinoxes from the IERS',
    '// Conventions (2010), table 5.2e; the precession is astronomy-engine\'s,',
    '// Copyright (c) 2019-2023 Don Cross, MIT License.',
    '',
  ].join('\n');
  const code = `${header}${body}`;
  const declarations = [
    '// Generated by scripts/build-time-basis.mjs. Do not edit.',
    '// Declarations for the bundle beside this file: the engine\'s own time basis and frame of date.',
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
    '/** The nutation and obliquity at a TT instant (days from J2000.0), IAU 2000B. */',
    'export interface Tilt {',
    '  /** Nutation in longitude, arcseconds. */',
    '  dpsi: number;',
    '  /** Nutation in obliquity, arcseconds. */',
    '  deps: number;',
    '  /** Mean obliquity of date, degrees. */',
    '  mobl: number;',
    '  /** True obliquity of date, degrees. */',
    '  tobl: number;',
    '  /** Equation of the equinoxes, arcseconds. */',
    '  ee: number;',
    '}',
    '',
    '/** From the J2000 mean equator (astronomy-engine\'s EQJ) to the mean ecliptic of date, with that instant\'s tilt. */',
    'export interface EclipticFrame {',
    '  /** TT, days from J2000.0. */',
    '  readonly tt: number;',
    '  /** The rotation, row by row. */',
    '  readonly rows: readonly number[];',
    '  readonly tilt: Tilt;',
    '}',
    '',
    '/** The nutation and obliquity at `tt`, TT days from J2000.0. */',
    'export declare function tilt(tt: number): Tilt;',
    '',
    '/** The frame at `tt`, TT days from J2000.0 (astronomy-engine\'s `time.tt`). */',
    'export declare function eclipticFrame(tt: number): EclipticFrame;',
    '',
    '/** An EQJ vector on the mean ecliptic and equinox of date, [x, y, z]. */',
    'export declare function meanEcliptic(frame: EclipticFrame, x: number, y: number, z: number): [number, number, number];',
    '',
    '/** An EQJ vector\'s longitude and latitude on the true ecliptic and equinox of date at `tt`, degrees. */',
    'export declare function eclipticOfDate(x: number, y: number, z: number, tt: number): { lon: number; lat: number };',
    '',
  ].join('\n');

  // The check: the bundle, loaded from a temporary file, against natalChart.
  // The frame is checked through the ephemeris it serves: astronomy-engine's
  // apparent vectors, taken on the bundled time basis as the package takes
  // them (its ΔT held for the call, then the model put back), turned by the
  // bundled frame, must give natalChart's longitude of every body, bit for bit.
  const work = await mkdtemp(join(tmpdir(), 'zodiacs-time-basis-'));
  try {
    const file = join(work, 'time-basis.mjs');
    await writeFile(file, code);
    const bundled = await import(pathToFileURL(file).href);
    const { natalChart, EPHEMERIS_SPAN } = await import(pathToFileURL(join(PACKAGE, 'dist/index.js')).href);
    const { deltaT } = await import(pathToFileURL(join(PACKAGE, 'dist/deltat.js')).href);
    const Astronomy = await import('astronomy-engine');
    if (!isDeepStrictEqual(bundled.EPHEMERIS_SPAN, EPHEMERIS_SPAN)) throw new Error('the bundled EPHEMERIS_SPAN differs from the package\'s');
    const RAD = 180 / Math.PI;
    const PLANETS = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
    const longitudes = (basis) => {
      const seconds = basis.deltaT.seconds;
      Astronomy.SetDeltaTFunction(() => seconds);
      try {
        const time = Astronomy.MakeTime(basis.ut1Days);
        const out = new Map();
        for (const name of PLANETS) {
          const vector = Astronomy.GeoVector(Astronomy.Body[name], time, true);
          out.set(name, bundled.eclipticOfDate(vector.x, vector.y, vector.z, time.tt).lon);
        }
        const moon = Astronomy.GeoMoon(time);
        out.set('Moon', bundled.eclipticOfDate(moon.x, moon.y, moon.z, time.tt).lon);
        const state = Astronomy.GeoMoonState(time);
        const frame = bundled.eclipticFrame(time.tt);
        const [x, y] = bundled.meanEcliptic(
          frame,
          state.y * state.vz - state.z * state.vy,
          state.z * state.vx - state.x * state.vz,
          state.x * state.vy - state.y * state.vx,
        );
        const node = ((Math.atan2(x, -y) * RAD + frame.tilt.dpsi / 3600) % 360 + 360) % 360;
        out.set('North Node', node);
        out.set('South Node', ((node + 180) % 360 + 360) % 360);
        return out;
      } finally {
        Astronomy.SetDeltaTFunction(deltaT);
      }
    };
    const instants = checkInstants();
    let bodies = 0;
    for (const ms of instants) {
      const basis = bundled.timeBasis(ms, 'utc');
      const chart = natalChart({ utc: new Date(ms), timeKnown: false });
      if (!isDeepStrictEqual(basis.deltaT, chart.deltaT) || !isDeepStrictEqual(basis.timeScale, chart.timeScale)) {
        throw new Error(`the bundled time basis differs from natalChart at ${new Date(ms).toISOString()}`);
      }
      const framed = longitudes(basis);
      for (const body of chart.bodies) {
        if (!Object.is(framed.get(body.body), body.lon)) {
          throw new Error(`the bundled frame gives ${body.body} at ${framed.get(body.body)}°, natalChart ${body.lon}°, at ${new Date(ms).toISOString()}`);
        }
        bodies += 1;
      }
    }
    return { code, declarations, checked: instants.length, bodies, version: manifest.version };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { code, declarations, checked, bodies, version } = await buildTimeBasis();
  if (process.argv.includes('--check')) {
    const [committed, committedDeclarations] = await Promise.all([
      readFile(OUT, 'utf8').catch(() => ''),
      readFile(DECLARATIONS, 'utf8').catch(() => ''),
    ]);
    if (committed !== code || committedDeclarations !== declarations) {
      console.error('src/lib/engine/time-basis.mjs is stale: run node scripts/build-time-basis.mjs');
      process.exit(1);
    }
    console.log(`time-basis.mjs is current (engine ${version}; checked against natalChart at ${checked} instants, ${bodies} longitudes)`);
  } else {
    await writeFile(OUT, code);
    await writeFile(DECLARATIONS, declarations);
    console.log(`wrote src/lib/engine/time-basis.mjs (${Buffer.byteLength(code)} bytes; engine ${version}; checked against natalChart at ${checked} instants, ${bodies} longitudes)`);
  }
}
