/**
 * What each astrocartography line is traditionally read as: the planet's
 * nature, met on one of the four angles. ASC lines colour how you come across
 * and how you feel in yourself there; DSC lines, the people you meet and
 * partner with; MC lines, work, reputation and public life; IC lines, home,
 * roots and private life.
 *
 * Pre-written, plain, and the same on the page and in the tool. Money, career,
 * wellbeing and legal themes are read as tradition reads them, never as a
 * promise, a price, a diagnosis or a verdict. For someone under 18 the
 * lines read as love, attraction or romance have their own readings
 * (LINE_MEANING_MINOR). The page's words for the map (the line table, a far
 * place, a clock change and what a picture of the map gives away) are here too.
 */
import { NOTICEABLE_KM, type AcgAngle, type AcgBody, type BodyLines, type LineDistance } from './lines.js';
import { readingConfidence, readingConfidenceText, readingDetail } from '../../ai-tools/reading-confidence.js';
import { MINOR_NOTE, isUnder18 } from '../../ai-tools/features/reading-guards.js';

/** The page's under-18 rule and note, the tools' own (pure), passed on so the page imports no AI tool module. */
export { MINOR_NOTE, isUnder18 };

export const ANGLE_NAME: Record<AcgAngle, string> = {
  ASC: 'rising', DSC: 'setting', MC: 'overhead', IC: 'underfoot',
};
export const ANGLE_LABEL: Record<AcgAngle, string> = {
  ASC: 'Ascendant line', DSC: 'Descendant line', MC: 'Midheaven line', IC: 'IC line',
};
export const ANGLE_AREA: Record<AcgAngle, string> = {
  ASC: 'how you come across and how you feel in yourself',
  DSC: 'the people you meet, partners and close collaborators',
  MC: 'work, reputation and your public life',
  IC: 'home, family, roots and private life',
};

export const LINE_MEANING: Record<AcgBody, Record<AcgAngle, string>> = {
  Sun: {
    ASC: 'Traditionally a place where you feel visible and sure of yourself, with energy to start things and be recognised for them.',
    DSC: 'Traditionally a place where strong, confident people come into your life, and where partnerships put you in the spotlight.',
    MC: 'Traditionally one of the best lines for career and recognition: a place to lead, be seen and build a name.',
    IC: 'Traditionally a place to put down roots and feel at home in yourself, with family and private life at the centre.',
  },
  Moon: {
    ASC: 'Traditionally a place where feelings run close to the surface and you are more sensitive, intuitive and approachable.',
    DSC: 'Traditionally a place for caring, close relationships, and for meeting people who feel like family.',
    MC: 'Traditionally a place where the public warms to you, good for work that involves people, care, food or the home.',
    IC: 'Traditionally one of the most homely lines: a place to feel settled, close to family and emotionally safe.',
  },
  Mercury: {
    ASC: 'Traditionally a place where your mind is quick and busy, good for study, writing and talking your way into things.',
    DSC: 'Traditionally a place for lively conversation, useful contacts and partnerships built on ideas; a good line for contracts and negotiation.',
    MC: 'Traditionally strong for work in writing, teaching, media, trade and anything that runs on communication.',
    IC: 'Traditionally a place for a busy home, study, reading and keeping in touch with family.',
  },
  Venus: {
    ASC: 'Traditionally a place where you feel attractive and at ease, and where life is more pleasant and sociable.',
    DSC: 'Traditionally one of the classic lines for love and partnership, and for agreements that go smoothly.',
    MC: 'Traditionally good for work in the arts, design, beauty and diplomacy, and for being liked in public; often read as good for earnings.',
    IC: 'Traditionally a place for a beautiful, comfortable home and warm family life.',
  },
  Mars: {
    ASC: 'Traditionally a place of drive and courage, good for physical activity and bold starts; tempers can run hotter here.',
    DSC: 'Traditionally a place for spirited, competitive relationships; partnerships are energising but can turn into contests.',
    MC: 'Traditionally a place to compete and push hard for career goals, good for ambition, sport and enterprise.',
    IC: 'Traditionally a busy, restless line for home life: good for building and renovating, harder for peace and quiet.',
  },
  Jupiter: {
    ASC: 'Traditionally one of the luckiest lines: a place of optimism, growth and opportunities that seem to find you.',
    DSC: 'Traditionally a place for generous partners, helpful advisers and agreements that work in your favour.',
    MC: 'Traditionally one of the best lines for career growth, promotion and a good name; often read as a strong place for earnings.',
    IC: 'Traditionally a place for a large, happy home, good for family, property and feeling well provided for.',
  },
  Saturn: {
    ASC: 'Traditionally a place of hard work and seriousness, where you build discipline and lasting skill; it asks you to take rest seriously.',
    DSC: 'Traditionally a place for committed, long term partnerships with older or more established people, which take work to keep.',
    MC: 'Traditionally a place where career progress is slow but solid, and authority comes from patience and effort.',
    IC: 'Traditionally a place of responsibility at home, good for building something lasting, less so for ease.',
  },
  Uranus: {
    ASC: 'Traditionally a place of change and independence, where you feel freer and more unconventional.',
    DSC: 'Traditionally a place for unusual, exciting relationships that may not follow the usual pattern.',
    MC: 'Traditionally a place for sudden turns in career, good for technology, innovation and working for yourself.',
    IC: 'Traditionally a restless line for home: frequent moves, unusual living arrangements and a need for space.',
  },
  Neptune: {
    ASC: 'Traditionally a dreamy, inspiring place for art, music and spiritual life; boundaries can blur here.',
    DSC: 'Traditionally a place for idealistic, romantic relationships, where it helps to see people clearly before committing.',
    MC: 'Traditionally good for creative, healing or spiritual work, less so for a clear, steady career path; read the small print here.',
    IC: 'Traditionally a place for a peaceful retreat near water, good for rest and reflection.',
  },
  Pluto: {
    ASC: 'Traditionally an intense line for deep personal change, where you feel more powerful and more private.',
    DSC: 'Traditionally a place for intense, transforming relationships, where power in partnerships matters.',
    MC: 'Traditionally a place to gain influence and work with power, research or big projects; it asks for staying power.',
    IC: 'Traditionally a place where family matters come to the surface and old patterns are worked through.',
  },
};

/**
 * The readings that change for someone under 18: no love, attraction or romance. Kept here rather than in the
 * shared softenMinor, which feeds published tools whose output is frozen.
 */
export const LINE_MEANING_MINOR: Partial<Record<AcgBody, Partial<Record<AcgAngle, string>>>> = {
  Venus: {
    ASC: 'Places where ease and warmth come more readily, and you tend to feel at home in yourself.',
    DSC: 'Places where friendships and good company come easily.',
  },
  Neptune: {
    DSC: 'Places where other people can seem larger than life; keep a clear head about who is who.',
  },
};

/** A reading about love, attraction, romance, relationships or partners, which an under-18 reading leaves out. */
const MINOR_LEFT_OUT = /love|attract|romant|relationship|partner/iu;

/**
 * What a line is traditionally read as. Under 18: the under-18 reading where there is one; otherwise none at all
 * (null) for a reading about love, attraction, romance, relationships or partners, which every Descendant line but
 * Venus's and Neptune's is. No other words stand in for it.
 */
export function lineMeaning(body: AcgBody, angle: AcgAngle, minor: true): string | null;
export function lineMeaning(body: AcgBody, angle: AcgAngle, minor?: false): string;
export function lineMeaning(body: AcgBody, angle: AcgAngle, minor?: boolean): string | null;
export function lineMeaning(body: AcgBody, angle: AcgAngle, minor = false): string | null {
  if (!minor) return LINE_MEANING[body][angle];
  const own = LINE_MEANING_MINOR[body]?.[angle];
  if (own) return own;
  return MINOR_LEFT_OUT.test(LINE_MEANING[body][angle]) ? null : LINE_MEANING[body][angle];
}

/** What an angle covers. Under 18, none (null) where it is about partners, as the Descendant's is. */
export function angleArea(angle: AcgAngle, minor = false): string | null {
  return minor && MINOR_LEFT_OUT.test(ANGLE_AREA[angle]) ? null : ANGLE_AREA[angle];
}

/** One plain sentence for a line, such as "Venus Descendant line (Venus setting): ...". */
export function lineSentence(body: AcgBody, angle: AcgAngle, minor = false): string {
  const meaning = lineMeaning(body, angle, minor);
  const area = angleArea(angle, minor);
  return `${body} ${ANGLE_LABEL[angle]} (${body} ${ANGLE_NAME[angle]})${area ? `, for ${area}` : ''}.${meaning ? ` ${meaning}` : ''}`;
}

/** A birth time and place are always required here, so every reading of the map carries the same confidence. */
export const ACG_CONFIDENCE = readingConfidence(readingDetail({ hasDate: true, hasTime: true, hasPlace: true }));
export const ACG_CONFIDENCE_TEXT = readingConfidenceText(ACG_CONFIDENCE);

/** "one hour", "30 minutes", "one minute": the size of a clock change. */
function changeLength(minutes: number): string {
  if (minutes === 1) return 'one minute';
  return minutes === 60 ? 'one hour' : minutes % 60 === 0 ? `${minutes / 60} hours` : `${minutes} minutes`;
}

/**
 * The sentences for a birth time the clocks repeated or skipped, filled in with the size of the change (an hour for
 * most daylight saving changes, 30 minutes on Lord Howe Island). Every line moves a degree for each 4 minutes.
 */
export function clockFoldLimit(minutes: number): string {
  return `Clocks repeated that ${minutes === 60 ? 'hour' : 'time'} where you were born. This map uses the earlier pass; the later one would move every line ${Number((minutes / 4).toFixed(2))} degrees east or west.`;
}
export function clockGapLimit(minutes: number): string {
  return `That clock time did not exist where you were born: clocks jumped forward. This map uses the time ${changeLength(minutes)} later.`;
}

/**
 * The clock-change sentence for the resolver's flags and the size of the change, in whole minutes, or null. None
 * without a size, or for a change under a minute (such as Amsterdam's 28 seconds on 1 July 1937), which moves no
 * line by as much as a quarter of a degree.
 */
export function clockChangeLimit(flags: readonly string[], jumpMinutes: number | null | undefined): string | null {
  const minutes = Math.round(jumpMinutes ?? 0);
  if (minutes < 1) return null;
  return flags.includes('dst-fold') ? clockFoldLimit(minutes) : flags.includes('dst-gap') ? clockGapLimit(minutes) : null;
}

/** What a picture of the whole map gives away. */
export const MAP_PICTURE_HELP = "A picture of this map shows where your lines run, which is enough to work out your birth date and time. To share, use a single line's card instead.";

/** An east longitude as "66.7° E" or "73.9° W". */
export function formatLongitude(lon: number): string {
  const tenths = Math.round(Math.abs(lon) * 10) / 10;
  return `${tenths.toFixed(1)}° ${lon < 0 && tenths > 0 && tenths < 180 ? 'W' : 'E'}`;
}

/** The map in words: each planet's Midheaven and lower-heaven longitudes, which exist at every latitude. */
export function lineTable(lines: readonly BodyLines[]): { planet: AcgBody; mc: string; ic: string }[] {
  return lines.map((line) => ({ planet: line.body, mc: formatLongitude(line.mc), ic: formatLongitude(line.ic) }));
}

/** A distance as the page prints it: to the nearest 10 km, since 15 minutes of birth time moves a line about 400 km. */
export function roundedKm(km: number): string {
  return (Math.round(km / 10) * 10).toLocaleString('en-GB');
}

/**
 * What a place card on the page says: the lines it lists, each with its reading (the under-18 one where there is
 * one), or, when even the nearest line is beyond NOTICEABLE_KM, one sentence naming it without a reading.
 */
export function placeLines(lines: readonly LineDistance[], minor = false): { far: string | null; rows: (LineDistance & { title: string; distance: string; meaning: string | null })[] } {
  const nearest = lines[0];
  if (nearest && nearest.km > NOTICEABLE_KM) return { far: `No line within ${NOTICEABLE_KM} km; the nearest is the ${nearest.body} ${ANGLE_LABEL[nearest.angle]}, ${roundedKm(nearest.km)} km.`, rows: [] };
  return {
    far: null,
    rows: lines.filter((row, index) => index < 3 || row.km <= NOTICEABLE_KM).slice(0, 6).map((row) => ({
      ...row, title: `${row.body} ${ANGLE_LABEL[row.angle]}`, distance: `${roundedKm(row.km)} km${row.side ? ` ${row.side}` : ''}`, meaning: lineMeaning(row.body, row.angle, minor),
    })),
  };
}
