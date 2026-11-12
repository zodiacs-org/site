import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(resolve(ROOT, 'public/thesis/index.html'), 'utf8');
const MANUSCRIPT = readFileSync(resolve(ROOT, 'zodiacs-thesis-v4.md'), 'utf8');

const CLAIMS = JSON.parse(readFileSync(resolve(ROOT, 'public/thesis/thesis-claims.json'), 'utf8'));
const CHARTS = JSON.parse(readFileSync(resolve(ROOT, 'public/thesis/thesis-charts.json'), 'utf8'));

// Edition Nº 10 is one essay in plain prose. Its sections carry no headings;
// they keep their ids so links published to the earlier editions still land.
const ESSAY_SECTION_IDS = [
  'everyone-has-a-sign',
  'where-the-signs-come-from',
  'attention',
  'what-holding-means',
  'the-public-record',
  'the-conclusion',
];

const ESSAY_FIGURE_IDS = ['fig-know', 'fig-1', 'fig-lifespan', 'fig-2', 'fig-provenance'];

const SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

const KEY_COPY = [
  'Before you had a username, you had a sign.',
  'Most memecoins do not last a day.',
  'A meme about a dog is about the dog. A meme about Scorpio is about you',
  'the copy will have the name without the history',
  'A memecoin can go to zero, and these can too.',
  'making the case that it should be this set.',
  'Choose the sign you already carry.',
];

function decodeEntities(value) {
  return value
    .replace(/&times;|&#215;|&#xd7;/gi, '×')
    .replace(/&#10003;|&#x2713;/gi, '✓')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function textOf(fragment) {
  return decodeEntities(fragment)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<span\b[^>]*class=["'][^"']*\bdc\b[^"']*["'][^>]*>([^<]+)<\/span>/gi, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function visibleTextOf(fragment) {
  const withoutScreenReaderLabels = fragment.replace(
    /<([a-z][\w-]*)\b[^>]*class=["'][^"']*\bsr-only\b[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
    ' ',
  );
  return textOf(withoutScreenReaderLabels);
}

function sliceElement(source, selectorPattern, tag) {
  const startMatch = source.match(selectorPattern);
  if (!startMatch || startMatch.index == null) return '';
  const tokens = new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi');
  tokens.lastIndex = startMatch.index;
  let depth = 0;
  let token;
  while ((token = tokens.exec(source))) {
    if (token[0].startsWith('</')) depth -= 1;
    else if (!token[0].endsWith('/>')) depth += 1;
    if (depth === 0) return source.slice(startMatch.index, tokens.lastIndex);
  }
  return '';
}

function sliceMatchedElement(source, selectorPattern) {
  const startMatch = source.match(selectorPattern);
  const tag = startMatch?.[0].match(/^<([a-z][\w-]*)\b/i)?.[1];
  return tag ? sliceElement(source, selectorPattern, tag) : '';
}

function tagParts(fragment, tag) {
  return [...fragment.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'gi'))]
    .map((match) => ({ attrs: match[1], inner: match[2], html: match[0] }));
}

function voidTagParts(fragment, tag) {
  return [...fragment.matchAll(new RegExp(`<${tag}\\b([^>]*)\\/?>`, 'gi'))]
    .map((match) => ({ attrs: match[1], html: match[0] }));
}

function classedDetailsRemoved(source) {
  return source.replace(
    /<details\b[^>]*class=["'][^"']*\bevidence-drawer\b[^"']*["'][^>]*>[\s\S]*?<\/details>/gi,
    (drawer) => drawer.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ?? ' ',
  );
}

function visibleEssayText() {
  let essay = sliceElement(HTML, /<article\b[^>]*\bid=["']essay["'][^>]*>/i, 'article');
  const evidenceVault = essay.search(/<details\b[^>]*class=["'][^"']*\bevidence-vault\b/i);
  if (evidenceVault !== -1) essay = essay.slice(0, evidenceVault);
  essay = classedDetailsRemoved(essay);
  return visibleTextOf(essay).toLowerCase();
}

/** The essay above the evidence vault, as HTML. */
function essayHtml() {
  const start = HTML.search(/<div\b[^>]*class=["']essay__body["'][^>]*>/i);
  const end = HTML.search(/<details\b[^>]*class=["'][^"']*\bevidence-vault\b/i);
  return start === -1 || end === -1 ? '' : HTML.slice(start, end);
}

/** The essay's running prose: no quoted post, no figures, no scripts. */
function essayProse() {
  return textOf(essayHtml()
    .replace(/<(blockquote|figure|script|style|svg)\b[\s\S]*?<\/\1>/gi, ' '));
}

const sentencesOf = (text) => text.split(/(?<=[.!?])\s+(?=[A-Z“"])/).map((s) => s.trim()).filter(Boolean);

describe('thesis Nº 10 editorial contract', () => {
  it('keeps the edition, the essay sections, and the source manuscript intact', () => {
    const htmlText = textOf(HTML).toLowerCase();
    const manuscriptText = MANUSCRIPT.replace(/[*_#>`]/g, ' ').replace(/\s+/g, ' ').toLowerCase();
    const sectionIds = [...essayHtml().matchAll(/<section\b[^>]*\bid=["']([^"']+)["']/gi)].map((m) => m[1]);

    expect(htmlText).toContain('nº 10');
    expect(htmlText).not.toContain('nº 09');
    expect(manuscriptText).toContain('nº 10');
    expect(sectionIds).toEqual(ESSAY_SECTION_IDS);
    expect(MANUSCRIPT).not.toMatch(/^##/m);
    for (const phrase of KEY_COPY) {
      expect(manuscriptText, `manuscript is missing: ${phrase}`).toContain(phrase.toLowerCase());
      expect(htmlText, `HTML is missing: ${phrase}`).toContain(phrase.toLowerCase());
    }
    expect(HTML).not.toMatch(/\bid=["']comparison-drawer["']/i);
  });

  it('keeps generic defensive language out of the visible reading path', () => {
    const visible = visibleEssayText();
    const rejected = [
      'young records',
      'attention is an input, never proof of demand',
      'demand is not proven',
      'not proof of demand',
      'not proof of lasting demand',
      'it does not show that they want these records',
      'that distinction is the honest center of the thesis',
      'these records must earn their own place',
      'whether people choose these particular records is still unproven',
      'none of it transfers to a token automatically',
      'this is not a replacement for bitcoin',
      'a young record with nothing hidden',
      'the questions we should ask',
      'the possibility is beautiful',
      'the outcome is not promised',
      'the technology becomes a smooth path beneath the story',
    ];
    for (const phrase of rejected) {
      expect(visible, `visible essay still contains: ${phrase}`).not.toContain(phrase);
    }
  });
});

describe('thesis publication metadata contract', () => {
  const hero = sliceElement(HTML, /<header\b[^>]*class=["'][^"']*\bhero\b[^"']*["'][^>]*>/i, 'header');

  it('keeps the visible publication dates exact and machine-readable', () => {
    const dates = tagParts(hero, 'time').map(({ attrs, inner }) => ({
      datetime: attrs.match(/\bdatetime=["']([^"']+)["']/i)?.[1] ?? '',
      label: textOf(inner),
    }));

    expect(dates).toEqual([
      { datetime: '2026-08-01', label: 'Published 1 Aug 2026' },
      { datetime: '2026-11-11', label: 'Updated 11 Nov 2026' },
    ]);
    expect(textOf(hero)).toContain('Evidence checked 10 Nov 2026');
  });

  it('publishes valid Article JSON-LD with matching canonical dates', () => {
    const jsonLd = tagParts(HTML, 'script')
      .filter(({ attrs }) => /\btype=["']application\/ld\+json["']/i.test(attrs));
    expect(jsonLd).toHaveLength(1);

    const data = JSON.parse(jsonLd[0].inner);
    const article = data['@graph']?.find((entry) => entry['@type'] === 'Article');
    expect(article).toMatchObject({
      '@id': 'https://zodiacs.org/thesis/#article',
      headline: 'Why Zodiacs Matter',
      url: 'https://zodiacs.org/thesis/',
      datePublished: '2026-08-01',
      dateModified: '2026-11-11',
    });
  });
});

describe('thesis hero icon contract', () => {
  const heroIcons = sliceElement(
    HTML,
    /<div\b[^>]*class=["'][^"']*\bhero__twelve\b[^"']*["'][^>]*>/i,
    'div',
  );

  it('uses the twelve canonical pastel icons in registry order', () => {
    const links = tagParts(heroIcons, 'a');
    expect(links).toHaveLength(12);
    expect(heroIcons).toMatch(/aria-label=["']The twelve digital assets["']/i);
    links.forEach(({ attrs, inner }, index) => {
      const slug = SIGNS[index];
      const label = `${slug[0].toUpperCase()}${slug.slice(1)} — digital asset`;
      expect(attrs).toMatch(new RegExp(`\\bhref=["']/registry/${slug}/["']`, 'i'));
      expect(attrs).toContain(`aria-label="${label}"`);
      expect(inner).toContain(`src="/assets/zodiac-icons/48/${slug}.webp"`);
      expect(inner).toMatch(/class="hero__twelve-icon"/);
      expect(inner).toMatch(/\bwidth="24"\s+height="24"/);
      expect(inner).toMatch(/\balt=""/);
      expect(inner).toMatch(/\baria-hidden="true"/);
    });
  });

  it('contains no platform-rendered zodiac emoji or legacy glyph spans', () => {
    expect(heroIcons).not.toMatch(/[♈♉♊♋♌♍♎♏♐♑♒♓]/u);
    expect(heroIcons).not.toContain('hero__twelve-glyph');
  });
});

describe('thesis hero background contract', () => {
  const hero = sliceElement(HTML, /<header\b[^>]*class=["'][^"']*\bhero\b[^"']*["'][^>]*>/i, 'header');

  it('keeps the ambient zodiac-clock video and its lightweight poster', () => {
    const videos = tagParts(hero, 'video');
    expect(videos).toHaveLength(1);
    expect(videos[0].attrs).toMatch(/class="hero__media"/);
    expect(videos[0].attrs).not.toMatch(/\bautoplay\b/);
    expect(videos[0].attrs).toMatch(/\bmuted\b/);
    expect(videos[0].attrs).toMatch(/\bloop\b/);
    expect(videos[0].attrs).toMatch(/\bplaysinline\b/);
    expect(videos[0].attrs).toContain('preload="none"');
    expect(videos[0].attrs).toContain('poster="/assets/art/zodiac-clock-768.avif"');
    expect(videos[0].attrs).toContain('fetchpriority="high"');
    expect(videos[0].inner).toContain('src="/assets/art/zodiac-clock.mp4"');
    expect(HTML).toContain('<link rel="preload" as="image" type="image/avif" href="/assets/art/zodiac-clock-768.avif" fetchpriority="high" />');
  });

  it('does not replace the moving background with a static canvas', () => {
    expect(hero).not.toContain('data-hero-art');
    expect(hero).not.toMatch(/<canvas\b/i);
  });
});

describe('thesis feedback simplification contract', () => {
  const attention = sliceElement(
    HTML,
    /<section\b[^>]*\bid=["']attention["'][^>]*>/i,
    'section',
  );
  const fig2 = sliceElement(attention, /<figure\b[^>]*\bid=["']fig-2["'][^>]*>/i, 'figure');
  const vault = sliceElement(
    HTML,
    /<details\b[^>]*class=["'][^"']*\bevidence-vault\b[^"']*["'][^>]*>/i,
    'details',
  );
  const audienceEvidence = sliceElement(
    vault,
    /<section\b[^>]*\bid=["']the-audience["'][^>]*>/i,
    'section',
  );
  const publicRecord = sliceElement(
    HTML,
    /<section\b[^>]*\bid=["']the-public-record["'][^>]*>/i,
    'section',
  );
  const close = sliceElement(
    HTML,
    /<div\b[^>]*\bid=["']the-honest-ending["'][^>]*>/i,
    'div',
  );

  it('keeps the audience and attention evidence in E5, below the essay, opened out', () => {
    expect(attention).not.toMatch(/<details\b/i);
    expect(fig2).not.toBe('');
    expect(audienceEvidence).not.toBe('');
    expect(textOf(audienceEvidence)).toContain('The audience and the calendar.');
    expect(audienceEvidence).toMatch(/class=["'][^"']*\bstats\b/i);
    expect([...audienceEvidence.matchAll(/\bdata-pulse(?:\s|>|=)/gi)]).toHaveLength(1);
    expect(audienceEvidence).toMatch(/\bid=["']pulse["']/i);
    expect(audienceEvidence).toMatch(/Live and committed data/i);
    // The stat tiles and the Pulse are plain content in E5, not a drawer inside the vault.
    const statsAndPulse = audienceEvidence.slice(0, audienceEvidence.indexOf('id="fig-keyboard"'));
    expect(statsAndPulse).not.toMatch(/<details\b/i);
    expect(audienceEvidence).toMatch(/\bid=["']fig-keyboard["']/i);
    expect(audienceEvidence).toMatch(/\bid=["']fig-3["']/i);
    expect(textOf(audienceEvidence)).toContain('See the dated historical timeline');
    expect(HTML).not.toMatch(/Co-Star|Statista|Tinder/);
    expect(attention).not.toMatch(/\btruth-panel\b/i);
  });

  it('exposes the committed measured chart without scripts or opening a drawer', () => {
    expect(fig2).not.toMatch(/<template\b|<details\b|\bhidden(?:\s|=|>)/i);
    const charts = tagParts(fig2, 'svg').filter(({ attrs }) => /\bdata-attention-chart\b/.test(attrs));
    expect(charts).toHaveLength(2);
    expect(charts.map(({ attrs }) => attrs)).toEqual(expect.arrayContaining([
      expect.stringContaining('attention-chart--wide'),
      expect.stringContaining('attention-chart--small'),
    ]));
    expect(fig2).toContain('href="/thesis/thesis-attention.json"');
    expect(textOf(fig2)).toContain('curiosity, not demand for the coins');
  });

  it('exposes dated adverse provenance before the complete history drawer', () => {
    const provenance = sliceElement(publicRecord, /<figure\b[^>]*\bid=["']fig-provenance["'][^>]*>/i, 'figure');
    const grid = sliceElement(provenance, /<div\b[^>]*class=["'][^"']*\bprovenance-grid\b[^"']*["'][^>]*>/i, 'div');
    const links = tagParts(grid, 'a');
    expect(provenance).not.toBe('');
    expect(provenance).not.toMatch(/<details\b/i);
    expect(links).toHaveLength(4);
    expect(links.map(({ attrs }) => attrs.match(/\bhref=["']([^"']+)["']/i)?.[1])).toEqual([
      'https://zodiacs.org/disclosure/#origin',
      'https://x.com/wantonwallet/status/1812520143638962302',
      'https://x.com/stoolpresidente/status/1891528769770279114',
      '/thesis/thesis-history.json',
    ]);
    expect(textOf(provenance)).toMatch(/2024-07-05.*2024-07-14.*2025-02-17.*2025-05-20/s);
    expect(textOf(provenance)).toMatch(/Concentration.*by mistake.*Dead bag/is);
    expect(textOf(provenance)).toContain('search link rather than an individual post receipt');
    // The complete history lives below the essay, in E4.
    const caseAgainst = sliceElement(vault, /<section\b[^>]*\bid=["']the-case-against["'][^>]*>/i, 'section');
    expect(textOf(caseAgainst)).toContain('See the complete dated history');
    expect(publicRecord).not.toMatch(/<details\b/i);
    expect(HTML).not.toMatch(/\bid=["']fig-4["']/i);
  });

  it('keeps the committed closing state fail-closed with catalogue and copy actions', () => {
    const links = tagParts(close, 'a');
    const buttons = tagParts(close, 'button');

    expect(links).toHaveLength(1);
    expect(links[0].attrs).toMatch(/\bdata-thesis-cta=["']catalogue["']/i);
    expect(links[0].attrs).toMatch(/\bhref=["']\/registry\/["']/i);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].attrs).toMatch(/\btype=["']button["']/i);
    expect(buttons[0].attrs).toMatch(/\bdata-thesis-copy-link\b/i);
    expect(buttons[0].inner).toMatch(/\bdata-thesis-copy-label\b/i);
    expect(close).toMatch(/<span\b(?=[^>]*\bdata-thesis-share-status\b)(?=[^>]*\baria-live=["']polite["'])[^>]*>/i);
    expect([...close.matchAll(/registry-collection-thesis:slot/g)]).toHaveLength(1);
    expect(close).not.toMatch(/\bdata-thesis-cta=["']collection["']/i);
    expect(HTML).not.toMatch(/href=["']\/registry\/collection\/?["']/i);
    expect(close).not.toMatch(/href=["']#the-twelve["']|href=["']\/registry\/#verify["']/i);
  });

  it('uses plain language on the closing actions', () => {
    expect(textOf(close)).toContain('Choose the sign you already carry.');
    expect(textOf(close)).toContain('Open the twelve coins');
    expect(textOf(close)).not.toContain('digital assets');
  });

  it('publishes no changelog section or changelog link', () => {
    expect(HTML).not.toMatch(/<section\b[^>]*\bid=["']changelog["']/i);
    expect(HTML).not.toMatch(/<a\b[^>]*\bhref=["']#changelog["']/i);
  });
});

describe('thesis catalogue icon contract', () => {
  const catalogue = sliceElement(
    HTML,
    /<section\b[^>]*\bid=["']the-twelve["'][^>]*>/i,
    'section',
  );

  it('uses the twelve official pastel icons in registry order', () => {
    const links = tagParts(catalogue, 'a');
    expect(links).toHaveLength(12);
    links.forEach(({ attrs, inner }, index) => {
      const slug = SIGNS[index];
      const images = voidTagParts(inner, 'img');
      expect(attrs).toMatch(new RegExp(`\\bhref=["']/registry/${slug}/["']`, 'i'));
      expect(images).toHaveLength(1);
      expect(images[0].attrs).toContain(`src="/assets/icons/${slug}.png"`);
      expect(images[0].attrs).toMatch(/\bclass=["'][^"']*\btwelve__glyph\b/);
      expect(inner).toMatch(/--glyph-w:\d+px;--glyph-h:\d+px/);
      expect(images[0].attrs).toMatch(/\bwidth="\d+"\s+height="\d+"/);
      expect(images[0].attrs).toMatch(/\balt=""/);
      expect(images[0].attrs).toMatch(/\baria-hidden="true"/);
      expect(textOf(inner)).toBe(`${slug[0].toUpperCase()}${slug.slice(1)}`);
    });
    expect(HTML).toMatch(/\.twelve__medallion\s*\{[^}]*inline-size:48px;[^}]*block-size:48px;[^}]*background:var\(--sign\)/s);
    expect(HTML).toMatch(/\.twelve__glyph\s*\{[^}]*inline-size:var\(--glyph-w\);[^}]*block-size:var\(--glyph-h\);[^}]*object-fit:contain;/s);
    expect(catalogue).not.toMatch(/\baf-glyph\b|\/assets\/astrofolio\//i);
    expect(textOf(catalogue)).toContain('lore, provenance & the listed digital asset.');
  });
});

describe('thesis Guide cache contract', () => {
  it('loads the quiet Guide shell from a versioned URL', () => {
    expect(HTML).toContain("import('/assets/assistant-ui.js?v=icon-guide-5')");
    expect(HTML).not.toContain("import('/assets/assistant-ui.js')");
  });
});

describe('thesis transmission and gallery contract', () => {
  const fig1 = sliceElement(HTML, /<figure\b[^>]*\bid=["']fig-1["'][^>]*>/i, 'figure');
  const eras = [...fig1.matchAll(
    /<div\b([^>]*class=["'][^"']*\bera\b[^"']*["'][^>]*)>([\s\S]*?)<\/div>/gi,
  )].map((match) => ({ attrs: match[1], inner: match[2], html: match[0] }));
  // The gallery left the essay in edition Nº 10; it sits just before the Twelve Catalogue.
  const holding = sliceElement(
    HTML,
    /<figure\b[^>]*\bdata-thesis-gallery\b[^>]*>/i,
    'figure',
  );
  const galleryTag = /<[a-z][^>]*\bdata-gallery-stage(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?[^>]*>/i;
  const gallery = sliceMatchedElement(holding, galleryTag);

  it('ends F1 with the canonical circle image and the word Coin', () => {
    expect(eras).toHaveLength(7);
    const finalEra = eras.at(-1);
    const name = sliceElement(
      finalEra?.inner ?? '',
      /<span\b[^>]*class=["'][^"']*\bera__name\b[^"']*["'][^>]*>/i,
      'span',
    );
    const time = sliceElement(
      finalEra?.inner ?? '',
      /<span\b[^>]*class=["'][^"']*\bera__time\b[^"']*["'][^>]*>/i,
      'span',
    );
    const images = voidTagParts(finalEra?.inner ?? '', 'img');

    expect(textOf(name)).toBe('Coin');
    expect(textOf(time)).toBe('5 Jul 2024');
    expect(images).toHaveLength(1);
    expect(images[0].attrs).toMatch(/\bsrc=["']\/assets\/app-icons\/v3\/icon-192\.png["']/i);
    expect(images[0].attrs).toMatch(/\balt=["']["']/i);
    expect(finalEra?.inner).not.toMatch(/<svg\b/i);
  });

  it('places one gallery outside the essay, just before the Twelve Catalogue', () => {
    const allGalleryTags = [...HTML.matchAll(new RegExp(galleryTag.source, 'gi'))];
    const galleryStart = HTML.indexOf(holding);
    const catalogueStart = HTML.search(/<section\b[^>]*\bid=["']the-twelve["']/i);
    const between = HTML.slice(galleryStart + holding.length, catalogueStart);

    expect(holding).not.toBe('');
    expect(allGalleryTags).toHaveLength(1);
    expect(gallery).not.toBe('');
    expect(essayHtml()).not.toMatch(/\bdata-thesis-gallery\b/i);
    expect(galleryStart).toBeGreaterThan(0);
    expect(catalogueStart).toBeGreaterThan(galleryStart);
    expect(between.trim()).toBe('');
  });

  it('removes the gallery display labels while retaining an accessible figure and stage name', () => {
    const galleryFigure = sliceElement(
      holding,
      /<figure\b[^>]*\bdata-thesis-gallery\b[^>]*>/i,
      'figure',
    );
    const stageAttrs = gallery.match(/^<[a-z][^>]*>/i)?.[0] ?? '';
    const caption = tagParts(galleryFigure, 'figcaption');

    expect(galleryFigure).not.toBe('');
    expect(caption).toHaveLength(1);
    expect(caption[0].attrs).toMatch(/\bclass=["'][^"']*\bsr-only\b/i);
    expect(galleryFigure).not.toMatch(/\bthesis-gallery__head\b/i);
    expect(galleryFigure).not.toMatch(/\bgband__fallback-title\b/i);
    expect(visibleTextOf(galleryFigure)).not.toMatch(/\bthe gallery\b|\bgold sculptures\b/i);
    expect(stageAttrs).toMatch(/\baria-label=["'][^"']+["']/i);
    expect(stageAttrs).not.toMatch(/\bthe gallery\b|\bgold sculptures\b/i);
  });

  it('keeps exactly twelve linked fallback records inside the gallery', () => {
    const fallback = sliceMatchedElement(
      gallery,
      /<[a-z][^>]*\bdata-gallery-fallback(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?[^>]*>/i,
    );
    const links = tagParts(fallback, 'a')
      .filter(({ attrs }) => /\bdata-gallery-fallback-record\b/i.test(attrs));
    const images = voidTagParts(fallback, 'img');

    expect(fallback).not.toBe('');
    expect(links).toHaveLength(12);
    expect(images).toHaveLength(12);
    links.forEach(({ attrs, inner }, index) => {
      const slug = SIGNS[index];
      const image = voidTagParts(inner, 'img');
      const ariaLabel = attrs.match(/\baria-label=["']([^"']*)["']/i)?.[1] ?? '';
      const imageAlt = image[0]?.attrs.match(/\balt=["']([^"']*)["']/i)?.[1] ?? '';
      const accessibleCopy = `${ariaLabel} ${imageAlt} ${textOf(inner)}`;

      expect(attrs).toMatch(new RegExp(`\\bhref=["']/registry/${slug}/["']`, 'i'));
      expect(image).toHaveLength(1);
      expect(image[0].attrs).toMatch(new RegExp(
        `\\bsrc=["']/assets/nuggets/thumb/${slug}\\.png["']`,
        'i',
      ));
      expect(accessibleCopy).toMatch(new RegExp(slug, 'i'));
    });
  });

  it('references the gallery bundle only from a viewport-lazy loader', () => {
    const loaders = tagParts(HTML, 'script')
      .filter(({ attrs, inner }) => /\/assets\/gallery\.js/.test(`${attrs} ${inner}`));

    expect(loaders).toHaveLength(1);
    expect(loaders[0].attrs).not.toMatch(/\bsrc=["']\/assets\/gallery\.js["']/i);
    expect(loaders[0].inner).toContain('/assets/gallery.js');
    expect(loaders[0].inner).toMatch(/\bIntersectionObserver\b/);
    expect(HTML).not.toMatch(/<script\b[^>]*\bsrc=["']\/assets\/gallery\.js["'][^>]*>/i);
  });
});

describe('thesis real-use proof and honest-limitation contract', () => {
  // The Leo check moved below the essay, into E3, in edition Nº 10.
  const instrument = sliceElement(
    HTML,
    /<section\b[^>]*\bid=["']the-instrument["'][^>]*>/i,
    'section',
  );
  const proof = sliceElement(
    instrument,
    /<aside\b[^>]*\bdata-real-use-proof\b[^>]*>/i,
    'aside',
  );

  it('shows one three-link Leo proof using the same exact mint', () => {
    const mint = '8Cd7wXoPb5Yt9cUGtmHNqAEmpMDrhfcVqnGbLC48b8Qm';
    const links = tagParts(proof, 'a');
    const hrefs = links.map(({ attrs }) => (
      attrs.match(/\bhref=["']([^"']+)["']/i)?.[1] ?? ''
    ));

    expect([...HTML.matchAll(/\bdata-real-use-proof\b/g)]).toHaveLength(1);
    expect(proof).not.toBe('');
    expect(proof).toMatch(/\baria-labelledby=["']proof-loop-title["']/i);
    expect(proof).toMatch(/<h3\b[^>]*\bid=["']proof-loop-title["'][^>]*>Leo, checked in three places\.<\/h3>/i);
    expect(hrefs).toEqual([
      '/registry/leo/',
      `https://explorer.solana.com/address/${mint}`,
      `https://www.solflare.com/prices/leo/${mint}/`,
    ]);
    links.slice(1).forEach(({ attrs }) => {
      expect(attrs).toMatch(/\brel=["'][^"']*\bnoopener\b[^"']*\bnoreferrer\b[^"']*["']/i);
    });
    expect(tagParts(proof, 'code').map(({ inner }) => textOf(inner))).toEqual([mint]);
    expect(textOf(proof)).toContain('Check one exact mint independently across three public surfaces.');
    expect(textOf(proof)).toContain('Solflare is a third-party wallet surface. This demonstrates wallet recognition of the mint; it does not show that Solflare consumes the Zodiacs Registry or SDK.');
  });

  it('keeps the desktop proof loop full-width with copy below its fixed controls', () => {
    expect(HTML).toMatch(/\.proof-loop__steps\s*\{[^}]*\bwidth\s*:\s*100%[^}]*\bmax-width\s*:\s*none/isu);
    expect(HTML).toMatch(/\.proof-loop__step\s*\{[^}]*grid-template-columns\s*:\s*40px\s+minmax\(0,1fr\)\s+28px[^}]*grid-template-rows\s*:\s*auto\s+40px\s+auto/isu);
    expect(HTML).toMatch(/\.proof-loop__copy\s*\{[^}]*grid-column\s*:\s*1\s*\/\s*-1[^}]*grid-row\s*:\s*3/isu);
  });

  it('states the doubts once, in one paragraph that points to the scoreboard', () => {
    const conclusion = sliceElement(HTML, /<section\b[^>]*\bid=["']the-conclusion["'][^>]*>/i, 'section');
    const doubts = tagParts(conclusion, 'p')[0];

    expect(HTML).not.toMatch(/\bdata-honest-limitation\b/);
    expect(textOf(doubts?.inner ?? '')).toMatch(/^A memecoin can go to zero, and these can too\./);
    expect(textOf(doubts?.inner ?? '')).toContain('No outside app has adopted them yet.');
    expect(doubts?.inner).toContain('href="#the-candidacy"');
  });
});

describe('thesis schematic curves (E5)', () => {
  const fig3 = sliceElement(HTML, /<figure\b[^>]*\bid=["']fig-3["'][^>]*>/i, 'figure');
  const patterns = sliceElement(fig3, /<div\b[^>]*class=["'][^"']*\battention-patterns\b[^"']*["'][^>]*>/i, 'div');

  it('labels all four attention curves as schematic rather than measured performance', () => {
    const charts = tagParts(patterns, 'svg');
    expect(charts).toHaveLength(4);
    for (const { attrs } of charts) {
      expect(attrs).toMatch(/\brole=["']img["']/i);
      expect(attrs).toMatch(/\baria-label=["']Schematic/i);
    }
    expect(textOf(fig3)).toContain('These curves are illustrative, not measured coin performance.');
    expect(fig3).toContain('href="#fig-2"');
    expect([...charts.at(-1).inner.matchAll(/\bstroke=["']#[a-f0-9]{6}["']/gi)]).toHaveLength(12);
  });

  it('has no gold, Bitcoin and Zodiacs comparison anywhere on the page', () => {
    expect(HTML).not.toMatch(/\bid=["']comparison-drawer["']/i);
    expect(HTML).not.toMatch(/<table\b[^>]*class=["'][^"']*\bztbl\b/i);
    expect(HTML).not.toMatch(/gold\.org|bitcoin\.org/i);
  });
});

describe('thesis keyboard and authority figures', () => {
  it('prints all twelve Unicode code points with the dated Unicode source', () => {
    const keyboard = sliceElement(HTML, /<figure\b[^>]*\bid=["']fig-keyboard["'][^>]*>/i, 'figure');
    const symbols = tagParts(keyboard, 'svg');
    expect(symbols).toHaveLength(12);
    symbols.forEach(({ attrs, inner }, index) => {
      const codePoint = `U+${(0x2648 + index).toString(16).toUpperCase()}`;
      expect(attrs).toMatch(/\brole=["']img["']/i);
      expect(textOf(inner)).toContain(codePoint);
      expect(textOf(inner)).toContain('June 1993');
    });
    expect(keyboard).toContain('https://www.unicode.org/Public/17.0.0/ucd/DerivedAge.txt');
    expect(keyboard).toContain('https://www.unicode.org/versions/Unicode1.1.0/');
  });

  it('keeps ownership records available in a drawer that starts closed', () => {
    const holding = sliceElement(HTML, /<section\b[^>]*\bid=["']the-instrument["'][^>]*>/i, 'section');
    const drawer = sliceElement(holding, /<details\b[^>]*\bid=["']ownership-details["'][^>]*>/i, 'details');
    const openingTag = drawer.match(/^<details\b[^>]*>/i)?.[0] ?? '';
    expect(openingTag).toMatch(/\bclass=["'][^"']*\bevidence-drawer\b/);
    expect(openingTag).not.toMatch(/\sopen(?:\s|=|>)/i);
    expect(textOf(tagParts(drawer, 'summary')[0]?.inner ?? '')).toBe('See the supply and ownership records');
    expect(drawer).toContain('id="fig-authorities"');
    expect(textOf(drawer)).toContain('The people who made these coins gave up the power to make more or to freeze yours.');
    expect(textOf(drawer)).toContain('We do hold some of these coins ourselves');
    const readingFlow = classedDetailsRemoved(holding);
    expect(readingFlow).not.toContain('id="fig-authorities"');
    expect(textOf(readingFlow)).not.toContain('gave up the power to make more');
  });

  it('copies recorded pool burns without treating unspecified percentages as complete', () => {
    const authorities = sliceElement(HTML, /<figure\b[^>]*\bid=["']fig-authorities["'][^>]*>/i, 'figure');
    const disclosure = JSON.parse(readFileSync(resolve(ROOT, 'public/thesis/thesis-disclosure.json'), 'utf8'));
    const labels = tagParts(authorities, 'text')
      .filter(({ attrs }) => /class=["']plate-value["']/i.test(attrs))
      .map(({ inner }) => textOf(inner));
    expect(labels).toEqual(SIGNS.map((sign) => (
      disclosure.signs[sign].liquidity.value.match(/LP (\d+(?:\.\d+)?%) burned/)?.[1] ?? '% not stated'
    )));
    expect(textOf(authorities)).toContain('burns are not uniformly complete');
    expect(textOf(authorities)).toContain('Our own statement, not an audit. We hold some of these coins ourselves.');
    expect(textOf(authorities)).toContain('23 Jul 2026');
    expect(textOf(authorities)).toContain('14 Jul 2026');
    expect(authorities).toContain('href="/thesis/thesis-disclosure.json"');
    expect(authorities).not.toMatch(/\bdata-field=/i);
  });
});

describe('thesis evidence-vault and sharing contract', () => {
  const vault = sliceElement(
    HTML,
    /<details\b[^>]*class=["'][^"']*\bevidence-vault\b[^"']*["'][^>]*>/i,
    'details',
  );
  const close = sliceElement(
    HTML,
    /<div\b[^>]*\bid=["']the-honest-ending["'][^>]*>/i,
    'div',
  );

  it('keeps the complete appendix inside the evidence vault and closes afterward', () => {
    const appendixIds = [
      'appendix',
      'reading-the-instrument',
      'why-solana-why-base',
      'methodology',
      'verify',
    ];

    expect(vault).not.toBe('');
    for (const id of appendixIds) {
      expect([...HTML.matchAll(new RegExp(`\\bid=["']${id}["']`, 'gi'))]).toHaveLength(1);
      expect(vault).toMatch(new RegExp(`<section\\b[^>]*\\bid=["']${id}["']`, 'i'));
    }

    const vaultEnd = HTML.indexOf(vault) + vault.length;
    const closeStart = HTML.indexOf(close);
    expect(close).not.toBe('');
    expect(closeStart).toBeGreaterThanOrEqual(vaultEnd);
    expect(vault).not.toContain('id="the-honest-ending"');
  });

  it('opens collapsed evidence for deep links and wires canonical-link copying', () => {
    const behavior = tagParts(HTML, 'script')
      .filter(({ inner }) => inner.includes('function exposeHashTarget()'));

    expect(behavior).toHaveLength(1);
    expect(behavior[0].inner).toContain("location.hash.slice(1)");
    expect(behavior[0].inner).toContain('document.getElementById(decodeURIComponent(id))');
    expect(behavior[0].inner).toContain("node.tagName === 'DETAILS'");
    expect(behavior[0].inner).toContain('details.open = true');
    expect(behavior[0].inner).toContain("window.addEventListener('hashchange', exposeHashTarget)");
    expect(behavior[0].inner).toContain("document.querySelector('[data-thesis-copy-link]')");
    expect(behavior[0].inner).toContain("document.querySelector('[data-thesis-share-status]')");
    expect(behavior[0].inner).toContain("document.querySelector('link[rel=\"canonical\"]')");
    expect(behavior[0].inner).toContain('navigator.clipboard.writeText(url)');
    expect(behavior[0].inner).toContain("button.addEventListener('click'");
    expect(behavior[0].inner).toContain("document.execCommand('copy')");
  });
});

describe('thesis disclosure compatibility contract', () => {
  it.each(['the-candidacy', 'the-test', 'the-instrument'])('preserves section #%s', (id) => {
    expect(HTML).toMatch(new RegExp(`<section\\b[^>]*\\bid=["']${id}["'][^>]*>`, 'i'));
  });

  it('preserves all 114 baked disclosure field slots', () => {
    expect([...HTML.matchAll(/\bdata-field=["'][^"']+["']/g)]).toHaveLength(114);
  });
});

// ── The pass bar for edition Nº 10 (Linear ZOD-41). Each check below has been
// seen to fail on a one-line change before it was trusted. ──
describe('thesis pass bar', () => {
  const essay = essayHtml();
  const prose = essayProse();
  const proseLower = prose.toLowerCase();
  const essayVisible = visibleTextOf(essay);
  const count = (text, phrase) => text.split(phrase).length - 1;

  it('1. ledger: every sentence with a number has a claim, and every claim is printed', () => {
    const NUMBER_PHRASES = ['one in four', 'nine in ten', 'one in twenty', 'three million', 'five languages', 'third year', 'two years', 'ninety days'];
    const matches = CLAIMS.claims.map((claim) => claim.match.toLowerCase());
    for (const sentence of sentencesOf(prose)) {
      const lower = sentence.toLowerCase();
      if (!/\d/.test(sentence) && !NUMBER_PHRASES.some((phrase) => lower.includes(phrase))) continue;
      expect(matches.some((match) => lower.includes(match)), `no claim covers: ${sentence}`).toBe(true);
    }
    const pageText = textOf(HTML);
    for (const claim of CLAIMS.claims) {
      expect(pageText, `claim ${claim.id} is not on the page`).toContain(claim.match);
      expect(CLAIMS.statuses).toContain(claim.status);
    }
    expect(new Set(CLAIMS.claims.map((claim) => claim.id)).size).toBe(CLAIMS.claims.length);
    expect(HTML).toContain('href="/thesis/thesis-claims.json"');
  });

  it('2. no price language in the essay', () => {
    const banned = [/\brall(?:y|ies)\b/i, /\bpump\b(?!\.fun)/i, /to the moon/i, /\bportfolio/i, /store of value/i,
      /\bundervalued\b/i, /\bupside\b/i, /\binvest\w*/i, /\bprofit\w*/i, /\bbullish\b/i, /price target/i,
      /market cap/i, /\b100x\b/i];
    for (const pattern of banned) expect(prose, `price language: ${pattern}`).not.toMatch(pattern);
  });

  it('3. one name: no asset jargon or gold and Bitcoin above the evidence', () => {
    for (const pattern of [/\bdigital assets?\b/i, /\binstrument\b/i, /\bcandidacy\b/i, /\bstanding\b/i, /\bunits\b/i, /\bgold\b/i, /\bbitcoin\b/i]) {
      expect(essayVisible, `essay says ${pattern}`).not.toMatch(pattern);
    }
  });

  it('4. said early: "coin" is in the first 60 words after the hero', () => {
    expect(essayVisible.split(/\s+/).slice(0, 60).join(' ').toLowerCase()).toMatch(/\bcoins?\b/);
  });

  it('5. pure prose: no headings, drawers, asides or lists, one quote, five figures', () => {
    for (const tag of ['h2', 'h3', 'h4', 'details', 'aside', 'ul', 'ol']) {
      expect(essay, `essay has <${tag}>`).not.toMatch(new RegExp(`<${tag}\\b`, 'i'));
    }
    expect([...essay.matchAll(/<blockquote\b/gi)]).toHaveLength(1);
    expect([...essay.matchAll(/<figure\b[^>]*\bid=["']([^"']+)["']/gi)].map((m) => m[1])).toEqual(ESSAY_FIGURE_IDS);
  });

  it('6. length: 1,100 words or fewer, not counting the quote and figures', () => {
    expect(prose.split(/\s+/).length).toBeLessThanOrEqual(1100);
  });

  it('7. reading level: Flesch-Kincaid grade 11 or below', () => {
    const words = prose.match(/[A-Za-z’']+/g) ?? [];
    const syllables = words.reduce((sum, word) => {
      const w = word.toLowerCase().replace(/[’']/g, '');
      let n = (w.match(/[aeiouy]+/g) ?? []).length;
      if (/[^l]e$/.test(w)) n -= 1;
      return sum + Math.max(1, n);
    }, 0);
    const grade = 0.39 * (words.length / sentencesOf(prose).length) + 11.8 * (syllables / words.length) - 15.59;
    expect(grade, `grade ${grade.toFixed(1)}`).toBeLessThanOrEqual(11);
  });

  it('8. fresh: evidence and chart data within 30 days of "Updated"', () => {
    const hero = sliceElement(HTML, /<header\b[^>]*class=["'][^"']*\bhero\b[^"']*["'][^>]*>/i, 'header');
    const updated = [...hero.matchAll(/<time\b[^>]*datetime=["']([^"']+)["']/gi)][1]?.[1];
    const checked = textOf(hero).match(/Evidence checked (\d{1,2} [A-Z][a-z]{2} \d{4})/)?.[1];
    const days = (a, b) => (Date.parse(b) - Date.parse(a)) / 86_400_000;
    expect(updated).toBeTruthy();
    expect(checked).toBeTruthy();
    const evidenceAge = days(new Date(`${checked} UTC`).toISOString().slice(0, 10), updated);
    expect(evidenceAge, `evidence checked ${checked}, updated ${updated}`).toBeGreaterThanOrEqual(0);
    expect(evidenceAge, `evidence checked ${checked}, updated ${updated}`).toBeLessThanOrEqual(30);
    for (const date of [CHARTS.know.checkedAt, CHARTS.lifespan.checkedAt, CHARTS.twelve.checkedAt].filter(Boolean)) {
      expect(Math.abs(days(date, updated)), `chart data checked ${date}`).toBeLessThanOrEqual(30);
    }
  });

  it('9. no em or en dashes in the essay, figures included', () => {
    const outsideGenerated = essay.replace(/<!-- thesis-attention-figure:begin -->[\s\S]*?<!-- thesis-attention-figure:end -->/, ' ');
    expect(visibleTextOf(outsideGenerated)).not.toMatch(/[—–]/);
  });

  it('10. said once: each doubt and the disclosure appear once, and the ending is the approved one', () => {
    expect(count(proseLower, 'fall to zero')).toBe(1);
    expect(count(proseLower, 'go to zero')).toBe(1);
    expect(count(proseLower, 'hold some')).toBe(1);
    expect(prose.trim().endsWith('making the case that it should be this set.')).toBe(true);
    expect(essay).not.toMatch(/href=["']\/race\//i);
    expect(essayVisible).not.toMatch(/What is the same as any memecoin|What comes with them|How we could be wrong|Questions a skeptic asks/i);
  });

  it('11. no slop: banned words, phrases and patterns from the "No AI slop" skill', () => {
    const words = ['delve', 'foster', 'leverage', 'utilize', 'facilitate', 'empower', 'streamline', 'robust', 'cutting-edge',
      'paradigm shift', 'game changer', 'tapestry', 'realm', 'beacon', 'multifaceted', 'meticulous', 'intricate', 'paramount',
      'transformative', 'elevate', 'embark', 'supercharge', 'harness', 'ever-evolving'];
    const phrases = ["it's worth noting", 'it is worth noting', 'at the end of the day', 'at its core', "in today's world",
      'the reality is', 'the truth is', "here's the thing", 'let me be clear', 'what most people get wrong', 'in conclusion', 'ultimately'];
    for (const word of words) expect(proseLower, `banned word: ${word}`).not.toMatch(new RegExp(`\\b${word}\\b`));
    for (const phrase of phrases) expect(proseLower.replace(/’/g, "'"), `banned phrase: ${phrase}`).not.toContain(phrase);
    // (a) "it is not X, it is Y" turns
    expect(prose).not.toMatch(/\b(?:is|are|was|were)(?:n[’']t| not) (?:just |only |merely )?[^.]{1,60}[.,;] (?:it|this|that|they)(?:[’']s| is| are)\b/i);
    // (b) dramatic fragments
    for (const sentence of sentencesOf(prose)) {
      expect(sentence, `fragment: ${sentence}`).not.toMatch(/^(?:And|That[’']s)\b(?:\S+\s?){0,3}$/);
    }
    // (c) rhetorical questions, (d) colon reveals
    expect(prose).not.toContain('?');
    expect(prose).not.toMatch(/:\s+[a-z]/);
    // (e) empty intensifiers
    expect(prose).not.toMatch(/\b(?:honestly|genuinely|literally|fundamentally|crucially)\b/i);
  });

  it('12. the two bar charts match their data file', () => {
    const run = spawnSync(process.execPath, ['scripts/build-thesis-charts.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);
    const lifespan = sliceElement(HTML, /<figure\b[^>]*\bid=["']fig-lifespan["'][^>]*>/i, 'figure');
    const shown = textOf(lifespan).match(/(\d+) of 12/)?.[1];
    if (CHARTS.twelve.tradedInWindow === null) expect(shown).toBeUndefined();
    else expect(Number(shown)).toBe(CHARTS.twelve.tradedInWindow);
    expect(textOf(lifespan)).toContain('counted trades on Pump.fun only');
    expect(textOf(lifespan)).not.toMatch(/\$\d|market cap|price/i);
  });
});
