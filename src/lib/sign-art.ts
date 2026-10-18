/**
 * Hero artwork for the twelve sign guides: one illustrated 3:2 panel per
 * sign in the hero film's enamel-and-bronze style, published at two widths
 * under public/assets/sign-art/. Alt text describes what each panel shows,
 * in every locale that renders a sign guide.
 */
import type { CatalogLocale } from './i18n/core.js';

export const SIGN_ART_WIDTHS = [720, 1200] as const;
export const SIGN_ART_SIZE = { width: 1200, height: 800 } as const;

/** The guide hero's rendered width: 72% of the window on wide screens, the full card on phones. */
export const SIGN_GUIDE_HERO_SIZES = '(min-width: 761px) 72vw, calc(100vw - 16px)';

/** The birthday hero's rendered width: 62% of the frame on wide screens, the full card on phones. */
export const BIRTHDAY_HERO_SIZES = '(min-width: 761px) 62vw, calc(100vw - 16px)';

export function signArtSrc(slug: string, width: (typeof SIGN_ART_WIDTHS)[number] = 1200): string {
  return `/assets/sign-art/${slug}-${width}.webp`;
}

export function signArtSrcset(slug: string): string {
  return SIGN_ART_WIDTHS.map((width) => `${signArtSrc(slug, width)} ${width}w`).join(', ');
}

const SIGN_ART_ALT: Record<CatalogLocale, Record<string, string>> = {
  en: {
    aries: 'Illustrated ram with golden horns in side profile, standing on an ornate bronze and black zodiac dial',
    taurus: 'Illustrated bull with golden horns in side profile, standing on an ornate bronze and black zodiac dial',
    gemini: 'Illustrated twins walking hand in hand in side profile, standing on an ornate bronze and black zodiac dial',
    cancer: 'Illustrated crab in side profile, standing on an ornate bronze and black zodiac dial',
    leo: 'Illustrated lion with a golden mane in side profile, standing on an ornate bronze and black zodiac dial',
    virgo: 'Illustrated maiden holding a sheaf of wheat in side profile, standing on an ornate bronze and black zodiac dial',
    libra: 'Illustrated woman holding balance scales in side profile, standing on an ornate bronze and black zodiac dial',
    scorpio: 'Illustrated scorpion with a raised tail in side profile, standing on an ornate bronze and black zodiac dial',
    sagittarius: 'Illustrated centaur drawing a bow in side profile, standing on an ornate bronze and black zodiac dial',
    capricorn: 'Illustrated sea-goat with a fish tail in side profile, standing on an ornate bronze and black zodiac dial',
    aquarius: 'Illustrated water bearer pouring from an urn in side profile, standing on an ornate bronze and black zodiac dial',
    pisces: 'Illustrated pair of fish joined by a ribbon in side profile, standing on an ornate bronze and black zodiac dial',
  },
  es: {
    aries: 'Ilustración de un carnero con cuernos dorados de perfil sobre un ornamentado dial zodiacal de bronce y negro',
    taurus: 'Ilustración de un toro con cuernos dorados de perfil sobre un ornamentado dial zodiacal de bronce y negro',
    gemini: 'Ilustración de dos gemelos tomados de la mano de perfil sobre un ornamentado dial zodiacal de bronce y negro',
    cancer: 'Ilustración de un cangrejo de perfil sobre un ornamentado dial zodiacal de bronce y negro',
    leo: 'Ilustración de un león de melena dorada de perfil sobre un ornamentado dial zodiacal de bronce y negro',
    virgo: 'Ilustración de una doncella con un haz de trigo de perfil sobre un ornamentado dial zodiacal de bronce y negro',
    libra: 'Ilustración de una mujer que sostiene una balanza de perfil sobre un ornamentado dial zodiacal de bronce y negro',
    scorpio: 'Ilustración de un escorpión con la cola alzada de perfil sobre un ornamentado dial zodiacal de bronce y negro',
    sagittarius: 'Ilustración de un centauro que tensa un arco de perfil sobre un ornamentado dial zodiacal de bronce y negro',
    capricorn: 'Ilustración de una cabra marina con cola de pez de perfil sobre un ornamentado dial zodiacal de bronce y negro',
    aquarius: 'Ilustración de un aguador que vierte agua de un cántaro de perfil sobre un ornamentado dial zodiacal de bronce y negro',
    pisces: 'Ilustración de dos peces unidos por una cinta de perfil sobre un ornamentado dial zodiacal de bronce y negro',
  },
  pt: {
    aries: 'Ilustração de um carneiro de chifres dourados de perfil sobre um mostrador zodiacal ornamentado de bronze e preto',
    taurus: 'Ilustração de um touro de chifres dourados de perfil sobre um mostrador zodiacal ornamentado de bronze e preto',
    gemini: 'Ilustração de dois gêmeos de mãos dadas de perfil sobre um mostrador zodiacal ornamentado de bronze e preto',
    cancer: 'Ilustração de um caranguejo de perfil sobre um mostrador zodiacal ornamentado de bronze e preto',
    leo: 'Ilustração de um leão de juba dourada de perfil sobre um mostrador zodiacal ornamentado de bronze e preto',
    virgo: 'Ilustração de uma donzela segurando um feixe de trigo de perfil sobre um mostrador zodiacal ornamentado de bronze e preto',
    libra: 'Ilustração de uma mulher segurando uma balança de perfil sobre um mostrador zodiacal ornamentado de bronze e preto',
    scorpio: 'Ilustração de um escorpião com a cauda erguida de perfil sobre um mostrador zodiacal ornamentado de bronze e preto',
    sagittarius: 'Ilustração de um centauro puxando o arco de perfil sobre um mostrador zodiacal ornamentado de bronze e preto',
    capricorn: 'Ilustração de uma cabra-marinha com cauda de peixe de perfil sobre um mostrador zodiacal ornamentado de bronze e preto',
    aquarius: 'Ilustração de um aguadeiro despejando água de um jarro de perfil sobre um mostrador zodiacal ornamentado de bronze e preto',
    pisces: 'Ilustração de dois peixes unidos por uma fita de perfil sobre um mostrador zodiacal ornamentado de bronze e preto',
  },
  fr: {
    aries: 'Illustration d’un bélier aux cornes dorées de profil sur un cadran zodiacal ouvragé en bronze et noir',
    taurus: 'Illustration d’un taureau aux cornes dorées de profil sur un cadran zodiacal ouvragé en bronze et noir',
    gemini: 'Illustration de jumeaux se tenant la main de profil sur un cadran zodiacal ouvragé en bronze et noir',
    cancer: 'Illustration d’un crabe de profil sur un cadran zodiacal ouvragé en bronze et noir',
    leo: 'Illustration d’un lion à la crinière dorée de profil sur un cadran zodiacal ouvragé en bronze et noir',
    virgo: 'Illustration d’une jeune femme tenant une gerbe de blé de profil sur un cadran zodiacal ouvragé en bronze et noir',
    libra: 'Illustration d’une femme tenant une balance de profil sur un cadran zodiacal ouvragé en bronze et noir',
    scorpio: 'Illustration d’un scorpion à la queue dressée de profil sur un cadran zodiacal ouvragé en bronze et noir',
    sagittarius: 'Illustration d’un centaure bandant son arc de profil sur un cadran zodiacal ouvragé en bronze et noir',
    capricorn: 'Illustration d’une chèvre marine à queue de poisson de profil sur un cadran zodiacal ouvragé en bronze et noir',
    aquarius: 'Illustration d’un porteur d’eau versant une jarre de profil sur un cadran zodiacal ouvragé en bronze et noir',
    pisces: 'Illustration de deux poissons reliés par un ruban de profil sur un cadran zodiacal ouvragé en bronze et noir',
  },
  it: {
    aries: 'Illustrazione di un ariete dalle corna dorate di profilo su un quadrante zodiacale decorato in bronzo e nero',
    taurus: 'Illustrazione di un toro dalle corna dorate di profilo su un quadrante zodiacale decorato in bronzo e nero',
    gemini: 'Illustrazione di due gemelli che si tengono per mano di profilo su un quadrante zodiacale decorato in bronzo e nero',
    cancer: 'Illustrazione di un granchio di profilo su un quadrante zodiacale decorato in bronzo e nero',
    leo: 'Illustrazione di un leone dalla criniera dorata di profilo su un quadrante zodiacale decorato in bronzo e nero',
    virgo: 'Illustrazione di una fanciulla con un covone di grano di profilo su un quadrante zodiacale decorato in bronzo e nero',
    libra: 'Illustrazione di una donna che regge una bilancia di profilo su un quadrante zodiacale decorato in bronzo e nero',
    scorpio: 'Illustrazione di uno scorpione con la coda sollevata di profilo su un quadrante zodiacale decorato in bronzo e nero',
    sagittarius: 'Illustrazione di un centauro che tende l’arco di profilo su un quadrante zodiacale decorato in bronzo e nero',
    capricorn: 'Illustrazione di una capra marina con la coda di pesce di profilo su un quadrante zodiacale decorato in bronzo e nero',
    aquarius: 'Illustrazione di un portatore d’acqua che versa da una brocca di profilo su un quadrante zodiacale decorato in bronzo e nero',
    pisces: 'Illustrazione di due pesci uniti da un nastro di profilo su un quadrante zodiacale decorato in bronzo e nero',
  },
  ru: {
    aries: 'Иллюстрация: баран с золотыми рогами в профиль на узорном бронзово-чёрном зодиакальном циферблате',
    taurus: 'Иллюстрация: бык с золотыми рогами в профиль на узорном бронзово-чёрном зодиакальном циферблате',
    gemini: 'Иллюстрация: близнецы, держащиеся за руки, в профиль на узорном бронзово-чёрном зодиакальном циферблате',
    cancer: 'Иллюстрация: краб в профиль на узорном бронзово-чёрном зодиакальном циферблате',
    leo: 'Иллюстрация: лев с золотой гривой в профиль на узорном бронзово-чёрном зодиакальном циферблате',
    virgo: 'Иллюстрация: дева со снопом пшеницы в профиль на узорном бронзово-чёрном зодиакальном циферблате',
    libra: 'Иллюстрация: женщина с весами в профиль на узорном бронзово-чёрном зодиакальном циферблате',
    scorpio: 'Иллюстрация: скорпион с поднятым хвостом в профиль на узорном бронзово-чёрном зодиакальном циферблате',
    sagittarius: 'Иллюстрация: кентавр, натягивающий лук, в профиль на узорном бронзово-чёрном зодиакальном циферблате',
    capricorn: 'Иллюстрация: козёл с рыбьим хвостом в профиль на узорном бронзово-чёрном зодиакальном циферблате',
    aquarius: 'Иллюстрация: водолей, льющий воду из кувшина, в профиль на узорном бронзово-чёрном зодиакальном циферблате',
    pisces: 'Иллюстрация: две рыбы, связанные лентой, в профиль на узорном бронзово-чёрном зодиакальном циферблате',
  },
};

export function signArtAlt(slug: string, locale: CatalogLocale = 'en'): string {
  const alt = SIGN_ART_ALT[locale][slug] ?? SIGN_ART_ALT.en[slug];
  if (!alt) throw new Error(`No sign art for: ${slug}`);
  return alt;
}
