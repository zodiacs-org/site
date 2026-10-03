import { afterEach, describe, expect, it } from 'vitest';
import {
  CATALOG_LOCALES,
  RELEASED_LOCALES,
  normalizeCatalogLocale,
  normalizeLocale,
  requireCatalogLocale,
} from '../core';
import { aspectLabel, moonPhaseLabel, planetLabel } from '../astrology';
import { tp } from '../plural';
import {
  SIGN_SLUGS,
  elementLabel,
  modalityLabel,
  signDates,
  signEssence,
  signName,
  signPrepositional,
} from '../../signs';
import en from './en';
import ru, { RUSSIAN_UI_PLURALS } from './ru';
import { clientUi, clientUiMessage } from './client';
import { serverUiMessage } from './server';
import type { ClientUiPayload, UiKey } from './schema';

type ClientUiGlobal = typeof globalThis & { __ZDX_UI__?: ClientUiPayload };
const clientGlobal = globalThis as ClientUiGlobal;

function placeholders(message: string): string[] {
  return [...message.matchAll(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g)]
    .map((match) => match[1])
    .sort();
}

afterEach(() => {
  Reflect.deleteProperty(clientGlobal, '__ZDX_UI__');
});

describe('Russian staged catalog', () => {
  it('covers every UI key and preserves every interpolation token', () => {
    const englishKeys = Object.keys(en).sort() as UiKey[];
    expect(englishKeys).toHaveLength(452);
    expect(Object.keys(ru).sort()).toEqual(englishKeys);
    for (const key of englishKeys) {
      expect(placeholders(ru[key]), `ru.${key}`).toEqual(placeholders(en[key]));
    }
  });

  it('pins representative exact deck copy', () => {
    expect(ru.navTools).toBe('Инструменты');
    expect(ru.privacyDevice).toBe('Приватно по умолчанию. Данные рождения остаются в этом браузере.');
    expect(ru.skyAsOf).toBe('{date} · 12 UTC');
    expect(ru.emailCapturePersonalTitle).toBe('Ваша неделя {sign} впереди.');
    expect(ru.emailConfirmIgnore).toContain('Ссылка действует 48 часов.');
  });

  it('renders the complete catalog without releasing or indexing Russian', () => {
    expect(CATALOG_LOCALES).toContain('ru');
    expect(RELEASED_LOCALES).not.toContain('ru');
    expect(normalizeCatalogLocale('ru-RU')).toBe('ru');
    expect(normalizeLocale('ru-RU')).toBe('en');
    expect(requireCatalogLocale('ru')).toBe('ru');
    expect(() => requireCatalogLocale('ar')).toThrow('Locale ar has no complete production catalog');
    expect(serverUiMessage('ru', 'birthChart')).toBe('Натальная карта');
  });

  it('loads the Russian catalog into gated client islands', () => {
    clientGlobal.__ZDX_UI__ = { locale: 'ru', messages: ru };
    expect(clientUi('ru')).toBe(ru);
    expect(clientUiMessage('ru', 'moonSign')).toBe('Лунный знак');
    expect(() => clientUi('ar')).toThrow('Locale ar has no complete production catalog');
  });

  it('pins Russian astrology and all twelve sign overrides', () => {
    expect(planetLabel('ru', 'North Node')).toBe('Северный узел');
    expect(aspectLabel('ru', 'square')).toBe('квадратура');
    expect(moonPhaseLabel('ru', 'Waning Crescent')).toBe('Убывающий серп');
    expect(SIGN_SLUGS.map((slug) => signName(slug, 'ru'))).toEqual([
      'Овен', 'Телец', 'Близнецы', 'Рак', 'Лев', 'Дева',
      'Весы', 'Скорпион', 'Стрелец', 'Козерог', 'Водолей', 'Рыбы',
    ]);
    expect(signDates('aries', 'ru')).toBe('21 мар – 19 апр');
    expect(signEssence('taurus', 'ru')).toBe('Твёрдые руки, хороший вкус и долгая память на уют.');
    expect(signPrepositional('aquarius')).toBe('Водолее');
    expect(elementLabel('water', 'ru')).toBe('вода');
    expect(modalityLabel('mutable', 'ru')).toBe('мутабельный');
  });

  it('selects reviewed Russian forms for every R1 count family', () => {
    const expected = {
      charts: ['1 карта', '2 карты', '5 карт', '1.5 карты'],
      savedCharts: ['1 сохранённая карта', '2 сохранённые карты', '5 сохранённых карт', '1.5 сохранённой карты'],
      aspects: ['1 аспект', '2 аспекта', '5 аспектов', '1.5 аспекта'],
      activeTransits: ['1 активный транзит', '2 активных транзита', '5 активных транзитов', '1.5 активного транзита'],
      places: ['1 место', '2 места', '5 мест', '1.5 места'],
      windows: ['1 окно', '2 окна', '5 окон', '1.5 окна'],
      years: ['1 год', '2 года', '5 лет', '1.5 года'],
      days: ['1 день', '2 дня', '5 дней', '1.5 дня'],
    } as const;

    for (const [key, forms] of Object.entries(expected)) {
      expect([1, 2, 5, 1.5].map((count) => tp('ru', key, count, RUSSIAN_UI_PLURALS)), key)
        .toEqual(forms);
      expect(tp('ru', key, 21, RUSSIAN_UI_PLURALS), `${key}.21`).toBe(forms[0].replace('1 ', '21 '));
      expect(tp('ru', key, 22, RUSSIAN_UI_PLURALS), `${key}.22`).toBe(forms[1].replace('2 ', '22 '));
      expect(tp('ru', key, 25, RUSSIAN_UI_PLURALS), `${key}.25`).toBe(forms[2].replace('5 ', '25 '));
    }
  });
});
