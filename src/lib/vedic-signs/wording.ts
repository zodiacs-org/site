/**
 * The pre-written words of the Vedic signs reading, shared by the
 * /vedic-signs/ page and the get_vedic_signs tool: the twelve rashis, the 27
 * nakshatras with their traditional deity and symbol, and the ayanamsas the
 * reading offers. Nothing here is generated. Pure: no engine, no network.
 * Every value import names its file, so the share function loads it as it is.
 */

export const VEDIC_AYANAMSAS = ['lahiri', 'raman', 'krishnamurti', 'fagan-bradley', 'yukteswar', 'true-chitra'] as const;
export type VedicAyanamsa = typeof VEDIC_AYANAMSAS[number];
export const AYANAMSA_NAME: Readonly<Record<VedicAyanamsa, string>> = {
  lahiri: 'Lahiri (Chitrapaksha)', raman: 'Raman', krishnamurti: 'Krishnamurti (KP)', 'fagan-bradley': 'Fagan and Bradley', yukteswar: 'Sri Yukteswar', 'true-chitra': 'True Chitra',
};

/** The 27 nakshatras of 13 degrees 20 minutes, from 0 degrees sidereal Aries (the engine's NAKSHATRAS, which a test holds this to). */
export const NAKSHATRA_NAMES = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'] as const;
export type NakshatraName = typeof NAKSHATRA_NAMES[number];

/** The rashis a nakshatra (index 0 to 26) touches: one, or two where a sign boundary runs through it. */
export function nakshatraSigns(index: number): number[] {
  const start = (index * 40) / 3;
  const first = Math.floor(start / 30);
  const last = Math.floor(((index + 1) * 40) / 3 / 30 - 1e-9);
  return first === last ? [first] : [first, last];
}

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

export const VEDIC_NOTE = 'Vedic astrology counts the signs from the stars, so its signs sit about 24 degrees behind the Western ones: many people find their Vedic Sun sign is the sign before their Western one.';

const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth', 'twenty first', 'twenty second', 'twenty third', 'twenty fourth', 'twenty fifth', 'twenty sixth', 'twenty seventh'];
/** "fifteenth", for 1 to 27. */
export const nakshatraOrdinal = (n: number): string => ORDINALS[n];
