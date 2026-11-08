/** Lunas llenas y nuevas en español, escritas a partir de los hechos del catálogo. */
import { signBySlug, signName } from '../../signs';
import { degreeMinutes } from '../../today-sky';
import { dayMonthYear, utcClock } from '../horoscope/format';
import { THEME } from '../horoscope/es';
import type { LunationCopy, LunationFacts } from './types';

const L = 'es' as const;
const sign = (slug: string) => signName(signBySlug(slug), L);
const kindName = (facts: LunationFacts) => (facts.kind === 'full' ? 'Luna llena' : 'Luna nueva');
const when = (facts: LunationFacts) => dayMonthYear(L, facts.at);


/** Lo que cada signo pone en juego cuando la Luna lo ilumina o lo oscurece. */
const SIGN_TOPIC: Record<string, string> = {
  aries: 'la iniciativa, la valentía y la prisa',
  taurus: 'la seguridad, el cuerpo y lo que se construye despacio',
  gemini: 'las palabras, la curiosidad y los vínculos cercanos',
  cancer: 'el hogar, el cuidado y la memoria familiar',
  leo: 'la expresión personal, el orgullo y la alegría',
  virgo: 'el orden, el trabajo bien hecho y los detalles',
  libra: 'los acuerdos, la justicia y la convivencia',
  scorpio: 'la confianza, lo compartido y lo que se transforma',
  sagittarius: 'el sentido, los viajes y las creencias',
  capricorn: 'la responsabilidad, las metas y el tiempo',
  aquarius: 'la amistad, los grupos y las ideas nuevas',
  pisces: 'la sensibilidad, el descanso y lo que no se dice',
};

export const es: LunationCopy = {
  locale: L,
  title: (f) => `${kindName(f)} en ${sign(f.sign)}: ${when(f)}`,
  h1: (f) => `${kindName(f)} en ${sign(f.sign)}`,
  description: (f) => `La ${kindName(f).toLowerCase()} del ${when(f)} es exacta a las ${utcClock(f.at)}, a ${degreeMinutes(f.degree)} de ${sign(f.sign)}. Qué significa y cómo toca a cada signo.`,
  kindLabel: (kind) => (kind === 'full' ? 'Luna llena' : 'Luna nueva'),
  crumbsRoot: 'Calendario lunar',
  lead: (f) => (f.kind === 'full'
    ? `La Luna llena del ${when(f)} es exacta a las ${utcClock(f.at)}, con la Luna a ${degreeMinutes(f.degree)} de ${sign(f.sign)} y el Sol justo enfrente. Es el punto más iluminado del ciclo: lo que empezó con la Luna nueva anterior se ve ahora con claridad.`
    : `La Luna nueva del ${when(f)} es exacta a las ${utcClock(f.at)}, con el Sol y la Luna juntos a ${degreeMinutes(f.degree)} de ${sign(f.sign)}. Es el inicio de un ciclo de unas cuatro semanas, el momento clásico para fijar una intención pequeña y concreta.`),
  eclipseNote: (f) => (f.eclipse
    ? f.eclipse.type === 'solar'
      ? 'Esta Luna nueva coincide con un eclipse de Sol, así que su efecto se suele leer como un comienzo más marcado de lo habitual.'
      : 'Esta Luna llena coincide con un eclipse de Luna, así que su cierre se suele leer como más rotundo de lo habitual.'
    : ''),
  factLabels: { exact: 'Momento exacto', position: 'Posición', phase: 'Fase' },
  meaning: (f) => (f.kind === 'full'
    ? [
      `En ${sign(f.sign)}, la Luna llena pone el foco en ${SIGN_TOPIC[f.sign]}. Es un buen momento para ver resultados, terminar algo que estaba a medias y decir en voz alta lo que ya sabes.`,
      'No hace falta tomar grandes decisiones el mismo día: la Luna llena aclara, y la semana siguiente sirve para ajustar con calma.',
    ]
    : [
      `En ${sign(f.sign)}, la Luna nueva abre un ciclo para ${SIGN_TOPIC[f.sign]}. Funciona mejor con un primer paso pequeño que con una lista larga de propósitos.`,
      'Escribe una sola intención y revísala en la Luna llena siguiente, unas dos semanas después.',
    ]),
  signNotesHeading: 'Cómo toca a cada signo',
  signNotesIntro: 'Contada desde tu signo solar (casas solares de signo entero), esta Luna cae en una zona distinta para cada signo.',
  signNote: (sunSign, house) => `${sign(sunSign)}: casa ${house}, ${THEME[house]}.`,
  previous: 'Anterior',
  next: 'Siguiente',
  calendarLink: 'Calendario de lunas llenas',
  moonPhaseLink: 'La fase lunar de hoy',
  horoscopesLink: 'Horóscopos',
  confidence: (value) => `Confianza de lectura ${value}%`,
  confidenceNote: 'La cifra dice cuán específicos son los datos de la lectura (aquí, solo el signo solar), no la probabilidad de que algo pase.',
  method: 'El momento exacto y la posición se calculan con el motor astronómico del sitio. Las horas están en UTC.',
  faqHeading: 'Preguntas frecuentes',
  faq: (f) => [
    {
      q: `¿A qué hora es la ${kindName(f).toLowerCase()} del ${when(f)}?`,
      a: `Es exacta a las ${utcClock(f.at)} (hora UTC). En España peninsular suma una hora en invierno y dos en verano; en México y el resto de América resta según tu zona horaria.`,
    },
    {
      q: `¿En qué signo está la ${kindName(f).toLowerCase()}?`,
      a: `En ${sign(f.sign)}, a ${degreeMinutes(f.degree)}.`,
    },
    {
      q: '¿Necesito mi carta natal para leerla?',
      a: 'No. Las notas por signo usan solo el signo solar. Con tu carta natal puedes ver en qué casa cae exactamente para ti.',
    },
  ],
};
