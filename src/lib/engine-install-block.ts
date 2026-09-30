/**
 * The install commands the engine page publishes.
 *
 * Same discipline as `mcp-install-block.ts`, and here for the same reason: the
 * page tells readers to check a digest, so the block has to actually check one.
 * An audit of the earlier MCP block found it running `shasum -a 256` and
 * printing the expected value in a comment — that reads like a check and is
 * not one, because shasum exits 0 on any readable file and the lines after it
 * run regardless.
 *
 * This block is shorter than the MCP one because nothing is unpacked: the
 * archive is downloaded, compared, and handed to npm. What it must never do is
 * reach `npm install` on bytes it did not verify.
 *
 * Two rules follow from that, and both are asserted statically in the test
 * because both are easy to break while making the block friendlier. The
 * verification runs UNCONDITIONALLY — no `if`, no `command -v node`, no `||`
 * between the download and the install, because a missing verifier has to stop
 * the install rather than be skipped over. And the block is plain POSIX shell,
 * because the comment in it says "macOS, Linux or WSL" and `/bin/sh` is `dash`
 * on Debian and Ubuntu: a `[[ ... ]]` in place of the guard below is not an
 * error there, it is a silently skipped guard that overwrites a file the user
 * already had. The test runs every case under bash, dash and sh for that
 * reason. `scripts/engine-install-block.test.mjs`
 * executes it against the real archive, a tampered one, a truncated one, and a
 * failing download.
 *
 * It also stops, before downloading anything, unless the directory it runs in
 * has a package.json (finding F-04). Without one, `npm install` does not
 * install here: it walks up to the nearest parent directory with a
 * package.json or node_modules and installs into that project instead. The
 * test shows npm doing that, and the guard stopping it, in every shell.
 */
export interface EngineArtifact {
  readonly name: string;
  readonly version: string;
  readonly artifactUrl: string;
  readonly sha256: string;
}

/** The filename the archive lands under, taken from the published URL. */
export function archiveNameFor(artifact: EngineArtifact): string {
  const path = artifact.artifactUrl.split(/[?#]/u)[0];
  return path.slice(path.lastIndexOf('/') + 1);
}

/**
 * Three manifest fields are interpolated into a shell string and a JS heredoc
 * below. Nothing escapes them, so a single quote in any of the three would
 * produce a block that runs something else — published verbatim on a page that
 * tells strangers to paste it. The manifest is in-repo and reviewed, which
 * makes this unlikely rather than impossible, so the build refuses instead.
 */
function checked(artifact: EngineArtifact, file: string): void {
  const bad = (what: string, value: string): never => {
    throw new Error(`engineInstallBlock: refusing to render a block from an unusable ${what}: ${value}`);
  };
  if (!/^[\w.@+-]+\.tgz$/u.test(file)) bad('archive filename', file);
  if (!/^https:\/\/[\w.-]+(?:\/[\w.@+-]+)+$/u.test(artifact.artifactUrl)) bad('artifact URL', artifact.artifactUrl);
  if (!/^[0-9a-f]{64}$/u.test(artifact.sha256)) bad('sha256', artifact.sha256);
  if (!/^[\w.@/-]+$/u.test(artifact.name)) bad('package name', artifact.name);
  if (!/^[\w.+-]+$/u.test(artifact.version)) bad('version', artifact.version);
}

export function engineInstallBlock(artifact: EngineArtifact): string {
  const file = archiveNameFor(artifact);
  checked(artifact, file);
return `( set -eu
# POSIX shell — macOS, Linux or WSL. Not PowerShell. It runs in a subshell, so
# a failure stops the install without closing your terminal.
BASE=$(pwd)
FILE='${file}'
# Run it in your project's directory. Without a package.json here, npm would
# install into the nearest parent directory that has one.
if test ! -f package.json; then
  echo "Stop: there is no package.json here. Run this in your project's directory, or create one first with: npm init -y" >&2
  exit 1
fi
if test -e "$FILE" || test -L "$FILE"; then
  echo "Stop: $FILE already exists here. Move or delete it, then run this again." >&2
  exit 1
fi
# A download that fails verification is removed, so the guard above does not
# then block the retry. Once npm takes over the archive stays: npm reports its
# own failures, and the file is what you would retry with.
trap 'status=$?; if test "$status" -ne 0; then rm -f "$BASE/$FILE"; fi; exit $status' EXIT

curl --disable --fail --silent --show-error --location --proto '=https' --max-time 120 \\
  '${artifact.artifactUrl}' -o "$FILE"

node --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const file = '${file}';
const expected = '${artifact.sha256}';
const bytes = readFileSync(file);
const actual = createHash('sha256').update(bytes).digest('hex');
if (actual !== expected) {
  console.error(\`Stop: this is not the published archive.\\n  expected \${expected}\\n  got      \${actual}\`);
  console.error('Nothing was installed.');
  process.exit(1);
}
console.log(\`Archive verified: \${actual}\`);
JS

trap - EXIT
npm install --ignore-scripts "./$FILE"
echo "Installed ${artifact.name}@${artifact.version} from the verified archive."
)`;
}
