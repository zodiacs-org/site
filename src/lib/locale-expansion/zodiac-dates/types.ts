/** Copy contract for the localized zodiac dates page (/es/learn/zodiac-dates/ and the like). */
import type { ExpansionLocale } from '../horoscope/types';

export interface ZodiacDatesCopy {
  locale: ExpansionLocale;
  /** Under 60 characters. */
  title(currentYear: number, nextYear: number): string;
  h1: string;
  description(currentYear: number, nextYear: number): string;
  lede(currentYear: number, nextYear: number): string;
  crumbs: string;
  tableHeading: string;
  tableCaption(currentYear: number, nextYear: number): string;
  columns: { sign: string; dates: string; longitude: string; element: string; modality: string; ruler: string; seasons: string; ingress(year: number): string };
  north: string;
  south: string;
  /** Season names keyed by the English season word in ZODIAC_DATE_ROWS (Spring, Summer, Autumn, Winter). */
  season: Record<string, string>;
  /** Three or four short paragraphs: what the exact dates mean, cusps, how to check a birth near a boundary. */
  explainer: string[];
  explainerHeading: string;
  calculatorLink: string;
  methodLink: string;
  csvLink: string;
  faqHeading: string;
  faq(currentYear: number): Array<{ q: string; a: string }>;
}
