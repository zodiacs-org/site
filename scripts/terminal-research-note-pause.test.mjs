import * as fs from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  REGISTRY_RESEARCH_DIST_PATHS,
  registryResearchItemDistPath,
  registryResearchWithheldProblems,
  withheldRegistryResearchIds,
  withholdRegistryResearchFromDist,
} from './registry-research-withheld.mjs';

// While Registry Research is paused (src/data/registry-research/pause.json), a note that was still scheduled is
// withheld. Its page says it was not published, so the page must not carry the note's readings or market section,
// not even hidden for a later reveal: before this check the body shipped in the HTML with the `hidden` attribute.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const PAGE = 'src/pages/terminal/research/[slug].astro';

describe('a scheduled research note while publishing is paused', () => {
  it('leaves the body out of the page instead of hiding it', async () => {
    const page = await read(PAGE);
    expect(page).toContain("const publishingPaused = pauseJson.status === 'paused';");
    expect(page).toContain('const withheld = scheduled && publishingPaused;');
    // The body (readings, market observation, audit receipt and JSON link) renders only when not withheld.
    const body = page.match(/\{!withheld && \(\s*<div class="research-note__body"[\s\S]*?<\/div>\s*<\/div>\s*\)\}\s*<\/main>/u);
    expect(body, 'the research body is wrapped in {!withheld && (...)}').not.toBeNull();
    for (const part of ['sectionList.map', '<section class="research-note__audit">', 'Open immutable JSON']) {
      expect(body[0]).toContain(part);
      expect(page.indexOf(part)).toBe(page.lastIndexOf(part));
    }
  });

  it('says the edition was not published and ships no reveal script', async () => {
    const page = await read(PAGE);
    expect(page).toContain("{withheld ? 'This edition was not published.' : 'This edition is approved and scheduled.'}");
    expect(page).toContain('Publishing is paused. This edition stays unpublished until publishing resumes.');
    expect(page).toContain('{scheduled && !withheld && (\n  <script>');
  });

  it('applies to the committed scheduled notes while the pause record says paused', async () => {
    const pause = JSON.parse(await read('src/data/registry-research/pause.json'));
    const publication = JSON.parse(await read('src/data/registry-research/publication.json'));
    const scheduled = publication.items.filter((item) => item.status === 'scheduled');
    if (pause.status !== 'paused') return;
    // Every scheduled note in the frozen ledger is one this page withholds; none was revealed before the pause.
    for (const item of scheduled) expect(item.visibleAt > publication.generatedAt).toBe(true);
  });
});

describe('a paused note ships no public JSON', () => {
  // The committed copies under public/ stay as they are; the build step in scripts/registry-research-withheld.mjs
  // (an Astro integration, astro.config.mjs) removes the withheld notes from dist/ after public/ is copied in.
  const copyCommitted = async (dist, publication) => {
    const { cp, mkdir } = fs;
    await mkdir(resolve(dist, REGISTRY_RESEARCH_DIST_PATHS.items), { recursive: true });
    await cp(resolve(root, 'public', REGISTRY_RESEARCH_DIST_PATHS.index), resolve(dist, REGISTRY_RESEARCH_DIST_PATHS.index));
    await cp(resolve(root, 'public', REGISTRY_RESEARCH_DIST_PATHS.feed), resolve(dist, REGISTRY_RESEARCH_DIST_PATHS.feed));
    for (const item of publication.items) {
      await cp(resolve(root, 'public', registryResearchItemDistPath(item.id)), resolve(dist, registryResearchItemDistPath(item.id)));
    }
    // A withheld page as [slug].astro now renders it (title, summary, pause message, no body), and a
    // stand-in for the body that the page used to carry hidden.
    return async (item, html) => {
      await mkdir(resolve(dist, item.url.slice(1)), { recursive: true });
      await fs.writeFile(resolve(dist, item.url.slice(1), 'index.html'), html, 'utf8');
    };
  };

  it('is left out of the item files, the archive index and the compact feed, and the source stays untouched', async () => {
    const pause = JSON.parse(await read('src/data/registry-research/pause.json'));
    const publication = JSON.parse(await read('src/data/registry-research/publication.json'));
    const paused = { ...pause, status: 'paused', pausedAt: pause.pausedAt ?? '2026-11-12T03:15:00.000Z', reason: pause.reason ?? 'Paused for the test.' };
    const scheduled = publication.items.filter((item) => item.status === 'scheduled');
    const published = publication.items.filter((item) => item.status !== 'scheduled');
    expect(scheduled.length).toBeGreaterThan(0);
    expect(withheldRegistryResearchIds(publication, paused)).toEqual(scheduled.map((item) => item.id));

    const before = await read(`public/${REGISTRY_RESEARCH_DIST_PATHS.index}`);
    const dist = await fs.mkdtemp(resolve(tmpdir(), 'research-withheld-'));
    try {
      const writePage = await copyCommitted(dist, publication);
      await writePage(scheduled[0], '<main data-scheduled="true"><h1>Not published</h1></main>');
      await writePage(scheduled[1], `<main><div data-research-body hidden><a href="/${registryResearchItemDistPath(scheduled[1].id)}">JSON</a></div></main>`);

      const leaksBefore = await registryResearchWithheldProblems(dist, { publication, pause: paused });
      expect(leaksBefore.some((problem) => problem.includes('ships its JSON'))).toBe(true);
      expect(leaksBefore.some((problem) => problem.includes('carries its body'))).toBe(true);

      expect(await withholdRegistryResearchFromDist(dist, { publication, pause: paused })).toEqual(scheduled.map((item) => item.id));
      for (const item of scheduled) {
        await expect(fs.access(resolve(dist, registryResearchItemDistPath(item.id)))).rejects.toThrow();
      }
      for (const item of published) await fs.access(resolve(dist, registryResearchItemDistPath(item.id)));

      const index = JSON.parse(await fs.readFile(resolve(dist, REGISTRY_RESEARCH_DIST_PATHS.index), 'utf8'));
      const feed = JSON.parse(await fs.readFile(resolve(dist, REGISTRY_RESEARCH_DIST_PATHS.feed), 'utf8'));
      const withheld = new Set(scheduled.map((item) => item.id));
      expect(index.items.some((item) => withheld.has(item.id))).toBe(false);
      expect(index.rollingItemIds.some((id) => withheld.has(id))).toBe(false);
      expect(index.items.length).toBe(published.length);
      expect(feed.items.some((item) => withheld.has(item.id))).toBe(false);
      for (const item of scheduled) {
        expect(JSON.stringify(index)).not.toContain(item.id);
        expect(JSON.stringify(feed)).not.toContain(item.id);
      }

      // Only the page that still carried a body is reported once the JSON is gone.
      expect(await registryResearchWithheldProblems(dist, { publication, pause: paused }))
        .toEqual([`withheld note ${scheduled[1].id} carries its body on ${scheduled[1].url}`]);
    } finally {
      await fs.rm(dist, { recursive: true, force: true });
    }
    // The committed public copy is never rewritten.
    expect(await read(`public/${REGISTRY_RESEARCH_DIST_PATHS.index}`)).toBe(before);
    for (const item of scheduled) await fs.access(resolve(root, 'public', registryResearchItemDistPath(item.id)));
  });

  it('withholds nothing while publishing', async () => {
    const publication = JSON.parse(await read('src/data/registry-research/publication.json'));
    expect(withheldRegistryResearchIds(publication, { schema: 'zodiacs.registry-research-pause.v1', status: 'publishing' })).toEqual([]);
    expect(withheldRegistryResearchIds(publication, null)).toEqual([]);
  });

  it('runs in the Astro build and is checked over dist/', async () => {
    const config = await read('astro.config.mjs');
    expect(config).toContain("import { registryResearchWithheld } from './scripts/registry-research-withheld.mjs';");
    expect(config).toMatch(/integrations: \[[^\]]*registryResearchWithheld\(\)/u);
    expect(await read('scripts/check-dist.mjs')).toContain('registryResearchWithheldProblems(root, {');
  });
});
