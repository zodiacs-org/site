// Writes the initialize result and tools/list of this branch's server, switched on as production runs it.
// Run: npx vite-node --script docs/platform/evidence/assistant-tryouts-20261113/tools/dump-branch-tools.ts <out-dir>
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { createAiNodeHandler } from '../../../../../src/ai-tools/http';
import committedWindow from '../../../../../src/data/horoscope-window.json';
import committedMonths from '../../../../../src/data/horoscope-months.json';
import committedProgram from '../../../../../src/data/horoscope-program.json';

const out = process.argv.at(-1)!;
const allowedHosts: string[] = [];
const handle = createAiNodeHandler({ env: { ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1' }, allowedHosts, rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed',
  countUsage: async () => undefined, dependencies: { horoscopeWindow: async () => committedWindow as never, horoscopeMonths: async () => committedMonths, horoscopeProgram: async () => committedProgram as never } });
const server = createServer((req, res) => { void handle(req, res); });
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
allowedHosts.push(host);
async function rpc(method: string, params: unknown) {
  const response = await fetch(`http://${host}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const text = await response.text();
  return JSON.parse(response.headers.get('content-type')?.includes('text/event-stream') ? text.split('\n').find(line => line.startsWith('data: '))!.slice(6) : text);
}
const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'assistant-tryouts', version: '1' } });
const tools = await rpc('tools/list', {});
writeFileSync(`${out}/initialize.json`, JSON.stringify(init.result, null, 1) + '\n');
writeFileSync(`${out}/tools-list.json`, JSON.stringify(tools.result, null, 1) + '\n');
console.log(init.result.serverInfo, tools.result.tools.length);
server.close();
