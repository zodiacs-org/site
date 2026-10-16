/**
 * What the shared compatibility and date cards show, worked out from a
 * checked share query (src/lib/share-results.ts). Pure: the renderer and the
 * link page draw from this model and nothing else.
 */
import { OCCASION_LABELS } from '../lib/occasions/kinds.js';
import {
  COMPATIBILITY_VERDICT_TEXT,
  OCCASION_SHARE_HEADLINES,
  OCCASION_VERDICT_TEXT,
  type CompatibilityShare,
  type OccasionShare,
  type ShareSign,
} from '../lib/share-results.js';
import { HUES } from './chart-preview-model.js';

/** The ring's colour where a sign is not known. */
export const NEUTRAL_HUE = '#C6CCDA';

const signName = (slug: ShareSign) => slug.charAt(0).toUpperCase() + slug.slice(1);

export interface PreviewSign {
  slug: ShareSign | null;
  /** "Leo Sun", or a plain line where the sign is not known. */
  label: string;
  hue: string;
}

export interface CompatibilityCardModel {
  first: string;
  second: string;
  people: [PreviewSign, PreviewSign];
  score: number;
  verdict: string;
  areas: { label: string; value: number }[];
  ring: [string, string];
  /** For the page title and the image's alternative text. */
  title: string;
  summary: string;
}

export interface OccasionCardModel {
  names: string | null;
  headline: string;
  when: string;
  score: number;
  verdict: string;
  signs: PreviewSign[];
  ring: [string, string];
  title: string;
  summary: string;
}

function previewSign(slug: ShareSign | null, body: 'Sun' | 'Moon', unknown: string): PreviewSign {
  return slug
    ? { slug, label: `${signName(slug)} ${body}`, hue: HUES[slug] }
    : { slug: null, label: unknown, hue: NEUTRAL_HUE };
}

export function compatibilityCardModel(share: CompatibilityShare): CompatibilityCardModel {
  const first = share.a ?? 'Person A';
  const second = share.b ?? 'Person B';
  const people: [PreviewSign, PreviewSign] = [
    previewSign(share.aSun, 'Sun', 'Sun sign on the cusp'),
    previewSign(share.bSun, 'Sun', 'Sun sign on the cusp'),
  ];
  const verdict = COMPATIBILITY_VERDICT_TEXT[share.verdict];
  const areas = [
    { label: 'Attraction', value: share.attraction },
    { label: 'Communication', value: share.communication },
    { label: 'Stability', value: share.stability },
  ];
  return {
    first,
    second,
    people,
    score: share.score,
    verdict,
    areas,
    ring: [people[0].hue, people[1].hue],
    title: `${first} and ${second}: ${share.score}/100`,
    summary: `${verdict}. Attraction ${share.attraction}, communication ${share.communication}, long-term stability ${share.stability}.`,
  };
}

const LONG_DATE = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** "Saturday 12 June 2027", built from parts: runtimes differ on the comma after the weekday. */
export function longDate(date: string): string {
  const parts = Object.fromEntries(LONG_DATE.formatToParts(new Date(`${date}T12:00:00Z`)).map((part) => [part.type, part.value]));
  return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year}`;
}

export function occasionCardModel(share: OccasionShare): OccasionCardModel {
  const when = [longDate(share.date), share.place].filter(Boolean).join(' · ');
  const signs = [
    previewSign(share.sun, 'Sun', 'Sun'),
    previewSign(share.moon, 'Moon', 'Moon'),
  ].filter((sign) => sign.slug !== null);
  const verdict = OCCASION_VERDICT_TEXT[share.verdict];
  const headline = OCCASION_SHARE_HEADLINES[share.occasion];
  const ring: [string, string] = [
    share.sun ? HUES[share.sun] : NEUTRAL_HUE,
    share.moon ? HUES[share.moon] : share.sun ? HUES[share.sun] : NEUTRAL_HUE,
  ];
  return {
    names: share.names,
    headline,
    when,
    score: share.score,
    verdict,
    signs,
    ring,
    title: `${share.names ? `${share.names}: ` : ''}${OCCASION_LABELS[share.occasion].replace(/ \(.*\)$/u, '')}, ${share.score}/100`,
    summary: `${verdict}. ${when}.`,
  };
}
