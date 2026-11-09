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
  RESULT_SHARE_ROUTES,
} from './result-preview';
import {
  bigThreeCardModel,
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

  it('open an older link with names and a place, and show neither in the HTML, the title, the description or the image', async () => {
    const names = /Ana|Luis|Florence/u;
    const pages = [
      [handleCompatibilityLinkRequest, 'compatibility', COMPAT_NAMED, COMPAT],
      [handleOccasionLinkRequest, 'occasion', OCCASION_NAMED, OCCASION],
    ] as const;
    for (const [handle, kind, named, plain] of pages) {
      const response = await handle(new Request(`https://zodiacs.org/share/${kind}/?${named}&ref=chatgpt`));
      const html = await response.text();
      expect(response.status, kind).toBe(200);
      expect(html, kind).toContain(`content="https://zodiacs.org/api/og/${kind}-image?${plain.replaceAll('&', '&amp;')}"`);
      for (const part of [html.match(/<title>[^<]*<\/title>/u)?.[0], html.match(/<meta name="description" content="[^"]*">/u)?.[0], html.match(/<meta property="og:title" content="[^"]*">/u)?.[0]]) {
        expect(part, kind).toBeTruthy();
        expect(part, kind).not.toMatch(names);
      }
      expect(html, kind).not.toMatch(names);
      // The page is the one the same link without them opens.
      expect(html, kind).toBe(await (await handle(new Request(`https://zodiacs.org/share/${kind}/?${plain}&ref=chatgpt`))).text());
    }
    // The preview image and the story are the nameless link's pictures, byte for byte.
    const pictures = [
      [handleCompatibilityImageRequest, 'compatibility-image', COMPAT_NAMED, COMPAT],
      [handleCompatibilityStoryRequest, 'compatibility-story', COMPAT_NAMED, COMPAT],
      [handleOccasionImageRequest, 'occasion-image', OCCASION_NAMED, OCCASION],
      [handleOccasionStoryRequest, 'occasion-story', OCCASION_NAMED, OCCASION],
    ] as const;
    for (const [handle, route, named, plain] of pictures) {
      const [withNames, without] = await Promise.all([named, plain].map(async (query) => {
        const response = await handle(new Request(`https://zodiacs.org/api/og/${route}?${query}`));
        expect(response.status, route).toBe(200);
        return Buffer.from(await response.arrayBuffer());
      }));
      expect(withNames.equals(without), route).toBe(true);
    }
  }, 60_000);

  it('open the plain page, with the site’s own card, for a query that is not a share', async () => {
    const response = await handleCompatibilityLinkRequest(new Request('https://zodiacs.org/share/compatibility/?a=%3Cscript%3E&score=78'));
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
    // An older link still opens the same page, and its dates go no further: not into the text, the picture or the story.
    const older = await (await handleMilestoneLinkRequest(new Request(`https://zodiacs.org/share/milestone/?${SATURN_OLDER}`))).text();
    expect(older).toContain('<h1>First Saturn return, at 29</h1>');
    expect(older).toContain(`content="https://zodiacs.org/api/og/milestone-image?${SATURN.replaceAll('&', '&amp;')}"`);
    expect(older).toContain(`href="/api/og/milestone-story?${SATURN.replaceAll('&', '&amp;')}"`);
    for (const page of [milestone, older]) expect(page).not.toMatch(/2026-04-23|2026-12-31|23 April|31 December|[?;]f=|[?;]l=/u);
    for (const page of [twins, famous, milestone]) expect(page.replace(/<style[^]*?<\/style>/u, '')).not.toMatch(/[—–]/u);
    // A bare address opens the directory; a named person absent from the directory is not a share.
    expect(await (await handleFamousChartLinkRequest(new Request('https://zodiacs.org/share/famous-chart/'))).text()).toContain('<h1>Famous birth charts</h1>');
    expect((await handleFamousChartLinkRequest(new Request('https://zodiacs.org/share/famous-chart/?p=someone-else'))).status).toBe(404);
    expect(await (await handleChartTwinsLinkRequest(new Request('https://zodiacs.org/share/chart-twins/?s=taurus&d=1990-05-03'))).text()).toContain('content="https://zodiacs.org/assets/og/v2/tool/chart-twins.png"');
    expect(await (await handleMilestoneLinkRequest(new Request('https://zodiacs.org/share/milestone/?k=saturn-return&i=1&a=12&f=2026-04-23&l=2026-12-31'))).text()).toContain('content="https://zodiacs.org/assets/og/v2/tool/saturn-return.png"');
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
    // An older link with its year still opens, drawn and linked without it.
    const animal = await (await handleChineseZodiacLinkRequest(new Request('https://zodiacs.org/share/chinese-zodiac/?a=snake&y=1989'))).text();
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
    expect(await (await handleChineseZodiacLinkRequest(new Request('https://zodiacs.org/share/chinese-zodiac/?a=horse&y=2025'))).text()).toContain('<h1>The Chinese zodiac</h1>');
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
      ['/share/astrocartography/', 'astrocartography-link'], ['/api/og/astrocartography-image', 'astrocartography-image'], ['/api/og/astrocartography-story', 'astrocartography-story'],
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

    const repeated = nodeResponse();
    await handleResultShareNodeRequest({ method: 'GET', headers: { host: 'zodiacs.org' }, query: { __zodiacs_share: 'compatibility-link', ...Object.fromEntries(new URLSearchParams(COMPAT)), a: ['Ana', 'Eve'] } }, repeated, 'compatibility-link');
    expect(repeated.statusCode).toBe(200);
    expect(repeated.body.toString()).toContain('Compare two birth charts');

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

describe('share preview images', () => {
  it.each([
    ['compatibility', () => handleCompatibilityImageRequest(new Request(`https://zodiacs.org/api/og/compatibility-image?${COMPAT}`))],
    ['date', () => handleOccasionImageRequest(new Request(`https://zodiacs.org/api/og/occasion-image?${OCCASION}`))],
    ['older link with accented names', () => handleCompatibilityImageRequest(new Request('https://zodiacs.org/api/og/compatibility-image?a=%C5%81ukasz&b=Zo%C3%AB&score=63&attraction=70&communication=59&stability=58&v=good'))],
    ['older date link with accented names and place', () => handleOccasionImageRequest(new Request('https://zodiacs.org/api/og/occasion-image?o=anniversary&d=2027-09-04&n=%C5%81ucja+%26+%C3%96mer&p=Gda%C5%84sk&sun=virgo&moon=pisces&score=72&v=good'))],
    ['older link with Cyrillic names', () => handleCompatibilityImageRequest(new Request(`https://zodiacs.org/api/og/compatibility-image?${new URLSearchParams({ a: 'Анна', b: 'Иван', score: '63', attraction: '70', communication: '59', stability: '58', v: 'good' })}`))],
    ['older date link with Cyrillic names and place', () => handleOccasionImageRequest(new Request(`https://zodiacs.org/api/og/occasion-image?${new URLSearchParams({ o: 'anniversary', d: '2027-09-04', n: 'Анна & Іван', p: 'Київ', sun: 'virgo', moon: 'pisces', score: '72', v: 'good' })}`))],
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
    ['life milestone from an older link with its dates', () => handleMilestoneImageRequest(new Request(`https://zodiacs.org/api/og/milestone-image?${SATURN_OLDER}`))],
    ['Uranus opposition', () => handleMilestoneImageRequest(new Request('https://zodiacs.org/api/og/milestone-image?k=uranus-opposition&i=1&a=42'))],
    ['compatibility with its confidence', () => handleCompatibilityImageRequest(new Request(`https://zodiacs.org/api/og/compatibility-image?${COMPAT}&c=70`))],
    ['date with its confidence', () => handleOccasionImageRequest(new Request(`https://zodiacs.org/api/og/occasion-image?${OCCASION}&c=55`))],
    ['month’s horoscope', () => handleHoroscopeImageRequest(new Request(`https://zodiacs.org/api/og/horoscope-image?s=leo&m=${Object.keys(json<PublishedMonths>('../data/horoscope-months.json').months).sort()[0]}`))],
    ['year’s horoscope', () => handleHoroscopeImageRequest(new Request('https://zodiacs.org/api/og/horoscope-image?s=aquarius&y=2026'))],
    ['big three', () => handleBigThreeImageRequest(new Request('https://zodiacs.org/api/og/big-three-image?s=leo&m=aries&r=libra'))],
    ['big three with the Moon undetermined', () => handleBigThreeImageRequest(new Request('https://zodiacs.org/api/og/big-three-image?s=sagittarius'))],
    ['Chinese zodiac', () => handleChineseZodiacImageRequest(new Request('https://zodiacs.org/api/og/chinese-zodiac-image?a=rabbit'))],
    ['Chinese zodiac from an older link with its year', () => handleChineseZodiacImageRequest(new Request('https://zodiacs.org/api/og/chinese-zodiac-image?a=horse&y=2026'))],
    ['invitation', () => handleInviteImageRequest(new Request('https://zodiacs.org/api/og/invite-image?s=taurus&p=scorpio'))],
    ['invitation with one sign', () => handleInviteImageRequest(new Request('https://zodiacs.org/api/og/invite-image?p=gemini'))],
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
      [handleMilestoneImageRequest, 'https://zodiacs.org/api/og/milestone-image?k=saturn-return&i=1&a=12&f=2026-04-23&l=2026-12-31'],
      [handleHoroscopeImageRequest, 'https://zodiacs.org/api/og/horoscope-image?s=leo&y=2031'],
      [handleHoroscopeImageRequest, 'https://zodiacs.org/api/og/horoscope-image?s=leo&m=2020-01'],
      [handleBigThreeImageRequest, 'https://zodiacs.org/api/og/big-three-image?s=leo&r=libra'],
      [handleChineseZodiacImageRequest, 'https://zodiacs.org/api/og/chinese-zodiac-image?a=horse&y=2025'],
      [handleChineseZodiacImageRequest, 'https://zodiacs.org/api/og/chinese-zodiac-image?a=horse&d=1990-01-20'],
      [handleInviteImageRequest, 'https://zodiacs.org/api/og/invite-image'],
      [handleInviteImageRequest, 'https://zodiacs.org/api/og/invite-image?s=taurus&n=Ana'],
      [handleCompatibilityImageRequest, `https://zodiacs.org/api/og/compatibility-image?${COMPAT}&c=99`],
    ] as const) expect((await handle(new Request(url))).status, url).toBe(400);
  });
});

describe('story pictures', () => {
  it.each([
    ['compatibility', () => handleCompatibilityStoryRequest(new Request(`https://zodiacs.org/api/og/compatibility-story?${COMPAT}`))],
    ['older link with long names', () => handleCompatibilityStoryRequest(new Request('https://zodiacs.org/api/og/compatibility-story?a=Maximiliana&as=capricorn&b=Bartholomew&bs=sagittarius&score=41&attraction=55&communication=38&stability=30&v=challenging'))],
    ['wedding', () => handleOccasionStoryRequest(new Request(`https://zodiacs.org/api/og/occasion-story?${OCCASION}`))],
    ['older date link with accented names and place', () => handleOccasionStoryRequest(new Request('https://zodiacs.org/api/og/occasion-story?o=anniversary&d=2027-09-04&n=%C5%81ucja+%26+%C3%96mer&p=Gda%C5%84sk&sun=virgo&moon=pisces&score=72&v=good'))],
    ['birthday', () => handleBirthdayStoryRequest(new Request('https://zodiacs.org/api/og/birthday-story?d=05-03'))],
    ['cusp birthday', () => handleBirthdayStoryRequest(new Request('https://zodiacs.org/api/og/birthday-story?d=04-20'))],
    ['sky calendar', () => handleSkyCalendarStoryRequest(new Request('https://zodiacs.org/api/og/sky-calendar-story?k=retrograde&b=mercury&d=2026-10-24'))],
    ['horoscope', () => handleHoroscopeStoryRequest(new Request(`https://zodiacs.org/api/og/horoscope-story?s=leo&d=${TODAY}`))],
    ['chart twins', () => handleChartTwinsStoryRequest(new Request('https://zodiacs.org/api/og/chart-twins-story?s=taurus&m=leo'))],
    ['famous chart', () => handleFamousChartStoryRequest(new Request('https://zodiacs.org/api/og/famous-chart-story?p=frida-kahlo'))],
    ['famous chart with a long name', () => handleFamousChartStoryRequest(new Request('https://zodiacs.org/api/og/famous-chart-story?p=wolfgang-amadeus-mozart'))],
    ['life milestone', () => handleMilestoneStoryRequest(new Request(`https://zodiacs.org/api/og/milestone-story?${SATURN}`))],
    ['life milestone from an older link with its dates', () => handleMilestoneStoryRequest(new Request(`https://zodiacs.org/api/og/milestone-story?${SATURN_OLDER}`))],
    ['compatibility with its confidence', () => handleCompatibilityStoryRequest(new Request(`https://zodiacs.org/api/og/compatibility-story?${COMPAT}&c=75`))],
    ['year’s horoscope', () => handleHoroscopeStoryRequest(new Request('https://zodiacs.org/api/og/horoscope-story?s=leo&y=2026'))],
    ['big three', () => handleBigThreeStoryRequest(new Request('https://zodiacs.org/api/og/big-three-story?s=leo&m=aries&r=sagittarius'))],
    ['big three with the Moon undetermined', () => handleBigThreeStoryRequest(new Request('https://zodiacs.org/api/og/big-three-story?s=sagittarius'))],
    ['Chinese zodiac', () => handleChineseZodiacStoryRequest(new Request('https://zodiacs.org/api/og/chinese-zodiac-story?a=tiger'))],
    ['invitation', () => handleInviteStoryRequest(new Request('https://zodiacs.org/api/og/invite-story?s=taurus&p=scorpio'))],
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
  });
});
