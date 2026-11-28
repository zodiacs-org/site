import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { isOfficialZodiacAddress } from '@zodiacs/sdk';
import {
  BASE_COMPARISON_NOTE, NORMALIZATION_NOTE, REGISTRY_SOURCE_URL,
  compareIdentifier, loadRegistry, validateRegistry,
} from '../../src/registry/astrofolio-verification/checker';

const raw = readFileSync(new URL('../../public/registry/zodiacs.registry.json', import.meta.url), 'utf8');
const registry = JSON.parse(raw);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const expectedSha256 = digest(raw);
const solana = registry.assets[0].native.address as string;
const base = registry.assets[0].representations.find((item: { chain: string }) => item.chain === 'base').address as string;
const jsonResponse = (value = raw) => new Response(value, { headers: { 'content-type': 'application/json; charset=utf-8' } });

describe('Registry source compatibility', () => {
  it('accepts the canonical collection without maintaining another identifier list', () => {
    expect(validateRegistry(registry).ok).toBe(true);
    for (const asset of registry.assets) {
      for (const representation of asset.representations) {
        expect(compareIdentifier(representation.address, representation.chain, registry)).toMatchObject({
          status: 'match', registryVersion: registry.version,
          record: { sign: asset.sign, displayName: asset.displayName, representation },
        });
      }
    }
  });

  it.each([
    ['missing', () => null],
    ['wrong source', (copy: any) => { copy.source = 'https://example.org'; return copy; }],
    ['wrong network ID', (copy: any) => { copy.assets[0].representations[1].chainId = 1; return copy; }],
    ['unsupported declaration', (copy: any) => { copy.supportedChains[1].chainId = 1; return copy; }],
    ['incomplete', (copy: any) => { copy.assets.pop(); return copy; }],
    ['duplicate sign', (copy: any) => { copy.assets[1].sign = copy.assets[0].sign; return copy; }],
    ['native contradiction', (copy: any) => { copy.assets[0].native.address = copy.assets[1].native.address; return copy; }],
    ['unofficial', (copy: any) => { copy.assets[0].representations[0].isOfficialRepresentation = false; return copy; }],
    ['bridged as native', (copy: any) => { copy.assets[0].representations[1].kind = 'native'; return copy; }],
    ['bridge contradiction', (copy: any) => { copy.assets[0].representations[1].originAddress = copy.assets[1].native.address; return copy; }],
    ['duplicate address', (copy: any) => { copy.assets[1].representations[1].address = base; return copy; }],
    ['malformed address', (copy: any) => { copy.assets[0].representations[1].address = '0x1234'; return copy; }],
  ])('rejects %s without returning a matching record', (_name, mutate) => {
    const changed = mutate(structuredClone(registry));
    expect(validateRegistry(changed).ok).toBe(false);
    expect(compareIdentifier(solana, 'solana', changed)).toMatchObject({ status: 'source-error' });
    expect(compareIdentifier(solana, 'solana', changed)).not.toHaveProperty('record');
  });
});

describe('chain-specific identifier semantics', () => {
  it('ignores ASCII edge whitespace and preserves Solana case', () => {
    expect(compareIdentifier(` \t${solana}\r\n`, 'solana', registry).status).toBe('match');
    // Changing a suffix keeps this particular public key 32 bytes while changing its identity.
    const differentKey = solana.slice(0, -1) + (solana.endsWith('v') ? 'V' : 'v');
    expect(compareIdentifier(differentKey, 'solana', registry).status).toBe('not-found');
    expect(NORMALIZATION_NOTE).toContain('case-sensitive');
  });

  it('compares Base hex bytes honestly without claiming checksum validation', () => {
    for (const value of [base.toLowerCase(), `0x${base.slice(2).toUpperCase()}`, base.replace('B', 'b')]) {
      expect(compareIdentifier(value, 'base', registry).status).toBe('match');
    }
    expect(BASE_COMPARISON_NOTE).toContain('checksum validation is not performed');
    expect(compareIdentifier(base.toUpperCase(), 'base', registry).status).toBe('malformed');
  });

  it('makes the published SDK checksum distinction explicit rather than claiming full parity', () => {
    const differentChecksum = base.replace('B', 'b');
    expect(differentChecksum).not.toBe(base);
    expect(isOfficialZodiacAddress(base, { chain: 'base' })).toBe(true);
    expect(isOfficialZodiacAddress(differentChecksum, { chain: 'base' })).toBe(false);
    expect(compareIdentifier(differentChecksum, 'base', registry).status).toBe('match');
    expect(BASE_COMPARISON_NOTE).toContain('hexadecimal bytes');
    expect(BASE_COMPARISON_NOTE).toContain('checksum validation is not performed');
  });

  it('agrees with published SDK identity membership for every canonical representation and selected chain', () => {
    for (const asset of registry.assets) {
      for (const representation of asset.representations) {
        const chain = representation.chain as 'solana' | 'base';
        expect(isOfficialZodiacAddress(representation.address, { chain })).toBe(true);
        expect(compareIdentifier(representation.address, chain, registry).status).toBe('match');
        expect(isOfficialZodiacAddress(representation.address, { chain: chain === 'base' ? 'solana' : 'base' })).toBe(false);
      }
    }
  });

  it.each([
    null, undefined, 123, {}, '', 'ARIES', 'ticker:ARIES', '0x1234', 'z'.repeat(44), '1'.repeat(33),
    `${solana}\u200b`, `\u00a0${solana}`, solana.replace('G', 'Ｇ'), base.replace('3', '３'),
    `${base}\u202e`, `${base}\u0000`, `https://solscan.io/token/${solana}`, `solana:${solana}`,
  ])('rejects malformed or Unicode input %s', (value) => {
    expect(compareIdentifier(value, 'solana', registry).status).toBe('malformed');
  });

  it('separates supported-format mismatch, unsupported network, and unknown records', () => {
    expect(compareIdentifier(solana, 'base', registry).status).toBe('wrong-network');
    expect(compareIdentifier(base, 'solana', registry).status).toBe('wrong-network');
    for (const network of ['ethereum', 'solana-devnet', 'base-sepolia', '8453', 'BASE', '']) {
      expect(compareIdentifier(base, network, registry).status).toBe('unsupported-network');
    }
    const unknown = compareIdentifier('1'.repeat(32), 'solana', registry);
    expect(unknown.status).toBe('not-found');
    expect(unknown.message).toContain('does not establish fraud or impersonation');
    expect(compareIdentifier(`0x${'0'.repeat(40)}`, 'base', registry).status).toBe('not-found');
  });
});

describe('fresh, address-free Registry loading', () => {
  it('fetches only the public canonical source and ties checks to exact source bytes', async () => {
    const fetcher = vi.fn(async () => jsonResponse());
    const result = await loadRegistry({ expectedSha256, fetcher });
    expect(result).toMatchObject({ status: 'ready', registrySha256: expectedSha256, registry });
    expect(fetcher).toHaveBeenCalledWith(REGISTRY_SOURCE_URL, {
      cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: expect.any(AbortSignal),
    });
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain(solana);
    if (result.status === 'ready') expect(Number.isFinite(Date.parse(result.checkedAt))).toBe(true);
  });

  it('does not reuse a prior success when the next source fetch fails', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(jsonResponse()).mockRejectedValueOnce(new Error('offline'));
    expect((await loadRegistry({ expectedSha256, fetcher })).status).toBe('ready');
    const result = await loadRegistry({ expectedSha256, fetcher });
    expect(result.status).toBe('source-error');
    expect(result).not.toHaveProperty('registry');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects changed source bytes even when the claimed version is unchanged', async () => {
    const changed = structuredClone(registry);
    changed.assets[0].representations[1].address = `0x${'1'.repeat(40)}`;
    const result = await loadRegistry({ expectedSha256, fetcher: async () => jsonResponse(JSON.stringify(changed)) });
    expect(result.status).toBe('source-changed');
    expect(result).not.toHaveProperty('registry');
    expect((await loadRegistry({ expectedSha256, fetcher: async () => jsonResponse(`${raw}\n`) })).status).toBe('source-changed');
  });

  it.each([
    ['HTTP error', async () => new Response('unavailable', { status: 503 })],
    ['HTML response', async () => new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } })],
    ['oversized body', async () => jsonResponse(' '.repeat(256 * 1024 + 1))],
    ['network failure', async () => { throw new Error('offline'); }],
  ])('fails closed on %s', async (_name, fetcher) => {
    const result = await loadRegistry({ expectedSha256, fetcher });
    expect(result.status).toBe('source-error');
    expect(result).not.toHaveProperty('registry');
  });

  it('rejects malformed JSON or shape even if the expected digest agrees', async () => {
    for (const value of ['{broken', '{}', 'null']) {
      expect((await loadRegistry({ expectedSha256: digest(value), fetcher: async () => jsonResponse(value) })).status).toBe('source-error');
    }
  });

  it('times out even if a transport ignores its AbortSignal', async () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => {}));
    expect((await loadRegistry({ expectedSha256, fetcher, timeoutMs: 5 })).status).toBe('source-error');
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('honors cancellation and never fetches with an invalid expected digest', async () => {
    const fetcher = vi.fn(async () => jsonResponse());
    const controller = new AbortController();
    controller.abort();
    expect((await loadRegistry({ expectedSha256, fetcher, signal: controller.signal })).status).toBe('source-error');
    expect((await loadRegistry({ expectedSha256: '', fetcher })).status).toBe('source-error');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not promote a late successful response after cancellation', async () => {
    let release: (response: Response) => void = () => {};
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { release = resolve; }));
    const controller = new AbortController();
    const loading = loadRegistry({ expectedSha256, fetcher, signal: controller.signal });
    controller.abort();
    expect((await loading).status).toBe('source-error');
    release(jsonResponse());
    await Promise.resolve();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not equate fetching source bytes with fetching chain evidence', async () => {
    const fetcher = vi.fn(async () => jsonResponse());
    const result = await loadRegistry({ expectedSha256, fetcher });
    expect(result.status).toBe('ready');
    expect(result).not.toHaveProperty('independentlyVerified');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(REGISTRY_SOURCE_URL);
  });
});
