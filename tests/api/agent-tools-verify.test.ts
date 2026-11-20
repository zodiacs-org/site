import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { matchingHeaderRules, sourcePattern } from '../../scripts/lib/vercel-source-pattern.mjs';

/*
 * The Agent Tools directory proves that zodiacs.org owns its listing by
 * fetching this file as plain text. It re-checks for 72 hours and revokes the
 * claim after three failed checks, so the file has to stay where it is. It is
 * a static .txt file, which the host already serves as text/plain, so no
 * header rule, rewrite or redirect may reach it.
 */
const PATH = '/.well-known/agent-tools-verify.txt';
const config = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
const body = readFileSync(new URL('../../public/.well-known/agent-tools-verify.txt', import.meta.url), 'utf8');

describe('Agent Tools ownership proof', () => {
  it('holds exactly one directory token and nothing else', () => {
    expect(body).toMatch(/^atc_[A-Za-z0-9_-]{20,}\n$/u);
  });

  it('is not rewritten, redirected or given a content-type by vercel.json', () => {
    // Rules for other hosts (www, old domains) never see the canonical host's requests.
    const forCanonicalHost = (rule: any) =>
      (rule.has ?? []).every((cond: any) => cond.type !== 'host' || new RegExp(cond.value, 'u').test('zodiacs.org'));
    for (const rule of [...(config.rewrites ?? []), ...(config.redirects ?? [])].filter(forCanonicalHost)) {
      expect(sourcePattern(rule.source).test(PATH), rule.source).toBe(false);
    }
    const rules = matchingHeaderRules(config, PATH);
    expect(rules.map((rule: any) => rule.source)).toEqual(['/(.*)']);
    expect(rules.flatMap((rule: any) => rule.headers.map((h: any) => h.key.toLowerCase()))).not.toContain('content-type');
  });
});
