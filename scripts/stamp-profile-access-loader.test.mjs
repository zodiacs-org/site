import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  findProfileAccessChunk,
  profileAccessLoaderProblems,
  stampProfileAccessLoader,
} from './stamp-profile-access-loader.mjs';
import {
  PROFILE_ACCESS_CHUNK_PLACEHOLDER,
  profileAccessLoaderScript,
} from '../src/lib/account-v2/profile-access-loader.mjs';

const CHUNK = 'profile-access-autostart.Ab12_c-D.js';
const page = (src) => `<!doctype html><html><body><script data-profile-access-loader>${
  profileAccessLoaderScript({ src, keys: ['zodiacs.profile.v1'] })}</script></body></html>`;
let dist = '';

async function site({ chunks = [CHUNK], importer = true, pages = { 'aries/index.html': page(PROFILE_ACCESS_CHUNK_PLACEHOLDER) } } = {}) {
  dist = await mkdtemp(join(tmpdir(), 'profile-access-loader-'));
  await mkdir(join(dist, '_astro'), { recursive: true });
  for (const name of chunks) await writeFile(join(dist, '_astro', name), 'export {};');
  await writeFile(join(dist, '_astro', 'store.Zz9.js'),
    importer ? `const l=()=>import(\`./${chunks[0] ?? 'missing.js'}\`);export{l};` : 'export {};');
  for (const [path, html] of Object.entries(pages)) {
    await mkdir(join(dist, path, '..'), { recursive: true });
    await writeFile(join(dist, path), html);
  }
  return dist;
}

afterEach(async () => { if (dist) await rm(dist, { recursive: true, force: true }); dist = ''; });

describe('profile access loader stamping', () => {
  it('stamps the one chunk the save path imports, and the check then passes', async () => {
    await site();
    const chunk = await findProfileAccessChunk(dist);
    expect(chunk).toEqual({ name: CHUNK, problems: [] });
    expect(await profileAccessLoaderProblems(dist, chunk.name)).toEqual([
      'aries/index.html: the profile access loader was never stamped',
      'aries/index.html: the profile access loader names 0 chunk URLs',
    ]);
    expect(await stampProfileAccessLoader(dist, chunk.name)).toBe(1);
    const html = await readFile(join(dist, 'aries/index.html'), 'utf8');
    expect(html).toContain(`"/_astro/${CHUNK}"`);
    expect(html).not.toContain(PROFILE_ACCESS_CHUNK_PLACEHOLDER);
    expect(await profileAccessLoaderProblems(dist, chunk.name)).toEqual([]);
  });

  it('fails when the chunk is missing or ambiguous', async () => {
    await site({ chunks: [] });
    expect((await findProfileAccessChunk(dist)).problems[0]).toMatch(/found 0/u);
    await rm(dist, { recursive: true, force: true });
    await site({ chunks: [CHUNK, 'profile-access-autostart.Other1.js'] });
    expect((await findProfileAccessChunk(dist)).problems[0]).toMatch(/found 2/u);
  });

  it('fails when nothing the save path loads imports the chunk', async () => {
    await site({ importer: false });
    expect((await findProfileAccessChunk(dist)).problems[0]).toMatch(/would not share it/u);
  });

  it('fails a page whose loader names another file', async () => {
    await site({ pages: { 'aries/index.html': page('/_astro/profile-access-autostart.Stale99.js') } });
    const problems = await profileAccessLoaderProblems(dist, CHUNK);
    expect(problems).toEqual([`aries/index.html: the profile access loader imports /_astro/profile-access-autostart.Stale99.js, not /_astro/${CHUNK}`]);
  });

  it('has nothing to check when no page carries the loader', async () => {
    await site({ pages: { 'index.html': '<!doctype html><html><body></body></html>' } });
    expect(await profileAccessLoaderProblems(dist, null)).toEqual([]);
  });
});
