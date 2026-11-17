import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { matchingHeaderRules, sourcePattern } from '../../scripts/lib/vercel-source-pattern.mjs';

// Glama (glama.ai) reads this file to confirm that we own the Zodiacs listing there.
// It must stay public JSON at this exact path, and stay published to keep the claim.
const PATH = '/.well-known/glama.json';
const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
const body = readFileSync(new URL('../../public/.well-known/glama.json', import.meta.url), 'utf8');

describe('Glama ownership proof', () => {
  it('is the JSON Glama asks for, with one claim token and nothing else', () => {
    const json = JSON.parse(body);
    expect(Object.keys(json).sort()).toEqual(['$schema', 'claim']);
    expect(json.$schema).toBe('https://glama.ai/mcp/schemas/connector.json');
    expect(json.claim).toMatch(/^glama_claim_[A-Za-z0-9]{20,}$/u);
  });

  it('is not rewritten, redirected or given another content-type by vercel.json', () => {
    // Rules for other hosts (www, old domains) never see the canonical host's requests.
    const forCanonicalHost = (rule: any) =>
      (rule.has ?? []).every((cond: any) => cond.type !== 'host' || new RegExp(cond.value, 'u').test('zodiacs.org'));
    for (const rule of [...(config.rewrites ?? []), ...(config.redirects ?? [])].filter(forCanonicalHost)) {
      expect(sourcePattern(rule.source).test(PATH), rule.source).toBe(false);
    }
    const rules = matchingHeaderRules(config, PATH);
    expect(rules.flatMap((rule: any) => rule.headers.map((h: any) => h.key.toLowerCase()))).not.toContain('content-type');
  });
});
