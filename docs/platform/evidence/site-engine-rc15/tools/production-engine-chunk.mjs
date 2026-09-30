/**
 * The engine chunk that production's /birth-chart/ loads, and the engine
 * version it carries.
 *
 *   node docs/platform/evidence/site-engine-rc15/tools/production-engine-chunk.mjs https://zodiacs.org > production-engine-chunk.json
 *
 * Starts from the page's own scripts (script src, modulepreload, and the Astro
 * islands' component and renderer URLs), follows every static and dynamic
 * import under /_astro/, and names the engine chunk as
 * scripts/report-bundles.mjs does: the one /_astro/full.<hash>.js. It then
 * lists the version strings (0.1.1-rc.N) in that chunk's static closure and
 * in every other module reached. Files are fetched with curl, which reads
 * HTTPS_PROXY; a connection dropped before any response is tried again, and
 * any path that still fails is listed in fetchFailures.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const origin = process.argv[2] ?? 'https://zodiacs.org';
const failed = [];
let connectionRetries = 0;
const get = (path) => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return execFileSync('curl', ['-sS', '--fail', '--compressed', `${origin}${path}`], {
        maxBuffer: 64 << 20,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch (error) {
      // curl 7 connect, 28 timeout, 35 TLS handshake, 52 empty reply, 56 receive.
      if (![7, 28, 35, 52, 56].includes(error.status) || attempt >= 10) throw error;
      connectionRetries += 1;
      execFileSync('sleep', ['2']);
    }
  }
};
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const versionsIn = (buffer) => [...new Set([...buffer.toString('utf8').matchAll(/0\.1\.1-rc\.\d+/g)].map((m) => m[0]))];
const toPath = (ref) => `/_astro/${ref.replace(/^(?:\.{1,2}\/|\/)?(?:_astro\/)?/, '')}`;

const html = get('/birth-chart/').toString('utf8');
const entries = [...new Set([...html.matchAll(/(?:src|href|component-url|renderer-url|before-hydration-url)="(\/_astro\/[^"]+\.js)"/g)].map((m) => m[1]))];

const modules = new Map();
const staticImports = new Map();
const queue = [...entries];
while (queue.length) {
  const path = queue.shift();
  if (modules.has(path) || failed.includes(path)) continue;
  let body;
  try {
    body = get(path);
  } catch {
    failed.push(path);
    continue;
  }
  modules.set(path, body);
  const text = body.toString('utf8');
  staticImports.set(path, [...text.matchAll(/(?:from|import)\s*["'](\.{1,2}\/[^"']+\.js|\/_astro\/[^"']+\.js)["']/g)].map((m) => toPath(m[1])));
  // Every module name the file mentions: static imports, import() and Vite's preload lists.
  for (const [, ref] of text.matchAll(/["'(]((?:\.{1,2}\/|\/)?(?:_astro\/)?[A-Za-z0-9_.@-]+\.js)["')]/g)) {
    const next = toPath(ref);
    if (!modules.has(next)) queue.push(next);
  }
}

const closure = (root) => {
  const out = new Set();
  const walk = (path) => {
    if (out.has(path) || !modules.has(path)) return;
    out.add(path);
    for (const next of staticImports.get(path) ?? []) walk(next);
  };
  walk(root);
  return [...out];
};
const engineChunks = [...modules.keys()].filter((path) => /^\/_astro\/full\.[^/]+\.js$/.test(path));

console.log(JSON.stringify({
  origin,
  page: '/birth-chart/',
  checkedAt: new Date().toISOString(),
  entryScripts: entries.length,
  modulesReached: modules.size,
  fetchFailures: failed,
  connectionRetries,
  engineChunks: engineChunks.map((path) => {
    const members = closure(path);
    return {
      path,
      bytes: modules.get(path).length,
      sha256: sha256(modules.get(path)),
      staticClosureSize: members.length,
      staticClosureVersions: members.map((member) => ({ path: member, versions: versionsIn(modules.get(member)) })).filter((row) => row.versions.length),
    };
  }),
  modulesWithVersionStrings: [...modules.entries()].map(([path, body]) => ({ path, versions: versionsIn(body) })).filter((row) => row.versions.length),
}, null, 2));
