/**
 * The body of a request that makes a feed, read as raw bytes and refused past
 * CALENDAR_FEED_BODY_MAX_BYTES whether or not the request declared its length
 * (a chunked body has no Content-Length). Vercel's Node.js runtime parses
 * `req.body` only when code reads it, and this reader never does when the
 * request is a stream: it counts the bytes of the stream itself, so the bytes
 * counted are the bytes sent, not a re-serialization of what a parser kept.
 * (The `bodyParser: false` in api/calendar/transits.ts does not do this; that
 * runtime ignores it.)
 */

/** The largest body a create request may carry; a positions code is at most 256 characters. */
export const CALENDAR_FEED_BODY_MAX_BYTES = 512;

export type CalendarFeedBody =
  | { ok: true; text: string }
  | { ok: false; status: 400 | 413 };

const UNREADABLE: CalendarFeedBody = { ok: false, status: 400 };
const TOO_LARGE: CalendarFeedBody = { ok: false, status: 413 };

function header(req: any, name: string): string | null | 'invalid' {
  let candidate: unknown;
  try {
    candidate = req?.headers?.[name];
  } catch {
    return 'invalid';
  }
  if (candidate === undefined || candidate === null) return null;
  return typeof candidate === 'string' ? candidate : 'invalid';
}

function utf8(bytes: Uint8Array): CalendarFeedBody {
  try {
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return UNREADABLE;
  }
}

function asBytes(chunk: unknown): Buffer | null {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  if (typeof chunk === 'string') return Buffer.from(chunk, 'utf8');
  return null;
}

/**
 * Reads the stream through data/end listeners: Vercel replays the buffered
 * raw body through them (as the Guide route relies on, see
 * src/lib/guide-server/handler.ts). Past the limit nothing more is kept, and
 * the answer is 413 once the stream ends.
 */
function readStream(req: any, maxBytes: number): Promise<CalendarFeedBody> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;
    let endedGuard: ReturnType<typeof setImmediate> | null = null;
    const settle = (result: CalendarFeedBody) => {
      if (settled) return;
      settled = true;
      if (endedGuard !== null) clearImmediate(endedGuard);
      resolve(result);
    };
    const onData = (chunk: unknown) => {
      if (settled) return;
      const part = asBytes(chunk);
      if (!part) {
        settle(UNREADABLE);
        return;
      }
      total += part.byteLength;
      if (total > maxBytes) {
        chunks.length = 0;
        return;
      }
      chunks.push(part);
    };
    const onEnd = () => settle(total > maxBytes ? TOO_LARGE : utf8(Buffer.concat(chunks)));
    const onFailure = () => settle(total > maxBytes ? TOO_LARGE : UNREADABLE);
    try {
      req.on('end', onEnd);
      req.on('error', onFailure);
      req.on('aborted', onFailure);
      req.on('close', onFailure);
      req.on('data', onData);
      // A stream already consumed will never emit again; a replay settles in
      // this turn, so fail closed on the next one.
      if (!settled && (req.readableEnded === true || req.complete === true || req.destroyed === true)) {
        endedGuard = setImmediate(() => settle(UNREADABLE));
      }
    } catch {
      settle(UNREADABLE);
    }
  });
}

export async function readCalendarFeedBody(
  req: any,
  maxBytes: number = CALENDAR_FEED_BODY_MAX_BYTES,
): Promise<CalendarFeedBody> {
  const declared = header(req, 'content-length');
  if (declared === 'invalid') return UNREADABLE;
  if (declared !== null && declared.trim() !== '') {
    if (!/^\d+$/u.test(declared.trim())) return UNREADABLE;
    const digits = declared.trim().replace(/^0+(?=\d)/u, '');
    if (digits.length > String(maxBytes).length || Number(digits) > maxBytes) return TOO_LARGE;
  }

  if (req && typeof req.on === 'function' && typeof req.read === 'function') {
    return readStream(req, maxBytes);
  }

  // A body handed over already read (a test, or a runtime that buffers it):
  // only raw bytes or text count, never a parsed value.
  let body: unknown;
  try {
    body = req?.body;
  } catch {
    return UNREADABLE;
  }
  const bytes = asBytes(body);
  if (!bytes) return UNREADABLE;
  return bytes.byteLength > maxBytes ? TOO_LARGE : utf8(bytes);
}
