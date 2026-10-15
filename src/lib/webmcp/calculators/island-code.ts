/**
 * For the calculator tools' tests only: runs a calculator island's own code, taken from its source file, so a test can
 * hold a tool to what the page computes, the way MoonPhaseTool.reference.test.ts and ChartCalculator's tests run their
 * island's code. Nothing ships this.
 *
 * The named function (or the arrow a named const or useMemo holds) is transpiled and run inside `with (context)`:
 * every name it reads comes from `context`, then from the global object; any other name reads as a function that
 * does nothing and returns undefined (a setter the test does not watch, an analytics call), and is listed in
 * `missing`. Dynamic import() calls go to `context.__import`.
 */
import { readFileSync } from 'node:fs';
import ts from 'typescript';

type Selector =
  | { function: string }
  | { const: string }
  | { useMemo: string }
  /** The function assigned to a target, such as a worker's `self.onmessage`. */
  | { assigned: string };

function find(ast: ts.SourceFile, selector: Selector): ts.Node {
  let found: ts.Node | null = null;
  const visit = (node: ts.Node) => {
    if (found) return;
    if ('function' in selector && ts.isFunctionDeclaration(node) && node.name?.text === selector.function) found = node;
    if ('const' in selector && ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
      && node.name.text === selector.const && node.initializer) found = node.initializer;
    if ('useMemo' in selector && ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
      && node.name.text === selector.useMemo && node.initializer && ts.isCallExpression(node.initializer)
      && node.initializer.expression.getText(ast) === 'useMemo') found = node.initializer.arguments[0];
    if ('assigned' in selector && ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && node.left.getText(ast) === selector.assigned) found = node.right;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  if (!found) throw new Error(`Not found in the island: ${JSON.stringify(selector)}`);
  return found;
}

export interface IslandFunction {
  (context: Record<string, unknown>, ...args: unknown[]): unknown;
  /** Names the code read that the context did not supply, from every call so far. */
  missing: Set<string>;
}

/**
 * The island function `selector` names in `file` (a path relative to src/islands/), called with the arguments given
 * after the context; with `{ value: true }`, the selected expression's value itself (a const's Set, say).
 */
export function islandFunction(file: string, selector: Selector, { value = false } = {}): IslandFunction {
  const source = readFileSync(new URL(`../../../islands/${file}`, import.meta.url), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const node = find(ast, selector);
  const text = node.getText(ast).replace(/\bimport\(/gu, '__import(');
  const expression = ts.isFunctionDeclaration(node) ? `(${text.replace(/^export\s+(default\s+)?/u, '')})` : `(${text})`;
  const js = ts.transpile(`const __island = ${expression};`, { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React });
  // eslint-disable-next-line no-new-func
  const compiled = new Function('__context', '__args', `with (__context) { ${js}; return ${value ? '__island' : '__island(...__args)'}; }`);
  const missing = new Set<string>();
  const run = ((supplied: Record<string, unknown>, ...args: unknown[]) => {
    const values: Record<string, unknown> = {
      __import: (specifier: string) => Promise.reject(new Error(`${specifier} is not loaded in this test`)),
      ...supplied,
    };
    const context = new Proxy(values, {
      has: (_target, key) => typeof key === 'string' && (!key.startsWith('__') || key === '__import'),
      get: (target, key) => {
        if (key === Symbol.unscopables) return undefined;
        if (Object.hasOwn(target, key)) return target[key as string];
        if (key in globalThis) return (globalThis as Record<PropertyKey, unknown>)[key];
        missing.add(String(key));
        return () => undefined;
      },
      set: (target, key, value) => {
        target[key as string] = value;
        return true;
      },
    });
    return compiled(context, args);
  }) as IslandFunction;
  run.missing = missing;
  return run;
}

/** A React-style ref. */
export const ref = <T>(current: T) => ({ current });
