/*
 * Generates the new wing's Open Graph share cards in the Cosmic Void
 * system — 1200×630 PNGs under public/assets/og/v2/:
 *
 *   share.png              site-wide default
 *   fomo.png               /fomo/, Astrofolio on the Fomo app
 *   sign/{slug}.png        the 12 sign guides
 *   registry/{slug}.png    the 12 Registry lots (Nº / Lot convention)
 *   registry.png           Registry landing page
 *   thesis.png             Registry thesis
 *   disclosure.png         Registry disclosure
 *   tool/{key}.png         calculators + hubs
 *   pair/{a}-{b}.png       all 78 compatibility pairings
 *   horoscope/{slug}[-{surface}].png  unique daily-through-yearly cards
 *   placements/{planet}.png  one per planet, shared by its 12 placement pages
 *   rising/{slug}.png      the 12 rising-sign profiles
 *   almanac/{slug}.png     the Almanac hub + published articles
 *   ru/{...}.png           the bounded 31-route Russian release set
 *
 * The legacy gilt cards at assets/og/*.png stay byte-identical — the
 * frozen originals remain available. This script never touches those files
 * or any HTML owned by the wing generators.
 *
 *   npm run data:og
 *   npm run data:og -- --only-horoscopes  # refresh the horoscope family
 *   npm run data:og -- --only-homepage    # refresh the cache-busted homepage card
 *   npm run data:og -- --only-wing        # refresh the shared Astrofolio / Terminal card
 *   npm run data:og -- --only-sharing-ru # refresh the four Russian sharing cards
 *   npm run data:og -- --only-fomo        # refresh the /fomo/ card
 *   npm run data:og -- --review-people-identities # three A20 candidates, artifacts only
 *
 * Deterministic and offline: fonts and disc art are inlined as data:
 * URIs; Chromium comes from playwright-core (PLAYWRIGHT_MODULE and
 * CHROMIUM_PATH override module and binary).
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import {
  fileSha256, peopleIdentityReviewOptions, peopleFactReviewOptions, productionOgHashes, reviewedPeople, reviewedFactPeople,
} from './people-identity-og-review.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Parse before any output directory or browser is created. Review mode never
// writes production cards or manifests, including the separate wing family.
const peopleFactReview = peopleFactReviewOptions(process.argv.slice(2), root);
const peopleIdentityReview = peopleFactReview ?? peopleIdentityReviewOptions(process.argv.slice(2), root);
const OUT = peopleIdentityReview?.output ?? resolve(root, 'public/assets/og/v2');
const HOMEPAGE_CARD = 'share-pastel-wheel-20260809.png';

// Import-free, test-pinned projection of the canonical sign table. The live
// signs module now has runtime imports, while this generator must stay plain
// Node, deterministic, and offline.
const {
  OG_SIGNS: SIGNS,
  OG_ELEMENT_LABEL: ELEMENT_LABEL,
  OG_MODALITY_LABEL: MODALITY_LABEL,
} = await import(pathToFileURL(resolve(root, 'src/strings/seo.signs.mjs')).href);
const { HOROSCOPE_OG_SURFACES, OG_EN } = await import(
  pathToFileURL(resolve(root, 'src/strings/seo.en.mjs')).href
);
const WING_OUT = resolve(root, 'public/assets/og/v5');
// The immutable v5 card is retained as historical output. Astrofolio and
// Terminal now have distinct v6-era identities built by the dedicated
// Astrofolio identity generator.
const WING_CARD = 'the-twelve.png';
const LEGACY_REGISTRY_CARD_COPY = Object.freeze({
  kicker: 'The Official Registry',
  title: 'Twelve signs. One register.',
  subtitle: 'A read-only catalogue of the twelve official Zodiac records.',
  data: 'Nº 01–12 / 12 · read-only by design',
});
const {
  RU_OG_COPY_DIGEST_INPUT,
  RU_OG_REQUIRED_CARDS,
  RU_OG_ROUTE_CARDS,
  RU_OG_ROUTES,
} = await import(pathToFileURL(resolve(root, 'src/strings/seo.ru.mjs')).href);
const EVENTS_PUBLICATION = JSON.parse(
  await readFile(resolve(root, 'src/data/events-publication.json'), 'utf8'),
);
const peopleSource = await readFile(resolve(root, 'src/data/people.json'), 'utf8');
const PEOPLE_PILOT = JSON.parse(peopleSource).people;
const identityReviewPeople = peopleFactReview ? reviewedFactPeople(PEOPLE_PILOT)
  : peopleIdentityReview ? reviewedPeople(PEOPLE_PILOT) : null;
const productionOgBefore = peopleIdentityReview ? await productionOgHashes(root) : null;
const identityReviewSources = {};
if (peopleIdentityReview) {
  const sourcePaths = [
    'src/data/people.json', 'scripts/build-og-void.mjs', 'package-lock.json',
    'scripts/people-identity-og-review.mjs', 'tests/visual/browser.mjs',
    'docs/phase5/people-pilot/tools/principal-identities.mjs', 'src/strings/seo.signs.mjs',
    'docs/phase5/people-pilot/source-reviews.json', 'docs/phase5/people-pilot/tools/source-reviews.mjs',
    'public/fonts/eb-garamond-latin-500-normal.woff2',
    'public/fonts/eb-garamond-latin-400-italic.woff2',
    'public/fonts/instrument-sans-latin-wght-normal.woff2',
    'public/fonts/jetbrains-mono-latin-wght-normal.woff2',
    ...new Set(identityReviewPeople.map((person) => `public/assets/zodiac-icons/128/${person.sunSign.slug}.webp`)),
  ];
  for (const path of sourcePaths) identityReviewSources[path] = await fileSha256(resolve(root, path));
  if (identityReviewSources['src/data/people.json'] !== createHash('sha256').update(peopleSource).digest('hex')) {
    throw new Error('People data changed while preparing the review');
  }
}

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const executablePath =
  process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

// ── Inlined assets ────────────────────────────────────────────────────
const b64 = async (path, mime) =>
  `data:${mime};base64,${(await readFile(resolve(root, path))).toString('base64')}`;

const FONTS = {
  serif500: await b64('public/fonts/eb-garamond-latin-500-normal.woff2', 'font/woff2'),
  serifItalic: await b64('public/fonts/eb-garamond-latin-400-italic.woff2', 'font/woff2'),
  sans: await b64('public/fonts/instrument-sans-latin-wght-normal.woff2', 'font/woff2'),
  mono: await b64('public/fonts/jetbrains-mono-latin-wght-normal.woff2', 'font/woff2'),
  ruSerif: await b64('public/fonts/eb-garamond-cyrillic-500-normal.woff2', 'font/woff2'),
  ruSansA: await b64('public/fonts/golos-text-cyr-a.woff2', 'font/woff2'),
  ruSansB: await b64('public/fonts/golos-text-cyr-b.woff2', 'font/woff2'),
  ruMono: await b64('public/fonts/jetbrains-mono-cyrillic-400-500.woff2', 'font/woff2'),
};

const DISCS = {};
for (const s of SIGNS) {
  // The public 128px WebP tier is the canonical art primitive for every new
  // surface. It is deliberately scaled by the card rather than substituted
  // with a glyph, emoji, hue-only dot, or SDK packaging asset.
  DISCS[s.slug] = await b64(`public/assets/zodiac-icons/128/${s.slug}.webp`, 'image/webp');
}

// Fomo's own app icon, as published (docs/VENUE-MARKS.md); it identifies the
// app the /fomo/ card is about and is never redrawn or recoloured.
const FOMO_ICON = await b64('public/assets/venues/fomo-official.svg', 'image/svg+xml');
// fomo's eyes alone (the icon's glyph with the tile keyed away), and the two
// store badges as the page shows them.
const FOMO_EYES = await b64('public/assets/fomo/fomo-eyes.png', 'image/png');
const APP_STORE_BADGE = await b64('public/assets/badges/app-store-en.svg', 'image/svg+xml');
const GOOGLE_PLAY_BADGE = await b64('public/assets/badges/google-play-en.png', 'image/png');
// The owner's phone render of Fomo's Verified list, keyed to transparency, used as delivered.
const FOMO_PHONE = await b64('public/assets/fomo/fomo-verified.png', 'image/png');
// The twelve zodiac emoji tiles (Twemoji glyphs, CC-BY 4.0, on the site's own
// gradient tile; see docs/VENUE-MARKS.md), the same files the page's headline
// uses, so the card and the page match.
const TWEMOJI_CODEPOINTS = { aries: '2648', taurus: '2649', gemini: '264a', cancer: '264b', leo: '264c', virgo: '264d', libra: '264e', scorpio: '264f', sagittarius: '2650', capricorn: '2651', aquarius: '2652', pisces: '2653' };
const TWEMOJI = {};
for (const [slug, cp] of Object.entries(TWEMOJI_CODEPOINTS)) TWEMOJI[slug] = await b64(`public/assets/emoji/zodiac/${cp}.svg`, 'image/svg+xml');

// ── Shared chrome ─────────────────────────────────────────────────────
const INK = '#EEF1F7';
const INK2 = '#C6CCDA';
const MUTED = '#8E96AB';
const VOID = '#060709';
const HAIR = 'rgba(198, 204, 218, 0.10)';

function shell(body, footer, { centered = false } = {}) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: 'EB Garamond'; font-weight: 500; src: url(${FONTS.serif500}) format('woff2'); }
  @font-face { font-family: 'EB Garamond'; font-weight: 400; font-style: italic; src: url(${FONTS.serifItalic}) format('woff2'); }
  @font-face { font-family: 'Instrument Sans'; font-weight: 100 900; src: url(${FONTS.sans}) format('woff2'); }
  @font-face { font-family: 'JetBrains Mono'; font-weight: 100 800; src: url(${FONTS.mono}) format('woff2'); }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    background: ${VOID};
    font-family: 'Instrument Sans', sans-serif;
    color: ${INK};
    position: relative;
    overflow: hidden;
  }
  .stage {
    position: absolute;
    inset: 0 88px 96px;
    display: flex;
    align-items: center;
    ${centered ? 'justify-content: center; text-align: center;' : 'justify-content: space-between;'}
    gap: 48px;
  }
  .rule { position: absolute; left: 88px; right: 88px; bottom: 84px; height: 1px; background: ${HAIR}; }
  .footer {
    position: absolute;
    left: 88px;
    right: 88px;
    bottom: 40px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 19px;
    letter-spacing: 0.06em;
    color: ${MUTED};
    ${centered ? 'text-align: center;' : ''}
  }
  .kicker {
    font-family: 'EB Garamond', serif;
    font-style: italic;
    font-weight: 400;
    font-size: 30px;
    color: ${INK2};
    display: block;
    margin-bottom: 14px;
  }
  .display {
    font-family: 'EB Garamond', serif;
    font-weight: 500;
    line-height: 1.04;
    letter-spacing: -0.005em;
    font-variant-numeric: oldstyle-figures;
  }
  .sub { font-size: 28px; color: ${INK2}; line-height: 1.45; margin-top: 18px; }
  .data {
    font-family: 'JetBrains Mono', monospace;
    font-size: 20px;
    letter-spacing: 0.04em;
    color: ${MUTED};
    margin-top: 22px;
  }
  .disc { border-radius: 50%; display: block; }
  .left { max-width: 660px; }
</style></head>
<body>
  ${body}
  <div class="rule"></div>
  <div class="footer">${footer}</div>
</body></html>`;
}

/** The twelve canonical sign icons as the sign-less wheel mark. */
function wheelMark(diameter, dot) {
  const r = (diameter - dot) / 2;
  const c = diameter / 2;
  const dots = SIGNS.map((s, i) => {
    const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
    const x = c + r * Math.cos(a) - dot / 2;
    const y = c + r * Math.sin(a) - dot / 2;
    return `<img src="${DISCS[s.slug]}" width="${dot}" height="${dot}" alt=""
      style="position:absolute;left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${dot}px;height:${dot}px;border-radius:50%;display:block" />`;
  }).join('');
  return `<span style="position:relative;display:block;width:${diameter}px;height:${diameter}px">${dots}</span>`;
}

function russianShell(body, footer) {
  return `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><style>
  @font-face { font-family: 'EB Garamond Cyrillic'; font-weight: 400 500; src: url(${FONTS.ruSerif}) format('woff2'); }
  @font-face { font-family: 'Golos Text'; font-weight: 400 600; src: url(${FONTS.ruSansB}) format('woff2'); }
  @font-face { font-family: 'Golos Text'; font-weight: 400 600; src: url(${FONTS.ruSansA}) format('woff2'); unicode-range: U+0400-04FF; }
  @font-face { font-family: 'JetBrains Mono Cyrillic'; font-weight: 400 500; src: url(${FONTS.ruMono}) format('woff2'); }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    background: ${VOID};
    color: ${INK};
    font-family: 'Golos Text', sans-serif;
    position: relative;
    overflow: hidden;
  }
  .stage {
    position: absolute;
    inset: 0 78px 96px 88px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 44px;
  }
  .left { max-width: 710px; }
  .display {
    font-family: 'EB Garamond Cyrillic', serif;
    font-weight: 500;
    line-height: 1.02;
    letter-spacing: -0.005em;
  }
  .sub {
    max-width: 700px;
    margin-top: 22px;
    color: ${INK2};
    font-size: 24px;
    line-height: 1.42;
  }
  .disc { display: block; border-radius: 50%; }
  .rule { position: absolute; left: 88px; right: 88px; bottom: 84px; height: 1px; background: ${HAIR}; }
  .footer {
    position: absolute;
    left: 88px;
    right: 88px;
    bottom: 40px;
    color: ${MUTED};
    font-family: 'JetBrains Mono Cyrillic', monospace;
    font-size: 18px;
    letter-spacing: 0.04em;
  }
</style></head><body>
  ${body}
  <div class="rule"></div>
  <div class="footer">${footer}</div>
</body></html>`;
}

function russianTitleSize(title) {
  if (title.length > 62) return 49;
  if (title.length > 50) return 54;
  if (title.length > 38) return 60;
  if (title.length > 28) return 66;
  return 76;
}

function russianCard(entry) {
  const title = escapeHtml(entry.title);
  const description = escapeHtml(entry.description);
  const sign = entry.kind === 'sign'
    ? SIGNS.find((candidate) => candidate.slug === entry.slug)
    : null;
  const accent = sign
    ? `<img class="disc" src="${DISCS[sign.slug]}" width="310" height="310"
         style="box-shadow:0 32px 90px ${sign.hue}40" />`
    : wheelMark(258, 23);
  const body = `
  <div class="stage">
    <div class="left">
      <div class="display" style="font-size:${russianTitleSize(entry.title)}px">${title}</div>
      ${sharingRussianCards.has(entry.card) ? '' : `<div class="sub">${description}</div>`}
    </div>
    ${accent}
  </div>`;
  return russianShell(body, `zodiacs.org${escapeHtml(entry.publicPath)}`);
}

const nameSize = (name) => (name.length >= 10 ? 104 : name.length >= 8 ? 118 : 132);
const signName = (sign) => OG_EN.signNames[sign.slug] ?? sign.name;
const format = (template, values) => Object.entries(values).reduce(
  (copy, [name, value]) => copy.replaceAll(`{${name}}`, String(value)),
  template,
);
const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

// ── Card renderers ────────────────────────────────────────────────────
function shareCard() {
  const body = `
  <div class="stage">
    <div class="left" style="max-width: 580px;">
      <div class="display" style="font-size: 67px; max-width: 580px;">${OG_EN.share.title}</div>
      <div class="sub" style="font-size: 25px; color: ${MUTED}; max-width: 560px;">${OG_EN.share.subtitle}</div>
    </div>
    ${wheelMark(380, 70)}
  </div>`;
  return shell(body, OG_EN.site);
}

/** /fomo/ — Astrofolio on the Fomo app: the owner's phone render beside the
 *  headline. Wing register on purpose; emitted alone via --only-fomo. */
function fomoCard() {
  const body = `
  <div class="stage">
    <div class="left" style="max-width: 530px; flex: none;">
      <span class="kicker">Astrology in a trading app</span>
      <div class="display" style="font-size: 62px; max-width: 530px;">Trade your zodiac<span style="display:flex;gap:5px;margin:14px 0 12px">${SIGNS.map((s) => `<img src="${TWEMOJI[s.slug]}" width="38" height="38" alt="" style="display:block;width:38px;height:38px" />`).join('')}</span>on the fomo<img src="${FOMO_EYES}" width="512" height="326" alt="" style="display:inline-block;height:0.62em;width:auto;vertical-align:-0.04em;margin-left:0.2em" /> app</div>
      <div class="sub" style="max-width: 530px;">Buy your sign in a few taps and see what your friends are trading. It’s free.</div>
      <div style="display:flex;align-items:center;gap:14px;margin-top:26px">
        <img src="${APP_STORE_BADGE}" alt="" style="display:block;height:54px;width:auto" />
        <img src="${GOOGLE_PLAY_BADGE}" alt="" style="display:block;height:80px;width:auto;margin:-13px" />
      </div>
    </div>
  </div>
  <img src="${FOMO_PHONE}" alt=""
    style="position:absolute;right:36px;top:60px;z-index:2;height:640px;width:auto;filter:drop-shadow(0 34px 70px rgba(0,0,0,.6))" />`;
  return shell(body, 'zodiacs.org/fomo/');
}

/** The thesis page's own card — reference-document register, no consumer
 *  copy. Emitted alone via --only-thesis so the other cards stay put. */
function thesisCard() {
  const body = `
  <div class="stage" style="flex-direction: column; justify-content: center; gap: 40px;">
    ${wheelMark(160, 15)}
    <div>
      <span class="kicker">${OG_EN.thesis.kicker}</span>
      <div class="display" style="font-size: 76px; max-width: 980px;">${OG_EN.thesis.title}</div>
    </div>
  </div>`;
  return shell(body, OG_EN.thesis.footer, { centered: true });
}

function signCard(s) {
  const title = signName(s);
  const body = `
  <div class="stage">
    <div class="left">
      <span class="kicker">${OG_EN.signGuide.kicker}</span>
      <div class="display" style="font-size: ${nameSize(title)}px;">${title}</div>
      <div class="sub" style="max-width: 620px;">${s.essence}</div>
      <div class="data">${s.dates} · ${ELEMENT_LABEL[s.element]} · ${MODALITY_LABEL[s.modality]}</div>
    </div>
    <img class="disc" src="${DISCS[s.slug]}" width="360" height="360"
         style="box-shadow: 0 30px 90px ${s.hue}40;" />
  </div>`;
  return shell(body, `zodiacs.org/${s.slug}/`);
}

const LOTS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

function registryLotCard(s, index) {
  const title = signName(s);
  const number = String(index + 1).padStart(2, '0');
  const lot = LOTS[index];
  const numberLine = OG_EN.registryLot.numberLine
    .replace('{number}', number)
    .replace('{lot}', lot);
  const body = `
  <div class="stage">
    <div class="left">
      <span class="kicker">${OG_EN.registryLot.kicker}</span>
      <div class="display" style="font-size: ${nameSize(title)}px;">${title}</div>
      <div class="data" style="font-size:24px;color:${INK2};">${numberLine}</div>
      <div class="sub" style="font-size:23px;color:${MUTED};max-width:640px;">${OG_EN.registryLot.subtitle}</div>
    </div>
    <img class="disc" src="${DISCS[s.slug]}" width="360" height="360"
         style="box-shadow: 0 30px 90px ${s.hue}40;" />
  </div>`;
  return shell(body, `zodiacs.org/registry/${s.slug}/`);
}

function wingCard(copy = OG_EN.wing, footer = 'zodiacs.org · Astrofolio · Registry · Terminal') {
  const body = `
  <div class="stage">
    <div class="left">
      <span class="kicker">${copy.kicker}</span>
      <div class="display" style="font-size: 78px;max-width:680px;">${copy.title}</div>
      <div class="sub" style="font-size:25px;color:${MUTED};max-width:620px;">${copy.subtitle}</div>
      <div class="data">${copy.data}</div>
    </div>
    ${wheelMark(330, 38)}
  </div>`;
  return shell(body, footer);
}

function disclosureCard() {
  const body = `
  <div class="stage">
    <div class="left">
      <span class="kicker">${OG_EN.disclosure.kicker}</span>
      <div class="display" style="font-size: 72px;max-width:720px;">${OG_EN.disclosure.title}</div>
      <div class="sub" style="font-size:25px;color:${MUTED};max-width:690px;">${OG_EN.disclosure.subtitle}</div>
    </div>
    ${wheelMark(280, 32)}
  </div>`;
  return shell(body, 'zodiacs.org/disclosure/');
}

function toolCard(t) {
  const body = `
  <div class="stage">
    <div class="left">
      <span class="kicker">${t.kicker}</span>
      <div class="display" style="font-size: 76px;">${t.title}</div>
      <div class="sub" style="font-size: 26px; color: ${MUTED}; max-width: 640px;">${t.sub}</div>
    </div>
    ${wheelMark(300, 26)}
  </div>`;
  return shell(body, `zodiacs.org${t.path}`);
}

function compatibilityInviteCard() {
  const body = `
  <div class="stage">
    <div class="left">
      <span class="kicker">A private invitation</span>
      <div class="display" style="font-size: 76px;">Two charts,<br/>read together</div>
      <div class="sub" style="font-size: 26px; color: ${MUTED}; max-width: 640px;">Their side is entered. Yours stays in your browser.</div>
    </div>
    <div style="display:flex;align-items:center;">
      ${wheelMark(240, 22)}
      <div style="margin-left:-38px;box-shadow:0 0 0 12px ${VOID};border-radius:50%;">${wheelMark(240, 22)}</div>
    </div>
  </div>`;
  return shell(body, 'zodiacs.org/compatibility/');
}

function pairCard(a, b) {
  const aTitle = signName(a);
  const bTitle = signName(b);
  const same = a.slug === b.slug;
  const discs = same
    ? `<img class="disc" src="${DISCS[a.slug]}" width="320" height="320" style="box-shadow: 0 30px 90px ${a.hue}40;" />`
    : `<div style="display:flex;align-items:center;">
         <img class="disc" src="${DISCS[a.slug]}" width="300" height="300" />
         <img class="disc" src="${DISCS[b.slug]}" width="300" height="300"
              style="margin-left:-72px; box-shadow: 0 0 0 10px ${VOID};" />
       </div>`;
  // Both variants read as prose, so both wear the prose face: mono is the
  // data register here, and a middle-dot triad set in it was wide enough to
  // wrap inside its own last clause ("what / makes it last"). Each clause is
  // kept whole so any wrap lands on a separator instead.
  const triad = format(OG_EN.compatibility.data, {
    aElement: ELEMENT_LABEL[a.element],
    bElement: ELEMENT_LABEL[b.element].toLowerCase(),
    aModality: MODALITY_LABEL[a.modality].toLowerCase(),
    bModality: MODALITY_LABEL[b.modality].toLowerCase(),
  })
    .split(' · ')
    .map((clause) => clause.replaceAll(' ', ' '))
    // The sans middot carries its ink left of centre, so a plain space each
    // side reads lopsided; margins set the optical gap instead.
    .join(`<span style="margin: 0 0.42em; color: ${MUTED};">·</span>`);
  const dataLine = same
    ? `<div class="sub" style="font-size: 24px; max-width: 560px;">${a.essence}</div>`
    : `<div class="sub" style="font-size: 24px; max-width: 600px; color: ${MUTED};">${triad}</div>`;
  const body = `
  <div class="stage">
    <div class="left">
      <span class="kicker">${OG_EN.compatibility.kicker}</span>
      <div class="display" style="font-size: 72px; line-height: 1.08;">${format(OG_EN.compatibility.title, { a: aTitle, b: bTitle })}</div>
      ${dataLine}
    </div>
    ${discs}
  </div>`;
  return shell(body, `zodiacs.org/compatibility/${a.slug}-${b.slug}/`);
}

function placementCard(planetKey, glyph) {
  const planet = OG_EN.planetNames[planetKey];
  const discsRow = SIGNS.map((s) =>
    `<img src="${DISCS[s.slug]}" width="26" height="26" alt="" style="display:inline-block;width:26px;height:26px;border-radius:50%;margin-right:10px;" />`,
  ).join('');
  const body = `
  <div class="stage">
    <div class="left">
      <span class="kicker">${OG_EN.placements.kicker}</span>
      <div class="display" style="font-size: 72px; line-height: 1.08;">${format(OG_EN.placements.title, { planet })}</div>
      <div class="sub" style="font-size: 26px; color: ${MUTED}; max-width: 620px;">${OG_EN.placements.subtitle.replace('{planet}', planet)}</div>
      <div style="margin-top: 26px; line-height: 0;">${discsRow}</div>
    </div>
    <span style="font-family: 'EB Garamond', serif; font-size: 220px; color: ${INK2}; opacity: 0.9; line-height: 1;">${glyph}</span>
  </div>`;
  return shell(body, 'zodiacs.org/learn/placements/');
}

function horoscopeCard(s, surface) {
  const title = signName(s);
  const body = `
  <div class="stage">
    <div class="left">
      <span class="kicker">${surface.kicker}</span>
      <div class="display" style="font-size: ${nameSize(title)}px;">${title}</div>
      <div class="sub" style="font-size: 26px; color: ${MUTED};">${surface.subtitle}</div>
      <div class="data">${s.dates}</div>
    </div>
    <img class="disc" src="${DISCS[s.slug]}" width="340" height="340"
         style="box-shadow: 0 30px 90px ${s.hue}40;" />
  </div>`;
  const pagePath = surface.suffix ? `${s.slug}/${surface.suffix}/` : `${s.slug}/`;
  return shell(body, `zodiacs.org/horoscopes/${pagePath}`);
}

const horoscopeCardPath = (sign, surface) => (
  `horoscope/${sign.slug}${surface.suffix ? `-${surface.suffix}` : ''}.png`
);

function risingCard(s) {
  const title = signName(s);
  const body = `
  <div class="stage">
    <div class="left">
      <span class="kicker">${OG_EN.rising.kicker}</span>
      <div class="display" style="font-size: 84px; line-height: 1.06;">${format(OG_EN.rising.title, { sign: title })}</div>
      <div class="sub" style="font-size: 26px; color: ${MUTED};">${OG_EN.rising.subtitle}</div>
      <div class="data">${OG_EN.rising.data}</div>
    </div>
    <img class="disc" src="${DISCS[s.slug]}" width="340" height="340"
         style="box-shadow: 0 30px 90px ${s.hue}40;" />
  </div>`;
  return shell(body, `zodiacs.org/rising-sign/${s.slug}/`);
}

function almanacCard({ title, sub, path, hub = false }) {
  const size = title.length > 40 ? 62 : title.length > 28 ? 68 : 76;
  const body = `
  <div class="stage">
    <div class="left" style="max-width: 720px;">
      <span class="kicker">${hub ? 'The sky, written down' : 'The Almanac'}</span>
      <div class="display" style="font-size: ${size}px;">${title}</div>
      <div class="sub" style="font-size: 25px; color: ${MUTED}; max-width: 700px;">${sub}</div>
    </div>
    ${wheelMark(250, 22)}
  </div>`;
  return shell(body, `zodiacs.org${path}`);
}

function personCard(person) {
  const titleSize = person.displayName.length > 22 ? 58
    : person.displayName.length > 16 ? 66
      : person.displayName.length > 11 ? 76 : 88;
  const body = `
  <div class="stage">
    <div class="left" style="max-width:700px;">
      <span class="kicker">People · ${person.sourceReview?.status === 'adopted-date' ? 'adopted date · uncertain' : 'sourced birth date'}</span>
      <div class="display" style="font-size:${titleSize}px;">${escapeHtml(person.displayName)}</div>
      <div class="sub" style="font-size:24px;color:${MUTED};max-width:680px;">${escapeHtml(person.shortDescription)}</div>
      <div class="data">${escapeHtml(person.sunSign.name)} ${person.sunSign.degree.toFixed(1)}° · Birth time unknown</div>
    </div>
    <img class="disc" src="${DISCS[person.sunSign.slug]}" width="270" height="270" />
  </div>`;
  return shell(body, `zodiacs.org/people/${person.slug}/`);
}

const EVENT_FAMILY = {
  lunation: { label: 'Moon calendar', glyph: '☽' },
  eclipse: { label: 'Eclipse season', glyph: '◐' },
  retrograde: { label: 'Retrograde', glyph: '℞' },
  ingress: { label: 'Sign change', glyph: '→' },
  aspect: { label: 'Exact alignment', glyph: '✦' },
  station: { label: 'Planetary station', glyph: '℞' },
};

function eventHubCard() {
  const body = `
  <div class="stage">
    <div class="left" style="max-width: 720px;">
      <span class="kicker">The sky, dated</span>
      <div class="display" style="font-size: 84px;">Sky events</div>
      <div class="sub" style="font-size: 25px; color: ${MUTED}; max-width: 690px;">Full moons, eclipses, retrogrades, sign changes, and rare alignments through 2027.</div>
    </div>
    ${wheelMark(250, 22)}
  </div>`;
  return shell(body, 'zodiacs.org/events/');
}

function eventCard(event) {
  const family = EVENT_FAMILY[event.family] ?? { label: 'Sky event', glyph: '✦' };
  const sign = SIGNS.find((candidate) => candidate.slug === event.signs?.[0]);
  const instant = new Date(event.anchor);
  const date = new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(instant);
  const clock = instant.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
  });
  const cardTitle = event.title.replace(/\s+[—–]\s+.*\b20(?:26|27)\s*$/, '');
  const title = escapeHtml(cardTitle);
  const size = cardTitle.length > 62 ? 52 : cardTitle.length > 46 ? 58 : cardTitle.length > 32 ? 66 : 74;
  const accent = sign
    ? `<img class="disc" src="${DISCS[sign.slug]}" width="224" height="224" style="box-shadow:0 34px 90px ${sign.hue}38" />`
    : wheelMark(224, 20);
  const body = `
  <div class="stage">
    <div class="left" style="max-width: 760px;">
      <span class="kicker"><span style="font-style:normal;color:${sign?.hue ?? INK2};margin-right:12px">${family.glyph}</span>${family.label}</span>
      <div class="display" style="font-size:${size}px;">${title}</div>
      <div class="data">${escapeHtml(date)} · ${escapeHtml(clock)} UTC</div>
    </div>
    ${accent}
  </div>`;
  return shell(body, `zodiacs.org${escapeHtml(event.path)}`);
}

function frontmatterField(source, name) {
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  const raw = frontmatter.match(new RegExp(`^${name}:\\s*(.+)$`, 'm'))?.[1]?.trim();
  if (!raw) throw new Error(`Almanac entry missing ${name}`);
  return raw.startsWith('"') ? JSON.parse(raw) : raw.replace(/^['"]|['"]$/g, '');
}

function frontmatterBoolean(source, name) {
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '';
  return frontmatter.match(new RegExp(`^${name}:\\s*(true|false)\\s*$`, 'm'))?.[1] === 'true';
}

const almanacEntries = (await Promise.all(
  (await readdir(resolve(root, 'src/content/almanac')))
    .filter((file) => file.endsWith('.mdx'))
    .sort()
    .map(async (file) => {
      const source = await readFile(resolve(root, 'src/content/almanac', file), 'utf8');
      return {
        slug: file.replace(/\.mdx$/, ''),
        title: frontmatterField(source, 'title'),
        description: frontmatterField(source, 'description'),
        draft: frontmatterBoolean(source, 'draft'),
      };
    }),
)).filter((entry) => !entry.draft);

const TOOLS = OG_EN.tools;
const englishRequiredCards = () => [
  ...SIGNS.map((s) => `sign/${s.slug}.png`),
  ...SIGNS.map((s) => `registry/${s.slug}.png`),
  ...SIGNS.flatMap((s) => HOROSCOPE_OG_SURFACES.map((surface) => horoscopeCardPath(s, surface))),
  ...TOOLS.map((tool) => `tool/${tool.key}.png`),
  'tool/compatibility-invite.png',
  ...(EVENTS_PUBLICATION.hub.indexEligible ? ['events/index.png'] : []),
  ...EVENTS_PUBLICATION.pages.map((event) => `events/${event.id}.png`),
  ...PEOPLE_PILOT.map((person) => `people/${person.slug}.png`),
  'fomo.png',
  'registry.png',
  'thesis.png',
  'disclosure.png',
].sort();

async function writeEnglishManifest() {
  await writeFile(resolve(OUT, 'manifest.json'), `${JSON.stringify({
    schema: 'zodiacs.og-cards.v1',
    locale: 'en',
    width: 1200,
    height: 630,
    iconSource: '/assets/zodiac-icons/128/{sign}.webp',
    fallback: `/assets/og/v2/${HOMEPAGE_CARD}`,
    requiredCards: englishRequiredCards(),
  }, null, 2)}\n`);
}

// ── Render loop ───────────────────────────────────────────────────────
// A failed rerun may leave candidate PNGs, but must never leave an earlier
// success receipt beside partially replaced output.
if (peopleIdentityReview) await rm(resolve(OUT, 'receipt.json'), { force: true });
for (const dir of peopleIdentityReview ? ['people'] : ['', 'sign', 'registry', 'tool', 'pair', 'horoscope', 'placements', 'rising', 'almanac', 'events', 'people', 'pin', 'ru', 'ru/sign', 'ru/tool']) {
  await mkdir(resolve(OUT, dir), { recursive: true });
}
if (!peopleIdentityReview) await mkdir(WING_OUT, { recursive: true });

const reviewLaunchOptions = peopleIdentityReview
  ? { args: (await import('../tests/visual/browser.mjs')).STABLE_CHROMIUM_ARGS }
  : {};
const browser = await chromium.launch({ executablePath, ...reviewLaunchOptions });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const onlyHoroscopes = process.argv.includes('--only-horoscopes');
const onlyInvite = process.argv.includes('--only-compatibility-invite');
const onlyRussian = process.argv.includes('--only-ru');
const onlyReturnRussian = process.argv.includes('--only-return-visits-ru');
const returnRussianCards = new Set(['tool/sky-calendar.png', 'tool/astrologer-kit.png', 'tool/your-sky-wrapped.png', 'tool/chart-of-the-day.png']);
const onlySharingRussian = process.argv.includes('--only-sharing-ru');
const sharingRussianCards = new Set(['tool/big-three.png', 'tool/compatibility-private-invite.png', 'tool/group-charts.png', 'tool/chart-twins.png']);
const onlyPeople = process.argv.includes('--only-people');
const onlyHomepage = process.argv.includes('--only-homepage');
// --only-terminal remains an undocumented compatibility alias for release
// tooling that predates the split identities.
const onlyWing = process.argv.includes('--only-wing') || process.argv.includes('--only-terminal');

let total = 0;
let count = 0;
let russianTotal = 0;

async function shoot(html, outPath, outputRoot = OUT) {
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  let reviewFonts;
  if (peopleIdentityReview) {
    reviewFonts = await page.evaluate(async () => {
      const specs = ['500 24px "EB Garamond"', 'italic 400 30px "EB Garamond"', '400 24px "Instrument Sans"', '400 20px "JetBrains Mono"'];
      const loaded = await Promise.all(specs.map(async (spec) => {
        const faces = await document.fonts.load(spec);
        if (!faces.length || faces.some((face) => face.status !== 'loaded')) throw new Error(`Card font failed: ${spec}`);
        return spec;
      }));
      await Promise.all([...document.images].map((image) => image.decode()));
      const fits = [...document.querySelectorAll('.display, .sub, .data, .disc, .footer')]
        .every((element) => {
          const box = element.getBoundingClientRect();
          return box.left >= 0 && box.right <= 1200 && box.top >= 0 && box.bottom <= 630;
        });
      if (!fits) throw new Error('People identity card overflows the capture');
      return loaded;
    });
  }
  await page.waitForTimeout(120);
  if (outPath.startsWith('ru/')) {
    // Title-only sharing cards still verify the full Russian font family.
    await page.evaluate(() => document.fonts.load('24px \"Golos Text\"', '\u041d\u0430\u0442\u0430\u043b\u044c\u043d\u0430\u044f \u043a\u0430\u0440\u0442\u0430'));
    const layout = await page.evaluate(() => {
      const stage = document.querySelector('.stage')?.getBoundingClientRect();
      const left = document.querySelector('.left')?.getBoundingClientRect();
      const display = document.querySelector('.display')?.getBoundingClientRect();
      const sub = (document.querySelector('.sub') ?? document.querySelector('.display'))?.getBoundingClientRect();
      return {
        stage: stage ? { left: stage.left, right: stage.right, top: stage.top, bottom: stage.bottom } : null,
        left: left ? { left: left.left, right: left.right, top: left.top, bottom: left.bottom } : null,
        display: display ? { left: display.left, right: display.right, top: display.top, bottom: display.bottom } : null,
        sub: sub ? { left: sub.left, right: sub.right, top: sub.top, bottom: sub.bottom } : null,
        fonts: {
          sans: document.fonts.check('24px "Golos Text"', 'Натальная карта'),
          serif: document.fonts.check('54px "EB Garamond Cyrillic"', 'Знаки'),
          mono: document.fonts.check('18px "JetBrains Mono Cyrillic"', 'zodiacs.org/ru/'),
        },
      };
    });
    const boxes = [layout.left, layout.display, layout.sub];
    const fits = layout.stage && boxes.every((box) => box
      && box.left >= layout.stage.left - 1
      && box.right <= layout.stage.right + 1
      && box.top >= layout.stage.top - 1
      && box.bottom <= layout.stage.bottom + 1);
    if (!fits || !Object.values(layout.fonts).every(Boolean)) {
      throw new Error(`${outPath}: Russian card overflow or font-load failure (${JSON.stringify(layout)})`);
    }
  }
  const raw = await page.screenshot({ type: 'png' });
  const firstPass = await sharp(raw)
    .png({ palette: true, compressionLevel: 9, effort: 8 })
    .toBuffer();
  // The event family adds one unique card per published page. A dedicated
  // 64-colour palette keeps type edges and the canonical pastel sign art
  // crisp while cutting this repeated family enough to preserve the complete
  // v2 bundle's 15MiB ceiling.
  const compactPalette = outPath.startsWith('events/')
    || outPath.startsWith('people/')
    || outPath.startsWith('ru/');
  const compactColors = outPath.startsWith('people/') ? 32 : 64;
  // Re-quantize People and the new Russian sharing cards from the full-colour capture. Reprocessing the
  // already-indexed first pass can preserve its larger palette in libvips,
  // which defeats this small family's tighter launch budget.
  const sharingRussian = outPath.startsWith('ru/') && (sharingRussianCards.has(outPath.slice(3)) || returnRussianCards.has(outPath.slice(3)));
  const compactInput = outPath.startsWith('people/') || sharingRussian ? raw : firstPass;
  const buf = compactPalette
    ? await sharp(compactInput).png({
        palette: true,
        colors: sharingRussian ? 32 : compactColors,
        dither: sharingRussian ? 0 : 0.6,
        compressionLevel: 9,
        effort: 10,
      }).toBuffer()
    : firstPass;
  await writeFile(resolve(outputRoot, outPath), buf);
  total += buf.length;
  if (outPath.startsWith('ru/')) russianTotal += buf.length;
  count += 1;
  if (count % 20 === 0) console.log(`  …${count} cards, ${(total / 1024 / 1024).toFixed(1)}MB so far`);
  if (peopleIdentityReview) {
    const metadata = await sharp(buf).metadata();
    if (metadata.width !== 1200 || metadata.height !== 630) throw new Error(`${outPath}: unexpected dimensions`);
    return {
      path: outPath, bytes: buf.length, width: metadata.width, height: metadata.height,
      sha256: createHash('sha256').update(buf).digest('hex'),
      displayedIdentity: await page.locator('.sub').textContent(),
      loadedFonts: reviewFonts,
    };
  }
}

async function writeRussianManifest() {
  const copyDigest = createHash('sha256').update(RU_OG_COPY_DIGEST_INPUT).digest('hex');
  await writeFile(resolve(OUT, 'ru/manifest.json'), `${JSON.stringify({
    schema: 'zodiacs.og-cards.v1',
    locale: 'ru',
    width: 1200,
    height: 630,
    iconSource: '/assets/zodiac-icons/128/{sign}.webp',
    fallback: '/assets/og/v2/ru/share.png',
    copyDigest,
    requiredCards: RU_OG_REQUIRED_CARDS,
    routeCards: RU_OG_ROUTE_CARDS,
  }, null, 2)}\n`);
}

async function renderRussianCards(sharingOnly = false, returnOnly = false) {
  for (const entry of RU_OG_ROUTES.filter((entry) => (!sharingOnly || sharingRussianCards.has(entry.card)) && (!returnOnly || returnRussianCards.has(entry.card)))) {
    await shoot(russianCard(entry), `ru/${entry.card}`);
  }
  await writeRussianManifest();
  // A bounded refresh still checks the whole committed Russian family.
  russianTotal = (await Promise.all(RU_OG_REQUIRED_CARDS.map(async (card) => (await readFile(resolve(OUT, 'ru', card))).length))).reduce((a, b) => a + b, 0);
  if (russianTotal > 700 * 1024) {
    throw new Error(`Russian OG family is ${(russianTotal / 1024).toFixed(1)}KiB; budget is 700KiB`);
  }
}

if (peopleIdentityReview) {
  try {
    const cards = [];
    for (const person of identityReviewPeople) {
      const capture = await shoot(personCard(person), `people/${person.slug}.png`);
      if (capture.displayedIdentity !== person.shortDescription) {
        throw new Error(`${person.slug}: displayed identity differs from production source`);
      }
      cards.push({ slug: person.slug, shortDescription: person.shortDescription, ...capture });
    }
    const productionOgAfter = await productionOgHashes(root);
    if (JSON.stringify(productionOgAfter) !== JSON.stringify(productionOgBefore)) {
      throw new Error('Review rendering changed production OG files');
    }
    for (const [path, before] of Object.entries(identityReviewSources)) {
      if (await fileSha256(resolve(root, path)) !== before) throw new Error(`${path}: source changed during review rendering`);
    }
    const require = createRequire(import.meta.url);
    await writeFile(resolve(OUT, 'receipt.json'), `${JSON.stringify({
      schema: peopleFactReview ? 'zodiacs.people-facts-og-review.v1' : 'zodiacs.people-identity-og-review.v1',
      output: peopleFactReview ? 'tests/visual/artifacts/explorer/people-facts-og' : 'tests/visual/artifacts/explorer/people-identity-og',
      runtime: {
        node: process.version, platform: process.platform, arch: process.arch,
        nodeSha256: await fileSha256(process.execPath),
        chromium: browser.version(), playwright: require('playwright-core/package.json').version,
        chromiumSha256: await fileSha256(executablePath ?? chromium.executablePath()),
        sharp: sharp.versions,
      },
      sources: identityReviewSources, cards,
      productionOg: { unchanged: true, before: productionOgBefore, after: productionOgAfter },
    }, null, 2)}\n`);
    console.log(`Reviewed ${count} People ${peopleFactReview ? 'facts' : 'identity'} cards; production OG files unchanged.`);
  } finally {
    await browser.close();
  }
  process.exit(0);
}

if (onlyWing) {
  await browser.close();
  const { buildAstrofolioIdentity } = await import('./build-astrofolio-identity.mjs');
  const identity = await buildAstrofolioIdentity();
  console.log(`Done: ${identity.seasons.length} seasonal Astrofolio cards + distinct Terminal card.`);
  process.exit(0);
}

if (onlyHomepage) {
  console.log('Rendering the homepage social card…');
  await shoot(shareCard(), HOMEPAGE_CARD);
  await writeEnglishManifest();
  console.log(`Done: ${count} homepage card, ${(total / 1024).toFixed(0)}KB.`);
  await browser.close();
  process.exit(0);
}

if (onlyRussian || onlySharingRussian || onlyReturnRussian) {
  console.log('Rendering Russian OG cards…');
  await renderRussianCards(onlySharingRussian, onlyReturnRussian);
  console.log(`Done: ${count} Russian cards, ${(russianTotal / 1024).toFixed(1)}KiB.`);
  await browser.close();
  process.exit(0);
}

if (process.argv.includes('--only-fomo')) {
  console.log('Rendering the /fomo/ share card…');
  await shoot(fomoCard(), 'fomo.png');
  await writeEnglishManifest();
  console.log(`Done: ${count} card(s), ${(total / 1024).toFixed(0)}KB.`);
  await browser.close();
  process.exit(0);
}

if (onlyPeople) {
  console.log('Rendering People pilot OG cards…');
  for (const person of PEOPLE_PILOT) {
    await shoot(personCard(person), `people/${person.slug}.png`);
  }
  await writeEnglishManifest();
  console.log(`Done: ${count} People cards, ${(total / 1024).toFixed(0)}KB.`);
  await browser.close();
  process.exit(0);
}

if (process.argv.includes('--only-almanac')) {
  console.log('Rendering Almanac OG cards…');
  await shoot(almanacCard({
    title: 'The Almanac',
    sub: "What's actually happening up there each month, and what the tradition makes of it.",
    path: '/almanac/',
    hub: true,
  }), 'almanac/index.png');
  for (const entry of almanacEntries) {
    await shoot(almanacCard({
      title: entry.title,
      sub: entry.description,
      path: `/almanac/${entry.slug}/`,
    }), `almanac/${entry.slug}.png`);
  }
  console.log(`Done: ${count} card(s), ${(total / 1024).toFixed(0)}KB.`);
  await browser.close();
  process.exit(0);
}

const PLANET_GLYPHS = {
  sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂',
  jupiter: '♃', saturn: '♄', uranus: '♅', neptune: '♆', pluto: '♇',
};

if (onlyInvite) {
  console.log('Rendering the private compatibility-invitation card…');
  await shoot(compatibilityInviteCard(), 'tool/compatibility-invite.png');
  console.log(`Done: ${count} card(s), ${(total / 1024).toFixed(0)}KB.`);
  await browser.close();
  process.exit(0);
}

console.log(onlyHoroscopes ? 'Rendering horoscope-family cards…' : 'Rendering Cosmic Void OG cards…');
if (onlyHoroscopes) {
  const horoscopeTool = TOOLS.find((tool) => tool.key === 'horoscopes');
  if (!horoscopeTool) throw new Error('Missing horoscopes tool-card copy');
  await shoot(toolCard(horoscopeTool), 'tool/horoscopes.png');
  for (const s of SIGNS) {
    for (const surface of HOROSCOPE_OG_SURFACES) {
      await shoot(horoscopeCard(s, surface), horoscopeCardPath(s, surface));
    }
  }
} else {
  await shoot(thesisCard(), 'thesis.png');
  if (process.argv.includes('--only-thesis')) {
    console.log(`Done: ${count} card(s), ${(total / 1024).toFixed(0)}KB.`);
    await browser.close();
    process.exit(0);
  }
  await shoot(fomoCard(), 'fomo.png');
  // Keep the established global fallback byte-stable unless a deliberate
  // fallback refresh is explicitly requested.
  if (process.argv.includes('--include-fallback')) await shoot(shareCard(), 'share.png');
  await shoot(almanacCard({
    title: 'The Almanac',
    sub: "What's actually happening up there each month, and what the tradition makes of it.",
    path: '/almanac/',
    hub: true,
  }), 'almanac/index.png');
  for (const entry of almanacEntries) {
    await shoot(almanacCard({
      title: entry.title,
      sub: entry.description,
      path: `/almanac/${entry.slug}/`,
    }), `almanac/${entry.slug}.png`);
  }
  for (const s of SIGNS) await shoot(signCard(s), `sign/${s.slug}.png`);
  for (let i = 0; i < SIGNS.length; i += 1) {
    await shoot(registryLotCard(SIGNS[i], i), `registry/${SIGNS[i].slug}.png`);
  }
  // The v2 URL has a long-lived social-cache history. Preserve its original
  // Registry bytes; the active products share the neutral versioned v4 URL.
  await shoot(wingCard(LEGACY_REGISTRY_CARD_COPY, 'zodiacs.org/registry/'), 'registry.png');
  await shoot(disclosureCard(), 'disclosure.png');
  await shoot(compatibilityInviteCard(), 'tool/compatibility-invite.png');
  for (const t of TOOLS) await shoot(toolCard(t), `tool/${t.key}.png`);
  for (let i = 0; i < SIGNS.length; i += 1) {
    for (let j = i; j < SIGNS.length; j += 1) {
      await shoot(pairCard(SIGNS[i], SIGNS[j]), `pair/${SIGNS[i].slug}-${SIGNS[j].slug}.png`);
    }
  }
  for (const s of SIGNS) {
    for (const surface of HOROSCOPE_OG_SURFACES) {
      await shoot(horoscopeCard(s, surface), horoscopeCardPath(s, surface));
    }
  }
  for (const s of SIGNS) await shoot(risingCard(s), `rising/${s.slug}.png`);
  for (const [planetKey, glyph] of Object.entries(PLANET_GLYPHS)) {
    await shoot(placementCard(planetKey, glyph), `placements/${planetKey}.png`);
  }
  if (EVENTS_PUBLICATION.hub.indexEligible) {
    await shoot(eventHubCard(), 'events/index.png');
    for (const event of EVENTS_PUBLICATION.pages) {
      await shoot(eventCard(event), `events/${event.id}.png`);
    }
  }
  for (const person of PEOPLE_PILOT) {
    await shoot(personCard(person), `people/${person.slug}.png`);
  }
  await renderRussianCards();
}

// ── Pinterest pins — 1000×1500, the 2:3 ratio pins want ──────────────
function pinShell(body, footer) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: 'EB Garamond'; font-weight: 500; src: url(${FONTS.serif500}) format('woff2'); }
  @font-face { font-family: 'EB Garamond'; font-weight: 400; font-style: italic; src: url(${FONTS.serifItalic}) format('woff2'); }
  @font-face { font-family: 'Instrument Sans'; font-weight: 100 900; src: url(${FONTS.sans}) format('woff2'); }
  @font-face { font-family: 'JetBrains Mono'; font-weight: 100 800; src: url(${FONTS.mono}) format('woff2'); }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1000px; height: 1500px; }
  body { background: ${VOID}; font-family: 'Instrument Sans', sans-serif; color: ${INK}; position: relative; overflow: hidden; }
  .pstage { position: absolute; inset: 110px 84px 150px; display: flex; flex-direction: column; align-items: center; text-align: center; justify-content: center; gap: 44px; }
  .prule { position: absolute; left: 84px; right: 84px; bottom: 128px; height: 1px; background: ${HAIR}; }
  .pfooter { position: absolute; left: 84px; right: 84px; bottom: 68px; font-family: 'JetBrains Mono', monospace; font-size: 22px; letter-spacing: 0.06em; color: ${MUTED}; text-align: center; }
  .kicker { font-family: 'EB Garamond', serif; font-style: italic; font-weight: 400; font-size: 36px; color: ${INK2}; display: block; margin-bottom: 6px; }
  .display { font-family: 'EB Garamond', serif; font-weight: 500; line-height: 1.02; letter-spacing: -0.005em; font-variant-numeric: oldstyle-figures; }
  .sub { font-size: 32px; color: ${INK2}; line-height: 1.5; max-width: 720px; }
  .data { font-family: 'JetBrains Mono', monospace; font-size: 24px; letter-spacing: 0.05em; color: ${MUTED}; }
  .disc { border-radius: 50%; display: block; }
</style></head>
<body>
  ${body}
  <div class="prule"></div>
  <div class="pfooter">${footer}</div>
</body></html>`;
}

function pinSign(s) {
  const title = signName(s);
  const body = `
  <div class="pstage">
    <span class="kicker">${OG_EN.pin.signGuide.kicker}</span>
    <img class="disc" src="${DISCS[s.slug]}" width="440" height="440" style="box-shadow: 0 44px 130px ${s.hue}45;" />
    <div>
      <div class="display" style="font-size: ${nameSize(title) + 22}px;">${title}</div>
      <div class="data" style="margin-top: 20px;">${s.dates} · ${ELEMENT_LABEL[s.element]} · ${MODALITY_LABEL[s.modality]}</div>
    </div>
    <div class="sub">${s.essence}</div>
  </div>`;
  return pinShell(body, `zodiacs.org/${s.slug}/`);
}

function pinHoroscope(s) {
  const title = signName(s);
  const body = `
  <div class="pstage">
    <span class="kicker">${OG_EN.pin.horoscope.kicker}</span>
    <img class="disc" src="${DISCS[s.slug]}" width="400" height="400" style="box-shadow: 0 44px 130px ${s.hue}45;" />
    <div>
      <div class="display" style="font-size: ${nameSize(title) + 8}px;">${format(OG_EN.pin.horoscope.title, { sign: title })}</div>
      <div class="data" style="margin-top: 20px;">${s.dates}</div>
    </div>
    <div class="sub">${OG_EN.pin.horoscope.subtitle}</div>
  </div>`;
  return pinShell(body, `zodiacs.org/horoscopes/${s.slug}/`);
}

function pinHowTo() {
  const steps = Object.values(OG_EN.pin.howTo.steps)
    .map((t) => `<div class="data" style="font-size: 28px; color: ${INK2};">${t}</div>`)
    .join('');
  const body = `
  <div class="pstage" style="gap: 52px;">
    <span class="kicker">${OG_EN.pin.howTo.kicker}</span>
    ${wheelMark(300, 26)}
    <div class="display" style="font-size: 96px; max-width: 800px;">${OG_EN.pin.howTo.title}</div>
    <div style="display: grid; gap: 18px;">${steps}</div>
  </div>`;
  return pinShell(body, 'zodiacs.org/learn/how-to-read-a-birth-chart/');
}

await page.setViewportSize({ width: 1000, height: 1500 });
if (!onlyHoroscopes) {
  for (const s of SIGNS) await shoot(pinSign(s), `pin/${s.slug}.png`);
}
for (const s of SIGNS) await shoot(pinHoroscope(s), `pin/horoscope-${s.slug}.png`);
if (!onlyHoroscopes) await shoot(pinHowTo(), 'pin/how-to-read-a-birth-chart.png');

await writeEnglishManifest();

await browser.close();

const mb = total / 1024 / 1024;
console.log(`Done — ${count} cards, ${mb.toFixed(2)}MB → public/assets/og/v2/`);
if (mb > 25) {
  console.error('ABORT: generated v2 card set exceeds the 25MB budget — tighten the palette and rerun.');
  process.exit(1);
}
