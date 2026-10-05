import type { APIRoute } from 'astro';
import { CATALOG_LOCALES, type CatalogLocale } from '../../lib/i18n/core';
import { skyCalendarResponse } from '../../lib/return-visits/sky-calendar';
export const prerender = true;
export function getStaticPaths() { return CATALOG_LOCALES.filter((locale) => locale !== 'en').map((locale) => ({ params: { returnLocale: locale } })); }
export const GET: APIRoute = ({ params }) => skyCalendarResponse(params.returnLocale as CatalogLocale);
