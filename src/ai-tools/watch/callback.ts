import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { request } from 'node:https';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { signature } from './crypto';

const blocked = new BlockList();
for (const [ip, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3]] as const) blocked.addSubnet(ip, prefix, 'ipv4');
const global6 = new BlockList(); global6.addSubnet('2000::', 3, 'ipv6');
for (const [ip, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]] as const) blocked.addSubnet(ip, prefix, 'ipv6');
export function publicAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, 'ipv4') : family === 6 && global6.check(address, 'ipv6') && !blocked.check(address, 'ipv6');
}
export function callbackUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443')
    || url.hostname.endsWith('.') || !url.hostname.includes('.') || isIP(url.hostname.replace(/^\[|\]$/g, ''))) throw new Error('invalid-callback');
  return url;
}
export type CallbackPost = (url: string, headers: Record<string, string>, body: string) => Promise<{ status: number; body: string }>;
/** Resolve per connection, validate every answer, and pin the selected address. No redirect or pool reuse. */
export const callbackPost: CallbackPost = async (raw, headers, body) => {
  const url = callbackUrl(raw);
  if (Buffer.byteLength(body) > 262_144) throw new Error('payload-too-large');
  // A single deadline includes DNS resolution, connection, TLS and response body.
  const signal = AbortSignal.timeout(10_000);
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true }),
    new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true })),
  ]);
  if (!addresses.length || addresses.some(row => !publicAddress(row.address))) throw new Error('blocked-callback');
  const pinned = addresses[0];
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'POST', agent: false, signal,
      servername: url.hostname, headers: { ...headers, 'Content-Length': String(Buffer.byteLength(body)) },
      lookup: (_host, options, done) => {
        if (typeof options === 'object' && options.all) (done as any)(null, [pinned]);
        else (done as any)(null, pinned.address, pinned.family);
      },
    }, res => {
      const chunks: Buffer[] = []; let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > 4096) { res.destroy(); reject(new Error('response-too-large')); } else chunks.push(chunk);
      });
      res.on('error', () => reject(new Error('callback-failed')));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', () => reject(new Error(signal.aborted ? 'timeout' : 'callback-failed')));
    req.end(body);
  });
};
export function signedHeaders(secret: string, id: string, subscription: string, body: string, now: number, previous?: string) {
  const seconds = Math.floor(now / 1000);
  return { 'Content-Type': 'application/json', 'webhook-id': id, 'webhook-timestamp': String(seconds),
    'webhook-signature': [signature(secret, id, seconds, body), ...(previous ? [signature(previous, id, seconds, body)] : [])].join(' '),
    'X-MCP-Subscription-Id': subscription };
}
export async function verifyCallback(url: string, secret: string, id: string, post: CallbackPost, now: number) {
  const challenge = randomBytes(32).toString('base64url');
  const body = JSON.stringify({ type: 'verification', challenge });
  const response = await post(url, signedHeaders(secret, `verify_${randomBytes(16).toString('hex')}`, id, body, now), body);
  let echo: unknown; try { echo = JSON.parse(response.body).challenge; } catch { /* fixed refusal below */ }
  const returned = Buffer.from(typeof echo === 'string' ? echo : ''); const expected = Buffer.from(challenge);
  if (response.status < 200 || response.status >= 300 || returned.length !== expected.length || !timingSafeEqual(returned, expected)) throw new Error('challenge_failed');
}
