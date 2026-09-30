/**
 * Drives the compute API's handler the way Vercel's Node runtime does: a
 * readable request stream with lower-cased headers and the rewrite's query
 * parameter, and a response that records its status, headers and body.
 * Used by scripts/build-compute-examples.mjs and the tests under tests/api/.
 */
import { Readable } from 'node:stream';
import { COMPUTE_FUNCTION_PATH, COMPUTE_ROUTE_PARAM, type ComputeEndpoint } from '../../src/lib/compute-api/constants';

export interface HarnessRequest {
  endpoint: ComputeEndpoint | null;
  method?: string;
  contentType?: string | null;
  /** A JSON value is serialized; a string or Buffer is sent as it is. */
  body?: unknown;
  contentLength?: number | null;
  headers?: Record<string, string>;
  /** Extra query parameters, as a client might add them. */
  query?: Record<string, string>;
}

export interface HarnessResponse {
  status: number;
  /** What the handler set as the reason phrase; undefined leaves Node's default for the status. */
  statusMessage: unknown;
  headers: Map<string, string>;
  text: string;
  json: any;
}

export function bodyBytes(body: unknown): Buffer {
  if (body === undefined || body === null) return Buffer.alloc(0);
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return Buffer.from(body, 'utf8');
  return Buffer.from(JSON.stringify(body), 'utf8');
}

export function makeRequest(request: HarnessRequest): any {
  const bytes = bodyBytes(request.body);
  const stream: any = Readable.from(bytes.length ? [bytes] : []);
  const query: Record<string, string> = { ...(request.query ?? {}) };
  if (request.endpoint !== null) query[COMPUTE_ROUTE_PARAM] = request.endpoint;
  const search = new URLSearchParams(query).toString();
  stream.method = request.method ?? 'POST';
  stream.url = `${COMPUTE_FUNCTION_PATH}${search ? `?${search}` : ''}`;
  stream.query = query;
  const headers: Record<string, string> = {
    host: 'zodiacs.org',
    'x-real-ip': '203.0.113.7',
    'x-forwarded-for': '203.0.113.7',
    ...(request.headers ?? {}),
  };
  const contentType = request.contentType === undefined ? 'application/json' : request.contentType;
  if (contentType !== null) headers['content-type'] = contentType;
  const declared = request.contentLength === undefined ? bytes.length : request.contentLength;
  if (declared !== null && (bytes.length > 0 || request.contentLength !== undefined)) headers['content-length'] = String(declared);
  stream.headers = headers;
  return stream;
}

export function makeResponse() {
  const headers = new Map<string, string>();
  const recorder = {
    statusCode: 0,
    statusMessage: undefined as unknown,
    text: '',
    ended: false,
    setHeader(name: string, value: string | number) {
      headers.set(name.toLowerCase(), String(value));
    },
    getHeader(name: string) {
      return headers.get(name.toLowerCase());
    },
    end(chunk?: string) {
      recorder.text = chunk ?? '';
      recorder.ended = true;
    },
    headers,
  };
  return recorder;
}

export async function run(
  handler: (req: any, res: any) => Promise<void>,
  request: HarnessRequest,
): Promise<HarnessResponse> {
  const req = makeRequest(request);
  const res = makeResponse();
  await handler(req, res);
  if (!res.ended) throw new Error('the handler did not end the response');
  let json: any = null;
  if (res.text) json = JSON.parse(res.text);
  return { status: res.statusCode, statusMessage: res.statusMessage, headers: res.headers, text: res.text, json };
}

/**
 * Fields that name the running Node's tzdb, and the digest over a receipt
 * that holds one: they differ between machines with different ICU data, and
 * nothing else in a response does.
 */
export function withoutRuntime(value: any): any {
  const copy = JSON.parse(JSON.stringify(value));
  const receipt = copy?.receipt;
  if (receipt?.provenance?.runtime) receipt.provenance.runtime = '<runtime>';
  if (receipt?.timeResolution && 'runtimeTzdb' in receipt.timeResolution) receipt.timeResolution.runtimeTzdb = '<runtime>';
  if (copy?.cite?.receipt) copy.cite.receipt = '<digest>';
  return copy;
}
