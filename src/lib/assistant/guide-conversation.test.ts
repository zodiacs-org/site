import { describe, expect, it } from 'vitest';
import {
  GUIDE_PAGE_STARTERS,
  followUpsFor,
  pageStarters,
  skyGreeting,
  starterTopic,
  waitLinks,
} from './guide-conversation';

const LOCALES = ['en', 'es', 'pt', 'fr', 'it'] as const;
const DASHES = /[–—]/u;

const SKY = [
  { body: 'Sun', lon: 223, retrograde: false },
  { body: 'Moon', lon: 40, retrograde: false },
  { body: 'Mercury', lon: 230, retrograde: true },
  { body: 'Saturn', lon: 355, retrograde: true },
  { body: 'Mars', lon: 260, retrograde: false },
];

describe('Guide conversation copy', () => {
  it('offers three starters for every page group in every locale, with no dashes', () => {
    for (const locale of LOCALES) {
      for (const [topic, starters] of Object.entries(GUIDE_PAGE_STARTERS[locale])) {
        expect(starters, `${locale} ${topic}`).toHaveLength(3);
        for (const starter of starters) {
          expect(starter.trim(), `${locale} ${topic}`).toBe(starter);
          expect(starter, `${locale} ${topic}`).not.toMatch(DASHES);
        }
      }
    }
  });

  it('picks starters by the page group Guide already recognises', () => {
    expect(starterTopic('transits')).toBe('transits');
    expect(starterTopic('account')).toBe('default');
    expect(starterTopic(null)).toBe('default');
    expect(pageStarters('en', 'moon-sign')[0]).toBe('What does a Moon sign describe?');
  });

  it('greets with the Moon, the Sun and the planets retrograde right now', () => {
    expect(skyGreeting('en', SKY)).toBe(
      'The Moon is in Taurus today and the Sun is in Scorpio. Retrograde now: Mercury and Saturn. What would you like to know?',
    );
    expect(skyGreeting('en', SKY.map((body) => ({ ...body, retrograde: false }))))
      .toBe('The Moon is in Taurus today and the Sun is in Scorpio. What would you like to know?');
    for (const locale of LOCALES) {
      const line = skyGreeting(locale, SKY);
      expect(line, locale).toBeTruthy();
      expect(line, locale).not.toMatch(DASHES);
    }
    expect(skyGreeting('en', [{ body: 'Sun', lon: 1, retrograde: false }])).toBeNull();
  });

  it('asks when a retrograde ends only after an answer about retrogrades', () => {
    expect(followUpsFor('en', 'Mercury is retrograde until the 29th.')).toContain('When does it end?');
    expect(followUpsFor('en', 'The Moon describes your feelings.')).not.toContain('When does it end?');
    for (const locale of LOCALES) {
      const followUps = followUpsFor(locale, 'text');
      expect(followUps, locale).toHaveLength(3);
      for (const followUp of followUps) expect(followUp, locale).not.toMatch(DASHES);
    }
  });

  it('sends people to pages that exist in their own language while Guide is down', () => {
    expect(waitLinks('en')).toEqual({ daily: '/horoscopes/', chart: '/birth-chart/', privacy: '/privacy/' });
    expect(waitLinks('fr').daily).toBe('/fr/transits/');
    expect(waitLinks('es').daily).toBe('/es/horoscopes/');
  });
});
