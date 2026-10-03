import { mkdtemp, mkdir, readdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkDeveloperAuthorship, requiredDocuments } from './check-developer-authorship.mjs';

let root;
async function put(path, text) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), text);
}
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'developer-authorship-'));
  for (const path of requiredDocuments) {
    await put(path, '<a href="/about/#editorial">Editorial policy</a> {"@type": "Organization"}');
  }
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(`${root}-outside`, { recursive: true, force: true });
});

describe('served developer documentation authorship', () => {
  it('accepts current editorial anchors and Organization markup', async () => {
    await put('developers/new/deep/valid.md', 'Current documentation');
    await put('sdk/engine/new/deep/valid.html', 'Current API reference');
    expect((await checkDeveloperAuthorship(root)).errors).toEqual([]);
    expect((await checkDeveloperAuthorship(root)).files).toContain('developers/new/deep/valid.md');
    expect((await checkDeveloperAuthorship(root)).files).toContain('sdk/engine/new/deep/valid.html');
  });

  it('requires every current Astro developer page in the output inventory', async () => {
    const pages = await readdir('src/pages/developers', { recursive: true });
    for (const page of pages.filter((path) => path.endsWith('.astro'))) {
      expect(requiredDocuments).toContain(`developers/${page.replace(/\.astro$/, '.html')}`);
    }
  });

  const surfaces = [
    'developers/engine/reference/functions/calc.calc.html',
    'developers/engine/reference/release/NOTICE.txt',
    'developers/engine/index.html', 'developers/new/deep/topic/index.html',
    'sdk/engine/functions/nested/example.html', 'sdk/engine/media/new.md',
    'sdk/examples/new/index.html', 'llms.txt', 'llms-full.txt',
    'api/v1/llms.txt', 'api/v1/sky/today.md', 'api/v1/sky/upcoming.md',
    'api/v1/schema/nested/example.json',
  ];
  for (const [label, text] of [
    ['retired persona', 'Rowan Vale'],
    ['retired editor anchor', '<a href="https://zodiacs.org/about/#editor">Editor</a>'],
    ['Person markup', '{"@type" :\n\t"Person"}'],
  ]) {
    it.each(surfaces)(`rejects ${label} in %s`, async (path) => {
      await put(path, text);
      expect((await checkDeveloperAuthorship(root)).errors).toContain(`${path}:1: ${label}`);
    });
  }

  it('rejects an editor anchor at end of file', async () => {
    await put('llms.txt', '/about/#editor');
    expect((await checkDeveloperAuthorship(root)).errors).toContain('llms.txt:1: retired editor anchor');
  });

  it.each(requiredDocuments)('fails closed when %s is missing', async (path) => {
    await rm(join(root, path));
    expect((await checkDeveloperAuthorship(root)).errors)
      .toContain(`${path}: missing or empty required documentation output`);
  });

  it('rejects empty required output and a wholly missing build', async () => {
    await put('llms.txt', '');
    expect((await checkDeveloperAuthorship(root)).errors)
      .toContain('llms.txt: missing or empty required documentation output');
    await rm(root, { recursive: true });
    expect(await checkDeveloperAuthorship(root)).toEqual({
      files: [], errors: ['.: missing or non-regular documentation directory'],
    });
  });

  it('does not sweep historical evidence, immutable archives, or unrelated pages', async () => {
    for (const path of ['docs/platform/evidence/old.md', 'archive/old/index.html',
      'downloads/release.tgz', 'about/index.html']) {
      await put(path, 'Rowan Vale /about/#editor {"@type":"Person"}');
    }
    expect((await checkDeveloperAuthorship(root)).errors).toEqual([]);
  });

  it('exits nonzero for rejected output and reports the path and line', async () => {
    await put('llms.txt', 'Valid first line\nRowan Vale');
    const run = spawnSync(process.execPath, ['scripts/check-developer-authorship.mjs', root], { encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('llms.txt:2: retired persona');
  });

  it('exits successfully for valid output', () => {
    const run = spawnSync(process.execPath, ['scripts/check-developer-authorship.mjs', root], { encoding: 'utf8' });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('Developer authorship: PASS');
  });

  it('rejects symlinked documentation rather than walking outside the bounded trees', async () => {
    await symlink(join(root, 'llms.txt'), join(root, 'developers', 'linked.txt'));
    expect((await checkDeveloperAuthorship(root)).errors)
      .toContain('developers/linked.txt: unexpected documentation symlink');
  });

  it.each([
    '{"@context":"https://schema.org","@type":["Thing","Person"]}',
    '{"@type":"https://schema.org/Person"}',
    '{"@type":"http://schema.org/Person"}',
    '{"@type":["Thing","https://schema.org/Person"]}',
    '<div itemscope itemtype="https://schema.org/Person"></div>',
    "<div itemscope itemtype='http://schema.org/Person'></div>",
    '<div itemscope itemtype="https://schema.org/Thing https://schema.org/Person"></div>',
  ])('rejects ordinary Person type forms: %s', async (text) => {
    await put('developers/engine/index.html', text);
    expect((await checkDeveloperAuthorship(root)).errors)
      .toContain('developers/engine/index.html:1: Person markup');
  });

  it('accepts Organization arrays/IRIs/microdata and unrelated Person text', async () => {
    await put('developers/engine/index.html', `
      {"@type":["Thing","Organization"],"description":"Person"}
      {"@type":"https://schema.org/Organization"}
      <div itemscope itemtype="https://schema.org/Organization"></div>
      {"@type":"https://example.org/Person"}
      <a href="/about/#editorial">Editorial policy</a>
    `);
    expect((await checkDeveloperAuthorship(root)).errors).toEqual([]);
  });

  it('rejects a symlinked output root without scanning its target', async () => {
    await rename(root, `${root}-outside`);
    await symlink(`${root}-outside`, root);
    expect(await checkDeveloperAuthorship(root)).toEqual({
      files: [], errors: ['.: missing or non-regular documentation directory'],
    });
  });

  it.each(['developers', 'sdk', 'api', 'api/v1', 'sdk/engine'])('rejects symlinked directory %s without scanning its target', async (path) => {
    await rename(join(root, path), `${root}-outside`);
    await writeFile(join(`${root}-outside`, 'forbidden.txt'), 'Rowan Vale');
    await symlink(`${root}-outside`, join(root, path));
    const result = await checkDeveloperAuthorship(root);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.files.some((file) => file.startsWith(`${path}/`))).toBe(false);
    expect(result.errors.some((error) => error.includes('retired persona'))).toBe(false);
  });

  it.each(['llms.txt', 'llms-full.txt'])('rejects %s symlinks without reading their targets', async (path) => {
    await writeFile(`${root}-outside`, 'Rowan Vale');
    await rm(join(root, path));
    await symlink(`${root}-outside`, join(root, path));
    const result = await checkDeveloperAuthorship(root);
    expect(result.errors).toContain(`${path}: missing or empty required documentation output`);
    expect(result.files).not.toContain(path);
    expect(result.errors.some((error) => error.includes('retired persona'))).toBe(false);
  });

  it('keeps the original src guard and runs controls and output guard after ordinary Build', async () => {
    const workflow = await readFile('.github/workflows/site-check.yml', 'utf8');
    expect(workflow).toContain(String.raw`! grep -RInE 'Rowan Vale|about/#editor([^i]|$)|"@type"[[:space:]]*:[[:space:]]*"Person"' src`);
    const ordinaryJob = workflow.split('  legacy-drift:')[0];
    expect(ordinaryJob).toMatch(/run: npm run build\s+- name: Developer documentation authorship\s+run: \|\s+npx vitest run scripts\/check-developer-authorship.test.mjs\s+node scripts\/check-developer-authorship.mjs/);
  });
});
