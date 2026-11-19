import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EDITOR_ORGANIZATION } from './editorial';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const publicContactPages = [
  'src/pages/about/index.astro',
  'src/pages/corrections/index.astro',
  'src/pages/privacy/index.astro',
  'src/pages/terms/index.astro',
  'src/pages/es/privacy/index.astro',
  'src/pages/fr/privacy/index.astro',
  'src/pages/pt/privacy/index.astro',
  'src/pages/it/privacy/index.astro',
  'src/pages/ru/privacy/index.astro',
  'src/pages/ru/disclosure/index.astro',
] as const;

describe('public contact identity', () => {
  it('uses the approved admin mailbox across public trust pages and schema', async () => {
    const sources = await Promise.all(
      publicContactPages.map((path) => readFile(resolve(root, path), 'utf8')),
    );

    for (const source of sources) {
      expect(source).toContain('mailto:admin@zodiacs.org');
      expect(source).not.toContain('hello@zodiacs.org');
    }
    expect(EDITOR_ORGANIZATION.email).toBe('admin@zodiacs.org');
  });
});
