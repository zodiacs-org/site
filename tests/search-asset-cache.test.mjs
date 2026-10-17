import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const config = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'));

function effectiveCacheControl(path) {
  let value;
  for (const rule of config.headers ?? []) {
    if (!new RegExp(`^${rule.source}$`).test(path)) continue;
    for (const header of rule.headers) {
      if (header.key.toLowerCase() === 'cache-control') value = header.value;
    }
  }
  return value;
}

describe('Search ranking asset cache release', () => {
  it.each(['search-ui', 'webmcp-register', 'webmcp-calculators'])('revalidates the stable %s bundle', (asset) => {
    expect(effectiveCacheControl(`/assets/${asset}.js`))
      .toBe('public, max-age=0, must-revalidate');
  });
});
