/**
 * The digest a citation quotes: `sha256:` and the hex SHA-256 of a receipt's
 * RFC 8785 canonical JSON. The hosted compute API and the local MCP adapter
 * both cite with it, so one receipt has one digest wherever it is quoted, and
 * any client can recompute it from the receipt.
 *
 * Server and Node only: it imports `node:crypto`.
 */
import { createHash } from 'node:crypto';

/**
 * RFC 8785 (JSON Canonicalization Scheme) text of a JSON value: object keys
 * sorted by UTF-16 code units, no whitespace, and numbers and strings written
 * as ECMAScript's JSON.stringify writes them, which is what the RFC specifies.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON has no non-finite numbers.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
  }
  throw new TypeError('Canonical JSON holds only JSON values.');
}

/** `sha256:` and the hex digest of the receipt as a client parses it from the response. */
export function receiptDigest(receipt: unknown): string {
  const parsed: unknown = JSON.parse(JSON.stringify(receipt));
  return `sha256:${createHash('sha256').update(canonicalJson(parsed), 'utf8').digest('hex')}`;
}
