/**
 * The rising sign page's worked example: a made-up birth in New York on
 * 17 October 1990, at 6:40 AM and, ninety minutes later, at 8:10 AM, and the
 * whole local day of rising signs around it. Computed with the site's engine
 * when the page is built; no real person's details. New York kept daylight
 * time until 28 October that year, so local midnight is 04:00 UTC.
 *
 * Server-only: the page imports this from its frontmatter.
 */
import { natalChart } from '@zodiacs/engine';
import { SIGNS, signForLongitude, type Sign } from './signs';

export const RISING_EXAMPLE = {
  date: 'Oct 17, 1990',
  place: 'New York',
  latitude: 40.7128,
  longitude: -74.006,
  /** Local midnight, in UTC (EDT, UTC−4). */
  dayStartUtc: Date.UTC(1990, 9, 17, 4, 0),
} as const;

const MINUTE = 60_000;

function chartAt(minutes: number) {
  const chart = natalChart({
    utc: new Date(RISING_EXAMPLE.dayStartUtc + minutes * MINUTE).toISOString(),
    latitude: RISING_EXAMPLE.latitude,
    longitude: RISING_EXAMPLE.longitude,
    houseSystem: 'whole',
  });
  // A birthplace is given, so the engine returns the angles.
  if (!chart.angles) throw new Error('rising-example: the engine returned no angles');
  return { ...chart, angles: chart.angles };
}

/** 410 → "6:50 am": a minute of the local day, on a 12-hour clock. */
export function clockLabel(minutes: number) {
  const m = ((minutes % 1440) + 1440) % 1440;
  if (m === 720) return 'Noon';
  const hours = Math.floor(m / 60);
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(m % 60).padStart(2, '0')} ${hours < 12 ? 'am' : 'pm'}`;
}

function degreeLabel(lon: number) {
  const within = ((lon % 30) + 30) % 30;
  const whole = Math.floor(within);
  return `${whole}°${String(Math.floor((within - whole) * 60)).padStart(2, '0')}′`;
}

/** The planet the calculator names as chart ruler: the traditional one. */
export function traditionalRuler(sign: Sign) {
  return ['Uranus', 'Neptune', 'Pluto'].includes(sign.ruler) ? (sign.classicRuler ?? sign.ruler) : sign.ruler;
}

export interface RisingMoment {
  minutes: number;
  /** Ecliptic longitude of the ascendant, in degrees. */
  asc: number;
  clock: string;
  sign: Sign;
  degree: string;
  ruler: string;
  rulerSign: Sign;
}

function momentAt(minutes: number): RisingMoment {
  const chart = chartAt(minutes);
  const sign = signForLongitude(chart.angles.asc);
  const ruler = traditionalRuler(sign);
  const body = chart.bodies.find((item) => item.body === ruler)!;
  return {
    minutes,
    asc: chart.angles.asc,
    clock: clockLabel(minutes),
    sign,
    degree: degreeLabel(chart.angles.asc),
    ruler,
    rulerSign: signForLongitude(body.lon),
  };
}

/** 6:40 AM, the example result; 8:10 AM, ninety minutes later. */
export const RISING_AT = momentAt(6 * 60 + 40);
export const RISING_LATER = momentAt(8 * 60 + 10);

export interface RisingBand {
  sign: Sign;
  start: number;
  end: number;
}

/** The rising sign through the local day, minute by minute, as bands. */
function dayBands(): RisingBand[] {
  const bands: RisingBand[] = [];
  for (let minutes = 0; minutes < 1440; minutes += 1) {
    const sign = signForLongitude(chartAt(minutes).angles.asc);
    const last = bands.at(-1);
    if (last && last.sign.slug === sign.slug) last.end = minutes + 1;
    else bands.push({ sign, start: minutes, end: minutes + 1 });
  }
  return bands;
}
export const RISING_DAY = dayBands();

/** Whole bands only (the first and last are cut by midnight). */
const whole = RISING_DAY.slice(1, -1);
const longest = [...whole].sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];
const shortest = Math.min(...whole.map((band) => band.end - band.start));
export const RISING_LONGEST = longest;
export const RISING_SHORTEST = whole.filter((band) => band.end - band.start === shortest);

/** 152 → "2 hours 32 minutes"; under two hours, minutes alone: 71 → "71 minutes". */
export function durationLabel(minutes: number) {
  if (minutes < 120) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts = [];
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (rest) parts.push(`${rest} minute${rest === 1 ? '' : 's'}`);
  return parts.join(' ');
}

