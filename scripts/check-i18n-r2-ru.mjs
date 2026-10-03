import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RU_OG_ROUTE_CARDS } from '../src/strings/seo.ru.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(repo, 'dist');
const failures = [];
const fail = (message) => failures.push(message);

const signs = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const core = [
  '/', '/tools/', '/birth-chart/', '/compatibility/', '/moon-sign/',
  '/rising-sign/', '/moon-phase/', '/saturn-return/', '/transits/',
  '/baby-zodiac/', '/profile/', '/methodology/', '/privacy/', '/disclosure/',
  '/big-three/', '/compatibility/invite/', '/group-charts/', '/chart-twins/',
  ...signs.map((sign) => `/${sign}/`),
];
const signPaths = new Set(signs.map((sign) => `/${sign}/`));
const indexedRoutes = core.filter((path) => !signPaths.has(path)).map((path) => `/ru${path}`);
const noindexSignRoutes = new Set(signs.map((sign) => `/ru/${sign}/`));
const notFoundRoute = '/ru/404/';
const expectedRoutes = [...indexedRoutes, ...noindexSignRoutes, notFoundRoute];
const expectedFiles = new Map(expectedRoutes.map((route) => [
  route,
  resolve(dist, route.replace(/^\//, ''), 'index.html'),
]));
const expectedHreflangs = ['en', 'es', 'pt-BR', 'fr', 'it', 'ru', 'x-default'];
const structuredImageRoutes = new Set([
  '/ru/birth-chart/', '/ru/compatibility/', '/ru/moon-sign/',
  '/ru/rising-sign/', '/ru/moon-phase/', '/ru/saturn-return/',
  '/ru/transits/', '/ru/baby-zodiac/', '/ru/methodology/',
  ...signs.map((sign) => `/ru/${sign}/`),
]);
const publicLocaleCards = [
  { prefix: '', ogLocale: 'en_US' },
  { prefix: '/es', ogLocale: 'es_LA' },
  { prefix: '/pt', ogLocale: 'pt_BR' },
  { prefix: '/fr', ogLocale: 'fr_FR' },
  { prefix: '/it', ogLocale: 'it_IT' },
  { prefix: '/ru', ogLocale: 'ru_RU' },
];

function attr(tag, name) {
  return tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i'))?.slice(1).find(Boolean) ?? null;
}

function headAlternates(html) {
  return [...html.matchAll(/<link\b[^>]*>/giu)]
    .map((match) => match[0])
    .filter((tag) => attr(tag, 'rel')?.toLowerCase().split(/\s+/u).includes('alternate'))
    .flatMap((tag) => {
      const hreflang = attr(tag, 'hreflang');
      return hreflang ? [[hreflang, attr(tag, 'href')]] : [];
    });
}

function canonicalHref(html) {
  const tag = [...html.matchAll(/<link\b[^>]*>/giu)]
    .map((match) => match[0])
    .find((candidate) => attr(candidate, 'rel')?.toLowerCase().split(/\s+/u).includes('canonical'));
  return tag ? attr(tag, 'href') : null;
}

function metaContent(html, name) {
  const tag = [...html.matchAll(/<meta\b[^>]*>/giu)]
    .map((match) => match[0])
    .find((candidate) => attr(candidate, 'name')?.toLowerCase() === name.toLowerCase());
  return tag ? attr(tag, 'content') : null;
}

function propertyMetaContents(html, property) {
  return [...html.matchAll(/<meta\b[^>]*>/giu)]
    .map((match) => match[0])
    .filter((tag) => attr(tag, 'property')?.toLowerCase() === property.toLowerCase())
    .flatMap((tag) => {
      const content = attr(tag, 'content');
      return content ? [content] : [];
    });
}

function ogImage(html) {
  const tag = [...html.matchAll(/<meta\b[^>]*>/giu)]
    .map((match) => match[0])
    .find((candidate) => attr(candidate, 'property')?.toLowerCase() === 'og:image');
  return tag ? attr(tag, 'content') : null;
}

function jsonLdImages(html) {
  const images = [];
  const walk = (value) => {
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (typeof value.image === 'string') images.push(value.image);
    Object.values(value).forEach(walk);
  };
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu)) {
    try {
      walk(JSON.parse(match[1]));
    } catch {
      fail('Russian route contains invalid JSON-LD');
    }
  }
  return images;
}

function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/giu, ' ')
    .replace(/<svg\b[\s\S]*?<\/svg>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&(?:nbsp|amp|quot|#39|lt|gt);/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

const englishLeakPhrases = [
  'Free birth chart', 'Get your free birth chart', 'Birth date', 'Birth time',
  'Birthplace', 'House system', 'Saved charts', 'Open menu', 'Close menu',
  'The twelve signs', 'Start with your chart', 'Compatibility calculator',
  'Moon sign calculator', 'Rising sign calculator', 'Check your transits',
  'Your profile', 'Privacy policy', 'How we calculate', 'Page not found',
  'This page does not exist', 'Read the pair',
];
const publicCorePaths = new Set(core.filter((path) => path !== '/'));

function hasSilentEnglishCoreLink(html) {
  const anchors = html.matchAll(/<a\b([^>]*?)\bhref=(["'])(.*?)\2([^>]*)>([\s\S]*?)<\/a>/giu);
  for (const match of anchors) {
    const href = match[3].replace(/^https:\/\/zodiacs\.org/u, '').split(/[?#]/u, 1)[0];
    if (!publicCorePaths.has(href)) continue;
    const attrs = `${match[1]} ${match[4]}`;
    const visiblyMarked = /пока по-английски/u.test(match[5]);
    const languageChoice = /\bhreflang=["']en["']/u.test(attrs) && /\blang=["']en["']/u.test(attrs);
    const explained = /Материал пока доступен по-английски/u.test(attrs);
    if (!languageChoice && !visiblyMarked && !explained) return true;
  }
  return false;
}

const htmlFiles = (await readdir(dist, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
  .map((entry) => resolve(entry.parentPath, entry.name));
const russianFiles = htmlFiles.filter((file) => {
  const rel = relative(dist, file);
  return rel === `ru${sep}index.html` || rel.startsWith(`ru${sep}`);
});

for (const [route, file] of expectedFiles) {
  try {
    await stat(file);
  } catch {
    fail(`${route}: expected Russian route is missing`);
  }
}
if (russianFiles.length !== expectedRoutes.length) {
  fail(`Russian release has ${russianFiles.length} HTML files; expected exactly ${expectedRoutes.length}`);
}

for (const [route, file] of expectedFiles) {
  let html;
  try {
    html = await readFile(file, 'utf8');
  } catch {
    continue;
  }
  const text = visibleText(html);
  const noindex = route === notFoundRoute || noindexSignRoutes.has(route);
  if (!/<html\b[^>]*\blang=["']ru["']/u.test(html)) fail(`${route}: html lang is not ru`);
  if (/<html\b[^>]*\bdir=/u.test(html)) fail(`${route}: Russian LTR page must not emit dir`);
  const robots = metaContent(html, 'robots');
  const expectedRobots = noindex
    ? 'noindex, follow, max-image-preview:large'
    : 'max-image-preview:large';
  if (robots !== expectedRobots) fail(`${route}: robots is ${robots ?? 'missing'}; expected ${expectedRobots}`);
  if (canonicalHref(html) !== `https://zodiacs.org${route}`) fail(`${route}: canonical is not self-referential`);

  const alternates = headAlternates(html);
  const languages = alternates.map(([hreflang]) => hreflang);
  if (JSON.stringify(languages) !== JSON.stringify(noindex ? [] : expectedHreflangs)) {
    fail(`${route}: hreflangs are ${languages.join(',') || 'none'}`);
  }
  if (!noindex) {
    const english = route === '/ru/' ? '/' : route.slice('/ru'.length);
    const xDefault = alternates.find(([hreflang]) => hreflang === 'x-default')?.[1];
    if (xDefault !== `https://zodiacs.org${english}`) fail(`${route}: x-default does not point to English`);
  }

  if (!/<meta\b[^>]*property=["']og:locale["'][^>]*content=["']ru_RU["']/u.test(html)) {
    fail(`${route}: Russian Open Graph locale is missing`);
  }
  const expectedCard = RU_OG_ROUTE_CARDS[route];
  const expectedImage = expectedCard
    ? `https://zodiacs.org/assets/og/v2/ru/${expectedCard}`
    : null;
  const image = ogImage(html);
  const twitterImage = metaContent(html, 'twitter:image');
  if (!expectedImage || image !== expectedImage) {
    fail(`${route}: Open Graph image is ${image ?? 'none'}; expected ${expectedImage ?? 'a mapped Russian card'}`);
  }
  if (!expectedImage || twitterImage !== expectedImage) {
    fail(`${route}: Twitter image is ${twitterImage ?? 'none'}; expected ${expectedImage ?? 'a mapped Russian card'}`);
  }
  const structuredImages = jsonLdImages(html);
  if (structuredImageRoutes.has(route)
      && (structuredImages.length !== 1 || structuredImages[0] !== expectedImage)) {
    fail(`${route}: structured-data image does not equal the mapped Russian card`);
  }
  if (structuredImages.some((value) => value !== expectedImage)) {
    fail(`${route}: structured data references a non-Russian card`);
  }
  if (!expectedImage) {
    fail(`${route}: Russian card mapping is missing`);
  } else {
    try {
      await stat(resolve(dist, new URL(expectedImage).pathname.replace(/^\//, '')));
    } catch {
      fail(`${route}: localized card does not resolve (${expectedImage})`);
    }
  }

  const selectorEntries = (html.match(/class="zfooter__locale"/gu) ?? []).length;
  if (selectorEntries !== 6 || !/Русский/u.test(html) || /العربية/u.test(html)) {
    fail(`${route}: language selector is not the exact six-locale public set`);
  }
  if (/href=["'](?:https:\/\/zodiacs\.org)?\/ar(?:\/|["'#?])/u.test(html)) {
    fail(`${route}: Arabic route leaked into Russian release`);
  }
  if (hasSilentEnglishCoreLink(html)) fail(`${route}: a Russian core-page link silently points to English`);
  for (const phrase of englishLeakPhrases) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) fail(`${route}: English interface phrase leaked — ${phrase}`);
  }
  const cyrillic = (text.match(/[А-Яа-яЁё]/gu) ?? []).length;
  const latin = (text.match(/[A-Za-z]/gu) ?? []).length;
  if (cyrillic < 80 || cyrillic / Math.max(1, cyrillic + latin) < 0.58) {
    fail(`${route}: visible copy is not predominantly Russian (${cyrillic} Cyrillic / ${latin} Latin letters)`);
  }
}

for (const contentPath of core) {
  const discoveryLocaleCards = signPaths.has(contentPath)
    ? publicLocaleCards.filter((entry) => entry.prefix !== '/ru')
    : publicLocaleCards;
  for (const locale of publicLocaleCards) {
    const route = `${locale.prefix}${contentPath}` || '/';
    const file = resolve(dist, route === '/' ? 'index.html' : `${route.replace(/^\//u, '')}index.html`);
    let html;
    try {
      html = await readFile(file, 'utf8');
    } catch {
      fail(`${route}: public locale route is missing for Open Graph reciprocity`);
      continue;
    }
    const self = propertyMetaContents(html, 'og:locale');
    const alternates = propertyMetaContents(html, 'og:locale:alternate');
    const expectedAlternates = signPaths.has(contentPath) && locale.prefix === '/ru'
      ? []
      : discoveryLocaleCards
        .filter((entry) => entry.ogLocale !== locale.ogLocale)
        .map((entry) => entry.ogLocale);
    if (JSON.stringify(self) !== JSON.stringify([locale.ogLocale])) {
      fail(`${route}: Open Graph locale is ${self.join(',') || 'missing'}; expected ${locale.ogLocale}`);
    }
    if (JSON.stringify(alternates) !== JSON.stringify(expectedAlternates)) {
      fail(`${route}: Open Graph locale alternates are ${alternates.join(',') || 'none'}`);
    }
  }
}

const sitemap = await readFile(resolve(dist, 'sitemap.xml'), 'utf8');
const russianSitemapRoutes = [...sitemap.matchAll(/<loc>https:\/\/zodiacs\.org(\/ru\/[^<]*)<\/loc>/gu)]
  .map((match) => match[1]);
if (JSON.stringify([...russianSitemapRoutes].sort()) !== JSON.stringify([...indexedRoutes].sort())) {
  fail(`sitemap.xml has ${russianSitemapRoutes.length}/${indexedRoutes.length} exact indexable Russian core routes`);
}
if (sitemap.includes('/ru/404/')) fail('sitemap.xml contains the noindex Russian 404');

const search = JSON.parse(await readFile(resolve(dist, 'search-index.json'), 'utf8'));
if (search.some((entry) => typeof entry?.path === 'string' && (entry.path === '/ru/' || entry.path.startsWith('/ru/')))) {
  fail('search-index.json contains a Russian route even though localized search is deferred');
}

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  if (/href=["'](?:https:\/\/zodiacs\.org)?\/ar(?:\/|["'#?])/u.test(html)
      || /hreflang=["']ar["']/u.test(html)
      || /العربية/u.test(html)) {
    fail(`${relative(dist, file)}: absent Arabic locale leaked into rendered output`);
  }
}

const fontFiles = [
  'golos-text-cyr-a.woff2', 'golos-text-cyr-b.woff2',
  'eb-garamond-cyrillic-500-normal.woff2', 'jetbrains-mono-cyrillic-400-500.woff2',
];
let heroPosterBytes = 0;
let mobileHeroPosterBytes = 0;
try {
  heroPosterBytes = (await stat(resolve(repo, 'public/assets/hero/zodiacs-hero-poster-ru.avif'))).size;
  if (heroPosterBytes > 48 * 1024) {
    fail(`Russian homepage poster is ${heroPosterBytes} bytes; budget is 49152`);
  }
  mobileHeroPosterBytes = (await stat(resolve(repo, 'public/assets/hero/zodiacs-hero-poster-ru-mobile.avif'))).size;
  if (mobileHeroPosterBytes > 33 * 1024) {
    fail(`Russian mobile homepage poster is ${mobileHeroPosterBytes} bytes; budget is 33792`);
  }
} catch {
  fail('Russian homepage poster or mobile derivative is missing');
}
let fontBytes = 0;
for (const name of fontFiles) {
  try {
    fontBytes += (await stat(resolve(repo, 'public/fonts', name))).size;
  } catch {
    fail(`Russian font is missing: ${name}`);
  }
}
if (fontBytes > 80 * 1024) fail(`Russian font payload is ${fontBytes} bytes; budget is 81920`);
for (const license of ['OFL-golos-text.txt', 'OFL-eb-garamond.txt', 'OFL-jetbrains-mono.txt']) {
  try {
    const value = await readFile(resolve(repo, 'public/fonts', license), 'utf8');
    if (!value.includes('SIL OPEN FONT LICENSE Version 1.1')) fail(`${license}: incomplete OFL text`);
  } catch {
    fail(`Russian font license is missing: ${license}`);
  }
}

if (failures.length) {
  console.error(`i18n-r2-ru: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`i18n-r2-ru: OK — 18 indexable routes + 12 noindex sign guides + noindex 404, reciprocal discovery, ${fontBytes} font bytes, ${heroPosterBytes}/${mobileHeroPosterBytes} byte desktop/mobile homepage posters`);
