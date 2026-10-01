import type { Daily, DailyEvent } from './daily';
import type { SIGN_SLUGS } from './signs';

export type HoroscopeSign = (typeof SIGN_SLUGS)[number];

export type HoroscopeSurface =
  | 'today'
  | 'tomorrow'
  | 'weekly'
  | 'love'
  | 'career'
  | 'yearly-2027';

export type ProgramEventKind = DailyEvent['kind'] | 'eclipse';

/**
 * Normalized event accepted from an audited monthly or yearly event catalog.
 * `sourceId` should name that catalog when one exists. When omitted, receipts
 * honestly identify the value as coming from the builder's `yearlyEvents`
 * input rather than implying an external source.
 */
export interface HoroscopeProgramEvent {
  kind: ProgramEventKind;
  at: string;
  sourceId?: string;
  planet?: string;
  sign?: string;
  degree?: number;
  type?: string;
  retrograde?: boolean;
  a?: string;
  b?: string;
  aSign?: string;
  aDegree?: number;
  bSign?: string;
  bDegree?: number;
  /** Exact-hit aspect catalogs use zero; approximate aspects are not accepted. */
  orb?: 0;
}

export interface BuildHoroscopeProgramInput {
  /** Canonical YYYY-MM-DD edition date. */
  anchorDate: string;
  /**
   * Explicit deterministic snapshots. A complete program contains the anchor
   * day, tomorrow, and every UTC day in the anchor date's ISO week.
   */
  dailySnapshots: readonly Daily[];
  /**
   * Major 2027 events. A publishable yearly surface requires coverage that
   * includes an ingress, an eclipse, and retrograde/direct station boundaries.
   * A station boundary may sit in adjacent 2026/2028 when its retrograde
   * period overlaps 2027; other event kinds remain strictly in-year.
   */
  yearlyEvents?: readonly HoroscopeProgramEvent[];
}

export type EvidenceKind =
  | 'body-position'
  | 'sky-event'
  | 'solar-house';

/** Serializable fact or derivation behind published copy. */
export interface HoroscopeEvidenceReceipt {
  id: string;
  kind: EvidenceKind;
  sourceId: string;
  label: string;
  at: string;
  body?: string;
  eventKind?: ProgramEventKind;
  eventType?: string;
  a?: string;
  b?: string;
  sign?: string;
  degree?: number;
  /** Present on Moon position receipts so daily strips and auditors use the edition's own phase. */
  moonPhase?: string;
  /** Explicit zero-degree orb for an exact aspect fact. */
  orb?: 0;
  retrograde?: boolean;
  sunSign?: HoroscopeSign;
  house?: number;
  sourceFactId?: string;
}

export interface HoroscopePassage {
  /** Reader-facing section label when the prose renderer owns the editorial structure. */
  heading?: string;
  text: string;
  /** Stable IDs in `HoroscopeProgram.evidence`. */
  evidenceRefs: string[];
}

export interface HoroscopeReading {
  surface: HoroscopeSurface;
  sign: HoroscopeSign;
  period: {
    from: string;
    through: string;
    utcBasis: true;
  };
  title: string;
  status: 'publishable' | 'insufficient-evidence';
  /** Present only for an honest, non-publishable fallback. */
  fallbackReason?: string;
  passages: HoroscopePassage[];
  /** Exact join of passage text, convenient for static page generation. */
  text: string;
  wordCount: number;
}

export interface HoroscopeSignProgram {
  sign: HoroscopeSign;
  readings: Record<HoroscopeSurface, HoroscopeReading>;
}

export interface HoroscopeProgram {
  schema: 'zodiacs.horoscope-program.v1';
  anchorDate: string;
  locale: 'en';
  policy: {
    id: 'org.zodiacs.horoscope-program.en';
    version: '1.0.0';
    rendererVersion: 'zodiacs.horoscope-program-renderer.v9';
    mode: 'deterministic-template';
    model: null;
  };
  coverage: {
    today: 'complete' | 'unavailable';
    tomorrow: 'complete' | 'unavailable';
    isoWeek: 'complete' | 'partial' | 'unavailable';
    yearly2027: 'complete' | 'insufficient';
  };
  evidence: HoroscopeEvidenceReceipt[];
  signs: HoroscopeSignProgram[];
}

export interface HoroscopeProgramViolation {
  ruleId: string;
  path: string;
  message: string;
}
