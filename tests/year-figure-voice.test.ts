import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** After a build: a figure's page names the figure, and keeps "you" only for the reader's own call to action. */
describe('the Year Ahead pages speak about the figure, not to them', () => {
  const root = new URL('../dist/year/', import.meta.url);
  it.skipIf(!existsSync(root))('has no second-person reading on any figure page', () => {
    for (const slug of readdirSync(root).filter((name) => existsSync(new URL(`${name}/index.html`, root)))) {
      const html = readFileSync(new URL(`${slug}/index.html`, root), 'utf8');
      const main = html.slice(html.indexOf('<main'), html.indexOf('</main>'));
      const text = main.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gu, '').replace(/<[^>]+>/gu, ' ').replace('Score your own year', '');
      expect(text, slug).not.toMatch(/\b(?:your|you|yourself)\b/iu);
    }
  });
});
