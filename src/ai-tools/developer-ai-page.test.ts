import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EVERY_AI_TOOL_NAME, EVERY_TOOL_NAME } from './contracts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (path: string) => readFile(resolve(root, path), 'utf8');

describe('the connector page at /developers/ai/', () => {
  it('lists every tool the hosted server offers with both switches on, once each, and no tool behind another switch', async () => {
    const source = await read('src/pages/developers/ai/index.astro');
    const listed = [...source.matchAll(/^\s*\['([a-z_]+)', '/gmu)].map((match) => match[1]);
    expect([...listed].sort()).toEqual([...EVERY_AI_TOOL_NAME].sort());
    for (const name of EVERY_TOOL_NAME.filter((tool) => !(EVERY_AI_TOOL_NAME as readonly string[]).includes(tool))) expect(source).not.toContain(name);
  });

  it('states the limits, has troubleshooting and examples, and no longer denies what the server does', async () => {
    const source = await read('src/pages/developers/ai/index.astro');
    for (const text of ['betting tips', 'sports picks', 'investment timing', 'election forecasts', 'health predictions', 'less than 13 years ago', 'under 18', 'never stored or logged', 'never put in links', 'id="troubleshooting"', 'id="examples"']) expect(source).toContain(text);
    expect(source).not.toContain('offers no birth-chart storage, scheduling, eclipse search');
    expect(source).not.toMatch(/[–—]/u);
  });

  it('gives the approved mailbox as the support contact on the connector page and the support page', async () => {
    for (const path of ['src/pages/developers/ai/index.astro', 'src/pages/developers/support/index.astro']) {
      const source = await read(path);
      expect(source).toContain('mailto:admin@zodiacs.org');
      expect(source.match(/mailto:[^"']+/gu)!.every((link) => link === 'mailto:admin@zodiacs.org')).toBe(true);
    }
    expect(await read('src/pages/developers/support/index.astro')).toContain('id="connector"');
  });
});
