import { afterAll, describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { getYearScore } from '../../ai-tools/features/year-score';
import { DRAFT_NOTE, OFFICIAL_FIGURE_NAMES, OFFICIAL_TIER_LABELS, OFFICIAL_TRANSIT_TITLES, REVIEW_CHECKLIST, X_POST_LIMIT, buildTrendingReport, compactKey, draftPost, matchTrends, officialTransitTitle, type DraftScore, type ReportMatch } from './trending';
import { YEAR_PEOPLE, figureDriverTitle, findYearPerson, yearPageStart, yearPersonPath } from './people';
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

/** Every month name and abbreviation, as words: an official draft names none. */
const MONTH_WORD = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\b/u;
const OFFICIAL_LABELS = [9, 7, 5, 3, 1].map((value) => scoreTier(value).label);
const OFFICIAL_TITLES = SLOW_PLANETS.flatMap((planet) => SCORE_ASPECTS.flatMap((aspect) => SCORE_POINTS.map((point) => driverTitle({ planet, aspect, point }))));

describe('draft posts', () => {
  const person = findYearPerson('Jensen Huang')!;
  const url = 'https://zodiacs.org/year/jensen-huang/';
  /** A label or a main transit title is withheld, both ways. */
  const expectWithheld = (text: string, why: string) => {
    expect(draftPost(person, score({ label: text }), url), `${why}: ${text}`).toBeNull();
    expect(draftPost(person, score({ drivers: [{ title: text }] }), url), `${why} in the transit: ${text}`).toBeNull();
  };
  it('drafts one post under X’s limit, with the link, the confidence label and no dashes', () => {
    const draft = draftPost(person, score(), url)!;
    expect(draft.endsWith(`\n${url}`)).toBe(true);
    expect(draft).toContain('6.4/10');
    expect(draft).toContain('Reading confidence 55%. ' + DRAFT_NOTE);
    expect(draft).toContain("Jupiter trine Jensen's Sun");
    expect(draft.length - url.length + 23).toBeLessThanOrEqual(X_POST_LIMIT);
    expect(draft).not.toMatch(/[‒-―⸺⸻]/u);
  });
  it('gives the score’s birth-day range as the figure’s page does, when it is wide enough to show', () => {
    expect(draftPost(person, score({ scoreRange: { low: 5.9, high: 6.8 } }), url)).toContain('6.4/10 (between 5.9 and 6.8 without a birth time), a supportive year.');
    expect(draftPost(person, score({ scoreRange: { low: 6.3, high: 6.4 } }), url)).toContain('6.4/10, a supportive year.');
  });
  it('gives none without a score, a label or a confidence label', () => {
    expect(draftPost(person, score({ status: 'not-in-directory', score: null }), url)).toBeNull();
    expect(draftPost(person, score({ score: null }), url)).toBeNull();
    expect(draftPost(person, score({ label: null }), url)).toBeNull();
    expect(draftPost(person, score({ label: '' }), url)).toBeNull();
    expect(draftPost(person, score({ confidenceLabel: null }), url)).toBeNull();
  });
  it('allows only official wording: the five tier labels, the directory names and the transit titles', () => {
    expect([...OFFICIAL_TIER_LABELS]).toEqual(['A wide open year', 'A supportive year', 'A balanced year', 'A year of steady pressure', 'A year of heavy pressure']);
    expect([...OFFICIAL_TIER_LABELS]).toEqual(OFFICIAL_LABELS);
    expect([...OFFICIAL_FIGURE_NAMES].sort()).toEqual(YEAR_PEOPLE.map((figure) => figure.name).sort());
    expect([...OFFICIAL_TRANSIT_TITLES].sort()).toEqual([...OFFICIAL_TITLES].sort());
    expect(OFFICIAL_TRANSIT_TITLES.size).toBe(125);
    for (const title of OFFICIAL_TRANSIT_TITLES) expect(title).toMatch(/^(?:Jupiter|Saturn|Uranus|Neptune|Pluto) (?:conjunct|sextile|square|trine|opposite) your (?:Sun|Moon|Mercury|Venus|Mars)$/u);
  });
  it('withholds a label, transit or name that is not official wording exactly, never softening it', () => {
    // Near misses of the official wording: case, spacing, punctuation, extra words.
    for (const label of ['a supportive year', 'A Supportive Year', 'A supportive year.', ' A supportive year', 'A supportive year ', 'A  supportive year', 'A supportive year with steady momentum', 'A very supportive year', 'Supportive', 'A year of pressure', 'A wide-open year', 'A balanced year!']) {
      expect(draftPost(person, score({ label }), url), label).toBeNull();
    }
    for (const title of ['jupiter trine your Sun', 'Jupiter trine your sun', 'Jupiter trine Jensen\'s Sun', 'Jupiter trines your Sun', 'Jupiter trine your Sun.', 'Jupiter trine your Sun ', 'Jupiter trine your Ascendant', 'Mars trine your Sun', 'Jupiter quincunx your Sun', 'Jupiter opposition your Sun', 'Jupiter trine your Sun, a lucky break', '']) {
      expect(draftPost(person, score({ drivers: [{ title }] }), url), title).toBeNull();
    }
    // Only the main transit is read, and only an official one passes; the rest are never printed.
    expect(draftPost(person, score({ drivers: [{ title: 'Saturn square your Venus' }, { title: 'Shares double' }] }), url)).toContain("Saturn square Jensen's Venus");
    expect(draftPost(person, score({ drivers: [{ title: 'Shares double' }, { title: 'Saturn square your Venus' }] }), url)).toBeNull();
    for (const name of ['jensen huang', 'Jensen', 'Jensen Huang ', 'Jensen Huang (NVDA)', 'Somebody New', 'Changpeng Zhao']) {
      expect(draftPost({ ...person, name }, score(), url), name).toBeNull();
    }
    for (const confidenceLabel of ['Reading confidence 55', 'reading confidence 55%', 'Reading confidence 55%.', 'Reading confidence 155%', 'Confidence 55%', 'Reading confidence 55% (guaranteed)']) {
      expect(draftPost(person, score({ confidenceLabel }), url), confidenceLabel).toBeNull();
    }
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1, 10.1]) {
      expect(draftPost(person, score({ score: value }), url), String(value)).toBeNull();
      expect(draftPost(person, score({ scoreRange: { low: 5, high: value } }), url), `range ${value}`).toBeNull();
    }
    expect(draftPost(person, score({ scoreRange: { low: 7.6, high: 5.1 } }), url), 'range backwards').toBeNull();
  });
  it('accepts get_year_score’s wording of an official title for that figure only, and prints the official title', () => {
    const scorer = { title: "Uranus trine Jensen Huang's Mercury", planet: 'Uranus', aspect: 'trine', point: 'Mercury' };
    expect(officialTransitTitle(person, scorer)).toBe('Uranus trine your Mercury');
    expect(draftPost(person, score({ drivers: [scorer] }), url)).toContain("Main transit: Uranus trine Jensen's Mercury.");
    expect(draftPost(person, score({ drivers: [{ title: scorer.title }] }), url)).toContain("Main transit: Uranus trine Jensen's Mercury.");
    expect(draftPost(person, score({ drivers: [{ title: 'Uranus trine your Mercury', planet: 'Uranus', aspect: 'trine', point: 'Mercury' }] }), url)).toContain("Uranus trine Jensen's Mercury");
    // Another figure's name, a short or altered name, or altered wording around it: withheld.
    for (const title of [
      "Uranus trine Elon Musk's Mercury", "Uranus trine Jensen's Mercury", "Uranus trine jensen huang's Mercury", "Uranus trine Jensen Huang’s Mercury",
      "Uranus trine Jensen Huangs Mercury", "Uranus trine Jensen Huang's Mercury.", "Uranus trine Jensen Huang's Mercury, shares double", "Uranus trines Jensen Huang's Mercury",
      "Uranus trine Jensen Huang's Ascendant", "Mars trine Jensen Huang's Mercury", "Uranus trine Jensen Huang's (NVDA) Mercury", "Uranus trine Jensen Huang's  Mercury",
      "Uranus trine Jensen Huang's your Mercury", "Jensen Huang's Mercury",
    ]) {
      expect(draftPost(person, score({ drivers: [{ title }] }), url), title).toBeNull();
      expect(draftPost(person, score({ drivers: [{ ...scorer, title }] }), url), `${title} with fields`).toBeNull();
    }
    // The planet, aspect and point, where given, must be the ones the title names, all three of them.
    for (const fields of [{ planet: 'Saturn' }, { aspect: 'square' }, { point: 'Sun' }, { planet: 'Uranus ' }, { aspect: 'trines' }]) {
      expect(draftPost(person, score({ drivers: [{ ...scorer, ...fields }] }), url), JSON.stringify(fields)).toBeNull();
    }
    expect(draftPost(person, score({ drivers: [{ title: scorer.title, planet: 'Uranus' }] }), url), 'planet only').toBeNull();
    expect(draftPost(person, score({ drivers: [{ title: scorer.title, planet: 'Uranus', aspect: 'trine' }] }), url), 'no point').toBeNull();
    // Every official title, in every figure's own wording, drafts for that figure and for no other.
    const other = findYearPerson('Elon Musk')!;
    for (const figure of YEAR_PEOPLE) {
      for (const title of OFFICIAL_TITLES) {
        const worded = figureDriverTitle(title, figure.name);
        expect(officialTransitTitle(figure, { title: worded }), worded).toBe(title);
        if (figure.slug !== other.slug) expect(officialTransitTitle(other, { title: worded }), `${worded} for ${other.name}`).toBeNull();
      }
    }
  });
  it('withholds a trading call or a diagnosis', () => {
    expect(draftPost(person, score({ label: 'A year to buy' }), url)).toBeNull();
    for (const label of ['A good time for surgery', 'A year to start treatment', 'Recovery from illness', 'A cure arrives']) expectWithheld(label, 'diagnosis');
  });
  it('withholds every class the old guard named, as a label and as the main transit', () => {
    const banned: Record<string, string[]> = {
      'price, stock or crypto call': ['$100', 'Up to €40 a share', '£5 by spring', '₿1 by summer', '$NVDA', 'Shares up 20%', 'A 30 per cent jump', 'A price surge', 'Ethereum rallies', 'Bitcoin to the moon', 'Dogecoin soars', 'Solana pumps', 'A bull run', 'Markets plunge', 'The stock tanks', 'A 10x year', 'A new all-time high', 'NFT drop', 'Time to invest', 'A trading year'],
      'buy or sell signal': ['A year to buy', 'Buying opportunity', 'Sell now', 'A selloff ahead', 'Go long', 'Take profits', 'Shorting the market'],
      'diagnosis or medical timing': ['Hospital admission in June', 'A good time for surgery', 'A year to start treatment', 'Recovery from illness', 'A cure arrives', 'Injury in the spring', 'A diagnosis by March', 'Back in the clinic', 'A stroke in May', 'Therapy pays off', 'Doctors step in', 'Rehab by autumn', 'A health scare'],
      'death prediction': ['Death in the family', 'Dies this year', 'Passes away', 'A fatal year', 'Killed in action', 'A funeral ahead'],
      'legal win or loss': ['Wins the lawsuit', 'Loses the case', 'Lost the appeal', 'A court victory', 'Sued by rivals', 'The verdict favours them', 'Will win', 'Going to lose', 'Set to win', 'Acquitted by spring', 'Arrested in June', 'Facing trial', 'A legal battle'],
      doom: ['A doomed year', 'Disaster strikes', 'Ruin ahead', 'A crash', 'Collapse by autumn', 'Catastrophic losses', 'Bankruptcy looms', 'A tragic turn', 'The worst year yet', 'Downfall', 'Guaranteed success'],
      'em or en dash': ['A year — heavy', 'A year – steady', 'A year ― open', 'A year ‒ open', 'A year ⸺ open', 'A supportive year —', 'Jupiter trine your Sun –'],
      'share or value move': ['Nvidia shares double', 'Shares halve', 'Shares jump', 'Shares are falling', 'Shares could triple', 'Shares climb', 'Shares slide', 'Shares to rise', 'Net worth doubles', 'Nvidia doubles', 'Value tripled', 'A halving year', 'A slump ahead', 'A new all-time low'],
      'written amount': ['Nvidia reaches 200 dollars', 'Two hundred dollars', 'Fifty euros a share', 'Ten pesos', '500 rupees', '100 pounds', '1,000 yen', '200k by spring', '5bn', '3 billion', 'Reaches 200', 'Hits 1,000', 'Tops 500', 'Breaks 100', 'Valued at 3', 'Target 250', '40 USD', 'EUR 30', '15 GBP'],
      'short or long a ticker': ['Short NVDA', 'Shorting TSLA', 'SHORT AAPL', 'Long NVDA', 'Short $NVDA', 'NVDA shorts', 'TSLA calls', 'Short selling', 'A short squeeze', 'Short sellers circle', 'A long position'],
      'coin or ticker': ['BNB doubles', 'BNB', 'bnb season', 'AVAX', 'Matic', 'Shiba', 'Tron', 'Litecoin', 'Polkadot', 'Chainlink', 'Uniswap', 'Monero', 'SOL', 'DOT', 'LINK', 'ADA', 'TON', 'PEPE', 'An altcoin year', 'Memecoin season', 'A crypto wallet'],
      'named condition or procedure': ['Dialysis in June', 'Pneumonia in June', 'Bronchitis', 'Arthritis flares', 'Appendicitis', 'An appendectomy', 'A colonoscopy', 'A rhinoplasty', 'Flu season', 'Influenza', 'Covid again', 'Sepsis', 'A torn ACL', 'A broken leg', 'Hamstring trouble', 'A fracture', 'A concussion', 'Blood clots', 'Heart failure', 'Kidney trouble', 'Lung trouble', 'A biopsy', 'An MRI', 'Test results in June', 'Leukemia', 'Lymphoma', 'Asthma', 'Migraines', 'Insomnia', 'Bipolar', 'Addiction', 'Epilepsy', 'Menopause', 'IVF in June', 'A caesarean', 'Anaesthesia', 'On a ventilator', 'Quarantine', 'A pandemic year', 'Back on the ward', 'Bed rest', 'Nurses step in', 'Psychosis', 'Thrombosis', 'Cirrhosis'],
      'legal outcome': ['The appeal is dismissed', 'Appeal dismissed', 'The appeal fails', 'Appeal granted', 'The case is thrown out', 'Charges dropped', 'Charges are dropped', 'Conviction overturned', 'The ruling is upheld', 'The motion is denied', 'Petition rejected', 'The ban is lifted', 'The claim succeeds', 'A judge rules', 'Lawyers step in', 'An injunction', 'Found liable', 'Found not guilty', 'Cleared of wrongdoing', 'Pardoned by spring', 'Exonerated', 'Settles the lawsuit', 'Settlement of the claim', 'Ruled against them', 'Ruled in their favour', 'Testifies in June', 'Pleads not guilty', 'A plea deal', 'Extradited', 'Charged with fraud', 'The tribunal decides'],
      'share or value move, words between': ['Nvidia shares increase', 'Nvidia shares will steadily rise', 'Apple shares decrease', 'Shares could slowly grow', 'Shares shrink', 'Shares gain', 'Shares edge lower', 'The share price will quietly climb', 'Its stock price drops', 'Net worth set to shrink', 'Its value rises', 'The value will sharply fall', 'Valuation jumps', 'Nvidia will double', 'Set to halve'],
      'short or long of a name or ticker, any case': ['Short Nvidia', 'short nvda', 'Short NVDA', 'short Tesla', 'Long Tesla', 'long tsla', 'Shorting Apple', 'Time to short Nvidia', 'Short meta now', 'I would short nvda', 'Longing Nvidia'],
      'a month, season, weekday or span as a date': ['HIV in June', 'Lupus in June', 'Dengue in June', 'Hepatitis in June', 'Measles by March', 'Malaria during October', 'A scare in May', 'Lupus in may', 'hiv by march', 'Something by Mar', 'A scare in mid-June', 'By the end of April', 'On the 3rd of May', 'In early September', 'Through December', 'June 12', '12 June', '12th of March', 'March 2027', 'May 3rd', 'Back by spring', 'This summer', 'On Monday', 'Within weeks', 'In two weeks', 'Next month', '2027-06-12'],
      'named condition, by name or by its ending': ['HIV', 'AIDS', 'Lupus', 'Dengue', 'Zika', 'Ebola', 'Cholera', 'Herpes', 'Shingles', 'Chickenpox', 'Rotavirus', 'Anemia', 'Endometriosis', 'Neuropathy', 'Neuralgia', 'Paraplegic', 'A fever', 'A hernia', 'An ulcer', 'Chronic pain', 'A rare condition', 'Back pain', 'A flare-up', 'Tests positive', 'MS', 'PTSD'],
      'legal result, words between': ['The appeal is successful', 'The appeal has failed', 'The appeal is unanimously rejected', 'The appeal succeeded', 'The appeal has been formally denied', 'The case is successful', 'The case was quickly granted', 'The charge fails', 'The charges against him were dropped', 'The motion was narrowly granted', 'The suit was ultimately thrown out', 'The case goes their way', 'The appeal is quietly overturned', 'Rejects the appeal', 'Denies the motion', 'Drops all charges', 'A successful appeal', 'A failed lawsuit'],
    };
    for (const [kind, texts] of Object.entries(banned)) for (const text of texts) expectWithheld(text, kind);
  });
  it('withholds the s947d examples, which the phrase denylist let through', () => {
    for (const text of [
      'Nvidia shares are now widely expected to increase', 'Nvidia shares, expected to rise', 'We are short Nvidia', 'We are long Nvidia',
      'The appeal is a success', 'The motion passes', 'The case is resolved against her', 'Anaphylaxis', 'Alopecia', 'Narcolepsy',
    ]) expectWithheld(text, 's947d');
  });
  it('withholds custom wording the old guard let through, however ordinary it reads', () => {
    for (const text of [
      'in short', 'In short, a calm year', 'short of time', 'falls short', 'cut short by rest', 'the long run', 'long for home', 'as long as it takes', 'a long time coming',
      'a short Mercury retrograde', 'a year that may surprise', 'it may be a quiet year', 'time to march on', 'a short year', 'a short window to sign agreements', 'a long year', 'the long view',
      'a share of the spotlight', 'shares a birthday', 'a year of broad appeal', 'ruled by Venus', 'a strong case for patience', 'a year to settle in', 'worth the wait', 'a double life',
      'a strong year for earnings; take rest seriously; a good window to sign contracts', 'a stroke of luck', 'traditional money themes', 'a year of deadlines and new skills',
      'A good year to build on what already works, in your work and at home.', 'A supportive year with steady momentum', 'Oprah Winfrey', 'Reading confidence 55%', DRAFT_NOTE,
    ]) expectWithheld(text, 'custom wording');
  });
  it('drafts for every figure in the directory, at every tier and with every main transit, and names no month', () => {
    expect(new Set(OFFICIAL_LABELS).size).toBe(5);
    for (const figure of YEAR_PEOPLE) {
      const page = `https://zodiacs.org/year/${figure.slug}/`;
      for (const label of OFFICIAL_LABELS) {
        for (const title of OFFICIAL_TITLES) {
          for (const scoreRange of [null, { low: 0.4, high: 9.6 }]) {
            const draft = draftPost(figure, score({ score: 10, label, drivers: [{ title }], confidenceLabel: 'Reading confidence 100%', scoreRange }), page);
            if (draft === null) throw new Error(`no draft for ${figure.name}, ${label}, ${title}`);
            if (MONTH_WORD.test(draft.split('\n')[0])) throw new Error(`a month in the draft for ${figure.name}: ${draft}`);
          }
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
      expect(draft.split('\n')[0], category).not.toMatch(MONTH_WORD);
      expect(draft, category).toContain(DRAFT_NOTE);
    }
  });
  it('ends every draft with the fixed note, and drops the main transit, never the note, to fit', () => {
    const short = draftPost(person, score(), url)!;
    expect(short).toContain('Main transit:');
    expect(short.split('\n')[0].endsWith(DRAFT_NOTE)).toBe(true);
    // An official label with the birth-day range and a long transit runs past the limit, so the transit goes.
    const long = draftPost(person, score({ scoreRange: { low: 5.1, high: 7.6 }, label: 'A year of steady pressure', drivers: [{ title: 'Neptune opposite your Mercury' }] }), url)!;
    expect(long).not.toBeNull();
    expect(long).toContain('(between 5.1 and 7.6 without a birth time), a year of steady pressure.');
    expect(long).not.toContain('Main transit:');
    expect(long).toContain('Reading confidence 55%. ' + DRAFT_NOTE);
    expect(long.length - url.length + 23).toBeLessThanOrEqual(X_POST_LIMIT);
  });
});

describe('draft posts from the real scorer, as scripts/trending-x.ts makes them', () => {
  const clock = createLocalTimeModule();
  afterAll(() => clock.dispose());
  const NOW = new Date('2026-11-20T09:00:00Z');
  const ORIGIN = 'https://zodiacs.org';
  it('drafts for every directory figure, with the official title of the scorer’s main transit, and still withholds unofficial wording', async () => {
    let withTransit = 0;
    for (const figure of YEAR_PEOPLE) {
      const { data } = await getYearScore({ person: figure.slug, from: yearPageStart(NOW) }, NOW, clock, ORIGIN);
      const url = `${ORIGIN}${yearPersonPath(figure.slug)}`;
      const draft = draftPost(figure, data, url);
      if (draft === null) throw new Error(`no draft for ${figure.name}: label ${data.label}, main transit ${data.drivers[0]?.title}`);
      expect(draft.endsWith(`\n${url}`)).toBe(true);
      expect(draft).toContain(`${data.score!.toFixed(1)}/10`);
      expect(draft).toContain(`${data.confidenceLabel}. ${DRAFT_NOTE}`);
      expect(draft).not.toMatch(/[‒-―⸺⸻]/u);
      expect(draft.split('\n')[0]).not.toMatch(MONTH_WORD);
      const main = data.drivers[0];
      if (main) {
        // The scorer words it with the figure's full name; the draft prints the official title with their first name.
        expect(main.title).toContain(`${figure.name}'s`);
        const official = officialTransitTitle(figure, main);
        expect(official, main.title).not.toBeNull();
        if (draft.includes('Main transit:')) {
          withTransit += 1;
          expect(draft).toContain(`Main transit: ${official!.replace(' your ', ` ${figure.name.split(' ')[0]}'s `)}.`);
        }
        // The same answer with unofficial wording in place of the main transit, or a title worded for someone else: withheld.
        const stranger = YEAR_PEOPLE.find((candidate) => candidate.slug !== figure.slug)!;
        for (const title of [`${main.title}, shares double`, main.title.replace(`${figure.name}'s`, `${figure.name.split(' ')[0]}'s`), main.title.replace(figure.name, stranger.name), 'Nvidia shares are now widely expected to increase'].filter((title) => title !== main.title)) {
          expect(draftPost(figure, { ...data, drivers: [{ ...main, title }, ...data.drivers.slice(1)] }, url), title).toBeNull();
        }
        expect(draftPost(figure, { ...data, drivers: [{ ...main, planet: main.planet === 'Saturn' ? 'Jupiter' : 'Saturn' }] }, url), 'planet changed').toBeNull();
      }
      for (const label of ['A year to buy', 'A supportive year with steady momentum', 'The appeal is a success']) {
        expect(draftPost(figure, { ...data, label }, url), label).toBeNull();
      }
      expect(draftPost({ ...figure, name: `${figure.name} (NVDA)` }, data, url), 'name changed').toBeNull();
      expect(draftPost(figure, { ...data, confidenceLabel: `${data.confidenceLabel} (guaranteed)` }, url), 'confidence changed').toBeNull();
    }
    expect(withTransit).toBeGreaterThan(0);
  }, 120_000);
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
