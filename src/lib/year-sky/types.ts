/** Shapes shared by the general and the personal halves of "Your 2027 sky". */

export type MomentKind =
  | 'eclipse'
  | 'retrograde'
  | 'ingress'
  | 'solar-return'
  | 'milestone'
  | 'slow'
  | 'pass'
  | 'eclipse-hit'
  | 'retrograde-hit'
  | 'ingress-personal';

/** One dated calendar entry a moment puts in the .ics file. */
export interface MomentDate {
  at: string;
  /** A timed instant (one minute long) rather than an all-day event. */
  timed?: boolean;
  /** Added to the event title, e.g. "pass 2 of 3" or "turns direct". */
  label?: string;
}

export interface YearMoment {
  /** Stable within a reading; the calendar hashes it into the event UID. */
  id: string;
  kind: MomentKind;
  /** The moment's planet, for its glyph and hue. */
  body: string;
  /** When it lands, or opens, inside the year. */
  at: string;
  /** Set when the moment is a window. */
  endAt?: string;
  title: string;
  /** The reading: what astrology makes of it. */
  line: string;
  /** Dates, passes and degrees: the evidence. */
  detail: string;
  /** "Reading confidence NN%" value; null for the shared sky's facts. */
  confidence: number | null;
  /** How large the moment is, for the year in brief and the card. */
  weight: number;
  /** Every date it puts in the calendar file. */
  dates: MomentDate[];
  /** True when the window opened before the year began; `at` is then 1 January. */
  underWay?: boolean;
  /** True when it reads the whole year rather than a date. */
  allYear?: boolean;
  /** A shared-sky moment this personal one stands in for, in the calendar. */
  replaces?: string;
  /** The card's words: planets and placements only, never a date. */
  card?: string;
}
