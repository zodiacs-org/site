import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleResultShareNodeRequest, type ResultShareRoute } from './result-preview';

/** The launch switches the share routes follow (src/lib/launch-flags.ts), read from process.env at run time. */
const FLAGS = ['PUBLIC_YEAR_SCORE_ENABLED', 'PUBLIC_YEAR_PEOPLE_ENABLED', 'PUBLIC_BIRTHDAY_REPORT_ENABLED', 'PUBLIC_SOLAR_RETURN_SHARE_ENABLED', 'PUBLIC_YOUR_DAY_ENABLED'] as const;

/** Each switched route, its switch and a query its handler accepts. */
const SWITCHED: readonly { route: ResultShareRoute; flag: (typeof FLAGS)[number]; query: Record<string, string> }[] = [
  { route: 'year-score-link', flag: 'PUBLIC_YEAR_SCORE_ENABLED', query: { s: 'taurus', v: '6.4' } },
  { route: 'year-score-image', flag: 'PUBLIC_YEAR_SCORE_ENABLED', query: { s: 'taurus', v: '6.4' } },
  { route: 'birthday-report-link', flag: 'PUBLIC_BIRTHDAY_REPORT_ENABLED', query: { s: 'leo', v: '6.4', t: '17' } },
  { route: 'birthday-report-image', flag: 'PUBLIC_BIRTHDAY_REPORT_ENABLED', query: { s: 'leo', v: '6.4', t: '17' } },
  { route: 'solar-return-link', flag: 'PUBLIC_SOLAR_RETURN_SHARE_ENABLED', query: { s: 'taurus', y: '2027', r: 'leo', j: 'leo' } },
  { route: 'solar-return-image', flag: 'PUBLIC_SOLAR_RETURN_SHARE_ENABLED', query: { s: 'taurus', y: '2027', r: 'leo', j: 'leo' } },
  { route: 'your-day-link', flag: 'PUBLIC_YOUR_DAY_ENABLED', query: { day: '2026-11-09', p: 'mars', a: 'square', n: 'sun', c: '75' } },
  { route: 'your-day-image', flag: 'PUBLIC_YOUR_DAY_ENABLED', query: { day: '2026-11-09', p: 'mars', a: 'square', n: 'sun', c: '75' } },
  { route: 'your-day-story', flag: 'PUBLIC_YOUR_DAY_ENABLED', query: { day: '2026-11-09', p: 'mars', a: 'square', n: 'sun', c: '75' } },
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
    expect(await statusOf(route, {})).toBe(route.endsWith('-link') ? 200 : 400);
  }, 30_000);

  it.each(['year-score-link', 'year-score-image'] as const)('%s keeps a public figure (p=) a 404 until the people switch is on as well', async (route) => {
    process.env.PUBLIC_YEAR_SCORE_ENABLED = '1';
    expect(await statusOf(route, { p: 'jensen-huang' })).toBe(404);
    process.env.PUBLIC_YEAR_PEOPLE_ENABLED = '1';
    expect(await statusOf(route, { p: 'jensen-huang' })).toBe(200);
    delete process.env.PUBLIC_YEAR_SCORE_ENABLED;
    expect(await statusOf(route, { p: 'jensen-huang' })).toBe(404);
  }, 30_000);

  describe('a birthday report link that still carries the Personal Year (py)', () => {
    const REPORT = { s: 'capricorn', v: '6.8', t: '13' };
    const PERSONAL = 'My birthday report: 6.8/10, Capricorn Sun';
    const send = async (route: 'birthday-report-link' | 'birthday-report-image', query: Record<string, string | string[]>) => {
      const res = nodeResponse();
      await handleResultShareNodeRequest({ method: 'GET', headers: { host: 'zodiacs.org' }, query: { __zodiacs_share: route, ...query } }, res, route);
      return { status: res.statusCode, body: res.body.toString('utf8') };
    };
    const WITH_PY: readonly [string, Record<string, string | string[]>][] = [
      ['once', { ...REPORT, py: '4' }],
      ['repeated', { ...REPORT, py: ['4', '5'] }],
      ['first', { py: '4', ...REPORT }],
      ['empty', { ...REPORT, py: '' }],
    ];

    beforeEach(() => { process.env.PUBLIC_BIRTHDAY_REPORT_ENABLED = '1'; });

    it('opens the page with the result, and skips an app\'s fbclid or utm_source as before', async () => {
      expect((await send('birthday-report-link', REPORT)).body).toContain(PERSONAL);
      const opened = await send('birthday-report-link', { ...REPORT, fbclid: 'IwAR0', utm_source: 'share' });
      expect(opened.status).toBe(200);
      expect(opened.body).toContain(PERSONAL);
    });

    it.each(WITH_PY)('opens the page without a result when py is there (%s)', async (_, query) => {
      const page = await send('birthday-report-link', query);
      expect(page.status).toBe(200);
      expect(page.body).not.toContain(PERSONAL);
      expect(page.body).not.toContain('6.8');
      expect(page.body).not.toContain('Personal Year 4');
      expect(page.body).toContain('Your birthday report');
    });

    it.each(WITH_PY)('refuses the image when py is there (%s)', async (_, query) => {
      expect((await send('birthday-report-image', query)).status).toBe(400);
    });
  });

  it('links the solar return share page to the Year Ahead Score only while that switch is on', async () => {
    process.env.PUBLIC_SOLAR_RETURN_SHARE_ENABLED = '1';
    const html = async () => {
      const res = nodeResponse();
      await handleResultShareNodeRequest({ method: 'GET', headers: { host: 'zodiacs.org' }, query: { __zodiacs_share: 'solar-return-link', s: 'taurus', y: '2027', r: 'leo', j: 'leo' } }, res, 'solar-return-link');
      return res.body.toString('utf8');
    };
    expect(await html()).not.toContain('/year-score/');
    process.env.PUBLIC_YEAR_SCORE_ENABLED = '1';
    expect(await html()).toContain('/year-score/');
  });
});
