/**
 * The birth chart page's sample result: a made-up person born in Chicago on
 * 8 October 1995 at 2:00 PM local time, computed with the site's engine when
 * the page is built. No real person's details. Chicago kept daylight time
 * until 29 October that year, so 2:00 PM CDT is 19:00 UTC.
 *
 * Server-only: pages import this from their frontmatter, so the engine runs
 * at build time and never reaches a browser chunk.
 */
import { natalChart } from '@zodiacs/engine';
import { houseOf } from './engine/houses';
import { signForLongitude, type Sign } from './signs';

export const SAMPLE_BIRTH = {
  date: 'Oct 8, 1995',
  time: '2:00 PM',
  place: 'Chicago',
  utc: '1995-10-08T19:00:00Z',
  latitude: 41.8781,
  longitude: -87.6298,
  /** The local calendar day in UTC (CDT, UTC−5): midnight to midnight. */
  dayStartUtc: '1995-10-08T05:00:00Z',
  dayEndUtc: '1995-10-09T04:59:00Z',
} as const;

const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;

export interface SamplePlacement {
  body: string;
  lon: number;
  sign: Sign;
  /** Whole degrees and minutes within the sign, e.g. "15°01′". */
  degree: string;
  house: number;
  retrograde: boolean;
}

function degreeLabel(lon: number) {
  const within = ((lon % 30) + 30) % 30;
  const whole = Math.floor(within);
  return `${whole}°${String(Math.floor((within - whole) * 60)).padStart(2, '0')}′`;
}

const chart = natalChart({
  utc: SAMPLE_BIRTH.utc,
  latitude: SAMPLE_BIRTH.latitude,
  longitude: SAMPLE_BIRTH.longitude,
  houseSystem: 'whole',
});

const cusps = chart.houses.cusps;
const asc = chart.angles.asc;

/** Sun through Pluto, then the rising sign, as the result page lists them. */
export const SAMPLE_PLACEMENTS: SamplePlacement[] = PLANETS.map((name) => {
  const body = chart.bodies.find((item) => item.body === name)!;
  return {
    body: name,
    lon: body.lon,
    sign: signForLongitude(body.lon),
    degree: degreeLabel(body.lon),
    house: houseOf(body.lon, cusps),
    retrograde: body.retrograde,
  };
});

export const SAMPLE_RISING: SamplePlacement = {
  body: 'Rising',
  lon: asc,
  sign: signForLongitude(asc),
  degree: degreeLabel(asc),
  house: 1,
  retrograde: false,
};

/** Props for the shared Wheel: every body but the South Node, as the demo draws it. */
export const SAMPLE_WHEEL = {
  bodies: chart.bodies
    .filter((body) => body.body !== 'South Node')
    .map((body) => ({ body: body.body, lon: body.lon, retrograde: body.retrograde })),
  asc,
  mc: chart.angles.mc,
  cusps,
  aspects: chart.aspects
    .filter((aspect) => PLANETS.includes(aspect.a as never) && PLANETS.includes(aspect.b as never))
    .sort((a, b) => a.orb - b.orb)
    .slice(0, 8)
    .map(({ a, b, type }) => ({ a, b, type })),
};

/** The tightest aspects between planets, tightest first, with their orbs. */
export const SAMPLE_ASPECTS = chart.aspects
  .filter((aspect) => PLANETS.includes(aspect.a as never) && PLANETS.includes(aspect.b as never))
  .sort((a, b) => a.orb - b.orb)
  .map(({ a, b, type, orb }) => ({ a, b, type, orb }));

/**
 * Whether the Moon kept one sign all through the local birth date, which is
 * what a chart without a birth time can say about it.
 */
function moonSignAt(utc: string) {
  const moon = natalChart({
    utc,
    latitude: SAMPLE_BIRTH.latitude,
    longitude: SAMPLE_BIRTH.longitude,
    houseSystem: 'whole',
  }).bodies.find((body) => body.body === 'Moon')!;
  return signForLongitude(moon.lon).slug;
}
export const SAMPLE_MOON_ALL_DAY = moonSignAt(SAMPLE_BIRTH.dayStartUtc) === moonSignAt(SAMPLE_BIRTH.dayEndUtc);

export const SAMPLE_COORDINATES = `${Math.abs(SAMPLE_BIRTH.latitude).toFixed(2)}° N, ${Math.abs(SAMPLE_BIRTH.longitude).toFixed(2)}° W`;

/**
 * Whole hours since the full moon, when the birth fell within half a day
 * after one: the Sun and Moon opposition's orb over the Moon's daily gain on the
 * Sun. Null otherwise, and the page then says nothing about it.
 */
function hoursAfterFullMoon(): number | null {
  const opposition = chart.aspects.find((aspect) => aspect.type === 'opposition'
    && [aspect.a, aspect.b].includes('Sun') && [aspect.a, aspect.b].includes('Moon'));
  if (!opposition || opposition.applying) return null;
  const sun = chart.bodies.find((body) => body.body === 'Sun')!;
  const moon = chart.bodies.find((body) => body.body === 'Moon')!;
  const hours = (opposition.orb / (moon.speed - sun.speed)) * 24;
  return hours > 0 && hours < 12 ? Math.round(hours) : null;
}
export const SAMPLE_HOURS_AFTER_FULL_MOON = hoursAfterFullMoon();
