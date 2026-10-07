import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const OUT = process.env.OUT_DIR ?? null;
const CHROMIUM = await findChromium();
const expectedPrimary = ['/birth-chart/', '/astrofolio/'];
const expectedSigns = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const failures = [];

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` · ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

await withPreview({ port: Number(process.env.BIO_DRIVE_PORT ?? 4431) }, async (BASE) => {
  if (OUT) await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROMIUM, args: STABLE_CHROMIUM_ARGS });

  try {
    for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'tablet', width: 1024, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'annotation', width: 412, height: 915 },
    { name: 'narrow', width: 320, height: 780 },
  ]) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: viewport.width <= 600,
    });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${BASE}/bio/`, { waitUntil: 'networkidle' });

    const evidence = await page.evaluate(() => ({
      title: document.title,
      editionDate: document.documentElement.getAttribute('data-edition-date'),
      displayedEditionDate: document.querySelector('.bio-signs time')?.getAttribute('datetime'),
      canonical: document.querySelector('link[rel="canonical"]')?.href,
      robots: document.querySelector('meta[name="robots"]')?.content,
      width: document.documentElement.scrollWidth,
      viewport: innerWidth,
      navCount: document.querySelectorAll('nav.nav[aria-label="Primary"]').length,
      fullFooterCount: document.querySelectorAll('.zfooter').length,
      mainPaddingTop: getComputedStyle(document.querySelector('main')).paddingTop,
      navLinksVisible: [...document.querySelectorAll('.nav__links, .nav__search, .nav__chip, .nav__burger')]
        .some((node) => getComputedStyle(node).display !== 'none'),
      shareVisible: getComputedStyle(document.querySelector('[data-bio-share]')).display !== 'none',
      shareHitTarget: (() => {
        const share = document.querySelector('[data-bio-share]');
        if (!share) return false;
        const rect = share.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return hit === share || Boolean(hit && share.contains(hit));
      })(),
      guideVisible: (() => {
        const guide = document.querySelector('[data-guide-launcher]');
        return Boolean(guide && getComputedStyle(guide).display !== 'none');
      })(),
      primaryTop: Math.round(document.querySelector('.bio-link')?.getBoundingClientRect().top ?? 9999),
      signColumns: getComputedStyle(document.querySelector('.bio-signs__grid')).gridTemplateColumns.split(' ').length,
      card: (() => {
        const rect = document.querySelector('.bio-card')?.getBoundingClientRect();
        const styles = document.querySelector('.bio-card')
          ? getComputedStyle(document.querySelector('.bio-card'))
          : null;
        return rect && styles ? {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          border: styles.borderTopWidth,
          background: styles.backgroundColor,
          shadow: styles.boxShadow,
        } : null;
      })(),
    }));

    check(`${viewport.name}: route renders without page errors`, errors.length === 0, errors.join(' | '));
    check(`${viewport.name}: daily edition metadata and visible date agree`,
      Boolean(evidence.editionDate) && evidence.editionDate === evidence.displayedEditionDate,
      `${evidence.editionDate}/${evidence.displayedEditionDate}`);
    check(`${viewport.name}: no horizontal overflow`, evidence.width <= evidence.viewport, `${evidence.width}/${evidence.viewport}`);
    check(`${viewport.name}: canonical nav and footer remain present`, evidence.navCount === 1 && evidence.fullFooterCount === 1);
    check(`${viewport.name}: focused navigation spacing remains present`, evidence.mainPaddingTop === '76px', evidence.mainPaddingTop);
    check(`${viewport.name}: shared site navigation remains visible`, evidence.navLinksVisible);
    check(`${viewport.name}: share action stays visible`, evidence.shareVisible);
    check(`${viewport.name}: share action remains unobstructed in the page content`, evidence.shareHitTarget);
    check(`${viewport.name}: Guide does not overlap the link hub`, !evidence.guideVisible);
    check(`${viewport.name}: card stays inside viewport`, Boolean(evidence.card && evidence.card.left >= 0 && evidence.card.right <= viewport.width));
    check(`${viewport.name}: primary CTA arrives in the opening scan`, evidence.primaryTop <= 360, `${evidence.primaryTop}px`);

    if (viewport.width <= 600) {
      check(`${viewport.name}: small-screen composition drops the outer bezel`,
        evidence.card?.border === '0px' && evidence.card.background === 'rgba(0, 0, 0, 0)' && evidence.card.shadow === 'none',
        JSON.stringify(evidence.card));
      check(`${viewport.name}: all signs stay in a three-column grid`, evidence.signColumns === 3, `${evidence.signColumns}`);
    }

    await page.locator('.zfooter').scrollIntoViewIfNeeded();
    await page.waitForTimeout(50);
    const footerHeight = Math.round(await page.locator('.zfooter').evaluate((footer) => footer.getBoundingClientRect().height));
    check(`${viewport.name}: rendered compact footer stays subordinate`, footerHeight > 0 && footerHeight <= 460, `${footerHeight}px`);
    check(`${viewport.name}: compact footer does not leave an orphan Guide description`,
      !(await page.locator('.zfooter__help').isVisible()));
    await page.evaluate(() => window.scrollTo(0, 0));

    if (viewport.name === 'desktop') {
      const primary = await page.locator('.bio-link, .bio-astrofolio').evaluateAll((links) => links.map((link) => link.getAttribute('href')));
      const signsHeading = await page.locator('#signs-title').textContent();
      const signs = await page.locator('.bio-sign').evaluateAll((links) => links.map((link) => ({
        href: link.getAttribute('href'),
        label: link.getAttribute('aria-label'),
      })));
      check('primary links are exact', JSON.stringify(primary) === JSON.stringify(expectedPrimary), JSON.stringify(primary));
      check('horoscope heading is plain and stable', signsHeading === 'Choose your sign', signsHeading ?? '');
      check('desktop gives the twelve signs a four-column field', evidence.signColumns === 4, `${evidence.signColumns}`);
      check('all twelve signs appear once in canonical order',
        signs.length === 12 && signs.every((link, index) => (
          link.href === `/horoscopes/${expectedSigns[index]}/`
          && link.label === `${expectedSigns[index][0].toUpperCase()}${expectedSigns[index].slice(1)} daily horoscope`
        )), JSON.stringify(signs));
      check('page is self-canonical and noindex, follow',
        evidence.canonical === 'https://zodiacs.org/bio/'
          && evidence.robots?.includes('noindex') && evidence.robots?.includes('follow'),
        JSON.stringify(evidence));
      check('document title stays focused on the link hub',
        evidence.title === 'Zodiacs.org Links — Birth Chart, Horoscopes & Astrofolio', evidence.title);

      await page.evaluate(() => {
        window.__bioShares = [];
        Object.defineProperty(navigator, 'share', {
          configurable: true,
          value: async (payload) => window.__bioShares.push(payload),
        });
      });
      await page.locator('[data-bio-share]').click();
      await page.waitForFunction(() => document.querySelector('[data-bio-share-label]')?.textContent === 'Shared');
      const nativeShare = await page.evaluate(() => ({
        payloads: window.__bioShares,
        label: document.querySelector('[data-bio-share-label]')?.textContent,
        status: document.querySelector('[data-bio-share-status]')?.textContent,
      }));
      check('native share receives only the canonical bio URL and bounded copy',
        JSON.stringify(nativeShare) === JSON.stringify({
          payloads: [{
            title: 'Zodiacs.org',
            text: 'Free birth charts and daily horoscopes from Zodiacs.org.',
            url: 'https://zodiacs.org/bio/',
          }],
          label: 'Shared',
          status: 'Shared',
        }), JSON.stringify(nativeShare));

      await page.evaluate(() => {
        window.__bioCopies = [];
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: { writeText: async (value) => window.__bioCopies.push(value) },
        });
      });
      await page.locator('[data-bio-share]').click();
      await page.waitForFunction(() => document.querySelector('[data-bio-share-label]')?.textContent === 'Copied');
      const clipboardShare = await page.evaluate(() => ({
        copies: window.__bioCopies,
        label: document.querySelector('[data-bio-share-label]')?.textContent,
        status: document.querySelector('[data-bio-share-status]')?.textContent,
      }));
      check('clipboard share copies the canonical bio URL and announces success',
        JSON.stringify(clipboardShare) === JSON.stringify({
          copies: ['https://zodiacs.org/bio/'],
          label: 'Copied',
          status: 'Copied',
        }), JSON.stringify(clipboardShare));

      const sitemapResponse = await page.request.get(`${BASE}/sitemap.xml`);
      const sitemap = await sitemapResponse.text();
      check('noindex bio page stays out of the sitemap', sitemapResponse.ok() && !sitemap.includes('/bio/'));

      const searchResponse = await page.request.get(`${BASE}/search-index.json`);
      const searchIndex = await searchResponse.json();
      check('noindex bio page stays out of site search',
        searchResponse.ok() && Array.isArray(searchIndex)
          && !searchIndex.some((entry) => entry?.path === '/bio/'));

      await page.evaluate(() => {
        window.__bioEvents = [];
        window.zodiacsAnalytics = {
          track: (name, properties) => window.__bioEvents.push({ name, properties }),
        };
        document.querySelector('.bio-link')?.addEventListener('click', (event) => event.preventDefault(), { once: true });
      });
      await page.locator('.bio-link').first().click();
      const bioEvents = await page.evaluate(() => window.__bioEvents);
      check('primary CTA emits only its bounded destination',
        JSON.stringify(bioEvents) === JSON.stringify([
          { name: 'bio_click', properties: { destination: 'birth_chart' } },
        ]), JSON.stringify(bioEvents));

      if (OUT) await page.screenshot({ path: `${OUT}/bio-${viewport.name}.png`, fullPage: true });
      await page.keyboard.press('Tab');
      check('keyboard focus enters the page', await page.locator(':focus-visible').count() === 1);
    }
    else if (OUT) await page.screenshot({ path: `${OUT}/bio-${viewport.name}.png`, fullPage: true });
    await page.close();
  }

    const reduced = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await reduced.goto(`${BASE}/bio/`, { waitUntil: 'networkidle' });
    const motion = await reduced.locator('.bio-link').first().evaluate((node) => ({
      transition: getComputedStyle(node).transitionDuration,
      animation: getComputedStyle(node).animationName,
    }));
    check('reduced motion removes bio transitions and animation',
      motion.transition.split(',').every((duration) => duration.trim() === '0s') && motion.animation === 'none',
      JSON.stringify(motion));
    await reduced.close();
  } finally {
    await browser.close();
  }
});

console.log(failures.length ? `\n${failures.length} FAILURES` : '\nALL PASS');
process.exit(failures.length ? 1 : 0);
