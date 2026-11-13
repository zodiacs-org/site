/**
 * Crops of the hero film's poster (public/assets/hero/zodiacs-hero-poster.jpg),
 * used as the lead picture of a page's explainer. Each crop is a 16:10 WebP
 * at two widths under public/assets/hero-crops/. Alt text describes what each
 * crop shows, in every catalog locale.
 */
import type { CatalogLocale } from './i18n/core.js';

export const HERO_CROP_WIDTHS = [360, 560] as const;
export const HERO_CROP_SIZE = { width: 560, height: 350 } as const;

export type HeroCropName =
  | 'crescent'
  | 'crescent-band'
  | 'sun-moon'
  | 'sun-moon-signs'
  | 'clock-dial'
  | 'clock-hand'
  | 'sign-ring-hand'
  | 'sign-ring'
  | 'twins'
  | 'zodiac-figures';

export function heroCropSrc(name: HeroCropName, width: (typeof HERO_CROP_WIDTHS)[number] = 560): string {
  return `/assets/hero-crops/${name}-${width}.webp`;
}

export function heroCropSrcset(name: HeroCropName): string {
  return HERO_CROP_WIDTHS.map((width) => `${heroCropSrc(name, width)} ${width}w`).join(', ');
}

const HERO_CROP_ALT: Record<CatalogLocale, Record<HeroCropName, string>> = {
  en: {
    crescent: 'Gilded crescent moon on the dark, star-painted band of an astronomical clock',
    'crescent-band': 'Gilded crescent moon above painted zodiac figures on a star-painted band',
    'sun-moon': 'Gilded sun face and crescent moon above painted zodiac figures',
    'sun-moon-signs': 'Gilded sun and crescent moon above painted zodiac figures and a ring of pastel sign discs',
    'clock-dial': 'Brass clock hand crossing the engraved dial of an astronomical clock',
    'clock-hand': 'Brass clock hand pointing past a ring of pastel zodiac sign discs',
    'sign-ring-hand': 'Ring of pastel zodiac sign discs above the brass hand of an astronomical clock',
    'sign-ring': 'Ring of pastel zodiac sign discs below a band of painted zodiac figures',
    twins: 'Painted twins among zodiac figures above pastel sign discs',
    'zodiac-figures': 'Painted lion among zodiac figures beside pastel sign discs',
  },
  es: {
    crescent: 'Luna creciente dorada sobre la banda oscura y estrellada de un reloj astronómico',
    'crescent-band': 'Luna creciente dorada sobre figuras zodiacales pintadas en una banda estrellada',
    'sun-moon': 'Rostro de sol dorado y luna creciente sobre figuras zodiacales pintadas',
    'sun-moon-signs': 'Sol dorado y luna creciente sobre figuras zodiacales pintadas y un anillo de discos de signos en tonos pastel',
    'clock-dial': 'Manecilla de latón que cruza la esfera grabada de un reloj astronómico',
    'clock-hand': 'Manecilla de latón que apunta más allá de un anillo de discos zodiacales en tonos pastel',
    'sign-ring-hand': 'Anillo de discos zodiacales en tonos pastel sobre la manecilla de latón de un reloj astronómico',
    'sign-ring': 'Anillo de discos zodiacales en tonos pastel bajo una banda de figuras zodiacales pintadas',
    twins: 'Gemelos pintados entre figuras zodiacales, sobre discos de signos en tonos pastel',
    'zodiac-figures': 'León pintado entre figuras zodiacales, junto a discos de signos en tonos pastel',
  },
  pt: {
    crescent: 'Lua crescente dourada na faixa escura e estrelada de um relógio astronômico',
    'crescent-band': 'Lua crescente dourada acima de figuras do zodíaco pintadas em uma faixa estrelada',
    'sun-moon': 'Rosto de sol dourado e lua crescente acima de figuras do zodíaco pintadas',
    'sun-moon-signs': 'Sol dourado e lua crescente acima de figuras do zodíaco pintadas e de um anel de discos dos signos em tons pastel',
    'clock-dial': 'Ponteiro de latão cruzando o mostrador gravado de um relógio astronômico',
    'clock-hand': 'Ponteiro de latão apontando além de um anel de discos dos signos em tons pastel',
    'sign-ring-hand': 'Anel de discos dos signos em tons pastel acima do ponteiro de latão de um relógio astronômico',
    'sign-ring': 'Anel de discos dos signos em tons pastel abaixo de uma faixa de figuras do zodíaco pintadas',
    twins: 'Gêmeos pintados entre figuras do zodíaco, acima de discos dos signos em tons pastel',
    'zodiac-figures': 'Leão pintado entre figuras do zodíaco, ao lado de discos dos signos em tons pastel',
  },
  fr: {
    crescent: 'Croissant de lune doré sur la bande sombre et étoilée d’une horloge astronomique',
    'crescent-band': 'Croissant de lune doré au-dessus de figures zodiacales peintes sur une bande étoilée',
    'sun-moon': 'Visage de soleil doré et croissant de lune au-dessus de figures zodiacales peintes',
    'sun-moon-signs': 'Soleil doré et croissant de lune au-dessus de figures zodiacales peintes et d’un anneau de disques des signes aux tons pastel',
    'clock-dial': 'Aiguille en laiton traversant le cadran gravé d’une horloge astronomique',
    'clock-hand': 'Aiguille en laiton pointant au-delà d’un anneau de disques des signes aux tons pastel',
    'sign-ring-hand': 'Anneau de disques des signes aux tons pastel au-dessus de l’aiguille en laiton d’une horloge astronomique',
    'sign-ring': 'Anneau de disques des signes aux tons pastel sous une bande de figures zodiacales peintes',
    twins: 'Jumeaux peints parmi des figures zodiacales, au-dessus de disques des signes aux tons pastel',
    'zodiac-figures': 'Lion peint parmi des figures zodiacales, à côté de disques des signes aux tons pastel',
  },
  it: {
    crescent: 'Falce di luna dorata sulla fascia scura e stellata di un orologio astronomico',
    'crescent-band': 'Falce di luna dorata sopra figure zodiacali dipinte su una fascia stellata',
    'sun-moon': 'Volto di sole dorato e falce di luna sopra figure zodiacali dipinte',
    'sun-moon-signs': 'Sole dorato e falce di luna sopra figure zodiacali dipinte e un anello di dischi dei segni in tinte pastello',
    'clock-dial': 'Lancetta d’ottone che attraversa il quadrante inciso di un orologio astronomico',
    'clock-hand': 'Lancetta d’ottone che punta oltre un anello di dischi dei segni in tinte pastello',
    'sign-ring-hand': 'Anello di dischi dei segni in tinte pastello sopra la lancetta d’ottone di un orologio astronomico',
    'sign-ring': 'Anello di dischi dei segni in tinte pastello sotto una fascia di figure zodiacali dipinte',
    twins: 'Gemelli dipinti tra figure zodiacali, sopra dischi dei segni in tinte pastello',
    'zodiac-figures': 'Leone dipinto tra figure zodiacali, accanto a dischi dei segni in tinte pastello',
  },
  ru: {
    crescent: 'Позолоченный полумесяц на тёмной звёздной ленте астрономических часов',
    'crescent-band': 'Позолоченный полумесяц над расписными зодиакальными фигурами на звёздной ленте',
    'sun-moon': 'Позолоченный лик солнца и полумесяц над расписными зодиакальными фигурами',
    'sun-moon-signs': 'Позолоченные солнце и полумесяц над расписными зодиакальными фигурами и кольцом пастельных дисков знаков',
    'clock-dial': 'Латунная стрелка пересекает гравированный циферблат астрономических часов',
    'clock-hand': 'Латунная стрелка указывает мимо кольца пастельных дисков знаков зодиака',
    'sign-ring-hand': 'Кольцо пастельных дисков знаков зодиака над латунной стрелкой астрономических часов',
    'sign-ring': 'Кольцо пастельных дисков знаков зодиака под лентой расписных зодиакальных фигур',
    twins: 'Расписные близнецы среди зодиакальных фигур над пастельными дисками знаков',
    'zodiac-figures': 'Расписной лев среди зодиакальных фигур рядом с пастельными дисками знаков',
  },
};

export function heroCropAlt(name: HeroCropName, locale: CatalogLocale = 'en'): string {
  return HERO_CROP_ALT[locale][name] ?? HERO_CROP_ALT.en[name];
}
