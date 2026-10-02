/**
 * Named-host acceptance: does a real end-user MCP host launch this adapter and
 * connect to it?
 *
 *   node tests/mcp-host-drive.mjs
 *
 * The host is the Claude Code CLI, which is what is actually installable here.
 * Only the installed Claude Code CLI is exercised here; no claim is made
 * about the separate Claude Desktop application.
 *
 * The drive uses the host's own documented mechanism — `claude mcp add`,
 * `list`, `get`, `remove` — inside a throwaway CLAUDE_CONFIG_DIR and a
 * throwaway project directory, so the machine's real Claude Code setup is never
 * read from or written to. It asserts that afterwards.
 *
 * What this drive does NOT do is drive a model. A model turn needs credentials
 * and costs a request, so it is recorded separately, by hand, with the exact
 * command and the exact reply, in host-interop.md. This file covers the part
 * that can be re-run by anyone at any time.
 */
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const SERVER = resolve(ROOT, 'examples/mcp-server/server.mjs');
const OUT = resolve(ROOT, 'docs/platform/evidence/mcp-adapter');

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) });
  if (!ok) console.error(`FAIL ${name}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
};

const version = spawnSync('claude', ['--version'], { encoding: 'utf8' });
if (version.error || version.status !== 0) {
  console.error('mcp-host-drive: the Claude Code CLI is not on PATH here, so no named host can be'
    + ' exercised. That is the exact limitation; nothing is simulated in its place.');
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'host-drive.json'), `${JSON.stringify({
    host: 'claude-code-cli', available: false,
    reason: 'the claude executable is not on PATH in this environment',
    completedAt: new Date().toISOString(),
  }, null, 2)}\n`);
  process.exit(1);
}
const hostVersion = version.stdout.trim();

const sandbox = mkdtempSync(join(tmpdir(), 'zodiacs-mcp-host-'));
const configDir = join(sandbox, 'claude-config');
const project = join(sandbox, 'project');
mkdirSync(configDir, { recursive: true });
mkdirSync(project, { recursive: true });

/** Every host invocation runs against the throwaway config, never the real one. */
const host = (args) => spawnSync('claude', args, {
  cwd: project, encoding: 'utf8', env: { ...process.env, CLAUDE_CONFIG_DIR: configDir },
});

// A fingerprint of the machine's real Claude Code config, to prove afterwards
// that the drive did not touch it. Read once, compared once; never written.
const realConfig = join(homedir(), '.claude.json');
const fingerprint = (path) => (existsSync(path)
  ? createHash('sha256').update(readFileSync(path)).digest('hex') : 'absent');
const before = fingerprint(realConfig);

const added = host(['mcp', 'add', 'zodiacs', '--scope', 'local', '--', 'node', SERVER]);
check('the host accepts the server through its documented add command',
  added.status === 0 && /Added stdio MCP server zodiacs/.test(added.stdout), added.stdout.trim() || added.stderr.trim());
check('the registration landed in the throwaway config, not the real one',
  added.stdout.includes(configDir), added.stdout.trim());

const listed = host(['mcp', 'list']);
check('the host launches the server and reports it connected',
  listed.status === 0 && /zodiacs:.*Connected/s.test(listed.stdout), listed.stdout.trim() || listed.stderr.trim());

const got = host(['mcp', 'get', 'zodiacs']);
check('the host reports it as a connected stdio server',
  got.status === 0 && /Status:.*Connected/.test(got.stdout) && /Type: stdio/.test(got.stdout),
  got.stdout.trim() || got.stderr.trim());

const removed = host(['mcp', 'remove', 'zodiacs', '-s', 'local']);
check('the documented removal command removes it',
  removed.status === 0 && /Removed MCP server zodiacs/.test(removed.stdout), removed.stdout.trim());

const afterList = host(['mcp', 'list']);
check('nothing is left configured after removal',
  /No MCP servers configured/.test(afterList.stdout), afterList.stdout.trim());

check('the machine\'s own Claude Code configuration is byte-identical throughout',
  fingerprint(realConfig) === before, { before, after: fingerprint(realConfig) });

const bundle = await readFile(SERVER);
await mkdir(OUT, { recursive: true });
const evidence = {
  type: 'named end-user host interoperability: the host launched the adapter and connected to it.'
    + ' Separate from the official-SDK protocol drive, and separate from the model-driven'
    + ' demonstration recorded by hand in host-interop.md.',
  host: { name: 'Claude Code CLI', version: hostVersion, mechanism: 'claude mcp add/list/get/remove, stdio' },
  notTested: [
    'Claude Desktop: not exercised; this drive tests the installed CLI only.',
    'VS Code, Cursor and other hosts: not installed here. Their config files are documented in the README from their own docs, not from a run.',
  ],
  isolation: { claudeConfigDir: 'a throwaway directory', project: 'a throwaway directory', realConfigTouched: false },
  server: { path: 'examples/mcp-server/server.mjs', sha256: createHash('sha256').update(bundle).digest('hex') },
  completedAt: new Date().toISOString(),
  checks: results.length,
  passed: results.filter((row) => row.ok).length,
  results,
};
await writeFile(join(OUT, 'host-drive.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`mcp-host-drive: ${evidence.passed}/${evidence.checks} checks passed against ${hostVersion}`);
if (evidence.passed !== evidence.checks) process.exitCode = 1;
