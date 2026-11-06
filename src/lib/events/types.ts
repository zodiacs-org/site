/**
 * Typed presentation contract for the astrology-events surface (Phase 2).
 *
 * These types describe what the event hub and event pages RENDER — they are
 * a read-side contract over the committed fact catalogs (sky.json,
 * eclipses.json, ingresses.json, transits-YYYY-MM.json). Astronomy is never
 * computed here beyond formatting a committed instant through the site's own
 * engine; producing or verifying new event facts stays with the deterministic
 * builders and their verification gates.
 */

export type EventFamily =
  | 'lunation'
  | 'eclipse'
  | 'retrograde'
  | 'ingress'
  | 'aspect'
  | 'station';

/** Family-specific subtype, e.g. 'full' | 'new', 'solar-annular', 'cycle'. */
export type EventSubtype = string;

/** Where a fact record came from. Fixture data may never publish. */
export interface EventProvenance {
  /** Committed catalog file (or 'fixture' for labeled sample data). */
  source:
    | 'sky.json'
    | 'eclipses.json'
    | 'ingresses.json'
    | `transits-${string}.json`
    | 'fixture';
  /** The catalog's own generation stamp, when it records one. */
  generatedAt?: string;
  /** Derivations applied to the committed instant (engine formatting). */
  derived?: string[];
}

export interface EventFacts {
  /** Stable ID, e.g. 'full-moon-2026-07-29' or 'mercury-retrograde-2026-07-18'. */
  id: string;
  family: EventFamily;
  subtype: EventSubtype;
  /** Site-relative canonical path with trailing slash. */
  path: string;
  /** Reader-facing display title, unique across the catalog. */
  title: string;
  /** Exact instant (UTC ISO) — peak, exactitude, ingress, or station. */
  at?: string;
  /** Span start (retrograde cycles). */
  start?: string;
  /** Span end; null = past the data horizon (honest unknown, not a fact). */
  end?: string | null;
  /** Direct-motion crossing of the eventual direct-station longitude. */
  preShadowStart?: string | null;
  /** Direct-motion crossing of the retrograde-station longitude. */
  postShadowEnd?: string | null;
  /** True when a span was clipped at the catalog boundary, not stationed. */
  clamped?: boolean;
  /** Bodies involved, engine names ('Moon', 'Sun', 'Mercury', …). */
  bodies: string[];
  /** Sign slugs involved (lunation sign, ingress destination, aspect signs). */
  signs: string[];
  /** Degree within sign at the instant, when the catalog records one. */
  degree?: number;
  /** Ecliptic longitude at the instant, when the catalog records one. */
  longitude?: number;
  /** Ingress origin sign slug (the sign being left), when known. */
  fromSign?: string;
  /** Station direction for station events. */
  direction?: 'retrograde' | 'direct';
  /** Aspect type for aspect events ('trine', 'opposition', …). */
  aspectType?: string;
  /** Exact-hit catalogs carry zero orb; approximate aspects are not accepted. */
  orb?: 0;
  /** Eclipse detail. */
  eclipseKind?: 'total' | 'annular' | 'partial' | 'penumbral';
  obscuration?: number;
  totalMinutes?: number;
  /** Traditional almanac name for full moons ('Buck', 'Blue', …). */
  moonName?: string;
  /**
   * The committed catalog instant and title that name the page (its id,
   * path and publication receipt), when the printed `at`/`start`/`end` and
   * `title` use NASA's instant instead (src/lib/nasa-instants.ts).
   */
  committed?: { anchor: string; title: string };
  provenance: EventProvenance;
}

/** A related-event link. Every link carries the reason it exists. */
export interface EventLink {
  id: string;
  /** Plain-language relationship, rendered next to the link. */
  reason: string;
}

export interface EventRelations {
  /** Previous event of the same family + subtype (chronological). */
  previous?: EventLink;
  /** Next event of the same family + subtype (chronological). */
  next?: EventLink;
  /** Nearby events that materially affect the reading (≤ 5 days, capped). */
  nearby: EventLink[];
  /** The lunation a solar/lunar eclipse is (new/full moon of the same day). */
  lunation?: EventLink;
  /** The eclipse a lunation turns out to be, when it is one. */
  eclipse?: EventLink;
  /** The retrograde cycle a station belongs to. */
  cycle?: EventLink;
}

/** One sign's note, derived through whole-sign solar houses (the declared
 * Phase 1 method) — house numbers come from src/lib/daily.ts. */
export interface EventSignNote {
  /** Sign slug ('aries' … 'pisces'). */
  sign: string;
  /** Whole-sign solar house the event falls in for that Sun sign. */
  house: number;
  /** Short authored note, distinct per house territory. */
  note: string;
}

/**
 * Authored editorial fields. Interpretation is written, not generated —
 * pages without it render facts, context, and navigation only, and stay
 * ineligible for indexing.
 */
export interface EventInterpretation {
  /** Concrete plain-language opening: what this is and why it may matter. */
  lead: string;
  /** Body paragraphs, grounded in the supplied facts. */
  body?: string[];
  /** Practical, non-deterministic reflection prompts. */
  reflections?: string[];
  /** Per-sign notes (whole-sign solar houses). Optional per family. */
  signNotes?: EventSignNote[];
  /** Consequential limitations that must stay visible (not disclosure-only). */
  limitations?: string[];
}

export interface CatalogEvent {
  facts: EventFacts;
  relations: EventRelations;
  interpretation?: EventInterpretation;
  /**
   * Whether this page may be indexed and enter the sitemap. On this branch
   * the answer is always false: eligibility is flipped per event by the
   * verification pass once the 2026–2030 catalog and its relational proofs
   * exist. Fixture events are never eligible.
   */
  indexEligible: boolean;
  /** Marks labeled sample data. Fixture pages carry a visible banner. */
  fixture?: boolean;
  /** Last-modified stamp for metadata, from the source catalog. */
  lastModified?: string;
}

/** The families a standalone page family exists for on this surface. */
export const PAGE_FAMILIES: readonly EventFamily[] = [
  'lunation',
  'eclipse',
  'retrograde',
  'ingress',
  'aspect',
];
