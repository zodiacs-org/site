import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  SCHEMA,
  compare,
  contentDigest,
  distFile,
  fingerprint,
  pageContent,
  sitemapDates,
  textDifference,
} from './sitemap-rendered-changes.mjs';

const root = resolve(import.meta.dirname, '..');
const script = join(root, 'scripts/sitemap-rendered-changes.mjs');
const frozenClock = join(root, 'scripts/frozen-clock.mjs');

function sitemap(entries) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries.map(([path, lastmod]) => [
      '  <url>',
      `    <loc>https://zodiacs.org${path}</loc>`,
      `    <xhtml:link rel="alternate" hreflang="en" href="https://zodiacs.org${path}" />`,
      ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
      '  </url>',
    ].join('\n')),
    '</urlset>',
    '',
  ].join('\n');
}

function page({ title = 'Compare', description = 'How the engine compares.', main = '<p>Ten guides.</p>', nav = 'Home', footer = '© 2026' } = {}) {
  return `<!doctype html><html><head><title>${title}</title><meta name="description" content="${description}"><link rel="stylesheet" href="/_astro/a1b2.css"></head>`
    + `<body><nav><a href="/">${nav}</a></nav><main>${main}<script>window.x = 1;</script></main><footer>${footer}</footer></body></html>`;
}

let dir;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sitemap-rendered-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function build(name, sitemapEntries, pages) {
  const dist = join(dir, name);
  await mkdir(dist, { recursive: true });
  await writeFile(join(dist, 'sitemap.xml'), sitemap(sitemapEntries));
  for (const [path, html] of Object.entries(pages)) {
    const file = distFile(dist, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, html);
  }
  return dist;
}

describe('a page’s content', () => {
  it('is its title, description and main region, without scripts, navigation or footer', () => {
    const content = pageContent(page({ main: '<h1>Compare</h1><p>Ten <a href="/developers/docs/">guides</a> &amp; <img src="/x.png" alt="A wheel"> more.</p>' }));
    expect(content).toEqual({
      title: 'Compare',
      description: 'How the engine compares.',
      text: 'Compare Ten guides & more.',
      links: ['/developers/docs/'],
      images: ['A wheel'],
    });
  });

  it('ignores the navigation, the footer and the stylesheet links of the head', () => {
    const before = contentDigest(Buffer.from(page()), '/developers/compare/');
    expect(contentDigest(Buffer.from(page({ nav: 'Start', footer: '© 2027' })), '/developers/compare/')).toBe(before);
    expect(contentDigest(Buffer.from(page().replace('a1b2.css', 'c3d4.css')), '/developers/compare/')).toBe(before);
  });

  it('changes with the text, a link target, an image description, the title or the description', () => {
    const before = contentDigest(Buffer.from(page()), '/p/');
    for (const changed of [
      page({ main: '<p>Eleven guides.</p>' }),
      page({ main: '<p>Ten <a href="/new/">guides</a>.</p>' }),
      page({ main: '<p>Ten guides.</p><img alt="A chart">' }),
      page({ title: 'Compare engines' }),
      page({ description: 'How the engine compares with Swiss.' }),
    ]) {
      expect(contentDigest(Buffer.from(changed), '/p/')).not.toBe(before);
    }
  });

  it('falls back to the body without a main region, and counts other files by their bytes', () => {
    expect(pageContent('<html><body><p>Only a body</p></body></html>').text).toBe('Only a body');
    expect(contentDigest(Buffer.from('a'), '/feed.xml')).not.toBe(contentDigest(Buffer.from('b'), '/feed.xml'));
  });
});

describe('the sitemap', () => {
  it('maps each path to its lastmod, and refuses foreign or duplicate locations', () => {
    expect([...sitemapDates(sitemap([['/', '2026-10-14'], ['/a/', null]]))]).toEqual([['/', '2026-10-14'], ['/a/', null]]);
    expect(() => sitemapDates(sitemap([['/a/', '2026-10-14'], ['/a/', '2026-10-14']]))).toThrow(/twice/);
    expect(() => sitemapDates('<urlset><url><loc>https://example.com/</loc></url></urlset>')).toThrow(/not on/);
    expect(() => sitemapDates('<html></html>')).toThrow(/no <urlset>/);
  });
});

describe('comparing two builds', () => {
  it('fails a page whose content changed while its date did not, as #740 left /developers/compare/', async () => {
    const base = await build('base', [['/developers/compare/', '2026-10-11'], ['/developers/mcp/', '2026-10-12'], ['/privacy/', '2026-10-09'], ['/old/', '2026-01-01']], {
      '/developers/compare/': page(),
      '/developers/mcp/': page({ main: '<p>Three tools.</p>' }),
      '/privacy/': page({ main: '<p>Logs.</p>' }),
      '/old/': page(),
    });
    const head = await build('head', [['/developers/compare/', '2026-10-11'], ['/developers/mcp/', '2026-10-14'], ['/privacy/', '2026-10-14'], ['/new/', '2026-10-14']], {
      '/developers/compare/': page({ main: '<p>Ten guides, and how each compares.</p>' }),
      '/developers/mcp/': page({ main: '<p>Five tools.</p>' }),
      '/privacy/': page({ main: '<p>Logs.</p>' }),
      '/new/': page(),
    });
    const result = compare(await fingerprint(base), await fingerprint(head));
    expect(result).toMatchObject({
      compared: 3,
      unchanged: 0,
      changedAndRedated: ['/developers/mcp/'],
      redatedOnly: ['/privacy/'],
      added: ['/new/'],
      removed: ['/old/'],
      undated: [{ path: '/developers/compare/', lastmod: '2026-10-11' }],
    });
    expect(textDifference(await readFile(distFile(base, '/developers/compare/'), 'utf8'), await readFile(distFile(head, '/developers/compare/'), 'utf8')))
      .toEqual({ removed: ['Ten guides.'], added: ['Ten guides, and how each compares.'] });
  });

  it('passes two builds of the same pages, and refuses a file that is not a fingerprint', async () => {
    const pages = { '/': page(), '/a/': page({ main: '<p>A</p>' }) };
    const a = await fingerprint(await build('a', [['/', '2026-10-14'], ['/a/', '2026-10-01']], pages));
    const b = await fingerprint(await build('b', [['/', '2026-10-14'], ['/a/', '2026-10-01']], pages));
    expect(a.schema).toBe(SCHEMA);
    expect(compare(a, b)).toMatchObject({ compared: 2, unchanged: 2, undated: [] });
    expect(() => compare({ urls: {} }, b)).toThrow(/fingerprint/);
  });

  it('exits 1 from the command line with the page and its date, and 0 when every change is re-dated', async () => {
    const base = await build('cli-base', [['/developers/compute/', '2026-10-12']], { '/developers/compute/': page() });
    const head = await build('cli-head', [['/developers/compute/', '2026-10-12']], { '/developers/compute/': page({ main: '<p>atlasPlace rules.</p>' }) });
    const redated = await build('cli-redated', [['/developers/compute/', '2026-10-14']], { '/developers/compute/': page({ main: '<p>atlasPlace rules.</p>' }) });
    for (const [name, dist] of [['base', base], ['head', head], ['redated', redated]]) {
      execFileSync(process.execPath, [script, 'fingerprint', dist, join(dir, `${name}.json`)]);
    }
    let failure;
    try {
      execFileSync(process.execPath, [script, 'compare', join(dir, 'base.json'), join(dir, 'head.json'), '--explain', base, head], { encoding: 'utf8' });
    } catch (error) {
      failure = error;
    }
    expect(failure?.status).toBe(1);
    expect(failure.stdout).toContain('- /developers/compute/ (still 2026-10-12)');
    expect(failure.stdout).toContain('+ atlasPlace rules.');
    const ok = execFileSync(process.execPath, [script, 'compare', join(dir, 'base.json'), join(dir, 'redated.json')], { encoding: 'utf8' });
    expect(ok).toContain('Every page whose content changed has a new sitemap date.');
  });
});

describe('the pinned clock', () => {
  const read = 'console.log(JSON.stringify([Date.now(), new Date().toISOString(), Date(), new Date(0).toISOString(), new Date() instanceof Date, Date.UTC(2026, 0, 1), typeof performance.now()]))';
  const run = (env) => JSON.parse(execFileSync(process.execPath, ['--import', frozenClock, '-e', read], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  }));

  it('reads one instant for now, and leaves dates built from a value alone', () => {
    const [now, iso, string, epoch, isDate, utc, monotonic] = run({ ZODIACS_FROZEN_CLOCK: '2026-10-14T12:00:00Z' });
    expect(now).toBe(Date.parse('2026-10-14T12:00:00Z'));
    expect(iso).toBe('2026-10-14T12:00:00.000Z');
    expect(new Date(string).getTime()).toBe(now);
    expect(epoch).toBe('1970-01-01T00:00:00.000Z');
    expect(isDate).toBe(true);
    expect(utc).toBe(Date.UTC(2026, 0, 1));
    expect(monotonic).toBe('number');
  });

  it('changes nothing without ZODIACS_FROZEN_CLOCK, and refuses a value that is not a date', () => {
    const before = Date.now();
    const [now] = run({ ZODIACS_FROZEN_CLOCK: '' });
    expect(now).toBeGreaterThanOrEqual(before);
    expect(() => run({ ZODIACS_FROZEN_CLOCK: 'noon' })).toThrow(/not a date/);
  });
});
