/**
 * Serves /mcp/engine on this machine for testing, with the switch on and no
 * rate limit: http://127.0.0.1:<port>/mcp/engine (default port 8787).
 *
 *   npx vite-node --script scripts/serve-engine-mcp.ts -- --port 8787
 */
import { createServer } from 'node:http';
import { createEngineNodeHandler } from '../src/engine-mcp/http';

const index = process.argv.indexOf('--port');
const port = index >= 0 ? Number(process.argv[index + 1]) : 8787;
const host = `127.0.0.1:${port}`;
const handle = createEngineNodeHandler({ env: { ZODIACS_ENGINE_MCP_ENABLED: '1' }, rateLimit: async () => 'allowed', allowedHosts: [host] });
createServer((req, res) => {
  if (!req.url?.startsWith('/mcp/engine')) { res.statusCode = 404; res.end(); return; }
  void handle(req, res);
}).listen(port, '127.0.0.1', () => process.stdout.write(`http://${host}/mcp/engine\n`));
