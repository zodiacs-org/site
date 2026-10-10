#!/usr/bin/env node
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir, realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {openStudy, recordDecision, settleDecisions, reportStudy} from '../research/market-lens/prospective.mjs';

const [command, flag, directoryArg, ...extra] = process.argv.slice(2);
if (!['init', 'record', 'settle', 'report'].includes(command) || flag !== '--dir' || !directoryArg || extra.length) throw new Error('Usage: node scripts/market-lens-paper.mjs init|record|settle|report --dir /persistent/private/path-outside-checkout');
await mkdir(path.resolve(directoryArg), {recursive: true, mode: 0o700});
const directory = await realpath(path.resolve(directoryArg));
const checkout = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
if (directory === checkout || directory.startsWith(checkout + path.sep)) throw new Error('Raw paper-study data must remain outside the checkout, including symlink targets');
const study = await openStudy(directory, Date.now(), command === 'init');
const execute = promisify(execFile);
async function fetchCandles(product, start, end) {
  const url = new URL(`https://api.exchange.coinbase.com/products/${product}/candles`);
  url.search = new URLSearchParams({granularity: '86400', start: new Date(start * 1000).toISOString(), end: new Date(end * 1000).toISOString()});
  const {stdout} = await execute('curl', ['--fail', '--silent', '--show-error', '--connect-timeout', '10', '--max-time', '30', '--proto', '=https', '--max-filesize', '250000', url.href], {maxBuffer: 250000});
  return JSON.parse(stdout);
}
if (command === 'record') {
  const decision = await recordDecision(study, fetchCandles);
  console.log(JSON.stringify({executionAt: decision.payload.executionAt, recordedAt: decision.payload.recordedAt, decisionHash: decision.sha256, protocolHash: study.protocolHash}, null, 2));
} else if (command === 'settle') console.log(JSON.stringify(await settleDecisions(study, fetchCandles), null, 2));
else console.log(JSON.stringify(await reportStudy(study), null, 2));
