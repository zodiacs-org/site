import { readFileSync } from 'node:fs';
import { decode as decodeJpeg } from 'jpeg-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseCompatibilityShare, parseOccasionShare } from '../lib/share-results';
import {
  handleBirthdayImageRequest,
  handleBirthdayLinkRequest,
  handleBirthdayStoryRequest,
  handleCompatibilityStoryRequest,
  handleHoroscopeStoryRequest,
  handleOccasionStoryRequest,
  handleSkyCalendarStoryRequest,
  handleCompatibilityImageRequest,
  handleCompatibilityLinkRequest,
  handleHoroscopeImageRequest,
  handleHoroscopeLinkRequest,
  handleOccasionImageRequest,
  handleOccasionLinkRequest,
  handleResultShareNodeRequest,
  handleSkyCalendarImageRequest,
  handleSkyCalendarLinkRequest,
  handleChartTwinsImageRequest,
  horoscopeCard,
  horoscopeStory,
  handleChartTwinsLinkRequest,
  handleChartTwinsStoryRequest,
  handleFamousChartImageRequest,
  handleFamousChartLinkRequest,
  handleFamousChartStoryRequest,
  handleMilestoneImageRequest,
  handleMilestoneLinkRequest,
  handleMilestoneStoryRequest,
  handleBigThreeImageRequest,
  handleBigThreeLinkRequest,
  handleBigThreeStoryRequest,
  handleChineseZodiacImageRequest,
  handleChineseZodiacLinkRequest,
  handleChineseZodiacStoryRequest,
  handleInviteImageRequest,
  handleInviteLinkRequest,
  handleInviteStoryRequest,
  handleVedicSignsImageRequest,
  handleVedicSignsLinkRequest,
  handleVedicSignsStoryRequest,
  RESULT_SHARE_ROUTES,
} from './result-preview';
import {
  bigThreeCardModel,
  vedicSignsCardModel,
  chineseZodiacCardModel,
  inviteCardModel,
  type PublishedMonths,
  type PublishedYears,
  birthdayCardModel,
  chartTwinsCardModel,
  compatibilityCardModel,
  famousBirthdays,
  famousChartCardModel,
  type IndexedPerson,
  milestoneCardModel,
  horoscopeCardModel,
  longDate,
  NEUTRAL_HUE,
  occasionCardModel,
  skyCalendarCardModel,
  skyEvents,
} from './result-preview-model';
import { parseBigThreeShare, parseBirthdayShare, parseChartTwinsShare, parseChineseZodiacShare, parseFamousChartShare, parseHoroscopeShare, parseInviteShare, parseMilestoneShare, parseSkyCalendarShare } from '../ai-tools/share-links';
import { parseVedicSignsShare } from '../lib/vedic-signs/share';
import type { HoroscopeWindow } from '../ai-tools/horoscope/window';
import { NATAL_NOTE } from '../ai-tools/features/natal-chart';
import { CHINESE_ZODIAC_NOTE } from '../ai-tools/features/chinese-zodiac';
import { HOROSCOPE_DISCLOSURE } from '../ai-tools/horoscope/reading';

const COMPAT = 'as=leo&bs=libra&score=78&attraction=82&communication=71&stability=80&v=strong';
/** The same result as a link made before the assistant tools stopped writing names (0.6.1): it opens, without them. */
const COMPAT_NAMED = 'a=Ana&as=leo&b=Luis&bs=libra&score=78&attraction=82&communication=71&stability=80&v=strong';
const json = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;
const DAYS = json<{ days: Record<string, { sign?: string; cusp?: { a: string; b: string } }> }>('../data/birthdays.json').days;
const SKY_EVENTS = skyEvents({ ...json<any>('../data/sky.json'), eclipses: json<any>('../data/eclipses.json').eclipses });
const WINDOW = json<HoroscopeWindow>('../data/horoscope-window.json');
const TODAY = WINDOW.generatedFor;
const WEEK = WINDOW.editions.find((edition) => edition.anchorDate === TODAY)!.signs.leo.weekly.period;
const OCCASION = 'o=wedding&d=2027-06-12&sun=gemini&moon=libra&score=84&v=excellent';
/** The same date as an older link with the couple's names and the place: it opens, without them. */
const OCCASION_NAMED = 'o=wedding&d=2027-06-12&n=Ana+%26+Luis&p=Florence&sun=gemini&moon=libra&score=84&v=excellent';
const FAMOUS = famousBirthdays(json<{ people: Parameters<typeof famousBirthdays>[0] }>('../ai-tools/features/people-index.json').people);
const PEOPLE = json<{ people: IndexedPerson[] }>('../ai-tools/features/people-index.json').people;
const SATURN = 'k=saturn-return&i=1&a=29';
/** A milestone link made before the pass dates were left out: it still opens, drawn without them. */
const SATURN_OLDER = 'k=saturn-return&i=1&a=29&f=2026-04-23&l=2026-12-31';
const MONTHS = json<PublishedMonths>('../data/horoscope-months.json');
const PROGRAM = json<PublishedYears>('../data/horoscope-program.json');
/** The latest month the committed readings hold, served from its first day. */
const LATEST_MONTH = Object.keys(MONTHS.months).sort().at(-1)!;
const SERVED = new Date(`${LATEST_MONTH}-15T12:00:00Z`);
const nativeFetch = globalThis.fetch;

afterEach(() => {
  vi.stubGlobal('fetch', nativeFetch);
});

function nodeResponse() {
  const headers = new Map<string, string>();
  return {
    statusCode: 0,
    headers,
    body: Buffer.alloc(0) as Buffer,
    setHeader(name: string, value: string) { headers.set(name.toLowerCase(), value); },
    end(body: Buffer) { this.body = body; },
  };
}

describe('share card models', () => {
  it('name the two people by their Sun signs, in their hues, the score, the verdict and the three areas, never a name', () => {
    const model = compatibilityCardModel(parseCompatibilityShare(new URLSearchParams(COMPAT))!);
    expect(model).toMatchObject({
      first: 'Leo', second: 'Libra', score: 78, verdict: 'A strong match',
      people: [{ slug: 'leo', label: 'Leo Sun', hue: '#E0A9B4' }, { slug: 'libra', label: 'Libra Sun', hue: '#D3A9DE' }],
      ring: ['#E0A9B4', '#D3A9DE'],
      areas: [{ label: 'Attraction', value: 82 }, { label: 'Communication', value: 71 }, { label: 'Stability', value: 80 }],
      title: 'Leo and Libra: 78/100',
    });
    // Handed an older link's names, the card is the same.
    expect(compatibilityCardModel(parseCompatibilityShare(new URLSearchParams(COMPAT_NAMED))!)).toEqual(model);
  });

  it('call the two people Person A and Person B when a sign is not known, and draw an unknown sign in the neutral tone', () => {
    const model = compatibilityCardModel(parseCompatibilityShare(new URLSearchParams('bs=pisces&score=41&attraction=55&communication=38&stability=30&v=challenging'))!);
    expect([model.first, model.second]).toEqual(['Person A', 'Person B']);
    expect(model.people[0]).toEqual({ slug: null, label: 'Sun sign on the cusp', hue: NEUTRAL_HUE });
    expect(model.verdict).toBe('A challenging match');
  });

  it('give a date its headline, the day in words and the Sun and Moon, never names or a place', () => {
    const model = occasionCardModel(parseOccasionShare(new URLSearchParams(OCCASION))!);
    expect(model).toMatchObject({
      headline: 'Our wedding', when: 'Saturday, 12 June 2027', score: 84, verdict: 'An excellent day for it',
      signs: [{ label: 'Gemini Sun' }, { label: 'Libra Moon' }],
      title: 'Wedding, 84/100',
    });
    expect(model).not.toHaveProperty('names');
    // Handed an older link's names and place, the card is the same.
    expect(occasionCardModel(parseOccasionShare(new URLSearchParams(OCCASION_NAMED))!)).toEqual(model);
    expect(longDate('1999-08-11')).toBe('Wednesday, 11 August 1999');
  });
});

describe('birthday, sky calendar and horoscope share models', () => {
  const birthday = (query: string) => birthdayCardModel(parseBirthdayShare(new URLSearchParams(query))!, DAYS);

  it('give a birthday its sign, or a cusp date both signs, and refuse a sign the date never has', () => {
    expect(birthday('d=05-03')).toMatchObject({ title: '3 May birthdays', line: 'Taurus Sun', slug: 'may-3', signs: [{ slug: 'taurus' }] });
    expect(birthday('d=05-03')!.about).toBe('People born on 3 May have the Sun in Taurus. Earth, fixed, ruled by Venus. Apr 20 to May 20.');
    expect(birthday('d=04-20')).toMatchObject({ line: 'On the cusp of Aries and Taurus', signs: [{ slug: 'aries' }, { slug: 'taurus' }] });
    expect(birthday('d=04-20&s=taurus')).toMatchObject({ line: 'Taurus Sun', signs: [{ slug: 'taurus' }] });
    expect(birthday('d=02-29')).toMatchObject({ title: '29 February birthdays', line: 'Pisces Sun' });
    expect(birthday('d=05-03&s=leo')).toBeNull();
    expect(birthday('d=04-20&s=leo')).toBeNull();
  });

  it('name the first famous person the site publishes for the date, as its birthday page lists them', () => {
    const famous = (query: string) => {
      const share = parseBirthdayShare(new URLSearchParams(query))!;
      return birthdayCardModel(share, DAYS, FAMOUS.get(`${String(share.month).padStart(2, '0')}-${String(share.day).padStart(2, '0')}`) ?? null)!;
    };
    expect(FAMOUS.get('05-04')).toEqual({ name: 'Audrey Hepburn', slug: 'audrey-hepburn', sun: 'taurus' });
    // Oldest first: Edgar Allan Poe (1809) before Janis Joplin (1943).
    expect(FAMOUS.get('01-19')?.name).toBe('Edgar Allan Poe');
    expect(FAMOUS.has('05-03')).toBe(false);
    expect(famous('d=05-04')).toMatchObject({ line: 'Taurus Sun, like Audrey Hepburn', famous: { slug: 'audrey-hepburn' } });
    expect(famous('d=05-04').about).toBe('People born on 4 May have the Sun in Taurus. Earth, fixed, ruled by Venus. Apr 20 to May 20. Audrey Hepburn was born on this date.');
    // On a cusp, "like" only when the line names the sign they had.
    expect(famous('d=01-19&s=capricorn').line).toBe('Capricorn Sun, like Edgar Allan Poe');
    expect(famous('d=01-19&s=aquarius').line).toBe('Aquarius Sun. Edgar Allan Poe was born on this date');
    expect(famous('d=01-19').line).toBe('On the cusp of Capricorn and Aquarius. Edgar Allan Poe was born on this date');
    expect(famous('d=05-03')).toMatchObject({ line: 'Taurus Sun', famous: null });
  });

  it('find a sky calendar event in the feed’s own data, and nothing that is not in it', () => {
    const sky = (query: string) => skyCalendarCardModel(parseSkyCalendarShare(new URLSearchParams(query))!, SKY_EVENTS);
    expect(sky('k=retrograde&b=mercury&d=2026-10-24')).toEqual({
      title: 'Mercury retrograde', span: 'Sat 24 Oct to Fri 13 Nov', spanLong: 'Saturday 24 October to Friday 13 November', line: 'Mercury retrograde, Sat 24 Oct to Fri 13 Nov.',
    });
    expect(sky('k=full-moon&d=2026-10-26')).toMatchObject({ title: 'Full moon', line: 'Full moon, Mon 26 Oct.' });
    expect(sky('k=retrograde&b=mercury&d=2026-10-25')).toBeNull();
    expect(sky('k=new-moon&d=2026-10-26')).toBeNull();
  });

  it('quote a published horoscope’s own line for the sign, and the sign’s dates once it is gone', () => {
    const horoscope = (query: string) => horoscopeCardModel(parseHoroscopeShare(new URLSearchParams(query))!, WINDOW)!;
    const day = horoscope(`s=leo&d=${TODAY}`);
    const published = WINDOW.editions.find((edition) => edition.anchorDate === TODAY)!.signs.leo.today.passages.map((passage) => passage.text).join(' ');
    expect(day.line).toMatch(/^For Leo, .+[.!?]$/u);
    expect(published).toContain(day.line);
    expect(day.kicker).toMatch(/^Horoscope for [A-Z][a-z]+day \d{1,2} [A-Z][a-z]+$/u);
    expect(day.heading).toBe(`Leo ${day.kicker.charAt(0).toLowerCase()}${day.kicker.slice(1)}`);
    expect(horoscope(`s=leo&d=${TODAY}&f=love`).kicker).toMatch(/^Love horoscope for /u);
    expect(horoscope(`s=leo&w=${WEEK.from}`).kicker).toMatch(/^Horoscope for \d{1,2}(?: [A-Z][a-z]+)? to \d{1,2} [A-Z][a-z]+$/u);
    expect(horoscope('s=leo&d=2026-09-01')).toMatchObject({ kicker: 'Horoscope for Tuesday 1 September', line: 'Jul 23 to Aug 22', passage: null });
    // Nothing is published after the window's latest day or week yet.
    const latest = WINDOW.editions.map((edition) => edition.anchorDate).sort().at(-1)!;
    const after = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
    expect(horoscopeCardModel(parseHoroscopeShare(new URLSearchParams(`s=leo&d=${after(latest, 1)}`))!, WINDOW)).toBeNull();
    // The window can already carry next week's edition (it rolls on Sundays), so step past the latest week, not today's.
    const latestWeek = WINDOW.editions.map((edition) => edition.signs.leo.weekly.period.from).sort().at(-1)!;
    expect(horoscopeCardModel(parseHoroscopeShare(new URLSearchParams(`s=leo&w=${after(latestWeek, 7)}`))!, WINDOW)).toBeNull();
  });
});

describe('confidence labels on the cards that show a forecast or a score', () => {
  it('print the link\'s own value on a compatibility or date card, and nothing on a link made before the label', () => {
    expect(compatibilityCardModel(parseCompatibilityShare(new URLSearchParams(`${COMPAT}&c=70`))!).confidence).toBe('Reading confidence 70%');
    expect(compatibilityCardModel(parseCompatibilityShare(new URLSearchParams(COMPAT))!).confidence).toBeNull();
    expect(occasionCardModel(parseOccasionShare(new URLSearchParams(`${OCCASION}&c=55`))!).confidence).toBe('Reading confidence 55%');
    expect(occasionCardModel(parseOccasionShare(new URLSearchParams(OCCASION))!).confidence).toBeNull();
  });

  it('print a Sun-sign horoscope\'s 40% whenever the card quotes a published reading, and nothing once it is gone', () => {
    expect(horoscopeCardModel(parseHoroscopeShare(new URLSearchParams(`s=leo&d=${TODAY}`))!, WINDOW)!.confidence).toBe('Reading confidence 40%');
    expect(horoscopeCardModel(parseHoroscopeShare(new URLSearchParams('s=leo&d=2026-09-01'))!, WINDOW)!.confidence).toBeNull();
  });

  it('say on a horoscope image and story that the 40% is a Sun-sign reading\'s', () => {
    const model = horoscopeCardModel(parseHoroscopeShare(new URLSearchParams(`s=leo&d=${TODAY}`))!, WINDOW)!;
    for (const card of [horoscopeCard(model, new Map(), []), horoscopeStory(model, new Map(), [])]) {
      expect(JSON.stringify(card)).toContain('Sun-sign reading. Reading confidence 40%');
    }
  });
});

describe('month and year horoscope share models', () => {
  const model = (query: string, now = SERVED) => horoscopeCardModel(parseHoroscopeShare(new URLSearchParams(query))!, WINDOW, { months: MONTHS, years: PROGRAM, now });

  it('quote a published month\'s opening, with the month in the kicker and the reading\'s confidence', () => {
    const month = model(`s=leo&m=${LATEST_MONTH}`)!;
    const paragraphs = MONTHS.months[LATEST_MONTH].leo.paragraphs.join(' ');
    expect(month.kicker).toMatch(/^Horoscope for [A-Z][a-z]+ \d{4}$/u);
    expect(month.heading).toBe(`Leo ${month.kicker.charAt(0).toLowerCase()}${month.kicker.slice(1)}`);
    expect(paragraphs).toContain(month.line);
    expect(month.line.length).toBeLessThanOrEqual(150);
    expect(month.passage).toBe(MONTHS.months[LATEST_MONTH].leo.paragraphs[0]);
    expect(month.confidence).toBe('Reading confidence 40%');
  });

  it('quote a published year, and refuse a month or year the site does not publish, or a month before its first day', () => {
    const year = model('s=aquarius&y=2026')!;
    expect(year).toMatchObject({ kicker: 'Horoscope for 2026', heading: 'Aquarius horoscope for 2026', confidence: 'Reading confidence 40%' });
    expect(model('s=leo&y=2031')).toBeNull();
    expect(model('s=leo&m=2020-01')).toBeNull();
    // A month written ahead is not shown before its first day reaches the earliest clock on Earth.
    expect(model(`s=leo&m=${LATEST_MONTH}`, new Date(Date.parse(`${LATEST_MONTH}-01T00:00:00+14:00`) - 60_000))).toBeNull();
    expect(model(`s=leo&m=${LATEST_MONTH}`, new Date(Date.parse(`${LATEST_MONTH}-01T00:00:00+14:00`)))).not.toBeNull();
    // Every sign's every published month and year has a line of its own to quote.
    for (const sign of Object.keys(MONTHS.months[LATEST_MONTH])) {
      for (const month of Object.keys(MONTHS.months)) expect(model(`s=${sign}&m=${month}`)?.confidence, `${sign} ${month}`).toBe('Reading confidence 40%');
      for (const y of ['2026', '2027']) expect(model(`s=${sign}&y=${y}`)?.confidence, `${sign} ${y}`).toBe('Reading confidence 40%');
    }
  });
});

describe('the Vedic signs share', () => {
  it('lists the sidereal signs with their Western names and the nakshatra, and says what is undetermined', () => {
    const timed = vedicSignsCardModel(parseVedicSignsShare(new URLSearchParams('s=sagittarius&m=libra&r=leo&n=15&a=lahiri'))!);
    expect(timed).toMatchObject({
      rows: [{ slug: 'sagittarius', text: 'Dhanu Sun', western: 'Sagittarius' }, { slug: 'libra', text: 'Tula Moon', western: 'Libra' }, { slug: 'leo', text: 'Simha rising', western: 'Leo' }],
      title: 'Dhanu Sun, Tula Moon, Simha rising', nakshatra: 'Moon in Swati, nakshatra 15 of 27',
      about: 'Vedic signs in the sidereal zodiac, read with the Lahiri (Chitrapaksha) ayanamsa. Moon in Swati, nakshatra 15 of 27.',
    });
    const untimed = vedicSignsCardModel(parseVedicSignsShare(new URLSearchParams('s=aries&a=raman'))!);
    expect(untimed.rows).toEqual([{ slug: 'aries', text: 'Mesha Sun', western: 'Aries' }, { slug: null, text: 'Moon sign undetermined', western: null }]);
    expect(untimed.nakshatra).toBe('Moon nakshatra undetermined');
    expect(untimed.about).toContain('needs the birth time');
  });

  it('gets its own page, preview, story and a way back to the page', async () => {
    const page = await (await handleVedicSignsLinkRequest(new Request('https://zodiacs.org/share/vedic-signs/?s=sagittarius&m=libra&r=leo&n=15&a=lahiri&ref=chatgpt'))).text();
    expect(page).toContain('<h1>Dhanu Sun, Tula Moon, Simha rising</h1>');
    expect(page).toContain('<meta property="og:image" content="https://zodiacs.org/api/og/vedic-signs-image?s=sagittarius&amp;m=libra&amp;r=leo&amp;n=15&amp;a=lahiri">');
    expect(page).toContain('<a class="cta" href="/vedic-signs/?ref=chatgpt">Find your Vedic signs</a>');
    expect(page).toContain('href="/api/og/vedic-signs-story?s=sagittarius&amp;m=libra&amp;r=leo&amp;n=15&amp;a=lahiri" download="zodiacs-vedic-signs-sagittarius-story.jpg"');
    expect(page.replace(/<style[^]*?<\/style>/u, '')).not.toMatch(/[—–]/u);
    const plain = await (await handleVedicSignsLinkRequest(new Request('https://zodiacs.org/share/vedic-signs/?s=leo&a=lahiri&d=1990-08-01'))).text();
    expect(plain).toContain('<h1>Your Vedic signs</h1>');
    expect(plain).toContain('<a class="cta" href="/vedic-signs/">Find your Vedic signs</a>');
    expect(plain).not.toContain('1990');
  });
});

describe('big three, Chinese zodiac and invitation share models', () => {
  it('list the big three, saying when the Moon is undetermined and leaving out a rising sign that is not known', () => {
    expect(bigThreeCardModel(parseBigThreeShare(new URLSearchParams('s=leo&m=aries&r=libra'))!)).toMatchObject({
      rows: [{ slug: 'leo', text: 'Leo Sun' }, { slug: 'aries', text: 'Aries Moon' }, { slug: 'libra', text: 'Libra rising' }],
      title: 'Leo Sun, Aries Moon, Libra rising', about: 'The big three: the Sun sign, the Moon sign and the rising sign.',
    });
    const untimed = bigThreeCardModel(parseBigThreeShare(new URLSearchParams('s=sagittarius'))!);
    expect(untimed.rows).toEqual([{ slug: 'sagittarius', text: 'Sagittarius Sun' }, { slug: null, text: 'Moon sign undetermined' }]);
    expect(untimed.about).toBe('The big three: the Sun sign, the Moon sign and the rising sign. The Moon changed sign on the birth day, so its sign needs the birth time. The rising sign needs the birth time and place.');
    expect(bigThreeCardModel(parseBigThreeShare(new URLSearchParams('s=leo&m=leo'))!).rows.map((row) => row.text)).toEqual(['Leo Sun', 'Leo Moon']);
  });

  it('give the animal its own element and the yin or yang of its years, and never a year', () => {
    const horse = chineseZodiacCardModel(parseChineseZodiacShare(new URLSearchParams('a=horse'))!)!;
    expect(horse).toEqual({ slug: 'horse', name: 'Horse', title: 'The Horse', detail: 'Its element is fire, and Horse years are yang', element: 'fire', yinYang: 'yang', branch: '午',
      association: expect.any(String), context: expect.any(String) });
    expect(chineseZodiacCardModel(parseChineseZodiacShare(new URLSearchParams('a=ox'))!)).toMatchObject({ title: 'The Ox', detail: 'Its element is earth, and Ox years are yin' });
    // The animals' own elements, from their Earthly Branches, in the cycle's order.
    expect(['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig'].map((animal) => chineseZodiacCardModel({ animal, ref: null })!.element))
      .toEqual(['water', 'earth', 'wood', 'wood', 'earth', 'fire', 'fire', 'earth', 'metal', 'metal', 'earth', 'water']);
    // An older link's year opens the same card: the year is gone, and nothing on the card is a year's own.
    expect(chineseZodiacCardModel(parseChineseZodiacShare(new URLSearchParams('a=horse&y=1990'))!)).toEqual(horse);
    expect(`${horse.title} ${horse.detail}`).not.toMatch(/\d/u);
  });

  it('name the two Sun signs of an invitation, or the one that is known', () => {
    expect(inviteCardModel(parseInviteShare(new URLSearchParams('s=taurus&p=scorpio'))!)).toMatchObject({ line: 'Taurus and Scorpio. Two birth charts, read together.', front: 'taurus' });
    expect(inviteCardModel(parseInviteShare(new URLSearchParams('p=scorpio'))!)).toMatchObject({ line: 'Scorpio Sun. Two birth charts, read together.', front: null });
  });
});

describe('chart twins, famous chart and milestone share models', () => {
  it('name the first chart twin as the tool does, and count everyone who shares the signs', () => {
    const both = chartTwinsCardModel(parseChartTwinsShare(new URLSearchParams('s=taurus&m=leo'))!, PEOPLE)!;
    expect(both.quote).toBe('Taurus Sun, like Audrey Hepburn');
    expect(both.count).toMatch(/^\d+ famous people share this Sun or Moon$/u);
    expect(both.signs.map((sign) => sign.slug)).toEqual(['taurus', 'leo']);
    const sunOnly = chartTwinsCardModel(parseChartTwinsShare(new URLSearchParams('s=taurus'))!, PEOPLE)!;
    expect(sunOnly.count).toMatch(/^\d+ famous people share this Sun$/u);
    // Someone who shares both signs comes first and is named for both.
    const twin = PEOPLE.find((person) => person.moon.sign)!;
    const pair = chartTwinsCardModel({ sun: twin.sun.sign as never, moon: twin.moon.sign as never, ref: null }, PEOPLE)!;
    expect(pair.quote).toMatch(/^[A-Z][a-z]+ Sun and [A-Z][a-z]+ Moon, like /u);
  });

  it('draw a famous chart from the directory, and nothing for a slug it does not publish', () => {
    const frida = famousChartCardModel(parseFamousChartShare(new URLSearchParams('p=frida-kahlo'))!, PEOPLE)!;
    expect(frida).toMatchObject({ name: 'Frida Kahlo', sunLine: 'Cancer Sun at 13.5°', born: 'Painter, born 6 July 1907' });
    expect(frida.lede).not.toMatch(/[—–·]/u);
    expect(famousChartCardModel({ slug: 'someone-else', ref: null }, PEOPLE)).toBeNull();
  });

  it('name a milestone and its age, with no dates, for a new link and an older one alike', () => {
    const share = parseMilestoneShare(new URLSearchParams(SATURN))!;
    const model = milestoneCardModel(share);
    expect(model).toMatchObject({ title: 'First Saturn return', heading: 'First Saturn return, at 29', line: 'Saturn comes back to its place at birth' });
    expect(milestoneCardModel(parseMilestoneShare(new URLSearchParams(SATURN_OLDER))!)).toEqual(model);
    expect(JSON.stringify(model)).not.toMatch(/2026|April|December/u);
    expect(milestoneCardModel(parseMilestoneShare(new URLSearchParams('k=uranus-opposition&i=1&a=42&f=2027-03-02&l=2027-03-02'))!)).toMatchObject({ title: 'Uranus opposition', line: 'Uranus stands opposite its place at birth' });
  });
});

describe('share link pages', () => {
  it('show the card, a line about it and the way to check your own, with the preview image', async () => {
    const response = await handleCompatibilityLinkRequest(new Request(`https://zodiacs.org/share/compatibility/?${COMPAT}&ref=chatgpt`));
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(html).not.toContain('<script');
    const image = `https://zodiacs.org/api/og/compatibility-image?${COMPAT.replaceAll('&', '&amp;')}`;
    expect(html).toContain(`<meta property="og:image" content="${image}">`);
    expect(html).toContain(`<meta name="twitter:image" content="${image}">`);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).toContain('<meta property="og:image:type" content="image/jpeg">');
    expect(html).toContain(`<img class="card" src="${image}"`);
    expect(html).toContain('<a class="cta" href="/compatibility/?ref=chatgpt">Check your own compatibility</a>');
    expect(html).toContain('<title>Leo and Libra: 78/100 on Zodiacs</title>');
    expect(html).not.toMatch(/ref=chatgpt[^"]*"[^>]*og:image|image\?[^"]*ref=/u);
    // The same result as a 1080×1920 picture, to save and post as a story.
    expect(html).toContain(`<p class="story"><a href="/api/og/compatibility-story?${COMPAT.replaceAll('&', '&amp;')}" download="zodiacs-compatibility-story.jpg">Save the picture for your story</a></p>`);
  });

  it('offer a date its own way to rate yours', async () => {
    const response = await handleOccasionLinkRequest(new Request(`https://zodiacs.org/share/occasion/?${OCCASION}`));
    const html = await response.text();
    expect(html).toContain(`content="https://zodiacs.org/api/og/occasion-image?${OCCASION.replaceAll('&', '&amp;')}"`);
    expect(html).toContain('<a class="cta" href="/occasions/">Rate your own date</a>');
    expect(html).toContain('<h1>Our wedding</h1>');
    expect(html).toContain('download="zodiacs-wedding-story.jpg"');
  });

  it('answer an older link with names and a place with a 303 to the same address without them', async () => {
    const names = /Ana|Luis|Florence|[?&](?:a|b|n|p)=/u;
    const cases = [
      [handleCompatibilityLinkRequest, '/share/compatibility/', COMPAT_NAMED, COMPAT],
      [handleOccasionLinkRequest, '/share/occasion/', OCCASION_NAMED, OCCASION],
      [handleCompatibilityImageRequest, '/api/og/compatibility-image', COMPAT_NAMED, COMPAT],
      [handleCompatibilityStoryRequest, '/api/og/compatibility-story', COMPAT_NAMED, COMPAT],
      [handleOccasionImageRequest, '/api/og/occasion-image', OCCASION_NAMED, OCCASION],
      [handleOccasionStoryRequest, '/api/og/occasion-story', OCCASION_NAMED, OCCASION],
    ] as const;
    for (const [handle, path, named, plain] of cases) {
      const response = await handle(new Request(`https://zodiacs.org${path}?${named}&ref=chatgpt`));
      expect(response.status, path).toBe(303);
      expect(response.headers.get('cache-control'), path).toBe('no-store, max-age=0');
      const location = response.headers.get('location')!;
      expect(location, path).toBe(`https://zodiacs.org${path}?${plain}&ref=chatgpt`);
      expect(location, path).not.toMatch(names);
      expect(await response.text(), path).toBe('');
    }
  });

  it('send a birthday, a baby or a coming of age date link away, keeping a birthday’s month and day only', async () => {
    const birthday = await handleOccasionLinkRequest(new Request('https://zodiacs.org/share/occasion/?o=birthday&d=1987-03-14&n=Qwertina&p=Zzyzx&sun=pisces&moon=leo&score=70&v=good'));
    expect(birthday.status).toBe(303);
    expect(birthday.headers.get('location')).toBe('https://zodiacs.org/share/birthday/?d=03-14');
    for (const occasion of ['baby', 'coming-of-age']) {
      const response = await handleOccasionLinkRequest(new Request(`https://zodiacs.org/share/occasion/?o=${occasion}&d=2008-03-14&sun=pisces&moon=leo&score=70&v=good`));
      expect(response.status, occasion).toBe(303);
      expect(response.headers.get('location'), occasion).toBe('https://zodiacs.org/share/occasion/');
    }
    for (const handle of [handleOccasionImageRequest, handleOccasionStoryRequest]) {
      for (const occasion of ['birthday', 'baby', 'coming-of-age']) {
        const response = await handle(new Request(`https://zodiacs.org/api/og/occasion-image?o=${occasion}&d=1987-03-14&sun=pisces&moon=leo&score=70&v=good`));
        expect(response.status, occasion).toBe(303);
        expect(response.headers.get('location'), occasion).toBe('https://zodiacs.org/assets/og/v2/share.png');
      }
    }
  });

  it('send a birth occasion away when its keys are repeated or joined by others', async () => {
    const page = await handleOccasionLinkRequest(new Request('https://zodiacs.org/share/occasion/?o=birthday&d=1987-03-14&ref=chatgpt&ref=assistant&sun=pisces&moon=leo&score=70&v=good'));
    expect(page.status).toBe(303);
    expect(page.headers.get('location')).toBe('https://zodiacs.org/share/birthday/?d=03-14');
    const hidden = await handleOccasionLinkRequest(new Request('https://zodiacs.org/share/occasion/?o=wedding&o=birthday&d=1987-03-14&sun=pisces&moon=leo&score=70&v=good'));
    expect(hidden.status).toBe(303);
    expect(hidden.headers.get('location')).toBe('https://zodiacs.org/share/birthday/?d=03-14');
    for (const handle of [handleOccasionImageRequest, handleOccasionStoryRequest]) {
      const response = await handle(new Request('https://zodiacs.org/api/og/occasion-image?o=baby&o=baby&d=2008-03-14&fbclid=IwAR0&sun=pisces&moon=leo&score=70&v=good'));
      expect(response.status).toBe(303);
      expect(response.headers.get('location')).toBe('https://zodiacs.org/assets/og/v2/share.png');
    }
    const names = await handleOccasionLinkRequest(new Request(`https://zodiacs.org/share/occasion/?${OCCASION}&n=Qwertina&n=Zolvar`));
    expect(names.status).toBe(303);
    expect(names.headers.get('location')).toBe(`https://zodiacs.org/share/occasion/?${OCCASION}`);
    const year = await handleChineseZodiacLinkRequest(new Request('https://zodiacs.org/share/chinese-zodiac/?a=horse&y=1990&y=2002'));
    expect(year.status).toBe(303);
    expect(year.headers.get('location')).toBe('https://zodiacs.org/share/chinese-zodiac/?a=horse');
  });

  it('send a milestone’s pass days and a Chinese zodiac year away with a 303', async () => {
    const cases = [
      [handleMilestoneLinkRequest, '/share/milestone/', SATURN_OLDER, SATURN],
      [handleMilestoneImageRequest, '/api/og/milestone-image', SATURN_OLDER, SATURN],
      [handleMilestoneStoryRequest, '/api/og/milestone-story', SATURN_OLDER, SATURN],
      [handleChineseZodiacLinkRequest, '/share/chinese-zodiac/', 'a=horse&y=1990', 'a=horse'],
      [handleChineseZodiacImageRequest, '/api/og/chinese-zodiac-image', 'a=horse&y=1990', 'a=horse'],
      [handleChineseZodiacStoryRequest, '/api/og/chinese-zodiac-story', 'a=horse&y=1990', 'a=horse'],
    ] as const;
    for (const [handle, path, older, plain] of cases) {
      const response = await handle(new Request(`https://zodiacs.org${path}?${older}`));
      expect(response.status, path).toBe(303);
      expect(response.headers.get('location'), path).toBe(`https://zodiacs.org${path}?${plain}`);
    }
  });

  it('open the plain page, with the site’s own card, for a query that is not a share', async () => {
    const response = await handleCompatibilityLinkRequest(new Request('https://zodiacs.org/share/compatibility/?as=%3Cscript%3E&score=78'));
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('content="https://zodiacs.org/assets/og/v2/tool/compatibility.png"');
    expect(html).toContain('<meta property="og:image:type" content="image/png">');
    expect(html).not.toContain('script%3E');
    expect(html).not.toContain('<script');
    const occasion = await (await handleOccasionLinkRequest(new Request('https://zodiacs.org/share/occasion/?o=wedding&d=2027-06-12&lat=1'))).text();
    expect(occasion).toContain('content="https://zodiacs.org/assets/og/v2/share.png"');
    expect(html).not.toContain('class="story"');
  });

  it('give a birthday, the sky calendar and a horoscope their own page, preview and way to try it', async () => {
    const birthday = await (await handleBirthdayLinkRequest(new Request('https://zodiacs.org/share/birthday/?d=05-03&ref=chatgpt'))).text();
    expect(birthday).toContain('<title>3 May birthdays: Taurus Sun on Zodiacs</title>');
    expect(birthday).toContain('<meta property="og:image" content="https://zodiacs.org/api/og/birthday-image?d=05-03">');
    expect(birthday).toContain('<meta property="og:image:type" content="image/jpeg">');
    expect(birthday).toContain('<a class="cta" href="/birthday/?ref=chatgpt">Find your own birthday</a>');
    // The brand lockup, as in the nav: the tilted mark and ZODIACS · ORG, named Zodiacs.org.
    expect(birthday).toMatch(/<a class="brand" href="\/" aria-label="Zodiacs\.org"><svg viewBox="-2 4 28 16"[^>]*>(?:<circle [^>]+\/>){12}<\/svg><span class="brand-name" aria-hidden="true">Zodiacs<span class="brand-sep">·<\/span><span class="brand-tld">org<\/span><\/span><\/a>/u);
    expect(birthday).not.toContain('class="more"');
    expect(birthday).toContain('<a href="/api/og/birthday-story?d=05-03" download="zodiacs-may-3-birthday-story.jpg">Save the picture for your story</a>');
    // A date with a famous birthday names them, and links their chart.
    const famous = await (await handleBirthdayLinkRequest(new Request('https://zodiacs.org/share/birthday/?d=05-04'))).text();
    expect(famous).toContain('<title>4 May birthdays: Taurus Sun, like Audrey Hepburn on Zodiacs</title>');
    expect(famous).toContain('Audrey Hepburn was born on this date.');
    expect(famous).toContain('<a class="more" href="/people/audrey-hepburn/">Audrey Hepburn’s chart</a>');
    const sky = await (await handleSkyCalendarLinkRequest(new Request('https://zodiacs.org/share/sky-calendar/?k=retrograde&b=mercury&d=2026-10-24'))).text();
    expect(sky).toContain('content="https://zodiacs.org/api/og/sky-calendar-image?k=retrograde&amp;b=mercury&amp;d=2026-10-24"');
    expect(sky).toContain('Mercury retrograde: Saturday 24 October to Friday 13 November.');
    expect(sky).toContain('<a class="cta" href="/sky-calendar/">Add it to your calendar</a>');
    expect(sky).toContain('href="/api/og/sky-calendar-story?k=retrograde&amp;b=mercury&amp;d=2026-10-24" download="zodiacs-sky-calendar-story.jpg"');
    const horoscope = await (await handleHoroscopeLinkRequest(new Request(`https://zodiacs.org/share/horoscope/?s=leo&d=${TODAY}`))).text();
    expect(horoscope).toContain(`content="https://zodiacs.org/api/og/horoscope-image?s=leo&amp;d=${TODAY}"`);
    expect(horoscope).toMatch(/<h1>Leo horoscope for [A-Z][a-z]+day \d{1,2} [A-Z][a-z]+<\/h1>/u);
    expect(horoscope).toContain('<a class="cta" href="/horoscopes/">Read your own horoscope</a>');
    expect(horoscope).toContain(`href="/api/og/horoscope-story?s=leo&amp;d=${TODAY}" download="zodiacs-leo-horoscope-story.jpg"`);
    expect(horoscope).not.toMatch(/[—–]/u);
    // A link that does not match the site's data opens the plain page.
    expect(await (await handleBirthdayLinkRequest(new Request('https://zodiacs.org/share/birthday/?d=05-03&s=leo'))).text()).toContain('content="https://zodiacs.org/assets/og/v2/tool/birthday.png"');
    expect(await (await handleSkyCalendarLinkRequest(new Request('https://zodiacs.org/share/sky-calendar/?k=full-moon&d=2026-10-27'))).text()).toContain('content="https://zodiacs.org/assets/og/v2/tool/sky-calendar.png"');
    expect(await (await handleHoroscopeLinkRequest(new Request('https://zodiacs.org/share/horoscope/?s=leo&text=Win'))).text()).toContain('content="https://zodiacs.org/assets/og/v2/tool/horoscopes.png"');
    expect(await (await handleHoroscopeLinkRequest(new Request('https://zodiacs.org/share/horoscope/?s=leo&d=2199-01-01'))).text()).toContain('content="https://zodiacs.org/assets/og/v2/tool/horoscopes.png"');
    // A reading that has left the window keeps its sign and day.
    const gone = await (await handleHoroscopeLinkRequest(new Request('https://zodiacs.org/share/horoscope/?s=leo&d=2026-09-01'))).text();
    expect(gone).toContain('<h1>Leo horoscope for Tuesday 1 September</h1>');
    expect(gone).toContain('content="Leo, Jul 23 to Aug 22. Zodiacs writes a horoscope for each Sun sign every day."');
  });

  it('give chart twins, a famous chart and a milestone their own page, preview, story and way to try it', async () => {
    const twins = await (await handleChartTwinsLinkRequest(new Request('https://zodiacs.org/share/chart-twins/?s=taurus&m=leo&ref=chatgpt'))).text();
    expect(twins).toContain('<h1>Taurus Sun, like Audrey Hepburn</h1>');
    expect(twins).toContain('<meta property="og:image" content="https://zodiacs.org/api/og/chart-twins-image?s=taurus&amp;m=leo">');
    expect(twins).toContain('<a class="cta" href="/chart-twins/?ref=chatgpt">Find your chart twins</a>');
    expect(twins).toContain('<a class="more" href="/people/audrey-hepburn/?ref=chatgpt">Audrey Hepburn’s chart</a>');
    expect(twins).toContain('href="/api/og/chart-twins-story?s=taurus&amp;m=leo" download="zodiacs-chart-twins-taurus-story.jpg"');
    const famous = await (await handleFamousChartLinkRequest(new Request('https://zodiacs.org/share/famous-chart/?p=frida-kahlo'))).text();
    expect(famous).toContain('<title>Frida Kahlo’s birth chart on Zodiacs</title>');
    expect(famous).toContain('content="https://zodiacs.org/api/og/famous-chart-image?p=frida-kahlo"');
    expect(famous).toContain('<a class="cta" href="/people/frida-kahlo/">Open Frida Kahlo’s chart</a>');
    expect(famous).toContain('a reference instant, not a birth time.');
    const milestone = await (await handleMilestoneLinkRequest(new Request(`https://zodiacs.org/share/milestone/?${SATURN}`))).text();
    expect(milestone).toContain('<h1>First Saturn return, at 29</h1>');
    expect(milestone).toContain('Saturn comes back to its place at birth.');
    expect(milestone).toContain('<a class="cta" href="/occasions/milestones/">Find your own milestones</a>');
    expect(milestone).toContain(`content="https://zodiacs.org/api/og/milestone-image?${SATURN.replaceAll('&', '&amp;')}"`);
    // An older link is sent to the same address without its dates, which then opens this page.
    const olderResponse = await handleMilestoneLinkRequest(new Request(`https://zodiacs.org/share/milestone/?${SATURN_OLDER}`));
    expect(olderResponse.status).toBe(303);
    expect(olderResponse.headers.get('location')).toBe(`https://zodiacs.org/share/milestone/?${SATURN}`);
    const older = await (await handleMilestoneLinkRequest(new Request(olderResponse.headers.get('location')!))).text();
    expect(older).toBe(milestone);
    for (const page of [milestone, older]) expect(page).not.toMatch(/2026-04-23|2026-12-31|23 April|31 December|[?;]f=|[?;]l=/u);
    for (const page of [twins, famous, milestone]) expect(page.replace(/<style[^]*?<\/style>/u, '')).not.toMatch(/[—–]/u);
    // A bare address opens the directory; a named person absent from the directory is not a share.
    expect(await (await handleFamousChartLinkRequest(new Request('https://zodiacs.org/share/famous-chart/'))).text()).toContain('<h1>Famous birth charts</h1>');
    expect((await handleFamousChartLinkRequest(new Request('https://zodiacs.org/share/famous-chart/?p=someone-else'))).status).toBe(404);
    expect(await (await handleChartTwinsLinkRequest(new Request('https://zodiacs.org/share/chart-twins/?s=taurus&d=1990-05-03'))).text()).toContain('content="https://zodiacs.org/assets/og/v2/tool/chart-twins.png"');
    expect(await (await handleMilestoneLinkRequest(new Request('https://zodiacs.org/share/milestone/?k=saturn-return&i=1&a=12'))).text()).toContain('content="https://zodiacs.org/assets/og/v2/tool/saturn-return.png"');
    expect((await handleMilestoneLinkRequest(new Request('https://zodiacs.org/share/milestone/?k=saturn-return&i=1&a=12&f=2026-04-23&l=2026-12-31'))).headers.get('location'))
      .toBe('https://zodiacs.org/share/milestone/?k=saturn-return&i=1&a=12');
  });

  it('give the big three, the Chinese zodiac and an invitation their own page, preview, story and way to try it', async () => {
    const big = await (await handleBigThreeLinkRequest(new Request('https://zodiacs.org/share/big-three/?s=leo&m=aries&r=libra&ref=chatgpt'))).text();
    expect(big).toContain('<h1>Leo Sun, Aries Moon, Libra rising</h1>');
    expect(big).toContain('<meta property="og:image" content="https://zodiacs.org/api/og/big-three-image?s=leo&amp;m=aries&amp;r=libra">');
    expect(big).toContain('<a class="cta" href="/big-three/?ref=chatgpt">Find your big three</a>');
    expect(big).toContain('<a class="more" href="/birth-chart/?ref=chatgpt">Open the birth chart page</a>');
    expect(big).toContain('href="/api/og/big-three-story?s=leo&amp;m=aries&amp;r=libra" download="zodiacs-big-three-leo-story.jpg"');
    expect(big).toContain(NATAL_NOTE);
    const untimed = await (await handleBigThreeLinkRequest(new Request('https://zodiacs.org/share/big-three/?s=sagittarius'))).text();
    expect(untimed).toContain('<h1>Sagittarius Sun, Moon sign undetermined</h1>');
    const chinese = await (await handleChineseZodiacLinkRequest(new Request('https://zodiacs.org/share/chinese-zodiac/?a=horse'))).text();
    expect(chinese).toContain('<title>The Horse: the Chinese zodiac on Zodiacs</title>');
    expect(chinese).toContain('content="https://zodiacs.org/api/og/chinese-zodiac-image?a=horse"');
    expect(chinese).toContain('Its element is fire, and Horse years are yang. Fire is the Horse’s own element, from its Earthly Branch 午, whatever the year.');
    expect(chinese).toContain('<a class="cta" href="/learn/chinese-zodiac/horse/">Read about the Horse</a>');
    expect(chinese).toContain('<a class="more" href="/learn/chinese-zodiac/">All twelve animals</a>');
    expect(chinese).toContain(CHINESE_ZODIAC_NOTE);
    // An older link with its year is sent to the address without it, which opens drawn and linked without it.
    const animalResponse = await handleChineseZodiacLinkRequest(new Request('https://zodiacs.org/share/chinese-zodiac/?a=snake&y=1989'));
    expect(animalResponse.status).toBe(303);
    expect(animalResponse.headers.get('location')).toBe('https://zodiacs.org/share/chinese-zodiac/?a=snake');
    const animal = await (await handleChineseZodiacLinkRequest(new Request(animalResponse.headers.get('location')!))).text();
    expect(animal).toContain('<h1>The Snake</h1>');
    expect(animal).toContain('Its element is fire, and Snake years are yin.');
    expect(animal).toContain('content="https://zodiacs.org/api/og/chinese-zodiac-image?a=snake"');
    expect(animal).toContain('href="/api/og/chinese-zodiac-story?a=snake"');
    expect(animal.replace(/<style[^]*?<\/style>/u, '')).not.toMatch(/\b(?:18|19|20|21)\d\d\b/u);
    const invite = await (await handleInviteLinkRequest(new Request('https://zodiacs.org/share/invite/?s=taurus&p=scorpio&ref=chatgpt'))).text();
    expect(invite).toContain('<h1>Compare our charts</h1>');
    expect(invite).toContain('content="https://zodiacs.org/api/og/invite-image?s=taurus&amp;p=scorpio"');
    expect(invite).toContain('<a class="cta" href="/compatibility/invite/?ref=chatgpt">Make an invite link</a>');
    expect(invite).toContain('<a class="more" href="/compatibility/?ref=chatgpt">Compare two charts now</a>');
    expect(invite).toContain('Taurus and Scorpio. Two birth charts, read together.');
    for (const page of [big, untimed, chinese, animal, invite]) expect(page.replace(/<style[^]*?<\/style>/u, '')).not.toMatch(/[—–]/u);
    // A bare address or a query that is not a share opens the plain page, with the site's own card.
    expect(await (await handleBigThreeLinkRequest(new Request('https://zodiacs.org/share/big-three/?s=leo&d=1990-08-01'))).text()).toContain('content="https://zodiacs.org/assets/og/v2/tool/big-three.png"');
    expect(await (await handleChineseZodiacLinkRequest(new Request('https://zodiacs.org/share/chinese-zodiac/?a=dragonfly'))).text()).toContain('<h1>The Chinese zodiac</h1>');
    const bare = await (await handleInviteLinkRequest(new Request('https://zodiacs.org/share/invite/'))).text();
    expect(bare).toContain('content="https://zodiacs.org/assets/og/v2/tool/compatibility-private-invite.png"');
    expect(bare).toContain('<a class="cta" href="/compatibility/invite/">Make an invite link</a>');
  });

  it('give a month\'s and a year\'s horoscope the horoscope page, with the reading, its confidence and the period\'s own page', async () => {
    vi.useFakeTimers({ now: SERVED, toFake: ['Date'] });
    try {
      const month = await (await handleHoroscopeLinkRequest(new Request(`https://zodiacs.org/share/horoscope/?s=leo&m=${LATEST_MONTH}&ref=chatgpt`))).text();
      expect(month).toMatch(/<h1>Leo horoscope for [A-Z][a-z]+ \d{4}<\/h1>/u);
      expect(month).toContain(`content="https://zodiacs.org/api/og/horoscope-image?s=leo&amp;m=${LATEST_MONTH}"`);
      expect(month).toContain('Reading confidence 40%.');
      expect(month).toContain('<a class="more" href="/horoscopes/leo/monthly/?ref=chatgpt">Leo’s monthly horoscope</a>');
      expect(month).toContain(HOROSCOPE_DISCLOSURE);
      const year = await (await handleHoroscopeLinkRequest(new Request('https://zodiacs.org/share/horoscope/?s=leo&y=2027'))).text();
      expect(year).toContain('<h1>Leo horoscope for 2027</h1>');
      expect(year).toContain('<a class="more" href="/horoscopes/leo/2027/">Leo’s 2027 horoscope</a>');
      expect(await (await handleHoroscopeLinkRequest(new Request('https://zodiacs.org/share/horoscope/?s=leo&y=2031'))).text()).toContain('content="https://zodiacs.org/assets/og/v2/tool/horoscopes.png"');
    } finally { vi.useRealTimers(); }
  });

  it('carry the reading confidence on the compatibility, date and horoscope pages', async () => {
    const compat = await (await handleCompatibilityLinkRequest(new Request(`https://zodiacs.org/share/compatibility/?${COMPAT}&c=75`))).text();
    expect(compat).toContain('Sun signs’ elements. Reading confidence 75%.</p>');
    expect(compat).toContain(`content="https://zodiacs.org/api/og/compatibility-image?${COMPAT.replaceAll('&', '&amp;')}&amp;c=75"`);
    const date = await (await handleOccasionLinkRequest(new Request(`https://zodiacs.org/share/occasion/?${OCCASION}&c=70`))).text();
    expect(date).toContain('any planets in retrograde. Reading confidence 70%.');
    const day = await (await handleHoroscopeLinkRequest(new Request(`https://zodiacs.org/share/horoscope/?s=leo&d=${TODAY}`))).text();
    expect(day).toContain('Reading confidence 40%.');
    expect(await (await handleCompatibilityLinkRequest(new Request(`https://zodiacs.org/share/compatibility/?${COMPAT}`))).text()).not.toContain('Reading confidence');
  });

  it('refuse other methods', async () => {
    expect((await handleCompatibilityLinkRequest(new Request(`https://zodiacs.org/share/compatibility/?${COMPAT}`, { method: 'POST' }))).status).toBe(405);
    expect((await handleOccasionImageRequest(new Request(`https://zodiacs.org/api/og/occasion-image?${OCCASION}`, { method: 'POST' }))).status).toBe(405);
  });
});

describe('the deployed entry', () => {
  it('is reached through the existing compatibility function', async () => {
    const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8'));
    for (const [source, route] of [
      ['/share/compatibility/', 'compatibility-link'], ['/api/og/compatibility-image', 'compatibility-image'],
      ['/share/occasion/', 'occasion-link'], ['/api/og/occasion-image', 'occasion-image'],
      ['/share/birthday/', 'birthday-link'], ['/api/og/birthday-image', 'birthday-image'],
      ['/share/sky-calendar/', 'sky-calendar-link'], ['/api/og/sky-calendar-image', 'sky-calendar-image'],
      ['/share/horoscope/', 'horoscope-link'], ['/api/og/horoscope-image', 'horoscope-image'],
      ['/api/og/compatibility-story', 'compatibility-story'], ['/api/og/occasion-story', 'occasion-story'],
      ['/api/og/birthday-story', 'birthday-story'], ['/api/og/sky-calendar-story', 'sky-calendar-story'],
      ['/api/og/horoscope-story', 'horoscope-story'],
      ['/share/chart-twins/', 'chart-twins-link'], ['/api/og/chart-twins-image', 'chart-twins-image'], ['/api/og/chart-twins-story', 'chart-twins-story'],
      ['/share/famous-chart/', 'famous-chart-link'], ['/api/og/famous-chart-image', 'famous-chart-image'], ['/api/og/famous-chart-story', 'famous-chart-story'],
      ['/share/milestone/', 'milestone-link'], ['/api/og/milestone-image', 'milestone-image'], ['/api/og/milestone-story', 'milestone-story'],
      ['/share/big-three/', 'big-three-link'], ['/api/og/big-three-image', 'big-three-image'], ['/api/og/big-three-story', 'big-three-story'],
      ['/share/chinese-zodiac/', 'chinese-zodiac-link'], ['/api/og/chinese-zodiac-image', 'chinese-zodiac-image'], ['/api/og/chinese-zodiac-story', 'chinese-zodiac-story'],
      ['/share/invite/', 'invite-link'], ['/api/og/invite-image', 'invite-image'], ['/api/og/invite-story', 'invite-story'],
      ['/share/vedic-signs/', 'vedic-signs-link'], ['/api/og/vedic-signs-image', 'vedic-signs-image'], ['/api/og/vedic-signs-story', 'vedic-signs-story'],
    ]) expect(vercel.rewrites).toContainEqual({ source, destination: `/api/compatibility?__zodiacs_share=${route}` });
    // Every route the function answers is reached by one rewrite, and every share rewrite names a route it answers.
    const shareRewrites = (vercel.rewrites as { source: string; destination: string }[]).filter((rewrite) => rewrite.destination.includes('__zodiacs_share='));
    expect(shareRewrites.map((rewrite) => rewrite.destination.split('__zodiacs_share=')[1]).sort()).toEqual([...RESULT_SHARE_ROUTES].sort());
    const source = readFileSync(new URL('../../api/compatibility.ts', import.meta.url), 'utf8');
    expect(source).toContain("from '../src/server/result-preview.js'");
  });


  it('passes on only the route’s own keys, and the image refuses anything else', async () => {
    const res = nodeResponse();
    await handleResultShareNodeRequest({ method: 'GET', headers: { host: 'zodiacs.org' }, query: { __zodiacs_share: 'compatibility-image', ...Object.fromEntries(new URLSearchParams(COMPAT)), lat: '1' } }, res, 'compatibility-image');
    expect(res.statusCode).toBe(400);
    expect(res.headers.get('cache-control')).toBe('no-store, max-age=0');
    // The story picture is held to the same rule.
    const story = nodeResponse();
    await handleResultShareNodeRequest({ method: 'GET', headers: { host: 'zodiacs.org' }, query: { __zodiacs_share: 'birthday-story', d: '05-03', fbclid: 'IwAR0' } }, story, 'birthday-story');
    expect(story.statusCode).toBe(400);

    // A repeated key the page uses opens the plain page, without a result.
    const repeated = nodeResponse();
    await handleResultShareNodeRequest({ method: 'GET', headers: { host: 'zodiacs.org' }, query: { __zodiacs_share: 'compatibility-link', ...Object.fromEntries(new URLSearchParams(COMPAT)), score: ['78', '79'] } }, repeated, 'compatibility-link');
    expect(repeated.statusCode).toBe(200);
    expect(repeated.body.toString()).toContain('Compare two birth charts');

    // Repeated names are retired keys: the 303 clears them, however many there are.
    const named = nodeResponse();
    await handleResultShareNodeRequest({ method: 'GET', headers: { host: 'zodiacs.org' }, query: { __zodiacs_share: 'compatibility-link', ...Object.fromEntries(new URLSearchParams(COMPAT)), a: ['Ana', 'Eve'] } }, named, 'compatibility-link');
    expect(named.statusCode).toBe(303);
    expect(named.headers.get('location')).toBe(`https://zodiacs.org/share/compatibility/?${COMPAT}`);

    // Apps add their own keys as a link is opened; the page keeps the result.
    const opened = nodeResponse();
    await handleResultShareNodeRequest({ method: 'GET', headers: { host: 'zodiacs.org' }, query: { __zodiacs_share: 'compatibility-link', ...Object.fromEntries(new URLSearchParams(COMPAT)), fbclid: 'IwAR0', utm_source: 'share' } }, opened, 'compatibility-link');
    expect(opened.statusCode).toBe(200);
    expect(opened.body.toString()).not.toContain('Compare two birth charts');
    expect(opened.body.toString()).toContain('content="https://zodiacs.org/api/og/compatibility-image?');
    expect(opened.body.toString()).not.toContain('fbclid');

    const page = nodeResponse();
    await handleResultShareNodeRequest({ method: 'GET', headers: { host: 'evil.example' }, query: { __zodiacs_share: 'occasion-link', ...Object.fromEntries(new URLSearchParams(OCCASION)) } }, page, 'occasion-link');
    expect(page.statusCode).toBe(200);
    expect(page.body.toString()).toContain('content="https://zodiacs.org/api/og/occasion-image?');
  });
});

describe('retired links through the deployed entry', () => {
  type Query = Record<string, string | string[]>;
  const node = async (route: (typeof RESULT_SHARE_ROUTES)[number], query: Query, method = 'GET') => {
    const res = nodeResponse();
    await handleResultShareNodeRequest({ method, headers: { host: 'zodiacs.org' }, query: { __zodiacs_share: route, ...query } }, res, route);
    return res;
  };
  const BIRTH = { d: '1987-03-14', sun: 'pisces', moon: 'leo', score: '70', v: 'good' };
  const PERSONAL = /1987|Qwertina|Zolvar|Zzyzx|Florence|Ana|Luis|Eve|1990/u;

  it('sends a birthday link with a repeated ref to the birthday page, with the month and day only', async () => {
    const res = await node('occasion-link', { o: 'birthday', ...BIRTH, ref: ['chatgpt', 'assistant'] });
    expect(res.statusCode).toBe(303);
    const location = res.headers.get('location')!;
    expect(location).toBe('https://zodiacs.org/share/birthday/?d=03-14');
    expect(location).not.toContain('1987');
    expect(location).not.toContain('1987-03-14');
    expect(res.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(res.body.length).toBe(0);
  });

  it('reads every occasion and every date, so a repeated key cannot hide a birthday', async () => {
    for (const query of [
      { o: ['wedding', 'birthday'], ...BIRTH },
      { o: 'birthday', ...BIRTH, d: ['03-14', '1987-03-14'] },
      { o: 'birthday', ...BIRTH, fbclid: 'IwAR0', utm_source: 'share' },
    ] as Query[]) {
      const res = await node('occasion-link', query);
      expect(res.statusCode, JSON.stringify(query)).toBe(303);
      expect(res.headers.get('location'), JSON.stringify(query)).toBe('https://zodiacs.org/share/birthday/?d=03-14');
    }
    for (const occasion of ['baby', 'coming-of-age']) {
      const res = await node('occasion-link', { o: occasion, ...BIRTH, ref: ['a', 'b'], n: ['Qwertina', 'Zolvar'] });
      expect(res.statusCode, occasion).toBe(303);
      expect(res.headers.get('location'), occasion).toBe('https://zodiacs.org/share/occasion/');
    }
  });

  it('clears repeated names and places from an occasion link, keeping the rest of the address', async () => {
    const res = await node('occasion-link', { ...Object.fromEntries(new URLSearchParams(OCCASION)), n: ['Qwertina', 'Zolvar'], p: 'Zzyzx Canary', ref: ['chatgpt', 'assistant'] });
    expect(res.statusCode).toBe(303);
    const location = res.headers.get('location')!;
    expect(location).toBe(`https://zodiacs.org/share/occasion/?${OCCASION}&ref=chatgpt&ref=assistant`);
    expect(location).not.toMatch(PERSONAL);
  });

  it('clears a repeated Chinese zodiac year, on the page and on both pictures', async () => {
    for (const [route, path] of [
      ['chinese-zodiac-link', '/share/chinese-zodiac/'],
      ['chinese-zodiac-image', '/api/og/chinese-zodiac-image'],
      ['chinese-zodiac-story', '/api/og/chinese-zodiac-story'],
    ] as const) {
      const res = await node(route, { a: 'horse', y: ['1990', '2002'] });
      expect(res.statusCode, route).toBe(303);
      expect(res.headers.get('location'), route).toBe(`https://zodiacs.org${path}?a=horse`);
    }
  });

  it('clears repeated names, pass days and extra keys from every family’s pictures before the query is checked', async () => {
    const cases = [
      ['compatibility-image', '/api/og/compatibility-image', { ...Object.fromEntries(new URLSearchParams(COMPAT)), a: ['Ana', 'Eve'], b: 'Luis', fbclid: 'IwAR0' }, `${COMPAT}&fbclid=IwAR0`],
      ['compatibility-story', '/api/og/compatibility-story', { ...Object.fromEntries(new URLSearchParams(COMPAT)), a: 'Ana' }, COMPAT],
      ['occasion-image', '/api/og/occasion-image', { ...Object.fromEntries(new URLSearchParams(OCCASION)), n: ['Ana', 'Luis'], utm_source: 'share' }, `${OCCASION}&utm_source=share`],
      ['occasion-story', '/api/og/occasion-story', { ...Object.fromEntries(new URLSearchParams(OCCASION)), p: ['Florence', 'Florence'] }, OCCASION],
      ['milestone-link', '/share/milestone/', { ...Object.fromEntries(new URLSearchParams(SATURN)), f: ['2026-04-23', '2026-04-24'], l: '2026-12-31', ref: ['a', 'b'] }, `${SATURN}&ref=a&ref=b`],
      ['milestone-image', '/api/og/milestone-image', { ...Object.fromEntries(new URLSearchParams(SATURN)), f: '2026-04-23', lat: '1' }, `${SATURN}&lat=1`],
    ] as const;
    for (const [route, path, query, kept] of cases) {
      const res = await node(route, query as Query);
      expect(res.statusCode, route).toBe(303);
      expect(res.headers.get('location'), route).toBe(`https://zodiacs.org${path}?${kept}`);
      expect(res.headers.get('location'), route).not.toMatch(PERSONAL);
    }
  });

  it('sends a birth occasion’s picture to the default share picture, with extra or repeated keys, never a 400', async () => {
    for (const route of ['occasion-image', 'occasion-story'] as const) {
      for (const query of [
        { o: 'birthday', ...BIRTH, fbclid: 'IwAR0' },
        { o: 'baby', ...BIRTH, ref: ['chatgpt', 'assistant'] },
        { o: 'coming-of-age', ...BIRTH, d: ['2008-03-14', '2008-03-15'], lat: '43.2567' },
        { o: ['birthday', 'birthday'], ...BIRTH },
      ] as Query[]) {
        const res = await node(route, query);
        expect(res.statusCode, `${route} ${JSON.stringify(query)}`).toBe(303);
        expect(res.headers.get('location'), route).toBe('https://zodiacs.org/assets/og/v2/share.png');
      }
    }
  });

  it('leaves a link with no retired key to the usual checks', async () => {
    const image = await node('occasion-image', { ...Object.fromEntries(new URLSearchParams(OCCASION)), lat: '1' });
    expect(image.statusCode).toBe(400);
    const page = await node('chinese-zodiac-link', { a: 'horse', fbclid: 'IwAR0' });
    expect(page.statusCode).toBe(200);
    // Only a GET is redirected; anything else keeps its refusal.
    const post = await node('occasion-link', { o: 'birthday', ...BIRTH }, 'POST');
    expect(post.statusCode).toBe(405);
  });
});

describe('share preview images', () => {
  it.each([
    ['compatibility', () => handleCompatibilityImageRequest(new Request(`https://zodiacs.org/api/og/compatibility-image?${COMPAT}`))],
    ['date', () => handleOccasionImageRequest(new Request(`https://zodiacs.org/api/og/occasion-image?${OCCASION}`))],
    ['one unknown sign', () => handleCompatibilityImageRequest(new Request('https://zodiacs.org/api/og/compatibility-image?bs=pisces&score=41&attraction=55&communication=38&stability=30&v=challenging'))],
    ['birthday', () => handleBirthdayImageRequest(new Request('https://zodiacs.org/api/og/birthday-image?d=05-03'))],
    ['cusp birthday', () => handleBirthdayImageRequest(new Request('https://zodiacs.org/api/og/birthday-image?d=04-20'))],
    ['famous birthday', () => handleBirthdayImageRequest(new Request('https://zodiacs.org/api/og/birthday-image?d=01-19&s=aquarius'))],
    ['sky calendar', () => handleSkyCalendarImageRequest(new Request('https://zodiacs.org/api/og/sky-calendar-image?k=retrograde&b=mercury&d=2026-10-24'))],
    ['horoscope', () => handleHoroscopeImageRequest(new Request(`https://zodiacs.org/api/og/horoscope-image?s=leo&d=${TODAY}`))],
    ['week’s horoscope', () => handleHoroscopeImageRequest(new Request(`https://zodiacs.org/api/og/horoscope-image?s=sagittarius&w=${WEEK.from}`))],
    ['chart twins', () => handleChartTwinsImageRequest(new Request('https://zodiacs.org/api/og/chart-twins-image?s=taurus&m=leo'))],
    ['chart twins by the Sun', () => handleChartTwinsImageRequest(new Request('https://zodiacs.org/api/og/chart-twins-image?s=pisces'))],
    ['famous chart', () => handleFamousChartImageRequest(new Request('https://zodiacs.org/api/og/famous-chart-image?p=frida-kahlo'))],
    ['famous chart with a long name', () => handleFamousChartImageRequest(new Request('https://zodiacs.org/api/og/famous-chart-image?p=wolfgang-amadeus-mozart'))],
    ['life milestone', () => handleMilestoneImageRequest(new Request(`https://zodiacs.org/api/og/milestone-image?${SATURN}`))],
    ['Uranus opposition', () => handleMilestoneImageRequest(new Request('https://zodiacs.org/api/og/milestone-image?k=uranus-opposition&i=1&a=42'))],
    ['compatibility with its confidence', () => handleCompatibilityImageRequest(new Request(`https://zodiacs.org/api/og/compatibility-image?${COMPAT}&c=70`))],
    ['date with its confidence', () => handleOccasionImageRequest(new Request(`https://zodiacs.org/api/og/occasion-image?${OCCASION}&c=55`))],
    ['month’s horoscope', () => handleHoroscopeImageRequest(new Request(`https://zodiacs.org/api/og/horoscope-image?s=leo&m=${Object.keys(json<PublishedMonths>('../data/horoscope-months.json').months).sort()[0]}`))],
    ['year’s horoscope', () => handleHoroscopeImageRequest(new Request('https://zodiacs.org/api/og/horoscope-image?s=aquarius&y=2026'))],
    ['big three', () => handleBigThreeImageRequest(new Request('https://zodiacs.org/api/og/big-three-image?s=leo&m=aries&r=libra'))],
    ['big three with the Moon undetermined', () => handleBigThreeImageRequest(new Request('https://zodiacs.org/api/og/big-three-image?s=sagittarius'))],
    ['Chinese zodiac', () => handleChineseZodiacImageRequest(new Request('https://zodiacs.org/api/og/chinese-zodiac-image?a=rabbit'))],
    ['invitation', () => handleInviteImageRequest(new Request('https://zodiacs.org/api/og/invite-image?s=taurus&p=scorpio'))],
    ['invitation with one sign', () => handleInviteImageRequest(new Request('https://zodiacs.org/api/og/invite-image?p=gemini'))],
    ['Vedic signs', () => handleVedicSignsImageRequest(new Request('https://zodiacs.org/api/og/vedic-signs-image?s=sagittarius&m=libra&r=leo&n=15&a=lahiri'))],
    ['Vedic signs with the Moon undetermined', () => handleVedicSignsImageRequest(new Request('https://zodiacs.org/api/og/vedic-signs-image?s=aries&n=3&a=raman'))],
  ])('render the %s card as a local-asset-only 1200×630 JPEG a link preview takes', async (_label, render) => {
    const fetchSpy = vi.fn(() => {
      throw new Error('The share preview renderer must not fetch assets.');
    });
    vi.stubGlobal('fetch', fetchSpy);
    const response = await render();
    const jpeg = Buffer.from(await response.arrayBuffer());
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    expect(Array.from(jpeg.subarray(0, 3))).toEqual([0xFF, 0xD8, 0xFF]);
    const { width, height } = decodeJpeg(jpeg);
    expect([width, height]).toEqual([1200, 630]);
    // The art fills the picture; WhatsApp drops a preview image over 600 KB, and the site keeps a photograph's share card under 300 KB.
    expect(jpeg.byteLength).toBeGreaterThan(40_000);
    expect(jpeg.byteLength).toBeLessThan(300_000);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 30_000);

  it('refuses a query that is not a share', async () => {
    const response = await handleCompatibilityImageRequest(new Request('https://zodiacs.org/api/og/compatibility-image?score=78'));
    expect(response.status).toBe(400);
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
  });

  it('refuses a share the site’s data does not hold, before drawing anything', async () => {
    for (const [handle, url] of [
      [handleBirthdayImageRequest, 'https://zodiacs.org/api/og/birthday-image?d=05-03&s=leo'],
      [handleBirthdayImageRequest, 'https://zodiacs.org/api/og/birthday-image?d=1990-05-03'],
      [handleSkyCalendarImageRequest, 'https://zodiacs.org/api/og/sky-calendar-image?k=retrograde&b=mercury&d=2026-10-25'],
      [handleHoroscopeImageRequest, `https://zodiacs.org/api/og/horoscope-image?s=leo&d=${TODAY}&t=You+will+win`],
      [handleHoroscopeImageRequest, 'https://zodiacs.org/api/og/horoscope-image?s=leo&d=2199-01-01'],
      [handleFamousChartImageRequest, 'https://zodiacs.org/api/og/famous-chart-image?p=someone-else'],
      [handleChartTwinsImageRequest, 'https://zodiacs.org/api/og/chart-twins-image?s=taurus&n=Audrey'],
      [handleMilestoneImageRequest, 'https://zodiacs.org/api/og/milestone-image?k=saturn-return&i=1&a=12'],
      [handleHoroscopeImageRequest, 'https://zodiacs.org/api/og/horoscope-image?s=leo&y=2031'],
      [handleHoroscopeImageRequest, 'https://zodiacs.org/api/og/horoscope-image?s=leo&m=2020-01'],
      [handleBigThreeImageRequest, 'https://zodiacs.org/api/og/big-three-image?s=leo&r=libra'],
      [handleChineseZodiacImageRequest, 'https://zodiacs.org/api/og/chinese-zodiac-image?a=horse&d=1990-01-20'],
      [handleInviteImageRequest, 'https://zodiacs.org/api/og/invite-image'],
      [handleInviteImageRequest, 'https://zodiacs.org/api/og/invite-image?s=taurus&n=Ana'],
      [handleCompatibilityImageRequest, `https://zodiacs.org/api/og/compatibility-image?${COMPAT}&c=99`],
      [handleVedicSignsImageRequest, 'https://zodiacs.org/api/og/vedic-signs-image?s=leo&m=aries&n=10&a=lahiri'],
      [handleVedicSignsImageRequest, 'https://zodiacs.org/api/og/vedic-signs-image?s=leo&a=lahiri&lat=28.61'],
    ] as const) expect((await handle(new Request(url))).status, url).toBe(400);
  });
});

describe('story pictures', () => {
  it.each([
    ['compatibility', () => handleCompatibilityStoryRequest(new Request(`https://zodiacs.org/api/og/compatibility-story?${COMPAT}`))],
    ['compatibility with long sign names', () => handleCompatibilityStoryRequest(new Request('https://zodiacs.org/api/og/compatibility-story?as=capricorn&bs=sagittarius&score=41&attraction=55&communication=38&stability=30&v=challenging'))],
    ['anniversary', () => handleOccasionStoryRequest(new Request('https://zodiacs.org/api/og/occasion-story?o=anniversary&d=2027-09-04&sun=virgo&moon=pisces&score=72&v=good'))],
    ['wedding', () => handleOccasionStoryRequest(new Request(`https://zodiacs.org/api/og/occasion-story?${OCCASION}`))],
    ['birthday', () => handleBirthdayStoryRequest(new Request('https://zodiacs.org/api/og/birthday-story?d=05-03'))],
    ['cusp birthday', () => handleBirthdayStoryRequest(new Request('https://zodiacs.org/api/og/birthday-story?d=04-20'))],
    ['sky calendar', () => handleSkyCalendarStoryRequest(new Request('https://zodiacs.org/api/og/sky-calendar-story?k=retrograde&b=mercury&d=2026-10-24'))],
    ['horoscope', () => handleHoroscopeStoryRequest(new Request(`https://zodiacs.org/api/og/horoscope-story?s=leo&d=${TODAY}`))],
    ['chart twins', () => handleChartTwinsStoryRequest(new Request('https://zodiacs.org/api/og/chart-twins-story?s=taurus&m=leo'))],
    ['famous chart', () => handleFamousChartStoryRequest(new Request('https://zodiacs.org/api/og/famous-chart-story?p=frida-kahlo'))],
    ['famous chart with a long name', () => handleFamousChartStoryRequest(new Request('https://zodiacs.org/api/og/famous-chart-story?p=wolfgang-amadeus-mozart'))],
    ['life milestone', () => handleMilestoneStoryRequest(new Request(`https://zodiacs.org/api/og/milestone-story?${SATURN}`))],
    ['compatibility with its confidence', () => handleCompatibilityStoryRequest(new Request(`https://zodiacs.org/api/og/compatibility-story?${COMPAT}&c=75`))],
    ['year’s horoscope', () => handleHoroscopeStoryRequest(new Request('https://zodiacs.org/api/og/horoscope-story?s=leo&y=2026'))],
    ['big three', () => handleBigThreeStoryRequest(new Request('https://zodiacs.org/api/og/big-three-story?s=leo&m=aries&r=sagittarius'))],
    ['big three with the Moon undetermined', () => handleBigThreeStoryRequest(new Request('https://zodiacs.org/api/og/big-three-story?s=sagittarius'))],
    ['Chinese zodiac', () => handleChineseZodiacStoryRequest(new Request('https://zodiacs.org/api/og/chinese-zodiac-story?a=tiger'))],
    ['invitation', () => handleInviteStoryRequest(new Request('https://zodiacs.org/api/og/invite-story?s=taurus&p=scorpio'))],
    ['Vedic signs', () => handleVedicSignsStoryRequest(new Request('https://zodiacs.org/api/og/vedic-signs-story?s=sagittarius&m=libra&r=leo&n=15&a=lahiri'))],
  ])('draw the %s story as a local-asset-only 1080×1920 JPEG', async (_label, render) => {
    const fetchSpy = vi.fn(() => {
      throw new Error('The story renderer must not fetch assets or fonts.');
    });
    vi.stubGlobal('fetch', fetchSpy);
    const response = await render();
    const jpeg = Buffer.from(await response.arrayBuffer());
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/jpeg');
    expect(response.headers.get('cache-control')).toBe('no-store, max-age=0');
    expect(response.headers.get('x-robots-tag')).toContain('noindex');
    const { width, height } = decodeJpeg(jpeg, { maxMemoryUsageInMB: 64 });
    expect([width, height]).toEqual([1080, 1920]);
    expect(jpeg.byteLength).toBeGreaterThan(100_000);
    expect(jpeg.byteLength).toBeLessThan(600_000);
    expect(fetchSpy).not.toHaveBeenCalled();
  }, 60_000);

  it('refuses what the link preview refuses', async () => {
    expect((await handleCompatibilityStoryRequest(new Request('https://zodiacs.org/api/og/compatibility-story?score=78'))).status).toBe(400);
    expect((await handleBirthdayStoryRequest(new Request('https://zodiacs.org/api/og/birthday-story?d=05-03&s=leo'))).status).toBe(400);
    expect((await handleHoroscopeStoryRequest(new Request('https://zodiacs.org/api/og/horoscope-story?s=leo&d=2199-01-01'))).status).toBe(400);
    expect((await handleOccasionStoryRequest(new Request(`https://zodiacs.org/api/og/occasion-story?${OCCASION}`, { method: 'POST' }))).status).toBe(405);
    expect((await handleBigThreeStoryRequest(new Request('https://zodiacs.org/api/og/big-three-story?s=leo&d=1990-08-01'))).status).toBe(400);
    expect((await handleChineseZodiacStoryRequest(new Request('https://zodiacs.org/api/og/chinese-zodiac-story?a=cat'))).status).toBe(400);
    expect((await handleInviteStoryRequest(new Request('https://zodiacs.org/api/og/invite-story?s=taurus&p=scorpio&n=Luis'))).status).toBe(400);
    expect((await handleVedicSignsStoryRequest(new Request('https://zodiacs.org/api/og/vedic-signs-story?s=leo&a=lahiri&d=1990-08-01'))).status).toBe(400);
  });
});
