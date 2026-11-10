import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleResultShareNodeRequest, type ResultShareRoute } from './result-preview';

/** The launch switches the share routes follow (src/lib/launch-flags.ts), read from process.env at run time. */
const FLAGS = ['PUBLIC_YEAR_SCORE_ENABLED', 'PUBLIC_YEAR_PEOPLE_ENABLED', 'PUBLIC_BIRTHDAY_REPORT_ENABLED', 'PUBLIC_SOLAR_RETURN_SHARE_ENABLED'] as const;

/** Each switched route, its switch and a query its handler accepts. */
const SWITCHED: readonly { route: ResultShareRoute; flag: (typeof FLAGS)[number]; query: Record<string, string> }[] = [
  { route: 'year-score-link', flag: 'PUBLIC_YEAR_SCORE_ENABLED', query: { s: 'taurus', v: '6.4' } },
  { route: 'year-score-image', flag: 'PUBLIC_YEAR_SCORE_ENABLED', query: { s: 'taurus', v: '6.4' } },
  { route: 'birthday-report-link', flag: 'PUBLIC_BIRTHDAY_REPORT_ENABLED', query: { s: 'leo', v: '6.4', py: '7', t: '17' } },
  { route: 'birthday-report-image', flag: 'PUBLIC_BIRTHDAY_REPORT_ENABLED', query: { s: 'leo', v: '6.4', py: '7', t: '17' } },
];

function nodeResponse() {
  const headers = new Map<string, string>();
  return {
    statusCode: 0,
    headers,
    body: Buffer.alloc(0) as Buffer,
    setHeader(name: string, value: string) { headers.set(name.toLowerCase(), value); },
    end(body: Buffer) { this.body = body; },
  };
}

async function statusOf(route: ResultShareRoute, query: Record<string, string>): Promise<number> {
  const res = nodeResponse();
  await handleResultShareNodeRequest({ method: 'GET', headers: { host: 'zodiacs.org' }, query: { __zodiacs_share: route, ...query } }, res, route);
  return res.statusCode;
}

const saved = new Map<string, string | undefined>();
beforeEach(() => {
  for (const flag of FLAGS) {
    saved.set(flag, process.env[flag]);
    delete process.env[flag];
  }
});
afterEach(() => {
  for (const flag of FLAGS) {
    const value = saved.get(flag);
    if (value === undefined) delete process.env[flag];
    else process.env[flag] = value;
  }
});

describe('share routes behind a launch switch', () => {
  it.each(SWITCHED)('$route is a 404 while its switch is off', async ({ route, query }) => {
    expect(await statusOf(route, query)).toBe(404);
  });

  it.each(SWITCHED)('$route is a 404 for anything but exactly 1', async ({ route, flag, query }) => {
    for (const value of ['', '0', 'true', ' 1']) {
      process.env[flag] = value;
      expect(await statusOf(route, query)).toBe(404);
    }
  });

  it.each(SWITCHED)('$route answers as before once its switch is 1', async ({ route, flag, query }) => {
    process.env[flag] = '1';
    expect(await statusOf(route, query)).toBe(200);
    expect(await statusOf(route, {})).toBe(route.endsWith('-image') ? 400 : 200);
  }, 30_000);

  it.each(['year-score-link', 'year-score-image'] as const)('%s keeps a public figure (p=) a 404 until the people switch is on as well', async (route) => {
    process.env.PUBLIC_YEAR_SCORE_ENABLED = '1';
    expect(await statusOf(route, { p: 'jensen-huang' })).toBe(404);
    process.env.PUBLIC_YEAR_PEOPLE_ENABLED = '1';
    expect(await statusOf(route, { p: 'jensen-huang' })).toBe(200);
    delete process.env.PUBLIC_YEAR_SCORE_ENABLED;
    expect(await statusOf(route, { p: 'jensen-huang' })).toBe(404);
  }, 30_000);
});
