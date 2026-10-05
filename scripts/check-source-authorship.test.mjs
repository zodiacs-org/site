import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PERSON_SUBJECT_ALLOWANCE, checkSourceAuthorship } from './check-source-authorship.mjs';

let root;
async function put(path, text) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), text);
}
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'source-authorship-'));
  await put('src/pages/about/index.astro', '<a href="/about/#editorial">Editorial policy</a>');
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('source authorship guard', () => {
  it('passes the repository as it is, with the People subject allowance in use', async () => {
    const { files, errors } = await checkSourceAuthorship(process.cwd());
    expect(errors).toEqual([]);
    expect(files).toContain(PERSON_SUBJECT_ALLOWANCE.path);
    expect(files.length).toBeGreaterThan(1000);
  }, 60_000); // it reads every file under src/, beside the suite's other workers

  // The guard this replaced matched only "@type": "Person" in double quotes and the
  // persona with one plain space; src/ writes object keys in single quotes.
  it.each([
    ["{ '@type': 'Person', name }", 'Person markup'],
    ['{ "@type": "Person" }', 'Person markup'],
    ["{ '@type': ['Thing', 'Person'] }", 'Person markup'],
    ["{ '@type': 'https://schema.org/Person' }", 'Person markup'],
    ['<div itemscope itemtype="https://schema.org/Person">', 'Person markup'],
    ['Written by Rowan Vale', 'retired persona'],
    ['Written by Rowan\n  Vale', 'retired persona'],
    ['ROWAN VALE', 'retired persona'],
    ['<a href="/about/#editor">', 'retired editor anchor'],
    ['<a href="/about#editor">', 'retired editor anchor'],
  ])('rejects %j', async (text, label) => {
    await put('src/components/Byline.astro', `---\n---\n${text}`);
    expect((await checkSourceAuthorship(root)).errors).toContain(`src/components/Byline.astro:3: ${label}`);
  });

  it('allows the People template one subject Person, and no second one', async () => {
    const subject = "const jsonLd = [{ '@type': 'WebPage', about: { '@id': '#person' } }, { '@type': 'Person', '@id': '#person' }];";
    await put(PERSON_SUBJECT_ALLOWANCE.path, subject);
    expect((await checkSourceAuthorship(root)).errors).toEqual([]);
    await put(PERSON_SUBJECT_ALLOWANCE.path, `${subject}\nconst author = { '@type': 'Person', name: 'Editor' };`);
    expect((await checkSourceAuthorship(root)).errors).toEqual([`${PERSON_SUBJECT_ALLOWANCE.path}:2: Person markup`]);
  });

  it('gives no other file the allowance', async () => {
    await put('src/pages/people/index.astro', "const subject = { '@type': 'Person' };");
    expect((await checkSourceAuthorship(root)).errors).toEqual(['src/pages/people/index.astro:1: Person markup']);
  });

  it('fails closed on a symlink and on a missing src directory', async () => {
    await put('outside.txt', 'Rowan Vale');
    await symlink(join(root, 'outside.txt'), join(root, 'src', 'linked.txt'));
    const linked = await checkSourceAuthorship(root);
    expect(linked.errors).toEqual(['src/linked.txt: unexpected source symlink']);
    await rm(join(root, 'src'), { recursive: true });
    expect((await checkSourceAuthorship(root)).errors).toEqual(['src: missing, unreadable or non-regular source directory']);
  });

  it('rejects a special file under src/', async () => {
    expect(spawnSync('mkfifo', [join(root, 'src', 'pipe')]).status).toBe(0);
    expect((await checkSourceAuthorship(root)).errors).toEqual(['src/pipe: unexpected non-regular source entry']);
  });

  it.each([
    ['<section vocab="https://schema.org/" typeof="Person">', 'Person markup'],
    ['<p>Written by Rowan&nbsp;<em>Vale</em></p>', 'retired persona'],
    ['<img src="/authors/rowan-vale.jpg" alt="">', 'retired persona'],
    ['<a href="/about/&#35;editor">', 'retired editor anchor'],
  ])('finds %s in a source file', async (text, label) => {
    await put('src/components/New.astro', text);
    expect((await checkSourceAuthorship(root)).errors).toEqual([`src/components/New.astro:1: ${label}`]);
  });

  it('skips binary files, as grep -I did', async () => {
    await put('src/assets/picture.bin', Buffer.concat([Buffer.from([0, 1, 2]), Buffer.from('Rowan Vale')]));
    expect((await checkSourceAuthorship(root)).errors).toEqual([]);
  });

  it('exits nonzero with the path and line, and zero when clean', async () => {
    const clean = spawnSync(process.execPath, ['scripts/check-source-authorship.mjs', root], { encoding: 'utf8' });
    expect(clean.status).toBe(0);
    expect(clean.stdout).toContain('Source authorship: PASS');
    await put('src/content/note.md', 'First line\nby Rowan Vale');
    const dirty = spawnSync(process.execPath, ['scripts/check-source-authorship.mjs', root], { encoding: 'utf8' });
    expect(dirty.status).toBe(1);
    expect(dirty.stderr).toContain('src/content/note.md:2: retired persona');
  });

  it('runs, uncommented and blocking, in the job before the build', async () => {
    const workflow = await readFile('.github/workflows/site-check.yml', 'utf8');
    const ordinaryJob = workflow.split('  legacy-drift:')[0];
    const step = ordinaryJob.match(/- name: Authorship stays transparent\n([\s\S]*?)\n\s*(?=- name:|#)/)?.[1] ?? '';
    expect(step).toMatch(/^\s+run: \|\n\s+npx vitest run scripts\/check-source-authorship\.test\.mjs\n\s+node scripts\/check-source-authorship\.mjs\s*$/);
    expect(step).not.toMatch(/continue-on-error|if:/);
    expect(ordinaryJob.indexOf('- name: Authorship stays transparent')).toBeLessThan(ordinaryJob.indexOf('run: npm run build'));
  });
});
