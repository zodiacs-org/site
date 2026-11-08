/**
 * getStaticPaths for the injected locale-expansion routes. Each locale has
 * its own entry files (src/locale-pages/{locale}/), injected under a static
 * prefix such as /it/horoscopes/[sign]/ so they outrank the locale trees'
 * catch-all routes (/it/[...slug]); each lists only what is enabled.
 */
import { SIGN_SLUGS } from '../lib/signs';
import { HOROSCOPE_PERIODS, isExpansionEnabled } from '../lib/locale-expansion/policy.mjs';
import { lunations } from '../lib/locale-expansion/lunation/catalog';
import type { ExpansionLocale } from '../lib/locale-expansion/horoscope/types';

export const dailyPaths = (locale: ExpansionLocale) => (isExpansionEnabled(locale, 'horoscope-daily')
  ? SIGN_SLUGS.map((sign) => ({ params: { sign } })) : []);

export const periodPaths = (locale: ExpansionLocale) => HOROSCOPE_PERIODS
  .filter((period) => isExpansionEnabled(locale, `horoscope-${period}`))
  .flatMap((period) => SIGN_SLUGS.map((sign) => ({ params: { sign, period } })));

export const lunationPaths = (locale: ExpansionLocale, kind: 'full' | 'new') => (isExpansionEnabled(locale, `${kind}-moon`)
  ? lunations(kind).map((entry) => ({ params: { date: entry.date } })) : []);
