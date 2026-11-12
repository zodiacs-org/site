import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import corrections from '../src/data/corrections.json';
import dailyPublication from '../src/data/daily-publication.json';
import { dailyReading, houseLine } from '../src/lib/daily';
import { PEOPLE, peopleText } from '../src/lib/people';
import {
  dailyPublicationDashMatches,
  renderedDashMatches,
  searchIndexDashMatches,
} from './consumer-dashes-lib.mjs';

const DASH = /[\u2013\u2014]/u;
const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = (head, body) => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe('rendered-copy dash gate', () => {
  it('flags a dash in the Astrofolio navigation description on any page', () => {
    const nav = '<a href="/astrofolio/" title="Coleção oficial \u2014 em inglês" aria-description="Coleção oficial \u2014 em inglês">Astrofolio</a>'
      + '<a class="mobile-menu__link" href="/astrofolio/"><span>Astrofolio</span><small>Coleção oficial \u2014 em inglês</small></a>';
    const matches = renderedDashMatches(page('', nav), '/pt/');
    expect(matches.some((match) => match.startsWith('nav aria-description'))).toBe(true);
    expect(matches.some((match) => match.startsWith('nav title'))).toBe(true);
    expect(matches.some((match) => match.startsWith('nav text'))).toBe(true);
    const clean = nav.replaceAll(' \u2014 em inglês', ' (em inglês)');
    expect(renderedDashMatches(page('', clean), '/pt/')).toEqual([]);
  });

  it('checks every part of a People page, the closed evidence panel and structured data included', () => {
    const jsonLd = '<script type="application/ld+json">{"description":"Mathematician · United Kingdom · 1815\\u20131852"}</script>';
    expect(renderedDashMatches(page(jsonLd, '<p>Ada</p>'), '/people/ada-lovelace/')[0]).toMatch(/^JSON-LD/u);
    const closed = '<details><summary>Sources</summary><dd>none &mdash; Wikidata carries no claim</dd></details>';
    expect(renderedDashMatches(page('', closed), '/people/ada-lovelace/')[0]).toMatch(/^body/u);
    expect(renderedDashMatches(page('<title>Ada \u2013 chart</title>', ''), '/people/')[0]).toMatch(/^title/u);
    expect(renderedDashMatches(page('<title>Ada</title>', '<p>1815 to 1852</p>'), '/people/ada-lovelace/')).toEqual([]);
  });

  it('checks the titles of /lunar-return/ and /numerology/ and the body of /corrections/', () => {
    const titled = page('<title>Lunar Return Calculator \u2014 Next</title><meta property="og:title" content="A \u2014 B">', '');
    expect(renderedDashMatches(titled, '/lunar-return/').map((match) => match.split(':')[0]))
      .toEqual(['title', 'meta og']);
    expect(renderedDashMatches(page('', '<p>filed \u2014 while</p>'), '/corrections/')[0]).toMatch(/^body/u);
  });

  it('leaves surfaces outside the gate, scripts and comments alone', () => {
    const body = '<p>Лунный знак \u2014 это знак</p><script>const a = "\u2014";</script><!-- a \u2014 b -->';
    expect(renderedDashMatches(page('<title>Ru \u2014 title</title>', body), '/ru/moon-sign/')).toEqual([]);
    expect(renderedDashMatches(page('', '<script>"\u2014"</script><!-- \u2014 -->'), '/people/x/')).toEqual([]);
  });

  it('checks the gated search entries and every printed daily line', () => {
    expect(searchIndexDashMatches([
      { path: '/numerology/', title: 'Numerology Calculator \u2014 Life Path' },
      { path: '/ru/moon-sign/', title: 'Лунный знак \u2014 узнать' },
    ])).toEqual(['/numerology/ title: Numerology Calculator \u2014 Life Path']);
    expect(dailyPublicationDashMatches({
      signs: [{ sign: 'aries', headline: 'a \u2014 b', todayLine: { text: 'ok' }, lines: [{ text: 'ok' }] }],
    })).toEqual(['aries headline: a \u2014 b']);
  });
});

describe('the copy the dash gate covers carries no dash at source', () => {
  it('Astrofolio navigation descriptions, and the scanner allowlist that pins them', () => {
    const nav = source('src/components/SiteNav.astro').match(/const astrofolioLabel[\s\S]*?\n\};/u)?.[0];
    expect(nav).toBeTruthy();
    expect(nav).not.toMatch(DASH);
    const pinned = source('scripts/consumer-boundary-lib.mjs')
      .match(/function isAstrofolioNavigationDescription[\s\S]*?\]\)\.has/u)?.[0];
    expect(pinned).toBeTruthy();
    expect(pinned).not.toMatch(DASH);
  });

  it('the /lunar-return/ and /numerology/ titles and the corrections record', () => {
    for (const path of ['src/pages/lunar-return/index.astro', 'src/pages/numerology/index.astro']) {
      const title = source(path).match(/\stitle="([^"]+)"/u)?.[1];
      expect(title, path).toBeTruthy();
      expect(title, path).not.toMatch(DASH);
    }
    expect(JSON.stringify(corrections)).not.toMatch(DASH);
  });

  it('every People string the pages print, after peopleText', () => {
    const printed = (person) => [
      person.shortDescription,
      person.birthTimeEvidence,
      person.birthPlace.entityLabel,
      person.birthPlace.normalisedLabel,
      person.birthPlace.coordinates.sourceEntityLabel,
      person.birthPlace.coordinates.precisionDowngrade ?? '',
      person.copy.title,
      person.copy.metaDescription,
      person.copy.lede,
      person.copy.birthdayLink.label,
      person.copy.signLink.label,
      ...person.copy.blocks.flatMap((block) => [block.title, block.text]),
      ...(person.sourceReview ? [person.sourceReview.note, ...person.sourceReview.sources.map((item) => item.title)] : []),
      ...(person.portrait.available
        ? [person.portrait.creator, person.portrait.licence, person.portrait.renderedAttribution]
        : [person.portrait.reason]),
      person.sources.wikipedia.title,
    ];
    const left = PEOPLE.flatMap((person) => printed(person)
      .map((text) => peopleText(text))
      .filter((text) => DASH.test(text))
      .map((text) => `${person.slug}: ${text}`));
    expect(left).toEqual([]);
  });

  it('the People templates print data through peopleText', () => {
    const template = source('src/pages/people/[slug].astro') + source('src/components/people/PeopleCard.astro');
    expect(template).not.toMatch(/\{person\.(?:shortDescription|birthTimeEvidence|portrait\.creator|sourceReview\.note|birthPlace\.(?:entityLabel|normalisedLabel))\}/u);
    expect(template).not.toMatch(/description: person\.shortDescription/u);
    const corrected = template.match(/correctedPeopleText\(person/gu)?.length ?? 0;
    const plain = template.match(/peopleText\(correctedPeopleText\(person/gu)?.length ?? 0;
    expect(plain).toBe(corrected);
  });

  it('peopleText keeps the words and changes only the punctuation', () => {
    expect(peopleText('Mathematician · United Kingdom · 1815\u20131852')).toBe('Mathematician · United Kingdom · 1815 to 1852');
    expect(peopleText('inside the first decan (0°\u201310°), whose')).toBe('inside the first decan (0° to 10°), whose');
    expect(peopleText('William Hall (1826\u2013ca. 1898)')).toBe('William Hall (1826 to ca. 1898)');
    expect(peopleText('Yale \u2013 New Haven Hospital')).toBe('Yale-New Haven Hospital');
    expect(peopleText('none \u2014 Wikidata carries no birth-time claim for this person'))
      .toBe('none: Wikidata carries no birth-time claim for this person');
    expect(peopleText('Mars in Aries at 1.7° is in domicile \u2014 the planet in its own sign; Venus is in fall \u2014 strength earned.'))
      .toBe('Mars in Aries at 1.7° is in domicile: the planet in its own sign; Venus is in fall: strength earned.');
    expect(peopleText('The oldest layer of the scheme \u2014 seven planets, four conditions \u2014 flags two placements in this chart.'))
      .toBe('The oldest layer of the scheme (seven planets, four conditions) flags two placements in this chart.');
    expect(peopleText('No closed figure \u2014 no grand trine, t-square, or grand cross \u2014 holds among the day-stable angles.'))
      .toBe('No closed figure (no grand trine, t-square, or grand cross) holds among the day-stable angles.');
    expect(peopleText('Mars was retrograde \u2014 the optical reversal the tradition reads as review \u2014 energy turned over before it is turned out.'))
      .toBe('Mars was retrograde (the optical reversal the tradition reads as review), energy turned over before it is turned out.');
    expect(peopleText('Tallied where the signs are certain \u2014 9 placements whose signs hold for the whole day \u2014 the chart gives fire 4.'))
      .toBe('Tallied where the signs are certain (9 placements whose signs hold for the whole day), the chart gives fire 4.');
    expect(peopleText('The pitch: steady \u2014 and slow.')).toBe('The pitch: steady, and slow.');
  });

  it('the daily templates /today/ and /profile/ print, and the committed publication', () => {
    const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Chiron'];
    for (const body of bodies) {
      for (let house = 1; house <= 12; house += 1) {
        const line = houseLine({ body, lon: 0, sign: 'aries', degree: 1, retrograde: false }, house);
        expect(line.text).not.toMatch(DASH);
      }
    }
    const daily = {
      date: '2026-11-12',
      bodies: [{ body: 'Moon', lon: 250, sign: 'sagittarius', degree: 10, retrograde: false }],
      moon: { phase: 'waxing', illumination: 0.5 },
      events: [
        { kind: 'aspect', at: '2026-11-12T03:00:00Z', a: 'Mars', b: 'Saturn', type: 'square', orb: 0 },
        { kind: 'ingress', at: '2026-11-12T04:00:00Z', planet: 'Venus', sign: 'scorpio' },
        { kind: 'lunation', at: '2026-11-12T05:00:00Z', type: 'new', sign: 'scorpio', degree: 20 },
        { kind: 'lunation', at: '2026-11-12T05:00:00Z', type: 'full', sign: 'taurus', degree: 20 },
        { kind: 'station', at: '2026-11-12T06:00:00Z', planet: 'Mercury', type: 'retrograde', sign: 'sagittarius', degree: 5 },
        { kind: 'station', at: '2026-11-12T06:00:00Z', planet: 'Saturn', type: 'direct', sign: 'pisces', degree: 25 },
      ],
    };
    // Each event leads its own reading, so every template is rendered.
    for (const event of daily.events) {
      const reading = dailyReading('aries', { ...daily, events: [event] });
      expect(reading.lines.length).toBeGreaterThan(0);
      for (const line of reading.lines) expect(line.text).not.toMatch(DASH);
      expect(reading.headline).not.toMatch(DASH);
    }
    expect(dailyPublicationDashMatches(dailyPublication)).toEqual([]);
  });
});
