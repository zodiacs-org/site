import { createServer } from 'node:http';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { registerHoroscopePreview } from './register';
import { HOROSCOPE_HTML } from '../../../integrations/generated/horoscope-preview.mjs';
import { sanitizeProtocolMessage } from '../sanitize';
const port = Number(process.env.ZODIACS_HOROSCOPE_PREVIEW_PORT ?? 8796);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid loopback preview port.');
if (process.env.VERCEL || process.env.VERCEL_ENV === 'production') throw new Error('This preview is loopback-only.');
const counts = new Map<number, number>();
const handler = createMcpHandler(() => { const server = new McpServer({ name: 'zodiacs-horoscopes-preview', version: '0.1.0' }, { capabilities: { tools: {}, resources: {} }, instructions: 'Read-only private horoscope preview. Preserve edition dates, unavailable coverage and the distinction between sky facts and astrological interpretation. No personal birth chart is calculated.' }); registerHoroscopePreview(server); return server; }, { legacy: 'stateless', responseMode: 'auto', onerror: () => {} });
const server = createServer(async (req, res) => {
  res.setHeader('Cache-Control','no-store'); res.setHeader('X-Content-Type-Options','nosniff');
  const host = req.headers.host;
  if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(host ?? '') || (req.headers.origin && ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(req.headers.origin))) { res.writeHead(403); res.end(); return; }
  const minute = Math.floor(Date.now() / 60000); const count = (counts.get(minute) ?? 0) + 1; counts.clear(); counts.set(minute,count);
  if (count > 40) { res.writeHead(429, { 'Retry-After':'60' }); res.end(); return; }
  if (req.method === 'GET' && req.url === '/horoscopes') { res.writeHead(200, { 'Content-Type':'text/html; charset=utf-8', 'Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'" }); res.end(HOROSCOPE_HTML); return; }
  if (req.method !== 'POST' || req.url !== '/mcp') { res.writeHead(404); res.end(); return; }
  if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? '')) { res.writeHead(415); res.end(); return; }
  try {
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of req) { const bytes = Buffer.from(chunk); size += bytes.length; if (size > 16_384) { res.writeHead(413); res.end(); return; } chunks.push(bytes); }
    const body = Buffer.concat(chunks).toString('utf8'); const message = JSON.parse(body);
    if (Array.isArray(message) || !['initialize','notifications/initialized','ping','tools/list','tools/call','resources/list','resources/read','resources/templates/list'].includes(message?.method)) { res.writeHead(400); res.end(); return; }
    const headers = new Headers({ 'content-type':'application/json', accept:'application/json, text/event-stream' });
    if (typeof req.headers['mcp-protocol-version'] === 'string') headers.set('mcp-protocol-version',req.headers['mcp-protocol-version']);
    const response = await handler.fetch(new Request(`http://127.0.0.1:${port}/mcp`,{ method:'POST',headers,body }), { parsedBody:message });
    res.statusCode = response.status; response.headers.forEach((value,key) => res.setHeader(key,value));
    const reply = await response.text();
    const safe = response.headers.get('content-type')?.includes('text/event-stream') ? reply.split('\n').map(line => line.startsWith('data:') ? 'data: '+JSON.stringify(sanitizeProtocolMessage(JSON.parse(line.slice(5)))) : line).join('\n') : reply ? JSON.stringify(sanitizeProtocolMessage(JSON.parse(reply))) : '';
    res.end(safe);
  } catch { if (!res.headersSent) res.writeHead(400); res.end('{"error":"Preview request unavailable"}'); }
});
server.requestTimeout = 10000; server.headersTimeout = 10000;
server.listen(port,'127.0.0.1',() => console.log(`Horoscope preview: http://127.0.0.1:${port}/horoscopes · MCP: http://127.0.0.1:${port}/mcp`));
for (const signal of ['SIGINT','SIGTERM']) process.once(signal, () => server.close());
