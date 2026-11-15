import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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
