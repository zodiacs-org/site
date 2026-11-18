import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import {
  ResendRequestWithdrawnError,
  createRateLimitedResendRequest,
  type ResendRequest,
  type ResendRequestControl,
} from '../daily-email/resend-request.js';

const RESEND_EMAILS_ENDPOINT = 'https://api.resend.com/emails';
const ENVELOPE_SCHEMA = 'weekly-digest-request-v1';
const SEALED_ENVELOPE_VERSION = 'wde1';
const ENVELOPE_KDF_SALT = Buffer.from('zodiacs.org/weekly-digest/envelope/salt/v1', 'utf8');
const ENVELOPE_KDF_INFO = Buffer.from('zodiacs.org/weekly-digest/envelope/aes-256-gcm/v1', 'utf8');
const ENVELOPE_AAD_DOMAIN = 'zodiacs.org/weekly-digest/envelope/aad/v1';
const ENVELOPE_IV_BYTES = 12;
const ENVELOPE_TAG_BYTES = 16;
const MAX_SECRET_BYTES = 4_096;
const MAX_FROM_BYTES = 512;
const MAX_TO_BYTES = 320;
const MAX_SUBJECT_BYTES = 998;
const MAX_UNSUBSCRIBE_BYTES = 2_048;
const MAX_BODY_BYTES = 128 * 1_024;
const MAX_ENVELOPE_PAYLOAD_BYTES = MAX_BODY_BYTES + 1_024;
const MAX_SEALED_ENVELOPE_CHARS = Math.ceil(MAX_ENVELOPE_PAYLOAD_BYTES * 4 / 3) + 128;
const MAX_PROVIDER_RESPONSE_BYTES = 4_096;
const SAFE_PROVIDER_CODE = /^[a-z][a-z0-9_]{0,63}$/u;
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/u;

/**
 * Resend does not currently document a recipient-only synchronous error code.
 * These exact names are deliberately narrow so a future explicit response can
 * be finalized without treating generic validation/configuration failures as a
 * recipient rejection.
 */
const PERMANENT_RECIPIENT_CODES = new Set([
  'invalid_recipient',
  'invalid_recipient_address',
  'recipient_suppressed',
]);

export const WEEKLY_DIGEST_PROVIDER_TIMEOUT_MS = 30_000;

export interface WeeklyDigestDeliveryContext {
  weekStart: string;
  userId: string;
}

export interface WeeklyDigestEmail extends WeeklyDigestDeliveryContext {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  unsubscribe: string;
}

export interface WeeklyDigestRequestEnvelope {
  readonly schema: typeof ENVELOPE_SCHEMA;
  readonly endpoint: typeof RESEND_EMAILS_ENDPOINT;
  readonly method: 'POST';
  readonly contentType: 'application/json';
  readonly idempotencyKey: string;
  readonly body: string;
}

export type WeeklyDigestProviderResult =
  | { kind: 'sent'; receipt: string }
  | { kind: 'rejected'; status: number; code: string };

export type WeeklyDigestProviderAbortReason =
  | 'transport'
  | 'provider-response'
  | 'invalid-success';

/**
 * A deliberately sanitized error. It carries only bounded provider metadata,
 * never the response message, request body, recipient, API key, or secret.
 */
export class WeeklyDigestProviderAbortError extends Error {
  readonly reason: WeeklyDigestProviderAbortReason;
  readonly status: number | null;
  readonly code: string | null;
  /**
   * The provider explicitly rejected the request, so nothing was accepted
   * under it: a 4xx other than 408 and 409, an exhausted run of 429s
   * included (the queue retries only 429s, so every earlier attempt was one).
   * Everything else (transport failures, 5xx, 408, 409, a malformed success)
   * is ambiguous: the request may have been accepted.
   */
  readonly definitive: boolean;

  constructor(
    reason: WeeklyDigestProviderAbortReason,
    status: number | null = null,
    code: string | null = null,
  ) {
    super('Weekly digest provider outcome requires safe replay or reconciliation.');
    this.name = 'WeeklyDigestProviderAbortError';
    this.reason = reason;
    this.status = status;
    this.code = code;
    this.definitive = reason === 'provider-response'
      && Number.isInteger(status)
      && status! >= 400
      && status! <= 499
      && status !== 408
      && status !== 409;
  }
}

export interface WeeklyDigestResendRequestOptions {
  timeoutMs?: number;
  absoluteDeadlineMs?: number;
  minIntervalMs?: number;
  maxRetries?: number;
  maxRetryAfterMs?: number;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  timeoutSignal?: (milliseconds: number) => AbortSignal;
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function validWeekStart(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const instant = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(instant.getTime())
    && instant.toISOString().slice(0, 10) === value
    && instant.getUTCDay() === 1;
}

function validUserId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function validBoundedHeader(value: string, maximum: number): boolean {
  return typeof value === 'string'
    && value.length > 0
    && utf8Bytes(value) <= maximum
    && !CONTROL_CHARACTER.test(value);
}

function validUnsubscribe(value: string): boolean {
  if (!validBoundedHeader(value, MAX_UNSUBSCRIBE_BYTES)) return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:')
      && !parsed.username
      && !parsed.password;
  } catch {
    return false;
  }
}

function validContext(context: WeeklyDigestDeliveryContext): boolean {
  return Boolean(context)
    && typeof context.weekStart === 'string'
    && typeof context.userId === 'string'
    && validWeekStart(context.weekStart)
    && validUserId(context.userId);
}

/**
 * A recipient-stable, non-identifying key. Resend keeps idempotency records for
 * 24 hours; the database receipt remains the durable cross-run authority.
 */
export function weeklyDigestIdempotencyKey(weekStart: string, userId: string): string {
  if (!validWeekStart(weekStart) || !validUserId(userId)) {
    throw new Error('Invalid weekly delivery identity.');
  }
  const digest = createHash('sha256')
    .update('weekly-digest-v1\0')
    .update(weekStart)
    .update('\0')
    .update(userId.toLowerCase())
    .digest('hex');
  return `weekly-digest-v1/${digest}`;
}

/** A deterministic weekly rotation that does not expose an account identifier. */
export function weeklyDigestOrderKey(weekStart: string, userId: string): string {
  if (!validWeekStart(weekStart) || !validUserId(userId)) {
    throw new Error('Invalid weekly delivery identity.');
  }
  return createHash('sha256')
    .update('weekly-digest-order-v1\0')
    .update(weekStart)
    .update('\0')
    .update(userId.toLowerCase())
    .digest('hex');
}

function freezeEnvelope(envelope: WeeklyDigestRequestEnvelope): WeeklyDigestRequestEnvelope {
  return Object.freeze(envelope);
}

/** Builds the one canonical body and request envelope used for every replay. */
export function buildWeeklyDigestRequestEnvelope(
  email: Omit<WeeklyDigestEmail, 'apiKey'> | WeeklyDigestEmail,
): WeeklyDigestRequestEnvelope {
  if (!validContext(email)
    || !validBoundedHeader(email.from, MAX_FROM_BYTES)
    || !validBoundedHeader(email.to, MAX_TO_BYTES)
    || !validBoundedHeader(email.subject, MAX_SUBJECT_BYTES)
    || typeof email.text !== 'string'
    || typeof email.html !== 'string'
    || !validUnsubscribe(email.unsubscribe)) {
    throw new Error('Invalid weekly digest request envelope input.');
  }

  const body = JSON.stringify({
    from: email.from,
    to: [email.to],
    subject: email.subject,
    text: email.text,
    html: email.html,
    headers: {
      'List-Unsubscribe': `<${email.unsubscribe}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });
  if (utf8Bytes(body) > MAX_BODY_BYTES) {
    throw new Error('Weekly digest request envelope exceeds its size limit.');
  }

  return freezeEnvelope({
    schema: ENVELOPE_SCHEMA,
    endpoint: RESEND_EMAILS_ENDPOINT,
    method: 'POST',
    contentType: 'application/json',
    idempotencyKey: weeklyDigestIdempotencyKey(email.weekStart, email.userId),
    body,
  });
}

function validatedEnvelope(value: unknown): WeeklyDigestRequestEnvelope | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<Record<keyof WeeklyDigestRequestEnvelope, unknown>>;
  const keys = Object.keys(value).sort();
  const expectedKeys = [
    'body',
    'contentType',
    'endpoint',
    'idempotencyKey',
    'method',
    'schema',
  ];
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    return null;
  }
  if (candidate.schema !== ENVELOPE_SCHEMA
    || candidate.endpoint !== RESEND_EMAILS_ENDPOINT
    || candidate.method !== 'POST'
    || candidate.contentType !== 'application/json'
    || typeof candidate.idempotencyKey !== 'string'
    || !/^weekly-digest-v1\/[0-9a-f]{64}$/u.test(candidate.idempotencyKey)
    || typeof candidate.body !== 'string'
    || utf8Bytes(candidate.body) > MAX_BODY_BYTES) {
    return null;
  }
  try {
    const parsedBody = JSON.parse(candidate.body) as unknown;
    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) return null;
  } catch {
    return null;
  }
  return freezeEnvelope({
    schema: candidate.schema,
    endpoint: candidate.endpoint,
    method: candidate.method,
    contentType: candidate.contentType,
    idempotencyKey: candidate.idempotencyKey,
    body: candidate.body,
  });
}

/** SHA-256 of the canonical immutable envelope persisted beside its ciphertext. */
export function weeklyDigestEnvelopeDigest(envelope: WeeklyDigestRequestEnvelope): string {
  const normalized = validatedEnvelope(envelope);
  if (!normalized) throw new Error('Invalid weekly digest request envelope.');
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function validSecret(secret: string): boolean {
  if (typeof secret !== 'string') return false;
  const length = utf8Bytes(secret);
  return secret.length >= 32 && length >= 32 && length <= MAX_SECRET_BYTES;
}

function envelopeEncryptionKey(secret: string): Buffer {
  if (!validSecret(secret)) throw new Error('Invalid weekly digest envelope secret.');
  const inputKeyMaterial = Buffer.from(secret, 'utf8');
  try {
    return Buffer.from(hkdfSync(
      'sha256',
      inputKeyMaterial,
      ENVELOPE_KDF_SALT,
      ENVELOPE_KDF_INFO,
      32,
    ));
  } finally {
    inputKeyMaterial.fill(0);
  }
}

function envelopeAad(
  context: WeeklyDigestDeliveryContext,
  idempotencyKey: string,
): Buffer {
  if (!validContext(context)
    || weeklyDigestIdempotencyKey(context.weekStart, context.userId) !== idempotencyKey) {
    throw new Error('Invalid weekly digest envelope context.');
  }
  return Buffer.from([
    ENVELOPE_AAD_DOMAIN,
    context.weekStart,
    context.userId.toLowerCase(),
    idempotencyKey,
  ].join('\0'), 'utf8');
}

function decodeBase64Url(value: string, maximumBytes: number): Buffer | null {
  if (!value || !/^[A-Za-z0-9_-]+$/u.test(value) || value.length % 4 === 1) return null;
  try {
    const decoded = Buffer.from(value, 'base64url');
    if (decoded.length > maximumBytes || decoded.toString('base64url') !== value) return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Encrypts the exact immutable envelope for durable storage. The context and
 * deterministic request key are authenticated as AAD and are not serialized in
 * plaintext alongside the ciphertext.
 */
export function sealWeeklyDigestRequestEnvelope(
  envelope: WeeklyDigestRequestEnvelope,
  context: WeeklyDigestDeliveryContext,
  secret: string,
): string {
  const normalized = validatedEnvelope(envelope);
  if (!normalized) throw new Error('Invalid weekly digest request envelope.');
  const aad = envelopeAad(context, normalized.idempotencyKey);
  const payload = Buffer.from(JSON.stringify(normalized), 'utf8');
  if (payload.length > MAX_ENVELOPE_PAYLOAD_BYTES) {
    payload.fill(0);
    throw new Error('Weekly digest request envelope exceeds its size limit.');
  }

  const key = envelopeEncryptionKey(secret);
  try {
    const iv = randomBytes(ENVELOPE_IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: ENVELOPE_TAG_BYTES });
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      SEALED_ENVELOPE_VERSION,
      iv.toString('base64url'),
      ciphertext.toString('base64url'),
      tag.toString('base64url'),
    ].join('.');
  } finally {
    key.fill(0);
    payload.fill(0);
  }
}

/** Returns null for every malformed, oversized, tampered, or context-mismatched value. */
export function openWeeklyDigestRequestEnvelope(
  sealed: string,
  context: WeeklyDigestDeliveryContext,
  secret: string,
): WeeklyDigestRequestEnvelope | null {
  if (typeof sealed !== 'string'
    || sealed.length === 0
    || sealed.length > MAX_SEALED_ENVELOPE_CHARS
    || !validContext(context)
    || !validSecret(secret)) return null;

  const [version, encodedIv, encodedCiphertext, encodedTag, extra] = sealed.split('.');
  if (version !== SEALED_ENVELOPE_VERSION
    || !encodedIv
    || !encodedCiphertext
    || !encodedTag
    || extra) return null;
  const iv = decodeBase64Url(encodedIv, ENVELOPE_IV_BYTES);
  const ciphertext = decodeBase64Url(encodedCiphertext, MAX_ENVELOPE_PAYLOAD_BYTES);
  const tag = decodeBase64Url(encodedTag, ENVELOPE_TAG_BYTES);
  if (!iv || iv.length !== ENVELOPE_IV_BYTES
    || !ciphertext
    || !tag || tag.length !== ENVELOPE_TAG_BYTES) return null;

  const idempotencyKey = weeklyDigestIdempotencyKey(context.weekStart, context.userId);
  let key: Buffer | null = null;
  let plaintext: Buffer | null = null;
  try {
    key = envelopeEncryptionKey(secret);
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: ENVELOPE_TAG_BYTES });
    decipher.setAAD(envelopeAad(context, idempotencyKey));
    decipher.setAuthTag(tag);
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    if (plaintext.length > MAX_ENVELOPE_PAYLOAD_BYTES) return null;
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
    const envelope = validatedEnvelope(JSON.parse(decoded) as unknown);
    return envelope?.idempotencyKey === idempotencyKey ? envelope : null;
  } catch {
    return null;
  } finally {
    key?.fill(0);
    plaintext?.fill(0);
  }
}

function providerReceipt(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const receipt = (value as { id?: unknown }).id;
  if (typeof receipt !== 'string') return null;
  const normalized = receipt.trim();
  if (!normalized || normalized.length > 256 || CONTROL_CHARACTER.test(normalized)) return null;
  return normalized;
}

async function boundedJson(response: Response): Promise<Record<string, unknown> | null> {
  if (!response.body) return null;
  const declaredLength = response.headers.get('content-length');
  if (declaredLength && /^\d+$/u.test(declaredLength)
    && Number(declaredLength) > MAX_PROVIDER_RESPONSE_BYTES) {
    try { await response.body.cancel(); } catch { /* best-effort */ }
    return null;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_PROVIDER_RESPONSE_BYTES) {
        try { await reader.cancel(); } catch { /* best-effort */ }
        return null;
      }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const parsed = JSON.parse(decoded) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

interface ProviderFailureMetadata {
  status: number;
  code: string | null;
}

async function providerFailureMetadata(response: Response): Promise<ProviderFailureMetadata> {
  const parsed = await boundedJson(response);
  const reportedStatus = parsed?.statusCode ?? parsed?.status;
  const statusMatches = reportedStatus === undefined
    || (typeof reportedStatus === 'number'
      && Number.isInteger(reportedStatus)
      && reportedStatus === response.status);
  const candidate = parsed?.name ?? parsed?.code;
  const code = statusMatches && typeof candidate === 'string' && SAFE_PROVIDER_CODE.test(candidate)
    ? candidate
    : null;
  return { status: response.status, code };
}

function isPermanentRecipientFailure(failure: ProviderFailureMetadata): failure is {
  status: number;
  code: string;
} {
  return (failure.status === 400 || failure.status === 422)
    && failure.code !== null
    && PERMANENT_RECIPIENT_CODES.has(failure.code);
}

/**
 * Creates the serialized Resend queue used by weekly delivery. The daily queue
 * owns pacing and bounded 429 retries; this wrapper replaces its signal for
 * every underlying fetch attempt so a previous attempt cannot consume the next
 * attempt's 30-second budget.
 */
export function createWeeklyDigestResendRequest(
  fetchImpl: typeof fetch,
  options: WeeklyDigestResendRequestOptions = {},
): ResendRequest {
  const timeoutMs = options.timeoutMs ?? WEEKLY_DIGEST_PROVIDER_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000) {
    throw new Error('Invalid weekly digest provider timeout.');
  }
  const now = options.now ?? Date.now;
  const absoluteDeadlineMs = options.absoluteDeadlineMs;
  if (absoluteDeadlineMs !== undefined
    && (!Number.isFinite(absoluteDeadlineMs) || absoluteDeadlineMs <= now())) {
    throw new Error('Invalid weekly digest provider deadline.');
  }
  const timeoutSignal = options.timeoutSignal ?? AbortSignal.timeout;
  const timedFetch: typeof fetch = (input, init) => {
    const remainingMs = absoluteDeadlineMs === undefined
      ? timeoutMs
      : Math.floor(absoluteDeadlineMs - now());
    if (remainingMs <= 0) {
      throw new Error('Weekly digest provider deadline elapsed.');
    }
    return fetchImpl(input, {
      ...init,
      signal: timeoutSignal(Math.min(timeoutMs, remainingMs)),
    });
  };
  const sleepImpl = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  }));
  const boundedSleep = absoluteDeadlineMs === undefined
    ? options.sleep
    : async (milliseconds: number): Promise<void> => {
      const remainingMs = absoluteDeadlineMs - now();
      if (remainingMs <= 0 || milliseconds >= remainingMs) {
        throw new Error('Weekly digest provider deadline would be exceeded.');
      }
      await sleepImpl(milliseconds);
      if (now() >= absoluteDeadlineMs) {
        throw new Error('Weekly digest provider deadline elapsed.');
      }
    };
  return createRateLimitedResendRequest(timedFetch, {
    minIntervalMs: options.minIntervalMs,
    maxRetries: options.maxRetries,
    maxRetryAfterMs: options.maxRetryAfterMs,
    now,
    sleep: boundedSleep,
  });
}

/**
 * Sends a previously built or opened envelope without reconstructing its body.
 * `control.beforeAttempt` runs immediately before every provider attempt; when
 * it declines, this rejects with ResendRequestWithdrawnError and nothing more
 * is sent.
 */
export async function sendWeeklyDigestEnvelope(
  envelope: WeeklyDigestRequestEnvelope,
  apiKey: string,
  request: ResendRequest = createWeeklyDigestResendRequest(fetch),
  control?: ResendRequestControl,
): Promise<WeeklyDigestProviderResult> {
  const normalized = validatedEnvelope(envelope);
  if (!normalized || !validBoundedHeader(apiKey, 1_024)) {
    throw new Error('Invalid weekly digest provider request.');
  }

  let response: Response;
  try {
    response = await request(normalized.endpoint, {
      method: normalized.method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': normalized.contentType,
        'Idempotency-Key': normalized.idempotencyKey,
      },
      body: normalized.body,
      // The weekly request factory replaces this with a fresh signal for every
      // hidden 429 attempt. It remains a bounded fallback for custom requests.
      signal: AbortSignal.timeout(WEEKLY_DIGEST_PROVIDER_TIMEOUT_MS),
    }, control);
  } catch (error) {
    if (error instanceof ResendRequestWithdrawnError) throw error;
    throw new WeeklyDigestProviderAbortError('transport');
  }

  if (!response.ok) {
    const failure = await providerFailureMetadata(response);
    if (isPermanentRecipientFailure(failure)) {
      return { kind: 'rejected', status: failure.status, code: failure.code };
    }
    throw new WeeklyDigestProviderAbortError(
      'provider-response',
      failure.status,
      failure.code,
    );
  }

  const parsed = await boundedJson(response);
  const receipt = providerReceipt(parsed);
  if (!receipt) {
    throw new WeeklyDigestProviderAbortError('invalid-success', response.status);
  }
  return { kind: 'sent', receipt };
}

/** Convenience path for a newly rendered email; recovery should open and send its saved envelope. */
export async function sendWeeklyDigestEmail(
  email: WeeklyDigestEmail,
  request: ResendRequest = createWeeklyDigestResendRequest(fetch),
): Promise<WeeklyDigestProviderResult> {
  return sendWeeklyDigestEnvelope(
    buildWeeklyDigestRequestEnvelope(email),
    email.apiKey,
    request,
  );
}
