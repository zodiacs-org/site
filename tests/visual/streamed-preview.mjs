import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { setTimeout as pause } from 'node:timers/promises';

// Serve the built pages and assets unchanged. For selected HTML responses,
// give the browser a paint between the specified parser offsets.
export async function startStreamedPreview(baseURL, cutsFor, delay = 300) {
  const server = createServer(async (req, res) => {
    try {
      const response = await fetch(new URL(req.url, baseURL));
      const bytes = Buffer.from(await response.arrayBuffer());
      res.statusCode = response.status;
      for (const [name, value] of response.headers) {
        if (!['content-encoding', 'content-length', 'transfer-encoding', 'etag'].includes(name)) {
          res.setHeader(name, value);
        }
      }
      if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
        const html = bytes.toString();
        const cuts = cutsFor(req.url, html);
        if (cuts.length) {
          let start = 0;
          for (const cut of cuts) {
            assert.ok(cut > start && cut < html.length, `Invalid stream cut on ${req.url}`);
            res.write(html.slice(start, cut));
            await pause(delay);
            start = cut;
          }
          res.end(html.slice(start));
          return;
        }
      }
      res.end(bytes);
    } catch (error) {
      if (!res.headersSent) res.statusCode = 500;
      res.end(String(error));
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    async close() {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    },
  };
}
