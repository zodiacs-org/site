import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/*
 * A birthplace longitude makes an early date need the local mean time table
 * and the zone's pinned history, and resolving without them throws. So every
 * production call that passes a longitude must follow an awaited
 * prepareLocalTime of the same date and zone in the same function, or sit in
 * a module that re-exports the preparation to the islands that await it; and
 * the longitude must be a place's `.lon`. Calls without a longitude keep the
 * host's clock, and each is listed with a reason.
 */
const root = resolve(process.cwd(), 'src');

const WITHOUT_LONGITUDE: Record<string, string> = {
  'lib/learning-source.ts': 'checks that a stored birth resolves at all; the chart itself goes through ChartCalculator',
  'islands/WalletChart.tsx': 'Registry scope, frozen for Phase 1; planets only, no angles',
  'exchange/lens/window.ts': 'a planned trade entry typed in the display zone; a present-day civil time, not a birthplace',
};

/** Compute modules that re-export the preparation, and the islands that await it. */
const PREPARED_BY: Record<string, string[]> = {
  'islands/lunar-return/compute.ts': ['islands/LunarReturnCalculator.tsx'],
  'islands/solar-return/compute.ts': ['islands/SolarReturnCalculator.tsx'],
};

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const parse = (path: string, text: string) =>
  ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

function calls(node: ts.Node, name: string, found: ts.CallExpression[] = []): ts.CallExpression[] {
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name) found.push(node);
  ts.forEachChild(node, (child) => { calls(child, name, found); });
  return found;
}

function enclosingFunction(node: ts.Node): ts.Node {
  for (let at = node.parent; at; at = at.parent) if (ts.isFunctionLike(at)) return at;
  return node.getSourceFile();
}

/** Whether a prepareLocalTime call is awaited: directly, in an awaited Promise.all, or through a variable awaited later. */
function awaitedBefore(prepare: ts.CallExpression, before: number): boolean {
  let at: ts.Node = prepare;
  while (ts.isParenthesizedExpression(at.parent) || ts.isConditionalExpression(at.parent)
    || ts.isArrayLiteralExpression(at.parent)) at = at.parent;
  if (ts.isAwaitExpression(at.parent)) return at.parent.getStart() < before;
  if (ts.isCallExpression(at.parent) && at.parent.expression.getText() === 'Promise.all'
    && ts.isAwaitExpression(at.parent.parent)) return at.parent.parent.getStart() < before;
  if (ts.isVariableDeclaration(at.parent) && ts.isIdentifier(at.parent.name)) {
    const name = at.parent.name.text;
    let awaited = false;
    const scan = (node: ts.Node) => {
      if (ts.isAwaitExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name
        && node.getStart() < before) awaited = true;
      ts.forEachChild(node, scan);
    };
    scan(enclosingFunction(prepare));
    return awaited;
  }
  return false;
}

const longitudeOf = (call: ts.CallExpression): ts.Expression | null => {
  const options = call.arguments[3];
  if (!options || !ts.isObjectLiteralExpression(options)) return null;
  const property = options.properties.find((p) => p.name && ts.isIdentifier(p.name) && p.name.text === 'longitude');
  if (!property) return null;
  return ts.isPropertyAssignment(property) ? property.initializer : property.name as ts.Expression;
};

/**
 * An argument's text with what does not change which date or zone it names
 * taken out: spacing, non-null assertions, optional chaining, and a trailing
 * `?? 'UTC'` fallback (the callers resolve only once a place is present).
 */
const normal = (text: string) => text.replace(/\s+/g, '').replace(/!/g, '').replace(/\?\./g, '.').replace(/\?\?'[^']*'$/, '');

/** An expression in a function's body, with each parameter replaced by the argument a call passes. */
function substituted(expression: ts.Expression, fn: ts.SignatureDeclaration, use: ts.CallExpression): string {
  let text = expression.getText();
  fn.parameters.forEach((parameter, index) => {
    if (ts.isIdentifier(parameter.name) && use.arguments[index]) {
      text = text.replace(new RegExp(`\\b${parameter.name.text}\\b`, 'g'), use.arguments[index].getText());
    }
  });
  return normal(text);
}

/** Whether the function around a call awaits prepareLocalTime(date, zone) before it. */
const preparedBefore = (use: ts.CallExpression, date: string, zone: string) => calls(enclosingFunction(use), 'prepareLocalTime')
  .some((prepare) => prepare.arguments.length === 2 && normal(prepare.arguments[0].getText()) === date
    && normal(prepare.arguments[1].getText()) === zone && awaitedBefore(prepare, use.getStart()));

const sources = walk(root)
  .filter((path) => /\.(?:ts|tsx)$/.test(path) && !/\.test\.tsx?$/.test(path))
  .map((path) => {
    const text = readFileSync(path, 'utf8');
    return { path: relative(root, path).split(sep).join('/'), file: parse(path, text) };
  })
  .filter(({ path, file }) => path !== 'lib/time/localToUtc.ts' && calls(file, 'resolveLocalToUtc').length > 0);

describe('callers of resolveLocalToUtc', () => {
  it('finds the production callers', () => {
    expect(sources.length).toBeGreaterThan(10);
  });

  it('await prepareLocalTime of the same date and zone before each call that passes a longitude', () => {
    const problems: string[] = [];
    for (const { path, file } of sources) {
      for (const call of calls(file, 'resolveLocalToUtc')) {
        const longitude = longitudeOf(call);
        if (!longitude) continue;
        const where = `${path}:${file.getLineAndCharacterOfPosition(call.getStart()).line + 1}`;
        if (!/\.lon$/.test(longitude.getText())) problems.push(`${where} passes ${longitude.getText()} as the longitude`);
        const date = normal(call.arguments[0].getText());
        const zone = normal(call.arguments[2].getText());
        const scope = enclosingFunction(call);
        if (preparedBefore(call, date, zone)) continue;
        // A named function is prepared for when every call of it follows an
        // awaited preparation of the same date and zone, its parameters
        // replaced by the call's arguments: TransitTracker's natal helpers in
        // the same file, and the return calculators' compute functions in the
        // islands that load them.
        const helper = ts.isFunctionDeclaration(scope) && scope.name ? scope.name.text : null;
        const users = PREPARED_BY[path]
          ? PREPARED_BY[path].map((island) => parse(island, readFileSync(resolve(root, island), 'utf8')))
          : [file];
        const uses = helper ? users.flatMap((user) => calls(user, helper)) : [];
        const preparedByCallers = uses.length > 0 && uses.every((use) => preparedBefore(use,
          substituted(call.arguments[0], scope as ts.SignatureDeclaration, use),
          substituted(call.arguments[2], scope as ts.SignatureDeclaration, use)));
        if (!preparedByCallers) problems.push(`${where} has no awaited prepareLocalTime(${date}, ${zone}) before it`);
      }
    }
    for (const module of Object.keys(PREPARED_BY)) {
      if (!/export \{ prepareLocalTime \}/.test(readFileSync(resolve(root, module), 'utf8'))) problems.push(`${module} does not re-export prepareLocalTime`);
    }
    expect(problems).toEqual([]);
  });

  it('pass a longitude everywhere except the listed places', () => {
    const without = sources
      .filter(({ file }) => calls(file, 'resolveLocalToUtc').some((call) => !longitudeOf(call)))
      .map(({ path }) => path)
      .sort();
    expect(without).toEqual(Object.keys(WITHOUT_LONGITUDE).sort());
  });
});
