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

export async function auditWithRetry(args, {
  execute = executeAudit,
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
      return failureStatus;
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

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await auditWithRetry(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
