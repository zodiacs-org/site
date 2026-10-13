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
    for (const locale of ['fr', 'it', 'ru', 'ar']) expect(editionRules(locale)).toBeNull();
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
    ];
    for (const [locale, title, dated] of titles) expect(datedEditionTitleIn(locale, title)).toBe(dated);
    for (const sign of SIGNS) {
      const es = signName(sign, 'es');
      const pt = signName(sign, 'pt');
      expect(datedEditionTitleIn('es', `Horóscopo de ${es} hoy, 12 de octubre | Zodiacs.org`)).toBe(`Horóscopo de ${es} del 12 de octubre | Zodiacs.org`);
      expect(datedEditionTitleIn('pt', `Horóscopo de ${pt} hoje, 1º de novembro | Zodiacs.org`)).toBe(`Horóscopo de ${pt} de 1º de novembro | Zodiacs.org`);
    }
    expect(editionTitleRules('en')).toEqual([]);
    expect(editionTitleRules('fr')).toEqual([]);
  });

  it('inlines title rules that date a title in the browser exactly as on the server', () => {
    for (const [locale, title] of [['es', 'Horóscopo de Piscis hoy, 12 de octubre | Zodiacs.org'], ['pt', 'Hoje — o céu de 12 de outubro de 2026 | Zodiacs.org']] as const) {
      const browser = inlineEditionTitleRules(locale)
        .map(([source, flags, replacement]) => [new RegExp(source, flags), replacement] as const)
        .reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), title as string);
      expect(browser).toBe(datedEditionTitleIn(locale, title));
      expect(browser).not.toBe(title);
    }
  });
});

