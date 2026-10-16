/**
 * What the developer playground (/developers/playground/) does with a request
 * besides sending it: the code that sends it in five languages, the link that
 * reopens it, the digest that checks a receipt's citation, and the comparison
 * of two answers. No calculation happens here; the island imports this file
 * and the browser run is public/developers/playground/engine.mjs.
 */
import { COMPUTE_ORIGIN, computePath, type ComputeEndpoint } from './compute-api/constants';

export const PLAYGROUND_PATH = '/developers/playground/';
export const PLAYGROUND_EXAMPLES_PATH = '/developers/playground/examples.json';
export const PLAYGROUND_ENGINE_PATH = '/developers/playground/engine.mjs';
export const PLAYGROUND_EXAMPLES_SCHEMA = 'zodiacs.playground-examples.v1';

/** One documented request and the answer the API documents for it (src/lib/compute-api/examples.json). */
export interface PlaygroundExample {
  /** `endpoint.name`, as the playground's links name it. */
  id: string;
  endpoint: ComputeEndpoint;
  name: string;
  summary: string;
  /** The request body as the documentation sends it. */
  body: unknown;
  status: number;
  answer: unknown;
}

export const LANGUAGES = ['curl', 'javascript', 'python', 'swift', 'ruby'] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  curl: 'cURL',
  javascript: 'JavaScript',
  python: 'Python',
  swift: 'Swift',
  ruby: 'Ruby',
};

/** A JSON text written compactly, to compare requests whatever their layout; text that is not JSON as it is. */
export function compactBody(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return text;
  }
}

const SWIFT_ESCAPES: Readonly<Record<string, string>> = { '\n': 'n', '\r': 'r', '\t': 't' };

/**
 * The code that sends `text` to an endpoint as it stands, the request the
 * page's own buttons send, and prints the answer's body, in each language with
 * its standard library only. `origin` is where the API answers; the tests
 * point it at a local copy of the handler.
 */
export function codeSamples(endpoint: ComputeEndpoint, text: string, origin: string = COMPUTE_ORIGIN): Record<Language, string> {
  const url = `${origin}${computePath(endpoint)}`;
  // Not compacted: the API measures the body before it reads it, so whitespace can decide its answer.
  const body = text;
  // Swift's raw string ends at a quote followed by its hashes, and reads a backslash followed by them as an escape
  // (`\#(` would run code), so it takes more hashes than any run of them the text has after either. Swift refuses
  // control characters in a string literal, line breaks and tabs among them, so they are written as escapes.
  let hashes = '#';
  while (body.includes(`"${hashes}`) || body.includes(`\\${hashes}`)) hashes += '#';
  const swiftBody = body.replace(/[\u0000-\u001f\u007f]/gu, (character) =>
    `\\${hashes}${SWIFT_ESCAPES[character] ?? `u{${character.codePointAt(0)!.toString(16)}}`}`);
  return {
    curl: [
      `curl --silent --show-error ${url} \\`,
      "  --header 'Content-Type: application/json' \\",
      // --data would read a text that starts with @ as a file to upload.
      `  --data-raw '${body.replaceAll("'", "'\\''")}'`,
    ].join('\n'),
    javascript: [
      '// Node 18 or later, Deno, Bun or a browser.',
      `const response = await fetch('${url}', {`,
      "  method: 'POST',",
      "  headers: { 'Content-Type': 'application/json' },",
      `  body: ${JSON.stringify(body)},`,
      '});',
      'console.log(await response.text());',
    ].join('\n'),
    python: [
      '# Python 3.8 or later, standard library only.',
      'import urllib.error',
      'import urllib.request',
      '',
      `body = ${JSON.stringify(body)}`,
      'request = urllib.request.Request(',
      `    "${url}",`,
      '    data=body.encode("utf-8"),',
      '    headers={"Content-Type": "application/json"},',
      '    method="POST",',
      ')',
      'try:',
      '    with urllib.request.urlopen(request) as response:',
      '        print(response.read().decode("utf-8"))',
      'except urllib.error.HTTPError as refusal:',
      '    print(refusal.read().decode("utf-8"))',
    ].join('\n'),
    swift: [
      '// Swift 5.7 or later, Foundation only (macOS 12, iOS 15, Linux).',
      'import Foundation',
      '#if canImport(FoundationNetworking)',
      'import FoundationNetworking',
      '#endif',
      '',
      `var request = URLRequest(url: URL(string: "${url}")!)`,
      'request.httpMethod = "POST"',
      'request.setValue("application/json", forHTTPHeaderField: "Content-Type")',
      `request.httpBody = Data(${hashes}"${swiftBody}"${hashes}.utf8)`,
      'let (data, _) = try await URLSession.shared.data(for: request)',
      'print(String(decoding: data, as: UTF8.self))',
    ].join('\n'),
    ruby: [
      '# Ruby 2.6 or later, standard library only.',
      "require 'net/http'",
      '',
      `uri = URI('${url}')`,
      // Ruby reads a carriage return before a line feed in its source as the line break alone, so each carriage return
      // is a "\r" of its own, joined to the text around it as adjacent literals are.
      `body = ${body.split('\r').map((part) => `'${part.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`).join(' "\\r" ')}`,
      "response = Net::HTTP.post(uri, body, 'Content-Type' => 'application/json')",
      'puts response.body',
    ].join('\n'),
  };
}

/** Base64url of UTF-8 text, and back. */
export function toBase64Url(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export function fromBase64Url(encoded: string): string | null {
  if (!/^[A-Za-z0-9_-]*$/u.test(encoded)) return null;
  try {
    const binary = atob(encoded.replaceAll('-', '+').replaceAll('_', '/'));
    return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
  } catch {
    return null;
  }
}

export interface PlaygroundLinkState {
  endpoint: ComputeEndpoint;
  /** The documented example the request came from, if it is still that example's body. */
  example: string | null;
  text: string;
}

/**
 * A link that reopens the playground on a request. It names the endpoint and,
 * for an unedited documented example, the example. The request itself is in
 * the link only when `includeRequest` is true, and then in the fragment, which
 * a browser never sends to a server.
 */
export function shareLink(state: PlaygroundLinkState, includeRequest: boolean, origin: string = COMPUTE_ORIGIN): string {
  const url = new URL(PLAYGROUND_PATH, origin);
  if (state.example !== null && !includeRequest) url.searchParams.set('example', state.example);
  else url.searchParams.set('endpoint', state.endpoint);
  if (includeRequest) url.hash = `request=${toBase64Url(state.text)}`;
  return url.href;
}

/** What a playground link asks for: an example, an endpoint, and a request if it carries one. */
export function readLink(href: string, endpoints: readonly string[]): { example: string | null; endpoint: string | null; text: string | null } {
  const url = new URL(href, COMPUTE_ORIGIN);
  const example = url.searchParams.get('example');
  const endpoint = url.searchParams.get('endpoint');
  const fragment = new URLSearchParams(url.hash.replace(/^#/u, ''));
  const encoded = fragment.get('request');
  return {
    example: example && /^[a-z-]+\.[a-z-]+$/u.test(example) ? example : null,
    endpoint: endpoint && endpoints.includes(endpoint) ? endpoint : null,
    text: encoded === null ? null : fromBase64Url(encoded),
  };
}

/**
 * RFC 8785 canonical JSON, as src/lib/receipt-digest.ts writes it: object keys
 * sorted by UTF-16 code units, no whitespace, numbers and strings as
 * JSON.stringify writes them. Written again here because that file imports
 * node:crypto, and so that the browser checks a citation with code of its own.
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
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
  }
  throw new TypeError('Canonical JSON holds only JSON values.');
}

/** `sha256:` and the hex SHA-256 of a receipt's canonical JSON, with the runtime's own SHA-256 (crypto.subtle). */
export async function citationDigest(receipt: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(receipt));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return `sha256:${[...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** Whether an answer cites its receipt: its `cite.receipt` is the digest of its `receipt`. Null when it has neither. */
export async function citesItsReceipt(answer: unknown): Promise<{ cited: string; computed: string; matches: boolean } | null> {
  const value = answer as { receipt?: unknown; cite?: { receipt?: unknown } } | null;
  if (!value || typeof value !== 'object' || value.receipt === undefined || typeof value.cite?.receipt !== 'string') return null;
  const computed = await citationDigest(value.receipt);
  return { cited: value.cite.receipt, computed, matches: computed === value.cite.receipt };
}

export type DifferenceKind = 'runtime' | 'citation' | 'rounding' | 'value';

export interface Difference {
  path: string;
  kind: DifferenceKind;
  left: unknown;
  right: unknown;
}

// Where a receipt names the runtime that computed it: Node and the tzdb release
// its Intl reads, or a browser, which reports none (runtimeIdentity in
// src/lib/compute-api/local-time.ts).
const RUNTIME_PATHS = [/^\/receipt\/provenance\/runtime(?:\/|$)/u, /^\/receipt\/timeResolution\/runtimeTzdb$/u];
// Speeds are central differences, and a runtime's own sine and cosine can move
// the last digits of one (tests/api/compute-api-openapi.test.ts bounds nodal
// speeds by 1e-8 degrees a day across Node builds).
const ROUNDING = 1e-8;

/**
 * Where two answers differ, path by path (JSON Pointer), each named for why:
 * `runtime` where a receipt names its runtime, `citation` where the digest of
 * a receipt that differs there differs too, `rounding` where two numbers are
 * within 1e-8 of each other, and `value` for anything else.
 */
export function differences(left: unknown, right: unknown): Difference[] {
  const found: Difference[] = [];
  const walk = (a: unknown, b: unknown, path: string) => {
    const bothObjects = a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b);
    if (bothObjects) {
      const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
      for (const key of keys) walk((a as any)[key], (b as any)[key], `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`);
      return;
    }
    if (Object.is(a, b)) return;
    let kind: DifferenceKind = 'value';
    if (RUNTIME_PATHS.some((pattern) => pattern.test(path))) kind = 'runtime';
    else if (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= ROUNDING) kind = 'rounding';
    found.push({ path, kind, left: a, right: b });
  };
  walk(left, right, '');
  // A citation's digest follows its receipt: where the receipts differ, so do the digests. Where they do not, a
  // digest that differs is a difference in its own right.
  const receiptsDiffer = found.some(({ path }) => path.startsWith('/receipt/'));
  for (const difference of found) {
    if (difference.path === '/cite/receipt' && receiptsDiffer) difference.kind = 'citation';
  }
  return found;
}

/** The one-line verdict of a comparison. */
export function verdict(found: readonly Difference[]): 'same' | 'runtime' | 'rounding' | 'different' {
  if (found.length === 0) return 'same';
  if (found.some(({ kind }) => kind === 'value')) return 'different';
  if (found.some(({ kind }) => kind === 'rounding')) return 'rounding';
  return 'runtime';
}
