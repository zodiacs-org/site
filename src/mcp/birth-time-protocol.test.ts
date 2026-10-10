import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { createServer } from './create-server';
import { RESOLVE_BIRTH_OUTPUT } from './birth-time-tools';

async function withClient(run: (client: Client, notes: string[]) => Promise<void>) {
  const notes: string[] = [];
  const server = createServer((message) => notes.push(message));
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'local-birth-protocol-test', version: '1.0.0' });
  await server.connect(serverSide);
  await client.connect(clientSide);
  try { await run(client, notes); }
  finally { await client.close(); await server.close(); }
}

describe('local birth resolution through the real SDK connection', () => {
  it('advertises its actual schema, privacy and read-only boundary', async () => withClient(async (client) => {
    const tool = (await client.listTools()).tools.find((entry) => entry.name === 'resolve_birth_time');
    expect(tool).toBeDefined();
    expect(tool!.inputSchema.additionalProperties).toBe(false);
    expect(tool!.outputSchema?.type).toBe('object');
    expect(tool!.description).toContain('receipt digest identifies');
    expect(tool!.description).toContain('model provider');
    expect(tool!.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
  }));

  it('returns the fixed backzone instant as structured content and the same text', async () => withClient(async (client, notes) => {
    const tool = (await client.listTools()).tools.find((entry) => entry.name === 'resolve_birth_time')!;
    const result = await client.callTool({ name: 'resolve_birth_time', arguments: {
      date: '1947-07-01', time: '12:00', timeZone: 'Europe/Stockholm', latitude: 59.33, longitude: 18.07,
    } });
    expect(result.isError).toBeFalsy();
    const value = RESOLVE_BIRTH_OUTPUT.parse(result.structuredContent);
    expect(value.birth.utc).toBe('1947-07-01T11:00:00.000Z');
    expect(value.resolution.zone).toMatchObject({ source: 'tzdb', dataForm: 'main+backzone', tzdbVersion: '2025c' });
    expect(JSON.parse((result.content as { text: string }[])[0].text)).toEqual(result.structuredContent);
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    const validate = ajv.compile(tool.outputSchema as object);
    expect(validate(result.structuredContent), ajv.errorsText(validate.errors)).toBe(true);
    expect(validate({ ...value, privatePath: '/private/canary' })).toBe(false);
    expect(notes).toEqual([]);
  }));

  it('refuses an unknown zone without echoing it and then serves a valid call', async () => withClient(async (client, notes) => {
    await client.listTools();
    const refusal = await client.callTool({ name: 'resolve_birth_time', arguments: {
      date: '1947-07-01', time: '12:00', timeZone: 'Europe/PrivateCanary',
    } });
    expect(refusal.isError).toBe(true);
    expect(refusal.structuredContent).toBeUndefined();
    expect(JSON.stringify(refusal)).not.toContain('PrivateCanary');
    const next = await client.callTool({ name: 'resolve_birth_time', arguments: { date: '1947-07-01', timeZone: 'Europe/Stockholm' } });
    expect(next.isError).toBeFalsy();
    expect(RESOLVE_BIRTH_OUTPUT.parse(next.structuredContent)).toMatchObject({ birth: { timeKnown: false }, reference: 'local-noon' });
    expect(notes).toEqual([]);
  }));
});
