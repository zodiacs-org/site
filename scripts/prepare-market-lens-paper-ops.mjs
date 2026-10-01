#!/usr/bin/env node
import {mkdir, realpath, cp, copyFile, writeFile, readdir, chmod} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {openStudy, readDecisions} from '../research/market-lens/prospective.mjs';

const [stateFlag, stateArg, outFlag, outArg, ...extra] = process.argv.slice(2);
if (stateFlag !== '--state' || outFlag !== '--out' || !stateArg || !outArg || extra.length) throw Error('Use: node scripts/prepare-market-lens-paper-ops.mjs --state /private/existing-study --out /private/new-bundle');
const root = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const state = await realpath(path.resolve(stateArg));
const outputParent = await realpath(path.dirname(path.resolve(outArg)));
const output = path.join(outputParent, path.basename(path.resolve(outArg)));
const inside = (child, parent) => child === parent || child.startsWith(parent + path.sep);
if (inside(state, root) || inside(output, root) || inside(output, state) || inside(state, output)) throw Error('State and output must remain outside the public checkout and separate from each other');
const study = await openStudy(state);
const decisions = await readDecisions(study);
await mkdir(output, {mode: 0o700}); // Refuse an existing destination; do not overwrite a prior seed.
const frozen = path.join(output, 'frozen');
await mkdir(frozen, {mode: 0o700});
const files = ['package.json', 'package-lock.json', 'vendor/zodiacs-engine-0.1.1-rc.15.tgz', 'scripts/market-lens-paper.mjs', ...['prospective-manifest.json', 'prospective.mjs', 'features.mjs', 'core.mjs', 'dataset.mjs'].map(name => 'research/market-lens/' + name)];
for (const name of files) {
  const destination = path.join(frozen, name);
  await mkdir(path.dirname(destination), {recursive: true, mode: 0o700});
  await copyFile(path.join(root, name), destination);
}
await cp(path.join(root, 'research/market-lens/ops'), path.join(output, 'ops'), {recursive: true, dereference: false});
await cp(state, path.join(output, 'state'), {recursive: true, dereference: false});
await mkdir(path.join(output, '.github/workflows'), {recursive: true, mode: 0o700});
await copyFile(path.join(output, 'ops/paper.yml'), path.join(output, '.github/workflows/paper.yml'));
await copyFile(path.join(output, 'ops/README.md'), path.join(output, 'README.md'));
await writeFile(path.join(output, '.gitignore'), 'node_modules/\n*.tmp\n.env*\n', {mode: 0o600});
async function privatePermissions(directory) {
  await chmod(directory, 0o700);
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    if (entry.isSymbolicLink()) throw Error('Private bundle cannot contain symlinks');
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await privatePermissions(filename);
    else await chmod(filename, 0o600);
  }
}
await privatePermissions(output);
console.log(JSON.stringify({output, protocolHash: study.protocolHash, recordedDecisions: decisions.length, schedulerActivated: false, rawDataPrivate: true}, null, 2));
