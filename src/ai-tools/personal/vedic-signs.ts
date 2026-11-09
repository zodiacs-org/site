/**
 * get_vedic_signs: the person's Sun, Moon and rising signs in the sidereal
 * zodiac Vedic astrology (Jyotish) uses, and the nakshatra (lunar mansion)
 * their Moon was in.
 *
 * Every position is the engine's: @zodiacs/engine/vedic's siderealChart
 * subtracts the true ayanamsa (Lahiri, the Indian government's Chitrapaksha
 * standard, by default) from the engine's tropical longitudes of date, and
 * nakshatraOf places the Moon in its nakshatra and pada. The words are
 * pre-written here; nothing is generated.
 *
 * Without a birth time there is no rising sign, and the Moon's sign and
 * nakshatra are given only when the whole birth day keeps the Moon in them;
 * otherwise both candidates are listed. Pure: no network, storage or logging.
 */
import { z } from 'zod';
import { nakshatraOf, siderealChart, type NakshatraName, type SiderealChart } from '@zodiacs/engine/vedic';
import { SIGNS, signIndexForLongitude } from '../../lib/signs';
import { readingConfidence, readingConfidenceLabel } from '../reading-confidence';
import { birthDayEnds, birthFields, castNatal, definePersonalTool, refineBirth, type BirthArgs } from './shared';

export const VEDIC_AYANAMSAS = ['lahiri', 'raman', 'krishnamurti', 'fagan-bradley', 'yukteswar', 'true-chitra'] as const;
export type VedicAyanamsa = typeof VEDIC_AYANAMSAS[number];
const AYANAMSA_NAME: Record<VedicAyanamsa, string> = {
  lahiri: 'Lahiri (Chitrapaksha)', raman: 'Raman', krishnamurti: 'Krishnamurti (KP)', 'fagan-bradley': 'Fagan and Bradley', yukteswar: 'Sri Yukteswar', 'true-chitra': 'True Chitra',
};

/** The twelve rashis, Aries to Pisces, by their Sanskrit names. */
export const RASHIS = ['Mesha', 'Vrishabha', 'Mithuna', 'Karka', 'Simha', 'Kanya', 'Tula', 'Vrishchika', 'Dhanu', 'Makara', 'Kumbha', 'Meena'] as const;

/** What each rashi is traditionally read as in Jyotish, for the Moon (the mind) and the rising sign (the body and path). */
export const RASHI_LINE: readonly string[] = [
  'Mesha, ruled by Mars: quick to start, direct, and at its best with a clear goal in front of it.',
  'Vrishabha, ruled by Venus: steady, loyal and fond of comfort, building slowly and keeping what it builds.',
  'Mithuna, ruled by Mercury: curious and talkative, happiest learning, trading ideas and staying in motion.',
  'Karka, ruled by the Moon: caring and protective, with strong ties to home, family and memory.',
  'Simha, ruled by the Sun: warm, proud and generous, drawn to lead and to be seen doing it.',
  'Kanya, ruled by Mercury: careful and practical, good with detail, service and getting things right.',
  'Tula, ruled by Venus: fair minded and sociable, weighing both sides and seeking balance with others.',
  'Vrishchika, ruled by Mars: intense and private, loyal to the end, drawn to what lies beneath the surface.',
  'Dhanu, ruled by Jupiter: hopeful and principled, drawn to teaching, travel and the larger picture.',
  'Makara, ruled by Saturn: patient and ambitious, ready to work for results that last.',
  'Kumbha, ruled by Saturn: independent and thoughtful, with a mind for groups, causes and new ideas.',
  'Meena, ruled by Jupiter: gentle and imaginative, with deep feeling and a pull toward the spiritual.',
];

/** The 27 nakshatras' traditional deity and symbol, and a plain line on what each is read as. */
export const NAKSHATRA_LORE: Readonly<Record<NakshatraName, { deity: string; symbol: string; line: string }>> = {
  Ashwini: { deity: 'the Ashvins, the divine physicians', symbol: "a horse's head", line: 'Quick, fresh and eager to begin; traditionally linked with healing and with help that arrives fast.' },
  Bharani: { deity: 'Yama, keeper of dharma', symbol: 'a yoni', line: 'Strong willed and able to carry a great deal; read as the star of restraint, endurance and big life changes.' },
  Krittika: { deity: 'Agni, the fire', symbol: 'a flame or a blade', line: 'Sharp, honest and purifying; it cuts to what matters and does not tolerate pretence.' },
  Rohini: { deity: 'Brahma, the creator', symbol: 'an ox cart', line: 'Warm, charming and fond of beauty; read as a star of growth, plenty and steady comfort.' },
  Mrigashira: { deity: 'Soma, the Moon', symbol: "a deer's head", line: 'Gentle and searching; always looking for the next thing to learn, see or find.' },
  Ardra: { deity: 'Rudra, the storm', symbol: 'a teardrop', line: 'Intense and searching; read as the storm that clears the air, bringing hard effort and then renewal.' },
  Punarvasu: { deity: 'Aditi, mother of the gods', symbol: 'a quiver of arrows', line: 'Hopeful and forgiving; the star of return, coming home and starting again after a setback.' },
  Pushya: { deity: 'Brihaspati, teacher of the gods', symbol: "a cow's udder", line: 'Nourishing and dependable; traditionally one of the most favourable stars, read as care, support and good counsel.' },
  Ashlesha: { deity: 'the Nagas, the serpents', symbol: 'a coiled serpent', line: 'Perceptive and persuasive; it reads people and situations closely and holds on to what it values.' },
  Magha: { deity: 'the Pitris, the ancestors', symbol: 'a throne', line: 'Dignified and loyal to its roots; read as rank, tradition and respect for those who came before.' },
  'Purva Phalguni': { deity: 'Bhaga, giver of good fortune', symbol: 'the front legs of a bed', line: 'Warm and pleasure loving; read as rest, creativity, affection and enjoying what has been earned.' },
  'Uttara Phalguni': { deity: 'Aryaman, god of agreements', symbol: 'the back legs of a bed', line: 'Generous and reliable; read as friendship, partnership and keeping one\'s word.' },
  Hasta: { deity: 'Savitar, the sun at work', symbol: 'a hand', line: 'Skilful and resourceful; good with the hands, with craft and with turning plans into things.' },
  Chitra: { deity: 'Tvashtar, the divine craftsman', symbol: 'a bright jewel', line: 'Creative and stylish; read as design, making and an eye for how things fit together.' },
  Swati: { deity: 'Vayu, the wind', symbol: 'a young shoot bending in the wind', line: 'Independent and adaptable; it bends without breaking and does best with room to move. Traditionally a good star for trade and earnings.' },
  Vishakha: { deity: 'Indra and Agni', symbol: 'a triumphal arch', line: 'Determined and goal minded; it fixes on an aim and keeps going until it gets there.' },
  Anuradha: { deity: 'Mitra, god of friendship', symbol: 'a lotus', line: 'Devoted and sociable; read as loyal friendship and success through working with others.' },
  Jyeshtha: { deity: 'Indra, chief of the gods', symbol: 'a round earring', line: 'Protective and responsible; the star of the eldest, read as seniority, courage and looking after others.' },
  Mula: { deity: 'Nirriti', symbol: 'a bunch of tied roots', line: 'Searching and thorough; it goes to the root of things, clearing away the old to find what is true.' },
  'Purva Ashadha': { deity: 'Apas, the waters', symbol: 'a winnowing fan', line: 'Confident and persuasive; read as the star of conviction, renewal and early victories.' },
  'Uttara Ashadha': { deity: 'the Vishvadevas, the universal gods', symbol: "an elephant's tusk", line: 'Principled and steady; read as lasting success that comes from doing the right thing patiently.' },
  Shravana: { deity: 'Vishnu, the preserver', symbol: 'an ear', line: 'Attentive and learned; the star of listening, study and passing knowledge on.' },
  Dhanishta: { deity: 'the eight Vasus', symbol: 'a drum', line: 'Lively and rhythmic; read as music, wealth and a talent for working in step with a group.' },
  Shatabhisha: { deity: 'Varuna, lord of the waters', symbol: 'an empty circle', line: 'Independent and private; traditionally the star of healers and researchers, with a need for time alone.' },
  'Purva Bhadrapada': { deity: 'Aja Ekapada, the one footed goat', symbol: 'a sword', line: 'Earnest and idealistic; read as strong conviction and a willingness to give a great deal to a cause.' },
  'Uttara Bhadrapada': { deity: 'Ahir Budhnya, serpent of the deep', symbol: 'the back legs of a bed', line: 'Calm, wise and patient; read as depth, self control and quiet strength.' },
  Revati: { deity: 'Pushan, the guide of travellers', symbol: 'a fish', line: 'Kind and protective; the last star, read as safe journeys, nourishment and seeing things through.' },
};

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
});
export type VedicSignsData = z.infer<typeof vedicSignsData>;

export const VEDIC_NOTE = 'Vedic astrology counts the signs from the stars, so its signs sit about 24 degrees behind the Western ones: many people find their Vedic Sun sign is the sign before their Western one.';

const round2 = (value: number) => Math.round(value * 100) / 100;
function signOf(lon: number, tropical: number, line: string) {
  const index = signIndexForLongitude(lon);
  return { sign: SIGNS[index].slug, rashi: RASHIS[index], degree: Math.min(29.99, round2(lon - index * 30)), tropicalSign: SIGNS[signIndexForLongitude(tropical)].slug, line };
}
const label = (index: number) => `${SIGNS[index].name} (${RASHIS[index]})`;

function chartAt(utc: Date, args: { latitude?: number | undefined; longitude?: number | undefined }, timeKnown: boolean, ayanamsa: VedicAyanamsa): SiderealChart {
  return siderealChart({ utc, ...(args.latitude !== undefined && args.longitude !== undefined ? { latitude: args.latitude, longitude: args.longitude } : {}), houseSystem: 'whole', timeKnown }, ayanamsa);
}

/** The sidereal signs and Moon nakshatra for one birth. Throws RangeError for details it cannot use. */
export async function vedicSigns(args: BirthArgs & { ayanamsa?: VedicAyanamsa | undefined }, clock: Parameters<typeof castNatal>[1], origin: string): Promise<{ data: VedicSignsData; links: { title: string; url: string }[] }> {
  const ayanamsa = args.ayanamsa ?? 'lahiri';
  const natal = await castNatal(args, clock);
  const chart = chartAt(natal.birthUtc, { latitude: natal.latitude, longitude: natal.longitude }, natal.timeKnown, ayanamsa);
  const body = (from: SiderealChart, name: string) => from.bodies.find((row) => row.body === name)!;
  const limits: string[] = [];
  // Without a time, a placement holds only if the whole birth day keeps it.
  const ends = natal.timeKnown ? null : (await birthDayEnds(args, clock)).map((at) => chartAt(at, {}, false, ayanamsa));
  const settled = (name: string) => {
    if (!ends) return { held: true, candidates: [] as string[] };
    const indices = [...new Set(ends.map((end) => signIndexForLongitude(body(end, name).lon)))];
    return { held: indices.length === 1, candidates: indices.length === 1 ? [] : indices.map(label) };
  };
  const sunHold = settled('Sun');
  const moonHold = settled('Moon');
  const sunRow = body(chart, 'Sun');
  const moonRow = body(chart, 'Moon');
  const sun = sunHold.held ? signOf(sunRow.lon, sunRow.tropical!, `Your Vedic Sun is in ${RASHIS[signIndexForLongitude(sunRow.lon)]}, ${SIGNS[signIndexForLongitude(sunRow.lon)].name} in the sidereal zodiac. In Jyotish the Sun is the soul and the sense of self: ${RASHI_LINE[signIndexForLongitude(sunRow.lon)]}`) : null;
  const moonIndex = signIndexForLongitude(moonRow.lon);
  const moon = moonHold.held ? signOf(moonRow.lon, moonRow.tropical!, `Your Moon sign (rashi) is ${RASHIS[moonIndex]}, ${SIGNS[moonIndex].name}. Vedic astrology reads the Moon sign first, as the mind and the emotional nature: ${RASHI_LINE[moonIndex]}`) : null;
  let rising = null;
  if (natal.angles && chart.ascendant && chart.ascendant.tropical !== null) {
    const index = signIndexForLongitude(chart.ascendant.lon);
    rising = signOf(chart.ascendant.lon, chart.ascendant.tropical, `Your lagna (rising sign) is ${RASHIS[index]}, ${SIGNS[index].name}. The lagna is the body and the path through life, and it sets the first house: ${RASHI_LINE[index]}`);
  }
  // The nakshatra: the same rule for an untimed day.
  const nakshatraNames = ends ? [...new Set(ends.map((end) => nakshatraOf(body(end, 'Moon')).name))] : [];
  const nakshatraHeld = !ends || nakshatraNames.length === 1;
  let moonNakshatra = null;
  if (nakshatraHeld) {
    const position = nakshatraOf(moonRow);
    const lore = NAKSHATRA_LORE[position.name];
    moonNakshatra = { name: position.name, number: position.index + 1, pada: position.pada, lord: position.lord, deity: lore.deity, symbol: lore.symbol, line: `Your Moon was in ${position.name}, the ${ordinal(position.index + 1)} nakshatra, ruled by ${position.lord}, with ${lore.deity} as its deity and ${lore.symbol} as its symbol. ${lore.line}` };
  }
  if (!natal.timeKnown) {
    limits.push('No birth time was given, so there is no rising sign (lagna), and the Moon sign and nakshatra are given only where the whole birth day keeps them.');
    if (!moonHold.held) limits.push(`The Moon changed sign that day: it was in ${moonHold.candidates.join(' or ')}. A birth time settles it.`);
    if (!nakshatraHeld) limits.push(`The Moon changed nakshatra that day: it was in ${nakshatraNames.join(' or ')}. A birth time settles it.`);
    if (!sunHold.held) limits.push(`The Sun changed sign that day: it was in ${sunHold.candidates.join(' or ')}. A birth time settles it.`);
  } else if (!natal.placed) limits.push('No birthplace coordinates were given, so there is no rising sign (lagna).');
  const parts = [sun?.line, moon?.line, rising?.line, moonNakshatra?.line].filter((line): line is string => !!line);
  const confidence = readingConfidence(natal.detail);
  const confidenceLabel = readingConfidenceLabel(natal.detail);
  const summary = `${parts.join(' ')} ${confidenceLabel}.`.trim();
  return {
    data: {
      birthDate: args.birthDate, timeKnown: natal.timeKnown, placed: natal.placed,
      ayanamsa: { name: ayanamsa, label: AYANAMSA_NAME[ayanamsa], degrees: Math.round(chart.ayanamsaValue.true * 10_000) / 10_000 },
      sun, sunCandidates: sunHold.candidates, moon, moonCandidates: moonHold.candidates, rising, moonNakshatra, nakshatraCandidates: nakshatraHeld ? [] : nakshatraNames,
      summary, confidence, confidenceLabel, limits, note: VEDIC_NOTE, pageUrl: `${origin}/birth-chart/`,
    },
    links: [
      { title: 'Your birth chart on Zodiacs (Western zodiac)', url: `${origin}/birth-chart/` },
      { title: 'Resolve a town or city (find_birthplace)', url: `${origin}/birth-chart/` },
      { title: 'How we calculate', url: `${origin}/methodology/` },
    ],
  };
}

const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth', 'twenty-first', 'twenty-second', 'twenty-third', 'twenty-fourth', 'twenty-fifth', 'twenty-sixth', 'twenty-seventh'];
const ordinal = (n: number) => ORDINALS[n].replace('-', ' ');

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
