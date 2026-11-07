/**
 * NASA's figures for the lunar eclipses the website lists, 2026 to 2030,
 * from the Five Millennium Catalog of Lunar Eclipses: 2001 to 2100
 * (F. Espenak and J. Meeus, NASA GSFC, https://eclipse.gsfc.nasa.gov/LEcat5/LE2001-2100.html,
 * kept with its SHA-256 at docs/accuracy-audit-2026-11/raw/nasa-LE2001-2100.html;
 * src/lib/nasa-lunar-eclipses.test.ts reads that copy and holds these rows to it).
 *
 * src/data/eclipses.json computes totality from astronomy-engine's shadow
 * model, a minute or so longer than the canon's (Chauvenet's 1/50
 * enlargement), and the AI tools bundle that file byte for byte. The website's
 * pages print NASA's durations through this site-only module instead, and say
 * plainly when a penumbral eclipse is too slight to be seen.
 */

export interface NasaLunarEclipse {
  /** Catalogue type: T total, P partial, N penumbral (with its qualifier). */
  type: string;
  penumbralMagnitude: number;
  umbralMagnitude: number;
  /** Duration of the total phase in minutes, to 0.1, for total eclipses. */
  totalMinutes?: number;
}

/** Keyed by the date of greatest eclipse (TD), as the catalogue prints it. */
export const NASA_LUNAR_ECLIPSES: Readonly<Record<string, NasaLunarEclipse>> = {
  '2026-03-03': { type: 'T', penumbralMagnitude: 2.1838, umbralMagnitude: 1.1507, totalMinutes: 58.3 },
  '2026-08-28': { type: 'P', penumbralMagnitude: 1.9645, umbralMagnitude: 0.9299 },
  '2027-02-20': { type: 'N', penumbralMagnitude: 0.9266, umbralMagnitude: -0.0569 },
  '2027-07-18': { type: 'Ne', penumbralMagnitude: 0.0014, umbralMagnitude: -1.068 },
  '2027-08-17': { type: 'N', penumbralMagnitude: 0.5456, umbralMagnitude: -0.5254 },
  '2028-01-12': { type: 'P', penumbralMagnitude: 1.0468, umbralMagnitude: 0.0662 },
  '2028-07-06': { type: 'P', penumbralMagnitude: 1.4266, umbralMagnitude: 0.3892 },
  '2028-12-31': { type: 'T', penumbralMagnitude: 2.2742, umbralMagnitude: 1.2463, totalMinutes: 71.3 },
  '2029-06-26': { type: 'T+', penumbralMagnitude: 2.8266, umbralMagnitude: 1.8436, totalMinutes: 101.9 },
  '2029-12-20': { type: 'T', penumbralMagnitude: 2.2008, umbralMagnitude: 1.1174, totalMinutes: 53.7 },
  '2030-06-15': { type: 'P', penumbralMagnitude: 1.448, umbralMagnitude: 0.5025 },
  '2030-12-09': { type: 'N', penumbralMagnitude: 0.9416, umbralMagnitude: -0.1628 },
};

/**
 * A penumbral eclipse whose penumbral magnitude is below this cannot be seen:
 * the Moon's disc barely touches the outer shadow, and the dimming is far
 * below what an eye or a camera can tell from an ordinary full Moon.
 */
export const INVISIBLE_PENUMBRAL_MAGNITUDE = 0.1;

const DAY = 86_400_000;

/** The canon row for a lunar eclipse peak (an ISO instant), within a day of it. */
export function nasaLunarEclipse(peak: string): NasaLunarEclipse | null {
  const at = Date.parse(peak);
  for (const offset of [0, -DAY, DAY]) {
    const row = NASA_LUNAR_ECLIPSES[new Date(at + offset).toISOString().slice(0, 10)];
    if (row) return row;
  }
  return null;
}

/**
 * Totality in whole minutes as NASA's canon gives it (101.9 reads 102), or
 * the computed value when the canon has no row.
 */
export function lunarTotalityMinutes(peak: string, computed?: number): number | undefined {
  const minutes = nasaLunarEclipse(peak)?.totalMinutes;
  return minutes === undefined ? computed : Math.round(minutes);
}

/** Whether a penumbral lunar eclipse is too slight for anyone to see. */
export function isInvisiblePenumbral(peak: string, kind?: string): boolean {
  if (kind !== undefined && kind !== 'penumbral') return false;
  const row = nasaLunarEclipse(peak);
  return Boolean(row && row.type.startsWith('N') && row.penumbralMagnitude < INVISIBLE_PENUMBRAL_MAGNITUDE);
}

/** NASA's penumbral magnitude for the eclipse, for the plain note. */
export function penumbralMagnitude(peak: string): number | null {
  return nasaLunarEclipse(peak)?.penumbralMagnitude ?? null;
}
