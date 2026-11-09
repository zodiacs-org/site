/**
 * What each astrocartography line is traditionally read as: the planet's
 * nature, met on one of the four angles. ASC lines colour how you come across
 * and how you feel in yourself there; DSC lines, the people you meet and
 * partner with; MC lines, work, reputation and public life; IC lines, home,
 * roots and private life.
 *
 * Pre-written, plain, and the same on the page and in the tool. Money, career,
 * wellbeing and legal themes are read as tradition reads them, never as a
 * promise, a price, a diagnosis or a verdict.
 */
import type { AcgAngle, AcgBody } from './lines';

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

/** One plain sentence for a line, such as "Venus Descendant line (Venus setting): ...". */
export function lineSentence(body: AcgBody, angle: AcgAngle): string {
  return `${body} ${ANGLE_LABEL[angle]} (${body} ${ANGLE_NAME[angle]}), for ${ANGLE_AREA[angle]}. ${LINE_MEANING[body][angle]}`;
}
