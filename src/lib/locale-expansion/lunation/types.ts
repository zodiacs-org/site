/**
 * Copy contract for the localized single full and new Moon pages
 * (/es/full-moon/2026-11-24/ and the like). The facts come from the events
 * catalog (src/lib/events/catalog.ts), the same records the English pages
 * print; each locale writes its own sentences from them.
 */
import type { ExpansionLocale } from '../horoscope/types';

export type LunationKind = 'full' | 'new';

export interface LunationFacts {
  kind: LunationKind;
  /** Sign slug of the Moon at the exact instant. */
  sign: string;
  /** ISO instant of the exact lunation. */
  at: string;
  /** Degree within the sign, 0 to 30. */
  degree: number;
  /** Present when the lunation is also an eclipse. */
  eclipse?: { type: 'solar' | 'lunar'; kind?: string };
}

export interface LunationCopy {
  locale: ExpansionLocale;
  /** Under 60 characters for the longest sign name. */
  title(facts: LunationFacts): string;
  h1(facts: LunationFacts): string;
  description(facts: LunationFacts): string;
  /** "Luna llena" or "Luna nueva", for the kicker and breadcrumb. */
  kindLabel(kind: LunationKind): string;
  /** The hub the page sits under, e.g. the full Moon calendar. */
  crumbsRoot: string;
  /** One opening paragraph with the date, the UTC time and the degree. */
  lead(facts: LunationFacts): string;
  /** When it is an eclipse, one sentence saying so. */
  eclipseNote(facts: LunationFacts): string;
  factLabels: { exact: string; position: string; phase: string };
  /** Two or three short paragraphs: what this phase in this sign is about. */
  meaning(facts: LunationFacts): string[];
  signNotesHeading: string;
  signNotesIntro: string;
  /** One line per Sun sign: the solar house it falls in, and what that area covers. */
  signNote(sunSign: string, house: number, facts: LunationFacts): string;
  previous: string;
  next: string;
  calendarLink: string;
  moonPhaseLink: string;
  horoscopesLink: string;
  confidence(value: number): string;
  confidenceNote: string;
  method: string;
  faqHeading: string;
  faq(facts: LunationFacts): Array<{ q: string; a: string }>;
}
