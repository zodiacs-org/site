/** Optional independent check with the SDK version referenced by OpenAI extensions. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createAiNodeHandler } from '../api/_ai/runtime.mjs';

const sdkRoot = resolve(process.argv[2] ?? '.');
const sdk = JSON.parse(await readFile(resolve(sdkRoot, 'package.json'), 'utf8'));
assert.equal(sdk.name, '@modelcontextprotocol/sdk'); assert.equal(sdk.version, '1.29.0');
const { Client } = await import(pathToFileURL(resolve(sdkRoot, 'dist/esm/client/index.js')).href);
const { StreamableHTTPClientTransport } = await import(pathToFileURL(resolve(sdkRoot, 'dist/esm/client/streamableHttp.js')).href);
let host;
const server = createServer((req, res) => createAiNodeHandler({ env: { ZODIACS_MCP_ENABLED: '1' }, allowedHosts: [host], rateLimit: async () => 'allowed' })(req, res));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
host = `127.0.0.1:${server.address().port}`;
const client = new Client({ name: 'zodiacs-legacy-sdk-review', version: '1' });
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://${host}/mcp`)));
  const tools = await client.listTools(); assert.equal(tools.tools.length, 5);
  for (const tool of tools.tools) assert.equal(tool.outputSchema.type, 'object');
  const calls = [
    ['get_capabilities', {}],
    ['get_sky', { instant: '2026-10-01T06:00:00Z', zone: 'Asia/Bangkok' }],
    ['get_upcoming_events', {}],
    ['check_sky_fact', { kind: 'ingress', body: 'Sun', sign: 'libra', date: '2026-09-23' }],
    ['search_zodiacs', { query: 'Moon sign' }],
  ];
  for (const [name, args] of calls) {
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, false); assert.equal(result.structuredContent.tool, name); assert.equal(result.structuredContent.ok, true);
  }
  const resource = await client.readResource({ uri: 'ui://zodiacs/sky-events-v1.html' });
  assert.equal(resource.contents[0].mimeType, 'text/html;profile=mcp-app');
  console.log('Official legacy SDK 1.29.0: discovery, five tools, native calendar launch and UI resource passed.');
} finally { await client.close(); await new Promise(resolve => server.close(resolve)); }
