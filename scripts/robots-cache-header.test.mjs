import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { effectiveHeaders } from './lib/vercel-source-pattern.mjs';

/**
 * Googlebot read /robots.txt 158 times in 14 days (11.2 a day, 15.6% of its requests) while the file was served
 * with max-age=0. Google keeps robots.txt for up to a day and reads max-age to set how long, so one day of cache
 * leaves the rest of its visits for pages.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));

describe('robots.txt delivery', () => {
  it('lets crawlers keep robots.txt for a day', () => {
    expect(effectiveHeaders(config, '/robots.txt').get('cache-control')).toBe('public, max-age=86400');
  });

  it('leaves every other path as it was', () => {
    for (const path of ['/', '/robots', '/robots.txt.bak', '/sitemap-index.xml']) {
      expect(effectiveHeaders(config, path).get('cache-control'), path).not.toBe('public, max-age=86400');
    }
  });
});
