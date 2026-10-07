import { describe, expect, it } from 'vitest';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { registerHoroscopePreview } from './register';
import { HOROSCOPE_URI } from './reading';

async function withClient(run: (client: Client) => Promise<void>) {
  const server = new McpServer({ name: 'horoscope-test', version: '0.1.0' });
  registerHoroscopePreview(server, () => new Date('2026-10-07T01:00:00Z'));
  const client = new Client({ name: 'horoscope-client', version: '0.1.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try { await run(client); } finally { await client.close(); await server.close(); }
}
describe('horoscope MCP registration', () => {
  it('exposes one read-only operation and a self-contained interactive resource', () => withClient(async client => {
    const result = await client.listTools();
    expect(result.tools.map(tool => tool.name)).toEqual(['get_horoscope']);
    expect(result.tools[0].annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    expect(result.tools[0]._meta?.['openai/outputTemplate']).toBe(HOROSCOPE_URI);
    const resource = await client.readResource({ uri: HOROSCOPE_URI });
    expect(resource.contents[0].mimeType).toBe('text/html;profile=mcp-app');
    const html = resource.contents[0].text as string;
    expect(html).toContain('New York');
    expect(html).not.toMatch(/<(?:script|link)[^>]*(?:src|href)=["']https?:/);
  }));
  it('carries date, timezone, coverage and evidence through the protocol', () => withClient(async client => {
    const read = await client.callTool({ name: 'get_horoscope', arguments: { sign: 'libra', period: 'week' } });
    expect(read.isError).toBe(false);
    expect(read.structuredContent).toMatchObject({ status: 'available', editionDate: '2026-10-06', request: { zone: 'America/New_York' }, reading: { period: { from: '2026-10-05', through: '2026-10-11' } } });
    const unavailable = await client.callTool({ name: 'get_horoscope', arguments: { sign: 'aries', date: '2026-10-20' } });
    expect(unavailable.structuredContent).toMatchObject({ status: 'unavailable' });
    expect(unavailable.structuredContent).not.toHaveProperty('reading');
  }));
});
