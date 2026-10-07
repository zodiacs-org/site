/** Build the isolated account/MCP/worker host. This never deploys or enables a schedule. */
import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addAiLifetimeBoundary } from './ai-runtime-lifetime.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = process.argv[2];
if (!output) throw new Error('Pass an empty staging output directory outside the repository.');
const dest = resolve(output);
if (dest === root || dest.startsWith(root + '/')) throw new Error('Use a separate staging directory.');
await mkdir(resolve(dest, 'api/_watch'), { recursive: true });
await mkdir(resolve(dest, 'assets'), { recursive: true });
const runtime = await build({ absWorkingDir: root, entryPoints: ['src/ai-tools/watch/preview-http.ts'], bundle: true,
  platform: 'node', format: 'esm', target: 'node22', write: false,
  external: ['@modelcontextprotocol/server', '@modelcontextprotocol/core', 'zod', '@vercel/firewall', '@supabase/supabase-js'] });
await writeFile(resolve(dest, 'api/_watch/runtime.mjs'), addAiLifetimeBoundary(runtime.outputFiles[0].text, false));
await writeFile(resolve(dest, 'api/index.mjs'), `import { createWatchPreviewHandler } from './_watch/runtime.mjs';
const handler = createWatchPreviewHandler();
const routes = { mcp: '/mcp', metadata: '/.well-known/oauth-protected-resource/mcp', config: '/account-config', worker: '/worker' };
export default (req, res) => {
  const route = req.query?.__watch_route;
  if (typeof route !== 'string' || !routes[route]) { res.statusCode=404; return res.end(); }
  delete req.query.__watch_route;
  req.url=routes[route]+(Object.keys(req.query).length?'?'+new URLSearchParams(req.query):'');
  return handler(req, res);
};\n`);
await build({ absWorkingDir: root, entryPoints: ['src/ai-tools/watch/account.ts'], bundle: true, minify: true,
  platform: 'browser', format: 'esm', target: 'es2022', outfile: resolve(dest, 'assets/account.js') });
for (const [from, to] of [
  ['src/ai-tools/watch/account.html', 'account.html'], ['src/ai-tools/watch/account.css', 'assets/account.css'],
  ['src/styles/site-footer.css', 'assets/site-footer.css'], ['public/assets/ai/sky-calendar.svg', 'assets/sky.svg'],
  ['public/fonts/instrument-sans-latin-wght-normal.woff2', 'assets/instrument-sans.woff2'],
  ['public/fonts/eb-garamond-latin-400-normal.woff2', 'assets/eb-garamond.woff2'],
]) await copyFile(resolve(root, from), resolve(dest, to));
await writeFile(resolve(dest, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
await writeFile(resolve(dest, 'test-callback.html'), '<!doctype html><html lang="en"><meta name="referrer" content="no-referrer"><meta name="robots" content="noindex"><title>Synthetic OAuth check</title><p>Synthetic authorization returned. No real user feedback is recorded by this check.</p></html>');
const source = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
await writeFile(resolve(dest, 'package.json'), JSON.stringify({ name: 'zodiacs-sky-watch-test', version: '0.3.0', private: true,
  type: 'module', engines: { node: '22.x' }, dependencies: Object.fromEntries(['@modelcontextprotocol/server', '@modelcontextprotocol/core', 'zod', '@vercel/firewall', '@vercel/functions', '@supabase/supabase-js']
    .map(name => [name, name === '@supabase/supabase-js' ? '2.110.0' : name === '@modelcontextprotocol/core' ? '2.0.0' : (source.dependencies[name] ?? source.devDependencies[name])])) }, null, 2) + '\n');
const routes = [['/mcp','mcp'],['/.well-known/oauth-protected-resource/mcp','metadata'],['/.well-known/oauth-protected-resource','metadata'],['/account-config','config'],['/worker','worker']];
await writeFile(resolve(dest, 'vercel.json'), JSON.stringify({ version: 2, framework: null, buildCommand: '', installCommand: 'npm ci --ignore-scripts',
  functions: { 'api/index.mjs': { maxDuration: 180 } },
  rewrites: [...routes.map(([source, route]) => ({ source, destination: `/api/index?__watch_route=${route}` })),
    { source: '/', destination: '/account.html' }, { source: '/oauth/consent', destination: '/account.html' },
    { source: '/oauth/test-callback', destination: '/test-callback.html' }],
  headers: [{ source: '/(.*)', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }, { key: 'Referrer-Policy', value: 'no-referrer' },
    { key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Cache-Control', value: 'no-store' },
    { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'none'; form-action 'self'" }] }],
}, null, 2) + '\n');
console.log(`Built isolated Sky Watch preview in ${dest}`);
