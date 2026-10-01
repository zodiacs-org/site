import { createServer, request } from 'node:http';
import { spawn } from 'node:child_process';
import { startPreview } from './visual/preview-server.mjs';

// Serve the production assets with the real development API behind the same
// origin. This checks the built browser bundle; it does not certify Vercel's
// edge rewrite. The routing test separately checks that configuration.
const preview = await startPreview({ port: 4333 });
const publicOrigin = new URL(preview.baseURL);
const apiOrigin = new URL(process.env.LENS_DEV_ORIGIN ?? 'http://127.0.0.1:4321');
if (!['127.0.0.1', 'localhost'].includes(apiOrigin.hostname)) {
  await preview.stop();
  throw new Error('The API origin for this local acceptance driver must be loopback.');
}
const proxy = createServer((req, res) => {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
  const origin = path === '/api/registry/lens' ? apiOrigin : publicOrigin;
  const upstream = request(new URL(req.url ?? '/', origin), { method: req.method, headers: { ...req.headers, host: origin.host } }, response => {
    res.writeHead(response.statusCode ?? 502, response.headers);
    response.pipe(res);
  });
  upstream.on('error', () => { res.writeHead(502); res.end('Local acceptance upstream unavailable'); });
  req.pipe(upstream);
});
try {
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const address = proxy.address();
  for (const driver of ['tests/market-lens-drive.mjs', 'tests/market-lens-revised-drive.mjs']) {
    const child = spawn(process.execPath, [driver], {
      cwd: process.cwd(), stdio: 'inherit',
      env: { ...process.env, BASE_URL: `http://127.0.0.1:${address.port}`, OUT_DIR: `${process.env.OUT_DIR ?? '/tmp/market-lens-production-browser'}/${driver.includes('revised') ? 'revised' : 'legacy'}` },
    });
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
    if (code !== 0) { process.exitCode = code ?? 1; break; }
  }
} finally {
  await new Promise(resolve => proxy.close(resolve));
  await preview.stop();
}
