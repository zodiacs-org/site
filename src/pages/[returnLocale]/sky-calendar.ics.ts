import type { APIRoute } from 'astro';
import { CATALOG_LOCALES, type CatalogLocale } from '../../lib/i18n/core';
import { siteSkyCalendarResponse } from '../../lib/sky-calendar-feed';
export const prerender = true;
export function getStaticPaths() { return CATALOG_LOCALES.filter((locale) => locale !== 'en').map((locale) => ({ params: { returnLocale: locale } })); }
export const GET: APIRoute = ({ params }) => siteSkyCalendarResponse(params.returnLocale as CatalogLocale);
