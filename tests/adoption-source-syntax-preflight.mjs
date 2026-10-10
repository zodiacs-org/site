import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const sources = [
  { root: 'local-mcp', source: 'da9483b2a51c378667f721e200745778e26fb1e5', files: [
    'src/mcp/birth-time-tools.ts', 'src/mcp/birth-time-tools.test.ts',
    'src/mcp/birth-time-protocol.test.ts', 'src/mcp/create-server.ts',
    'src/mcp/create-server.test.ts', 'src/mcp/tools.ts', 'src/mcp/cite.ts',
    'src/mcp/resources.ts', 'tests/mcp-protocol-drive.mjs',
  ] },
  { root: 'library-adoption', source: '0eb5942b5eff1ade2d7115510f9de03c8a7a8abb', files: [
    'src/lib/composite.ts', 'src/lib/dignities.ts',
  ] },
];
const cases = [];
for (const entry of sources) {
  const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: entry.root, encoding: 'utf8' });
  if (git.status !== 0 || git.stdout.trim() !== entry.source) throw new Error('Source identity mismatch');
  for (const file of entry.files) {
    const bytes = readFileSync(resolve(entry.root, file));
    const args = file.endsWith('.ts') ? ['--experimental-strip-types', '--check', file] : ['--check', file];
    const checked = spawnSync(process.execPath, args, { cwd: entry.root, encoding: 'utf8', timeout: 15000 });
    cases.push({ source: entry.source, path: file, size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'), status: checked.status,
      signal: checked.signal, errorClass: checked.error?.name ?? null,
      stderr: checked.stderr ?? '', stdout: checked.stdout ?? '' });
  }
}
const report = {
  schema: 'zodiacs.adoption-source-syntax-preflight.v1',
  producer: { source: process.env.GITHUB_SHA, run: process.env.GITHUB_RUN_ID, node: process.version },
  scope: 'Native syntax parsing only; no imports, package execution, typecheck, resolution answer, parity, build or adoption claim.',
  cases,
  allPassed: cases.every((entry) => entry.status === 0 && entry.signal === null && entry.errorClass === null),
};
const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
console.log('PROGRAMME_FILE ' + JSON.stringify({ path: 'docs/platform/evidence/adoption-source-syntax-20261010/preflight.json', size: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'), base64: bytes.toString('base64') }));
console.log('Source syntax preflight: ' + cases.filter((entry) => entry.status === 0).length + '/' + cases.length);
if (!report.allPassed) process.exitCode = 1;
