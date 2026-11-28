import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createAiNodeHandler } from './http';
import {
  INPUT_SCHEMAS, NUMEROLOGY_SWITCH_ENV, SOLAR_RETURN_SWITCH_ENV, UNDER_13_REFUSAL, YEAR_SCORE_PEOPLE_SWITCH_ENV,
  YEAR_SCORE_SWITCH_ENV, type AiToolName,
} from './contracts';
import { childBirthDateRefusal } from './tools';

/**
 * The under-13 refusal (#915) covers every hosted tool, including any added later. under-13.test.ts names the tools
 * that existed when the rule landed; this file reads the input schemas themselves, so a new tool with a birthDate
 * field is held to the rule without anyone remembering to list it. Every date here is made up for the test.
 */
const NOW = new Date('2026-11-08T03:00:00Z');
const CHILD = '2020-06-15';
const TEEN_EVE = '2013-11-09';
const ADULT = '1990-06-15';

/** The object shape behind a tool's input schema, through any refinement wrapper. */
function shapeOf(schema: unknown): Record<string, unknown> {
  let current = schema as { shape?: Record<string, unknown>; _def?: { schema?: unknown; innerType?: unknown; in?: unknown } };
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (current.shape && typeof current.shape === 'object') return current.shape;
    current = (current._def?.schema ?? current._def?.innerType ?? current._def?.in) as typeof current;
  }
  return {};
}

const TOOLS = Object.keys(INPUT_SCHEMAS) as AiToolName[];
const WITH_BIRTH_DATE = TOOLS.filter((tool) => 'birthDate' in shapeOf(INPUT_SCHEMAS[tool as keyof typeof INPUT_SCHEMAS]));

describe('every hosted tool that takes a birth date refuses one less than 13 years ago', () => {
  it('finds the birth-date tools, the newer ones included', () => {
    for (const tool of ['get_natal_chart', 'get_life_milestones', 'get_birthday', 'get_horoscope', 'get_year_score', 'get_solar_return', 'get_numerology']) {
      expect(WITH_BIRTH_DATE, tool).toContain(tool);
    }
  });

  it('refuses a child, and the day before a 13th birthday, in every one of them', () => {
    for (const tool of WITH_BIRTH_DATE) {
      for (const birthDate of [CHILD, TEEN_EVE]) {
        const refusal = childBirthDateRefusal(tool, { birthDate }, NOW);
        expect(refusal, `${tool} ${birthDate}`).not.toBeNull();
        expect(refusal!.ok, tool).toBe(false);
        expect(JSON.stringify(refusal), tool).toContain(JSON.stringify(UNDER_13_REFUSAL).slice(1, -1));
        expect(JSON.stringify(refusal), tool).not.toContain(birthDate);
      }
      expect(childBirthDateRefusal(tool, { birthDate: ADULT }, NOW), tool).toBeNull();
    }
  });

  it('refuses either person in a comparison', () => {
    expect(childBirthDateRefusal('get_compatibility', { a: { birthDate: ADULT }, b: { birthDate: CHILD } }, NOW)).not.toBeNull();
    expect(childBirthDateRefusal('get_compatibility', { a: { birthDate: CHILD }, b: { birthDate: ADULT } }, NOW)).not.toBeNull();
  });
});

describe('the hosted server refuses a child for the switched tools too', () => {
  let server: Server;
  let endpoint: string;
  beforeAll(async () => {
    const allowedHosts: string[] = [];
    const handle = createAiNodeHandler({
      env: {
        ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1',
        [YEAR_SCORE_SWITCH_ENV]: '1', [YEAR_SCORE_PEOPLE_SWITCH_ENV]: '1', [SOLAR_RETURN_SWITCH_ENV]: '1', [NUMEROLOGY_SWITCH_ENV]: '1',
      },
      allowedHosts, rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed', countUsage: async () => undefined,
      dependencies: { now: () => NOW },
    });
    server = createServer((req, res) => { void handle(req, res); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
    allowedHosts.push(host);
    endpoint = `http://${host}/mcp`;
  });
  afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });

  async function call(name: string, args: Record<string, unknown>) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    });
    const text = await response.text();
    return JSON.parse(response.headers.get('content-type')?.includes('text/event-stream') ? text.split('\n').find((line) => line.startsWith('data: '))!.slice(6) : text).result;
  }

  it('answers get_year_score, get_solar_return and get_numerology with the fixed refusal, echoing nothing', async () => {
    const calls: [string, Record<string, unknown>][] = [
      ['get_year_score', { birthDate: CHILD }],
      ['get_solar_return', { birthDate: CHILD }],
      ['get_numerology', { birthDate: CHILD, name: 'Robin Example' }],
    ];
    for (const [name, args] of calls) {
      const answer = await call(name, args);
      expect(answer.isError, name).toBe(true);
      expect(answer.structuredContent, name).toEqual({ schema: 'zodiacs.ai-tool-result.v1', ok: false, tool: name, error: { code: 'invalid-request', message: UNDER_13_REFUSAL } });
      expect(JSON.stringify(answer), name).not.toMatch(/2020-06|Robin/u);
    }
  });
});
