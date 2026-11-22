import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  auditWithRetry, executeAudit, isRetryableEndpointError,
} from './audit-with-retry.mjs';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));
beforeEach(() => vi.mocked(spawnSync).mockReset());

const diagnostic = 'npm error audit endpoint returned an error';
const outage = {
  status: 1,
  stdout: "{ error: 'Service Unavailable' }\n",
  stderr: `npm warn audit 503 Service Unavailable - POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk\n${diagnostic}\nnpm error A complete log of this run can be found in: /tmp/npm-audit.log\n`,
};
const clean = { status: 0, stdout: 'found 0 vulnerabilities\n', stderr: '' };
const findings = { status: 1, stdout: '# npm audit report\nexample-package *\nSeverity: high\n1 high severity vulnerability\n', stderr: '' };

function harness(...results) {
  let index = 0;
  return {
    execute: vi.fn(() => results[Math.min(index++, results.length - 1)]),
    wait: vi.fn(async () => {}),
    stdout: vi.fn(),
    stderr: vi.fn(),
  };
}

describe('dependency advisory endpoint retry classification', () => {
  it('recognizes the observed npm registry 503 without changing audit output mode', () => {
    expect(isRetryableEndpointError(outage)).toBe(true);
    expect(isRetryableEndpointError({ ...outage, stderr: diagnostic })).toBe(true);
    expect(isRetryableEndpointError({ ...outage, stdout: '{"error":"Service Unavailable"}' })).toBe(true);
    expect(isRetryableEndpointError({ ...outage, stdout: '' })).toBe(true);
  });

  it('requires the exact npm diagnostic and transient-error evidence', () => {
    for (const stderr of ['', 'Service Unavailable', 'npm error something else', `${diagnostic} (maybe)`, `prefix ${diagnostic}`]) {
      expect(isRetryableEndpointError({ ...outage, stderr }), stderr).toBe(false);
    }
    expect(isRetryableEndpointError({ ...outage, stdout: '', stderr: diagnostic })).toBe(false);
  });

  it.each([
    { status: 0 }, { status: null }, { status: undefined }, { status: '1' },
    { signal: 'SIGTERM' }, { error: new Error('spawn failed') },
  ])('never retries process failure or a successful status: %j', (override) => {
    expect(isRetryableEndpointError({ ...outage, ...override })).toBe(false);
  });

  it.each([
    '# npm audit report\n1 high severity vulnerability',
    'found 0 vulnerabilities',
    '{"error":"Service Unavailable","vulnerabilities":{"example":{}}}',
    '{"error":"Service Unavailable","advisories":{}}',
    '{"error":{"code":"E401","summary":"Unauthorized"}}',
    '{"error":"Unauthorized"}',
    '{ error: \'Service Unavailable\', vulnerabilities: {} }',
    '{ error:', 'null', '[]', 'Service Unavailable',
    '{"error":"Service Unavailable"}\n1 critical vulnerability',
  ])('rejects findings, auth, malformed and unfamiliar stdout: %s', (stdout) => {
    expect(isRetryableEndpointError({ ...outage, stdout })).toBe(false);
  });

  it.each([
    'npm error code E401',
    'npm error Unable to authenticate, need: Bearer',
    'npm warn audit 401 Unauthorized - POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk',
    'npm error code E403',
    'npm error code ENOLOCK',
    '1 critical severity vulnerability',
    'npm warn something unexpected',
  ])('rejects mixed stderr even with the exact endpoint diagnostic: %s', (extra) => {
    expect(isRetryableEndpointError({ ...outage, stderr: `${outage.stderr}${extra}\n` })).toBe(false);
  });

  it('recognizes npm 10 logging and the retired quick endpoint without invoking it itself', () => {
    expect(isRetryableEndpointError({
      ...outage,
      stderr: 'npm WARN audit 503 Service Unavailable - POST https://registry.npmjs.org/-/npm/v1/security/audits/quick\nnpm ERR! audit endpoint returned an error\n',
    })).toBe(true);
  });
});

describe('dependency advisory retry execution', () => {
  it.each(['--omit=dev', '--audit-level=high'])('invokes npm with exactly the original %s arguments', (policy) => {
    vi.mocked(spawnSync).mockReturnValueOnce(clean);
    expect(executeAudit([policy])).toBe(clean);
    expect(spawnSync).toHaveBeenLastCalledWith('npm', ['audit', policy], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
    });
  });

  it.each(['--omit=dev', '--audit-level=high'])('preserves the %s policy on every attempt', async (policy) => {
    const run = harness(outage, clean);
    expect(await auditWithRetry([policy], run)).toBe(0);
    expect(run.execute.mock.calls).toEqual([[[policy]], [[policy]]]);
    expect(run.wait.mock.calls).toEqual([[2_000]]);
    expect(run.stdout.mock.calls).toEqual([[outage.stdout], [clean.stdout]]);
    expect(run.stderr).toHaveBeenCalledWith(outage.stderr);
  });

  it('bounds retries at three attempts, fails exhaustion, and preserves the exit code', async () => {
    const run = harness({ ...outage, status: 7 });
    expect(await auditWithRetry(['--omit=dev'], run)).toBe(7);
    expect(run.execute).toHaveBeenCalledTimes(3);
    expect(run.wait.mock.calls).toEqual([[2_000], [5_000]]);
    expect(run.stderr).toHaveBeenCalledWith(expect.stringContaining('retries exhausted'));
  });

  it('can recover on the last allowed attempt', async () => {
    const run = harness(outage, outage, clean);
    expect(await auditWithRetry(['--omit=dev'], run)).toBe(0);
    expect(run.execute).toHaveBeenCalledTimes(3);
  });

  it('does not retry findings in either severity policy', async () => {
    for (const policy of ['--omit=dev', '--audit-level=high']) {
      const run = harness(findings, clean);
      expect(await auditWithRetry([policy], run)).toBe(1);
      expect(run.execute).toHaveBeenCalledTimes(1);
      expect(run.wait).not.toHaveBeenCalled();
    }
  });

  it('does not let a subsequent clean response hide mixed findings and endpoint errors', async () => {
    const run = harness({ ...outage, stdout: `${outage.stdout}${findings.stdout}` }, clean);
    expect(await auditWithRetry(['--omit=dev'], run)).toBe(1);
    expect(run.execute).toHaveBeenCalledTimes(1);
    expect(run.wait).not.toHaveBeenCalled();
  });

  it('fails immediately if an endpoint retry returns findings', async () => {
    const run = harness(outage, findings, clean);
    expect(await auditWithRetry(['--omit=dev'], run)).toBe(1);
    expect(run.execute).toHaveBeenCalledTimes(2);
    expect(run.wait).toHaveBeenCalledTimes(1);
  });

  it.each([
    { ...outage, stdout: '{ malformed' },
    { ...outage, stderr: `${outage.stderr}npm error code E401\n` },
    { status: null, signal: 'SIGTERM' },
    { status: null, error: new Error('spawn npm ENOENT') },
    { ...outage, status: 0 },
  ])('fails malformed, auth, interrupted, launch, or contradictory outcomes without retry', async (result) => {
    const run = harness(result, clean);
    expect(await auditWithRetry(['--omit=dev'], run)).toBe(1);
    expect(run.execute).toHaveBeenCalledTimes(1);
    expect(run.wait).not.toHaveBeenCalled();
  });

  it('preserves npm success for the existing high-only dev-tree policy', async () => {
    const run = harness({ ...clean, stdout: '1 low severity vulnerability\n' });
    expect(await auditWithRetry(['--audit-level=high'], run)).toBe(0);
    expect(run.execute).toHaveBeenCalledTimes(1);
    expect(run.wait).not.toHaveBeenCalled();
  });

  it.each([[], ['--audit-level=critical'], ['fix'], ['--omit=dev', '--audit-level=high'], ['--omit=dev', '--registry=https://example.com']])('rejects unsupported policy arguments: %j', async (...args) => {
    const run = harness(clean);
    await expect(auditWithRetry(args, run)).rejects.toThrow('Expected exactly');
    expect(run.execute).not.toHaveBeenCalled();
  });

  it('keeps both Site Check policies mandatory and ordered', () => {
    const workflow = readFileSync(new URL('../.github/workflows/site-check.yml', import.meta.url), 'utf8');
    expect(workflow).toContain('run: |\n          node scripts/audit-with-retry.mjs --omit=dev\n          node scripts/audit-with-retry.mjs --audit-level=high');
    const advisoryStep = workflow.split('- name: Dependency advisories stay at zero')[1].split('- name:')[0];
    expect(advisoryStep).not.toMatch(/continue-on-error|\|\|\s*true|set\s+\+e/u);
  });
});

describe('audit findings have no advisory exceptions', () => {
  // GHSA-fc5q-39xc-vjpf was withdrawn on 2026-11-18. If the registry
  // reports it again, fail normally rather than reviving the old exception.
  const formerlyExceptedReport = {
    vulnerabilities: {
      picomatch: {
        name: 'picomatch', severity: 'high',
        via: [{
          name: 'picomatch', severity: 'high', range: '<=4.0.7',
          url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf',
        }],
      },
    },
  };

  it.each([
    ['--omit=dev', 1], ['--omit=dev', 7],
    ['--audit-level=high', 1], ['--audit-level=high', 7],
  ])('preserves %s failure %s without a JSON fallback or package lookup', async (policy, status) => {
    vi.mocked(spawnSync)
      .mockReturnValueOnce({ ...findings, status, stdout: '# npm audit report\npicomatch <=4.0.7\nSeverity: high\n' })
      // These would have granted the former exception. Neither may run.
      .mockReturnValueOnce({ status: 1, stdout: JSON.stringify(formerlyExceptedReport), stderr: '' })
      .mockReturnValueOnce({ status: 0, stdout: '4.0.7\n', stderr: '' });
    const wait = vi.fn();
    const stdout = vi.fn();
    const stderr = vi.fn();
    expect(await auditWithRetry([policy], { wait, stdout, stderr })).toBe(status);
    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(spawnSync).toHaveBeenCalledWith('npm', ['audit', policy], expect.any(Object));
    expect(wait).not.toHaveBeenCalled();
  });
});
