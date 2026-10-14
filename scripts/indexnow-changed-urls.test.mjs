import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BOOTSTRAP_DAYS,
  INDEXNOW_ENDPOINT,
  SITEMAP_URL,
  SNAPSHOT_SCHEMA,
  bootstrapSince,
  changedUrls,
  parseSitemap,
  readIndexNowKey,
  renderReport,
  runIndexNow,
  submitUrls,
  urlsDatedSince,
} from './indexnow-changed-urls.mjs';

const root = resolve(import.meta.dirname, '..');
const site = (path) => `https://zodiacs.org${path}`;

function sitemap(entries) {
  const blocks = entries.map(([loc, lastmod]) => [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <xhtml:link rel="alternate" hreflang="en" href="${loc}" />`,
    ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
    '  </url>',
  ].join('\n'));
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...blocks,
    '</urlset>',
    '',
  ].join('\n');
}

/** A stand-in for IndexNow (and the live sitemap) that records each request. */
function stub({ statuses = [200], sitemapXml = null } = {}) {
  const posts = [];
  const gets = [];
  const fetchImpl = async (url, init = {}) => {
    if (init.method === 'POST') {
      posts.push({ url, body: JSON.parse(init.body) });
      const status = statuses[Math.min(posts.length - 1, statuses.length - 1)];
      if (status instanceof Error) throw status;
      return new Response(status === 200 || status === 202 ? '' : 'refused', { status });
    }
    gets.push(url);
    return new Response(sitemapXml, { status: sitemapXml ? 200 : 503 });
  };
  return { fetchImpl, posts, gets };
}

const noPause = async () => {};

describe('parseSitemap', () => {
  it('maps each loc to its lastmod and decodes XML entities', () => {
    const urls = parseSitemap(sitemap([
      [site('/'), '2026-10-03'],
      [site('/developers/docs/'), '2026-10-12'],
      [site('/search/?q=a&amp;b'), null],
    ]));
    expect([...urls]).toEqual([
      [site('/'), '2026-10-03'],
      [site('/developers/docs/'), '2026-10-12'],
      [site('/search/?q=a&b'), null],
    ]);
  });

  it('refuses a sitemap it cannot trust', () => {
    expect(() => parseSitemap('<html></html>')).toThrow('no <urlset>');
    expect(() => parseSitemap(sitemap([]))).toThrow('lists no URLs');
    expect(() => parseSitemap(sitemap([['https://example.org/', '2026-10-12']]))).toThrow('outside https://zodiacs.org');
    expect(() => parseSitemap(sitemap([['https://zodiacs.org', '2026-10-12']]))).toThrow('not in canonical form');
    expect(() => parseSitemap(sitemap([[site('/a/'), '2026-10-12'], [site('/a/'), '2026-10-11']]))).toThrow('twice');
    expect(() => parseSitemap('<urlset><url><lastmod>2026-10-12</lastmod></url></urlset>')).toThrow('no <loc>');
  });
});

describe('changedUrls', () => {
  it('lists new, changed and removed URLs, each sorted, and leaves the rest', () => {
    const previous = new Map([[site('/b/'), '2026-10-01'], [site('/a/'), '2026-10-01'], [site('/gone/'), '2026-09-01'], [site('/same/'), null]]);
    const current = new Map([[site('/b/'), '2026-10-12'], [site('/a/'), '2026-10-11'], [site('/new/'), '2026-10-12'], [site('/same/'), null]]);
    expect(changedUrls(previous, current)).toEqual({
      added: [site('/new/')],
      changed: [site('/a/'), site('/b/')],
      removed: [site('/gone/')],
    });
  });
});

describe('the bootstrap window', () => {
  it(`spans the ${BOOTSTRAP_DAYS} days before the run`, () => {
    expect(bootstrapSince('2026-10-12')).toBe('2026-09-12');
    expect(bootstrapSince('2026-03-01')).toBe('2026-01-30');
    expect(() => bootstrapSince('2026-13-01')).toThrow('Invalid date');
  });

  it('takes the URLs dated on or after its first day, by date', () => {
    const current = new Map([
      [site('/old/'), '2026-09-11'],
      [site('/first-day/'), '2026-09-12'],
      [site('/stamped/'), '2026-10-01T10:00:00+00:00'],
      [site('/undated/'), null],
    ]);
    expect(urlsDatedSince(current, '2026-09-12')).toEqual([site('/first-day/'), site('/stamped/')]);
  });
});

describe('the IndexNow key', () => {
  let dir;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'indexnow-key-')); });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  it('is the one key file the site serves', async () => {
    const { key, keyLocation } = await readIndexNowKey(resolve(root, 'public'));
    expect(key).toMatch(/^[A-Za-z0-9-]{8,128}$/u);
    expect(keyLocation).toBe(`https://zodiacs.org/${key}.txt`);
    expect((await readFile(resolve(root, 'public', `${key}.txt`), 'utf8')).trim()).toBe(key);
    // The daily workflow notifies IndexNow with the same key file.
    const daily = await readFile(resolve(root, '.github/workflows/daily-horoscopes.yml'), 'utf8');
    expect(daily).toContain(`/^${key.split('-')[0]}-.*\\.txt$/`);
  });

  it('needs exactly one file whose name and body are the same key', async () => {
    await writeFile(join(dir, 'robots.txt'), 'User-agent: *\n');
    await writeFile(join(dir, 'llms-full.txt'), '# not a key\n');
    await expect(readIndexNowKey(dir)).rejects.toThrow('found 0');
    await writeFile(join(dir, 'aaaa1111-bbbb.txt'), 'aaaa1111-bbbb\n');
    await expect(readIndexNowKey(dir)).resolves.toEqual({ key: 'aaaa1111-bbbb', keyLocation: 'https://zodiacs.org/aaaa1111-bbbb.txt' });
    await writeFile(join(dir, 'cccc2222-dddd.txt'), 'cccc2222-dddd');
    await expect(readIndexNowKey(dir)).rejects.toThrow('found 2');
  });
});

describe('submitUrls', () => {
  const key = { key: 'aaaa1111-bbbb', keyLocation: 'https://zodiacs.org/aaaa1111-bbbb.txt' };
  const urls = ['/1/', '/2/', '/3/', '/4/', '/5/'].map(site);

  it('posts the host, key, key location and URLs in requests of at most the limit', async () => {
    const { fetchImpl, posts } = stub({ statuses: [200, 202, 200] });
    await expect(submitUrls(urls, { ...key, fetchImpl, pause: noPause, maxPerRequest: 2 })).resolves.toEqual([200, 202, 200]);
    expect(posts.map(({ url }) => url)).toEqual([INDEXNOW_ENDPOINT, INDEXNOW_ENDPOINT, INDEXNOW_ENDPOINT]);
    expect(posts.map(({ body }) => body.urlList)).toEqual([urls.slice(0, 2), urls.slice(2, 4), urls.slice(4)]);
    for (const { body } of posts) {
      expect(body).toMatchObject({ host: 'zodiacs.org', key: key.key, keyLocation: key.keyLocation });
    }
  });

  it('retries a server error or a failed request, and fails on any other refusal at once', async () => {
    const retried = stub({ statuses: [503, new TypeError('fetch failed'), 200] });
    await expect(submitUrls(urls, { ...key, fetchImpl: retried.fetchImpl, pause: noPause })).resolves.toEqual([200]);
    expect(retried.posts).toHaveLength(3);

    for (const status of [400, 403, 422, 429]) {
      const refused = stub({ statuses: [status] });
      await expect(submitUrls(urls, { ...key, fetchImpl: refused.fetchImpl, pause: noPause })).rejects.toThrow(`HTTP ${status}: refused`);
      expect(refused.posts).toHaveLength(1);
    }

    const down = stub({ statuses: [503] });
    await expect(submitUrls(urls, { ...key, fetchImpl: down.fetchImpl, pause: noPause })).rejects.toThrow('HTTP 503');
    expect(down.posts).toHaveLength(3);
  });
});

describe('runIndexNow', () => {
  let dir;
  let snapshotPath;
  let publicDir;
  const now = () => '2026-10-12T06:00:00.000Z';
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'indexnow-run-'));
    snapshotPath = join(dir, '.indexnow', 'sitemap.json');
    publicDir = join(dir, 'public');
    await mkdir(publicDir);
    await writeFile(join(publicDir, 'aaaa1111-bbbb.txt'), 'aaaa1111-bbbb\n');
  });
  afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

  const previousSitemap = sitemap([
    [site('/'), '2026-10-03'],
    [site('/developers/compute/'), '2026-10-11'],
    [site('/eclipses/'), '2026-07-10'],
    [site('/retired/'), '2026-07-10'],
  ]);
  const currentSitemap = sitemap([
    [site('/'), '2026-10-03'],
    [site('/developers/compute/'), '2026-10-12'],
    [site('/developers/docs/'), '2026-10-12'],
    [site('/eclipses/'), '2026-07-10'],
  ]);
  const snapshot = async () => JSON.parse(await readFile(snapshotPath, 'utf8'));

  it('without a snapshot, submits the URLs dated within the window and records the sitemap', async () => {
    const { fetchImpl, posts } = stub();
    const result = await runIndexNow({ snapshotPath, publicDir, sitemapXml: currentSitemap, date: '2026-10-12', now, fetchImpl, pause: noPause });
    expect(result).toMatchObject({ mode: 'bootstrap', since: '2026-09-12', count: 4, statuses: [200] });
    expect(posts).toHaveLength(1);
    expect(posts[0].body.urlList).toEqual([site('/'), site('/developers/compute/'), site('/developers/docs/')]);
    expect(await snapshot()).toEqual({
      schema: SNAPSHOT_SCHEMA,
      sitemap: SITEMAP_URL,
      readAt: '2026-10-12T06:00:00.000Z',
      urls: {
        [site('/')]: '2026-10-03',
        [site('/developers/compute/')]: '2026-10-12',
        [site('/developers/docs/')]: '2026-10-12',
        [site('/eclipses/')]: '2026-07-10',
      },
    });
    expect(renderReport(result)).toContain('No earlier sitemap was recorded. The sitemap read at 2026-10-12T06:00:00.000Z lists 4 URLs; 3 are dated 2026-09-12 or later.');
  });

  it('with a snapshot, submits only the new, changed and removed URLs, then records the sitemap read', async () => {
    await runIndexNow({ snapshotPath, publicDir, sitemapXml: previousSitemap, date: '2026-10-11', now: () => '2026-10-11T06:00:00.000Z', fetchImpl: stub().fetchImpl, pause: noPause });
    const { fetchImpl, posts } = stub({ statuses: [202] });
    const result = await runIndexNow({ snapshotPath, publicDir, sitemapXml: currentSitemap, now, fetchImpl, pause: noPause });
    expect(result).toMatchObject({
      mode: 'changes',
      previousReadAt: '2026-10-11T06:00:00.000Z',
      previousCount: 4,
      added: [site('/developers/docs/')],
      changed: [site('/developers/compute/')],
      removed: [site('/retired/')],
      statuses: [202],
    });
    expect(posts.map(({ body }) => body.urlList)).toEqual([[site('/developers/compute/'), site('/developers/docs/'), site('/retired/')]]);
    expect((await snapshot()).urls).not.toHaveProperty(site('/retired/'));
    expect((await snapshot()).readAt).toBe('2026-10-12T06:00:00.000Z');
    const report = renderReport(result);
    expect(report).toContain('1 new, 1 changed, 1 removed');
    expect(report).toContain('Submitted 3 URLs to IndexNow (HTTP 202).');
  });

  it('sends nothing when nothing changed', async () => {
    await runIndexNow({ snapshotPath, publicDir, sitemapXml: currentSitemap, date: '2026-10-12', now: () => '2026-10-12T05:00:00.000Z', fetchImpl: stub().fetchImpl, pause: noPause });
    const { fetchImpl, posts } = stub();
    const result = await runIndexNow({ snapshotPath, publicDir, sitemapXml: currentSitemap, now, fetchImpl, pause: noPause });
    expect(posts).toHaveLength(0);
    expect(result.urls).toEqual([]);
    expect(renderReport(result)).toContain('Nothing to submit.');
  });

  it('keeps the previous snapshot when IndexNow refuses, so the next run submits the same URLs', async () => {
    await runIndexNow({ snapshotPath, publicDir, sitemapXml: previousSitemap, date: '2026-10-11', now: () => '2026-10-11T06:00:00.000Z', fetchImpl: stub().fetchImpl, pause: noPause });
    const before = await readFile(snapshotPath, 'utf8');
    await expect(runIndexNow({ snapshotPath, publicDir, sitemapXml: currentSitemap, now, fetchImpl: stub({ statuses: [403] }).fetchImpl, pause: noPause }))
      .rejects.toThrow('IndexNow refused the submission: HTTP 403');
    expect(await readFile(snapshotPath, 'utf8')).toBe(before);

    const { fetchImpl, posts } = stub();
    await runIndexNow({ snapshotPath, publicDir, sitemapXml: currentSitemap, now, fetchImpl, pause: noPause });
    expect(posts[0].body.urlList).toEqual([site('/developers/compute/'), site('/developers/docs/'), site('/retired/')]);
  });

  it('refuses a sitemap that lost more than half its URLs', async () => {
    await runIndexNow({ snapshotPath, publicDir, sitemapXml: previousSitemap, date: '2026-10-11', now: () => '2026-10-11T06:00:00.000Z', fetchImpl: stub().fetchImpl, pause: noPause });
    const before = await readFile(snapshotPath, 'utf8');
    const { fetchImpl, posts } = stub();
    await expect(runIndexNow({ snapshotPath, publicDir, sitemapXml: sitemap([[site('/'), '2026-10-03']]), now, fetchImpl, pause: noPause }))
      .rejects.toThrow('fewer than half the 4');
    expect(posts).toHaveLength(0);
    expect(await readFile(snapshotPath, 'utf8')).toBe(before);
  });

  it('refuses a snapshot it did not write', async () => {
    await mkdir(join(dir, '.indexnow'));
    await writeFile(snapshotPath, JSON.stringify({ schema: 'something-else', urls: {} }));
    await expect(runIndexNow({ snapshotPath, publicDir, sitemapXml: currentSitemap, now, fetchImpl: stub().fetchImpl, pause: noPause }))
      .rejects.toThrow(`is not a ${SNAPSHOT_SCHEMA} snapshot`);
  });

  it('in a dry run, neither sends nor records anything', async () => {
    const { fetchImpl, posts } = stub();
    const result = await runIndexNow({ snapshotPath, publicDir, sitemapXml: currentSitemap, date: '2026-10-12', now, fetchImpl, pause: noPause, dryRun: true });
    expect(posts).toHaveLength(0);
    await expect(readFile(snapshotPath, 'utf8')).rejects.toThrow('ENOENT');
    expect(renderReport(result)).toContain('Would submit 3 URLs (dry run; nothing was sent or recorded).');
  });

  it('reads the live sitemap, and records nothing when it cannot', async () => {
    const live = stub({ sitemapXml: currentSitemap });
    await runIndexNow({ snapshotPath, publicDir, date: '2026-10-12', now, fetchImpl: live.fetchImpl, pause: noPause });
    expect(live.gets).toEqual([SITEMAP_URL]);
    expect(live.posts).toHaveLength(1);

    await rm(snapshotPath);
    const down = stub();
    await expect(runIndexNow({ snapshotPath, publicDir, date: '2026-10-12', now, fetchImpl: down.fetchImpl, pause: noPause }))
      .rejects.toThrow(`Could not read ${SITEMAP_URL}: HTTP 503`);
    expect(down.gets).toHaveLength(3);
    expect(down.posts).toHaveLength(0);
    await expect(readFile(snapshotPath, 'utf8')).rejects.toThrow('ENOENT');
  });
});

describe('the IndexNow workflow', () => {
  it('runs from the default branch on Vercel production events, with no secret', async () => {
    const workflow = await readFile(resolve(root, '.github/workflows/indexnow-changes.yml'), 'utf8');
    expect(workflow).toContain('repository_dispatch:');
    expect(workflow).toContain("- 'vercel.deployment.ready'");
    expect(workflow).toContain("- 'vercel.deployment.promoted'");
    // Instant Rollbacks send no dispatch: a run every six hours catches them, and lost dispatches.
    expect(workflow).toMatch(/^ {2}schedule:\n {4}- cron: '41 \*\/6 \* \* \*'$/mu);
    expect(workflow).toContain("github.event_name == 'schedule' || (");
    expect([...workflow.matchAll(/^ {2}([a-z_]+):$/gmu)].map((match) => match[1]).slice(0, 2)).toEqual(['repository_dispatch', 'schedule']);
    expect(workflow).not.toMatch(/^\s*deployment_status\s*:/mu);
    expect(workflow).toContain("github.actor == 'vercel[bot]'");
    expect(workflow).toContain("github.event.client_payload.environment == 'production'");
    expect(workflow).toContain('github.event.client_payload.project.id == vars.VERCEL_PROJECT_ID');
    expect(workflow).toContain("github.event.client_payload.project.name == 'zodiacs-org'");
    expect(workflow).toContain('ref: ${{ github.event.repository.default_branch }}');
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).not.toContain('client_payload.git.sha');
    expect(workflow).not.toContain('secrets.');
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).toMatch(/concurrency:\n {2}group: indexnow-production\n {2}cancel-in-progress: false/u);
    for (const [, reference] of workflow.matchAll(/uses: (\S+)/gu)) {
      expect(reference).toMatch(/@[0-9a-f]{40}$/u);
    }
  });

  it('records the sitemap only after the submission succeeded', async () => {
    const workflow = await readFile(resolve(root, '.github/workflows/indexnow-changes.yml'), 'utf8');
    const restore = workflow.indexOf('uses: actions/cache/restore@');
    const submit = workflow.indexOf('run: node scripts/indexnow-changed-urls.mjs --snapshot .indexnow/sitemap.json');
    const save = workflow.indexOf('uses: actions/cache/save@');
    expect(restore).toBeGreaterThan(-1);
    expect(submit).toBeGreaterThan(restore);
    expect(save).toBeGreaterThan(submit);
    expect(workflow.slice(save)).not.toMatch(/if: .*always\(\)|continue-on-error/u);
    expect(workflow.match(/actions\/cache\/(?:restore|save)@([0-9a-f]{40})/gu)).toHaveLength(2);
    expect(new Set([...workflow.matchAll(/actions\/cache\/(?:restore|save)@([0-9a-f]{40})/gu)].map((match) => match[1])).size).toBe(1);
    expect([...workflow.matchAll(/path: (\S+)/gu)].map((match) => match[1])).toEqual(['.indexnow', '.indexnow']);
    expect([...workflow.matchAll(/ key: (\S+)/gu)].map((match) => match[1])).toEqual([
      'indexnow-sitemap-v1-${{', 'indexnow-sitemap-v1-${{',
    ]);
    expect(workflow).toContain('restore-keys: indexnow-sitemap-v1-\n');
  });
});
