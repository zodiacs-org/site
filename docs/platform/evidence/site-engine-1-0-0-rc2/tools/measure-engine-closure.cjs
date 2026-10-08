const io = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '../../../../..');
const ts = require(path.join(root, 'node_modules/typescript'));
const dir = path.join(root, 'dist/_astro');
const roots = io.readdirSync(dir).filter(f => /^full\.[^.]+\.js$/.test(f));
if (roots.length !== 1) throw new Error('expected one full chunk');
const seen = new Map();
function visit(file) {
  if (seen.has(file)) return;
  const text = io.readFileSync(path.join(dir, file), 'utf8');
  seen.set(file, { file, gzip: zlib.gzipSync(text, { level: 9 }).length });
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  for (const node of tree.statements) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (spec.startsWith('./')) visit(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)));
    }
  }
}
visit(roots[0]);
console.log(JSON.stringify({
  metric: 'gzip level 9, each static chunk separately, matching report-bundles.mjs',
  root: roots[0], chunks: [...seen.values()],
  gzipBytes: [...seen.values()].reduce((n, chunk) => n + chunk.gzip, 0),
  limitBytes: JSON.parse(io.readFileSync(path.join(root, 'budgets.json')))['engine-chunk'] * 1024,
}, null, 2));
