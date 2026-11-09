/**
 * Shareable cards, drawn at build time (src/pages/cards/): one compatibility
 * card per sign pair and one "big three" card per sign, in every live
 * locale. Each card names the page it comes from and links back to it; the
 * page shares its own canonical address. Cards are keyed by sign slugs only:
 * nothing a person types, no birth date, time or place, ever reaches them.
 */
import { readFile } from 'node:fs/promises';
import { h } from 'preact';
import { encode as encodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';
import { lockupImage } from '../../server/brand-lockup-image';
import { localizedPairFacts, type PairLocale } from '../compat-i18n';
import { pairFacts } from '../compat';
import { SIGNS, signBySlug, signName, elementLabel, modalityLabel } from '../signs';
import { SHARE_CARD_COPY } from '../share-card-copy';
import type { BigThreeLines } from './big-three-lines/types';

export type CardLocale = 'en' | 'es' | 'pt' | 'fr' | 'it';
export const CARD_LOCALES: readonly CardLocale[] = ['en', 'es', 'pt', 'fr', 'it'];
export const CARD_SIZE = { width: 1200, height: 630 } as const;
const JPEG_QUALITY = 86;

const linesFound = import.meta.glob<Record<string, BigThreeLines>>('./big-three-lines/{en,es,pt,fr,it}.ts', { eager: true });
export function bigThreeLines(locale: CardLocale): BigThreeLines {
  const mod = linesFound[`./big-three-lines/${locale}.ts`]?.[locale];
  if (!mod) throw new Error(`No big three card lines for ${locale}`);
  return mod;
}

const prefix = (locale: CardLocale) => (locale === 'en' ? '' : `/${locale}`);
/** The page each card links back to, and the address it prints. */
export const pairPagePath = (locale: CardLocale, pair: string) => `${prefix(locale)}/compatibility/${pair}/`;
export const signPagePath = (locale: CardLocale, sign: string) => `${prefix(locale)}/${sign}/`;
/** Where the built card lives. */
export const pairCardPath = (locale: CardLocale, pair: string) => `/cards/${locale}/pair/${pair}.jpg`;
export const bigThreeCardPath = (locale: CardLocale, sign: string) => `/cards/${locale}/big-three/${sign}.jpg`;

// Literal addresses only, as src/server/result-preview.ts does, so the share-code audit can see every load.
const FONT_FILES = {
  noto: new URL('../../../node_modules/@vercel/og/dist/noto-sans-v27-latin-regular.ttf', import.meta.url),
  serif: new URL('../../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-500-normal.woff', import.meta.url),
  serifExt: new URL('../../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-ext-500-normal.woff', import.meta.url),
  serifRegular: new URL('../../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff', import.meta.url),
  italic: new URL('../../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff', import.meta.url),
};
let fontsPromise: Promise<Array<{ name: string; data: ArrayBuffer; weight: 400 | 500; style: 'normal' | 'italic' }>> | null = null;
function fonts() {
  const read = (url: URL) => readFile(url).then((bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  fontsPromise ??= Promise.all([
    read(FONT_FILES.noto), read(FONT_FILES.serif), read(FONT_FILES.serifExt), read(FONT_FILES.serifRegular), read(FONT_FILES.italic),
  ]).then(([noto, serif, serifExt, serifRegular, italic]) => [
    { name: 'Noto', data: noto, weight: 400 as const, style: 'normal' as const },
    { name: 'EB Garamond', data: serif, weight: 500 as const, style: 'normal' as const },
    { name: 'EB Garamond', data: serifRegular, weight: 400 as const, style: 'normal' as const },
    { name: 'EB Garamond', data: italic, weight: 400 as const, style: 'italic' as const },
    { name: 'EB Garamond Ext', data: serifExt, weight: 500 as const, style: 'normal' as const },
  ]);
  return fontsPromise;
}

const DISC_FILES: Record<string, URL> = {
  aries: new URL('../../../public/assets/sdk/zodiac-icons/circle/aries.png', import.meta.url),
  taurus: new URL('../../../public/assets/sdk/zodiac-icons/circle/taurus.png', import.meta.url),
  gemini: new URL('../../../public/assets/sdk/zodiac-icons/circle/gemini.png', import.meta.url),
  cancer: new URL('../../../public/assets/sdk/zodiac-icons/circle/cancer.png', import.meta.url),
  leo: new URL('../../../public/assets/sdk/zodiac-icons/circle/leo.png', import.meta.url),
  virgo: new URL('../../../public/assets/sdk/zodiac-icons/circle/virgo.png', import.meta.url),
  libra: new URL('../../../public/assets/sdk/zodiac-icons/circle/libra.png', import.meta.url),
  scorpio: new URL('../../../public/assets/sdk/zodiac-icons/circle/scorpio.png', import.meta.url),
  sagittarius: new URL('../../../public/assets/sdk/zodiac-icons/circle/sagittarius.png', import.meta.url),
  capricorn: new URL('../../../public/assets/sdk/zodiac-icons/circle/capricorn.png', import.meta.url),
  aquarius: new URL('../../../public/assets/sdk/zodiac-icons/circle/aquarius.png', import.meta.url),
  pisces: new URL('../../../public/assets/sdk/zodiac-icons/circle/pisces.png', import.meta.url),
};

const discs = new Map<string, Promise<string>>();
function disc(sign: string) {
  if (!discs.has(sign)) {
    discs.set(sign, readFile(DISC_FILES[sign])
      .then((bytes) => `data:image/png;base64,${bytes.toString('base64')}`));
  }
  return discs.get(sign)!;
}

async function render(element: ReturnType<typeof h>): Promise<Uint8Array> {
  const { ImageResponse } = await import('@vercel/og');
  const response = new ImageResponse(element as never, { ...CARD_SIZE, fonts: await fonts() });
  const { width, height, data } = PNG.sync.read(Buffer.from(await response.arrayBuffer()));
  return new Uint8Array(encodeJpeg({ width, height, data }, JPEG_QUALITY).data);
}

const INK = { bg: '#060709', text: '#EEF1F7', muted: '#A9B0C2', faint: '#6F778C' };
const serif = { fontFamily: 'EB Garamond, EB Garamond Ext', fontWeight: 500 };
const sans = { fontFamily: 'Noto' };

function frame(hue: string, body: ReturnType<typeof h>, address: string) {
  return h('div', {
    style: {
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      backgroundColor: INK.bg, color: INK.text, padding: '56px 64px', borderTop: `6px solid ${hue}`,
    },
  },
  body,
  h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
    h('div', { style: { ...sans, fontSize: 24, color: INK.muted } }, `zodiacs.org${address}`),
    lockupImage(30)));
}

export async function pairCard(locale: CardLocale, pair: string): Promise<Uint8Array> {
  const [slugA, slugB] = pair.split('-');
  const facts = locale === 'en' ? pairFacts(slugA, slugB) : localizedPairFacts(locale as PairLocale, slugA, slugB);
  const a = signBySlug(facts.a.slug);
  const b = signBySlug(facts.b.slug);
  const copy = SHARE_CARD_COPY[locale];
  const [discA, discB] = await Promise.all([disc(a.slug), disc(b.slug)]);
  const names = facts.same ? signName(a, locale) : `${signName(a, locale)} & ${signName(b, locale)}`;
  const body = h('div', { style: { display: 'flex', alignItems: 'center' } },
    h('div', { style: { display: 'flex', marginRight: 48 } },
      h('img', { src: discA, width: 180, height: 180 }),
      facts.same ? null : h('img', { src: discB, width: 180, height: 180, style: { marginLeft: -36 } })),
    h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1 } },
      h('div', { style: { ...serif, fontStyle: 'italic', fontWeight: 400, fontSize: 32, color: INK.muted } }, copy.compatibilityTitle),
      h('div', { style: { ...serif, fontSize: names.length > 22 ? 64 : 76, lineHeight: 1.05, marginTop: 8 } }, names),
      h('div', { style: { ...sans, fontSize: 28, color: INK.text, marginTop: 24 } }, `${elementLabel(a.element, locale)} · ${elementLabel(b.element, locale)}: ${facts.element.label}`),
      h('div', { style: { ...sans, fontSize: 28, color: INK.muted, marginTop: 10 } }, `${modalityLabel(a.modality, locale)} · ${modalityLabel(b.modality, locale)}: ${facts.modality.label}`)));
  return render(frame(a.hue, body, pairPagePath(locale, facts.slug)));
}

export async function bigThreeCard(locale: CardLocale, sign: string): Promise<Uint8Array> {
  const s = signBySlug(sign);
  const copy = SHARE_CARD_COPY[locale];
  const lines = bigThreeLines(locale)[s.slug as keyof BigThreeLines];
  const row = (label: string, text: string) => h('div', { style: { display: 'flex', flexDirection: 'column', marginTop: 14 } },
    h('div', { style: { ...sans, fontSize: 20, color: s.hue, letterSpacing: 1 } }, label),
    h('div', { style: { ...sans, fontSize: 25, color: INK.text, marginTop: 2 } }, text));
  const body = h('div', { style: { display: 'flex', alignItems: 'flex-start' } },
    h('img', { src: await disc(s.slug), width: 180, height: 180, style: { marginRight: 44 } }),
    h('div', { style: { display: 'flex', flexDirection: 'column', flex: 1 } },
      h('div', { style: { ...serif, fontStyle: 'italic', fontWeight: 400, fontSize: 30, color: INK.muted } }, copy.bigThreeTitle),
      h('div', { style: { ...serif, fontSize: 60, lineHeight: 1.05 } }, signName(s, locale)),
      row(copy.sun, lines.sun),
      row(copy.moon, lines.moon),
      row(copy.rising, lines.rising)));
  return render(frame(s.hue, body, signPagePath(locale, s.slug)));
}

export const ALL_PAIR_SLUGS = SIGNS.flatMap((a, index) => SIGNS.slice(index).map((b) => `${a.slug}-${b.slug}`));
