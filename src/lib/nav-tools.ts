import type { CatalogLocale as Locale, UiKey } from './i18n';

export type ToolGroup = 'start' | 'sky' | 'milestones' | 'numbers';
export type ToolGlyphKind =
  | 'birth'
  | 'moon'
  | 'rising'
  | 'compat'
  | 'sun'
  | 'saturn'
  | 'transit'
  | 'retrograde'
  | 'moonphase'
  | 'fullmoon'
  | 'eclipse'
  | 'baby'
  | 'numerology';

interface ToolHubCard {
  order: number;
  title: string;
  promise: string;
  hue: string;
  kind: ToolGlyphKind;
  group: ToolGroup;
}

interface ToolCatalogEntry {
  href: string;
  label?: UiKey;
  sublabel?: Record<Locale, string>;
  navOrder?: number;
  footerOrder?: number;
  /** Today is intentionally English-only but keeps a clear locale-aware label. */
  footerLabel?: Record<Locale, string>;
  footerUsesLocalizedPath?: boolean;
  hub?: ToolHubCard;
}

export interface NavTool {
  href: string;
  label: UiKey;
  sublabel: Record<Locale, string>;
}

// These Birthday catalogue labels already disclose the canonical English page.
// Match only their existing endings so an unqualified future label still gets
// the navigation's shared English-only courtesy.
const BIRTHDAY_ENGLISH_ENDINGS: Partial<Record<Locale, string>> = {
  es: ' (en inglés)',
  pt: ' (em inglês)',
  fr: ' (en anglais)',
  it: ' (in inglese)',
};

export function navToolLabelHasEnglishCue(locale: Locale, key: UiKey, text: string): boolean {
  const ending = BIRTHDAY_ENGLISH_ENDINGS[locale];
  return key === 'birthday' && Boolean(ending && text.endsWith(ending));
}

export interface FooterTool {
  href: string;
  label: UiKey;
  localized: boolean;
  labels?: Record<Locale, string>;
}

export interface ToolsHubEntry extends ToolHubCard {
  href: string;
}

const NAV_SUBLABELS = {
  birth: {
    en: 'See your sun, moon, rising, planets, houses, and what they mean.',
    es: 'Ve tu Sol, Luna, ascendente, planetas, casas y lo que significan.',
    pt: 'Veja seu Sol, sua Lua, seu ascendente, os planetas, as casas e o que tudo isso significa.',
    fr: 'Découvre ton Soleil, ta Lune, ton ascendant, tes planètes, tes maisons et leur signification.',
    it: 'Il tuo Sole, la tua Luna, l’ascendente, i pianeti, le case e il loro significato.',
    ru: 'Солнце, Луна, асцендент, планеты, дома — и что всё это значит.',
  },
  compatibility: {
    en: 'Compare two charts and see where they click, clash, and grow.',
    es: 'Compara dos cartas y mira dónde conectan, chocan y crecen.',
    pt: 'Compare dois mapas e veja onde combinam, entram em conflito e crescem.',
    fr: 'Compare deux thèmes et vois où ils s’accordent, se heurtent et évoluent.',
    it: 'Confronta due temi e scopri dove si accordano, si scontrano e crescono.',
    ru: 'Сравните две карты и увидьте, где они совпадают, спорят и растут.',
  },
  transits: {
    en: 'Explore today’s planets and their connections to your chart.',
    es: 'Explora los planetas de hoy y sus conexiones con tu carta.',
    pt: 'Explore os planetas de hoje e suas conexões com seu mapa.',
    fr: 'Explore les planètes du jour et leurs liens avec ton thème.',
    it: 'Esplora i pianeti di oggi e i loro legami con il tuo tema.',
    ru: 'Изучите планеты сегодня и их связи с вашей картой.',
  },
  moon: {
    en: 'How you feel, and what settles you.',
    es: 'Cómo sientes y qué te ayuda a volver a ti.',
    pt: 'Como você vive as emoções e o que traz calma.',
    fr: 'Ta manière de ressentir et ce qui t’apaise.',
    it: 'Come vivi le emozioni e che cosa ti calma.',
    ru: 'Как вы чувствуете и что помогает вам успокоиться.',
  },
  rising: {
    en: 'Find the sign people meet first. Birth time helps.',
    es: 'Encuentra la energía que otros notan primero.',
    pt: 'Descubra o signo que as pessoas percebem primeiro em você. O horário de nascimento ajuda.',
    fr: 'Découvre le signe que les autres perçoivent en premier. L’heure de naissance est utile.',
    it: 'Il segno che mostri agli altri al primo incontro. L’ora di nascita aiuta.',
    ru: 'Найдите знак, который люди встречают первым. Нужны часы рождения.',
  },
  moonPhase: {
    en: 'Tonight’s moon, and the moon of any date you care about.',
    es: 'La Luna de hoy y la Luna de cualquier fecha importante.',
    pt: 'A Lua desta noite e a Lua de qualquer data importante para você.',
    fr: 'La Lune de ce soir et celle de toute date qui compte pour toi.',
    it: 'La Luna di oggi e quella di qualsiasi data importante per te.',
    ru: 'Луна сегодня и Луна в любую важную для вас дату.',
  },
  saturn: {
    en: 'When yours hits, exactly, and what it tends to ask.',
    es: 'Cuándo llega el tuyo y qué suele pedir.',
    pt: 'Quando o seu acontece, com exatidão, e o que ele costuma pedir.',
    fr: 'Quand le tien arrive, précisément, et ce qu’il tend à demander.',
    it: 'Quando arriva il tuo, con precisione, e che cosa tende a chiedere.',
    ru: 'Когда именно случится ваше возвращение и о чём оно обычно спрашивает.',
  },
  birthday: {
    en: 'Find your Sun sign from your birthday, including dates near a sign change.',
    es: 'Encuentra tu signo solar por tu cumpleaños, incluso cerca de un cambio de signo.',
    pt: 'Encontre seu signo solar pelo aniversário, inclusive perto de uma mudança de signo.',
    fr: 'Trouve ton signe solaire avec ta date de naissance, même près d’un changement de signe.',
    it: 'Trova il tuo segno solare dalla data di nascita, anche vicino a un cambio di segno.',
    ru: 'Узнайте солнечный знак по дате рождения, в том числе на границе знаков.',
  },
} as const satisfies Record<string, Record<Locale, string>>;

/**
 * One catalogue owns tool membership and ordering for the shared navigation,
 * footer, and English /tools/ hub. Surface-specific fields keep each list
 * deliberately short without copying hrefs or descriptions into templates.
 */
export const TOOL_CATALOG: readonly ToolCatalogEntry[] = [
  {
    href: '/birth-chart/', label: 'birthChart', sublabel: NAV_SUBLABELS.birth,
    navOrder: 1, footerOrder: 1, footerUsesLocalizedPath: true,
    hub: { order: 1, title: 'Birth chart calculator', promise: NAV_SUBLABELS.birth.en, hue: 'var(--sign-cancer)', kind: 'birth', group: 'start' },
  },
  {
    href: '/birth-chart/someone-else/',
    hub: { order: 2, title: "Someone else's chart", promise: 'Use birth details, the Big Three, or a Zodiacs link — with their permission.', hue: 'var(--sign-pisces)', kind: 'birth', group: 'start' },
  },
  {
    href: '/big-three/',
    hub: { order: 16, title: 'Big Three calculator', promise: 'Sun, Moon, and Rising in seconds, with a card to share and one tap into the full chart.', hue: 'var(--sign-leo)', kind: 'birth', group: 'start' },
  },
  {
    href: '/today/', label: 'today', footerOrder: 2, footerUsesLocalizedPath: true,
    footerLabel: {
      en: 'Today', es: 'Hoy', pt: 'Hoje',
      fr: 'Aujourd’hui (en anglais)', it: 'Oggi (in inglese)', ru: 'Сегодня — пока по-английски',
    },
    hub: { order: 3, title: 'Today', promise: 'A plain-language daily brief once you have saved a chart.', hue: 'var(--sign-cancer)', kind: 'transit', group: 'start' },
  },
  {
    href: '/compatibility/', label: 'compatibility', sublabel: NAV_SUBLABELS.compatibility,
    navOrder: 2, footerOrder: 3, footerUsesLocalizedPath: true,
    hub: { order: 4, title: 'Compatibility', promise: NAV_SUBLABELS.compatibility.en, hue: 'var(--sign-libra)', kind: 'compat', group: 'start' },
  },
  {
    href: '/transits/', label: 'transits', sublabel: NAV_SUBLABELS.transits,
    navOrder: 3, footerOrder: 8, footerUsesLocalizedPath: true,
    hub: { order: 11, title: 'Transit tracker', promise: NAV_SUBLABELS.transits.en, hue: 'var(--sign-aries)', kind: 'transit', group: 'sky' },
  },
  {
    href: '/moon-sign/', label: 'moonSign', sublabel: NAV_SUBLABELS.moon,
    navOrder: 4, footerOrder: 4, footerUsesLocalizedPath: true,
    hub: { order: 5, title: 'Moon sign calculator', promise: NAV_SUBLABELS.moon.en, hue: 'var(--sign-pisces)', kind: 'moon', group: 'start' },
  },
  {
    href: '/rising-sign/', label: 'risingSign', sublabel: NAV_SUBLABELS.rising,
    navOrder: 5, footerOrder: 5, footerUsesLocalizedPath: true,
    hub: { order: 6, title: 'Rising sign calculator', promise: NAV_SUBLABELS.rising.en, hue: 'var(--sign-gemini)', kind: 'rising', group: 'start' },
  },
  {
    href: '/moon-phase/', label: 'moonPhase', sublabel: NAV_SUBLABELS.moonPhase,
    navOrder: 6, footerOrder: 6, footerUsesLocalizedPath: true,
    hub: { order: 7, title: 'Moon phase', promise: NAV_SUBLABELS.moonPhase.en, hue: 'var(--sign-cancer)', kind: 'moonphase', group: 'sky' },
  },
  {
    href: '/events/',
    hub: { order: 8, title: 'Sky events', promise: 'The full moons, eclipses, retrogrades, sign changes, and rare alignments ahead.', hue: 'var(--sign-aquarius)', kind: 'transit', group: 'sky' },
  },
  {
    href: '/saturn-return/', label: 'saturnReturn', sublabel: NAV_SUBLABELS.saturn,
    navOrder: 7, footerOrder: 7, footerUsesLocalizedPath: true,
    hub: { order: 9, title: 'Saturn return', promise: NAV_SUBLABELS.saturn.en, hue: 'var(--sign-capricorn)', kind: 'saturn', group: 'milestones' },
  },
  {
    href: '/solar-return/',
    hub: { order: 10, title: 'Solar return', promise: 'Cast the exact chart of your personal new year, for any year and place.', hue: 'var(--sign-leo)', kind: 'sun', group: 'milestones' },
  },
  {
    href: '/lunar-return/',
    hub: { order: 17, title: 'Lunar return', promise: 'Find your next Moon return, explore its chart, and save a moment to check in.', hue: 'var(--sign-cancer)', kind: 'moon', group: 'sky' },
  },
  {
    href: '/baby-zodiac/',
    hub: { order: 12, title: 'Baby zodiac', promise: 'What sign a due date makes likely, and what has to wait.', hue: 'var(--sign-cancer)', kind: 'baby', group: 'milestones' },
  },
  {
    href: '/void-of-course-moon/',
    hub: { order: 19, title: 'Void-of-course Moon', promise: 'Every void this month and the next two, to the minute, with the aspect that starts it.', hue: 'var(--sign-cancer)', kind: 'moonphase', group: 'sky' },
  },
  {
    href: '/full-moon-calendar/',
    hub: { order: 13, title: 'Full moon calendar', promise: 'Every full moon through 2027: date, sign, and name.', hue: 'var(--sign-taurus)', kind: 'fullmoon', group: 'sky' },
  },
  {
    href: '/eclipses/',
    hub: { order: 14, title: 'Eclipses', promise: 'Solar and lunar through 2028, with exact peak times.', hue: 'var(--sign-leo)', kind: 'eclipse', group: 'sky' },
  },
  {
    href: '/retrogrades/', label: 'retrogrades', footerOrder: 9,
    hub: { order: 15, title: 'Retrogrades', promise: "See each planet's retrograde dates at a glance.", hue: 'var(--sign-virgo)', kind: 'retrograde', group: 'sky' },
  },
  {
    href: '/birthday/', label: 'birthday', sublabel: NAV_SUBLABELS.birthday, navOrder: 8,
  },
  {
    href: '/numerology/',
    hub: { order: 18, title: 'Numerology', promise: 'Life Path, Expression, Soul Urge, and Personal Year, with every step shown.', hue: 'var(--sign-virgo)', kind: 'numerology', group: 'numbers' },
  },
];

export const NAV_TOOLS: readonly NavTool[] = TOOL_CATALOG
  .filter((tool): tool is typeof tool & Required<Pick<ToolCatalogEntry, 'label' | 'sublabel' | 'navOrder'>> => (
    tool.label !== undefined && tool.sublabel !== undefined && tool.navOrder !== undefined
  ))
  .sort((left, right) => left.navOrder - right.navOrder)
  .map(({ href, label, sublabel }) => ({ href, label, sublabel }));

export const FOOTER_TOOLS: readonly FooterTool[] = TOOL_CATALOG
  .filter((tool): tool is typeof tool & Required<Pick<ToolCatalogEntry, 'label' | 'footerOrder'>> => (
    tool.label !== undefined && tool.footerOrder !== undefined
  ))
  .sort((left, right) => left.footerOrder - right.footerOrder)
  .map(({ href, label, footerLabel, footerUsesLocalizedPath }) => ({
    href,
    label,
    localized: footerUsesLocalizedPath === true,
    ...(footerLabel ? { labels: footerLabel } : {}),
  }));

export const TOOLS_HUB: readonly ToolsHubEntry[] = TOOL_CATALOG
  .filter((tool): tool is typeof tool & Required<Pick<ToolCatalogEntry, 'hub'>> => tool.hub !== undefined)
  .sort((left, right) => left.hub.order - right.hub.order)
  .map(({ href, hub }) => ({ href, ...hub }));

export const ALL_TOOLS_LABEL = {
  en: 'All tools',
  es: 'Todas las herramientas',
  pt: 'Todas as ferramentas',
  fr: 'Tous les outils',
  it: 'Tutti gli strumenti',
  ru: 'Все инструменты',
} as const satisfies Record<Locale, string>;
