/** Rendered editorial metadata and locale parity, without JavaScript. */
import { mkdir } from 'node:fs/promises';
import { EDITORIAL_METADATA } from '../src/lib/editorial-metadata.mjs';
import { editorialGraphErrors } from '../scripts/editorial-metadata-checks.mjs';

export async function runEditorialMetadataChecks({ browser, baseURL, check, outDir = null }) {
  if (outDir) await mkdir(outDir, { recursive: true });
  const paths = Object.keys(EDITORIAL_METADATA).filter((path) =>
    EDITORIAL_METADATA[path].type === 'CollectionPage'
    || path.endsWith('/chinese-zodiac/') || path.endsWith('/chinese-zodiac/rat/'));
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, javaScriptEnabled: false });
    try {
      for (const path of paths) {
        const response = await page.goto(`${baseURL}${path}`, { waitUntil: 'load' });
        const data = await page.evaluate(() => ({
          canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href'),
          lang: document.documentElement.lang,
          headings: document.querySelectorAll('h1').length,
          fit: document.documentElement.scrollWidth <= innerWidth + 1,
          nodes: [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((script) => {
            const data = JSON.parse(script.textContent);
            return data['@graph'] ?? [data];
          }),
        }));
        // The Mandarin editions declare zh-Hans / zh-Hant, whose primary subtag is zh.
        const prefix = /^\/(es|pt|fr|it|zh-hans|zh-hant)\//u.exec(path)?.[1];
        const locale = prefix?.startsWith('zh-') ? 'zh' : prefix ?? 'en';
        check(`editorial ${width}: ${path} has its exact canonical, locale and reviewed date without JavaScript`,
          response?.ok() && data.canonical === `https://zodiacs.org${path}`
          && data.lang.split('-')[0] === locale && data.headings === 1 && data.fit
          && editorialGraphErrors(path, data.nodes).length === 0);
        if (outDir) await page.screenshot({ path: `${outDir}/${path.slice(1).replaceAll('/', '-')}${width}.png`, fullPage: true });
      }
    } finally { await page.close(); }
  }
}
