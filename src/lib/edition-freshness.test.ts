import { describe, expect, it } from 'vitest';
import dailyData from '../data/daily.json';
import type { Daily } from './daily';
import {
  datedEditionText,
  datedEditionTextIn,
  datedEditionTitleIn,
  editionDateLabel,
  editionRules,
  editionTitleRules,
  inlineEditionRules,
  inlineEditionTitleRules,
  isCurrentUtcEdition,
  millisecondsUntilNextUtcDay,
  type EditionLocale,
} from './edition-freshness';
import { dailyReadingForLocale } from './i18n/daily-reading';
import { dailyReadingRu } from './locale-expansion/daily-ru';
import { ru as russianDailyCopy } from './locale-expansion/daily-copy/ru';
import { formatDate } from './i18n/dates';
import { SIGNS, signName } from './signs';

describe('daily edition freshness', () => {
  it('uses the UTC calendar day rather than the visitor timezone', () => {
    expect(isCurrentUtcEdition('2026-08-01', new Date('2026-08-01T23:59:59.000-07:00'))).toBe(false);
    expect(isCurrentUtcEdition('2026-08-02', new Date('2026-08-01T23:59:59.000-07:00'))).toBe(true);
    expect(isCurrentUtcEdition('not-a-date', new Date('2026-08-02T06:59:59.000Z'))).toBe(false);
  });

  it('turns relative Today wording into an explicit archived edition', () => {
    const dated = datedEditionText(
      'Today, read today’s sky. Today is quieter; read today.',
      '2026-08-01',
    );
    expect(dated).toBe(
      'For the August 1, 2026 edition, read the August 1, 2026 edition’s sky. '
      + 'The August 1, 2026 edition is quieter; read on August 1, 2026.',
    );
    expect(dated).not.toMatch(/\btoday\b/iu);
    expect(editionDateLabel('2026-08-01')).toBe('August 1, 2026');
  });

  it('keeps prepositions grammatical when dating lowercase relative copy', () => {
    expect(datedEditionText(
      'What matters today; read for today, as of today, and from today.',
      '2026-08-01',
    )).toBe(
      'What matters on August 1, 2026; read for August 1, 2026, '
      + 'as of August 1, 2026, and from August 1, 2026.',
    );
  });

  it('schedules the next check just after UTC midnight', () => {
    expect(millisecondsUntilNextUtcDay(new Date('2026-08-01T23:59:59.500Z'))).toBe(1_500);
  });
});

describe('dated wording on the Spanish and Portuguese daily pages', () => {
  const date = '2026-10-12';
  const label = { es: '12 de octubre de 2026', pt: '12 de outubro de 2026' } as const;
  const dateOptions = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' } as const;

  it('labels the edition exactly as the pages print its date', () => {
    for (const locale of ['es', 'pt'] as const) {
      expect(editionDateLabel(date, locale)).toBe(label[locale]);
      for (const day of ['2026-11-01', '2027-01-09', '2028-02-29']) {
        expect(editionDateLabel(day, locale)).toBe(formatDate(locale, `${day}T12:00:00Z`, dateOptions));
      }
    }
  });

  it('dates each reviewed phrase of the page copy', () => {
    const pages: [EditionLocale, string, string][] = [
      ['es', 'Hoy', 'El cielo del 12 de octubre de 2026'],
      ['es', 'Elige tu signo solar. Cada nota sale de las posiciones registradas del cielo de hoy, leídas desde las casas solares de tu signo.',
        'Elige tu signo solar. Cada nota sale de las posiciones registradas del cielo del 12 de octubre de 2026, leídas desde las casas solares de tu signo.'],
      ['es', '¿Tienes tu carta natal? La comparación privada con el cielo de hoy está en',
        '¿Tienes tu carta natal? La comparación privada con el cielo del 12 de octubre de 2026 está en'],
      ['es', 'Horóscopos de hoy', 'Horóscopos del 12 de octubre de 2026'],
      ['es', 'Busca tu signo y encontrarás la nota más concreta del cielo de hoy.', 'Busca tu signo y encontrarás la nota más concreta del cielo del 12 de octubre de 2026.'],
      ['es', 'Leer hoy →', 'Lectura del 12 de octubre de 2026 →'],
      ['es', 'Un cielo tranquilo hoy.', 'Un cielo tranquilo el 12 de octubre de 2026.'],
      ['pt', 'Hoje', 'O céu de 12 de outubro de 2026'],
      ['pt', 'Escolha o seu signo solar. Cada nota vem das posições registradas do céu de hoje, lidas a partir das casas solares do seu signo.',
        'Escolha o seu signo solar. Cada nota vem das posições registradas do céu de 12 de outubro de 2026, lidas a partir das casas solares do seu signo.'],
      ['pt', 'Já tem o seu mapa astral? A comparação privada com o céu de hoje está na',
        'Já tem o seu mapa astral? A comparação privada com o céu de 12 de outubro de 2026 está na'],
      ['pt', 'Horóscopos de hoje', 'Horóscopos de 12 de outubro de 2026'],
      ['pt', 'Encontre o seu signo e veja a nota mais concreta sobre o céu de hoje.', 'Encontre o seu signo e veja a nota mais concreta sobre o céu de 12 de outubro de 2026.'],
      ['pt', 'Ler hoje →', 'Leitura de 12 de outubro de 2026 →'],
      ['pt', 'Um céu tranquilo hoje.', 'Um céu tranquilo em 12 de outubro de 2026.'],
    ];
    for (const [locale, current, dated] of pages) expect(datedEditionTextIn(locale, current, date)).toBe(dated);
    // The heading keeps the whitespace the template puts around it.
    expect(datedEditionTextIn('es', '\n        Hoy\n      ', date)).toBe('\n        El cielo del 12 de octubre de 2026\n      ');
  });

  it('dates every sign heading and sign link', () => {
    for (const sign of SIGNS) {
      const es = signName(sign, 'es');
      const pt = signName(sign, 'pt');
      expect(datedEditionTextIn('es', `\n  ${es} hoy\n`, date)).toBe(`\n  ${es}, ${label.es}\n`);
      expect(datedEditionTextIn('pt', `\n  ${pt} hoje\n`, date)).toBe(`\n  ${pt} em ${label.pt}\n`);
      expect(datedEditionTextIn('es', `Horóscopo de ${es} de hoy`, date)).toBe(`Horóscopo de ${es} del ${label.es}`);
      expect(datedEditionTextIn('pt', `Horóscopo de ${pt} de hoje`, date)).toBe(`Horóscopo de ${pt} de ${label.pt}`);
    }
  });

  it('gives every reading line the templates write a reviewed dated form', () => {
    const base = dailyData as Daily;
    const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
    const at = `${base.date}T08:00:00Z`;
    const editions: Daily[] = [{ ...base, bodies: [], events: [] }];
    for (const sign of SIGNS) {
      // The Moon in every sign puts its line in every house of every Sun sign.
      editions.push({ ...base, events: [], bodies: base.bodies.map((body) => (body.body === 'Moon' ? { ...body, sign: sign.slug } : body)) });
      for (const planet of planets) editions.push({ ...base, events: [{ kind: 'ingress', at, planet, sign: sign.slug, degree: 0 }] });
    }
    for (const [a, b] of [['Sun', 'Moon'], ['Mercury', 'Jupiter'], ['Mars', 'Saturn'], ['Jupiter', 'Pluto']]) {
      for (const type of ['conjunction', 'opposition', 'square', 'trine', 'sextile']) {
        editions.push({ ...base, events: [{ kind: 'aspect', at, a, b, type, orb: 0 }] });
      }
    }
    const shapes = {
      es: [
        [/^La Luna pasa hoy por (.+)$/u, (m: string[]) => `El ${label.es}, la Luna pasa por ${m[1]}`],
        [/^(.+) entra hoy en tu (\S+) casa (y .+)$/u, (m: string[]) => `${m[1]} entra en tu ${m[2]} casa el ${label.es} ${m[3]}`],
        [/^(.+) alcanza hoy su punto exacto(: .+)$/u, (m: string[]) => `${m[1]} alcanza su punto exacto el ${label.es}${m[2]}`],
        [/^Un cielo tranquilo hoy\.$/u, () => `Un cielo tranquilo el ${label.es}.`],
      ],
      pt: [
        [/^A Lua passa hoje por (.+)$/u, (m: string[]) => `Em ${label.pt}, a Lua passa por ${m[1]}`],
        [/^(.+) entra hoje na sua (.+?) casa (e .+)$/u, (m: string[]) => `${m[1]} entra na sua ${m[2]} casa em ${label.pt} ${m[3]}`],
        [/^(.+) chega hoje ao ponto exato(: .+)$/u, (m: string[]) => `${m[1]} chega ao ponto exato em ${label.pt}${m[2]}`],
        [/^Um céu tranquilo hoje\.$/u, () => `Um céu tranquilo em ${label.pt}.`],
      ],
    } as const;
    const seen = { es: new Set<string>(), pt: new Set<string>() };
    for (const daily of editions) {
      for (const locale of ['es', 'pt'] as const) {
        for (const sign of SIGNS) {
          const reading = dailyReadingForLocale(sign.slug, daily, locale);
          for (const text of [reading.headline, ...reading.lines.map((line) => line.text)]) {
            if (!/\b(?:hoy|hoje)\b/iu.test(text) || seen[locale].has(text)) continue;
            seen[locale].add(text);
            const shape = shapes[locale].find(([pattern]) => pattern.test(text));
            expect(shape, `${locale}: no reviewed dated form for "${text}"`).toBeDefined();
            const [pattern, dated] = shape!;
            expect(datedEditionTextIn(locale, text, date)).toBe(dated(text.match(pattern)!));
          }
        }
      }
    }
    // Every house for the Moon, and every planet's ingress into every house.
    expect(seen.es.size).toBeGreaterThanOrEqual(12 + 10 * 12);
    expect(seen.pt.size).toBe(seen.es.size);
  });

  it('dates nothing outside the reviewed phrases', () => {
    for (const text of ['Hoy en día, hoy mismo.', 'Hoy, Marte cambia de signo.', 'Aries · hoy']) {
      expect(datedEditionTextIn('es', text, date)).toBe(text);
    }
    for (const text of ['Hoje em dia, até hoje.', 'Hoje, Marte muda de signo.', 'Leia hoje o seu signo.']) {
      expect(datedEditionTextIn('pt', text, date)).toBe(text);
    }
    expect(editionRules('ar')).toBeNull();
    // The held French and Italian daily editions (locale expansion) date every relative word.
    expect(datedEditionTextIn('fr', 'La Lune traverse aujourd’hui le Lion. Le ciel d’aujourd’hui.', '2026-11-08'))
      .toBe('Le 8 novembre 2026, la Lune traverse le Lion. Le ciel du 8 novembre 2026.');
    expect(datedEditionTextIn('it', 'Oggi, il cielo di oggi per il Leone.', '2026-11-08'))
      .toBe('L’8 novembre 2026, il cielo dell’8 novembre 2026 per il Leone.');
    expect(datedEditionTextIn('it', 'La Luna attraversa oggi il Leone.', '2026-12-01'))
      .toBe('Il 1° dicembre 2026 la Luna attraversa il Leone.');
    for (const [locale, words] of [['fr', ['aujourd’hui', 'Aujourd’hui']], ['it', ['oggi', 'Oggi']]] as const) {
      for (const text of words) {
        expect(datedEditionTextIn(locale, `x ${text} y`, '2026-11-08')).not.toMatch(/aujourd’hui|\boggi\b/iu);
      }
    }
  });

  it('inlines rules that date text in the browser exactly as on the server', () => {
    const samples = {
      en: ['Today', 'Compare today’s sky, as of today.', 'Today, read today’s sky.'],
      es: ['Hoy', '\n  Piscis hoy\n', 'Horóscopo de Cáncer de hoy', 'La Luna pasa hoy por tu sexta casa: el trabajo.', 'Leer hoy →', 'Horóscopos de hoy'],
      pt: ['Hoje', '\n  Leão hoje\n', 'Horóscopo de Gêmeos de hoje', 'Vênus entra hoje na sua décima segunda casa e coloca o foco', 'Ler hoje →', 'céu de hoje'],
    } as const;
    for (const locale of ['en', 'es', 'pt'] as const) {
      const rules = inlineEditionRules(locale, date).map(([source, flags, replacement]) => [new RegExp(source, flags), replacement] as const);
      for (const text of samples[locale]) {
        const browser = rules.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text as string);
        expect(browser).toBe(datedEditionTextIn(locale, text, date));
        expect(browser).not.toBe(text);
      }
    }
  });
});

describe('dated tab titles and the pt-BR first of the month', () => {
  it('writes the first of a month as 1º in pt-BR, exactly as the pages print it', () => {
    expect(editionDateLabel('2026-11-01', 'pt')).toBe('1º de novembro de 2026');
    expect(editionDateLabel('2026-11-11', 'pt')).toBe('11 de novembro de 2026');
    expect(editionDateLabel('2026-11-21', 'pt')).toBe('21 de novembro de 2026');
    expect(editionDateLabel('2026-11-01', 'es')).toBe('1 de noviembre de 2026');
    expect(editionDateLabel('2026-11-01', 'en')).toBe('November 1, 2026');
    const options = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' } as const;
    expect(formatDate('pt', '2026-11-01T12:00:00Z', options)).toBe('1º de novembro de 2026');
    expect(formatDate('pt', '2026-11-01T12:00:00Z', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })).toBe('01/11/2026');
    expect(datedEditionTextIn('pt', 'Hoje', '2026-11-01')).toBe('O céu de 1º de novembro de 2026');
  });

  it('dates each Spanish and Portuguese tab title and leaves English as it is', () => {
    const titles: [string, string, string][] = [
      ['es', 'Hoy — el cielo del 12 de octubre de 2026 | Zodiacs.org', 'El cielo del 12 de octubre de 2026 | Zodiacs.org'],
      ['es', 'Horóscopos de hoy — 12 de octubre de 2026 | Zodiacs.org', 'Horóscopos del 12 de octubre de 2026 | Zodiacs.org'],
      ['pt', 'Hoje — o céu de 1º de novembro de 2026 | Zodiacs.org', 'O céu de 1º de novembro de 2026 | Zodiacs.org'],
      ['pt', 'Horóscopos de hoje — 12 de outubro de 2026 | Zodiacs.org', 'Horóscopos de 12 de outubro de 2026 | Zodiacs.org'],
      ['en', 'Daily Horoscopes — October 12, 2026, All 12 Signs | Zodiacs.org', 'Daily Horoscopes — October 12, 2026, All 12 Signs | Zodiacs.org'],
      // The same titles once their dash is written as a comma or a colon.
      ['es', 'Hoy, el cielo del 12 de octubre de 2026 | Zodiacs.org', 'El cielo del 12 de octubre de 2026 | Zodiacs.org'],
      ['es', 'Horóscopos de hoy, 12 de octubre de 2026 | Zodiacs.org', 'Horóscopos del 12 de octubre de 2026 | Zodiacs.org'],
      ['pt', 'Hoje: o céu de 1º de novembro de 2026 | Zodiacs.org', 'O céu de 1º de novembro de 2026 | Zodiacs.org'],
      ['pt', 'Horóscopos de hoje, 12 de outubro de 2026 | Zodiacs.org', 'Horóscopos de 12 de outubro de 2026 | Zodiacs.org'],
    ];
    for (const [locale, title, dated] of titles) expect(datedEditionTitleIn(locale, title)).toBe(dated);
    for (const sign of SIGNS) {
      const es = signName(sign, 'es');
      const pt = signName(sign, 'pt');
      expect(datedEditionTitleIn('es', `Horóscopo de ${es} hoy, 12 de octubre | Zodiacs.org`)).toBe(`Horóscopo de ${es} del 12 de octubre | Zodiacs.org`);
      expect(datedEditionTitleIn('pt', `Horóscopo de ${pt} hoje, 1º de novembro | Zodiacs.org`)).toBe(`Horóscopo de ${pt} de 1º de novembro | Zodiacs.org`);
    }
    expect(editionTitleRules('en')).toEqual([]);
    expect(editionTitleRules('ar')).toEqual([]);
    expect(datedEditionTitleIn('it', 'Oroscopo Leone oggi, 8 novembre | Zodiacs.org')).toBe('Oroscopo Leone dell’8 novembre | Zodiacs.org');
    expect(datedEditionTitleIn('fr', 'Horoscope Lion aujourd’hui, 8 novembre | Zodiacs.org')).toBe('Horoscope Lion du 8 novembre | Zodiacs.org');
  });

  it('inlines title rules that date a title in the browser exactly as on the server', () => {
    for (const [locale, title] of [['es', 'Horóscopo de Piscis hoy, 12 de octubre | Zodiacs.org'], ['pt', 'Hoje — o céu de 12 de outubro de 2026 | Zodiacs.org'], ['pt', 'Hoje, o céu de 12 de outubro de 2026 | Zodiacs.org']] as const) {
      const browser = inlineEditionTitleRules(locale)
        .map(([source, flags, replacement]) => [new RegExp(source, flags), replacement] as const)
        .reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), title as string);
      expect(browser).toBe(datedEditionTitleIn(locale, title));
      expect(browser).not.toBe(title);
    }
  });
});


describe('dated wording on the held Russian daily pages', () => {
  const date = '2026-11-09';
  const label = '9 ноября 2026 года';
  const TODAY_WORD = /сегодня/iu;

  it('spells the year out, so a dated phrase can end a sentence', () => {
    expect(editionDateLabel(date, 'ru')).toBe(label);
    expect(editionDateLabel('2026-12-01', 'ru')).toBe('1 декабря 2026 года');
    expect(formatDate('ru', `${date}T12:00:00Z`, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }))
      .toBe('9 ноября 2026 г.');
  });

  it('dates each reviewed phrase', () => {
    const pages: [string, string][] = [
      ['Сегодня', `Небо на ${label}`],
      ['\n  Лев сегодня\n', `\n  Лев, ${label}\n`],
      ['Луна сегодня проходит ваш пятый дом: творчество, романтика, дети и удовольствия.',
        `${label} Луна проходит ваш пятый дом: творчество, романтика, дети и удовольствия.`],
      ['Марс сегодня входит в ваш шестой дом, и на первый план выходят текущая работа.',
        `Марс ${label} входит в ваш шестой дом, и на первый план выходят текущая работа.`],
      ['Сегодня небо спокойное.', `${label} небо спокойное.`],
      ['Читать прогноз на сегодня →', `Читать прогноз на ${label} →`],
      ['Небо сегодня', `Небо ${label}`],
    ];
    for (const [current, dated] of pages) expect(datedEditionTextIn('ru', current, date)).toBe(dated);
    for (const sign of SIGNS) {
      const name = signName(sign, 'ru');
      expect(datedEditionTextIn('ru', `\n  ${name} сегодня\n`, date)).toBe(`\n  ${name}, ${label}\n`);
    }
  });

  it('leaves no «сегодня» in any daily copy string or reading line once dated', () => {
    // Every string the Russian daily copy can print, called with each sign's name.
    const texts = new Set<string>();
    const walk = (value: unknown, args: unknown[], depth = 0): void => {
      if (depth > 6 || value == null) return;
      if (typeof value === 'string') { texts.add(value); return; }
      if (Array.isArray(value)) { value.forEach((item) => walk(item, args, depth + 1)); return; }
      if (typeof value === 'function') {
        try { walk((value as (...input: unknown[]) => unknown)(...args), args, depth + 1); } catch { /* a signature these args do not fit */ }
        return;
      }
      if (typeof value === 'object') Object.values(value as Record<string, unknown>).forEach((item) => walk(item, args, depth + 1));
    };
    for (const sign of SIGNS) {
      const name = signName(sign, 'ru');
      walk(russianDailyCopy, [name, '9 ноября 2026 г.', 3, 2]);
      walk(russianDailyCopy, ['9 ноября 2026 г.', name, name, 1]);
    }
    // Every reading line: the Moon in every house, every planet's ingress, stations, lunations and aspects.
    const base = dailyData as Daily;
    const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
    const at = `${base.date}T08:00:00Z`;
    const editions: Daily[] = [{ ...base, bodies: [], events: [] }];
    for (const sign of SIGNS) {
      editions.push({ ...base, events: [], bodies: base.bodies.map((body) => (body.body === 'Moon' ? { ...body, sign: sign.slug } : body)) });
      for (const planet of planets) editions.push({ ...base, events: [{ kind: 'ingress', at, planet, sign: sign.slug, degree: 0 }] });
      for (const type of ['retrograde', 'direct']) editions.push({ ...base, events: [{ kind: 'station', at, planet: 'Mercury', sign: sign.slug, type, degree: 12 }] });
      for (const type of ['new', 'full']) editions.push({ ...base, events: [{ kind: 'lunation', at, sign: sign.slug, type, degree: 12 }] });
    }
    for (const type of ['conjunction', 'opposition', 'square', 'trine', 'sextile']) {
      editions.push({ ...base, events: [{ kind: 'aspect', at, a: 'Sun', b: 'Saturn', type, orb: 0 }] });
    }
    for (const daily of editions) {
      for (const sign of SIGNS) {
        const reading = dailyReadingRu(sign.slug, daily);
        for (const text of [reading.headline, ...reading.lines.map((line) => line.text)]) texts.add(text);
      }
    }
    const withToday = [...texts].filter((text) => TODAY_WORD.test(text));
    expect(withToday.length).toBeGreaterThan(20);
    const survivors = withToday.map((text) => datedEditionTextIn('ru', text, date)).filter((text) => TODAY_WORD.test(text));
    expect(survivors).toEqual([]);
    // The browser applies the same rules to the same result.
    const rules = inlineEditionRules('ru', date).map(([source, flags, replacement]) => [new RegExp(source, flags), replacement] as const);
    for (const text of withToday) {
      expect(rules.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text)).toBe(datedEditionTextIn('ru', text, date));
    }
  });

  it('keeps the Russian daily reading on the same receipts as every other locale', () => {
    const daily = dailyData as Daily;
    for (const sign of SIGNS) {
      const ru = dailyReadingRu(sign.slug, daily).lines;
      const es = dailyReadingForLocale(sign.slug, daily, 'es').lines;
      expect(ru.map(({ templateId, scope, evidenceRefs, house, body }) => ({ templateId, scope, evidenceRefs, house, body })))
        .toEqual(es.map(({ templateId, scope, evidenceRefs, house, body }) => ({ templateId, scope, evidenceRefs, house, body })));
    }
  });

  it('dates the Russian tab titles', () => {
    for (const sign of SIGNS) {
      const name = signName(sign, 'ru');
      expect(datedEditionTitleIn('ru', `${name}: гороскоп на сегодня, 9 ноября | Zodiacs.org`)).toBe(`${name}: гороскоп на 9 ноября | Zodiacs.org`);
    }
    expect(datedEditionTitleIn('ru', 'Небо на сегодня, 9 ноября 2026 г. | Zodiacs.org')).toBe('Небо на 9 ноября 2026 г. | Zodiacs.org');
    expect(datedEditionTitleIn('ru', 'Гороскопы на сегодня, 9 ноября 2026 г. | Zodiacs.org')).toBe('Гороскопы на 9 ноября 2026 г. | Zodiacs.org');
    const titles = [
      russianDailyCopy.horoscope.title('Скорпион', '9 ноября'),
      russianDailyCopy.today.title('9 ноября 2026 г.'),
      russianDailyCopy.hub.title('9 ноября 2026 г.'),
    ];
    for (const title of titles) expect(datedEditionTitleIn('ru', title)).not.toMatch(/сегодня/iu);
  });
});
