import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EVERY_AI_TOOL_NAME } from '../../src/ai-tools/contracts';

/**
 * The Zodiacs Astrologer Grok Bot template (integrations/grok-bot/) holds to
 * the rules the ChatGPT app and the Claude connector keep: no dashes and no
 * crypto words in its copy, the child and privacy rules stated, every tool it
 * names offered by the live server, and no birth details in its prompts.
 */
const read = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
const fenced = (text: string) => [...text.matchAll(/```text\n([\s\S]*?)\n```/gu)].map((match) => match[1]);
const SETUP = fenced(read('SETUP-MESSAGE.md'))[0];
const LISTING = read('LISTING.md');
const [ONE_LINE, LONG] = fenced(LISTING);
const STARTERS = [...LISTING.split('## Starter prompts')[1].split('##')[0].matchAll(/^\d+\. (.+)$/gmu)].map((match) => match[1]);

describe('Zodiacs Astrologer for Grok Bot', () => {
  it('has a setup message, a one-line and a longer description, and six starter prompts', () => {
    expect(SETUP.length).toBeGreaterThan(2000);
    expect(ONE_LINE.length).toBeLessThanOrEqual(240);
    expect(LONG.length).toBeGreaterThan(300);
    expect(STARTERS).toHaveLength(6);
  });

  it('uses no em or en dashes and no crypto, token or market language', () => {
    for (const [name, text] of [['setup', SETUP], ['one line', ONE_LINE], ['long', LONG], ['starters', STARTERS.join('\n')]] as const) {
      expect(text, name).not.toMatch(/[–—]/u);
      expect(text, name).not.toMatch(/\b(?:crypto\w*|tokens?|coins?|bitcoin|blockchain|nfts?|web3|markets?|trading)\b/iu);
    }
  });

  it('connects the live server with no key, and keeps the child and privacy rules', () => {
    expect(SETUP).toContain('Add the MCP server at https://zodiacs.org/mcp');
    expect(SETUP).toContain('It needs no account, sign-in or key.');
    expect(SETUP).toContain('Zodiacs is not directed at children under 13.');
    expect(SETUP).toContain('Make no card, chart or reading for anyone under 13');
    expect(SETUP).toContain('Compatibility readings are for two adults.');
    expect(SETUP).toContain('Never save a birth date, birth time, birthplace or anyone\'s name');
    expect(SETUP).toContain('Ask before you use someone else\'s birth details');
    expect(SETUP).toContain('"Reading confidence NN%"');
    expect(SETUP).toMatch(/End every reading with the zodiacs\.org link the tool returned/u);
    for (const text of [ONE_LINE, LONG]) expect(text).toMatch(/children under 13/u);
  });

  it('names only tools the live server offers, and steers clear of the panel-only one', () => {
    const named = new Set(SETUP.match(/\b(?:get|find|check|explain|open|search)_[a-z_]+\b/gu));
    expect(named.size).toBeGreaterThanOrEqual(15);
    for (const tool of named) expect(EVERY_AI_TOOL_NAME as readonly string[], tool).toContain(tool);
    expect(SETUP).toContain('Do not call open_chart_studio.');
  });

  it('puts no birth details in its starter prompts or descriptions', () => {
    for (const text of [...STARTERS, ONE_LINE, LONG]) expect(text).not.toMatch(/\b(?:1[89]|20)\d{2}\b|\d{1,2}:\d{2}/u);
  });
});
