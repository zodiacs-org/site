/**
 * `reference-residuals.ts` run on the base commit: its own `src/` from git
 * objects, bundled against the rc.14 archive, measured against the references
 * that commit carries, which were built on rc.14's clock. It gives the
 * residuals rc.14 had before the adoption, to set beside rc.15's against the
 * rebuilt references.
 *
 *   node docs/platform/evidence/site-engine-rc15/tools/reference-residuals-base.mjs \
 *     <base commit> vendor/zodiacs-engine-0.1.1-rc.14.tgz > residuals-base.json
 *
 * Run from the repository root; the residual tool is this checkout's, placed
 * at its own path inside the base tree so that its imports resolve there.
 */
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import * as esbuild from 'esbuild';

const [base, archive] = process.argv.slice(2);
if (!/^[0-9a-f]{40}$/u.test(base ?? '') || !archive) {
  console.error('usage: reference-residuals-base.mjs <40-hex base commit> <rc.14 archive>');
  process.exit(2);
}
const root = process.cwd();
const work = mkdtempSync(join(tmpdir(), 'zodiacs-residuals-base-'));
try {
  execFileSync('sh', ['-c', `git archive ${base} src | tar -x -C "${work}"`], { cwd: root });
  mkdirSync(join(work, 'node_modules/@zodiacs/engine'), { recursive: true });
  execFileSync('tar', ['-xzf', resolve(root, archive), '--strip-components=1', '-C', join(work, 'node_modules/@zodiacs/engine')]);
  symlinkSync(resolve(root, 'node_modules/astronomy-engine'), join(work, 'node_modules/astronomy-engine'));
  const tools = join(work, 'docs/platform/evidence/site-engine-rc15/tools');
  mkdirSync(tools, { recursive: true });
  copyFileSync(resolve(root, 'docs/platform/evidence/site-engine-rc15/tools/reference-residuals.ts'), join(tools, 'reference-residuals.ts'));
  const bundle = join(tools, 'reference-residuals.mjs');
  await esbuild.build({
    entryPoints: [join(tools, 'reference-residuals.ts')], bundle: true, platform: 'node', format: 'esm',
    target: 'node22', outfile: bundle, logLevel: 'error', nodePaths: [resolve(root, 'node_modules')],
  });
  process.stdout.write(execFileSync(process.execPath, [bundle, join(work, 'src/lib/engine/fixtures')], { cwd: work, maxBuffer: 1 << 26 }));
} finally {
  rmSync(work, { recursive: true, force: true });
}
