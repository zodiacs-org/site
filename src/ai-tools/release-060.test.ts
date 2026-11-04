import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { createAiNodeHandler } from './http';
import { ALL_AI_TOOL_NAMES, COVERAGE_TOOL_NAMES, EVERY_AI_TOOL_NAME, TOOL_DESCRIPTIONS, TOOL_TITLES } from './contracts';
import { executeAiTool } from './tools';
import { EXPLAIN_TOPICS } from './features/explain';
import { CHINESE_ZODIAC_ANIMALS } from '../data/chinese-zodiac';
import { SIGNS } from '../lib/signs';
import { HOROSCOPE_SIGNS } from './horoscope/reading';
import committedWindow from '../data/horoscope-window.json';
import committedMonths from '../data/horoscope-months.json';
import committedProgram from '../data/horoscope-program.json';
import type { HoroscopeWindow } from './horoscope/window';
import type { HoroscopeProgram } from '../lib/horoscope-program-types';

/**
 * 0.6.0 adds five tools and changes nothing about the thirteen the directories reviewed. The live tools/list,
 * fetched from https://zodiacs.org/mcp on 1 November 2026, is kept in
 * docs/platform/zodiacs-ai/evidence/0.6.0/; every one of its thirteen entries must come back byte for byte.
 */
const root = new URL('../../', import.meta.url);
const LIVE = JSON.parse(readFileSync(new URL('docs/platform/zodiacs-ai/evidence/0.6.0/tools-list.live-2026-11-01.json', root), 'utf8'));
const window = async () => committedWindow as HoroscopeWindow;
const months = async () => committedMonths;
const program = async () => committedProgram as unknown as HoroscopeProgram;

let server: Server;
let endpoint: string;
beforeAll(async () => {
  const allowedHosts: string[] = [];
  // As production will run it (api/_ai/handler.ts): all three switches on, the three horoscope sources supplied.
  const handle = createAiNodeHandler({ env: { ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1' }, allowedHosts, rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed',
    countUsage: async () => undefined, dependencies: { horoscopeWindow: window, horoscopeMonths: months, horoscopeProgram: program } });
  server = createServer((req, res) => { void handle(req, res); });
  // Long tests in between leave the client's pooled socket idle; keep it open so it is never reset mid-suite.
  server.keepAliveTimeout = 10 * 60_000;
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
  allowedHosts.push(host);
  endpoint = `http://${host}/mcp`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

async function rpc(method: string, params: unknown) {
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const text = await response.text();
  return JSON.parse(response.headers.get('content-type')?.includes('text/event-stream') ? text.split('\n').find(line => line.startsWith('data: '))!.slice(6) : text);
}

describe('0.6.0 keeps the thirteen published tools as they are', () => {
  it('lists the thirteen live definitions byte for byte, then the five new tools', async () => {
    const live = LIVE.result.tools as { name: string }[];
    const tools = (await rpc('tools/list', {})).result.tools as Record<string, unknown>[];
    expect(live.map(tool => tool.name)).toEqual([...ALL_AI_TOOL_NAMES]);
    expect(tools.map(tool => tool.name)).toEqual([...EVERY_AI_TOOL_NAME]);
    for (const [index, published] of live.entries()) {
      // Whole entries, and each field on its own so a failure names it.
      for (const field of ['name', 'title', 'description', 'inputSchema', 'outputSchema', 'annotations', '_meta', 'icons']) {
        expect(JSON.stringify(tools[index][field]), `${published.name}.${field}`).toBe(JSON.stringify((published as Record<string, unknown>)[field]));
      }
      expect(JSON.stringify(tools[index])).toBe(JSON.stringify(published));
    }
    expect(JSON.stringify(tools.slice(0, live.length))).toBe(JSON.stringify(live));
  });

  it('keeps the thirteen published names, descriptions and input schemas byte for byte', async () => {
    const live = LIVE.result.tools as { name: string; description: string; inputSchema: unknown }[];
    const tools = (await rpc('tools/list', {})).result.tools as { name: string; description: string; inputSchema: unknown }[];
    expect(live).toHaveLength(13);
    for (const [index, published] of live.entries()) {
      expect(tools[index].name, published.name).toBe(published.name);
      expect(tools[index].description, published.name).toBe(published.description);
      expect(JSON.stringify(tools[index].inputSchema), published.name).toBe(JSON.stringify(published.inputSchema));
    }
  });

  it('reports 0.6.0 in the handshake and in get_capabilities, whose tool list keeps its published names', async () => {
    const init = (await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'release-060', version: '1' } })).result;
    expect(init.serverInfo).toEqual({ name: 'zodiacs', version: '0.6.0' });
    const capabilities = (await rpc('tools/call', { name: 'get_capabilities', arguments: {} })).result.structuredContent;
    expect(capabilities.data.version).toBe('0.6.0');
    expect(capabilities.data.tools).toEqual([...ALL_AI_TOOL_NAMES]);
    expect(capabilities.data.limitations.join(' ')).toContain('Version 0.6.0 adds tools listed in tools/list');
  });
});

describe('get_capabilities names every tool offered', () => {
  const sources = { horoscopeWindow: window, horoscopeMonths: months, horoscopeProgram: program };
  it('names all eighteen with coverage on: the thirteen in tools, the five by name in limitations', async () => {
    const result = await executeAiTool('get_capabilities', {}, { occasions: true, coverage: true, ...sources });
    if (!result.ok || result.tool !== 'get_capabilities') throw new Error(JSON.stringify(result));
    expect(result.data.tools).toEqual([...ALL_AI_TOOL_NAMES]);
    const text = result.data.limitations.join(' ');
    const named = EVERY_AI_TOOL_NAME.filter((name) => result.data.tools.includes(name as never) || text.includes(`${name} (`));
    expect(named).toEqual([...EVERY_AI_TOOL_NAME]);
    expect(named).toHaveLength(19);
    expect(text).toContain('Version 0.6.0 adds tools listed in tools/list: get_natal_chart (a birth chart readout), get_horoscope_period (');
    expect(text).toContain('and find_birthplace (a town or city name, with coordinates and a time zone for the chart tools).');
    expect(text).toContain('With them Zodiacs offers 19 tools: the 13 in the tools field and these 6.');
    expect(result.data.coverage.eclipses).toContain('get_horoscope_period');
    expect(result.data.coverage.aspects).toContain('get_personal_transits');
    expect(result.data.coverage.tools.split(', ')).toHaveLength(19);
    expect(result.data.privacy).toContain('https://zodiacs.org/privacy/');
    expect(text).not.toMatch(/[–—]/u);
  });

  it('names only the thirteen with coverage off', async () => {
    const result = await executeAiTool('get_capabilities', {}, { occasions: true, ...sources });
    if (!result.ok || result.tool !== 'get_capabilities') throw new Error(JSON.stringify(result));
    expect(result.data.tools).toEqual([...ALL_AI_TOOL_NAMES]);
    expect(result.data.tools).toHaveLength(13);
    const text = JSON.stringify(result.data);
    for (const name of COVERAGE_TOOL_NAMES) expect(text, name).not.toContain(name);
  });
});

describe('the five 0.6.0 tools', () => {
  it('are read-only, closed-world, non-destructive and anonymous, with a title in the annotations and no panel', async () => {
    const tools = (await rpc('tools/list', {})).result.tools as { name: string; title: string; description: string; annotations: Record<string, unknown>; _meta: Record<string, unknown>; inputSchema: { type: string; properties: Record<string, { type?: string }> } }[];
    for (const name of COVERAGE_TOOL_NAMES) {
      const tool = tools.find(entry => entry.name === name)!;
      expect(tool.title).toBe(TOOL_TITLES[name]);
      expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false, title: TOOL_TITLES[name] });
      expect(tool._meta).toEqual({ securitySchemes: [{ type: 'noauth' }] });
      expect(tool.description).toBe(TOOL_DESCRIPTIONS[name]);
      // Flat inputs: every property is a plain value, never an object to fill in.
      for (const property of Object.values(tool.inputSchema.properties)) expect(['string', 'number', 'integer']).toContain(property.type);
      expect(`${tool.title} ${tool.description}`).not.toMatch(/[–—]|crypto|token|blockchain|NFT/u);
    }
  });

  it('names the missing or wrong field when the SDK refuses the arguments, without repeating unknown names', async () => {
    const call = async (name: string, args: unknown) => (await rpc('tools/call', { name, arguments: args })).result;
    const natal = await call('get_natal_chart', {});
    expect(natal.isError).toBe(true);
    expect(natal.structuredContent).toEqual({ schema: 'zodiacs.ai-tool-result.v1', ok: false, tool: 'get_natal_chart', error: { code: 'invalid-request', message: 'birthDate is required.' } });
    expect(JSON.parse(natal.content[0].text)).toEqual(natal.structuredContent);
    expect((await call('get_horoscope_period', { sign: 'leo' })).structuredContent.error.message).toBe('period is required.');
    expect((await call('get_horoscope_period', { sign: 'lion', period: 'month' })).structuredContent.error.message).toBe(`sign must be one of: ${HOROSCOPE_SIGNS.join(', ')}.`);
    expect((await call('get_personal_transits', { birthDate: '3 May 1990' })).structuredContent.error.message).toBe('birthDate must be a date such as 1990-05-03.');
    expect((await call('get_chinese_zodiac', { year: 1890 })).structuredContent.error.message).toBe('year must be at least 1901.');
    expect((await call('explain_astrology', {})).structuredContent.error.message).toBe('topic is required.');
    const unknown = await call('get_natal_chart', { birthDate: '1990-05-03', secretPassword: 'x' });
    expect(unknown.structuredContent.error.message).toBe('Leave out fields this tool does not take.');
    expect(JSON.stringify(unknown)).not.toContain('secretPassword');
    // The thirteen name the field too, since the live audit fixes (#865).
    const old = await call('get_life_milestones', {});
    expect(JSON.parse(old.content[0].text).error).toEqual({ code: 'invalid-arguments', message: 'birthDate is required.' });
  });

  it('answer through the hosted server with structured content and the same JSON as text', async () => {
    const calls: [string, Record<string, unknown>][] = [
      ['get_natal_chart', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.4168, longitude: -3.7038 }],
      ['get_horoscope_period', { sign: 'leo', period: 'month', date: '2026-11-05' }],
      ['get_chinese_zodiac', { birthDate: '1990-01-20' }],
      ['get_personal_transits', { birthDate: '1990-05-03', from: '2026-11-01', to: '2026-11-30' }],
      ['explain_astrology', { topic: 'Mercury retrograde' }],
    ];
    for (const [name, args] of calls) {
      const result = (await rpc('tools/call', { name, arguments: args, _meta: { 'openai/userLocation': { timezone: 'Asia/Bangkok' } } })).result;
      expect(result.isError, name).toBe(false);
      expect(result.structuredContent).toMatchObject({ ok: true, tool: name });
      expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
      // ChatGPT calls carry ?ref=chatgpt on every zodiacs.org link, as the other tools' do.
      for (const link of result.structuredContent.links) expect(link.url).toMatch(/^https:\/\/zodiacs\.org\/.*[?&]ref=chatgpt(?:#|$)/u);
    }
  }, 60_000);
});

/** Whether a zodiacs.org path is a page the site builds: a static route, or a dynamic route with a slug it generates. */
function routeExists(path: string): boolean {
  const page = (file: string) => existsSync(new URL(`src/pages/${file}`, root));
  const content = (file: string) => existsSync(new URL(`src/content/${file}`, root));
  const signs = SIGNS.map(sign => sign.slug);
  const parts = path.replace(/^\/|\/$/gu, '').split('/');
  if (parts.length === 1 && signs.includes(parts[0])) return page('[sign]');
  if (parts[0] === 'rising-sign' && parts.length === 2) return signs.includes(parts[1]) && page('rising-sign/[sign].astro');
  if (parts[0] === 'horoscopes' && parts.length >= 2 && signs.includes(parts[1])) return page(`horoscopes/[sign]/${parts.slice(2).join('/')}${parts.length > 2 ? '/' : ''}index.astro`);
  if (parts[0] === 'learn' && parts.length === 3 && ['planets', 'houses', 'aspects', 'placements'].includes(parts[1])) return content(`learn/${parts[1]}/${parts[2]}.mdx`) && page(`learn/${parts[1]}/[slug].astro`);
  if (parts[0] === 'learn' && parts[1] === 'chinese-zodiac' && parts.length === 3) return CHINESE_ZODIAC_ANIMALS.some(animal => animal.slug === parts[2]) && page('learn/chinese-zodiac/[animal]/index.astro');
  return page(`${parts.join('/')}${parts.length && parts[0] ? '/' : ''}index.astro`) || page(`${parts.join('/')}.astro`);
}

describe('every link the 0.6.0 tools return', () => {
  it('opens a page the site builds', async () => {
    const dependencies = { occasions: true, coverage: true, horoscopeWindow: window, horoscopeMonths: months, horoscopeProgram: program, now: () => new Date('2026-11-02T05:00:00Z') };
    const calls: [typeof COVERAGE_TOOL_NAMES[number], Record<string, unknown>][] = [
      ...EXPLAIN_TOPICS.map((topic): [typeof COVERAGE_TOOL_NAMES[number], Record<string, unknown>] => ['explain_astrology', { topic }]),
      ['explain_astrology', { topic: 'tarot' }],
      ...HOROSCOPE_SIGNS.flatMap((sign) => (['month', 'year', 'week'] as const).flatMap((period) => (['general', 'love', 'career'] as const).map((focus): [typeof COVERAGE_TOOL_NAMES[number], Record<string, unknown>] => ['get_horoscope_period', { sign, period, focus, ...(period === 'year' ? { date: '2027-06-01' } : {}) }]))),
      ['get_horoscope_period', { sign: 'leo', period: 'year' }],
      ...['1990-05-03', '1972-08-15', '2000-11-11'].flatMap((birthDate): [typeof COVERAGE_TOOL_NAMES[number], Record<string, unknown>][] => [
        ['get_natal_chart', { birthDate }],
        ['get_natal_chart', { birthDate, time: '23:10', zone: 'Asia/Tokyo', latitude: 35.68, longitude: 139.69 }],
        ['get_personal_transits', { birthDate }],
        ['get_personal_transits', { birthDate, time: '23:10', zone: 'Asia/Tokyo', latitude: 35.68, longitude: 139.69, mode: 'year-ahead' }],
        ['get_chinese_zodiac', { birthDate }],
      ]),
    ];
    const missing = new Set<string>();
    for (const [tool, args] of calls) {
      const result = await executeAiTool(tool, args, dependencies);
      expect(result.ok, `${tool} ${JSON.stringify(args)}`).toBe(true);
      const urls = [...JSON.stringify(result).matchAll(/"(https:\/\/zodiacs\.org[^"]*)"/gu)].map(match => match[1]);
      for (const url of urls) {
        const { pathname } = new URL(url);
        if (!routeExists(pathname)) missing.add(pathname);
      }
    }
    expect([...missing]).toEqual([]);
  }, 120_000);
});

describe('get_horoscope_period over /mcp takes a sign as written', () => {
  const call = async (name: string, args: unknown) => (await rpc('tools/call', { name, arguments: args })).result;

  it('lower-cases and trims the sign before the SDK checks the published enum', async () => {
    const expected = await call('get_horoscope_period', { sign: 'leo', period: 'month', date: '2026-11-01' });
    expect(expected.isError).toBeFalsy();
    expect(expected.structuredContent.ok).toBe(true);
    expect(expected.structuredContent.data.sign).toBe('leo');
    for (const sign of ['Leo', 'LEO', ' leo ']) {
      const result = await call('get_horoscope_period', { sign, period: 'month', date: '2026-11-01' });
      expect(result.isError, sign).toBeFalsy();
      expect(result.structuredContent, sign).toEqual(expected.structuredContent);
    }
  });

  it('still refuses a sign that is not one, and leaves the thirteen tools as they were', async () => {
    expect((await call('get_horoscope_period', { sign: 'Lion', period: 'month' })).structuredContent.error.message).toBe(`sign must be one of: ${HOROSCOPE_SIGNS.join(', ')}.`);
    // get_horoscope's published enum is lower case and its arguments reach the SDK unchanged.
    const old = await call('get_horoscope', { sign: 'Leo' });
    expect(old.isError).toBe(true);
    expect(old.structuredContent?.ok).not.toBe(true);
    const ok = await call('get_horoscope', { sign: 'leo' });
    expect(ok.isError).toBeFalsy();
    expect(ok.structuredContent.ok).toBe(true);
  });
});
