import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function source(path: string): Promise<string> {
  return readFile(resolve(root, path), 'utf8');
}

describe('public legal identity', () => {
  it('associates Zodiacs.org with Zodiacs LLC across public trust surfaces', async () => {
    const [about, terms, privacy, homepage] = await Promise.all([
      source('src/pages/about/index.astro'),
      source('src/pages/terms/index.astro'),
      source('src/pages/privacy/index.astro'),
      source('src/pages/index.astro'),
    ]);

    expect(about).toContain('official website of <strong>Zodiacs LLC</strong>');
    expect(about).toContain('New Mexico limited liability company formed on August 11, 2026');
    expect(about).toContain("legalName: 'Zodiacs LLC'");
    expect(about).toContain("foundingDate: '2026-08-11'");
    expect(terms).toContain('<strong>Zodiacs LLC</strong>, a New Mexico limited liability company');
    expect(terms).toContain('Operator and applicable law');
    expect(terms).toContain('the operator of Zodiacs.org');
    expect(terms).not.toContain("operator's legal identity and a chosen governing jurisdiction");
    expect(privacy).toContain('<h2>Who operates this site</h2>');
    expect(privacy).toContain('Zodiacs LLC is the');
    expect(privacy).toContain('controller for that information');
    expect(homepage).toContain('Zodiacs.org is owned and operated by <a href="/about/">Zodiacs LLC</a>');
    expect(homepage).toContain("legalName: 'Zodiacs LLC'");
    expect(homepage).toContain("foundingDate: '2026-08-11'");
  });

  it('dates the changed legal pages to the public release date', async () => {
    const [about, terms, privacy] = await Promise.all([
      source('src/pages/about/index.astro'),
      source('src/pages/terms/index.astro'),
      source('src/pages/privacy/index.astro'),
    ]);

    // Terms and privacy were revised for the owner's approved Guide and
    // paste-address-only notices on 3 October. About retains its prior date.
    // Privacy changed again on 5 October, when the compute API it describes
    // gained the elections endpoint.
    expect(about).toContain("dateModified: '2026-09-28T00:00:00.000Z'");
    expect(terms).toContain("const updated = '3 October 2026'");
    expect(terms).toContain("const modifiedAt = '2026-10-03T00:00:00.000Z'");
    expect(privacy).toContain("const updated = '5 October 2026'");
    expect(privacy).toContain("const modifiedAt = '2026-10-05T00:00:00.000Z'");
  });
});
