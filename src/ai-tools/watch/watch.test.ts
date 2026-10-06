import { describe, it, expect, vi } from 'vitest';
import { randomBytes, webcrypto } from 'node:crypto';
import { callbackUrl, publicAddress, signedHeaders, verifyCallback } from './callback';
import { destinationVault, signingKey } from './crypto';
import { FILTERS } from './contracts';
import { configuredSkyWatch } from './service';
import { calculateWindow, deliveryOutcome, fillWatchLedger } from './worker';

describe('Sky Watch safety and event ledger', () => {
  it.each(['http://example.com', 'https://127.1/', 'https://[::1]/', 'https://u:p@example.com', 'https://example.com:444/a', 'https://example.com/#x', 'https://example.com./', 'file:///tmp/callback'])('refuses unsafe callback syntax %s', url => {
    expect(() => callbackUrl(url)).toThrow();
  });
  it.each(['0.0.0.0', '10.4.2.1', '100.100.100.100', '127.0.0.1', '169.254.169.254', '172.31.0.1', '192.168.1.1', '192.0.2.1', '198.18.1.1', '224.0.0.1', '255.255.255.255', '::1', '::ffff:127.0.0.1', 'fc00::1', 'fe80::1', '2001:db8::1', '2002:7f00:1::1', '3fff::1'])('blocks nonpublic destination %s', address => expect(publicAddress(address)).toBe(false));
  it('accepts ordinary public addresses and HTTPS destinations', () => {
    expect(publicAddress('8.8.8.8')).toBe(true); expect(publicAddress('2606:4700::1111')).toBe(true);
    expect(publicAddress('2001:4860::8888')).toBe(true);
    expect(callbackUrl('https://receiver.example/events').href).toBe('https://receiver.example/events');
  });
  it('authenticates the exact payload bytes with Standard Webhooks HMAC', async () => {
    const bytes = randomBytes(32); const secret = `whsec_${bytes.toString('base64')}`;
    const body = '{"test":"λ","at":1}'; const headers = signedHeaders(secret, 'evt_test', 'sub_test', body, 100000);
    const key = await webcrypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const signature = Buffer.from(headers['webhook-signature'].slice(3), 'base64');
    expect(await webcrypto.subtle.verify('HMAC', key, signature, Buffer.from(`evt_test.100.${body}`))).toBe(true);
    expect(await webcrypto.subtle.verify('HMAC', key, signature, Buffer.from(`evt_test.100.${body} `))).toBe(false);
    expect(signedHeaders(secret, 'e', 's', body, 100000, secret)['webhook-signature'].split(' ')).toHaveLength(2);
  });
  it('rejects malformed or incorrectly sized signing keys', () => {
    for (const secret of ['x', 'whsec_YQ==', `whsec_${randomBytes(65).toString('base64')}`, `whsec_${randomBytes(32).toString('base64')}=`]) expect(() => signingKey(secret)).toThrow();
  });
  it('accepts canonical base64 with or without padding', () => {
    const bytes = randomBytes(32);
    expect(signingKey(`whsec_${bytes.toString('base64').replace(/=+$/, '')}`)).toEqual(bytes);
  });
  it('encrypts destinations, detects changes, and binds ciphertext to its subscription', () => {
    const vault = destinationVault(randomBytes(32).toString('base64'));
    const destination = { url: 'https://receiver.example/private', secret: 'secret-canary' };
    const sealed = vault.seal(destination, 'sub_1'); expect(sealed).not.toContain('canary');
    expect(vault.open(sealed, 'sub_1')).toEqual(destination);
    expect(() => vault.open(sealed, 'sub_2')).toThrow();
    expect(() => vault.open(sealed.replace(/^v1./, 'v2.'), 'sub_1')).toThrow();
    expect(() => destinationVault('bad-key')).toThrow();
  });
  it('requires a successful challenge echo, including on refresh', async () => {
    const secret = `whsec_${randomBytes(32).toString('base64')}`;
    const challenges: string[] = [];
    const echo = vi.fn(async (_url, _headers, body) => { challenges.push(JSON.parse(body).challenge); return { status: 200, body }; });
    await verifyCallback('https://receiver.example', secret, 'sub', echo, Date.now());
    await verifyCallback('https://receiver.example', secret, 'sub', echo, Date.now());
    expect(challenges[0]).not.toBe(challenges[1]);
    for (const status of [302, 410, 503]) await expect(verifyCallback('https://receiver.example', secret, 'sub', async (_u, _h, body) => ({ status, body }), Date.now())).rejects.toThrow();
    await expect(verifyCallback('https://receiver.example', secret, 'sub', async () => ({ status: 200, body: '{"challenge":"old"}' }), Date.now())).rejects.toThrow();
  });
  it('requires explicit supported filters and canonicalizes ordering', () => {
    expect(FILTERS['zodiacs.sky.ingress'].parse({ bodies: ['Moon', 'Sun', 'Moon'] })).toEqual({ bodies: ['Moon', 'Sun'], zone: 'UTC' });
    for (const args of [{}, { bodies: ['Moon'], birth: 'private' }, { bodies: ['Earth'] }, { bodies: ['Sun'], zone: 'Invalid/zone' }]) expect(() => FILTERS['zodiacs.sky.ingress'].parse(args)).toThrow();
    expect(() => FILTERS['zodiacs.sky.station'].parse({ bodies: ['Sun'] })).toThrow();
  });
  it('defaults off and refuses enabling the private credential bridge in production', () => {
    expect(configuredSkyWatch({})).toBeUndefined();
    expect(() => configuredSkyWatch({ ZODIACS_SKY_WATCH_ENABLED: '1', VERCEL_ENV: 'production' })).toThrow();
  });
  it('retries transient failures with a bound and stops permanent rejection', () => {
    expect(deliveryOutcome(503, 1)).toEqual({ outcome: 'retry', delay_seconds: 30 });
    expect(deliveryOutcome(429, 7).outcome).toBe('retry');
    for (const status of [0, 408, 503]) expect(deliveryOutcome(status, 8).outcome).toBe('failed');
    expect(deliveryOutcome(410, 1).outcome).toBe('gone');
    for (const status of [301, 400, 401, 403, 413]) expect(deliveryOutcome(status, 1).outcome).toBe('failed');
    expect(deliveryOutcome(204, 1).outcome).toBe('sent');
  });
  it('does not advance a failed search; catch-up is bounded and uses fixed UTC partitions', async () => {
    const rpc = vi.fn(async (_operation: string) => '2026-10-01T00:00:00Z');
    await expect(fillWatchLedger(rpc as any, Date.parse('2026-10-02T12:00:00Z'), async () => { throw new Error('refused'); })).rejects.toThrow();
    expect(rpc.mock.calls.map(args => args[0])).toEqual(['window']);
    rpc.mockClear(); const calculate = vi.fn(async () => []);
    expect(await fillWatchLedger(rpc as any, Date.parse('2026-10-06T12:00:00Z'), calculate)).toBe(3);
    expect(calculate).toHaveBeenCalledWith('2026-10-01T00:00:00Z', '2026-10-02T00:00:00.000Z');
  });
  it('reproduces engine event IDs with full receipts and no birth data', async () => {
    const first = await calculateWindow('2026-10-10T00:00:00Z', '2026-10-11T00:00:00Z');
    expect(first.length).toBeGreaterThan(0);
    expect(await calculateWindow('2026-10-10T00:00:00Z', '2026-10-11T00:00:00Z')).toEqual(first);
    for (const event of first) {
      expect(event.eventId).toMatch(/^evt_[a-f0-9]{64}$/); expect(event.data.receipt.search.completeness).toBe('tested-not-proven');
      expect(event).not.toHaveProperty('type'); expect(event.cursor).toBeNull();
    }
  });
});
