/**
 * Read-only rc.16 server-state inventory and finite completion-state probe.
 * Run from an installed checkout; JSON goes to stdout. No production file is
 * changed. Private observers exist only in an isolated, in-memory module.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const require = createRequire(join(root, 'package.json'));
const bundlePath = 'api/_compute/compute.mjs';
const filename = join(root, bundlePath);
const source = readFileSync(filename, 'utf8');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const program = ts.createProgram([filename], { allowJs: true, noResolve: true, noLib: true });
const checker = program.getTypeChecker();
const tree = program.getSourceFile(filename);
assert.ok(tree);
const globals = new Map();
const declarations = [];
for (const statement of tree.statements) {
  if (!ts.isVariableStatement(statement)) continue;
  for (const declaration of statement.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name)) continue;
    const name = declaration.name.text;
    globals.set(checker.getSymbolAtLocation(declaration.name), name);
    declarations.push({
      name,
      line: tree.getLineAndCharacterOfPosition(declaration.getStart(tree)).line + 1,
      initializer: declaration.initializer?.getText(tree).replaceAll('\n', ' ').slice(0, 180) ?? '<uninitialized>',
    });
  }
}

function rootIdentifier(expression) {
  while (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) expression = expression.expression;
  return ts.isIdentifier(expression) ? expression : null;
}
const directWrites = [];
function record(node, target, kind) {
  const identifier = rootIdentifier(target);
  if (!identifier) return;
  const name = globals.get(checker.getSymbolAtLocation(identifier));
  if (!name) return;
  directWrites.push({
    name,
    kind,
    line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
    expression: node.getText(tree).replaceAll('\n', ' ').slice(0, 180),
  });
}
function visit(node) {
  if (ts.isBinaryExpression(node)
    && node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment
    && node.operatorToken.kind <= ts.SyntaxKind.LastAssignment) record(node, node.left, 'assignment');
  if ((ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node))
    && [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken].includes(node.operator)) record(node, node.operand, 'update');
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
    && /^(push|pop|shift|unshift|splice|set|add|delete|clear|fill|sort|reverse|setTime|setUTC.*)$/u.test(node.expression.name.text)) {
    record(node, node.expression.expression, 'method');
  }
  ts.forEachChild(node, visit);
}
visit(tree);

function once(text, from, to) {
  assert.equal(text.split(from).length, 2, `instrumentation marker: ${from}`);
  return text.replace(from, to);
}
const names = declarations.map(({ name }) => name);
let instrumented = once(source, 'from "@vercel/firewall";', `from ${JSON.stringify(pathToFileURL(require.resolve('@vercel/firewall')).href)};`);
instrumented += `\nexport function inspectAll() { return { ${names.join(', ')} }; }
export function inspectLifetime() { return { frame: last ?? null, pluto: Object.keys(pluto_cache), moon: CalcMoonCount, deltaTReset: DeltaT === deltaT }; }
`;
const module = await import(`data:text/javascript;base64,${Buffer.from(instrumented).toString('base64')}`);
const handler = module.createComputeApiHandler({ localTime: {}, env: {}, rateLimit: async () => 'allowed' });
async function run(endpoint, body) {
  let output;
  const response = { setHeader() {}, end(text) { output = JSON.parse(text); } };
  await handler({ method: 'POST', query: { __zodiacs_compute: endpoint }, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(module.inspectLifetime(), { frame: null, pluto: [], moon: 0, deltaTReset: true });
  return output;
}
function snapshot() {
  return Object.fromEntries(Object.entries(module.inspectAll()).map(([name, value]) => [name, sha256(JSON.stringify(value, (_key, item) => {
    if (item instanceof Map || item instanceof Set) return [...item];
    if (item instanceof WeakMap) return '[weak map: source-reviewed, not enumerated]';
    if (item instanceof WeakSet) return '[weak set: source-reviewed, not enumerated]';
    if (typeof item === 'function') return `function:${item.toString()}`;
    return item === undefined ? '[undefined]' : item;
  }))]));
}

// Both the IERS and model branches are deliberately initialized before the
// baseline. Initializing immutable-data tables is expected and is not a leak.
await run('positions', { instants: ['2000-01-01T12:00:00Z', '2082-03-14T05:29:17Z'] });
const baseline = snapshot();
const cases = [];
for (const utc of ['1800-01-01T12:00:00.002Z', '2000-01-01T12:00:00Z', '2026-10-01T00:00:00Z', '2199-12-31T12:00:00.002Z']) {
  const result = await run('chart', { utc, latitude: -31.55537, longitude: 159.07735 });
  const after = snapshot();
  const changedBindings = names.filter(name => baseline[name] !== after[name]);
  assert.deepEqual(changedBindings, []);
  assert.equal(result.receipt.conventions.nutation, 'iau2000b;equation-of-equinoxes-with-two-complementary-terms');
  assert.equal(result.receipt.conventions.moonPosition, 'astronomy-engine-geo-moon;no-light-time;no-aberration');
  cases.push({ utc, changedBindings, lifetime: module.inspectLifetime(), rc16Conventions: true });
}

console.log(JSON.stringify({
  schemaVersion: 1,
  node: process.version,
  source: { path: bundlePath, sha256: sha256(source) },
  globalsObserved: names.length,
  declarations,
  directWrites,
  reviewedAliasMutation: 'GetSegment(cache, tt) receives pluto_cache and populates epoch-selected segments; direct-global-write enumeration alone does not detect this alias.',
  cases,
  limits: [
    'Finite same-runtime regression observation, supplemented by source audit; not a proof for every input.',
    'Weak collections are intentionally not enumerated. Their weak keys and fixed value/default-policy behavior were source-reviewed.',
    'Function source snapshots cannot enumerate captured closures; DeltaT restoration is also checked by exact function identity.',
    'No secure heap erasure, platform-log guarantee, independent astronomical accuracy or production-performance claim.',
  ],
}, null, 2));
