import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderInlineImages } from './build-email-inline-images.mjs';

describe('email inline images', () => {
  it('match the committed ring and sign PNGs byte for byte', async () => {
    const committed = await readFile(resolve(import.meta.dirname, '../src/lib/email/inline-images.ts'), 'utf8');
    expect(committed).toBe(await renderInlineImages());
  });
});
