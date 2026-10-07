import { readFileSync } from 'node:fs';
import { h } from 'preact';
import render from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import Inspector from '../islands/explorer/Inspector';
import { computeChart } from './engine/full';
import { resolveLocalToUtc } from './time/localToUtc';
import { chartSheetProvenanceLines, chartSheetSettings, shareCardTimeNotes } from './share-card';
import { shareCardText } from './share-card-copy';
import { buildSceneModel } from './scene/build';
import { decodePositionsLink, encodePositionsLink } from './share-positions';
import { t, type CatalogLocale } from './i18n';
import { previewModel, previewPlacementsFromToken } from '../server/chart-preview-model';
import en from './i18n/ui/en'; import es from './i18n/ui/es'; import fr from './i18n/ui/fr';
import itUi from './i18n/ui/it'; import pt from './i18n/ui/pt'; import ru from './i18n/ui/ru';

const catalogs = { en, es, fr, it: itUi, pt, ru };
const locales = Object.keys(catalogs) as CatalogLocale[];
const r = resolveLocalToUtc('2000-01-15', '12:00', 'Africa/Khartoum');
const chart = computeChart({ utc: r.utc, latitude: 15.5, longitude: 32.5, houseSystem: 'whole', timeKnown: false, flags: r.flags });
const details = { date: '2000-01-15', time: '12:00', timeKnown: false, city: '', country: '', timezone: 'Africa/Khartoum' };

describe('reference caption output contracts', () => {
  it('keeps the real gap-adjusted UTC and privacy choice while making no noon claim', () => {
    expect(chart.input.utc.toISOString()).toBe('2000-01-15T10:00:00.000Z');
    expect(chartSheetProvenanceLines(chart, details)).toEqual(['Birth details hidden']);
    expect(chartSheetProvenanceLines(chart, details, false)).toEqual([
      '2000-01-15 · Birth time unknown · Reference positions',
      '15.5000°N · 32.5000°E · Africa/Khartoum',
      'Reference UTC · 2000-01-15 10:00 UTC',
      'DST gap adjusted forward',
    ]);
    expect(chartSheetSettings(chart)).toBe('Reference positions · Apparent geocentric · Tropical of date · No houses · True Node');
  });

  it.each([
    ['en', 'Reference positions · Birth time unknown'],
    ['es', 'Posiciones de referencia · Hora de nacimiento desconocida'],
    ['fr', 'Positions de référence · Heure de naissance inconnue'],
    ['it', 'Posizioni di riferimento · Ora di nascita sconosciuta'],
    ['pt', 'Posições de referência · Hora de nascimento desconhecida'],
    ['ru', 'Опорные положения · Время рождения неизвестно'],
  ] as const)('%s keeps the exact generic export note with no invented clock', (locale, note) => {
    expect(shareCardTimeNotes(locale, { referenceTime: true })).toEqual([note]);
    expect(shareCardText(locale, 'referenceTimeNote')).toBe(note);
    expect(shareCardTimeNotes(locale, { referenceTime: false })).toEqual([]);
  });

  it.each(locales)('%s preserves 452 keys with complete caption retirement and two reference-Sun additions', locale => {
    const catalog = catalogs[locale];
    expect(Object.keys(catalog)).toHaveLength(452);
    expect(catalog.referenceChartName).toBeTruthy();
    expect(catalog.unknownTimeSunReference).toBeTruthy();
    for (const key of ['middayLocalCaption', 'middayUtcCaption', 'moonChangedNotice']) expect(catalog).not.toHaveProperty(key);
    for (const key of ['referenceLocalCaption', 'referenceUtcCaption', 'moonPhaseAtReference']) expect(catalog).toHaveProperty(key);
    expect(t(locale, 'moonPhaseAtReference')).not.toBe(t(locale, 'moonPhaseAtBirth'));
  });

  it.each(locales)('%s describes a clockless Inspector scene without a clock or zone assertion', locale => {
    const scene = buildSceneModel({ ...chart, moonSignCandidates: [] });
    expect(scene).not.toHaveProperty('input'); expect(scene).not.toHaveProperty('utc'); expect(scene).not.toHaveProperty('zone');
    const markup = render(h(Inspector, { scene, selection: { kind: 'body', body: 'Moon' }, onSelect() {}, locale }));
    expect(markup).toContain(t(locale, 'noTimeNotice'));
    expect(markup).not.toMatch(/12:00|12 h|civil time|гражданского/);
  });

  it('keeps a non-noon public token clockless and its reference placements unchanged', () => {
    const token = encodePositionsLink({ bodies: chart.bodies, angles: chart.angles, houseSystem: 'whole', engineVersion: chart.engineVersion })!;
    const decoded = decodePositionsLink(token)!;
    expect(Object.keys(decoded)).toEqual(['bodies', 'angles', 'houseSystem', 'engineVersion']);
    expect(decoded.angles).toBeNull();
    const model = previewModel(previewPlacementsFromToken(token)!);
    expect(model.settings).toBe('Reference positions / No houses / Tropical');
    expect(model.placements).toEqual([
      { label: 'Sun', sign: 'Capricorn', hue: '#C0DEA8', degree: '24 deg' },
      { label: 'Moon', sign: 'Taurus', hue: '#B9D4BE', degree: '5 deg' },
    ]);
  });

  it.each(['', 'es/', 'fr/', 'it/', 'pt/', 'ru/'])('%s Moon FAQ supplies the same source to visible and structured content', prefix => {
    const page = readFileSync(new URL(`../pages/${prefix}moon-phase/index.astro`, import.meta.url), 'utf8');
    expect(page).toContain('faq.map');
    expect(page).toContain('text: a');
    expect(page).toMatch(/<p>\{a\}<\/p>|items=\{faq\}/);
    expect(page).not.toMatch(/phase is exact from the date alone|phase précisément|fase puede calcularse con precisión a partir de la fecha|fase può essere calcolata con precisione dalla data|fase pode ser calculada com precisão a partir da data|Фазу можно точно рассчитать по дате/);
  });
});
