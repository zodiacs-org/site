/**
 * Canonical sign table for the new site. Order matters: it is the zodiac
 * order and matches SIGN_ORDER in scripts/sign-data.mjs and the registry.
 * Hues are sampled from the pastel SDK icon discs — the same values live
 * as --sign-* custom properties in src/styles/tokens.css.
 */
import { requireCatalogLocale, type Locale, type ReleasedLocale } from './i18n/core.js';
import { russianRuntime } from './i18n/ru-runtime/index.js';

export type Element = 'fire' | 'earth' | 'air' | 'water';
export type Modality = 'cardinal' | 'fixed' | 'mutable';

export interface Sign {
  slug: string;
  name: string;
  glyph: string;
  /** Display dates, tropical zodiac. */
  dates: string;
  /** [startMonth, startDay] and [endMonth, endDay], tropical. */
  start: [number, number];
  end: [number, number];
  element: Element;
  modality: Modality;
  ruler: string;
  /** Traditional ruler where the modern one differs. */
  classicRuler?: string;
  polarity: 'day' | 'night';
  house: number;
  hue: string;
  /** One-line essence in the site voice — plain, warm, no woo. */
  essence: string;
}

export const SIGNS: readonly Sign[] = [
  { slug: 'aries', name: 'Aries', glyph: '♈', dates: 'Mar 21 – Apr 19', start: [3, 21], end: [4, 19], element: 'fire', modality: 'cardinal', ruler: 'Mars', polarity: 'day', house: 1, hue: '#DE8E79', essence: 'First out of the gate — direct, fast, unafraid to start.' },
  { slug: 'taurus', name: 'Taurus', glyph: '♉', dates: 'Apr 20 – May 20', start: [4, 20], end: [5, 20], element: 'earth', modality: 'fixed', ruler: 'Venus', polarity: 'night', house: 2, hue: '#B9D4BE', essence: 'Steady hands, good taste, and a long memory for comfort.' },
  { slug: 'gemini', name: 'Gemini', glyph: '♊', dates: 'May 21 – Jun 20', start: [5, 21], end: [6, 20], element: 'air', modality: 'mutable', ruler: 'Mercury', polarity: 'day', house: 3, hue: '#B29DD0', essence: 'Quick, curious, wired for conversation.' },
  { slug: 'cancer', name: 'Cancer', glyph: '♋', dates: 'Jun 21 – Jul 22', start: [6, 21], end: [7, 22], element: 'water', modality: 'cardinal', ruler: 'Moon', polarity: 'night', house: 4, hue: '#B6D4E4', essence: 'Feels first, remembers everything, protects what it loves.' },
  { slug: 'leo', name: 'Leo', glyph: '♌', dates: 'Jul 23 – Aug 22', start: [7, 23], end: [8, 22], element: 'fire', modality: 'fixed', ruler: 'Sun', polarity: 'day', house: 5, hue: '#E0A9B4', essence: 'Warm-hearted, expressive, born for the spotlight.' },
  { slug: 'virgo', name: 'Virgo', glyph: '♍', dates: 'Aug 23 – Sep 22', start: [8, 23], end: [9, 22], element: 'earth', modality: 'mutable', ruler: 'Mercury', polarity: 'night', house: 6, hue: '#B7D9B0', essence: 'Precise, useful, quietly running the whole operation.' },
  { slug: 'libra', name: 'Libra', glyph: '♎', dates: 'Sep 23 – Oct 22', start: [9, 23], end: [10, 22], element: 'air', modality: 'cardinal', ruler: 'Venus', polarity: 'day', house: 7, hue: '#D3A9DE', essence: 'Balance-seeking, charming, allergic to unfairness.' },
  { slug: 'scorpio', name: 'Scorpio', glyph: '♏', dates: 'Oct 23 – Nov 21', start: [10, 23], end: [11, 21], element: 'water', modality: 'fixed', ruler: 'Pluto', classicRuler: 'Mars', polarity: 'night', house: 8, hue: '#B9DCE8', essence: 'Intense, private, all-or-nothing.' },
  { slug: 'sagittarius', name: 'Sagittarius', glyph: '♐', dates: 'Nov 22 – Dec 21', start: [11, 22], end: [12, 21], element: 'fire', modality: 'mutable', ruler: 'Jupiter', polarity: 'day', house: 9, hue: '#E0B080', essence: 'Restless, honest, aimed at the horizon.' },
  { slug: 'capricorn', name: 'Capricorn', glyph: '♑', dates: 'Dec 22 – Jan 19', start: [12, 22], end: [1, 19], element: 'earth', modality: 'cardinal', ruler: 'Saturn', polarity: 'night', house: 10, hue: '#C0DEA8', essence: 'Patient, ambitious, building something that lasts.' },
  { slug: 'aquarius', name: 'Aquarius', glyph: '♒', dates: 'Jan 20 – Feb 18', start: [1, 20], end: [2, 18], element: 'air', modality: 'fixed', ruler: 'Uranus', classicRuler: 'Saturn', polarity: 'day', house: 11, hue: '#AE8FC9', essence: 'Independent, inventive, loyal to the future.' },
  { slug: 'pisces', name: 'Pisces', glyph: '♓', dates: 'Feb 19 – Mar 20', start: [2, 19], end: [3, 20], element: 'water', modality: 'mutable', ruler: 'Neptune', classicRuler: 'Jupiter', polarity: 'night', house: 12, hue: '#A9D4C4', essence: 'Porous, imaginative, tuned to what goes unspoken.' },
] as const;

export const SIGN_SLUGS = SIGNS.map((s) => s.slug);
export type DisplayLocale = Locale;

/** Russian case seam used by R1 copy such as “Луна в {sign}”. */
export function signPrepositional(sign: Sign | string): string {
  const resolved = typeof sign === 'string' ? signBySlug(sign) : sign;
  return russianRuntime().signs.prepositional[resolved.slug];
}

const SIGN_NAME_ES: Record<string, string> = {
  aries: 'Aries',
  taurus: 'Tauro',
  gemini: 'Géminis',
  cancer: 'Cáncer',
  leo: 'Leo',
  virgo: 'Virgo',
  libra: 'Libra',
  scorpio: 'Escorpio',
  sagittarius: 'Sagitario',
  capricorn: 'Capricornio',
  aquarius: 'Acuario',
  pisces: 'Piscis',
};

const SIGN_DATES_ES: Record<string, string> = {
  aries: '21 mar – 19 abr',
  taurus: '20 abr – 20 may',
  gemini: '21 may – 20 jun',
  cancer: '21 jun – 22 jul',
  leo: '23 jul – 22 ago',
  virgo: '23 ago – 22 sep',
  libra: '23 sep – 22 oct',
  scorpio: '23 oct – 21 nov',
  sagittarius: '22 nov – 21 dic',
  capricorn: '22 dic – 19 ene',
  aquarius: '20 ene – 18 feb',
  pisces: '19 feb – 20 mar',
};

const SIGN_ESSENCE_ES: Record<string, string> = {
  aries: 'Impulso, valentía y ganas de empezar.',
  taurus: 'Calma, placer y una lealtad que se construye con tiempo.',
  gemini: 'Curiosidad, conversación y una mente siempre en movimiento.',
  cancer: 'Sensibilidad, memoria y cuidado para lo que ama.',
  leo: 'Calidez, presencia y una forma natural de brillar.',
  virgo: 'Precisión, ayuda práctica y atención a lo que mejora la vida.',
  libra: 'Encanto, equilibrio y un radar fino para la justicia.',
  scorpio: 'Intensidad, intuición y una verdad que no se queda en la superficie.',
  sagittarius: 'Honestidad, horizonte y ganas de encontrar sentido.',
  capricorn: 'Paciencia, ambición y la fuerza de construir algo real.',
  aquarius: 'Independencia, ideas propias y amor por el futuro.',
  pisces: 'Imaginación, empatía y sensibilidad para lo que no se dice.',
};

const SIGN_NAME_PT: Record<string, string> = {
  aries: 'Áries',
  taurus: 'Touro',
  gemini: 'Gêmeos',
  cancer: 'Câncer',
  leo: 'Leão',
  virgo: 'Virgem',
  libra: 'Libra',
  scorpio: 'Escorpião',
  sagittarius: 'Sagitário',
  capricorn: 'Capricórnio',
  aquarius: 'Aquário',
  pisces: 'Peixes',
};

const SIGN_DATES_PT: Record<string, string> = {
  aries: '21 mar – 19 abr',
  taurus: '20 abr – 20 mai',
  gemini: '21 mai – 20 jun',
  cancer: '21 jun – 22 jul',
  leo: '23 jul – 22 ago',
  virgo: '23 ago – 22 set',
  libra: '23 set – 22 out',
  scorpio: '23 out – 21 nov',
  sagittarius: '22 nov – 21 dez',
  capricorn: '22 dez – 19 jan',
  aquarius: '20 jan – 18 fev',
  pisces: '19 fev – 20 mar',
};

const SIGN_ESSENCE_PT: Record<string, string> = {
  aries: 'Impulso, coragem e vontade de começar.',
  taurus: 'Calma, prazer e uma lealdade construída com o tempo.',
  gemini: 'Curiosidade, conversa e uma mente sempre em movimento.',
  cancer: 'Sensibilidade, memória e cuidado com o que ama.',
  leo: 'Calor, presença e uma forma natural de brilhar.',
  virgo: 'Precisão, ajuda prática e atenção ao que melhora a vida.',
  libra: 'Charme, equilíbrio e um senso apurado de justiça.',
  scorpio: 'Intensidade, intuição e uma verdade que vai além da superfície.',
  sagittarius: 'Honestidade, horizonte e vontade de encontrar sentido.',
  capricorn: 'Paciência, ambição e a força de construir algo real.',
  aquarius: 'Independência, ideias próprias e amor pelo futuro.',
  pisces: 'Imaginação, empatia e sensibilidade para o que não é dito.',
};

const SIGN_NAME_FR: Record<string, string> = {
  aries: 'Bélier',
  taurus: 'Taureau',
  gemini: 'Gémeaux',
  cancer: 'Cancer',
  leo: 'Lion',
  virgo: 'Vierge',
  libra: 'Balance',
  scorpio: 'Scorpion',
  sagittarius: 'Sagittaire',
  capricorn: 'Capricorne',
  aquarius: 'Verseau',
  pisces: 'Poissons',
};

const SIGN_DATES_FR: Record<string, string> = {
  aries: '21 mars – 19 avr.',
  taurus: '20 avr. – 20 mai',
  gemini: '21 mai – 20 juin',
  cancer: '21 juin – 22 juil.',
  leo: '23 juil. – 22 août',
  virgo: '23 août – 22 sept.',
  libra: '23 sept. – 22 oct.',
  scorpio: '23 oct. – 21 nov.',
  sagittarius: '22 nov. – 21 déc.',
  capricorn: '22 déc. – 19 janv.',
  aquarius: '20 janv. – 18 févr.',
  pisces: '19 févr. – 20 mars',
};

const SIGN_ESSENCE_FR: Record<string, string> = {
  aries: 'Élan, courage et envie de commencer.',
  taurus: 'Calme, plaisir et loyauté qui se construit avec le temps.',
  gemini: 'Curiosité, conversation et esprit toujours en mouvement.',
  cancer: 'Sensibilité, mémoire et soin de ce qui compte.',
  leo: 'Chaleur, présence et façon naturelle de rayonner.',
  virgo: 'Précision, aide concrète et attention à ce qui améliore la vie.',
  libra: 'Charme, équilibre et sens aigu de la justice.',
  scorpio: 'Intensité, intuition et vérité qui va au-delà de la surface.',
  sagittarius: 'Franchise, horizon et envie de trouver du sens.',
  capricorn: 'Patience, ambition et force de construire quelque chose de réel.',
  aquarius: 'Indépendance, idées personnelles et amour de l’avenir.',
  pisces: 'Imagination, empathie et sensibilité à ce qui ne se dit pas.',
};

const SIGN_NAME_IT: Record<string, string> = {
  aries: 'Ariete',
  taurus: 'Toro',
  gemini: 'Gemelli',
  cancer: 'Cancro',
  leo: 'Leone',
  virgo: 'Vergine',
  libra: 'Bilancia',
  scorpio: 'Scorpione',
  sagittarius: 'Sagittario',
  capricorn: 'Capricorno',
  aquarius: 'Acquario',
  pisces: 'Pesci',
};

const SIGN_DATES_IT: Record<string, string> = {
  aries: '21 mar – 19 apr',
  taurus: '20 apr – 20 mag',
  gemini: '21 mag – 20 giu',
  cancer: '21 giu – 22 lug',
  leo: '23 lug – 22 ago',
  virgo: '23 ago – 22 set',
  libra: '23 set – 22 ott',
  scorpio: '23 ott – 21 nov',
  sagittarius: '22 nov – 21 dic',
  capricorn: '22 dic – 19 gen',
  aquarius: '20 gen – 18 feb',
  pisces: '19 feb – 20 mar',
};

const SIGN_ESSENCE_IT: Record<string, string> = {
  aries: 'Slancio, coraggio e voglia di cominciare.',
  taurus: 'Calma, piacere e una lealtà che si costruisce nel tempo.',
  gemini: 'Curiosità, conversazione e una mente sempre in movimento.',
  cancer: 'Sensibilità, memoria e cura per ciò che ama.',
  leo: 'Calore, presenza e un modo naturale di brillare.',
  virgo: 'Precisione, aiuto concreto e attenzione a ciò che migliora la vita.',
  libra: 'Fascino, equilibrio e un senso acuto della giustizia.',
  scorpio: 'Intensità, intuizione e una verità che va oltre la superficie.',
  sagittarius: 'Onestà, orizzonte e voglia di trovare un senso.',
  capricorn: 'Pazienza, ambizione e la forza di costruire qualcosa di reale.',
  aquarius: 'Indipendenza, idee proprie e amore per il futuro.',
  pisces: 'Immaginazione, empatia e sensibilità per ciò che non viene detto.',
};

const SIGN_NAME_OVERRIDES = {
  en: null,
  es: SIGN_NAME_ES,
  pt: SIGN_NAME_PT,
  fr: SIGN_NAME_FR,
  it: SIGN_NAME_IT,
} satisfies Record<ReleasedLocale, Record<string, string> | null>;

const SIGN_DATES_OVERRIDES = {
  en: null,
  es: SIGN_DATES_ES,
  pt: SIGN_DATES_PT,
  fr: SIGN_DATES_FR,
  it: SIGN_DATES_IT,
} satisfies Record<ReleasedLocale, Record<string, string> | null>;

const SIGN_ESSENCE_OVERRIDES = {
  en: null,
  es: SIGN_ESSENCE_ES,
  pt: SIGN_ESSENCE_PT,
  fr: SIGN_ESSENCE_FR,
  it: SIGN_ESSENCE_IT,
} satisfies Record<ReleasedLocale, Record<string, string> | null>;

export function signBySlug(slug: string): Sign {
  const sign = SIGNS.find((s) => s.slug === slug);
  if (!sign) throw new Error(`Unknown sign: ${slug}`);
  return sign;
}

/** Sign index (0–11) for an ecliptic longitude in degrees. */
export function signIndexForLongitude(lon: number): number {
  return Math.floor(((lon % 360) + 360) % 360 / 30);
}

export function signForLongitude(lon: number): Sign {
  return SIGNS[signIndexForLongitude(lon)];
}

export function signName(sign: Sign | string, locale: DisplayLocale = 'en'): string {
  const resolved = typeof sign === 'string' ? signBySlug(sign) : sign;
  const catalogLocale = requireCatalogLocale(locale);
  if (catalogLocale === 'ru') return russianRuntime().signs.names[resolved.slug] ?? resolved.name;
  return SIGN_NAME_OVERRIDES[catalogLocale]?.[resolved.slug] ?? resolved.name;
}

export function signDates(sign: Sign | string, locale: DisplayLocale = 'en'): string {
  const resolved = typeof sign === 'string' ? signBySlug(sign) : sign;
  const catalogLocale = requireCatalogLocale(locale);
  if (catalogLocale === 'ru') return russianRuntime().signs.dates[resolved.slug] ?? resolved.dates;
  return SIGN_DATES_OVERRIDES[catalogLocale]?.[resolved.slug] ?? resolved.dates;
}

export function signEssence(sign: Sign | string, locale: DisplayLocale = 'en'): string {
  const resolved = typeof sign === 'string' ? signBySlug(sign) : sign;
  const catalogLocale = requireCatalogLocale(locale);
  if (catalogLocale === 'ru') return russianRuntime().signs.essences[resolved.slug] ?? resolved.essence;
  return SIGN_ESSENCE_OVERRIDES[catalogLocale]?.[resolved.slug] ?? resolved.essence;
}

/** Degree within the sign (0–29.999…) for an ecliptic longitude. */
export function degreeInSign(lon: number): number {
  return (((lon % 360) + 360) % 360) % 30;
}

/** Format 123.456 → "3°27′ Leo" style label. */
export function formatLongitude(lon: number, locale: DisplayLocale = 'en'): string {
  const sign = signForLongitude(lon);
  const deg = degreeInSign(lon);
  const d = Math.floor(deg);
  const m = Math.floor((deg - d) * 60);
  return `${d}°${String(m).padStart(2, '0')}′ ${signName(sign, locale)}`;
}

export const ELEMENT_LABEL: Record<Element, string> = {
  fire: 'Fire', earth: 'Earth', air: 'Air', water: 'Water',
};
export const MODALITY_LABEL: Record<Modality, string> = {
  cardinal: 'Cardinal', fixed: 'Fixed', mutable: 'Mutable',
};

const ELEMENT_LABEL_OVERRIDES = {
  en: null,
  es: { fire: 'Fuego', earth: 'Tierra', air: 'Aire', water: 'Agua' },
  pt: { fire: 'Fogo', earth: 'Terra', air: 'Ar', water: 'Água' },
  fr: { fire: 'Feu', earth: 'Terre', air: 'Air', water: 'Eau' },
  it: { fire: 'Fuoco', earth: 'Terra', air: 'Aria', water: 'Acqua' },
} satisfies Record<ReleasedLocale, Record<Element, string> | null>;

const MODALITY_LABEL_OVERRIDES = {
  en: null,
  es: { cardinal: 'Cardinal', fixed: 'Fijo', mutable: 'Mutable' },
  pt: { cardinal: 'Cardinal', fixed: 'Fixo', mutable: 'Mutável' },
  fr: { cardinal: 'Cardinal', fixed: 'Fixe', mutable: 'Mutable' },
  it: { cardinal: 'Cardinale', fixed: 'Fisso', mutable: 'Mobile' },
} satisfies Record<ReleasedLocale, Record<Modality, string> | null>;

export function elementLabel(element: Element, locale: DisplayLocale = 'en'): string {
  const catalogLocale = requireCatalogLocale(locale);
  if (catalogLocale === 'ru') return russianRuntime().signs.elements[element];
  return ELEMENT_LABEL_OVERRIDES[catalogLocale]?.[element] ?? ELEMENT_LABEL[element];
}

export function modalityLabel(modality: Modality, locale: DisplayLocale = 'en'): string {
  const catalogLocale = requireCatalogLocale(locale);
  if (catalogLocale === 'ru') return russianRuntime().signs.modalities[modality];
  return MODALITY_LABEL_OVERRIDES[catalogLocale]?.[modality] ?? MODALITY_LABEL[modality];
}

/** The sun sign whose season contains the given month/day (tropical). */
export function seasonSign(month: number, day: number): Sign {
  for (const sign of SIGNS) {
    const [sm, sd] = sign.start;
    const [em, ed] = sign.end;
    if (sm <= em) {
      if ((month > sm || (month === sm && day >= sd)) && (month < em || (month === em && day <= ed))) return sign;
    } else {
      // Capricorn wraps the year end.
      if ((month > sm || (month === sm && day >= sd)) || (month < em || (month === em && day <= ed))) return sign;
    }
  }
  return SIGNS[0];
}
