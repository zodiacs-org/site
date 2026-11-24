/**
 * POST /api/good-days/outcome (rewritten to api/compatibility.ts, so no new
 * function is deployed): stores one anonymous "How did your day go?" answer.
 *
 * - Off unless ZODIACS_GOOD_DAYS_OUTCOMES_ENABLED is exactly '1': it answers
 *   404 and reads nothing.
 * - Only from zodiacs.org or the Vercel preview serving the request.
 * - Counted by the Firewall rule OUTCOMES_RATE_LIMIT_ID per address; while the
 *   rule is not published, or the Firewall cannot count, it refuses.
 * - The body is at most 2 KB of JSON with exactly the fields outcomeRecord
 *   takes; the note is scrubbed there.
 * - It stores through one Supabase function with the service role, which
 *   keeps the record and the database's own UTC date, never an IP, a user
 *   agent, a time of day or an identifier. Nothing is logged: the handler has
 *   no console call, and a refusal never repeats what was sent.
 */
import { checkRateLimit } from '@vercel/firewall';
import { serviceRpc } from '../../ai-tools/quota.js';
import { isAllowedGamesRequest } from '../games/server.js';
import { OUTCOMES_SERVER_SWITCH, outcomeRecord, type OutcomeRecord } from './outcomes.js';

export const OUTCOMES_RATE_LIMIT_ID = 'zodiacs-good-days-outcomes';
/** The rule the owner publishes with the switch: answers per address in each 60-second window. */
export const OUTCOMES_RATE_LIMIT = Object.freeze({ requests: 6, windowSeconds: 60 });
export const OUTCOMES_RPC = 'good_days_outcome_record_v1';
const MAX_BYTES = 2048;
const LATEST_CLOCK_MS = 14 * 3_600_000;

type Verdict = 'allowed' | 'limited' | 'unavailable';
export interface OutcomeApiDeps {
  env: Readonly<Record<string, string | undefined>>;
  fetcher?: typeof fetch;
  rateLimit?: (req: any) => Promise<Verdict>;
  now?: () => Date;
}

async function firewall(req: any): Promise<Verdict> {
  if (process.env.NODE_ENV !== 'production') return 'unavailable';
  try {
    const result = await checkRateLimit(OUTCOMES_RATE_LIMIT_ID, { headers: req.headers });
    if (result?.rateLimited === true) return 'limited';
    if (result?.rateLimited === false && result.error === undefined) return 'allowed';
    return 'unavailable';
  } catch { return 'unavailable'; }
}

function send(res: any, status: number, body: Record<string, unknown> | null) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (body === null) { res.end(); return; }
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readJson(req: any): Promise<unknown> {
  if (req.body !== undefined && req.body !== null) {
    const text = typeof req.body === 'string' ? req.body : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
    if (Buffer.byteLength(text) > MAX_BYTES) throw new Error('too-large');
    return typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : JSON.parse(text);
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BYTES) throw new Error('too-large');
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** The arguments the database function takes, and nothing else. */
export function rpcArguments(record: OutcomeRecord, scope: string) {
  return {
    outcome_scope: scope, outcome_goal: record.goal, outcome_day: record.day, outcome_finder_score: record.finderScore,
    outcome_personal: record.personal, outcome_rating: record.rating, outcome_note: record.note, outcome_rules_version: record.rulesVersion,
  };
}

export async function handleOutcomeRequest(req: any, res: any, deps: OutcomeApiDeps): Promise<void> {
  if (deps.env[OUTCOMES_SERVER_SWITCH] !== '1') return send(res, 404, { error: 'not_found' });
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { error: 'method_not_allowed' }); }
  if (!isAllowedGamesRequest(req, { NODE_ENV: deps.env.NODE_ENV ?? process.env.NODE_ENV })) return send(res, 403, { error: 'forbidden' });
  const type = String(req.headers?.['content-type'] ?? '');
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/iu.test(type)) return send(res, 415, { error: 'unsupported_media_type' });
  const verdict = await (deps.rateLimit ?? firewall)(req);
  if (verdict !== 'allowed') return send(res, verdict === 'limited' ? 429 : 503, { error: verdict === 'limited' ? 'rate_limited' : 'unavailable', message: 'Zodiacs is busy. Try again in a minute.' });
  let body: unknown;
  try { body = await readJson(req); } catch (error) {
    return error instanceof Error && error.message === 'too-large' ? send(res, 413, { error: 'too_large' }) : send(res, 400, { error: 'invalid_json' });
  }
  const now = deps.now?.() ?? new Date();
  const today = new Date(now.getTime() + LATEST_CLOCK_MS).toISOString().slice(0, 10);
  const checked = outcomeRecord(body, today);
  if ('refusal' in checked) return send(res, 400, { error: 'invalid_outcome', message: checked.refusal });
  const rpc = serviceRpc(deps.env);
  if (!rpc) return send(res, 503, { error: 'unavailable', message: 'Zodiacs could not keep this right now. Try again later.' });
  try {
    const response = await (deps.fetcher ?? fetch)(`${rpc.url}/rest/v1/rpc/${OUTCOMES_RPC}`, {
      method: 'POST', headers: rpc.headers, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(3000),
      body: JSON.stringify(rpcArguments(checked.record, rpc.scope)),
    });
    await response.body?.cancel().catch(() => {});
    if (!response.ok) return send(res, 503, { error: 'unavailable', message: 'Zodiacs could not keep this right now. Try again later.' });
  } catch {
    return send(res, 503, { error: 'unavailable', message: 'Zodiacs could not keep this right now. Try again later.' });
  }
  return send(res, 201, { ok: true, noteKept: checked.record.note !== null });
}
