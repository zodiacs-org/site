import { describe, expect, it } from 'vitest';
import { DRAFT_BANNED, X_POST_LIMIT, compactKey, draftPost, matchTrends, type DraftScore } from './trending';
import { findYearPerson } from './people';

const score = (overrides: Partial<DraftScore> = {}): DraftScore => ({
  status: 'found', score: 6.4, label: 'A supportive year', best: { name: 'March 2027' }, hardest: { name: 'October 2026' },
  drivers: [{ title: 'Jupiter trine your Sun' }], confidenceLabel: 'Reading confidence 55%', ...overrides,
});

describe('matching trending names', () => {
  it('matches names, hashtags and handles to one figure each, and lists the rest for review', () => {
    const report = matchTrends([{ name: '#ElonMusk', volume: 120000 }, { name: 'elon musk' }, { name: '@sama' }, { name: 'Jensen Huang' }, { name: 'Somebody New' }, { name: '#MondayMotivation' }, { name: '2026' }]);
    expect(report.matches.map((match) => match.person.slug)).toEqual(['elon-musk', 'sam-altman', 'jensen-huang']);
    expect(report.matches[0]).toMatchObject({ trend: '#ElonMusk', volume: 120000 });
    expect(report.unmatched.map((row) => row.name)).toEqual(['Somebody New']);
  });
  it('never matches a held-back figure: they go to review', () => {
    expect(matchTrends([{ name: 'Changpeng Zhao' }]).unmatched.map((row) => row.name)).toEqual(['Changpeng Zhao']);
  });
  it('compares names without case, accents, spaces or a leading # or @', () => {
    expect(compactKey('#Beyoncé')).toBe('beyonce');
    expect(compactKey('@KingJames')).toBe('kingjames');
  });
});

describe('draft posts', () => {
  const person = findYearPerson('Jensen Huang')!;
  const url = 'https://zodiacs.org/year/jensen-huang/';
  it('drafts one post under X’s limit, with the link, the confidence label and no dashes', () => {
    const draft = draftPost(person, score(), url)!;
    expect(draft.endsWith(`\n${url}`)).toBe(true);
    expect(draft).toContain('6.4/10');
    expect(draft).toContain('Strongest month: March 2027. Most pressure: October 2026.');
    expect(draft).toContain('Reading confidence 55%');
    expect(draft).toContain("Jupiter trine Jensen's Sun");
    expect(draft.length - url.length + 23).toBeLessThanOrEqual(X_POST_LIMIT);
    expect(draft).not.toMatch(DRAFT_BANNED);
  });
  it('withholds a draft that would carry a trading call or a diagnosis, and gives none without a score', () => {
    expect(draftPost(person, score({ label: 'A year to buy' }), url)).toBeNull();
    expect(draftPost(person, score({ status: 'not-in-directory', score: null }), url)).toBeNull();
  });
  it('allows money and wellbeing themes read the traditional way', () => {
    expect('a strong year for earnings; take rest seriously; a good window to sign contracts').not.toMatch(DRAFT_BANNED);
  });
});
