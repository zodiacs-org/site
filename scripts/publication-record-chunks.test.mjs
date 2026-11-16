import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PUBLICATION_RECORD_MARKER, chunksWithPublicationRecord } from './publication-record-chunks.mjs';

let dir;
afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = undefined;
});

describe('publication record bundle check', () => {
  it('uses the key every entry of both publication records carries', async () => {
    for (const file of ['../src/data/locale-expansion-publication.json', '../src/data/natal-aspects-publication.json']) {
      const text = await readFile(new URL(file, import.meta.url), 'utf8');
      expect(text, file).toContain(`"${PUBLICATION_RECORD_MARKER}"`);
    }
  });

  it('lists every script and page in dist that contains the record', async () => {
    dir = await mkdtemp(join(tmpdir(), 'publication-chunks-'));
    await mkdir(join(dir, '_astro'));
    await mkdir(join(dir, 'es', 'horoscopes'), { recursive: true });
    await mkdir(join(dir, 'assets'));
    await writeFile(join(dir, '_astro', 'i18n.abc123.js'), 'export const a = 1;');
    await writeFile(join(dir, '_astro', 'Island.def456.js'), 'const r={es:{"horoscope-weekly":{released:!1,holdReason:"Awaiting"}}};');
    await writeFile(join(dir, '_astro', 'chunk.mjs'), '{"holdReason":"x"}');
    await writeFile(join(dir, 'assets', 'loader.cjs'), 'module.exports={holdReason:1};');
    // Island props and inline scripts live in the page itself, outside _astro.
    await writeFile(join(dir, 'es', 'horoscopes', 'index.html'), '<astro-island props="{&quot;holdReason&quot;:[0,&quot;x&quot;]}"></astro-island>');
    await writeFile(join(dir, 'index.html'), '<script>window.r={holdReason:"x"}</script>');
    await writeFile(join(dir, 'about.html'), '<p>Clean page</p>');
    await writeFile(join(dir, 'styles.css'), '.holdReason{}');
    await writeFile(join(dir, 'record.json'), '{"holdReason":"x"}');
    expect(await chunksWithPublicationRecord(dir)).toEqual([
      '_astro/Island.def456.js', '_astro/chunk.mjs', 'assets/loader.cjs', 'es/horoscopes/index.html', 'index.html',
    ]);
  });

  it('passes a clean or missing chunk directory', async () => {
    dir = await mkdtemp(join(tmpdir(), 'publication-chunks-'));
    await writeFile(join(dir, 'clean.js'), 'export default 1;');
    expect(await chunksWithPublicationRecord(dir)).toEqual([]);
    expect(await chunksWithPublicationRecord(join(dir, 'missing'))).toEqual([]);
  });
});
