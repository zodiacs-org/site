import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Sign guides live at /<slug>/ (src/pages/[sign]/). There is no /signs/ route, so a
 * /signs/<slug>/ link is a 404. Islands render their links in the browser, after the
 * build, so check-dist never sees them; this test reads the source instead. The
 * "Read <Sign>" links on /birth-chart/someone-else/ pointed at /signs/ for months.
 */
const SRC = fileURLToPath(new URL('../', import.meta.url));
const THIS_FILE = fileURLToPath(import.meta.url);
const SOURCE_FILE = /\.(?:astro|[cm]?[jt]sx?)$/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (SOURCE_FILE.test(name) && path !== THIS_FILE) out.push(path);
  }
  return out;
}

describe('sign guide links', () => {
  it('sign guides are served at /<slug>/ and no /signs/ route exists', () => {
    expect(existsSync(join(SRC, 'pages/[sign]/index.astro'))).toBe(true);
    expect(existsSync(join(SRC, 'pages/signs'))).toBe(false);
  });

  it('the someone-else chart links each placement to its sign guide at /<slug>/', () => {
    const island = readFileSync(join(SRC, 'islands/SomeoneElseChart.tsx'), 'utf8');
    expect(island).toContain('href={`/${placement.slug}/`}');
  });

  it('no source file builds a link under /signs/', () => {
    const offenders = sourceFiles(SRC).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) => (/[`'"]\/signs\//.test(line) ? [`${relative(SRC, file)}:${index + 1}`] : [])),
    );
    expect(offenders).toEqual([]);
  });
});
