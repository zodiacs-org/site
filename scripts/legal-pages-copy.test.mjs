import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { LEGAL_PAGE_RULES, legalPageProblems, mainOf, normalizeLegalHtml } from './legal-pages-copy.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('the English legal pages approved on 20 November 2026', () => {
  it('holds the privacy and terms sources to the approved copy', async () => {
    expect(legalPageProblems('/privacy/', await read('src/pages/privacy/index.astro'))).toEqual([]);
    expect(legalPageProblems('/terms/', await read('src/pages/terms/index.astro'))).toEqual([]);
  });

  it('keeps the edited legal copy free of long dashes', async () => {
    const privacy = await read('src/pages/privacy/index.astro');
    const calculator = privacy.slice(privacy.indexOf('<h2>What happens when you use a calculator</h2>'), privacy.indexOf('<h2>Guide</h2>'));
    expect(calculator).toContain('one more script');
    expect(calculator).not.toMatch(/[–—]/u);
    expect(privacy).toContain('<h2 id="ai-integrations">The Zodiacs app</h2>');
    const terms = await read('src/pages/terms/index.astro');
    const lede = terms.slice(terms.indexOf('<p class="lede">'), terms.indexOf('</p>', terms.indexOf('<p class="lede">')));
    expect(lede).not.toMatch(/[–—]/u);
  });

  it('dates both pages to the approval day', async () => {
    for (const path of ['src/pages/privacy/index.astro', 'src/pages/terms/index.astro']) {
      const source = await read(path);
      expect(source, path).toContain("const updated = '20 November 2026'");
      expect(source, path).toContain("const modifiedAt = '2026-11-20T00:00:00.000Z'");
    }
    // The sitemap's later entries win, so the approval day must be each page's last entry.
    const sitemap = await read('src/pages/sitemap.xml.ts');
    for (const path of ['/privacy/', '/terms/']) {
      const entry = `['${path}', '2026-11-20'] as const,`;
      expect(sitemap, path).toContain(entry);
      expect(sitemap.lastIndexOf(`['${path}', '`), path).toBe(sitemap.indexOf(entry));
    }
  });

  it('is run over the built pages by check-dist', async () => {
    const checkDist = await read('scripts/check-dist.mjs');
    expect(checkDist).toContain("from './legal-pages-copy.mjs'");
    expect(checkDist).toContain('legalPageProblems(path, mainOf(');
  });

  it('reads only the page’s own copy, decodes what Astro escapes, and reports both directions', () => {
    const built = '<nav>official Zodiac token collection</nav><main id="main"><h2 id="ai-integrations" data-astro-cid-x>The Zodiacs app</h2>'
      + '<p>site&#39;s analytics &amp; birthplace&rsquo;s</p></main><footer>Registry</footer>';
    expect(mainOf(built)).not.toContain('<nav>');
    expect(normalizeLegalHtml(mainOf(built))).toContain('site’s analytics & birthplace’s');
    const problems = legalPageProblems('/privacy/', mainOf(built));
    expect(problems).toContain('/privacy/: missing "load Plausible, the site’s analytics"');
    expect(problems.some((problem) => problem.includes('still carries'))).toBe(false);
    const regressed = legalPageProblems('/terms/', '<h2>Digital-asset risks and third-party routes</h2><p>Purchase links open independent services.</p>');
    expect(regressed).toContain('/terms/: still carries "Digital-asset risks"');
    expect(regressed).toContain('/terms/: still carries "Purchase links"');
    expect(() => legalPageProblems('/about/', '')).toThrow(/no rules/u);
    expect(Object.keys(LEGAL_PAGE_RULES)).toEqual(['/privacy/', '/terms/']);
  });
});
