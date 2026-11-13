import { RUSSIAN_UI_PLURALS } from '../ui/ru.js';
import type { RussianRuntimePayload } from './schema.js';

/**
 * R1-only browser copy. Base.astro serializes this object only into Russian
 * preview pages; public locale bundles must never import these literals.
 */
export const RUSSIAN_RUNTIME = {
  signs: {
    names: {
      aries: 'Овен', taurus: 'Телец', gemini: 'Близнецы', cancer: 'Рак',
      leo: 'Лев', virgo: 'Дева', libra: 'Весы', scorpio: 'Скорпион',
      sagittarius: 'Стрелец', capricorn: 'Козерог', aquarius: 'Водолей', pisces: 'Рыбы',
    },
    dates: {
      aries: 'с 21 мар по 19 апр', taurus: 'с 20 апр по 20 мая', gemini: 'с 21 мая по 20 июн',
      cancer: 'с 21 июн по 22 июл', leo: 'с 23 июл по 22 авг', virgo: 'с 23 авг по 22 сен',
      libra: 'с 23 сен по 22 окт', scorpio: 'с 23 окт по 21 ноя', sagittarius: 'с 22 ноя по 21 дек',
      capricorn: 'с 22 дек по 19 янв', aquarius: 'с 20 янв по 18 фев', pisces: 'с 19 фев по 20 мар',
    },
    essences: {
      aries: 'Первый со старта, прямой, быстрый, не боится начинать.',
      taurus: 'Твёрдые руки, хороший вкус и долгая память на уют.',
      gemini: 'Быстрые, любопытные, созданы для разговора.',
      cancer: 'Сначала чувствует, всё помнит, бережёт то, что любит.',
      leo: 'Тёплое сердце, выразительность, рождён для света.',
      virgo: 'Точная, полезная, тихо ведёт всё хозяйство.',
      libra: 'Взвешивают всё, ради красоты и ради справедливости.',
      scorpio: 'Глубина, выдержка и взгляд, который не отвести.',
      sagittarius: 'Дальняя дорога, широкая мысль, честный смех.',
      capricorn: 'Долгий подъём, сухой юмор, результат по расписанию.',
      aquarius: 'Свой угол зрения. И дверь, открытая будущему.',
      pisces: 'Мягкая настройка на всех, море внутри.',
    },
    prepositional: {
      aries: 'Овне', taurus: 'Тельце', gemini: 'Близнецах', cancer: 'Раке',
      leo: 'Льве', virgo: 'Деве', libra: 'Весах', scorpio: 'Скорпионе',
      sagittarius: 'Стрельце', capricorn: 'Козероге', aquarius: 'Водолее', pisces: 'Рыбах',
    },
    elements: { fire: 'огонь', earth: 'земля', air: 'воздух', water: 'вода' },
    modalities: { cardinal: 'кардинальный', fixed: 'фиксированный', mutable: 'мутабельный' },
  },
  astrology: {
    planets: {
      Sun: 'Солнце', Moon: 'Луна', Mercury: 'Меркурий', Venus: 'Венера', Mars: 'Марс',
      Jupiter: 'Юпитер', Saturn: 'Сатурн', Uranus: 'Уран', Neptune: 'Нептун', Pluto: 'Плутон',
      'North Node': 'Северный узел', 'South Node': 'Южный узел',
    },
    aspects: {
      conjunction: 'соединение', sextile: 'секстиль', square: 'квадратура',
      trine: 'трин', opposition: 'оппозиция',
    },
    moonPhases: {
      'New Moon': 'Новолуние',
      'Waxing Crescent': 'Растущий серп',
      'First Quarter': 'Первая четверть',
      'Waxing Gibbous': 'Растущая Луна',
      'Full Moon': 'Полнолуние',
      'Waning Gibbous': 'Убывающая Луна',
      'Last Quarter': 'Последняя четверть',
      'Waning Crescent': 'Убывающий серп',
    },
  },
  chart: {
    lens: {
      rail: 'Карта во времени', natal: 'Натальная', sky: 'Небо сейчас',
      progressed: 'Прогрессии', return: 'Солнечное возвращение',
    },
    detail: { lead: 'Точные данные карты: ', placements: ' положений · ', aspects: ' аспектов' },
    wheelActions: {
      actions: 'Действия с картой',
      guide: 'Пройти экскурсию',
      replay: 'Повторить экскурсию',
      another: 'Прочитать другую карту (пока по-английски)',
      signatureSelf: 'Характерный рисунок вашей карты',
      signatureOther: 'Характерный рисунок этой карты',
      compareMine: 'Сравнить с моей (пока по-английски)',
      compareAdd: 'Добавить мою карту для сравнения (пока по-английски)',
      shareOther: 'Поделиться этой картой',
      spotlight: 'Выделено на этой карте',
    },
    chartBook: { label: 'Чья это карта?', save: 'Сохранить', skip: 'Пропустить' },
    registryAura: {
      discover: 'Сохранённую карту можно сопоставить с записями Реестра по публичному адресу.',
      discoverLink: 'Открыть карту рядом с публичным адресом (пока по-английски) →',
      return: 'Карта сохранена.',
      returnLink: 'Вернуться в Registry Collection (пока по-английски) →',
    },
    personChartTemplate: 'Карта «{name}»: ниже «вы» относится к этому человеку.',
    otherSubject: {
      unnamed: 'Вы читаете карту другого человека. Ниже «вы» означает человека, чьи данные рождения вы ввели.',
      namedTemplate: 'Вы читаете карту «{name}». Ниже «вы» относится к этому человеку.',
      headingTemplate: 'Натальная карта: {name}',
      headingUnnamed: 'Натальная карта другого человека',
      submit: 'Обновить эту карту',
      privacy: 'Приватно по умолчанию. Данные рождения этого человека остаются в браузере.',
    },
    autoNameSun: 'Солнце',
    autoNameSunTemplate: 'Солнце в {sign}',
    sharedBirthplace: 'Общее место рождения',
    englishOnlyTitle: 'Материал пока доступен по-английски',
    englishOnlySuffix: ' (пока по-английски)',
  },
  plurals: RUSSIAN_UI_PLURALS,
} as const satisfies RussianRuntimePayload;

export function serverRussianRuntime(): RussianRuntimePayload {
  return RUSSIAN_RUNTIME;
}
