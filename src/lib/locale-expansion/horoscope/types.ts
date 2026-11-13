/**
 * The shared fact model for the localized horoscope periods.
 *
 * The English program (src/data/horoscope-program.json) is the single source
 * of computed sky: each English passage names the receipts it rests on. The
 * engine (./engine.ts) turns each passage's receipts into plain facts, and a
 * locale module writes its own sentences from those facts, in its own word
 * order and register. The localized passage keeps the English passage's
 * receipts, so a reader in any language answers to the same evidence.
 *
 * A locale module never translates English sentences; it only sees facts.
 */
import type { HoroscopeSign } from '../../horoscope-program-types';

export type ExpansionLocale = 'es' | 'pt' | 'fr' | 'it' | 'ru';

export type PeriodSurface = 'tomorrow' | 'weekly' | 'love' | 'career' | 'yearly-2026' | 'yearly-2027';

/** A body's place on one day (noon UTC), counted from the reader's Sun sign. */
export interface PositionFact {
  kind: 'position';
  body: string;
  sign: string;
  /** Solar whole-sign house, 1 to 12. */
  house: number;
  /** ISO instant, noon UTC of the day. */
  at: string;
  retrograde: boolean;
}

/** A dated sky event, with the house (or houses, for an aspect) it falls in. */
export interface EventFact {
  kind: 'event';
  eventKind: 'ingress' | 'station' | 'lunation' | 'eclipse' | 'aspect';
  /** station: retrograde | direct; lunation: new | full; eclipse: solar | lunar; aspect: the aspect. */
  eventType?: string;
  /** The moving body for ingress and station, the Moon for lunations and eclipses. */
  body?: string;
  sign?: string;
  /** For aspects: the two bodies, each with its sign and house. */
  a?: string;
  b?: string;
  aSign?: string;
  bSign?: string;
  houses: number[];
  at: string;
  degree?: number;
}

export type Fact = PositionFact | EventFact;

export interface PassageFacts {
  /** Position in the English reading, 0-based. Each surface has a fixed count. */
  index: number;
  facts: Fact[];
}

export interface PeriodContext {
  sign: HoroscopeSign;
  surface: PeriodSurface;
  /** Edition period in UTC days, YYYY-MM-DD. */
  from: string;
  through: string;
  passages: PassageFacts[];
}

export interface MonthlyContext {
  sign: HoroscopeSign;
  /** YYYY-MM */
  month: string;
  /** The month's dated events in time order, each counted from the sign. */
  events: EventFact[];
}

export interface LocalizedPassage {
  heading?: string;
  text: string;
}

export interface PeriodChrome {
  /** Under 60 characters for the longest sign name. */
  title(signName: string, ctx: { surface: PeriodSurface | 'monthly'; from: string; through: string; month?: string }): string;
  h1(signName: string, ctx: { surface: PeriodSurface | 'monthly'; from: string; through: string; month?: string }): string;
  description(signName: string, ctx: { surface: PeriodSurface | 'monthly'; from: string; through: string; month?: string }): string;
  /** The period switch, in reading order. */
  periodLabel: Record<'today' | 'tomorrow' | 'weekly' | 'monthly' | 'love' | 'career' | 'yearly-2026' | 'yearly-2027', string>;
  /** Breadcrumb root ("Horóscopos"). */
  crumbs: string;
  switchAria: string;
  skyHeading: string;
  skyIntro: string;
  /** "Mercurio en Escorpio, casa 4", rendered from a fact for the sky list. */
  skyRow(fact: Fact): string;
  moreHeading: string;
  signGuide(signName: string): string;
  pairs(signName: string): string;
  calculator: string;
  otherSigns: string;
  method: string;
  /**
   * "Confianza de lectura 40%": the site's rule (src/ai-tools/reading-confidence.ts), a Sun sign alone.
   * Italian ignores the value and prints a fixed "Lettura dal segno solare".
   */
  confidence(value: number): string;
  /** One sentence: how specific the details are (Italian: that only the Sun sign is used), never the odds that something happens. */
  confidenceNote: string;
  /** Three questions and answers for the FAQ block (FAQPage markup). */
  faq(signName: string, surface: PeriodSurface | 'monthly'): Array<{ q: string; a: string }>;
}

export interface HoroscopeLocaleModule {
  locale: ExpansionLocale;
  chrome: PeriodChrome;
  /**
   * Writes one passage per English passage, in the same order, from the
   * facts alone. Must return exactly ctx.passages.length passages.
   */
  period(ctx: PeriodContext): LocalizedPassage[];
  /** Writes the month from the transit catalog's events. */
  monthly(ctx: MonthlyContext): LocalizedPassage[];
}
