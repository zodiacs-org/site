/**
 * English source catalogue for build-time social cards and additive schema.
 *
 * Keep keys and tool IDs stable so localized card generation can replace this
 * catalogue without scraping copy from Astro templates or generated HTML.
 */
// Consumer Organization identity only. Registry channels remain contained on
// the Registry's own static surfaces and must not enter consumer JSON-LD.
export const SOCIAL_PROFILES = Object.freeze([
  'https://github.com/zodiacs-org/sdk',
]);

// English-only build descriptors for the Phase 1 route family. Keeping this
// array outside OG_EN prevents the additive-locale manifest from mistaking a
// collection of build instructions for one translatable string.
export const HOROSCOPE_OG_SURFACES = Object.freeze([
  { key: 'today', suffix: '', kicker: 'Daily horoscope', subtitle: 'What matters today, with one useful move.' },
  { key: 'tomorrow', suffix: 'tomorrow', kicker: 'Tomorrow’s horoscope', subtitle: 'An early look at tomorrow’s tone and priorities.' },
  { key: 'weekly', suffix: 'weekly', kicker: 'Weekly horoscope', subtitle: 'The choices and themes developing across seven days.' },
  { key: 'monthly', suffix: 'monthly', kicker: 'Monthly horoscope', subtitle: 'The month’s turning points, read in sequence.' },
  { key: 'love', suffix: 'love', kicker: 'Love horoscope', subtitle: 'Relationships, reciprocity, boundaries, and repair.' },
  { key: 'career', suffix: 'career', kicker: 'Career horoscope', subtitle: 'Work, resources, collaboration, and direction.' },
  { key: 'year', suffix: '2027', kicker: '2027 horoscope', subtitle: 'The year’s major cycles and practical checkpoints.' },
]);

export const OG_EN = Object.freeze({
  fallbackAlt: 'Zodiacs.org — free birth charts, sign guides, and astrology tools.',
  site: 'zodiacs.org',
  signNames: Object.freeze({
    aries: 'Aries',
    taurus: 'Taurus',
    gemini: 'Gemini',
    cancer: 'Cancer',
    leo: 'Leo',
    virgo: 'Virgo',
    libra: 'Libra',
    scorpio: 'Scorpio',
    sagittarius: 'Sagittarius',
    capricorn: 'Capricorn',
    aquarius: 'Aquarius',
    pisces: 'Pisces',
  }),
  share: {
    title: 'Your whole chart, not just your sign.',
    subtitle: 'Free birth charts, sign guides, and astrology tools.',
  },
  signGuide: {
    kicker: 'Sign guide',
  },
  registryLot: {
    kicker: 'The Registry',
    numberLine: 'Nº {number} / 12 · Lot {lot} of XII',
    subtitle: 'Official record · native Solana origin · bridged Base representation',
  },
  wing: {
    kicker: 'Zodiacs.org',
    title: 'The Twelve',
    subtitle: 'Official records and public market context for the twelve Zodiac signs.',
    data: 'Astrofolio · Registry · Terminal',
  },
  astrofolio: {
    path: '/astrofolio/',
    image: '/assets/og/astrofolio/v5/faces.jpg',
    alt: 'Astrofolio: the collection of twelve official Zodiac tokens.',
  },
  terminal: {
    path: '/terminal/',
    image: '/assets/og/v6/terminal.png',
    alt: 'Terminal: expert market context and reviewed research for the twelve official Zodiac tokens.',
  },
  thesis: {
    kicker: 'The Thesis',
    title: 'Why Zodiacs Matter',
    footer: 'zodiacs.org — The Registry · History, ownership, modern rails · Nº 09',
    path: '/thesis/',
    image: '/assets/og/v2/thesis.png',
    alt: 'Why Zodiacs Matter — history, digital ownership, and modern rails · Nº 09.',
  },
  disclosure: {
    kicker: 'Registry disclosure',
    title: 'The facts, including the unresolved ones.',
    subtitle: 'Operator, economic-interest, provenance, separation, and read-only disclosures.',
    path: '/disclosure/',
    image: '/assets/og/v2/disclosure.png',
    alt: 'Registry disclosure — verified facts and dated operator attestations.',
  },
  horoscope: {
    kicker: 'Horoscope',
    subtitle: 'Daily through yearly readings with clear themes and one useful next move.',
  },
  rising: {
    kicker: 'Rising signs',
    title: '{sign}<br/>rising',
    subtitle: 'How the world first meets you — and the planet that steers your chart.',
    data: 'the ascendant changes sign about every two hours',
  },
  placements: {
    kicker: 'Placements',
    title: '{planet} through<br/>the signs',
    subtitle: 'All twelve {planet} placements, read closely.',
  },
  compatibility: {
    kicker: 'Compatibility',
    title: '{a}<br/>and {b}',
    data: 'What works · what strains · what makes it last',
  },
  planetNames: Object.freeze({
    sun: 'Sun',
    moon: 'Moon',
    mercury: 'Mercury',
    venus: 'Venus',
    mars: 'Mars',
    jupiter: 'Jupiter',
    saturn: 'Saturn',
    uranus: 'Uranus',
    neptune: 'Neptune',
    pluto: 'Pluto',
  }),
  pin: {
    signGuide: {
      kicker: 'Sign guide',
    },
    horoscope: {
      kicker: 'Horoscope',
      title: '{sign}, your forecast',
      subtitle: 'Daily, weekly, monthly, love, career, and yearly readings for every sign.',
    },
    howTo: {
      kicker: 'Learn astrology',
      title: 'How to read a birth chart.',
      steps: {
        bigThree: '1 · The big three',
        rooms: '2 · Planets, room by room',
        aspects: '3 · The working aspects',
        weather: '4 · The chart’s weather',
      },
    },
  },
  tools: Object.freeze([
    { key: 'birth-chart', path: '/birth-chart/', kicker: 'Free calculator', title: 'Your birth chart', sub: 'See your Sun, Moon, rising sign, houses, and the patterns that connect them.' },
    { key: 'moon-sign', path: '/moon-sign/', kicker: 'Free calculator', title: 'Your moon sign', sub: 'How you feel and what soothes you — from your date, time, and place of birth.' },
    { key: 'rising-sign', path: '/rising-sign/', kicker: 'Free calculator', title: 'Your rising sign', sub: 'How people first read you — from your birth time and place.' },
    { key: 'moon-phase', path: '/moon-phase/', kicker: 'Free calculator', title: 'The moon, any night', sub: 'Tonight’s phase, and the moon of any date that matters to you.' },
    { key: 'saturn-return', path: '/saturn-return/', kicker: 'Free calculator', title: 'Your Saturn return', sub: 'The exact dates, every pass and retrograde loop included.' },
    { key: 'mercury-retrograde', path: '/mercury-retrograde/', kicker: 'The calendar', title: 'Mercury retrograde', sub: 'Every window through 2027, with station dates and the themes to watch.' },
    { key: 'compatibility', path: '/compatibility/', kicker: 'Compatibility', title: 'Two charts, compared', sub: 'Whole-chart synastry — plus guides to all 78 sign pairings.' },
    { key: 'horoscopes', path: '/horoscopes/', kicker: 'Horoscopes', title: 'All twelve signs', sub: 'Daily through yearly readings with clear themes and one useful next move.' },
    { key: 'learn', path: '/learn/', kicker: 'Learn astrology', title: 'Read your chart', sub: 'The signs, the planets, the houses, and the aspects — and how they fit together.' },
    { key: 'how-to-read-a-birth-chart', path: '/learn/how-to-read-a-birth-chart/', kicker: 'Learn astrology', title: 'How to read a birth chart', sub: 'Big three, planets room by room, the working aspects, then the weather — in order.' },
    { key: 'tools', path: '/tools/', kicker: 'Free astrology tools', title: 'Calculators, no signup', sub: 'Birth chart, compatibility, moon sign, rising sign, and more — free to use.' },
    { key: 'transits', path: '/transits/', kicker: 'Free tracker', title: 'Your transits, today', sub: 'The current sky aspected to your birth chart, within 3° of exact.' },
    { key: 'eclipses', path: '/eclipses/', kicker: 'The calendar', title: 'Eclipses, dated', sub: 'Every solar and lunar eclipse through 2028, with exact peak times and signs.' },
    { key: 'full-moon-calendar', path: '/full-moon-calendar/', kicker: 'The calendar', title: 'Every full moon', sub: 'Exact instants through 2027, with each moon’s sign, degree, and name.' },
    { key: 'retrogrades', path: '/retrogrades/', kicker: 'The calendar', title: 'Every retrograde', sub: 'All eight planets, with every station window through 2027.' },
    { key: 'baby-zodiac', path: '/baby-zodiac/', kicker: 'Free calculator', title: 'What sign will the baby be?', sub: 'The due date’s near-certain Sun, the week’s possible Moons, and what waits for the clock.' },
    { key: 'birthday', path: '/birthday/', kicker: 'Birthday astrology', title: 'Your birthday, read closely', sub: 'Character, love, work, growth, and an exact cusp answer when the year matters.' },
    { key: 'ask', path: '/ask/', kicker: 'Astrology guide', title: 'Guide', sub: 'Ask about this site, astrology, or your own chart.' },
    { key: 'today', path: '/today/', kicker: 'Your daily brief', title: 'Today, against your chart', sub: 'A personal daily focus drawn from the latest chart saved on this device.' },
    { key: 'group-charts', path: '/group-charts/', kicker: 'Free group reading', title: 'Who’s the spark, who’s the glue?', sub: 'Three to eight charts, each given a role: the spark, the anchor, the connector, or the glue.' },
    { key: 'chart-twins', path: '/chart-twins/', kicker: 'Sourced directory', title: 'Your chart twins', sub: 'Public figures who share your verified Sun and Moon signs.' },
    { key: 'big-three', path: '/big-three/', kicker: 'Sun · Moon · Rising', title: 'Your big three', sub: 'Three signs in seconds, with a portrait card made in your browser.' },
    { key: 'compatibility-private-invite', path: '/compatibility/invite/', kicker: 'Compatibility', title: 'Invite a friend to compare', sub: 'Send a link. They add their chart, and you both see how the two connect.' },
    { key: 'sky-calendar', path: '/sky-calendar/', kicker: 'The calendar', title: 'The sky, in your calendar', sub: 'New and full moons, eclipse peaks, and retrograde windows, 2026–2030.' },
    { key: 'chart-of-the-day', path: '/chart-of-the-day/', kicker: 'In the news', title: 'Chart of the day', sub: 'A public figure’s chart, with sourced birth data and its limits stated.' },
    { key: 'your-sky-wrapped', path: '/your-sky-wrapped/', kicker: 'Your year', title: 'Your sky, wrapped', sub: 'The year’s Jupiter and Saturn contacts to your chart, on one card.' },
    { key: 'astrologer-kit', path: '/astrologer-kit/', kicker: 'For astrologers', title: 'A client-ready chart', sub: 'Chart wheel, placements, aspects, and the calculation receipt as a PDF.' },
  ]),
});

export const WEB_APPLICATION_PATHS = Object.freeze([
  '/birth-chart/',
  '/compatibility/',
  '/transits/',
  '/moon-sign/',
  '/rising-sign/',
  '/moon-phase/',
  '/lunar-return/',
  '/numerology/',
  '/void-of-course-moon/',
  '/saturn-return/',
  '/birthday/',
  '/today/',
  '/baby-zodiac/',
  '/full-moon-calendar/',
  '/eclipses/',
  '/retrogrades/',
  '/mercury-retrograde/',
]);

export const SCHEMA_EN = Object.freeze({
  organizationName: 'Zodiacs',
  organizationAlternateName: 'Zodiacs.org',
  websiteName: 'Zodiacs.org',
  websiteDescription: 'Free birth charts, moon signs, compatibility, horoscopes, and sign guides — private in your browser.',
  breadcrumbHome: 'Zodiacs.org',
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'Any device with a modern web browser',
  browserRequirements: 'Requires a modern web browser.',
  freePrice: '0',
  currency: 'USD',
});

export const BREADCRUMB_LABELS = Object.freeze({
  about: 'About',
  archive: 'Archive',
  'baby-zodiac': 'Baby zodiac',
  'birth-chart': 'Birth chart',
  birthday: 'Birthday astrology',
  compatibility: 'Compatibility',
  disclosure: 'Disclosure',
  eclipses: 'Eclipses',
  es: 'Español',
  feeds: 'Feeds',
  'full-moon-calendar': 'Full moon calendar',
  horoscopes: 'Horoscopes',
  houses: 'Houses',
  learn: 'Learn astrology',
  markets: 'Terminal venue route',
  'mercury-retrograde': 'Mercury retrograde',
  methodology: 'Methodology',
  'moon-phase': 'Moon phase',
  'moon-sign': 'Moon sign',
  placements: 'Placements',
  planets: 'Planets',
  privacy: 'Privacy',
  profile: 'Profile',
  registry: 'Zodiacs Registry',
  research: 'Markets Research',
  retrogrades: 'Retrogrades',
  'rising-sign': 'Rising sign',
  'saturn-return': 'Saturn return',
  sdk: 'SDK',
  terms: 'Terms',
  astrofolio: 'Astrofolio',
  terminal: 'Terminal',
  thesis: 'The Thesis',
  today: 'Today',
  tools: 'Astrology tools',
  transits: 'Transits',
  widgets: 'Widgets',
});

function normalizedPath(path) {
  const value = String(path || '/').split(/[?#]/, 1)[0];
  return value === '/' ? value : `/${value.replace(/^\/+|\/+$/g, '')}/`;
}

const TERMINAL_OG_PREFIXES = Object.freeze([
  '/terminal/',
  '/terminal/markets/',
  '/terminal/research/',
]);

/** Resolve route-specific copy while the two products share one neutral card asset. */
export function ogSpecialForPath(path) {
  const normalized = normalizedPath(path);
  if (normalized === OG_EN.astrofolio.path) {
    return { key: 'astrofolio', value: OG_EN.astrofolio };
  }
  if (TERMINAL_OG_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return { key: 'terminal', value: OG_EN.terminal };
  }
  for (const key of ['thesis', 'disclosure']) {
    const value = OG_EN[key];
    if (value.path === normalized) return { key, value };
  }
  return null;
}

/** Return a generated card for a known page, or null for the global fallback. */
export function ogImageForPath(path) {
  const normalized = normalizedPath(path);
  const tool = OG_EN.tools.find((entry) => entry.path === normalized);
  if (tool) return `/assets/og/v2/tool/${tool.key}.png`;
  return ogSpecialForPath(normalized)?.value.image ?? null;
}

export function ogAltForPath(path) {
  const normalized = normalizedPath(path);
  const tool = OG_EN.tools.find((entry) => entry.path === normalized);
  if (tool) return `${tool.title} — Zodiacs.org`;
  return ogSpecialForPath(normalized)?.value.alt ?? OG_EN.fallbackAlt;
}

export function breadcrumbLabel(segment) {
  const key = decodeURIComponent(String(segment || '')).toLowerCase();
  return BREADCRUMB_LABELS[key]
    ?? key.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
