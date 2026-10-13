import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { gunzipSync, gzipSync } from 'node:zlib';
import { parse } from '@astrojs/compiler';
import ts from 'typescript';
import { afterEach, describe, expect, it } from 'vitest';
import { consumerEnvironment, readPackageArchive, starterFiles, verifyPlatformStarter } from './verify-platform-starter.mjs';

const root = process.cwd();
const read = (path) => readFileSync(join(root, path));
const metadata = JSON.parse(read('public/examples/platform-starter.json'));
const candidate = JSON.parse(read('examples/platform/candidate.json'));
const siteCandidate = JSON.parse(read('src/data/platform-engine-candidate.json'));
const enginePath = `vendor/zodiacs-engine-${candidate.version}.tgz`;
const archive = read(`public/examples/${metadata.file}`);
const originalFiles = readPackageArchive(archive);
const temporary = [];

afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });

// Small independent tar writer for adversarial fixtures; no extraction or npm.
function pack(entries) {
  const blocks = [];
  for (const { path, bytes = Buffer.from('fixture'), type = '0', link = '' } of entries) {
    const header = Buffer.alloc(512);
    header.write(path, 0, 100, 'ascii');
    header.write('0000644\0', 100, 'ascii');
    header.write(bytes.length.toString(8).padStart(11, '0') + '\0', 124, 'ascii');
    header.fill(32, 148, 156);
    header.write(type, 156, 'ascii');
    header.write(link, 157, 100, 'ascii');
    header.write('ustar\0' + '00', 257, 'ascii');
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
    blocks.push(header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}

function fixture({ mutateFiles, mutateCandidate, mutateMetadata, sourceMatchesArchive = false } = {}) {
  const path = mkdtempSync(join(tmpdir(), 'zodiacs-starter-verifier-test-'));
  temporary.push(path);
  const put = (name, bytes) => { mkdirSync(dirname(join(path, name)), { recursive: true }); writeFileSync(join(path, name), bytes); };
  const files = new Map(originalFiles);
  mutateFiles?.(files);
  const changedArchive = pack([...files].map(([name, bytes]) => ({ path: `package/${name}`, bytes })));
  const changedMetadata = { ...metadata, sha256: createHash('sha256').update(changedArchive).digest('hex') };
  mutateMetadata?.(changedMetadata);
  put('public/examples/platform-starter.json', JSON.stringify(changedMetadata));
  put(`public/examples/${metadata.file}`, changedArchive);
  // Keep the repository source independent from the mutated archive.
  for (const [name, bytes] of sourceMatchesArchive ? files : originalFiles) put(`examples/platform/${name}`, bytes);
  if (mutateCandidate) {
    const changedCandidate = structuredClone(candidate);
    mutateCandidate(changedCandidate);
    put('examples/platform/candidate.json', JSON.stringify(changedCandidate));
  }
  return { root: path, put, files };
}

// Repack a synthetic contained engine, updating all claimed digests and source
// bytes. These fixtures test the checks beyond agreement of matching metadata.
function engineFixture(change) {
  return fixture({ sourceMatchesArchive: true, mutateFiles(files) {
    const engineFiles = readPackageArchive(files.get(enginePath));
    change(engineFiles);
    const engineBytes = pack([...engineFiles].map(([path, bytes]) => ({ path: `package/${path}`, bytes })));
    files.set(enginePath, engineBytes);
    const value = JSON.parse(files.get('candidate.json'));
    value.sha256 = createHash('sha256').update(engineBytes).digest('hex');
    files.set('candidate.json', Buffer.from(JSON.stringify(value)));
    const lock = JSON.parse(files.get('npm-shrinkwrap.json'));
    lock.packages['node_modules/@zodiacs/engine'].integrity = `sha512-${createHash('sha512').update(engineBytes).digest('base64')}`;
    files.set('npm-shrinkwrap.json', Buffer.from(JSON.stringify(lock)));
  } });
}

describe('platform starter archive and source identity (offline)', () => {
  it('verifies the starter without the application engine pin', () => {
    const test = fixture();
    const result = verifyPlatformStarter(test);
    expect(result.candidate).toEqual(candidate);
    expect(result.enginePath).toBe(enginePath);
  });

  it('allows the application to retain a different engine and artifact', () => {
    const test = fixture();
    test.put('src/data/platform-engine-candidate.json', JSON.stringify({ ...siteCandidate, version: '99.0.0-rc.0', sha256: '0'.repeat(64) }));
    expect(verifyPlatformStarter(test).candidate).toEqual(candidate);
  });

  it('verifies the public-directory archive against every source byte and the candidate', () => {
    const result = verifyPlatformStarter();
    expect(result.metadata).toEqual(metadata);
    expect([...result.files.keys()].sort()).toEqual(starterFiles(candidate.version).sort());
    expect(result.files.size).toBe(21);
  });

  it('detects an archive digest change before reading package data', () => {
    const test = fixture({ mutateMetadata: (value) => { value.sha256 = '0'.repeat(64); } });
    expect(() => verifyPlatformStarter(test)).toThrow('Starter archive SHA-256 mismatch');
  });

  it.each([undefined, 'main', '80dff5f', 'g'.repeat(40), 'a'.repeat(41), 'a'.repeat(40) + '\n', 123, ['a'.repeat(40)]])('requires a full immutable starter commit: %j', (artifactCommit) => {
    const test = fixture({ mutateMetadata: (value) => { value.artifactCommit = artifactCommit; } });
    expect(() => verifyPlatformStarter(test)).toThrow('Invalid immutable starter commit');
  });

  it('detects stale or substituted source even after the public digest is updated', () => {
    const test = fixture({ mutateFiles: (files) => files.set('src/app.mjs', Buffer.from('alert("changed")')) });
    expect(() => verifyPlatformStarter(test)).toThrow('Archive/source byte mismatch: src/app.mjs');
  });

  it('detects candidate provenance drift independently of starter source and digest', () => {
    const test = fixture({ mutateCandidate: (value) => { value.sourceCommit = 'a'.repeat(40); } });
    expect(() => verifyPlatformStarter(test)).toThrow('Archive/source byte mismatch: candidate.json');
  });

  it('rejects mutable artifact URLs even when both metadata copies match', () => {
    const test = fixture({ mutateFiles: (files) => {
      const value = JSON.parse(files.get('candidate.json'));
      value.url = value.url.replace(value.artifactCommit, 'main');
      files.set('candidate.json', Buffer.from(JSON.stringify(value)));
    }, sourceMatchesArchive: true });
    test.put('examples/platform/candidate.json', test.files.get('candidate.json'));
    expect(() => verifyPlatformStarter(test)).toThrow('Candidate URL must identify the immutable artifact');
  });

  it.each([
    ['schemaVersion', 2, 'Invalid candidate package identity'],
    ['schemaVersion', '1', 'Invalid candidate package identity'],
    ['package', '@elsewhere/engine', 'Invalid candidate package identity'],
    ['version', ['0.1.1-rc.3'], 'Invalid candidate package identity'],
    ['version', '00.1.1-rc.3', 'Invalid candidate package identity'],
    ['version', '0.1.1', 'Invalid candidate package identity'],
    ['version', '0.1.1-rc.3\n', 'Invalid candidate package identity'],
    ['status', 'Published and approved', 'Candidate release status mismatch'],
    ['sha256', ['a'.repeat(64)], 'Invalid candidate SHA-256'],
    ['sha256', 'a'.repeat(63), 'Invalid candidate SHA-256'],
    ['sha256', 'a'.repeat(64) + '\n', 'Invalid candidate SHA-256'],
    ['artifactRepository', 'https://github.com/ZodiacsOfficial/sdk.evil', 'Invalid candidate repository provenance'],
    ['artifactRepository', 'https://github.com/other/sdk', 'Invalid candidate repository provenance'],
    ['artifactRepository', 'https://user:secret@github.com/ZodiacsOfficial/sdk', 'Invalid candidate repository provenance'],
    ['artifactCommit', 'main', 'Invalid candidate repository provenance'],
    ['artifactCommit', 'a'.repeat(40) + '\n', 'Invalid candidate repository provenance'],
    ['artifactCommit', ['a'.repeat(40)], 'Invalid candidate repository provenance'],
    ['sourceRepository', 'https://github.com/ZodiacsOfficial/site', 'Invalid candidate repository provenance'],
    ['sourceCommit', 'main', 'Invalid candidate repository provenance'],
    ['sourceCommit', ['a'.repeat(40)], 'Invalid candidate repository provenance'],
    ['sourcePackagePath', 'packages/../engine', 'Invalid candidate repository provenance'],
    ['artifactPath', '../private.tgz', 'Candidate URL must identify the immutable artifact'],
    ['artifactPath', 'artifacts/%2e%2e/private.tgz', 'Candidate URL must identify the immutable artifact'],
    ['url', 'https://raw.githubusercontent.com/ZodiacsOfficial/sdk/main/artifacts/engine.tgz', 'Candidate URL must identify the immutable artifact'],
    ['url', 'https://example.invalid/unfetched.tgz', 'Candidate URL must identify the immutable artifact'],
  ])('rejects hostile or ambiguous candidate %s: %j', (key, value, message) => {
    const test = fixture({ mutateCandidate: (record) => { record[key] = value; } });
    expect(() => verifyPlatformStarter(test)).toThrow(message);
  });

  it.each(['unknownField', 'name', 'releaseStatus'])('rejects unrecognized candidate field %s', (key) => {
    const test = fixture({ mutateCandidate: (value) => { value[key] = 'ambiguous'; } });
    expect(() => verifyPlatformStarter(test)).toThrow('Invalid candidate metadata schema');
  });

  it.each(['artifactPath', 'sourcePackagePath', 'schemaVersion', 'ephemeris'])('requires candidate field %s', (key) => {
    const test = fixture({ mutateCandidate: (value) => { delete value[key]; } });
    expect(() => verifyPlatformStarter(test)).toThrow('Invalid candidate metadata schema');
  });

  it.each([
    null, [], {}, 'astronomy-engine@2.1.19',
    { name: 'astronomy-engine' }, { version: '2.1.19' },
    { name: 'other-ephemeris', version: '2.1.19' },
    { name: 'astronomy-engine', version: '2.1.19', status: 'authenticated' },
    ...['^2.1.19', '~2.1.19', 'latest', '02.1.19', '2.1', '2.1.19-01', '2.1.19\n', ['2.1.19'], 2].map((version) => ({ name: 'astronomy-engine', version })),
  ])('rejects missing, extra or non-exact ephemeris facts: %j', (ephemeris) => {
    const test = fixture({ mutateCandidate: (value) => { value.ephemeris = ephemeris; } });
    expect(() => verifyPlatformStarter(test)).toThrow('Invalid candidate ephemeris provenance');
  });

  it('rejects a claimed ephemeris version that differs from the resolved shrinkwrap', () => {
    const test = fixture({ sourceMatchesArchive: true, mutateFiles: (files) => {
      const value = JSON.parse(files.get('candidate.json'));
      value.ephemeris.version = '9.9.9';
      files.set('candidate.json', Buffer.from(JSON.stringify(value)));
    } });
    expect(() => verifyPlatformStarter(test)).toThrow('Locked ephemeris version mismatch');
  });

  it('rejects a missing resolved ephemeris entry', () => {
    const test = fixture({ sourceMatchesArchive: true, mutateFiles: (files) => {
      const lock = JSON.parse(files.get('npm-shrinkwrap.json'));
      delete lock.packages['node_modules/astronomy-engine'];
      files.set('npm-shrinkwrap.json', Buffer.from(JSON.stringify(lock)));
    } });
    expect(() => verifyPlatformStarter(test)).toThrow('Locked ephemeris version mismatch');
  });

  it.each(['?token=synthetic', '#fragment', '/extra'])('rejects URL suffix %s even with matching source bytes', (suffix) => {
    const test = fixture({ sourceMatchesArchive: true, mutateFiles: (files) => {
      const value = JSON.parse(files.get('candidate.json'));
      value.url += suffix;
      files.set('candidate.json', Buffer.from(JSON.stringify(value)));
    } });
    expect(() => verifyPlatformStarter(test)).toThrow('Candidate URL must identify the immutable artifact');
  });

  it('keeps source provenance distinct from the artifact host commit', () => {
    const test = fixture({ sourceMatchesArchive: true, mutateFiles: (files) => {
      const value = JSON.parse(files.get('candidate.json'));
      value.url = value.url.replace(value.artifactCommit, value.sourceCommit);
      files.set('candidate.json', Buffer.from(JSON.stringify(value)));
    } });
    expect(() => verifyPlatformStarter(test)).toThrow('Candidate URL must identify the immutable artifact');
  });

  it('accepts the official site artifact host independently of the SDK source repository', () => {
    const test = fixture({ sourceMatchesArchive: true, mutateFiles: (files) => {
      const value = JSON.parse(files.get('candidate.json'));
      value.artifactRepository = 'https://github.com/ZodiacsOfficial/site';
      value.artifactPath = enginePath;
      value.url = `https://raw.githubusercontent.com/ZodiacsOfficial/site/${value.artifactCommit}/${value.artifactPath}`;
      files.set('candidate.json', Buffer.from(JSON.stringify(value)));
    } });
    const result = verifyPlatformStarter(test);
    expect(result.candidate.sourceRepository).toBe('https://github.com/ZodiacsOfficial/sdk');
    expect(result.candidate.artifactRepository).toBe('https://github.com/ZodiacsOfficial/site');
  });

  it.each(['.', './geo', './receipt'])('requires the public %s export even when hashes are updated', (entry) => {
    const test = engineFixture((files) => {
      const manifest = JSON.parse(files.get('package.json'));
      delete manifest.exports[entry];
      files.set('package.json', Buffer.from(JSON.stringify(manifest)));
    });
    expect(() => verifyPlatformStarter(test)).toThrow(`Missing public engine export: ${entry}`);
  });

  it.each([
    ['version', '9.9.9-rc.0'], ['name', '@elsewhere/engine'], ['type', 'commonjs'], ['license', 'UNLICENSED'],
    ['repository', { type: 'git', url: 'git+https://github.com/ZodiacsOfficial/site.git', directory: 'packages/engine' }],
  ])('rejects substituted engine package %s despite matching claimed hashes', (key, value) => {
    const test = engineFixture((files) => {
      const manifest = JSON.parse(files.get('package.json'));
      manifest[key] = value;
      files.set('package.json', Buffer.from(JSON.stringify(manifest)));
    });
    expect(() => verifyPlatformStarter(test)).toThrow('Contained engine package identity mismatch');
  });

  it.each(['import', 'types'])('requires contained bytes for the receipt %s target', (kind) => {
    const test = engineFixture((files) => {
      const manifest = JSON.parse(files.get('package.json'));
      files.delete(manifest.exports['./receipt'][kind].slice(2));
    });
    expect(() => verifyPlatformStarter(test)).toThrow(`Missing public engine export: ./receipt ${kind}`);
  });

  it.each(['README.md', 'LICENSE', 'NOTICE', 'LICENSING.md'])('requires the retained engine %s document', (path) => {
    const test = engineFixture((files) => files.delete(path));
    expect(() => verifyPlatformStarter(test)).toThrow(`Missing engine notice/document: ${path}`);
  });

  it('rejects a blank license and unlisted engine secrets despite matching claimed hashes', () => {
    expect(() => verifyPlatformStarter(engineFixture((files) => files.set('LICENSE', Buffer.from(' \n')))))
      .toThrow('Missing engine notice/document: LICENSE');
    expect(() => verifyPlatformStarter(engineFixture((files) => files.set('.env', Buffer.from('synthetic-only')))))
      .toThrow('Unexpected engine package file: .env');
  });

  it('rejects a repacked engine even when starter source and its own digest agree', () => {
    const test = fixture({ mutateFiles: (files) => files.set(enginePath, Buffer.from('different engine')) });
    test.put(`examples/platform/${enginePath}`, test.files.get(enginePath));
    expect(() => verifyPlatformStarter(test)).toThrow('Contained engine artifact mismatch');
  });

  it('rejects a starter that drops its private flag', () => {
    const test = fixture({ mutateFiles: (files) => {
      const value = JSON.parse(files.get('package.json'));
      delete value.private;
      files.set('package.json', Buffer.from(JSON.stringify(value)));
    } });
    test.put('examples/platform/package.json', test.files.get('package.json'));
    expect(() => verifyPlatformStarter(test)).toThrow('Starter package identity/private/runtime mismatch');
  });

  it('checks shrinkwrap engine integrity beyond source byte equality', () => {
    const test = fixture({ mutateFiles: (files) => {
      const lock = JSON.parse(files.get('npm-shrinkwrap.json'));
      lock.packages['node_modules/@zodiacs/engine'].integrity = 'sha512-wrong';
      files.set('npm-shrinkwrap.json', Buffer.from(JSON.stringify(lock)));
    } });
    test.put('examples/platform/npm-shrinkwrap.json', test.files.get('npm-shrinkwrap.json'));
    expect(() => verifyPlatformStarter(test)).toThrow('Locked engine integrity mismatch');
  });

  it('rejects an unpinned registry dependency even when source bytes agree', () => {
    const test = fixture({ sourceMatchesArchive: true, mutateFiles: (files) => {
      const lock = JSON.parse(files.get('npm-shrinkwrap.json'));
      lock.packages['node_modules/esbuild'].resolved = 'https://example.invalid/esbuild.tgz';
      files.set('npm-shrinkwrap.json', Buffer.from(JSON.stringify(lock)));
    } });
    expect(() => verifyPlatformStarter(test)).toThrow('Dependency must use an integrity-pinned public registry archive');
  });

  it('rejects source symlinks even if the target contains matching bytes', () => {
    const test = fixture();
    const target = join(test.root, 'examples/platform/README.md');
    test.put('elsewhere.md', read('examples/platform/README.md'));
    rmSync(target);
    symlinkSync(join(test.root, 'elsewhere.md'), target);
    expect(() => verifyPlatformStarter(test)).toThrow('Source must not contain links or special files');
  });
});

describe('examples page artifact identity', () => {
  it('renders links, setup values, and release identity from shared metadata', async () => {
    const pagePath = 'src/pages/developers/examples/index.astro';
    const { ast } = await parse(read(pagePath).toString('utf8'));
    const frontmatter = ast.children.find((node) => node.type === 'frontmatter').value;
    const source = ts.createSourceFile(pagePath, frontmatter, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const bindings = new Map(source.statements.filter(ts.isImportDeclaration).map((statement) => [
      resolve(root, dirname(pagePath), statement.moduleSpecifier.text), statement.importClause?.name?.text,
    ]));
    const starterBinding = bindings.get(join(root, 'public/examples/platform-starter.json'));
    const candidateBinding = bindings.get(join(root, 'examples/platform/candidate.json'));
    expect(starterBinding).toBeTypeOf('string');
    expect(candidateBinding).toBeTypeOf('string');
    const declarations = source.statements.filter((statement) => !ts.isImportDeclaration(statement)).map((statement) => statement.getFullText(source)).join('\n');

    // Evaluate the actual frontmatter and template expressions with substituted
    // metadata. This checks data flow without pinning prose or variable names.
    function render(starterValue, candidateValue) {
      const evaluate = (expression) => runInNewContext(ts.transpileModule(`${declarations}\n(${expression})`, {
        compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext },
      }).outputText, { [starterBinding]: starterValue, [candidateBinding]: candidateValue }, { timeout: 1000 });
      const text = (node) => node.type === 'expression' ? String(evaluate(node.children.map((child) => child.value).join('')))
        : node.type === 'text' ? node.value : node.type === 'frontmatter' ? '' : (node.children || []).map(text).join('');
      const links = [];
      const pre = [];
      function walk(node) {
        if (node.type === 'element' && node.name === 'a') {
          const href = node.attributes.find((attribute) => attribute.name === 'href');
          if (href) links.push(href.kind === 'expression' ? evaluate(href.value) : href.value);
        }
        if (node.type === 'element' && node.name === 'pre') pre.push(text(node));
        for (const child of node.children || []) walk(child);
      }
      walk(ast);
      return { links, setup: pre[0], visible: text(ast) };
    }

    const original = render(metadata, candidate);
    const changedStarter = { ...metadata, version: '8.7.6-rc.5', file: 'zodiacs-platform-starter-8.7.6-rc.5.tgz', sha256: 'b'.repeat(64), artifactCommit: 'a'.repeat(40) };
    const changedCandidate = { ...candidate, package: '@example/engine', version: '9.8.7-rc.6', status: 'Unpublished test candidate' };
    const changed = render(changedStarter, changedCandidate);
    expect(changed.links).toContain(`https://raw.githubusercontent.com/zodiacs-org/site/${changedStarter.artifactCommit}/public/examples/${changedStarter.file}`);
    expect(changed.links).toContain(`https://github.com/zodiacs-org/site/blob/${changedStarter.artifactCommit}/examples/platform/README.md`);
    expect(changed.setup).toBe(original.setup.replaceAll(metadata.file, changedStarter.file)
      .replaceAll(metadata.sha256, changedStarter.sha256).replaceAll(metadata.artifactCommit, changedStarter.artifactCommit));
    for (const value of [changedStarter.file, changedStarter.sha256, changedStarter.artifactCommit]) expect(changed.setup).toContain(value);
    for (const value of [changedStarter.version, `${changedCandidate.package}@${changedCandidate.version}`, changedCandidate.status]) expect(changed.visible.toLowerCase()).toContain(value.toLowerCase());
    for (const value of [metadata.file, metadata.sha256, metadata.artifactCommit, candidate.version]) expect(changed.visible).not.toContain(value);
  });
});

describe('starter archive extraction boundary', () => {
  it.each(['package/../outside', '/absolute', 'package/a/../../outside', 'package/a\\b', 'package//double', 'package/./dot'])('rejects unsafe path %s', (path) => {
    expect(() => readPackageArchive(pack([{ path }]))).toThrow('Unsafe archive path');
  });

  it.each(['1', '2', '3', '5', 'x', 'g', 'L'])('rejects nonregular or alternate tar entries %s', (type) => {
    expect(() => readPackageArchive(pack([{ path: 'package/README.md', type }]))).toThrow('Archive must contain only regular files');
  });

  it.each(['node_modules/secret', 'dist/app.js', '.env', 'unexpected.txt'])('rejects unlisted content %s', (path) => {
    expect(() => readPackageArchive(pack([{ path: `package/${path}` }]), starterFiles(candidate.version))).toThrow('Unexpected archive file');
  });

  it('rejects duplicate members, misleading link targets and missing expected files', () => {
    const member = { path: 'package/README.md' };
    expect(() => readPackageArchive(pack([member, member]))).toThrow('Duplicate archive file');
    expect(() => readPackageArchive(pack([{ ...member, link: '../secret' }]))).toThrow('Archive link target is forbidden');
    expect(() => readPackageArchive(pack([member]), ['README.md', 'package.json'])).toThrow('Missing archive file: package.json');
  });

  it('rejects bad checksums, truncated archives and data after the end marker', () => {
    const tar = gunzipSync(pack([{ path: 'package/README.md' }]));
    const corrupt = Buffer.from(tar);
    corrupt[0] ^= 1;
    expect(() => readPackageArchive(gzipSync(corrupt))).toThrow('Tar checksum mismatch');
    expect(() => readPackageArchive(gzipSync(tar.subarray(0, tar.length - 1)))).toThrow('Truncated tar archive');
    expect(() => readPackageArchive(gzipSync(tar.subarray(0, tar.length - 1024)))).toThrow('Missing tar end marker');
    expect(() => readPackageArchive(gzipSync(Buffer.concat([tar, Buffer.alloc(512, 1)])))).toThrow('Invalid tar end marker');
  });

  it('bounds compressed and inflated archive sizes', () => {
    expect(() => readPackageArchive(Buffer.alloc(4 * 1024 * 1024 + 1))).toThrow('Archive exceeds size limit');
    expect(() => readPackageArchive(gzipSync(Buffer.alloc(16 * 1024 * 1024 + 512)))).toThrow();
  });

  it('isolates the install from private npm settings and inherited credentials', () => {
    const env = consumerEnvironment('/tmp/isolated-consumer', { PATH: '/bin', NPM_TOKEN: 'secret', NODE_AUTH_TOKEN: 'secret',
      npm_config_userconfig: '/private/.npmrc', npm_config_cache: '/private/cache', NODE_OPTIONS: '--require=private.js', OTHER_SECRET: 'secret' });
    expect(env.PATH).toBe(`${dirname(process.execPath)}${delimiter}/bin`);
    expect(env.npm_config_cache).toBe('/tmp/isolated-consumer/npm-cache');
    expect(env.npm_config_userconfig).toBe('/tmp/isolated-consumer/user.npmrc');
    for (const key of ['NPM_TOKEN', 'NODE_AUTH_TOKEN', 'NODE_OPTIONS', 'OTHER_SECRET']) expect(env).not.toHaveProperty(key);
    expect(JSON.stringify(env)).not.toMatch(/secret|\/private\/(?:\.npmrc|cache)/);
  });
});

describe("the starter's widget page", () => {
  const source = (name) => read(`examples/platform/src/${name}`).toString('utf8');
  it('loads the frame with the referrer policy it states, and adds nothing else to it', () => {
    const page = source('widget.html');
    // One script, the bundle of widget.mjs, and two fields: the theme and the accent.
    expect([...page.matchAll(/<script\b[^>]*>/giu)].map(([tag]) => tag)).toEqual(['<script type="module" src="/widget.js">']);
    expect([...page.matchAll(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"/giu)].map(([, id]) => id)).toEqual(['theme', 'accent']);
    expect(page).toContain('<code>strict-origin-when-cross-origin</code> omits the parent path and query');
    const loader = source('widget.mjs');
    expect([...loader.matchAll(/^import .* from '([^']+)';$/gmu)].map(([, from]) => from)).toEqual(['./widget-contract.mjs']);
    expect(loader).toContain("frame.referrerPolicy = 'strict-origin-when-cross-origin';");
    for (const code of [loader, source('widget-contract.mjs')]) {
      expect(code).not.toMatch(/postMessage|localStorage|sessionStorage|indexedDB|cookie|sendBeacon|fetch\(|XMLHttpRequest|WebSocket|PaymentRequest|ethereum|navigator\.credentials|import\(/u);
    }
  });
});
