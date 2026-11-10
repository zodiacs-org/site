#!/usr/bin/env node
/**
 * Builds the sealed DE440 pack the compute API's backend `de440` reads (P4.1,
 * docs/platform/evidence/de440-hosted-20261109/PREREGISTRATION.md), at
 * api/_compute/precision/de440-1790-2210.zeph, which git ignores: no
 * DE440-derived pack is ever committed or distributed
 * (docs/platform/programme/DECISIONS-2026-09-28.md §11). The function's file
 * trace carries it to the server (api/_compute/handler.ts).
 *
 *   node scripts/build-precision-pack.mjs
 *
 * It runs on a Vercel build, or wherever ZODIACS_PRECISION_PACK=build or
 * PRECISION_KERNEL (a local de440.bsp) is set, and does nothing elsewhere.
 * The kernel comes from PRECISION_KERNEL or from NAIF, and must have the
 * pinned SHA-256; the research runtime's compiler 2.0.0 and seal tool make
 * the pack, unchanged, and it must have the pinned SHA-256 too. It never
 * fails the build: on any failure it says so and leaves no pack, and the
 * backend then answers backend-unavailable while astronomy-engine is unchanged.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PACK_PATH = join(ROOT, 'api', '_compute', 'precision', 'de440-1790-2210.zeph');
export const PACK_SHA256 = '51428874d9a47213abc0ff42cbcec65f338624eaa2d8831f0e6ddc3654bf1fa7';
export const KERNEL_SHA256 = 'a4ce9bf9b3282becc9f4b2ac3cebe03a2ae7599981aabd7265fd8482fff7c4b5';
const KERNEL_URL = 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440.bsp';
const CACHE = join(ROOT, 'node_modules', '.cache', 'zodiacs-precision');
const ALPHA = join(ROOT, 'examples', 'precision-alpha', 'tools');

function sha256(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(path).on('error', reject).on('data', (chunk) => hash.update(chunk)).on('end', () => resolve(hash.digest('hex')));
  });
}

function say(message) {
  console.log(`precision pack: ${message}`);
}

async function kernel() {
  if (process.env.PRECISION_KERNEL) {
    const path = process.env.PRECISION_KERNEL;
    if ((await sha256(path)) !== KERNEL_SHA256) throw new Error('PRECISION_KERNEL is not de440.bsp (SHA-256 differs)');
    return path;
  }
  const path = join(CACHE, 'de440.bsp');
  if (existsSync(path) && (await sha256(path)) === KERNEL_SHA256) return path;
  mkdirSync(CACHE, { recursive: true });
  const part = `${path}.part`;
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(KERNEL_URL);
      if (!response.ok || !response.body) throw new Error(`NAIF answered ${response.status}`);
      const { Writable } = await import('node:stream');
      const { createWriteStream } = await import('node:fs');
      await response.body.pipeTo(Writable.toWeb(createWriteStream(part)));
      if ((await sha256(part)) !== KERNEL_SHA256) throw new Error('the downloaded kernel is not de440.bsp (SHA-256 differs)');
      renameSync(part, path);
      return path;
    } catch (error) {
      lastError = error;
      rmSync(part, { force: true });
    }
  }
  throw lastError;
}

function run(script, args) {
  const result = spawnSync(process.execPath, [join(ALPHA, script), ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (result.status !== 0) throw new Error(`${script} exited ${result.status}`);
}

export async function buildPrecisionPack({ env = process.env } = {}) {
  const wanted = env.VERCEL === '1' || env.ZODIACS_PRECISION_PACK === 'build' || Boolean(env.PRECISION_KERNEL);
  if (existsSync(PACK_PATH) && (await sha256(PACK_PATH)) === PACK_SHA256) {
    say(`present, ${statSync(PACK_PATH).size} bytes, SHA-256 ${PACK_SHA256}`);
    return true;
  }
  if (!wanted) {
    say('not built here (no Vercel build, ZODIACS_PRECISION_PACK or PRECISION_KERNEL); backend de440 will answer backend-unavailable');
    return false;
  }
  const work = join(CACHE, 'work');
  try {
    const from = await kernel();
    rmSync(work, { recursive: true, force: true });
    mkdirSync(work, { recursive: true });
    const compiled = join(work, 'de440-1790-2210.zeph');
    const sealed = join(work, 'de440-1790-2210.v2.zeph');
    run(join('compiler', 'compile.mjs'), [`--kernel=${from}`, '--fromYear=1790', '--toYear=2210', `--out=${compiled}`]);
    run('seal.mjs', [compiled, sealed]);
    const digest = await sha256(sealed);
    if (digest !== PACK_SHA256) throw new Error(`the sealed pack's SHA-256 is ${digest}, not the pinned one`);
    mkdirSync(dirname(PACK_PATH), { recursive: true });
    renameSync(sealed, PACK_PATH);
    say(`built, ${statSync(PACK_PATH).size} bytes, SHA-256 ${PACK_SHA256}`);
    return true;
  } catch (error) {
    rmSync(PACK_PATH, { force: true });
    say(`NOT built (${error instanceof Error ? error.message : 'failed'}); backend de440 will answer backend-unavailable`);
    return false;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await buildPrecisionPack();
}
