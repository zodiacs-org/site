/** Shared chart-engine types. Pure data — no ephemeris imports here. */

export { ENGINE_VERSION } from '@zodiacs/engine/internal/math';
import type { DeltaT, TimeScale } from '@zodiacs/engine';

export type BodyName =
  | 'Sun' | 'Moon' | 'Mercury' | 'Venus' | 'Mars'
  | 'Jupiter' | 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto'
  | 'North Node' | 'South Node';

export type HouseSystem = 'whole' | 'placidus';

/** `outside-reference-span`: the instant is before 1800 or from 2200 (engine 0.1.1-rc.8 on). */
export type ChartFlag =
  | 'dst-gap' | 'dst-fold' | 'lmt' | 'no-time' | 'polar-fallback' | 'outside-reference-span';

export interface ChartInput {
  /** Resolved UTC instant of birth. */
  utc: Date;
  /** Geographic coordinates; omit when place is unknown. */
  latitude?: number;
  longitude?: number;
  houseSystem: HouseSystem;
  /** True when the birth time is known; false means a caller-supplied reference instant and no angles. */
  timeKnown: boolean;
  flags?: ChartFlag[];
}

export interface BodyPosition {
  body: BodyName;
  /** Tropical ecliptic longitude of date, degrees 0–360. */
  lon: number;
  /** Ecliptic latitude, degrees (0 for the nodes). */
  lat: number;
  /** Longitude speed, degrees/day (negative = retrograde). */
  speed: number;
  retrograde: boolean;
}

export interface Angles {
  asc: number;
  mc: number;
  dsc: number;
  ic: number;
}

export interface Houses {
  system: HouseSystem;
  /** Cusp longitudes, index 0 = 1st house. */
  cusps: number[];
}

export type AspectType = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';

export interface Aspect {
  a: BodyName;
  b: BodyName;
  type: AspectType;
  /** Deviation from exact, degrees (unsigned). */
  orb: number;
  /** True when the aspect is still tightening. */
  applying: boolean;
}

export interface Chart {
  input: ChartInput;
  bodies: BodyPosition[];
  /** Present only when time + place are known. */
  angles: Angles | null;
  houses: Houses | null;
  aspects: Aspect[];
  flags: ChartFlag[];
  engineVersion: string;
  /** The ΔT (TT − UT1) the engine computed the chart with, and its source (0.1.1-rc.8 on). */
  deltaT?: DeltaT;
  /**
   * How the engine read the instant (0.1.1-rc.15 on): from 1972 to 2027-10-02
   * as UTC, through the leap seconds and IERS UT1 − UTC; otherwise as UT1 with
   * the ΔT model.
   */
  timeScale?: TimeScale;
  /** Caller-verified Moon signs across an unknown-time local birth date.
   * One sign is settled; two are alternatives; absent with no angles is unverified.
   * Presentation metadata only: never changes positions or the share-token wire format. */
  moonSignCandidates?: readonly string[];
}
