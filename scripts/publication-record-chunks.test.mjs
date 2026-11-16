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

  it('lists only the browser chunks that contain the record', async () => {
    dir = await mkdtemp(join(tmpdir(), 'publication-chunks-'));
    await mkdir(join(dir, 'nested'));
    await writeFile(join(dir, 'i18n.abc123.js'), 'export const a = 1;');
    await writeFile(join(dir, 'Island.def456.js'), 'const r={es:{"horoscope-weekly":{released:!1,holdReason:"Awaiting"}}};');
    await writeFile(join(dir, 'nested', 'chunk.mjs'), '{"holdReason":"x"}');
    await writeFile(join(dir, 'styles.css'), '.holdReason{}');
    expect(await chunksWithPublicationRecord(dir)).toEqual(['Island.def456.js', 'nested/chunk.mjs']);
  });

  it('passes a clean or missing chunk directory', async () => {
    dir = await mkdtemp(join(tmpdir(), 'publication-chunks-'));
    await writeFile(join(dir, 'clean.js'), 'export default 1;');
    expect(await chunksWithPublicationRecord(dir)).toEqual([]);
    expect(await chunksWithPublicationRecord(join(dir, 'missing'))).toEqual([]);
  });
});
