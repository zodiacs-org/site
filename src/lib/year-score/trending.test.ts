import { describe, expect, it } from 'vitest';
import { DRAFT_BANNED, DRAFT_BANNED_CASED, DRAFT_NOTE, REVIEW_CHECKLIST, X_POST_LIMIT, buildTrendingReport, compactKey, draftPost, draftWithheld, matchTrends, type DraftScore, type ReportMatch } from './trending';
import { YEAR_PEOPLE } from './people';
import { findYearPerson } from './people';
import { SCORE_ASPECTS, SCORE_POINTS, SLOW_PLANETS } from './core';
import { driverTitle } from './reading';
import { scoreTier } from './tier';

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
    expect(draftWithheld(draft)).toBe(false);
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
  it('withholds every class the guard names, not only the phrase that prompted it', () => {
    const banned: Record<string, string[]> = {
      'price, stock or crypto call': ['$100', 'Up to €40 a share', '£5 by spring', '₿1 by summer', '$NVDA', 'Shares up 20%', 'A 30 per cent jump', 'A price surge', 'Ethereum rallies', 'Bitcoin to the moon', 'Dogecoin soars', 'Solana pumps', 'A bull run', 'Markets plunge', 'The stock tanks', 'A 10x year', 'A new all-time high', 'NFT drop', 'Time to invest', 'A trading year'],
      'buy or sell signal': ['A year to buy', 'Buying opportunity', 'Sell now', 'A selloff ahead', 'Go long', 'Take profits', 'Shorting the market'],
      'diagnosis or medical timing': ['Hospital admission in June', 'A good time for surgery', 'A year to start treatment', 'Recovery from illness', 'A cure arrives', 'Injury in the spring', 'A diagnosis by March', 'Back in the clinic', 'A stroke in May', 'Therapy pays off', 'Doctors step in', 'Rehab by autumn', 'A health scare'],
      'death prediction': ['Death in the family', 'Dies this year', 'Passes away', 'A fatal year', 'Killed in action', 'A funeral ahead'],
      'legal win or loss': ['Wins the lawsuit', 'Loses the case', 'Lost the appeal', 'A court victory', 'Sued by rivals', 'The verdict favours them', 'Will win', 'Going to lose', 'Set to win', 'Acquitted by spring', 'Arrested in June', 'Facing trial', 'A legal battle'],
      doom: ['A doomed year', 'Disaster strikes', 'Ruin ahead', 'A crash', 'Collapse by autumn', 'Catastrophic losses', 'Bankruptcy looms', 'A tragic turn', 'The worst year yet', 'Downfall', 'Guaranteed success'],
      'em or en dash': ['A year \u2014 heavy', 'A year \u2013 steady', 'A year \u2015 open', 'A year \u2012 open', 'A year \u2E3A open'],
    };
    for (const [kind, labels] of Object.entries(banned)) {
      for (const label of labels) {
        expect(draftWithheld(label), `${kind}: ${label}`).toBe(true);
        expect(draftPost(person, score({ label }), url), `${kind}: ${label}`).toBeNull();
        // The guard reads the whole draft, so a banned phrase in the transit line is withheld too.
        expect(draftPost(person, score({ drivers: [{ title: label }] }), url), `${kind} in the transit: ${label}`).toBeNull();
      }
    }
  });
  it('withholds the wider classes: share and value moves, written amounts, a short of a ticker, coin tickers, named conditions and procedures, legal outcomes', () => {
    const banned: Record<string, string[]> = {
      'share or value move': ['Nvidia shares double', 'Shares halve', 'Shares jump', 'Shares are falling', 'Shares could triple', 'Shares climb', 'Shares slide', 'Shares to rise', 'Net worth doubles', 'Nvidia doubles', 'Value tripled', 'A halving year', 'A slump ahead', 'A new all-time low'],
      'written amount': ['Nvidia reaches 200 dollars', 'Two hundred dollars', 'Fifty euros a share', 'Ten pesos', '500 rupees', '100 pounds', '1,000 yen', '200k by spring', '5bn', '3 billion', 'Reaches 200', 'Hits 1,000', 'Tops 500', 'Breaks 100', 'Valued at 3', 'Target 250', '40 USD', 'EUR 30', '15 GBP'],
      'short or long a ticker': ['Short NVDA', 'Shorting TSLA', 'SHORT AAPL', 'Long NVDA', 'Short $NVDA', 'NVDA shorts', 'TSLA calls', 'Short selling', 'A short squeeze', 'Short sellers circle', 'A long position'],
      'coin or ticker': ['BNB doubles', 'BNB', 'bnb season', 'AVAX', 'Matic', 'Shiba', 'Tron', 'Litecoin', 'Polkadot', 'Chainlink', 'Uniswap', 'Monero', 'SOL', 'DOT', 'LINK', 'ADA', 'TON', 'PEPE', 'An altcoin year', 'Memecoin season', 'A crypto wallet'],
      'named condition or procedure': ['Dialysis in June', 'Pneumonia in June', 'Bronchitis', 'Arthritis flares', 'Appendicitis', 'An appendectomy', 'A colonoscopy', 'A rhinoplasty', 'Flu season', 'Influenza', 'Covid again', 'Sepsis', 'A torn ACL', 'A broken leg', 'Hamstring trouble', 'A fracture', 'A concussion', 'Blood clots', 'Heart failure', 'Kidney trouble', 'Lung trouble', 'A biopsy', 'An MRI', 'Test results in June', 'Leukemia', 'Lymphoma', 'Asthma', 'Migraines', 'Insomnia', 'Bipolar', 'Addiction', 'Epilepsy', 'Menopause', 'IVF in June', 'A caesarean', 'Anaesthesia', 'On a ventilator', 'Quarantine', 'A pandemic year', 'Back on the ward', 'Bed rest', 'Nurses step in', 'Psychosis', 'Thrombosis', 'Cirrhosis'],
      'legal outcome': ['The appeal is dismissed', 'Appeal dismissed', 'The appeal fails', 'Appeal granted', 'The case is thrown out', 'Charges dropped', 'Charges are dropped', 'Conviction overturned', 'The ruling is upheld', 'The motion is denied', 'Petition rejected', 'The ban is lifted', 'The claim succeeds', 'A judge rules', 'Lawyers step in', 'An injunction', 'Found liable', 'Found not guilty', 'Cleared of wrongdoing', 'Pardoned by spring', 'Exonerated', 'Settles the lawsuit', 'Settlement of the claim', 'Ruled against them', 'Ruled in their favour', 'Testifies in June', 'Pleads not guilty', 'A plea deal', 'Extradited', 'Charged with fraud', 'The tribunal decides'],
    };
    for (const [kind, labels] of Object.entries(banned)) {
      for (const label of labels) {
        expect(draftWithheld(label), `${kind}: ${label}`).toBe(true);
        expect(draftPost(person, score({ label }), url), `${kind}: ${label}`).toBeNull();
        expect(draftPost(person, score({ drivers: [{ title: label }] }), url), `${kind} in the transit: ${label}`).toBeNull();
      }
    }
  });
  it('reads tickers in capitals only, so the ordinary words they spell still pass', () => {
    for (const text of ['a short year', 'a short window to sign agreements', 'short of time', 'a long year', 'the long view', 'a sole focus', 'connect the dots', 'a link to the past', 'near the end of the year', 'the tone of the year', 'a stellar year', 'a year of metamorphosis', 'a dichotomy', 'horoscopy', 'patient work', 'a share of the spotlight', 'shares a birthday', 'shares the credit', 'a year of broad appeal', 'ruled by Venus', 'the ruling planet', 'a fair judgment', 'a strong case for patience', 'a balanced year in the case of work', 'the claims of the year', 'a year to settle in', 'a fertile year', 'Reaching out', 'a top year', 'a year to clear the decks', 'worth the wait', 'a double life', 'twice the work']) {
      expect(draftWithheld(text), text).toBe(false);
    }
    for (const figure of YEAR_PEOPLE) {
      for (const name of [figure.name, ...figure.aliases]) expect(name, name).not.toMatch(DRAFT_BANNED_CASED);
    }
  });
  it('allows money and wellbeing themes read the traditional way', () => {
    expect(draftWithheld('a strong year for earnings; take rest seriously; a good window to sign contracts')).toBe(false);
    for (const text of [
      'Reading confidence 55%', 'Reading confidence 90%', 'A good year to build on what already works, in your work and at home.',
      'Tradition reads a year like this as strong for career growth, and a good window to start things and sign agreements.',
      'a year for patience and follow through: steady work, keeping things simple and taking rest seriously',
      'keep commitments clear, look after your energy and let patient work do the building', 'a year of deadlines and new skills',
      'a stroke of luck', 'traditional money themes', 'a year to coincide plans', 'Oprah Winfrey', 'A wide open year', 'A year of heavy pressure',
    ]) expect(draftWithheld(text), text).toBe(false);
  });
  it('drafts for every figure in the directory, at every tier and with every main transit', () => {
    const labels = [9, 7, 5, 3, 1].map((value) => scoreTier(value).label);
    const titles = SLOW_PLANETS.flatMap((planet) => SCORE_ASPECTS.flatMap((aspect) => SCORE_POINTS.map((point) => driverTitle({ planet, aspect, point }))));
    expect(new Set(labels).size).toBe(5);
    for (const figure of YEAR_PEOPLE) {
      const page = `https://zodiacs.org/year/${figure.slug}/`;
      for (const label of labels) {
        for (const title of titles) {
          const draft = draftPost(figure, score({ label, drivers: [{ title }], confidenceLabel: 'Reading confidence 90%' }), page);
          if (draft === null) throw new Error(`no draft for ${figure.name}, ${label}, ${title}`);
        }
      }
    }
  });
  it('names no month for anyone, whatever their category', () => {
    for (const category of ['ceo', 'athlete', 'entertainer', 'founder'] as const) {
      const figure = YEAR_PEOPLE.find((candidate) => candidate.category === category);
      expect(figure, category).toBeDefined();
      const draft = draftPost(figure!, score(), url)!;
      expect(draft, category).not.toBeNull();
      expect(draft, category).not.toMatch(/Strongest month|Most pressure|Hardest month|March 2027|October 2026/u);
      expect(draft, category).toContain(DRAFT_NOTE);
    }
  });
  it('ends every draft with the fixed note, and drops the main transit, never the note, to fit', () => {
    expect(draftWithheld(DRAFT_NOTE)).toBe(false);
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
