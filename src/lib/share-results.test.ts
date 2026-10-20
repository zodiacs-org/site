import { describe, expect, it } from 'vitest';
import { COMPAT_VERDICTS, compatVerdictKey } from './compat-score';
import { DATE_VERDICTS, dateVerdictKey } from './occasions/date-score';
import {
  compatibilityQuery,
  compatibilityShareUrl,
  occasionQuery,
  occasionShareUrl,
  parseCompatibilityShare,
  parseOccasionShare,
  shareName,
  shareNames,
  sharePlace,
} from './share-results';

const COMPAT = 'a=Ana&as=leo&b=Luis&bs=libra&score=78&attraction=82&communication=71&stability=80&v=strong';
const OCCASION = 'o=wedding&d=2027-06-12&n=Ana+%26+Luis&p=Florence&sun=gemini&moon=libra&score=84&v=excellent';
const params = (query: string) => new URLSearchParams(query);

describe('verdict keys', () => {
  it('name every verdict the scores give', () => {
    for (let score = 0; score <= 100; score += 1) {
      expect(Object.values(COMPAT_VERDICTS)).toContain(COMPAT_VERDICTS[compatVerdictKey(score)]);
      expect(Object.values(DATE_VERDICTS)).toContain(DATE_VERDICTS[dateVerdictKey(score)]);
    }
    expect(compatVerdictKey(85)).toBe('exceptional');
    expect(compatVerdictKey(44)).toBe('challenging');
    expect(dateVerdictKey(82)).toBe('excellent');
    expect(dateVerdictKey(54)).toBe('challenging');
  });
});

describe('compatibility share links', () => {
  it('carry first names, Sun signs, the scores and a verdict key, in a fixed order', () => {
    const url = compatibilityShareUrl('https://zodiacs.org', {
      a: { name: 'Ana', sun: 'leo' },
      b: { name: 'Luis', sun: 'libra' },
      score: { overall: 78, areas: { attraction: 82, communication: 71, stability: 80 } },
    });
    expect(url).toBe(`https://zodiacs.org/share/compatibility/?${COMPAT}`);
  });

  it('leave out a name or sign the card cannot show', () => {
    const query = compatibilityQuery(parseCompatibilityShare(params(COMPAT))!);
    expect(query).toBe(COMPAT);
    const url = compatibilityShareUrl('https://zodiacs.org', {
      a: { name: '<b>Ana</b>', sun: null },
      b: { name: '花子', sun: 'nope' },
      score: { overall: 40, areas: { attraction: 50, communication: 40, stability: 30 } },
    })!;
    expect(new URL(url).search).toBe('?score=40&attraction=50&communication=40&stability=30&v=challenging');
  });

  it('read back exactly what they carry', () => {
    expect(parseCompatibilityShare(params(`${COMPAT}&ref=chatgpt`))).toEqual({
      a: 'Ana', b: 'Luis', aSun: 'leo', bSun: 'libra', score: 78, attraction: 82, communication: 71, stability: 80, verdict: 'strong', ref: 'chatgpt',
    });
    expect(parseCompatibilityShare(params('score=0&attraction=100&communication=5&stability=99&v=mixed'))).toMatchObject({ a: null, b: null, aSun: null, bSun: null });
  });

  it.each([
    ['an unknown key', `${COMPAT}&date=1990-01-01`],
    ['a birth time', `${COMPAT}&time=12:00`],
    ['a repeated key', `${COMPAT}&a=Eve`],
    ['a score over 100', COMPAT.replace('score=78', 'score=101')],
    ['a negative score', COMPAT.replace('score=78', 'score=-1')],
    ['a padded score', COMPAT.replace('score=78', 'score=078')],
    ['a fractional score', COMPAT.replace('score=78', 'score=7.8')],
    ['free-text verdict', COMPAT.replace('v=strong', 'v=Soulmates')],
    ['a missing area', COMPAT.replace('&stability=80', '')],
    ['an unknown sign', COMPAT.replace('as=leo', 'as=ophiuchus')],
    ['markup in a name', COMPAT.replace('a=Ana', 'a=%3Cscript%3E')],
    ['a link in a name', COMPAT.replace('a=Ana', 'a=zodiacs.org%2Fx')],
    ['a web address as a name', COMPAT.replace('a=Ana', 'a=example.com')],
    ['a long name', COMPAT.replace('a=Ana', `a=${'A'.repeat(25)}`)],
    ['an empty name', COMPAT.replace('a=Ana', 'a=')],
    ['a padded name', COMPAT.replace('a=Ana', 'a=+Ana')],
    ['a name in a script the card cannot draw', COMPAT.replace('a=Ana', `a=${encodeURIComponent('Ελένη')}`)],
    ['an unknown ref', `${COMPAT}&ref=newsletter`],
  ])('refuse %s', (_label, query) => {
    expect(parseCompatibilityShare(params(query))).toBeNull();
  });
});

describe('date share links', () => {
  it('carry the occasion, the day, names, a place name, Sun and Moon signs and the rating', () => {
    expect(occasionShareUrl('https://zodiacs.org', {
      occasion: 'wedding', date: '2027-06-12', names: 'Ana & Luis', place: 'Florence', sun: 'gemini', moon: 'libra', score: 84,
    })).toBe(`https://zodiacs.org/share/occasion/?${OCCASION}`);
    expect(occasionQuery(parseOccasionShare(params(OCCASION))!)).toBe(OCCASION);
  });

  it('shorten a long place name to the part before its comma, and drop what the card cannot show', () => {
    expect(sharePlace('Florence, Tuscany, Italy')).toBe('Florence, Tuscany, Italy');
    expect(sharePlace('Llanfairpwllgwyngyll, Isle of Anglesey, Wales, United Kingdom')).toBe('Llanfairpwllgwyngyll');
    expect(sharePlace('東京')).toBeNull();
    expect(shareNames('Ana  &  Luis')).toBe('Ana & Luis');
    expect(shareNames('<Ana>')).toBeNull();
    expect(shareName('Zoë')).toBe('Zoë');
    expect(shareName('Łukasz')).toBe('Łukasz');
    // The preview draws Cyrillic in EB Garamond's Cyrillic subset, so a Russian or Ukrainian name stays in the link.
    expect(shareName('Анна')).toBe('Анна');
    expect(shareName('Анна-Мария')).toBe('Анна-Мария');
    expect(shareName('Ґанна')).toBe('Ґанна');
    expect(shareNames('Анна & Иван')).toBe('Анна & Иван');
    expect(sharePlace('Москва')).toBe('Москва');
    expect(shareName('Ελένη')).toBeNull();
    expect(shareName('J. R.')).toBe('J. R.');
    expect(sharePlace('St. Louis')).toBe('St. Louis');
    expect(occasionShareUrl('https://zodiacs.org', {
      occasion: 'wedding', date: '2027-06-12', names: '{x}', place: null, sun: 'gemini', moon: null, score: 84,
    })).toBe('https://zodiacs.org/share/occasion/?o=wedding&d=2027-06-12&sun=gemini&score=84&v=excellent');
  });

  it('read back exactly what they carry', () => {
    expect(parseOccasionShare(params(`${OCCASION}&ref=assistant`))).toEqual({
      occasion: 'wedding', date: '2027-06-12', names: 'Ana & Luis', place: 'Florence', sun: 'gemini', moon: 'libra', score: 84, verdict: 'excellent', ref: 'assistant',
    });
  });

  it.each([
    ['an unknown occasion', OCCASION.replace('o=wedding', 'o=funeral')],
    ['a time', `${OCCASION}&t=19:00`],
    ['coordinates', `${OCCASION}&lat=43.77`],
    ['a time zone', `${OCCASION}&tz=Europe%2FRome`],
    ['an impossible date', OCCASION.replace('2027-06-12', '2027-02-30')],
    ['a date out of range', OCCASION.replace('2027-06-12', '2300-01-01')],
    ['a date with a time', OCCASION.replace('2027-06-12', '2027-06-12T19%3A00')],
    ['a free-text verdict', OCCASION.replace('v=excellent', 'v=perfect')],
    ['a missing score', OCCASION.replace('&score=84', '')],
    ['markup in a place', OCCASION.replace('p=Florence', 'p=%3Cimg%3E')],
    ['a web address as a place', OCCASION.replace('p=Florence', 'p=example.com')],
    ['a long place', OCCASION.replace('p=Florence', `p=${'F'.repeat(49)}`)],
    ['long names', OCCASION.replace('n=Ana+%26+Luis', `n=${'A'.repeat(41)}`)],
    ['a repeated key', `${OCCASION}&o=wedding`],
  ])('refuse %s', (_label, query) => {
    expect(parseOccasionShare(params(query))).toBeNull();
  });
});
