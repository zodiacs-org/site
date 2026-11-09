/**
 * The Russian daily reading. It mirrors dailyReadingForLocale in
 * src/lib/i18n/daily-reading.ts line for line: the same events first (at
 * most two), the Moon's house when no event took it, then Mercury, Venus,
 * Mars and the Sun into unused houses up to four lines, with the same
 * templateIds, scopes and evidenceRefs, so a Russian line answers to the
 * same receipts as its English twin. Only the words are Russian.
 *
 * Every «сегодня» a line says is dated by the Russian rules in
 * src/lib/edition-freshness.ts once the edition is no longer current.
 * No adjective «сегодняшний» is used, so the rules can date every form.
 */
import {
  dailyBodyFactId,
  dailyEventFactId,
  dailyHouseFactId,
  solarHouse,
  type Daily,
  type DailyBody,
  type DailyEvent,
  type DailyLine,
  type DailyReading,
} from '../daily';
import { signBySlug, signName } from '../signs';
import { aspectLabel, planetLabel } from '../i18n/astrology';

/** Ordinal house numbers, nominative (accusative of «дом» is the same) and prepositional. */
const ORDINAL = ['', 'первый', 'второй', 'третий', 'четвёртый', 'пятый', 'шестой', 'седьмой', 'восьмой', 'девятый', 'десятый', 'одиннадцатый', 'двенадцатый'];
const ORDINAL_PREP = ['', 'первом', 'втором', 'третьем', 'четвёртом', 'пятом', 'шестом', 'седьмом', 'восьмом', 'девятом', 'десятом', 'одиннадцатом', 'двенадцатом'];

/** What each solar house covers on the daily page, nominative. */
const HOUSE_THEME: Record<number, string> = {
  1: 'ваш образ и то, как вы себя подаёте',
  2: 'ценности, имущество и чувство устойчивости',
  3: 'сообщения, текущие дела, братья и сёстры, ближнее окружение',
  4: 'семья, жильё и личная жизнь',
  5: 'творчество, романтика, дети и удовольствия',
  6: 'текущая работа, полезные привычки и повседневные обязанности',
  7: 'партнёры и отношения один на один',
  8: 'общие финансы, долги, близость и доверие',
  9: 'путешествия, учёба, убеждения и дальние планы',
  10: 'карьера, репутация и публичная ответственность',
  11: 'друзья, сообщества и планы на будущее',
  12: 'отдых, уединение и незавершённые дела',
};

/** The same themes in the genitive, after «темы». */
const HOUSE_THEME_GEN: Record<number, string> = {
  1: 'вашего образа и того, как вы себя подаёте',
  2: 'ценностей, имущества и чувства устойчивости',
  3: 'сообщений, текущих дел, братьев и сестёр, ближнего окружения',
  4: 'семьи, жилья и личной жизни',
  5: 'творчества, романтики, детей и удовольствий',
  6: 'текущей работы, полезных привычек и повседневных обязанностей',
  7: 'партнёров и отношений один на один',
  8: 'общих финансов, долгов, близости и доверия',
  9: 'путешествий, учёбы, убеждений и дальних планов',
  10: 'карьеры, репутации и публичной ответственности',
  11: 'друзей, сообществ и планов на будущее',
  12: 'отдыха, уединения и незавершённых дел',
};

/** A verb that takes the house in the accusative: «Венера согревает ваш пятый дом». */
const PLANET_VERB: Record<string, string> = {
  Moon: 'Луна сегодня проходит',
  Sun: 'Солнце проходит',
  Mercury: 'Меркурий оживляет',
  Venus: 'Венера согревает',
  Mars: 'Марс заряжает энергией',
  Jupiter: 'Юпитер расширяет',
  Saturn: 'Сатурн испытывает на прочность',
  Uranus: 'Уран встряхивает',
  Neptune: 'Нептун затуманивает',
  Pluto: 'Плутон медленно перестраивает',
};

const PLANET_GEN: Record<string, string> = {
  Sun: 'Солнца', Moon: 'Луны', Mercury: 'Меркурия', Venus: 'Венеры', Mars: 'Марса',
  Jupiter: 'Юпитера', Saturn: 'Сатурна', Uranus: 'Урана', Neptune: 'Нептуна', Pluto: 'Плутона',
};
const planetGen = (body: string) => PLANET_GEN[body] ?? planetLabel('ru', body);

/** The exact aspect agrees with the aspect's own gender: «точной» for квадратура and оппозиция. */
const EXACT: Record<string, string> = {
  conjunction: 'точным', sextile: 'точным', square: 'точной', trine: 'точным', opposition: 'точной',
};

const signLabel = (slug: string) => signName(signBySlug(slug), 'ru');
/** Russian writes a decimal comma. */
const degree = (value: number) => value.toFixed(1).replace('.', ',');
const utcTime = (at: string) => `${at.slice(11, 16)} UTC`;
const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

type LineContext = { date: string; sunSign: string };

/** The same receipts the English renderer attaches, so a Russian line answers to identical evidence. */
function solarHouseProvenance(sourceFactId: string, context: LineContext, house: number) {
  return {
    scope: 'solar-house' as const,
    evidenceRefs: [sourceFactId, dailyHouseFactId(context.date, context.sunSign, sourceFactId, house)],
  };
}

function houseLine(body: DailyBody, house: number, context: LineContext): DailyLine {
  const planet = planetLabel('ru', body.body);
  const rx = body.retrograde ? ' ℞' : '';
  return {
    text: `${PLANET_VERB[body.body] ?? `${planet} проходит`} ваш ${ORDINAL[house]} дом: ${HOUSE_THEME[house]}.`,
    receipt: `${planet} ${degree(body.degree)}° ${signLabel(body.sign)}${rx} · ${house}-й дом`,
    house,
    body: body.body,
    hue: signBySlug(body.sign).hue,
    templateId: 'body-house.v1',
    ...solarHouseProvenance(dailyBodyFactId(context.date, body), context, house),
  };
}

function eventLine(event: DailyEvent, sunSign: string, date: string): DailyLine | null {
  if (event.kind === 'ingress' && event.planet && event.sign) {
    const house = solarHouse(event.sign, sunSign);
    const planet = planetLabel('ru', event.planet);
    const focus = event.planet === 'Saturn' || event.planet === 'Pluto'
      ? 'и на первый план надолго выходят'
      : 'и на первый план выходят';
    return {
      text: `${planet} сегодня входит в ваш ${ORDINAL[house]} дом, ${focus} ${HOUSE_THEME[house]}.`,
      receipt: `${planet} → 0° ${signLabel(event.sign)} · ${utcTime(event.at)}`,
      body: event.planet,
      hue: signBySlug(event.sign).hue,
      house,
      templateId: 'ingress-house.v1',
      ...solarHouseProvenance(dailyEventFactId(date, event), { date, sunSign }, house),
    };
  }
  if (event.kind === 'lunation' && event.sign) {
    const house = solarHouse(event.sign, sunSign);
    const name = event.type === 'new' ? 'Новолуние' : 'Полнолуние';
    const meaning = event.type === 'new' ? 'открывает новый цикл' : 'подводит итог';
    return {
      text: `${name} в вашем ${ORDINAL_PREP[house]} доме ${meaning}: ${HOUSE_THEME[house]}.`,
      receipt: `${name} ${degree(event.degree ?? 0)}° ${signLabel(event.sign)} · ${utcTime(event.at)}`,
      body: 'Moon',
      hue: signBySlug(event.sign).hue,
      house,
      templateId: 'lunation-house.v1',
      ...solarHouseProvenance(dailyEventFactId(date, event), { date, sunSign }, house),
    };
  }
  if (event.kind === 'station' && event.planet && event.sign) {
    const house = solarHouse(event.sign, sunSign);
    const planet = planetLabel('ru', event.planet);
    const retrograde = event.type === 'retrograde';
    const direction = retrograde ? 'переходит в ретроградное движение' : 'переходит в директное движение';
    const meaning = retrograde
      ? `пора пересмотреть темы ${HOUSE_THEME_GEN[house]}`
      : `темы ${HOUSE_THEME_GEN[house]} снова набирают ход`;
    return {
      text: `${planet} ${direction} в вашем ${ORDINAL_PREP[house]} доме: ${meaning}.`,
      receipt: `${planet}: ${retrograde ? 'ретроградная' : 'директная'} станция, ${degree(event.degree ?? 0)}° ${signLabel(event.sign)} · ${utcTime(event.at)}`,
      body: event.planet,
      hue: signBySlug(event.sign).hue,
      house,
      templateId: 'station-house.v1',
      ...solarHouseProvenance(dailyEventFactId(date, event), { date, sunSign }, house),
    };
  }
  if (event.kind === 'aspect' && event.a && event.b && event.type) {
    const a = planetLabel('ru', event.a);
    const b = planetLabel('ru', event.b);
    const aspect = aspectLabel('ru', event.type);
    return {
      text: `${cap(aspect)} ${planetGen(event.a)} и ${planetGen(event.b)} сегодня становится ${EXACT[event.type] ?? 'точным'}: это общий фон для всех знаков, а время указано в записи расчёта.`,
      receipt: `${a} ${aspect} ${b} · точно в ${utcTime(event.at)}`,
      body: event.a,
      templateId: 'aspect-collective.v1',
      scope: 'collective',
      evidenceRefs: [dailyEventFactId(date, event)],
    };
  }
  return null;
}

/** The Russian reading for one Sun sign, in the same selection order as every other locale. */
export function dailyReadingRu(sunSign: string, daily: Daily): DailyReading {
  const lines: DailyLine[] = [];
  const usedHouses = new Set<number>();

  for (const event of daily.events) {
    const line = eventLine(event, sunSign, daily.date);
    if (line) {
      lines.push(line);
      if (event.sign) usedHouses.add(solarHouse(event.sign, sunSign));
    }
    if (lines.length >= 2) break;
  }

  const byName = (name: string) => daily.bodies.find((body) => body.body === name);
  const moon = byName('Moon');
  if (moon) {
    const house = solarHouse(moon.sign, sunSign);
    if (!usedHouses.has(house)) {
      lines.push(houseLine(moon, house, { date: daily.date, sunSign }));
      usedHouses.add(house);
    }
  }

  for (const name of ['Mercury', 'Venus', 'Mars', 'Sun']) {
    if (lines.length >= 4) break;
    const body = byName(name);
    if (!body) continue;
    const house = solarHouse(body.sign, sunSign);
    if (usedHouses.has(house)) continue;
    lines.push(houseLine(body, house, { date: daily.date, sunSign }));
    usedHouses.add(house);
  }

  return { headline: lines[0]?.text ?? 'Сегодня небо спокойное.', lines };
}
