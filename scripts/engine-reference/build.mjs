// Generated documentation only. Never writes public/sdk or the package archive.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Application, PageEvent } from 'typedoc';
import ts from 'typescript';

const root = fileURLToPath(new URL('../../', import.meta.url));
const target = join(root, 'public/developers/engine/reference');
const base = 'https://zodiacs.org/developers/engine/reference/';
export const release = Object.freeze({
  version: '1.0.0-rc.2',
  sourceCommit: '7fa964d2a77d09dbb819b5733b36e303fc7fc513',
  sha256: '4cd834b2dca085cd5732ecad6edbd82b61d7625d9a0647900c160a0747810002',
  sourceRepository: 'https://github.com/zodiacs-org/engine',
  artifactUrl: 'https://raw.githubusercontent.com/zodiacs-org/engine/e790362bddf28016405df4164e66baea057c4f19/artifacts/zodiacs-engine-1.0.0-rc.2.tgz',
});
export const excluded = Object.freeze(['./internal', './internal/math']);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
export async function inventory(directory) {
  const result = {};
  async function walk(relative = '') {
    for (const entry of (await readdir(join(directory, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const path = join(relative, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) result[path] = sha(await readFile(join(directory, path)));
      else throw new Error(`Unexpected non-regular output: ${path}`);
    }
  }
  await walk();
  return result;
}
export async function buildEngineReference({ check = false } = {}) {
  const candidate = await json(join(root, 'src/data/platform-engine-candidate.json'));
  for (const [key, value] of Object.entries(release)) {
    if (candidate[key] !== value) throw new Error(`Reference release pin differs: ${key}`);
  }
  const archive = join(root, candidate.artifactPath);
  if (sha(await readFile(archive)) !== release.sha256) throw new Error('Reference archive digest mismatch');
  const temp = await mkdtemp(join(tmpdir(), 'zodiacs-reference-'));
  try {
    execFileSync('tar', ['-xzf', archive, '-C', temp]);
    const pkgRoot = join(temp, 'package');
    const pkg = await json(join(pkgRoot, 'package.json'));
    if (pkg.version !== release.version || pkg.license !== 'MIT AND CC-BY-4.0') throw new Error('Unexpected release identity or licence');
    const entries = Object.entries(pkg.exports).filter(([key]) => !excluded.includes(key));
    const paths = entries.map(([, value]) => join(pkgRoot, value.types));
    const tsconfig = join(temp, 'tsconfig.json');
    await writeFile(tsconfig, JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', skipLibCheck: true }, files: paths }));
    const source = `${candidate.sourceRepository}/tree/${release.sourceCommit}`;
    let readme = await readFile(join(root, 'scripts/engine-reference/README.md'), 'utf8');
    for (const [key, value] of Object.entries({ VERSION: pkg.version, SOURCE: source, COMMIT: release.sourceCommit, ARCHIVE: candidate.artifactUrl, SHA256: release.sha256 })) readme = readme.replaceAll(`{{${key}}}`, value);
    await writeFile(join(temp, 'README.md'), readme);
    const signs = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
    const footer = `<nav class="engine-sign-rail" aria-label="The twelve zodiac sign guides">${signs.map((sign) => `<a href="/${sign}/" aria-label="${sign[0].toUpperCase() + sign.slice(1)}"><img src="/assets/zodiac-icons/48/${sign}.webp" width="32" height="32" alt="" loading="lazy" decoding="async"></a>`).join('')}</nav><p class="engine-docs-posture"><a href="/developers/engine/">Zodiacs Engine</a> · ${pkg.version} · MIT AND CC-BY-4.0 · <a href="${source}">Pinned source</a> · <a href="${base}release/NOTICE.txt">Notices</a> · <a href="/about/#editorial-system">Editorial policy</a></p>`;
    const app = await Application.bootstrap({
      tsconfig, entryPoints: paths, entryPointStrategy: 'resolve',
      name: `${pkg.name} ${pkg.version}`, readme: join(temp, 'README.md'),
      excludeInternal: true, excludePrivate: true, disableSources: true,
      hideGenerator: true, searchInComments: true, lang: 'en',
      customCss: join(root, 'scripts/engine-reference/custom.css'),
      customFooterHtml: footer, customFooterHtmlDisableWrapper: true,
      navigationLinks: { 'Engine overview': '/developers/engine/', 'Support': '/developers/support/' },
    });
    app.renderer.on(PageEvent.END, (page) => {
      const canonical = page.url === 'index.html' ? base : new URL(page.url, base).href;
      page.contents = page.contents.replace('<head>', `<head><link rel="canonical" href="${canonical}"/><meta name="robots" content="noindex,follow"/>`);
    });
    const project = await app.convert();
    if (!project || app.logger.hasErrors()) throw new Error('TypeDoc conversion failed');
    // Independent TypeScript export inventory: every public name must be present.
    const program = ts.createProgram(paths, { module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, target: ts.ScriptTarget.ES2022, skipLibCheck: true });
    const checker = program.getTypeChecker();
    const api = {};
    for (const [subpath, value] of entries) {
      const path = join(pkgRoot, value.types);
      const module = project.children.find((child) => child.name === basename(path, '.d.ts'));
      const names = checker.getExportsOfModule(checker.getSymbolAtLocation(program.getSourceFile(path))).map((symbol) => symbol.name).sort();
      const documented = (module?.children ?? []).map((child) => child.name).sort();
      if (JSON.stringify(names) !== JSON.stringify(documented)) throw new Error(`Export coverage differs for ${subpath}: ${names.filter((name) => !documented.includes(name))}`);
      module.name = subpath === '.' ? 'engine' : subpath.slice(2);
      api[subpath] = { declaration: value.types, exports: names };
    }
    const out = join(temp, 'output');
    await app.generateDocs(project, out);
    if (app.logger.hasErrors()) throw new Error('TypeDoc rendering failed');
    await mkdir(join(out, 'release'));
    const notices = {};
    for (const name of ['LICENSE', 'LICENSING.md', 'NOTICE', 'README.md']) {
      const bytes = await readFile(join(pkgRoot, name));
      const filename = `release/${name.replace(/\.md$/, '')}.txt`;
      await writeFile(join(out, filename), bytes);
      notices[filename] = sha(bytes);
    }
    await cp(join(root, 'scripts/engine-reference/node_modules/typedoc/LICENSE'), join(out, 'release/TYPEDOC-LICENSE.txt'));
    const provenance = {
      schemaVersion: 1, version: release.version, sourceCommit: release.sourceCommit, sha256: release.sha256,
      license: pkg.license, sourceRepository: release.sourceRepository, artifactUrl: release.artifactUrl,
      generator: { typedoc: (await json(join(root, 'scripts/engine-reference/node_modules/typedoc/package.json'))).version, typescript: ts.version },
      input: 'Unmodified public declarations from the digest-verified package archive',
      excluded: Object.fromEntries(excluded.map((key) => [key, 'Site compatibility only; outside the public API promise; may change without notice.'])),
      api, notices,
    };
    await writeFile(join(out, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
    if (check) {
      if (JSON.stringify(await inventory(out)) !== JSON.stringify(await inventory(target))) throw new Error('Engine reference drift; run node scripts/build-engine-reference.mjs');
    } else {
      await rm(target, { recursive: true, force: true });
      await cp(out, target, { recursive: true });
    }
    console.log(`Engine reference: ${check ? 'drift PASS' : 'generated'} (${entries.length} public entry points; archive ${release.sha256})`);
  } finally { await rm(temp, { recursive: true, force: true }); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildEngineReference({ check: process.argv.includes('--check') });
}
