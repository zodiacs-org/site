// One compatibility card per sign pair and live locale, drawn at build time.
import type { APIRoute } from 'astro';
import { ALL_PAIR_SLUGS, CARD_LOCALES, pairCard, type CardLocale } from '../../../../lib/share-cards/cards';

export const prerender = true;

export function getStaticPaths() {
  return CARD_LOCALES.flatMap((locale) => ALL_PAIR_SLUGS.map((pair) => ({ params: { locale, pair } })));
}

export const GET: APIRoute = async ({ params }) => new Response(
  await pairCard(params.locale as CardLocale, params.pair!),
  { headers: { 'Content-Type': 'image/jpeg' } },
);
