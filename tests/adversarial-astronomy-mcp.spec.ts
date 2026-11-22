/**
 * Hostile inputs against the hosted MCP server's own code: the published
 * connector (api/_ai/handler.ts, publishedConnector), the bytes /mcp runs in
 * production, on a loopback address. No production request is made. Plain
 * `npm test` skips it, and no workflow runs it yet; run it by hand with
 *
 *   ADVERSARIAL_MCP=1 npx vitest run tests/adversarial-astronomy-mcp.spec.ts --reporter=verbose
 *
 * It is the thin, MCP-side companion of the engine repository's
 * tests/adversarial-astronomy.spec.ts (230 cases with measured tolerances).
 * The expected UTC instants below are the IANA tz database's (2026f, compiled
 * by zic with backzone), the same values that fixture holds; none comes from
 * this server. All birth data is invented, and every birth is more than 13
 * years ago, since the server refuses anything later (the one refused date is
 * worked out from today's, five years back).
 *
 * What it holds the server to:
 *   - a historical wall time is read on that zone's history (US War Time,
 *     British Double Summer Time, Amsterdam Time, India's wartime +06:30);
 *   - a skipped or repeated wall time is never read silently: the result
 *     carries a timeNote that says which reading was used;
 *   - without a birth time there is no rising sign and no house, and on a day
 *     the Moon (or the Sun) changes sign its sign is null with both candidates;
 *   - inside the polar circle a chart still has a position for every planet,
 *     both angles and a house from 1 to 12 (the house system is the default,
 *     whole sign; no other system is asked for here);
 *   - malformed input is refused with an error that names the field, and no
 *     chart is made;
 *   - no number in any result is NaN or infinite. JSON writes either as null,
 *     so the walk also fails on a null where a position's number belongs
 *     (lon, lat, speed, degree, orb), and on "NaN" inside any text.
 */
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const ENABLED = process.env.ADVERSARIAL_MCP === '1';
const NEW_YORK = { latitude: 40.7128, longitude: -74.006 };
/** A date five years before today, for the refusal: worked out here so the rule is tested whenever this runs. */
const FIVE_YEARS_AGO = new Date(Date.now() - 5 * 365.25 * 86_400_000).toISOString().slice(0, 10);

interface ToolResult { status: number; isError: boolean; data: Record<string, any> | null; error: { code?: string; message?: string } | null; text: string }

/** Keys that hold a position's number in a result. JSON.stringify writes NaN and Infinity as null, so a null here is one of those. */
const NUMBER_KEYS = new Set(['lon', 'lat', 'speed', 'degree', 'orb']);
/** A position as the birth chart prints it, for example 0°24′ Cancer. */
const POSITION = /^\d{1,2}°\d{2}′ [A-Z][a-z]+$/u;

function everyNumberFinite(value: unknown, where: string, key = ''): void {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${where} is ${value}`);
  if (NUMBER_KEYS.has(key) && value === null) throw new Error(`${where} is null, where a number belongs`);
  if (typeof value === 'string' && /\bNaN\b|\bInfinity\b/u.test(value)) throw new Error(`${where} is ${JSON.stringify(value)}`);
  if (Array.isArray(value)) value.forEach((entry, index) => everyNumberFinite(entry, `${where}[${index}]`));
  else if (value && typeof value === 'object') for (const [name, entry] of Object.entries(value)) everyNumberFinite(entry, `${where}.${name}`, name);
}

/** Every planet of a chart has a printed position, and with a time and a place both angles and a house. */
function expectWholeChart(chart: Record<string, any>, placed: boolean): void {
  expect((chart.planets as unknown[]).length).toBe(10);
  for (const planet of chart.planets as { body: string; position: unknown; house: unknown }[]) {
    expect(planet.position, `${planet.body} position`).toMatch(POSITION);
    if (placed) expect(Number.isInteger(planet.house) && (planet.house as number) >= 1 && (planet.house as number) <= 12, `${planet.body} house ${String(planet.house)}`).toBe(true);
  }
  if (placed) {
    expect(chart.angles.ascendant, 'ascendant').toMatch(POSITION);
    expect(chart.angles.midheaven, 'midheaven').toMatch(POSITION);
  }
  for (const aspect of chart.aspects as { orb: unknown }[]) expect(typeof aspect.orb).toBe('number');
}

describe.skipIf(!ENABLED)('the hosted MCP server under hostile input (local published connector)', () => {
  let server: Server;
  let endpoint = '';
  let id = 0;

  beforeAll(async () => {
    const routes = await import('../api/_ai/handler');
    let handle: Awaited<ReturnType<typeof routes.publishedConnector>> | undefined;
    server = createServer((req, res) => {
      // As after Vercel's rewrite of /mcp (vercel.json): the connector reads its route from the query.
      const rewritten = req as IncomingMessage & { query?: Record<string, string> };
      rewritten.url = '/api/compatibility?__zodiacs_ai=1';
      rewritten.query = { __zodiacs_ai: '1' };
      void handle?.(rewritten, res);
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
    const allowed = async () => 'allowed' as const;
    // Production's switches for the 19 tools it lists; rate limits and usage counting are stand-ins that allow and count nothing.
    handle = await routes.publishedConnector({
      env: { ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1' },
      allowedHosts: [host],
      rateLimit: allowed,
      atomicQuota: allowed,
      countUsage: async () => undefined,
    } as never);
    endpoint = `http://${host}/mcp`;
  }, 120_000);

  afterAll(async () => {
    server?.closeAllConnections();
    await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
  });

  async function call(name: string, args: unknown): Promise<ToolResult> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name, arguments: args } }),
    });
    const raw = await response.text();
    const payload = /^(?:event|data):/u.test(raw) ? raw.split('\n').find((line) => line.startsWith('data:'))!.slice(5) : raw;
    const message = JSON.parse(payload) as { result?: { isError?: boolean; structuredContent?: { data?: Record<string, any>; error?: ToolResult['error'] }; content?: { text?: string }[] }; error?: ToolResult['error'] };
    const structured = message.result?.structuredContent;
    // A NaN reaches JSON as null: the walk fails on a null under a position's number key, and on "NaN" in any text.
    everyNumberFinite(message, `${name} result`);
    return { status: response.status, isError: Boolean(message.result?.isError ?? message.error), data: structured?.data ?? null, error: structured?.error ?? message.error ?? null, text: message.result?.content?.[0]?.text ?? '' };
  }

  const natal = (args: Record<string, unknown>) => call('get_natal_chart', args);

  describe('historical wall times are read on the zone\'s own history', () => {
    it.each([
      ['US War Time in January 1943', { birthDate: '1943-01-15', time: '12:00', zone: 'America/New_York', ...NEW_YORK }, '1943-01-15T16:00:00.000Z'],
      ['British Double Summer Time, July 1941', { birthDate: '1941-07-01', time: '12:00', zone: 'Europe/London', latitude: 51.5074, longitude: -0.1278 }, '1941-07-01T10:00:00.000Z'],
      ['Amsterdam summer time of 1937, +01:19:32', { birthDate: '1937-06-15', time: '12:00', zone: 'Europe/Amsterdam', latitude: 52.3676, longitude: 4.9041 }, '1937-06-15T10:40:28.000Z'],
      ['India\'s wartime +06:30, June 1943', { birthDate: '1943-06-15', time: '12:00', zone: 'Asia/Kolkata', latitude: 22.5726, longitude: 88.3639 }, '1943-06-15T05:30:00.000Z'],
    ])('%s', async (_label, args, utc) => {
      const result = await natal(args);
      expect(result.isError).toBe(false);
      expect(result.data!.castFor).toEqual({ utc, basis: 'birth-time' });
      expect(result.data!.timeNote ?? null, 'an ordinary wall time carries no time note').toBeNull();
      expect(result.data!.rising.sign).toMatch(/^[a-z]+$/u);
    });
  });

  describe('a skipped or repeated wall time is said, not guessed', () => {
    it.each([
      ['an hour that did not exist (New York, March 2010)', { birthDate: '2010-03-14', time: '02:30', zone: 'America/New_York', ...NEW_YORK }, '2010-03-14T07:30:00.000Z', 'dst-gap', 60],
      ['an hour that happened twice (New York, November 2010)', { birthDate: '2010-11-07', time: '01:30', zone: 'America/New_York', ...NEW_YORK }, '2010-11-07T05:30:00.000Z', 'dst-fold', 0],
      ['a day that did not exist (Samoa, 30 December 2011)', { birthDate: '2011-12-30', time: '12:00', zone: 'Pacific/Apia', latitude: -13.8333, longitude: -171.7667 }, '2011-12-30T22:00:00.000Z', 'dst-gap', 1440],
    ])('%s', async (_label, args, utc, kind, shift) => {
      const result = await natal(args);
      expect(result.isError).toBe(false);
      expect(result.data!.castFor.utc).toBe(utc);
      expect(result.data!.timeNote).toMatchObject({ kind, shiftMinutes: shift });
      expect(String(result.data!.timeNote.text).length, 'the note says in words what was done').toBeGreaterThan(40);
    });
  });

  describe('without a birth time', () => {
    it('gives no rising sign and no house, and both Moon signs on a day the Moon changes sign', async () => {
      const result = await natal({ birthDate: '1990-06-16', zone: 'America/New_York', ...NEW_YORK });
      expect(result.isError).toBe(false);
      const chart = result.data!;
      expect(chart.timeKnown).toBe(false);
      expect(chart.castFor.basis).toBe('local-noon');
      expect(chart.rising).toMatchObject({ sign: null, possibleSigns: [] });
      expect(chart.angles).toBeNull();
      expect(chart.houseSystem).toBeNull();
      for (const planet of chart.planets as { house: unknown }[]) expect(planet.house).toBeNull();
      // The Moon entered Aries at 13:54:46 UTC that day (the engine's DE440 search): 09:54 in New York.
      expect(chart.moon).toMatchObject({ sign: null, possibleSigns: ['pisces', 'aries'] });
      expect((chart.unknown as string[]).join(' ')).toMatch(/rising sign and the houses are unknown/u);
      expect((chart.unknown as string[]).join(' ')).toMatch(/Moon changed sign that day/u);
    });

    it('names the Moon sign when it held all day', async () => {
      const chart = (await natal({ birthDate: '1990-06-15', zone: 'America/New_York', ...NEW_YORK })).data!;
      expect(chart.moon).toMatchObject({ sign: 'pisces', possibleSigns: ['pisces'] });
      expect(chart.rising.sign).toBeNull();
    });

    it('does not name a Sun sign on the day of the March equinox', async () => {
      // The equinox of 2000 fell at 07:35 UTC on 20 March: with no time and no zone, both signs are possible.
      const chart = (await natal({ birthDate: '2000-03-20' })).data!;
      expect(chart.sun).toMatchObject({ sign: null, possibleSigns: ['pisces', 'aries'] });
      expect((chart.unknown as string[]).join(' ')).toMatch(/Sun changed sign that day/u);
    });
  });

  describe('polar latitudes and leap days', () => {
    // No house system is asked for, so this is the default (whole sign), not a fallback from another system.
    it.each([78.2232, 89.9999, 90, -77.85, -90])('a chart at latitude %s has the default whole-sign houses, a position for every planet and both angles', async (latitude) => {
      const result = await natal({ birthDate: '2000-06-21', time: '12:00', zone: 'UTC', latitude, longitude: 15 });
      expect(result.isError).toBe(false);
      expect(result.data!.houseSystem).toBe('whole-sign');
      expectWholeChart(result.data!, true);
    });

    it.each(['1800-01-01T00:00:00Z', '2000-06-21T12:00:00Z', '2199-12-31T23:59:59Z'])('the sky at %s has a number for every longitude, latitude and speed', async (instant) => {
      const result = await call('get_sky', { instant });
      expect(result.isError).toBe(false);
      const bodies = result.data!.calculation.result.instants[0].bodies as Record<string, unknown>[];
      expect(bodies.length).toBeGreaterThanOrEqual(10);
      for (const body of bodies) for (const key of ['lon', 'lat', 'speed', 'degree']) expect(Number.isFinite(body[key]), `${String(body.body)} ${key}`).toBe(true);
    });

    it('takes 29 February 2000 and refuses 29 February 1900', async () => {
      expect((await natal({ birthDate: '2000-02-29' })).isError).toBe(false);
      const refused = await natal({ birthDate: '1900-02-29' });
      expect(refused.isError).toBe(true);
      expect(refused.error?.message).toMatch(/birthDate must be a real date/u);
    });

    it('takes 1800 and 1850, and refuses 1799 and 2200', async () => {
      for (const birthDate of ['1800-01-01', '1850-01-01']) {
        const taken = await natal({ birthDate, time: '00:00', zone: 'UTC' });
        expect(taken.isError, birthDate).toBe(false);
        expectWholeChart(taken.data!, false);
      }
      for (const birthDate of ['1799-12-31', '2200-01-01']) {
        const refused = await natal({ birthDate });
        expect(refused.isError, birthDate).toBe(true);
        expect(refused.error?.message, birthDate).toMatch(/1800 to 2199/u);
      }
    });
  });

  describe('the Sun\'s ingress of 22 November 2026', () => {
    // NAIF's de440.bsp puts it at 07:23:20.563 UTC (the engine repository's stored reference). This server
    // computes on astronomy-engine, which is later by under a minute: the minute before and the minute after
    // still fall on either side.
    it('has the Sun in Scorpio at 07:23:00 and in Sagittarius at 07:24:00', async () => {
      const sun = async (instant: string) => (await call('get_sky', { instant, bodies: ['Sun'] })).data!.calculation.result.instants[0].bodies[0] as { sign: string; lon: number };
      const before = await sun('2026-11-22T07:23:00Z');
      const after = await sun('2026-11-22T07:24:00Z');
      expect(before.sign).toBe('scorpio');
      expect(after.sign).toBe('sagittarius');
      expect(before.lon).toBeLessThan(240);
      expect(after.lon).toBeGreaterThanOrEqual(240);
    });

    it('reports its own ingress instant within 60 s of the DE440 reference, and names its ephemeris', async () => {
      const fact = (await call('check_sky_fact', { kind: 'ingress', body: 'Sun', sign: 'sagittarius', date: '2026-11-22', zone: 'America/New_York' })).data!;
      expect(fact.answer).toBe('true');
      const at = Date.parse(fact.calculation.result.facts.ingresses[0].at);
      expect(Math.abs(at - Date.parse('2026-11-22T07:23:20.563Z'))).toBeLessThan(60_000);
      // The frozen bundle names astronomy-engine: a silent change of source fails here.
      expect(fact.calculation.receipt.engine.ephemeris.name).toBe('astronomy-engine');
    });
  });

  it('the number walk fails on what JSON makes of a NaN', () => {
    // JSON.stringify writes NaN and Infinity as null: the walk has to see that, or "no NaN" could never fail.
    const sent = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;
    expect(() => everyNumberFinite(sent({ bodies: [{ body: 'Sun', lon: Number.NaN }] }), 'planted')).toThrow(/planted\.bodies\[0\]\.lon is null/u);
    expect(() => everyNumberFinite(sent({ aspects: [{ orb: Number.POSITIVE_INFINITY }] }), 'planted')).toThrow(/orb is null/u);
    expect(() => everyNumberFinite({ planets: [{ position: `${Number.NaN}°${Number.NaN}′ Cancer` }] }, 'planted')).toThrow(/position/u);
    expect(() => everyNumberFinite(sent({ bodies: [{ lon: 239.9995, lat: 0, speed: 1.0097, degree: 29.9995 }], rising: { sign: null }, house: null }), 'planted')).not.toThrow();
  });

  describe('malformed input is refused by name, and no chart is made', () => {
    it.each([
      ['an empty object', {}, /birthDate is required/u],
      ['30 February', { birthDate: '1990-02-30' }, /birthDate must be a real date/u],
      ['a day-first date', { birthDate: '15/06/1990' }, /birthDate/u],
      ['a null date', { birthDate: null }, /birthDate/u],
      ['a number for the date', { birthDate: 19900615 }, /birthDate/u],
      ['latitude 91', { birthDate: '1990-06-15', time: '14:30', zone: 'UTC', latitude: 91, longitude: 0 }, /latitude must be at most 90/u],
      ['latitude -90.0001', { birthDate: '1990-06-15', time: '14:30', zone: 'UTC', latitude: -90.0001, longitude: 0 }, /latitude/u],
      ['longitude 181', { birthDate: '1990-06-15', time: '14:30', zone: 'UTC', latitude: 0, longitude: 181 }, /longitude must be at most 180/u],
      ['coordinates as strings', { birthDate: '1990-06-15', time: '14:30', zone: 'UTC', latitude: '40.7', longitude: '-74' }, /latitude must be a number/u],
      ['a latitude with no longitude', { birthDate: '1990-06-15', time: '14:30', zone: 'UTC', latitude: 40.7 }, /latitude and longitude together/u],
      ['a time with no zone', { birthDate: '1990-06-15', time: '14:30' }, /needs its time zone/u],
      ['24:00', { birthDate: '1990-06-15', time: '24:00', zone: 'UTC' }, /time must be a time/u],
      ['a time with seconds', { birthDate: '1990-06-15', time: '14:30:15', zone: 'UTC' }, /time must be a time/u],
      ['a zone that does not exist', { birthDate: '1990-06-15', time: '14:30', zone: 'Mars/Phobos' }, /zone must be a time zone name/u],
      ['a field the tool does not take', { birthDate: '1990-06-15', lat: 40.7 }, /Leave out fields/u],
      ['a birth less than 13 years ago', { birthDate: FIVE_YEARS_AGO }, /under 13/u],
    ])('%s', async (_label, args, message) => {
      const result = await natal(args as Record<string, unknown>);
      expect(result.isError).toBe(true);
      expect(result.error?.code).toBe('invalid-request');
      expect(result.error?.message).toMatch(message);
      expect(result.data, 'no chart beside the error').toBeNull();
    });

    it('refuses a sky moment outside 1800 to 2199, or with no offset', async () => {
      for (const instant of ['1799-12-31T23:59:59Z', '2200-01-01T00:00:00Z', '2026-11-22T07:23:00', 'yesterday at noon, roughly']) {
        const result = await call('get_sky', { instant });
        expect(result.isError, instant).toBe(true);
        expect(result.data, instant).toBeNull();
      }
    });
  });
});
