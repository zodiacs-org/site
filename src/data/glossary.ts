import { ASPECTS } from '../lib/engine/aspects';
import { TRANSIT_ORB } from '../lib/transits';
import {
  CONTEXT_TERMS,
  normalizeContextTerm,
  type GlossaryCategory,
  type GlossaryLevel,
} from './context-help';

export type { GlossaryCategory, GlossaryLevel } from './context-help';

export interface GlossaryLink {
  href: string;
  label: string;
}

export interface GlossaryTerm {
  slug: string;
  term: string;
  definition: string;
  /** A one-sentence explanation suitable for first-time readers. */
  plainDefinition?: string;
  /** Search and inline-help spellings such as “Rx”, “ASC”, or “natal chart”. */
  aliases?: readonly string[];
  category?: GlossaryCategory;
  level?: GlossaryLevel;
  receipt?: string;
  related?: string[];
  link?: GlossaryLink;
}

type AspectName = (typeof ASPECTS)[number]['type'];

function aspectDefinition(type: AspectName) {
  const definition = ASPECTS.find((candidate) => candidate.type === type);
  if (!definition) throw new Error(`Missing aspect definition for ${type}`);
  return definition;
}

function aspectReceipt(type: AspectName): string {
  const definition = aspectDefinition(type);
  return `Exact ${definition.angle}° · natal orb ≤ ${definition.orb}° · with Sun or Moon ≤ ${definition.orbLuminary}°`;
}

const conjunction = aspectDefinition('conjunction');
const sextile = aspectDefinition('sextile');
const square = aspectDefinition('square');
const trine = aspectDefinition('trine');
const opposition = aspectDefinition('opposition');

const terms: GlossaryTerm[] = [
  {
    slug: 'zodiac',
    term: 'Zodiac',
    definition: 'The zodiac is the coordinate band around the ecliptic used to describe where chart bodies appear in longitude. This site divides it into twelve tropical signs of equal size.',
    related: ['ecliptic', 'zodiac-sign', 'tropical-zodiac'],
    link: { href: '/learn/zodiac-dates/', label: 'See the zodiac table' },
  },
  {
    slug: 'zodiac-sign',
    term: 'Zodiac sign',
    definition: 'A zodiac sign is one of twelve equal sections of zodiac longitude. A placement enters a sign when its longitude crosses that section’s boundary.',
    receipt: 'Twelve signs · 30° each',
    related: ['zodiac', 'ingress', 'placement'],
    link: { href: '/learn/zodiac-dates/', label: 'See all twelve signs' },
  },
  {
    slug: 'tropical-zodiac',
    term: 'Tropical zodiac',
    definition: 'The tropical zodiac fixes 0° Aries to the March equinox and measures twelve equal signs from that point. This site computes tropical positions rather than sidereal positions.',
    receipt: 'Aries begins at 0° tropical longitude',
    related: ['sidereal-zodiac', 'precession', 'zodiac-longitude'],
    link: { href: '/learn/zodiac-dates/', label: 'See tropical sign boundaries' },
  },
  {
    slug: 'sidereal-zodiac',
    term: 'Sidereal zodiac',
    definition: 'A sidereal zodiac keeps its signs aligned to a chosen stellar reference through an offset often called an ayanamsha. This site does not compute sidereal charts; its chart positions are tropical.',
    related: ['tropical-zodiac', 'precession'],
  },
  {
    slug: 'precession',
    term: 'Precession',
    definition: 'Precession is the slow change in the orientation of Earth’s rotational axis, which shifts the equinoxes relative to the stars. It is the reason tropical and sidereal zodiac frames do not stay aligned.',
    related: ['tropical-zodiac', 'sidereal-zodiac', 'ecliptic'],
    link: { href: '/methodology/', label: 'Read the calculation method' },
  },
  {
    slug: 'zodiac-season',
    term: 'Zodiac season',
    definition: 'A zodiac season is the interval while the tropical Sun occupies one sign. It begins at one exact solar ingress; the year changes that UTC instant, and time zones change its local civil date and clock time.',
    related: ['sun', 'ingress', 'tropical-zodiac'],
    link: { href: '/learn/zodiac-dates/', label: 'See exact Sun ingresses' },
  },
  {
    slug: 'element',
    term: 'Element',
    definition: 'Element is a four-part classification that groups the signs as fire, earth, air, or water. Each element contains one cardinal, one fixed, and one mutable sign.',
    related: ['fire', 'earth', 'air', 'water', 'modality'],
    link: { href: '/learn/zodiac-dates/', label: 'Compare sign elements' },
  },
  {
    slug: 'fire',
    term: 'Fire',
    definition: 'Fire is the element assigned to Aries, Leo, and Sagittarius. In this site’s readings, it describes emphasis on initiative, expression, and conviction rather than a physical substance.',
    related: ['aries', 'leo', 'sagittarius', 'element'],
  },
  {
    slug: 'earth',
    term: 'Earth',
    definition: 'Earth is the element assigned to Taurus, Virgo, and Capricorn. In this site’s readings, it describes emphasis on material conditions, maintenance, and practical results.',
    related: ['taurus', 'virgo', 'capricorn', 'element'],
  },
  {
    slug: 'air',
    term: 'Air',
    definition: 'Air is the element assigned to Gemini, Libra, and Aquarius. In this site’s readings, it describes emphasis on language, exchange, and systems of thought.',
    related: ['gemini', 'libra', 'aquarius', 'element'],
  },
  {
    slug: 'water',
    term: 'Water',
    definition: 'Water is the element assigned to Cancer, Scorpio, and Pisces. In this site’s readings, it describes emphasis on feeling, attachment, memory, and permeability.',
    related: ['cancer', 'scorpio', 'pisces', 'element'],
  },
  {
    slug: 'modality',
    term: 'Modality',
    definition: 'Modality classifies signs by how they meet a season: cardinal signs begin, fixed signs sustain, and mutable signs transition. Each modality includes one sign from every element.',
    related: ['cardinal', 'fixed', 'mutable', 'element'],
    link: { href: '/learn/zodiac-dates/', label: 'Compare sign modalities' },
  },
  {
    slug: 'cardinal',
    term: 'Cardinal',
    definition: 'Cardinal is the modality of Aries, Cancer, Libra, and Capricorn. These four signs begin the tropical seasons and are read through initiation and direction.',
    related: ['aries', 'cancer', 'libra', 'capricorn', 'modality'],
  },
  {
    slug: 'fixed',
    term: 'Fixed',
    definition: 'Fixed is the modality of Taurus, Leo, Scorpio, and Aquarius. These four signs occupy the middle of the tropical seasons and are read through continuity and concentration.',
    related: ['taurus', 'leo', 'scorpio', 'aquarius', 'modality'],
  },
  {
    slug: 'mutable',
    term: 'Mutable',
    definition: 'Mutable is the modality of Gemini, Virgo, Sagittarius, and Pisces. These four signs close the tropical seasons and are read through adjustment and transition.',
    related: ['gemini', 'virgo', 'sagittarius', 'pisces', 'modality'],
  },
  {
    slug: 'polarity',
    term: 'Polarity',
    definition: 'Polarity divides the signs into alternating day and night groups, also called positive and negative in some texts. This site uses the day and night labels to avoid treating either half as better or worse.',
    related: ['day-sign', 'night-sign', 'zodiac-sign'],
    link: { href: '/learn/zodiac-dates/', label: 'Compare sign polarities' },
  },
  {
    slug: 'day-sign',
    term: 'Day sign',
    definition: 'A day sign belongs to the outward-facing half of the zodiac’s alternating polarity. Aries, Gemini, Leo, Libra, Sagittarius, and Aquarius make up this group.',
    related: ['night-sign', 'polarity'],
  },
  {
    slug: 'night-sign',
    term: 'Night sign',
    definition: 'A night sign belongs to the inward-facing half of the zodiac’s alternating polarity. Taurus, Cancer, Virgo, Scorpio, Capricorn, and Pisces make up this group.',
    related: ['day-sign', 'polarity'],
  },
  {
    slug: 'aries',
    term: 'Aries',
    definition: 'Aries is the first tropical sign, spanning 0° through just under 30° of zodiac longitude. It is a cardinal fire day sign ruled by Mars in both modern and classical tables.',
    related: ['fire', 'cardinal', 'mars', 'first-house'],
    link: { href: '/aries/', label: 'Read the Aries guide' },
  },
  {
    slug: 'taurus',
    term: 'Taurus',
    definition: 'Taurus is the second tropical sign, spanning 30° through just under 60° of zodiac longitude. It is a fixed earth night sign ruled by Venus in both modern and classical tables.',
    related: ['earth', 'fixed', 'venus', 'second-house'],
    link: { href: '/taurus/', label: 'Read the Taurus guide' },
  },
  {
    slug: 'gemini',
    term: 'Gemini',
    definition: 'Gemini is the third tropical sign, spanning 60° through just under 90° of zodiac longitude. It is a mutable air day sign ruled by Mercury in both modern and classical tables.',
    related: ['air', 'mutable', 'mercury', 'third-house'],
    link: { href: '/gemini/', label: 'Read the Gemini guide' },
  },
  {
    slug: 'cancer',
    term: 'Cancer',
    definition: 'Cancer is the fourth tropical sign, spanning 90° through just under 120° of zodiac longitude. It is a cardinal water night sign ruled by the Moon in both modern and classical tables.',
    related: ['water', 'cardinal', 'moon', 'fourth-house'],
    link: { href: '/cancer/', label: 'Read the Cancer guide' },
  },
  {
    slug: 'leo',
    term: 'Leo',
    definition: 'Leo is the fifth tropical sign, spanning 120° through just under 150° of zodiac longitude. It is a fixed fire day sign ruled by the Sun in both modern and classical tables.',
    related: ['fire', 'fixed', 'sun', 'fifth-house'],
    link: { href: '/leo/', label: 'Read the Leo guide' },
  },
  {
    slug: 'virgo',
    term: 'Virgo',
    definition: 'Virgo is the sixth tropical sign, spanning 150° through just under 180° of zodiac longitude. It is a mutable earth night sign ruled by Mercury in both modern and classical tables.',
    related: ['earth', 'mutable', 'mercury', 'sixth-house'],
    link: { href: '/virgo/', label: 'Read the Virgo guide' },
  },
  {
    slug: 'libra',
    term: 'Libra',
    definition: 'Libra is the seventh tropical sign, spanning 180° through just under 210° of zodiac longitude. It is a cardinal air day sign ruled by Venus in both modern and classical tables.',
    related: ['air', 'cardinal', 'venus', 'seventh-house'],
    link: { href: '/libra/', label: 'Read the Libra guide' },
  },
  {
    slug: 'scorpio',
    term: 'Scorpio',
    definition: 'Scorpio is the eighth tropical sign, spanning 210° through just under 240° of zodiac longitude. It is a fixed water night sign ruled by Pluto in the modern table and Mars in the classical table.',
    related: ['water', 'fixed', 'pluto', 'mars', 'eighth-house'],
    link: { href: '/scorpio/', label: 'Read the Scorpio guide' },
  },
  {
    slug: 'sagittarius',
    term: 'Sagittarius',
    definition: 'Sagittarius is the ninth tropical sign, spanning 240° through just under 270° of zodiac longitude. It is a mutable fire day sign ruled by Jupiter in both modern and classical tables.',
    related: ['fire', 'mutable', 'jupiter', 'ninth-house'],
    link: { href: '/sagittarius/', label: 'Read the Sagittarius guide' },
  },
  {
    slug: 'capricorn',
    term: 'Capricorn',
    definition: 'Capricorn is the tenth tropical sign, spanning 270° through just under 300° of zodiac longitude. It is a cardinal earth night sign ruled by Saturn in both modern and classical tables.',
    related: ['earth', 'cardinal', 'saturn', 'tenth-house'],
    link: { href: '/capricorn/', label: 'Read the Capricorn guide' },
  },
  {
    slug: 'aquarius',
    term: 'Aquarius',
    definition: 'Aquarius is the eleventh tropical sign, spanning 300° through just under 330° of zodiac longitude. It is a fixed air day sign ruled by Uranus in the modern table and Saturn in the classical table.',
    related: ['air', 'fixed', 'uranus', 'saturn', 'eleventh-house'],
    link: { href: '/aquarius/', label: 'Read the Aquarius guide' },
  },
  {
    slug: 'pisces',
    term: 'Pisces',
    definition: 'Pisces is the twelfth tropical sign, spanning 330° through just under 360° of zodiac longitude. It is a mutable water night sign ruled by Neptune in the modern table and Jupiter in the classical table.',
    related: ['water', 'mutable', 'neptune', 'jupiter', 'twelfth-house'],
    link: { href: '/pisces/', label: 'Read the Pisces guide' },
  },
  {
    slug: 'angle',
    term: 'Angle',
    definition: 'An angle is one of four chart points derived from a known time and place: the ascendant, midheaven, descendant, and IC. These points anchor the horizon and meridian axes and are omitted when birth time is unknown.',
    related: ['ascendant', 'midheaven', 'descendant', 'ic'],
    link: { href: '/birth-chart/', label: 'Calculate chart angles' },
  },
  {
    slug: 'ascendant',
    term: 'Ascendant',
    definition: 'The ascendant is the ecliptic degree rising on the eastern horizon at a specific time and place. It anchors the first house and supplies the rising sign; without a known birth time, this site omits the angles and houses.',
    receipt: 'Descendant = Ascendant + 180°',
    related: ['rising-sign', 'descendant', 'first-house', 'angle'],
    link: { href: '/rising-sign/', label: 'Calculate the ascendant' },
  },
  {
    slug: 'big-three',
    term: 'Big three',
    definition: 'The big three are the Sun sign, Moon sign, and rising sign. The first two come from body longitude, while the rising sign also requires an accurate time and place.',
    related: ['sun-sign', 'moon-sign', 'rising-sign'],
    link: { href: '/birth-chart/', label: 'Calculate the big three' },
  },
  {
    slug: 'birth-chart',
    term: 'Birth chart (natal chart)',
    definition: 'A birth chart is a map of apparent geocentric positions for one birth moment. This site calculates tropical longitudes, signs, major aspects, and, when time and place are known, angles and houses.',
    related: ['placement', 'aspect', 'house', 'angle'],
    link: { href: '/birth-chart/', label: 'Calculate a birth chart' },
  },
  {
    slug: 'chart-ruler',
    term: 'Chart ruler',
    definition: 'The chart ruler is the planet that classically rules the rising sign. This site uses traditional rulership for that label, so a known ascendant is required.',
    related: ['rising-sign', 'ascendant', 'classical-ruler', 'rulership'],
    link: { href: '/rising-sign/', label: 'Find the chart ruler' },
  },
  {
    slug: 'cusp',
    term: 'Cusp',
    definition: 'A cusp is a boundary, usually between houses or between zodiac signs in date-based shorthand. A computed sign changes only at an exact ingress, while house cusps depend on the selected house system.',
    related: ['ingress', 'house-system', 'zodiac-sign'],
    link: { href: '/birthday/', label: 'Check a birthday boundary' },
  },
  {
    slug: 'decan',
    term: 'Decan',
    definition: 'A decan is one of three equal divisions within a zodiac sign. This site uses ten-degree triplicity decans and assigns their rulers from the classical table.',
    receipt: 'Three decans per sign · 10° each',
    related: ['degree', 'zodiac-sign', 'classical-ruler'],
    link: { href: '/birthday/', label: 'Look up birthday decans' },
  },
  {
    slug: 'degree',
    term: 'Degree',
    definition: 'A degree is one three-hundred-and-sixtieth of a circle and the basic unit used for chart longitude. Sign degree describes a position within its thirty-degree sign, while zodiac longitude describes its position around the full circle.',
    receipt: 'One full circle = 360°',
    related: ['zodiac-longitude', 'zodiac-sign', 'orb'],
  },
  {
    slug: 'descendant',
    term: 'Descendant',
    definition: 'The descendant is the ecliptic degree setting on the western horizon at a specific time and place. It is exactly opposite the ascendant and anchors the seventh-house side of the chart.',
    receipt: 'Descendant = Ascendant + 180°',
    related: ['ascendant', 'seventh-house', 'angle'],
    link: { href: '/birth-chart/', label: 'Calculate chart angles' },
  },
  {
    slug: 'ecliptic',
    term: 'Ecliptic',
    definition: 'The ecliptic is the apparent annual path of the Sun against the sky and the reference plane for zodiac coordinates. Chart longitude runs along this plane, while ecliptic latitude measures distance north or south of it.',
    related: ['zodiac-longitude', 'ecliptic-latitude', 'zodiac'],
    link: { href: '/methodology/', label: 'Read the coordinate method' },
  },
  {
    slug: 'ecliptic-latitude',
    term: 'Ecliptic latitude',
    definition: 'Ecliptic latitude is angular distance north or south of the ecliptic plane. The engine retains it for body positions, but sign and house placement on this site use zodiac longitude.',
    related: ['ecliptic', 'zodiac-longitude', 'placement', 'declination'],
    link: { href: '/methodology/', label: 'Read the coordinate method' },
  },
  {
    slug: 'declination',
    term: 'Declination',
    definition: 'Declination is angular distance north or south of the celestial equator, which is a different reference plane from the ecliptic and so a different measurement from ecliptic latitude. A chart wheel does not carry it: the wheel plots zodiac longitude only. The dimensional view on the birth-chart page computes declination for the ten Sun-through-Pluto bodies and draws the circles they ride.',
    receipt: 'Bounded by the obliquity of the ecliptic, ±23.44°',
    related: ['ecliptic-latitude', 'out-of-bounds', 'parallel', 'contraparallel'],
    link: { href: '/birth-chart/three-dimensions/#declination', label: 'Read how declination works' },
  },
  {
    slug: 'out-of-bounds',
    term: 'Out of bounds',
    definition: 'A body is out of bounds when its declination passes ±23.44°, further north or south of the celestial equator than the Sun itself ever travels. The Moon and Mercury reach it most often, Venus and Mars less so, and the Sun never can, because that limit is the Sun’s own path. The dimensional view on the birth-chart page marks any body outside the bounds circles.',
    receipt: 'Out of bounds when |declination| > 23.44°',
    aliases: ['oob'],
    related: ['declination', 'ecliptic', 'moon'],
    link: { href: '/birth-chart/three-dimensions/#out-of-bounds', label: 'Read how out of bounds works' },
  },
  {
    slug: 'parallel',
    term: 'Parallel',
    definition: 'A parallel joins two bodies at the same declination on the same side of the celestial equator, and traditional practice reads it much as it reads a conjunction. Because it measures height above the equator rather than position round the zodiac, a parallel can hold between bodies that stand half the wheel apart and show no longitude aspect at all. This site marks parallels within 1° of exact, or 1.5° when the Sun or Moon is one of the pair.',
    receipt: 'Same-side declinations within 1° · 1.5° with Sun or Moon',
    aliases: ['declination aspect'],
    related: ['contraparallel', 'declination', 'conjunction', 'aspect'],
    link: { href: '/birth-chart/three-dimensions/#parallels', label: 'Read how parallels work' },
  },
  {
    slug: 'contraparallel',
    term: 'Contraparallel',
    definition: 'A contraparallel joins two bodies at the same declination on opposite sides of the celestial equator, mirrored across it, and traditional practice reads it much as it reads an opposition. Like the parallel it is invisible on a chart wheel, which plots zodiac longitude and not declination. This site marks contraparallels within 1° of exact, or 1.5° when the Sun or Moon is one of the pair.',
    receipt: 'Mirrored declinations within 1° · 1.5° with Sun or Moon',
    related: ['parallel', 'declination', 'opposition', 'aspect'],
    link: { href: '/birth-chart/three-dimensions/#parallels', label: 'Read how contraparallels work' },
  },
  {
    slug: 'ephemeris',
    term: 'Ephemeris',
    definition: 'An ephemeris is a table or computational model of astronomical positions over time. This site obtains planetary and lunar positions from Astronomy Engine instead of reading a printed table.',
    related: ['apparent-position', 'geocentric-position', 'transit'],
    link: { href: '/methodology/', label: 'Read the engine method' },
  },
  {
    slug: 'geocentric-position',
    term: 'Geocentric position',
    definition: 'A geocentric position describes where a body appears from the center of Earth rather than from the Sun. Natal positions and transits on this site use the geocentric frame.',
    related: ['apparent-position', 'ephemeris', 'zodiac-longitude'],
    link: { href: '/methodology/', label: 'Read the position method' },
  },
  {
    slug: 'apparent-position',
    term: 'Apparent position',
    definition: 'An apparent position includes observational corrections that affect where a body appears at a given instant. This site’s planetary longitudes include light-time, aberration, and nutation through Astronomy Engine.',
    related: ['geocentric-position', 'ephemeris', 'zodiac-longitude'],
    link: { href: '/methodology/', label: 'Read the position method' },
  },
  {
    slug: 'glyph',
    term: 'Glyph',
    definition: 'A glyph is the compact symbol used to label a sign, planet, or aspect. It is a display shorthand; the underlying chart data remains a named body, sign, or aspect type.',
    related: ['zodiac-sign', 'planet', 'aspect'],
  },
  {
    slug: 'hemisphere',
    term: 'Hemisphere',
    definition: 'Hemisphere can refer to Earth’s northern or southern half when discussing seasons. Tropical sign longitudes stay the same in both hemispheres, while the associated civil seasons reverse.',
    related: ['zodiac-season', 'tropical-zodiac'],
    link: { href: '/learn/zodiac-dates/', label: 'Compare both hemispheres' },
  },
  {
    slug: 'house',
    term: 'House',
    definition: 'A house is one of twelve chart sectors used to locate a placement within areas of life. House assignment requires a time, place, and house system; it is not determined by sign alone.',
    related: ['house-system', 'cusp', 'placement'],
    link: { href: '/learn/houses/', label: 'Read the house guides' },
  },
  {
    slug: 'house-system',
    term: 'House system',
    definition: 'A house system is a rule for turning the local sky and ascendant into twelve house sectors. This site offers whole-sign and Placidus houses, with a documented polar fallback.',
    related: ['whole-sign-houses', 'placidus', 'polar-fallback'],
    link: { href: '/birth-chart/', label: 'Compare house systems' },
  },
  {
    slug: 'ic',
    term: 'IC (Imum Coeli)',
    definition: 'The IC is the ecliptic point opposite the midheaven on the local meridian axis. It anchors the lower half of the chart but is not universally identical to the fourth-house cusp.',
    receipt: 'IC = Midheaven + 180°',
    related: ['midheaven', 'fourth-house', 'angle'],
    link: { href: '/birth-chart/', label: 'Calculate chart angles' },
  },
  {
    slug: 'midheaven',
    term: 'Midheaven (MC)',
    definition: 'The midheaven is the ecliptic point where the local meridian reaches the upper half of the chart. It is an angle associated with public direction, but in whole-sign houses it need not equal the tenth-house cusp.',
    related: ['ic', 'tenth-house', 'angle', 'whole-sign-houses'],
    link: { href: '/birth-chart/', label: 'Calculate the midheaven' },
  },
  {
    slug: 'modern-ruler',
    term: 'Modern ruler',
    definition: 'A modern ruler is the planet assigned to a sign after the discoveries of Uranus, Neptune, and Pluto. On this site those assignments differ from the classical table only for Aquarius, Pisces, and Scorpio.',
    related: ['classical-ruler', 'rulership', 'uranus', 'neptune', 'pluto'],
    link: { href: '/learn/zodiac-dates/', label: 'Compare sign rulers' },
  },
  {
    slug: 'natural-house',
    term: 'Natural house',
    definition: 'The sign-house correspondence, often called the “natural house” scheme, is a modern teaching device that pairs Aries with the first house, Taurus with the second, and so on. It is not a traditional rulership table and never determines the houses in a calculated natal chart.',
    related: ['house', 'zodiac-sign', 'whole-sign-houses'],
    link: { href: '/learn/houses/', label: 'Read the house guides' },
  },
  {
    slug: 'no-time-chart',
    term: 'No-time chart',
    definition: 'A no-time chart is the reduced chart used when a birth time is unknown. This site uses local noon for body positions and omits angles and houses rather than presenting uncertain values.',
    related: ['birth-chart', 'angle', 'house'],
    link: { href: '/birth-chart/', label: 'Calculate a chart' },
  },
  {
    slug: 'placement',
    term: 'Placement',
    definition: 'A placement is a chart body located by sign and degree, and by house when time and place are known. A phrase such as “Venus in Taurus” names the body and sign portion of that result.',
    related: ['planet', 'zodiac-sign', 'house', 'degree'],
    link: { href: '/learn/placements/', label: 'Browse placement guides' },
  },
  {
    slug: 'placidus',
    term: 'Placidus',
    definition: 'Placidus divides the houses through time-based semi-arcs, so its intermediate cusps vary with latitude and birth time. This site falls back to whole-sign houses inside the polar circle, where the absolute latitude is 90° minus the obliquity or more (about 66.56°) and the Placidus solver is undefined.',
    receipt: 'Polar fallback: |latitude| ≥ 90° − ε (about 66.56°)',
    related: ['house-system', 'whole-sign-houses', 'polar-fallback'],
    link: { href: '/birth-chart/', label: 'Use Placidus houses' },
  },
  {
    slug: 'polar-fallback',
    term: 'Polar fallback',
    definition: 'Polar fallback is the switch from Placidus to whole-sign houses where the Placidus cusp calculation cannot resolve. This site applies it inside the polar circle, where the absolute latitude is 90° minus the obliquity or more, and also if circumpolar cusp math degenerates.',
    receipt: 'Fallback when |latitude| ≥ 90° − ε or cusp math is undefined',
    related: ['placidus', 'whole-sign-houses', 'house-system'],
    link: { href: '/birth-chart/', label: 'Read the house-system options' },
  },
  {
    slug: 'quadrant',
    term: 'Quadrant',
    definition: 'A quadrant is one of four chart regions bounded by the ascendant-descendant and midheaven-IC axes. Quadrant house systems such as Placidus subdivide those regions into three houses each.',
    related: ['angle', 'placidus', 'house-system'],
  },
  {
    slug: 'rising-sign',
    term: 'Rising sign',
    definition: 'The rising sign is the tropical sign containing the ascendant. It changes with local time and place, so a date alone cannot establish it.',
    related: ['ascendant', 'chart-ruler', 'big-three'],
    link: { href: '/rising-sign/', label: 'Calculate the rising sign' },
  },
  {
    slug: 'rulership',
    term: 'Rulership',
    definition: 'Rulership is the convention that assigns one or more planets to each zodiac sign. This site displays both modern and classical rulers and uses the classical table for chart rulers and decans.',
    related: ['modern-ruler', 'classical-ruler', 'chart-ruler'],
    link: { href: '/learn/zodiac-dates/', label: 'Compare rulership tables' },
  },
  {
    slug: 'sun-sign',
    term: 'Sun sign',
    definition: 'The Sun sign is the tropical sign containing the Sun at a given instant. A birthday near an ingress needs its year and time checked because the boundary does not fall at one fixed civil date.',
    related: ['sun', 'big-three', 'ingress'],
    link: { href: '/birthday/', label: 'Look up a birthday' },
  },
  {
    slug: 'moon-sign',
    term: 'Moon sign',
    definition: 'The Moon sign is the tropical sign containing the Moon at a given instant. Because the Moon moves quickly, birth time can change the answer on a sign-boundary day.',
    related: ['moon', 'big-three', 'ingress'],
    link: { href: '/moon-sign/', label: 'Calculate the Moon sign' },
  },
  {
    slug: 'classical-ruler',
    term: 'Classical ruler',
    definition: 'A classical ruler comes from the seven-body rulership scheme used before Uranus, Neptune, and Pluto were discovered. This site keeps that table for chart rulers, decans, and traditional dignity calculations.',
    related: ['modern-ruler', 'rulership', 'essential-dignity'],
    link: { href: '/learn/zodiac-dates/', label: 'Compare sign rulers' },
  },
  {
    slug: 'whole-sign-houses',
    term: 'Whole-sign houses',
    definition: 'Whole-sign houses make the ascendant’s entire sign the first house and assign each following sign to the next house. Every house spans thirty degrees, while the ascendant and midheaven remain separate angle degrees within the chart.',
    receipt: 'Twelve houses · 30° each',
    related: ['house-system', 'placidus', 'ascendant'],
    link: { href: '/birth-chart/', label: 'Use whole-sign houses' },
  },
  {
    slug: 'zodiac-longitude',
    term: 'Zodiac longitude',
    definition: 'Zodiac longitude is angular position measured eastward around the ecliptic from 0° Aries. This site normalizes it to the range from 0° up to, but not including, 360°.',
    related: ['degree', 'ecliptic', 'tropical-zodiac'],
    link: { href: '/methodology/', label: 'Read the coordinate method' },
  },
  {
    slug: 'first-house',
    term: 'First house',
    definition: 'The first house begins the house sequence and covers self-presentation, approach, and the body’s immediate way of meeting the world. Its starting boundary is tied to the ascendant, though the exact cusp treatment depends on the house system.',
    related: ['ascendant', 'seventh-house', 'house'],
    link: { href: '/learn/houses/first-house/', label: 'Read the first-house guide' },
  },
  {
    slug: 'second-house',
    term: 'Second house',
    definition: 'The second house covers personal resources, possessions, earning, and the standards used to decide what is worth keeping. It stands opposite the eighth house, which deals with shared resources and obligations.',
    related: ['eighth-house', 'house'],
    link: { href: '/learn/houses/second-house/', label: 'Read the second-house guide' },
  },
  {
    slug: 'third-house',
    term: 'Third house',
    definition: 'The third house covers local movement, routine communication, siblings, neighbors, and early learning. It stands opposite the ninth house, which widens the frame toward distance, belief, and advanced study.',
    related: ['ninth-house', 'house'],
    link: { href: '/learn/houses/third-house/', label: 'Read the third-house guide' },
  },
  {
    slug: 'fourth-house',
    term: 'Fourth house',
    definition: 'The fourth house covers home, roots, family history, privacy, and the conditions that make a place feel secure. It stands opposite the tenth house, placing private foundations across from public direction.',
    related: ['tenth-house', 'ic', 'house'],
    link: { href: '/learn/houses/fourth-house/', label: 'Read the fourth-house guide' },
  },
  {
    slug: 'fifth-house',
    term: 'Fifth house',
    definition: 'The fifth house covers play, creative authorship, romance, pleasure, and relationships with children. It stands opposite the eleventh house, setting personal expression across from groups and shared futures.',
    related: ['eleventh-house', 'house'],
    link: { href: '/learn/houses/fifth-house/', label: 'Read the fifth-house guide' },
  },
  {
    slug: 'sixth-house',
    term: 'Sixth house',
    definition: 'The sixth house covers daily work, maintenance, health routines, service, and the systems that keep life functioning. It stands opposite the twelfth house, contrasting visible upkeep with retreat and what happens outside ordinary notice.',
    related: ['twelfth-house', 'house'],
    link: { href: '/learn/houses/sixth-house/', label: 'Read the sixth-house guide' },
  },
  {
    slug: 'seventh-house',
    term: 'Seventh house',
    definition: 'The seventh house covers one-to-one partnership, agreement, negotiation, and open opposition. It faces the first house across the ascendant-descendant axis.',
    related: ['first-house', 'descendant', 'house'],
    link: { href: '/learn/houses/seventh-house/', label: 'Read the seventh-house guide' },
  },
  {
    slug: 'eighth-house',
    term: 'Eighth house',
    definition: 'The eighth house covers shared resources, debt, inheritance, dependency, and changes that cannot be handled alone. It stands opposite the second house, placing joint obligations across from personal holdings.',
    related: ['second-house', 'house'],
    link: { href: '/learn/houses/eighth-house/', label: 'Read the eighth-house guide' },
  },
  {
    slug: 'ninth-house',
    term: 'Ninth house',
    definition: 'The ninth house covers long-distance travel, higher study, law, publishing, religion, and frameworks of meaning. It stands opposite the third house, widening local facts into larger systems.',
    related: ['third-house', 'house'],
    link: { href: '/learn/houses/ninth-house/', label: 'Read the ninth-house guide' },
  },
  {
    slug: 'tenth-house',
    term: 'Tenth house',
    definition: 'The tenth house covers vocation, reputation, authority, responsibility, and visible contribution. It stands opposite the fourth house, placing public direction across from private foundations.',
    related: ['fourth-house', 'midheaven', 'house'],
    link: { href: '/learn/houses/tenth-house/', label: 'Read the tenth-house guide' },
  },
  {
    slug: 'eleventh-house',
    term: 'Eleventh house',
    definition: 'The eleventh house covers friendship, communities, alliances, audiences, and plans that require more than one person. It stands opposite the fifth house, balancing collective aims with personal authorship.',
    related: ['fifth-house', 'house'],
    link: { href: '/learn/houses/eleventh-house/', label: 'Read the eleventh-house guide' },
  },
  {
    slug: 'twelfth-house',
    term: 'Twelfth house',
    definition: 'The twelfth house covers retreat, seclusion, institutions, hidden costs, and patterns that operate outside immediate awareness. It stands opposite the sixth house, setting withdrawal across from daily maintenance.',
    related: ['sixth-house', 'house'],
    link: { href: '/learn/houses/twelfth-house/', label: 'Read the twelfth-house guide' },
  },
  {
    slug: 'aspect',
    term: 'Aspect',
    definition: 'An aspect is a recognized angular relationship between two chart positions. This site calculates the five major aspects and reports the distance from each exact angle as its orb.',
    related: ['major-aspect', 'angular-separation', 'orb'],
    link: { href: '/learn/aspects/', label: 'Read the aspect guides' },
  },
  {
    slug: 'major-aspect',
    term: 'Major aspect',
    definition: 'Major aspect is the collective label for conjunction, sextile, square, trine, and opposition. Those are the only aspect types used by this site’s natal and synastry calculations.',
    related: ['conjunction', 'sextile', 'square', 'trine', 'opposition'],
    link: { href: '/learn/aspects/', label: 'Compare the five aspects' },
  },
  {
    slug: 'angular-separation',
    term: 'Angular separation',
    definition: 'Angular separation is the shortest distance between two zodiac longitudes around the circle. For aspect matching, this site expresses that distance from 0° through 180°.',
    related: ['aspect', 'zodiac-longitude', 'orb'],
  },
  {
    slug: 'conjunction',
    term: 'Conjunction',
    definition: `A conjunction places two chart bodies together at the same zodiac longitude. Its exact angular separation is ${conjunction.angle}°, and the engine treats closeness as concentration rather than ease or strain by itself.`,
    receipt: aspectReceipt('conjunction'),
    related: ['aspect', 'orb', 'applying', 'separating'],
    link: { href: '/learn/aspects/conjunction/', label: 'Read the conjunction guide' },
  },
  {
    slug: 'sextile',
    term: 'Sextile',
    definition: `A sextile places two chart bodies two signs apart in the zodiac geometry. Its exact angular separation is ${sextile.angle}°, and this site reads it as an opening that still requires participation.`,
    receipt: aspectReceipt('sextile'),
    related: ['aspect', 'orb', 'applying', 'separating'],
    link: { href: '/learn/aspects/sextile/', label: 'Read the sextile guide' },
  },
  {
    slug: 'square',
    term: 'Square',
    definition: `A square places two chart bodies a quarter-circle apart. Its exact angular separation is ${square.angle}°, and this site reads it as friction that presses for a response.`,
    receipt: aspectReceipt('square'),
    related: ['aspect', 'orb', 'applying', 'separating'],
    link: { href: '/learn/aspects/square/', label: 'Read the square guide' },
  },
  {
    slug: 'trine',
    term: 'Trine',
    definition: `A trine places two chart bodies four signs apart in the zodiac geometry. Its exact angular separation is ${trine.angle}°, and this site reads it as a channel that tends to operate with less resistance.`,
    receipt: aspectReceipt('trine'),
    related: ['aspect', 'orb', 'applying', 'separating'],
    link: { href: '/learn/aspects/trine/', label: 'Read the trine guide' },
  },
  {
    slug: 'opposition',
    term: 'Opposition',
    definition: `An opposition places two chart bodies across the zodiac from one another. Its exact angular separation is ${opposition.angle}°, and this site reads it through polarity, encounter, and competing demands.`,
    receipt: aspectReceipt('opposition'),
    related: ['aspect', 'orb', 'applying', 'separating'],
    link: { href: '/learn/aspects/opposition/', label: 'Read the opposition guide' },
  },
  {
    slug: 'orb',
    term: 'Orb',
    definition: `An orb is the distance between an aspect’s current separation and its exact angle. This site uses aspect-specific limits for natal charts and a ${TRANSIT_ORB}° limit for active transits.`,
    receipt: `Active transit orb ≤ ${TRANSIT_ORB}°`,
    related: ['aspect', 'exact-aspect', 'transit'],
    link: { href: '/transits/', label: 'Read active transits' },
  },
  {
    slug: 'applying',
    term: 'Applying aspect',
    definition: 'An aspect is applying when the moving positions are drawing closer to the aspect’s exact angle. The natal engine labels the aspect applying while its distance from exact is shrinking, judged from the two bodies’ relative speed at that moment; fixed-chart synastry does not assign applying or separating status.',
    related: ['separating', 'exact-aspect', 'aspect'],
  },
  {
    slug: 'separating',
    term: 'Separating aspect',
    definition: 'An aspect is separating when the same 0.02-day forward-speed check does not reduce its distance from the exact angle. It describes direction of motion, not whether the aspect is strong enough to be included.',
    related: ['applying', 'exact-aspect', 'orb'],
  },
  {
    slug: 'exact-aspect',
    term: 'Exact aspect',
    definition: 'An exact aspect occurs when angular separation equals the aspect’s defining angle. An exact transit contact is timestamped at that crossing, including repeated crossings caused by retrograde motion.',
    related: ['partile', 'orb', 'transit', 'retrograde-loop'],
  },
  {
    slug: 'partile',
    term: 'Partile aspect',
    definition: 'Partile is a traditional label for an aspect that is exact or very close to exact, with usage varying by school. Because traditions set that threshold differently, this site reports the actual orb instead of labeling an aspect partile.',
    related: ['exact-aspect', 'orb', 'aspect'],
  },
  {
    slug: 'planet',
    term: 'Planet',
    definition: 'Planet is the general chart label for a moving body whose zodiac position is calculated, even though astrology conventionally includes the Sun and Moon in the same list. This site calculates positions for the Sun through Pluto and both lunar nodes, and does not calculate Chiron or asteroids.',
    related: ['luminary', 'personal-planets', 'outer-planets', 'lunar-nodes'],
    link: { href: '/learn/planets/', label: 'Read the planet guides' },
  },
  {
    slug: 'luminary',
    term: 'Luminary',
    definition: 'Luminary is the shared astrological label for the Sun and Moon. This site gives aspects involving either luminary a wider natal orb than the same aspect between two other bodies.',
    related: ['sun', 'moon', 'aspect', 'orb'],
    link: { href: '/learn/planets/', label: 'Read the planet guides' },
  },
  {
    slug: 'sect',
    term: 'Sect',
    definition: 'Sect divides charts into those born by day and those born by night, according to whether the Sun stood above or below the horizon at the moment of birth. The tradition sorts the planets by the same halves: Sun, Jupiter, and Saturn belong to the day, and Moon, Venus, and Mars to the night, with whichever group matches the chart said to be in sect. Mercury takes the half it rises in. Sect needs a birth time and place, because it needs a horizon.',
    receipt: 'Day chart when the Sun’s altitude at birth is 0° or above',
    aliases: ['day chart', 'night chart', 'diurnal chart', 'nocturnal chart'],
    related: ['sect-light', 'ascendant', 'no-time-chart', 'luminary'],
    link: { href: '/birth-chart/three-dimensions/#sect', label: 'Read how sect works' },
  },
  {
    slug: 'sect-light',
    term: 'Sect light',
    definition: 'The sect light is the luminary that belongs to the chart’s own half of the day: the Sun in a chart born by day, the Moon in one born by night. Traditional practice gives it first weight among the ten bodies. The dimensional view on the birth-chart page rings whichever luminary holds the role.',
    receipt: 'Sun by day · Moon by night',
    related: ['sect', 'luminary', 'sun', 'moon'],
    link: { href: '/birth-chart/three-dimensions/#sect', label: 'Read how the sect light works' },
  },
  {
    slug: 'personal-planets',
    term: 'Personal planets',
    definition: 'Personal planets is a practical grouping for the Sun, Moon, Mercury, Venus, and Mars in chart interpretation. Their placements describe the faster, more individual layer of the chart, though the label is interpretive rather than astronomical.',
    related: ['sun', 'moon', 'mercury', 'venus', 'mars'],
    link: { href: '/learn/planets/', label: 'Read the planet guides' },
  },
  {
    slug: 'outer-planets',
    term: 'Outer planets',
    definition: 'Outer planets is the astrological grouping for Uranus, Neptune, and Pluto. Their slow motion makes sign placements broadly generational, while house placement and exact aspects make their role more specific to one chart.',
    related: ['uranus', 'neptune', 'pluto', 'placement'],
    link: { href: '/learn/planets/', label: 'Read the planet guides' },
  },
  {
    slug: 'sun',
    term: 'Sun',
    definition: 'The Sun is the star at the center of the solar system and one of astrology’s two luminaries. In this site’s readings, its placement describes identity, direction, and the part of life organized around being fully oneself.',
    related: ['luminary', 'sun-sign', 'solar-return'],
    link: { href: '/learn/planets/sun/', label: 'Read the Sun guide' },
  },
  {
    slug: 'moon',
    term: 'Moon',
    definition: 'The Moon is Earth’s natural satellite and the faster of astrology’s two luminaries. In this site’s readings, its placement describes emotional regulation, habits, memory, and what creates a sense of safety.',
    receipt: 'The Moon moves about 13° a day',
    related: ['luminary', 'moon-sign', 'moon-phase'],
    link: { href: '/learn/planets/moon/', label: 'Read the Moon guide' },
  },
  {
    slug: 'mercury',
    term: 'Mercury',
    definition: 'Mercury is the chart body associated here with attention, language, learning, messages, and exchange. Its sign describes style, while its house locates where those processes are most active when a birth time is known.',
    related: ['personal-planets', 'retrograde', 'placement'],
    link: { href: '/learn/planets/mercury/', label: 'Read the Mercury guide' },
  },
  {
    slug: 'venus',
    term: 'Venus',
    definition: 'Venus is the chart body associated here with attraction, taste, reciprocity, pleasure, and value. Its placement describes what draws a person in and how they negotiate closeness and preference.',
    related: ['personal-planets', 'placement', 'rulership'],
    link: { href: '/learn/planets/venus/', label: 'Read the Venus guide' },
  },
  {
    slug: 'mars',
    term: 'Mars',
    definition: 'Mars is the chart body associated here with action, assertion, conflict, appetite, and the use of force. Its placement describes how energy starts, pushes, defends, and spends itself.',
    related: ['personal-planets', 'placement', 'rulership'],
    link: { href: '/learn/planets/mars/', label: 'Read the Mars guide' },
  },
  {
    slug: 'jupiter',
    term: 'Jupiter',
    definition: 'Jupiter is the chart body associated here with growth, confidence, opportunity, belief, and the widening of range. Its placement can describe where a chart expects more room and where excess needs proportion.',
    related: ['planet', 'return', 'placement'],
    link: { href: '/learn/planets/jupiter/', label: 'Read the Jupiter guide' },
  },
  {
    slug: 'saturn',
    term: 'Saturn',
    definition: 'Saturn is the chart body associated here with limits, structure, duty, delay, craft, and accountability. Its natal placement supplies the longitude used to calculate an exact Saturn return.',
    related: ['saturn-return', 'return', 'placement'],
    link: { href: '/learn/planets/saturn/', label: 'Read the Saturn guide' },
  },
  {
    slug: 'uranus',
    term: 'Uranus',
    definition: 'Uranus is the chart body associated here with disruption, independence, invention, and departures from an established pattern. It is used as Aquarius’s modern ruler while Saturn remains the sign’s classical ruler.',
    related: ['outer-planets', 'aquarius', 'modern-ruler'],
    link: { href: '/learn/planets/uranus/', label: 'Read the Uranus guide' },
  },
  {
    slug: 'neptune',
    term: 'Neptune',
    definition: 'Neptune is the chart body associated here with imagination, idealization, diffusion, longing, and uncertain boundaries. It is used as Pisces’s modern ruler while Jupiter remains the sign’s classical ruler.',
    related: ['outer-planets', 'pisces', 'modern-ruler'],
    link: { href: '/learn/planets/neptune/', label: 'Read the Neptune guide' },
  },
  {
    slug: 'pluto',
    term: 'Pluto',
    definition: 'Pluto is the chart body associated here with power, compulsion, elimination, and slow structural change. It is used as Scorpio’s modern ruler while Mars remains the sign’s classical ruler.',
    related: ['outer-planets', 'scorpio', 'modern-ruler'],
    link: { href: '/learn/planets/pluto/', label: 'Read the Pluto guide' },
  },
  {
    slug: 'lunar-nodes',
    term: 'Lunar nodes',
    definition: 'The lunar nodes are the two points where the Moon’s orbit crosses the ecliptic. This site calculates the true North Node and derives the exactly opposite South Node, but excludes both from natal and synastry aspect detection.',
    related: ['north-node', 'south-node', 'true-node', 'ecliptic'],
    link: { href: '/methodology/', label: 'Read the node method' },
  },
  {
    slug: 'north-node',
    term: 'North Node',
    definition: 'The North Node is the ascending intersection where the Moon’s orbit crosses from south to north of the ecliptic. This site computes its true, instantaneous position and places the South Node opposite it.',
    related: ['south-node', 'true-node', 'lunar-nodes'],
  },
  {
    slug: 'south-node',
    term: 'South Node',
    definition: 'The South Node is the descending lunar-orbit intersection opposite the North Node. This site derives it by adding half a circle to the true North Node longitude.',
    receipt: 'South Node = North Node + 180°',
    related: ['north-node', 'true-node', 'lunar-nodes'],
  },
  {
    slug: 'true-node',
    term: 'True node',
    definition: 'The true node follows the instantaneous intersection of the Moon’s changing orbital plane with the ecliptic. This site uses that true position rather than a smoothed mean node.',
    related: ['lunar-nodes', 'north-node', 'ecliptic'],
    link: { href: '/methodology/', label: 'Read the node method' },
  },
  {
    slug: 'essential-dignity',
    term: 'Essential dignity',
    definition: 'Essential dignity is a traditional classification of how a planet is placed by sign, using labels such as domicile, exaltation, detriment, and fall. This site applies that table only to the Sun, Moon, Mercury, Venus, Mars, Jupiter, and Saturn.',
    related: ['domicile', 'exaltation', 'detriment', 'fall'],
  },
  {
    slug: 'domicile',
    term: 'Domicile',
    definition: 'Domicile means a planet occupies a sign it classically rules. It is one of the essential-dignity labels calculated here for the seven traditional chart bodies.',
    related: ['essential-dignity', 'rulership', 'detriment'],
  },
  {
    slug: 'exaltation',
    term: 'Exaltation',
    definition: 'Exaltation is a traditional dignity assigned when a planet occupies a particular honored sign. It stands opposite fall in the dignity table used by this site.',
    related: ['essential-dignity', 'fall', 'domicile'],
  },
  {
    slug: 'detriment',
    term: 'Detriment',
    definition: 'Detriment means a planet occupies the sign opposite one of its classical domiciles. It is a sign-based dignity label, not a measurement of aspect strength or transit intensity.',
    related: ['essential-dignity', 'domicile', 'fall'],
  },
  {
    slug: 'fall',
    term: 'Fall',
    definition: 'Fall means a planet occupies the sign opposite its traditional exaltation. It belongs to the essential-dignity table and does not mean that every expression of the placement is uniformly weak.',
    related: ['essential-dignity', 'exaltation', 'detriment'],
  },
  {
    slug: 'direct',
    term: 'Direct motion',
    definition: 'Direct motion means a body’s apparent geocentric zodiac longitude is increasing with time. A station separates a direct interval from a retrograde interval.',
    related: ['retrograde', 'station', 'zodiac-longitude'],
    link: { href: '/retrogrades/', label: 'See retrograde periods' },
  },
  {
    slug: 'retrograde',
    term: 'Retrograde motion',
    definition: 'Retrograde motion means a body’s apparent geocentric zodiac longitude is decreasing for a time, even though the body has not reversed its physical orbit. The loop can carry a transit across the same natal point more than once.',
    related: ['direct', 'station', 'retrograde-loop', 'transit'],
    link: { href: '/retrogrades/', label: 'See retrograde periods' },
  },
  {
    slug: 'retrograde-loop',
    term: 'Retrograde loop',
    definition: 'A retrograde loop is the apparent path through a section of zodiac longitude as a body slows, reverses, and later resumes direct motion. It can create two or three exact contacts to the same natal point within one broader transit.',
    related: ['retrograde', 'station', 'exact-aspect', 'transit'],
    link: { href: '/retrogrades/', label: 'See retrograde periods' },
  },
  {
    slug: 'station',
    term: 'Station',
    definition: 'A station is the instant when apparent longitude speed passes through zero as a body changes direction. The site derives station times from computed motion rather than from a fixed calendar rule.',
    related: ['direct', 'retrograde', 'zodiac-longitude'],
    link: { href: '/retrogrades/', label: 'See planetary stations' },
  },
  {
    slug: 'ingress',
    term: 'Ingress',
    definition: 'An ingress is the exact instant a body crosses into a new zodiac sign. The zodiac-dates table gives the Sun’s tropical ingresses in UTC instead of treating calendar dates as fixed boundaries.',
    receipt: 'Each tropical sign spans 30° of longitude',
    related: ['transit', 'zodiac-sign', 'zodiac-season'],
    link: { href: '/learn/zodiac-dates/', label: 'See exact Sun ingresses' },
  },
  {
    slug: 'transit',
    term: 'Transit',
    definition: `A transit compares a moving sky position with a fixed point in a natal chart. This site counts an active transit when a major aspect is within ${TRANSIT_ORB}° of exact and can scan for the exact UTC contact.`,
    receipt: `Transits read as active within ${TRANSIT_ORB}° of exact`,
    related: ['orb', 'exact-aspect', 'ingress', 'return'],
    link: { href: '/transits/', label: 'Track current transits' },
  },
  {
    slug: 'return',
    term: 'Return',
    definition: 'A return occurs when a transiting body reaches the same zodiac longitude it held in a natal chart. Retrograde motion can produce multiple exact crossings, which remain separate return instants.',
    related: ['solar-return', 'saturn-return', 'transit', 'retrograde-loop'],
    link: { href: '/saturn-return/', label: 'Calculate a Saturn return' },
  },
  {
    slug: 'progression',
    term: 'Progression',
    definition: 'A progression advances a natal chart by a symbolic timing rule rather than using the sky positions of the target date directly. This site does not calculate progressed charts.',
    related: ['transit', 'return', 'birth-chart'],
  },
  {
    slug: 'solar-return',
    term: 'Solar return',
    definition: 'A solar return is the exact instant the transiting Sun reaches its natal zodiac longitude. It usually falls near the civil birthday, but its UTC time is set by the longitude crossing rather than the calendar alone.',
    related: ['sun', 'return', 'exact-aspect'],
    link: { href: '/saturn-return/', label: 'Read about exact returns' },
  },
  {
    slug: 'saturn-return',
    term: 'Saturn return',
    definition: 'A Saturn return is an exact crossing of transiting Saturn over natal Saturn’s zodiac longitude. This site preserves separate direct and retrograde passes instead of collapsing a multi-pass return into one date.',
    related: ['saturn', 'return', 'retrograde-loop'],
    link: { href: '/saturn-return/', label: 'Calculate a Saturn return' },
  },
  {
    slug: 'moon-phase',
    term: 'Moon phase',
    definition: 'Moon phase describes the illumination cycle created by the changing angular relationship between the Sun and Moon as seen from Earth. This site calculates the phase for an entered moment; location is used only to resolve that moment from local time.',
    related: ['moon', 'lunation', 'new-moon', 'full-moon'],
    link: { href: '/moon-phase/', label: 'Calculate a Moon phase' },
  },
  {
    slug: 'lunation',
    term: 'Lunation',
    definition: 'A lunation is the cycle from one new moon to the next, or a particular new or full moon within that cycle. Eclipses are lunations that occur close enough to the lunar nodes for the Sun, Earth, and Moon to align.',
    related: ['new-moon', 'full-moon', 'eclipse', 'lunar-nodes'],
    link: { href: '/moon-phase/', label: 'Check the lunar cycle' },
  },
  {
    slug: 'new-moon',
    term: 'New moon',
    definition: 'A new moon occurs when the Sun and Moon have the same geocentric ecliptic longitude. The Moon is then near the Sun in the sky, and a solar eclipse is possible only when the alignment is also near a node.',
    related: ['lunation', 'solar-eclipse', 'moon-phase'],
    link: { href: '/moon-phase/', label: 'Check the current Moon phase' },
  },
  {
    slug: 'full-moon',
    term: 'Full moon',
    definition: 'A full moon occurs when the Sun and Moon are opposite in geocentric ecliptic longitude. A lunar eclipse is possible only when that opposition is also close enough to the lunar nodes.',
    related: ['lunation', 'lunar-eclipse', 'moon-phase'],
    link: { href: '/full-moon-calendar/', label: 'See the full-moon calendar' },
  },
  {
    slug: 'eclipse',
    term: 'Eclipse',
    definition: 'An eclipse occurs when a new- or full-moon alignment falls close enough to the lunar nodes for the Sun, Earth, and Moon to line up. At a solar eclipse the Moon blocks the Sun from part of Earth; at a lunar eclipse Earth’s shadow falls on the Moon. This site publishes computed eclipse dates and checks conjunctions and oppositions to natal Sun-through-Pluto positions.',
    related: ['solar-eclipse', 'lunar-eclipse', 'eclipse-season', 'lunar-nodes'],
    link: { href: '/eclipses/', label: 'See upcoming eclipses' },
  },
  {
    slug: 'solar-eclipse',
    term: 'Solar eclipse',
    definition: 'A solar eclipse occurs at a new moon when the Moon crosses between Earth and the Sun closely enough to obscure the Sun from part of Earth. Its exact visibility depends on location even though the geocentric lunation has one UTC instant.',
    related: ['new-moon', 'eclipse', 'eclipse-season'],
    link: { href: '/eclipses/', label: 'See upcoming solar eclipses' },
  },
  {
    slug: 'lunar-eclipse',
    term: 'Lunar eclipse',
    definition: 'A lunar eclipse occurs at a full moon when the Moon passes through Earth’s shadow. It can be seen from the night side of Earth when the Moon is above the horizon.',
    related: ['full-moon', 'eclipse', 'eclipse-season'],
    link: { href: '/eclipses/', label: 'See upcoming lunar eclipses' },
  },
  {
    slug: 'eclipse-season',
    term: 'Eclipse season',
    definition: 'An eclipse season is a period when the Sun is close enough to a lunar node for a new or full moon to produce an eclipse. It commonly contains a solar eclipse and a lunar eclipse separated by about half a lunation.',
    related: ['solar-eclipse', 'lunar-eclipse', 'lunar-nodes', 'lunation'],
    link: { href: '/eclipses/', label: 'See the eclipse calendar' },
  },
  {
    slug: 'void-of-course-moon',
    term: 'Void-of-course Moon',
    definition: 'Under the common modern rule, the Moon is void of course from its last exact major aspect in a sign until it enters the next sign. Definitions differ over which aspects and bodies count; this site uses the five Ptolemaic aspects to the Sun through Pluto and lists every void to the minute.',
    related: ['moon', 'applying', 'major-aspect', 'ingress'],
    link: { href: '/void-of-course-moon/', label: 'See the void-of-course calendar' },
  },
  {
    slug: 'synastry',
    term: 'Synastry',
    definition: 'Synastry compares placements in two natal charts, keeping both charts intact rather than blending them into one. This site calculates major inter-chart aspects among the Sun through Pluto and sorts them by exactness.',
    related: ['bi-wheel', 'inter-chart-aspect', 'composite-chart'],
    link: { href: '/compatibility/', label: 'Compare two birth charts' },
  },
  {
    slug: 'bi-wheel',
    term: 'Bi-wheel',
    definition: 'A bi-wheel draws two charts on concentric rings so their placements can be compared around one zodiac circle. On this site it visualizes synastry between two fixed natal charts.',
    related: ['synastry', 'inter-chart-aspect', 'birth-chart'],
    link: { href: '/compatibility/', label: 'Open the relationship wheel' },
  },
  {
    slug: 'inter-chart-aspect',
    term: 'Inter-chart aspect',
    definition: 'An inter-chart aspect connects a body in one natal chart with a body in another. This site tests the Sun through Pluto in each chart with the same major-aspect orb table used for natal bodies, without applying or separating labels.',
    related: ['synastry', 'aspect', 'orb', 'bi-wheel'],
    link: { href: '/compatibility/', label: 'Compare inter-chart aspects' },
  },
  {
    slug: 'composite-chart',
    term: 'Composite chart',
    definition: 'A composite chart places symbolic points at the midpoints of two natal charts and treats the result as a chart of the relationship. This site computes inter-chart synastry, not composite charts.',
    related: ['synastry', 'bi-wheel', 'inter-chart-aspect'],
    link: { href: '/compatibility/', label: 'Use the synastry calculator' },
  },
  {
    slug: 'utc',
    term: 'UTC',
    definition: 'UTC is the common time standard used to publish one unambiguous instant worldwide. This site converts local birth input through historical time-zone rules and reports exact astronomical events in UTC.',
    related: ['time-zone', 'local-mean-time', 'ephemeris'],
    link: { href: '/methodology/', label: 'Read the time method' },
  },
  {
    slug: 'local-mean-time',
    term: 'Local mean time',
    definition: 'Local mean time is civil time based on the average Sun at a place’s longitude, used historically before standard time zones became common. For a birth from before its place adopted a legal time, this site works out the birthplace’s own local mean time from its longitude rather than asking for a manual UTC offset.',
    related: ['time-zone', 'utc'],
    link: { href: '/methodology/', label: 'Read the time method' },
  },
  {
    slug: 'time-zone',
    term: 'Time zone',
    definition: 'A time zone is a set of civil-clock rules that maps local date and time to UTC, including historical offset changes. This site uses IANA time-zone data so daylight-saving and earlier rule changes are resolved for the entered place.',
    related: ['utc', 'local-mean-time', 'birth-chart'],
    link: { href: '/methodology/', label: 'Read the time-zone method' },
  },
  {
    slug: 'stellium',
    term: 'Stellium',
    definition: 'A stellium is a concentration of several chart bodies in one sign or house. This site flags three or more of the ten Sun-through-Pluto bodies in one sign, or in one house when houses are available.',
    receipt: 'Stellium threshold: 3+ Sun-through-Pluto bodies',
    related: ['placement', 'zodiac-sign', 'house'],
    link: { href: '/birth-chart/', label: 'Calculate chart clusters' },
  },
];

function compareTerms(a: GlossaryTerm, b: GlossaryTerm): number {
  const left = a.term.toLowerCase();
  const right = b.term.toLowerCase();
  return left < right ? -1 : left > right ? 1 : 0;
}

export const GLOSSARY: readonly GlossaryTerm[] = Object.freeze(
  terms
    .map((entry) => {
      const context = CONTEXT_TERMS.find((candidate) => candidate.slug === entry.slug);
      return context ? { ...entry, ...context } : entry;
    })
    .sort(compareTerms),
);

const glossaryByKey = new Map<string, GlossaryTerm>();
for (const entry of GLOSSARY) {
  glossaryByKey.set(normalizeContextTerm(entry.slug), entry);
  glossaryByKey.set(normalizeContextTerm(entry.term), entry);
  for (const alias of entry.aliases ?? []) {
    glossaryByKey.set(normalizeContextTerm(alias), entry);
  }
}

/** Resolve a published slug, canonical term, or supported plain-language alias. */
export function resolveGlossaryTerm(value: string): GlossaryTerm | undefined {
  return glossaryByKey.get(normalizeContextTerm(value));
}

export function glossaryTermHref(value: string): string | undefined {
  const entry = resolveGlossaryTerm(value);
  return entry ? `/learn/glossary/#${entry.slug}` : undefined;
}
