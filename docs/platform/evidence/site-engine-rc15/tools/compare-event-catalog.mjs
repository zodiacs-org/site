/**
 * The events catalog (`src/lib/events/catalog.ts`) on engine rc.14 and on
 * rc.15, event by event.
 *
 *   node docs/platform/evidence/site-engine-rc15/tools/compare-event-catalog.mjs \
 *     <base commit> vendor/zodiacs-engine-0.1.1-rc.14.tgz [dump.json] > event-catalog.json
 *
 * Run from the repository root with rc.15 installed (`npm ci`). The old side
 * is the base commit's `src/` read from git objects, bundled against the rc.14
 * archive extracted into a temporary directory; the new side is this
 * checkout's `src/` bundled against the installed rc.15. Each side writes the
 * rows `../../events-vs-swiss-2026-09-23/tools/dump-catalog.ts` writes, the
 * input of the comparison with Swiss Ephemeris, and the optional third
 * argument saves the new side's. Instants are compared to the millisecond and
 * longitudes in arcseconds; every other field must be equal. The catalog reads
 * the monthly transit files with Vite's `import.meta.glob`, which esbuild does
 * not know, so a small plugin expands each eager glob into static imports of
 * the files it matches.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

const [baseCommit, oldArchive, dumpOut] = process.argv.slice(2);
if (!/^[0-9a-f]{40}$/u.test(baseCommit ?? '') || !oldArchive) {
  console.error('usage: compare-event-catalog.mjs <40-hex base commit> <rc.14 archive> [dump.json]');
  process.exit(2);
}
const root = process.cwd();
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const work = mkdtempSync(join(tmpdir(), 'zodiacs-event-catalog-'));

/** Vite's eager `import.meta.glob('dir/prefix-*.json', { eager: true })`, as static imports. */
const eagerGlob = {
  name: 'eager-import-meta-glob',
  setup(build) {
    build.onLoad({ filter: /\.ts$/ }, (args) => {
      const source = readFileSync(args.path, 'utf8');
      if (!source.includes('import.meta.glob')) return undefined;
      const imports = [];
      const contents = source.replace(
        /import\.meta\.glob(?:<[^>]*>)?\(\s*'([^'*]*)\*([^'*]*)'\s*,\s*\{\s*eager:\s*true\s*\}\s*\)/gu,
        (_, head, tail) => {
          const folder = dirname(resolve(dirname(args.path), `${head}x`));
          const prefix = head.slice(head.lastIndexOf('/') + 1);
          const entries = readdirSync(folder)
            .filter((file) => file.startsWith(prefix) && file.endsWith(tail) && !file.slice(prefix.length, -tail.length || undefined).includes('/'))
            .sort()
            .map((file) => {
              const key = `${head.slice(0, head.lastIndexOf('/') + 1)}${file}`;
              const name = `__glob${imports.length}`;
              imports.push(`import * as ${name} from ${JSON.stringify(key)};`);
              return `${JSON.stringify(key)}: ${name}`;
            });
          return `{ ${entries.join(', ')} }`;
        },
      );
      if (contents.includes('import.meta.glob')) throw new Error(`${args.path}: an import.meta.glob this plugin does not expand`);
      return { contents: `${imports.join('\n')}\n${contents}`, loader: 'ts' };
    });
  },
};

/** The fields dump-catalog.ts keeps, in its order. */
const dump = (catalog) => catalog.events.map(({ facts: e }) => ({
  id: e.id, family: e.family, subtype: e.subtype, at: e.at, start: e.start, end: e.end, bodies: e.bodies,
  longitude: e.longitude, signs: e.signs, fromSign: e.fromSign, direction: e.direction,
  aspectType: e.aspectType, eclipseKind: e.eclipseKind, clamped: e.clamped,
}));

try {
  const old = join(work, 'old');
  mkdirSync(old, { recursive: true });
  execFileSync('sh', ['-c', `git archive ${baseCommit} src | tar -x -C "${old}"`], { cwd: root });
  mkdirSync(join(old, 'node_modules/@zodiacs/engine'), { recursive: true });
  execFileSync('tar', ['-xzf', resolve(root, oldArchive), '--strip-components=1',
    '-C', join(old, 'node_modules/@zodiacs/engine')]);
  symlinkSync(resolve(root, 'node_modules/astronomy-engine'), join(old, 'node_modules/astronomy-engine'));

  async function side(from, name) {
    const result = await esbuild.build({
      stdin: {
        contents: "export { eventsCatalog } from './src/lib/events/catalog.ts';\nexport { ENGINE_VERSION } from './src/lib/engine/types.ts';",
        resolveDir: from, sourcefile: `${name}-entry.mjs`, loader: 'js',
      },
      bundle: true, platform: 'node', format: 'esm', target: 'node22', write: true,
      outfile: join(work, `${name}.mjs`), metafile: true, logLevel: 'error',
      nodePaths: [resolve(root, 'node_modules')], plugins: [eagerGlob],
    });
    const engineFiles = Object.keys(result.metafile.inputs).filter((path) => path.includes('node_modules/@zodiacs/engine/'));
    const module = await import(pathToFileURL(join(work, `${name}.mjs`)).href);
    const rows = dump(module.eventsCatalog());
    const text = JSON.stringify(rows, null, 1);
    return { rows, text, engineVersion: module.ENGINE_VERSION, engineFiles: engineFiles.length };
  }
  const A = await side(old, 'old');
  const B = await side(root, 'new');
  if (dumpOut) writeFileSync(dumpOut, B.text);

  const INSTANTS = ['at', 'start', 'end'];
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const byFamily = {};
  const otherChanges = [];
  if (A.rows.length !== B.rows.length || A.rows.some((row, i) => row.id !== B.rows[i].id)) {
    otherChanges.push({ field: 'id', old: A.rows.map((row) => row.id), new: B.rows.map((row) => row.id) });
  }
  const oldById = new Map(A.rows.map((row) => [row.id, row]));
  for (const b of B.rows) {
    const a = oldById.get(b.id);
    if (!a) continue;
    const family = (byFamily[b.family] ??= {
      events: 0, instantsMoved: 0, maxInstantShiftMs: 0, longitudesMoved: 0, maxLongitudeShiftArcsec: 0, examples: [],
    });
    family.events += 1;
    let moved = false;
    for (const field of INSTANTS) {
      if (a[field] === b[field]) continue;
      if (typeof a[field] !== 'string' || typeof b[field] !== 'string') {
        otherChanges.push({ id: b.id, field, old: a[field] ?? null, new: b[field] ?? null });
        continue;
      }
      const shift = Date.parse(b[field]) - Date.parse(a[field]);
      moved = true;
      family.maxInstantShiftMs = Math.max(family.maxInstantShiftMs, Math.abs(shift));
      if (family.examples.length < 5) family.examples.push({ id: b.id, field, old: a[field], new: b[field], shiftMs: shift });
    }
    if (moved) family.instantsMoved += 1;
    if (a.longitude !== b.longitude) {
      if (typeof a.longitude === 'number' && typeof b.longitude === 'number') {
        const arcsec = Math.abs((((b.longitude - a.longitude) % 360) + 540) % 360 - 180) * 3600;
        family.longitudesMoved += 1;
        family.maxLongitudeShiftArcsec = Math.max(family.maxLongitudeShiftArcsec, arcsec);
      } else {
        otherChanges.push({ id: b.id, field: 'longitude', old: a.longitude ?? null, new: b.longitude ?? null });
      }
    }
    for (const field of Object.keys(b)) {
      if (INSTANTS.includes(field) || field === 'longitude' || field === 'id') continue;
      if (!same(a[field], b[field])) otherChanges.push({ id: b.id, field, old: a[field] ?? null, new: b[field] ?? null });
    }
  }
  for (const family of Object.values(byFamily)) {
    family.maxLongitudeShiftArcsec = Number(family.maxLongitudeShiftArcsec.toPrecision(6));
  }

  process.stdout.write(`${JSON.stringify({
    schema: 'zodiacs-site-event-catalog-comparison/v1',
    generatedAt: new Date().toISOString(),
    node: process.version,
    esbuild: esbuild.version,
    old: {
      sourceCommit: baseCommit,
      archive: oldArchive,
      archiveSha256: sha256(readFileSync(resolve(root, oldArchive))),
      engineVersion: A.engineVersion,
      bundledPackageFiles: A.engineFiles,
      events: A.rows.length,
      dumpSha256: sha256(A.text),
    },
    new: {
      engineVersion: B.engineVersion,
      bundledPackageFiles: B.engineFiles,
      events: B.rows.length,
      dumpSha256: sha256(B.text),
    },
    byFamily,
    otherChanges,
  }, null, 1)}\n`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
