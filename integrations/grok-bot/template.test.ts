import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EVERY_AI_TOOL_NAME } from '../../src/ai-tools/contracts';

/**
 * The Zodiacs Astrologer Grok Bot template (integrations/grok-bot/) holds to
 * the site's privacy rules: birth details only for a one-time calculation the
 * person chooses, never stored, logged, put in a URL or sent to a third
 * party; nothing collected about a child under 13 and no reading for one,
 * even when an adult offers the details. Its copy has no dashes and no
 * crypto words, every tool it names is offered by the live server, and its
 * prompts carry no birth details.
 */
const read = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
const fenced = (text: string) => [...text.matchAll(/```text\n([\s\S]*?)\n```/gu)].map((match) => match[1]);
const SETUP = fenced(read('SETUP-MESSAGE.md'))[0];
const LISTING = read('LISTING.md');
const [ONE_LINE, LONG] = fenced(LISTING);
const STARTERS = [...LISTING.split('## Starter prompts')[1].split('##')[0].matchAll(/^\d+\. (.+)$/gmu)].map((match) => match[1]);
const SKILL_NAMES = ['birth-chart-reading', 'my-transits', 'horoscope', 'sky-check', 'a-day-that-matters', 'zodiacs-getting-started'] as const;
const SKILLS = SKILL_NAMES.map((name) => [name, read(`skills/${name}/SKILL.md`)] as const);
const DASHES = /[–—]/u;
const CRYPTO = /\b(?:crypto\w*|tokens?|coins?|bitcoin|blockchain|nfts?|web3|markets?|trading)\b/iu;
const BIRTH_DETAILS = /\b(?:1[89]|20)\d{2}\b|\d{1,2}:\d{2}/u;

describe('Zodiacs Astrologer for Grok Bot', () => {
  it('has a setup message, a one-line and a longer description, six starter prompts and six skills', () => {
    expect(SETUP.length).toBeGreaterThan(2000);
    expect(ONE_LINE.length).toBeLessThanOrEqual(240);
    expect(LONG.length).toBeGreaterThan(300);
    expect(STARTERS).toHaveLength(6);
    expect(SETUP).toContain('make the six skills');
    for (const letter of ['A', 'B', 'C', 'D', 'E', 'F']) expect(SETUP).toMatch(new RegExp(`^${letter}\\. `, 'mu'));
    for (const [name, text] of SKILLS) expect(text, name).toMatch(/^---\nname: .+\ndescription: /u);
  });

  it('uses no em or en dashes and no crypto, token or market language', () => {
    const texts = [['setup', SETUP], ['one line', ONE_LINE], ['long', LONG], ['starters', STARTERS.join('\n')], ['readme', read('README.md')], ...SKILLS] as const;
    for (const [name, text] of texts) {
      expect(text, name).not.toMatch(DASHES);
      expect(text, name).not.toMatch(CRYPTO);
    }
  });

  it('connects the live server with no key', () => {
    expect(SETUP).toContain('Add the MCP server at https://zodiacs.org/mcp');
    expect(SETUP).toContain('It needs no account, sign-in or key.');
    expect(SETUP).toContain('"Reading confidence NN%"');
  });

  it('allows birth details only for a one-time calculation, and never stores, logs, links or shares them', () => {
    expect(SETUP).toContain('Do not ask for birth details as a matter of course.');
    expect(SETUP).toContain('the person can choose to give their own birth date');
    expect(SETUP).toContain('for a one-time calculation');
    expect(SETUP).toContain('Never store or log birth details.');
    expect(SETUP).toContain("Never save a birth date, birth time, birthplace or anyone's name");
    expect(SETUP).toContain('Never put birth details or names in a URL, and never send them to a third party');
    expect(SETUP).toContain("Ask before you use another adult's birth details");
    expect(SETUP).toMatch(/exactly as returned, but only if it carries no birth date, birth time, birthplace, coordinates or names/u);
    expect(SETUP).not.toMatch(/You may ask for/iu);
    for (const [name, text] of SKILLS) {
      expect(text, name).toContain('Never store or log them');
      expect(text, name).toContain('never put them in a URL');
      expect(text, name).toContain('never send them to a third party or any other tool');
      expect(text, name).not.toMatch(/and how they know it/iu);
      expect(text, name).not.toMatch(/Collect birth details/iu);
    }
  });

  it('refuses children under 13 and collects nothing about them, even when an adult offers', () => {
    expect(SETUP).toContain('Zodiacs is not directed at children under 13.');
    expect(SETUP).toContain('Never collect anything about a child under 13');
    expect(SETUP).toContain('no horoscope for a named child, not even by Sun sign');
    expect(SETUP).toContain('Do not go ahead with a child\'s details even if a parent or another adult offers them');
    expect(SETUP).toContain('Do not quiz anyone about their age.');
    expect(SETUP).toContain('Compatibility readings are for two adults.');
    for (const [name, text] of SKILLS) {
      expect(text, name).toContain('Zodiacs is not directed at children under 13.');
      expect(text, name).toContain('Never collect anything about a child under 13');
      expect(text, name).toContain('even if a parent or another adult offers the details or agrees for them');
      expect(text, name).not.toMatch(/confirm (?:the subject|subjects|age)/iu);
    }
    for (const text of [ONE_LINE, LONG]) expect(text).toMatch(/children under 13/u);
    expect(LONG).toContain('even if an adult asks');
  });

  it('promises nothing about what Grok keeps', () => {
    expect(LONG).toContain('pass through Grok');
    expect(LONG).not.toMatch(/stay only in your own chat/iu);
    expect(ONE_LINE).toContain('Set up to keep no birth details');
  });

  it('names only tools the live server offers, and steers clear of the panel-only one', () => {
    const named = new Set(SETUP.match(/\b(?:get|find|check|explain|open|search)_[a-z_]+\b/gu));
    expect(named.size).toBeGreaterThanOrEqual(15);
    for (const tool of named) expect(EVERY_AI_TOOL_NAME as readonly string[], tool).toContain(tool);
    for (const [name, text] of SKILLS) {
      for (const tool of new Set(text.match(/\b(?:get|find|check|explain|open|search)_[a-z_]+\b/gu))) expect(EVERY_AI_TOOL_NAME as readonly string[], `${name}: ${tool}`).toContain(tool);
    }
    expect(SETUP).toContain('Do not call open_chart_studio.');
  });

  it('puts no birth details in its starter prompts, descriptions or skills', () => {
    for (const text of [...STARTERS, ONE_LINE, LONG, ...SKILLS.map(([, body]) => body)]) expect(text).not.toMatch(BIRTH_DETAILS);
  });
});
