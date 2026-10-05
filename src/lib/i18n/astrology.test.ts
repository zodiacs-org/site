import { describe, expect, it } from 'vitest';
import dailyData from '../../data/daily.json';
import { eventList } from '../horoscopes';
import { SIGN_SLUGS, elementLabel, modalityLabel, signDates, signEssence, signName } from '../signs';
import type { Daily } from '../daily';
import {
  aspectLabel,
  moonPhaseLabel,
  planetLabel,
} from './astrology';
import { dailyReadingForLocale } from './daily-reading';
import { intlLocale } from './dates';

const daily = dailyData as Daily;

describe('astrology localization', () => {
  it('localizes every supported planet, aspect, and moon phase label', () => {
    expect(planetLabel('es', 'Jupiter')).toBe('Júpiter');
    expect(planetLabel('es', 'Neptune')).toBe('Neptuno');
    expect(planetLabel('es', 'Pluto')).toBe('Plutón');
    expect(aspectLabel('es', 'trine')).toBe('trígono');
    expect(aspectLabel('es', 'square')).toBe('cuadratura');
    expect(moonPhaseLabel('es', 'Waning Crescent')).toBe('Luna menguante');
    expect(moonPhaseLabel('es', 'Waxing Gibbous')).toBe('Gibosa creciente');
    expect(planetLabel('pt', 'Jupiter')).toBe('Júpiter');
    expect(planetLabel('pt', 'Neptune')).toBe('Netuno');
    expect(planetLabel('pt', 'Pluto')).toBe('Plutão');
    expect(aspectLabel('pt', 'trine')).toBe('trígono');
    expect(aspectLabel('pt', 'square')).toBe('quadratura');
    expect(moonPhaseLabel('pt', 'Waning Crescent')).toBe('Lua minguante');
    expect(moonPhaseLabel('pt', 'Waxing Gibbous')).toBe('Gibosa crescente');
    expect(planetLabel('fr', 'Venus')).toBe('Vénus');
    expect(planetLabel('fr', 'North Node')).toBe('Nœud Nord');
    expect(aspectLabel('fr', 'trine')).toBe('trigone');
    expect(aspectLabel('fr', 'square')).toBe('carré');
    expect(moonPhaseLabel('fr', 'Waning Crescent')).toBe('Dernier croissant');
    expect(moonPhaseLabel('fr', 'Waxing Gibbous')).toBe('Lune gibbeuse croissante');
    expect(planetLabel('it', 'Venus')).toBe('Venere');
    expect(planetLabel('it', 'North Node')).toBe('Nodo Nord');
    expect(aspectLabel('it', 'trine')).toBe('trigono');
    expect(aspectLabel('it', 'square')).toBe('quadratura');
    expect(moonPhaseLabel('it', 'Waning Crescent')).toBe('Falce calante');
    expect(moonPhaseLabel('it', 'Waxing Gibbous')).toBe('Gibbosa crescente');
  });

  it('uses the neutral Latin American locale for Spanish dates', () => {
    expect(intlLocale('es')).toBe('es-419');
    expect(intlLocale('pt')).toBe('pt-BR');
    expect(intlLocale('fr')).toBe('fr-FR');
    expect(intlLocale('it')).toBe('it-IT');
  });

  it('localizes French sign names, dates, essences, elements, and modalities', () => {
    expect(signName('aries', 'fr')).toBe('Bélier');
    expect(signName('aquarius', 'fr')).toBe('Verseau');
    expect(signDates('pisces', 'fr')).toBe('19 févr. – 20 mars');
    expect(signEssence('libra', 'fr')).toBe('Charme, équilibre et sens aigu de la justice.');
    expect(elementLabel('water', 'fr')).toBe('Eau');
    expect(modalityLabel('fixed', 'fr')).toBe('Fixe');
  });

  it('localizes Italian sign names, dates, essences, elements, and modalities', () => {
    expect(signName('aries', 'it')).toBe('Ariete');
    expect(signName('aquarius', 'it')).toBe('Acquario');
    expect(signDates('pisces', 'it')).toBe('19 feb – 20 mar');
    expect(signEssence('libra', 'it')).toBe('Fascino, equilibrio e un senso acuto della giustizia.');
    expect(elementLabel('water', 'it')).toBe('Acqua');
    expect(modalityLabel('fixed', 'it')).toBe('Fisso');
  });

  it('localizes every visible part of the monthly transit list', () => {
    const july = eventList('2026-07', 'es').map((event) => event.label).join(' ');
    const august = eventList('2026-08', 'es').map((event) => event.label).join(' ');

    expect(july).toContain('Neptuno estaciona retrógrado');
    expect(july).toContain('Mercurio estaciona directo');
    expect(july).toContain('Luna nueva a 22° de Cáncer');
    expect(july).toContain('Neptuno estaciona retrógrado a 4° de Aries');
    expect(august).toContain('Mercurio en conjunción con Júpiter');
    expect(`${july} ${august}`).not.toMatch(
      /\b(?:Sun|Moon|Mercury|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto|retrograde|direct|conjunction|sextile|square|trine|opposition)\b/,
    );
  });

  it('keeps English transit terms out of the Brazilian Portuguese month list', () => {
    const july = eventList('2026-07', 'pt').map((event) => event.label).join(' ');
    const august = eventList('2026-08', 'pt').map((event) => event.label).join(' ');

    expect(july).toContain('Netuno estaciona retrógrado');
    expect(july).toContain('Mercúrio estaciona direto');
    expect(july).toContain('Lua nova a 22° de Câncer');
    expect(august).toContain('Mercúrio em conjunção com Júpiter');
    expect(`${july} ${august}`).not.toMatch(
      /\b(?:Sun|Moon|Mercury|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto|retrograde|direct|conjunction|sextile|square|trine|opposition)\b/,
    );
  });

  it('keeps English transit terms out of the French month list', () => {
    const july = eventList('2026-07', 'fr').map((event) => event.label).join(' ');
    const august = eventList('2026-08', 'fr').map((event) => event.label).join(' ');

    expect(july).toContain('Neptune devient rétrograde');
    expect(july).toContain('Mercure redevient direct');
    expect(july).toContain('Nouvelle Lune à 22° en Cancer');
    expect(august).toContain('Mercure en conjonction avec Jupiter');
    expect(`${july} ${august}`).not.toMatch(
      /\b(?:Sun|Moon|Mercury|Venus|Saturn|Pluto|retrograde|conjunction|square|trine|Aries|Taurus|Gemini|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)\b/,
    );
  });

  it('keeps English transit terms out of the Italian month list', () => {
    const july = eventList('2026-07', 'it').map((event) => event.label).join(' ');
    const august = eventList('2026-08', 'it').map((event) => event.label).join(' ');

    expect(july).toContain('Nettuno staziona in moto retrogrado');
    expect(july).toContain('Mercurio staziona in moto diretto');
    expect(july).toContain('Luna nuova a 22° in Cancro');
    expect(august).toContain('Mercurio in congiunzione con Giove');
    expect(`${july} ${august}`).not.toMatch(
      /\b(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto|retrograde|direct|conjunction|sextile|square|trine|opposition|Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)\b/,
    );
  });

  it('preserves TodayBySign fact selection while rendering Spanish prose', () => {
    const fixtures: Daily[] = [
      daily,
      {
        ...daily,
        events: [{
          kind: 'ingress', at: `${daily.date}T12:00:00.000Z`, planet: 'Pluto', sign: 'aquarius', degree: 0,
        }],
      },
      {
        ...daily,
        events: [{
          kind: 'lunation', at: `${daily.date}T12:00:00.000Z`, type: 'new', sign: 'cancer', degree: 18,
        }],
      },
      {
        ...daily,
        events: [{
          kind: 'station', at: `${daily.date}T12:00:00.000Z`, planet: 'Neptune', type: 'retrograde', sign: 'aries', degree: 4,
        }],
      },
      {
        ...daily,
        events: [{
          kind: 'station', at: `${daily.date}T12:00:00.000Z`, planet: 'Mercury', type: 'direct', sign: 'cancer', degree: 22,
        }],
      },
      {
        ...daily,
        events: [{
          kind: 'aspect', at: `${daily.date}T12:00:00.000Z`, a: 'Mars', b: 'Saturn', type: 'square',
        }],
      },
    ];

    for (const fixture of fixtures) for (const slug of SIGN_SLUGS) {
      const english = dailyReadingForLocale(slug, fixture, 'en');
      const spanish = dailyReadingForLocale(slug, fixture, 'es');

      expect(spanish.lines).toHaveLength(english.lines.length);
      expect(spanish.lines.map((line) => line.body)).toEqual(english.lines.map((line) => line.body));
      expect(spanish.lines.map((line) => line.receipt.match(/casa (\d+)/)?.[1] ?? null)).toEqual(
        english.lines.map((line) => line.receipt.match(/house (\d+)/)?.[1] ?? null),
      );

      const visibleSpanish = spanish.lines.map((line) => `${line.text} ${line.receipt}`).join(' ');
      expect(visibleSpanish).not.toMatch(
        /\b(?:Sun|Moon|Mercury|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto|Taurus|Gemini|Cancer|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces|house|retrograde|Waning|Waxing|Quarter|Gibbous|conjunction|sextile|square|trine|opposition)\b/,
      );
    }
  });

  it('preserves TodayBySign fact selection while rendering Brazilian Portuguese prose', () => {
    const fixtures: Daily[] = [
      daily,
      { ...daily, events: [{ kind: 'ingress', at: `${daily.date}T12:00:00.000Z`, planet: 'Pluto', sign: 'aquarius', degree: 0 }] },
      { ...daily, events: [{ kind: 'lunation', at: `${daily.date}T12:00:00.000Z`, type: 'new', sign: 'cancer', degree: 18 }] },
      { ...daily, events: [{ kind: 'station', at: `${daily.date}T12:00:00.000Z`, planet: 'Neptune', type: 'retrograde', sign: 'aries', degree: 4 }] },
      { ...daily, events: [{ kind: 'aspect', at: `${daily.date}T12:00:00.000Z`, a: 'Mars', b: 'Saturn', type: 'square' }] },
    ];

    for (const fixture of fixtures) for (const slug of SIGN_SLUGS) {
      const english = dailyReadingForLocale(slug, fixture, 'en');
      const portuguese = dailyReadingForLocale(slug, fixture, 'pt');
      expect(portuguese.lines).toHaveLength(english.lines.length);
      expect(portuguese.lines.map((line) => line.body)).toEqual(english.lines.map((line) => line.body));
      expect(portuguese.lines.map((line) => line.receipt.match(/casa (\d+)/)?.[1] ?? null)).toEqual(
        english.lines.map((line) => line.receipt.match(/house (\d+)/)?.[1] ?? null),
      );
      const visiblePortuguese = portuguese.lines.map((line) => `${line.text} ${line.receipt}`).join(' ');
      expect(visiblePortuguese).not.toMatch(
        /\b(?:Sun|Moon|Mercury|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto|Taurus|Gemini|Cancer|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces|house|retrograde|Waning|Waxing|Quarter|Gibbous|conjunction|sextile|square|trine|opposition)\b/,
      );
      expect(visiblePortuguese).not.toMatch(/\bem (?:o|a|os|as)\b/);
    }
  });

  it('preserves TodayBySign fact selection while rendering French prose', () => {
    const fixtures: Daily[] = [
      daily,
      { ...daily, events: [{ kind: 'ingress', at: `${daily.date}T12:00:00.000Z`, planet: 'Pluto', sign: 'aquarius', degree: 0 }] },
      { ...daily, events: [{ kind: 'lunation', at: `${daily.date}T12:00:00.000Z`, type: 'new', sign: 'cancer', degree: 18 }] },
      { ...daily, events: [{ kind: 'station', at: `${daily.date}T12:00:00.000Z`, planet: 'Neptune', type: 'retrograde', sign: 'aries', degree: 4 }] },
      { ...daily, events: [{ kind: 'aspect', at: `${daily.date}T12:00:00.000Z`, a: 'Mars', b: 'Saturn', type: 'square' }] },
    ];

    for (const fixture of fixtures) for (const slug of SIGN_SLUGS) {
      const english = dailyReadingForLocale(slug, fixture, 'en');
      const french = dailyReadingForLocale(slug, fixture, 'fr');
      expect(french.lines).toHaveLength(english.lines.length);
      expect(french.lines.map((line) => line.body)).toEqual(english.lines.map((line) => line.body));
      expect(french.lines.map((line) => line.receipt.match(/maison (\d+)/)?.[1] ?? null)).toEqual(
        english.lines.map((line) => line.receipt.match(/house (\d+)/)?.[1] ?? null),
      );
      const visibleFrench = french.lines.map((line) => `${line.text} ${line.receipt}`).join(' ');
      // Uranus, sextile, and opposition are spelled identically in French, so
      // they cannot mark English leakage (today's sky triggers them whenever
      // those bodies or aspects feature). Mars, Jupiter, Neptune, and Cancer
      // were already omitted for the same reason.
      expect(visibleFrench).not.toMatch(
        /\b(?:Sun|Moon|Mercury|Venus|Saturn|Pluto|Taurus|Gemini|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces|house|retrograde|Waning|Waxing|Quarter|Gibbous|conjunction|square|trine)\b/,
      );
    }
  });

  it('preserves TodayBySign fact selection while rendering Italian prose', () => {
    const fixtures: Daily[] = [
      daily,
      { ...daily, events: [{ kind: 'ingress', at: `${daily.date}T12:00:00.000Z`, planet: 'Pluto', sign: 'aquarius', degree: 0 }] },
      { ...daily, events: [{ kind: 'lunation', at: `${daily.date}T12:00:00.000Z`, type: 'new', sign: 'cancer', degree: 18 }] },
      { ...daily, events: [{ kind: 'station', at: `${daily.date}T12:00:00.000Z`, planet: 'Neptune', type: 'retrograde', sign: 'aries', degree: 4 }] },
      { ...daily, events: [{ kind: 'aspect', at: `${daily.date}T12:00:00.000Z`, a: 'Mars', b: 'Saturn', type: 'square' }] },
    ];

    for (const fixture of fixtures) for (const slug of SIGN_SLUGS) {
      const english = dailyReadingForLocale(slug, fixture, 'en');
      const italian = dailyReadingForLocale(slug, fixture, 'it');
      expect(italian.lines).toHaveLength(english.lines.length);
      expect(italian.lines.map((line) => line.body)).toEqual(english.lines.map((line) => line.body));
      expect(italian.lines.map((line) => line.receipt.match(/casa (\d+)/)?.[1] ?? null)).toEqual(
        english.lines.map((line) => line.receipt.match(/house (\d+)/)?.[1] ?? null),
      );
      const visibleItalian = italian.lines.map((line) => `${line.text} ${line.receipt}`).join(' ');
      expect(visibleItalian).not.toMatch(
        /\b(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces|house|retrograde|Waning|Waxing|Quarter|Gibbous|conjunction|sextile|square|trine|opposition)\b/,
      );
    }
  });
});
