import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const endpointDiagnostic = /^npm (?:error|ERR!) audit endpoint returned an error$/u;
const transientMessages = new Set([
  'Request Timeout', 'Too Many Requests', 'Internal Server Error',
  'Bad Gateway', 'Service Unavailable', 'Gateway Timeout',
]);
const endpointWarning = /^npm (?:warn|WARN) audit (?:408 Request Timeout|429 Too Many Requests|500 Internal Server Error|502 Bad Gateway|503 Service Unavailable|504 Gateway Timeout) - POST https:\/\/registry\.npmjs\.org\/-\/npm\/v1\/security\/(?:advisories\/bulk|audits\/quick)(?: - (?:Request Timeout|Too Many Requests|Internal Server Error|Bad Gateway|Service Unavailable|Gateway Timeout))?$/u;
const logLocation = /^npm (?:error|ERR!) A complete log of this run can be found in: .+$/u;
const retryDelays = [2_000, 5_000];

function transientBody(body) {
  // npm's ordinary (non-JSON) audit output prints the registry error object
  // with util.inspect. Accept only this small, known error response shape;
  // an advisory report or unfamiliar/malformed response must fail closed.
  const inspected = body.match(/^\{\s*error:\s*(['"])([^'"\r\n]+)\1\s*\}$/u);
  if (inspected) return transientMessages.has(inspected[2]);
  try {
    const parsed = JSON.parse(body);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      && Object.keys(parsed).length === 1 && transientMessages.has(parsed.error);
  } catch {
    return false;
  }
}

/** Only a recognized, findings-free registry outage is eligible for a retry. */
export function isRetryableEndpointError({ status, signal, error, stdout = '', stderr = '' }) {
  if (!Number.isInteger(status) || status <= 0 || signal || error) return false;
  const lines = stderr.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  if (!lines.some((line) => endpointDiagnostic.test(line))) return false;
  if (!lines.every((line) => endpointDiagnostic.test(line)
    || endpointWarning.test(line) || logLocation.test(line))) return false;
  const body = stdout.trim();
  return body ? transientBody(body) : lines.some((line) => endpointWarning.test(line));
}

export function executeAudit(args) {
  return spawnSync('npm', ['audit', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
  });
}

/**
 * One narrow, temporary exception, approved by the site owner on 2026-11-18.
 * GHSA-fc5q-39xc-vjpf (picomatch ReDoS on repeated extglobs) covers every
 * picomatch release through 4.0.7, the newest, so no upgrade can clear it.
 * Astro, Vite and their glob helpers need picomatch; the site only feeds it
 * patterns written in its own build setup, never visitor input.
 *
 * The exception lapses by itself, and the gate fails again, as soon as any
 * of these is true:
 *   - picomatch publishes a release newer than 4.0.7 (a fix to upgrade to);
 *   - the advisory's affected range is no longer exactly "<=4.0.7";
 *   - the UTC date is after PICOMATCH_EXCEPTION.expires (the last allowed day);
 *   - the audit reports any other advisory at the policy's severity.
 */
export const PICOMATCH_EXCEPTION = Object.freeze({
  name: 'picomatch',
  url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf',
  range: '<=4.0.7',
  newestUnfixedRelease: '4.0.7',
  expires: '2027-02-18',
});

const severityRank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const policyThreshold = { '--omit=dev': 'low', '--audit-level=high': 'high' };

export function executeAuditJson(args) {
  return spawnSync('npm', ['audit', ...args, '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    maxBuffer: 32 * 1024 * 1024,
  });
}

export function readLatestPicomatch() {
  const result = spawnSync('npm', ['view', 'picomatch', 'version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
  });
  if (result.error || result.signal || result.status !== 0) return null;
  return result.stdout.trim();
}

/**
 * Returns a reason string when the exception does NOT apply (the gate must
 * stay failed), or null when the only findings at the policy's severity are
 * the one excepted picomatch advisory and every lapse condition still holds.
 */
export function picomatchExceptionBlocker(policy, report, { latest, today }) {
  const exception = PICOMATCH_EXCEPTION;
  if (!(policy in policyThreshold)) return 'unsupported policy';
  if (typeof today !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(today)) return 'no valid date';
  if (today > exception.expires) return `the exception expired on ${exception.expires}`;
  if (latest !== exception.newestUnfixedRelease) {
    return latest
      ? `picomatch ${latest} is out; upgrade instead of using the exception`
      : 'could not confirm the newest picomatch release';
  }
  const vulnerabilities = report && typeof report === 'object' && !Array.isArray(report)
    ? report.vulnerabilities : undefined;
  if (report && typeof report === 'object' && Object.hasOwn(report, 'error')) {
    return 'the audit report contains an error';
  }
  if (!vulnerabilities || typeof vulnerabilities !== 'object' || Array.isArray(vulnerabilities)) {
    return 'unreadable audit report';
  }
  const threshold = severityRank[policyThreshold[policy]];
  let sawException = false;
  for (const [name, entry] of Object.entries(vulnerabilities)) {
    if (!entry || !Array.isArray(entry.via) || entry.via.length === 0) return `unreadable entry for ${name}`;
    if (!Object.hasOwn(severityRank, entry.severity)) return `unknown severity for ${name}`;
    for (const via of entry.via) {
      if (typeof via === 'string') {
        if (!Object.hasOwn(vulnerabilities, via)) return `${name} points to ${via}, which the report does not list`;
        continue;
      }
      if (!via || typeof via !== 'object') return `unreadable advisory under ${name}`;
      if (!Object.hasOwn(severityRank, via.severity)) return `unknown severity under ${name}`;
      const rank = severityRank[via.severity];
      if (rank < threshold) continue;
      if (via.url !== exception.url || via.name !== exception.name || name !== exception.name) {
        return `another advisory: ${via.url ?? via.title ?? name}`;
      }
      if (via.range !== exception.range) {
        return `the picomatch advisory range changed to ${via.range}`;
      }
      sawException = true;
    }
  }
  return sawException ? null : 'the excepted advisory was not the failure';
}

export async function auditWithRetry(args, {
  execute = executeAudit,
  executeJson = executeAuditJson,
  latestPicomatch = readLatestPicomatch,
  today = () => new Date().toISOString().slice(0, 10),
  wait = setTimeout,
  stdout = (message) => process.stdout.write(message),
  stderr = (message) => process.stderr.write(message),
} = {}) {
  // Keep Site Check's two severity policies explicit. This wrapper cannot be
  // repurposed with audit fix, a relaxed severity, or an alternate registry.
  if (args.length !== 1 || !['--omit=dev', '--audit-level=high'].includes(args[0])) {
    throw new Error('Expected exactly --omit=dev or --audit-level=high');
  }

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    const result = execute(args);
    if (result.stdout) stdout(result.stdout);
    if (result.stderr) stderr(result.stderr);
    if (result.error) stderr(`npm audit could not complete: ${result.error.message}\n`);
    if (result.signal) stderr(`npm audit terminated by ${result.signal}\n`);

    const hasEndpointDiagnostic = (result.stderr ?? '').split(/\r?\n/u)
      .some((line) => endpointDiagnostic.test(line.trim()));
    if (result.status === 0 && !result.error && !result.signal && !hasEndpointDiagnostic) return 0;
    const failureStatus = Number.isInteger(result.status) && result.status > 0 ? result.status : 1;
    if (!isRetryableEndpointError(result)) {
      return applyPicomatchException(args[0], failureStatus, { executeJson, latestPicomatch, today, stderr });
    }
    if (attempt === retryDelays.length) {
      stderr('npm audit endpoint retries exhausted after 3 attempts; failing the gate.\n');
      return failureStatus;
    }
    const delay = retryDelays[attempt];
    stderr(`npm audit endpoint unavailable; retrying attempt ${attempt + 2}/3 in ${delay / 1000}s.\n`);
    await wait(delay);
  }
  return 1;
}

function applyPicomatchException(policy, failureStatus, { executeJson, latestPicomatch, today, stderr }) {
  let report;
  try {
    const result = executeJson([policy]);
    // Only npm's ordinary findings exit is eligible. A mixed error/report,
    // contradictory success, or diagnostic on stderr cannot prove that the
    // audit completed; never turn those outcomes into an exception pass.
    if (result.status !== 1 || result.error || result.signal || !result.stdout
      || (result.stderr ?? '').trim()) {
      stderr('picomatch exception not applied: the JSON audit did not complete.\n');
      return failureStatus;
    }
    report = JSON.parse(result.stdout);
  } catch {
    stderr('picomatch exception not applied: the JSON audit could not be read.\n');
    return failureStatus;
  }
  const blocker = picomatchExceptionBlocker(policy, report, { latest: latestPicomatch(), today: today() });
  if (blocker) {
    stderr(`picomatch exception not applied: ${blocker}. Failing the gate.\n`);
    return failureStatus;
  }
  stderr(`Only ${PICOMATCH_EXCEPTION.url} (picomatch ${PICOMATCH_EXCEPTION.range}, no fixed release yet) failed; `
    + `passing under the temporary exception that ends when a fix ships or after ${PICOMATCH_EXCEPTION.expires} (UTC).\n`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await auditWithRetry(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
