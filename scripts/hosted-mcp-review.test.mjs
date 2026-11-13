import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CALLS, NOT_APPLICABLE, RATE_LIMITED, classify, runScenario, strictFindings } from './hosted-mcp-review.mjs';
import { ALL_AI_TOOL_NAMES } from '../src/ai-tools/contracts';

const failure = (id, errorMessage) => ({ id, status: 'FAILURE', errorMessage });
const success = (id) => ({ id, status: 'SUCCESS', errorMessage: null });

describe('the hosted MCP review', () => {
  it('calls every tool production offers, once', () => {
    expect(Object.keys(CALLS).sort()).toEqual([...ALL_AI_TOOL_NAMES].sort());
  });

  it('counts a scenario as not applicable only when it fails as its reason predicts', () => {
    expect(classify('prompts-list', [failure('prompts-list', 'Failed: MCP error -32601: This MCP operation is not supported.')]))
      .toMatchObject({ verdict: 'not-applicable', reason: NOT_APPLICABLE['prompts-list'] });
    expect(classify('tools-call-image', [failure('tools-call-image', 'Failed: MCP error -32602: The MCP request does not match a supported operation or schema.')]))
      .toMatchObject({ verdict: 'not-applicable' });
    // The same scenario failing some other way is a failure, and so is a listed scenario that times out.
    expect(classify('prompts-list', [failure('prompts-list', 'Failed: fetch failed')])).toMatchObject({ verdict: 'fail' });
    expect(classify('tools-call-image', [failure('tools-call-image', 'Request timed out')])).toMatchObject({ verdict: 'fail' });
    // A scenario that applies fails on any failed check; with warnings and no confirmed check it has not passed.
    expect(classify('tools-list', [failure('tools-list', 'Failed: MCP error -32601')])).toMatchObject({ verdict: 'fail' });
    expect(classify('tools-list', [success('tools-list'), { id: 'note', status: 'WARNING' }])).toMatchObject({ verdict: 'pass', warnings: ['note'] });
    expect(classify('server-sse-polling', [{ id: 'server-sse-retry-field', status: 'WARNING' }])).toMatchObject({ verdict: 'warnings-only', warnings: ['server-sse-retry-field'] });
  });

  it('fails a scenario that did not run, or that checked nothing', () => {
    // The suite exits before writing checks.json: no checks at all, whatever the scenario.
    expect(classify('tools-list', [], 1)).toMatchObject({ verdict: 'fail', failures: [{ message: expect.stringContaining('did not run') }] });
    expect(classify('prompts-list', [], 1)).toMatchObject({ verdict: 'fail' });
    // Notes alone confirm nothing and warn of nothing.
    expect(classify('server-sse-polling', [{ id: 'outgoing-request', status: 'INFO' }])).toMatchObject({ verdict: 'fail' });
  });

  it('excuses the localhost check of DNS rebinding protection, never the rejection, and the whole scenario only off localhost', () => {
    const localhost = failure('localhost-host-valid-accepted', 'Expected HTTP 2xx for valid localhost Host/Origin headers, got 403');
    expect(classify('dns-rebinding-protection', [success('localhost-host-rebinding-rejected'), localhost]))
      .toMatchObject({ verdict: 'pass', notApplicableChecks: [{ check: 'localhost-host-valid-accepted' }] });
    expect(classify('dns-rebinding-protection', [failure('localhost-host-rebinding-rejected', 'Expected HTTP 403, got 200'), localhost]))
      .toMatchObject({ verdict: 'fail', failures: [{ check: 'localhost-host-rebinding-rejected' }] });
    // Against a deployed server the suite does not run it at all.
    const remote = 'DNS rebinding tests require a localhost server URL (localhost, 127.0.0.1, or [::1])';
    expect(classify('dns-rebinding-protection', [failure('localhost-host-rebinding-rejected', remote), failure('localhost-host-valid-accepted', remote)]))
      .toMatchObject({ verdict: 'not-applicable', reason: NOT_APPLICABLE['dns-rebinding-protection'] });
  });

  it('reads only the checks this run of a scenario wrote, never an earlier run\'s', () => {
    const out = mkdtempSync(join(tmpdir(), 'hosted-mcp-review-'));
    try {
      const root = join(out, 'conformance');
      // An earlier review into the same directory left a passing run of the scenario, in every folder name it used.
      for (const leftover of ['tools-list.1', 'tools-list.2', 'tools-list.']) {
        mkdirSync(join(root, leftover, 'server-tools-list-2026-01-01T00-00-00-000Z'), { recursive: true });
        writeFileSync(join(root, leftover, 'server-tools-list-2026-01-01T00-00-00-000Z', 'checks.json'), JSON.stringify([success('tools-list')]));
      }
      // This run fails.
      const failing = runScenario('tools-list', root, (dir) => {
        mkdirSync(join(dir, 'server-tools-list-2026-10-18T00-00-00-000Z'));
        writeFileSync(join(dir, 'server-tools-list-2026-10-18T00-00-00-000Z', 'checks.json'), JSON.stringify([failure('tools-list', 'Failed: fetch failed')]));
        return { status: 1, stdout: '', stderr: '' };
      });
      expect(classify('tools-list', failing.checks, failing.status)).toMatchObject({ verdict: 'fail' });
      // This run stops before it writes anything.
      const silent = runScenario('tools-list', root, () => ({ status: 1, stdout: '', stderr: '' }));
      expect(silent.checks).toEqual([]);
      expect(silent.dir).not.toBe(failing.dir);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('reads the Inspector\'s --strict findings', () => {
    const text = [
      'Warning: tool "get_sky"',
      '  Path: outputSchema.anyOf[0].properties.data.properties.time',
      '  Issue: `type` is an array (["string","null"]). This is legal JSON Schema.',
      '  Suggestion: Split it.',
      '',
      'Error: tool "get_birthday"',
      '  Path: outputSchema.anyOf[0].properties.data.properties.cusp.anyOf[0].properties.signs.items',
      '  Issue: Bare `false` used where a schema object is expected.',
    ].join('\n');
    expect(strictFindings(text)).toEqual([
      { severity: 'warning', tool: 'get_sky', path: 'outputSchema.anyOf[0].properties.data.properties.time', issue: '`type` is an array (["string","null"]). This is legal JSON Schema.' },
      { severity: 'error', tool: 'get_birthday', path: 'outputSchema.anyOf[0].properties.data.properties.cusp.anyOf[0].properties.signs.items', issue: 'Bare `false` used where a schema object is expected.' },
    ]);
  });

  it('knows the hosted server\'s rate limit when it meets it', () => {
    expect(RATE_LIMITED.test('Error POSTing to endpoint: {"error":{"code":"rate-limited","message":"Zodiacs is busy. Try again in a minute."}}","status":429')).toBe(true);
    expect(RATE_LIMITED.test('Failed: MCP error -32602: The MCP request does not match a supported operation or schema.')).toBe(false);
  });
});
