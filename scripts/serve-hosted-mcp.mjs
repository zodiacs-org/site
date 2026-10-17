#!/usr/bin/env node
/**
 * Serves the hosted MCP runtime (api/_ai/runtime.mjs, the bundle production runs) on 127.0.0.1 with production's
 * switches: the server on and the occasion tools on, accounts off. Rate limits, quotas and usage counting are
 * stand-ins that allow every call. For reviewing a change before it is deployed:
 *
 *   node scripts/serve-hosted-mcp.mjs 4521   # then review http://127.0.0.1:4521/mcp
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createAiNodeHandler } from '../api/_ai/runtime.mjs';

const port = Number(process.argv[2] ?? 4521);
const host = `127.0.0.1:${port}`;
const horoscopeWindow = JSON.parse(await readFile(new URL('../src/data/horoscope-window.json', import.meta.url), 'utf8'));
const handle = createAiNodeHandler({
  env: { ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1' },
  allowedHosts: [host],
  rateLimit: async () => 'allowed',
  atomicQuota: async () => 'allowed',
  countUsage: async () => undefined,
  dependencies: { horoscopeWindow: async () => horoscopeWindow },
});
createServer((request, response) => { void handle(request, response); })
  .listen(port, '127.0.0.1', () => console.log(`serving http://${host}/mcp`));
