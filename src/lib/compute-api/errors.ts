/**
 * Typed refusals. Every message is a fixed sentence written here: no error
 * the API returns carries a value from the request, from its result, or from
 * an exception's own message, because a thrown message can quote its input
 * (V8's JSON.parse errors quote the text they failed on). A pointer names a
 * field by the schema's own names and array positions, never by a key the
 * request invented.
 */
import {
  BUDGETS,
  BUDGET_MESSAGES,
  ERROR_STATUS,
  MAX_BODY_BYTES,
  RETRY_AFTER_SECONDS,
  type BudgetName,
  type ErrorCode,
} from './constants.js';

export interface ErrorDetail {
  code: ErrorCode;
  message: string;
  /** JSON Pointer to the refused field, for invalid-request. */
  pointer?: string;
  /** The limit a budget-exhausted or payload-too-large error names. */
  limit?: string;
  max?: number;
  retryAfterSeconds?: number;
}

export interface ErrorBody {
  error: ErrorDetail;
}

export class ComputeApiError extends Error {
  readonly status: number;
  readonly detail: ErrorDetail;
  readonly headers: Readonly<Record<string, string>>;

  constructor(detail: ErrorDetail, headers: Record<string, string> = {}) {
    super(detail.message);
    this.name = 'ComputeApiError';
    this.status = ERROR_STATUS[detail.code];
    this.detail = detail;
    this.headers = Object.freeze({ ...headers });
  }
}

export const MESSAGES = Object.freeze({
  notFound: 'No compute endpoint is served at this address.',
  methodNotAllowed: 'This endpoint accepts POST with a JSON body, and OPTIONS.',
  disabled: 'The compute API is switched off. Try again later.',
  rateLimited: 'Too many requests from this address. Try again after the interval in Retry-After.',
  rateLimitUnavailable: 'The compute API answers only while its rate limit is in place, and the limit could not be checked. Try again after the interval in Retry-After.',
  unsupportedMediaType: 'Send the body as application/json in UTF-8, without a content encoding.',
  payloadTooLarge: `The body is larger than ${MAX_BODY_BYTES} bytes.`,
  invalidJson: 'The body is not valid JSON in UTF-8.',
  calculationFailed: 'The engine could not complete this calculation.',
});

export function notFound(): ComputeApiError {
  return new ComputeApiError({ code: 'not-found', message: MESSAGES.notFound });
}

export function methodNotAllowed(): ComputeApiError {
  return new ComputeApiError(
    { code: 'method-not-allowed', message: MESSAGES.methodNotAllowed },
    { Allow: 'POST, OPTIONS' },
  );
}

export function disabled(): ComputeApiError {
  const seconds = RETRY_AFTER_SECONDS.disabled;
  return new ComputeApiError(
    { code: 'disabled', message: MESSAGES.disabled, retryAfterSeconds: seconds },
    { 'Retry-After': String(seconds) },
  );
}

export function rateLimited(): ComputeApiError {
  const seconds = RETRY_AFTER_SECONDS.rateLimited;
  return new ComputeApiError(
    { code: 'rate-limited', message: MESSAGES.rateLimited, retryAfterSeconds: seconds },
    { 'Retry-After': String(seconds) },
  );
}

export function rateLimitUnavailable(): ComputeApiError {
  const seconds = RETRY_AFTER_SECONDS.rateLimitUnavailable;
  return new ComputeApiError(
    { code: 'rate-limit-unavailable', message: MESSAGES.rateLimitUnavailable, retryAfterSeconds: seconds },
    { 'Retry-After': String(seconds) },
  );
}

export function unsupportedMediaType(): ComputeApiError {
  return new ComputeApiError({ code: 'unsupported-media-type', message: MESSAGES.unsupportedMediaType });
}

export function payloadTooLarge(): ComputeApiError {
  return new ComputeApiError({
    code: 'payload-too-large',
    message: MESSAGES.payloadTooLarge,
    limit: 'body.bytes',
    max: MAX_BODY_BYTES,
  });
}

export function invalidJson(): ComputeApiError {
  return new ComputeApiError({ code: 'invalid-json', message: MESSAGES.invalidJson });
}

export function invalidRequest(pointer: string, message: string): ComputeApiError {
  return new ComputeApiError({ code: 'invalid-request', message, pointer });
}

export function budgetExhausted(limit: BudgetName): ComputeApiError {
  return new ComputeApiError({
    code: 'budget-exhausted',
    message: BUDGET_MESSAGES[limit],
    limit,
    max: BUDGETS[limit],
  });
}

export function calculationFailed(): ComputeApiError {
  return new ComputeApiError({ code: 'calculation-failed', message: MESSAGES.calculationFailed });
}
