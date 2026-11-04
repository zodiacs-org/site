import { describe, expect, it } from 'vitest';
import { executeAiTool } from '../tools';
import { bigThree } from '../../lib/interpretations';
import { EXPLAIN_TOPICS, explainAstrology, matchAngleSign, matchNoSuchHouse, matchPlacement, matchRising, matchTopic } from './explain';

const on = { occasions: true, coverage: true };

describe('explain_astrology', () => {
  it('matches the way people ask', () => {
    const cases: Record<string, string> = {
      'What is Mercury retrograde?': 'mercury-retrograde',
      'Is Mercury in retrograde': 'mercury-retrograde',
      'what does the 7th house mean': 'seventh-house',
      'Leo traits': 'leo',
      'my rising sign': 'rising-sign',
      'Ascendant': 'rising-sign',
      'saturn return': 'saturn-return',
      'Moon phases': 'moon-phases',
      'full moon': 'moon-phases',
      'born on the cusp': 'cusps',
      'fire signs': 'elements',
      'mutable': 'modalities',
      'synastry basics': 'synastry',
      'Chinese zodiac': 'chinese-zodiac',
      'square aspect': 'square',
      'the planets': 'planets',
      'Venus': 'venus',
      'big 3': 'big-three',
    };
    for (const [query, key] of Object.entries(cases)) expect(matchTopic(query)?.key, query).toBe(key);
  });

  it('explains every topic in the site’s own words with links to its pages', () => {
    for (const topic of EXPLAIN_TOPICS) {
      const { data, links } = explainAstrology({ topic });
      expect(data.found, topic).toBe(true);
      expect(data.topic).toBe(topic);
      expect(data.paragraphs.length, topic).toBeGreaterThan(0);
      expect(data.pages.length, topic).toBeGreaterThan(0);
      expect(links.every((link) => link.url.startsWith('https://zodiacs.org/'))).toBe(true);
      expect(JSON.stringify(data), topic).not.toMatch(/[–—]/u);
      for (const related of data.related) expect(EXPLAIN_TOPICS).toContain(related);
    }
  });

  it('explains what a Saturn return is, and when it falls', () => {
    const { data } = explainAstrology({ topic: 'saturn return' });
    expect(data.paragraphs[0]).toContain('29.5 years');
    expect(data.paragraphs[0]).toContain('around age 29');
    expect(data.paragraphs[0].toLowerCase()).toContain('responsibility');
    expect(data.paragraphs.join(' ')).toContain('get_life_milestones');
  });

  it('points a sign to its guide, its rising-sign page and its horoscope', () => {
    const { data } = explainAstrology({ topic: 'leo' });
    expect(data.pages.map((page) => page.url)).toEqual(['https://zodiacs.org/leo/', 'https://zodiacs.org/rising-sign/leo/', 'https://zodiacs.org/horoscopes/leo/']);
    expect(data.paragraphs[1]).toContain('23 July to 22 August');
    expect(data.paragraphs[1]).toContain('fixed fire sign ruled by Sun');
  });

  it('declines systems it does not cover and topics it has no explainer for', async () => {
    for (const topic of ['tarot card meanings', 'numerology life path', 'horary question', 'Vedic astrology', 'sidereal astrology', 'What is sidereal astrology?']) {
      const { data } = explainAstrology({ topic });
      expect(data, topic).toMatchObject({ found: false, topic: null, paragraphs: [] });
      expect(data.message).toContain('does not cover');
      expect(data.topics).toEqual([...EXPLAIN_TOPICS]);
    }
    const unknown = explainAstrology({ topic: 'quantum entanglement' }).data;
    expect(unknown).toMatchObject({ found: false, message: 'Zodiacs has no explainer for that topic. Choose one of the listed topics, or answer without Zodiacs.' });
    expect(await executeAiTool('explain_astrology', { topic: '' }, on)).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
  });

  it('answers a planet in a sign with the planet, the sign and the placement page', () => {
    for (const query of ['Moon in Scorpio', 'what does my moon in scorpio mean', 'Scorpio Moon']) {
      expect(matchTopic(query)?.key, query).toBe('moon');
      expect(matchPlacement(query), query).toMatchObject({ planet: 'Moon', sign: { slug: 'scorpio' }, house: null });
    }
    const { data } = explainAstrology({ topic: 'Moon in Scorpio' });
    expect(data).toMatchObject({ found: true, topic: 'moon', title: 'Moon in Scorpio' });
    expect(data.pages[0]).toEqual({ title: 'Moon in Scorpio', url: 'https://zodiacs.org/learn/placements/moon-in-scorpio/' });
    expect(data.pages.map((page) => page.url)).toContain('https://zodiacs.org/scorpio/');
    expect(data.pages.map((page) => page.url)).toContain('https://zodiacs.org/learn/planets/moon/');
    expect(data.paragraphs.join(' ')).toContain('In Scorpio');
    expect(data.related.slice(0, 2)).toEqual(['scorpio', 'birth-chart']);
    expect(JSON.stringify(data)).not.toMatch(/[–—]/u);
  });

  it('answers a planet in a house with the planet and the house', () => {
    for (const [query, house] of [['Mars in the 10th house', 10], ['mars in tenth house', 10], ['Venus in house 7', 7], ['what is sun in the 1st house', 1]] as const) {
      const placement = matchPlacement(query);
      expect(placement?.house, query).toBe(house);
      expect(matchTopic(query)?.key, query).toBe(placement!.planet.toLowerCase());
    }
    const { data } = explainAstrology({ topic: 'Mars in the 10th house' });
    expect(data).toMatchObject({ found: true, topic: 'mars', title: 'Mars in the Tenth house' });
    expect(data.pages[0].url).toBe('https://zodiacs.org/learn/houses/tenth-house/');
    expect(data.related).toContain('tenth-house');
    expect(JSON.stringify(data)).not.toMatch(/[–—]/u);
    expect(matchPlacement('Mars in the 13th house')).toBeNull();
    // A degree or decan is not a house.
    for (const query of ['Jupiter in 12° Leo', 'Jupiter in 12 degrees Leo', 'Moon in the first decan of Scorpio', 'Venus in the 3rd degree of Taurus']) {
      expect(matchPlacement(query)?.house ?? null, query).toBeNull();
    }
    for (const query of ['Moon in the 13th degree of Scorpio', 'Mars in the 13th decan']) {
      expect(matchNoSuchHouse(query), query).toBeNull();
    }
    expect(matchPlacement('Is Mercury in retrograde')).toBeNull();
  });

  it('needs everyday words such as fall, fire, earth and chart to be the whole question', () => {
    expect(matchTopic('fall')?.key).toBe('rulership');
    expect(matchTopic('fire')?.key).toBe('elements');
    expect(matchTopic('earth')?.key).toBe('elements');
    expect(matchTopic('chart')?.key).toBe('birth-chart');
    expect(matchTopic('earth signs')?.key).toBe('elements');
    expect(matchTopic('an earth sign')?.key).toBe('elements');
    expect(matchTopic('Venus in fall')?.key).toBe('rulership');
    expect(matchTopic('read my birth chart')?.key).toBe('birth-chart');
    for (const query of ['falling in love in the fall', 'is the earth flat', 'fire safety', 'flow chart', 'water bill']) {
      expect(matchTopic(query), query).toBeNull();
      expect(explainAstrology({ topic: query }).data.found, query).toBe(false);
    }
  });

  it('explains the Midheaven by its name, MC and medium coeli', () => {
    for (const query of ['midheaven', 'Midheaven', 'MC', 'mc', 'medium coeli', 'What is my midheaven?', 'mid heaven']) expect(matchTopic(query)?.key, query).toBe('midheaven');
    const { data } = explainAstrology({ topic: 'mc' });
    expect(data).toMatchObject({ found: true, topic: 'midheaven', title: 'The Midheaven' });
    expect(data.paragraphs[0]).toContain('The midheaven is the ecliptic point');
    expect(data.pages.map((page) => page.url)).toContain('https://zodiacs.org/learn/houses/tenth-house/');
    expect(data.terms.map((entry) => entry.term)).toContain('IC (Imum Coeli)');
  });

  it('answers a sign rising with that rising sign’s own reading and page', () => {
    for (const [query, slug] of [['leo rising', 'leo'], ['Leo Rising', 'leo'], ['ascendant in virgo', 'virgo'], ['virgo ascendant', 'virgo'], ['my rising sign is Leo', 'leo'], ['what does scorpio rising mean', 'scorpio']] as const) {
      expect(matchRising(query)?.slug, query).toBe(slug);
      expect(matchTopic(query)?.key, query).toBe('rising-sign');
    }
    expect(matchRising('my rising sign')).toBeNull();
    expect(matchRising('Leo traits')).toBeNull();
    const { data } = explainAstrology({ topic: 'leo rising' });
    expect(data).toMatchObject({ found: true, topic: 'rising-sign', title: 'Leo rising' });
    expect(data.paragraphs).toContain(bigThree('rising', 'leo'));
    expect(data.paragraphs).not.toContain(bigThree('rising', 'virgo'));
    expect(data.pages[0]).toEqual({ title: 'Leo rising', url: 'https://zodiacs.org/rising-sign/leo/' });
    expect(explainAstrology({ topic: 'ascendant in virgo' }).data.paragraphs).toContain(bigThree('rising', 'virgo'));
    expect(JSON.stringify(data)).not.toMatch(/[–—]/u);
  });

  it('reads a house without the word house, as an ordinal, a word or a number', () => {
    for (const [query, house] of [['jupiter in 12th', 12], ['jupiter in the 12th', 12], ['Jupiter in the twelfth', 12], ['venus in 7', 7], ['Saturn in my 2nd', 2], ['12th house Jupiter', 12], ['jupiter 12th house', 12]] as const) {
      expect(matchPlacement(query), query).toMatchObject({ planet: query.toLowerCase().includes('jupiter') ? 'Jupiter' : expect.any(String), house, sign: null });
    }
    const { data } = explainAstrology({ topic: 'jupiter in 12th' });
    expect(data).toMatchObject({ found: true, topic: 'jupiter', title: 'Jupiter in the Twelfth house' });
    expect(data.paragraphs.join(' ')).toContain('twelfth house');
    expect(data.pages[0].url).toBe('https://zodiacs.org/learn/houses/twelfth-house/');
    expect(matchPlacement('Mercury in 2026')).toBeNull();
  });

  it('says plainly that there is no 13th house', () => {
    for (const query of ['Moon in the 13th house', 'moon in 13th', '13th house', 'house 14', 'the thirteenth house', 'Venus in the 0th house']) {
      expect(matchNoSuchHouse(query), query).not.toBeNull();
      expect(matchTopic(query)?.key, query).toBe('houses');
    }
    for (const query of ['12th house', 'Moon in the 1st house', 'jupiter in 12th', 'houses']) expect(matchNoSuchHouse(query), query).toBeNull();
    const { data } = explainAstrology({ topic: 'Moon in the 13th house' });
    expect(data).toMatchObject({ found: true, topic: 'houses' });
    expect(data.paragraphs[0]).toBe('There is no 13th house; houses are numbered 1 to 12. A birth chart in Western astrology has exactly twelve houses, and every planet falls in one of them.');
    expect(data.message).toBe('Western astrology has twelve houses, numbered 1 to 12; there is no 13th house. Say so plainly before explaining the twelve.');
    expect(data.title).toBe('The houses');
    expect(JSON.stringify(data)).not.toMatch(/[–—]/u);
  });

  it('writes a bare number as "house 0", never "0 house"', () => {
    for (const query of ['house 0', 'Moon in house 0']) {
      const { data } = explainAstrology({ topic: query });
      expect(data.paragraphs[0], query).toBe('There is no house 0; houses are numbered 1 to 12. A birth chart in Western astrology has exactly twelve houses, and every planet falls in one of them.');
      expect(data.message, query).toContain('there is no house 0.');
      expect(JSON.stringify(data), query).not.toMatch(/\b0 house/u);
    }
    expect(explainAstrology({ topic: 'zeroth house' }).data.paragraphs[0]).toMatch(/^There is no zeroth house; houses are numbered 1 to 12\./u);
  });

  it('answers the Midheaven in a sign as the Midheaven plus the sign, and says Zodiacs has no separate reading for it', () => {
    for (const query of ['midheaven in capricorn', 'MC in Capricorn', 'mc in capricorn', 'Capricorn midheaven', 'my midheaven is in capricorn', 'M.C. in Capricorn']) {
      expect(matchAngleSign(query), query).toMatchObject({ angle: 'midheaven', sign: { slug: 'capricorn' } });
      const { data } = explainAstrology({ topic: query });
      expect(data, query).toMatchObject({ found: true, topic: 'midheaven', title: 'Midheaven in Capricorn' });
      expect(data.paragraphs[0], query).toContain('The midheaven is the ecliptic point');
      expect(data.paragraphs.join(' '), query).toContain('Zodiacs has no separate reading for the Midheaven in Capricorn.');
      expect(data.paragraphs.join(' '), query).toContain('Capricorn is the tenth tropical sign');
      expect(data.pages.map((page) => page.url), query).toContain('https://zodiacs.org/capricorn/');
      expect(JSON.stringify(data), query).not.toMatch(/[–—]/u);
    }
    expect(explainAstrology({ topic: 'midheaven' }).data.title).toBe('The Midheaven');
    expect(matchAngleSign('capricorn')).toBeNull();
    expect(matchAngleSign('Moon in Capricorn')).toBeNull();
  });

  it('explains the IC as the point opposite the Midheaven, without matching "ic" inside other words', () => {
    for (const query of ['IC', 'ic', 'imum coeli', 'What is the IC?', 'the IC in astrology', 'Imum Coeli']) expect(matchTopic(query)?.key, query).toBe('ic');
    const { data } = explainAstrology({ topic: 'IC' });
    expect(data).toMatchObject({ found: true, topic: 'ic', title: 'The IC (Imum Coeli)' });
    const text = data.paragraphs.join(' ');
    expect(text).toContain('opposite the Midheaven, at the base of the chart');
    expect(text).toContain('cusp of the fourth house');
    expect(text).toContain('In whole-sign houses, which Zodiacs uses, it does not always fall in the fourth');
    expect(data.related).toContain('midheaven');
    expect(explainAstrology({ topic: 'IC in Cancer' }).data).toMatchObject({ topic: 'ic', title: 'IC in Cancer' });
    for (const query of ['basic chart', 'picture of my chart', 'ice', 'magic', 'icy moon', 'stoic leo', 'music']) expect(matchTopic(query)?.key ?? null, query).not.toBe('ic');
    expect(matchTopic('Midheaven')?.key).toBe('midheaven');
    expect(matchTopic('mc')?.key).toBe('midheaven');
  });
});
