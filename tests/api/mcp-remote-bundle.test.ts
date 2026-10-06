import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createHostedMcpHandler as bundledHandler } from '../../api/_mcp/remote.mjs';
import { createHostedMcpHandler as sourceHandler } from '../../src/mcp/hosted-http';
import { ALLOWED_RUNTIME_IMPORTS, externalImports } from '../../scripts/build-compute-handler.mjs';
import { BUNDLE_PATH, TYPES_PATH, addMcpLifetimeBoundary, buildMcpRemoteBundle } from '../../scripts/build-mcp-remote.mjs';

/*
 * The hosted MCP endpoint runs api/_mcp/remote.mjs, its server bundled with the
 * engine, the MCP SDK and zod, as the compute API runs api/_compute/compute.mjs
 * (FINDINGS F-58 for why the engine is bundled). These tests hold the bundle to
 * its sources, to what it may load at run time, to loading on a Node that does
 * not detect module syntax, to the engine-state lifetime boundary, and to the
 * source transport's answers.
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url));
const NO_DETECTION = ['--no-experimental-detect-module', '--input-type=module', '-e'];

function fakeResponse() {
  const headers: Record<string, string> = {};
  let resolve!: (reply: { status: number; text: string; headers: Record<string, string> }) => void;
  const done = new Promise<{ status: number; text: string; headers: Record<string, string> }>((r) => { resolve = r; });
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader(name: string, value: string) { headers[name.toLowerCase()] = String(value); },
    end(chunk?: string) { this.headersSent = true; resolve({ status: this.statusCode, text: chunk ?? '', headers }); },
  };
  return { res, done };
}

async function post(handler: (req: any, res: any) => Promise<void>, body: unknown) {
  const { res, done } = fakeResponse();
  await handler({
    method: 'POST',
    url: '/api/compatibility?__zodiacs_mcp=1',
    headers: { host: 'zodiacs.org', 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify(body),
  }, res);
  return done;
}

function payload(text: string): unknown {
  const data = text.split('\n').find((line) => line.startsWith('data: '));
  return JSON.parse(data ? data.slice(6) : text);
}

describe("the hosted MCP endpoint's bundle", () => {
  it('is what scripts/build-mcp-remote.mjs builds from its sources', async () => {
    const { bytes, types } = await buildMcpRemoteBundle();
    expect(read(BUNDLE_PATH).equals(bytes), 'stale: run node scripts/build-mcp-remote.mjs').toBe(true);
    expect(read(TYPES_PATH).equals(types), 'stale: run node scripts/build-mcp-remote.mjs').toBe(true);
  }, 120_000);

  it('fails closed when reviewed private-state markers change or another frame is bundled', () => {
    const source = read(BUNDLE_PATH).toString('utf8')
      .split("// Server-only lifetime boundary, the compute API's")[0]
      .replace('export {\n  createStatelessHostedMcpHandler as createHostedMcpHandler\n};', 'export {\n  createHostedMcpHandler\n};');
    expect(() => addMcpLifetimeBoundary(source)).not.toThrow();
    for (const marker of ['var last;', 'var pluto_cache = [];', 'var CalcMoonCount = 0;']) {
      expect(() => addMcpLifetimeBoundary(source.replace(marker, ''))).toThrow(/review cleanup/u);
      expect(() => addMcpLifetimeBoundary(source + '\n' + marker)).toThrow(/review cleanup/u);
    }
    for (const declaration of ['var cache_e_tilt;', 'var sidereal_time_cache;', 'var last2;']) {
      expect(() => addMcpLifetimeBoundary(source + '\n' + declaration)).toThrow(/review private-state cleanup/u);
    }
  });

  it("loads nothing at run time but Node's own modules and the Firewall SDK", () => {
    expect(externalImports(read(BUNDLE_PATH).toString('utf8'))).toEqual(ALLOWED_RUNTIME_IMPORTS);
  });

  it('loads on a Node that does not detect module syntax', () => {
    const bundleUrl = new URL('../../api/_mcp/remote.mjs', import.meta.url).href;
    const result = spawnSync(process.execPath, [
      ...NO_DETECTION,
      `const m = await import(${JSON.stringify(bundleUrl)}); if (typeof m.createHostedMcpHandler !== 'function') process.exit(2);`,
    ], { cwd: ROOT, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
  });

  it('answers as the source transport does, and refuses while switched off', async () => {
    const options = { env: { ZODIACS_SKY_MCP_ENABLED: '1' }, rateLimit: async () => 'allowed' as const, now: () => new Date('2026-10-06T12:00:00Z') };
    const fromBundle = bundledHandler(options);
    const fromSource = sourceHandler(options);
    const requests = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } } },
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_sky', arguments: {} } },
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'find_events', arguments: { from: '2026-10-01T00:00:00Z', to: '2026-10-31T00:00:00Z' } } },
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'check_sky_fact', arguments: { kind: 'ingress', body: 'Sun', sign: 'libra', date: '2026-09-23' } } },
    ];
    for (const request of requests) {
      const bundled = await post(fromBundle, request);
      const source = await post(fromSource, request);
      expect(bundled.status, request.method).toBe(source.status);
      expect(payload(bundled.text), request.method).toEqual(payload(source.text));
    }
    // Twice in a row, so a memo the boundary failed to clear would show as a difference.
    const again = await post(fromBundle, requests[3]);
    expect(payload(again.text)).toEqual(payload((await post(fromSource, requests[3])).text));
    const off = await post(bundledHandler({ env: {}, rateLimit: async () => 'allowed' }), requests[0]);
    expect(off.status).toBe(503);
  });
});
