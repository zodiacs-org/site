/**
 * The sample chart (src/islands/DemoChart.tsx) in the five translated
 * homes. English keeps the component's own strings, untouched. Here the
 * captions are built from what each locale already publishes: the sign
 * essences, the planet, sign and aspect names, and the catalogue's
 * empty-house note, plus one short line per aspect type. The natal reading
 * corpus behind the English captions stays English, as everywhere else.
 */
import type { CatalogLocale } from './i18n/core';
import { signPrepositional, type Sign } from './signs';

export type DemoChartLocale = Exclude<CatalogLocale, 'en'>;

export interface DemoChartCopy {
  /** The pill over the wheel. */
  badge: string;
  /** Accessible name of the wheel picture. */
  wheel: string;
  hint: string;
  explore: string;
  /** Option groups: planets, signs, houses, aspects. */
  groups: readonly [string, string, string, string];
  kinds: { planet: string; sign: string; house: string; aspect: string };
  bigThreeLabel: string;
  /** What the Sun, the Moon and the rising sign stand for, about her. */
  bigThree: readonly [string, string, string];
  /** 'Sol en Cáncer'. */
  placed: (body: string, sign: Sign, name: string) => string;
  /** 'Ascendente en Leo'. */
  rising: (sign: Sign, name: string) => string;
  /** 'Sol en conjunción con Neptuno', names already translated. */
  aspect: (a: string, type: string, label: string, b: string) => string;
  /** Separator between a sign name and its essence (French spaces it). */
  colon: string;
  occupants: (list: string) => string;
  noOccupants: string;
  /** The empty-house note, where the catalogue's own reads poorly here. */
  emptyHouse?: string;
  houseSign: (name: string) => string;
  houseOccupants: (list: string) => string;
  aspectGloss: Readonly<Record<string, string>>;
  orb: (orb: string) => string;
  meaning: string;
  cta: string;
  /** Her birth line as each locale writes a date and a place. */
  birth: string;
  instant: (utc: string) => string;
  source: string;
}

/** Russian takes "во" before Льве, "в" before every other sign. */
const ruIn = (sign: Sign) => `${sign.slug === 'leo' ? 'во' : 'в'} ${signPrepositional(sign)}`;

export const DEMO_CHART_COPY: Record<DemoChartLocale, DemoChartCopy> = {
  es: {
    badge: 'Carta de ejemplo · Frida Kahlo',
    wheel: 'Carta natal de Frida Kahlo',
    hint: 'Toca una marca de la rueda o elige aquí cualquier parte de la carta.',
    explore: 'Explora la carta',
    groups: ['Planetas', 'Signos', 'Áreas de la vida', 'Conexiones'],
    kinds: { planet: 'Planeta', sign: 'Signo', house: 'Área de la vida', aspect: 'Conexión' },
    bigThreeLabel: 'Los tres grandes de Frida Kahlo',
    bigThree: [
      'Identidad, propósito y la dirección en la que crece.',
      'Necesidades emocionales, instinto y lo que la ayuda a sentirse estable.',
      'Primera impresión, manera de llegar y cómo la conocen los demás.',
    ],
    placed: (body, _sign, name) => `${body} en ${name}`,
    rising: (_sign, name) => `Ascendente en ${name}`,
    aspect: (a, type, label, b) => `${a} en ${label} ${type === 'opposition' ? 'a' : 'con'} ${b}`,
    colon: ': ',
    occupants: (list) => `En su carta: ${list}.`,
    noOccupants: 'En su carta, ningún punto cae en este signo.',
    houseSign: (name) => `Esta casa cae en ${name}.`,
    houseOccupants: (list) => `En ella: ${list}.`,
    aspectGloss: {
      conjunction: 'Están casi en el mismo punto del zodiaco y actúan juntos; cuesta separarlos.',
      sextile: 'A unos 60°: colaboran cuando se les da la ocasión.',
      square: 'A unos 90°: una fricción constante que también da fuerza.',
      trine: 'A unos 120°: se ayudan con tanta facilidad que el apoyo pasa inadvertido.',
      opposition: 'Frente a frente, a unos 180°: se turnan hasta encontrar sitio para los dos.',
    },
    orb: (orb) => `Orbe: ${orb}.`,
    meaning: 'Qué significa',
    cta: 'Ver mi carta natal',
    birth: '6 de julio de 1907 · 8:30 · Coyoacán, México',
    instant: (utc) => `instante usado: ${utc} UTC`,
    source: 'fuente publicada de la hora',
  },
  pt: {
    badge: 'Mapa de exemplo · Frida Kahlo',
    wheel: 'Mapa astral de Frida Kahlo',
    hint: 'Toque em uma marca da roda ou escolha aqui qualquer parte do mapa.',
    explore: 'Explore o mapa',
    groups: ['Planetas', 'Signos', 'Áreas da vida', 'Conexões'],
    kinds: { planet: 'Planeta', sign: 'Signo', house: 'Área da vida', aspect: 'Conexão' },
    bigThreeLabel: 'Os três signos principais de Frida Kahlo',
    bigThree: [
      'Identidade, propósito e a direção em que ela cresce.',
      'Necessidades emocionais, instinto e o que a ajuda a se sentir estável.',
      'Primeira impressão, jeito de chegar e como as pessoas a conhecem.',
    ],
    placed: (body, _sign, name) => `${body} em ${name}`,
    rising: (_sign, name) => `Ascendente em ${name}`,
    aspect: (a, type, label, b) => `${a} em ${label} ${type === 'opposition' ? 'a' : 'com'} ${b}`,
    colon: ': ',
    occupants: (list) => `No mapa dela: ${list}.`,
    noOccupants: 'No mapa dela, nenhum ponto cai neste signo.',
    houseSign: (name) => `Esta casa fica em ${name}.`,
    houseOccupants: (list) => `Nela: ${list}.`,
    aspectGloss: {
      conjunction: 'Estão quase no mesmo ponto do zodíaco e agem juntos; é difícil separá-los.',
      sextile: 'A cerca de 60°: colaboram quando surge a oportunidade.',
      square: 'A cerca de 90°: um atrito constante que também dá força.',
      trine: 'A cerca de 120°: ajudam-se com tanta facilidade que o apoio passa despercebido.',
      opposition: 'Frente a frente, a cerca de 180°: revezam-se até encontrar espaço para os dois.',
    },
    orb: (orb) => `Orbe: ${orb}.`,
    meaning: 'O que significa',
    cta: 'Ver meu mapa astral',
    birth: '6 de julho de 1907 · 8h30 · Coyoacán, México',
    instant: (utc) => `instante usado: ${utc} UTC`,
    source: 'fonte publicada do horário',
  },
  fr: {
    badge: 'Thème d’exemple · Frida Kahlo',
    wheel: 'Thème astral de Frida Kahlo',
    hint: 'Touche une marque de la roue ou choisis ici n’importe quelle partie du thème.',
    explore: 'Explore le thème',
    groups: ['Planètes', 'Signes', 'Domaines de vie', 'Liens'],
    kinds: { planet: 'Planète', sign: 'Signe', house: 'Domaine de vie', aspect: 'Lien' },
    bigThreeLabel: 'Les trois signes principaux de Frida Kahlo',
    bigThree: [
      'Identité, but et direction dans laquelle elle grandit.',
      'Besoins émotionnels, instinct et ce qui l’aide à se sentir stable.',
      'Première impression, manière d’arriver et façon dont les autres la rencontrent.',
    ],
    placed: (body, _sign, name) => `${body} en ${name}`,
    rising: (_sign, name) => `Ascendant ${name}`,
    aspect: (a, _type, label, b) => `${a} en ${label} avec ${b}`,
    colon: ' : ',
    occupants: (list) => `Dans son thème : ${list}.`,
    noOccupants: 'Dans son thème, aucun point ne tombe dans ce signe.',
    houseSign: (name) => `Cette maison est en ${name}.`,
    houseOccupants: (list) => `On y trouve : ${list}.`,
    aspectGloss: {
      conjunction: 'Presque au même point du zodiaque, ils agissent ensemble et se séparent difficilement.',
      sextile: 'À environ 60° : ils coopèrent dès que l’occasion se présente.',
      square: 'À environ 90° : un frottement constant, qui donne aussi de la force.',
      trine: 'À environ 120° : ils s’entraident si facilement que l’appui passe inaperçu.',
      opposition: 'Face à face, à environ 180° : ils alternent jusqu’à trouver de la place pour les deux.',
    },
    orb: (orb) => `Orbe : ${orb}.`,
    meaning: 'Ce que cela signifie',
    cta: 'Voir mon thème astral',
    birth: '6 juillet 1907 · 8 h 30 · Coyoacán, Mexique',
    instant: (utc) => `instant retenu : ${utc} UTC`,
    source: 'source publiée de l’heure',
  },
  it: {
    badge: 'Tema di esempio · Frida Kahlo',
    wheel: 'Tema natale di Frida Kahlo',
    hint: 'Tocca un simbolo sulla ruota o scegli qui una parte qualsiasi del tema.',
    explore: 'Esplora il tema',
    groups: ['Pianeti', 'Segni', 'Ambiti di vita', 'Legami'],
    kinds: { planet: 'Pianeta', sign: 'Segno', house: 'Ambito di vita', aspect: 'Legame' },
    bigThreeLabel: 'I tre segni principali di Frida Kahlo',
    bigThree: [
      'Identità, scopo e la direzione in cui cresce.',
      'Bisogni emotivi, istinto e ciò che la aiuta a sentirsi stabile.',
      'Prima impressione, modo di presentarsi e come la incontrano gli altri.',
    ],
    placed: (body, _sign, name) => `${body} in ${name}`,
    rising: (_sign, name) => `Ascendente ${name}`,
    aspect: (a, type, label, b) => `${a} in ${label} ${type === 'opposition' ? 'a' : 'con'} ${b}`,
    colon: ': ',
    occupants: (list) => `Nel suo tema: ${list}.`,
    noOccupants: 'Nel suo tema nessun punto cade in questo segno.',
    houseSign: (name) => `Questa casa cade in ${name}.`,
    houseOccupants: (list) => `Al suo interno: ${list}.`,
    aspectGloss: {
      conjunction: 'Sono quasi nello stesso punto dello zodiaco e agiscono insieme; è difficile separarli.',
      sextile: 'A circa 60°: collaborano quando se ne presenta l’occasione.',
      square: 'A circa 90°: un attrito costante che dà anche forza.',
      trine: 'A circa 120°: si aiutano con tale facilità che il sostegno passa inosservato.',
      opposition: 'Uno di fronte all’altro, a circa 180°: si alternano finché trovano spazio per entrambi.',
    },
    orb: (orb) => `Orbita: ${orb}.`,
    meaning: 'Che cosa significa',
    cta: 'Vedi il mio tema natale',
    birth: '6 luglio 1907 · 8:30 · Coyoacán, Messico',
    instant: (utc) => `istante usato: ${utc} UTC`,
    source: 'fonte pubblicata dell’ora',
  },
  ru: {
    badge: 'Пример карты · Фрида Кало',
    wheel: 'Натальная карта Фриды Кало',
    hint: 'Нажмите на отметку на круге или выберите здесь любую часть карты.',
    explore: 'Изучите карту',
    groups: ['Планеты', 'Знаки', 'Сферы жизни', 'Связи'],
    kinds: { planet: 'Планета', sign: 'Знак', house: 'Сфера жизни', aspect: 'Связь' },
    bigThreeLabel: 'Большая тройка Фриды Кало',
    bigThree: [
      'Личность, цель и направление, в котором она растёт.',
      'Эмоциональные потребности, инстинкт и то, что даёт ей опору.',
      'Первое впечатление, манера держаться и то, какой её видят другие.',
    ],
    placed: (body, sign) => `${body} ${ruIn(sign)}`,
    rising: (sign) => `Асцендент ${ruIn(sign)}`,
    aspect: (a, _type, label, b) => `${a} и ${b}: ${label}`,
    colon: ': ',
    occupants: (list) => `В её карте здесь: ${list}.`,
    noOccupants: 'В её карте в этом знаке нет ни одной точки.',
    emptyHouse: 'Планет здесь нет. Пустой дом не означает пробела: его темы идут через планету, которая им управляет.',
    houseSign: (name) => `Знак дома: ${name}.`,
    houseOccupants: (list) => `В нём: ${list}.`,
    aspectGloss: {
      conjunction: 'Почти в одной точке зодиака: действуют вместе, и разделить их трудно.',
      sextile: 'Около 60° друг от друга: сотрудничают, когда для этого есть повод.',
      square: 'Около 90° друг от друга: постоянное трение, которое тоже даёт силу.',
      trine: 'Около 120° друг от друга: помогают друг другу так естественно, что эту поддержку можно не заметить.',
      opposition: 'Друг напротив друга, около 180°: действуют по очереди, пока не найдут место для обоих.',
    },
    orb: (orb) => `Орбис: ${orb}.`,
    meaning: 'Что это значит',
    cta: 'Построить мою карту',
    birth: '6 июля 1907 · 8:30 · Койоакан, Мексика',
    instant: (utc) => `расчётный момент: ${utc} UTC`,
    source: 'опубликованный источник времени',
  },
};
