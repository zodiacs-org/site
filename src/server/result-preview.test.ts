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
} from './result-preview';
import {
  birthdayCardModel,
  compatibilityCardModel,
  famousBirthdays,
  horoscopeCardModel,
  longDate,
  NEUTRAL_HUE,
  occasionCardModel,
  skyCalendarCardModel,
  skyEvents,
} from './result-preview-model';
import { parseBirthdayShare, parseHoroscopeShare, parseSkyCalendarShare } from '../ai-tools/share-links';
import type { HoroscopeWindow } from '../ai-tools/horoscope/window';

const COMPAT = 'a=Ana&as=leo&b=Luis&bs=libra&score=78&attraction=82&communication=71&stability=80&v=strong';
const json = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;
const DAYS = json<{ days: Record<string, { sign?: string; cusp?: { a: string; b: string } }> }>('../data/birthdays.json').days;
const SKY_EVENTS = skyEvents({ ...json<any>('../data/sky.json'), eclipses: json<any>('../data/eclipses.json').eclipses });
const WINDOW = json<HoroscopeWindow>('../data/horoscope-window.json');
const TODAY = WINDOW.generatedFor;
const WEEK = WINDOW.editions.find((edition) => edition.anchorDate === TODAY)!.signs.leo.weekly.period;
const OCCASION = 'o=wedding&d=2027-06-12&n=Ana+%26+Luis&p=Florence&sun=gemini&moon=libra&score=84&v=excellent';
const FAMOUS = famousBirthdays(json<{ people: Parameters<typeof famousBirthdays>[0] }>('../ai-tools/features/people-index.json').people);
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
  it('show names, signs in their hues, the score, the verdict and the three areas', () => {
    const model = compatibilityCardModel(parseCompatibilityShare(new URLSearchParams(COMPAT))!);
    expect(model).toMatchObject({
      first: 'Ana', second: 'Luis', score: 78, verdict: 'A strong match',
      people: [{ slug: 'leo', label: 'Leo Sun', hue: '#E0A9B4' }, { slug: 'libra', label: 'Libra Sun', hue: '#D3A9DE' }],
      ring: ['#E0A9B4', '#D3A9DE'],
      areas: [{ label: 'Attraction', value: 82 }, { label: 'Communication', value: 71 }, { label: 'Stability', value: 80 }],
      title: 'Ana and Luis: 78/100',
    });
  });

  it('call unnamed people Person A and Person B, and draw an unknown sign in the neutral tone', () => {
    const model = compatibilityCardModel(parseCompatibilityShare(new URLSearchParams('bs=pisces&score=41&attraction=55&communication=38&stability=30&v=challenging'))!);
    expect([model.first, model.second]).toEqual(['Person A', 'Person B']);
    expect(model.people[0]).toEqual({ slug: null, label: 'Sun sign on the cusp', hue: NEUTRAL_HUE });
    expect(model.verdict).toBe('A challenging match');
  });

  it('give a date its headline, the day in words, the place and the Sun and Moon', () => {
    const model = occasionCardModel(parseOccasionShare(new URLSearchParams(OCCASION))!);
    expect(model).toMatchObject({
      names: 'Ana & Luis', headline: 'Our wedding', when: 'Saturday, 12 June 2027 in Florence', score: 84, verdict: 'An excellent day for it',
      signs: [{ label: 'Gemini Sun' }, { label: 'Libra Moon' }],
      title: 'Ana & Luis: Wedding, 84/100',
    });
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
    expect(horoscopeCardModel(parseHoroscopeShare(new URLSearchParams(`s=leo&w=${after(WEEK.from, 7)}`))!, WINDOW)).toBeNull();
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
    expect(html).toContain('<title>Ana and Luis: 78/100 on Zodiacs</title>');
    expect(html).not.toMatch(/ref=chatgpt[^"]*"[^>]*og:image|image\?[^"]*ref=/u);
    // The same result as a 1080×1920 picture, to save and post as a story.
    expect(html).toContain(`<p class="story"><a href="/api/og/compatibility-story?${COMPAT.replaceAll('&', '&amp;')}" download="zodiacs-compatibility-story.jpg">Save the picture for your story</a></p>`);
  });

  it('offer a date its own way to rate yours', async () => {
    const response = await handleOccasionLinkRequest(new Request(`https://zodiacs.org/share/occasion/?${OCCASION}`));
    const html = await response.text();
    expect(html).toContain(`content="https://zodiacs.org/api/og/occasion-image?${OCCASION.replaceAll('&', '&amp;')}"`);
    expect(html).toContain('<a class="cta" href="/occasions/">Rate your own date</a>');
    expect(html).toContain('Ana &amp; Luis: our wedding');
    expect(html).toContain('download="zodiacs-wedding-story.jpg"');
  });

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
    ]) expect(vercel.rewrites).toContainEqual({ source, destination: `/api/compatibility?__zodiacs_share=${route}` });
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
    ['accented names', () => handleCompatibilityImageRequest(new Request('https://zodiacs.org/api/og/compatibility-image?a=%C5%81ukasz&b=Zo%C3%AB&score=63&attraction=70&communication=59&stability=58&v=good'))],
    ['accented names on a date', () => handleOccasionImageRequest(new Request('https://zodiacs.org/api/og/occasion-image?o=anniversary&d=2027-09-04&n=%C5%81ucja+%26+%C3%96mer&p=Gda%C5%84sk&sun=virgo&moon=pisces&score=72&v=good'))],
    ['one unknown sign', () => handleCompatibilityImageRequest(new Request('https://zodiacs.org/api/og/compatibility-image?bs=pisces&score=41&attraction=55&communication=38&stability=30&v=challenging'))],
    ['birthday', () => handleBirthdayImageRequest(new Request('https://zodiacs.org/api/og/birthday-image?d=05-03'))],
    ['cusp birthday', () => handleBirthdayImageRequest(new Request('https://zodiacs.org/api/og/birthday-image?d=04-20'))],
    ['famous birthday', () => handleBirthdayImageRequest(new Request('https://zodiacs.org/api/og/birthday-image?d=01-19&s=aquarius'))],
    ['sky calendar', () => handleSkyCalendarImageRequest(new Request('https://zodiacs.org/api/og/sky-calendar-image?k=retrograde&b=mercury&d=2026-10-24'))],
    ['horoscope', () => handleHoroscopeImageRequest(new Request(`https://zodiacs.org/api/og/horoscope-image?s=leo&d=${TODAY}`))],
    ['week’s horoscope', () => handleHoroscopeImageRequest(new Request(`https://zodiacs.org/api/og/horoscope-image?s=sagittarius&w=${WEEK.from}`))],
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
    ] as const) expect((await handle(new Request(url))).status, url).toBe(400);
  });
});

describe('story pictures', () => {
  it.each([
    ['compatibility', () => handleCompatibilityStoryRequest(new Request(`https://zodiacs.org/api/og/compatibility-story?${COMPAT}`))],
    ['long names compared', () => handleCompatibilityStoryRequest(new Request('https://zodiacs.org/api/og/compatibility-story?a=Maximiliana&as=capricorn&b=Bartholomew&bs=sagittarius&score=41&attraction=55&communication=38&stability=30&v=challenging'))],
    ['wedding', () => handleOccasionStoryRequest(new Request(`https://zodiacs.org/api/og/occasion-story?${OCCASION}`))],
    ['accented names on a date', () => handleOccasionStoryRequest(new Request('https://zodiacs.org/api/og/occasion-story?o=anniversary&d=2027-09-04&n=%C5%81ucja+%26+%C3%96mer&p=Gda%C5%84sk&sun=virgo&moon=pisces&score=72&v=good'))],
    ['birthday', () => handleBirthdayStoryRequest(new Request('https://zodiacs.org/api/og/birthday-story?d=05-03'))],
    ['cusp birthday', () => handleBirthdayStoryRequest(new Request('https://zodiacs.org/api/og/birthday-story?d=04-20'))],
    ['sky calendar', () => handleSkyCalendarStoryRequest(new Request('https://zodiacs.org/api/og/sky-calendar-story?k=retrograde&b=mercury&d=2026-10-24'))],
    ['horoscope', () => handleHoroscopeStoryRequest(new Request(`https://zodiacs.org/api/og/horoscope-story?s=leo&d=${TODAY}`))],
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
  });
});
