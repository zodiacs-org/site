import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { handleResultShareNodeRequest, type ResultShareRoute } from './result-preview';

/** The launch switches the share routes follow (src/lib/launch-flags.ts), read from process.env at run time. */
const FLAGS = ['PUBLIC_ASTROCARTOGRAPHY_ENABLED'] as const;

/** Each switched route, its switch and a query its handler accepts. */
const SWITCHED: readonly { route: ResultShareRoute; flag: (typeof FLAGS)[number]; query: Record<string, string> }[] = [
  { route: 'astrocartography-link', flag: 'PUBLIC_ASTROCARTOGRAPHY_ENABLED', query: { p: 'venus', a: 'mc' } },
  { route: 'astrocartography-image', flag: 'PUBLIC_ASTROCARTOGRAPHY_ENABLED', query: { p: 'venus', a: 'mc' } },
  { route: 'astrocartography-story', flag: 'PUBLIC_ASTROCARTOGRAPHY_ENABLED', query: { p: 'venus', a: 'mc' } },
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
});
