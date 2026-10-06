/**
 * The hosted server's tools, driven through the SDK's own client in one
 * process: the five public-sky tools and nothing else, honest annotations,
 * every result inside its output schema, and the same calculation, result,
 * receipt and cite as the local adapter's tool for the same arguments.
 */
import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport, type McpServer } from '@modelcontextprotocol/server';
import { receiptDigest } from '../lib/receipt-digest';
import { createServer } from './create-server';
import {
  EVENTS_LIMIT_REFUSAL, HOSTED_CAPABILITIES_OUTPUT, HOSTED_TOOL_NAMES, LOCAL_ONLY_TOOLS, createHostedServer,
  type HostedDependencies,
} from './hosted-server';
import { EVENTS_OUTPUT, POSITIONS_OUTPUT, SKY_FACT_OUTPUT } from './outputs';

async function connect(server: McpServer): Promise<Client> {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'zodiacs-hosted-test', version: '1.0.0' });
  await client.connect(clientSide);
  return client;
}

const NOW = new Date('2026-10-06T12:34:56.000Z');

async function hosted(dependencies: HostedDependencies = {}) {
  return connect(createHostedServer({ now: () => NOW, ...dependencies }));
}

const POSITIONS_ARGS = { instants: ['2000-01-01T12:00:00Z', '1990-06-15T14:30:00+02:00'] };
const EVENTS_ARGS = { from: '2026-10-01T00:00:00Z', to: '2026-10-31T00:00:00Z' };
const FACT_ARGS = { kind: 'sign', body: 'Sun', sign: 'libra', instant: '2026-10-06T12:00:00Z' };

describe('the hosted MCP server', () => {
  it('offers the five public-sky tools, and neither tool that takes birth details or records', async () => {
    const client = await hosted();
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([...HOSTED_TOOL_NAMES].sort());
    for (const local of LOCAL_ONLY_TOOLS) expect(tools.map((tool) => tool.name)).not.toContain(local);
  });

  it('gives every tool a title, an output schema and honest read-only hints', async () => {
    const client = await hosted();
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.outputSchema, tool.name).toBeTruthy();
      expect(tool.annotations, tool.name).toEqual({
        readOnlyHint: true, destructiveHint: false, openWorldHint: false,
        // get_sky without an instant answers for the moment it is asked.
        idempotentHint: tool.name !== 'get_sky',
      });
    }
  });

  it('never says a calculation runs on the caller\'s machine', async () => {
    const client = await hosted();
    const { tools } = await client.listTools();
    const text = JSON.stringify(tools);
    for (const phrase of ['this machine', 'on the machine', 'computed locally', 'no network']) expect(text).not.toContain(phrase);
  });

  it('describes itself within its output schema, with a cite of its own receipt', async () => {
    const client = await hosted();
    const result = await client.callTool({ name: 'get_capabilities', arguments: {} });
    expect(result.isError).toBeFalsy();
    const value = HOSTED_CAPABILITIES_OUTPUT.parse(result.structuredContent);
    expect(value.tools).toEqual([...HOSTED_TOOL_NAMES]);
    expect(value.localOnly.tools).toEqual([...LOCAL_ONLY_TOOLS]);
    expect(value.cite.receipt).toBe(receiptDigest(value.receipt));
  });

  it('answers get_positions, find_events and check_sky_fact exactly as the local adapter does', async () => {
    const remote = await hosted();
    const local = await connect(createServer(() => {}));
    for (const [name, args, schema] of [
      ['get_positions', POSITIONS_ARGS, POSITIONS_OUTPUT],
      ['find_events', EVENTS_ARGS, EVENTS_OUTPUT],
      ['check_sky_fact', FACT_ARGS, SKY_FACT_OUTPUT],
    ] as const) {
      const fromRemote = await remote.callTool({ name, arguments: args });
      const fromLocal = await local.callTool({ name, arguments: args });
      expect(fromRemote.isError, name).toBeFalsy();
      expect(schema.parse(fromRemote.structuredContent), name).toBeTruthy();
      expect(fromRemote.structuredContent, name).toEqual(fromLocal.structuredContent);
    }
  });

  it('answers get_sky as get_positions for one instant, by default the current time of the server', async () => {
    const client = await hosted();
    const now = await client.callTool({ name: 'get_sky', arguments: {} });
    const same = await client.callTool({ name: 'get_positions', arguments: { instants: [NOW.toISOString()] } });
    expect(now.isError).toBeFalsy();
    expect(POSITIONS_OUTPUT.parse(now.structuredContent)).toBeTruthy();
    expect(now.structuredContent).toEqual(same.structuredContent);
    const at = await client.callTool({ name: 'get_sky', arguments: { instant: '2000-01-01T12:00:00Z', bodies: ['Sun', 'Moon'] } });
    const atSame = await client.callTool({ name: 'get_positions', arguments: { instants: ['2000-01-01T12:00:00Z'], bodies: ['Sun', 'Moon'] } });
    expect(at.structuredContent).toEqual(atSame.structuredContent);
  });

  it('counts find_events under the events limit and refuses it, in a fixed sentence, when that limit says no', async () => {
    for (const verdict of ['limited', 'unavailable'] as const) {
      let asked = 0;
      const client = await hosted({ allowEvents: async () => { asked += 1; return verdict; } });
      const result = await client.callTool({ name: 'find_events', arguments: EVENTS_ARGS });
      expect(asked).toBe(1);
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([{ type: 'text', text: EVENTS_LIMIT_REFUSAL[verdict] }]);
      // The other tools do not consult the events limit.
      await client.callTool({ name: 'get_positions', arguments: POSITIONS_ARGS });
      expect(asked).toBe(1);
    }
  });

  it('refuses a request it cannot read without quoting it', async () => {
    const client = await hosted();
    const result = await client.callTool({ name: 'get_positions', arguments: { instants: ['1990-06-15T14:30:00'] } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).not.toContain('1990-06-15');
  });
});
