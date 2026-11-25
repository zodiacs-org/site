/**
 * The one age gate (./birth-date-age-gate.ts), as a table: every row is read by the gate itself, then sent to every
 * tool in AGE_FIRST_TOOLS on the direct tool, the hosted server from source, and the hosted server from both
 * generated bundles (api/_ai/runtime.mjs and integrations/generated/sky-watch.mjs).
 *
 * - ADULT rows go on to the tool's own field checks, which name the missing zone.
 * - UNDER_13 rows get the plain under-13 refusal and nothing else, whatever else the call carries or lacks.
 * - NEEDS_DATE rows get the birth date asked for alone, never a time, zone, latitude, longitude or place.
 *
 * The clock is 2026-11-09T09:00Z: 2026-11-08 at UTC-12, so 2013-11-08 is the latest birth date accepted, and
 * 2026-11-09 at UTC+14, so 2026-11-10 is the first date still to come.
 */
import { createServer, request, type Server } from 'node:http';
import { afterAll, describe, expect, it } from 'vitest';
import { birthDateAgeGate, type BirthDateAgeGate } from './birth-date-age-gate';
import { AGE_FIRST_TOOLS, executeAiTool } from './tools';
import { createAiNodeHandler } from './http';
import { UNDER_13_REFUSAL, type AiToolName } from './contracts';
import { UNDER_13_SENTENCE } from '../lib/good-days/find';
import { loadPlaceTable } from './features/place-table';
import { PERSONAL_TOOL_NAMES, personalTool } from './personal/registry';

const NOW = new Date('2026-11-09T09:00:00Z');
const ON = { occasions: true, coverage: true, personal: true, now: () => NOW, placeTable: async () => loadPlaceTable(), sitePageOn: () => true };
/** A call with no birthDate at all. */
const MISSING = Symbol('missing');
const DATE_FORM = 'birthDate must be a date such as 1994-05-14.';

const ROWS: readonly [unknown, BirthDateAgeGate, string][] = [
  // Adult controls: every reading, in every order, a real day 13 or more years ago.
  ['1990-01-31', 'ADULT', 'year, month, day (year, day, month has no month 31)'],
  ['31/01/1990', 'ADULT', 'day, month, year'],
  ['01/31/1990', 'ADULT', 'month, day, year'],
  ['1990/31/01', 'ADULT', 'year, day, month'],
  ['31 01 1990', 'ADULT', 'spaces between'],
  ['31.1.1990', 'ADULT', 'full stops, unpadded'],
  ['1990-05-03', 'ADULT', 'year first, both orders adult'],
  [' 1990-05-03 ', 'ADULT', 'spaces around'],
  ['05/06/1985', 'ADULT', 'day first and month first both adult'],
  ['1990/01-31', 'ADULT', 'mixed separators, read all the same'],
  ['05/06/05', 'ADULT', 'two digit year, 1905 and 2005 in every order adult'],
  ['2013-11-08', 'ADULT', 'the latest birth date accepted'],
  ['08/11/2013', 'ADULT', 'the latest, day first; month first is August'],
  ['January 5, 1990', 'ADULT', 'month name, day, year'],
  ['5 Jan 1990', 'ADULT', 'day, abbreviation, year'],
  ['5th of January, 1990', 'ADULT', 'ordinal and of'],
  ['1990 January 5', 'ADULT', 'year, month name, day'],
  ['1990 5 January', 'ADULT', 'year, day, month name'],
  ['January 1990 5', 'ADULT', 'month name, year, day'],
  ['jan. 5, 1990', 'ADULT', 'lower case with a full stop'],
  ['Sept 1 1985', 'ADULT', 'Sept'],
  ['November 8, 2013', 'ADULT', 'the latest, with a month name'],
  // Under 13, or still to come, in any reading.
  ['2020-01-01', 'UNDER_13', 'year first'],
  ['2020-1-1', 'UNDER_13', 'unpadded'],
  ['2013-11-09', 'UNDER_13', 'the day after the latest accepted'],
  ['2013/11/09', 'UNDER_13', 'the day after, slashes'],
  ['31/01/2020', 'UNDER_13', 'day first'],
  ['01/31/2020', 'UNDER_13', 'month first'],
  ['2020/31/01', 'UNDER_13', 'year, day, month'],
  ['01/12/2013', 'UNDER_13', 'month first adult, day first 1 December 2013'],
  ['2013/09/11', 'UNDER_13', 'year, day, month reads 9 November 2013'],
  ['2013-09-11', 'UNDER_13', 'the same with hyphens'],
  ['13/09/11', 'UNDER_13', 'two digit year first reads 9 November 2013'],
  ['Jan 5 27', 'UNDER_13', 'two digit year read as 2027, still to come'],
  ['03/04/28', 'UNDER_13', 'two digit year read as 2028, still to come'],
  ['31.01.90', 'UNDER_13', 'two digit year read as 2090, still to come'],
  ['5 Jan 90', 'UNDER_13', 'month name, two digit year read as 2090'],
  ['12/02/30', 'UNDER_13', 'two digit year read as 2030'],
  ['01/02/15', 'UNDER_13', 'two digit year read as 2015'],
  ['30/01/15', 'UNDER_13', 'two digit year read as 2015, day first'],
  ['January 5, 2020', 'UNDER_13', 'month name, day, year'],
  ['5 January 2020', 'UNDER_13', 'day, month name, year'],
  ['2020 January 5', 'UNDER_13', 'year, month name, day'],
  ['2020 5 January', 'UNDER_13', 'year, day, month name'],
  ['November 9, 2013', 'UNDER_13', 'the day after, month name'],
  ['9 Nov 2013', 'UNDER_13', 'the day after, abbreviation'],
  ['2016.2.29', 'UNDER_13', 'a real leap day'],
  ['2026-12-31', 'UNDER_13', 'still to come'],
  ['01 12 2026', 'UNDER_13', 'still to come, spaces'],
  ['9999-01-01', 'UNDER_13', 'an absurd year still to come'],
  // The birth date alone is asked for again.
  [MISSING, 'NEEDS_DATE', 'missing'],
  ['', 'NEEDS_DATE', 'empty'],
  ['   ', 'NEEDS_DATE', 'spaces'],
  ['\t\n', 'NEEDS_DATE', 'tab and newline'],
  ['1990-02-30', 'NEEDS_DATE', 'no 30 February'],
  ['2019-02-29', 'NEEDS_DATE', 'no leap day in 2019'],
  ['1900-02-29', 'NEEDS_DATE', 'no Gregorian leap day in 1900'],
  ['31/04/1990', 'NEEDS_DATE', 'no 31 April'],
  ['02/30/1990', 'NEEDS_DATE', 'no 30 February, month first'],
  ['1990/30/02', 'NEEDS_DATE', 'no 30 February, year, day, month'],
  ['February 30, 1990', 'NEEDS_DATE', 'no 30 February by name'],
  ['1990-13-45', 'NEEDS_DATE', 'no month 13 or 45'],
  ['13/13/1990', 'NEEDS_DATE', 'no month 13 either way'],
  ['1990-00-00', 'NEEDS_DATE', 'no month 0'],
  ['00/00/1990', 'NEEDS_DATE', 'no day or month 0'],
  ['1990-05-00', 'NEEDS_DATE', 'no day 0'],
  ['Jan 32 1990', 'NEEDS_DATE', 'no day 32'],
  ['1990', 'NEEDS_DATE', 'a year alone'],
  ['1990-05', 'NEEDS_DATE', 'a year and month'],
  ['May 1990', 'NEEDS_DATE', 'a month name and year'],
  ['5 May', 'NEEDS_DATE', 'a day and month name'],
  ['sometime in spring', 'NEEDS_DATE', 'unreadable'],
  ['Smarch 5 1990', 'NEEDS_DATE', 'not a month'],
  ['Monday, January 5, 1990', 'NEEDS_DATE', 'a weekday too'],
  ['1990-01-01abc', 'NEEDS_DATE', 'garbage after'],
  ['abc1990-01-01', 'NEEDS_DATE', 'garbage before'],
  ['2020-01-01 lol', 'NEEDS_DATE', 'a word after a child\'s date'],
  ['1990-01-01T08:30', 'NEEDS_DATE', 'a time inside'],
  ['1990-01-01 08:30', 'NEEDS_DATE', 'a time after'],
  ['1990-01-01-05', 'NEEDS_DATE', 'a fourth part'],
  ['31/01/1990/2', 'NEEDS_DATE', 'a fourth part, day first'],
  ['19900101', 'NEEDS_DATE', 'no separators'],
  ['1/2/3', 'NEEDS_DATE', 'no year'],
  ['5 Jan 7', 'NEEDS_DATE', 'a one digit year'],
  ['990-01-05', 'NEEDS_DATE', 'a three digit year'],
  ['0001-01-01', 'NEEDS_DATE', 'an absurd year in the past'],
  ['1799-05-03', 'NEEDS_DATE', 'before the years the tools take'],
  ['１９９０-01-01', 'NEEDS_DATE', 'full width digits'],
  [`${'1'.repeat(80)}-01-01`, 'NEEDS_DATE', 'far too long'],
  [19900101, 'NEEDS_DATE', 'a number'],
  [null, 'NEEDS_DATE', 'null'],
  [true, 'NEEDS_DATE', 'a boolean'],
  [['1990-01-01'], 'NEEDS_DATE', 'an array'],
  [{ year: 1990, month: 1, day: 1 }, 'NEEDS_DATE', 'an object'],
];

/** What a child's or an unsettled call may carry besides the date: each is still answered by the gate alone. */
const INCOMPLETE: readonly [string, Record<string, unknown>][] = [
  ['nothing else', {}],
  ['a time without a zone', { time: '08:30' }],
  ['a lone latitude', { latitude: 51.51 }],
  ['a lone longitude', { longitude: -0.13 }],
  ['an invalid time', { time: '25:99', zone: 'Europe/London' }],
  ['a time without padding and an unknown field', { time: '8:30', unknown: 1 }],
];
/** A gate reply never names any of these. */
const OTHER_FIELDS = /\btime\b|zone|latitude|longitude|place|coordinates/iu;

const argsFor = (value: unknown, extra: Record<string, unknown>) => (value === MISSING ? { ...extra } : { ...extra, birthDate: value });

function expectReply(reply: { ok: boolean; error?: { code: string; message: string } }, value: unknown, verdict: BirthDateAgeGate, label: string) {
  const text = JSON.stringify(reply);
  expect(reply.ok, label).toBe(false);
  if (verdict === 'ADULT') {
    // Past the gate: the tool's own field check names the zone the time needs.
    expect(reply.error!.message, label).not.toBe(UNDER_13_SENTENCE);
    expect(reply.error!.message, label).not.toBe(DATE_FORM);
    expect(reply.error!.message, label).toMatch(/zone/u);
    return;
  }
  expect(reply.error, label).toMatchObject({ code: 'invalid-request' });
  expect(reply.error!.message, label).toBe(verdict === 'UNDER_13' ? UNDER_13_SENTENCE : value === MISSING ? 'birthDate is required.' : DATE_FORM);
  expect(text, label).not.toMatch(OTHER_FIELDS);
  expect(text, label).not.toContain(UNDER_13_REFUSAL);
  // The date is never echoed back.
  if (typeof value === 'string' && value.trim().length >= 4) expect(text, label).not.toContain(value.trim());
}

describe('the one age gate for a birth date', () => {
  const servers: Server[] = [];
  afterAll(async () => { await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve())))); });
  async function serve(make: typeof createAiNodeHandler) {
    let handle: (req: unknown, res: unknown) => Promise<void> = async () => {};
    const server = createServer((req, res) => { void handle(req, res); });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    servers.push(server);
    const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
    handle = make({ env: { ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1', ZODIACS_PERSONAL_TOOLS_ENABLED: '1' }, allowedHosts: [host],
      rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed', countUsage: async () => {}, dependencies: { now: ON.now, placeTable: ON.placeTable } });
    return host;
  }
  function call(host: string, name: string, args: unknown) {
    return new Promise<any>((resolve, reject) => {
      const req = request(`http://${host}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' } }, (res) => {
        let text = ''; res.setEncoding('utf8');
        res.on('data', (chunk) => { text += chunk; });
        res.on('end', () => {
          const body = text.includes('data: ') ? text.split('\n').find((line) => line.startsWith('data: '))!.slice(6) : text;
          resolve(JSON.parse(body).result);
        });
      });
      req.on('error', reject);
      req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }));
    });
  }

  it('sorts every row the same on the gate, every birth date tool, the hosted server and both bundles', async () => {
    expect(ROWS.length).toBeGreaterThanOrEqual(80);
    for (const verdict of ['ADULT', 'UNDER_13', 'NEEDS_DATE'] as const) expect(ROWS.some((row) => row[1] === verdict)).toBe(true);
    // The tools: every personal tool whose input takes a birth date, and no other.
    const tools = [...AGE_FIRST_TOOLS] as AiToolName[];
    expect(tools.length).toBeGreaterThan(0);
    expect(tools).toEqual(PERSONAL_TOOL_NAMES.filter((name) => 'birthDate' in (personalTool(name).input as unknown as { shape: Record<string, unknown> }).shape));

    for (const [value, verdict, label] of ROWS) expect(birthDateAgeGate(value === MISSING ? undefined : value, NOW), label).toBe(verdict);

    for (const tool of tools) {
      const { birthDate: _adult, ...full } = personalTool(tool as never).example;
      // The direct tool.
      for (const [value, verdict, label] of ROWS) {
        if (verdict === 'ADULT') {
          expectReply(await executeAiTool(tool, argsFor(value, { time: '08:30' }), ON) as never, value, verdict, `${tool} tool, a time without a zone: ${label}`);
          // A date already in the tools' own form is worked out.
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value)) expect((await executeAiTool(tool, argsFor(value, full), ON) as { ok: boolean }).ok, `${tool} tool, worked out: ${label}`).toBe(true);
          continue;
        }
        for (const [extraLabel, extra] of [...INCOMPLETE, ['every other detail', full] as const]) {
          expectReply(await executeAiTool(tool, argsFor(value, extra), ON) as never, value, verdict, `${tool} tool, ${extraLabel}: ${label}`);
        }
      }
      // The hosted server, from the source and from both generated bundles that carry it.
      const runtime = (await import('../../api/_ai/runtime.mjs')) as unknown as { createAiNodeHandler: typeof createAiNodeHandler };
      const skyWatch = (await import('../../integrations/generated/sky-watch.mjs')) as unknown as { createAiNodeHandler: typeof createAiNodeHandler };
      for (const [name, make] of [['source', createAiNodeHandler], ['api/_ai/runtime.mjs', runtime.createAiNodeHandler], ['sky-watch.mjs', skyWatch.createAiNodeHandler]] as const) {
        const host = await serve(make);
        for (const [value, verdict, label] of ROWS) {
          const extras = verdict === 'ADULT' ? [['a time without a zone', { time: '08:30' }] as const] : [...INCOMPLETE, ['every other detail', full] as const];
          for (const [extraLabel, extra] of extras) {
            const result = await call(host, tool, argsFor(value, extra));
            const where = `${tool} ${name}, ${extraLabel}: ${label}`;
            expect(result.isError, where).toBe(true);
            expect(result.structuredContent, where).toMatchObject({ ok: false, tool });
            expectReply(result.structuredContent, value, verdict, where);
            if (verdict !== 'ADULT') expect(JSON.stringify(result.content), where).not.toMatch(OTHER_FIELDS);
          }
        }
      }
    }
  }, 600_000);
});
