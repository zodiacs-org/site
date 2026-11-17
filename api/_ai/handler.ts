// The underscore directory adds no Vercel function. /mcp rewrites through compatibility.
import { waitUntil } from '@vercel/functions';
import { createAiNodeHandler } from './runtime.mjs';

// The daily publication commits the horoscope window; it is read when a horoscope is asked for, so the bundle stays the same every day.
const horoscopeWindow = async () => (await import('../../src/data/horoscope-window.json', { with: { type: 'json' } })).default;
// The monthly and yearly readings get_horoscope_period gives, read the same way: a month written or a daily program
// committed leaves the bundle unchanged.
const horoscopeMonths = async () => (await import('../../src/data/horoscope-months.json', { with: { type: 'json' } })).default;
const horoscopeProgram = async () => (await import('../../src/data/horoscope-program.json', { with: { type: 'json' } })).default;

// The account consent page is read only when it is asked for, which happens only while ZODIACS_ACCOUNTS_ENABLED=1.
const consentPage = async () => import('../../integrations/generated/accounts-consent.mjs');
// The place index is read the same way, so its city names stay out of the shared runtime.
const placeTable = async () => (await import('../../src/ai-tools/features/place-table.js')).loadPlaceTable();

const dependencies = { horoscopeWindow, horoscopeMonths, horoscopeProgram, placeTable };

// waitUntil lets the anonymous daily usage count, started after each reply has ended, finish in the same invocation.
export default createAiNodeHandler({ dependencies, waitUntil, consentPage });

const WARM_UP_CALLS = [
  { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'zodiacs-warm-up', version: '1' } } },
  { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
] as const;

/**
 * Runs initialize and tools/list once inside this instance, before any caller's request, so a new instance answers
 * its first real request at the speed of later ones: the first pass through the protocol code and the tool schemas
 * costs several times what later passes cost. Nothing leaves the instance: the address limit, the service budget
 * and the usage count are stand-ins that allow and count nothing, no request reaches the Firewall or the database,
 * and the replies go nowhere; only their status codes come back, so a test can tell a warm-up from one that did nothing. It changes no answer: the handler it warms is built the same way, per request, either way.
 */
export async function warmUp(): Promise<number[]> {
  const handle = createAiNodeHandler({
    dependencies,
    consentPage,
    rateLimit: async () => 'allowed',
    atomicQuota: async () => 'allowed',
    countUsage: async () => undefined,
  });
  const statuses: number[] = [];
  for (const call of WARM_UP_CALLS) {
    const res = { statusCode: 200, headersSent: false, setHeader() {}, getHeader() { return undefined; }, write() { return true; }, end() { this.headersSent = true; } };
    await handle({
      method: 'POST',
      url: '/mcp',
      query: {},
      headers: { host: 'zodiacs.org', 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify(call),
    }, res);
    statuses.push(res.statusCode);
  }
  return statuses;
}
