import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const fromAstro = createRequire(createRequire(import.meta.url).resolve('astro/package.json'));
const resolved = fromAstro.resolve('http-cache-semantics');
const CachePolicy = fromAstro('http-cache-semantics');
const request = headers => ({ url: 'https://fixture.invalid/photo', method: 'GET', headers });
const make = (headers, shared = true) => new CachePolicy(request({}), { status: 200, headers }, { shared });
const attackerDirectives = ['max-stale', 'max-stale=999999999'];
const pinnedSourceHash = 'fc7b3f0265b7a7d0fee83bafa47186a66495720d3179801c2be3083de6d0cf76';

describe('pinned HTTP cache reuse security', () => {
  it('resolves Astro to the reviewed local patch, with preserved provenance and license', () => {
    expect(resolved.replaceAll('\\', '/')).toContain('/vendor/http-cache-semantics/index.js');
    expect(createHash('sha256').update(readFileSync(resolved)).digest('hex')).toBe(pinnedSourceHash);
    expect(readFileSync(new URL('../vendor/http-cache-semantics/LICENSE', import.meta.url), 'utf8')).toContain('Copyright 2016-2018 Kornel');
    const provenance = readFileSync(new URL('../vendor/http-cache-semantics/PROVENANCE.md', import.meta.url), 'utf8');
    expect(provenance).toContain('not a published or maintainer-approved');
    expect(provenance).toContain('14a8c2ad51740dc39bf3e8f1a11c845a5003f217');
  });
  it.each([
    ['shared session cookie', { 'cache-control': 'max-age=600', 'set-cookie': 'session=synthetic-user-a' }],
    ['private response', { 'cache-control': 'private, max-age=600' }],
    ['do not store', { 'cache-control': 'no-store' }],
    ['always revalidate', { 'cache-control': 'no-cache, max-age=600' }],
    ['proxy revalidation', { 'cache-control': 'proxy-revalidate, max-age=600' }],
    ['mandatory revalidation', { 'cache-control': 'must-revalidate, max-age=600' }],
  ])('client stale directives cannot retrieve a %s, including after cache restoration', (_name, headers) => {
    const policy = make(headers);
    for (const instance of [policy, CachePolicy.fromObject(policy.toObject())]) {
      for (const cc of attackerDirectives) {
        const req = request({ 'cache-control': cc });
        expect(instance.satisfiesWithoutRevalidation(req)).toBe(false);
        expect(instance.evaluateRequest(req).response).toBeUndefined();
        expect(instance.evaluateRequest(req).revalidation?.synchronous).toBe(true);
      }
    }
  });
  it('preserves fresh public assets and explicitly public cookies', () => {
    for (const headers of [
      { 'cache-control': 'public, max-age=600' },
      { 'cache-control': 'public, max-age=600', 'set-cookie': 'public=synthetic' },
      { 'cache-control': 'immutable, max-age=600', 'set-cookie': 'public=synthetic' },
    ]) expect(make(headers).satisfiesWithoutRevalidation(request({}))).toBe(true);
  });
  it('preserves ordinary public expiration and allowed stale reuse', () => {
    const policy = make({ 'cache-control': 'public, max-age=60', age: '120' });
    expect(policy.satisfiesWithoutRevalidation(request({}))).toBe(false);
    expect(policy.satisfiesWithoutRevalidation(request({ 'cache-control': 'max-stale=180' }))).toBe(true);
  });
  it('preserves cookie-bearing responses in a private, non-shared cache', () => {
    const policy = make({ 'cache-control': 'max-age=600', 'set-cookie': 'private=synthetic' }, false);
    expect(policy.satisfiesWithoutRevalidation(request({}))).toBe(true);
  });
});
