// The underscore directory adds no Vercel function. /mcp rewrites through compatibility.
import { waitUntil } from '@vercel/functions';
import type { AiHttpOptions } from './runtime.mjs';

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
const publishedDependencies = {
  ...dependencies,
  horoscopeWindow: async () => {
    const current = await horoscopeWindow();
    const published = (await import('./published/horoscope-window.json', { with: { type: 'json' } })).default;
    return current.generatedFor === published.generatedFor ? published : current;
  },
  horoscopeProgram: async () => {
    const current = await horoscopeProgram();
    const published = (await import('./published/horoscope-program.json', { with: { type: 'json' } })).default;
    return current.anchorDate === published.anchorDate ? published : current;
  },
};

export function publishedConnector(options: AiHttpOptions = {}) {
  return import('./published/runtime.mjs').then(({ createAiNodeHandler }) =>
    createAiNodeHandler({ dependencies: publishedDependencies, waitUntil, consentPage, ...options }));
}

export function de440Connector(options: AiHttpOptions = {}) {
  return import('./runtime.mjs').then(({ createAiNodeHandler }) =>
    createAiNodeHandler({ dependencies, waitUntil, consentPage, ...options, de440: true }));
}

let publishedHandler: ReturnType<typeof publishedConnector> | undefined;
let de440Handler: ReturnType<typeof de440Connector> | undefined;

export default async function published(req: any, res: any) {
  await (await (publishedHandler ??= publishedConnector()))(req, res);
}

export async function de440(req: any, res: any) {
  await (await (de440Handler ??= de440Connector()))(req, res);
}

/**
 * The route values vercel.json gives the DE440 connector: de440 for /mcp/de440 and de440-health for its status
 * check, /mcp/de440/health. Every other value, /mcp's and /mcp/health's among them, reaches the published connector.
 */
export const DE440_ROUTES: readonly string[] = ['de440', 'de440-health'];

type NodeHandler = (req: any, res: any) => Promise<void>;

/** Sends a request to the connector for the __zodiacs_ai value its vercel.json rewrite gave it. */
export function aiRouter(connectors: { published: NodeHandler; de440: NodeHandler }): NodeHandler {
  return (req, res) => (DE440_ROUTES.includes(req.query?.__zodiacs_ai) ? connectors.de440 : connectors.published)(req, res);
}

/** What api/compatibility.ts runs for every request vercel.json rewrites with __zodiacs_ai. */
export const route = aiRouter({ published, de440 });

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
  const handle = await publishedConnector({
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
