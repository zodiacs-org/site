/** Developer companion: public-sky tools plus the existing local chart tools.
 * Stdio only. No listener, outbound requests, persistence or argument logging.
 */
import { Transform } from 'node:stream';
import { StdioServerTransport, serveStdio } from '@modelcontextprotocol/server/stdio';
import * as localTime from '../../api/_compute/local-time.mjs';
import { LIMITS } from '../mcp/bounds';
import { CAPABILITIES_INPUT, COMPARE_INPUT, NATAL_INPUT, PRIVACY, calculateNatalChart, compareCalculationRecords, describeCapabilities, type ToolOutcome } from '../mcp/tools';
import { AI_VERSION, READ_ONLY } from './contracts';
import { BACKEND } from '../lib/compute-api/receipt';
import { createAiServer } from './server';
import { sanitizeProtocolMessage } from './sanitize';

function respond(run: () => ToolOutcome) {
  try {
    const result = run();
    return result.ok ? { content: [{ type: 'text' as const, text: JSON.stringify(result.value) }], structuredContent: result.value }
      : { isError: true, content: [{ type: 'text' as const, text: result.refusal }] };
  } catch {
    return { isError: true, content: [{ type: 'text' as const, text: 'The local calculation could not complete. No partial result is returned.' }] };
  }
}

function build() {
  const server = createAiServer({ localTime });
  server.registerTool('get_local_chart_capabilities', { description: `Local natal and comparison conventions, bounds and privacy. ${PRIVACY.assistant}`, inputSchema: CAPABILITIES_INPUT, annotations: READ_ONLY }, () => respond(() => {
    const outcome = describeCapabilities();
    return outcome.ok ? { ok: true, value: { ...outcome.value, adapter: { name: 'zodiacs-developer', version: AI_VERSION, releaseStatus: 'unpublished-candidate', transport: 'stdio' }, engine: { name: '@zodiacs/engine', version: BACKEND.version, releaseStatus: 'published' } } } : outcome;
  }));
  server.registerTool('calculate_natal_chart', { description: `Calculate one natal chart locally; request output: record for an exportable receipt. Do not invent a birth time or place. ${PRIVACY.assistant}`, inputSchema: NATAL_INPUT, annotations: READ_ONLY }, args => respond(() => calculateNatalChart(args)));
  server.registerTool('compare_calculation_records', { description: `Compare two record strings locally. Pass the record field from calculate_natal_chart with output: record. Do not pass paths or URLs. Preserve evidence levels. ${PRIVACY.assistant}`, inputSchema: COMPARE_INPUT, annotations: READ_ONLY }, args => respond(() => compareCalculationRecords(args)));
  return server;
}

// Hold complete lines; discard oversized input and recover at the next newline.
let pending: Buffer[] = [], size = 0, dropping = false;
const gate = new Transform({ transform(chunk: Buffer, _encoding, done) {
  let start = 0;
  while (start < chunk.length) {
    const newline = chunk.indexOf(10, start);
    const end = newline < 0 ? chunk.length : newline + 1;
    const part = chunk.subarray(start, end); start = end;
    if (dropping) { if (newline >= 0) dropping = false; continue; }
    if (size + part.length > LIMITS.requestBytes) { pending = []; size = 0; dropping = newline < 0; continue; }
    pending.push(part); size += part.length;
    if (newline >= 0) { this.push(Buffer.concat(pending, size)); pending = []; size = 0; }
  }
  done();
}, flush(done) { if (size) this.push(Buffer.concat(pending, size)); done(); } });
process.stdin.pipe(gate);
let output = '';
const safeOutput = new Transform({ transform(chunk, _encoding, done) {
  output += chunk.toString('utf8');
  let newline: number;
  while ((newline = output.indexOf('\n')) >= 0) {
    const line = output.slice(0, newline); output = output.slice(newline + 1);
    try { this.push(JSON.stringify(sanitizeProtocolMessage(JSON.parse(line))) + '\n'); }
    catch { /* Never send non-protocol diagnostics on stdout. */ }
  }
  done();
} });
safeOutput.pipe(process.stdout);
const handle = serveStdio(build, { transport: new StdioServerTransport(gate, safeOutput, { maxBufferSize: LIMITS.requestBytes + 4096 }), onerror: () => {} });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void handle.close().then(() => process.exit(0), () => process.exit(1)); });
