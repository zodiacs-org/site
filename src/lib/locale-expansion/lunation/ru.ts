/**
 * Новолуния и полнолуния на русском, по фактам каталога. Московское время в
 * ответе FAQ вычисляется из самого момента через Intl (Europe/Moscow), вместе
 * со сдвигом относительно UTC и датой, если она отличается от даты по UTC.
 * Обращение на «вы», без длинных тире.
 */
import { degreeMinutes } from '../../today-sky';
import { dayMonth } from '../horoscope/format';
import { SIGN_FORMS, THEME, inSign } from '../horoscope/ru';
import type { LunationCopy, LunationFacts } from './types';

const kindName = (f: LunationFacts) => (f.kind === 'full' ? 'Полнолуние' : 'Новолуние');
const kindLower = (f: LunationFacts) => (f.kind === 'full' ? 'полнолуние' : 'новолуние');
const year = (at: string) => at.slice(0, 4);
/** «24 ноября 2026 года» */
const when = (f: LunationFacts) => `${dayMonth('ru', f.at)} ${year(f.at)} года`;
const clock = (f: LunationFacts) => `${f.at.slice(11, 16)} UTC`;
/** «2°19′ Близнецов» */
const degree = (f: LunationFacts) => `${degreeMinutes(f.degree)} ${SIGN_FORMS[f.sign]?.gen ?? f.sign}`;
const signNom = (slug: string) => SIGN_FORMS[slug]?.nom ?? slug;

/** «час», «часа», «часов» */
function hoursWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'час';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'часа';
  return 'часов';
}
const HOURS = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть'];

/** Московское время для этого момента: часы, сдвиг от UTC в эту дату и дата, если она другая. */
function moscow(f: LunationFacts): { time: string; offset: string } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    day: '2-digit', month: '2-digit', year: 'numeric', timeZoneName: 'longOffset',
  }).formatToParts(new Date(f.at)).map((part) => [part.type, part.value]));
  const hm = `${parts.hour}:${parts.minute}`;
  const localDay = `${parts.year}-${parts.month}-${parts.day}`;
  const time = localDay === f.at.slice(0, 10) ? hm : `${hm}, уже ${dayMonth('ru', `${localDay}T12:00:00Z`)}`;
  const match = /([+-])(\d{2}):(\d{2})/u.exec(parts.timeZoneName ?? '');
  const hours = match ? Number(match[2]) : 0;
  const offset = !match || hours === 0
    ? 'совпадает с UTC'
    : `${match[1] === '+' ? 'опережает' : 'отстаёт от'} UTC на ${HOURS[hours] ?? hours} ${hoursWord(hours)}`;
  return { time, offset };
}

/** Что каждый знак выносит на свет, когда его освещает или затемняет Луна: винительный и родительный падежи. */
const SIGN_TOPIC: Record<string, { acc: string; gen: string }> = {
  aries: { acc: 'порыв, смелость и нетерпение', gen: 'порыва, смелости и нетерпения' },
  taurus: { acc: 'безопасность, комфорт и то, что строится медленно', gen: 'безопасности, комфорта и того, что строится медленно' },
  gemini: { acc: 'слова, любопытство и близкие связи', gen: 'слов, любопытства и близких связей' },
  cancer: { acc: 'дом, заботу о близких и семейную память', gen: 'дома, заботы о близких и семейной памяти' },
  leo: { acc: 'самовыражение, гордость и радость', gen: 'самовыражения, гордости и радости' },
  virgo: { acc: 'порядок, тщательную работу и детали', gen: 'порядка, тщательной работы и деталей' },
  libra: { acc: 'договорённости, чувство справедливости и жизнь вдвоём', gen: 'договорённостей, чувства справедливости и жизни вдвоём' },
  scorpio: { acc: 'доверие, близость и глубокие перемены', gen: 'доверия, близости и глубоких перемен' },
  sagittarius: { acc: 'смысл, путешествия и убеждения', gen: 'смысла, путешествий и убеждений' },
  capricorn: { acc: 'ответственность, цели и долгую дистанцию', gen: 'ответственности, целей и долгой дистанции' },
  aquarius: { acc: 'дружбу, сообщества и новые идеи', gen: 'дружбы, сообществ и новых идей' },
  pisces: { acc: 'чувствительность, отдых и то, что остаётся несказанным', gen: 'чувствительности, отдыха и того, что остаётся несказанным' },
};

export const ru: LunationCopy = {
  locale: 'ru',
  title: (f) => `${kindName(f)} ${inSign(f.sign)}: ${when(f)}`,
  h1: (f) => `${kindName(f)} ${inSign(f.sign)}`,
  description: (f) => `${kindName(f)} ${when(f)} наступает в ${clock(f)}, на ${degree(f)}. Что оно означает и как затрагивает каждый знак.`,
  kindLabel: (kind) => (kind === 'full' ? 'Полнолуние' : 'Новолуние'),
  crumbsRoot: 'Лунный календарь',
  lead: (f) => (f.kind === 'full'
    ? `Полнолуние ${when(f)} наступает в ${clock(f)}: Луна стоит на ${degree(f)}, а Солнце прямо напротив. Это самая светлая точка цикла: то, что началось на предыдущем новолунии, теперь хорошо видно.`
    : `Новолуние ${when(f)} наступает в ${clock(f)}: Солнце и Луна сходятся на ${degree(f)}. Оно открывает цикл примерно в четыре недели; по традиции это время сформулировать скромное и конкретное намерение.`),
  eclipseNote: (f) => (f.eclipse
    ? f.eclipse.type === 'solar'
      ? 'Это новолуние совпадает с солнечным затмением, и начало, которое оно открывает, принято считать более заметным, чем у обычного новолуния.'
      : 'Это полнолуние совпадает с лунным затмением, и завершение, которое оно приносит, принято считать более отчётливым, чем у обычного полнолуния.'
    : ''),
  factLabels: { exact: 'Точный момент', position: 'Положение', phase: 'Фаза' },
  meaning: (f) => (f.kind === 'full'
    ? [
      `Полнолуние ${inSign(f.sign)} высвечивает ${SIGN_TOPIC[f.sign]?.acc ?? ''}. Хорошее время, чтобы увидеть результаты, завершить то, что затянулось, и вслух сказать то, что вы уже знаете.`,
      'Принимать большие решения в тот же день не обязательно: полнолуние проясняет, а следующая неделя подходит, чтобы спокойно всё поправить.',
    ]
    : [
      `Новолуние ${inSign(f.sign)} открывает цикл для ${SIGN_TOPIC[f.sign]?.gen ?? ''}. Лучше один небольшой первый шаг, чем длинный список добрых намерений.`,
      'Запишите одно намерение и вернитесь к нему на следующем полнолунии, примерно через две недели.',
    ]),
  signNotesHeading: 'Как оно затрагивает каждый знак',
  signNotesIntro: 'Если считать от вашего солнечного знака (солнечные дома по целым знакам), эта Луна попадает для каждого знака в свою сферу жизни.',
  signNote: (sunSign, house) => `${signNom(sunSign)}: ${house}-й дом, ${THEME[house]}.`,
  previous: 'Предыдущее',
  next: 'Следующее',
  calendarLink: 'Лунный календарь',
  moonPhaseLink: 'Фаза Луны на любую дату',
  horoscopesLink: 'Гороскопы',
  confidence: (value) => `Уверенность прочтения ${value}%`,
  confidenceNote: 'Число показывает, насколько конкретны данные, на которых основано прочтение (здесь только солнечный знак), а не вероятность того, что что-то произойдёт.',
  method: 'Точный момент и положение рассчитаны астрономическим движком сайта. Время указано по UTC.',
  faqHeading: 'Частые вопросы',
  faq: (f) => {
    const msk = moscow(f);
    return [
      {
        q: `Во сколько наступает ${kindLower(f)} ${when(f)}?`,
        a: `Оно наступает в ${clock(f)}. В Москве, где время в эту дату ${msk.offset}, в этот момент ${msk.time}.`,
      },
      {
        q: `В каком знаке это ${kindLower(f)}?`,
        a: `${inSign(f.sign).replace(/^в/u, 'В')}, на ${degreeMinutes(f.degree)}.`,
      },
      {
        q: 'Нужна ли натальная карта, чтобы понять, что оно значит для вас?',
        a: 'Нет. Заметки по знакам опираются только на солнечный знак. По натальной карте видно, в какой именно дом оно попадает у вас.',
      },
    ];
  },
};
