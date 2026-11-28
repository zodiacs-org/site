/**
 * The loopback server behind tests/chatgpt-plugin-gate.spec.ts when no
 * BASE_URL is given. It serves what a deployment serves for the app listing:
 *
 *   - /mcp, /mcp/health and the OAuth discovery addresses, routed by the
 *     rewrites in vercel.json into the published connector
 *     (api/_ai/handler.ts, publishedConnector), the same bytes /mcp runs in
 *     production, with production's tool switches on and accounts off;
 *   - every other path from dist/ when a build exists, otherwise from public/
 *     (enough for the /.well-known/ files).
 *
 * Rate limits, quotas and usage counting are stand-ins that allow every call
 * and count nothing. It binds 127.0.0.1 only.
 *
 * To keep it running for another client (the gate with BASE_URL, MCP
 * Inspector): npx vite-node --script scripts/serve-chatgpt-gate.ts 4530
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const AI_DESTINATION = /^\/api\/compatibility\?__zodiacs_ai=([a-z0-9-]+)$/;
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2',
};

export interface GateServer {
  baseUrl: string;
  /** True when dist/ exists, so the listing pages can be checked. */
  servesPages: boolean;
  /** Every header name that arrived on an AI route (/mcp and its neighbours), lower case. Names only, never values. */
  receivedHeaderNames(): string[];
  close(): Promise<void>;
}

async function fileAt(base: string, pathname: string): Promise<{ path: string; body: Buffer } | null> {
  const relative = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  if (relative.startsWith('..')) return null;
  for (const candidate of [join(base, relative), join(base, relative, 'index.html')]) {
    try {
      if ((await stat(candidate)).isFile()) return { path: candidate, body: await readFile(candidate) };
    } catch { /* try the next candidate */ }
  }
  return null;
}

export async function startGateServer(port = 0): Promise<GateServer> {
  const vercel = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8')) as { rewrites: { source: string; destination: string }[] };
  // The AI routes exactly as vercel.json sends them: source path to the handler's route value.
  const aiRoutes = new Map<string, string>();
  for (const rewrite of vercel.rewrites) {
    const route = AI_DESTINATION.exec(rewrite.destination)?.[1];
    if (route && !rewrite.source.includes(':')) aiRoutes.set(rewrite.source, route);
  }
  const dist = join(root, 'dist');
  const servesPages = existsSync(join(dist, 'index.html'));
  const routes = await import('../../api/_ai/handler');
  let handle: Awaited<ReturnType<typeof routes.publishedConnector>> | undefined;
  let candidateHandle: Awaited<ReturnType<typeof routes.de440Connector>> | undefined;
  const received = new Set<string>();

  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const route = aiRoutes.get(url.pathname);
      const isCandidate = route === 'de440' || route === 'de440-health';
      const target = isCandidate ? candidateHandle : handle;
      if (route && target) {
        for (const name of Object.keys(req.headers)) received.add(name.toLowerCase());
        // As after Vercel's rewrite: the destination's query first, then the request's own.
        const query = new URLSearchParams(`__zodiacs_ai=${route}`);
        for (const [key, value] of url.searchParams) query.append(key, value);
        const rewritten = req as IncomingMessage & { query?: Record<string, string> };
        rewritten.url = `/api/compatibility?${query}`;
        rewritten.query = Object.fromEntries(query);
        await target(rewritten, res);
        return;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return; }
      const found = (servesPages ? await fileAt(dist, url.pathname) : null) ?? await fileAt(join(root, 'public'), url.pathname);
      if (!found) {
        const missing = servesPages ? await fileAt(dist, '/404.html') : null;
        res.writeHead(404, { 'Content-Type': missing ? TYPES['.html'] : TYPES['.txt'], 'Cache-Control': 'no-store' });
        res.end(req.method === 'HEAD' ? undefined : missing?.body ?? 'Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[extname(found.path)] ?? 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : found.body);
    })().catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); });
  });
  await new Promise<void>(done => server.listen(port, '127.0.0.1', done));
  const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
  const allowed = async () => 'allowed' as const;
  handle = await routes.publishedConnector({
    // Production's switches for the tools it lists today (19): the server, the occasion tools and the 0.6.0 tools.
    env: { ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1' },
    allowedHosts: [host],
    rateLimit: allowed,
    atomicQuota: allowed,
    countUsage: async () => undefined,
  });
  candidateHandle = await routes.de440Connector({
    // Candidate connector with the 7 feature funnels (8 tools, Tarot off) enabled so the gate exercises features-v1.html.
    env: {
      ZODIACS_MCP_ENABLED: '1',
      ZODIACS_OCCASIONS_ENABLED: '1',
      ZODIACS_COVERAGE_ENABLED: '1',
      ZODIACS_YEAR_SCORE_ENABLED: '1',
      ZODIACS_SOLAR_RETURN_ENABLED: '1',
      ZODIACS_NUMEROLOGY_ENABLED: '1',
      ZODIACS_GOOD_DAYS_ENABLED: '1',
      ZODIACS_PERSONAL_TOOLS_ENABLED: '1',
    },
    allowedHosts: [host],
    rateLimit: allowed,
    atomicQuota: allowed,
    countUsage: async () => undefined,
  });
  return {
    baseUrl: `http://${host}`,
    servesPages,
    receivedHeaderNames: () => [...received].sort(),
    close: () => new Promise<void>((done) => { server.closeAllConnections(); server.close(() => done()); }),
  };
}
