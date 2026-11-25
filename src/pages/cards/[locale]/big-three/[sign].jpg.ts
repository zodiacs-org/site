// One big three card per sign and live locale, drawn at build time.
import type { APIRoute } from 'astro';
import { CARD_LOCALES, bigThreeCard, type CardLocale } from '../../../../lib/share-cards/cards';
import { SIGN_SLUGS } from '../../../../lib/signs';

export const prerender = true;

export function getStaticPaths() {
  return CARD_LOCALES.flatMap((locale) => SIGN_SLUGS.map((sign) => ({ params: { locale, sign } })));
}

export const GET: APIRoute = async ({ params }) => new Response(
  await bigThreeCard(params.locale as CardLocale, params.sign!),
  { headers: { 'Content-Type': 'image/jpeg' } },
);
