import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/*
 * The 9 November 2026 audit, Decision A: a link never carries a birth date,
 * time, place or name, even after the #. encodeChartLink packs all of them,
 * so no island or component may call it. Its only production caller is
 * src/lib/chart-handoff.ts, which writes the token into this tab's
 * sessionStorage, never into a link. Links people already shared are still
 * read through decodeChartLink, which this test does not restrict.
 */
const root = resolve(process.cwd(), 'src');

const ALLOWED_CALLERS: Record<string, string> = {
  'lib/chart-handoff.ts': 'writes the token into sessionStorage only; its fragments carry a random key',
};

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const isTest = (path: string) => /\.test\.(?:ts|tsx|mts)$/u.test(path);

function callersOf(name: string): string[] {
  const callers: string[] = [];
  for (const path of walk(root)) {
    if (!/\.(?:ts|tsx|mts|astro)$/u.test(path) || isTest(path)) continue;
    const text = readFileSync(path, 'utf8');
    if (!text.includes(name)) continue;
    const file = relative(root, path).split(sep).join('/');
    if (path.endsWith('.astro')) {
      if (new RegExp(`\\b${name}\\s*\\(`, 'u').test(text)) callers.push(file);
      continue;
    }
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    let calls = false;
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const named = ts.isIdentifier(callee) ? callee.text
          : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
        if (named === name) calls = true;
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (calls) callers.push(file);
  }
  return callers.sort();
}

describe('encodeChartLink callers (Decision A)', () => {
  const callers = callersOf('encodeChartLink');

  it('is called from no island or component', () => {
    expect(callers.filter((file) => file.startsWith('islands/') || file.startsWith('components/'))).toEqual([]);
  });

  it('is called in production only by the session handoff', () => {
    expect(callers).toEqual(Object.keys(ALLOWED_CALLERS).sort());
  });

  it('is not even imported by an island or component', () => {
    const importers = walk(root)
      .filter((path) => /\.(?:tsx?|astro)$/u.test(path) && !isTest(path))
      .map((path) => relative(root, path).split(sep).join('/'))
      .filter((file) => file.startsWith('islands/') || file.startsWith('components/'))
      .filter((file) => /\bencodeChartLink\b/u.test(readFileSync(resolve(root, file), 'utf8')));
    expect(importers).toEqual([]);
  });
});
