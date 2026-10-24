import type { PageLocale as Locale, UiKey } from './i18n';
import { TOOL_ICON_FOR_PATH, type ToolIconName } from './tool-icons';

/**
 * The English /tools/ hub's sections: the birth chart leads on its own, then
 * four groups named for the question a visitor arrives with.
 */
export type ToolGroup = 'lead' | 'you' | 'together' | 'sky' | 'year';
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
  | 'numerology'
  | 'group'
  | 'invite'
  | 'calendar'
  | 'document';

interface ToolHubCard {
  order: number;
  title: string;
  /** One plain line under the name: what the tool does. */
  promise: string;
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
  /** The tool's icon in the shared set (src/lib/tool-icons.ts). */
  icon: ToolIconName;
}

const NAV_SUBLABELS = {
  birth: {
    en: 'See your sun, moon, rising, planets, houses, and what they mean.',
    es: 'Descubre tu Sol, tu Luna, tu ascendente, los planetas, las casas y lo que significan.',
    pt: 'Veja seu Sol, sua Lua, seu ascendente, os planetas, as casas e o que tudo isso significa.',
    fr: 'Découvre ton Soleil, ta Lune, ton ascendant, tes planètes, tes maisons et leur signification.',
    it: 'Il tuo Sole, la tua Luna, l’ascendente, i pianeti, le case e il loro significato.',
    ru: 'Солнце, Луна, асцендент, планеты, дома и что всё это значит.',
    'zh-hans': '看看你的太阳、月亮、上升、行星和宫位，以及它们各自的含义。',
    'zh-hant': '看看你的太陽、月亮、上升、行星和宮位，以及它們各自的含義。',
  },
  compatibility: {
    en: 'Compare two charts and see where they click, clash, and grow.',
    es: 'Compara dos cartas y mira dónde conectan, chocan y crecen.',
    pt: 'Compare dois mapas e veja onde combinam, entram em conflito e crescem.',
    fr: 'Compare deux thèmes : où ils s’accordent, où ils se heurtent, où ils grandissent.',
    it: 'Confronta due temi e scopri dove si accordano, si scontrano e crescono.',
    ru: 'Сравните две карты: где они сходятся, где спорят и где помогают друг другу расти.',
    'zh-hans': '比较两张星盘，看看彼此在哪里契合、在哪里摩擦、又在哪里一起成长。',
    'zh-hant': '比較兩張星盤，看看彼此在哪裡契合、在哪裡摩擦、又在哪裡一起成長。',
  },
  transits: {
    en: 'Explore today’s planets and their connections to your chart.',
    es: 'Explora los planetas de hoy y sus conexiones con tu carta.',
    pt: 'Explore os planetas de hoje e suas conexões com seu mapa.',
    fr: 'Explore les planètes du jour et leurs liens avec ton thème.',
    it: 'Esplora i pianeti di oggi e i loro legami con il tuo tema.',
    ru: 'Изучите планеты сегодня и их связи с вашей картой.',
    'zh-hans': '看看今天的行星，以及它们和你星盘之间的联系。',
    'zh-hant': '看看今天的行星，以及它們和你星盤之間的聯繫。',
  },
  moon: {
    en: 'How you feel, and what settles you.',
    es: 'Cómo sientes las cosas y qué te calma.',
    pt: 'Como você vive as emoções e o que traz calma.',
    fr: 'Ta manière de ressentir et ce qui t’apaise.',
    it: 'Come vivi le emozioni e che cosa ti calma.',
    ru: 'Как вы чувствуете и что помогает вам успокоиться.',
    'zh-hans': '你感受情绪的方式，以及什么能让你安定下来。',
    'zh-hant': '你感受情緒的方式，以及什麼能讓你安定下來。',
  },
  rising: {
    en: 'Find the sign people meet first. Birth time helps.',
    es: 'El signo que los demás ven primero. La hora de nacimiento ayuda.',
    pt: 'Descubra o signo que as pessoas percebem primeiro em você. A hora de nascimento ajuda.',
    fr: 'Découvre le signe que les autres perçoivent en premier. L’heure de naissance est utile.',
    it: 'Il segno che mostri agli altri al primo incontro. L’ora di nascita aiuta.',
    ru: 'Знак, который другие замечают первым. Нужно время рождения.',
    'zh-hans': '别人初次认识你时，最先注意到的那一面。有出生时间会算得更准确。',
    'zh-hant': '別人初次認識你時，最先注意到的那一面。有出生時間會算得更準確。',
  },
  moonPhase: {
    en: 'Tonight’s moon, and the moon of any date you care about.',
    es: 'La Luna de hoy y la Luna de cualquier fecha importante.',
    pt: 'A Lua desta noite e a Lua de qualquer data importante para você.',
    fr: 'La Lune de ce soir et celle de toute date qui compte pour toi.',
    it: 'La Luna di oggi e quella di qualsiasi data importante per te.',
    ru: 'Луна сегодня и Луна в любую важную для вас дату.',
    'zh-hans': '今晚的月亮，以及任何一个你在意的日子里的月亮。',
    'zh-hant': '今晚的月亮，以及任何一個你在意的日子裡的月亮。',
  },
  saturn: {
    en: 'When yours hits, exactly, and what it tends to ask.',
    es: 'Cuándo llega el tuyo y qué suele pedir.',
    pt: 'Quando o seu chega, com datas exatas, e o que ele costuma pedir.',
    fr: 'Quand arrive le tien, à la date près, et ce qu’il demande en général.',
    it: 'Quando arriva il tuo, con precisione, e che cosa tende a chiedere.',
    ru: 'Когда именно случится ваше возвращение и какие вопросы оно обычно ставит.',
    'zh-hans': '你的土星回归具体在什么时候，以及它通常会引人思考的问题。',
    'zh-hant': '你的土星回歸具體在什麼時候，以及它通常會引人思考的問題。',
  },
  birthday: {
    en: 'Find your Sun sign from your birthday, including dates near a sign change.',
    es: 'Encuentra tu signo solar por tu cumpleaños, incluso cerca de un cambio de signo.',
    pt: 'Encontre seu signo solar pelo aniversário, inclusive perto de uma mudança de signo.',
    fr: 'Trouve ton signe solaire avec ta date de naissance, même près d’un changement de signe.',
    it: 'Trova il tuo segno solare dalla data di nascita, anche vicino a un cambio di segno.',
    ru: 'Узнайте солнечный знак по дате рождения, в том числе на границе знаков.',
    'zh-hans': '用生日找到你的太阳星座，星座交界前后的日子也算得清楚。',
    'zh-hant': '用生日找到你的太陽星座，星座交界前後的日子也算得清楚。',
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
    hub: { order: 1, title: 'Birth chart', promise: 'Your sun, moon, rising, planets, and houses, with what each one means.', group: 'lead' },
  },
  {
    href: '/birth-chart/someone-else/',
    hub: { order: 9, title: 'Someone else’s chart', promise: 'Anyone’s chart, with their permission.', group: 'together' },
  },
  {
    href: '/big-three/',
    hub: { order: 4, title: 'Big three card', promise: 'Sun, Moon and Rising, as a card to share.', group: 'you' },
  },
  {
    href: '/group-charts/',
    hub: { order: 11, title: 'Group charts', promise: 'How three to eight people fit together.', group: 'together' },
  },
  {
    href: '/compatibility/invite/',
    hub: { order: 10, title: 'Invite a friend', promise: 'Send a link, then compare your charts.', group: 'together' },
  },
  {
    href: '/chart-twins/',
    hub: { order: 12, title: 'Chart twins', promise: 'Public figures with your Sun and Moon.', group: 'together' },
  },
  {
    href: '/astrologer-kit/',
    hub: { order: 7, title: 'Chart PDF', promise: 'A clean copy of your chart to print or send.', group: 'you' },
  },
  {
    href: '/sky-calendar/',
    hub: { order: 27, title: 'Sky calendar', promise: 'New and full moons in your calendar app.', group: 'year' },
  },
  {
    href: '/chart-of-the-day/',
    hub: { order: 19, title: 'Chart of the day', promise: 'A figure in the news, with sourced data.', group: 'sky' },
  },
  {
    href: '/your-sky-wrapped/',
    hub: { order: 23, title: 'Your sky, wrapped', promise: 'Your year in the sky, as a card to share.', group: 'year' },
  },
  {
    href: '/today/', label: 'today', footerOrder: 2, footerUsesLocalizedPath: true,
    footerLabel: {
      en: 'Today', es: 'Hoy', pt: 'Hoje',
      fr: 'Aujourd’hui (en anglais)', it: 'Oggi (in inglese)', ru: 'Сегодня (пока по-английски)',
      'zh-hans': '今天（英文）', 'zh-hant': '今天（英文）',
    },
    hub: { order: 14, title: 'Today', promise: 'Today’s sky, read against your saved chart.', group: 'sky' },
  },
  {
    href: '/compatibility/', label: 'compatibility', sublabel: NAV_SUBLABELS.compatibility,
    navOrder: 2, footerOrder: 3, footerUsesLocalizedPath: true,
    hub: { order: 8, title: 'Compatibility', promise: 'Where two charts click, clash and grow.', group: 'together' },
  },
  {
    href: '/transits/', label: 'transits', sublabel: NAV_SUBLABELS.transits,
    navOrder: 3, footerOrder: 8, footerUsesLocalizedPath: true,
    hub: { order: 17, title: 'Transit tracker', promise: 'Today’s planets against your own chart.', group: 'sky' },
  },
  {
    href: '/moon-sign/', label: 'moonSign', sublabel: NAV_SUBLABELS.moon,
    navOrder: 4, footerOrder: 4, footerUsesLocalizedPath: true,
    hub: { order: 2, title: 'Moon sign', promise: NAV_SUBLABELS.moon.en, group: 'you' },
  },
  {
    href: '/rising-sign/', label: 'risingSign', sublabel: NAV_SUBLABELS.rising,
    navOrder: 5, footerOrder: 5, footerUsesLocalizedPath: true,
    hub: { order: 3, title: 'Rising sign', promise: 'The sign people meet first. Birth time helps.', group: 'you' },
  },
  {
    href: '/moon-phase/', label: 'moonPhase', sublabel: NAV_SUBLABELS.moonPhase,
    navOrder: 6, footerOrder: 6, footerUsesLocalizedPath: true,
    hub: { order: 15, title: 'Moon phase', promise: 'Tonight’s moon, or the moon on any date.', group: 'sky' },
  },
  {
    href: '/events/',
    hub: { order: 28, title: 'Sky events', promise: 'Sign changes, alignments and rarer sights.', group: 'year' },
  },
  {
    href: '/saturn-return/', label: 'saturnReturn', sublabel: NAV_SUBLABELS.saturn,
    navOrder: 7, footerOrder: 7, footerUsesLocalizedPath: true,
    hub: { order: 20, title: 'Saturn return', promise: 'Saturn back where it was at your birth.', group: 'year' },
  },
  {
    href: '/solar-return/',
    hub: { order: 21, title: 'Solar return', promise: 'The chart of your personal new year.', group: 'year' },
  },
  {
    href: '/lunar-return/',
    hub: { order: 22, title: 'Lunar return', promise: 'Your monthly Moon return, and its chart.', group: 'year' },
  },
  {
    href: '/baby-zodiac/',
    hub: { order: 13, title: 'Baby zodiac', promise: 'The Sun sign a due date falls in.', group: 'together' },
  },
  {
    href: '/void-of-course-moon/',
    hub: { order: 18, title: 'Void-of-course Moon', promise: 'The pause before the Moon changes sign.', group: 'sky' },
  },
  {
    href: '/full-moon-calendar/',
    hub: { order: 26, title: 'Full moon calendar', promise: 'Every full moon through 2027, with its sign.', group: 'year' },
  },
  {
    href: '/eclipses/',
    hub: { order: 24, title: 'Eclipses', promise: 'Solar and lunar eclipses through 2028.', group: 'year' },
  },
  {
    href: '/retrogrades/', label: 'retrogrades', footerOrder: 9, footerUsesLocalizedPath: true,
    hub: { order: 25, title: 'Retrogrades', promise: 'Each planet’s retrograde dates at a glance.', group: 'year' },
  },
  {
    href: '/birthday/', label: 'birthday', sublabel: NAV_SUBLABELS.birthday, navOrder: 8,
    hub: { order: 5, title: 'Birthday sign', promise: 'Your Sun sign, even near a sign change.', group: 'you' },
  },
  {
    href: '/numerology/',
    hub: { order: 6, title: 'Numerology', promise: 'Life Path and more, with every step shown.', group: 'you' },
  },
  {
    href: '/horoscopes/',
    hub: { order: 16, title: 'Horoscopes', promise: 'A reading for every sign, every morning.', group: 'sky' },
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
  .map(({ href, hub }) => {
    const icon = TOOL_ICON_FOR_PATH[href];
    if (!icon) throw new Error(`The tools hub lists ${href} without an icon in src/lib/tool-icons.ts.`);
    return { href, icon, ...hub };
  });

export const ALL_TOOLS_LABEL = {
  en: 'All tools',
  es: 'Todas las herramientas',
  pt: 'Todas as ferramentas',
  fr: 'Tous les outils',
  it: 'Tutti gli strumenti',
  ru: 'Все инструменты',
  'zh-hans': '全部工具',
  'zh-hant': '全部工具',
} as const satisfies Record<Locale, string>;

/**
 * Newer sharing and return-visit tools, listed under the main eight in the
 * Tools menu with short labels. Every one has a route in all six catalog
 * locales; the Chinese zodiac section links their English pages.
 */
export const NAV_MORE: readonly { href: string; label: Record<Locale, string> }[] = [
  { href: '/group-charts/', label: { en: 'Group charts', es: 'Cartas de grupo', pt: 'Mapas do grupo', fr: 'Thèmes de groupe', it: 'Temi di gruppo', ru: 'Карты группы', 'zh-hans': '群组星盘', 'zh-hant': '群組星盤' } },
  { href: '/chart-twins/', label: { en: 'Chart twins', es: 'Gemelos astrales', pt: 'Gêmeos astrais', fr: 'Jumeaux astrologiques', it: 'Gemelli astrologici', ru: 'Астрологические близнецы', 'zh-hans': '星盘双胞胎', 'zh-hant': '星盤雙胞胎' } },
  { href: '/big-three/', label: { en: 'Big three card', es: 'Los tres grandes', pt: 'Seus três signos', fr: 'Tes trois signes', it: 'I tuoi tre segni', ru: 'Большая тройка', 'zh-hans': '日月升卡片', 'zh-hant': '日月升卡片' } },
  { href: '/compatibility/invite/', label: { en: 'Invite a friend', es: 'Invitar a un amigo', pt: 'Convidar alguém', fr: 'Inviter un ami', it: 'Invita un amico', ru: 'Пригласить друга', 'zh-hans': '邀请朋友', 'zh-hant': '邀請朋友' } },
  { href: '/sky-calendar/', label: { en: 'Sky calendar', es: 'Calendario del cielo', pt: 'Calendário do céu', fr: 'Calendrier du ciel', it: 'Calendario del cielo', ru: 'Календарь неба', 'zh-hans': '天象日历', 'zh-hant': '天象日曆' } },
  { href: '/chart-of-the-day/', label: { en: 'Chart of the day', es: 'Carta del día', pt: 'Mapa do dia', fr: 'Thème du jour', it: 'Tema del giorno', ru: 'Карта дня', 'zh-hans': '每日星盘', 'zh-hant': '每日星盤' } },
  { href: '/your-sky-wrapped/', label: { en: 'Your sky, wrapped', es: 'Tu cielo, en retrospectiva', pt: 'Seu céu em retrospectiva', fr: 'Ton ciel, en rétrospective', it: 'Il tuo cielo, in retrospettiva', ru: 'Ваше небо: итоги года', 'zh-hans': '你的年度星空', 'zh-hant': '你的年度星空' } },
  { href: '/astrologer-kit/', label: { en: 'Chart PDF', es: 'PDF de la carta', pt: 'PDF do mapa', fr: 'PDF du thème', it: 'PDF del tema', ru: 'PDF карты', 'zh-hans': '星盘 PDF', 'zh-hant': '星盤 PDF' } },
];

export const NAV_MORE_LABEL = {
  en: 'More to explore', es: 'Más para explorar', pt: 'Mais para explorar', fr: 'À explorer aussi', it: 'Altro da esplorare', ru: 'Ещё стоит посмотреть',
  'zh-hans': '还可以看看', 'zh-hant': '還可以看看',
} as const satisfies Record<Locale, string>;
