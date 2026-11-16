import { describe, expect, it } from 'vitest';
import { DRAFT_BANNED, DRAFT_NOTE, REVIEW_CHECKLIST, X_POST_LIMIT, buildTrendingReport, compactKey, draftPost, matchTrends, type DraftScore, type ReportMatch } from './trending';
import { YEAR_PEOPLE } from './people';
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
    expect(draft).toContain('Reading confidence 55%. ' + DRAFT_NOTE);
    expect(draft).toContain("Jupiter trine Jensen's Sun");
    expect(draft.length - url.length + 23).toBeLessThanOrEqual(X_POST_LIMIT);
    expect(draft).not.toMatch(DRAFT_BANNED);
  });
  it('gives the score’s birth-day range as the figure’s page does, when it is wide enough to show', () => {
    expect(draftPost(person, score({ scoreRange: { low: 5.9, high: 6.8 } }), url)).toContain('6.4/10 (between 5.9 and 6.8 without a birth time), a supportive year.');
    expect(draftPost(person, score({ scoreRange: { low: 6.3, high: 6.4 } }), url)).toContain('6.4/10, a supportive year.');
  });
  it('withholds a draft that would carry a trading call or a diagnosis, and gives none without a score', () => {
    expect(draftPost(person, score({ label: 'A year to buy' }), url)).toBeNull();
    expect(draftPost(person, score({ status: 'not-in-directory', score: null }), url)).toBeNull();
    expect(draftPost(person, score({ confidenceLabel: null }), url)).toBeNull();
    for (const label of ['A good time for surgery', 'A year to start treatment', 'Recovery from illness', 'A cure arrives']) {
      expect(draftPost(person, score({ label }), url), label).toBeNull();
    }
  });
  it('allows money and wellbeing themes read the traditional way', () => {
    expect('a strong year for earnings; take rest seriously; a good window to sign contracts').not.toMatch(DRAFT_BANNED);
  });
  it('names no month for anyone, whatever their category', () => {
    for (const category of ['ceo', 'athlete', 'entertainer', 'founder', 'investor'] as const) {
      const figure = YEAR_PEOPLE.find((candidate) => candidate.category === category);
      expect(figure, category).toBeDefined();
      const draft = draftPost(figure!, score(), url)!;
      expect(draft, category).not.toBeNull();
      expect(draft, category).not.toMatch(/Strongest month|Most pressure|Hardest month|March 2027|October 2026/u);
    }
  });
  it('ends every draft with the fixed note, and drops the main transit, never the note, to fit', () => {
    expect(DRAFT_NOTE).not.toMatch(DRAFT_BANNED);
    const short = draftPost(person, score(), url)!;
    expect(short).toContain('Main transit:');
    expect(short.split('\n')[0].endsWith(DRAFT_NOTE)).toBe(true);
    const long = draftPost(person, score({ scoreRange: { low: 5.1, high: 7.6 }, label: 'A supportive year with steady momentum' }), url)!;
    expect(long).not.toBeNull();
    expect(long).not.toContain('Main transit:');
    expect(long).toContain('Reading confidence 55%. ' + DRAFT_NOTE);
    expect(long.length - url.length + 23).toBeLessThanOrEqual(X_POST_LIMIT);
    // Too long even without the transit: no draft, rather than one without its note.
    expect(draftPost(person, score({ label: 'A year '.repeat(30).trim() }), url)).toBeNull();
  });
});

describe('the report', () => {
  const match: ReportMatch = { trend: '#JensenHuang', volume: 5000, slug: 'jensen-huang', name: 'Jensen Huang', score: 6.4, label: 'A supportive year', url: 'https://zodiacs.org/year/jensen-huang/', draft: 'draft text' };
  const base = { date: '2026-11-16', source: 'names given to the run', namesRead: 2, matches: [match], unmatched: [{ name: 'Nobody Real', volume: null }] };
  it('prints the review checklist under every match, and marks each one for review in the JSON', () => {
    const { markdown, json } = buildTrendingReport({ ...base, listUnmatched: false });
    for (const line of REVIEW_CHECKLIST) expect(markdown).toContain(`> ${line}`);
    expect(markdown).not.toMatch(/[\u2013\u2014]/u);
    const parsed = JSON.parse(json);
    expect(parsed.matches[0]).toMatchObject({ reviewRequired: true, matchedTrend: '#JensenHuang' });
    expect(parsed.posted).toBe(false);
  });
  it('leaves the unmatched names out unless the run asks for them', () => {
    const quiet = buildTrendingReport({ ...base, listUnmatched: false });
    expect(quiet.markdown).not.toContain('Nobody Real');
    expect(quiet.markdown).not.toContain('Not in the directory');
    expect(quiet.json).not.toContain('Nobody Real');
    expect(JSON.parse(quiet.json)).not.toHaveProperty('unmatched');
    const listed = buildTrendingReport({ ...base, listUnmatched: true });
    expect(listed.markdown).toContain('- Nobody Real');
    expect(JSON.parse(listed.json).unmatched).toEqual([{ name: 'Nobody Real', volume: null }]);
  });
});
