/**
 * The words of the Sun's year plate on the sign guides
 * (src/components/guide/SunYearPlate.astro), one table per released guide
 * language. English is the plate as first published; the translations follow
 * the voice of each language's guide (tú, você, tu, tu, вы) and the season
 * pages' wording (src/lib/seasons/copy-*.ts). Sign and element names come
 * from signs.ts; French and Italian put an article before a sign, held here
 * by slug, and Russian takes the prepositional case (signPrepositional).
 * The component formats every date and number; these only place them.
 * No dashes in any line.
 */
import { elementLabel, signName, signPrepositional, type Element } from './signs';
import type { CatalogLocale } from './i18n/core.js';
import type { PluralForms } from './i18n/plural';

export type SunYearLocale = CatalogLocale;

export interface SunYearWords {
  /** "The Sun’s year, 2026 to 2027". */
  kicker: (from: number, to: number) => string;
  /** "When the Sun is in Aries". */
  heading: (slug: string) => string;
  /** The ring, read for the reader: two sentences. */
  ring: string;
  /** "Cancer is the longest season and Sagittarius the shortest." */
  extremes: (longest: string, shortest: string) => string;
  began: string;
  begins: string;
  ends: string;
  /** The end of a season already past in the year shown. */
  ended: string;
  length: string;
  /** Whole days and spare hours, as plural forms with {n}. */
  days: PluralForms;
  hours: PluralForms;
  twelfth: string;
  /** The facts row label: "Fire signs". */
  elementRow: (element: Element) => string;
  thirdApart: string;
  /** The season page link text; null where the language has no season pages. */
  seasonLink: ((slug: string) => string) | null;
  source: string;
  /** Under the centre number (always shown with one decimal): "days in Aries". */
  centre: PluralForms;
  /** The ring's accessible name. Dates arrive formatted. */
  alt: (slug: string, from: string, to: string, element: Element, family: readonly string[]) => string;
  /**
   * The sentence under the Sun mark: where the Sun is on the edition's date,
   * always dated, never "today". The date arrives formatted; the degree is
   * whole and left out when the committed data does not give it.
   */
  sunOn: (date: string, slug: string, degree: number | null) => string;
  /** Added to the ring's accessible name when the Sun mark is drawn. */
  sunMark: (date: string, slug: string) => string;
  /**
   * Under the facts when the season drawn is already past: when the sign's
   * next season begins. The date arrives formatted, with its year.
   */
  nextSeason: (slug: string, date: string) => string;
}

const lower = (text: string) => text.charAt(0).toLocaleLowerCase() + text.slice(1);

/* ── French: le Bélier, la Vierge, les Gémeaux ─────────────────── */
const FR_ARTICLE: Record<string, 'le' | 'la' | 'les'> = {
  aries: 'le', taurus: 'le', gemini: 'les', cancer: 'le', leo: 'le', virgo: 'la',
  libra: 'la', scorpio: 'le', sagittarius: 'le', capricorn: 'le', aquarius: 'le', pisces: 'les',
};
const frThe = (slug: string) => `${FR_ARTICLE[slug]} ${signName(slug, 'fr')}`;
const frOf = (slug: string) => {
  const name = signName(slug, 'fr');
  return { le: `du ${name}`, la: `de la ${name}`, les: `des ${name}` }[FR_ARTICLE[slug]];
};
/** "de feu", "de terre", "d’air", "d’eau". */
const frElement = (element: Element) => {
  const word = lower(elementLabel(element, 'fr'));
  return /^[aeiou]/u.test(word) ? `d’${word}` : `de ${word}`;
};

/* ── Italian: l’Ariete, il Toro, i Gemelli, lo Scorpione ────────── */
type ItArticle = 'l’' | 'il' | 'lo' | 'la' | 'i';
const IT_ARTICLE: Record<string, ItArticle> = {
  aries: 'l’', taurus: 'il', gemini: 'i', cancer: 'il', leo: 'il', virgo: 'la',
  libra: 'la', scorpio: 'lo', sagittarius: 'il', capricorn: 'il', aquarius: 'l’', pisces: 'i',
};
const itOf = (slug: string) => {
  const name = signName(slug, 'it');
  return { 'l’': `dell’${name}`, il: `del ${name}`, lo: `dello ${name}`, la: `della ${name}`, i: `dei ${name}` }[IT_ARTICLE[slug]];
};
const itIn = (slug: string) => {
  const name = signName(slug, 'it');
  return { 'l’': `nell’${name}`, il: `nel ${name}`, lo: `nello ${name}`, la: `nella ${name}`, i: `nei ${name}` }[IT_ARTICLE[slug]];
};
/** "di fuoco", "di terra", "d’aria", "d’acqua". */
const itElement = (element: Element) => {
  const word = lower(elementLabel(element, 'it'));
  return /^[aeiou]/u.test(word) ? `d’${word}` : `di ${word}`;
};
/** Days that start with a vowel sound take an elided article: "dall’8 marzo", "all’11 aprile". */
const itElides = (date: string) => /^(?:8|11)\s/u.test(date);
const itFrom = (date: string) => (itElides(date) ? `dall’${date}` : `dal ${date}`);
const itTo = (date: string) => (itElides(date) ? `all’${date}` : `al ${date}`);
const itOn = (date: string) => (itElides(date) ? `l’${date}` : `il ${date}`);
const upper = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/* ── Russian: the elements in the genitive, "знаки огня" ─────────── */
const RU_ELEMENT_GENITIVE: Record<Element, string> = {
  fire: 'огня', earth: 'земли', air: 'воздуха', water: 'воды',
};

const EN: SunYearWords = {
  kicker: (from, to) => `The Sun’s year, ${from} to ${to}`,
  heading: (slug) => `When the Sun is in ${signName(slug)}`,
  ring: 'The ring is one year, read clockwise from the March equinox. Each sign takes the share of the year the Sun spends in it, so the twelve are close to equal and never exactly so.',
  extremes: (longest, shortest) => `${signName(longest)} is the longest season and ${signName(shortest)} the shortest.`,
  began: 'Began',
  begins: 'Begins',
  ends: 'Ends',
  ended: 'Ended',
  length: 'Length',
  days: { other: '{n} days' },
  hours: { one: '{n} hour', other: '{n} hours' },
  twelfth: 'about a twelfth of the year',
  elementRow: (element) => {
    const labels: Record<Element, string> = { fire: 'Fire', earth: 'Earth', air: 'Air', water: 'Water' };
    return `${labels[element]} signs`;
  },
  thirdApart: 'a third of the year apart',
  seasonLink: (slug) => `${signName(slug)} season in your time zone`,
  source: 'Sun’s sign entries calculated by Zodiacs. Times in UTC.',
  centre: { other: 'days in {sign}' },
  alt: (slug, from, to, element, family) => {
    const labels: Record<Element, string> = { fire: 'fire', earth: 'earth', air: 'air', water: 'water' };
    return `A ring showing one year from the March equinox, divided into the twelve signs to scale. ${signName(slug)} runs from ${from} to ${to}. A triangle joins the three ${labels[element]} signs: ${family.join(', ')}.`;
  },
  sunOn: (date, slug, degree) => `On ${date} the Sun is in ${signName(slug)}${degree === null ? '' : `, at ${degree}° of the sign`}.`,
  sunMark: (date, slug) => `A small Sun mark on the ring shows where the Sun is on ${date}, in ${signName(slug)}.`,
  nextSeason: (slug, date) => `Next ${signName(slug)} season begins ${date}.`,
};

const ES: SunYearWords = {
  kicker: (from, to) => `El año del Sol, de ${from} a ${to}`,
  heading: (slug) => `Cuando el Sol está en ${signName(slug, 'es')}`,
  ring: 'El anillo es un año, leído en el sentido de las agujas del reloj desde el equinoccio de marzo. Cada signo ocupa la parte del año que el Sol pasa en él, así que los doce son casi iguales, pero nunca del todo.',
  extremes: (longest, shortest) => `La temporada de ${signName(longest, 'es')} es la más larga y la de ${signName(shortest, 'es')}, la más corta.`,
  began: 'Empezó',
  begins: 'Empieza',
  ends: 'Termina',
  ended: 'Terminó',
  length: 'Duración',
  days: { one: '{n} día', other: '{n} días' },
  hours: { one: '{n} hora', other: '{n} horas' },
  twelfth: 'cerca de un doceavo del año',
  elementRow: (element) => `Signos de ${lower(elementLabel(element, 'es'))}`,
  thirdApart: 'a un tercio de año entre sí',
  seasonLink: (slug) => `Temporada de ${signName(slug, 'es')} en tu zona horaria`,
  source: 'Entradas del Sol en cada signo calculadas por Zodiacs. Horas en UTC.',
  centre: { one: 'día en {sign}', other: 'días en {sign}' },
  alt: (slug, from, to, element, family) => `Un anillo que muestra un año desde el equinoccio de marzo, dividido a escala entre los doce signos. La temporada de ${signName(slug, 'es')} va del ${from} al ${to}. Un triángulo une los tres signos de ${lower(elementLabel(element, 'es'))}: ${family.join(', ')}.`,
  sunOn: (date, slug, degree) => `El ${date}, el Sol está en ${signName(slug, 'es')}${degree === null ? '' : `, a ${degree}° del signo`}.`,
  sunMark: (date, slug) => `Una pequeña marca del Sol en el anillo muestra dónde está el Sol el ${date}, en ${signName(slug, 'es')}.`,
  nextSeason: (slug, date) => `La próxima temporada de ${signName(slug, 'es')} empieza el ${date}.`,
};

const PT: SunYearWords = {
  kicker: (from, to) => `O ano do Sol, de ${from} a ${to}`,
  heading: (slug) => `Quando o Sol está em ${signName(slug, 'pt')}`,
  ring: 'O anel é um ano, lido em sentido horário a partir do equinócio de março. Cada signo ocupa a parte do ano que o Sol passa nele, então os doze são quase iguais, mas nunca exatamente.',
  extremes: (longest, shortest) => `A temporada de ${signName(longest, 'pt')} é a mais longa, e a de ${signName(shortest, 'pt')}, a mais curta.`,
  began: 'Começou',
  begins: 'Começa',
  ends: 'Termina',
  ended: 'Terminou',
  length: 'Duração',
  days: { one: '{n} dia', other: '{n} dias' },
  hours: { one: '{n} hora', other: '{n} horas' },
  twelfth: 'cerca da duodécima parte do ano',
  elementRow: (element) => `Signos de ${lower(elementLabel(element, 'pt'))}`,
  thirdApart: 'separados por um terço do ano',
  seasonLink: (slug) => `Temporada de ${signName(slug, 'pt')} no seu fuso horário`,
  source: 'Entradas do Sol em cada signo calculadas pelo Zodiacs. Horários em UTC.',
  centre: { one: 'dia em {sign}', other: 'dias em {sign}' },
  alt: (slug, from, to, element, family) => `Um anel que mostra um ano a partir do equinócio de março, dividido em escala entre os doze signos. A temporada de ${signName(slug, 'pt')} vai de ${from} a ${to}. Um triângulo liga os três signos de ${lower(elementLabel(element, 'pt'))}: ${family.join(', ')}.`,
  sunOn: (date, slug, degree) => `Em ${date}, o Sol está em ${signName(slug, 'pt')}${degree === null ? '' : `, a ${degree}° do signo`}.`,
  sunMark: (date, slug) => `Uma pequena marca do Sol no anel mostra onde o Sol está em ${date}, em ${signName(slug, 'pt')}.`,
  nextSeason: (slug, date) => `A próxima temporada de ${signName(slug, 'pt')} começa em ${date}.`,
};

const FR: SunYearWords = {
  kicker: (from, to) => `L’année du Soleil, de ${from} à ${to}`,
  heading: (slug) => `Quand le Soleil est dans ${frThe(slug)}`,
  ring: 'L’anneau représente une année, lue dans le sens des aiguilles d’une montre à partir de l’équinoxe de mars. Chaque signe occupe la part de l’année que le Soleil y passe, si bien que les douze sont presque égaux, sans l’être jamais tout à fait.',
  extremes: (longest, shortest) => `La saison ${frOf(longest)} est la plus longue, celle ${frOf(shortest)} la plus courte.`,
  began: 'A commencé',
  begins: 'Commence',
  ends: 'Se termine',
  ended: 'S’est terminée',
  length: 'Durée',
  days: { one: '{n} jour', other: '{n} jours' },
  hours: { one: '{n} heure', other: '{n} heures' },
  twelfth: 'environ un douzième de l’année',
  elementRow: (element) => `Signes ${frElement(element)}`,
  thirdApart: 'à un tiers d’année d’intervalle',
  seasonLink: (slug) => `Saison ${frOf(slug)} dans ton fuseau horaire`,
  source: 'Entrées du Soleil dans chaque signe calculées par Zodiacs. Heures en UTC.',
  centre: { one: 'jour dans {sign}', other: 'jours dans {sign}' },
  alt: (slug, from, to, element, family) => `Un anneau qui montre une année à partir de l’équinoxe de mars, partagée à l’échelle entre les douze signes. La saison ${frOf(slug)} va du ${from} au ${to}. Un triangle relie les trois signes ${frElement(element)} : ${family.join(', ')}.`,
  sunOn: (date, slug, degree) => `Le ${date}, le Soleil est dans ${frThe(slug)}${degree === null ? '' : `, à ${degree}° du signe`}.`,
  sunMark: (date, slug) => `Une petite marque du Soleil sur l’anneau montre où il se trouve le ${date}, dans ${frThe(slug)}.`,
  nextSeason: (slug, date) => `La prochaine saison ${frOf(slug)} commence le ${date}.`,
};

const IT: SunYearWords = {
  kicker: (from, to) => `L’anno del Sole, dal ${from} al ${to}`,
  heading: (slug) => `Quando il Sole è ${itIn(slug)}`,
  ring: 'L’anello è un anno, letto in senso orario a partire dall’equinozio di marzo. Ogni segno occupa la parte dell’anno che il Sole vi trascorre, quindi i dodici sono quasi uguali, ma mai del tutto.',
  extremes: (longest, shortest) => `La stagione ${itOf(longest)} è la più lunga, quella ${itOf(shortest)} la più breve.`,
  began: 'È cominciata',
  begins: 'Comincia',
  ends: 'Finisce',
  ended: 'È finita',
  length: 'Durata',
  days: { one: '{n} giorno', other: '{n} giorni' },
  hours: { one: '{n} ora', other: '{n} ore' },
  twelfth: 'circa un dodicesimo dell’anno',
  elementRow: (element) => `Segni ${itElement(element)}`,
  thirdApart: 'a un terzo d’anno l’uno dall’altro',
  seasonLink: (slug) => `Stagione ${itOf(slug)} nel tuo fuso orario`,
  source: 'Ingressi del Sole nei segni calcolati da Zodiacs. Orari in UTC.',
  centre: { one: 'giorno {in}', other: 'giorni {in}' },
  alt: (slug, from, to, element, family) => `Un anello che mostra un anno a partire dall’equinozio di marzo, diviso in scala tra i dodici segni. La stagione ${itOf(slug)} va ${itFrom(from)} ${itTo(to)}. Un triangolo unisce i tre segni ${itElement(element)}: ${family.join(', ')}.`,
  sunOn: (date, slug, degree) => `${upper(itOn(date))} il Sole è ${itIn(slug)}${degree === null ? '' : `, a ${degree}° del segno`}.`,
  sunMark: (date, slug) => `Un piccolo simbolo del Sole sull’anello mostra dove si trova ${itOn(date)}, ${itIn(slug)}.`,
  nextSeason: (slug, date) => `La prossima stagione ${itOf(slug)} comincia ${itOn(date)}.`,
};

const RU: SunYearWords = {
  kicker: (from, to) => `Год Солнца, с ${from} по ${to} год`,
  heading: (slug) => `Когда Солнце в ${signPrepositional(slug)}`,
  ring: 'Кольцо показывает один год, по часовой стрелке от мартовского равноденствия. Каждый знак занимает ту долю года, которую Солнце проводит в нём, поэтому все двенадцать почти равны, но никогда не совпадают в точности.',
  extremes: (longest, shortest) => `Дольше всего Солнце остаётся в ${signPrepositional(longest)}, меньше всего в ${signPrepositional(shortest)}.`,
  began: 'Начался',
  begins: 'Начнётся',
  ends: 'Закончится',
  ended: 'Закончился',
  length: 'Длительность',
  days: { one: '{n} день', few: '{n} дня', many: '{n} дней', other: '{n} дня' },
  hours: { one: '{n} час', few: '{n} часа', many: '{n} часов', other: '{n} часа' },
  twelfth: 'около двенадцатой части года',
  elementRow: (element) => `Знаки ${RU_ELEMENT_GENITIVE[element]}`,
  thirdApart: 'на треть года друг от друга',
  seasonLink: null,
  source: 'Моменты входа Солнца в знаки рассчитаны Zodiacs. Время указано в UTC.',
  centre: { one: 'день в {in}', few: 'дня в {in}', many: 'дней в {in}', other: 'дня в {in}' },
  alt: (slug, from, to, element, family) => `Кольцо показывает один год от мартовского равноденствия, разделённый на двенадцать знаков в масштабе. Солнце находится в ${signPrepositional(slug)} с ${from} по ${to}. Треугольник соединяет три знака ${RU_ELEMENT_GENITIVE[element]}: ${family.join(', ')}.`,
  sunOn: (date, slug, degree) => `Солнце ${date} находится в ${signPrepositional(slug)}${degree === null ? '' : `, в ${degree}° от начала знака`}.`,
  sunMark: (date, slug) => `Небольшая отметка на кольце показывает, где Солнце находится ${date}: в ${signPrepositional(slug)}.`,
  // The date ends with its year marker ("2027 г."), whose full stop ends the sentence.
  nextSeason: (slug, date) => `В следующий раз Солнце будет в ${signPrepositional(slug)} с ${date}${date.endsWith('.') ? '' : '.'}`,
};

export const SUN_YEAR_WORDS: Readonly<Record<SunYearLocale, SunYearWords>> = {
  en: EN, es: ES, pt: PT, fr: FR, it: IT, ru: RU,
};

/** The sign as the centre label places it: "Aries", "le Bélier", "nell’Ariete", "Овне". */
export function sunYearCentreValues(slug: string, locale: SunYearLocale): Record<string, string> {
  if (locale === 'fr') return { sign: frThe(slug) };
  if (locale === 'it') return { in: itIn(slug) };
  if (locale === 'ru') return { in: signPrepositional(slug) };
  return { sign: signName(slug, locale) };
}
