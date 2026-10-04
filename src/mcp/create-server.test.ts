/**
 * The catch in `guard`, which no valid or invalid request reaches: a handler
 * that throws for a reason nobody foresaw. The call becomes a refusal on its
 * own, the note names the error's class and never its message, which may quote
 * an argument, and the session goes on serving the next request.
 */
import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { createServer } from './create-server';

vi.mock('./tools', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./tools')>();
  return {
    ...actual,
    calculateNatalChart: () => {
      // A synthetic chart's details, quoted in the message as an unknown throw might.
      throw new SyntaxError('could not read 1990-06-15T13:30:00Z at 51.5074, -0.1278');
    },
  };
});

describe('a tool handler that throws', async () => {
  const notes: string[] = [];
  const server = createServer((message) => notes.push(message));
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await server.connect(serverSide);
  const client = new Client({ name: 'zodiacs-guard-test', version: '1.0.0' });
  await client.connect(clientSide);
  await client.listTools();

  it('answers that call with a fixed refusal, notes only the error class, and serves the next request', async () => {
    const failed = await client.callTool({
      name: 'calculate_natal_chart', arguments: { utc: '1990-06-15T13:30:00Z', latitude: 51.5074, longitude: -0.1278 },
    });
    expect(failed.isError).toBe(true);
    expect(failed.content).toEqual([{
      type: 'text', text: 'The adapter could not complete this call. The connection is still open and the next request is unaffected.',
    }]);
    expect(notes).toEqual(['a tool handler failed with SyntaxError']);
    expect(JSON.stringify(failed)).not.toContain('51.5074');

    const next = await client.callTool({ name: 'get_capabilities', arguments: {} });
    expect(next.isError).toBeFalsy();
    expect((next.structuredContent as { adapter: { name: string } }).adapter.name).toBe('zodiacs-mcp-server');
    expect(notes).toHaveLength(1);
  });
});
