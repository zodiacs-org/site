import { describe, expect, it } from 'vitest';
import {
  assertCaptureRuntime,
  CAPTURE_OPT_IN,
  captureMarker,
  PINNED_BROWSER_VERSION,
  sanitizedStepOutcomes,
  selectCaptureRequest,
} from './browser-evidence-control.mjs';

const repository = 'ZodiacsOfficial/site';
const head = 'a'.repeat(40);
const base = 'b'.repeat(40);
function event(action, overrides = {}) {
  return {
    action,
    repository: { full_name: repository },
    pull_request: {
      body: `${CAPTURE_OPT_IN}\nReady for review.`,
      head: { sha: head, repo: { full_name: repository } },
      base: { sha: base },
    },
    ...overrides,
  };
}

describe('browser evidence capture control', () => {
  it.each(['opened', 'synchronize', 'reopened'])('compares on %s', (action) => {
    expect(selectCaptureRequest(event(action), repository)).toEqual({ mode: 'compare', headSha: head, baseSha: base });
  });

  it('generates candidates only when a current-head marker is newly added', () => {
    const request = event('edited', { changes: { body: { from: 'Reviewed the comparison artifacts.' } } });
    request.pull_request.body += `\n${captureMarker(head)}`;
    expect(selectCaptureRequest(request, repository)?.mode).toBe('candidates');
  });

  it('does not reinterpret a surviving marker as another request', () => {
    const marker = captureMarker(head);
    const request = event('edited', { changes: { body: { from: marker } } });
    request.pull_request.body = `${CAPTURE_OPT_IN}\n${marker}\nAn unrelated description update.`;
    expect(selectCaptureRequest(request, repository)).toBeNull();
  });

  it('does not accept a marker bound to a previous head', () => {
    const request = event('edited', { changes: { body: { from: '' } } });
    request.pull_request.body = `${CAPTURE_OPT_IN}\n${captureMarker(base)}`;
    expect(selectCaptureRequest(request, repository)).toBeNull();
  });

  it('does not accept title edits, missing bodies or marker removal', () => {
    const titleEdit = event('edited', { changes: { title: { from: 'Old title' } } });
    titleEdit.pull_request.body = `${CAPTURE_OPT_IN}\n${captureMarker(head)}`;
    expect(selectCaptureRequest(titleEdit, repository)).toBeNull();
    const missing = event('edited', { changes: { body: { from: '' } } });
    missing.pull_request.body = null;
    expect(selectCaptureRequest(missing, repository)).toBeNull();
    expect(selectCaptureRequest(event('edited', { changes: { body: { from: captureMarker(head) } } }), repository)).toBeNull();
  });

  it('requires an exact marker and does not execute surrounding PR prose', () => {
    const request = event('edited', { changes: { body: { from: '' } } });
    request.pull_request.body = `${CAPTURE_OPT_IN}\n$(false)\n${captureMarker(head).replace(' -->', '-->')}`;
    expect(selectCaptureRequest(request, repository)).toBeNull();
    request.pull_request.body = `${CAPTURE_OPT_IN}\n$(false)\n${captureMarker(head)}`;
    expect(selectCaptureRequest(request, repository)?.mode).toBe('candidates');
  });

  it.each(['closed', 'labeled', 'ready_for_review'])('ignores unsupported %s events', (action) => {
    expect(selectCaptureRequest(event(action), repository)).toBeNull();
  });

  it('rejects forked or mismatched repositories', () => {
    const fork = event('opened');
    fork.pull_request.head.repo.full_name = 'another/site';
    expect(selectCaptureRequest(fork, repository)).toBeNull();
    expect(selectCaptureRequest(event('opened'), 'another/site')).toBeNull();
    expect(selectCaptureRequest(event('opened'), '')).toBeNull();
  });

  it('requires explicit opt-in, including when a candidate marker is present', () => {
    const unrequested = event('opened');
    unrequested.pull_request.body = 'An ordinary publication PR.';
    expect(selectCaptureRequest(unrequested, repository)).toBeNull();
    const candidates = event('edited', { changes: { body: { from: '' } } });
    candidates.pull_request.body = captureMarker(head);
    expect(selectCaptureRequest(candidates, repository)).toBeNull();
    unrequested.pull_request.body = CAPTURE_OPT_IN.replace(' -->', '-->');
    expect(selectCaptureRequest(unrequested, repository)).toBeNull();
  });

  it.each(['abc123', 'A'.repeat(40), 'a'.repeat(40) + '\n'])('rejects malformed head SHA %j', (sha) => {
    const invalid = event('opened');
    invalid.pull_request.head.sha = sha;
    expect(() => selectCaptureRequest(invalid, repository)).toThrow('full PR head and base');
    expect(() => captureMarker(sha)).toThrow('full lowercase');
  });

  it('also requires the exact base SHA', () => {
    const invalid = event('opened');
    invalid.pull_request.base.sha = 'main';
    expect(() => selectCaptureRequest(invalid, repository)).toThrow('full PR head and base');
  });

  it('pins Node 22 and Chromium 149.0.7827.55', () => {
    expect(() => assertCaptureRuntime({ nodeVersion: 'v22.20.0', browserVersion: PINNED_BROWSER_VERSION })).not.toThrow();
    expect(() => assertCaptureRuntime({ nodeVersion: 'v24.0.0', browserVersion: PINNED_BROWSER_VERSION })).toThrow('Node 22');
    expect(() => assertCaptureRuntime({ nodeVersion: 'v22.20.0', browserVersion: '149.0.7827.56' })).toThrow('149.0.7827.55');
  });

  it('records failures and missing steps without serializing arbitrary outputs', () => {
    const outcomes = sanitizedStepOutcomes({
      build: { outcome: 'success', outputs: { credentials: 'must-not-be-copied' } },
      visual: { outcome: 'failure', conclusion: 'success' },
      lighthouse: { outcome: 'skipped' },
      unrelated: { outcome: 'success' },
    });
    expect(outcomes.build).toBe('success');
    expect(outcomes.visual).toBe('failure');
    expect(outcomes.lighthouse).toBe('skipped');
    expect(outcomes.acceptance).toBe('unrecorded');
    expect(JSON.stringify(outcomes)).not.toContain('must-not-be-copied');
    expect(outcomes).not.toHaveProperty('unrelated');
  });
});
