/**
 * Read-only AI bundle state inventory, adapted from the rc.16 inventory.
 * Run from an installed checkout; JSON goes to stdout. No production file is
 * changed. Static inventory only: direct writes do not cover alias mutation or dependency state.
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
const bundlePath = process.argv[2];
assert.ok(['api/_ai/runtime.mjs', 'plugins/zodiacs-developer/mcp/server.mjs', 'integrations/generated/sky-watch.mjs'].includes(bundlePath), 'expected a generated AI runtime');
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

console.log(JSON.stringify({bundlePath, bundleSha256:sha256(source), bindings:declarations, directWrites},null,2));
