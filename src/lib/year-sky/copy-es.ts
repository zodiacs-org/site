/**
 * "Tu cielo de 2027": the Spanish words of Your 2027 sky. Importing this
 * module registers them (defineYearSkyWords), so only the Spanish page and
 * its island carry them. Sign and planet names come from the site's own
 * helpers; the reading follows the English one line for line.
 *
 * House rules, as in copy.ts: plain, warm and dry; tú, as the rest of the
 * Spanish site; no em or en dashes; no health, money, betting or guarantees.
 */
import { planetLabel } from '../i18n/astrology';
import { signName as localSignName } from '../signs';
import { PERSONAL_WORDS } from '../personal-calendar/words';
import type { MilestoneKind } from '../occasions/milestones';
import { defineYearSkyWords, type YearAspect, type YearSkyWords } from './copy';

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ORDINAL = ['', 'primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto', 'séptimo', 'octavo'];
const HOUSE_ORDINAL = ['', 'primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta', 'séptima', 'octava', 'novena', 'décima', 'undécima', 'duodécima'];
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const P = (body: string) => planetLabel('es', body);
const W = PERSONAL_WORDS.es;

const HOUSE_TOPIC = [
  '',
  'cómo te muestras y cómo empiezas las cosas',
  'lo que valoras y guardas cerca',
  'las conversaciones, los viajes cortos, los hermanos y los vecinos',
  'el hogar, la familia y las raíces',
  'el juego, el romance y crear cosas',
  'el trabajo diario y las rutinas',
  'la pareja y los vínculos de tú a tú',
  'la intimidad, la confianza y lo que compartes',
  'los viajes, el estudio y las grandes ideas',
  'el trabajo, la reputación y el rumbo',
  'los amigos, los grupos y las esperanzas',
  'el descanso, el retiro y lo que pasa lejos de la vista',
];

const SIGN_TOPIC: Record<string, string> = {
  aries: 'empezar cosas',
  taurus: 'la comodidad y la constancia',
  gemini: 'las conversaciones y las ideas',
  cancer: 'el hogar y la familia',
  leo: 'el juego y dejarse ver',
  virgo: 'el oficio y el trabajo útil',
  libra: 'la pareja y la justicia',
  scorpio: 'la confianza y la profundidad',
  sagittarius: 'los viajes y las grandes ideas',
  capricorn: 'el trabajo y la posición',
  aquarius: 'los amigos y el futuro',
  pisces: 'el descanso y la imaginación',
};
const SLUG_BY_NAME = new Map(Object.keys(SIGN_TOPIC).map((slug) => [localSignName(slug, 'es'), slug]));
const signTopic = (sign: string) => SIGN_TOPIC[SLUG_BY_NAME.get(sign) ?? ''] ?? sign;

const POINT: Record<string, string> = { ASC: 'ascendente', MC: 'medio cielo' };
const pointName = (point: string) => POINT[point] ?? P(point);
const your = (point: string) => `tu ${pointName(point)}`;
const my = (point: string) => `mi ${pointName(point)}`;

/** What each point stands for, as "tu ..."; the part before a comma is its short form. */
const ROLE: Record<string, string> = {
  Sun: 'tu sentido de ti',
  Moon: 'tu vida emocional',
  Mercury: 'tu forma de pensar',
  Venus: 'tu forma de amar',
  Mars: 'tu empuje',
  Jupiter: 'tu apetito de más',
  Saturn: 'tu sentido del deber',
  ASC: 'tu ascendente, la forma en que te presentas al mundo',
  MC: 'tu medio cielo, tu rumbo público',
};
const role = (point: string) => ROLE[point] ?? your(point);
const shortRole = (point: string) => role(point).split(',')[0];

const TONE: Record<string, string> = {
  Jupiter: 'cerca de un año de crecimiento',
  Saturn: 'unos dos años y medio de construcción lenta',
  Uranus: 'unos siete años de cambio',
  Neptune: 'más de una década de sueños',
  Pluto: 'dos décadas de cambio profundo',
};
const tone = (planet: string) => TONE[planet] ?? 'un tramo largo';
/** "en torno a la pareja", "en torno al hogar". */
const around = (topic: string) => (topic.startsWith('el ') ? `en torno al ${topic.slice(3)}` : `en torno a ${topic}`);

/** What the moving planet brings while it passes (the English MOVER table). */
const MOVER: Record<string, string> = {
  Venus: 'un tramo suave de calidez y de ganas',
  Mars: 'un tramo cargado de calor y de prisa',
  Jupiter: 'un tramo generoso de confianza',
  Saturn: 'una larga temporada de presión y de rendir cuentas',
  Uranus: 'una sacudida que se repite durante meses',
  Neptune: 'una niebla lenta de anhelo y contornos borrosos',
  Pluto: 'una excavación que dura años',
};
const ASPECT_VERB: Record<YearAspect, { verb: string; gloss: string }> = {
  conjunction: { verb: 'se posa sobre', gloss: 'que durante un tiempo lo tiñe todo' },
  square: { verb: 'presiona contra', gloss: 'una fricción que no se resuelve sola' },
  trine: { verb: 'fluye a través de', gloss: 'una ayuda que llega sin pedirla' },
  opposition: { verb: 'se sitúa frente a', gloss: 'una tensión que conviene enfrentar de cara en lugar de absorberla' },
};
const ASPECT_TITLE: Record<YearAspect, string> = {
  conjunction: 'se une a',
  square: 'en cuadratura con',
  trine: 'en trígono con',
  opposition: 'en oposición a',
};

const RETROGRADE_LINE: Record<string, string> = {
  Mercury: 'Los planes, los mensajes y los viajes piden una segunda mirada. Termina, revisa y repara antes de lanzar nada.',
  Venus: 'Vuelven viejos sentimientos y viejos gustos para revisarse. Un buen tramo para reparar más que para empezar.',
  Mars: 'La energía se vuelve hacia dentro. Un tramo largo para revisar cómo empujas, no para buscar peleas nuevas.',
  Jupiter: 'El crecimiento se frena para revisarse. Una temporada para terminar lo que el año empezó.',
  Saturn: 'Los compromisos se revisan desde dentro. El trabajo callado sobre los cimientos da fruto más tarde.',
  Uranus: 'Los cambios de los últimos años se asientan, y ves cuáles querías de verdad.',
  Neptune: 'La niebla se levanta un poco. Las esperanzas reciben una suave dosis de realidad.',
  Pluto: 'El trabajo profundo se vuelve callado y personal.',
};

const ECLIPSE_KIND: Record<string, string> = { total: 'total', annular: 'anular', partial: 'parcial', penumbral: 'penumbral', hybrid: 'híbrido' };
const kindOf = (kind: string) => ECLIPSE_KIND[kind] ?? kind;

const MILESTONE_CARD: Record<MilestoneKind, string> = {
  'jupiter-return': 'Mi retorno de Júpiter',
  'saturn-return': 'Mi retorno de Saturno',
  'uranus-opposition': 'Mi oposición de Urano',
};

const day = (iso: string, year: number) => {
  const d = new Date(iso);
  const base = `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
  return d.getUTCFullYear() === year ? base : `${base} de ${d.getUTCFullYear()}`;
};
const list = (items: string[]) => items.length <= 1
  ? items.join('')
  : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
const decimal = (value: string) => value.replace('.', ',');

export const YEAR_SKY_WORDS_ES: YearSkyWords = defineYearSkyWords('es', {
  dateLocale: 'es-419',
  pageTitle: 'Tu cielo de 2027: el año que viene para tu carta natal',
  pageDescription: 'Los eclipses, los planetas lentos, los retrógrados y los retornos de 2027 que tocan tu carta natal, mes a mes, con una tarjeta para compartir y un archivo de calendario hechos en tu dispositivo.',
  heroTitle: 'Tu cielo de 2027',
  heroLede: 'Los grandes momentos de 2027 que tocan tu propia carta: los eclipses, los planetas lentos, Venus y Marte sobre tu Sol, tu retorno solar y los retrógrados que caen sobre tus posiciones. Todo se calcula en este navegador.',
  noscript: 'Para leer el año de tu carta hace falta JavaScript. El cielo compartido de abajo funciona sin él.',
  chooserTitle: 'Léelo para tu carta',
  chooserSaved: 'Carta guardada',
  savedLede: (name) => (name ? `Con tu carta guardada, ${name}.` : 'Elige una de tus cartas guardadas.'),
  enterOther: 'Usar otros datos de nacimiento',
  useSaved: 'Usar una carta guardada',
  readMine: 'Leer mi 2027',
  enterDetails: 'Escribir datos de nacimiento',
  enterDetailsLede: 'Escribe una fecha, una hora y un lugar de nacimiento para leer el año de esa carta.',
  readEntered: 'Leer mi 2027',
  orGeneral: 'O lee el cielo que compartimos todos.',
  reading: 'Leyendo el año…',
  cancel: 'Cancelar',
  error: 'No se pudo calcular el año. Revisa los datos y vuelve a intentarlo.',
  savedRemoved: 'Esa carta guardada cambió mientras se leía el año. Vuelve a intentarlo.',
  saveHint: 'Si guardas una carta, puedes volver aquí sin escribir los datos otra vez.',
  saveChart: 'Guardar una carta',
  privacy: 'El año se calcula en este dispositivo. Tus datos de nacimiento no se envían, no se guardan y no aparecen en ningún enlace.',
  resultTitle: 'Tu 2027',
  resultLede: 'Cada momento de abajo lleva su día exacto en UTC. Los planetas lentos se quedan cerca durante semanas antes y después de la fecha exacta, así que lee cada uno como una temporada con un punto más intenso.',
  briefTitle: 'El año en breve',
  allYearTitle: 'Todo el año',
  allYearLede: 'Dónde están los planetas lentos en tu carta durante todo el año, por casas de signo entero desde tu signo ascendente.',
  quietQuarter: 'Nada grande toca tu carta en estos meses. El cielo compartido de abajo sigue contando.',
  unknownTime: 'Sin hora de nacimiento, la carta se calcula para el mediodía de la fecha de nacimiento, así que una fecha puede moverse un día, y la Luna, el ascendente y las casas quedan fuera.',
  quarterNames: ['De enero a marzo', 'De abril a junio', 'De julio a septiembre', 'De octubre a diciembre'],
  monthNames: MONTHS,
  generalTitle: 'El cielo de 2027 que compartimos todos',
  generalLede: 'Cinco eclipses, los retrógrados y dónde pasan el año los planetas lentos. Estas fechas son las mismas para todos; lo que tocan depende de cada carta.',
  generalInvite: '¿Quieres saber cuáles caen sobre tu carta?',
  generalInviteLink: 'Léelo para tu carta',
  generalCalendar: 'Pon el cielo compartido en tu app de calendario',
  moreTitle: 'Más sobre 2027',
  moreLinks: [
    { path: '/eclipses/', label: 'Eclipses solares y lunares' },
    { path: '/mercury-retrograde/', label: 'Mercurio retrógrado' },
    { path: '/full-moon-calendar/', label: 'Calendario de lunas llenas' },
    { path: '/sky-calendar/', label: 'Pon el cielo compartido en tu app de calendario' },
    { path: '/transits/', label: 'Tránsitos, día a día' },
    { path: '/birth-chart/', label: 'Tu carta natal' },
  ],
  shareTitle: 'Comparte tu año',
  shareLede: 'La tarjeta solo muestra signos y planetas: ni nombre, ni fecha, hora o lugar de nacimiento, ni fechas de tu carta.',
  shareSquare: 'Compartir la tarjeta cuadrada',
  shareStory: 'Compartir la tarjeta para historias',
  shareShared: 'Compartida.',
  shareSaved: 'Guardada en tu dispositivo.',
  cardNote: 'Hecha en este navegador. La tarjeta cuadrada mide 1080 × 1080 y la de historias 1080 × 1920.',
  calendarTitle: 'Añadir 2027 a mi calendario',
  calendarLede: 'Un solo archivo con tus momentos y el cielo compartido, cada uno con un aviso el día antes. Se crea en este navegador y se guarda en tu dispositivo; no hay enlace para suscribirse, porque un enlace tendría que llevar tus datos de nacimiento.',
  calendarButton: 'Descargar el archivo de calendario',
  calendarDone: 'Archivo de calendario guardado. Ábrelo para añadir los eventos a tu app de calendario.',
  calendarNote: 'El archivo se llama zodiacs-2027-sky.ics. La mayoría de las apps de calendario lo importan con un doble toque o desde su menú de importación.',
  calendarName: 'Zodiacs.org · Mi cielo de 2027',
  calendarExact: 'Exacto a las {time} UTC.',
  calendarMore: 'Más: {url}',
  calendarForecast: W.note,
  confidenceNote: 'Cada lectura lleva su confianza de lectura: cuán específicos son los datos de la carta en los que se apoya, no la probabilidad de que algo pase.',
  cardHeadline: 'Mi cielo en',
  cardSun: P('Sun'),
  cardMoon: P('Moon'),
  cardRising: 'Ascendente',
  cardCount: (n) => (n === 1 ? '1 momento toca mi carta' : `${n} momentos tocan mi carta`),
  cardQuiet: 'Un año tranquilo para mi carta',
  confidence: (value) => `Confianza de lectura ${value}%`,
  day,
  dayTime: (iso) => {
    const d = new Date(iso);
    return `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} a las ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
  },
  range: (fromIso, toIso, year) => `del ${day(fromIso, year)} al ${day(toIso, year)}`,
  list,
  signName: (slug) => localSignName(slug, 'es'),
  planet: P,
  pointName,

  eclipseTitle: (type, kind) => `Eclipse ${type === 'solar' ? 'solar' : 'lunar'} ${kindOf(kind)}`,
  eclipseLine: (type, kind, degree, sign, unseen) => type === 'solar'
    ? `Una Luna nueva con peso extra a ${degree} de ${sign}. Los astrólogos leen los eclipses solares como comienzos que llegan antes de lo previsto.${kind === 'total' ? ' Este es total: la Luna cubre el Sol entero a lo largo de su franja.' : ''}`
    : `Una Luna llena con peso extra a ${degree} de ${sign}. Los eclipses lunares se leen como finales y limpiezas.${unseen ? ` Este es penumbral y tan leve que ningún ojo ni cámara lo verá: la NASA le da una magnitud de ${String(unseen).replace('.', ',')}.` : kind === 'penumbral' ? ' Este es penumbral, tenue a simple vista.' : ''}`,
  retrogradeTitle: (planet) => `${P(planet)} retrógrado`,
  retrogradeLine: (planet) => RETROGRADE_LINE[planet] ?? `${P(planet)} parece moverse hacia atrás durante un tiempo.`,
  retrogradeDetail: (range, sign, shadow) => `${cap(range)}${sign ? `, en ${sign}` : ''}.${shadow ? ` La sombra va ${shadow}.` : ''}`,
  ingressTitle: (planet, sign) => `${P(planet)} entra en ${sign}`,
  ingressLine: (planet, sign, until) => `${P(planet)} se queda en ${sign} hasta el ${until}: ${tone(planet)} ${around(signTopic(sign))}.`,
  stationRetrograde: 'empieza la retrogradación',
  underWay: 'En marcha al empezar el año',
  stationDirect: 'vuelve al movimiento directo',
  backgroundTitle: 'Dónde pasan 2027 los planetas lentos',
  backgroundLine: (planet, signs) => `${P(planet)}: ${signs}.`,
  backgroundSigns: (spans) => spans.length === 1
    ? `${spans[0].sign} todo el año`
    : spans.map((span, i) => `${i === 0 ? '' : 'luego '}${span.sign}${span.until ? ` hasta el ${span.until}` : ''}`).join(', '),
  passLabel: (pass, count) => `paso ${pass} de ${count}`,

  solarTitle: W.solarTitle,
  solarLine: 'El Sol vuelve al grado exacto que ocupaba cuando naciste. Los astrólogos leen la carta de este momento como la forma de tu año que empieza.',
  solarDetail: (time) => `Exacto el ${time}.`,
  milestoneTitle: (kind, index) => kind === 'uranus-opposition'
    ? 'Tu oposición de Urano'
    : `Tu ${ORDINAL[index] ?? `${index}.º`} ${W.milestones[kind].name.charAt(0).toLowerCase()}${W.milestones[kind].name.slice(1)}`,
  milestoneLine: (kind) => W.milestones[kind].about,
  contactTitle: (planet, aspect, point) => `${P(planet)} ${ASPECT_TITLE[aspect]} ${your(point)}`,
  contactLine: (planet, aspect, point) => {
    const phrase = ASPECT_VERB[aspect];
    const mover = MOVER[planet];
    if (!phrase || !mover) return `${P(planet)} forma un aspecto con ${role(point)}.`;
    return `${P(planet)} ${phrase.verb} ${role(point)}: ${mover}, ${phrase.gloss}.`;
  },
  exactOn: (dates) => `Exacto: ${dates}.`,
  passOf: (pass, count) => `Paso ${pass} de ${count}.`,
  loopBefore: (year) => `El ciclo empezó en ${year}.`,
  loopAfter: (year) => `El ciclo termina en ${year}.`,
  slowNote: W.slowNote,
  eclipseHitTitle: (type, contact, point) => `Un eclipse ${type === 'solar' ? 'solar' : 'lunar'} cae ${contact === 'conjunction' ? 'sobre' : 'frente a'} ${your(point)}`,
  eclipseHitLine: (type, contact, point, degree, sign) => {
    const where = contact === 'conjunction' ? `sobre ${role(point)}` : `frente a ${role(point)}`;
    return type === 'solar'
      ? `El eclipse a ${degree} de ${sign} cae ${where}. Léelo como una puerta que se abre ahí: algo empieza, antes de lo que planeabas.`
      : `El eclipse a ${degree} de ${sign} cae ${where}. Léelo como una limpieza: algo ahí llega a su final natural y recuperas el espacio.`;
  },
  eclipseOrb: (orb) => `A ${decimal(orb)}° del punto exacto.`,
  retrogradeHitTitle: (planet, points) => `${P(planet)} retrógrado vuelve sobre ${list(points.map(your))}`,
  retrogradeHitLine: (planet, points) => {
    const names = list(points.map(your));
    const roles = list(points.map(shortRole));
    if (planet === 'Mercury') return `Mercurio cruza ${names} tres veces: hacia delante, hacia atrás y otra vez hacia delante. Las conversaciones y los planes que tocan ${roles} tienen un segundo borrador.`;
    if (planet === 'Venus') return `Venus cruza ${names} tres veces. Viejos sentimientos y viejos gustos ${around(roles)} vuelven para revisarse.`;
    return `${P(planet)} cruza ${names} tres veces. ${cap(roles)} ${points.length > 1 ? 'hacen' : 'hace'} un largo ejercicio: primero más lento, luego más fuerte.`;
  },
  ingressSunTitle: (planet) => `${P(planet)} entra en tu signo solar`,
  ingressRisingTitle: (planet) => `${P(planet)} entra en tu signo ascendente`,
  ingressHouseTitle: (planet, house) => `${P(planet)} pasa a tu ${HOUSE_ORDINAL[house]} casa`,
  ingressPersonalLine: (planet, sign, house, ownSign) => {
    const parts = [`${P(planet)} pasa a ${sign}`];
    if (house) parts.push(`, tu ${HOUSE_ORDINAL[house]} casa por casas de signo entero: ${tone(planet)} ${around(HOUSE_TOPIC[house])}.`);
    else parts.push(`: ${tone(planet)} ${around(signTopic(sign))}.`);
    if (ownSign === 'sun') parts.push(' Es tu signo solar, así que el ciclo vuelve a empezar donde tu carta tiene su motor.');
    if (ownSign === 'rising') parts.push(' Es tu signo ascendente, así que el cambio se nota primero en cómo te presentas al mundo.');
    return parts.join('');
  },
  backgroundHouseLine: (planet, sign, house, until) => `${P(planet)} ${until ? `está en ${sign} hasta el ${until}` : `pasa el año en ${sign}`}, tu ${HOUSE_ORDINAL[house]} casa por casas de signo entero: ${tone(planet)} ${around(HOUSE_TOPIC[house])}.`,
  cardContact: (planet, aspect, point) => `${P(planet)} ${ASPECT_TITLE[aspect]} ${my(point)}`,
  cardEclipse: (point) => `Un eclipse sobre ${my(point)}`,
  cardRetrograde: (planet, points) => `${P(planet)} retrógrado sobre ${list(points.map(my))}`,
  cardMilestone: (kind) => MILESTONE_CARD[kind],
  cardIngress: (planet, house, ownSign) => ownSign === 'sun'
    ? `${P(planet)} en mi signo solar`
    : ownSign === 'rising'
      ? `${P(planet)} en mi signo ascendente`
      : `${P(planet)} en mi ${HOUSE_ORDINAL[house ?? 0] ?? ''} casa`,
});
