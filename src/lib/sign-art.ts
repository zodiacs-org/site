/**
 * Hero artwork for the twelve sign guides: one illustrated 3:2 panel per
 * sign in the hero film's enamel-and-bronze style, published at two widths
 * under public/assets/sign-art/. Alt text describes what each panel shows,
 * in every locale that renders a sign guide.
 */
import type { CatalogLocale } from './i18n/core.js';

export const SIGN_ART_WIDTHS = [720, 1200] as const;
export const SIGN_ART_SIZE = { width: 1200, height: 800 } as const;

export function signArtSrc(slug: string, width: (typeof SIGN_ART_WIDTHS)[number] = 1200): string {
  return `/assets/sign-art/${slug}-${width}.webp`;
}

export function signArtSrcset(slug: string): string {
  return SIGN_ART_WIDTHS.map((width) => `${signArtSrc(slug, width)} ${width}w`).join(', ');
}

const SIGN_ART_ALT: Record<CatalogLocale, Record<string, string>> = {
  en: {
    aries: 'Illustrated ram with golden horns in an ornate bronze zodiac medallion',
    taurus: 'Illustrated bull resting among flowers in an ornate bronze zodiac medallion',
    gemini: 'Illustrated twins holding hands in an ornate bronze zodiac medallion',
    cancer: 'Illustrated crab on a moonlit shore in an ornate bronze zodiac medallion',
    leo: 'Illustrated lion with a golden mane on a star-painted bronze zodiac panel',
    virgo: 'Illustrated maiden holding a sheaf of wheat on a star-painted bronze zodiac panel',
    libra: 'Illustrated woman holding balance scales in an ornate bronze zodiac medallion',
    scorpio: 'Illustrated scorpion with a raised tail in an ornate bronze zodiac medallion',
    sagittarius: 'Illustrated centaur drawing a bow in an ornate bronze zodiac medallion',
    capricorn: 'Illustrated sea-goat with a fish tail in an ornate bronze zodiac medallion',
    aquarius: 'Illustrated water bearer pouring from a jar in an ornate bronze zodiac medallion',
    pisces: 'Illustrated pair of fish joined by a ribbon in an ornate bronze zodiac medallion',
  },
  es: {
    aries: 'Ilustración de un carnero con cuernos dorados en un medallón zodiacal de bronce ornamentado',
    taurus: 'Ilustración de un toro recostado entre flores en un medallón zodiacal de bronce ornamentado',
    gemini: 'Ilustración de dos gemelos tomados de la mano en un medallón zodiacal de bronce ornamentado',
    cancer: 'Ilustración de un cangrejo en una orilla bajo la luna en un medallón zodiacal de bronce ornamentado',
    leo: 'Ilustración de un león de melena dorada en un panel zodiacal de bronce pintado de estrellas',
    virgo: 'Ilustración de una doncella con un haz de trigo en un panel zodiacal de bronce pintado de estrellas',
    libra: 'Ilustración de una mujer que sostiene una balanza en un medallón zodiacal de bronce ornamentado',
    scorpio: 'Ilustración de un escorpión con la cola alzada en un medallón zodiacal de bronce ornamentado',
    sagittarius: 'Ilustración de un centauro que tensa un arco en un medallón zodiacal de bronce ornamentado',
    capricorn: 'Ilustración de una cabra marina con cola de pez en un medallón zodiacal de bronce ornamentado',
    aquarius: 'Ilustración de un aguador que vierte agua de un cántaro en un medallón zodiacal de bronce ornamentado',
    pisces: 'Ilustración de dos peces unidos por una cinta en un medallón zodiacal de bronce ornamentado',
  },
  pt: {
    aries: 'Ilustração de um carneiro de chifres dourados em um medalhão zodiacal de bronze ornamentado',
    taurus: 'Ilustração de um touro deitado entre flores em um medalhão zodiacal de bronze ornamentado',
    gemini: 'Ilustração de dois gêmeos de mãos dadas em um medalhão zodiacal de bronze ornamentado',
    cancer: 'Ilustração de um caranguejo em uma praia ao luar em um medalhão zodiacal de bronze ornamentado',
    leo: 'Ilustração de um leão de juba dourada em um painel zodiacal de bronze pintado de estrelas',
    virgo: 'Ilustração de uma donzela segurando um feixe de trigo em um painel zodiacal de bronze pintado de estrelas',
    libra: 'Ilustração de uma mulher segurando uma balança em um medalhão zodiacal de bronze ornamentado',
    scorpio: 'Ilustração de um escorpião com a cauda erguida em um medalhão zodiacal de bronze ornamentado',
    sagittarius: 'Ilustração de um centauro puxando o arco em um medalhão zodiacal de bronze ornamentado',
    capricorn: 'Ilustração de uma cabra-marinha com cauda de peixe em um medalhão zodiacal de bronze ornamentado',
    aquarius: 'Ilustração de um aguadeiro despejando água de um jarro em um medalhão zodiacal de bronze ornamentado',
    pisces: 'Ilustração de dois peixes unidos por uma fita em um medalhão zodiacal de bronze ornamentado',
  },
  fr: {
    aries: 'Illustration d’un bélier aux cornes dorées dans un médaillon zodiacal en bronze ouvragé',
    taurus: 'Illustration d’un taureau couché parmi des fleurs dans un médaillon zodiacal en bronze ouvragé',
    gemini: 'Illustration de jumeaux se tenant la main dans un médaillon zodiacal en bronze ouvragé',
    cancer: 'Illustration d’un crabe sur un rivage au clair de lune dans un médaillon zodiacal en bronze ouvragé',
    leo: 'Illustration d’un lion à la crinière dorée sur un panneau zodiacal en bronze semé d’étoiles',
    virgo: 'Illustration d’une jeune femme tenant une gerbe de blé sur un panneau zodiacal en bronze semé d’étoiles',
    libra: 'Illustration d’une femme tenant une balance dans un médaillon zodiacal en bronze ouvragé',
    scorpio: 'Illustration d’un scorpion à la queue dressée dans un médaillon zodiacal en bronze ouvragé',
    sagittarius: 'Illustration d’un centaure bandant son arc dans un médaillon zodiacal en bronze ouvragé',
    capricorn: 'Illustration d’une chèvre marine à queue de poisson dans un médaillon zodiacal en bronze ouvragé',
    aquarius: 'Illustration d’un porteur d’eau versant une jarre dans un médaillon zodiacal en bronze ouvragé',
    pisces: 'Illustration de deux poissons reliés par un ruban dans un médaillon zodiacal en bronze ouvragé',
  },
  it: {
    aries: 'Illustrazione di un ariete dalle corna dorate in un medaglione zodiacale in bronzo decorato',
    taurus: 'Illustrazione di un toro sdraiato tra i fiori in un medaglione zodiacale in bronzo decorato',
    gemini: 'Illustrazione di due gemelli che si tengono per mano in un medaglione zodiacale in bronzo decorato',
    cancer: 'Illustrazione di un granchio su una riva al chiaro di luna in un medaglione zodiacale in bronzo decorato',
    leo: 'Illustrazione di un leone dalla criniera dorata su un pannello zodiacale in bronzo dipinto di stelle',
    virgo: 'Illustrazione di una fanciulla con un covone di grano su un pannello zodiacale in bronzo dipinto di stelle',
    libra: 'Illustrazione di una donna che regge una bilancia in un medaglione zodiacale in bronzo decorato',
    scorpio: 'Illustrazione di uno scorpione con la coda sollevata in un medaglione zodiacale in bronzo decorato',
    sagittarius: 'Illustrazione di un centauro che tende l’arco in un medaglione zodiacale in bronzo decorato',
    capricorn: 'Illustrazione di una capra marina con la coda di pesce in un medaglione zodiacale in bronzo decorato',
    aquarius: 'Illustrazione di un portatore d’acqua che versa da una brocca in un medaglione zodiacale in bronzo decorato',
    pisces: 'Illustrazione di due pesci uniti da un nastro in un medaglione zodiacale in bronzo decorato',
  },
  ru: {
    aries: 'Иллюстрация: баран с золотыми рогами в узорном бронзовом зодиакальном медальоне',
    taurus: 'Иллюстрация: бык, лежащий среди цветов, в узорном бронзовом зодиакальном медальоне',
    gemini: 'Иллюстрация: близнецы держатся за руки в узорном бронзовом зодиакальном медальоне',
    cancer: 'Иллюстрация: краб на берегу под луной в узорном бронзовом зодиакальном медальоне',
    leo: 'Иллюстрация: лев с золотой гривой на бронзовой зодиакальной панели, расписанной звёздами',
    virgo: 'Иллюстрация: дева со снопом пшеницы на бронзовой зодиакальной панели, расписанной звёздами',
    libra: 'Иллюстрация: женщина с весами в руках в узорном бронзовом зодиакальном медальоне',
    scorpio: 'Иллюстрация: скорпион с поднятым хвостом в узорном бронзовом зодиакальном медальоне',
    sagittarius: 'Иллюстрация: кентавр натягивает лук в узорном бронзовом зодиакальном медальоне',
    capricorn: 'Иллюстрация: козёл с рыбьим хвостом в узорном бронзовом зодиакальном медальоне',
    aquarius: 'Иллюстрация: юноша льёт воду из кувшина в узорном бронзовом зодиакальном медальоне',
    pisces: 'Иллюстрация: две рыбы, связанные лентой, в узорном бронзовом зодиакальном медальоне',
  },
};

export function signArtAlt(slug: string, locale: CatalogLocale = 'en'): string {
  const alt = SIGN_ART_ALT[locale][slug] ?? SIGN_ART_ALT.en[slug];
  if (!alt) throw new Error(`No sign art for: ${slug}`);
  return alt;
}
