/**
 * Гороскопы по периодам на русском: завтра, неделя, месяц, любовь, работа и
 * год. Текст пишется по-русски из фактов (./types.ts), без перевода
 * английских или испанских фраз. Обращение на «вы», спокойный и конкретный
 * тон, без обещаний о судьбе, здоровье, деньгах или отношениях. Длинных тире
 * нет: только запятые, двоеточия, точки и скобки.
 *
 * Падежи не склеиваются из именительного: у знаков, планет, месяцев, дней
 * недели и тем домов есть свои таблицы форм. Глаголы стоят в настоящем или
 * будущем времени, где род не виден; где он виден («становится
 * ретроградным»), форма берётся по роду планеты.
 */
import { SIGNS, signBySlug, signName } from '../../signs';
import { planetLabel } from '../../i18n/astrology';
import { cap, dayMonth, dayMonthYear, pick, utcClock } from './format';
import type {
  EventFact,
  Fact,
  HoroscopeLocaleModule,
  LocalizedPassage,
  MonthlyContext,
  PeriodContext,
  PeriodSurface,
  PositionFact,
} from './types';

const L = 'ru' as const;
const SIGN_ORDER = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const idx = (slug: string) => SIGN_ORDER.indexOf(slug);

// ── Знаки: падежные формы ──

/** Именительный, родительный, дательный, предложный, творительный. */
interface SignForms { nom: string; gen: string; dat: string; prep: string; inst: string }

export const SIGN_FORMS: Record<string, SignForms> = {
  aries: { nom: 'Овен', gen: 'Овна', dat: 'Овну', prep: 'Овне', inst: 'Овном' },
  taurus: { nom: 'Телец', gen: 'Тельца', dat: 'Тельцу', prep: 'Тельце', inst: 'Тельцом' },
  gemini: { nom: 'Близнецы', gen: 'Близнецов', dat: 'Близнецам', prep: 'Близнецах', inst: 'Близнецами' },
  cancer: { nom: 'Рак', gen: 'Рака', dat: 'Раку', prep: 'Раке', inst: 'Раком' },
  leo: { nom: 'Лев', gen: 'Льва', dat: 'Льву', prep: 'Льве', inst: 'Львом' },
  virgo: { nom: 'Дева', gen: 'Девы', dat: 'Деве', prep: 'Деве', inst: 'Девой' },
  libra: { nom: 'Весы', gen: 'Весов', dat: 'Весам', prep: 'Весах', inst: 'Весами' },
  scorpio: { nom: 'Скорпион', gen: 'Скорпиона', dat: 'Скорпиону', prep: 'Скорпионе', inst: 'Скорпионом' },
  sagittarius: { nom: 'Стрелец', gen: 'Стрельца', dat: 'Стрельцу', prep: 'Стрельце', inst: 'Стрельцом' },
  capricorn: { nom: 'Козерог', gen: 'Козерога', dat: 'Козерогу', prep: 'Козероге', inst: 'Козерогом' },
  aquarius: { nom: 'Водолей', gen: 'Водолея', dat: 'Водолею', prep: 'Водолее', inst: 'Водолеем' },
  pisces: { nom: 'Рыбы', gen: 'Рыб', dat: 'Рыбам', prep: 'Рыбах', inst: 'Рыбами' },
};

const SLUG_BY_NAME = new Map(SIGNS.map((entry) => [signName(entry, L), entry.slug]));
/** Слаг знака по слагу или по русскому названию; undefined для незнакомого имени. */
export const signSlugOf = (key: string): string | undefined => (SIGN_FORMS[key] ? key : SLUG_BY_NAME.get(key));

const sign = (slug: string) => signName(signBySlug(slug), L);
/** «Льва», «Близнецов»; незнакомое имя ставится после слова «знака». */
export const signGen = (key: string) => {
  const slug = signSlugOf(key);
  return slug ? SIGN_FORMS[slug].gen : `знака ${key}`;
};
/** «в Скорпионе», «во Льве»; незнакомое имя ставится после «в знаке». */
export const inSign = (key: string) => {
  const slug = signSlugOf(key);
  if (!slug) return `в знаке ${key}`;
  return slug === 'leo' ? 'во Льве' : `в ${SIGN_FORMS[slug].prep}`;
};
/** «в знак Стрельца», после глаголов движения. */
const intoSign = (key: string) => `в знак ${signGen(key)}`;

// ── Планеты ──

const planet = (body: string) => planetLabel(L, body);
type Gender = 'm' | 'f' | 'n';
const GENDER: Record<string, Gender> = { Sun: 'n', Moon: 'f', Venus: 'f' };
const gender = (body: string): Gender => GENDER[body] ?? 'm';
const PLANET_GEN: Record<string, string> = {
  Sun: 'Солнца', Moon: 'Луны', Mercury: 'Меркурия', Venus: 'Венеры', Mars: 'Марса',
  Jupiter: 'Юпитера', Saturn: 'Сатурна', Uranus: 'Урана', Neptune: 'Нептуна', Pluto: 'Плутона',
};
const PLANET_INST: Record<string, string> = {
  Sun: 'Солнцем', Moon: 'Луной', Mercury: 'Меркурием', Venus: 'Венерой', Mars: 'Марсом',
  Jupiter: 'Юпитером', Saturn: 'Сатурном', Uranus: 'Ураном', Neptune: 'Нептуном', Pluto: 'Плутоном',
};
const planetGen = (body: string) => PLANET_GEN[body] ?? planet(body);
const planetInst = (body: string) => PLANET_INST[body] ?? planet(body);
/** «ретроградным», «ретроградной», в согласии с родом планеты. */
const becomes = (body: string, retrograde: boolean) => {
  const stem = retrograde ? 'ретроградн' : 'директн';
  return `${stem}${gender(body) === 'f' ? 'ой' : 'ым'}`;
};

/** Аспект в винительном падеже: «образует квадратуру с …». */
const ASPECT_ACC: Record<string, string> = {
  conjunction: 'соединение', sextile: 'секстиль', square: 'квадратуру', trine: 'трин', opposition: 'оппозицию',
};
const ASPECT_NOM: Record<string, string> = {
  conjunction: 'соединение', sextile: 'секстиль', square: 'квадратура', trine: 'трин', opposition: 'оппозиция',
};

// ── Даты ──

const MONTH_NOM = ['', 'январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTH_GEN = ['', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTH_PREP = ['', 'январе', 'феврале', 'марте', 'апреле', 'мае', 'июне', 'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'];

/** «9 ноября»: Intl уже даёт родительный падеж месяца. */
const date = (at: string) => dayMonth(L, at);
/** «9 ноября 2026 года», без сокращения «г.». */
const dateYear = (at: string) => dayMonthYear(L, at).replace(/ г\.$/u, ' года');
const dayNum = (at: string) => String(Number(at.slice(8, 10)));
/** «с 9 по 15 ноября», «с 30 ноября по 6 декабря». */
const range = (from: string, through: string) => (from.slice(0, 7) === through.slice(0, 7)
  ? `с ${dayNum(from)} по ${date(through)}`
  : `с ${date(from)} по ${date(through)}`);
/** «ноябрь 2026 года» */
const monthYear = (month: string) => `${MONTH_NOM[Number(month.slice(5, 7))]} ${month.slice(0, 4)} года`;
/** «к четвергу», «ко вторнику»: день недели в дательном падеже. */
const TOWARD_DAY = ['к воскресенью', 'к понедельнику', 'ко вторнику', 'к среде', 'к четвергу', 'к пятнице', 'к субботе'];
const towardDay = (at: string) => TOWARD_DAY[new Date(`${at.slice(0, 10)}T12:00:00Z`).getUTCDay()];

const tidy = (text: string) => text.replace(/\s+/g, ' ').trim();

// ── Дома: темы в нужных падежах ──

/** Порядковые числительные дома: именительный и предложный. */
const ORD_PREP = ['', 'первом', 'втором', 'третьем', 'четвёртом', 'пятом', 'шестом', 'седьмом', 'восьмом', 'девятом', 'десятом', 'одиннадцатом', 'двенадцатом'];
const inHouse = (house: number) => `в вашем ${ORD_PREP[house]} доме`;

/** Что каждый солнечный дом выносит на стол, в именительном падеже. */
export const THEME: Record<number, string> = {
  1: 'ваш образ и начинания',
  2: 'ценности, самооценка и чувство устойчивости',
  3: 'общение, повседневные дела и ближний круг',
  4: 'семья, домашние дела и личная жизнь',
  5: 'радость, романтика и творчество',
  6: 'повседневная работа, привычки и распорядок дня',
  7: 'партнёрство, брак и договоры',
  8: 'общие ресурсы, обязательства и глубокое доверие',
  9: 'поездки, учёба и убеждения',
  10: 'карьера, репутация и положение в обществе',
  11: 'друзья, сообщества и планы на будущее',
  12: 'отдых, уединение и скрытые дела',
};
/** Те же темы в родительном падеже: «для …», «в сфере …», «темы …». */
export const THEME_GEN: Record<number, string> = {
  1: 'вашего образа и начинаний',
  2: 'ценностей, самооценки и чувства устойчивости',
  3: 'общения, повседневных дел и ближнего круга',
  4: 'семьи, домашних дел и личной жизни',
  5: 'радости, романтики и творчества',
  6: 'повседневной работы, привычек и распорядка дня',
  7: 'партнёрства, брака и договоров',
  8: 'общих ресурсов, обязательств и глубокого доверия',
  9: 'поездок, учёбы и убеждений',
  10: 'карьеры, репутации и положения в обществе',
  11: 'друзей, сообществ и планов на будущее',
  12: 'отдыха, уединения и скрытых дел',
};

/** Тема с придаточным («того, что зреет незаметно») закрывается запятой, если фраза продолжается. */
const closed = (theme: string) => (/, (?:как|что) /u.test(theme) ? `${theme},` : theme);

/** Короткие заголовки для кварталов года. */
const SHORT: Record<number, string> = {
  1: 'образ и начинания',
  2: 'ценности и устойчивость',
  3: 'общение и ближний круг',
  4: 'семья и личная жизнь',
  5: 'радость и творчество',
  6: 'работа и распорядок',
  7: 'партнёрство и договоры',
  8: 'общие ресурсы и доверие',
  9: 'учёба и горизонты',
  10: 'карьера и репутация',
  11: 'друзья и планы',
  12: 'отдых и уединение',
};
/** Второй заголовок для того же дома, чтобы кварталы года не повторялись. */
const SHORT2: Record<number, string> = {
  1: 'то, как вы себя подаёте',
  2: 'то, что вам дорого',
  3: 'разговоры и текущие дела',
  4: 'дом и близкие',
  5: 'удовольствие и любовь',
  6: 'привычки и обязанности',
  7: 'отношения на равных',
  8: 'обязательства и близость',
  9: 'поездки и убеждения',
  10: 'цели и заметность',
  11: 'сообщества и будущее',
  12: 'тишина и восстановление',
};

/** Первый конкретный шаг по дому. */
const ADVICE: Record<number, string> = {
  1: 'Скажите, что хотите начать, прежде чем откликаться на чужие предложения.',
  2: 'Спросите себя, что для вас сейчас действительно важно, и берегите это.',
  3: 'Ответьте на сообщение, которое давно ждёт, и запишите, о чём договорились.',
  4: 'Посмотрите, что вам нужно дома, и найдите на это время, прежде чем соглашаться на что-то ещё.',
  5: 'Выделите время на занятие для удовольствия, не думая о результате.',
  6: 'Пересмотрите список дел на день и уберите задачу, которая не ваша.',
  7: 'Говорите с партнёром прямо и спрашивайте, а не додумывайте.',
  8: 'Разделите, что ваше, что общее и какие обязательства на вас лежат.',
  9: 'Почитайте, разузнайте или спланируйте поездку: что-то, что выведет мысли из привычной колеи.',
  10: 'Доведите до конца то, что увидят другие, и дайте понять, чья это работа.',
  11: 'Напишите другу или группе и назначьте дату встречи.',
  12: 'Оставьте себе час без экранов и позвольте дню замедлиться.',
};

/** Второй взгляд на тот же дом, чтобы совет не повторялся. */
const REFINE: Record<number, string> = {
  1: 'Небольшая перемена в том, как вы себя подаёте, скажет больше громкого заявления.',
  2: 'Прежде чем брать на себя обязательство, спросите себя, будет ли этот выбор иметь смысл через неделю.',
  3: 'Перечитайте то, что отправляете: одно неудачное слово может стоить целого вечера.',
  4: 'Почините дома одну конкретную вещь вместо того, чтобы планировать большой ремонт.',
  5: 'Пусть игра останется игрой: не всё должно становиться проектом.',
  6: 'Присмотритесь к привычке, которая стала автоматической, и решите, нужна ли она вам.',
  7: 'Справедливую договорённость видно по тому, что каждый знает свою часть.',
  8: 'Немного неловкий разговор о доверии и общих обязательствах избавит от многих подозрений.',
  9: 'Новая идея становится ценнее, когда вы проверяете её на практике.',
  10: 'Выберите одну заметную цель и отмечайте продвижение по фактам, а не по ощущениям.',
  11: 'Посмотрите, какие сообщества действительно вам что-то дают, а за какими вы следите по привычке.',
  12: 'Выспаться и закрыть отложенные дела тоже значит двигаться вперёд.',
};

/** Третий совет по дому, когда первые два уже есть на странице. */
const EXTRA: Record<number, string> = {
  1: 'Выберите одну вещь, которую хотите показать, а остальное пусть подождёт.',
  2: 'Заметьте, что даёт вам настоящую устойчивость, и опирайтесь на это.',
  3: 'Задайте вопрос напрямую, а не через третьих лиц.',
  4: 'Оставьте один вечер для себя и близких, без других планов.',
  5: 'Сделайте что-то просто ради удовольствия, никому этого не показывая.',
  6: 'Начните с самой короткой задачи: она расчистит путь для остальных.',
  7: 'Выслушайте ответ до конца, прежде чем предлагать свой.',
  8: 'Ясно скажите, чем готовы делиться, а что оставляете себе.',
  9: 'Запишите вопрос, который вам действительно интересен, и найдите первый ответ.',
  10: 'Сверьте, чего от вас ждут и что вы реально можете выполнить.',
  11: 'Предложите простой общий проект с конкретной датой.',
  12: 'Закройте одно отложенное дело, прежде чем открывать новое.',
};

/** Чувства: угол каждого дома. */
const LOVE: Record<number, string> = {
  1: 'Будьте собой, без игры на публику: сейчас трогает естественность.',
  2: 'Нежность видна в конкретном: внимание, помощь, подаренное время.',
  3: 'Простой разговор сейчас значит больше, чем широкий жест.',
  4: 'Спокойствие дома служит опорой: позаботьтесь о пространстве, которое вы делите.',
  5: 'Хочется радоваться жизни: предложите то, что развеселит вас обоих.',
  6: 'Любовь живёт и в быту: делите дела, не ведя счёт.',
  7: 'Пара просит отношений на равных: сначала выслушайте, потом отвечайте.',
  8: 'Доверие растёт, когда вы говорите о том, что для вас по-настоящему важно.',
  9: 'Впустите в отношения что-то новое: место, идею, непривычную тему.',
  10: 'Следите, чтобы работа не занимала всё место, которое принадлежит близкому человеку.',
  11: 'Дружба сейчас часть любви: помогают встречи в компании.',
  12: 'Некоторые вещи лучше сказать наедине и не торопясь.',
};

/** Работа: угол каждого дома. */
const WORK: Record<number, string> = {
  1: 'Возьмите инициативу в задаче, под которой стоит ваше имя.',
  2: 'Проясните, что для вас важно в работе и в чём вы не готовы уступать.',
  3: 'Письма, звонки и текущие дела требуют порядка и быстрых ответов.',
  4: 'Обустройте рабочее место так, чтобы оно не отнимало силы.',
  5: 'Творческий проект или собственное предложение заслуживают вашего лучшего часа.',
  6: 'Наведите порядок в методах и сроках: регулярность уводит дальше, чем рывок.',
  7: 'Ведите переговоры ясно: с партнёрами, клиентами и коллегами.',
  8: 'Посмотрите на общие ресурсы, обязательства и то, что зависит от других.',
  9: 'Обучение, публикация или выход к новой аудитории приносят плоды со временем.',
  10: 'Репутация складывается из законченной работы: сначала доведите до конца самое заметное.',
  11: 'Контакты и командная работа открывают двери.',
  12: 'Продвигайте то, что пока не видно, и не ждите аплодисментов слишком рано.',
};

/** Второй рабочий угол того же дома. */
const WORK2: Record<number, string> = {
  1: 'Ясно покажите, что вы вносите, не дожидаясь, пока это заметят.',
  2: 'Вспомните, что придаёт смысл вашей работе, и держитесь этого.',
  3: 'Ясное сообщение в нужный момент избавит от лишней встречи.',
  4: 'Защитите рабочее время от ненужных отвлечений.',
  5: 'Оставьте в текущем проекте место для собственной идеи.',
  6: 'Упростите метод, который каждый день отнимает у вас время.',
  7: 'Запишите, о чём договорились с коллегой или клиентом.',
  8: 'Уточните, кто от кого зависит, прежде чем обещать сроки.',
  9: 'Короткий курс или прицельное чтение могут прояснить следующий шаг.',
  10: 'Продвиньте дело, от которого больше всего зависит ваша репутация.',
  11: 'Разговор с кем-то из другой команды может сдвинуть дело с места.',
  12: 'Спокойно закончите то, что должно быть закончено: результаты скажут сами за себя.',
};

/** Первая строка списка, которой ещё нет на странице; ни один совет не звучит дважды. */
const fresh = (used: Set<string>, ...options: string[]) => {
  const line = options.find((option) => !used.has(option)) ?? options[0];
  used.add(line);
  return line;
};
/** Второй вариант первого шага, где он нужен, чтобы тот же совет не звучал дважды. */
const ADVICE_ALT: Record<number, string> = {
  4: 'Подумайте, чего вам не хватает дома, и выделите на это время до новых обязательств.',
};
const adviceFor = (used: Set<string>, h: number) => fresh(used, ...[ADVICE[h], ADVICE_ALT[h], REFINE[h], EXTRA[h]].filter((line): line is string => Boolean(line)));

/** Что лучше всего удаётся каждому знаку, одной фразой. */
const KEY: Record<string, string> = {
  aries: 'Овну лучше удаётся один ясный первый шаг, чем бег во все стороны.',
  taurus: 'Тельцу полезно идти в своём темпе и не уступать то, что действительно даёт ему опору.',
  gemini: 'Близнецам ясность приносит один выбранный разговор, доведённый до конца.',
  cancer: 'Для Рака забота о других не означает, что всё нужно нести на себе: ваши собственные потребности тоже важны.',
  leo: 'Льву легче проявить себя, когда суть дела готова раньше эффектной подачи.',
  virgo: 'Деве не нужно исправлять всё сразу: достаточно одной вещи, сделанной хорошо.',
  libra: 'Весам равновесие даётся легче, когда вы говорите, чего хотите сами, а не угадываете желания других.',
  scorpio: 'Сила Скорпиона в том, чтобы спокойно решить, что оставить, а что отпустить.',
  sagittarius: 'Стрельцу одно ясное направление даёт больше, чем десять открытых путей.',
  capricorn: 'Для Козерога прогресс измеряется шагами, которые можно выдерживать долго.',
  aquarius: 'Для Водолея идея обретает ценность, когда находит конкретное применение.',
  pisces: 'Для Рыб ясные границы не гасят чувствительность, а берегут её.',
};

/** Главная нить года для каждого знака. */
const YEAR: Record<string, string> = {
  aries: 'Этот год поддерживает тот порыв, которого хватает надолго: начинать вам легко, важнее довести дело до конца.',
  taurus: 'Этот год просит пересмотреть, что на самом деле даёт вам чувство надёжности, и отпустить то, что держится лишь на привычке.',
  gemini: 'В этом году всё вращается вокруг выбора: меньше открытых фронтов, больше разговоров, которые к чему-то приводят.',
  cancer: 'Этот год о том, как заботиться, не выгорая, и как сделать дом убежищем, а не обязанностью.',
  leo: 'Этот год учит отличать желание быть на виду от желания быть по-настоящему узнанным и ценить то, что имело бы смысл и без зрителей.',
  virgo: 'Этот год просит порядка без перфекционизма: улучшать важное и отпускать остальное.',
  libra: 'Этот год проверяет ваши договорённости: какие из них справедливы, а какие держатся лишь на нежелании спорить.',
  scorpio: 'Этот год о доверии: кому вы его отдаёте, чем делитесь и что решаете оставить при себе.',
  sagittarius: 'Этот год предлагает превратить любопытство в план с датами.',
  capricorn: 'Этот год подтверждает то, что вы построили, и показывает, какая конструкция вам больше не нужна.',
  aquarius: 'Этот год сводит ваши идеи с нужными людьми: замыслы растут в компании.',
  pisces: 'Этот год помогает придать форму тому, что вы чувствуете интуитивно, и выстроить границы, которые вас берегут.',
};

const KIND_LOVE: Record<string, string> = {
  aries: 'В любви Овну нужны прямота и простор для движения.',
  taurus: 'В любви Телец больше доверяет постоянству, чем обещаниям.',
  gemini: 'В любви Близнецам поровну нужны разговор и сюрприз.',
  cancer: 'В любви Рак раскрывается, когда чувствует себя в безопасности.',
  leo: 'В любви Лев расцветает, когда восхищение взаимно.',
  virgo: 'В любви Дева показывает чувства маленькими точными делами.',
  libra: 'В любви Весы ищут взаимности, а не только гармонии.',
  scorpio: 'В любви Скорпиону правда нужнее накала.',
  sagittarius: 'В любви Стрелец хочет идти вдвоём, не теряя свободы.',
  capricorn: 'В любви Козерог верит тому, что подтверждается временем.',
  aquarius: 'В любви Водолею нужна дружба внутри пары.',
  pisces: 'В любви Рыбы отдают много, и им важно получать в ответ.',
};

const KIND_WORK: Record<string, string> = {
  aries: 'В работе Овен лучше всего проявляет себя, когда может прокладывать путь.',
  taurus: 'В работе Тельцу комфортно с реальными сроками и понятными ресурсами.',
  gemini: 'В работе Близнецы сильны, когда могут объяснять и связывать людей и идеи.',
  cancer: 'В работе Рак полностью включается, когда команда чувствует поддержку.',
  leo: 'В работе заметность помогает Льву, когда за ней стоит прочная основа.',
  virgo: 'В работе Дева особенно полезна, когда может улучшить конкретный порядок действий.',
  libra: 'В работе Весы сильнее всего там, где нужно договориться и уравновесить интересы.',
  scorpio: 'В работе Скорпион силён, когда может разобраться в вопросе до конца.',
  sagittarius: 'В работе Стрелец продвигается хорошо, когда видит, куда идёт проект.',
  capricorn: 'В работе Козерог опирается на измеримые цели.',
  aquarius: 'В работе Водолей приносит больше всего пользы, когда предлагает другой способ действовать.',
  pisces: 'В работе Рыбы вовлекаются, когда у задачи есть ясный смысл.',
};

/** Аспект связывает два разных дома. */
const ASPECT_MEANING: Record<string, string> = {
  conjunction: 'Две сферы сходятся: то, что вы делаете в одной, отражается в другой.',
  sextile: 'Это неброская возможность: воспользуйтесь ею, сделав небольшой конкретный шаг.',
  square: 'Две сферы задевают друг друга: подстройте одну, прежде чем давить на другую.',
  trine: 'Между ними всё идёт легко: хорошее время, чтобы двигаться без нажима.',
  opposition: 'Две сферы тянут в разные стороны: ищите золотую середину.',
};

/** Обе планеты в одном доме. */
const ASPECT_SAME: Record<string, string> = {
  conjunction: 'Обе силы действуют вместе, в одной и той же сфере.',
  sextile: 'Неброская возможность: воспользуйтесь ею с помощью небольшого шага.',
  square: 'Трение, которое требует подстройки, а не напора.',
  trine: 'Всё идёт легко: двигайтесь без нажима.',
  opposition: 'Два противоположных стремления: ищите середину.',
};

/** Четыре способа сказать о повороте затмения, у каждого свой конец. */
const ECLIPSE_LINES: Array<(gen: string) => string> = [
  (gen) => `Поворотный момент для ${gen}: в этот день лучше ничего не решать окончательно.`,
  (gen) => `В этот день наступает поворот в сфере ${gen}: дайте решениям созреть несколько дней.`,
  (gen) => `Для ${closed(gen)} закрывается или открывается этап: сначала понаблюдайте, потом действуйте.`,
  (gen) => `Что-то меняется в сфере ${gen}, и решать сразу не нужно.`,
  (gen) => `В сфере ${closed(gen)} обозначается перемена: не торопите выводы.`,
  (gen) => `Для ${closed(gen)} это заметная веха: отметьте её и вернитесь к ней через неделю.`,
  (gen) => `Затмение подсвечивает темы ${gen}: смотрите, что уходит, а что остаётся.`,
  (gen) => `Для ${closed(gen)} начинается новый отрезок: дайте ему немного времени.`,
];
const ECLIPSE_TAILS = ['ничего не решать окончательно', 'дайте решениям созреть', 'сначала понаблюдайте', 'решать сразу не нужно', 'не торопите выводы', 'вернитесь к ней через неделю', 'что уходит, а что остаётся', 'дайте ему немного времени'];

const SLOW_YEARS = new Set(['Saturn', 'Uranus', 'Neptune', 'Pluto']);

/** «Луна будет в Стрельце, в вашем пятом доме» (завтра) или «Луна находится …». */
function positionSentence(fact: PositionFact, tomorrow: boolean): string {
  const where = `${inSign(fact.sign)}, ${inHouse(fact.house)}`;
  if (tomorrow) {
    return fact.retrograde
      ? `Завтра ${planet(fact.body)} будет ${where}, и продолжит ретроградное движение.`
      : `Завтра ${planet(fact.body)} будет ${where}.`;
  }
  return fact.retrograde
    ? `${planet(fact.body)} находится ${where}, и движется ретроградно.`
    : `${planet(fact.body)} находится ${where}.`;
}

/** Событие одной фразой, без даты. */
function eventClause(fact: EventFact): string {
  const where = fact.sign ?? '';
  switch (fact.eventKind) {
    case 'ingress':
      return `${planet(fact.body!)} входит ${intoSign(where)}`;
    case 'station':
      return `${planet(fact.body!)} становится ${becomes(fact.body!, fact.eventType === 'retrograde')} ${inSign(where)}`;
    case 'lunation':
      return fact.eventType === 'full' ? `наступает полнолуние ${inSign(where)}` : `наступает новолуние ${inSign(where)}`;
    case 'eclipse':
      return fact.eventType === 'solar' ? `происходит солнечное затмение ${inSign(where)}` : `происходит лунное затмение ${inSign(where)}`;
    case 'aspect': {
      const type = fact.eventType ?? 'conjunction';
      return `${planet(fact.a!)} образует ${ASPECT_ACC[type] ?? type} с ${planetInst(fact.b!)}`;
    }
  }
}

/** То же событие коротким заголовком, для списка неба и дат года. */
function eventTitle(fact: EventFact): string {
  const where = fact.sign ?? '';
  switch (fact.eventKind) {
    case 'ingress': return `${planet(fact.body!)} входит ${intoSign(where)}`;
    case 'station': return `${planet(fact.body!)} становится ${becomes(fact.body!, fact.eventType === 'retrograde')} ${inSign(where)}`;
    case 'lunation': return `${fact.eventType === 'full' ? 'Полнолуние' : 'Новолуние'} ${inSign(where)}`;
    case 'eclipse': return `${fact.eventType === 'solar' ? 'Солнечное' : 'Лунное'} затмение ${inSign(where)}`;
    case 'aspect': return `${cap(ASPECT_NOM[fact.eventType ?? 'conjunction'] ?? '')} ${planetGen(fact.a!)} и ${planetGen(fact.b!)}`;
  }
}

/** Варианты смысла события в доме, где оно происходит; страница берёт первый, которого на ней ещё нет. */
function meaningVariants(fact: EventFact): string[] {
  const h = fact.houses[0];
  if (!h) return [];
  const nom = THEME[h];
  const gen = THEME_GEN[h];
  switch (fact.eventKind) {
    case 'ingress':
      if (fact.body === 'Jupiter') {
        return [
          `Примерно на год в центре внимания окажутся ${nom}.`,
          `Начинается год, важный для ${gen}.`,
          `Около года рост и новые возможности будут связаны с темами ${gen}.`,
          `На ближайший год темы ${closed(gen)} получают больше простора.`,
        ];
      }
      if (fact.body && SLOW_YEARS.has(fact.body)) {
        return [
          `Начинается долгий период для ${gen}.`,
          `Несколько лет внимание будет часто возвращаться к темам ${gen}.`,
          `Открывается длинная глава для ${gen}.`,
          `На годы вперёд темы ${closed(gen)} будут постепенно меняться.`,
          `Это медленный переход, и темы ${closed(gen)} будут перестраиваться не сразу.`,
        ];
      }
      // Солнце и быстрые планеты задерживаются в знаке на недели, а не на годы.
      return [
        `В ближайшие недели в центре внимания окажутся ${nom}.`,
        `На несколько недель фокус смещается в сферу ${gen}.`,
        `Несколько недель ваши дни больше связаны с темами ${gen}.`,
        `До следующей смены знака темы ${closed(gen)} просят больше времени.`,
        `Ближайший месяц удобно посвятить темам ${gen}.`,
      ];
    case 'station':
      return fact.eventType === 'retrograde'
        ? [
          `Время пересмотреть темы ${gen}, прежде чем браться за новое.`,
          `Не спеша вернитесь ко всему, что касается ${gen}.`,
          `Перепроверьте всё, что связано с темами ${gen}, и исправьте то, что нужно.`,
          `В сфере ${closed(gen)} полезно доделать начатое, а не открывать новое.`,
          `Темы ${closed(gen)} просят второго взгляда и неспешных поправок.`,
          `Пока планета движется назад, вернитесь к старым вопросам в сфере ${gen}.`,
        ]
        : [
          `То, что стояло на месте в сфере ${gen}, снова приходит в движение.`,
          `К темам ${closed(gen)} возвращается импульс.`,
          `К отложенным решениям в сфере ${closed(gen)} можно вернуться.`,
          `В сфере ${closed(gen)} снова можно двигаться вперёд.`,
          `Темы ${closed(gen)} понемногу набирают ход.`,
          `Задержки в сфере ${closed(gen)} постепенно уходят.`,
        ];
    case 'lunation':
      return fact.eventType === 'full'
        ? [
          `То, что зрело в сфере ${gen}, приходит к итогу.`,
          `В темах ${closed(gen)} намечается итог.`,
          `Для ${closed(gen)} это момент ясности: видно, что получилось.`,
          `В сфере ${closed(gen)} что-то подходит к завершению.`,
        ]
        : [
          `Хорошее время начать что-то новое в сфере ${gen}.`,
          `Начинается новый цикл для ${gen}.`,
          `Для ${closed(gen)} это удобный момент поставить небольшую цель.`,
          `В сфере ${closed(gen)} можно сделать первый шаг.`,
        ];
    case 'eclipse': {
      // Варианты затмения расставлены от дня события, чтобы соседние затмения не начинали с одного.
      const day = Number(fact.at.slice(8, 10)) + Number(fact.at.slice(5, 7));
      return ECLIPSE_LINES.map((_, k) => ECLIPSE_LINES[(day + k) % ECLIPSE_LINES.length](gen));
    }
    case 'aspect': {
      const [h1, h2] = fact.houses;
      const type = fact.eventType ?? 'conjunction';
      return h2 && h2 !== h1
        ? [
          `С одной стороны, это ${THEME[h1]}. С другой стороны, ${THEME[h2]}.`,
          `Аспект связывает две сферы. Первая: ${THEME[h1]}. Вторая: ${THEME[h2]}.`,
          `Здесь затронуты темы ${THEME_GEN[h1]}. Им отвечают темы ${THEME_GEN[h2]}.`,
        ]
        : [
          `Всё происходит в сфере ${THEME_GEN[h1]}.`,
          `Аспект целиком приходится на сферу ${THEME_GEN[h1]}.`,
        ];
    }
  }
}

/** Что аспект значит сам по себе, после фразы о сферах. */
function aspectTail(fact: EventFact): string {
  if (fact.eventKind !== 'aspect') return '';
  const [h1, h2] = fact.houses;
  const type = fact.eventType ?? 'conjunction';
  return ` ${(h2 && h2 !== h1 ? ASPECT_MEANING : ASPECT_SAME)[type] ?? ''}`.trimEnd();
}

/** Вариант по умолчанию; сдвиг зависит от дня, чтобы соседние события звучали по-разному. */
function eventMeaning(fact: EventFact, shift = 0): string {
  const variants = meaningVariants(fact);
  if (!variants.length) return '';
  return `${pick(variants, Number(fact.at.slice(8, 10)) + Number(fact.at.slice(5, 7)) + shift)}${aspectTail(fact)}`;
}

const sentencesOf = (line: string) => line.split(/(?<=\.)\s+/u).filter((sentence) => sentence.length > 25);

/** Смысл события в варианте, которого ещё нет на странице; у каждого события он есть всегда. */
function freshMeaning(fact: EventFact, used: Set<string> | undefined, shift = 0): string {
  if (!used) return eventMeaning(fact, shift);
  const variants = meaningVariants(fact);
  if (!variants.length) return '';
  const start = Number(fact.at.slice(8, 10)) + Number(fact.at.slice(5, 7)) + shift;
  // У затмения не должна повторяться и концовка фразы.
  const keyOf = (line: string) => (fact.eventKind === 'eclipse' ? `eclipse:${ECLIPSE_TAILS.find((tail) => line.includes(tail))}` : line);
  for (let k = 0; k < variants.length; k += 1) {
    const line = pick(variants, start + k);
    // Ни одна фраза варианта не должна уже стоять на странице.
    if (!used.has(keyOf(line)) && !sentencesOf(line).some((sentence) => used.has(`s:${sentence}`))) {
      used.add(keyOf(line));
      for (const sentence of sentencesOf(line)) used.add(`s:${sentence}`);
      return `${line}${aspectTail(fact)}`;
    }
  }
  // Все варианты уже прозвучали: смысл не пропадает, а связывается с уже сказанным.
  const fallback = `Эта дата продолжает то, что уже сказано выше о темах ${closed(THEME_GEN[fact.houses[0]])}.`;
  used.add(fallback);
  return `${fallback}${aspectTail(fact)}`;
}

const timed = (fact: EventFact) => fact.eventKind === 'lunation' || fact.eventKind === 'eclipse' || fact.eventKind === 'aspect';
/** «9 ноября в 07:02 UTC» или «22 ноября». */
const when = (fact: EventFact) => (timed(fact) ? `${date(fact.at)} в ${utcClock(fact.at)}` : date(fact.at));

function factSentence(fact: Fact, tomorrowPosition: boolean, used?: Set<string>): string {
  if (fact.kind === 'position') {
    // Положение, уже названное на странице, не повторяется.
    const key = `position:${fact.body}:${fact.at}`;
    if (used?.has(key)) return '';
    used?.add(key);
    return positionSentence(fact, tomorrowPosition);
  }
  return `${when(fact)} ${eventClause(fact)}. ${freshMeaning(fact, used)}`.trim();
}

const houseOf = (fact: Fact) => (fact.kind === 'position' ? fact.house : fact.houses[0]);
const firstHouse = (facts: Fact[]) => facts.find((fact) => fact.kind === 'position')?.house
  ?? (facts.find((fact) => fact.kind === 'event') as EventFact | undefined)?.houses[0] ?? 1;

// ── Периоды ──

const CLOSE_TOMORROW = [
  'Подготовьте первый шаг с вечера, и день начнётся легче.',
  'Запишите вечером то, что не хотите забыть завтра.',
  'Если что-то может подождать до послезавтра, пусть подождёт.',
  'Начните с того, что зависит только от вас.',
  'Оставьте в расписании запас на непредвиденное.',
];

function tomorrow(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  const used = new Set<string>();
  return ctx.passages.map(({ facts, index }) => {
    const h = firstHouse(facts);
    const advice = adviceFor(used, h);
    const sentences = facts.map((fact) => factSentence(fact, true, used)).filter(Boolean);
    if (!sentences.length) {
      // Все факты абзаца уже названы: связываем сферы, а не повторяем их.
      const houses = [...new Set(facts.map(houseOf).filter(Boolean))];
      sentences.push(houses.length > 1
        ? `К концу дня полезно соединить две сферы. С одной стороны, это ${THEME[houses[0]]}. С другой стороны, ${THEME[houses[1]]}.`
        : `В центре дня по-прежнему остаются ${THEME[h]}.`);
    }
    if (index === 0) {
      return { text: `${sentences.join(' ')} На первый план выходят ${THEME[h]}. ${advice} ${KEY[s]}` };
    }
    if (index === ctx.passages.length - 1) {
      return { text: `${sentences.join(' ')} ${advice} ${pick(CLOSE_TOMORROW, idx(s))}` };
    }
    return { text: `${sentences.join(' ')} ${advice}` };
  });
}

const CLOSE_WEEK = [
  'Подводя итоги в воскресенье, отметьте одну вещь, которая сработала, и одну, которую вы бы изменили.',
  'Прежде чем начнётся следующая неделя, решите, что не будете повторять.',
  'Завершите неделю чем-то законченным, пусть даже небольшим.',
  'Оставьте воскресный вечер на то, чтобы навести порядок, а не догонять всё упущенное.',
];

function weekly(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  const used = new Set<string>();
  const last = ctx.passages.length - 1;
  return ctx.passages.map(({ facts, index }) => {
    const moons = facts.filter((fact): fact is PositionFact => fact.kind === 'position');
    if (index === 0 && moons.length >= 2) {
      const [start, ...rest] = moons;
      const end = rest.at(-1)!;
      const mid = rest.length > 1 ? rest[0] : undefined;
      const midText = mid ? ` Ближе ${towardDay(mid.at)} Луна переходит ${intoSign(mid.sign)} и выводит на первый план темы ${THEME_GEN[mid.house]}.` : '';
      return {
        text: `Неделя ${range(ctx.from, ctx.through)} начинается с Луны ${inSign(start.sign)}, и в центре внимания оказываются ${THEME[start.house]}.${midText} К концу недели Луна приходит в сферу ${THEME_GEN[end.house]}. ${KEY[s]}`,
      };
    }
    const h = firstHouse(facts);
    const event = facts.find((fact): fact is EventFact => fact.kind === 'event');
    if (event) return { text: factSentence(event, false, used) };
    const advice = adviceFor(used, h);
    if (index === 1) return { text: `В первые дни недели на первый план выходят ${THEME[h]}. ${advice}` };
    if (index === last) return { text: `Неделя завершается в сфере ${THEME_GEN[h]}. ${advice} ${pick(CLOSE_WEEK, idx(s))}` };
    return { text: `В середине недели внимание переходит к темам ${THEME_GEN[h]}. ${advice}` };
  });
}

const LOVE_CLOSE = [
  'Искренний вопрос проясняет больше, чем догадка.',
  'Посмотрите, становится ли после ответа другого человека легче в общем пространстве.',
  'Не нужно решать всё сразу: достаточно ничего не скрывать.',
  'Скажите, что вам нужно, одной простой фразой.',
  'Выполненное обещание ценнее нового.',
];

function love(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  const used = new Set<string>();
  return ctx.passages.map(({ facts, index }) => {
    const h = firstHouse(facts);
    const sentences = facts.map((fact) => factSentence(fact, false, used)).join(' ');
    if (index === 0) return { text: `${sentences} ${fresh(used, LOVE[h])} ${KIND_LOVE[s]}` };
    return { text: `${sentences} Чувства сейчас тянутся к темам ${THEME_GEN[h]}. ${fresh(used, pick(LOVE_CLOSE, idx(s)), LOVE[h])}` };
  });
}

const WORK_CLOSE = [
  'Одна законченная задача лучше трёх начатых.',
  'Отметьте, на чём остановились, прежде чем переключаться.',
  'Уточните, чего от вас ждут, вместо того чтобы гадать.',
];

function career(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  const used = new Set<string>();
  return ctx.passages.map(({ facts, index }) => {
    const h = firstHouse(facts);
    const sentences = facts.map((fact) => factSentence(fact, false, used)).join(' ');
    if (index === 0) return { text: `${sentences} ${fresh(used, WORK[h], WORK2[h])} ${KIND_WORK[s]}` };
    return { text: `${sentences} Ещё одна сфера, которая требует внимания: ${THEME[h]}. ${fresh(used, WORK2[h], WORK[h])} ${pick(WORK_CLOSE, idx(s))}` };
  });
}

// ── Год ──

const QUARTERS: Array<[number, number]> = [[1, 3], [4, 6], [7, 9], [10, 12]];

/** Дома абзаца, от самого частого к самому редкому. */
function rankedHouses(facts: Fact[]): number[] {
  const counts = new Map<number, number>();
  for (const fact of facts) {
    const houses = fact.kind === 'position' ? [fact.house] : fact.houses;
    for (const house of houses) counts.set(house, (counts.get(house) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0]).map(([house]) => house);
}

function datedList(facts: Fact[], used: Set<string>, shift = 0): string {
  return facts
    .filter((fact): fact is EventFact => fact.kind === 'event')
    .map((fact) => `${date(fact.at)} ${eventClause(fact)}. ${freshMeaning(fact, used, shift)}`)
    .join(' ');
}

const THEMED_HEADINGS = [
  'Любовь, дружба и ясные договорённости',
  'Работа, обязательства и репутация',
  'Дом, отдых и личное пространство',
  'Ваш собственный курс',
];

const THEMED_LEADS = [
  'В отношениях важно то, что видно: просьба, пересмотренная договорённость, время, которое вы бережёте для двоих.',
  'В делах и обязательствах трезво оценивайте силы, сроки и реальный объём работы, а не только желание.',
  'Дома и в свободное время берегите главное: сон, пространство и время без обязательств.',
  'В личном плане рост имеет смысл, только если он меняет конкретное решение.',
];

function yearly(ctx: PeriodContext, year: string): LocalizedPassage[] {
  const s = ctx.sign;
  const headings = new Set<string>();
  const headed = new Set<number>();
  const used = new Set<string>();
  return ctx.passages.map(({ facts, index }) => {
    const events = facts.filter((fact): fact is EventFact => fact.kind === 'event');
    if (index === 0) {
      const first = events[0];
      const firstText = first
        ? ` Первая заметная дата года: ${date(first.at)}, когда ${eventClause(first)}. ${freshMeaning(first, used)}`
        : '';
      return { heading: `${year} год для ${signGen(s)}`, text: `${YEAR[s]}${firstText}` };
    }
    if (index >= 1 && index <= 4) {
      const [from, to] = QUARTERS[index - 1];
      // Заголовки кварталов не повторяются: берём следующий по частоте дом, а если все уже были, второй заголовок того же дома.
      const ranked = rankedHouses(facts);
      const h = ranked.find((house) => !headed.has(house)) ?? ranked[0] ?? 1;
      headed.add(h);
      const short = [SHORT[h], SHORT2[h]].find((label) => !headings.has(label)) ?? SHORT2[h];
      headings.add(short);
      const lead = pick([
        `В этом квартале всё вращается вокруг тем ${THEME_GEN[h]}.`,
        `В эти месяцы в центре внимания окажутся ${THEME[h]}.`,
        `Этот квартал делает акцент на темах ${THEME_GEN[h]}.`,
      ], index, idx(s));
      return {
        heading: `С ${MONTH_GEN[from]} по ${MONTH_NOM[to]}: ${short}`,
        text: `${lead} ${datedList(facts, used)} ${fresh(used, REFINE[h], EXTRA[h], ADVICE[h])}`.trim(),
      };
    }
    if (index >= 5 && index <= 8) {
      const k = index - 5;
      const extra = k === 0 ? KIND_LOVE[s] : k === 1 ? KIND_WORK[s] : k === 3 ? KEY[s] : '';
      return { heading: THEMED_HEADINGS[k], text: `${THEMED_LEADS[k]} ${extra} ${datedList(facts, used, 1)}` };
    }
    // В скобках с маленькой буквы, кроме названий планет: «(новолуние в Скорпионе)», «(Марс входит в знак Девы)».
    const inline = (fact: EventFact) => {
      const title = eventTitle(fact);
      return fact.eventKind === 'ingress' || fact.eventKind === 'station' ? title : title.charAt(0).toLowerCase() + title.slice(1);
    };
    const dates = events.map((fact) => `${date(fact.at)} (${inline(fact)})`);
    const joined = dates.length > 1 ? `${dates.slice(0, -1).join(', ')} и ${dates.at(-1)}` : dates.join('');
    return {
      heading: 'Три даты, чтобы свериться с годом',
      text: `Отметьте три даты, чтобы посмотреть, как идёт год: ${joined}. В каждую из них запишите, что изменилось и что вы хотите сохранить.`,
    };
  });
}

function periodRaw(ctx: PeriodContext): LocalizedPassage[] {
  switch (ctx.surface) {
    case 'tomorrow': return tomorrow(ctx);
    case 'weekly': return weekly(ctx);
    case 'love': return love(ctx);
    case 'career': return career(ctx);
    case 'yearly-2026': return yearly(ctx, '2026');
    case 'yearly-2027': return yearly(ctx, '2027');
  }
}

function period(ctx: PeriodContext): LocalizedPassage[] {
  return periodRaw(ctx).map((passage) => ({ ...passage, text: tidy(passage.text) }));
}

// ── Месяц ──

const CLOSE_MONTH = [
  'В конце месяца отметьте одну вещь, которая сработала, и одну, которую вы бы изменили.',
  'Перед следующим месяцем решите, что не хотите повторять.',
  'Завершите месяц чем-то законченным, пусть даже небольшим.',
];

function monthlyRaw(ctx: MonthlyContext): LocalizedPassage[] {
  const s = ctx.sign;
  const lunations = ctx.events.filter((fact) => fact.eventKind === 'lunation' || fact.eventKind === 'eclipse');
  const stations = ctx.events.filter((fact) => fact.eventKind === 'station');
  const ingresses = ctx.events.filter((fact) => fact.eventKind === 'ingress');
  const aspects = ctx.events.filter((fact) => fact.eventKind === 'aspect').slice(0, 4);
  const lead = lunations[0];
  const used = new Set<string>();
  const passages: LocalizedPassage[] = [{
    text: `${cap(monthYear(ctx.month))} для ${signGen(s)}. Как и в любом месячном гороскопе, ваш солнечный знак здесь считается первым домом. ${lead ? `В ${MONTH_PREP[Number(ctx.month.slice(5, 7))]} на первый план выходят ${THEME[lead.houses[0]]}.` : ''} ${KEY[s]}`,
  }];
  if (lunations.length) passages.push({ heading: 'Новолуние и полнолуние', text: lunations.map((fact) => factSentence(fact, false, used)).join(' ') });
  if (stations.length) passages.push({ heading: 'Планеты меняют направление', text: stations.map((fact) => factSentence(fact, false, used)).join(' ') });
  if (ingresses.length) passages.push({ heading: 'Переходы в новые знаки', text: ingresses.map((fact) => factSentence(fact, false, used)).join(' ') });
  if (aspects.length) passages.push({ heading: 'Точные аспекты', text: aspects.map((fact) => factSentence(fact, false, used)).join(' ') });
  const close = lead ? ADVICE[lead.houses[0]] : REFINE[1];
  passages.push({ heading: 'В завершение месяца', text: `${close} ${pick(CLOSE_MONTH, idx(s))}` });
  return passages;
}

function monthly(ctx: MonthlyContext): LocalizedPassage[] {
  return monthlyRaw(ctx).map((passage) => ({ ...passage, text: tidy(passage.text) }));
}

// ── Страница ──

type ChromeCtx = { surface: PeriodSurface | 'monthly'; from: string; through: string; month?: string };

/** «Гороскоп для Льва на завтра, 10 ноября»: начало описания. */
function headline(name: string, ctx: ChromeCtx): string {
  const forSign = `для ${signGen(name)}`;
  switch (ctx.surface) {
    case 'tomorrow': return `Гороскоп ${forSign} на завтра, ${date(ctx.from)}`;
    case 'weekly': return `Гороскоп ${forSign} на неделю ${range(ctx.from, ctx.through)}`;
    case 'monthly': return `Гороскоп ${forSign} на ${monthYear(ctx.month!)}`;
    case 'love': return `Любовный гороскоп ${forSign} на ${date(ctx.from)}`;
    case 'career': return `Деловой гороскоп ${forSign} на ${date(ctx.from)}`;
    case 'yearly-2026': return `Гороскоп ${forSign} на 2026 год`;
    case 'yearly-2027': return `Гороскоп ${forSign} на 2027 год`;
  }
}

/** Строка небесного списка для события. */
const skyEventRow = (fact: EventFact) => `${eventTitle(fact)} · ${dateYear(fact.at)}, ${utcClock(fact.at)}`;

export const ru: HoroscopeLocaleModule = {
  locale: L,
  period,
  monthly,
  chrome: {
    title: (name, ctx) => {
      switch (ctx.surface) {
        case 'tomorrow': return `${name}: гороскоп на завтра, ${date(ctx.from)}`;
        case 'weekly': return `${name}: гороскоп на неделю ${range(ctx.from, ctx.through)}`;
        case 'monthly': return `${name}: гороскоп на ${monthYear(ctx.month!)}`;
        case 'love': return `${name}: любовный гороскоп на сегодня`;
        case 'career': return `${name}: деловой гороскоп на сегодня`;
        case 'yearly-2026': return `${name}: гороскоп на 2026 год`;
        case 'yearly-2027': return `${name}: гороскоп на 2027 год`;
      }
    },
    h1: (name, ctx) => {
      switch (ctx.surface) {
        case 'tomorrow': return `${name}: гороскоп на завтра`;
        case 'weekly': return `${name}: гороскоп на неделю`;
        case 'monthly': return `${name}: гороскоп на месяц`;
        case 'love': return `${name}: любовный гороскоп`;
        case 'career': return `${name}: деловой гороскоп`;
        case 'yearly-2026': return `${name}: гороскоп на 2026 год`;
        case 'yearly-2027': return `${name}: гороскоп на 2027 год`;
      }
    },
    description: (name, ctx) => tidy(`${headline(name, ctx)}. Составлен по точному расчёту неба: положения планет, фазы Луны и точные даты. Дома отсчитываются от вашего солнечного знака.`),
    periodLabel: {
      today: 'Сегодня', tomorrow: 'Завтра', weekly: 'Неделя', monthly: 'Месяц', love: 'Любовь', career: 'Работа', 'yearly-2026': '2026', 'yearly-2027': '2027',
    },
    crumbs: 'Гороскопы',
    switchAria: 'Выберите период',
    skyHeading: 'Небо, на котором основан прогноз',
    skyIntro: 'Каждая фраза опирается на эти данные, рассчитанные на полдень UTC или на точную минуту события.',
    skyRow: (fact) => (fact.kind === 'position'
      ? `${planet(fact.body)} ${inSign(fact.sign)}${fact.retrograde ? ' (ретроградно)' : ''}, ${fact.house}-й дом · ${dateYear(fact.at)}`
      : skyEventRow(fact)),
    moreHeading: 'Ещё для вашего знака',
    signGuide: (name) => `Гид по знаку ${name}`,
    pairs: (name) => `${name}: совместимость`,
    calculator: 'Постройте натальную карту',
    otherSigns: 'Другие знаки',
    method: 'Дома отсчитываются от вашего солнечного знака (солнечные дома по целым знакам). Время указано по UTC.',
    confidence: (value) => `Уверенность прочтения ${value}%`,
    confidenceNote: 'Число показывает, насколько конкретны данные, на которых основан прогноз (здесь только солнечный знак), а не вероятность того, что что-то произойдёт.',
    faq: (name, surface) => [
      {
        q: `Откуда берётся гороскоп для ${signGen(name)}?`,
        a: 'Из рассчитанных положений планет и Луны на эти даты. Каждая фраза ссылается на данные, на которые опирается, а дома отсчитываются от вашего солнечного знака.',
      },
      {
        q: surface === 'weekly' ? 'Какую неделю он охватывает?'
          : surface === 'monthly' ? 'Какой месяц он охватывает?'
            : surface === 'yearly-2026' || surface === 'yearly-2027' ? 'Какой период он охватывает?'
              : 'Когда он обновляется?',
        a: surface === 'weekly'
          ? 'Неделя идёт с понедельника по воскресенье по UTC и обновляется каждый понедельник.'
          : surface === 'monthly'
            ? 'Календарный месяц по UTC. Гороскоп на следующий месяц выходит 1-го числа.'
            : surface === 'yearly-2026' || surface === 'yearly-2027'
              ? 'Весь календарный год по UTC, с точной датой каждого события, которое его отмечает.'
              : 'Он пересчитывается каждый день по тому же небу, что и ежедневный выпуск.',
      },
      {
        q: 'Пригодится ли он, если я не знаю времени рождения?',
        a: 'Да. Этот прогноз использует только солнечный знак. По дате, времени и месту рождения можно построить полную натальную карту и узнать свой асцендент.',
      },
    ],
  },
};
