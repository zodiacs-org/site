import assert from 'node:assert/strict';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:http';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';
import { findChromium } from '../tests/visual/browser.mjs';
import { readPackageArchive } from './verify-platform-starter.mjs';

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
  // A published version is installed as the guides say, from npm by exact version, and every file npm
  // installed must be the carried archive's, byte for byte; a vendored candidate is installed from the archive.
  const published = candidate.releaseStatus === 'published';
  command('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', published ? `${candidate.name}@${candidate.version}` : archivePath]);
  const installed = JSON.parse(await readFile(join(scratch, 'node_modules/@zodiacs/engine/package.json'), 'utf8'));
  assert.equal(installed.version, candidate.version);
  if (published) {
    const packed = readPackageArchive(archive);
    // The same set of files, not only the archive's files: npm's package may hold nothing more.
    const installedDir = join(scratch, 'node_modules/@zodiacs/engine');
    const installedFiles = (await readdir(installedDir, { recursive: true, withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => relative(installedDir, join(entry.parentPath ?? entry.path, entry.name)).split(sep).join('/'))
      .sort();
    assert.deepEqual(installedFiles, [...packed.keys()].sort(), "npm's package holds exactly the archive's files");
    for (const [path, bytes] of packed) {
      assert.ok((await readFile(join(installedDir, path))).equals(bytes), `npm's ${path} is the archive's`);
    }
    outcomes.push({ check: 'npm install matches the carried archive', files: packed.size, status: 'pass' });
  }
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
  compatibilityDate: '2026-07-30',
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
  const workerd = JSON.parse(await readFile(join(scratch, 'node_modules/workerd/package.json'), 'utf8'));
  outcomes.push({ guide: 'cloudflare', runtime: 'Miniflare ' + miniflare.version + ' / workerd ' + workerd.version, compatibilityDate: '2026-07-30', status: 'pass' });

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
  // The hosted elections recipe: the guide's own snippet, run in Node with fetch pointed at a local fixture
  // of the committed contract. The request must be the compute API's documented example; a 200 must print
  // the committed response, and a refusal must stop the program.
  const examples = JSON.parse(await readFile(resolve(root, 'src/lib/compute-api/examples.json'), 'utf8'));
  // The documented request is the contract's own: examples.ts, compiled here and imported, not a copy.
  await build({ entryPoints: [resolve(root, 'src/lib/compute-api/examples.ts')], outfile: join(scratch, 'contract.mjs'),
    bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { SUCCESS_EXAMPLES } = await import(pathToFileURL(join(scratch, 'contract.mjs')).href);
  const documented = SUCCESS_EXAMPLES.elections.london.body;
  assert.ok(documented && Array.isArray(documented.conditions), "the compute API's elections example has a request body");
  await writeFile(join(scratch, 'elections.mjs'), code('elections'));
  await writeFile(join(scratch, 'elections-run.mjs'), `const target = process.env.MOCK_ORIGIN;
const realFetch = globalThis.fetch;
globalThis.fetch = (url, init) => realFetch(String(url).replace('https://zodiacs.org', target), init);
const printed = [];
console.log = (value) => { printed.push(value); };
process.on('exit', () => { process.stdout.write(JSON.stringify(printed)); });
await import('./elections.mjs');
`);
  for (const fixture of [
    { name: 'success', status: 200, headers: {}, response: examples.success.elections.london },
    { name: 'rate-limited', ...examples.refusals['rate-limited'] },
  ]) {
    let received = null;
    const mock = createServer(async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      received = { method: request.method, url: request.url, type: request.headers['content-type'], body: Buffer.concat(chunks).toString('utf8') };
      response.writeHead(fixture.status, { ...fixture.headers, 'Content-Type': 'application/json' });
      response.end(JSON.stringify(fixture.response));
    });
    await new Promise((ready) => mock.listen(0, '127.0.0.1', ready));
    try {
      // Asynchronous, so this process keeps serving the fixture while the snippet runs.
      let run;
      try {
        const { stdout, stderr } = await promisify(execFile)(process.execPath, [join(scratch, 'elections-run.mjs')], {
          cwd: scratch, encoding: 'utf8', timeout: 30000, env: { ...process.env, MOCK_ORIGIN: 'http://127.0.0.1:' + mock.address().port },
        });
        run = { status: 0, stdout, stderr };
      } catch (error) {
        assert.equal(typeof error.code, 'number', `the elections snippet did not run: ${error.message}`);
        run = { status: error.code, stdout: error.stdout, stderr: error.stderr };
      }
      assert.ok(received, 'the documented request reached the fixture');
      assert.equal(received.method, 'POST');
      assert.equal(received.url, '/api/v1/elections');
      assert.equal(received.type, 'application/json');
      assert.deepEqual(JSON.parse(received.body), documented);
      if (fixture.status === 200) {
        assert.equal(run.status, 0, run.stderr);
        assert.deepEqual(JSON.parse(run.stdout), [fixture.response]);
      } else {
        assert.notEqual(run.status, 0);
        assert.match(run.stderr, new RegExp(`The service refused this request: ${fixture.status}`));
      }
      outcomes.push({ guide: 'elections', runtime: 'node, against a local fixture of the committed contract', case: fixture.name, status: 'pass' });
    } finally {
      await new Promise((closed) => mock.close(closed));
    }
  }
  const source = createHash('sha256').update(await readFile(resolve(root, 'src/data/developer-guides.json'))).digest('hex');
  console.log(JSON.stringify({
    schema: 'zodiacs.developer-guide-examples.v1',
    candidate: { version: candidate.version, sha256: candidate.sha256, releaseStatus: candidate.releaseStatus, installedFrom: candidate.releaseStatus === 'published' ? 'npm registry, by exact version' : 'carried archive' },
    guideSourceSha256: source,
    runtimes: { node: process.version, deno: command('deno', ['--version']).trim(), bun: command('bun', ['--version']).trim() },
    outcomes,
    limitations: ['Local workerd validates the bundled Worker without proving a deployed Cloudflare service.', 'The Python and elections recipes run against local fixtures of the committed hosted API contract; no live request is made.', 'React Native and sunrise-based panchang guides are not yet written.'],
  }, null, 2));
} finally {
  await rm(scratch, { recursive: true, force: true });
}
