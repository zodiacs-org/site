/**
 * A local MCP server over the Zodiacs engine and its chart comparison.
 *
 * Transport is stdio and only stdio: this process reads requests on stdin and
 * writes protocol messages on stdout. It opens no listener, binds no port and
 * makes no outbound request. Start it with the host that will use it; it has
 * no other run mode.
 *
 * Two invariants hold the whole file together.
 *
 * Stdout carries protocol messages and nothing else. The stdio binding is
 * normative about this — a single stray `console.log` becomes a JSON parse
 * error at the client and takes the session with it — so this module never
 * writes to stdout itself, and `note` below is the only write path to stderr.
 * What `note` may say is deliberately thin: fixed strings, version numbers and
 * error class names. No birth detail, no record content, no argument value.
 *
 * Nothing thrown by a handler reaches the connection. The tools and resources
 * are registered in `create-server.ts`, where every tool call runs inside a
 * guard, so a malformed request produces a refusal and leaves the session able
 * to serve the next valid one.
 */
import { Transform } from 'node:stream';
import { StdioServerTransport, serveStdio } from '@modelcontextprotocol/server/stdio';
import { ENGINE_VERSION } from '@zodiacs/engine';
import { ADAPTER_NAME, ADAPTER_VERSION, LIMITS } from './bounds';
import { createServer } from './create-server';

/** The only write path off this process other than the protocol itself. */
function note(message: string): void {
  process.stderr.write(`${ADAPTER_NAME}: ${message}\n`);
}

/**
 * A line gate in front of the transport.
 *
 * A request is one JSON message on one line. When a line is longer than the
 * SDK's read buffer, that buffer throws and the stdio transport answers by
 * closing the connection — so one oversized line ended the session and the
 * process exited, with the next valid request never answered. An AI review
 * found it: 1048577 bytes in, no response, server gone. Lowering the buffer
 * from the SDK's 10 MB default had made it ten times easier to reach.
 *
 * This holds each line until it is complete and forwards it whole, or discards
 * it whole once it passes the limit and resynchronises at the next newline. A
 * partly-forwarded line would be worse than the crash: its fragment would join
 * the following line and destroy a legitimate request.
 *
 * A discarded line gets no reply. It was never parsed, so there is no request
 * id to answer with, and inventing one would be worse than silence. The only
 * thing inspected is the length: not one byte of a discarded line is parsed,
 * read or written anywhere.
 */
function lineGate(limit: number): Transform {
  let pending: Buffer[] = [];
  let pendingBytes = 0;
  let discarding = false;
  return new Transform({
    transform(chunk: Buffer, _encoding, done) {
      let start = 0;
      while (start < chunk.length) {
        const newline = chunk.indexOf(0x0a, start);
        const end = newline === -1 ? chunk.length : newline + 1;
        const segment = chunk.subarray(start, end);
        start = end;
        if (discarding) {
          if (newline !== -1) discarding = false;
          continue;
        }
        if (pendingBytes + segment.length > limit) {
          pending = [];
          pendingBytes = 0;
          discarding = newline === -1;
          note(`dropped one request line over the ${limit}-byte limit; the session is unaffected`);
          continue;
        }
        pending.push(segment);
        pendingBytes += segment.length;
        if (newline !== -1) {
          this.push(Buffer.concat(pending));
          pending = [];
          pendingBytes = 0;
        }
      }
      done();
    },
    flush(done) {
      // A final line with no newline is still a message the SDK can read.
      if (pendingBytes > 0) this.push(Buffer.concat(pending));
      done();
    },
  });
}

const gate = lineGate(LIMITS.requestBytes);
process.stdin.pipe(gate);

const handle = serveStdio(() => createServer(note), {
  // The gate above guarantees no forwarded line exceeds LIMITS.requestBytes, so
  // this buffer — deliberately a little larger — can no longer overflow. It is
  // still set rather than left at the SDK's 10 MB default, as a second bound.
  transport: new StdioServerTransport(gate, process.stdout, { maxBufferSize: LIMITS.requestBytes + 4096 }),
  onerror: (error) => note(`transport reported ${error.name}`),
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void handle.close().then(() => process.exit(0), () => process.exit(1));
  });
}

note(`ready on stdio: adapter ${ADAPTER_VERSION}, engine ${ENGINE_VERSION}, no network`);
