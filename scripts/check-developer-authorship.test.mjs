import { mkdtemp, mkdir, readdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkDeveloperAuthorship, generatedDeveloperDocuments, requiredDocuments } from './check-developer-authorship.mjs';

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
      const outputs = generatedDeveloperDocuments[page]
        ?? [`developers/${page.replace(/\.astro$/, '.html')}`];
      for (const output of outputs) expect(requiredDocuments).toContain(output);
    }
  });

  it('requires the generated HTML and Markdown outputs for their real route sources', async () => {
    const pages = await readdir('src/pages/developers', { recursive: true });
    for (const [source, outputs] of Object.entries(generatedDeveloperDocuments)) {
      expect(pages).toContain(source);
      for (const output of outputs) {
        expect(output).not.toContain('[');
        expect(requiredDocuments).toContain(output);
      }
    }
  });

  const surfaces = [
    'developers/docs/natal/index.html', 'developers/docs/natal.md',
    'developers/engine/reference/functions/calc.calc.html',
    'developers/engine/reference/release/NOTICE.txt',
    'developers/engine/index.html', 'developers/new/deep/topic/index.html',
    'sdk/engine/functions/nested/example.html', 'sdk/engine/media/new.md',
    'sdk/examples/new/index.html', 'llms.txt', 'llms-full.txt',
    'api/v1/llms.txt', 'api/v1/sky/today.md', 'api/v1/sky/upcoming.md',
    'api/v1/schema/nested/example.json', 'widgets/index.html', 'widgets/new/embed.md',
    'examples/new-manifest.json', 'examples/new-NOTICE.txt', 'assets/README.md',
    'developers/engine/reference/assets/new.js', 'developers/new/UPPER.HTML',
    'developers/new/graph.jsonld', 'developers/new/openapi.yaml', 'sdk/engine/media/NOTICE',
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

  // Generated pages wrap prose between words (the reference keeps the engine's
  // comment line breaks); escapes and letter case do not change the name.
  it.each([
    'Maintained by Rowan\n    Vale', 'Rowan\r\nVale', 'Rowan  Vale', 'Rowan\tVale', 'Rowan&nbsp;Vale',
    'Rowan&#160;Vale', 'Rowan&#xA0;Vale', 'Rowan Vale', '{"author":"Rowan\\u00a0Vale"}',
    'ROWAN VALE', 'rowan vale', 'Rowan&#32;Vale', 'Rowan&ensp;Vale', 'Rowan&shy;Vale',
    `Rowan${String.fromCharCode(0x200b)}Vale`, `Rowan${String.fromCharCode(0xad)}Vale`,
    '<b>Rowan</b> Vale', 'Rowan<span class="name"> Vale</span>', '{"author":"Rowan\\u0020Vale"}',
  ])('rejects the persona however its words are separated or cased: %j', async (text) => {
    await put('developers/engine/reference/functions/calc.calc.html', text);
    expect((await checkDeveloperAuthorship(root)).errors)
      .toContain('developers/engine/reference/functions/calc.calc.html:1: retired persona');
  });

  // A slug, a file name, an address or a handle joins the words; a citation
  // inverts them.
  it.each([
    '<a href="/authors/rowan-vale/">', 'rowan_vale.jpg', 'rowan.vale@zodiacs.org', '@RowanVale',
    'Vale, Rowan', 'VALE,&nbsp;ROWAN', 'Rowan - Vale',
  ])('rejects the persona joined or inverted: %j', async (text) => {
    await put('developers/support/index.html', text);
    expect((await checkDeveloperAuthorship(root)).errors)
      .toContain('developers/support/index.html:1: retired persona');
  });

  it('leaves other names that share a word alone', async () => {
    await put('developers/support/index.html',
      'Rowan Atkinson visited the Vale of Glamorgan. Vale of Leven, Rowanberry and Valerie.');
    expect((await checkDeveloperAuthorship(root)).errors).toEqual([]);
  });

  // /about redirects to /about/ with its fragment; these are the same link.
  it.each([
    '<a href="/about#editor">', '<a href="/about/index.html#editor">', '<a href="/about/?ref=nav#editor">',
    '<a href="https://zodiacs.org/about#editor">', '[editor](/es/about#editor)',
    '<a href="/about/&#35;editor">', '<a href="/about/&#x23;editor">', '<a href="/about/&num;editor">',
    '{"url":"https:\\/\\/zodiacs.org\\/about\\/#editor"}',
    '<a href="/about/./#editor">', '<a href="/about/#%65ditor">',
  ])('rejects the editor anchor however the about page is spelled: %s', async (text) => {
    await put('developers/support/index.html', text);
    expect((await checkDeveloperAuthorship(root)).errors)
      .toContain('developers/support/index.html:1: retired editor anchor');
  });

  it('keeps accepting the editorial anchor in every spelling', async () => {
    await put('developers/support/index.html',
      '<a href="/about#editorial"> <a href="/about/index.html#editorial"> <a href="/about/?x=1#editorial">'
      + ' <a href="/about/&#35;editorial"> <a href="/about/#%65ditorial"> <a href="/About/#editor">');
    expect((await checkDeveloperAuthorship(root)).errors).toEqual([]);
  });

  // The first two inputs made the earlier patterns quadratic (about eleven
  // seconds each at this size), because every repeated start rescanned the rest
  // of the line; each start must now give up within a bounded stretch.
  it.each([
    ['unclosed type arrays', '"@type":['],
    ['about-page queries', 'about?'],
    ['persona starts', 'Rowan<'],
    ['joined persona starts', 'Rowan-'],
    ['inverted persona starts', 'Vale,'],
    ['type attributes', 'itemtype="'],
  ])('scans 40,000 repeated %s in bounded time', async (_, start) => {
    await put('developers/engine/index.html', start.repeat(40_000));
    const started = performance.now();
    expect((await checkDeveloperAuthorship(root)).errors).toEqual([]);
    expect(performance.now() - started).toBeLessThan(2_000);
  });

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
    '{"@type":"\\u0050erson"}',
    '{"@type":"https:\\/\\/schema.org\\/Person"}',
    '{"@type":"schema:Person"}',
    "{ '@type': 'Person' }",
    '{ "@type": `Person` }',
    "{ '@type': [\n  'Thing',\n  'Person',\n] }",
    '{"\\u0040type":"Person"}', "node['@type'] = 'Person';", "{ ['@type']: 'Person' }",
    '<div vocab="https://schema.org/" typeof="Person"></div>', '<div typeof="schema:Person"></div>',
    "<div typeof='Thing Person'></div>", '<div itemscope itemtype=https://schema.org/Person></div>',
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
      <div typeof="Organization"></div>
      if (typeof value === "string" && typeof other == 'object') {}
      {"@type":"\\u{110000}"}
    `);
    expect((await checkDeveloperAuthorship(root)).errors).toEqual([]);
  });

  // Every regular file is read, whatever its extension; only binary files are skipped.
  it.each(['developers/new/types.d.ts', 'sdk/engine/assets/app.js.map', 'developers/new/data.cjs', 'api/v1/new/readme'])(
    'reads %s whatever its extension', async (path) => {
      await put(path, 'Rowan Vale');
      expect((await checkDeveloperAuthorship(root)).errors).toContain(`${path}:1: retired persona`);
    });

  it('skips a binary file and says nothing about its bytes', async () => {
    await put('developers/new/image.png', Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0]), Buffer.from('Rowan Vale')]));
    const result = await checkDeveloperAuthorship(root);
    expect(result.errors).toEqual([]);
    expect(result.files).not.toContain('developers/new/image.png');
  });

  it('rejects a special file in a documentation tree', async () => {
    expect(spawnSync('mkfifo', [join(root, 'developers', 'pipe')]).status).toBe(0);
    expect((await checkDeveloperAuthorship(root)).errors)
      .toContain('developers/pipe: unexpected non-regular documentation entry');
  });

  it('rejects a symlinked assets/README.md rather than skipping it', async () => {
    await writeFile(`${root}-outside`, 'Rowan Vale');
    await mkdir(join(root, 'assets'), { recursive: true });
    await symlink(`${root}-outside`, join(root, 'assets', 'README.md'));
    const result = await checkDeveloperAuthorship(root);
    expect(result.errors).toContain('assets/README.md: unexpected documentation symlink');
    expect(result.errors.some((error) => error.includes('retired persona'))).toBe(false);
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

  it('keeps the src guard (scripts/check-source-authorship.mjs) and runs controls and output guard after ordinary Build', async () => {
    const workflow = await readFile('.github/workflows/site-check.yml', 'utf8');
    const ordinaryJob = workflow.split('  legacy-drift:')[0];
    expect(ordinaryJob).toMatch(/- name: Authorship stays transparent\s+run: \|\s+npx vitest run scripts\/check-source-authorship.test.mjs\s+node scripts\/check-source-authorship.mjs/);
    expect(ordinaryJob).toMatch(/run: npm run build\s+- name: Developer documentation authorship\s+run: \|\s+npx vitest run scripts\/check-developer-authorship.test.mjs\s+node scripts\/check-developer-authorship.mjs/);
    const step = ordinaryJob.match(/- name: Developer documentation authorship\n([\s\S]*?)\n\s*(?=- name:|#)/)?.[1] ?? '';
    expect(step).not.toMatch(/continue-on-error|if:/);
  });
});
