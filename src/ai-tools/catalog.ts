import type { SearchEntry } from '../lib/search/score';

/** Deliberately bounded; this is not a claim to search the entire website. */
export const CONSUMER_CATALOG: SearchEntry[] = [
  { path: '/birth-chart/', title: 'Birth chart calculator', kind: 'tool', description: 'Calculate and explore a natal chart, placements, houses and aspects.' },
  { path: '/moon-sign/', title: 'Moon sign calculator', kind: 'tool', description: 'Find the Moon sign for a birth date and time.' },
  { path: '/rising-sign/', title: 'Rising sign calculator', kind: 'tool', description: 'Calculate the ascendant with a birthplace and time.' },
  { path: '/moon-phase/', title: 'Moon phase', kind: 'tool', description: 'Explore the Moon phase and lunar cycle at an instant.' },
  { path: '/retrogrades/', title: 'Retrograde calendar', kind: 'tool', description: 'Dates for Mercury, Venus and other planetary retrogrades and stations.' },
  { path: '/full-moon-calendar/', title: 'Full Moon calendar', kind: 'tool', description: 'Full Moon dates, signs and calendar exports.' },
  { path: '/transits/', title: 'Transit calculator', kind: 'tool', description: 'Explore current planetary transits to a natal chart.' },
  { path: '/compatibility/', title: 'Compatibility calculator', kind: 'tool', description: 'Compare two charts and explore synastry aspects.' },
  { path: '/saturn-return/', title: 'Saturn return calculator', kind: 'tool', description: 'Explore the timing of Saturn returning to its birth position.' },
  { path: '/methodology/', title: 'Calculation methodology', kind: 'learn', description: 'Planetary positions, houses, timezones, accuracy limits and calculation privacy.' },
  { path: '/learn/', title: 'Learn astrology', kind: 'learn', description: 'Learn signs, planets, houses and aspects with explanatory guides.' },
  { path: '/learn/houses/', title: 'Astrological houses', kind: 'learn', description: 'Learn house systems and the meaning of chart houses.' },
];
