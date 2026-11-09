/**
 * The year's main themes in a solar return chart, in the order astrologers
 * read them: the return's rising sign and the house its Sun falls in (both
 * need a birth time and place), the Moon's sign (needs a birth time), where
 * Jupiter grows and Saturn builds, and the tightest aspect in the chart.
 *
 * One reading for the site's solar return page (src/islands/solar-return/) and
 * the get_solar_return tool, so the two always say the same thing. The words
 * are the page's own (SR_COPY, JUPITER_FOCUS, planetsOnlyReturnReading) with
 * Saturn's and the Moon's added here, in the 9 November 2026 register: the
 * tradition's money, work, wellbeing and relationship themes, no price calls,
 * diagnoses, death predictions or legal outcomes. Engine-free and pure.
 */
import { JUPITER_FOCUS, SR_COPY, planetsOnlyReturnReading } from '../../islands/solar-return/copy';
import { houseOf } from '../engine/houses';
import type { Aspect, BodyPosition } from '../engine/types';
import { signForLongitude } from '../signs';

export type SolarReturnThemeKind = 'rising' | 'sun-house' | 'moon' | 'jupiter' | 'saturn' | 'aspect';

export interface SolarReturnTheme {
  kind: SolarReturnThemeKind;
  title: string;
  line: string;
  /** What the theme was read from, such as "Jupiter in Leo". */
  basis: string;
}

export const SATURN_FOCUS: Record<string, string> = {
  aries: 'learning to lead without rushing: one bold plan, carried through',
  taurus: 'money, possessions and the patience to build value slowly',
  gemini: 'focus: fewer conversations, kept, and a skill learned properly',
  cancer: 'home and family responsibilities, and the boundaries that make them lighter',
  leo: 'creative work and leadership that has to earn its applause',
  virgo: 'routines, wellbeing and work habits that hold up under load',
  libra: 'commitments to partners, and agreements put on firmer ground',
  scorpio: 'shared money, trust and the hard conversations that settle them',
  sagittarius: 'beliefs and plans tested against real results',
  capricorn: 'career structure, authority and the long game',
  aquarius: 'groups, networks and the future you are prepared to work for',
  pisces: 'rest, limits and turning a hope into a practice',
};

export const MOON_TONE: Record<string, string> = {
  aries: 'restless and quick to act; feelings move fast and want an outlet',
  taurus: 'steady and comfort-seeking; security and good food matter more than usual',
  gemini: 'curious and talkative; you process the year by putting it into words',
  cancer: 'protective and home-loving; family and close ties set the mood',
  leo: 'warm and expressive; you need to be seen and to enjoy yourself',
  virgo: 'practical and careful; order in the details keeps you calm',
  libra: 'sociable and fair-minded; harmony with others sets the tone',
  scorpio: 'private and intense; loyalty and trust run deep this year',
  sagittarius: 'optimistic and roaming; space and new horizons lift the mood',
  capricorn: 'composed and responsible; quiet achievement is what satisfies',
  aquarius: 'independent and friendly; you want room and like-minded people',
  pisces: 'sensitive and imaginative; rest and creative time refill the tank',
};

const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The themes for a return chart. `angles` and `cusps` are null without a
 * birth time and place; `timeKnown` is false without a birth time, which
 * leaves out the Moon (it moves about 13 degrees a day, so an untimed return
 * cannot settle its sign).
 */
export function solarReturnThemes(chart: {
  bodies: readonly Pick<BodyPosition, 'body' | 'lon'>[];
  aspects: readonly Pick<Aspect, 'a' | 'b' | 'type' | 'orb'>[];
  asc: number | null;
  cusps: readonly number[] | null;
  timeKnown: boolean;
}): SolarReturnTheme[] {
  const themes: SolarReturnTheme[] = [];
  const at = (body: string) => chart.bodies.find((row) => row.body === body)?.lon;
  const sun = at('Sun');
  if (chart.asc !== null) {
    const sign = signForLongitude(chart.asc);
    themes.push({ kind: 'rising', title: `${sign.name} rising`, line: SR_COPY.asc[sign.slug as keyof typeof SR_COPY.asc], basis: `Return ascendant in ${sign.name}` });
  }
  if (chart.cusps && sun !== undefined) {
    const house = houseOf(sun, [...chart.cusps]);
    themes.push({ kind: 'sun-house', title: `Sun in the ${house}${house === 1 ? 'st' : house === 2 ? 'nd' : house === 3 ? 'rd' : 'th'} house`, line: SR_COPY.sunHouse[house], basis: `Return Sun in house ${house}` });
  }
  const moon = at('Moon');
  if (chart.timeKnown && moon !== undefined) {
    const sign = signForLongitude(moon);
    themes.push({ kind: 'moon', title: `Moon in ${sign.name}`, line: `The year's emotional weather is ${MOON_TONE[sign.slug]}.`, basis: `Return Moon in ${sign.name}` });
  }
  const jupiter = at('Jupiter');
  if (jupiter !== undefined) {
    const sign = signForLongitude(jupiter);
    themes.push({ kind: 'jupiter', title: `Jupiter in ${sign.name}`, line: `${cap('growth this year favors')} ${JUPITER_FOCUS[sign.slug]}.`, basis: `Jupiter in ${sign.name}` });
  }
  const saturn = at('Saturn');
  if (saturn !== undefined) {
    const sign = signForLongitude(saturn);
    themes.push({ kind: 'saturn', title: `Saturn in ${sign.name}`, line: `The year's serious work is ${SATURN_FOCUS[sign.slug]}.`, basis: `Saturn in ${sign.name}` });
  }
  const strongest = [...chart.aspects].filter((aspect) => ![aspect.a, aspect.b].some((body) => body === 'Moon' || body.includes('Node'))).sort((a, b) => a.orb - b.orb)[0];
  if (strongest) {
    const reading = planetsOnlyReturnReading(chart.bodies, chart.aspects);
    themes.push({ kind: 'aspect', title: `${strongest.a} ${strongest.type} ${strongest.b}`, line: reading.text, basis: reading.receipt });
  }
  return themes;
}
