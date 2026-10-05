import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:https';
import { request } from 'node:http';

/** Exercise upgrade-insecure-requests on HTTPS, including WebKit's localhost behavior. */
export async function withSecurePreview(base, callback) {
  if (base.startsWith('https://')) return callback(base, false);
  const dir = await mkdtemp(join(tmpdir(), 'zodiacs-local-tls-'));
  let server;
  try {
    await promisify(execFile)('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost', '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem')]);
    server = createServer({ key: await readFile(join(dir, 'key.pem')), cert: await readFile(join(dir, 'cert.pem')) }, (incoming, outgoing) => {
      const upstream = request(new URL(incoming.url, base), { method: incoming.method, headers: incoming.headers }, (response) => {
        outgoing.writeHead(response.statusCode, response.headers); response.pipe(outgoing);
      });
      upstream.on('error', () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end(); });
      incoming.pipe(upstream);
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    return await callback(`https://127.0.0.1:${server.address().port}`, true);
  } finally {
    if (server) { const closed = new Promise((resolve) => server.close(resolve)); server.closeAllConnections(); await closed; }
    await rm(dir, { recursive: true, force: true });
  }
}
