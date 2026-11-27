/**
 * Every visible string of the localized /today/ pages (LocalizedToday.astro),
 * kept in a module so each locale's copy can live in its own file.
 * es and pt are here; fr and it are in src/lib/locale-expansion/daily-copy/.
 */
import dailyData from '../../data/daily.json';
import skyData from '../../data/sky.json';
import eclipseData from '../../data/eclipses.json';
import eventsData from '../../data/events-publication.json';
import type { Daily, DailyEvent } from '../../lib/daily';
import { ASPECT_GLYPH, PLANET_GLYPH } from '../../lib/glyphs/paths';
import { dailyReadingForLocale } from '../../lib/i18n/daily-reading';
import { formatDate, intlLocale } from '../../lib/i18n/dates';
import { aspectLabel, moonPhaseLabel, planetLabel } from '../../lib/i18n/astrology';
import { englishOnlyCue } from '../../lib/i18n/english-only';
import { localizePath, t } from '../../lib/i18n';
import { rangeWords } from '../../lib/range-words';
import { SIGNS, elementLabel, modalityLabel, signBySlug, signEssence, signName } from '../../lib/signs';
import { signDateRange } from '../../lib/sign-display';
import { ART, artSrc, artSrcset } from '../../lib/art';
import { toolIconForPath } from '../../lib/tool-icons';
import { refinePublishedAnchors, refineRetrogradeWindows, refineTransitMonth } from '../../lib/nasa-instants';
import {
  aspectsToday,
  comingUp,
  degreeMinutes,
  moonAgeDays,
  moonCycle,
  nextEclipse,
  planetRows,
  retrogradeTimeline,
  utcClock,
  type TransitCatalog,
} from '../../lib/today-sky';

export type TodayLocale = 'es' | 'pt' | 'fr' | 'it' | 'ru';
type Locale = TodayLocale;


/** A sentence in parts; `TODAY` is the edition's day, said relatively only while it is current. */
export const TODAY = Symbol('today');
export type Part = string | typeof TODAY;

export interface TodayCopy {
  title: (date: string) => string;
  description: (date: string) => string;
  crumbsAria: string;
  home: string;
  todayWord: string;
  TodayWord: string;
  onDate: (date: string) => string;
  h1: string;
  lede: string;
  cta: string;
  yourSign: string;
  reassure: string;
  wheelAria: (date: string) => string;
  legendRx: string;
  legendEasy: string;
  legendTense: string;
  legendJoined: string;
  lightsKicker: string;
  lightsTitle: string;
  lightsLede: string;
  moonLink: string;
  sunTag: (degree: string) => string;
  moonTag: (degree: string, percent: number) => string;
  sunIn: (sign: string) => string;
  moonIn: (sign: string) => string;
  sunNote: (third: number, ingress: { sign: string; date: string } | null) => string;
  moonNote: (age: string, single: boolean, lastDegree: boolean) => string;
  moonAge: (age: string, single: boolean) => string;
  cycleAria: string;
  signsKicker: string;
  signsLede: string;
  allHoroscopes: string;
  signsAria: string;
  horoscopeLink: (sign: string) => string;
  guideLink: (sign: string) => string;
  personalTitle: string;
  personalBody: string;
  personalCompare: string;
  planetsTitle: string;
  planetsSub: (date: string) => string;
  planetsSubMore: string;
  topics: Record<string, string>;
  direct: string;
  retrograde: string;
  station: (type: string, clock: string) => string;
  comingTitle: string;
  comingSub: string;
  eclipseTitle: (type: string, kind: string, sign: string) => string;
  eclipseShort: (type: string, kind: string) => string;
  eclipseType: Record<string, string>;
  eclipseKind: Record<string, string>;
  ingressTitle: (subject: string, sign: string) => string;
  ingressDetail: (retrograde: boolean, from: string) => string;
  lunationTitle: (type: string, sign: string) => string;
  stationTitle: (planet: string, type: string) => string;
  aspectDetail: (a: string, b: string) => string;
  nextEclipse: (name: string, date: string) => string;
  calendarLink: string;
  dayEvent: (event: DailyEvent) => string | null;
  rxTitle: string;
  rxLink: string;
  rxNone: Part[];
  rxNow: (list: string, count: number) => Part[];
  rxNext: (planet: string, date: string) => Part[];
  rxEnded: (planet: string, date: string | null) => Part[];
  rxTableAria: (range: string) => string;
  rxPlanet: string;
  rxPeriod: string;
  rxNowPrefix: string;
  rxNowDirect: string;
  rxStateNow: string;
  rxStateUpcoming: string;
  rxStateEnded: string;
  rxMeansKicker: string;
  rxMeans: string;
  aspectsTitle: string;
  aspectsLede: (all: number, shown: number) => string;
  definitions: Record<string, string>;
  represent: (a: string, topicA: string, b: string, topicB: string) => string;
  exactAt: (clock: string) => string;
  fromExact: (orb: string) => string;
  furtherTitle: string;
  furtherLede: string;
  allTools: string;
  tools: { href: string; title: string; promise: string }[];
  askTitle: string;
  askLead: string;
  askLabel: string;
  prompts: string[];
  methodTitle: string;
  methodBody: (date: string) => string;
  coverage: string;
  provenanceLabel: string;
  provenanceDescription: string;
  provenanceBefore: string;
  provenanceAfter: string;
  methodLink: string;
  publicationLink: string;
  correctionsLink: string;
}

// Planet names with the article the Sun and the Moon take in running text.
const ARTICLED: Record<Locale, { Sun: string; Moon: string }> = {
  es: { Sun: 'el Sol', Moon: 'la Luna' },
  pt: { Sun: 'o Sol', Moon: 'a Lua' },
  fr: { Sun: 'le Soleil', Moon: 'la Lune' },
  it: { Sun: 'il Sole', Moon: 'la Luna' },
  ru: { Sun: 'Солнце', Moon: 'Луна' },
};
export const named = (locale: Locale, body: string) => {
  if (body === 'Sun' || body === 'Moon') return ARTICLED[locale][body];
  return planetLabel(locale, body);
};
export const cap = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const TODAY_COPY: Record<'es' | 'pt', TodayCopy> = {
  es: {
    title: (date) => `Hoy, el cielo del ${date} | Zodiacs.org`,
    description: (date) => `El cielo de hoy para los doce signos solares: hasta cuatro notas por signo, calculadas a partir de las posiciones reales del ${date}.`,
    crumbsAria: 'Ruta de navegación',
    home: 'Inicio',
    todayWord: 'hoy',
    TodayWord: 'Hoy',
    onDate: (date) => `el ${date}`,
    h1: 'El cielo de hoy',
    lede: 'Dónde está cada planeta, qué ha representado tradicionalmente cada posición y qué viene después en el calendario.',
    cta: 'Compáralo con tu carta',
    yourSign: 'Tu signo',
    reassure: 'Gratis · Sin registro · Posiciones a las 12:00 UTC',
    wheelAria: (date) => `El cielo a las 12:00 UTC del ${date}: el Sol, la Luna y los planetas en sus signos, con los aspectos a menos de tres grados del exacto`,
    legendRx: 'Retrógrado',
    legendEasy: 'Trígono o sextil',
    legendTense: 'Cuadratura u oposición',
    legendJoined: 'Conjunción',
    lightsKicker: 'Donde empieza el día',
    lightsTitle: 'El Sol y la Luna',
    lightsLede: 'Las dos luminarias con las que empieza la astrología: dónde están y qué han representado tradicionalmente sus signos.',
    moonLink: 'La Luna de esta noche, en detalle',
    sunTag: (degree) => `Sol · ${degree}`,
    moonTag: (degree, percent) => `Luna · ${degree} · ${percent}% iluminada`,
    sunIn: (sign) => `Sol en ${sign}`,
    moonIn: (sign) => `Luna en ${sign}`,
    sunNote: (third, ingress) => `El Sol está en ${['el primer tercio', 'el tercio central', 'el último tercio'][third]} del signo${ingress ? ` y entra en ${ingress.sign} el ${ingress.date}` : ''}.`,
    moonNote: (age, single, lastDegree) => `${single ? 'Ha pasado' : 'Han pasado'} ${age} ${single ? 'día' : 'días'} desde la Luna nueva${lastDegree ? ', y la Luna está en el último grado del signo' : ''}.`,
    moonAge: (age, single) => `Edad: ${age} ${single ? 'día' : 'días'}`,
    cycleAria: 'Este ciclo lunar',
    signsKicker: 'Tu signo',
    signsLede: 'Elige tu signo solar. Cada nota sale de las posiciones registradas del cielo de hoy, leídas desde las casas solares de tu signo; los comprobantes bajo cada lectura dicen exactamente qué la produjo. Son temas para observar, no instrucciones.',
    allHoroscopes: 'Todos los horóscopos',
    signsAria: 'Signos',
    horoscopeLink: (sign) => `Horóscopo de ${sign} de hoy`,
    guideLink: (sign) => `Guía de ${sign}`,
    personalTitle: 'Tu carta, frente al cielo de hoy',
    personalBody: 'Con tu fecha, hora y lugar de nacimiento, tu carta natal se calcula aquí, en tu navegador. La comparación privada de una carta guardada con cada edición está, por ahora, en la edición en inglés.',
    personalCompare: 'Ver la comparación privada',
    planetsTitle: 'Dónde están los planetas',
    planetsSub: (date) => `12:00 UTC, ${date}.`,
    planetsSubMore: ' Cada cuerpo con lo que ha representado tradicionalmente.',
    topics: {
      Sun: 'identidad y dirección',
      Moon: 'necesidades emocionales e instintos',
      Mercury: 'pensamiento y comunicación',
      Venus: 'afecto, placer y valores',
      Mars: 'impulso y afirmación personal',
      Jupiter: 'crecimiento y creencias',
      Saturn: 'responsabilidad y crecimiento a largo plazo',
      Uranus: 'independencia y cambio',
      Neptune: 'imaginación e ideales',
      Pluto: 'poder y cambio profundo',
    },
    direct: 'Directo',
    retrograde: 'Retrógrado',
    station: (type, clock) => `${type === 'retrograde' ? 'Retrógrado' : 'Directo'} desde las ${clock} UTC`,
    comingTitle: 'Lo que viene en el cielo',
    comingSub: 'Fechas en UTC, así que algunas caen un día antes en América.',
    eclipseTitle: (type, kind, sign) => `Eclipse ${type} ${kind} en ${sign}`,
    eclipseShort: (type, kind) => `${type} ${kind}`,
    eclipseType: { solar: 'solar', lunar: 'lunar' },
    eclipseKind: { total: 'total', partial: 'parcial', annular: 'anular', penumbral: 'penumbral', hybrid: 'híbrido' },
    ingressTitle: (subject, sign) => `${subject} entra en ${sign}`,
    ingressDetail: (retrograde, from) => `${retrograde ? 'Retrógrado, desde' : 'Desde'} ${from}`,
    lunationTitle: (type, sign) => `${type === 'new' ? 'Luna nueva' : 'Luna llena'} en ${sign}`,
    stationTitle: (planet, type) => `${planet} estaciona ${type === 'retrograde' ? 'retrógrado' : 'directo'}`,
    aspectDetail: (a, b) => `${a} y ${b}`,
    nextEclipse: (name, date) => `Próximo eclipse: ${name}, ${date}`,
    calendarLink: 'Calendario del cielo completo',
    dayEvent: (event) => {
      if (event.kind === 'station' && event.planet) {
        return `${named('es', event.planet)} ${event.type === 'retrograde' ? 'se vuelve retrógrado' : 'retoma el movimiento directo'}`;
      }
      if (event.kind === 'aspect' && event.a && event.b && event.type) {
        const exact: Record<string, string> = {
          conjunction: 'una conjunción exacta', sextile: 'un sextil exacto', square: 'una cuadratura exacta',
          trine: 'un trígono exacto', opposition: 'una oposición exacta',
        };
        return `${named('es', event.a)} y ${named('es', event.b)} forman ${exact[event.type] ?? aspectLabel('es', event.type)}`;
      }
      if (event.kind === 'ingress' && event.planet && event.sign) return `${named('es', event.planet)} entra en ${signName(event.sign, 'es')}`;
      if (event.kind === 'lunation' && event.sign) return `la ${event.type === 'new' ? 'Luna nueva' : 'Luna llena'} cae en ${signName(event.sign, 'es')}`;
      return null;
    },
    rxTitle: 'Los retrógrados, de un vistazo',
    rxLink: 'Todas las fechas retrógradas',
    rxNone: ['Ningún planeta está retrógrado ', TODAY, '.'],
    rxNow: (list, count) => [`${list} ${count === 1 ? 'está retrógrado' : 'están retrógrados'} `, TODAY, '.'],
    rxNext: (planet, date) => [`${planet} se vuelve retrógrado el ${date}.`],
    rxEnded: (planet, date) => (date ? [`El periodo retrógrado de ${planet} terminó el ${date}.`] : [`El periodo retrógrado de ${planet} terminó `, TODAY, '.']),
    rxTableAria: (range) => `Periodos retrógrados ${range}`,
    rxPlanet: 'Planeta',
    rxPeriod: 'Periodo',
    rxNowPrefix: 'Retrógrado · ',
    rxNowDirect: ', ya directo',
    rxStateNow: 'Retrógrado ahora',
    rxStateUpcoming: 'Por venir',
    rxStateEnded: 'Terminado',
    rxMeansKicker: 'Qué significa retrógrado',
    rxMeans: 'Visto desde la Tierra, a veces un planeta parece frenar, detenerse y retroceder contra el fondo de las estrellas. Su órbita real no cambia. Los astrólogos han leído estos tramos como un tiempo de revisión: los temas del planeta se retoman en lugar de empezarse.',
    aspectsTitle: 'Los aspectos más exactos',
    aspectsLede: (all, shown) => {
      const word = (count: number) => ['ninguno', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'][count] ?? String(count);
      if (all > shown) return `Los aspectos son los ángulos entre los planetas. ${cap(word(all))} están a menos de tres grados del exacto a las 12:00 UTC; estos son los ${word(shown)} más exactos.`;
      return `Los aspectos son los ángulos entre los planetas. ${all === 1 ? 'Este está' : `Estos ${word(all)} están`} a menos de tres grados del exacto a las 12:00 UTC.`;
    },
    definitions: {
      conjunction: 'Un aspecto de 0° que reúne dos partes de la carta en el mismo lugar.',
      sextile: 'Un aspecto de 60° que se lee como una oportunidad para que dos partes de la carta cooperen.',
      square: 'Un aspecto de 90° que se lee como una fricción que pide acción o ajuste.',
      trine: 'Un aspecto de 120° que se lee como una conexión fluida entre dos partes de la carta.',
      opposition: 'Un aspecto de 180° que sitúa dos puntos de la carta uno frente al otro.',
    },
    represent: (a, topicA, b, topicB) => `Por tradición, ${a} representa ${topicA}; ${b}, ${topicB}.`,
    exactAt: (clock) => `Exacto a las ${clock} UTC`,
    fromExact: (orb) => `A ${orb} del exacto`,
    furtherTitle: 'Para ir más lejos',
    furtherLede: 'Más formas de seguir el cielo, fecha a fecha.',
    allTools: 'Todas las herramientas',
    tools: [
      { href: '/transits/', title: 'Tránsitos', promise: 'El cielo de hoy comparado con tu carta.' },
      { href: '/moon-phase/', title: 'Fase lunar', promise: 'La Luna de esta noche o la de cualquier fecha.' },
      { href: '/sky-calendar/', title: 'Calendario del cielo', promise: 'Lunas nuevas y llenas en tu app de calendario.' },
      { href: '/eclipses/', title: 'Eclipses', promise: 'Eclipses solares y lunares hasta 2030.' },
    ],
    askTitle: '¿Preguntas sobre el cielo de hoy?',
    askLead: 'Guide es un asistente de IA para preguntas de astrología y para ayudarte a usar Zodiacs.',
    askLabel: 'Preguntar a Guide',
    prompts: [
      '¿Qué significa el cielo de hoy para mi signo?',
      '¿Qué es un retrógrado?',
      '¿Cómo leo el cielo de hoy en mi carta natal?',
    ],
    methodTitle: 'Cómo se hace esta página',
    methodBody: (date) => `Las posiciones se calculan para las 12:00 UTC de la fecha de la edición, el ${date}. Las horas del calendario están en UTC. Las notas por signo describen temas para reflexionar, no consejos.`,
    coverage: 'Esta edición usa solo las posiciones planetarias; la hora exacta de los eventos no está disponible para esta fecha.',
    provenanceLabel: 'Detrás de esta lectura diaria',
    provenanceDescription: 'Datos del cielo, límites y criterios editoriales',
    provenanceBefore: 'Cada nota está ligada al cielo registrado del ',
    provenanceAfter: ', la fecha de la edición en UTC; las posiciones planetarias usan una instantánea a las 12:00 UTC. Las notas en español salen de los mismos hechos que la edición en inglés, con plantillas escritas en este idioma, y una prueba automática comprueba que cada una responde a la misma casa y al mismo cuerpo que su versión en inglés.',
    methodLink: 'Cómo calculamos',
    publicationLink: 'Cómo se publica cada edición',
    correctionsLink: 'Correcciones',
  },
  pt: {
    title: (date) => `Hoje, o céu de ${date} | Zodiacs.org`,
    description: (date) => `O céu de hoje para os doze signos solares: até quatro notas por signo, calculadas a partir das posições reais de ${date}.`,
    crumbsAria: 'Trilha de navegação',
    home: 'Início',
    todayWord: 'hoje',
    TodayWord: 'Hoje',
    onDate: (date) => `em ${date}`,
    h1: 'O céu de hoje',
    lede: 'Onde está cada planeta, o que cada posição tradicionalmente representa e o que vem a seguir no calendário.',
    cta: 'Compare com o seu mapa',
    yourSign: 'Seu signo',
    reassure: 'Grátis · Sem cadastro · Posições às 12h UTC',
    wheelAria: (date) => `O céu às 12h UTC de ${date}: o Sol, a Lua e os planetas nos seus signos, com os aspectos a menos de três graus do exato`,
    legendRx: 'Retrógrado',
    legendEasy: 'Trígono ou sextil',
    legendTense: 'Quadratura ou oposição',
    legendJoined: 'Conjunção',
    lightsKicker: 'Onde o dia começa',
    lightsTitle: 'O Sol e a Lua',
    lightsLede: 'Os dois luminares com que a astrologia começa: onde estão e o que os seus signos tradicionalmente representam.',
    moonLink: 'A Lua desta noite, em detalhe',
    sunTag: (degree) => `Sol · ${degree}`,
    moonTag: (degree, percent) => `Lua · ${degree} · ${percent}% iluminada`,
    sunIn: (sign) => `Sol em ${sign}`,
    moonIn: (sign) => `Lua em ${sign}`,
    sunNote: (third, ingress) => `O Sol está ${['no primeiro terço', 'no terço central', 'no último terço'][third]} do signo${ingress ? ` e entra em ${ingress.sign} em ${ingress.date}` : ''}.`,
    moonNote: (age, single, lastDegree) => `${single ? 'Passou' : 'Passaram-se'} ${age} ${single ? 'dia' : 'dias'} desde a Lua nova${lastDegree ? ', e a Lua está no último grau do signo' : ''}.`,
    moonAge: (age, single) => `Idade: ${age} ${single ? 'dia' : 'dias'}`,
    cycleAria: 'Este ciclo lunar',
    signsKicker: 'Seu signo',
    signsLede: 'Escolha o seu signo solar. Cada nota vem das posições registradas do céu de hoje, lidas a partir das casas solares do seu signo; os registros sob cada leitura dizem exatamente o que a produziu. São temas para observar, não instruções.',
    allHoroscopes: 'Todos os horóscopos',
    signsAria: 'Signos',
    horoscopeLink: (sign) => `Horóscopo de ${sign} de hoje`,
    guideLink: (sign) => `Guia de ${sign}`,
    personalTitle: 'Seu mapa, diante do céu de hoje',
    personalBody: 'Com a sua data, hora e local de nascimento, o seu mapa astral é calculado aqui, no seu navegador. A comparação privada de um mapa salvo com cada edição está, por enquanto, na edição em inglês.',
    personalCompare: 'Ver a comparação privada',
    planetsTitle: 'Onde estão os planetas',
    planetsSub: (date) => `12h UTC, ${date}.`,
    planetsSubMore: ' Cada corpo com o que tradicionalmente representa.',
    topics: {
      Sun: 'identidade e direção',
      Moon: 'necessidades emocionais e instintos',
      Mercury: 'pensamento e comunicação',
      Venus: 'afeto, prazer e valores',
      Mars: 'impulso e autoafirmação',
      Jupiter: 'crescimento e crenças',
      Saturn: 'responsabilidade e crescimento a longo prazo',
      Uranus: 'independência e mudança',
      Neptune: 'imaginação e ideais',
      Pluto: 'poder e mudança profunda',
    },
    direct: 'Direto',
    retrograde: 'Retrógrado',
    station: (type, clock) => `${type === 'retrograde' ? 'Retrógrado' : 'Direto'} a partir das ${clock} UTC`,
    comingTitle: 'O que vem no céu',
    comingSub: 'Datas em UTC, então algumas caem um dia antes nas Américas.',
    eclipseTitle: (type, kind, sign) => `Eclipse ${type} ${kind} em ${sign}`,
    eclipseShort: (type, kind) => `${type} ${kind}`,
    eclipseType: { solar: 'solar', lunar: 'lunar' },
    eclipseKind: { total: 'total', partial: 'parcial', annular: 'anular', penumbral: 'penumbral', hybrid: 'híbrido' },
    ingressTitle: (subject, sign) => `${subject} entra em ${sign}`,
    ingressDetail: (retrograde, from) => `${retrograde ? 'Retrógrado, vindo de' : 'Vindo de'} ${from}`,
    lunationTitle: (type, sign) => `${type === 'new' ? 'Lua nova' : 'Lua cheia'} em ${sign}`,
    stationTitle: (planet, type) => `${planet} estaciona ${type === 'retrograde' ? 'retrógrado' : 'direto'}`,
    aspectDetail: (a, b) => `${a} e ${b}`,
    nextEclipse: (name, date) => `Próximo eclipse: ${name}, ${date}`,
    calendarLink: 'Calendário do céu completo',
    dayEvent: (event) => {
      if (event.kind === 'station' && event.planet) {
        return `${named('pt', event.planet)} ${event.type === 'retrograde' ? 'fica retrógrado' : 'volta ao movimento direto'}`;
      }
      if (event.kind === 'aspect' && event.a && event.b && event.type) {
        const exact: Record<string, string> = {
          conjunction: 'uma conjunção exata', sextile: 'um sextil exato', square: 'uma quadratura exata',
          trine: 'um trígono exato', opposition: 'uma oposição exata',
        };
        return `${named('pt', event.a)} e ${named('pt', event.b)} formam ${exact[event.type] ?? aspectLabel('pt', event.type)}`;
      }
      if (event.kind === 'ingress' && event.planet && event.sign) return `${named('pt', event.planet)} entra em ${signName(event.sign, 'pt')}`;
      if (event.kind === 'lunation' && event.sign) return `a ${event.type === 'new' ? 'Lua nova' : 'Lua cheia'} acontece em ${signName(event.sign, 'pt')}`;
      return null;
    },
    rxTitle: 'Os retrógrados, num relance',
    rxLink: 'Todas as datas retrógradas',
    rxNone: ['Nenhum planeta está retrógrado ', TODAY, '.'],
    rxNow: (list, count) => [`${list} ${count === 1 ? 'está retrógrado' : 'estão retrógrados'} `, TODAY, '.'],
    rxNext: (planet, date) => [`${planet} fica retrógrado em ${date}.`],
    rxEnded: (planet, date) => (date ? [`O período retrógrado de ${planet} terminou em ${date}.`] : [`O período retrógrado de ${planet} terminou `, TODAY, '.']),
    rxTableAria: (range) => `Períodos retrógrados ${range}`,
    rxPlanet: 'Planeta',
    rxPeriod: 'Período',
    rxNowPrefix: 'Retrógrado · ',
    rxNowDirect: ', já direto',
    rxStateNow: 'Retrógrado agora',
    rxStateUpcoming: 'Por vir',
    rxStateEnded: 'Encerrado',
    rxMeansKicker: 'O que significa retrógrado',
    rxMeans: 'Visto da Terra, um planeta às vezes parece desacelerar, parar e recuar contra o fundo das estrelas. Nada muda na sua órbita real. Os astrólogos leem esses períodos há muito tempo como um tempo de revisão: os temas do planeta são retomados, em vez de começados.',
    aspectsTitle: 'Os aspectos mais exatos',
    aspectsLede: (all, shown) => {
      const word = (count: number) => ['nenhum', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'][count] ?? String(count);
      if (all > shown) return `Os aspectos são os ângulos entre os planetas. ${cap(word(all))} estão a menos de três graus do exato às 12h UTC; estes são os ${word(shown)} mais exatos.`;
      return `Os aspectos são os ângulos entre os planetas. ${all === 1 ? 'Este está' : `Estes ${word(all)} estão`} a menos de três graus do exato às 12h UTC.`;
    },
    definitions: {
      conjunction: 'Um aspecto de 0° que reúne duas partes do mapa no mesmo lugar.',
      sextile: 'Um aspecto de 60° lido como uma oportunidade de cooperação entre duas partes do mapa.',
      square: 'Um aspecto de 90° lido como um atrito que pede ação ou ajuste.',
      trine: 'Um aspecto de 120° lido como uma conexão fluida entre duas partes do mapa.',
      opposition: 'Um aspecto de 180° que coloca dois pontos do mapa um diante do outro.',
    },
    represent: (a, topicA, b, topicB) => `Por tradição, ${a} representa ${topicA}; ${b}, ${topicB}.`,
    exactAt: (clock) => `Exato às ${clock} UTC`,
    fromExact: (orb) => `A ${orb} do exato`,
    furtherTitle: 'Para ir além',
    furtherLede: 'Mais formas de acompanhar o céu, data a data.',
    allTools: 'Todas as ferramentas',
    tools: [
      { href: '/transits/', title: 'Trânsitos', promise: 'O céu de hoje comparado com seu mapa.' },
      { href: '/moon-phase/', title: 'Fase da Lua', promise: 'A Lua desta noite ou a de qualquer data.' },
      { href: '/sky-calendar/', title: 'Calendário do céu', promise: 'Luas novas e cheias no seu app de calendário.' },
      { href: '/eclipses/', title: 'Eclipses', promise: 'Eclipses solares e lunares até 2030.' },
    ],
    askTitle: 'Dúvidas sobre o céu de hoje?',
    askLead: 'O Guide é um assistente de IA para perguntas de astrologia e para ajudar você a usar o Zodiacs.',
    askLabel: 'Perguntar ao Guide',
    prompts: [
      'O que o céu de hoje significa para o meu signo?',
      'O que é um retrógrado?',
      'Como leio o céu de hoje no meu mapa astral?',
    ],
    methodTitle: 'Como esta página é feita',
    methodBody: (date) => `As posições são calculadas para as 12h UTC da data da edição, ${date}. Os horários do calendário estão em UTC. As notas por signo descrevem temas para reflexão, não conselhos.`,
    coverage: 'Esta edição usa apenas as posições planetárias; o horário exato dos eventos não está disponível para esta data.',
    provenanceLabel: 'Por trás desta leitura diária',
    provenanceDescription: 'Dados do céu, limites e critérios editoriais',
    provenanceBefore: 'Cada nota está ligada ao céu registrado de ',
    provenanceAfter: ', a data da edição em UTC; as posições planetárias usam um instantâneo das 12h UTC. As notas em português saem dos mesmos fatos da edição em inglês, com modelos escritos neste idioma, e um teste automático confere que cada uma corresponde à mesma casa e ao mesmo corpo da versão em inglês.',
    methodLink: 'Como calculamos',
    publicationLink: 'Como cada edição é publicada',
    correctionsLink: 'Correções',
  },
};
