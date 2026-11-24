/**
 * QA drive for /thesis/ against `astro preview`: anchors resolve, the season
 * clock computes, the disclosure surfaces render their RESOLVED values (baked
 * statically for no-JavaScript readers, re-hydrated from JSON with scripts
 * on), no amber pending chip remains, the hydration script stays silent on
 * console, and every illustrated module fits 375/390/730/810/1280/1440 viewports.
 * It also verifies the essay's plain-prose structure and two bar charts, no-JavaScript
 * visibility, and the reduced-motion final state.
 *
 *   npm run build
 *   OUT_DIR=/tmp/shots node tests/thesis-qa-drive.mjs
 */
import { chromium } from 'playwright-core';
import { startPreview } from './visual/preview-server.mjs';
import { existsSync, readFileSync } from 'node:fs';
const canonicalFooterCss = readFileSync(new URL('../src/styles/site-footer.css', import.meta.url), 'utf8');
import { setTimeout as wait } from 'node:timers/promises';

const OUT = process.env.OUT_DIR ?? null;
const PORT = Number.parseInt(process.env.THESIS_QA_PORT ?? '4399', 10);
const ZODIAC_SLUGS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const ROMAN_LOTS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const GALLERY_SELECTOR = '[data-thesis-gallery] [data-gallery-stage]';
const LEO_MINT = '8Cd7wXoPb5Yt9cUGtmHNqAEmpMDrhfcVqnGbLC48b8Qm';
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ?? (existsSync('/opt/pw-browsers/chromium')
    ? '/opt/pw-browsers/chromium'
    : existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : chromium.executablePath());

const preview = await startPreview({ port: PORT });
const BASE = preview.baseURL;
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); };
const shot = async (page, sel, path) => {
  if (!OUT) return;
  if (sel) {
    const target = page.locator(sel);
    await target.scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);
    const proof = target.locator('[data-real-use-proof]');
    if (await proof.count() === 1) {
      // A tall section capture can include a proof card the viewport has not
      // reached. Trigger its real entrance before returning to the section.
      check(`${path}: proof content is exposed before capture`, await isVisuallyExposed(proof));
      await target.scrollIntoViewIfNeeded();
      await page.waitForTimeout(350);
    }
    await target.screenshot({
      path: `${OUT}/${path}`,
      // Isolated figure/section captures omit floating site controls. This
      // style exists only during capture; viewport checks and hero shots keep
      // the real navigation and Guide launcher visible.
      style: '.wnav-wrap, [data-guide-launcher] { visibility: hidden !important; }',
    }).catch(() => {});
  } else {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${OUT}/${path}` }).catch(() => {});
  }
};

const isVisuallyExposed = async (locator) => {
  if (await locator.count() !== 1) return false;
  await locator.scrollIntoViewIfNeeded();
  // IntersectionObserver and the longest entrance transition settle within
  // 440ms. Sampling after that window tests the final state, not a random
  // frame before the element has entered the viewport.
  await wait(500);
  return locator.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    let current = node;
    let opacity = 1;
    while (current instanceof Element) {
      const style = getComputedStyle(current);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      opacity *= Number.parseFloat(style.opacity || '1');
      current = current.parentElement;
    }
    return opacity > 0.01;
  });
};

// Edition Nº 10 moved the evidence figures (keyboard, curves, ownership records,
// the Leo check) below the essay, into the collapsed Evidence & disclosures vault.
const setVault = async (page, open) => {
  await page.locator('details.evidence-vault').evaluate((node, value) => { node.open = value; }, open);
};

const checkOwnershipDrawer = async (page, label) => {
  await setVault(page, true);
  const drawer = page.locator('#ownership-details');
  const figure = drawer.locator('#fig-authorities');
  check(`${label}: ownership records start collapsed`,
    await drawer.getAttribute('open') === null && !await figure.isVisible());
  await drawer.locator(':scope > summary').click();
  check(`${label}: the ownership summary opens the complete records`,
    await drawer.getAttribute('open') !== null && await isVisuallyExposed(figure));
};

const waitForGalleryReady = async (page, timeout = 20_000) => {
  const gallery = page.locator(GALLERY_SELECTOR);
  if (await gallery.count() !== 1) return false;
  const deadline = Date.now() + timeout;
  // Materialize the content-visibility section before aiming at its gallery.
  await page.locator('[data-thesis-gallery]').scrollIntoViewIfNeeded({ timeout });
  await wait(Math.min(200, Math.max(0, deadline - Date.now())));
  let readyInView = false;
  while (Date.now() < deadline) {
    // Earlier sections can resize after a jump, moving the gallery back out
    // of view before lazy initialization. Reposition while waiting, not only
    // after .is-ready has appeared. Never manufacture the ready class.
    await gallery.evaluate((node) => node.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
    await wait(Math.min(200, Math.max(0, deadline - Date.now())));
    const state = await gallery.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return node.classList.contains('is-ready')
        && rect.width > 0 && rect.height > 0
        && rect.bottom > 0 && rect.top < window.innerHeight;
    });
    // Two consecutive samples ensure the caller measures a settled, visible
    // ready stage rather than the frame before another layout shift.
    if (state && readyInView) return true;
    readyInView = state;
  }
  return false;
};

const VISUAL_MODULES = [
  ['know-and-believe chart', '#fig-know svg:visible'],
  ['memecoin lifespan chart', '#fig-lifespan svg:visible'],
  ['history transmission', '#fig-1 .transmission'],
  ['measured attention chart', '#fig-2 [data-attention-chart]:visible'],
  ['Unicode keyboard', '#fig-keyboard'],
  ['schematic attention curves', '#fig-3 .attention-patterns'],
  ['native authorities and recorded burns', '#fig-authorities'],
  ['real-use proof', '[data-real-use-proof]'],
  ['pastel zodiac gallery', GALLERY_SELECTOR],
  ['public provenance', '#fig-provenance'],
];

const checkFigureFit = async (page, width) => {
  for (const id of ['fig-know', 'fig-lifespan', 'fig-keyboard', 'fig-2', 'fig-3', 'fig-authorities', 'fig-provenance']) {
    const figure = page.locator(`#${id}`);
    const drawer = id === 'fig-authorities' ? page.locator('#ownership-details') : null;
    const wasOpen = drawer ? await drawer.getAttribute('open') !== null : false;
    const inVault = await figure.evaluate((node) => !!node.closest('details.evidence-vault'));
    const vaultWasOpen = await page.locator('details.evidence-vault').evaluate((node) => node.open);
    try {
      if (inVault && !vaultWasOpen) await setVault(page, true);
      // Offscreen chapters use content-visibility:auto. Visit each figure as
      // a reader would so the browser lays it out before measuring its bounds.
      if (drawer && !wasOpen) await drawer.locator(':scope > summary').click();
      await isVisuallyExposed(figure);
      const geometry = await figure.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        const svgOverflow = [...node.querySelectorAll('svg')].some((svg) => {
          const bounds = svg.getBoundingClientRect();
          return bounds.width > 0 && (bounds.left < rect.left - 1 || bounds.right > rect.right + 1);
        });
        return { width: rect.width, left: rect.left, right: rect.right, scroll: node.scrollWidth, client: node.clientWidth, svgOverflow };
      });
      check(`${width}px: #${id} and its SVGs fit without horizontal overflow`,
        geometry.width > 0 && geometry.left >= -1 && geometry.right <= width + 1
          && geometry.scroll <= geometry.client + 1 && !geometry.svgOverflow,
        JSON.stringify(geometry));
    } finally {
      if (drawer && !wasOpen) await drawer.locator(':scope > summary').click();
      if (inVault && !vaultWasOpen) await setVault(page, false);
    }
  }
};

try {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  // Script errors and same-origin load failures are page defects; external
  // fetch failures (the Pulse's live Wikimedia refresh) depend on the
  // network the drive runs on and are reported separately, not failed on.
  const errors = [];
  const external = [];
  const galleryRequests = [];
  const heroMediaRequests = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === '/assets/gallery.js') galleryRequests.push(req.url());
    if (new URL(req.url()).pathname === '/assets/art/zodiac-clock.mp4') heroMediaRequests.push(req);
  });
  page.on('requestfailed', (req) => {
    (req.url().startsWith('http://127.0.0.1') ? errors : external).push(req.url());
  });
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    window.__thesisWebGLContexts = [];
    HTMLCanvasElement.prototype.getContext = function (type) {
      if (type === 'webgl' || type === 'webgl2') {
        window.__thesisWebGLContexts.push({ type, at: performance.now() });
      }
      return getContext.apply(this, arguments);
    };
  });
  await page.goto(`${BASE}/thesis/`, { waitUntil: 'networkidle' });
  const registryCollectionMarker = await page.evaluate(async () => {
    const html = await fetch('/astrofolio/').then((response) => response.text());
    const documentCopy = new DOMParser().parseFromString(html, 'text/html');
    return documentCopy.querySelector('meta[name="zodiacs-registry-collection-enabled"]')?.content ?? null;
  });
  const registryCollectionEnabled = registryCollectionMarker === '1';
  check('Astrofolio publishes a valid Collection build marker',
    registryCollectionMarker === '0' || registryCollectionMarker === '1',
    String(registryCollectionMarker));
  check('1440×900: no page-level horizontal overflow',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  const thesisGallery = page.locator(GALLERY_SELECTOR);
  check('the page contains one gallery stage, outside the essay', (await thesisGallery.count()) === 1
    && (await page.locator('.essay__body > section [data-thesis-gallery]').count()) === 0);
  check('gallery bundle is not requested above the fold', galleryRequests.length === 0,
    galleryRequests.join(' | '));

  const initialWebGLContexts = await page.evaluate(() => window.__thesisWebGLContexts);
  check('offscreen gallery creates no WebGL context above the fold',
    initialWebGLContexts.length === 0, JSON.stringify(initialWebGLContexts));

  // Anchors resolve.
  for (const id of ['everyone-has-a-sign', 'where-the-signs-come-from', 'attention',
    'worth-holding', 'pulse', 'the-candidacy', 'what-holding-means', 'the-public-record',
    'the-conclusion', 'the-test', 'why-solana-why-base', 'the-case-against',
    'the-instrument', 'the-audience', 'who-wrote-this', 'ownership-details', 'fig-provenance',
    'the-honest-ending', 'appendix', 'essay']) {
    check(`anchor #${id} resolves`, (await page.locator(`[id="${id}"]`).count()) === 1);
  }

  // Season clock computed from the embedded ingress table.
  const clock = await page.locator('[data-season-clock]').textContent();
  check('season clock renders', /season · day \d+ of \d+/.test(clock ?? ''), clock ?? '(hidden)');

  check('thesis embeds byte-identical canonical footer CSS without its blocking request',
    (await page.locator('style[data-canonical-thesis-footer]').textContent()) === canonicalFooterCss
      && await page.locator('link[rel="stylesheet"][href*="site-footer.css"]').count() === 0
      && await page.evaluate(() => performance.getEntriesByType('resource')
        .filter((entry) => new URL(entry.name).pathname === '/assets/site-footer.css').length) === 0);
  // Masthead + footer.
  check('masthead reads Nº 11 · Why Zodiacs Matter', /Nº 11 · Why Zodiacs Matter/.test(await page.locator('.essay__rail').textContent() ?? ''));
  check('hero keeps one concise consumer subheader',
    (await page.locator('.hero__epi').count()) === 0
      && /You already know your sign\. Now it is also a coin/.test(await page.locator('.hero__sub').textContent() ?? ''));
  const heroVideo = page.locator('.hero video.hero__media');
  check('hero uses one ambient zodiac-clock video', (await heroVideo.count()) === 1);
  const heroVideoStart = await heroVideo.evaluate((video) => ({
    autoplay: video.hasAttribute('autoplay'),
    preload: video.preload,
    currentTime: video.currentTime,
    filter: getComputedStyle(video).filter,
    loop: video.loop,
    muted: video.muted,
    objectFit: getComputedStyle(video).objectFit,
    objectPosition: getComputedStyle(video).objectPosition,
    paused: video.paused,
    playsInline: video.playsInline,
    poster: new URL(video.poster).pathname,
    readyState: video.readyState,
    source: new URL(video.currentSrc).pathname,
  }));
  await wait(350);
  const heroVideoLater = await heroVideo.evaluate((video) => ({
    currentTime: video.currentTime,
    paused: video.paused,
  }));
  check('hero ambient video is loaded, looping, muted, inline, and moving',
    heroVideoStart.readyState >= 2
      && !heroVideoStart.autoplay
      && heroVideoStart.preload === 'none'
      && heroVideoStart.loop
      && heroVideoStart.muted
      && heroVideoStart.playsInline
      && heroVideoStart.poster === '/assets/art/zodiac-clock-768.avif'
      && heroVideoStart.source === '/assets/art/zodiac-clock.mp4'
      && !heroVideoStart.paused
      && !heroVideoLater.paused
      && heroVideoLater.currentTime !== heroVideoStart.currentTime,
    JSON.stringify({ start: heroVideoStart, later: heroVideoLater }));
  const heroPaint = await page.evaluate(() => ({
    firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
    origin: performance.timeOrigin,
    posterFinished: performance.getEntriesByType('resource')
      .find((entry) => new URL(entry.name).pathname === '/assets/art/zodiac-clock-768.avif')?.responseEnd,
  }));
  const firstMediaRequest = heroMediaRequests[0]?.timing().startTime;
  check('ambient media starts after the poster load and first contentful paint',
    typeof firstMediaRequest === 'number'
      && typeof heroPaint.firstContentfulPaint === 'number'
      && typeof heroPaint.posterFinished === 'number'
      && firstMediaRequest >= heroPaint.origin + heroPaint.firstContentfulPaint
      && firstMediaRequest >= heroPaint.origin + heroPaint.posterFinished,
    JSON.stringify({ ...heroPaint, firstMediaRequest }));
  check('hero keeps the original cover crop and color treatment',
    heroVideoStart.objectFit === 'cover'
      && heroVideoStart.objectPosition === '28% 50%'
      && heroVideoStart.filter === 'saturate(0.92) brightness(0.9)',
    JSON.stringify(heroVideoStart));
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await wait(250);
  const heroVideoOffscreen = await heroVideo.evaluate((video) => ({ paused: video.paused, currentTime: video.currentTime }));
  check('hero ambient video pauses off screen', heroVideoOffscreen.paused, JSON.stringify(heroVideoOffscreen));
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await wait(350);
  const heroVideoReturned = await heroVideo.evaluate((video) => ({ paused: video.paused, currentTime: video.currentTime }));
  check('hero ambient video resumes on screen',
    !heroVideoReturned.paused && heroVideoReturned.currentTime > heroVideoOffscreen.currentTime,
    JSON.stringify({ offscreen: heroVideoOffscreen, returned: heroVideoReturned }));
  check('hero has no static artwork canvas', (await page.locator('[data-hero-art]').count()) === 0);
  const heroIcons = page.locator('.hero__twelve .hero__twelve-icon');
  const heroIconState = await heroIcons.evaluateAll((icons) => icons.map((icon) => ({
    complete: icon.complete,
    naturalWidth: icon.naturalWidth,
    src: new URL(icon.currentSrc || icon.src).pathname,
    alt: icon.getAttribute('alt'),
  })));
  const heroLinks = await page.locator('.hero__twelve a').evaluateAll((links) => links.map((link) => ({
    href: new URL(link.href).pathname,
    label: link.getAttribute('aria-label'),
  })));
  check('hero uses all twelve canonical pastel zodiac icons',
    heroIconState.length === 12
      && heroIconState.every((icon, index) => icon.complete
        && icon.naturalWidth === 48
        && icon.src === `/assets/zodiac-icons/48/${ZODIAC_SLUGS[index]}.webp`
        && icon.alt === ''),
    JSON.stringify(heroIconState));
  check('hero pastel icons keep their registry links and accessible names',
    heroLinks.length === 12 && heroLinks.every((link, index) => {
      const slug = ZODIAC_SLUGS[index];
      return link.href === `/registry/${slug}/`
        && link.label === `${slug[0].toUpperCase()}${slug.slice(1)} — digital asset`;
    }));
  check('hero contains no platform zodiac emoji fallback',
    (await page.locator('.hero__twelve-glyph').count()) === 0
      && !/[♈♉♊♋♌♍♎♏♐♑♒♓]/u.test(await page.locator('.hero__twelve').textContent() ?? ''));
  const catalogueIcons = await page.locator('#the-twelve .twelve__item').evaluateAll((links) => links.map((link) => {
    const icon = link.querySelector('.twelve__glyph');
    const medallion = link.querySelector('.twelve__medallion');
    const iconRect = icon?.getBoundingClientRect();
    const medallionRect = medallion?.getBoundingClientRect();
    return {
      href: new URL(link.href).pathname,
      label: link.textContent.trim().toLowerCase(),
      complete: icon?.complete,
      naturalWidth: icon?.naturalWidth,
      src: icon ? new URL(icon.currentSrc || icon.src).pathname : '',
      alt: icon?.getAttribute('alt'),
      hidden: icon?.getAttribute('aria-hidden'),
      glyphWidth: iconRect?.width,
      glyphHeight: iconRect?.height,
      medallionWidth: medallionRect?.width,
      medallionHeight: medallionRect?.height,
    };
  }));
  check('catalogue uses twelve official pastel zodiac icons',
    catalogueIcons.length === 12 && catalogueIcons.every((item, index) => {
      const slug = ZODIAC_SLUGS[index];
      return item.href === `/registry/${slug}/`
        && item.label === slug
        && item.complete
        && item.naturalWidth >= 191
        && item.src === `/assets/icons/${slug}.png`
        && item.alt === ''
        && item.hidden === 'true'
        && item.medallionWidth === 48
        && item.medallionHeight === 48
        && item.glyphWidth * item.glyphHeight >= 470
        && item.glyphWidth * item.glyphHeight <= 625;
    }),
    JSON.stringify(catalogueIcons));
  check('catalogue contains no legacy Astrofolio glyph masks',
    (await page.locator('#the-twelve .af-glyph').count()) === 0);
  check('essay opens with the twelve signs, which need no explaining',
    /Show someone a page of crypto coins and they will ask what they are looking at\./.test(await page.locator('#everyone-has-a-sign').textContent() ?? ''));
  check('the note above the essay says who wrote it and that they hold the coins',
    await isVisuallyExposed(page.locator('#who-wrote-this'))
      && /Zodiacs\.org runs Astrofolio and wrote this essay\. We hold some of these coins/.test(await page.locator('#who-wrote-this').textContent() ?? ''));
  check('the essay says memecoins in its third paragraph, and says what one is',
    /They are memecoins\. A memecoin is a coin built around something people recognise\./.test(await page.locator('#everyone-has-a-sign').textContent() ?? ''));
  check('the essay is plain prose: no headings, drawers or asides above the evidence',
    (await page.locator('.essay__body > section h2, .essay__body > section h3, .essay__body > section details, .essay__body > section aside').count()) === 0);
  check('essay closes with a concrete invitation',
    /Choose the sign you already carry\.[\s\S]*Choose your sign[\s\S]*Open the twelve coins/.test(await page.locator('#the-honest-ending').textContent() ?? ''));
  const catalogueAction = page.locator('#the-honest-ending [data-thesis-cta="catalogue"]');
  check('essay close sends the primary action to the catalogue',
    (await catalogueAction.count()) === 1
      && await catalogueAction.getAttribute('href') === '/registry/'
      && /Choose your sign[\s\S]*Open the twelve coins/.test(await catalogueAction.textContent() ?? ''));
  const collectionAction = page.locator('#the-honest-ending [data-thesis-cta="collection"]');
  check('Collection build marker controls the optional thesis action',
    (await collectionAction.count()) === (registryCollectionEnabled ? 1 : 0),
    `marker ${registryCollectionMarker} · ${await collectionAction.count()} action(s)`);
  check('essay close contains only the primary, optional Collection, and copy actions',
    (await page.locator('#the-honest-ending .thesis-close__actions > *').count())
      === (registryCollectionEnabled ? 3 : 2));
  if (registryCollectionEnabled) {
    check('enabled Collection action is read-only and uses the fixed route',
      await collectionAction.getAttribute('href') === '/registry/collection/'
        && /View a wallet collection[\s\S]*Read-only · no signing/.test(await collectionAction.textContent() ?? ''));
  } else {
    check('disabled Collection route is absent from the thesis',
      (await page.locator('a[href="/registry/collection/"]').count()) === 0);
  }
  check('essay close includes one canonical-link copy control',
    (await page.locator('#the-honest-ending [data-thesis-copy-link]').count()) === 1);
  await page.evaluate(() => {
    window.__thesisCopiedUrl = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText(value) {
          window.__thesisCopiedUrl = value;
          return Promise.resolve();
        },
      },
    });
  });
  await page.locator('[data-thesis-copy-link]').evaluate((button) => button.click());
  await page.waitForFunction(() => (
    document.querySelector('[data-thesis-copy-label]')?.textContent?.trim() === 'Link copied'
  ));
  const copiedState = await page.evaluate(() => ({
    copied: window.__thesisCopiedUrl,
    label: document.querySelector('[data-thesis-copy-label]')?.textContent?.trim(),
    status: document.querySelector('[data-thesis-share-status]')?.textContent?.trim(),
  }));
  check('copy control copies the canonical thesis URL and confirms it accessibly',
    copiedState.copied === 'https://zodiacs.org/thesis/'
      && copiedState.label === 'Link copied'
      && copiedState.status === 'Canonical thesis link copied.',
    JSON.stringify(copiedState));
  check('public changelog is removed',
    (await page.locator('#changelog, a[href="#changelog"]').count()) === 0);
  check('removed attention summary cards stay out of the essay',
    (await page.locator('.truth-panel').count()) === 0);
  const audience = page.locator('#the-audience');
  check('E5 holds the audience figures and the Pulse below the essay',
    (await page.locator('#attention details').count()) === 0
      && (await audience.locator('.stats').count()) === 1
      && (await audience.locator('#pulse').count()) === 1);
  await setVault(page, true);
  check('E5 exposes the audience figures and the Pulse once the evidence opens',
    await isVisuallyExposed(audience.locator('.stats'))
      && await isVisuallyExposed(audience.locator('#pulse')));
  await setVault(page, false);

  // The last historical form is the digital asset, drawn (since the owner's
  // redesign) as a trading screen of twelve mini charts; the gallery upgrades its
  // authored fallback only when the reader reaches Section V.
  const finalEraState = await page.locator('#fig-1 .era').last().evaluate((era) => {
    const drawing = era.querySelector('.era__object svg');
    return {
      svgCount: era.querySelectorAll('.era__object svg').length,
      imageCount: era.querySelectorAll('img').length,
      marks: drawing ? drawing.querySelectorAll('.cd').length : 0,
      width: drawing ? drawing.getBoundingClientRect().width : 0,
      label: era.querySelector('.era__name')?.textContent?.trim(),
      date: era.querySelector('.era__time')?.textContent?.trim(),
    };
  });
  check('F1 ends with the Digital asset drawing of the twelve, and 5 Jul 2024',
    finalEraState.svgCount === 1
      && finalEraState.imageCount === 0
      && finalEraState.marks === 12
      && finalEraState.width > 0
      && finalEraState.label === 'Digital asset'
      && finalEraState.date === '5 Jul 2024',
    JSON.stringify(finalEraState));

  const galleryReady = await waitForGalleryReady(page);
  check('gallery bundle loads once when the reader reaches it',
    galleryReady && galleryRequests.length === 1,
    `${galleryReady ? 'ready' : 'not ready'} · ${galleryRequests.length} request(s)`);
  const visibleWebGLContexts = await page.evaluate(() => window.__thesisWebGLContexts);
  check('gallery creates its real WebGL contexts when reached',
    galleryReady && visibleWebGLContexts.length > 0, JSON.stringify(visibleWebGLContexts));
  const railButtons = thesisGallery.locator('[data-gallery-rail]').getByRole('button');
  const railState = await railButtons.evaluateAll((buttons) => buttons.map((button) => ({
    current: button.getAttribute('aria-current'),
    label: button.getAttribute('aria-label'),
    tabIndex: button.tabIndex,
    type: button.getAttribute('type'),
  })));
  check('gallery exposes twelve accessible rail controls',
    railState.length === 12 && railState.every((control, index) => {
      const slug = ZODIAC_SLUGS[index];
      const name = `${slug[0].toUpperCase()}${slug.slice(1)}`;
      return control.type === 'button'
        && control.label === `${name}, Lot ${ROMAN_LOTS[index]} of twelve`;
    }),
    JSON.stringify(railState));
  check('gallery rail has one roving current control',
    railState.filter((control) => control.current === 'true' && control.tabIndex === 0).length === 1
      && railState.filter((control) => control.current !== 'true' && control.tabIndex === -1).length === 11,
    JSON.stringify(railState));

  const galleryOpener = thesisGallery.locator('[data-gallery-open]');
  await galleryOpener.focus();
  await page.keyboard.press('Enter');
  await page.locator(`${GALLERY_SELECTOR}.is-open [data-gallery-card]:not([hidden])`)
    .waitFor({ state: 'attached', timeout: 5_000 }).catch(() => {});
  const galleryOpenState = await thesisGallery.evaluate((gallery) => ({
    cardHidden: gallery.querySelector('[data-gallery-card]')?.hidden,
    closerFocused: document.activeElement === gallery.querySelector('[data-gallery-close]'),
    open: gallery.classList.contains('is-open'),
  }));
  check('gallery opens from its keyboard control and focuses the close button',
    galleryOpenState.open && galleryOpenState.cardHidden === false && galleryOpenState.closerFocused,
    JSON.stringify(galleryOpenState));
  await page.keyboard.press('Escape');
  await page.waitForFunction((selector) => {
    const gallery = document.querySelector(selector);
    return gallery && !gallery.classList.contains('is-open')
      && gallery.querySelector('[data-gallery-card]')?.hidden;
  }, GALLERY_SELECTOR, { timeout: 5_000 }).catch(() => {});
  const galleryClosedState = await thesisGallery.evaluate((gallery) => ({
    cardHidden: gallery.querySelector('[data-gallery-card]')?.hidden,
    currentFocused: document.activeElement === gallery.querySelector('[data-gallery-rail] [aria-current="true"]'),
    open: gallery.classList.contains('is-open'),
  }));
  check('Escape closes the gallery card and returns focus to its current sign',
    !galleryClosedState.open && galleryClosedState.cardHidden && galleryClosedState.currentFocused,
    JSON.stringify(galleryClosedState));

  // Resolved disclosures — no amber chip remains after hydration settles.
  await wait(600);
  check('no pending chips remain (hydrated)', (await page.locator('.pending-disclosure').count()) === 0);
  check('disclosure last-updated line is dated',
    /Last updated: 20\d{2}-\d{2}-\d{2}/.test(await page.locator('[data-disclosure-updated]').textContent() ?? ''));
  check('instrument table renders dated values',
    (await page.locator('#the-instrument .disc-val').count()) >= 104,
    `${await page.locator('#the-instrument .disc-val').count()} values`);
  check('instrument verify links point at explorers',
    (await page.locator('#the-instrument a.disc-verify').count()) >= 100);
  const scoreVals = await page.locator('#the-candidacy .score .disc-val').count();
  check('candidacy scoreboard carries five observed readings', scoreVals === 5, `${scoreVals} values`);
  const scoreText = await page.locator('#the-candidacy .score').textContent() ?? '';
  check('candidacy readings stay search-scoped, not exhaustive',
    /no qualifying/i.test(scoreText) && !/(^|[^\d.])0 (verified|editorial)/i.test(scoreText));
  const tcard = await page.locator('.tcard').textContent() ?? '';
  check('test card is preregistered, not pending', /PREREGISTERED/.test(tcard) && !/PENDING/i.test(tcard.replace(/PREREGISTERED[^.]*/, '')));
  check('test card admits the test has not begun', /has not begun/.test(tcard));
  check('test card fixes the no-later-than date', /2026-10-31/.test(tcard));

  check('the gold, Bitcoin and Zodiacs comparison is gone',
    (await page.locator('#comparison-drawer, .ztbl, .comparison-panel').count()) === 0);
  const evidenceVault = page.locator('details.evidence-vault');
  const appendix = page.locator('#appendix');
  check('technical appendix starts hidden inside the closed evidence vault',
    await evidenceVault.getAttribute('open') === null
      && (await evidenceVault.locator('#appendix').count()) === 1
      && !await appendix.isVisible());
  await evidenceVault.locator(':scope > summary').focus();
  await page.keyboard.press('Enter');
  check('evidence vault opens from the keyboard and reveals the appendix',
    await evidenceVault.getAttribute('open') !== null && await appendix.isVisible());
  await page.keyboard.press('Enter');
  check('evidence vault closes from the keyboard and hides the appendix',
    await evidenceVault.getAttribute('open') === null && !await appendix.isVisible());
  await page.evaluate(() => { location.hash = 'appendix'; });
  await page.waitForFunction(() => document.querySelector('details.evidence-vault')?.open === true);
  check('deep-linking #appendix opens its collapsed evidence ancestor',
    await evidenceVault.getAttribute('open') !== null && await appendix.isVisible());
  await page.evaluate(() => {
    history.replaceState(null, '', location.pathname);
    document.querySelector('details.evidence-vault').open = false;
  });

  // Keep figure visits after the hero and above-fold gallery checks.
  await checkFigureFit(page, 1440);
  await checkOwnershipDrawer(page, 'desktop');

  // The human visual layer and optional evidence remain available.
  check('eight-era transmission renders', (await page.locator('.transmission .era').count()) === 8);
  check('F2 exposes measured data outside a template or drawer',
    await page.locator('#fig-2 [data-attention-chart]:visible').count() === 1
      && await page.locator('#fig-2 template, #fig-2 details').count() === 0);
  check('F3 draws four accessible schematic attention curves',
    (await page.locator('#fig-3 .attention-patterns .fact-card svg[role="img"]').count()) === 4
      && /A sketch:.*illustrative, not measured coin performance\./s.test(await page.locator('#fig-3 .zfig-cap').textContent() ?? ''));
  check('the keyboard figure identifies twelve Unicode symbols',
    (await page.locator('#fig-keyboard .keyboard-grid svg[role="img"]').count()) === 12
      && /June 1993/.test(await page.locator('#fig-keyboard .zfig-src').textContent() ?? ''));
  check('the authority figure distinguishes partial and unspecified burns',
    (await page.locator('#fig-authorities .authority-summary .fact-card').count()) === 4
      && (await page.locator('#fig-authorities .burn-grid svg[role="img"]').count()) === 2
      && /burns are not uniformly complete/.test(await page.locator('#fig-authorities .zfig-cap').textContent() ?? ''));
  check('gallery display labels are removed',
    (await page.locator('.thesis-gallery__head, .gband__fallback-title').count()) === 0);
  const realUseProof = page.locator('[data-real-use-proof]');
  const proofHrefs = await realUseProof.locator('.proof-loop__step').evaluateAll((links) => (
    links.map((link) => link.getAttribute('href'))
  ));
  check('real-use proof follows one Leo mint across three public surfaces',
    (await realUseProof.count()) === 1
      && (await realUseProof.locator('.proof-loop__steps > li').count()) === 3
      && JSON.stringify(proofHrefs) === JSON.stringify([
        '/registry/leo/',
        `https://explorer.solana.com/address/${LEO_MINT}`,
        `https://www.solflare.com/prices/leo/${LEO_MINT}/`,
      ])
      && (await realUseProof.locator('.proof-loop__mint code').textContent())?.trim() === LEO_MINT,
    JSON.stringify(proofHrefs));
  check('wallet proof states its third-party boundary',
    /Solflare is a third-party wallet surface\.[\s\S]*does not show that Solflare consumes the Zodiacs Registry or SDK\./
      .test(await realUseProof.textContent() ?? ''));
  const provenance = page.locator('#fig-provenance');
  check('four dated provenance entries expose criticism and the mistaken purchase',
    (await provenance.locator('.provenance-grid a > svg').count()) === 4
      && /Concentration[\s\S]*by mistake[\s\S]*Dead bag/i.test(await provenance.textContent() ?? '')
      && /search link rather than an individual post receipt/.test(await provenance.locator('.zfig-cap').textContent() ?? ''));

  const doubts = page.locator('#the-conclusion p').first();
  check('the doubts are stated once, visibly, with a link to the scoreboard',
    await isVisuallyExposed(doubts)
      && /^A memecoin can go to zero, and these can too\./.test((await doubts.textContent() ?? '').trim())
      && /No outside app has adopted them yet\./.test(await doubts.textContent() ?? '')
      && (await doubts.locator('a[href="#the-candidacy"]').count()) === 1
      && (await page.locator('[data-honest-limitation]').count()) === 0);
  const lifespanText = await page.locator('#fig-lifespan').textContent() ?? '';
  check('the lifespan chart names its source and its caveat',
    /CoinGecko/.test(lifespanText) && /counted trades on Pump\.fun only/.test(lifespanText));
  check('the know-and-believe chart prints both survey figures',
    /90%[\s\S]*27%/.test(await page.locator('#fig-know svg.dots-chart--wide').textContent() ?? ''));
  check('plain candidacy snapshot renders', (await page.locator('.human-score__item').count()) === 4);
  check('three-question test renders', (await page.locator('.test-question').count()) === 3);
  check('plain-language instrument renders', (await page.locator('#the-instrument .fact-card:not(#ownership-details .fact-card)').count()) === 6);
  check('technical evidence is progressively disclosed', (await page.locator('details.evidence-drawer').count()) >= 6);

  // Entrances use one short transition and a restrained 50ms child stagger.
  // Sample the candidacy snapshot after it enters; computed timing remains
  // available after the one-time transition has completed. (F1 used to be
  // the sample; it now plays its own figure motion instead of the reveal.)
  await setVault(page, true);
  const motionSample = page.locator('#the-candidacy .human-score[data-almanac-reveal]');
  await motionSample.scrollIntoViewIfNeeded();
  await wait(850);
  const motionTimings = await motionSample.locator(':scope > *').evaluateAll((nodes) => nodes.slice(0, 4).map((node) => {
    const style = getComputedStyle(node);
    return {
      duration: Number.parseFloat(style.transitionDuration),
      delay: Number.parseFloat(style.transitionDelay),
      animation: style.animationName,
    };
  }));
  check('motion: entrances last 360–460ms and do not loop',
    motionTimings.length === 4
      && motionTimings.every((timing) => timing.duration >= 0.36 && timing.duration <= 0.46
        && timing.animation === 'none'));
  check('motion: child entrances stagger by 40–60ms',
    motionTimings.length === 4
      && motionTimings.slice(1).every((timing, index) => {
        const delta = timing.delay - motionTimings[index].delay;
        return delta >= 0.04 && delta <= 0.06;
      }),
    motionTimings.map((timing) => `${timing.delay}s`).join(', '));
  await setVault(page, false);

  // Origin receipts stay linked from the public-history story.
  check('public history links the registry disclosure origin row',
    (await page.locator('#the-case-against a[href="https://zodiacs.org/disclosure/#origin"]').count()) === 1
      && (await page.locator('#the-public-record a[href="/disclosure/#origin"]').count()) === 1);

  // Evidence shots — desktop.
  await shot(page, '#fig-know', 'thesis-know-desktop.png');
  await shot(page, '#fig-lifespan', 'thesis-lifespan-desktop.png');
  await shot(page, '#fig-1', 'thesis-f1-desktop.png');
  await shot(page, '#fig-2', 'thesis-f2-desktop.png');
  await shot(page, '#fig-provenance', 'thesis-provenance-desktop.png');
  await shot(page, '#the-public-record', 'thesis-history-desktop.png');
  for (const id of ['everyone-has-a-sign', 'where-the-signs-come-from', 'attention', 'what-holding-means', 'the-public-record', 'the-conclusion']) {
    await shot(page, `#${id}`, `thesis-${id}-desktop.png`);
  }
  await shot(page, GALLERY_SELECTOR, 'thesis-gallery-desktop.png');
  await setVault(page, true);
  await shot(page, '#fig-3', 'thesis-f3-desktop.png');
  await shot(page, '#fig-keyboard', 'thesis-keyboard-desktop.png');
  await shot(page, '#fig-authorities', 'thesis-authorities-desktop.png');
  await page.locator('#ownership-details > summary').click();
  await shot(page, '#the-instrument [data-real-use-proof]', 'thesis-proof-desktop.png');
  await shot(page, '#the-audience', 'thesis-audience-desktop.png');
  await shot(page, '#the-candidacy', 'thesis-v-desktop.png');
  await shot(page, '#the-test', 'thesis-vii-desktop.png');
  await shot(page, '#the-case-against', 'thesis-ix-desktop.png');
  await shot(page, '#the-instrument', 'thesis-x-desktop.png');
  await shot(page, null, 'thesis-hero-desktop.png');

  check('no page errors or same-origin failures (desktop)', errors.length === 0, errors.slice(0, 2).join(' | '));
  if (external.length) console.log(`  note: ${external.length} external fetch(es) failed on this network: ${[...new Set(external.map((u) => new URL(u).host))].join(', ')}`);
  await page.close();

  // 1280px shots for the release evidence set.
  const mid = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await mid.goto(`${BASE}/thesis/`, { waitUntil: 'networkidle' });
  await checkFigureFit(mid, 1280);
  await wait(600);
  await mid.locator('details.evidence-vault').evaluate((node) => { node.open = true; });
  await shot(mid, '#the-instrument', 'thesis-x-1280.png');
  await shot(mid, null, 'thesis-hero-1280.png');
  await mid.close();

  // F1 is a plate with its own one-time motion: the line carries the signs
  // from form to form, the count steps to 7, then the twelve light.
  const carry = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const carryErrors = [];
  carry.on('pageerror', (err) => carryErrors.push(String(err)));
  await carry.goto(`${BASE}/thesis/`, { waitUntil: 'networkidle' });
  await wait(300);
  const carryState = () => carry.locator('#fig-1').evaluate((fig) => {
    const opacity = (node) => Number.parseFloat(getComputedStyle(node).opacity);
    const veil = (node) => {
      const style = getComputedStyle(node, '::after');
      return style.content === 'none' || style.content === 'normal' ? 0 : Number.parseFloat(style.opacity);
    };
    return {
      armed: fig.classList.contains('is-armed'),
      on: fig.classList.contains('is-on'),
      isTwelve: fig.classList.contains('is-twelve'),
      count: fig.querySelector('[data-carry-count]')?.textContent ?? '',
      // A drawing is dimmed by a veil in the plate's colour, so its shown strength is 1 minus the veil.
      firstDrawing: 1 - veil(fig.querySelector('.era__object')),
      firstMark: opacity(fig.querySelector('.cd')),
      eras: [...fig.querySelectorAll('.era > :not(.era__tip)')].map((node) => (node.classList.contains('era__object') ? 1 - veil(node) : opacity(node))),
      marks: [...fig.querySelectorAll('.cd')].map(opacity),
      // The closing beat: the twelve sign icons in the header light one after another.
      picks: [...fig.querySelectorAll('.carry-pick')].map(opacity),
      live: fig.classList.contains('is-live'),
      // The big axis: leaders draw up from their dates (stroke-dashoffset to 0), markers pop to 1.
      leads: [...fig.querySelectorAll('svg.carry-axis:not(.carry-axis--mini) .carry-lead')]
        .map((node) => Number.parseFloat(getComputedStyle(node).strokeDashoffset)),
      axisMarks: [...fig.querySelectorAll('svg.carry-axis:not(.carry-axis--mini) .carry-mark')].map(opacity),
      height: fig.getBoundingClientRect().height,
    };
  });
  // Each leader's top end must sit under its drawing's horizontal centre.
  const leaderOffsets = () => carry.locator('#fig-1').evaluate((fig) => {
    const drawings = [...fig.querySelectorAll('.era__object')];
    return [...fig.querySelectorAll('svg.carry-axis:not(.carry-axis--mini) .carry-lead')].map((lead, index) => {
      const point = lead.getPointAtLength(0);
      const matrix = lead.getScreenCTM();
      const x = point.x * matrix.a + point.y * matrix.c + matrix.e;
      const box = drawings[index].getBoundingClientRect();
      return Math.abs(x - (box.left + box.width / 2));
    });
  });
  const carryBefore = await carryState();
  check('F1 plate: armed below the fold with the count at 0, the forms veiled and no marks yet',
    carryBefore.armed && !carryBefore.on && carryBefore.count === '0'
      && carryBefore.firstDrawing < 0.2 && carryBefore.firstMark === 0
      && carryBefore.leads.length === 8 && carryBefore.leads[0] !== 0
      && carryBefore.picks.length === 12 && carryBefore.picks.every((value) => value < 0.2),
    JSON.stringify({ ...carryBefore, eras: undefined, marks: undefined }));
  await carry.locator('#fig-1').evaluate((fig) => fig.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const scrolledAt = Date.now();
  // While the entrance plays, hovering a form and clicking a sign do nothing.
  await wait(800);
  await carry.locator('#fig-1 .era').nth(0).hover();
  await wait(250);
  await carry.locator('#fig-1 .carry-pick[data-sign="leo"]').click();
  await wait(150);
  const duringPlay = await carry.locator('#fig-1').evaluate((fig) => ({
    tip: getComputedStyle(fig.querySelector('.era__tip')).visibility,
    pressed: fig.querySelector('.carry-pick[data-sign="leo"]').getAttribute('aria-pressed'),
    pick: fig.classList.contains('has-pick'),
  }));
  check('F1 plate: while the entrance plays, hover shows nothing and the picker is off',
    duringPlay.tip === 'hidden' && duringPlay.pressed === 'false' && !duringPlay.pick, JSON.stringify(duringPlay));
  await carry.mouse.move(2, 2);
  await wait(Math.max(0, 6000 - (Date.now() - scrolledAt)));
  const carryAfter = await carryState();
  check('F1 plate: plays once into view, ending on 8 with every form unveiled and all 96 marks lit',
    carryAfter.on && carryAfter.isTwelve && carryAfter.live && carryAfter.count === '8'
      && carryAfter.eras.length === 24 && carryAfter.eras.every((value) => value === 1)
      && carryAfter.marks.length === 96 && carryAfter.marks.every((value) => value === 1)
      && carryAfter.picks.length === 12 && carryAfter.picks.every((value) => value === 1)
      && carryAfter.leads.length === 8 && carryAfter.leads.every((value) => value === 0)
      && carryAfter.axisMarks.length === 8 && carryAfter.axisMarks.every((value) => value === 1),
    JSON.stringify(carryAfter));
  check('F1 plate: the motion never changes the figure height',
    carryBefore.height === carryAfter.height, `${carryBefore.height} vs ${carryAfter.height}`);

  // Each form explains itself on hover or focus, and dims the other forms.
  const tipState = (index) => carry.locator('#fig-1').evaluate((fig, at) => {
    const opacity = (node) => Number.parseFloat(getComputedStyle(node).opacity);
    const tips = [...fig.querySelectorAll('.era__tip')];
    const box = fig.getBoundingClientRect();
    const tip = tips[at].getBoundingClientRect();
    const leads = [...fig.querySelectorAll('svg.carry-axis:not(.carry-axis--mini) .carry-lead')];
    return {
      shown: tips.map((node) => getComputedStyle(node).visibility === 'visible' && opacity(node) === 1),
      inside: tip.left >= box.left && tip.right <= box.right && tip.top >= box.top && tip.bottom <= box.bottom,
      drawings: [...fig.querySelectorAll('.era__object')].map(opacity),
      lead: opacity(leads[at]),
      others: leads.filter((_, i) => i !== at).map(opacity),
    };
  }, index);
  await carry.locator('#fig-1 .era').nth(4).hover();
  await wait(300);
  const hovered = await tipState(4);
  check('1440px: hovering the fifth form shows only its pop-up and dims the other seven',
    hovered.shown.filter(Boolean).length === 1 && hovered.shown[4] && hovered.inside
      && hovered.drawings.every((value, i) => (i === 4 ? value === 1 : Math.abs(value - 0.35) < 0.01))
      && hovered.lead === 1 && hovered.others.every((value) => Math.abs(value - 0.35) < 0.01),
    JSON.stringify(hovered));
  await carry.mouse.move(2, 2);
  await wait(300);
  const away = await tipState(4);
  check('1440px: moving away restores every form',
    away.shown.every((value) => !value) && away.drawings.every((value) => value === 1)
      && away.lead === 1 && away.others.every((value) => value === 1),
    JSON.stringify(away));
  await carry.locator('#fig-1 .era').nth(3).focus();
  await carry.keyboard.press('Tab');
  await wait(300);
  const tabbed = await tipState(4);
  const tabbedFocus = await carry.evaluate(() => document.activeElement?.getAttribute('aria-describedby'));
  await carry.keyboard.press('Escape');
  await wait(300);
  const escaped = await tipState(4);
  check('1440px: Tab to a form shows its pop-up and Escape hides it',
    tabbedFocus === 'carry-tip-4' && tabbed.shown[4] && escaped.shown.every((value) => !value),
    JSON.stringify({ tabbedFocus, tabbed: tabbed.shown, escaped: escaped.shown }));
  await carry.evaluate(() => document.activeElement?.blur());

  // The header icons are a sign picker: the reader's sign is marked in every drawing.
  const pickState = () => carry.evaluate(() => {
    const fig = document.querySelector('#fig-1');
    const me = [...fig.querySelectorAll('.cd.is-me')];
    const other = fig.querySelector('.cd:not(.is-me)');
    const leoDisc = document.querySelector('[data-motion="shelf"] .disc[data-sign="leo"]');
    return {
      pressed: [...fig.querySelectorAll('.carry-pick')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.sign),
      label: fig.querySelector('[data-carry-label]').textContent,
      me: me.length,
      meK: [...new Set(me.map((node) => node.style.getPropertyValue('--k').trim()))],
      perDrawing: [...fig.querySelectorAll('.era')].map((era) => era.querySelectorAll('.cd.is-me').length),
      otherOpacity: other ? Number.parseFloat(getComputedStyle(other).opacity) : null,
      asset: fig.querySelector('.da-word').textContent,
      shelfLeo: !!leoDisc && leoDisc.classList.contains('is-me'),
    };
  });
  await carry.locator('#fig-1 .carry-pick[data-sign="leo"]').click();
  await wait(400);
  const leo = await pickState();
  check('1440px: picking Leo marks Leo in all eight drawings, the trading screen and the shelf plate',
    JSON.stringify(leo.pressed) === '["leo"]' && leo.label === 'Leo in every form.'
      && leo.me === 8 && JSON.stringify(leo.meK) === '["4"]' && leo.perDrawing.every((value) => value === 1)
      && Math.abs(leo.otherOpacity - 0.25) < 0.01 && leo.asset === 'LEO' && leo.shelfLeo,
    JSON.stringify(leo));
  await carry.locator('#fig-1 .carry-pick[data-sign="leo"]').click();
  await wait(400);
  const cleared = await pickState();
  check('1440px: clicking Leo again clears the pick everywhere',
    cleared.pressed.length === 0 && cleared.label === 'The evolution of the zodiac. Pick your sign.'
      && cleared.me === 0 && cleared.otherOpacity === 1 && cleared.asset === 'ARIES' && !cleared.shelfLeo,
    JSON.stringify(cleared));
  await carry.locator('#fig-1 .carry-pick[data-sign="cancer"]').focus();
  await carry.keyboard.press('Tab');
  await carry.keyboard.press('Enter');
  await wait(400);
  const keyed = await pickState();
  await carry.keyboard.press('Enter');
  await wait(400);
  const keyedOff = await pickState();
  check('1440px: Tab to a sign and Enter picks it, Enter again clears it',
    JSON.stringify(keyed.pressed) === '["leo"]' && keyed.me === 8 && keyed.asset === 'LEO'
      && keyedOff.pressed.length === 0 && keyedOff.me === 0 && keyedOff.asset === 'ARIES',
    JSON.stringify({ keyed: keyed.pressed, keyedOff: keyedOff.pressed }));
  await carry.evaluate(() => document.activeElement?.blur());

  for (const width of [1440, 810, 730, 623, 375]) {
    await carry.setViewportSize({ width, height: 900 });
    await wait(200);
    if ([1440, 730, 623].includes(width)) {
      const offsets = await leaderOffsets();
      check(`${width}px: F1 timeline leaders start under their drawings' centres`,
        offsets.length === 8 && offsets.every((value) => value <= 3),
        offsets.map((value) => value.toFixed(2)).join(', '));
    }
    if (width === 375) {
      const axes = await carry.locator('#fig-1').evaluate((fig) => ({
        big: getComputedStyle(fig.querySelector('svg.carry-axis:not(.carry-axis--mini)')).display,
        mini: getComputedStyle(fig.querySelector('svg.carry-axis--mini')).display,
      }));
      check('375px: F1 hides the big axis and shows the small scale strip',
        axes.big === 'none' && axes.mini !== 'none', JSON.stringify(axes));
      const phone = await carry.evaluate(() => {
        const fig = document.querySelector('#fig-1');
        const box = fig.getBoundingClientRect();
        const picks = [...fig.querySelectorAll('.carry-pick')].map((b) => b.getBoundingClientRect());
        const tips = [...fig.querySelectorAll('.era__tip')];
        return {
          rows: new Set(picks.map((r) => Math.round(r.top))).size,
          inside: picks.every((r) => r.left >= box.left && r.right <= box.right),
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          tips: tips.map((t) => getComputedStyle(t).position === 'static' && getComputedStyle(t).visibility === 'visible'
            && Number.parseFloat(getComputedStyle(t).opacity) === 1 && t.getBoundingClientRect().height > 0),
        };
      });
      check('375px: twelve sign buttons in one row inside the plate, every sentence shown as text',
        phone.rows === 1 && phone.inside && !phone.overflow && phone.tips.length === 8 && phone.tips.every(Boolean),
        JSON.stringify(phone));
    }
    await shot(carry, '#fig-1', `thesis-f1-plate-${width}.png`);
  }
  check('no page errors (F1 plate)', carryErrors.length === 0, carryErrors.slice(0, 2).join(' | '));
  await carry.close();

  // The plate is shareable: a stable link, Share and Save image.
  const STABLE = 'https://zodiacs.org/thesis/#zodiac-timeline';
  const linked = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await linked.goto(`${BASE}/thesis/#zodiac-timeline`, { waitUntil: 'networkidle' });
  await wait(600);
  const linkedState = await linked.locator('#fig-1').evaluate((fig) => {
    const box = fig.getBoundingClientRect();
    return {
      inView: box.top < window.innerHeight && box.bottom > 0,
      armed: fig.classList.contains('is-armed'),
      count: fig.querySelector('[data-carry-count]').textContent,
    };
  });
  check('#zodiac-timeline lands on the plate, which shows its finished state at once',
    linkedState.inView && !linkedState.armed && linkedState.count === '8', JSON.stringify(linkedState));
  const saved = await linked.request.get(`${BASE}/assets/thesis/share/evolution-of-the-zodiac.png`);
  check('Save image serves the plate as a PNG',
    saved.status() === 200 && /^image\/png/.test(saved.headers()['content-type'] ?? ''),
    `${saved.status()} ${saved.headers()['content-type']}`);
  const capture = await linked.evaluate(() => {
    document.documentElement.classList.add('is-capture');
    const fig = document.querySelector('#fig-1');
    const shown = (node) => !!node && getComputedStyle(node).display !== 'none' && node.getClientRects().length > 0;
    const state = {
      share: shown(fig.querySelector('.carry-share')),
      save: shown(fig.querySelector('.carry-save')),
      brand: shown(fig.querySelector('.carry-brand')),
    };
    document.documentElement.classList.remove('is-capture');
    return state;
  });
  check('in the share image (is-capture) the controls are hidden and the brand mark is shown',
    !capture.share && !capture.save && capture.brand, JSON.stringify(capture));
  await linked.close();

  const copyContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await copyContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const copyPage = await copyContext.newPage();
  await copyPage.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true }); });
  await copyPage.goto(`${BASE}/thesis/#zodiac-timeline`, { waitUntil: 'networkidle' });
  await copyPage.locator('#fig-1 .carry-share').click();
  await wait(300);
  const copied = await copyPage.evaluate(async () => ({
    clip: await navigator.clipboard.readText(),
    status: document.querySelector('#fig-1 .carry-share-status').textContent,
  }));
  check('Share without a share sheet copies the stable link and says so',
    copied.clip === STABLE && copied.status === 'Link copied.', JSON.stringify(copied));
  await copyContext.close();

  const shareContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const sharePage = await shareContext.newPage();
  await sharePage.addInitScript(() => {
    window.__shared = [];
    Object.defineProperty(Navigator.prototype, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(Navigator.prototype, 'share', {
      value: (data) => {
        window.__shared.push({
          url: data.url, title: data.title, text: data.text,
          files: (data.files ?? []).map((file) => ({ name: file.name, type: file.type, size: file.size })),
        });
        return Promise.resolve();
      },
      configurable: true,
    });
  });
  await sharePage.goto(`${BASE}/thesis/#zodiac-timeline`, { waitUntil: 'networkidle' });
  await sharePage.locator('#fig-1 .carry-share').click();
  await sharePage.waitForFunction(() => window.__shared.length > 0, null, { timeout: 5000 }).catch(() => {});
  const shared = await sharePage.evaluate(() => window.__shared);
  check('Share with a share sheet sends the stable link and one PNG of the plate',
    shared.length === 1 && shared[0].url === STABLE && shared[0].files.length === 1
      && shared[0].files[0].type === 'image/png' && shared[0].files[0].size > 0
      && shared[0].title === 'The evolution of the zodiac',
    JSON.stringify(shared));
  await shareContext.close();

  // The annotated review viewport keeps the full four-column matrix.
  const review = await browser.newPage({ viewport: { width: 810, height: 1054 } });
  const reviewErrors = [];
  review.on('pageerror', (err) => reviewErrors.push(String(err)));
  review.on('requestfailed', (req) => { if (req.url().startsWith('http://127.0.0.1')) reviewErrors.push(req.url()); });
  await review.goto(`${BASE}/thesis/`, { waitUntil: 'networkidle' });
  await checkFigureFit(review, 810);
  await wait(600);
  const reviewOverflow = await review.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth,
  }));
  check('810px: no page-level horizontal overflow', reviewOverflow.doc <= reviewOverflow.win,
    `${reviewOverflow.doc} vs ${reviewOverflow.win}`);
  await checkOwnershipDrawer(review, '810px');
  for (const [name, selector] of VISUAL_MODULES) {
    check(`810px: ${name} is visible`, await isVisuallyExposed(review.locator(selector).first()));
  }
  await shot(review, '#fig-know', 'thesis-know-810.png');
  await shot(review, '#fig-lifespan', 'thesis-lifespan-810.png');
  await shot(review, '#fig-1', 'thesis-f1-810.png');
  await shot(review, '#fig-2', 'thesis-f2-810.png');
  await shot(review, '#fig-3', 'thesis-f3-810.png');
  await shot(review, '#fig-keyboard', 'thesis-keyboard-810.png');
  await shot(review, '#fig-authorities', 'thesis-authorities-810.png');
  await review.locator('#ownership-details > summary').click();
  await shot(review, '#fig-provenance', 'thesis-provenance-810.png');
  await shot(review, '#the-instrument [data-real-use-proof]', 'thesis-proof-810.png');
  await shot(review, GALLERY_SELECTOR, 'thesis-gallery-810.png');
  await shot(review, '#the-public-record', 'thesis-history-810.png');
  await review.locator('details.evidence-vault').evaluate((node) => { node.open = true; });
  await shot(review, '#the-candidacy', 'thesis-v-810.png');
  await shot(review, '#the-test', 'thesis-vii-810.png');
  await shot(review, '#the-instrument', 'thesis-x-810.png');
  check('no page errors or same-origin failures (810px)', reviewErrors.length === 0,
    reviewErrors.slice(0, 2).join(' | '));
  await review.close();

  // Exact browser-comment viewport — F1 remains a single chronology and the
  // newly embedded gallery contains any horizontal movement inside its rail.
  const annotated = await browser.newPage({ viewport: { width: 730, height: 1054 } });
  const annotatedErrors = [];
  annotated.on('pageerror', (err) => annotatedErrors.push(String(err)));
  annotated.on('requestfailed', (req) => {
    if (req.url().startsWith('http://127.0.0.1')) annotatedErrors.push(req.url());
  });
  await annotated.goto(`${BASE}/thesis/`, { waitUntil: 'networkidle' });
  await checkFigureFit(annotated, 730);
  const annotatedGalleryReady = await waitForGalleryReady(annotated);
  await wait(350);
  const annotatedLayout = await annotated.evaluate((selector) => {
    const gallery = document.querySelector(selector);
    const rail = gallery?.querySelector('[data-gallery-rail]');
    const nextSection = document.querySelector('#the-twelve');
    const galleryRect = gallery?.getBoundingClientRect();
    const nextRect = nextSection?.getBoundingClientRect();
    return {
      documentWidth: document.documentElement.scrollWidth,
      galleryBottom: galleryRect?.bottom ?? 0,
      galleryClientWidth: gallery?.clientWidth ?? 0,
      galleryLeft: galleryRect?.left ?? 0,
      galleryRight: galleryRect?.right ?? 0,
      galleryScrollWidth: gallery?.scrollWidth ?? 0,
      nextSectionTop: nextRect?.top ?? 0,
      railClientWidth: rail?.clientWidth ?? 0,
      railScrollWidth: rail?.scrollWidth ?? 0,
      viewportWidth: window.innerWidth,
    };
  }, GALLERY_SELECTOR);
  check('730px: no page-level or gallery-stage horizontal overflow',
    annotatedGalleryReady
      && annotatedLayout.documentWidth <= annotatedLayout.viewportWidth + 1
      && annotatedLayout.galleryLeft >= -1
      && annotatedLayout.galleryRight <= annotatedLayout.viewportWidth + 1
      && annotatedLayout.galleryScrollWidth <= annotatedLayout.galleryClientWidth + 1,
    JSON.stringify({ ready: annotatedGalleryReady, ...annotatedLayout }));
  check('730px: gallery precedes the Twelve Catalogue without overlap',
    annotatedLayout.galleryBottom <= annotatedLayout.nextSectionTop + 1,
    JSON.stringify(annotatedLayout));
  check('730px: gallery rail owns any horizontal scrolling',
    annotatedLayout.railClientWidth > 0
      && annotatedLayout.railScrollWidth >= annotatedLayout.railClientWidth,
    `${annotatedLayout.railScrollWidth} vs ${annotatedLayout.railClientWidth}`);

  const annotatedTransmission = annotated.locator('#fig-1 .transmission');
  await annotatedTransmission.scrollIntoViewIfNeeded();
  await wait(300);
  const annotatedF1 = await annotatedTransmission.evaluate((transmission) => {
    const eras = [...transmission.querySelectorAll('.era')];
    const coin = eras.at(-1)?.querySelectorAll('.era__object svg') ?? [];
    const tops = eras.map((era) => era.offsetTop);
    return {
      coinSvgs: coin.length,
      coinMarks: coin[0]?.querySelectorAll('.cd').length ?? 0,
      coinWidth: coin[0]?.getBoundingClientRect().width ?? 0,
      eras: eras.length,
      oneRow: tops.length > 0 && Math.max(...tops) - Math.min(...tops) <= 2,
      clientWidth: transmission.clientWidth,
      scrollWidth: transmission.scrollWidth,
    };
  });
  check('730px: F1 keeps eight eras on one row with the Digital asset drawing of the twelve',
    annotatedF1.eras === 8
      && annotatedF1.oneRow
      && annotatedF1.coinSvgs === 1
      && annotatedF1.coinMarks === 12
      && annotatedF1.coinWidth > 0
      && annotatedF1.scrollWidth <= annotatedF1.clientWidth + 1,
    JSON.stringify(annotatedF1));
  await shot(annotated, '#fig-1', 'thesis-f1-730.png');
  await shot(annotated, GALLERY_SELECTOR, 'thesis-gallery-730.png');
  check('no page errors or same-origin failures (730px)', annotatedErrors.length === 0,
    annotatedErrors.slice(0, 2).join(' | '));
  await annotated.close();

  // Exact annotated mobile/tablet viewport — the almanac modules should feel
  // compact at 623×1054 without giving up their chronology or structure.
  const compact = await browser.newPage({ viewport: { width: 623, height: 1054 } });
  const compactErrors = [];
  compact.on('pageerror', (err) => compactErrors.push(String(err)));
  compact.on('requestfailed', (req) => {
    if (req.url().startsWith('http://127.0.0.1')) compactErrors.push(req.url());
  });
  await compact.goto(`${BASE}/thesis/`, { waitUntil: 'networkidle' });
  await wait(600);
  const compactPage = await compact.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  check('623px: no page-level horizontal overflow',
    compactPage.documentWidth <= compactPage.viewportWidth + 1,
    `${compactPage.documentWidth} vs ${compactPage.viewportWidth}`);

  const chronology = await compact.locator('#fig-1 .era__time').allTextContents();
  check('623px: transmission retains eight chronological anchors',
    JSON.stringify(chronology.map((value) => value.trim())) === JSON.stringify([
      'c. 450 BCE',
      '150 BCE to 150 CE',
      '850 to 1150 CE',
      'c. 1500',
      '1930',
      '1993',
      'c. 2010',
      '5 Jul 2024',
    ]),
    chronology.join(' · '));

  await setVault(compact, true);
  const compactModules = [
    ['history transmission', '#fig-1 .story-figure', 0.24],
    ['real-use proof', '[data-real-use-proof]', 0.48],
  ];
  for (const [name, selector, maxViewportFraction] of compactModules) {
    const geometry = await compact.locator(selector).first().evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        height: rect.height,
        left: rect.left,
        right: rect.right,
        scrollWidth: node.scrollWidth,
        clientWidth: node.clientWidth,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });
    check(`623px: ${name} stays compact`,
      geometry.height <= geometry.viewportHeight * maxViewportFraction,
      `${geometry.height.toFixed(1)}px / ${(geometry.viewportHeight * maxViewportFraction).toFixed(1)}px cap`);
    check(`623px: ${name} fits without local overflow`,
      geometry.left >= -1
        && geometry.right <= geometry.viewportWidth + 1
        && geometry.scrollWidth <= geometry.clientWidth + 1,
      JSON.stringify(geometry));
  }
  const compactRows = await compact.evaluate(() => {
    const sameRow = (selector) => {
      const tops = [...document.querySelectorAll(selector)].map((node) => node.getBoundingClientRect().top);
      return tops.length > 0 && Math.max(...tops) - Math.min(...tops) <= 2;
    };
    const proofTops = [...document.querySelectorAll('.proof-loop__steps > li')]
      .map((node) => Math.round(node.getBoundingClientRect().top));
    return {
      eras: sameRow('#fig-1 .era'),
      proof: proofTops.length === 3 && new Set(proofTops).size === 2,
    };
  });
  check('623px: compact modules use their intended responsive summaries',
    compactRows.eras && compactRows.proof,
    JSON.stringify(compactRows));
  await shot(compact, '#fig-1', 'thesis-f1-623.png');
  await shot(compact, '#fig-3', 'thesis-f3-623.png');
  await shot(compact, '#the-instrument [data-real-use-proof]', 'thesis-proof-623.png');
  await shot(compact, GALLERY_SELECTOR, 'thesis-gallery-623.png');
  check('no page errors or same-origin failures (623px)', compactErrors.length === 0,
    compactErrors.slice(0, 2).join(' | '));
  await compact.close();

  // No-JavaScript pass — the baked static values must stand on their own.
  const nojsContext = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce' });
  const nojs = await nojsContext.newPage();
  const nojsMedia = [];
  nojs.on('request', (request) => {
    if (new URL(request.url()).pathname === '/assets/art/zodiac-clock.mp4') nojsMedia.push(request.url());
  });
  await nojs.setViewportSize({ width: 1280, height: 1000 });
  await nojs.goto(`${BASE}/thesis/`, { waitUntil: 'domcontentloaded' });
  check('no-JS: zero pending chips', (await nojs.locator('.pending-disclosure').count()) === 0);
  check('no-JS: instrument values baked',
    (await nojs.locator('#the-instrument .disc-val').count()) >= 104);
  check('no-JS: candidacy values baked', (await nojs.locator('#the-candidacy .score .disc-val').count()) === 5);
  check('no-JS: test card baked', /PREREGISTERED/.test(await nojs.locator('.tcard').textContent() ?? ''));
  check('no-JS: last-updated line is dated',
    /Last updated: 20\d{2}-\d{2}-\d{2}/.test(await nojs.locator('[data-disclosure-updated]').textContent() ?? ''));
  const nojsHeroVideo = await nojs.locator('.hero video.hero__media').evaluate((video) => ({
    autoplay: video.hasAttribute('autoplay'),
    paused: video.paused,
  }));
  check('no-JS + reduced motion: ambient hero video stays paused',
    !nojsHeroVideo.autoplay && nojsHeroVideo.paused,
    JSON.stringify(nojsHeroVideo));
  const nojsCollectionLinks = await nojs.locator('a[href="/registry/collection/"]').count();
  check('no-JS: Collection action follows the Registry build marker',
    nojsCollectionLinks === (registryCollectionEnabled ? 1 : 0),
    `marker ${registryCollectionMarker} · ${nojsCollectionLinks} link(s)`);
  check('no-JS: appendix remains collapsed behind Evidence & disclosures',
    !await nojs.locator('#appendix').isVisible()
      && await nojs.locator('details.evidence-vault').getAttribute('open') === null);
  const nojsFallback = nojs.locator(`${GALLERY_SELECTOR} [data-gallery-fallback]`);
  const nojsFallbackState = await nojsFallback.locator('[data-gallery-fallback-record]')
    .evaluateAll((links) => links.map((link) => {
      const image = link.querySelector('img');
      return {
        alt: image?.getAttribute('alt') ?? '',
        href: link.getAttribute('href') ?? '',
        src: image?.getAttribute('src') ?? '',
      };
    }));
  check('no-JS: gallery exposes all twelve linked Zodiac artwork records',
    nojsFallbackState.length === 12 && nojsFallbackState.every((record, index) => {
      const slug = ZODIAC_SLUGS[index];
      const name = `${slug[0].toUpperCase()}${slug.slice(1)}`;
      return record.href === `/registry/${slug}/`
        && record.src === `/assets/nuggets/thumb/${slug}.png`
        && record.alt === `${name} Zodiac artwork`;
    }),
    JSON.stringify(nojsFallbackState));
  check('no-JS: static gallery fallback is visibly exposed', await isVisuallyExposed(nojsFallback));
  await checkOwnershipDrawer(nojs, 'no-JS');
  for (const [name, selector] of VISUAL_MODULES) {
    check(`no-JS: ${name} is visually exposed`, await isVisuallyExposed(nojs.locator(selector).first()));
  }
  await shot(nojs, GALLERY_SELECTOR, 'thesis-gallery-nojs.png');
  check('no-JS never downloads the ambient loop', nojsMedia.length === 0, JSON.stringify(nojsMedia));
  await nojsContext.close();

  // Reduced motion shows final states without transitions or transforms.
  const reducedContext = await browser.newContext({ reducedMotion: 'reduce' });
  const reduced = await reducedContext.newPage();
  const reducedMedia = [];
  reduced.on('request', (request) => {
    if (new URL(request.url()).pathname === '/assets/art/zodiac-clock.mp4') reducedMedia.push(request.url());
  });
  await reduced.setViewportSize({ width: 1280, height: 1000 });
  await reduced.goto(`${BASE}/thesis/`, { waitUntil: 'networkidle' });
  await wait(600);
  const reducedHeroVideo = await reduced.locator('.hero video.hero__media').evaluate((video) => ({
    autoplay: video.hasAttribute('autoplay'),
    paused: video.paused,
  }));
  check('reduced motion: ambient hero video is paused',
    !reducedHeroVideo.autoplay && reducedHeroVideo.paused,
    JSON.stringify(reducedHeroVideo));
  const reducedGalleryReady = await waitForGalleryReady(reduced);
  // The fallback's short cross-fade is allowed even under reduced motion;
  // sample after it has settled so this detects continuing movement.
  await wait(400);
  const reducedGalleryState = await reduced.locator(GALLERY_SELECTOR).evaluate((gallery) => ({
    activeAnimations: gallery.getAnimations({ subtree: true })
      .filter((animation) => animation.playState === 'running').length,
    bandTransition: getComputedStyle(gallery).transitionDuration,
    mediaMatches: matchMedia('(prefers-reduced-motion: reduce)').matches,
    pictureTransforms: [...gallery.querySelectorAll('[data-gallery-rail] picture')]
      .map((picture) => getComputedStyle(picture).transform),
    ready: gallery.classList.contains('is-ready'),
  }));
  check('reduced motion: gallery settles without scaling or active animation',
    reducedGalleryReady
      && reducedGalleryState.ready
      && reducedGalleryState.mediaMatches
      && reducedGalleryState.activeAnimations === 0
      && reducedGalleryState.bandTransition.split(',')
        .every((duration) => Number.parseFloat(duration) === 0)
      && reducedGalleryState.pictureTransforms.length === 12
      && reducedGalleryState.pictureTransforms.every((transform) => transform === 'none'),
    JSON.stringify(reducedGalleryState));
  const reducedStates = await reduced.locator('.reveal, [data-visual-reveal], [data-almanac-reveal], [data-visual-reveal] > *, [data-almanac-reveal] > *').evaluateAll((nodes) => nodes.map((node) => {
    const style = getComputedStyle(node);
    return {
      opacity: Number.parseFloat(style.opacity),
      transform: style.transform,
      transition: style.transitionDuration,
      animation: style.animationName,
    };
  }));
  check('reduced motion: reveal targets render in their final state',
    reducedStates.length > 0 && reducedStates.every((state) => state.opacity > 0.99 && state.transform === 'none'),
    JSON.stringify(reducedStates.find((state) => state.opacity <= 0.99 || state.transform !== 'none') ?? ''));
  check('reduced motion: reveal targets have no active transitions or animations',
    reducedStates.every((state) => state.transition.split(',').every((duration) => Number.parseFloat(duration) === 0)
      && state.animation === 'none'));
  const reducedCarry = await reduced.locator('#fig-1').evaluate((fig) => ({
    armed: fig.classList.contains('is-armed'),
    count: fig.querySelector('[data-carry-count]')?.textContent ?? '',
    opacities: [...fig.querySelectorAll('.era > :not(.era__tip), .carry-pick')].map((node) => Number.parseFloat(getComputedStyle(node).opacity)),
    marks: [...fig.querySelectorAll('.cd')].map((node) => Number.parseFloat(getComputedStyle(node).opacity)),
    axis: [...fig.querySelectorAll('.carry-mark, .carry-tick, .carry-note')].map((node) => Number.parseFloat(getComputedStyle(node).opacity)),
    leads: [...fig.querySelectorAll('.carry-lead')].map((node) => getComputedStyle(node).strokeDasharray),
    line: [...fig.querySelectorAll('.carry-line')].map((node) => getComputedStyle(node).transform),
  }));
  check('reduced motion: F1 plate shows its finished state, unarmed, count 8, all 96 marks',
    !reducedCarry.armed && reducedCarry.count === '8'
      && reducedCarry.opacities.length === 36 && reducedCarry.opacities.every((value) => value === 1)
      && reducedCarry.marks.length === 96 && reducedCarry.marks.every((value) => value === 1)
      && reducedCarry.axis.length === 44 && reducedCarry.axis.every((value) => value === 1)
      && reducedCarry.leads.length === 8 && reducedCarry.leads.every((value) => value === 'none')
      && reducedCarry.line.length === 2 && reducedCarry.line.every((value) => value === 'none'),
    JSON.stringify(reducedCarry));
  await reduced.locator('#fig-1 .era').nth(4).hover();
  const reducedTip = await reduced.locator('#fig-1 .era__tip').nth(4).evaluate((tip) => ({
    visibility: getComputedStyle(tip).visibility,
    opacity: getComputedStyle(tip).opacity,
    durations: getComputedStyle(tip).transitionDuration,
  }));
  check('reduced motion: an F1 pop-up appears at once, with no transition',
    reducedTip.visibility === 'visible' && reducedTip.opacity === '1'
      && reducedTip.durations.split(',').every((value) => Number.parseFloat(value) === 0),
    JSON.stringify(reducedTip));
  await reduced.mouse.move(2, 2);
  await checkOwnershipDrawer(reduced, 'reduced motion');
  for (const [name, selector] of VISUAL_MODULES) {
    check(`reduced motion: ${name} is visually exposed`, await isVisuallyExposed(reduced.locator(selector).first()));
  }
  check('reduced motion never downloads the ambient loop', reducedMedia.length === 0, JSON.stringify(reducedMedia));
  await reducedContext.close();

  // A preference change after load must stop the ambient video immediately.
  const changingMotionContext = await browser.newContext({ reducedMotion: 'no-preference' });
  const changingMotion = await changingMotionContext.newPage();
  await changingMotion.goto(`${BASE}/thesis/`, { waitUntil: 'networkidle' });
  const changingHeroVideo = changingMotion.locator('.hero video.hero__media');
  await wait(350);
  const beforeMotionChange = await changingHeroVideo.evaluate((video) => ({ paused: video.paused, currentTime: video.currentTime }));
  await changingMotion.emulateMedia({ reducedMotion: 'reduce' });
  await wait(150);
  const afterMotionChange = await changingHeroVideo.evaluate((video) => ({ paused: video.paused, currentTime: video.currentTime }));
  check('runtime reduced-motion change pauses the ambient hero video',
    !beforeMotionChange.paused && afterMotionChange.paused,
    JSON.stringify({ before: beforeMotionChange, after: afterMotionChange }));
  await changingMotionContext.close();

  // Small-viewport passes — illustrated modules and charts never scroll sideways.
  for (const width of [375, 390]) {
    const mob = await browser.newPage({ viewport: { width, height: 812 }, deviceScaleFactor: 2, hasTouch: true });
    const mobErrors = [];
    mob.on('pageerror', (err) => mobErrors.push(String(err)));
    mob.on('requestfailed', (req) => { if (req.url().startsWith('http://127.0.0.1')) mobErrors.push(req.url()); });
    await mob.goto(`${BASE}/thesis/`, { waitUntil: 'networkidle' });
    await checkFigureFit(mob, width);
    await wait(600);
    const heroRibbon = await mob.locator('.hero__twelve').evaluate((row) => {
      const links = [...row.querySelectorAll('a')];
      return {
        count: links.length,
        rows: new Set(links.map((link) => link.getBoundingClientRect().top.toFixed(1))).size,
        scroll: row.scrollWidth,
        client: row.clientWidth,
      };
    });
    check(`${width}px: all twelve hero icons stay on one row`,
      heroRibbon.count === 12 && heroRibbon.rows === 1 && heroRibbon.scroll <= heroRibbon.client + 1,
      JSON.stringify(heroRibbon));
    const overflow = await mob.evaluate(() => ({
      doc: document.documentElement.scrollWidth, win: window.innerWidth,
    }));
    check(`${width}px: no page-level horizontal overflow`, overflow.doc <= overflow.win, `${overflow.doc} vs ${overflow.win}`);
    await mob.locator('details.evidence-vault').evaluate((node) => { node.open = true; });
    await mob.locator('#the-instrument details.evidence-drawer:not(#ownership-details)').evaluate((n) => { n.open = true; });
    const discScroll = await mob.locator('.disc-scroll').evaluate((n) => n.scrollWidth > n.clientWidth);
    check(`${width}px: disclosure table scrolls inside its own region`, discScroll);
    await checkOwnershipDrawer(mob, `${width}px`);
    for (const [name, selector] of VISUAL_MODULES) {
      const nodes = mob.locator(selector);
      const fits = await nodes.evaluateAll((elements, viewportWidth) => elements.length > 0 && elements.every((node) => {
        const rect = node.getBoundingClientRect();
        return rect.left >= -1 && rect.right <= viewportWidth + 1 && node.scrollWidth <= node.clientWidth + 1;
      }), width);
      check(`${width}px: ${name} fits without local overflow`, fits);
    }
    if (width === 375) {
      await shot(mob, '#fig-know', 'thesis-know-mobile.png');
      await shot(mob, '#fig-lifespan', 'thesis-lifespan-mobile.png');
      await shot(mob, '#fig-1', 'thesis-f1-mobile.png');
      await shot(mob, '#fig-2', 'thesis-f2-mobile.png');
      await shot(mob, '#fig-3', 'thesis-f3-mobile.png');
      for (const id of ['everyone-has-a-sign', 'where-the-signs-come-from', 'attention', 'what-holding-means', 'the-public-record', 'the-conclusion']) {
        await shot(mob, `#${id}`, `thesis-${id}-mobile.png`);
      }
      await shot(mob, '#fig-keyboard', 'thesis-keyboard-mobile.png');
      await shot(mob, '#fig-authorities', 'thesis-authorities-mobile.png');
      await mob.locator('#ownership-details > summary').click();
      await shot(mob, '#fig-provenance', 'thesis-provenance-mobile.png');
      await shot(mob, '#the-instrument [data-real-use-proof]', 'thesis-proof-mobile.png');
      await shot(mob, GALLERY_SELECTOR, 'thesis-gallery-mobile.png');
      await shot(mob, '#the-public-record', 'thesis-history-mobile.png');
      await mob.locator('#the-candidacy').scrollIntoViewIfNeeded();
      await shot(mob, '#the-candidacy', 'thesis-v-mobile.png');
      await shot(mob, '#the-test', 'thesis-vii-mobile.png');
      await shot(mob, '#the-case-against', 'thesis-ix-mobile.png');
      await shot(mob, '#the-instrument', 'thesis-x-mobile.png');
    } else {
      await shot(mob, '#the-instrument', 'thesis-x-390.png');
    }
    check(`no page errors or same-origin failures (${width}px)`, mobErrors.length === 0, mobErrors.slice(0, 2).join(' | '));
    await mob.close();
  }
  // Hold the real font requests to exercise the first layout with fallbacks,
  // then release them without modifying production styles or metric gates.
  for (const width of [390, 412, 810, 1440]) {
    const cold = await browser.newContext({ viewport: { width, height: 900 } });
    let releaseFonts;
    const fontGate = new Promise((resolve) => { releaseFonts = resolve; });
    await cold.route('**/fonts/*.woff2', async (route) => {
      await fontGate;
      await route.continue();
    });
    const coldPage = await cold.newPage();
    try {
      await coldPage.goto(`${BASE}/thesis/`, { waitUntil: 'domcontentloaded' });
      await coldPage.waitForTimeout(150);
      const beforeFonts = await coldPage.evaluate(() => ({
        top: document.querySelector('.essay__body').getBoundingClientRect().top,
        labels: [...document.querySelectorAll('.essay__rail .label')].map((node) => ({
          height: node.getBoundingClientRect().height,
          lineHeight: getComputedStyle(node).lineHeight,
        })),
        fontLoaded: document.fonts.check('500 9.5px "EB Garamond"'),
      }));
      releaseFonts();
      await coldPage.evaluate(async () => {
        await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      const afterFonts = await coldPage.evaluate(() => ({
        top: document.querySelector('.essay__body').getBoundingClientRect().top,
        fontLoaded: document.fonts.check('500 9.5px "EB Garamond"'),
      }));
      check(`${width}px: essay start stays fixed across real font loading`,
        !beforeFonts.fontLoaded && afterFonts.fontLoaded
          && Math.abs(beforeFonts.top - afterFonts.top) <= 0.01,
        JSON.stringify({ beforeFonts, afterFonts }));
    } finally {
      releaseFonts();
      await cold.close();
    }
  }
  await browser.close();
} finally {
  await preview.stop();
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  · ${r.ok ? r.detail.slice(0, 80) : r.detail}` : ''}`);
}
console.log(failed ? `\n${results.length - failed} PASSED · ${failed} FAILED` : `\nALL PASS · ${results.length} checks`);
process.exit(failed ? 1 : 0);
