/** Explicit, authenticated staging acceptance. Never run against production. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { STUDIO_HTML } from '../integrations/generated/chart-studio.mjs';

const url = new URL(process.env.ZODIACS_STAGING_MCP_URL);
assert.equal(url.protocol, 'https:');
assert.ok(url.hostname.endsWith('.vercel.app'));
assert.equal(url.pathname, '/mcp');
assert.equal(url.search, '');
// A short-lived Vercel share cookie stays outside the repository and evidence.
const jar = await readFile(process.env.ZODIACS_STAGING_COOKIE_FILE, 'utf8');
const cookies = jar.split('\n').filter(line => line && (!line.startsWith('#') || line.startsWith('#HttpOnly_')))
  .map(line => line.replace(/^#HttpOnly_/, '').split('\t'))
  .filter(fields => fields[0].replace(/^\./, '') === url.hostname && fields.length === 7)
  .map(fields => `${fields[5]}=${fields[6]}`).join('; ');
assert.ok(cookies);
const headers = { Cookie: cookies };
const client = new Client({ name: 'zodiacs-staging-review', version: '1' });
const evidence = { schema: 'zodiacs.ai-staging-acceptance.v2', capturedAt: new Date().toISOString(), url: url.href, transport: 'official SDK 2.0.0', checks: [], calls: [] };
const record = (name, detail = {}) => evidence.checks.push({ name, passed: true, ...detail });
const request = async (path, options = {}) => fetch(new URL(path, url), { ...options, headers: { ...headers, ...options.headers }, redirect: 'manual' });
try {
  for (const path of ['/mcp/health', '/mcp/health/']) {
    const response = await request(path);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).ready, true);
    record(`health ${path}`, { status: response.status });
  }
  await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers } }));
  const tools = (await client.listTools()).tools;
  assert.equal(tools.length, 6);
  for (const tool of tools) { assert.equal(tool.outputSchema.type, 'object'); assert.equal(tool.annotations.readOnlyHint, true); }
  record('six read-only tools and output schemas');
  const launcher = tools.find(tool => tool.name === 'open_chart_studio');
  assert.deepEqual(launcher.inputSchema.properties, {});
  assert.equal(launcher.inputSchema.additionalProperties, false);
  assert.equal(launcher._meta.ui.resourceUri, 'ui://zodiacs/chart-studio-v2.html');
  assert.deepEqual(launcher._meta['openai/ui'].entrypoints, [{ type: 'global' }, { type: 'thread' }]);
  record('Chart Studio has empty-only arguments and both native entrypoints');
  const calls = [
    ['get_capabilities', {}],
    ['open_chart_studio', {}],
    ['get_sky', { instant: '2026-10-01T06:00:00Z', zone: 'Asia/Bangkok' }],
    ['get_upcoming_events', {}],
    ['get_upcoming_events', { from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z', zone: 'America/New_York', kinds: ['lunation'] }],
    ['check_sky_fact', { kind: 'ingress', body: 'Sun', sign: 'libra', date: '2026-09-23' }],
    ['search_zodiacs', { query: 'Moon sign' }],
  ];
  for (const [name, args] of calls) {
    const start = performance.now();
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, false); assert.equal(result.structuredContent.ok, true);
    if (name === 'get_capabilities') assert.equal(result.structuredContent.data.version, '0.2.0');
    if (name === 'open_chart_studio') assert.deepEqual(result.structuredContent.data, {
      title: 'Chart Studio', calculation: 'browser-local', initialChart: 'synthetic-example', sharing: 'user-reviewed-selection-only',
    });
    if (name === 'get_sky') assert.equal(result.structuredContent.data.calculation.cite.version, '0.1.1-rc.16');
    evidence.calls.push({ name, arguments: args, elapsedMs: Math.round(performance.now() - start), result: result.structuredContent });
  }
  record('all six tools, native empty-argument launches and bounded lunation window');
  const resource = await client.readResource({ uri: 'ui://zodiacs/sky-events-v1.html' });
  assert.equal(resource.contents[0].mimeType, 'text/html;profile=mcp-app');
  record('native calendar resource');
  const studio = (await client.readResource({ uri: 'ui://zodiacs/chart-studio-v2.html' })).contents[0];
  assert.equal(studio.mimeType, 'text/html;profile=mcp-app');
  assert.equal(studio.text, STUDIO_HTML);
  assert.deepEqual(studio._meta.ui.csp, { connectDomains: [], resourceDomains: [] });
  assert.deepEqual(studio._meta['openai/widgetCSP'], { connect_domains: [], resource_domains: [] });
  assert.equal(studio._meta['openai/ui'].preferredDisplayMode, 'fullscreen');
  record('native Chart Studio resource matches the reviewed self-contained bundle', {
    bytes: Buffer.byteLength(studio.text), sha256: createHash('sha256').update(studio.text).digest('hex'),
  });
  const canary = 'synthetic-staging-private-canary-20261001';
  const refusal = await client.callTool({ name: 'get_sky', arguments: { [canary]: 'not-personal-data' } });
  assert.equal(refusal.isError, true); assert.equal(JSON.stringify(refusal).includes(canary), false);
  record('unknown arguments refuse without echoing synthetic canary');
  const studioRefusal = await client.callTool({ name: 'open_chart_studio', arguments: { birthDate: canary } });
  assert.equal(studioRefusal.isError, true); assert.equal(JSON.stringify(studioRefusal).includes(canary), false);
  record('Chart Studio refuses personal tool arguments without echoing synthetic canary');
  for (const [name, path, options, status] of [
    ['malformed JSON', '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }, 400],
    ['oversized body', '/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: ' '.repeat(16385) }, 413],
    ['disallowed origin', '/mcp', { method: 'POST', headers: { Origin: 'https://example.com' } }, 403],
    ['extra query', '/mcp?extra=synthetic', { method: 'POST' }, 400],
    ['unsupported method', '/mcp', { method: 'GET' }, 405],
  ]) {
    const response = await request(path, options); assert.equal(response.status, status, name);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.text()).includes(canary), false);
    record(name, { status });
  }
  assert.equal((await client.callTool({ name: 'get_capabilities', arguments: {} })).isError, false);
  record('recovery after refusals');
  evidence.scope = 'Observed authenticated HTTPS staging. Timings include network; no cold-start, load-capacity, provider-retention or per-completion billing claim.';
  await writeFile(process.env.ZODIACS_STAGING_EVIDENCE_FILE, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Staging passed: ${evidence.checks.length} checks, ${evidence.calls.length} tool calls. Authentication excluded from evidence.`);
} finally { await client.close(); }
