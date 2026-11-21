import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { LEGAL_PAGE_RULES, LOCALIZED_PRIVACY_PATHS, legalPageProblems, mainOf, normalizeLegalHtml } from './legal-pages-copy.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

/**
 * The source with its first account sync v2 conditional (the calculator
 * analytics paragraph) reduced to one branch, as the built page prints it:
 * check-dist reads the flag-on build and the flag-off build, never both
 * branches at once.
 */
function analyticsBranch(source, flagOn) {
  const open = '{accountSyncV2Enabled ? (';
  const start = source.indexOf(open);
  const separator = source.indexOf(') : (', start);
  const end = source.indexOf(')}', separator);
  if (start < 0 || separator < 0 || end < 0) throw new Error('analyticsBranch: no account sync v2 conditional');
  const branch = flagOn ? source.slice(start + open.length, separator) : source.slice(separator + ') : ('.length, end);
  return (source.slice(0, start) + branch + source.slice(end + 2)).replaceAll("{' '}", ' ');
}

describe('the English legal pages approved on 20 November 2026', () => {
  it('holds the privacy and terms sources to the approved copy', async () => {
    expect(legalPageProblems('/privacy/', await read('src/pages/privacy/index.astro'))).toEqual([]);
    expect(legalPageProblems('/terms/', await read('src/pages/terms/index.astro'))).toEqual([]);
  });

  it('holds the privacy page with account sync v2 on and with it off', async () => {
    const source = await read('src/pages/privacy/index.astro');
    const on = analyticsBranch(source, true);
    const off = analyticsBranch(source, false);
    expect(normalizeLegalHtml(on)).toContain('The birth chart and compatibility calculator pages load no analytics');
    expect(normalizeLegalHtml(on)).not.toContain('The compatibility calculator page loads no analytics');
    expect(normalizeLegalHtml(off)).toContain('The compatibility calculator page loads no analytics');
    expect(normalizeLegalHtml(off)).not.toContain('The birth chart and compatibility calculator pages');
    expect(legalPageProblems('/privacy/', on), 'flag on').toEqual([]);
    expect(legalPageProblems('/privacy/', off), 'flag off').toEqual([]);
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
    expect(checkDist).toContain('for (const path of Object.keys(LEGAL_PAGE_RULES))');
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
    expect(Object.keys(LEGAL_PAGE_RULES)).toEqual(['/privacy/', '/terms/', ...LOCALIZED_PRIVACY_PATHS]);
  });
});

describe('the translated privacy pages revised on 20 November 2026', () => {
  const LOCALES = [
    // locale, printed date, flag-on analytics sentence start, flag-off sentence start
    ['es', '20 de noviembre de 2026', 'Las páginas de la calculadora de carta natal y de la calculadora de compatibilidad no cargan', 'La página de la calculadora de compatibilidad no carga'],
    ['fr', '20 novembre 2026', 'Les pages du calculateur de thème natal et du calculateur de compatibilité ne chargent', 'La page du calculateur de compatibilité ne charge'],
    ['it', '20 novembre 2026', 'Le pagine del calcolatore del tema natale e del calcolatore di compatibilità non caricano', 'La pagina del calcolatore di compatibilità non carica'],
    ['pt', '20 de novembro de 2026', 'As páginas da calculadora de mapa astral e da calculadora de compatibilidade não carregam', 'A página da calculadora de compatibilidade não carrega'],
    ['ru', '20 ноября 2026 года', 'Страницы калькулятора натальной карты и калькулятора совместимости не загружают', 'Страница калькулятора совместимости не загружает'],
  ];

  it('covers every translated privacy page', () => {
    expect(LOCALIZED_PRIVACY_PATHS).toEqual(LOCALES.map(([locale]) => `/${locale}/privacy/`));
  });

  for (const [locale, updated, flagOn, flagOff] of LOCALES) {
    const path = `src/pages/${locale}/privacy/index.astro`;

    it(`holds ${path} to the approved copy`, async () => {
      expect(legalPageProblems(`/${locale}/privacy/`, await read(path))).toEqual([]);
    });

    it(`holds ${path} with account sync v2 on and with it off, one branch at a time`, async () => {
      const source = await read(path);
      const on = normalizeLegalHtml(analyticsBranch(source, true));
      const off = normalizeLegalHtml(analyticsBranch(source, false));
      // Each fixture prints only its own sentence, as the built page does.
      expect(on).toContain(flagOn);
      expect(on).not.toContain(flagOff);
      expect(off).toContain(flagOff);
      expect(off).not.toContain(flagOn);
      expect(legalPageProblems(`/${locale}/privacy/`, on), `${locale} flag on`).toEqual([]);
      expect(legalPageProblems(`/${locale}/privacy/`, off), `${locale} flag off`).toEqual([]);
    });

    it(`names the birth chart page only while account sync v2 is on (${locale})`, async () => {
      const source = normalizeLegalHtml(await read(path));
      const on = source.indexOf(flagOn);
      const off = source.indexOf(flagOff, on);
      expect(on, `${path}: flag-on sentence`).toBeGreaterThan(-1);
      expect(source.slice(on - 40, on), `${path}: flag-on branch`).toContain('{accountSyncV2Enabled ? (');
      expect(off, `${path}: flag-off sentence`).toBeGreaterThan(on);
      expect(source.slice(off - 20, off), `${path}: flag-off branch`).toContain(') : (');
      // The flag-off branch runs to its closing parenthesis and names the compatibility page alone.
      const offBranch = source.slice(off, source.indexOf(')}', off));
      expect(offBranch).not.toContain(flagOn);
      expect(offBranch.match(/Plausible/gu)).toHaveLength(1);
    });

    it(`keeps the new copy free of long dashes and dates the page (${locale})`, async () => {
      const source = await read(path);
      // From the calculator section's methodology link to the Guide heading: the calculator and analytics paragraphs.
      const calculator = source.slice(source.indexOf(`<a href="/${locale}/methodology/">`), source.indexOf('<h2>Guide</h2>'));
      expect(calculator).toContain('1970');
      expect(calculator).toContain('Plausible');
      expect(calculator).not.toMatch(/[–—]/u);
      const lede = source.slice(source.indexOf('<p class="lede">'), source.indexOf('</p>', source.indexOf('<p class="lede">')));
      expect(lede).not.toMatch(/[–—]/u);
      expect(source).not.toContain('configuredWalletChains');
      expect(source).toContain(`const updated = '${updated}'`);
      expect(source).toContain("const modifiedAt = '2026-11-20T00:00:00.000Z'");
    });
  }

  it('gives the translated pages the approval day in the sitemap, as their last entry', async () => {
    const sitemap = await read('src/pages/sitemap.xml.ts');
    const entry = "...['/es/privacy/', '/fr/privacy/', '/it/privacy/', '/pt/privacy/', '/ru/privacy/']\n    .map((loc) => [loc, '2026-11-20'] as const),";
    expect(sitemap).toContain(entry);
    // The later entries of the evergreen map win, so this must be the last one that names the pages.
    const evergreen = sitemap.slice(0, sitemap.indexOf('function getLastmod('));
    for (const loc of LOCALIZED_PRIVACY_PATHS) {
      expect(evergreen.lastIndexOf(`'${loc}'`), loc).toBeGreaterThan(evergreen.indexOf(entry));
    }
    expect(evergreen.lastIndexOf("'/es/privacy/'")).toBe(evergreen.indexOf(entry) + 4);
    expect(evergreen.lastIndexOf('/privacy/')).toBeLessThan(evergreen.indexOf(entry) + entry.length);
  });
});
