#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {acquireDataset} from '../research/market-lens/dataset.mjs';
import {runExperiment} from '../research/market-lens/experiment.mjs';

const [command, ...args] = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!['--dir', '--report-dir'].includes(args[i]) || !args[i + 1]) throw new Error('Usage: node scripts/market-lens-research.mjs acquire|run --dir /path/outside/public [--report-dir /private/report/path]');
  options[args[i]] = args[i + 1];
}
if (!['acquire', 'run'].includes(command) || !options['--dir']) throw new Error('Specify acquire or run and --dir for the private data directory');
const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../research/market-lens');
const directory = path.resolve(options['--dir']);
const checkoutRoot = path.resolve(sourceRoot, '../..');
if (directory === checkoutRoot || directory.startsWith(checkoutRoot + path.sep)) throw new Error('Raw market research must remain outside the checkout to prevent publication or accidental commits');
const manifestBytes = await readFile(path.join(sourceRoot, 'manifest.json'));
const manifest = JSON.parse(manifestBytes.toString());
if (command === 'acquire') await acquireDataset(directory, manifest, manifestBytes);
else await runExperiment(directory, manifest, manifestBytes, options['--report-dir'] ? path.resolve(options['--report-dir']) : sourceRoot);
