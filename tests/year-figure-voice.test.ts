import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIGURE_NOTE } from '../src/lib/year-score/people';

/**
 * After a build with PUBLIC_YEAR_SCORE_ENABLED=1 and PUBLIC_YEAR_PEOPLE_ENABLED=1: a figure's page names the figure,
 * keeps "you" only for the reader's own call to action, and says nothing that reads as a call on a company, a team,
 * someone's health or their private life (ZOD-12).
 */
describe('the Year Ahead pages speak about the figure, not to them', () => {
  const root = new URL('../dist/year/', import.meta.url);
  const pages = () => readdirSync(root).filter((name) => existsSync(new URL(`${name}/index.html`, root)));
  const text = (slug: string) => {
    const html = readFileSync(new URL(`${slug}/index.html`, root), 'utf8');
    const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
    return main.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gu, '').replace(/<[^>]+>/gu, ' ').replace('Score your own year', '').replace(/&#39;|&#x27;/gu, "'");
  };
  it.skipIf(!existsSync(root))('has no second-person reading on any figure page', () => {
    for (const slug of pages()) expect(text(slug), slug).not.toMatch(/\b(?:your|you|yourself)\b/iu);
  });
  it.skipIf(!existsSync(root))('carries the fixed sentence and neutral month tiles, with no money, work, health or private-life words', () => {
    for (const slug of pages()) {
      const words = text(slug);
      expect(words, slug).toContain(FIGURE_NOTE);
      expect(words, slug).not.toMatch(/\b(?:earnings|money|spending|agreements|way of loving|emotional life|energy|Best month|Hardest month)\b/iu);
      expect(words, slug).toMatch(/Reading confidence \d{2}%/u);
    }
  });
});
