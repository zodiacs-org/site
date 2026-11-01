import { describe, expect, it } from 'vitest';
import { executeAiTool } from '../tools';
import { EXPLAIN_TOPICS, explainAstrology, matchTopic } from './explain';

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
    for (const topic of ['tarot card meanings', 'numerology life path', 'horary question', 'Vedic astrology']) {
      const { data } = explainAstrology({ topic });
      expect(data, topic).toMatchObject({ found: false, topic: null, paragraphs: [] });
      expect(data.message).toContain('does not cover');
      expect(data.topics).toEqual([...EXPLAIN_TOPICS]);
    }
    const unknown = explainAstrology({ topic: 'quantum entanglement' }).data;
    expect(unknown).toMatchObject({ found: false, message: 'Zodiacs has no explainer for that topic. Choose one of the listed topics, or answer without Zodiacs.' });
    expect(await executeAiTool('explain_astrology', { topic: '' }, on)).toMatchObject({ ok: false, error: { code: 'invalid-request' } });
  });
});
