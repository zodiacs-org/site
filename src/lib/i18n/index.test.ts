import { describe, expect, it } from 'vitest';
import {
  LOCALES,
  LOCALE_META,
  LOCALE_PATH_PREFIX,
  LOCALIZED_PATHS,
  CORE_ROUTE_LOCALES,
  DAILY_READING_ROUTE_LOCALES,
  CATALOG_LOCALES,
  LEGACY_HOME_SELECTOR_LOCALES,
  INDEXABLE_SIGN_GUIDE_LOCALES,
  PROGRAMMATIC_ROUTE_LOCALES,
  RELEASED_LOCALES,
  STAGED_CORE_ROUTE_LOCALES,
  alternatePaths,
  availableLocalesForPath,
  localizePath,
  normalizeCatalogLocale,
  normalizeKnownLocale,
  normalizeLocale,
  renderableLocalesForPath,
  renderableAlternatePathEntries,
  showsEnglishOnlyInterpretation,
  stripLocale,
  tf,
  UI,
  type UiKey,
} from './index';
import { SIGN_SLUGS } from '../signs';

describe('i18n helpers', () => {
  it('keeps every localized UI catalog aligned with all 452 English keys', () => {
    const englishKeys = Object.keys(UI.en).sort();
    expect(englishKeys).toHaveLength(452);
    for (const locale of CATALOG_LOCALES) {
      expect(Object.keys(UI[locale]).sort()).toEqual(englishKeys);
    }
  });

  it('preserves interpolation placeholders in every localized message', () => {
    const placeholders = (message: string) => (
      [...message.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)]
        .map((match) => match[1])
        .sort()
    );
    const keys = Object.keys(UI.en) as UiKey[];
    for (const locale of CATALOG_LOCALES) {
      for (const key of keys) {
        expect(placeholders(UI[locale][key]), locale + '.' + key).toEqual(placeholders(UI.en[key]));
      }
    }
  });

  it('uses the canonical browser-only privacy disclosure', () => {
    expect(UI.en.privacyDevice).toBe(
      'Private by default. Your birth details stay in this browser.',
    );
    expect(Object.keys(UI.en).filter((key) => key.startsWith('privacyDevice'))).toEqual(['privacyDevice']);
  });

  it('uses Astrofolio as the collection navigation label in every catalog', () => {
    expect(CATALOG_LOCALES.map((locale) => UI[locale].navCollect)).toEqual(
      CATALOG_LOCALES.map(() => 'Astrofolio'),
    );
  });

  it('localizes only supported core paths', () => {
    expect(localizePath('es', '/birth-chart/')).toBe('/es/birth-chart/');
    expect(localizePath('pt', '/birth-chart/')).toBe('/pt/birth-chart/');
    expect(localizePath('fr', '/birth-chart/')).toBe('/fr/birth-chart/');
    expect(localizePath('it', '/birth-chart/')).toBe('/it/birth-chart/');
    expect(localizePath('es', '/disclosure/')).toBe('/es/disclosure/');
    expect(localizePath('pt', '/disclosure/')).toBe('/pt/disclosure/');
    expect(localizePath('fr', '/disclosure/')).toBe('/fr/disclosure/');
    expect(localizePath('it', '/disclosure/')).toBe('/it/disclosure/');
    expect(localizePath('es', '/compatibility/aries-taurus/')).toBe('/es/compatibility/aries-taurus/');
    expect(localizePath('ru', '/compatibility/aries-taurus/')).toBe('/compatibility/aries-taurus/');
    expect(localizePath('es', '/compatibility/taurus-aries/')).toBe('/compatibility/taurus-aries/');
    expect(stripLocale('/es/aries/')).toBe('/aries/');
    expect(stripLocale('/pt/aries/')).toBe('/aries/');
    expect(stripLocale('/fr/aries/')).toBe('/aries/');
    expect(stripLocale('/it/aries/')).toBe('/aries/');
  });

  it('derives locale parsing and prefixes from the declared locales', () => {
    for (const locale of LOCALES) {
      expect(normalizeKnownLocale(locale.toUpperCase())).toBe(locale);
      expect(normalizeKnownLocale(LOCALE_META[locale].htmlLang)).toBe(locale);
      expect(normalizeKnownLocale(LOCALE_META[locale].intlLocale)).toBe(locale);
      expect(stripLocale(`${LOCALE_META[locale].pathPrefix}/tools/`)).toBe('/tools/');
    }
    expect(normalizeLocale('ru')).toBe('en');
    expect(normalizeLocale('ar')).toBe('en');
    expect(normalizeLocale('not-a-locale')).toBe('en');
    expect(normalizeCatalogLocale('ru')).toBe('ru');
    expect(normalizeCatalogLocale('ar')).toBe('en');
  });

  it('keeps English interpretive corpora off every non-English locale', () => {
    expect(LOCALES.filter(showsEnglishOnlyInterpretation)).toEqual(['en']);
  });

  it('returns alternates for translated pages', () => {
    expect(alternatePaths('/es/tools/')).toEqual({
      en: '/tools/',
      es: '/es/tools/',
      pt: '/pt/tools/',
      fr: '/fr/tools/',
      it: '/it/tools/',
      ru: '/ru/tools/',
    });
    expect(alternatePaths('/pt/privacy/')).toEqual({
      en: '/privacy/',
      es: '/es/privacy/',
      pt: '/pt/privacy/',
      fr: '/fr/privacy/',
      it: '/it/privacy/',
      ru: '/ru/privacy/',
    });
    expect(alternatePaths('/fr/disclosure/')).toEqual({
      en: '/disclosure/',
      es: '/es/disclosure/',
      pt: '/pt/disclosure/',
      fr: '/fr/disclosure/',
      it: '/it/disclosure/',
      ru: '/ru/disclosure/',
    });
    expect(LOCALIZED_PATHS.get('/tools/')).toEqual(CORE_ROUTE_LOCALES);
    expect(Object.keys(alternatePaths('/tools/') ?? {})).toEqual([...CORE_ROUTE_LOCALES]);
    expect(alternatePaths('/es/404/')).toEqual({
      en: '/404.html',
      es: '/es/404/',
      pt: '/pt/404/',
      fr: '/fr/404/',
      it: '/it/404/',
      ru: '/ru/404/',
    });
    expect(alternatePaths('/learn/placements/venus-in-scorpio/')).toBeNull();
  });

  it('publishes Russian only on the reviewed core route family', () => {
    expect(LOCALES).toEqual(['en', 'es', 'pt', 'fr', 'it', 'ru', 'ar']);
    expect(RELEASED_LOCALES).toEqual(['en', 'es', 'pt', 'fr', 'it']);
    expect(CORE_ROUTE_LOCALES).toEqual(['en', 'es', 'pt', 'fr', 'it', 'ru']);
    expect(CATALOG_LOCALES).toEqual(['en', 'es', 'pt', 'fr', 'it', 'ru']);
    expect(STAGED_CORE_ROUTE_LOCALES).toEqual([]);
    expect(LEGACY_HOME_SELECTOR_LOCALES).toEqual(['en', 'es', 'pt', 'fr', 'it']);
    expect(PROGRAMMATIC_ROUTE_LOCALES).toEqual(['en', 'es', 'pt', 'fr', 'it']);
    expect(INDEXABLE_SIGN_GUIDE_LOCALES).toEqual(['en', 'es', 'pt', 'fr', 'it']);
    expect(LOCALE_META.ru).toEqual({
      pathPrefix: '/ru', htmlLang: 'ru', dir: 'ltr', hreflang: 'ru',
      intlLocale: 'ru-RU', ogLocale: 'ru_RU', languageName: 'Русский',
    });
    expect(LOCALE_META.ar).toEqual({
      pathPrefix: '/ar', htmlLang: 'ar', dir: 'rtl', hreflang: 'ar',
      intlLocale: 'ar-u-ca-gregory-nu-latn', ogLocale: 'ar_AR', languageName: 'العربية',
    });
    expect(LOCALES.slice(0, 5).every((locale) => LOCALE_META[locale].dir === 'ltr')).toBe(true);
    for (const locale of LOCALES) {
      expect(LOCALE_PATH_PREFIX[locale]).toBe(LOCALE_META[locale].pathPrefix);
    }
    expect(localizePath('ru', '/tools/')).toBe('/ru/tools/');
    expect(localizePath('ar', '/tools/')).toBe('/tools/');
    expect(localizePath('ru', '/birthday/february-29/')).toBe('/birthday/february-29/');
    expect(availableLocalesForPath('/tools/')).toEqual(CORE_ROUTE_LOCALES);
    expect(renderableLocalesForPath('/tools/')).toEqual(CORE_ROUTE_LOCALES);
    expect(availableLocalesForPath('/birthday/february-29/')).toEqual(['en']);
    expect(renderableLocalesForPath('/birthday/february-29/')).toEqual(PROGRAMMATIC_ROUTE_LOCALES);
    expect(availableLocalesForPath('/learn/chinese-zodiac/dragon/')).toEqual(PROGRAMMATIC_ROUTE_LOCALES);
    expect(availableLocalesForPath('/aries/')).toEqual(INDEXABLE_SIGN_GUIDE_LOCALES);
    expect(renderableLocalesForPath('/aries/')).toEqual(CORE_ROUTE_LOCALES);
    expect(alternatePaths('/tools/')).toHaveProperty('ru', '/ru/tools/');
    for (const path of ['/birthday/february-29/', '/learn/chinese-zodiac/dragon/']) {
      expect(alternatePaths(path)).not.toHaveProperty('ru');
      expect(alternatePaths(path)).not.toHaveProperty('ar');
    }
  });

  it('keeps the published daily editions reciprocal without publishing other forecast families', () => {
    expect(DAILY_READING_ROUTE_LOCALES).toEqual(['en', 'es', 'pt']);
    for (const path of ['/today/', '/horoscopes/', ...SIGN_SLUGS.map((sign) => `/horoscopes/${sign}/`)]) {
      const expected = { en: path, es: `/es${path}`, pt: `/pt${path}` };
      for (const [locale, href] of Object.entries(expected)) {
        expect(availableLocalesForPath(href)).toEqual(DAILY_READING_ROUTE_LOCALES);
        expect(renderableLocalesForPath(href)).toEqual(DAILY_READING_ROUTE_LOCALES);
        expect(alternatePaths(href)).toEqual(expected);
        expect(renderableAlternatePathEntries(href)).toEqual(
          Object.entries(expected).map(([language, target]) => ({ locale: language, href: target })),
        );
        expect(localizePath(locale as 'en' | 'es' | 'pt', path)).toBe(href);
      }
      for (const locale of ['fr', 'it', 'ru', 'ar'] as const) {
        expect(localizePath(locale, path)).toBe(path);
      }
    }
    for (const path of [
      '/horoscopes/not-a-sign/', '/horoscopes/aries/weekly/',
      '/horoscopes/aries/monthly/', '/horoscopes/aries/tomorrow/',
      '/horoscopes/aries/love/', '/horoscopes/aries/career/', '/horoscopes/aries/2027/',
    ]) {
      expect(alternatePaths(path)).toBeNull();
      expect(localizePath('es', path)).toBe(path);
      expect(localizePath('pt', path)).toBe(path);
    }
  });

  it('keeps the English courtesy outside footer link labels to avoid repeated cues', () => {
    for (const locale of ['es', 'pt', 'fr', 'it'] as const) {
      expect(UI[locale].footerZodiacDates).not.toContain('(');
      expect(UI[locale].footerGlossary).not.toContain('(');
    }
  });

  it('localizes data-driven WS5 routes and the translated pair pages', () => {
    expect(LOCALIZED_PATHS.has('/compatibility/aries-taurus/')).toBe(false);
    expect(Object.keys(alternatePaths('/compatibility/aries-taurus/') ?? {})).toEqual(['en', 'es', 'pt', 'fr', 'it']);
    expect(alternatePaths('/compatibility/taurus-aries/')).toBeNull();

    for (const path of ['/learn/chinese-zodiac/', '/learn/chinese-zodiac/dragon/']) {
      // Programmatic families are recognized without enumerating hundreds of
      // paths into every client island's i18n bundle.
      expect(LOCALIZED_PATHS.has(path)).toBe(false);
      expect(alternatePaths(path)).toEqual({
        en: path,
        es: `/es${path}`,
        pt: `/pt${path}`,
        fr: `/fr${path}`,
        it: `/it${path}`,
      });
    }
    expect(alternatePaths('/birthday/july-15/')).toEqual({ en: '/birthday/july-15/' });
    expect(renderableAlternatePathEntries('/es/birthday/july-15/')).toEqual([
      { locale: 'en', href: '/birthday/july-15/' },
      { locale: 'es', href: '/es/birthday/july-15/' },
      { locale: 'pt', href: '/pt/birthday/july-15/' },
      { locale: 'fr', href: '/fr/birthday/july-15/' },
      { locale: 'it', href: '/it/birthday/july-15/' },
    ]);
    expect(alternatePaths('/aries/')).toEqual({
      en: '/aries/',
      es: '/es/aries/',
      pt: '/pt/aries/',
      fr: '/fr/aries/',
      it: '/it/aries/',
    });
    expect(renderableAlternatePathEntries('/ru/aries/')).toContainEqual({
      locale: 'ru', href: '/ru/aries/',
    });
    expect(alternatePaths('/birthday/february-30/')).toBeNull();
    expect(alternatePaths('/birthday/january-01/')).toBeNull();
    expect(alternatePaths('/learn/chinese-zodiac/phoenix/')).toBeNull();
  });

  it('interpolates localized messages without changing unsupported paths', () => {
    expect(tf('es', 'skyPlanetRetrograde', { planet: 'Plutón' })).toBe('Plutón retrógrado');
    expect(tf('es', 'pairingCta', { a: 'Aries', b: 'Tauro' })).toBe('Leer la combinación de Aries y Tauro');
    expect(tf('pt', 'skyPlanetRetrograde', { planet: 'Plutão' })).toBe('Plutão retrógrado');
    expect(tf('pt', 'pairingCta', { a: 'Áries', b: 'Touro' })).toBe('Leia a combinação entre Áries e Touro');
    expect(tf('it', 'skyPlanetRetrograde', { planet: 'Plutone' })).toBe('Plutone retrogrado');
    expect(tf('it', 'pairingCta', { a: 'Ariete', b: 'Toro' })).toBe('Leggi l’abbinamento fra Ariete e Toro');
    expect(localizePath('es', '/horoscopes/aries/weekly/')).toBe('/horoscopes/aries/weekly/');
  });

  it('renders the chart Registry bridge as complete localized sentences', () => {
    expect(tf('en', 'recordChartSun', { sign: 'Leo' })).toBe('Your Sun is in Leo.');
    expect(tf('en', 'recordChartBody', { sign: 'Leo' })).toBe(
      'Leo is one of the Twelve—with its own artwork, history, and official Registry record.',
    );
    expect(tf('en', 'recordChartLink', { sign: 'Leo' })).toBe('Explore the Leo Registry →');

    for (const locale of ['es', 'pt', 'fr', 'it', 'ru'] as const) {
      for (const key of ['recordChartSun', 'recordChartBody', 'recordChartLink'] as const) {
        expect(tf(locale, key, { sign: 'Leo' })).not.toMatch(/\{sign\}/u);
      }
    }
  });

  it('uses the approved Brazilian Portuguese registry register', () => {
    expect(UI.pt.navCollect).toBe('Astrofolio');
    expect(UI.pt.recordLabel).toBe('Ala do acervo');
    expect(UI.pt.recordOneOfTwelve).toBe(
      'também integra os Doze — um registro canônico no acervo.',
    );
    expect(UI.pt.recordViewLink).toBe('Ver o registro — por enquanto em inglês →');
  });

  it('uses the approved French registry register', () => {
    expect(UI.fr.navCollect).toBe('Astrofolio');
    expect(UI.fr.footerRegistry).toBe('Registry');
    expect(UI.fr.recordLabel).toBe('Aile des collections');
    expect(UI.fr.recordOneOfTwelve).toBe(
      'figure aussi parmi les Douze — une notice de référence dans le registre.',
    );
    expect(UI.fr.recordViewLink).toBe('Voir la notice — pour l’instant en anglais →');
  });

  it('uses the approved Italian registry register', () => {
    expect(UI.it.navCollect).toBe('Astrofolio');
    expect(UI.it.footerRegistry).toBe('Registry');
    expect(UI.it.recordLabel).toBe('Ala della collezione');
    expect(UI.it.recordOneOfTwelve).toBe(
      'esiste anche come uno dei Dodici — una scheda di riferimento nel registro.',
    );
    expect(UI.it.recordViewLink).toBe('Vedi la scheda — per ora in inglese →');
  });

  it('keeps the Spanish baby result sentences grammatical when signs are inserted', () => {
    expect(`${UI.es.babySunNearEdge} Géminis ${UI.es.babySunNearEdgeTail}`).toBe(
      'La fecha está cerca del borde del signo: si el bebé nace más de un día antes o después, puede tener el Sol en Géminis — la fecha de nacimiento decide.',
    );
    expect(`${UI.es.babySunSplitA} Aries ${UI.es.babySunSplitOr} Tauro ${UI.es.babySunSplitTail}`).toBe(
      'El Sol cambia de signo ese día: el bebé nace con el Sol en Aries o en Tauro según la hora. El momento exacto del nacimiento decide.',
    );
    expect(UI.es.babyMoonBody).toContain('Los bebés nacidos la misma semana');
  });

  it('keeps the Portuguese baby result sentences grammatical when signs are inserted', () => {
    expect(UI.pt.babySunNearEdge + ' Gêmeos ' + UI.pt.babySunNearEdgeTail).toBe(
      'A data fica perto da transição de signo, então nascer mais de um dia antes ou depois pode levar o Sol para Gêmeos — a data do nascimento é que decide.',
    );
    expect(
      UI.pt.babySunSplitA + ' Áries ' + UI.pt.babySunSplitOr + ' Touro ' + UI.pt.babySunSplitTail,
    ).toBe(
      'O Sol muda de signo nesta data: o bebê nasce com o Sol em Áries ou Touro dependendo do horário. O momento exato do nascimento decide.',
    );
    expect(UI.pt.babyMoonBody).toContain('Bebês que nascem na mesma semana');
  });

  it('keeps the Italian baby result sentences grammatical when signs are inserted', () => {
    expect(UI.it.babySunNearEdge + ' Gemelli ' + UI.it.babySunNearEdgeTail).toBe(
      'La data è vicina al confine del segno, quindi nascere più di un giorno prima o dopo può portare il Sole in Gemelli — decide la data di nascita.',
    );
    expect(
      UI.it.babySunSplitA + ' Ariete ' + UI.it.babySunSplitOr + ' Toro ' + UI.it.babySunSplitTail,
    ).toBe(
      'In questa data il Sole cambia segno: alla nascita sarà in Ariete oppure in Toro a seconda dell’ora. Decide il momento esatto della nascita.',
    );
    expect(UI.it.babyMoonBody).toContain('Chi nasce nella stessa settimana');
  });
});
