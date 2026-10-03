/**
 * The install commands the engine page publishes, executed.
 *
 * The page tells readers to verify a digest before installing, so these cases
 * run the block rather than grep it: a test that looked for the word "sha256"
 * would pass over a block that printed the digest instead of comparing it,
 * which is exactly the defect an audit found in the first MCP block.
 *
 * `curl` is replaced by a shell function with the same contract — writes the
 * file and exits 0, or exits non-zero — because the real line fetches over
 * https from a pinned commit and a unit test should not depend on the network.
 * Its flags are asserted separately and statically. `npm` is stubbed because
 * what these cases establish is control flow: that nothing reaches `npm
 * install` unless the bytes matched.
 *
 * The first version of this file ran everything under `bash`, on a machine
 * with `node` on the PATH, and asserted the curl flags by presence. An
 * adversarial review broke the block three ways and all three passed 10/10:
 *
 *  - wrapping the verifier in `if command -v node; then ... else echo
 *    "not checked, continuing" >&2; fi`, which installs tampered bytes and
 *    exits 0 on any machine without node;
 *  - `if [[ -e "$FILE" || -L "$FILE" ]]` in place of the POSIX guard, which
 *    under dash — `/bin/sh` on Debian and Ubuntu, and the block says "Linux" —
 *    is not an error but a skipped guard, so the download silently overwrites
 *    a file the user already had and still reports success;
 *  - dropping `|| test -L "$FILE"`, which lets `curl -o` follow a planted
 *    dangling symlink and write 36 KB wherever it points.
 *
 * So every case below runs under bash, dash and sh; two of them run with
 * `node` removed from the PATH; the symlink cases are real; and the static
 * assertions now say what must NOT be between the download and the install
 * rather than only what must be present.
 *
 * Finding F-04 (docs/platform/programme/FINDINGS.md) was that the block could
 * install into a parent directory: run where there is no package.json, `npm
 * install` walks up to the nearest directory that has one and installs into
 * that project. The block now stops first, before any download, and the cases
 * below show both halves: the real npm choosing the parent, and the block
 * refusing to get that far.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, realpathSync, mkdirSync, symlinkSync, lstatSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { engineInstallBlock, archiveNameFor } from '../src/lib/engine-install-block.ts';

const root = process.cwd();
const page = readFileSync(resolve(root, 'src/pages/developers/engine/index.astro'), 'utf8');
const artifact = JSON.parse(readFileSync(resolve(root, 'src/data/platform-engine-candidate.json'), 'utf8'));
const archive = readFileSync(resolve(root, artifact.artifactPath));

/** Exactly what the page renders: same function, same manifest. */
const block = engineInstallBlock(artifact);
const file = archiveNameFor(artifact);

/**
 * Every shell the block says it runs in. `/bin/sh` is dash on Debian and
 * Ubuntu, so "POSIX shell — macOS, Linux or WSL" is a promise about dash
 * whether or not the author was thinking about dash.
 */
const SHELLS = ['bash', 'dash', 'sh'].filter((shell) => {
  try {
    execFileSync(shell, ['-c', 'exit 0'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
});

/**
 * A PATH with no `node` on it, for the cases that check the verifier cannot be
 * skipped. Built by pointing PATH at a directory holding only the handful of
 * binaries the block needs, so nothing else changes.
 */
function pathWithoutNode(dir) {
  const bin = join(dir, 'nonode');
  mkdirSync(bin, { recursive: true });
  for (const tool of ['cp', 'rm', 'test', 'echo', 'pwd']) {
    const found = ['/usr/bin', '/bin'].map((d) => join(d, tool)).find((f) => existsSync(f));
    if (found) symlinkSync(found, join(bin, tool));
  }
  return bin;
}

/** A project's package.json, which the block now requires in the directory it runs in (F-04). */
const PROJECT = '{ "name": "reader-project", "private": true }\n';

function run(bytes, {
  seedFile = false, seedDir = false, seedSymlinkTo = null, seedDanglingSymlink = false,
  npmFails = false, dir = null, shell = 'bash', withoutNode = false, packageJson = true,
} = {}) {
  dir = dir ?? mkdtempSync(join(tmpdir(), 'zodiacs-engine-install-'));
  const target = join(dir, file);
  const payload = join(dir, 'payload.bin');
  if (bytes) writeFileSync(payload, bytes);
  if (packageJson && !existsSync(join(dir, 'package.json'))) writeFileSync(join(dir, 'package.json'), PROJECT);
  if (seedFile) writeFileSync(target, 'something of mine');
  if (seedDir) {
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'mine.txt'), 'do not touch');
  }
  if (seedSymlinkTo) {
    writeFileSync(join(dir, seedSymlinkTo), 'victim contents');
    symlinkSync(join(dir, seedSymlinkTo), target);
  }
  if (seedDanglingSymlink) symlinkSync(join(dir, 'not-created-yet'), target);
  // Every call to the curl stub leaves a mark, so a case can show that nothing
  // was downloaded, not only that nothing was installed.
  const curl = bytes
    ? `curl() { echo curl >> '${dir}/curl.log'; while [ $# -gt 0 ]; do [ "$1" = "-o" ] && { cp '${payload}' "$2"; return 0; }; shift; done; return 1; }`
    : `curl() { echo curl >> '${dir}/curl.log'; : > "${file}"; echo "curl: (22) The requested URL returned error: 404" >&2; return 22; }`;
  const npm = `npm() { echo "npm $*" >> '${dir}/npm.log'; return ${npmFails ? 1 : 0}; }`;
  const env = withoutNode ? { ...process.env, PATH: pathWithoutNode(dir) } : process.env;
  let status = 0;
  let output = '';
  try {
    output = execFileSync(shell, ['-c', `${curl}\n${npm}\n${block}\n`], {
      cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env,
    });
  } catch (error) {
    status = error.status ?? 1;
    output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  }
  const present = existsSync(target) || lstatSync(target, { throwIfNoEntry: false }) !== undefined;
  return {
    dir,
    shell,
    status,
    output,
    archivePresent: present,
    npmLog: existsSync(join(dir, 'npm.log')) ? readFileSync(join(dir, 'npm.log'), 'utf8') : '',
    downloaded: existsSync(join(dir, 'curl.log')),
    seededIntact: seedFile && existsSync(target) ? readFileSync(target, 'utf8') : null,
    seededDirIntact: seedDir && existsSync(join(target, 'mine.txt'))
      ? readFileSync(join(target, 'mine.txt'), 'utf8') : null,
    victim: seedSymlinkTo && existsSync(join(dir, seedSymlinkTo))
      ? readFileSync(join(dir, seedSymlinkTo), 'utf8') : null,
    danglingTargetCreated: existsSync(join(dir, 'not-created-yet')),
  };
}

const discard = (dir) => rmSync(dir, { recursive: true, force: true });

describe('the install commands the engine page publishes', () => {
  it('is the block the page publishes, not a copy of it', () => {
    expect(page).toMatch(/import \{[^}]*\bengineInstallBlock\b[^}]*\} from '[^']*\/engine-install-block'/u);
    expect(page).toMatch(/engineInstallBlock\(candidate\)/u);
    expect(page).toContain('<code>{install}</code>');
  });

  it('parses as POSIX shell in every shell it claims to run in', () => {
    expect(SHELLS, 'dash must be available for this suite to mean anything').toContain('dash');
    for (const shell of SHELLS) {
      expect(
        () => execFileSync(shell, ['-n'], { input: block, stdio: ['pipe', 'ignore', 'pipe'] }),
        `${shell} -n rejected the block`,
      ).not.toThrow();
    }
    // The bashism that started this: syntactically fine under bash, and under
    // dash a skipped guard rather than an error, which is worse than a crash.
    expect(block, 'no [[ ]] — dash treats it as a command that is not found').not.toMatch(/\[\[/u);
  });

  it('gives curl exactly the flags it is supposed to have, and no others', () => {
    // Presence assertions are a whitelist: `--insecure` would have passed all
    // of them. The whole invocation is pinned instead.
    const curl = /^curl (.*?) \\\n\s*'([^']+)' -o "\$FILE"$/mu.exec(block);
    expect(curl, 'the curl invocation must be one recognisable line').toBeTruthy();
    expect(curl[1].split(/\s+/u)).toEqual([
      '--disable', '--fail', '--silent', '--show-error', '--location',
      '--proto', "'=https'", '--max-time', '120',
    ]);
    expect(curl[2]).toBe(artifact.artifactUrl);
    expect(block).toMatch(/^\( set -eu$/mu);
  });

  it('puts nothing conditional between the download and the install', () => {
    // `if command -v node; then ... fi` around the verifier passed every
    // behavioural case, because every case ran where node exists.
    const from = block.indexOf('curl --disable');
    const to = block.indexOf('npm install');
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    // The heredoc body is JavaScript and legitimately contains `if`; what
    // must be unconditional is the shell around it, so the JS is cut out
    // first and the cut itself is asserted, not assumed.
    const between = block.slice(from, to);
    const heredoc = /<<'JS'\n[\s\S]*?\nJS\n/u;
    expect(between, 'the verifier heredoc must be where this thinks it is').toMatch(heredoc);
    const shellOnly = between.replace(heredoc, '\n');
    expect(shellOnly).not.toMatch(/createHash/u);
    for (const conditional of [/\bif\s/u, /\bcommand -v\b/u, /\bwhich\b/u, /\bcase\s/u, /\|\|/u, /&&/u]) {
      expect(shellOnly, `the verifier must not be guarded by ${conditional}`).not.toMatch(conditional);
    }
  });

  it('asks npm not to run the archive\'s lifecycle scripts', () => {
    expect(block).toMatch(/npm install --ignore-scripts "\.\/\$FILE"/u);
  });

  it('checks for a package.json here before it downloads anything (F-04)', () => {
    const guard = block.indexOf('if test ! -f package.json; then');
    expect(guard, 'the package.json guard must be in the block').toBeGreaterThan(-1);
    expect(guard).toBeLessThan(block.indexOf('curl --disable'));
    expect(guard).toBeLessThan(block.indexOf('npm install'));
  });

  it('guards against what npm really does without a package.json here (F-04)', () => {
    // The premise of the guard, shown with the real npm rather than assumed:
    // run in a directory with no package.json, npm takes the nearest parent
    // that has one as the project, and `npm install` would write there.
    // `npm prefix` prints that directory without touching the network. npm's
    // own variables are dropped, because `npm test` sets a local prefix of
    // its own in the environment.
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^npm_/iu.test(key)));
    const parent = mkdtempSync(join(tmpdir(), 'zodiacs-engine-parent-'));
    const child = join(parent, 'new-project');
    mkdirSync(child);
    writeFileSync(join(parent, 'package.json'), PROJECT);
    const prefix = (cwd) => execFileSync('npm', ['prefix'], { cwd, env, encoding: 'utf8' }).trim();
    try {
      expect(prefix(child), 'npm would install into the parent project').toBe(realpathSync(parent));
      writeFileSync(join(child, 'package.json'), PROJECT);
      expect(prefix(child), 'with a package.json here, npm installs here').toBe(realpathSync(child));
    } finally {
      discard(parent);
    }
  });

  it('refuses to render a block from a manifest it cannot safely interpolate', () => {
    // Three fields go into a shell string and a JS heredoc unescaped.
    const cases = [
      ['artifactUrl', "https://example.test/a'.tgz;rm -rf /tmp/x;echo '"],
      ['sha256', "' || true; echo '"],
      ['version', "1.0.0'; rm -rf /"],
    ];
    for (const [field, value] of cases) {
      expect(() => engineInstallBlock({ ...artifact, [field]: value }), field).toThrow(/refusing to render/u);
    }
    // …and a query string does not become part of the filename.
    expect(archiveNameFor({ ...artifact, artifactUrl: `${artifact.artifactUrl}?raw=true` })).toBe(file);
  });

  it('compares the digest rather than printing it, before npm sees the file', () => {
    expect(block).toContain(artifact.sha256);
    expect(block).toContain('createHash');
    expect(block).not.toMatch(/shasum\s+-a\s+256/u);
    const verified = block.indexOf('createHash');
    expect(verified).toBeGreaterThan(-1);
    expect(verified).toBeLessThan(block.indexOf('npm install'));
  });

  // Every behavioural case runs in every shell the block claims. Under dash a
  // guard written with `[[ ]]` is skipped rather than fatal, so a bash-only
  // suite cannot see the difference between a guard and no guard.
  describe.each(SHELLS)('in %s', (shell) => {
    it('installs when the archive is the published one', () => {
      const result = run(archive, { shell });
      discard(result.dir);
      expect(result.status, result.output).toBe(0);
      expect(result.npmLog).toMatch(new RegExp(`npm install --ignore-scripts \\./${file.replace(/\./gu, '\\.')}`, 'u'));
      expect(result.output).toContain('Archive verified');
    });

    it('never reaches npm when the digest does not match', () => {
      // Flip a byte rather than setting one: writing 0x00 over a byte that was
      // already 0x00 produces an identical archive and proves nothing.
      const tampered = Buffer.from(archive);
      tampered[tampered.length - 1] ^= 0xff;
      expect(tampered.length).toBe(archive.length);
      expect(createHash('sha256').update(tampered).digest('hex')).not.toBe(artifact.sha256);
      const result = run(tampered, { shell });
      discard(result.dir);
      expect(result.status).not.toBe(0);
      expect(result.npmLog, 'nothing may be installed after a failed digest').toBe('');
      expect(result.archivePresent, 'the rejected download is not left lying around').toBe(false);
      expect(result.output).toContain('Nothing was installed.');
    });

    it('never reaches npm when the archive is truncated', () => {
      const result = run(archive.subarray(0, Math.floor(archive.length / 2)), { shell });
      discard(result.dir);
      expect(result.status).not.toBe(0);
      expect(result.npmLog).toBe('');
      expect(result.archivePresent).toBe(false);
    });

    it('never reaches npm when the download fails', () => {
      // curl --fail can leave an empty file behind on a 404; the stub does too.
      const result = run(null, { shell });
      discard(result.dir);
      expect(result.status).not.toBe(0);
      expect(result.npmLog).toBe('');
      expect(result.archivePresent, 'the empty file curl left must not survive').toBe(false);
    });

    it('never reaches npm when there is no node to verify with', () => {
      // The review's first break was `if command -v node; then ... fi` around
      // the verifier: on a machine without node it installed tampered bytes
      // and exited 0. A missing verifier has to stop the install.
      const tampered = Buffer.from(archive);
      tampered[tampered.length - 1] ^= 0xff;
      const result = run(tampered, { shell, withoutNode: true });
      discard(result.dir);
      expect(result.status, result.output).not.toBe(0);
      expect(result.npmLog, 'a skipped verifier must not become an install').toBe('');
      expect(result.output).not.toContain('Installed @zodiacs/engine');
    });

    it('leaves a file of the same name untouched', () => {
      const result = run(archive, { shell, seedFile: true });
      discard(result.dir);
      expect(result.status).not.toBe(0);
      expect(result.npmLog).toBe('');
      expect(result.seededIntact, 'a file in the way must survive untouched').toBe('something of mine');
      expect(result.output).toContain('already exists here');
    });

    it('leaves a directory of the same name untouched', () => {
      const result = run(archive, { shell, seedDir: true });
      discard(result.dir);
      expect(result.status).not.toBe(0);
      expect(result.npmLog).toBe('');
      expect(result.seededDirIntact).toBe('do not touch');
    });

    it('will not write through a symlink someone planted', () => {
      // `test -e` is false for a dangling symlink, so without the `test -L`
      // half of the guard curl opens the link's target with O_CREAT and
      // writes the archive wherever it points — then `rm -f` deletes the
      // link and leaves the file it made.
      const result = run(archive, { shell, seedDanglingSymlink: true });
      discard(result.dir);
      expect(result.status).not.toBe(0);
      expect(result.npmLog).toBe('');
      expect(result.danglingTargetCreated, 'nothing may be created through the link').toBe(false);
      expect(result.output).toContain('already exists here');
    });

    it('will not write through a symlink to a file that exists', () => {
      const result = run(archive, { shell, seedSymlinkTo: 'victim.txt' });
      discard(result.dir);
      expect(result.status).not.toBe(0);
      expect(result.npmLog).toBe('');
      expect(result.victim, 'the file the link points at must be unchanged').toBe('victim contents');
    });

    it('stops before downloading anything when this directory has no package.json', () => {
      const result = run(archive, { shell, packageJson: false });
      discard(result.dir);
      expect(result.status).not.toBe(0);
      expect(result.downloaded, 'nothing may be downloaded').toBe(false);
      expect(result.npmLog, 'nothing may be installed').toBe('');
      expect(result.archivePresent).toBe(false);
      expect(result.output).toContain('there is no package.json here');
    });

    it('does not install into a parent project from a directory without a package.json', () => {
      // F-04: npm would take the parent's package.json for this project's.
      const parent = mkdtempSync(join(tmpdir(), 'zodiacs-engine-parent-'));
      const child = join(parent, 'new-project');
      mkdirSync(child);
      writeFileSync(join(parent, 'package.json'), PROJECT);
      const result = run(archive, { shell, dir: child, packageJson: false });
      const parentManifest = readFileSync(join(parent, 'package.json'), 'utf8');
      const parentEntries = existsSync(join(parent, 'node_modules')) || existsSync(join(parent, file));
      discard(parent);
      expect(result.status).not.toBe(0);
      expect(result.downloaded).toBe(false);
      expect(result.npmLog).toBe('');
      expect(result.archivePresent).toBe(false);
      expect(parentManifest, 'the parent project must be left alone').toBe(PROJECT);
      expect(parentEntries).toBe(false);
    });

    it('does not take a directory named package.json for a project', () => {
      const dir = mkdtempSync(join(tmpdir(), 'zodiacs-engine-install-'));
      mkdirSync(join(dir, 'package.json'));
      const result = run(archive, { shell, dir, packageJson: false });
      discard(dir);
      expect(result.status).not.toBe(0);
      expect(result.downloaded).toBe(false);
      expect(result.npmLog).toBe('');
    });

    it('can simply be run again after a rejected download', () => {
      const dir = mkdtempSync(join(tmpdir(), 'zodiacs-engine-retry-'));
      const tampered = Buffer.from(archive);
      tampered[tampered.length - 1] ^= 0xff;
      expect(run(tampered, { dir, shell }).status).not.toBe(0);
      const retried = run(archive, { dir, shell });
      discard(dir);
      expect(retried.status, retried.output).toBe(0);
      expect(retried.output).not.toContain('already exists here');
    });

    it('keeps the verified archive when npm itself fails, and does not claim success', () => {
      // Deliberately unlike the MCP block, which cleans up a directory it
      // created. Here npm owns whatever state it left; the verified archive is
      // what a retry needs, so removing it would make the failure harder to fix.
      const result = run(archive, { shell, npmFails: true });
      discard(result.dir);
      expect(result.status).not.toBe(0);
      expect(result.npmLog).toMatch(/npm install/u);
      expect(result.archivePresent).toBe(true);
      expect(result.output).not.toContain('Installed @zodiacs/engine');
    });
  });
});
