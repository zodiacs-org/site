import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { effectiveHeaders, matchingHeaderRules, sourcePattern } from '../../scripts/lib/vercel-source-pattern.mjs';

/*
 * Google's Connected Apps domain check. Connected Console's "Download token"
 * gives a google-connected-apps.json file with a `verification_tokens` array;
 * Google then fetches https://zodiacs.org/.well-known/google-connected-apps and
 * needs HTTP 200 with that JSON and no redirect. The file is checked in at
 * public/.well-known/google-connected-apps (no extension) and ships with an
 * empty list until the owner downloads the real token; see
 * docs/platform/zodiacs-ai/google-connected-apps/SUBMIT-CHECKLIST.md.
 */
const PATH = '/.well-known/google-connected-apps';
const file = new URL('../../public/.well-known/google-connected-apps', import.meta.url);
const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));

describe('Google Connected Apps domain verification', () => {
  it('is a plain file holding only a list of verification tokens', () => {
    expect(statSync(file).isFile()).toBe(true);
    const body = JSON.parse(readFileSync(file, 'utf8'));
    expect(Object.keys(body)).toEqual(['verification_tokens']);
    expect(Array.isArray(body.verification_tokens)).toBe(true);
    for (const token of body.verification_tokens) {
      expect(typeof token).toBe('string');
      expect(token).toMatch(/^[\x21-\x7e]{1,512}$/u);
    }
    expect(new Set(body.verification_tokens).size).toBe(body.verification_tokens.length);
  });

  it('is served as uncached JSON only on its exact path', () => {
    const headers = effectiveHeaders(config, PATH);
    expect(headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(headers.get('cache-control')).toBe('no-store');
    for (const other of [`${PATH}/`, `${PATH}.json`, `${PATH}/extra`, '/xwell-known/google-connected-apps', '/.well-known/openai-apps-challenge', '/mcp']) {
      expect(matchingHeaderRules(config, other).some((rule: any) => rule.source === PATH), other).toBe(false);
    }
  });

  it('is never redirected or rewritten on the canonical host', () => {
    const redirected = config.redirects.filter((rule: any) => !rule.has && sourcePattern(rule.source).test(PATH));
    expect(redirected).toEqual([]);
    // The trailing-slash redirect leaves .well-known alone; without that exclusion it would add a slash here.
    const trailingSlash = config.redirects.find((rule: any) => rule.destination === '/:path/');
    expect(trailingSlash.source).toContain('\\.well-known(?:/|$)');
    expect(config.rewrites.filter((rule: any) => sourcePattern(rule.source).test(PATH))).toEqual([]);
  });
});
