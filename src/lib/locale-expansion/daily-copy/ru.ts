/**
 * Видимые тексты ежедневных страниц на русском: гороскоп на день по знаку
 * (LocalizedHoroscope.astro), небо дня (LocalizedToday.astro) и страница
 * гороскопов (LocalizedHoroscopeHub.astro). Обращение на «вы», как в
 * ежедневном прогнозе (src/lib/locale-expansion/daily-ru.ts), «ёлочки»,
 * никаких длинных тире.
 *
 * Названия знаков приходят в именительном падеже; нужные падежи берутся из
 * таблиц horoscope/ru.ts («во Льве», «для Льва»), а не приклеиваются к
 * именительному. Каждое «сегодня» здесь датируется правилами
 * src/lib/edition-freshness.ts, когда выпуск перестаёт быть текущим; форм
 * «сегодняшний» здесь нет.
 */
import type { Copy } from '../../../components/localized/horoscope-copy';
import type { HubCopy } from '../../../components/localized/hub-copy';
import { TODAY, cap, named, type TodayCopy } from '../../../components/localized/today-copy';
import { inSign, signGen } from '../horoscope/ru';

/** Форма существительного после числа: 1 заметка, 3 заметки, 5 заметок; дробное число берёт родительный единственного. */
function plural(value: number | string, one: string, few: string, many: string): string {
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.').replace(/\s/gu, ''));
  if (!Number.isInteger(n)) return few;
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
const notesWord = (count: number) => plural(count, 'заметка', 'заметки', 'заметок');
const aspectsWord = (count: number) => plural(count, 'аспект', 'аспекта', 'аспектов');

/** Род планеты по её русскому названию, для согласования («становится ретроградной»). */
const FEMININE = new Set(['Венера', 'Луна']);
const becomes = (planet: string, retrograde: boolean) => {
  const stem = retrograde ? 'ретроградн' : 'директн';
  return `${stem}${FEMININE.has(planet) ? 'ой' : 'ым'}`;
};
/** Родительный падеж планеты по её русскому названию. */
const PLANET_GEN: Record<string, string> = {
  Солнце: 'Солнца', Луна: 'Луны', Меркурий: 'Меркурия', Венера: 'Венеры', Марс: 'Марса',
  Юпитер: 'Юпитера', Сатурн: 'Сатурна', Уран: 'Урана', Нептун: 'Нептуна', Плутон: 'Плутона',
};
const planetGen = (planet: string) => PLANET_GEN[planet] ?? planet;
/** «точный секстиль», «точную квадратуру»: аспект в винительном падеже с согласованным прилагательным. */
const EXACT: Record<string, string> = {
  conjunction: 'точное соединение', sextile: 'точный секстиль', square: 'точную квадратуру',
  trine: 'точный трин', opposition: 'точную оппозицию',
};
/** «9 ноября 2026 года» вместо «9 ноября 2026 г.», чтобы за датой могла стоять точка. */
const fullDate = (date: string) => date.replace(/ г\.$/u, ' года');

const horoscope: Copy = {
  title: (name, date) => `${name}: гороскоп на сегодня, ${date} | Zodiacs.org`,
  description: (name, date, notes) => `${name}, гороскоп на ${fullDate(date)}: ${notes} по солнечным домам знака, с реальными положениями неба и записями расчёта.`,
  notes: (count) => `${count} ${notesWord(count)}`,
  imageAlt: (name) => `${name}, ежедневный гороскоп, Zodiacs.org`,
  crumbs: 'Гороскопы',
  crumbsAria: 'Навигационная цепочка',
  h1: (name) => `${name} сегодня`,
  credit: (name) => `${name}, по иллюстрациям знаков Zodiacs`,
  periodsAria: (name) => `Периоды гороскопа для ${signGen(name)}`,
  todayWord: 'Сегодня',
  week: 'Эта неделя',
  month: 'Этот месяц',
  periodsNote: 'Неделя и месяц пока по-английски',
  railLabel: 'Сменить знак',
  metaLabel: 'Ежедневный гороскоп',
  noteCount: (count) => `${count} ${notesWord(count)}`,
  readingTitle: (name) => `Небо сегодня для ${signGen(name)}`,
  foot: (name) => `Прогноз написан для тех, у кого Солнце ${inSign(name)}. Положения неба рассчитаны, а их смысл дан в астрологической интерпретации. Используйте его как повод для размышления, а не как предсказание событий.`,
  methodLink: 'Как мы считаем',
  share: (name) => `${name}: гороскоп на сегодня`,
  shareLabel: 'Отправить этот прогноз',
  askLead: 'Есть вопросы об этом прогнозе?',
  askLabel: 'Спросить Guide',
  prompts: (name) => [
    `Что значит небо сегодня для ${signGen(name)}?`,
    'Из каких планет складывается этот прогноз?',
    'Как прочитать это в моей натальной карте?',
  ],
  railAria: 'Об этом прогнозе',
  skyTitle: 'Небо, на котором основан прогноз',
  skyBasis: '12:00 UTC',
  skySub: 'Каждая заметка опирается на одно из этих положений.',
  skyRow: (planet, sign) => `${planet} ${inSign(sign)}`,
  skyHouse: (house, name) => `${house}-й дом, если считать от ${signGen(name)}.`,
  moonLit: (phase, percent) => `${phase}, освещено ${percent}%.`,
  retrograde: 'Движется ретроградно.',
  alsoSun: (position) => `Также на этом небе: Солнце ${position}`,
  fullSky: 'Всё небо на сегодня',
  wheelAria: (date, name) => `Небо на ${fullDate(date)}, 12:00 UTC, с отсчётом домов от ${signGen(name)} как первого дома`,
  wheelCaption: (date, name, focus, count) => `Небо на ${fullDate(date)}, 12:00 UTC, на колесе ${signGen(name)}.${count > 0 ? ` В цвете: ${focus}, ${count === 1 ? 'планета этого прогноза' : 'планеты этого прогноза'}.` : ''}`,
  ctaKicker: 'Больше, чем солнечный знак',
  ctaTitle: 'Посмотрите, куда это небо попадает в вашей карте.',
  ctaLede: (name, moonSign, house) => `Этот прогноз отсчитывает колесо от ${signGen(name)}, поэтому Луна ${inSign(moonSign)} попадает в ${house}-й дом. Натальная карта отсчитывается от вашего асцендента, так что та же Луна может затронуть другую сферу вашей жизни.`,
  ticks: [
    'Ваши Солнце, Луна и асцендент и что означает каждый из них',
    'Небо каждого дня на фоне вашей карты',
    'Расчёт в браузере, без создания аккаунта',
  ],
  reassure: ['Дата, время и место рождения.', 'Около двадцати секунд.'],
  saved: 'Уже сохранили карту? ',
  savedLink: 'Сравните её с небом на сегодня',
  moreTitle: (name) => `Ещё о знаке ${name}`,
  moreLede: 'То же небо на более длинные периоды и знак, прочитанный от другой точки карты.',
  moreLonger: 'Завтра, неделя и месяц',
  moreLongerText: (name) => `Более длинные прогнозы для ${signGen(name)}, а также о любви, работе и 2027 годе.`,
  moreRising: (name) => `Асцендент ${inSign(name)}`,
  moreRisingNote: 'Профиль асцендента',
  moreRisingText: (name) => `${name} как восходящий знак: знак, который поднимался над горизонтом в момент вашего рождения.`,
  moreAll: 'Все знаки',
  moreAllText: 'Двенадцать гороскопов по небу на сегодня на одной странице.',
  guideKicker: 'Гид по знаку',
  guideTitle: (name) => `${name} подробно`,
  guideCopy: () => 'Характер, любовь, работа и деньги, совместимость и то, что этот знак значит в вашей натальной карте.',
  guideLink: (name) => `Полный гид по знаку ${name}`,
  signsTitle: 'Прочитать другой знак',
  signsLede: 'Заметки по небу на сегодня для всех двенадцати знаков, по тем же положениям.',
  allHoroscopes: 'Все гороскопы',
  signsAria: 'Другие знаки',
  readingNow: 'Вы читаете',
  faqTitle: (name) => `Ежедневный гороскоп для ${signGen(name)}: вопросы`,
  faqMore: 'Подробнее о методе: ',
  faq: (name) => [
    {
      q: `Что входит в ежедневный прогноз для ${signGen(name)}?`,
      a: `До четырёх заметок по небу дня: солнечные дома ${signGen(name)}, в которые попадают Луна и личные планеты, и любое точное событие этой даты. У каждой заметки есть своя запись расчёта.`,
    },
    {
      q: `Этот прогноз только для тех, у кого Солнце ${inSign(name)}?`,
      a: `Он читается от ${signGen(name)} как солнечного знака. Если вы знаете свой асцендент, прочитайте и его; полная натальная карта даёт самую личную картину.`,
    },
    {
      q: 'Как пользоваться этим прогнозом?',
      a: 'Возьмите то, что вам подходит, превратите это в вопрос или конкретное действие и оставьте решение за собой.',
    },
  ],
};

const today: TodayCopy = {
  title: (date) => `Небо на сегодня, ${date} | Zodiacs.org`,
  description: (date) => `Небо дня для двенадцати солнечных знаков: до четырёх заметок на знак, по реальным положениям планет на ${fullDate(date)}.`,
  crumbsAria: 'Навигационная цепочка',
  home: 'Главная',
  todayWord: 'сегодня',
  TodayWord: 'Сегодня',
  onDate: (date) => fullDate(date),
  h1: 'Небо сегодня',
  lede: 'Где находится каждая планета, что традиционно означает каждое положение и что ждёт дальше по календарю.',
  cta: 'Сравните со своей картой',
  yourSign: 'Ваш знак',
  reassure: 'Бесплатно · Без регистрации · Положения на 12:00 UTC',
  wheelAria: (date) => `Небо на ${fullDate(date)}, 12:00 UTC: Солнце, Луна и планеты в своих знаках и аспекты в пределах трёх градусов от точного`,
  legendRx: 'Ретроградно',
  legendEasy: 'Трин или секстиль',
  legendTense: 'Квадратура или оппозиция',
  legendJoined: 'Соединение',
  lightsKicker: 'С чего начинается день',
  lightsTitle: 'Солнце и Луна',
  lightsLede: 'Два светила, с которых начинается астрология: где они находятся и что традиционно означают их знаки.',
  moonLink: 'Подробнее о Луне этой ночи',
  sunTag: (degree) => `Солнце · ${degree}`,
  moonTag: (degree, percent) => `Луна · ${degree} · освещено ${percent}%`,
  sunIn: (sign) => `Солнце ${inSign(sign)}`,
  moonIn: (sign) => `Луна ${inSign(sign)}`,
  sunNote: (third, ingress) => `Солнце находится в ${['первой', 'средней', 'последней'][third] ?? 'средней'} трети знака${ingress ? ` и ${ingress.date} входит в знак ${signGen(ingress.sign)}` : ''}.`,
  moonNote: (age, _single, lastDegree) => `С новолуния прошло ${age} ${plural(age, 'день', 'дня', 'дней')}${lastDegree ? ', и Луна стоит в последнем градусе знака' : ''}.`,
  moonAge: (age) => `Возраст: ${age} ${plural(age, 'день', 'дня', 'дней')}`,
  cycleAria: 'Этот лунный цикл',
  signsKicker: 'Ваш знак',
  signsLede: 'Выберите свой солнечный знак. Каждая заметка опирается на записанные положения неба на сегодня, прочитанные по солнечным домам вашего знака; записи под каждым прогнозом показывают, откуда он взят. Это темы для наблюдения, а не указания.',
  allHoroscopes: 'Все гороскопы',
  signsAria: 'Знаки',
  horoscopeLink: (sign) => `${sign}: гороскоп на сегодня`,
  guideLink: (sign) => `Гид по знаку ${sign}`,
  personalTitle: 'Ваша карта и небо на сегодня',
  personalBody: 'По дате, времени и месту рождения натальная карта рассчитывается здесь, в вашем браузере. Приватное сравнение сохранённой карты с каждым выпуском пока доступно только в английской версии.',
  personalCompare: 'Открыть приватное сравнение',
  planetsTitle: 'Где сейчас планеты',
  planetsSub: (date) => `12:00 UTC, ${fullDate(date)}.`,
  planetsSubMore: ' Каждая планета и то, что она традиционно означает.',
  topics: {
    Sun: 'личность и направление',
    Moon: 'эмоциональные потребности и инстинкты',
    Mercury: 'мышление и общение',
    Venus: 'привязанность, удовольствие и ценности',
    Mars: 'напор и самоутверждение',
    Jupiter: 'рост и убеждения',
    Saturn: 'ответственность и долгое строительство',
    Uranus: 'независимость и перемены',
    Neptune: 'воображение и идеалы',
    Pluto: 'власть и глубокие преобразования',
  },
  direct: 'Директно',
  retrograde: 'Ретроградно',
  station: (type, clock) => `${type === 'retrograde' ? 'Ретроградно' : 'Директно'} с ${clock} UTC`,
  comingTitle: 'Что впереди на небе',
  comingSub: 'Время указано по UTC. По Москве прибавьте три часа, и иногда событие приходится уже на следующий день.',
  eclipseTitle: (type, kind, sign) => `${cap([kind, type, 'затмение'].filter(Boolean).join(' '))} ${inSign(sign)}`,
  eclipseShort: (type, kind) => [kind, type, 'затмение'].filter(Boolean).join(' '),
  eclipseType: { solar: 'солнечное', lunar: 'лунное' },
  eclipseKind: { total: 'полное', partial: 'частное', annular: 'кольцеобразное', penumbral: 'полутеневое', hybrid: 'гибридное' },
  ingressTitle: (subject, sign) => `${subject} входит в знак ${signGen(sign)}`,
  ingressDetail: (retrograde, from) => `${retrograde ? 'Ретроградно, из знака' : 'Из знака'} ${signGen(from)}`,
  lunationTitle: (type, sign) => `${type === 'new' ? 'Новолуние' : 'Полнолуние'} ${inSign(sign)}`,
  stationTitle: (planet, type) => `${planet} становится ${becomes(planet, type === 'retrograde')}`,
  aspectDetail: (a, b) => `${a} и ${b}`,
  nextEclipse: (name, date) => `Следующее затмение: ${name}, ${date}`,
  calendarLink: 'Полный календарь неба',
  dayEvent: (event) => {
    if (event.kind === 'station' && event.planet) {
      const planet = named('ru', event.planet);
      return `${planet} становится ${becomes(planet, event.type === 'retrograde')}`;
    }
    if (event.kind === 'aspect' && event.a && event.b && event.type) {
      return `${named('ru', event.a)} и ${named('ru', event.b)} образуют ${EXACT[event.type] ?? 'точный аспект'}`;
    }
    if (event.kind === 'ingress' && event.planet && event.sign) return `${named('ru', event.planet)} входит в знак ${signGen(event.sign)}`;
    if (event.kind === 'lunation' && event.sign) return `${event.type === 'new' ? 'новолуние' : 'полнолуние'} ${inSign(event.sign)} становится точным`;
    return null;
  },
  rxTitle: 'Ретроградные планеты: обзор',
  rxLink: 'Все даты ретроградности',
  rxNone: ['Ни одна планета не движется ретроградно ', TODAY, '.'],
  rxNow: (list, count) => [`${list} ${count === 1 ? 'движется' : 'движутся'} ретроградно `, TODAY, '.'],
  rxNext: (planet, date) => [`${planet} перейдёт в ретроградное движение ${date}.`],
  rxEnded: (planet, date) => (date
    ? [`Ретроградный период ${planetGen(planet)} завершился ${date}.`]
    : [`Ретроградный период ${planetGen(planet)} завершился `, TODAY, '.']),
  rxTableAria: (range) => `Ретроградные периоды: ${range}`,
  rxPlanet: 'Планета',
  rxPeriod: 'Период',
  rxNowPrefix: 'Ретроградно · ',
  rxNowDirect: ', затем снова директно',
  rxStateNow: 'Сейчас ретроградно',
  rxStateUpcoming: 'Впереди',
  rxStateEnded: 'Позади',
  rxMeansKicker: 'Что значит «ретроградный»',
  rxMeans: 'С Земли планета иногда как будто замедляется, останавливается и движется назад на фоне звёзд. Её настоящая орбита при этом не меняется. Астрологи давно читают такие периоды как время пересмотра: к темам планеты возвращаются, а не начинают новые.',
  aspectsTitle: 'Самые точные аспекты',
  aspectsLede: (all, shown) => {
    if (all > shown) return `Аспектами называют углы между планетами. В 12:00 UTC в пределах трёх градусов от точного ${all} ${aspectsWord(all)}; здесь показаны ${shown} самых точных.`;
    return `Аспектами называют углы между планетами. ${all === 1 ? 'Этот аспект в 12:00 UTC находится' : `Эти ${all} ${aspectsWord(all)} в 12:00 UTC находятся`} в пределах трёх градусов от точного.`;
  },
  definitions: {
    conjunction: 'Аспект в 0°: две части карты сходятся в одной точке.',
    sextile: 'Аспект в 60°, который читают как возможность для сотрудничества двух частей карты.',
    square: 'Аспект в 90°, который читают как трение, требующее действия или подстройки.',
    trine: 'Аспект в 120°, который читают как лёгкую связь между двумя частями карты.',
    opposition: 'Аспект в 180°, который ставит две точки карты друг напротив друга.',
  },
  represent: (a, topicA, b, topicB) => `По традиции ${a} означает ${topicA}, а ${b} отвечает за ${topicB}.`,
  exactAt: (clock) => `Точно в ${clock} UTC`,
  fromExact: (orb) => `${orb} до точного`,
  furtherTitle: 'Что ещё посмотреть',
  furtherLede: 'Другие способы следить за небом, дата за датой.',
  allTools: 'Все инструменты',
  tools: [
    { href: '/transits/', title: 'Транзиты', promise: 'Текущее небо рядом с вашей картой.' },
    { href: '/moon-phase/', title: 'Фаза Луны', promise: 'Луна этой ночи или на любую дату.' },
    { href: '/sky-calendar/', title: 'Календарь неба', promise: 'Новолуния и полнолуния в вашем календаре.' },
    { href: '/eclipses/', title: 'Затмения', promise: 'Солнечные и лунные затмения до 2030 года.' },
  ],
  askTitle: 'Есть вопросы о небе на сегодня?',
  askLead: 'Guide: ИИ-помощник, который отвечает на вопросы об астрологии и помогает пользоваться Zodiacs.',
  askLabel: 'Спросить Guide',
  prompts: [
    'Что значит небо на сегодня для моего знака?',
    'Что такое ретроградная планета?',
    'Как прочитать небо на сегодня в моей натальной карте?',
  ],
  methodTitle: 'Как устроена эта страница',
  methodBody: (date) => `Положения рассчитаны на 12:00 UTC в дату выпуска, ${fullDate(date)}. Время в календаре указано по UTC. Заметки по знакам описывают темы для размышления, а не советы.`,
  coverage: 'В этом выпуске только положения планет: точное время событий для этой даты недоступно.',
  provenanceLabel: 'Что стоит за этим ежедневным прогнозом',
  provenanceDescription: 'Данные неба, ограничения и редакционные решения',
  provenanceBefore: 'Каждая заметка привязана к небу, записанному на ',
  provenanceAfter: ', дату выпуска по UTC; положения планет взяты из снимка на 12:00 UTC. Русские заметки исходят из тех же фактов, что и английский выпуск, по шаблонам, написанным на русском, а автоматическая проверка следит, чтобы каждая из них указывала на тот же дом и то же небесное тело, что и английская версия.',
  methodLink: 'Как мы считаем',
  publicationLink: 'Как публикуется каждый выпуск',
  correctionsLink: 'Исправления',
};

const hub: HubCopy = {
  title: (date) => `Гороскопы на сегодня, ${date} | Zodiacs.org`,
  description: (date) => `Гороскопы на ${fullDate(date)}: ясная заметка для каждого из двенадцати знаков, рассчитанная по реальным положениям неба.`,
  imageAlt: 'Ежедневные гороскопы для двенадцати знаков, Zodiacs.org',
  h1: 'Гороскопы на сегодня',
  dateline: (date) => `Ежедневный выпуск · ${date}`,
  lede: 'Найдите свой знак и прочитайте самую конкретную заметку о небе на сегодня. Начните с солнечного знака, а затем, если знаете, прочитайте и асцендент.',
  stamp: (date) => `Обновляется каждый день · ${date}`,
  jumpLabel: 'Перейти к своему знаку',
  pickerAria: 'Выберите свой знак',
  read: 'Читать прогноз на сегодня →',
  notePersonal: 'Хотите более личный прогноз? ',
  noteChart: 'Постройте натальную карту бесплатно',
  noteSky: ' Полное небо, планета за планетой, на ',
  noteSkyLink: 'странице неба на сегодня',
  noteLonger: '. Прогнозы на завтра, неделю и месяц есть в ',
  noteEnglish: 'английской версии',
  askLead: 'Не знаете, с чего начать?',
  askLabel: 'Спросить Guide',
  prompts: [
    'Что читать: солнечный знак или асцендент?',
    'Что значит небо на сегодня для всех?',
    'Как рассчитываются эти гороскопы?',
  ],
  methodSummary: 'Что стоит за этими прогнозами',
  methodBefore: (date) => `Это выпуск по UTC на ${fullDate(date)}; положения взяты по небу на 12:00 UTC. Гороскопы по солнечному знаку дают общую картину. Подробнее: `,
  methodLink: 'как мы считаем',
};

export const ru: { horoscope: Copy; today: TodayCopy; hub: HubCopy } = { horoscope, today, hub };
