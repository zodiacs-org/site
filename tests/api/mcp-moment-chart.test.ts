import { afterEach, describe, expect, it, vi } from 'vitest';
import { de440Connector, publishedConnector } from '../../api/_ai/handler';
import { UNDER_13_REFUSAL } from '../../src/ai-tools/contracts';
import { MOMENT_CHART_SWITCH, MOMENT_CHART_TOOL } from '../../src/ai-tools/features/moment-chart-contract';

const now = () => new Date('2026-11-21T15:47:00Z');
const allowed = async () => 'allowed' as const;
const env = { ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1',
  VERCEL_ENV: 'preview', ZODIACS_MCP_MEASURE: '1' };
const options = { rateLimit: allowed, atomicQuota: allowed, dependencies: { now }, waitUntil: () => {} };
type Handler = Awaited<ReturnType<typeof publishedConnector>>;

async function rpc(handler: Handler, url: string, method: string, params: object) {
  const headers = new Headers();
  let text = '';
  const response = { statusCode: 200, setHeader: (key: string, value: string) => headers.set(key, value),
    write: (chunk: string) => { text += chunk; return true; }, end: (chunk = '') => { text += chunk; } };
  await handler({ method: 'POST', url, headers: { host: 'zodiacs.org', 'content-type': 'application/json',
    accept: 'application/json, text/event-stream' }, body: { jsonrpc: '2.0', id: 1, method, params } }, response);
  const json = JSON.parse(text.startsWith('event:') ? text.split('\n').find(line => line.startsWith('data: '))!.slice(6) : text);
  return { status: response.statusCode, headers, json };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe.each([['/mcp', publishedConnector], ['/mcp/de440', de440Connector]] as const)('%s', (route, connect) => {
  it('lists a separate sky chart only when enabled and protects personal requests on the built route', async () => {
    const urls: string[] = [];
    const NativeRequest = Request;
    vi.stubGlobal('Request', class extends NativeRequest {
      constructor(input: RequestInfo | URL, init?: RequestInit) { super(input, init); urls.push(this.url); }
    });
    const outbound = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected outbound request'));
    const logs = (['log', 'info', 'warn', 'error', 'debug'] as const).map(method => vi.spyOn(console, method).mockImplementation(() => {}));
    const counts = vi.fn(async () => {});
    const off = await connect({ ...options, env, countUsage: counts });
    const on = await connect({ ...options, env: { ...env, [MOMENT_CHART_SWITCH]: '1' }, countUsage: counts });
    const list = async (handler: Handler) => (await rpc(handler, route, 'tools/list', {})).json.result.tools;
    const original = await list(off);
    const tools = await list(on);
    expect(tools.slice(0, -1)).toEqual(original);
    expect(tools.at(-1)).toMatchObject({ name: MOMENT_CHART_TOOL, inputSchema: { additionalProperties: false } });
    expect(Object.keys(tools.at(-1).inputSchema.properties).sort()).toEqual(['houseSystem', 'instant', 'latitude', 'longitude']);
    const call = async (handler: Handler, name: string, args: object) => (await rpc(handler, route, 'tools/call', { name, arguments: args })).json;
    const place = { latitude: 13.7563, longitude: 100.5018 };
    const disabled = await call(off, MOMENT_CHART_TOOL, place);
    expect(disabled.error || disabled.result?.isError).toBeTruthy();
    const moment = (await call(on, MOMENT_CHART_TOOL, place)).result;
    expect(moment.structuredContent).toMatchObject({ ok: true, data: { kind: 'moment', instant: now().toISOString() } });
    expect(moment.structuredContent.data.positions).toHaveLength(12);
    expect(moment.structuredContent.data.houses.cusps).toHaveLength(12);
    const input = { birthDate: '2024-11-21', time: '06:37', zone: 'Asia/Bangkok', ...place };
    const refused = (await call(on, 'get_natal_chart', input)).result;
    expect(refused.structuredContent.error).toEqual({ code: 'invalid-request', message: UNDER_13_REFUSAL });
    const invalid = (await call(on, MOMENT_CHART_TOOL, { ...input, name: 'Private Example' })).result;
    expect(invalid.isError).toBe(true);
    const adult = (await call(on, 'get_natal_chart', { ...input, birthDate: '1990-04-18' })).result;
    expect(adult.structuredContent.ok).toBe(true);
    const links = JSON.stringify([adult, moment]).match(/https?:[^"\s]+/g) ?? [];
    expect(links.length).toBeGreaterThan(0);
    expect(urls.length).toBeGreaterThan(0);
    expect(logs.some(log => log.mock.calls.length > 0)).toBe(true);
    const observed = decodeURIComponent(JSON.stringify([urls, links, logs.map(log => log.mock.calls), counts.mock.calls, refused, invalid]));
    expect(observed).not.toMatch(/2024-11-21|1990-04-18|06:37|Asia.Bangkok|13\.7563|100\.5018|Private Example/u);
    expect(outbound).not.toHaveBeenCalled();
    const query = await rpc(on, route + '?birthDate=private', 'tools/list', {});
    expect(query.status).toBe(400);
    expect(query.headers.get('cache-control')).toBe('no-store');
  }, 20_000);
});
