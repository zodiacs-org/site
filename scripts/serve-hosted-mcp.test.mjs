import { afterAll, describe, expect, it } from 'vitest';
import { reviewEnv, reviewTarget, serveHostedMcp } from './serve-hosted-mcp.mjs';

const servers = [];
afterAll(async () => { await Promise.all(servers.map((server) => new Promise((done) => server.close(done)))); });

async function rpc(host, path, method, params = {}) {
  const response = await fetch(`http://${host}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const text = await response.text();
  const line = text.includes('data: ') ? text.split('\n').find((entry) => entry.startsWith('data: ')).slice(6) : text;
  return { status: response.status, result: JSON.parse(line).result };
}

async function toolNames(candidate, path) {
  const { server, host } = await serveHostedMcp({ port: 0, candidate, shell: { ZODIACS_COVERAGE_ENABLED: '1', ZODIACS_TAROT_ENABLED: '1' } });
  servers.push(server);
  const { status, result } = await rpc(host, path, 'tools/list');
  return { status, names: (result?.tools ?? []).map((tool) => tool.name) };
}

describe('the hosted MCP review server', () => {
  it('reads the port, the runtime and the path from the command line', () => {
    expect(reviewTarget(['4521'])).toEqual({ port: 4521, candidate: false, path: '/mcp' });
    expect(reviewTarget(['4600', '--candidate'])).toEqual({ port: 4600, candidate: true, path: '/mcp/de440' });
    expect(reviewTarget(['--candidate'])).toEqual({ port: 4521, candidate: true, path: '/mcp/de440' });
  });

  it('passes on only the switches the shell sets to exactly 1', () => {
    expect(reviewEnv({ ZODIACS_TAROT_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: 'true', ZODIACS_ACCOUNTS_ENABLED: '1' })).toEqual({ ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_TAROT_ENABLED: '1' });
    // The website's tarot page switch, so the review server can show the page link.
    expect(reviewEnv({ ZODIACS_TAROT_ENABLED: '1', PUBLIC_TAROT_ENABLED: '1' })).toEqual({ ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_TAROT_ENABLED: '1', PUBLIC_TAROT_ENABLED: '1' });
    for (const page of ['0', '', 'true', ' 1', undefined]) expect(reviewEnv({ ZODIACS_TAROT_ENABLED: '1', PUBLIC_TAROT_ENABLED: page })).not.toHaveProperty('PUBLIC_TAROT_ENABLED');
  });

  it('links the tarot page from draw_tarot and the tarot pointer only with PUBLIC_TAROT_ENABLED=1 in the shell', async () => {
    const tarotUrls = (result) => (JSON.stringify(result.structuredContent).match(/https:\/\/[^"]+/gu) ?? []).filter((url) => url.includes('/tarot/'));
    for (const page of [undefined, '1']) {
      const shell = { ZODIACS_COVERAGE_ENABLED: '1', ZODIACS_TAROT_ENABLED: '1', ...(page ? { PUBLIC_TAROT_ENABLED: page } : {}) };
      const { server, host } = await serveHostedMcp({ port: 0, candidate: true, shell });
      servers.push(server);
      const listed = await rpc(host, '/mcp/de440', 'tools/list');
      expect(listed.result.tools.map((tool) => tool.name), String(page)).toContain('draw_tarot');
      const drawn = await rpc(host, '/mcp/de440', 'tools/call', { name: 'draw_tarot', arguments: { spread: 'three-card' } });
      expect(drawn.result.structuredContent.ok, String(page)).toBe(true);
      const pointer = await rpc(host, '/mcp/de440', 'tools/call', { name: 'explain_astrology', arguments: { topic: 'tarot' } });
      if (page) {
        expect(drawn.result.structuredContent.links.map((link) => link.url)).toEqual(['https://zodiacs.org/tarot/?ref=assistant']);
        expect(pointer.result.structuredContent.links.map((link) => link.url)).toEqual(['https://zodiacs.org/tarot/?ref=assistant']);
      } else {
        expect(drawn.result.structuredContent.links).toEqual([]);
        expect(tarotUrls(drawn.result)).toEqual([]);
        expect(pointer.result.structuredContent.links).toEqual([]);
        expect(tarotUrls(pointer.result)).toEqual([]);
      }
    }
  }, 60_000);

  it('lists draw_tarot on the candidate at /mcp/de440, and not on the frozen published runtime at /mcp', async () => {
    const candidate = await toolNames(true, '/mcp/de440');
    expect(candidate.status).toBe(200);
    expect(candidate.names).toContain('draw_tarot');
    const published = await toolNames(false, '/mcp');
    expect(published.status).toBe(200);
    expect(published.names.length).toBeGreaterThan(0);
    expect(published.names).not.toContain('draw_tarot');
  }, 60_000);
});
