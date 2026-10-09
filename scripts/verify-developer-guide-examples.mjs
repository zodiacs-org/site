import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { findChromium } from '../tests/visual/browser.mjs';

const root = process.cwd();
const guides = JSON.parse(await readFile(resolve(root, 'src/data/developer-guides.json'), 'utf8'));
const candidate = JSON.parse(await readFile(resolve(root, 'src/data/platform-engine-candidate.json'), 'utf8'));
const code = (slug) => guides.find((guide) => guide.slug === slug).sections.find((section) => section.code).code.source;
assert.equal(guides.length, 18);
assert.equal(new Set(guides.map((guide) => guide.slug)).size, guides.length);
const scratch = await mkdtemp(join(tmpdir(), 'zodiacs-developer-guides-'));
const outcomes = [];
function command(binary, args, cwd = scratch) {
  const result = spawnSync(binary, args, { cwd, encoding: 'utf8', timeout: 180000 });
  if (result.status !== 0) throw new Error(`${binary} failed (${result.status}): ${result.stderr || result.stdout || result.error}`);
  return result.stdout;
}
const checks = {
  node: "assert.equal(chart.bodies.length, 12); assert.equal(chart.houses.system, 'whole'); for (const key of ['asc', 'mc', 'dsc', 'ic']) assert.ok(Number.isFinite(chart.angles[key]) && chart.angles[key] >= 0 && chart.angles[key] < 360);",
  deno: "assert.equal(chart.bodies.length, 12); assert.equal(chart.houses.system, 'whole'); for (const key of ['asc', 'mc', 'dsc', 'ic']) assert.ok(Number.isFinite(chart.angles[key]) && chart.angles[key] >= 0 && chart.angles[key] < 360);",
  bun: "assert.equal(chart.bodies.length, 12); assert.equal(chart.houses.system, 'whole'); for (const key of ['asc', 'mc', 'dsc', 'ic']) assert.ok(Number.isFinite(chart.angles[key]) && chart.angles[key] >= 0 && chart.angles[key] < 360);",
  natal: "assert.equal(chart.bodies.length, 12); assert.equal(chart.houses.system, 'whole'); for (const key of ['asc', 'mc', 'dsc', 'ic']) assert.ok(Number.isFinite(chart.angles[key]) && chart.angles[key] >= 0 && chart.angles[key] < 360);",
  transits: "assert.equal(typeof result, 'object'); assert.ok(result);",
  returns: "assert.equal(solar.body, 'Sun'); assert.equal(lunar.body, 'Moon'); assert.ok(Number.isFinite(solar.instant.getTime())); assert.ok(Number.isFinite(lunar.instant.getTime()));",
  synastry: "assert.equal(typeof synastry(first, second), 'object');",
  crossings: "assert.equal(result.status, 'complete'); assert.ok(result.crossings.length > 0); assert.ok(result.samples <= 5000);",
  conventions: "assert.equal(result.status, 'ok'); assert.ok(result.ayanamsa); assert.ok(result.receipt);",
  errors: "assert.equal(calc({ body: 'Sun', time: '1700-06-01T12:00:00Z' }).reason, 'out-of-range');",
  receipts: "assert.equal(result.status, 'ok'); assert.deepEqual(chart(JSON.parse(JSON.stringify(result.receipt.request))), result);",
};
try {
  const archivePath = resolve(root, candidate.artifactPath);
  const archive = await readFile(archivePath);
  assert.equal(createHash('sha256').update(archive).digest('hex'), candidate.sha256);
  await writeFile(join(scratch, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  command('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', archivePath]);
  const installed = JSON.parse(await readFile(join(scratch, 'node_modules/@zodiacs/engine/package.json'), 'utf8'));
  assert.equal(installed.version, candidate.version);
  for (const [slug, check] of Object.entries(checks)) {
    const file = join(scratch, slug + '.mjs');
    await writeFile(file, "import assert from 'node:assert/strict';\nconsole.log = () => {};\n" + code(slug) + '\n' + check + '\n');
    const runtime = slug === 'deno' ? 'deno' : slug === 'bun' ? 'bun' : process.execPath;
    const args = slug === 'deno' ? ['run', '--node-modules-dir=manual', file] : [file];
    command(runtime, args);
    outcomes.push({ guide: slug, runtime: slug === 'deno' || slug === 'bun' ? slug : 'node', status: 'pass' });
  }
  await writeFile(join(scratch, 'worker.mjs'), code('cloudflare'));
  await writeFile(join(scratch, 'worker-check.mjs'), `import assert from 'node:assert/strict';\nimport worker from './worker.mjs';\nconst response = await worker.fetch(new Request('https://example.invalid/'));\nassert.equal(response.status, 200);\nconst body = await response.json();\nassert.equal(body.bodies.length, 12);\n`);
  await build({ entryPoints: [join(scratch, 'worker.mjs')], outfile: join(scratch, 'worker-bundle.mjs'), bundle: true, platform: 'browser', format: 'esm', logLevel: 'silent' });
  command(process.execPath, [join(scratch, 'worker-check.mjs')]);
  outcomes.push({ guide: 'cloudflare', runtime: 'worker-style fetch plus browser-platform bundle', status: 'pass' });
  command('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', 'miniflare@4.20260730.0']);
  await writeFile(join(scratch, 'worker-runtime-check.mjs'), `import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
const worker = new Miniflare({
  modules: true, scriptPath: new URL('./worker-bundle.mjs', import.meta.url).pathname,
  compatibilityDate: '2026-10-09',
});
try {
  const response = await worker.dispatchFetch('https://example.invalid/');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).bodies.length, 12);
} finally {
  await worker.dispose();
}
`);
  command(process.execPath, [join(scratch, 'worker-runtime-check.mjs')]);
  const miniflare = JSON.parse(await readFile(join(scratch, 'node_modules/miniflare/package.json'), 'utf8'));
  assert.equal(miniflare.version, '4.20260730.0');
  outcomes.push({ guide: 'cloudflare', runtime: 'Miniflare ' + miniflare.version + ' / local workerd', status: 'pass' });

  await writeFile(join(scratch, 'browser.mjs'), code('browser'));
  await build({ entryPoints: [join(scratch, 'browser.mjs')], outfile: join(scratch, 'browser-bundle.mjs'), bundle: true, platform: 'browser', format: 'esm', logLevel: 'silent' });
  const server = createServer(async (request, response) => {
    if (request.url === '/browser-bundle.mjs') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(await readFile(join(scratch, 'browser-bundle.mjs')));
    } else {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><html><body><pre id="result"></pre><script type="module" src="/browser-bundle.mjs"></script></body></html>');
    }
  });
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: await findChromium(), headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => document.querySelector('#result').textContent.length > 0);
    const bodies = JSON.parse(await page.locator('#result').textContent());
    assert.equal(bodies.length, 12);
    assert.deepEqual(errors, []);
    outcomes.push({ guide: 'browser', runtime: await browser.version(), status: 'pass' });
  } finally {
    if (browser) await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
  }
  const source = createHash('sha256').update(await readFile(resolve(root, 'src/data/developer-guides.json'))).digest('hex');
  console.log(JSON.stringify({
    schema: 'zodiacs.developer-guide-examples.v1',
    candidate: { version: candidate.version, sha256: candidate.sha256 },
    guideSourceSha256: source,
    runtimes: { node: process.version, deno: command('deno', ['--version']).trim(), bun: command('bun', ['--version']).trim() },
    outcomes,
    limitations: ['Local workerd validates the bundled Worker without proving a deployed Cloudflare service.', 'Python and elections recipes use the existing hosted API contract fixtures; no live private request is made.', 'React Native and sunrise-based panchang remain outside this draft.'],
  }, null, 2));
} finally {
  await rm(scratch, { recursive: true, force: true });
}
