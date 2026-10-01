import { createServer } from 'node:http';
import { createAiNodeHandler } from '../api/_ai/runtime.mjs';

// Loopback-only development service, with explicit in-memory budgets.
const port = Number(process.env.ZODIACS_MCP_DEV_PORT ?? 8787);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid development port.');
const counts = new Map();
const handler = createAiNodeHandler({ env: { ZODIACS_MCP_ENABLED: '1' }, allowedHosts: [`127.0.0.1:${port}`, `localhost:${port}`], rateLimit: async (_req, id) => {
  const minute = Math.floor(Date.now() / 60000);
  const previous = counts.get(id);
  const count = previous?.minute === minute ? previous.count + 1 : 1;
  counts.set(id, { minute, count });
  return count <= (id.includes('events') ? 10 : 40) ? 'allowed' : 'limited';
} });
const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!['/mcp', '/mcp/health'].includes(url.pathname)) { res.writeHead(404); res.end(); return; }
  if (url.pathname === '/mcp/health' && !url.search) req.query = { __zodiacs_ai: 'health' };
  void handler(req, res).catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); });
});
server.requestTimeout = 10000;
server.headersTimeout = 10000;
server.listen(port, '127.0.0.1', () => console.log(`Development MCP: http://127.0.0.1:${port}/mcp (40 requests/minute, 10 event requests/minute).`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
