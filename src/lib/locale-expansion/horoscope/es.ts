/**
 * Horóscopos por periodo en español: mañana, semana, mes, amor, trabajo y año.
 * Escrito en español a partir de los hechos (./types.ts), no traducido del
 * inglés. Registro: tuteo, frases llanas, sin dramatismo; ninguna promesa
 * sobre salud, dinero o destino. Sin rayas ni guiones largos.
 */
import { signBySlug, signName } from '../../signs';
import { aspectLabel, planetLabel } from '../../i18n/astrology';
import { cap, dayMonth, dayMonthYear, monthName, monthYear, pick, utcClock, weekday } from './format';
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

const L = 'es' as const;
const SIGN_ORDER = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const idx = (slug: string) => SIGN_ORDER.indexOf(slug);

const sign = (slug: string) => signName(signBySlug(slug), L);
const planet = (body: string) => planetLabel(L, body);
/** El Sol y la Luna llevan artículo; los planetas, no. */
const subject = (body: string) => (body === 'Sun' ? 'el Sol' : body === 'Moon' ? 'la Luna' : planet(body));
const date = (at: string) => dayMonth(L, at);
/** "del 2 al 8 de noviembre", o "del 30 de noviembre al 6 de diciembre". */
const range = (from: string, through: string) => (from.slice(0, 7) === through.slice(0, 7)
  ? `del ${Number(from.slice(8, 10))} al ${date(through)}`
  : `del ${date(from)} al ${date(through)}`);
/** Contracciones obligatorias: "a el" y "de el" no existen en español escrito. */
const tidy = (text: string) => text.replace(/\ba el\b/g, 'al').replace(/\bde el\b/g, 'del').replace(/\s+/g, ' ').trim();

const ORDINAL = ['', 'primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta', 'séptima', 'octava', 'novena', 'décima', 'undécima', 'duodécima'];

/** Lo que cada casa solar pone sobre la mesa, con artículo. */
export const THEME: Record<number, string> = {
  1: 'tu imagen, tus comienzos y la impresión que causas',
  2: 'el dinero, lo que posees y lo que te da estabilidad',
  3: 'los mensajes, las gestiones y tu entorno cercano',
  4: 'el hogar, la familia y tu vida privada',
  5: 'el placer, el romance y lo que creas por gusto',
  6: 'el trabajo diario, los hábitos y tus rutinas',
  7: 'la pareja y los acuerdos de igual a igual',
  8: 'el dinero compartido, las deudas y la confianza íntima',
  9: 'los viajes, el estudio y tus creencias',
  10: 'la carrera, la reputación y lo que se ve de ti en público',
  11: 'las amistades, los grupos y los planes de futuro',
  12: 'el descanso, el retiro y lo que se mueve por dentro',
};

/** Títulos cortos para los encabezados del año. */
const SHORT: Record<number, string> = {
  1: 'Imagen y comienzos',
  2: 'Dinero y prioridades',
  3: 'Mensajes y entorno',
  4: 'Hogar y familia',
  5: 'Placer y creatividad',
  6: 'Rutinas y trabajo diario',
  7: 'Pareja y acuerdos',
  8: 'Lo compartido y la intimidad',
  9: 'Estudio y horizontes',
  10: 'Carrera y reputación',
  11: 'Amistades y proyectos',
  12: 'Descanso y retiro',
};

/** Un primer paso concreto por casa. */
const ADVICE: Record<number, string> = {
  1: 'Di qué quieres empezar antes de reaccionar a lo que proponen los demás.',
  2: 'Pon números a lo que cuesta, a lo que tienes y a lo que esperas recibir.',
  3: 'Contesta el mensaje pendiente y deja por escrito lo que se acordó.',
  4: 'Mira qué necesitas en casa y resérvale tiempo antes de aceptar otro plan.',
  5: 'Dedica un rato a algo que hagas solo por gusto, sin pensar en el resultado.',
  6: 'Ordena la lista del día y quita una tarea que no te corresponde.',
  7: 'Habla claro con la otra persona y pregunta en lugar de suponer.',
  8: 'Separa lo que es tuyo, lo que es compartido y lo que se debe.',
  9: 'Lee, pregunta o planea un viaje: algo que te saque de la rutina mental.',
  10: 'Termina lo que otros van a ver y deja claro quién lo hizo.',
  11: 'Escribe a esa amistad o a ese grupo y concreta una fecha.',
  12: 'Guarda una hora sin pantallas y deja que el día baje de ritmo.',
};

/** Una segunda mirada a la misma casa, para no repetir el consejo. */
const REFINE: Record<number, string> = {
  1: 'Un cambio pequeño en cómo te presentas dice más que un gran anuncio.',
  2: 'Antes de gastar, comprueba si la compra sigue teniendo sentido dentro de una semana.',
  3: 'Relee lo que envías: una palabra mal puesta puede costar una tarde.',
  4: 'Arregla una cosa concreta de la casa en vez de planear una reforma entera.',
  5: 'Deja que el juego sea juego; no todo tiene que convertirse en proyecto.',
  6: 'Revisa un hábito que se ha vuelto automático y decide si lo quieres conservar.',
  7: 'Un acuerdo justo se nota en que los dos saben qué toca a cada uno.',
  8: 'Una conversación incómoda sobre dinero o confianza ahorra muchas sospechas.',
  9: 'Una idea nueva vale más cuando la pruebas en algo práctico.',
  10: 'Elige una meta visible y mide el avance con hechos, no con impresiones.',
  11: 'Mira qué grupos te suman de verdad y cuáles sigues por costumbre.',
  12: 'Dormir bien y cerrar temas pendientes también cuenta como avanzar.',
};

/** El ángulo afectivo de cada casa. */
const LOVE: Record<number, string> = {
  1: 'Muéstrate como eres; lo que atrae ahora es la naturalidad.',
  2: 'El cariño se nota en lo tangible: un detalle, una ayuda, tiempo dedicado.',
  3: 'Una conversación sencilla vale más que cualquier gesto grande.',
  4: 'La calma en casa es la base: cuida el espacio que compartís.',
  5: 'Hay ganas de disfrutar; propón un plan que os haga reír.',
  6: 'El amor también está en lo cotidiano: repartir tareas sin llevar la cuenta.',
  7: 'La pareja pide trato de igual a igual; escucha antes de responder.',
  8: 'La confianza crece cuando hablas de lo que de verdad te importa.',
  9: 'Abre la relación a algo nuevo: un lugar, una idea, un tema distinto.',
  10: 'Cuida que el trabajo no ocupe todo el espacio que le toca a la otra persona.',
  11: 'La amistad es parte del amor ahora; los planes en grupo ayudan.',
  12: 'Hay cosas que se dicen mejor en privado y sin prisa.',
};

/** El ángulo laboral de cada casa. */
const WORK: Record<number, string> = {
  1: 'Toma la iniciativa en una tarea que lleve tu nombre.',
  2: 'Revisa ingresos, tarifas o presupuestos con números concretos.',
  3: 'Los correos, las llamadas y los trámites piden orden y respuesta rápida.',
  4: 'Organiza el lugar desde donde trabajas para que no te robe energía.',
  5: 'Un proyecto creativo o una propuesta propia merece tu mejor hora.',
  6: 'Ordena procesos y plazos; la constancia rinde más que el esfuerzo puntual.',
  7: 'Negocia con claridad: socios, clientes y acuerdos firmados.',
  8: 'Mira deudas, recursos compartidos y lo que depende de otros.',
  9: 'Formarte, publicar o llegar a un público nuevo da resultado a largo plazo.',
  10: 'Tu reputación se juega en lo que entregas; termina lo que tiene más visibilidad.',
  11: 'Los contactos y el trabajo en equipo abren puertas.',
  12: 'Trabaja en lo que todavía no se ve y no pidas aplausos antes de tiempo.',
};

/** Cómo funciona mejor cada signo, en una frase. */
const KEY: Record<string, string> = {
  aries: 'A Aries le va mejor un primer paso limpio que una carrera desordenada.',
  taurus: 'A Tauro le conviene avanzar a su ritmo y no ceder lo que de verdad le da seguridad.',
  gemini: 'Para Géminis, la claridad está en elegir una conversación y llevarla hasta el final.',
  cancer: 'Para Cáncer, cuidar no significa cargar con todo: también cuenta lo que necesitas tú.',
  leo: 'Para Leo, la presencia pesa más cuando el fondo está claro antes que el espectáculo.',
  virgo: 'A Virgo le basta con mejorar una cosa bien hecha, no con corregirlo todo.',
  libra: 'Para Libra, el equilibrio llega cuando dices lo que prefieres en lugar de adivinar lo que quieren los demás.',
  scorpio: 'Para Escorpio, la fuerza está en saber qué conservar y qué soltar sin dramatismo.',
  sagittarius: 'A Sagitario le sirve más una dirección clara que diez posibilidades abiertas.',
  capricorn: 'Para Capricornio, el progreso se mide en pasos que se puedan mantener.',
  aquarius: 'Para Acuario, una idea vale cuando encuentra un lugar concreto donde aplicarse.',
  pisces: 'Para Piscis, poner límites claros protege la sensibilidad en vez de apagarla.',
};

/** El hilo de cada signo para el año. */
const YEAR: Record<string, string> = {
  aries: 'Este año premia la iniciativa que se sostiene: empezar es fácil para ti, lo valioso es terminar.',
  taurus: 'Este año te pide revisar qué te da seguridad de verdad y soltar lo que solo es costumbre.',
  gemini: 'Este año gira en torno a elegir: menos frentes abiertos y más conversaciones que lleguen a algo.',
  cancer: 'Este año trata de cuidar sin desgastarte y de que tu casa sea refugio, no obligación.',
  leo: 'Este año separa el ser visto del ser conocido, y valora lo que tendría sentido aunque nadie aplaudiera.',
  virgo: 'Este año pide orden sin perfeccionismo: mejorar lo que importa y dejar pasar lo demás.',
  libra: 'Este año pone a prueba tus acuerdos: cuáles son justos y cuáles mantienes por evitar un conflicto.',
  scorpio: 'Este año habla de confianza: en quién la pones, qué compartes y qué decides guardar.',
  sagittarius: 'Este año te invita a convertir la curiosidad en un plan con fechas.',
  capricorn: 'Este año confirma lo que has construido y señala qué estructura ya no te hace falta.',
  aquarius: 'Este año une tus ideas con la gente adecuada: los proyectos crecen en compañía.',
  pisces: 'Este año te ayuda a dar forma a lo que intuyes, con límites que te protejan.',
};

const KIND_LOVE: Record<string, string> = {
  aries: 'En el amor, Aries necesita franqueza y espacio para moverse.',
  taurus: 'En el amor, Tauro valora la constancia por encima de las promesas.',
  gemini: 'En el amor, Géminis necesita conversación y sorpresa a partes iguales.',
  cancer: 'En el amor, Cáncer se abre cuando se siente en un lugar seguro.',
  leo: 'En el amor, Leo brilla cuando la admiración va en las dos direcciones.',
  virgo: 'En el amor, Virgo demuestra el cariño con hechos pequeños y precisos.',
  libra: 'En el amor, Libra busca reciprocidad, no solo armonía.',
  scorpio: 'En el amor, Escorpio necesita verdad antes que intensidad.',
  sagittarius: 'En el amor, Sagitario quiere compartir camino sin perder libertad.',
  capricorn: 'En el amor, Capricornio confía en lo que se demuestra con el tiempo.',
  aquarius: 'En el amor, Acuario necesita amistad dentro de la pareja.',
  pisces: 'En el amor, Piscis da mucho; conviene que también reciba.',
};

const KIND_WORK: Record<string, string> = {
  aries: 'En el trabajo, Aries rinde cuando puede abrir camino.',
  taurus: 'En el trabajo, Tauro rinde con plazos realistas y recursos claros.',
  gemini: 'En el trabajo, Géminis rinde cuando puede explicar y conectar.',
  cancer: 'En el trabajo, Cáncer rinde cuando el equipo se siente cuidado.',
  leo: 'En el trabajo, la visibilidad ayuda a Leo cuando lo que hay debajo está listo.',
  virgo: 'En el trabajo, Virgo rinde cuando puede mejorar un proceso concreto.',
  libra: 'En el trabajo, Libra rinde negociando y equilibrando intereses.',
  scorpio: 'En el trabajo, Escorpio rinde investigando a fondo.',
  sagittarius: 'En el trabajo, Sagitario rinde cuando ve hacia dónde va el proyecto.',
  capricorn: 'En el trabajo, Capricornio rinde con objetivos medibles.',
  aquarius: 'En el trabajo, Acuario rinde proponiendo otra forma de hacer las cosas.',
  pisces: 'En el trabajo, Piscis rinde cuando la tarea tiene un sentido claro.',
};

const ASPECT_MEANING: Record<string, string> = {
  conjunction: 'Las dos áreas se juntan: lo que hagas en una se nota en la otra.',
  sextile: 'Es una oportunidad tranquila; aprovéchala con un paso pequeño y concreto.',
  square: 'Hay fricción entre las dos áreas; ajusta una antes de forzar la otra.',
  trine: 'Las cosas fluyen entre las dos áreas; buen momento para avanzar sin forzar.',
  opposition: 'Las dos áreas tiran en sentidos contrarios; busca el punto medio.',
};

function houseIn(house: number): string {
  return `tu ${ORDINAL[house]} casa`;
}

/** "la Luna está en Escorpio, en tu cuarta casa" */
function positionClause(fact: PositionFact): string {
  const rx = fact.retrograde ? ' retrógrado' : '';
  return `${subject(fact.body)}${rx} está en ${sign(fact.sign)}, en ${houseIn(fact.house)}`;
}

/** Frase sobre un evento, sin la fecha. */
function eventClause(fact: EventFact): string {
  const where = fact.sign ? sign(fact.sign) : '';
  switch (fact.eventKind) {
    case 'ingress':
      return `${subject(fact.body!)} entra en ${where}`;
    case 'station':
      return fact.eventType === 'retrograde'
        ? `${subject(fact.body!)} se detiene y empieza a retroceder en ${where}`
        : `${subject(fact.body!)} retoma su marcha directa en ${where}`;
    case 'lunation':
      return fact.eventType === 'full' ? `llega la Luna llena en ${where}` : `llega la Luna nueva en ${where}`;
    case 'eclipse':
      return fact.eventType === 'solar' ? `hay un eclipse de Sol en ${where}` : `hay un eclipse de Luna en ${where}`;
    case 'aspect': {
      const a = subject(fact.a!);
      const b = subject(fact.b!);
      const type = fact.eventType ?? 'conjunction';
      if (type === 'conjunction') return `${a} se une a ${b}`;
      if (type === 'opposition') return `${a} se opone a ${b}`;
      const article = type === 'square' ? 'una' : 'un';
      return `${a} forma ${article} ${aspectLabel(L, type)} con ${b}`;
    }
  }
}

/** Lo que significa el evento en la casa en la que cae; la variante depende del día, así el texto no se repite. */
function eventMeaning(fact: EventFact): string {
  const h = fact.houses[0];
  if (!h) return '';
  const theme = THEME[h];
  const day = Number(fact.at.slice(8, 10)) + Number(fact.at.slice(5, 7));
  switch (fact.eventKind) {
    case 'ingress':
      // The Sun and the fast planets stay weeks, not years: no "long stage" for them.
      if (['Sun', 'Mercury', 'Venus', 'Mars'].includes(fact.body ?? '')) {
        return `Durante las próximas semanas, el foco está en ${theme}.`;
      }
      return pick([
        `Se abre una etapa larga para ${theme}.`,
        `Empieza un capítulo nuevo para ${theme}.`,
        `A partir de ahí, ${theme} pide otra forma de hacer las cosas.`,
      ], day);
    case 'station':
      return fact.eventType === 'retrograde'
        ? pick([
          `Toca revisar ${theme} antes de comprometerte con nada nuevo.`,
          `Es tiempo de repasar ${theme} sin prisa.`,
          `Conviene volver sobre ${theme} y corregir lo que haga falta.`,
        ], day)
        : pick([
          `Lo que estaba en pausa en ${theme} vuelve a moverse.`,
          `${cap(theme)} recupera el impulso.`,
          `Las decisiones aplazadas sobre ${theme} pueden avanzar de nuevo.`,
        ], day);
    case 'lunation':
      return fact.eventType === 'full'
        ? `Algo que venía madurando en ${theme} llega a su punto.`
        : `Es un buen comienzo para ${theme}.`;
    case 'eclipse':
      return `Marca un giro en ${theme}; conviene no forzar decisiones ese mismo día.`;
    case 'aspect': {
      const [h1, h2] = fact.houses;
      return h2 && h2 !== h1
        ? `Conecta ${THEME[h1]} con ${THEME[h2]}. ${ASPECT_MEANING[fact.eventType ?? 'conjunction']}`
        : `${ASPECT_MEANING[fact.eventType ?? 'conjunction']}`;
    }
  }
}

function factSentence(fact: Fact, when: 'today' | 'tomorrow' | 'dated'): string {
  if (fact.kind === 'position') {
    const lead = when === 'tomorrow' ? 'Mañana ' : '';
    return `${cap(`${lead}${positionClause(fact)}`)}.`;
  }
  const at = `El ${date(fact.at)}${fact.eventKind === 'lunation' || fact.eventKind === 'eclipse' || fact.eventKind === 'aspect' ? `, a las ${utcClock(fact.at)},` : ','}`;
  return `${at} ${eventClause(fact)}. ${eventMeaning(fact)}`.trim();
}

/** First mention of a house gets its first step, the second its refinement, and later ones nothing more. */
function adviser() {
  const seen = new Map<number, number>();
  return (house: number) => {
    const count = seen.get(house) ?? 0;
    seen.set(house, count + 1);
    return count === 0 ? ADVICE[house] : count === 1 ? REFINE[house] : '';
  };
}

const firstHouse = (facts: Fact[]) => facts.find((fact) => fact.kind === 'position')?.house
  ?? (facts.find((fact) => fact.kind === 'event') as EventFact | undefined)?.houses[0] ?? 1;

// ── Superficies ──

function tomorrow(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  const advise = adviser();
  return ctx.passages.map(({ facts, index }) => {
    const h = firstHouse(facts);
    const advice = advise(h);
    const sentences = facts.map((fact) => factSentence(fact, fact.kind === 'position' ? 'tomorrow' : 'dated'));
    if (index === 0) {
      return { text: `${sentences.join(' ')} Eso pone en primer plano ${THEME[h]}. ${advice} ${KEY[s]}` };
    }
    if (index === ctx.passages.length - 1) {
      return { text: `${sentences.join(' ')} ${advice} ${pick(CLOSE_TOMORROW, idx(s))}` };
    }
    return { text: `${sentences.join(' ')} ${advice}` };
  });
}

const CLOSE_TOMORROW = [
  'Deja preparado esta noche el primer paso, y el día empezará más ligero.',
  'Anota hoy lo que no quieres olvidar mañana.',
  'Si algo puede esperar a pasado mañana, déjalo esperar.',
  'Empieza por lo que depende solo de ti.',
];

function weekly(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  const advise = adviser();
  const last = ctx.passages.length - 1;
  return ctx.passages.map(({ facts, index }) => {
    const moons = facts.filter((fact): fact is PositionFact => fact.kind === 'position');
    if (index === 0 && moons.length >= 2) {
      const [start, ...rest] = moons;
      const end = rest.at(-1)!;
      const mid = rest.length > 1 ? rest[0] : undefined;
      const midText = mid ? `, hacia el ${weekday(L, mid.at)} pasa a ${THEME[mid.house]}` : '';
      return {
        text: `La semana ${range(ctx.from, ctx.through)} empieza con la Luna en ${sign(start.sign)}, en ${THEME[start.house]}${midText} y termina en ${THEME[end.house]}. ${KEY[s]}`,
      };
    }
    const h = firstHouse(facts);
    const advice = advise(h);
    const event = facts.find((fact): fact is EventFact => fact.kind === 'event');
    if (event) return { text: factSentence(event, 'dated') };
    if (index === 1) return { text: `Los primeros días piden atención a ${THEME[h]}. ${advice}` };
    if (index === last) return { text: `La semana cierra con ${THEME[h]}. ${advice} ${pick(CLOSE_WEEK, idx(s))}` };
    return { text: `A mitad de semana, el foco pasa a ${THEME[h]}. ${advice}` };
  });
}

const CLOSE_WEEK = [
  'Para el repaso del domingo, quédate con una cosa que funcionó y otra que cambiarías.',
  'Antes de que empiece la siguiente semana, decide qué no vas a repetir.',
  'Cierra la semana con algo terminado, aunque sea pequeño.',
];

function love(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  return ctx.passages.map(({ facts, index }) => {
    const h = firstHouse(facts);
    const sentences = facts.map((fact) => factSentence(fact, 'dated')).join(' ');
    if (index === 0) return { text: `${sentences} ${LOVE[h]} ${KIND_LOVE[s]}` };
    return { text: `${sentences} El clima emocional se mueve hacia ${THEME[h]}. ${pick(LOVE_CLOSE, idx(s), h)}` };
  });
}

const LOVE_CLOSE = [
  'Una pregunta sincera aclara más que una suposición.',
  'Fíjate en si la respuesta de la otra persona hace el espacio compartido más fácil.',
  'No hace falta resolverlo todo hoy; basta con no esconderlo.',
  'Di lo que necesitas con una frase sencilla.',
];

function career(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  return ctx.passages.map(({ facts, index }) => {
    const h = firstHouse(facts);
    const sentences = facts.map((fact) => factSentence(fact, 'dated')).join(' ');
    if (index === 0) return { text: `${sentences} ${WORK[h]} ${KIND_WORK[s]}` };
    return { text: `${sentences} El trabajo también mira hacia ${THEME[h]}. ${REFINE[h]}` };
  });
}

// ── El año ──

const QUARTERS: Array<[number, number]> = [[1, 3], [4, 6], [7, 9], [10, 12]];

function dominantHouse(facts: Fact[]): number {
  const counts = new Map<number, number>();
  for (const fact of facts) {
    const houses = fact.kind === 'position' ? [fact.house] : fact.houses;
    for (const house of houses) counts.set(house, (counts.get(house) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]?.[0] ?? 1;
}

function datedList(facts: Fact[]): string {
  return facts
    .filter((fact): fact is EventFact => fact.kind === 'event')
    .map((fact) => `El ${date(fact.at)}, ${eventClause(fact)}. ${eventMeaning(fact)}`)
    .join(' ');
}

const THEMED_HEADINGS = [
  'Amor, amistad y acuerdos claros',
  'Trabajo, dinero y autoridad que se sostiene',
  'Hogar, descanso y la carga privada',
  'Tu propio rumbo',
];

const THEMED_LEADS = [
  'En los afectos, cuenta lo que se puede ver: una petición, un acuerdo cambiado, un tiempo protegido.',
  'En el trabajo y el dinero, mide la capacidad, los plazos y lo que entregas, no solo las ganas.',
  'En casa y en el descanso, protege lo básico: sueño, espacio y tiempo sin obligaciones.',
  'En lo personal, el crecimiento sirve cuando cambia una decisión concreta.',
];

function yearly(ctx: PeriodContext, year: string): LocalizedPassage[] {
  const s = ctx.sign;
  const name = sign(s);
  return ctx.passages.map(({ facts, index }) => {
    const events = facts.filter((fact): fact is EventFact => fact.kind === 'event');
    if (index === 0) {
      const first = events[0];
      const firstText = first ? ` La primera fecha que conviene marcar es el ${date(first.at)}: ${eventClause(first)}. ${eventMeaning(first)}` : '';
      return { heading: `El ${year} de ${name}`, text: `${YEAR[s]}${firstText}` };
    }
    if (index >= 1 && index <= 4) {
      const [from, to] = QUARTERS[index - 1];
      const h = dominantHouse(facts);
      const lead = pick([
        `Este trimestre gira en torno a ${THEME[h]}.`,
        `El foco de estos meses está en ${THEME[h]}.`,
        `Aquí el peso cae sobre ${THEME[h]}.`,
      ], index, idx(s));
      return {
        heading: `De ${monthName(L, from)} a ${monthName(L, to)}: ${SHORT[h].toLowerCase()}`,
        text: `${lead} ${datedList(facts)} ${REFINE[h]}`.trim(),
      };
    }
    if (index >= 5 && index <= 8) {
      const k = index - 5;
      const extra = k === 0 ? KIND_LOVE[s] : k === 1 ? KIND_WORK[s] : k === 3 ? KEY[s] : '';
      return { heading: THEMED_HEADINGS[k], text: `${THEMED_LEADS[k]} ${extra} ${datedList(facts)}`.replace(/\s+/g, ' ').trim() };
    }
    const dates = events.map((fact) => `el ${date(fact.at)} (${eventClause(fact)})`);
    const joined = dates.length > 1 ? `${dates.slice(0, -1).join(', ')} y ${dates.at(-1)}` : dates.join('');
    return {
      heading: 'Tres fechas para repasar el año',
      text: `Apunta tres fechas para revisar cómo va el año: ${joined}. En cada una, anota qué cambió y qué quieres mantener.`,
    };
  });
}

function period(ctx: PeriodContext): LocalizedPassage[] {
  return periodRaw(ctx).map((passage) => ({ ...passage, text: tidy(passage.text) }));
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

// ── El mes ──

function monthly(ctx: MonthlyContext): LocalizedPassage[] {
  return monthlyRaw(ctx).map((passage) => ({ ...passage, text: tidy(passage.text) }));
}

function monthlyRaw(ctx: MonthlyContext): LocalizedPassage[] {
  const s = ctx.sign;
  const label = monthYear(L, ctx.month);
  const lunations = ctx.events.filter((fact) => fact.eventKind === 'lunation' || fact.eventKind === 'eclipse');
  const stations = ctx.events.filter((fact) => fact.eventKind === 'station');
  const ingresses = ctx.events.filter((fact) => fact.eventKind === 'ingress');
  const aspects = ctx.events.filter((fact) => fact.eventKind === 'aspect').slice(0, 4);
  const lead = lunations[0];
  const passages: LocalizedPassage[] = [{
    text: `${cap(label)} para ${sign(s)}, leyendo tu signo solar como primera casa, como hacen los horóscopos mensuales. ${lead ? `El mes gira en torno a ${THEME[lead.houses[0]]}.` : ''} ${KEY[s]}`.replace(/\s+/g, ' ').trim(),
  }];
  if (lunations.length) passages.push({ heading: 'Lunas del mes', text: lunations.map((fact) => factSentence(fact, 'dated')).join(' ') });
  if (stations.length) passages.push({ heading: 'Planetas que cambian de marcha', text: stations.map((fact) => factSentence(fact, 'dated')).join(' ') });
  if (ingresses.length) passages.push({ heading: 'Cambios de signo', text: ingresses.map((fact) => factSentence(fact, 'dated')).join(' ') });
  if (aspects.length) passages.push({ heading: 'Contactos exactos', text: aspects.map((fact) => factSentence(fact, 'dated')).join(' ') });
  const close = lead ? ADVICE[lead.houses[0]] : REFINE[1];
  passages.push({ heading: 'Para cerrar el mes', text: `${close} ${pick(CLOSE_WEEK, idx(s))}` });
  return passages;
}

// ── Página ──

type ChromeCtx = { surface: PeriodSurface | 'monthly'; from: string; through: string; month?: string };

/** "para mañana, 9 de noviembre", "de la semana del 2 al 8 de noviembre": what follows "El horóscopo de Leo". */
function periodPhrase(ctx: ChromeCtx): string {
  switch (ctx.surface) {
    case 'tomorrow': return `para mañana, ${date(ctx.from)}`;
    case 'weekly': return `de la semana ${range(ctx.from, ctx.through)}`;
    case 'monthly': return `de ${monthYear(L, ctx.month!)}`;
    case 'love': return `del amor para el ${date(ctx.from)}`;
    case 'career': return `del trabajo para el ${date(ctx.from)}`;
    case 'yearly-2026': return 'para 2026';
    case 'yearly-2027': return 'para 2027';
  }
}

export const es: HoroscopeLocaleModule = {
  locale: L,
  period,
  monthly,
  chrome: {
    title: (name, ctx) => {
      switch (ctx.surface) {
        case 'tomorrow': return `Horóscopo de ${name} para mañana, ${date(ctx.from)}`;
        case 'weekly': return `Horóscopo semanal de ${name}, ${range(ctx.from, ctx.through)}`;
        case 'monthly': return `Horóscopo mensual de ${name}: ${monthYear(L, ctx.month!)}`;
        case 'love': return `Horóscopo del amor de ${name} hoy`;
        case 'career': return `Horóscopo del trabajo de ${name} hoy`;
        case 'yearly-2026': return `Horóscopo de ${name} 2026`;
        case 'yearly-2027': return `Horóscopo de ${name} 2027`;
      }
    },
    h1: (name, ctx) => {
      switch (ctx.surface) {
        case 'tomorrow': return `Horóscopo de ${name} para mañana`;
        case 'weekly': return `Horóscopo semanal de ${name}`;
        case 'monthly': return `Horóscopo mensual de ${name}`;
        case 'love': return `Horóscopo del amor de ${name}`;
        case 'career': return `Horóscopo del trabajo de ${name}`;
        case 'yearly-2026': return `Horóscopo de ${name} 2026`;
        case 'yearly-2027': return `Horóscopo de ${name} 2027`;
      }
    },
    description: (name, ctx) => `El horóscopo de ${name} ${periodPhrase(ctx)}, escrito a partir del cielo calculado: posiciones, lunas y fechas exactas, contadas desde tu signo solar.`,
    periodLabel: {
      today: 'Hoy', tomorrow: 'Mañana', weekly: 'Semana', monthly: 'Mes', love: 'Amor', career: 'Trabajo', 'yearly-2026': '2026', 'yearly-2027': '2027',
    },
    crumbs: 'Horóscopos',
    switchAria: 'Elige el periodo',
    skyHeading: 'El cielo detrás de esta lectura',
    skyIntro: 'Cada frase se apoya en estos datos, calculados para el mediodía UTC o al minuto exacto del evento.',
    skyRow: (fact) => (fact.kind === 'position'
      ? `${cap(planet(fact.body))}${fact.retrograde ? ' retrógrado' : ''} en ${sign(fact.sign)}, casa ${fact.house} · ${dayMonthYear(L, fact.at)}`
      : `${cap(eventClause(fact))} · ${dayMonthYear(L, fact.at)}, ${utcClock(fact.at)}`),
    moreHeading: 'Más para tu signo',
    signGuide: (name) => `Guía de ${name}`,
    pairs: (name) => `Compatibilidad de ${name}`,
    calculator: 'Calcula tu carta natal',
    otherSigns: 'Los otros signos',
    method: 'Las casas se cuentan desde tu signo solar (casas solares de signo entero). Las horas están en UTC.',
    confidence: (value) => `Confianza de lectura ${value}%`,
    confidenceNote: 'La cifra dice cuán específicos son los datos en los que se apoya la lectura (aquí, solo el signo solar), no la probabilidad de que algo pase.',
    faq: (name, surface) => [
      {
        q: `¿De dónde sale el horóscopo de ${name}?`,
        a: 'De las posiciones calculadas de los planetas y la Luna para estas fechas. Cada frase cita el dato en el que se apoya, y las casas se cuentan desde tu signo solar.',
      },
      {
        q: surface === 'weekly' ? '¿Qué semana cubre?' : surface === 'monthly' ? '¿Qué mes cubre?' : '¿Cuándo se actualiza?',
        a: surface === 'weekly'
          ? 'La semana va de lunes a domingo en horario UTC y se renueva cada lunes.'
          : surface === 'monthly'
            ? 'Cubre el mes natural en UTC; el del mes siguiente se publica el día 1.'
            : 'Se recalcula cada día con el mismo cielo que usa la edición diaria.',
      },
      {
        q: '¿Sirve si no conozco mi hora de nacimiento?',
        a: 'Sí. Este horóscopo usa solo el signo solar. Con fecha, hora y lugar puedes calcular tu carta natal completa y ver tu ascendente.',
      },
    ],
  },
};
