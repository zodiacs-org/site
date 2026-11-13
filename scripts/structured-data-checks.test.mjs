import { describe, expect, it } from 'vitest';
import {
  breadcrumbSlashErrors, eventErrors, horoscopeHubPrefix, htmlLangOf, isHoroscopeContentPath, languageErrors, ogTypeOf,
} from './structured-data-checks.mjs';
import { SKY_EVENT_LOCATION } from '../src/lib/sky-event-schema.mjs';

const SITE = 'https://zodiacs.org';
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];

describe('localized daily horoscopes are held to the English contract', () => {
  it('treats the es and pt daily pages as horoscope content', () => {
    expect(isHoroscopeContentPath('/horoscopes/taurus/', SIGNS)).toBe(true);
    expect(isHoroscopeContentPath('/horoscopes/taurus/weekly/', SIGNS)).toBe(true);
    expect(isHoroscopeContentPath('/es/horoscopes/taurus/', SIGNS)).toBe(true);
    expect(isHoroscopeContentPath('/pt/horoscopes/pisces/', SIGNS)).toBe(true);
  });

  it('leaves locales and surfaces that publish no daily page alone', () => {
    expect(isHoroscopeContentPath('/fr/horoscopes/taurus/', SIGNS)).toBe(false);
    expect(isHoroscopeContentPath('/es/horoscopes/taurus/weekly/', SIGNS)).toBe(false);
    expect(isHoroscopeContentPath('/horoscopes/ophiuchus/', SIGNS)).toBe(false);
    expect(isHoroscopeContentPath('/es/horoscopes/', SIGNS)).toBe(false);
  });

  it('finds the hub of each locale that publishes one', () => {
    expect(horoscopeHubPrefix('/horoscopes/')).toBe('');
    expect(horoscopeHubPrefix('/es/horoscopes/')).toBe('/es');
    expect(horoscopeHubPrefix('/pt/horoscopes/')).toBe('/pt');
    expect(horoscopeHubPrefix('/fr/horoscopes/')).toBeNull();
    expect(horoscopeHubPrefix('/horoscopes/taurus/')).toBeNull();
  });

  it('reads og:type and <html lang>', () => {
    const html = '<html lang="pt-BR" dir="ltr"><head><meta property="og:type" content="article" /></head></html>';
    expect(ogTypeOf(html)).toBe('article');
    expect(htmlLangOf(html)).toBe('pt-BR');
    expect(ogTypeOf('<meta property="og:type" content="website">')).toBe('website');
    expect(ogTypeOf('<meta name="description" content="x">')).toBeUndefined();
  });
});

describe('breadcrumbSlashErrors', () => {
  const crumb = (position, item) => ({ '@type': 'ListItem', position, name: String(position), item });

  it('rejects the slashless locale root, which redirects', () => {
    const errors = breadcrumbSlashErrors([crumb(1, `${SITE}/ru`), crumb(2, `${SITE}/ru/privacy/`)]);
    expect(errors).toEqual([`breadcrumb 1 item must end in a slash (${SITE}/ru redirects)`]);
  });

  it('accepts canonical URLs and in-page anchors', () => {
    expect(breadcrumbSlashErrors([
      crumb(1, `${SITE}/`), crumb(2, `${SITE}/ru/`), crumb(3, `${SITE}/learn/#signs`), crumb(4, `${SITE}/ru/privacy/`),
    ])).toEqual([]);
  });
});

describe('eventErrors', () => {
  const page = `${SITE}/eclipses/`;
  const event = (overrides = {}) => ({
    '@type': 'Event',
    '@id': `${page}#2027-02-06-annular`,
    name: 'Annular solar eclipse in Aquarius',
    startDate: '2027-02-06T16:00:00.000Z',
    endDate: '2027-02-06T16:00:00.000Z',
    eventStatus: 'https://schema.org/EventScheduled',
    location: SKY_EVENT_LOCATION,
    url: `${SITE}/eclipses/2027-02-06/`,
    ...overrides,
  });

  it('accepts a hub row with an anchor id and the shared location', () => {
    expect(eventErrors([{ '@type': 'Dataset' }, event()], page)).toEqual([]);
  });

  it('accepts the virtual location the season pages still carry', () => {
    const season = `${SITE}/seasons/scorpio/`;
    expect(eventErrors([event({
      '@id': `${season}#season-2026`,
      location: { '@type': 'VirtualLocation', url: season },
      url: season,
    })], season)).toEqual([]);
  });

  it('requires a location', () => {
    const { location, ...withoutLocation } = event();
    expect(location).toBeDefined();
    expect(eventErrors([withoutLocation], page)).toEqual([
      `Event ${page}#2027-02-06-annular needs a location (a named Place or a VirtualLocation)`,
    ]);
    expect(eventErrors([event({ location: { '@type': 'Place' } })], page)).toHaveLength(1);
  });

  it('rejects an @id that is another page\'s URL', () => {
    const clash = `${SITE}/eclipses/2027-02-06/`;
    expect(eventErrors([event({ '@id': clash })], page)).toEqual([
      `Event ${clash} @id must be a fragment of ${page}, not another page's URL`,
    ]);
    expect(eventErrors([event({ '@id': page })], page)).toHaveLength(1);
    expect(eventErrors([event({ '@id': `${page}#` })], page)).toHaveLength(1);
  });

  it('requires a name and parseable dates', () => {
    expect(eventErrors([event({ name: ' ', startDate: 'soon', endDate: 'later' })], page)).toEqual([
      `Event ${page}#2027-02-06-annular is missing name`,
      `Event ${page}#2027-02-06-annular has an invalid startDate`,
      `Event ${page}#2027-02-06-annular has an invalid endDate`,
    ]);
  });
});

describe('languageErrors', () => {
  it('requires inLanguage on Article, FAQPage and WebApplication when the page is not English', () => {
    expect(languageErrors([
      { '@type': 'Organization' },
      { '@type': 'BreadcrumbList' },
      { '@type': 'WebApplication', name: 'Big three' },
      { '@type': 'FAQPage', mainEntity: [] },
    ], 'ru')).toEqual(['WebApplication is missing inLanguage "ru"', 'FAQPage is missing inLanguage "ru"']);
  });

  it('lets English pages leave the default unstated', () => {
    expect(languageErrors([{ '@type': 'WebApplication' }, { '@type': 'FAQPage' }], 'en')).toEqual([]);
  });

  it('holds every stated language to <html lang>', () => {
    expect(languageErrors([
      { '@type': 'Article', inLanguage: 'pt-BR' },
      { '@type': 'WebSite', inLanguage: ['en', 'pt-BR'] },
    ], 'pt-BR')).toEqual([]);
    expect(languageErrors([{ '@type': 'Article', inLanguage: 'pt' }], 'pt-BR')).toEqual([
      'Article inLanguage "pt" does not include <html lang> "pt-BR"',
    ]);
  });

  it('fails a page with no <html lang>', () => {
    expect(languageErrors([], undefined)).toEqual(['page has no <html lang>']);
  });
});
