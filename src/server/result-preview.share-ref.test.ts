import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ARRIVAL_REF_VALUES } from '../lib/analytics-config.mjs';
import { readShareRef, SHARE_REFS } from '../lib/share-results';
import { handleResultShareNodeRequest, type ResultShareRoute } from './result-preview';

/**
 * Every share family opens its own result, with its own preview image and story picture, for each `ref` word a
 * link the site gives out may carry (src/lib/analytics-config.mjs, ARRIVAL_REF_VALUES), and keeps refusing any
 * other word. The share page never passes the word on to its buttons.
 */

const TODAY = (JSON.parse(readFileSync(new URL('../data/horoscope-window.json', import.meta.url), 'utf8')) as { generatedFor: string }).generatedFor;

/**
 * Each family, a query its handler accepts, whether it has a story picture, and what its page answers today for a
 * query that is not a share: the plain page (200), or for a famous chart's slug a 404, as for an unknown person.
 */
const FAMILIES: readonly { family: string; query: string; story: boolean; plain?: 200 | 404 }[] = [
  { family: 'compatibility', query: 'as=leo&bs=libra&score=78&attraction=82&communication=71&stability=80&v=strong', story: true },
  { family: 'occasion', query: 'o=wedding&d=2027-06-12&sun=gemini&moon=libra&score=84&v=excellent', story: true },
  { family: 'birthday', query: 'd=05-03', story: true },
  { family: 'sky-calendar', query: 'k=retrograde&b=mercury&d=2026-10-24', story: true },
  { family: 'horoscope', query: `s=leo&d=${TODAY}`, story: true },
  { family: 'chart-twins', query: 's=taurus&m=leo', story: true },
  { family: 'famous-chart', query: 'p=frida-kahlo', story: true, plain: 404 },
  { family: 'milestone', query: 'k=saturn-return&i=1&a=29', story: true },
  { family: 'big-three', query: 's=leo&m=aries&r=libra', story: true },
  { family: 'chinese-zodiac', query: 'a=horse', story: true },
  { family: 'invite', query: 's=taurus&p=scorpio', story: true },
  { family: 'year-score', query: 's=taurus&v=6.4', story: false },
  { family: 'birthday-report', query: 's=leo&v=6.4&t=17', story: false },
  { family: 'solar-return', query: 's=taurus&y=2027&r=leo&j=leo', story: false },
];

const FLAGS = ['PUBLIC_YEAR_SCORE_ENABLED', 'PUBLIC_BIRTHDAY_REPORT_ENABLED', 'PUBLIC_SOLAR_RETURN_SHARE_ENABLED'] as const;
const saved = new Map<string, string | undefined>();
beforeAll(() => {
  for (const flag of FLAGS) {
    saved.set(flag, process.env[flag]);
    process.env[flag] = '1';
  }
});
afterAll(() => {
  for (const flag of FLAGS) {
    const value = saved.get(flag);
    if (value === undefined) delete process.env[flag];
    else process.env[flag] = value;
  }
});

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

async function send(route: string, query: string) {
  const res = nodeResponse();
  await handleResultShareNodeRequest(
    { method: 'GET', headers: { host: 'zodiacs.org' }, query: { __zodiacs_share: route, ...Object.fromEntries(new URLSearchParams(query)) } },
    res,
    route as ResultShareRoute,
  );
  return res;
}

const ownImage = (family: string) => `content="https://zodiacs.org/api/og/${family}-image?`;

describe('the ref words a share link may carry', () => {
  it('are the arrival words, less any default such as direct, in one list', () => {
    expect(SHARE_REFS).toEqual(ARRIVAL_REF_VALUES.filter((ref) => ref !== 'direct'));
    expect([...SHARE_REFS].sort()).toEqual(['app', 'assistant', 'card', 'chatgpt', 'note', 'video']);
    for (const ref of SHARE_REFS) expect(readShareRef(ref)).toBe(ref);
    expect(readShareRef(undefined)).toBeNull();
    for (const ref of ['', 'direct', 'tiktok', 'CARD', 'card ', 'chatgpt,card']) expect(readShareRef(ref)).toBeUndefined();
  });
});

describe.each(FAMILIES)('the $family share family', ({ family, query, story, plain = 200 }) => {
  it('opens its own result for every listed ref word, and never passes the word on', async () => {
    for (const ref of SHARE_REFS) {
      const res = await send(`${family}-link`, `${query}&ref=${ref}`);
      expect(res.statusCode, ref).toBe(200);
      const html = res.body.toString();
      expect(html, ref).toContain(ownImage(family));
      expect(html, ref).not.toMatch(/[?&;]ref=/u);
    }
  });

  it('draws its preview image, and its story picture, with ref=card', async () => {
    const image = await send(`${family}-image`, `${query}&ref=card`);
    expect(image.statusCode).toBe(200);
    expect(image.headers.get('content-type')).toMatch(/^image\//u);
    if (story) {
      const picture = await send(`${family}-story`, `${query}&ref=card`);
      expect(picture.statusCode).toBe(200);
      expect(picture.headers.get('content-type')).toMatch(/^image\//u);
    }
  }, 30_000);

  it('keeps treating a word off the list as no share: the plain page, and a 400 for the pictures', async () => {
    const page = await send(`${family}-link`, `${query}&ref=tiktok`);
    expect(page.statusCode).toBe(plain);
    expect(page.body.toString()).not.toContain(ownImage(family));
    expect(page.body.toString()).not.toContain('tiktok');
    expect((await send(`${family}-image`, `${query}&ref=tiktok`)).statusCode).toBe(400);
    if (story) expect((await send(`${family}-story`, `${query}&ref=tiktok`)).statusCode).toBe(400);
  });
});
