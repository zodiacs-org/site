// The site's own code, what src/ and api/ deploy, imports @zodiacs/engine's
// root and other entry points but never ./calc, and ./vedic only in
// src/lib/engine/vedic.ts, the boundary the Vedic signs page and the
// get_vedic_signs tool read the ayanamsa and nakshatras through, as the engine
// page and llms-full.txt say. Tests, which are not deployed, and evidence tools
// under docs/ may import either.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SOURCE = /\.(?:[cm]?[jt]sx?|astro)$/u;
/** A static or dynamic import, or a re-export, of an engine entry point; the entry is the first group, '' for the root. */
const ENGINE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]@zodiacs\/engine(?:\/([\w/-]+))?['"]/gu;

function* sourceFiles(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sourceFiles(path);
    else if (SOURCE.test(name)) yield path;
  }
}

/** Every engine entry point the files under these folders import, with the files that import it. */
function engineImports(dirs) {
  const entries = new Map();
  for (const dir of dirs) {
    for (const path of sourceFiles(resolve(root, dir))) {
      for (const [, entry = ''] of readFileSync(path, 'utf8').matchAll(ENGINE_IMPORT)) {
        const importers = entries.get(entry) ?? new Set();
        importers.add(relative(root, path));
        entries.set(entry, importers);
      }
    }
  }
  return entries;
}

describe('the engine entry points the site imports', () => {
  it('reads an import of an entry point in each form the site writes', () => {
    const forms = [
      "import { calc } from '@zodiacs/engine/calc';",
      'export { siderealChart } from "@zodiacs/engine/vedic";',
      "const { chart } = await import('@zodiacs/engine/calc');",
      "import '@zodiacs/engine';",
    ];
    expect(forms.map((form) => [...form.matchAll(ENGINE_IMPORT)].map(([, entry = '']) => entry))).toEqual([['calc'], ['vedic'], ['calc'], ['']]);
  });

  it('imports @zodiacs/engine/calc nowhere in src/ and api/, and @zodiacs/engine/vedic only at the Vedic signs boundary', () => {
    const entries = engineImports(['src', 'api']);
    const deployed = (entry) => [...(entries.get(entry) ?? [])].filter((path) => !/\.test\.[cm]?[jt]sx?$/u.test(path)).sort();
    // The site does import the engine: the root entry, among others.
    expect(entries.has('')).toBe(true);
    expect(deployed('calc'), 'importers of @zodiacs/engine/calc').toEqual([]);
    expect(deployed('vedic'), 'importers of @zodiacs/engine/vedic').toEqual(['src/lib/engine/vedic.ts']);
  });
});
