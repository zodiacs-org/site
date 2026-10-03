/**
 * Russian Open Graph catalogue for the bounded R2 route family.
 *
 * Existing route copy comes from RU-COPY-DECK.md §15; the four sharing
 * routes use the six-language Phase 2 sharing catalogue. Keeping this data independent from the Astro
 * templates lets the committed cards, rendered metadata, and release verifier
 * share one deterministic source without scraping generated HTML.
 */

const RU_SIGN_NAMES = Object.freeze({
  aries: 'Овен',
  taurus: 'Телец',
  gemini: 'Близнецы',
  cancer: 'Рак',
  leo: 'Лев',
  virgo: 'Дева',
  libra: 'Весы',
  scorpio: 'Скорпион',
  sagittarius: 'Стрелец',
  capricorn: 'Козерог',
  aquarius: 'Водолей',
  pisces: 'Рыбы',
});

const STATIC_ROUTES = [
  {
    key: 'big-three', kind: 'tool', contentPath: '/big-three/', publicPath: '/ru/big-three/', card: 'tool/big-three.png',
    title: 'Ваше Солнце, Луна и асцендент',
    description: 'Узнайте три своих знака и поделитесь вертикальной карточкой, созданной в браузере. Для асцендента нужно время рождения.',
  },
  {
    key: 'compatibility-private-invite', kind: 'tool', contentPath: '/compatibility/invite/', publicPath: '/ru/compatibility/invite/', card: 'tool/compatibility-private-invite.png',
    title: 'Пригласите друга сравнить карты',
    description: 'Сначала добавьте свою карту. Отправьте ссылку: друг добавит свою и увидит совместимость.',
  },
  {
    key: 'group-charts', kind: 'tool', contentPath: '/group-charts/', publicPath: '/ru/group-charts/', card: 'tool/group-charts.png',
    title: 'Изучите карты вашей группы',
    description: 'Добавьте от трёх до восьми человек и исследуйте возможный вклад каждого. Используйте данные рождения с их разрешения.',
  },
  {
    key: 'chart-twins', kind: 'tool', contentPath: '/chart-twins/', publicPath: '/ru/chart-twins/', card: 'tool/chart-twins.png',
    title: 'Найдите астрологических близнецов',
    description: 'Сравните свои знаки с каталогом людей с указанными источниками. Общий знак — повод для разговора, а не доказательство сходства характеров.',
  },
  {
    key: 'share',
    kind: 'share',
    contentPath: '/',
    publicPath: '/ru/',
    card: 'share.png',
    title: 'Zodiacs.org — натальные карты и астрология без мистики',
    description: 'Бесплатные натальные карты, совместимость и гиды по знакам. Всё считается приватно в вашем браузере и объясняется простым языком.',
  },
  {
    key: 'tools', kind: 'tool', contentPath: '/tools/', publicPath: '/ru/tools/', card: 'tool/tools.png',
    title: 'Астроинструменты — карта, совместимость, транзиты',
    description: 'Бесплатные инструменты: натальная карта, лунный знак, асцендент, фаза Луны, возвращение Сатурна, транзиты. Приватно, в браузере.',
  },
  {
    key: 'birth-chart', kind: 'tool', contentPath: '/birth-chart/', publicPath: '/ru/birth-chart/', card: 'tool/birth-chart.png',
    title: 'Бесплатная натальная карта — Солнце, Луна и асцендент',
    description: 'Рассчитайте натальную карту: Солнце, Луна, асцендент, планеты, дома и их значение. Приватно в браузере, объяснено простым языком.',
  },
  {
    key: 'compatibility', kind: 'tool', contentPath: '/compatibility/', publicPath: '/ru/compatibility/', card: 'tool/compatibility.png',
    title: 'Совместимость по натальным картам',
    description: 'Сравните две карты: каждый межкартный аспект, рассчитанный честно и приватно на вашем устройстве.',
  },
  {
    key: 'moon-sign', kind: 'tool', contentPath: '/moon-sign/', publicPath: '/ru/moon-sign/', card: 'tool/moon-sign.png',
    title: 'Лунный знак — узнать по дате рождения',
    description: 'Найдите свой лунный знак по дате рождения. Считается в браузере, с честными оговорками, когда Луна меняла знак.',
  },
  {
    key: 'rising-sign', kind: 'tool', contentPath: '/rising-sign/', publicPath: '/ru/rising-sign/', card: 'tool/rising-sign.png',
    title: 'Асцендент — рассчитать по времени рождения',
    description: 'Асцендент меняется каждые два часа. Рассчитайте свой по дате, времени и месту — приватно в браузере.',
  },
  {
    key: 'moon-phase', kind: 'tool', contentPath: '/moon-phase/', publicPath: '/ru/moon-phase/', card: 'tool/moon-phase.png',
    title: 'Фаза Луны при рождении',
    description: 'Узнайте фазу Луны на любую дату — освещённость, знак и что это значит, без мистики.',
  },
  {
    key: 'saturn-return', kind: 'tool', contentPath: '/saturn-return/', publicPath: '/ru/saturn-return/', card: 'tool/saturn-return.png',
    title: 'Возвращение Сатурна — когда и что это',
    description: 'Годы и точные даты вашего возвращения Сатурна, рассчитанные по эфемеридам, с тремя проходами.',
  },
  {
    key: 'transits', kind: 'tool', contentPath: '/transits/', publicPath: '/ru/transits/', card: 'tool/transits.png',
    title: 'Транзиты сегодня — небо на фоне вашей карты',
    description: 'Постройте карту и смотрите сегодняшние транзиты к ней — с орбисами, градусами и временем UTC.',
  },
  {
    key: 'baby-zodiac', kind: 'tool', contentPath: '/baby-zodiac/', publicPath: '/ru/baby-zodiac/', card: 'tool/baby-zodiac.png',
    title: 'Знак ребёнка по дате родов',
    description: 'Что можно знать о знаках ребёнка до рождения — честно: Солнце почти наверняка, Луна — один из нескольких, асцендент ждёт минуты.',
  },
  {
    key: 'profile', kind: 'page', contentPath: '/profile/', publicPath: '/ru/profile/', card: 'profile.png',
    title: 'Ваши сохранённые карты',
    description: 'Карты, которые вы сохранили, — сначала на устройстве, при входе на всех устройствах.',
  },
  {
    key: 'methodology', kind: 'page', contentPath: '/methodology/', publicPath: '/ru/methodology/', card: 'methodology.png',
    title: 'Методология — как мы считаем',
    description: 'Эфемериды, системы домов, орбисы и правила публикаций: как устроены расчёты Zodiacs.org.',
  },
  {
    key: 'privacy', kind: 'page', contentPath: '/privacy/', publicPath: '/ru/privacy/', card: 'privacy.png',
    title: 'Конфиденциальность',
    description: 'Что мы храним, чего не храним и почему расчёты остаются в вашем браузере.',
  },
  {
    key: 'disclosure', kind: 'page', contentPath: '/disclosure/', publicPath: '/ru/disclosure/', card: 'disclosure.png',
    title: 'Раскрытие информации',
    description: 'Открытые сведения о проекте, источниках данных и коллекционном крыле.',
  },
  {
    key: '404', kind: 'page', contentPath: '/404/', publicPath: '/ru/404/', card: '404.png',
    title: 'Страница не найдена',
    description: 'Такой страницы нет. Начните с главной или с инструментов.',
  },
];

const SIGN_ROUTES = Object.entries(RU_SIGN_NAMES).map(([slug, name]) => ({
  key: slug,
  kind: 'sign',
  slug,
  contentPath: `/${slug}/`,
  publicPath: `/ru/${slug}/`,
  card: `sign/${slug}.png`,
  title: `${name}: даты, характер, совместимость`,
  description: `Гид по знаку ${name}: даты, стихия, управитель, сильные стороны и как знак ведёт себя в отношениях.`,
}));

export const RU_OG_ROUTES = Object.freeze(
  [...STATIC_ROUTES, ...SIGN_ROUTES].map((entry) => Object.freeze(entry)),
);
export const RU_OG_REQUIRED_CARDS = Object.freeze(RU_OG_ROUTES.map((entry) => entry.card).sort());
export const RU_OG_ROUTE_CARDS = Object.freeze(Object.fromEntries(
  RU_OG_ROUTES.map((entry) => [entry.publicPath, entry.card]),
));

/** Stable serialized input used to invalidate committed cards when deck copy changes. */
export const RU_OG_COPY_DIGEST_INPUT = JSON.stringify(RU_OG_ROUTES.map((entry) => ({
  publicPath: entry.publicPath,
  card: entry.card,
  title: entry.title,
  description: entry.description,
})));

function normalizedContentPath(path) {
  let value = String(path || '/').split(/[?#]/, 1)[0];
  try {
    if (/^https?:\/\//u.test(value)) value = new URL(value).pathname;
  } catch {
    return '/';
  }
  if (value === '/ru') value = '/';
  else if (value.startsWith('/ru/')) value = value.slice(3) || '/';
  return value === '/' ? '/' : `/${value.replace(/^\/+|\/+$/gu, '')}/`;
}

export function ruOgMetaForPath(path) {
  const normalized = normalizedContentPath(path);
  return RU_OG_ROUTES.find((entry) => entry.contentPath === normalized) ?? null;
}

export function ruOgImageForPath(path) {
  const entry = ruOgMetaForPath(path);
  return entry ? `/assets/og/v2/ru/${entry.card}` : null;
}
