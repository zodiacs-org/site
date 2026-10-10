/**
 * The catch in `guard` and `guardAsync`, which no valid or invalid request
 * reaches: a handler that throws, or a promise that rejects, for a reason
 * nobody foresaw. The call becomes a refusal on its own, the note names the
 * error's class and never its message, which may quote an argument, and the
 * session goes on serving the next request. A sky tool turns only the compute
 * API's own refusals into its answer; any other throw from the compute API's
 * calculations goes to the same guard.
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

vi.mock('../lib/compute-api/endpoints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/compute-api/endpoints')>();
  return {
    ...actual,
    computePositions: () => {
      throw new TypeError('could not read 1990-06-15T13:30:00Z');
    },
    computeSkyFact: async () => {
      throw new RangeError('could not read 1990-06-15');
    },
  };
});

vi.mock('./birth-time-tools', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./birth-time-tools')>();
  return {
    ...actual,
    resolveBirthTime: async () => { throw new SyntaxError('private local time 1947-07-01 12:00 Europe/Stockholm'); },
  };
});

const FIXED = 'The adapter could not complete this call. The connection is still open and the next request is unaffected.';

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

  it('does the same for a sky tool whose calculation throws, and for one whose calculation rejects', async () => {
    notes.length = 0;
    const thrown = await client.callTool({ name: 'get_positions', arguments: { instants: ['1990-06-15T13:30:00Z'] } });
    expect(thrown.isError).toBe(true);
    expect(thrown.content).toEqual([{ type: 'text', text: FIXED }]);
    const rejected = await client.callTool({ name: 'check_sky_fact', arguments: { kind: 'retrograde', body: 'Mars', date: '1990-06-15' } });
    expect(rejected.isError).toBe(true);
    expect(rejected.content).toEqual([{ type: 'text', text: FIXED }]);
    expect(notes).toEqual(['a tool handler failed with TypeError', 'a tool handler failed with RangeError']);
    expect(JSON.stringify([thrown, rejected])).not.toContain('1990-06-15');

    // The compute API's own refusal is still the answer, in its own words, and the session still serves.
    const refused = await client.callTool({ name: 'find_events', arguments: { from: '2026-01-01T00:00:00Z', to: '2025-01-01T00:00:00Z' } });
    expect(refused.content).toEqual([{ type: 'text', text: '/to: Must be later than from.' }]);
    const events = await client.callTool({ name: 'find_events', arguments: { from: '2026-02-01T00:00:00Z', to: '2026-03-01T00:00:00Z', kinds: ['lunation'] } });
    expect(events.isError).toBeFalsy();
    expect(notes).toHaveLength(2);
  });
  it('keeps an unexpected local birth rejection private and serves the next call', async () => {
    notes.length = 0;
    const failed = await client.callTool({ name: 'resolve_birth_time', arguments: { date: '1947-07-01', time: '12:00', timeZone: 'Europe/Stockholm' } });
    expect(failed.isError).toBe(true);
    expect(failed.content).toEqual([{ type: 'text', text: FIXED }]);
    expect(JSON.stringify(failed)).not.toContain('1947-07-01');
    expect(JSON.stringify(failed)).not.toContain('Europe/Stockholm');
    expect(notes).toEqual(['a tool handler failed with SyntaxError']);
    const next = await client.callTool({ name: 'get_capabilities', arguments: {} });
    expect(next.isError).toBeFalsy();
    expect(notes).toHaveLength(1);
  });

});
