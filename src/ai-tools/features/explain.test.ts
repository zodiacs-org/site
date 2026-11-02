import { describe, expect, it } from 'vitest';
import { executeAiTool } from '../tools';
import { EXPLAIN_TOPICS, explainAstrology, matchPlacement, matchTopic } from './explain';

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
});
