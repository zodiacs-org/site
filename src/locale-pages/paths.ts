/**
 * getStaticPaths for the injected locale-expansion routes. Each locale has
 * its own entry files (src/locale-pages/{locale}/), injected under a static
 * prefix such as /it/horoscopes/[sign]/ so they outrank the locale trees'
 * catch-all routes (/it/[...slug]); each lists only what is enabled.
 */
import { SIGN_SLUGS } from '../lib/signs';
import { HOROSCOPE_PERIODS, isPathEnabled } from '../lib/locale-expansion/policy.mjs';
import { lunations } from '../lib/locale-expansion/lunation/catalog';
import type { ExpansionLocale } from '../lib/locale-expansion/horoscope/types';

export const dailyPaths = (locale: ExpansionLocale) => SIGN_SLUGS
  .filter((sign) => isPathEnabled(locale, `/horoscopes/${sign}/`))
  .map((sign) => ({ params: { sign } }));

export const periodPaths = (locale: ExpansionLocale) => HOROSCOPE_PERIODS
  .flatMap((period) => SIGN_SLUGS
    .filter((sign) => isPathEnabled(locale, `/horoscopes/${sign}/${period}/`))
    .map((sign) => ({ params: { sign, period } })));

export const lunationPaths = (locale: ExpansionLocale, kind: 'full' | 'new') => lunations(kind)
  .filter((entry) => isPathEnabled(locale, `/${kind}-moon/${entry.date}/`))
  .map((entry) => ({ params: { date: entry.date } }));
