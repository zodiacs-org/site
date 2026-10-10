/**
 * Accurate editorial identity for the Zodiacs.org publication.
 *
 * Articles are authored by the Zodiacs.org organization. The visible byline
 * links to the system disclosure; no fictional Person entity or credentials
 * are emitted for search engines or readers.
 */

import { absoluteBrandIconUrl, BRAND_ICON_PATHS } from './brand-icons.mjs';
import { ORGANIZATION_NAME, SOCIAL_PROFILES } from '../strings/seo.en.mjs';

export const EDITOR_NAME = 'Zodiacs.org Editorial System';
export const EDITOR_ID = 'https://zodiacs.org/#org';
export const EDITOR_PATH = '/about/#editorial-system';

/** Full Organization node — rendered once, on /about/. */
export const EDITOR_ORGANIZATION = {
  '@type': 'Organization',
  '@id': EDITOR_ID,
  name: ORGANIZATION_NAME,
  alternateName: 'Zodiacs.org',
  sameAs: SOCIAL_PROFILES,
  url: 'https://zodiacs.org/',
  logo: {
    '@type': 'ImageObject',
    url: absoluteBrandIconUrl(BRAND_ICON_PATHS.icon512),
    width: 512,
    height: 512,
  },
  email: 'admin@zodiacs.org',
  description:
    'A free astrology reference for birth charts, daily horoscopes, sign guides, '
    + 'and clear interpretation, with private on-device tools.',
  publishingPrinciples: 'https://zodiacs.org/about/#editorial-system',
  knowsAbout: ['astrology', 'astronomical computation', 'the tropical zodiac', 'house systems'],
} as const;

/** Compact Organization author reference embedded by Article emitters. */
export const EDITOR_AUTHOR = {
  '@type': 'Organization',
  '@id': EDITOR_ID,
  name: 'Zodiacs.org',
  publishingPrinciples: 'https://zodiacs.org/about/#editorial-system',
} as const;
