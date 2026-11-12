import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  findProfileAccessChunk,
  profileAccessLoaderProblems,
  stampProfileAccessLoader,
  verifyProfileAccessLoader,
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

describe('the verification check-dist runs', () => {
  it('passes a correctly stamped site whose chunk the save path imports', async () => {
    await site({ pages: { 'aries/index.html': page(`/_astro/${CHUNK}`) } });
    expect(await verifyProfileAccessLoader(dist)).toEqual({ needed: true, chunkName: CHUNK, problems: [] });
  });

  it('fails a correctly stamped page when no built chunk imports the bootstrap chunk', async () => {
    await site({ importer: false, pages: { 'aries/index.html': page(`/_astro/${CHUNK}`) } });
    // The pages alone are right; the shared import is what is missing.
    expect(await profileAccessLoaderProblems(dist, CHUNK)).toEqual([]);
    const { problems } = await verifyProfileAccessLoader(dist);
    expect(problems).toEqual([`no built chunk imports ${CHUNK}; the save path and the inline loader would not share it`]);
  });

  it('fails when the chunk is missing even though no page problem names it', async () => {
    await site({ chunks: [], pages: { 'aries/index.html': page(`/_astro/${CHUNK}`) } });
    const { problems } = await verifyProfileAccessLoader(dist);
    expect(problems[0]).toMatch(/found 0/u);
  });

  it('has nothing to verify when no page carries the loader (account sync v2 off)', async () => {
    await site({ importer: false, pages: { 'index.html': '<!doctype html><html><body></body></html>' } });
    expect(await verifyProfileAccessLoader(dist)).toEqual({ needed: false, chunkName: null, problems: [] });
  });

  it('is what check-dist enforces, reporting every problem on its own', async () => {
    const source = await readFile(new URL('./check-dist.mjs', import.meta.url), 'utf8');
    const block = source.slice(source.indexOf('// ---- Profile access loader'), source.indexOf('// ---- Report'));
    expect(block).toContain('await verifyProfileAccessLoader(root)');
    expect(block).toMatch(/for \(const problem of problems\.slice\(0, 20\)\) fail\(/u);
    expect(block).not.toMatch(/if \(problems\.length\)/u);
  });
});
