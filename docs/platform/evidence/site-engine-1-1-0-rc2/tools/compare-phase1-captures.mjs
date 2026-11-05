/**
 * C8: each new Phase 1 capture against the one main committed (git show <main>:path), with pngjs:
 * the two sizes and, where they agree, how many pixels differ and by how much at most in any channel.
 *
 *   node docs/platform/evidence/site-engine-1-1-0-rc2/tools/compare-phase1-captures.mjs <main commit> <captures dir>
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';

const [main, dir] = process.argv.slice(2);
const rows = [];
for (const name of readdirSync(dir).filter((file) => file.endsWith('.png')).sort()) {
  const before = PNG.sync.read(execFileSync('git', ['show', `${main}:docs/acceptance/phase1/screenshots/${name}`], { maxBuffer: 1 << 28 }));
  const after = PNG.sync.read(readFileSync(join(dir, name)));
  const row = { file: name, before: `${before.width}x${before.height}`, after: `${after.width}x${after.height}` };
  if (before.width === after.width && before.height === after.height) {
    let differing = 0;
    let largest = 0;
    let atMostTwo = 0;
    for (let i = 0; i < before.data.length; i += 4) {
      let pixel = 0;
      for (let c = 0; c < 4; c += 1) pixel = Math.max(pixel, Math.abs(before.data[i + c] - after.data[i + c]));
      if (pixel > 0) {
        differing += 1;
        if (pixel <= 2) atMostTwo += 1;
        largest = Math.max(largest, pixel);
      }
    }
    Object.assign(row, { pixels: before.width * before.height, differing, atMostTwoLevels: atMostTwo, largestLevelDifference: largest });
  }
  rows.push(row);
}
console.log(JSON.stringify({ main, rows }, null, 1));
