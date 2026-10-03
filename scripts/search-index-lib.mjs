export const SEARCH_KINDS = Object.freeze([
  'tool',
  'sign',
  'learn',
  'horoscope',
  'pairing',
  'page',
  'term',
  'astrofolio',
  'terminal',
  'registry',
]);

const SEARCH_KIND_SET = new Set(SEARCH_KINDS);
const SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const SIGN_NAMES = Object.freeze([
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
]);
const SIGN_PATTERN = SIGNS.join('|');
const TOOL_ROOTS = new Set([
  'baby-zodiac',
  'big-three',
  'group-charts',
  'sky-calendar',
  'astrologer-kit',
  'your-sky-wrapped',
  'chart-of-the-day',
  'chart-twins',
  'birth-chart',
  'birthday',
  'compatibility',
  'eclipses',
  'full-moon-calendar',
  'mercury-retrograde',
  'lunar-return',
  'moon-phase',
  'moon-sign',
  'numerology',
  'profile',
  'retrogrades',
  'rising-sign',
  'saturn-return',
  'solar-return',
  'tools',
  'transits',
  'void-of-course-moon',
  'widgets',
]);
const EXCLUDED_PREFIXES = ['/es/', '/astrofolio/', '/fomo/', '/terminal/', '/registry/', '/thesis/', '/archive/', '/sdk/'];
const NAMED_ENTITIES = Object.freeze({
  amp: '&',
  apos: "'",
  deg: '°',
  gt: '>',
  hellip: '…',
  ldquo: '“',
  lsquo: '‘',
  lt: '<',
  mdash: '—',
  nbsp: ' ',
  ndash: '–',
  quot: '"',
  rdquo: '”',
  rsquo: '’',
});

function freezeCuratedEntry(entry) {
  return Object.freeze({
    ...entry,
    keywords: Object.freeze([...entry.keywords]),
  });
}

/**
 * The wing remains outside the consumer-page crawl. These records-register
 * entries are deliberately small, reviewable, and independent of wing copy.
 */
export const CURATED_WING_ENTRIES = Object.freeze([
  freezeCuratedEntry({
    path: '/astrofolio/',
    title: 'Astrofolio',
    description: 'Choose your sign and explore the twelve-part Zodiac collection.',
    kind: 'astrofolio',
    keywords: [
      'astrofolio', 'collection', 'choose your sign', 'official zodiac',
      'token', 'zodiac design', 'artwork', 'gallery', 'verifier', 'buying guide',
    ],
  }),
  freezeCuratedEntry({
    path: '/terminal/',
    title: 'Terminal',
    description: 'See current prices, charts, standings, and research for all twelve Zodiac tokens.',
    kind: 'terminal',
    keywords: [
      'terminal', 'market desk', 'zodiac capital markets',
      'ranked zodiac tokens', 'market', 'markets', 'price', 'liquidity',
      'selected-sign chart', 'market tape', 'briefing', 'research',
    ],
  }),
  freezeCuratedEntry({
    path: '/registry/',
    title: 'The 12 Zodiac Profiles',
    description: 'Choose your Zodiac sign, meet famous people who share it, compare recent Wikipedia views, and see today’s market standings.',
    kind: 'registry',
    keywords: ['registry', 'zodiacs registry', 'verify', 'verification', 'address', 'addresses', 'canonical', 'dataset', 'methodology', 'record'],
  }),
  freezeCuratedEntry({
    path: '/thesis/',
    title: 'Why Zodiacs Matter',
    description: 'Why a sign people already know can become a shared digital identity.',
    kind: 'registry',
    keywords: ['registry', 'thesis', 'record', 'zodiac', 'history', 'identity', 'ownership', 'bitcoin', 'solana'],
  }),
  freezeCuratedEntry({
    path: '/sdk/',
    title: 'Zodiacs SDK',
    description: 'Open tools for building astrology apps — charts, icons, and the registry interface.',
    kind: 'registry',
    keywords: ['registry', 'sdk', 'record', 'tools'],
  }),
  ...SIGN_NAMES.map((sign) => freezeCuratedEntry({
    path: `/registry/${sign.toLowerCase()}/`,
    title: `${sign} Zodiac profile`,
    description: `${sign} dates, famous birthdays, Wikipedia views, current price and rank, and verified token address.`,
    kind: 'registry',
    keywords: ['registry', 'astrofolio', 'record', sign.toLowerCase()],
  })),
]);

function collapseWhitespace(value) {
  return value.replace(/\s+/g, ' ').trim();
}

export function decodeHtmlEntities(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z][\da-z]+);/gi, (entity, token) => {
    if (token[0] === '#') {
      const hexadecimal = token[1]?.toLowerCase() === 'x';
      const number = Number.parseInt(token.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      return Number.isFinite(number) && number >= 0 && number <= 0x10ffff
        ? String.fromCodePoint(number)
        : entity;
    }
    return NAMED_ENTITIES[token.toLowerCase()] ?? entity;
  });
}

function attributes(tag) {
  const found = new Map();
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(tag)) !== null) {
    const name = match[1].toLowerCase();
    if (name === 'meta') continue;
    found.set(name, match[2] ?? match[3] ?? match[4] ?? '');
  }
  return found;
}

export function extractPageMetadata(html) {
  const rawTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const title = collapseWhitespace(decodeHtmlEntities(rawTitle.replace(/<[^>]+>/g, '')))
    .replace(/\s*\|\s*Zodiacs\.org\s*$/i, '')
    .trim();
  let description = '';
  let noindex = false;

  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const name = attrs.get('name')?.toLowerCase();
    if (name === 'description' && !description) {
      description = collapseWhitespace(decodeHtmlEntities(attrs.get('content') ?? ''));
    }
    if (name === 'robots') {
      const directives = (attrs.get('content') ?? '')
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(Boolean);
      if (directives.includes('noindex')) noindex = true;
    }
  }

  return { title, description, noindex };
}

export function isEnglishHtml(html) {
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0];
  if (!htmlTag) return true;
  const language = attributes(htmlTag).get('lang')?.toLowerCase();
  return !language || language === 'en' || language.startsWith('en-');
}

export function htmlFileToPath(relativeFile) {
  const normalized = relativeFile.replaceAll('\\', '/').replace(/^\.\//, '');
  if (normalized === 'index.html') return '/';
  if (normalized.endsWith('/index.html')) {
    return `/${normalized.slice(0, -'index.html'.length)}`;
  }
  return `/${normalized}`;
}

export function shouldIndexPath(path) {
  if (!path.startsWith('/')) return false;
  if (EXCLUDED_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix))) return false;
  if (/\/(?:page|pages|p)\/\d+(?:\/|\.html)$/i.test(path)) return false;
  if (/\/page-\d+(?:\/|\.html)$/i.test(path)) return false;
  return true;
}

export function inferSearchKind(path) {
  if (new RegExp(`^/(?:${SIGN_PATTERN})/$`).test(path)) return 'sign';
  if (new RegExp(`^/compatibility/(?:${SIGN_PATTERN})-(?:${SIGN_PATTERN})/$`).test(path)) {
    return 'pairing';
  }
  if (path === '/horoscopes/' || path.startsWith('/horoscopes/')) return 'horoscope';
  if (path === '/learn/' || path.startsWith('/learn/')) return 'learn';
  const root = path.split('/').filter(Boolean)[0] ?? '';
  if (TOOL_ROOTS.has(root)) return 'tool';
  return 'page';
}

export function firstSentence(value) {
  const normalized = collapseWhitespace(value);
  return normalized.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? normalized;
}

export function glossarySearchEntries(glossary) {
  return glossary.map((entry) => ({
    path: `/learn/glossary/#${entry.slug}`,
    title: entry.term,
    description: firstSentence(entry.definition),
    kind: 'term',
  }));
}

export function truncateAtWord(value, maxLength = 160) {
  const normalized = collapseWhitespace(value);
  if (normalized.length <= maxLength) return normalized;
  const words = normalized.split(' ');
  let result = '';
  for (const word of words) {
    const candidate = result ? `${result} ${word}` : word;
    if (candidate.length > maxLength - 1 && result) break;
    result = candidate;
    if (result.length > maxLength - 1) break;
  }
  return `${result}…`;
}

export function sortSearchEntries(entries) {
  return [...entries].sort((left, right) => (
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0
  ));
}

export function searchIndexShapeFailures(index, { minEntries = 400 } = {}) {
  if (!Array.isArray(index)) return ['root must be an array'];
  const failures = [];
  const paths = new Set();

  if (index.length <= minEntries) {
    failures.push(`expected more than ${minEntries} entries, found ${index.length}`);
  }
  for (const [position, entry] of index.entries()) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      failures.push(`entry ${position} is not an object`);
      continue;
    }
    for (const field of ['path', 'title', 'description', 'kind']) {
      if (typeof entry[field] !== 'string' || !entry[field]) {
        failures.push(`entry ${position} has invalid ${field}`);
      }
    }
    if (typeof entry.path === 'string') {
      if (!entry.path.startsWith('/')) failures.push(`entry ${position} path is not root-relative`);
      if (entry.path.includes('?')) failures.push(`entry ${position} path contains a query string`);
      if (entry.path.indexOf('#') !== entry.path.lastIndexOf('#')) {
        failures.push(`entry ${position} path contains multiple fragments`);
      }
      if (entry.path.split(/[\/#]/).includes('..')) {
        failures.push(`entry ${position} path contains a parent segment`);
      }
      if (paths.has(entry.path)) failures.push(`duplicate path ${entry.path}`);
      paths.add(entry.path);
    }
    if (typeof entry.kind === 'string' && !SEARCH_KIND_SET.has(entry.kind)) {
      failures.push(`entry ${position} has unknown kind ${entry.kind}`);
    }
    if ('keywords' in entry && (
      !Array.isArray(entry.keywords)
      || entry.keywords.length === 0
      || entry.keywords.some((keyword) => typeof keyword !== 'string' || !keyword.trim())
    )) {
      failures.push(`entry ${position} has invalid keywords`);
    }
    if (typeof entry.path === 'string' && typeof entry.kind === 'string') {
      if (entry.kind === 'term' && !/^\/learn\/glossary\/#(?:[a-z0-9]+-)*[a-z0-9]+$/.test(entry.path)) {
        failures.push(`entry ${position} term path is not canonical`);
      }
      if (entry.kind !== 'term' && entry.path.includes('#')) {
        failures.push(`entry ${position} non-term path contains a fragment`);
      }
    }
    if (position > 0 && typeof entry.path === 'string' && index[position - 1]?.path > entry.path) {
      failures.push(`entries are not sorted at ${entry.path}`);
    }
  }
  return failures;
}
