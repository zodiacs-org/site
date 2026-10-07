import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';

const root = new URL('../', import.meta.url);
const plugin = process.env.ZODIACS_PLUGIN_REVIEW_DIR ? pathToFileURL(resolve(process.env.ZODIACS_PLUGIN_REVIEW_DIR) + sep) : new URL('plugins/zodiacs-developer/', root);
const manifest = JSON.parse(await readFile(new URL('.codex-plugin/plugin.json', plugin), 'utf8'));
const config = JSON.parse(await readFile(new URL('.mcp.json', plugin), 'utf8'));
assert.equal(manifest.name, 'zodiacs-developer');
assert.equal(manifest.mcpServers, './.mcp.json');
for (const skill of ['build-with-zodiacs', 'verify-astrology-output', 'test-astrology-integration']) {
  const text = await readFile(new URL(`skills/${skill}/SKILL.md`, plugin), 'utf8'); assert.ok(text.includes(`name: ${skill}`));
}
const server = config.mcpServers['zodiacs-developer'];
assert.deepEqual(server, { cwd: '.', command: 'node', args: ['./mcp/server.mjs'] });
const portable = JSON.parse(await readFile(new URL('plugin.json', plugin), 'utf8'));
assert.equal(portable.name, manifest.name);
const portableConfig = JSON.parse(await readFile(new URL('mcp.json', plugin), 'utf8')).mcpServers['zodiacs-developer'];
assert.deepEqual(portableConfig, { type: 'stdio', command: 'node', cwd: './', args: ['${PLUGIN_ROOT}/mcp/server.mjs'] });
const transport = new StdioClientTransport({ command: process.execPath, args: portableConfig.args.map(arg => arg.replace('${PLUGIN_ROOT}', fileURLToPath(plugin).replace(/\/$/, ''))), cwd: fileURLToPath(plugin), stderr: 'pipe' });
const client = new Client({ name: 'zodiacs-plugin-review', version: '1.0.0' });
await client.connect(transport);
let stderr = ''; transport.stderr?.on('data', data => { stderr += data; });
try {
  const tools = await client.listTools(); assert.equal(tools.tools.length, 8);
  assert.ok(!tools.tools.some(tool => tool.name === 'get_horoscope' || tool.name === 'search_zodiacs'), 'The local server offers no horoscopes and no catalogue search');
  for (const tool of tools.tools) assert.equal(tool.annotations.readOnlyHint, true);
  const call = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args }); assert.equal(result.isError ?? false, false, `${name}: ${JSON.stringify(result)}`); return result.structuredContent;
  };
  const studio = await call('open_chart_studio'); assert.equal(studio.data.calculation, 'browser-local');
  const panel = await client.readResource({ uri: 'ui://zodiacs/chart-studio-v2.html' });
  assert.equal(panel.contents[0].mimeType, 'text/html;profile=mcp-app');
  assert.ok(panel.contents[0].text.includes('Chart Studio'));
  assert.ok(panel.contents[0].text.length > 100_000);
  await call('get_capabilities'); const local = await call('get_local_chart_capabilities'); assert.equal(local.engine.releaseStatus, 'published');
  const sky = await call('get_sky', { instant: '2026-10-01T06:00:00Z' }); assert.equal(sky.data.calculation.cite.version, '0.1.1-rc.17');
  await call('get_upcoming_events', { from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z', kinds: ['lunation'] });
  const opened = await call('get_upcoming_events'); assert.equal(opened.data.zone, 'UTC');
  await call('check_sky_fact', { kind: 'retrograde', body: 'Mercury', instant: '2026-10-01T00:00:00Z' });
  const natal = await call('calculate_natal_chart', { utc: '1990-06-15T12:00:00Z', timeKnown: false, reference: 'utc-noon', output: 'record' });
  const comparison = await call('compare_calculation_records', { left: natal.record, right: natal.record }); assert.equal(comparison.identical, true);
  const refusal = await client.callTool({ name: 'get_sky', arguments: { 'private-canary-1985': 'secret' } });
  assert.equal(refusal.isError, true); assert.ok(!JSON.stringify(refusal).includes('private-canary'));
  await call('get_capabilities');
  assert.ok(!stderr.includes('private-canary'));
  console.log('Developer bundle: manifest, three skills, eight MCP tools, synthetic record comparison and privacy recovery passed.');
} finally { await client.close(); }
