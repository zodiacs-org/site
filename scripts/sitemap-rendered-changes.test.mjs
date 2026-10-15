import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LABEL_ATTRIBUTES,
  MEDIA_ATTRIBUTES,
  SCHEMA,
  compare,
  contentDigest,
  distFile,
  fingerprint,
  pageContent,
  pageStylesheets,
  sitemapDates,
  stylesheetCopy,
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

async function build(name, sitemapEntries, pages, { css = '.main { color: black; }' } = {}) {
  const dist = join(dir, name);
  await mkdir(join(dist, '_astro'), { recursive: true });
  await writeFile(join(dist, 'sitemap.xml'), sitemap(sitemapEntries));
  // The stylesheet page() links.
  await writeFile(join(dist, '_astro/a1b2.css'), css);
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
      media: ['src: /x.png'],
      labels: [],
      generated: [],
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

  it('changes with copy held in attributes: a placeholder, an accessible name, a tooltip or a shown input value', () => {
    const form = (attrs) => page({ main: `<p>Ten guides.</p><form><input type="search" ${attrs}><button ${attrs}></button></form>` });
    const before = contentDigest(Buffer.from(form('placeholder="Search people" aria-label="Search"')), '/p/');
    for (const changed of [
      form('placeholder="Search everyone" aria-label="Search"'),
      form('placeholder="Search people" aria-label="Find"'),
      form('placeholder="Search people" aria-label="Search" title="Search the directory"'),
      page({ main: '<p>Ten guides.</p><input type="submit" value="Read the group">' }),
    ]) {
      expect(contentDigest(Buffer.from(changed), '/p/')).not.toBe(before);
    }
    expect(pageContent('<main><input type="search" placeholder="Search &amp; find"></main>').labels).toEqual(['placeholder: Search & find']);
    // A value no reader sees is not copy.
    const hidden = (value) => contentDigest(Buffer.from(page({ main: `<p>Ten guides.</p><input type="hidden" value="${value}">` })), '/p/');
    expect(hidden('a')).toBe(hidden('b'));
    const explained = textDifference(form('placeholder="Search people" aria-label="Search"'), form('placeholder="Search everyone" aria-label="Search"'));
    expect(explained).toEqual({ removed: ['placeholder: Search people', 'placeholder: Search people'], added: ['placeholder: Search everyone', 'placeholder: Search everyone'] });
  });

  it('includes the words its stylesheets add, and the data-label they show', async () => {
    expect(stylesheetCopy('.a::after { content: "Show"; } .b::before{content:\'Hide\'} .c::after { content: "\\2192"; } .d::before { content: attr(data-label) ": "; } .e { align-content: center; background: url("a.png"); }'))
      .toEqual([{ text: 'Show', selectors: [['a']] }, { text: 'Hide', selectors: [['b']] }]);
    expect(stylesheetCopy('@media (min-width: 40em) { .x > summary::after, li:not(.y)[data-z="a.b"]::before { content: "Open"; } }'))
      .toEqual([{ text: 'Open', selectors: [['x'], []] }]);
    expect(pageStylesheets('<head><link rel="preload stylesheet" href="/_astro/a.css"><link rel="icon" href="/i.png"><style>.x::after{content:"Go"}</style></head>'))
      .toEqual({ hrefs: ['/_astro/a.css'], inline: ['.x::after{content:"Go"}'] });
    // The word reaches a page whose content carries the rule's class, and only that page.
    const pages = { '/events/': page({ main: '<details class="toggle"><summary>Earlier</summary></details>' }), '/eclipses/': page() };
    const dates = [['/events/', '2026-10-01'], ['/eclipses/', '2026-10-01']];
    const base = await build('css-base', dates, pages, { css: '.toggle > summary::after { content: "Show"; }' });
    const head = await build('css-head', dates, pages, { css: '.toggle > summary::after { content: "Open"; }' });
    const result = compare(await fingerprint(base), await fingerprint(head), { today: '2026-10-15' });
    expect(result.undated).toEqual([{ path: '/events/', lastmod: '2026-10-01' }]);
    const html = page();
    expect(textDifference(html, html, 3, { beforeGenerated: ['Show'], afterGenerated: ['Open'] }))
      .toEqual({ removed: ['stylesheet: Show'], added: ['stylesheet: Open'] });
    const label = (text) => contentDigest(Buffer.from(page({ main: `<table><tr><td data-label="${text}">1</td></tr></table>` })), '/p/');
    expect(label('Date')).not.toBe(label('Day'));
  });

  it('changes when a picture is swapped under the same description, lazy-loaded ones included', () => {
    const picture = (src) => contentDigest(Buffer.from(page({ main: `<p>Ten guides.</p><img src="${src}" alt="Aries">` })), '/p/');
    expect(picture('/assets/zodiac-icons/128/aries.webp')).not.toBe(picture('/assets/zodiac-icons/128/taurus.webp'));
    const video = (poster) => contentDigest(Buffer.from(page({ main: `<video src="/a.mp4" poster="${poster}"></video>` })), '/p/');
    expect(video('/a.jpg')).not.toBe(video('/b.jpg'));
    const lazy = (src) => contentDigest(Buffer.from(page({ main: `<video muted playsinline><source data-src="${src}" type="video/mp4"></video>` })), '/p/');
    expect(lazy('/assets/hero/a.mp4')).not.toBe(lazy('/assets/hero/b.mp4'));
  });

  it('reads every attribute the site names a media file in', async () => {
    const used = new Set();
    const walk = async (directory) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await walk(path);
        else if (/\.(?:astro|tsx|jsx|ts)$/u.test(entry.name) && !/\.test\./u.test(entry.name)) {
          for (const [, name] of (await readFile(path, 'utf8')).matchAll(/\s(data-[a-z-]*(?:src|srcset|poster))\s*=/gu)) used.add(name);
        }
      }
    };
    await walk(join(root, 'src'));
    expect([...used]).toContain('data-src');
    for (const name of used) expect(MEDIA_ATTRIBUTES).toContain(name);
  });

  it('reads every attribute the site\'s stylesheets show with attr()', async () => {
    const shown = new Set();
    const walk = async (directory) => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await walk(path);
        else if (/\.(?:css|astro)$/u.test(entry.name)) {
          for (const [, name] of (await readFile(path, 'utf8')).matchAll(/content\s*:[^;}]*?attr\(\s*([a-z-]+)/giu)) shown.add(name);
        }
      }
    };
    await walk(join(root, 'src'));
    expect([...shown]).toContain('data-label');
    for (const name of shown) expect(LABEL_ATTRIBUTES).toContain(name);
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

  it('passes a changed page already dated the day of the builds, as a daily page is', async () => {
    const base = await build('day-base', [['/pt/today/', '2026-10-13'], ['/pt/eclipses/', '2026-07-10']], {
      '/pt/today/': page({ main: '<p>1 de outubro</p>' }),
      '/pt/eclipses/': page({ main: '<p>1 de maio</p>' }),
    });
    const head = await build('day-head', [['/pt/today/', '2026-10-13'], ['/pt/eclipses/', '2026-07-10']], {
      '/pt/today/': page({ main: '<p>1º de outubro</p>' }),
      '/pt/eclipses/': page({ main: '<p>1º de maio</p>' }),
    });
    const [a, b] = [await fingerprint(base), await fingerprint(head)];
    expect(compare(a, b, { today: '2026-10-13' })).toMatchObject({
      changedOnItsDate: ['/pt/today/'],
      undated: [{ path: '/pt/eclipses/', lastmod: '2026-07-10' }],
    });
    expect(compare(a, b).undated.map(({ path }) => path)).toEqual(['/pt/eclipses/', '/pt/today/']);
    expect(() => compare(a, b, { today: 'today' })).toThrow(/Not a date/);
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

describe('the workflow', () => {
  // A job's `env:` block as a map: the lines indented under it, comments aside.
  async function jobEnv(workflow, job) {
    const lines = (await readFile(join(root, '.github/workflows', workflow), 'utf8')).split('\n');
    const start = lines.indexOf(`  ${job}:`);
    if (start < 0) throw new Error(`${workflow} has no job ${job}`);
    const end = lines.findIndex((line, index) => index > start && /^ {2}\S/.test(line));
    const envAt = lines.findIndex((line, index) => index > start && (end < 0 || index < end) && line === '    env:');
    if (envAt < 0) throw new Error(`${workflow}'s ${job} job has no env block`);
    const env = {};
    for (const line of lines.slice(envAt + 1)) {
      if (/^\s*(#|$)/.test(line)) continue;
      const match = /^ {6}([A-Z0-9_]+): (.*)$/.exec(line);
      if (!match) break;
      env[match[1]] = match[2].replace(/^"(.*)"$/, '$1');
    }
    return env;
  }

  it('builds with exactly the environment of site-check.yml\'s production build', async () => {
    const production = await jobEnv('site-check.yml', 'production-flags-build');
    expect(production).toHaveProperty('DAILY_EMAIL_ENABLED', '1');
    expect(Object.keys(production).length).toBeGreaterThan(20);
    expect(await jobEnv('sitemap-dates.yml', 'sitemap-dates')).toEqual(production);
  });
});

describe('a pull request that rolls the daily edition', () => {
  // The plan step's script and its daily-package pattern, as the workflow runs them.
  async function planStep() {
    const lines = (await readFile(join(root, '.github/workflows/sitemap-dates.yml'), 'utf8')).split('\n');
    const at = lines.indexOf('        id: plan');
    const pattern = lines.slice(at).find((line) => line.startsWith('          DAILY_PACKAGE: '));
    const runAt = lines.findIndex((line, index) => index > at && line === '        run: |');
    const end = lines.findIndex((line, index) => index > runAt && /^ {6}- name: /.test(line));
    const script = lines.slice(runAt + 1, end).map((line) => line.replace(/^ {10}/, '')).join('\n');
    return { script, pattern: pattern.replace('          DAILY_PACKAGE: ', '').replace(/^'(.*)'$/, '$1') };
  }

  it('names every file the daily publication commits as its package', async () => {
    const { pattern } = await planStep();
    const daily = await readFile(join(root, '.github/workflows/daily-horoscopes.yml'), 'utf8');
    // The paths quoted from FILES=( to the commit that adds them.
    const section = daily.slice(daily.indexOf('FILES=('), daily.indexOf('git add "${FILES[@]}"'));
    const listed = [...section.matchAll(/"((?:src|public)\/[^"]+)"/gu)].map((match) => match[1]);
    expect(listed).toEqual(expect.arrayContaining(['src/data/daily.json', 'src/data/horoscope-window.json', 'public/registry']));
    const regex = new RegExp(pattern);
    for (const path of listed) {
      // A directory in the list stands for the files under it.
      expect(regex.test(/\.[a-z0-9]+$/.test(path) ? path : `${path}/aries/index.html`)).toBe(true);
    }
    for (const path of ['src/pages/sitemap.xml.ts', 'src/data/sky.json', 'public/robots.txt', 'src/data/daily.json.bak']) {
      expect(regex.test(path)).toBe(false);
    }
  });

  describe('the plan step', () => {
    let repo;
    beforeEach(async () => {
      repo = await mkdtemp(join(tmpdir(), 'sitemap-plan-'));
      execFileSync('git', ['init', '-q'], { cwd: repo });
    });
    afterEach(async () => { await rm(repo, { recursive: true, force: true }); });

    const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
    async function commit(files) {
      for (const [path, content] of Object.entries(files)) {
        await mkdir(dirname(join(repo, path)), { recursive: true });
        await writeFile(join(repo, path), content);
      }
      git('add', '-A');
      git('-c', 'user.name=t', '-c', 'user.email=t@invalid', 'commit', '-qm', 'c');
      return git('rev-parse', 'HEAD');
    }
    async function plan(base, head) {
      const { script, pattern } = await planStep();
      const output = join(repo, 'output.txt');
      await writeFile(output, '');
      let status = 0;
      let stdout = '';
      try {
        stdout = execFileSync('bash', ['-e', '-c', script], {
          cwd: repo,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env, EVENT: 'workflow_dispatch', BASE_INPUT: base, HEAD_INPUT: head, DAILY_PACKAGE: pattern,
            GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: join(repo, 'summary.txt'), RUNNER_TEMP: join(repo, 'temp'),
          },
        });
      } catch (error) {
        status = error.status;
        stdout = error.stdout;
      }
      const outputs = Object.fromEntries((await readFile(output, 'utf8')).split('\n').filter(Boolean).map((line) => line.split('=')));
      return { status, stdout, outputs };
    }
    const edition = (date) => JSON.stringify({ date });

    it('compares two commits of one edition', async () => {
      const base = await commit({ 'src/data/daily.json': edition('2026-10-15'), 'scripts/sitemap-rendered-changes.mjs': '', 'scripts/frozen-clock.mjs': '' });
      const head = await commit({ 'src/pages/a.astro': 'a' });
      const { status, outputs } = await plan(base, head);
      expect(status).toBe(0);
      expect(outputs).toMatchObject({ compare: 'true', edition: '2026-10-15', clock: '2026-10-15T12:00:00Z' });
    });

    it('passes a head that only rolls the edition, with nothing to compare', async () => {
      const base = await commit({ 'src/data/daily.json': edition('2026-10-14'), 'scripts/sitemap-rendered-changes.mjs': '', 'scripts/frozen-clock.mjs': '' });
      const head = await commit({
        'src/data/daily.json': edition('2026-10-15'),
        'src/data/daily-publication.json': '{}',
        'public/registry/aries/index.html': '<p>',
        'public/assets/data/registry-research/items/brief.json': '{}',
      });
      const { status, stdout, outputs } = await plan(base, head);
      expect(status).toBe(0);
      expect(outputs).toEqual({ compare: 'false' });
      expect(stdout).toContain('rolls the daily edition to 2026-10-15 and changes nothing else');
    });

    it('fails a head that rolls the edition and changes anything else', async () => {
      const base = await commit({ 'src/data/daily.json': edition('2026-10-14'), 'scripts/sitemap-rendered-changes.mjs': '', 'scripts/frozen-clock.mjs': '' });
      const head = await commit({ 'src/data/daily.json': edition('2026-10-15'), 'src/pages/sitemap.xml.ts': 'x' });
      const { status, stdout, outputs } = await plan(base, head);
      expect(status).toBe(1);
      expect(stdout).toContain('::error::The head rolls the daily edition and changes 1 other file(s)');
      expect(outputs).toEqual({});
    });
  });
});
