/**
 * get_vedic_signs: the person's Sun, Moon and rising signs in the sidereal
 * zodiac Vedic astrology (Jyotish) uses, and the nakshatra (lunar mansion)
 * their Moon was in.
 *
 * A thin adapter over src/lib/vedic-signs/, which the /vedic-signs/ page runs
 * in the browser: the chart engine's tropical longitudes of date, less the
 * true ayanamsa (Lahiri, the Indian government's Chitrapaksha standard, by
 * default) from @zodiacs/engine/vedic, and nakshatraOf for the Moon's
 * nakshatra and pada. The words are pre-written there; nothing is generated.
 *
 * Without a birth time there is no rising sign, and the Moon's sign and
 * nakshatra are given only when the whole birth day keeps the Moon in them;
 * otherwise both candidates are listed. Pure: no network, storage or logging.
 */
import { z } from 'zod';
import { SIGNS } from '../../lib/signs';
import { computeVedicSigns } from '../../lib/vedic-signs/compute';
import { vedicSignsShareUrl } from '../../lib/vedic-signs/share';
import { RASHIS, VEDIC_AYANAMSAS, type VedicAyanamsa } from '../../lib/vedic-signs/wording';
import { birthDayEnds, birthFields, castNatal, definePersonalTool, refineBirth, type BirthArgs } from './shared';

export { NAKSHATRA_LORE, RASHIS, RASHI_LINE, VEDIC_AYANAMSAS, VEDIC_NOTE, type VedicAyanamsa } from '../../lib/vedic-signs/wording';

export const vedicSignsInput = z.strictObject({
  ...birthFields,
  latitude: birthFields.latitude.describe("Optional. The birthplace's latitude; with a birth time it adds the rising sign (lagna). Give it with longitude and zone. Nothing is stored."),
  ayanamsa: z.enum(VEDIC_AYANAMSAS).optional().describe('The sidereal zodiac to use. lahiri (the default, the Indian government standard), raman, krishnamurti, fagan-bradley, yukteswar or true-chitra.'),
}).superRefine(refineBirth);
export type VedicSignsInput = z.infer<typeof vedicSignsInput>;

const sign = z.object({
  /** The Western sign name for the sidereal sign, such as aries. */
  sign: z.enum(SIGNS.map((entry) => entry.slug) as [string, ...string[]]),
  rashi: z.enum(RASHIS),
  /** Degrees into the sidereal sign, 0 to 30, to two decimals. */
  degree: z.number().min(0).max(30),
  /** The sign the same body is in on the tropical (Western) zodiac. */
  tropicalSign: z.string(),
  line: z.string(),
});
const nakshatra = z.object({
  name: z.string(),
  /** 1 for Ashwini to 27 for Revati. */
  number: z.number().int().min(1).max(27),
  pada: z.number().int().min(1).max(4),
  /** Its ruling planet in the Vimshottari order. */
  lord: z.string(),
  deity: z.string(),
  symbol: z.string(),
  line: z.string(),
});
export const vedicSignsData = z.object({
  birthDate: z.string(),
  timeKnown: z.boolean(),
  placed: z.boolean(),
  ayanamsa: z.object({ name: z.enum(VEDIC_AYANAMSAS), label: z.string(), degrees: z.number() }),
  sun: sign.nullable(),
  /** Sun signs the birth day touched, when it changed sign that day without a birth time. */
  sunCandidates: z.array(z.string()),
  moon: sign.nullable(),
  moonCandidates: z.array(z.string()),
  rising: sign.nullable(),
  moonNakshatra: nakshatra.nullable(),
  nakshatraCandidates: z.array(z.string()),
  /** One plain paragraph, built from the lines above. */
  summary: z.string(),
  confidence: z.number().int().min(40).max(95),
  confidenceLabel: z.string(),
  limits: z.array(z.string()),
  note: z.string(),
  pageUrl: z.url(),
  /** The share card: the sidereal signs, the nakshatra's number and the ayanamsa, never a birth detail. Null when the Sun changed sign on an untimed birth day. */
  shareUrl: z.url().nullable(),
});
export type VedicSignsData = z.infer<typeof vedicSignsData>;

/** The sidereal signs and Moon nakshatra for one birth. Throws RangeError for details it cannot use. */
export async function vedicSigns(args: BirthArgs & { ayanamsa?: VedicAyanamsa | undefined }, clock: Parameters<typeof castNatal>[1], origin: string): Promise<{ data: VedicSignsData; links: { title: string; url: string }[] }> {
  const ayanamsa = args.ayanamsa ?? 'lahiri';
  const natal = await castNatal(args, clock);
  const reading = computeVedicSigns({
    birthUtc: natal.birthUtc, timeKnown: natal.timeKnown, latitude: natal.latitude, longitude: natal.longitude, ayanamsa,
    dayEnds: natal.timeKnown ? undefined : await birthDayEnds(args, clock),
  });
  return {
    data: { birthDate: args.birthDate, ...reading, pageUrl: `${origin}/vedic-signs/`, shareUrl: vedicSignsShareUrl(origin, reading) },
    links: [
      { title: 'Your Vedic signs on Zodiacs', url: `${origin}/vedic-signs/` },
      { title: 'Your birth chart on Zodiacs (Western zodiac)', url: `${origin}/birth-chart/` },
      { title: 'Resolve a town or city (find_birthplace)', url: `${origin}/birth-chart/` },
      { title: 'How we calculate', url: `${origin}/methodology/` },
    ],
  };
}

export const vedicSignsTool = definePersonalTool({
  name: 'get_vedic_signs',
  title: 'Vedic signs',
  summary: 'sidereal Sun, Moon and rising signs and the Moon nakshatra, Lahiri by default',
  description: "Gives the person's Vedic (sidereal) Sun, Moon and rising signs and the nakshatra their Moon was in, with its pada, ruling planet, deity and symbol, and what each is traditionally read as in Jyotish. Use it for my Vedic sign, my sidereal sign, my rashi, my lagna or my nakshatra, once the person has given a birth date. Give the birth date, and the time, birthplace time zone and coordinates only as the person gives them; never guess a birth time. Without a birth time there is no rising sign, and the Moon's sign and nakshatra come back only when the whole birth day settles them, otherwise as candidates. When they name a town or city instead of coordinates, use find_birthplace first. The zodiac is Lahiri unless the person asks for raman, krishnamurti, fagan-bradley, yukteswar or true-chitra. For the Western (tropical) chart use get_natal_chart. Share the readings plainly as Vedic astrology's reading, with the reading-confidence label.",
  input: vedicSignsInput,
  data: vedicSignsData,
  clockDependent: false,
  example: { birthDate: '1990-05-03', time: '08:30', zone: 'Asia/Kolkata', latitude: 28.61, longitude: 77.21 },
  run: (args, context) => vedicSigns(args, context.localTime, context.origin),
});
