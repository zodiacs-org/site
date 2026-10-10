import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STATUS_FEEDS, archiveStatusFeeds, readFeed } from './status-archive.mjs';

let out;
beforeEach(async () => { out = await mkdtemp(join(tmpdir(), 'status-archive-')); });
afterEach(async () => { await rm(out, { recursive: true, force: true }); });

const feedBody = JSON.stringify({ page: { id: 'x' }, incidents: [
  { id: 'b', created_at: '2026-10-12T09:00:00.000Z' },
  { id: 'a', created_at: '2026-09-30T18:30:00.000Z' },
] });
const reply = (status, body) => async () => new Response(body, { status });

describe('status archive', () => {
  it('lists only public Statuspage incident feeds, each once', () => {
    expect(new Set(STATUS_FEEDS.map((feed) => feed.slug)).size).toBe(STATUS_FEEDS.length);
    for (const feed of STATUS_FEEDS) expect(feed.url).toMatch(/^https:\/\/[a-z0-9.-]+\/api\/v2\/incidents\.json$/u);
  });

  it('keeps the feed exactly as received and records its span', async () => {
    const summary = await archiveStatusFeeds(out, {
      feeds: [{ slug: 'one', name: 'One', url: 'https://one.example/api/v2/incidents.json' }],
      fetchImpl: reply(200, feedBody),
      now: () => new Date('2026-10-13T03:41:00.000Z'),
    });
    expect(await readFile(join(out, 'one.json'), 'utf8')).toBe(feedBody);
    expect(summary).toEqual({ schema: 'zodiacs.status-archive.v1', savedAt: '2026-10-13T03:41:00.000Z', feeds: [
      { slug: 'one', name: 'One', url: 'https://one.example/api/v2/incidents.json', ok: true, incidents: 2, oldest: '2026-09-30T18:30:00.000Z', newest: '2026-10-12T09:00:00.000Z' },
    ] });
    expect(JSON.parse(await readFile(join(out, 'summary.json'), 'utf8'))).toEqual(summary);
  });

  it('records a feed it could not read and saves nothing for it', async () => {
    const feeds = [
      { slug: 'down', name: 'Down', url: 'https://down.example/api/v2/incidents.json' },
      { slug: 'odd', name: 'Odd', url: 'https://odd.example/api/v2/incidents.json' },
      { slug: 'broken', name: 'Broken', url: 'https://broken.example/api/v2/incidents.json' },
    ];
    const answers = { down: reply(503, ''), odd: reply(200, '{"page":{}}'), broken: async () => { throw new Error('connection reset'); } };
    const summary = await archiveStatusFeeds(out, { feeds, fetchImpl: (url, init) => answers[new URL(url).hostname.split('.')[0]](url, init) });
    expect(summary.feeds.map(({ slug, ok, error }) => [slug, ok, error])).toEqual([
      ['down', false, 'HTTP 503'], ['odd', false, 'no incidents list'], ['broken', false, 'connection reset'],
    ]);
    expect(await readdir(out)).toEqual(['summary.json']);
  });

  it('gives up on a feed that does not answer in time', async () => {
    const hang = (url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
    expect(await readFeed({ url: 'https://slow.example/api/v2/incidents.json' }, hang, 20)).toEqual({ ok: false, error: 'timed out' });
  });
});
