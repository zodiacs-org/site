import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const directory = process.env.INSPECTOR_REVIEW_DIR;
assert.ok(directory, 'Isolated Inspector installation is required');
const require = createRequire(resolve(directory, 'package.json'));
const inspectorPackage = require('@modelcontextprotocol/inspector/package.json');
assert.equal(inspectorPackage.version, '2.10.1');
const Ajv = require('ajv');
const Ajv2020 = require('ajv/dist/2020');
const addFormats = require('ajv-formats');
const storage = resolve(directory, 'isolated-auth');
mkdirSync(storage, { recursive: true, mode: 0o700 });
const environment = { ...process.env, MCP_STORAGE_DIR: storage,
  MCP_INSPECTOR_OAUTH_STATE_PATH: resolve(storage, 'oauth.json') };
const executable = resolve(directory, 'node_modules/@modelcontextprotocol/inspector/clients/launcher/build/index.js');
const origin = 'https://zodiacs.org/mcp';
const fixtures = {
  get_capabilities: {},
  get_sky: { instant: '2026-10-09T00:00:00Z', zone: 'UTC', bodies: ['Sun', 'Moon'] },
  get_upcoming_events: { from: '2026-10-09T00:00:00Z', to: '2026-10-12T00:00:00Z', zone: 'UTC', kinds: ['lunation'] },
  check_sky_fact: { kind: 'retrograde', body: 'Mercury', instant: '2026-10-09T00:00:00Z' },
  get_horoscope: { sign: 'aries', period: 'day', zone: 'UTC' },
  open_chart_studio: {},
};
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const calls = [];
async function command(method, extra = []) {
  const args = [executable, '--cli', '--transport', 'http', '--server-url', origin,
    '--connect-timeout', '15000', '--stored-auth-only', '--format', 'json', '--method', method, ...extra];
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', env: environment,
    timeout: 45000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  calls.push({ method, tool: extra.includes('--tool-name') ? extra[extra.indexOf('--tool-name') + 1] : null,
    exit: result.status, signal: result.signal, stdoutSha256: sha256(result.stdout ?? ''),
    stderrSha256: sha256(result.stderr ?? '') });
  assert.equal(result.status, 0, 'Inspector operation failed: ' + method);
  const envelope = JSON.parse(result.stdout);
  assert.ok(envelope.result, 'Inspector result envelope required');
  // Keep the remote traffic bounded without changing any platform limiter.
  await wait(10000);
  return envelope;
}
const report = {
  schema: 'zodiacs.remote-mcp-inspector-review.v1',
  producer: { head: process.env.GITHUB_SHA, run: process.env.GITHUB_RUN_ID, node: process.version },
  endpoint: origin, inspector: { version: inspectorPackage.version,
    lockSha256: sha256(readFileSync(resolve(directory, 'package-lock.json'))) },
  credentials: 'none; isolated empty OAuth state, stored-auth-only',
  calls, tools: [], passed: false,
  limitations: ['Inspector handshake/schema/tool integration review, not a full MCP conformance suite',
    'No rendered MCP App or end-user assistant trial',
    'No registry publication, account/grant/hosting changes, or private scan',
    'Unavailable horoscope editions, if reported, are not counted as content delivery'],
};
try {
  const initialized = await command('initialize');
  assert.equal(initialized.result.serverInfo.version, '0.4.0');
  report.server = initialized.result;
  const listed = await command('tools/list', ['--strict']);
  assert.deepEqual(listed.result.tools.map((tool) => tool.name).sort(), Object.keys(fixtures).sort());
  report.schemaFindings = listed.schemaFindings ?? [];
  for (const tool of listed.result.tools) {
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.ok(tool.inputSchema && tool.outputSchema, 'Both schemas required: ' + tool.name);
    const validate = (schema) => {
      const Constructor = schema.$schema?.includes('2020-12') ? Ajv2020 : Ajv;
      const ajv = new Constructor({ strict: false, allErrors: true });
      addFormats(ajv);
      return ajv.compile(schema);
    };
    const inputValidator = validate(tool.inputSchema);
    assert.equal(inputValidator(fixtures[tool.name]), true, 'Fixture input schema: ' + tool.name);
    const called = await command('tools/call', ['--tool-name', tool.name, '--tool-args-json', JSON.stringify(fixtures[tool.name])]);
    assert.notEqual(called.result.isError, true, 'Tool refused fixture: ' + tool.name);
    const payload = called.result.structuredContent;
    assert.ok(payload, 'Structured output required: ' + tool.name);
    const outputValidator = validate(tool.outputSchema);
    assert.equal(outputValidator(payload), true, 'Output schema: ' + tool.name);
    assert.equal(payload.schema, 'zodiacs.ai-tool-result.v1');
    assert.equal(payload.tool, tool.name);
    assert.equal(payload.ok, true);
    const invalid = structuredClone(payload);
    delete invalid.schema;
    assert.equal(outputValidator(invalid), false, 'Missing-field output control: ' + tool.name);
    if (tool.name === 'get_sky' || tool.name === 'check_sky_fact') {
      assert.equal(payload.data.calculation.cite.version, '1.0.0-rc.2');
    }
    report.tools.push({ name: tool.name, inputSha256: sha256(JSON.stringify(fixtures[tool.name])),
      inputSchemaSha256: sha256(JSON.stringify(tool.inputSchema)),
      outputSchemaSha256: sha256(JSON.stringify(tool.outputSchema)),
      outputSha256: sha256(JSON.stringify(payload)), inputValid: true, outputValid: true,
      missingSchemaControlRefused: true,
      ...(tool.name === 'get_horoscope' ? { editionStatus: payload.data?.status ?? null } : {}) });
  }
  report.passed = true;
} catch (error) {
  report.failure = error instanceof Error ? error.message : 'Review failed';
} finally {
  const bytes = Buffer.from(JSON.stringify(report, null, 2) + '\n');
  writeFileSync('remote-mcp-inspector-review.json', bytes);
  console.log('PROGRAMME_FILE ' + JSON.stringify({ path: 'remote-mcp-inspector-review.json',
    size: bytes.length, sha256: sha256(bytes), base64: bytes.toString('base64') }));
}
if (!report.passed) process.exitCode = 1;
