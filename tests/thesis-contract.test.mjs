import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = readFileSync(resolve(ROOT, 'public/thesis/index.html'), 'utf8');
const MANUSCRIPT = readFileSync(resolve(ROOT, 'zodiacs-thesis-v4.md'), 'utf8');

const MATRIX = [
  ['Millennia of history', '✓', '×', '✓'],
  ['Ancient mythology and symbolism', '✓', '×', '✓'],
  ['Identity from birth', '×', '×', '✓'],
  ['Scarcity', '✓', '✓', '✓'],
  ['Fixed supply', '×', '✓', '✓'],
  ['Public verification', '×', '✓', '✓'],
  ['Digital ownership', '×', '✓', '✓'],
  ['Permissionless online transfer', '×', '✓', '✓'],
  ['Programmable', '×', '✓', '✓'],
  ['Base-layer settlement in seconds', '×', '×', '✓'],
  ['Built-in monthly cultural seasonality', '×', '×', '✓'],
  ['Everyday cultural participation', '×', '×', '✓'],
];

const MANUSCRIPT_MOVEMENTS = [
  'The sign you already carry',
  'A story that survived every medium',
  'Ownership becomes personal',
  'Modern rails',
  'Something you can carry',
];

const HTML_MOVEMENTS = [
  'The sign you already carry',
  'A story that survived every medium',
  'Attention arrives on a schedule',
  'Twelve, not one',
  'A gift you can keep',
  'Two years in the open',
  'The next medium is ownership',
];

const SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

const KEY_COPY = [
  'Bitcoin proved digital ownership could be public and self-custodied. Zodiacs makes it personal.',
  'Before you had a username, you had a sign.',
  'Gold provides the sculptural language. Bitcoin made ownership digital. Solana makes it fast and efficient. Zodiacs brings those qualities to a sign people already know.',
  'Choose your sign. See the digital asset. Decide what it means to you.',
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

describe('thesis Nº 09 editorial contract', () => {
  it('keeps the edition, current essay movements, and source manuscript intact', () => {
    const htmlText = textOf(HTML).toLowerCase();
    const manuscriptText = MANUSCRIPT.replace(/[*_#>`]/g, ' ').replace(/\s+/g, ' ').toLowerCase();
    const htmlMovements = tagParts(HTML, 'h2')
      .filter(({ attrs }) => /class=["'][^"']*\bmov__title\b/i.test(attrs))
      .slice(0, 7)
      .map(({ inner }) => textOf(inner).replace(/\.$/, ''));
    const manuscriptMovements = [...MANUSCRIPT.matchAll(/^## Part [IVX]+\.\s+(.+)$/gm)]
      .slice(0, 5)
      .map((match) => match[1].replace(/[*_]/g, '').replace(/\.$/, ''));

    expect(htmlText).toContain('nº 09');
    expect(manuscriptText).toContain('nº 09');
    expect(htmlMovements).toEqual(HTML_MOVEMENTS);
    expect(manuscriptMovements).toEqual(MANUSCRIPT_MOVEMENTS);
    for (const phrase of KEY_COPY) {
      expect(manuscriptText, `manuscript is missing: ${phrase}`).toContain(phrase.toLowerCase());
    }
    for (const phrase of HTML_MOVEMENTS) {
      expect(htmlText, `HTML is missing: ${phrase}`).toContain(phrase.toLowerCase());
    }
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
      { datetime: '2026-09-05', label: 'Updated 5 Sep 2026' },
    ]);
    expect(textOf(hero)).toContain('Evidence checked 31 Jul 2026');
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
      dateModified: '2026-09-05',
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
  const audienceEvidence = sliceElement(
    attention,
    /<details\b[^>]*class=["'][^"']*\bevidence-drawer\b[^"']*["'][^>]*>\s*<summary\b[^>]*>Audience &amp; attention evidence<\/summary>/i,
    'details',
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

  it('merges the Part III audience and attention material into one evidence drawer', () => {
    const drawers = [...attention.matchAll(
      /<details\b[^>]*class=["'][^"']*\bevidence-drawer\b[^"']*["'][^>]*>/gi,
    )];

    expect(drawers).toHaveLength(1);
    expect(fig2).not.toMatch(/<details\b/i);
    expect(audienceEvidence).not.toBe('');
    expect(textOf(tagParts(audienceEvidence, 'summary')[0]?.inner ?? ''))
      .toBe('Audience & attention evidence');
    expect(audienceEvidence).toMatch(/class=["'][^"']*\bstats\b/i);
    expect([...audienceEvidence.matchAll(/\bdata-pulse(?:\s|>|=)/gi)]).toHaveLength(1);
    expect(audienceEvidence).toMatch(/Live and committed data/i);
    expect(attention.indexOf(audienceEvidence)).toBeGreaterThan(attention.indexOf(fig2));
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
    expect(publicRecord.indexOf(provenance)).toBeLessThan(publicRecord.indexOf('id="fig-4"'));
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

  it('uses digital-asset language on the closing actions', () => {
    expect(textOf(close)).toContain('Choose the sign you already carry.');
    expect(textOf(close)).toContain('Open the twelve digital assets');
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
  const holding = sliceElement(
    HTML,
    /<section\b[^>]*\bid=["']what-holding-means["'][^>]*>/i,
    'section',
  );
  const galleryTag = /<[a-z][^>]*\bdata-gallery-stage(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?[^>]*>/i;
  const gallery = sliceMatchedElement(holding, galleryTag);

  it('ends F1 with the canonical circle image and exact digital-asset copy', () => {
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

    expect(textOf(name)).toBe('Digital asset');
    expect(textOf(time)).toBe('5 Jul 2024');
    expect(images).toHaveLength(1);
    expect(images[0].attrs).toMatch(/\bsrc=["']\/assets\/app-icons\/v3\/icon-192\.png["']/i);
    expect(images[0].attrs).toMatch(/\balt=["']["']/i);
    expect(finalEra?.inner).not.toMatch(/<svg\b/i);
  });

  it('places one gallery after the Section V network evidence drawer', () => {
    const allGalleryTags = [...HTML.matchAll(new RegExp(galleryTag.source, 'gi'))];
    const sectionGalleryTags = [...holding.matchAll(new RegExp(galleryTag.source, 'gi'))];
    const drawer = sliceElement(
      holding,
      /<details\b[^>]*class=["'][^"']*\bevidence-drawer\b[^"']*["'][^>]*>/i,
      'details',
    );
    const drawerEnd = holding.indexOf(drawer) + drawer.length;
    const galleryStart = holding.indexOf(gallery);

    expect(holding).not.toBe('');
    expect(drawer).not.toBe('');
    expect(allGalleryTags).toHaveLength(1);
    expect(sectionGalleryTags).toHaveLength(1);
    expect(gallery).not.toBe('');
    expect(galleryStart).toBeGreaterThanOrEqual(drawerEnd);
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
  const holding = sliceElement(
    HTML,
    /<section\b[^>]*\bid=["']what-holding-means["'][^>]*>/i,
    'section',
  );
  const proof = sliceElement(
    holding,
    /<aside\b[^>]*\bdata-real-use-proof\b[^>]*>/i,
    'aside',
  );
  const publicRecord = sliceElement(
    HTML,
    /<section\b[^>]*\bid=["']the-public-record["'][^>]*>/i,
    'section',
  );
  const limitation = sliceElement(
    publicRecord,
    /<aside\b[^>]*\bdata-honest-limitation\b[^>]*>/i,
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
    expect(proof).toMatch(/<h3\b[^>]*\bid=["']proof-loop-title["'][^>]*>Leo matches across Registry, explorer, and wallet\.<\/h3>/i);
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

  it('keeps exactly one honest limitation in the visible essay', () => {
    const visible = visibleEssayText();
    const exactLimitation = 'Independent adoption had not arrived. The scoreboard prints both.';

    expect([...HTML.matchAll(/\bdata-honest-limitation\b/g)]).toHaveLength(1);
    expect(limitation).not.toBe('');
    expect(limitation).not.toMatch(/<details\b/i);
    expect(textOf(limitation)).toContain('What remains unproven');
    expect(textOf(limitation)).toContain('The assets are listed and transferable. Their broader standing still has to be earned.');
    expect(textOf(limitation)).toContain(exactLimitation);
    expect(textOf(limitation)).toContain('All twelve tracked pools were live on 23 July 2026.');
    expect(limitation).toContain('href="/thesis/thesis-candidacy.json"');
    expect((visible.match(/independent adoption had not arrived\./g) ?? [])).toHaveLength(1);
  });
});

describe('Gold, Bitcoin, and Zodiacs comparison contract', () => {
  const fig3 = sliceElement(HTML, /<figure\b[^>]*\bid=["']fig-3["'][^>]*>/i, 'figure');
  const patterns = sliceElement(fig3, /<div\b[^>]*class=["'][^"']*\battention-patterns\b[^"']*["'][^>]*>/i, 'div');
  const table = sliceElement(fig3, /<table\b[^>]*class=["'][^"']*\bztbl\b[^"']*["'][^>]*>/i, 'table');
  const drawer = sliceElement(fig3, /<details\b[^>]*\bid=["']comparison-drawer["'][^>]*>/i, 'details');

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

  it('retains the bullion-bar mark in the comparison table', () => {
    expect([...table.matchAll(/\bdata-icon=["']gold-bar["']/gi)]).toHaveLength(1);
    expect([...table.matchAll(/\bdata-gold-bar\b/gi)]).toHaveLength(1);
  });

  it('keeps the complete comparison in a closed evidence drawer', () => {
    expect(fig3).not.toBe('');
    expect(table).not.toBe('');
    expect(drawer).not.toBe('');
    expect(drawer.match(/^<details\b[^>]*>/i)?.[0]).not.toMatch(/\bopen(?:\s|=|>)/i);
    expect(drawer).toContain(table);
    expect(fig3).toMatch(/class=["'][^"']*\bcomparison-panel\b/);
  });

  it('uses accessible column and row headers for exactly twelve approved properties', () => {
    const thead = sliceElement(table, /<thead\b[^>]*>/i, 'thead');
    const tbody = sliceElement(table, /<tbody\b[^>]*>/i, 'tbody');
    const columnHeaders = tagParts(thead, 'th');
    const rows = tagParts(tbody, 'tr');

    expect(columnHeaders).toHaveLength(4);
    expect(columnHeaders.every(({ attrs }) => /\bscope=["']col["']/i.test(attrs))).toBe(true);
    expect(columnHeaders.map(({ inner }) => textOf(inner))).toEqual(['Property', 'Gold', '₿ Bitcoin', 'Zodiacs']);
    expect(rows).toHaveLength(12);
    expect(textOf(tagParts(table, 'caption')[0]?.inner ?? '')).toMatch(/twelve yes-or-no properties/i);
    expect(rows.map(({ inner }) => textOf(tagParts(inner, 'th')[0]?.inner ?? '')))
      .toEqual(MATRIX.map(([property]) => property));
    for (const { inner } of rows) {
      const rowHeaders = tagParts(inner, 'th');
      expect(rowHeaders).toHaveLength(1);
      expect(rowHeaders[0].attrs).toMatch(/\bscope=["']row["']/i);
      const rowId = rowHeaders[0].attrs.match(/\bid=["']([^"']+)["']/i)?.[1];
      expect(rowId).toBeTruthy();
      tagParts(inner, 'td').forEach(({ attrs }, column) => {
        const headers = attrs.match(/\bheaders=["']([^"']+)["']/i)?.[1]?.split(/\s+/) ?? [];
        expect(headers).toEqual([rowId, ['gold-col', 'bitcoin-col', 'zodiacs-col'][column]]);
      });
    }
  });

  it('renders only a check or X in every comparison cell, plus an sr-only label', () => {
    const tbody = sliceElement(table, /<tbody\b[^>]*>/i, 'tbody');
    const rows = tagParts(tbody, 'tr');
    const actual = rows.map(({ inner }) => {
      const rowHeader = tagParts(inner, 'th')[0];
      const cells = tagParts(inner, 'td');
      expect(cells).toHaveLength(3);
      const marks = cells.map(({ inner: cell }) => visibleTextOf(cell));
      cells.forEach(({ inner: cell }, column) => {
        expect(cell).toMatch(/class=["'][^"']*\bcomparison-mark\b/);
        expect(cell).toMatch(/class=["'][^"']*\bcomparison-mark\b[^>]*aria-hidden=["']true["']/);
        expect(cell).toMatch(/class=["'][^"']*\bsr-only\b/);
        const srOnly = cell.match(/<[^>]*class=["'][^"']*\bsr-only\b[^"']*["'][^>]*>([\s\S]*?)<\//i);
        expect(textOf(srOnly?.[1] ?? '')).toBe(marks[column] === '✓' ? 'Yes' : 'No');
        expect(['✓', '×']).toContain(marks[column]);
      });
      return [textOf(rowHeader?.inner ?? ''), ...marks];
    });

    expect(actual).toEqual(MATRIX);
    expect(actual.every((row) => row[3] === '✓')).toBe(true);
  });

  it('keeps explanations and sources outside the matrix', () => {
    const measurementDrawer = fig3.match(
      /<details\b[^>]*class=["'][^"']*\bevidence-drawer\b[^"']*["'][^>]*>[\s\S]*?<\/details>/i,
    )?.[0] ?? '';
    expect(textOf(measurementDrawer)).toMatch(/How this comparison is measured/i);
    expect(visibleTextOf(table)).not.toMatch(/\b(?:yes|no|limited|unproven)\b/i);
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
    const holding = sliceElement(HTML, /<section\b[^>]*\bid=["']what-holding-means["'][^>]*>/i, 'section');
    const drawer = sliceElement(holding, /<details\b[^>]*\bid=["']ownership-details["'][^>]*>/i, 'details');
    const openingTag = drawer.match(/^<details\b[^>]*>/i)?.[0] ?? '';
    expect(openingTag).toMatch(/\bclass=["'][^"']*\bevidence-drawer\b/);
    expect(openingTag).not.toMatch(/\sopen(?:\s|=|>)/i);
    expect(textOf(tagParts(drawer, 'summary')[0]?.inner ?? '')).toBe('See the supply and ownership records');
    expect(drawer).toContain('id="fig-authorities"');
    expect(textOf(drawer)).toContain('The issuer gave up the native assets’ minting and freezing permissions.');
    const readingFlow = classedDetailsRemoved(holding);
    expect(readingFlow).not.toContain('id="fig-authorities"');
    expect(textOf(readingFlow)).not.toContain('minting and freezing permissions');
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
    expect(textOf(authorities)).toContain('Operator statement; not an audit of insider holdings.');
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
