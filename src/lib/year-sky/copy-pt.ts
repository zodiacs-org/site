/**
 * "Seu céu de 2027": the Brazilian Portuguese words of Your 2027 sky.
 * Importing this module registers them (defineYearSkyWords), so only the
 * Portuguese page and its island carry them. Sign and planet names come from
 * the site's own helpers; the reading follows the English one line for line.
 *
 * House rules, as in copy.ts: plain, warm and dry; você, as the rest of the
 * Portuguese site; no em or en dashes; no health, money, betting or guarantees.
 */
import { planetLabel } from '../i18n/astrology';
import { signName as localSignName } from '../signs';
import { PERSONAL_WORDS } from '../personal-calendar/words';
import type { MilestoneKind } from '../occasions/milestones';
import { defineYearSkyWords, type YearAspect, type YearSkyWords } from './copy';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const ORDINAL = ['', 'primeiro', 'segundo', 'terceiro', 'quarto', 'quinto', 'sexto', 'sétimo', 'oitavo'];
const HOUSE_ORDINAL = ['', 'primeira', 'segunda', 'terceira', 'quarta', 'quinta', 'sexta', 'sétima', 'oitava', 'nona', 'décima', 'décima primeira', 'décima segunda'];
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const P = (body: string) => planetLabel('pt', body);
const W = PERSONAL_WORDS.pt;

const HOUSE_TOPIC = [
  '',
  'como você se mostra e começa as coisas',
  'o que você valoriza e mantém por perto',
  'conversas, viagens curtas, irmãos e vizinhos',
  'casa, família e raízes',
  'diversão, romance e criar coisas',
  'o trabalho do dia a dia e as rotinas',
  'parcerias e laços a dois',
  'intimidade, confiança e o que você divide',
  'viagens, estudos e grandes ideias',
  'trabalho, reputação e rumo',
  'amigos, grupos e esperanças',
  'descanso, recolhimento e o que acontece longe dos olhos',
];

const SIGN_TOPIC: Record<string, string> = {
  aries: 'começar coisas',
  taurus: 'conforto e constância',
  gemini: 'conversas e ideias',
  cancer: 'casa e família',
  leo: 'diversão e ser visto',
  virgo: 'ofício e trabalho útil',
  libra: 'parcerias e justiça',
  scorpio: 'confiança e profundidade',
  sagittarius: 'viagens e grandes ideias',
  capricorn: 'trabalho e posição',
  aquarius: 'amigos e o futuro',
  pisces: 'descanso e imaginação',
};
const SLUG_BY_NAME = new Map(Object.keys(SIGN_TOPIC).map((slug) => [localSignName(slug, 'pt'), slug]));
const signTopic = (sign: string) => SIGN_TOPIC[SLUG_BY_NAME.get(sign) ?? ''] ?? sign;

const POINT: Record<string, string> = { ASC: 'ascendente', MC: 'meio do céu' };
/** Points spoken of as feminine in Portuguese astrology. */
const FEMININE = new Set(['Moon', 'Venus']);
const pointName = (point: string) => POINT[point] ?? P(point);
const your = (point: string) => `${FEMININE.has(point) ? 'sua' : 'seu'} ${pointName(point)}`;
const toYour = (point: string) => `${FEMININE.has(point) ? 'à sua' : 'ao seu'} ${pointName(point)}`;
const my = (point: string) => `${FEMININE.has(point) ? 'minha' : 'meu'} ${pointName(point)}`;

/** What each point stands for; the part before a comma is its short form. */
const ROLE: Record<string, string> = {
  Sun: 'seu senso de si',
  Moon: 'sua vida emocional',
  Mercury: 'seu jeito de pensar',
  Venus: 'seu jeito de amar',
  Mars: 'sua garra',
  Jupiter: 'sua vontade de mais',
  Saturn: 'seu senso de dever',
  ASC: 'seu ascendente, o jeito como você encontra o mundo',
  MC: 'seu meio do céu, seu rumo público',
};
const role = (point: string) => ROLE[point] ?? your(point);
const shortRole = (point: string) => role(point).split(',')[0];

const TONE: Record<string, string> = {
  Jupiter: 'cerca de um ano de crescimento',
  Saturn: 'cerca de dois anos e meio de construção lenta',
  Uranus: 'cerca de sete anos de mudança',
  Neptune: 'mais de uma década de sonho',
  Pluto: 'duas décadas de mudança profunda',
};
const tone = (planet: string) => TONE[planet] ?? 'um trecho longo';
/** "em torno da casa", "em torno do trabalho", "em torno de conversas". */
const around = (topic: string) => {
  const article = /^(o|a|os|as) /u.exec(topic)?.[1];
  return article ? `em torno d${article} ${topic.slice(article.length + 1)}` : `em torno de ${topic}`;
};

const MOVER: Record<string, string> = {
  Venus: 'um trecho suave de carinho e vontade',
  Mars: 'um trecho carregado de calor e pressa',
  Jupiter: 'um trecho generoso de confiança',
  Saturn: 'uma longa temporada de pressão e de prestação de contas',
  Uranus: 'um solavanco que se repete por meses',
  Neptune: 'uma névoa lenta de saudade e contornos borrados',
  Pluto: 'uma escavação que dura anos',
};
const ASPECT_VERB: Record<YearAspect, { verb: (point: string) => string; gloss: string }> = {
  conjunction: { verb: (point) => `pousa sobre ${role(point)}`, gloss: 'que por um tempo dá cor a tudo ali' },
  square: { verb: (point) => `pressiona ${role(point)}`, gloss: 'um atrito que não se resolve sozinho' },
  trine: { verb: (point) => `flui por ${role(point)}`, gloss: 'uma ajuda que chega sem ser pedida' },
  opposition: { verb: (point) => `fica de frente para ${role(point)}`, gloss: 'uma tensão que vale encarar de frente em vez de absorver' },
};
const contactTitle = (aspect: YearAspect, point: string, mine: boolean) => {
  const plain = mine ? my(point) : your(point);
  const to = mine ? `${FEMININE.has(point) ? 'à minha' : 'ao meu'} ${pointName(point)}` : toYour(point);
  return {
    conjunction: `encontra ${plain}`,
    square: `em quadratura com ${plain}`,
    trine: `em trígono com ${plain}`,
    opposition: `em oposição ${to}`,
  }[aspect];
};

const RETROGRADE_LINE: Record<string, string> = {
  Mercury: 'Planos, mensagens e viagens pedem uma segunda olhada. Termine, revise e conserte antes de lançar qualquer coisa.',
  Venus: 'Sentimentos e gostos antigos voltam para revisão. Um bom trecho para consertar mais do que para começar.',
  Mars: 'A energia se volta para dentro. Um trecho longo para rever como você insiste, não para comprar brigas novas.',
  Jupiter: 'O crescimento desacelera para ser conferido. Uma temporada para terminar o que o ano começou.',
  Saturn: 'Os compromissos são revistos por dentro. O trabalho quieto nas bases rende depois.',
  Uranus: 'As mudanças dos últimos anos se assentam, e você vê quais eram para valer.',
  Neptune: 'A névoa se levanta um pouco. As esperanças recebem um choque suave de realidade.',
  Pluto: 'O trabalho profundo fica quieto e pessoal.',
};
const retrograde = (planet: string) => `${P(planet)} ${FEMININE.has(planet) ? 'retrógrada' : 'retrógrado'}`;

const ECLIPSE_KIND: Record<string, string> = { total: 'total', annular: 'anular', partial: 'parcial', penumbral: 'penumbral', hybrid: 'híbrido' };
const kindOf = (kind: string) => ECLIPSE_KIND[kind] ?? kind;

const MILESTONE_CARD: Record<MilestoneKind, string> = {
  'jupiter-return': 'Meu retorno de Júpiter',
  'saturn-return': 'Meu retorno de Saturno',
  'uranus-opposition': 'Minha oposição de Urano',
};

const dayOfMonth = (d: Date) => (d.getUTCDate() === 1 ? '1º' : String(d.getUTCDate()));
const day = (iso: string, year: number) => {
  const d = new Date(iso);
  const base = `${dayOfMonth(d)} de ${MONTHS[d.getUTCMonth()]}`;
  return d.getUTCFullYear() === year ? base : `${base} de ${d.getUTCFullYear()}`;
};
const list = (items: string[]) => items.length <= 1
  ? items.join('')
  : `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
const decimal = (value: string) => value.replace('.', ',');

export const YEAR_SKY_WORDS_PT: YearSkyWords = defineYearSkyWords('pt', {
  dateLocale: 'pt-BR',
  pageTitle: 'Seu céu de 2027: o ano que vem para o seu mapa astral',
  pageDescription: 'Os eclipses, os planetas lentos, as retrogradações e os retornos de 2027 que tocam o seu mapa astral, mês a mês, com um card para compartilhar e um arquivo de calendário feitos no seu aparelho.',
  heroTitle: 'Seu céu de 2027',
  heroLede: 'Os grandes momentos de 2027 que tocam o seu próprio mapa: os eclipses, os planetas lentos, Vênus e Marte sobre o seu Sol, a sua revolução solar e as retrogradações que caem sobre as suas posições. Tudo é calculado neste navegador.',
  noscript: 'Para ler o ano do seu mapa é preciso JavaScript. O céu compartilhado abaixo funciona sem ele.',
  chooserTitle: 'Leia para o seu mapa',
  chooserSaved: 'Mapa salvo',
  savedLede: (name) => (name ? `Com o seu mapa salvo, ${name}.` : 'Escolha um dos seus mapas salvos.'),
  enterOther: 'Usar outros dados de nascimento',
  useSaved: 'Usar um mapa salvo',
  readMine: 'Ler o meu 2027',
  enterDetails: 'Digitar os dados de nascimento',
  enterDetailsLede: 'Digite uma data, um horário e um local de nascimento para ler o ano desse mapa.',
  readEntered: 'Ler o meu 2027',
  orGeneral: 'Ou leia o céu que todos compartilham.',
  reading: 'Lendo o ano…',
  cancel: 'Cancelar',
  error: 'Não foi possível calcular o ano. Confira os dados e tente de novo.',
  savedRemoved: 'Esse mapa salvo mudou enquanto o ano era lido. Tente de novo.',
  saveHint: 'Salvando um mapa, você pode voltar aqui sem digitar os dados de novo.',
  saveChart: 'Salvar um mapa',
  privacy: 'O ano é calculado neste aparelho. Seus dados de nascimento não são enviados, não são guardados e não entram em nenhum link.',
  resultTitle: 'O seu 2027',
  resultLede: 'Cada momento abaixo traz o dia exato em UTC. Os planetas lentos ficam por perto por semanas antes e depois da data exata, então leia cada um como uma temporada com um pico.',
  briefTitle: 'O ano em resumo',
  allYearTitle: 'O ano todo',
  allYearLede: 'Onde os planetas lentos ficam no seu mapa durante o ano inteiro, por casas de signo inteiro a partir do seu signo ascendente.',
  quietQuarter: 'Nada grande toca o seu mapa nestes meses. O céu compartilhado abaixo continua valendo.',
  unknownTime: 'Sem horário de nascimento, o mapa é calculado para o meio-dia da data de nascimento, então uma data pode variar um dia, e a Lua, o ascendente e as casas ficam de fora.',
  quarterNames: ['De janeiro a março', 'De abril a junho', 'De julho a setembro', 'De outubro a dezembro'],
  monthNames: MONTHS,
  generalTitle: 'O céu de 2027 que todos compartilham',
  generalLede: 'Cinco eclipses, as retrogradações e onde os planetas lentos passam o ano. Essas datas são as mesmas para todos; o que elas tocam depende de cada mapa.',
  generalInvite: 'Quer saber quais caem sobre o seu mapa?',
  generalInviteLink: 'Leia para o seu mapa',
  generalCalendar: 'Coloque o céu compartilhado no seu app de calendário',
  moreTitle: 'Mais sobre 2027',
  moreLinks: [
    { path: '/eclipses/', label: 'Eclipses solares e lunares' },
    { path: '/mercury-retrograde/', label: 'Mercúrio retrógrado' },
    { path: '/full-moon-calendar/', label: 'Calendário de luas cheias' },
    { path: '/sky-calendar/', label: 'Coloque o céu compartilhado no seu app de calendário' },
    { path: '/transits/', label: 'Trânsitos, dia a dia' },
    { path: '/birth-chart/', label: 'O seu mapa astral' },
  ],
  shareTitle: 'Compartilhe o seu ano',
  shareLede: 'O card mostra só signos e planetas: nenhum nome, nenhuma data, horário ou local de nascimento, e nenhuma data do seu mapa.',
  shareSquare: 'Compartilhar o card quadrado',
  shareStory: 'Compartilhar o card para stories',
  shareShared: 'Compartilhado.',
  shareSaved: 'Salvo no seu aparelho.',
  cardNote: 'Feito neste navegador. O card quadrado tem 1080 × 1080 e o de stories 1080 × 1920.',
  calendarTitle: 'Adicionar 2027 ao meu calendário',
  calendarLede: 'Um único arquivo com os seus momentos e o céu compartilhado, cada um com um lembrete na véspera. Ele é criado neste navegador e salvo no seu aparelho; não há link para assinar, porque um link teria de levar os seus dados de nascimento.',
  calendarButton: 'Baixar o arquivo de calendário',
  calendarDone: 'Arquivo de calendário salvo. Abra o arquivo para adicionar os eventos ao seu app de calendário.',
  calendarNote: 'O arquivo se chama zodiacs-2027-sky.ics. A maioria dos apps de calendário importa o arquivo com um toque duplo ou pelo menu de importação.',
  calendarName: 'Zodiacs.org · Meu céu de 2027',
  calendarExact: 'Exato às {time} UTC.',
  calendarMore: 'Mais: {url}',
  calendarForecast: W.note,
  confidenceNote: 'Cada leitura traz a sua confiança de leitura: o quanto são específicos os dados do mapa por trás dela, não a chance de algo acontecer.',
  cardHeadline: 'Meu céu em',
  cardSun: P('Sun'),
  cardMoon: P('Moon'),
  cardRising: 'Ascendente',
  cardCount: (n) => (n === 1 ? '1 momento toca o meu mapa' : `${n} momentos tocam o meu mapa`),
  cardQuiet: 'Um ano tranquilo para o meu mapa',
  confidence: (value) => `Confiança da leitura ${value}%`,
  day,
  dayTime: (iso) => {
    const d = new Date(iso);
    return `${dayOfMonth(d)} de ${MONTHS[d.getUTCMonth()]} às ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
  },
  range: (fromIso, toIso, year) => `de ${day(fromIso, year)} a ${day(toIso, year)}`,
  list,
  signName: (slug) => localSignName(slug, 'pt'),
  planet: P,
  pointName,

  eclipseTitle: (type, kind) => `Eclipse ${type === 'solar' ? 'solar' : 'lunar'} ${kindOf(kind)}`,
  eclipseLine: (type, kind, degree, sign, unseen) => type === 'solar'
    ? `Uma Lua nova com peso extra a ${degree} de ${sign}. Os astrólogos leem os eclipses solares como começos que chegam antes do previsto.${kind === 'total' ? ' Este é total: a Lua cobre o Sol inteiro ao longo da sua faixa.' : ''}`
    : `Uma Lua cheia com peso extra a ${degree} de ${sign}. Os eclipses lunares são lidos como finais e faxinas.${unseen ? ` Este é penumbral e tão leve que nenhum olho nem câmera o verá: a NASA lhe dá uma magnitude de ${String(unseen).replace('.', ',')}.` : kind === 'penumbral' ? ' Este é penumbral, fraco a olho nu.' : ''}`,
  retrogradeTitle: retrograde,
  retrogradeLine: (planet) => RETROGRADE_LINE[planet] ?? `${P(planet)} parece andar para trás por um tempo.`,
  retrogradeDetail: (range, sign, shadow) => `${cap(range)}${sign ? `, em ${sign}` : ''}.${shadow ? ` A sombra vai ${shadow}.` : ''}`,
  ingressTitle: (planet, sign) => `${P(planet)} entra em ${sign}`,
  ingressLine: (planet, sign, until) => `${P(planet)} fica em ${sign} até ${until}: ${tone(planet)} ${around(signTopic(sign))}.`,
  stationRetrograde: 'começa a retrogradação',
  underWay: 'Já em curso quando o ano começa',
  stationDirect: 'volta ao movimento direto',
  backgroundTitle: 'Onde os planetas lentos passam 2027',
  backgroundLine: (planet, signs) => `${P(planet)}: ${signs}.`,
  backgroundSigns: (spans) => spans.length === 1
    ? `${spans[0].sign} o ano todo`
    : spans.map((span, i) => `${i === 0 ? '' : 'depois '}${span.sign}${span.until ? ` até ${span.until}` : ''}`).join(', '),
  passLabel: (pass, count) => `passagem ${pass} de ${count}`,

  solarTitle: W.solarTitle,
  solarLine: 'O Sol volta ao grau exato em que estava quando você nasceu. Os astrólogos leem o mapa deste momento como o formato do seu ano que começa.',
  solarDetail: (time) => `Exato em ${time}.`,
  milestoneTitle: (kind, index) => kind === 'uranus-opposition'
    ? 'Sua oposição de Urano'
    : `Seu ${ORDINAL[index] ?? `${index}º`} ${W.milestones[kind].name.charAt(0).toLowerCase()}${W.milestones[kind].name.slice(1)}`,
  milestoneLine: (kind) => W.milestones[kind].about,
  contactTitle: (planet, aspect, point) => `${P(planet)} ${contactTitle(aspect, point, false)}`,
  contactLine: (planet, aspect, point) => {
    const phrase = ASPECT_VERB[aspect];
    const mover = MOVER[planet];
    if (!phrase || !mover) return `${P(planet)} faz um aspecto com ${role(point)}.`;
    return `${P(planet)} ${phrase.verb(point)}: ${mover}, ${phrase.gloss}.`;
  },
  exactOn: (dates) => `Exato: ${dates}.`,
  passOf: (pass, count) => `Passagem ${pass} de ${count}.`,
  loopBefore: (year) => `O ciclo começou em ${year}.`,
  loopAfter: (year) => `O ciclo termina em ${year}.`,
  slowNote: W.slowNote,
  eclipseHitTitle: (type, contact, point) => `Um eclipse ${type === 'solar' ? 'solar' : 'lunar'} cai ${contact === 'conjunction' ? `sobre ${your(point)}` : `de frente para ${your(point)}`}`,
  eclipseHitLine: (type, contact, point, degree, sign) => {
    const where = contact === 'conjunction' ? `sobre ${role(point)}` : `de frente para ${role(point)}`;
    return type === 'solar'
      ? `O eclipse a ${degree} de ${sign} cai ${where}. Leia como uma porta que se abre ali: algo começa, antes do que você planejava.`
      : `O eclipse a ${degree} de ${sign} cai ${where}. Leia como uma faxina: algo ali chega ao seu fim natural, e você ganha o espaço de volta.`;
  },
  eclipseOrb: (orb) => `A ${decimal(orb)}° do ponto exato.`,
  retrogradeHitTitle: (planet, points) => `${retrograde(planet)} volta sobre ${list(points.map(your))}`,
  retrogradeHitLine: (planet, points) => {
    const names = list(points.map(your));
    const roles = list(points.map(shortRole));
    if (planet === 'Mercury') return `Mercúrio cruza ${names} três vezes: para a frente, para trás e para a frente de novo. Conversas e planos que tocam ${roles} ganham um segundo rascunho.`;
    if (planet === 'Venus') return `Vênus cruza ${names} três vezes. Sentimentos e gostos antigos ligados a ${roles} voltam para revisão.`;
    return `${P(planet)} cruza ${names} três vezes. ${cap(roles)} ${points.length > 1 ? 'passam' : 'passa'} por um longo treino: primeiro mais lento, depois mais forte.`;
  },
  ingressSunTitle: (planet) => `${P(planet)} entra no seu signo solar`,
  ingressRisingTitle: (planet) => `${P(planet)} entra no seu signo ascendente`,
  ingressHouseTitle: (planet, house) => `${P(planet)} entra na sua ${HOUSE_ORDINAL[house]} casa`,
  ingressPersonalLine: (planet, sign, house, ownSign) => {
    const parts = [`${P(planet)} entra em ${sign}`];
    if (house) parts.push(`, a sua ${HOUSE_ORDINAL[house]} casa por casas de signo inteiro: ${tone(planet)} ${around(HOUSE_TOPIC[house])}.`);
    else parts.push(`: ${tone(planet)} ${around(signTopic(sign))}.`);
    if (ownSign === 'sun') parts.push(' É o seu signo solar, então o ciclo recomeça onde o seu mapa guarda o motor.');
    if (ownSign === 'rising') parts.push(' É o seu signo ascendente, então a mudança aparece primeiro no jeito como você encontra o mundo.');
    return parts.join('');
  },
  backgroundHouseLine: (planet, sign, house, until) => `${P(planet)} ${until ? `fica em ${sign} até ${until}` : `passa o ano em ${sign}`}, a sua ${HOUSE_ORDINAL[house]} casa por casas de signo inteiro: ${tone(planet)} ${around(HOUSE_TOPIC[house])}.`,
  cardContact: (planet, aspect, point) => `${P(planet)} ${contactTitle(aspect, point, true)}`,
  cardEclipse: (point) => `Um eclipse sobre ${my(point)}`,
  cardRetrograde: (planet, points) => `${retrograde(planet)} sobre ${list(points.map(my))}`,
  cardMilestone: (kind) => MILESTONE_CARD[kind],
  cardIngress: (planet, house, ownSign) => ownSign === 'sun'
    ? `${P(planet)} no meu signo solar`
    : ownSign === 'rising'
      ? `${P(planet)} no meu signo ascendente`
      : `${P(planet)} na minha ${HOUSE_ORDINAL[house ?? 0] ?? ''} casa`,
});
