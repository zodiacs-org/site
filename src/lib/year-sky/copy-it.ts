/**
 * "Il tuo cielo del 2027": the Italian words of Your 2027 sky. Importing this
 * module registers them (defineYearSkyWords), so only the Italian page and
 * its island carry them. Sign and planet names come from the site's own
 * helpers; the reading follows the English one line for line.
 *
 * House rules, as in copy.ts: plain, warm and dry; tu, as the rest of the
 * Italian site; no em or en dashes; no health, money, betting or guarantees.
 */
import { planetLabel } from '../i18n/astrology';
import { signName as localSignName } from '../signs';
import { PERSONAL_WORDS } from '../personal-calendar/words';
import type { MilestoneKind } from '../occasions/milestones';
import { defineYearSkyWords, type YearAspect, type YearSkyWords } from './copy';

const MONTHS = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
const ORDINAL = ['', 'primo', 'secondo', 'terzo', 'quarto', 'quinto', 'sesto', 'settimo', 'ottavo'];
const HOUSE_ORDINAL = ['', 'prima', 'seconda', 'terza', 'quarta', 'quinta', 'sesta', 'settima', 'ottava', 'nona', 'decima', 'undicesima', 'dodicesima'];
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const P = (body: string) => planetLabel('it', body);
const W = PERSONAL_WORDS.it;

const HOUSE_TOPIC = [
  '',
  'come ti mostri e come cominci le cose',
  'ciò a cui tieni e che tieni vicino',
  'le conversazioni, i brevi spostamenti, i fratelli e i vicini',
  'la casa, la famiglia e le radici',
  'il gioco, l’amore e il creare',
  'il lavoro di ogni giorno e le abitudini',
  'la coppia e i legami a due',
  'l’intimità, la fiducia e ciò che condividi',
  'i viaggi, lo studio e le grandi idee',
  'il lavoro, la reputazione e la direzione',
  'gli amici, i gruppi e le speranze',
  'il riposo, il ritiro e ciò che accade lontano dagli occhi',
];

const SIGN_TOPIC: Record<string, string> = {
  aries: 'i nuovi inizi',
  taurus: 'il comfort e la costanza',
  gemini: 'le conversazioni e le idee',
  cancer: 'la casa e la famiglia',
  leo: 'il gioco e il farsi vedere',
  virgo: 'il mestiere e il lavoro utile',
  libra: 'la coppia e l’equità',
  scorpio: 'la fiducia e la profondità',
  sagittarius: 'i viaggi e le grandi idee',
  capricorn: 'il lavoro e la posizione',
  aquarius: 'gli amici e il futuro',
  pisces: 'il riposo e l’immaginazione',
};
const SLUG_BY_NAME = new Map(Object.keys(SIGN_TOPIC).map((slug) => [localSignName(slug, 'it'), slug]));
const signTopic = (sign: string) => SIGN_TOPIC[SLUG_BY_NAME.get(sign) ?? ''] ?? sign;

const POINT: Record<string, string> = { ASC: 'ascendente', MC: 'medio cielo' };
/** Points that are feminine in Italian. */
const FEMININE = new Set(['Moon', 'Venus']);
const pointName = (point: string) => POINT[point] ?? P(point);
const your = (point: string) => `${FEMININE.has(point) ? 'la tua' : 'il tuo'} ${pointName(point)}`;
const toYour = (point: string) => `${FEMININE.has(point) ? 'alla tua' : 'al tuo'} ${pointName(point)}`;
const onYour = (point: string) => `${FEMININE.has(point) ? 'sulla tua' : 'sul tuo'} ${pointName(point)}`;
const my = (point: string) => `${FEMININE.has(point) ? 'la mia' : 'il mio'} ${pointName(point)}`;
const toMy = (point: string) => `${FEMININE.has(point) ? 'alla mia' : 'al mio'} ${pointName(point)}`;
const onMy = (point: string) => `${FEMININE.has(point) ? 'sulla mia' : 'sul mio'} ${pointName(point)}`;

/** What each point stands for, each with its article; the part before a comma is its short form. */
const ROLE: Record<string, { the: string; on: string; to: string }> = {
  Sun: { the: 'il tuo senso di te', on: 'sul tuo senso di te', to: 'al tuo senso di te' },
  Moon: { the: 'la tua vita emotiva', on: 'sulla tua vita emotiva', to: 'alla tua vita emotiva' },
  Mercury: { the: 'il tuo modo di pensare', on: 'sul tuo modo di pensare', to: 'al tuo modo di pensare' },
  Venus: { the: 'il tuo modo di amare', on: 'sul tuo modo di amare', to: 'al tuo modo di amare' },
  Mars: { the: 'la tua spinta', on: 'sulla tua spinta', to: 'alla tua spinta' },
  Jupiter: { the: 'la tua voglia di avere di più', on: 'sulla tua voglia di avere di più', to: 'alla tua voglia di avere di più' },
  Saturn: { the: 'il tuo senso del dovere', on: 'sul tuo senso del dovere', to: 'al tuo senso del dovere' },
  ASC: { the: 'il tuo ascendente, il modo in cui vai incontro al mondo', on: 'sul tuo ascendente, il modo in cui vai incontro al mondo', to: 'al tuo ascendente, il modo in cui vai incontro al mondo' },
  MC: { the: 'il tuo medio cielo, la tua direzione pubblica', on: 'sul tuo medio cielo, la tua direzione pubblica', to: 'al tuo medio cielo, la tua direzione pubblica' },
};
const role = (point: string) => ROLE[point] ?? { the: your(point), on: onYour(point), to: toYour(point) };
const shortRole = (point: string) => role(point).the.split(',')[0];

const TONE: Record<string, string> = {
  Jupiter: 'circa un anno di crescita',
  Saturn: 'circa due anni e mezzo di costruzione lenta',
  Uranus: 'circa sette anni di cambiamento',
  Neptune: 'più di dieci anni di sogno',
  Pluto: 'due decenni di cambiamento profondo',
};
const tone = (planet: string) => TONE[planet] ?? 'un lungo tratto';
/** The topic a slow planet's years turn on, after a comma: ", con al centro ...". */
const around = (topic: string) => `, con al centro ${topic}`;

const MOVER: Record<string, string> = {
  Venus: 'un tratto morbido di calore e desiderio',
  Mars: 'un tratto carico di calore e urgenza',
  Jupiter: 'un tratto generoso di fiducia',
  Saturn: 'una lunga stagione di pressione e di resa dei conti',
  Uranus: 'uno scossone che si ripete per mesi',
  Neptune: 'una nebbia lenta di desiderio e contorni sfumati',
  Pluto: 'uno scavo che dura anni',
};
const ASPECT_VERB: Record<YearAspect, { verb: (point: string) => string; gloss: string }> = {
  conjunction: { verb: (point) => `si posa ${role(point).on}`, gloss: 'che per un po’ colora tutto ciò che vi si trova' },
  square: { verb: (point) => `fa pressione ${role(point).on}`, gloss: 'un attrito che non si risolve da solo' },
  trine: { verb: (point) => `scorre attraverso ${role(point).the}`, gloss: 'un aiuto che arriva senza chiederlo' },
  opposition: { verb: (point) => `sta di fronte ${role(point).to}`, gloss: 'una tensione da affrontare di petto invece che da assorbire' },
};
const contactTitle = (aspect: YearAspect, point: string, mine: boolean) => {
  const plain = mine ? my(point) : your(point);
  const to = mine ? toMy(point) : toYour(point);
  return {
    conjunction: `incontra ${plain}`,
    square: `in quadratura ${to}`,
    trine: `in trigono ${to}`,
    opposition: `in opposizione ${to}`,
  }[aspect];
};

const RETROGRADE_LINE: Record<string, string> = {
  Mercury: 'Piani, messaggi e viaggi chiedono una seconda occhiata. Finisci, rivedi e ripara prima di lanciare qualcosa di nuovo.',
  Venus: 'Vecchi sentimenti e vecchi gusti tornano per essere rivisti. Un buon tratto per riparare più che per cominciare.',
  Mars: 'L’energia si volge verso l’interno. Un lungo tratto per rivedere come spingi, non per cercare nuove liti.',
  Jupiter: 'La crescita rallenta per essere verificata. Una stagione per finire ciò che l’anno ha cominciato.',
  Saturn: 'Gli impegni vengono rivisti da dentro. Il lavoro silenzioso sulle fondamenta dà frutto più avanti.',
  Uranus: 'I cambiamenti degli ultimi anni si assestano, e vedi quali volevi davvero.',
  Neptune: 'La nebbia si alza un po’. Le speranze ricevono un dolce confronto con la realtà.',
  Pluto: 'Il lavoro profondo diventa silenzioso e personale.',
};
const retrograde = (planet: string) => `${P(planet)} ${FEMININE.has(planet) ? 'retrograda' : 'retrogrado'}`;

const ECLIPSE_KIND: Record<string, string> = { total: 'totale', annular: 'anulare', partial: 'parziale', penumbral: 'penombrale', hybrid: 'ibrida' };
const kindOf = (kind: string) => ECLIPSE_KIND[kind] ?? kind;

const MILESTONE_CARD: Record<MilestoneKind, string> = {
  'jupiter-return': 'Il mio ritorno di Giove',
  'saturn-return': 'Il mio ritorno di Saturno',
  'uranus-opposition': 'La mia opposizione di Urano',
};

const dayOfMonth = (d: Date) => (d.getUTCDate() === 1 ? '1º' : String(d.getUTCDate()));
const day = (iso: string, year: number) => {
  const d = new Date(iso);
  const base = `${dayOfMonth(d)} ${MONTHS[d.getUTCMonth()]}`;
  return d.getUTCFullYear() === year ? base : `${base} ${d.getUTCFullYear()}`;
};
/** "al 26 luglio", "all’8 agosto", "all’11 maggio": the article before a day. */
const elides = (dayText: string) => /^(?:8|11)\s/u.test(dayText);
const al = (dayText: string) => (elides(dayText) ? `all’${dayText}` : `al ${dayText}`);
const dal = (dayText: string) => (elides(dayText) ? `dall’${dayText}` : `dal ${dayText}`);
const list = (items: string[]) => items.length <= 1
  ? items.join('')
  : `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
const decimal = (value: string) => value.replace('.', ',');

export const YEAR_SKY_WORDS_IT: YearSkyWords = defineYearSkyWords('it', {
  dateLocale: 'it-IT',
  pageTitle: 'Il tuo cielo del 2027: l’anno che viene per il tuo tema natale',
  pageDescription: 'Le eclissi, i pianeti lenti, i moti retrogradi e i ritorni del 2027 che toccano il tuo tema natale, mese per mese, con una card da condividere e un file di calendario creati sul tuo dispositivo.',
  heroTitle: 'Il tuo cielo del 2027',
  heroLede: 'I grandi momenti del 2027 che toccano il tuo tema: le eclissi, i pianeti lenti, Venere e Marte sul tuo Sole, la tua rivoluzione solare e i moti retrogradi che cadono sulle tue posizioni. Tutto viene calcolato in questo browser.',
  noscript: 'Per leggere l’anno del tuo tema serve JavaScript. Il cielo condiviso qui sotto funziona anche senza.',
  chooserTitle: 'Leggilo per il tuo tema',
  chooserSaved: 'Tema salvato',
  savedLede: (name) => (name ? `Dal tuo tema salvato, ${name}.` : 'Scegli uno dei tuoi temi salvati.'),
  enterOther: 'Inserisci altri dati di nascita',
  useSaved: 'Usa un tema salvato',
  readMine: 'Leggi il mio 2027',
  enterDetails: 'Inserisci i dati di nascita',
  enterDetailsLede: 'Inserisci una data, un’ora e un luogo di nascita per leggere l’anno di quel tema.',
  readEntered: 'Leggi il mio 2027',
  orGeneral: 'Oppure leggi il cielo che condividiamo tutti.',
  reading: 'Lettura dell’anno…',
  cancel: 'Annulla',
  error: 'Non è stato possibile calcolare l’anno. Controlla i dati e riprova.',
  savedRemoved: 'Quel tema salvato è cambiato mentre leggevamo l’anno. Riprova.',
  saveHint: 'Salvando un tema puoi tornare qui senza scrivere di nuovo i dati.',
  saveChart: 'Salva un tema',
  privacy: 'L’anno viene calcolato su questo dispositivo. I tuoi dati di nascita non vengono inviati, né conservati, né messi in un link.',
  resultTitle: 'Il tuo 2027',
  resultLede: 'Ogni momento qui sotto ha il suo giorno esatto in UTC. I pianeti lenti restano vicini per settimane prima e dopo la data esatta, quindi leggi ognuno come una stagione con un culmine.',
  briefTitle: 'L’anno in breve',
  allYearTitle: 'Tutto l’anno',
  allYearLede: 'Dove si trovano i pianeti lenti nel tuo tema per tutto l’anno, con le case a segno intero dal tuo segno ascendente.',
  quietQuarter: 'Niente di grande tocca il tuo tema in questi mesi. Il cielo condiviso qui sotto vale comunque.',
  unknownTime: 'Senza ora di nascita il tema è calcolato per mezzogiorno della data di nascita, quindi una data può spostarsi di un giorno, e la Luna, l’ascendente e le case restano fuori.',
  quarterNames: ['Da gennaio a marzo', 'Da aprile a giugno', 'Da luglio a settembre', 'Da ottobre a dicembre'],
  monthNames: MONTHS,
  generalTitle: 'Il cielo del 2027 che condividiamo tutti',
  generalLede: 'Cinque eclissi, i moti retrogradi e dove passano l’anno i pianeti lenti. Queste date sono le stesse per tutti; ciò che toccano dipende dal tema.',
  generalInvite: 'Vuoi sapere quali cadono sul tuo tema?',
  generalInviteLink: 'Leggilo per il tuo tema',
  generalCalendar: 'Metti il cielo condiviso nella tua app di calendario',
  moreTitle: 'Altro sul 2027',
  moreLinks: [
    { path: '/eclipses/', label: 'Eclissi solari e lunari' },
    { path: '/mercury-retrograde/', label: 'Mercurio retrogrado' },
    { path: '/full-moon-calendar/', label: 'Calendario delle lune piene' },
    { path: '/sky-calendar/', label: 'Metti il cielo condiviso nella tua app di calendario' },
    { path: '/transits/', label: 'I transiti, giorno per giorno' },
    { path: '/birth-chart/', label: 'Il tuo tema natale' },
  ],
  shareTitle: 'Condividi il tuo anno',
  shareLede: 'La card mostra solo segni e pianeti: nessun nome, nessuna data, ora o luogo di nascita, nessuna data del tuo tema.',
  shareSquare: 'Condividi la card quadrata',
  shareStory: 'Condividi la card per le storie',
  shareShared: 'Condivisa.',
  shareSaved: 'Salvata sul tuo dispositivo.',
  cardNote: 'Creata in questo browser. La card quadrata misura 1080 × 1080 e quella per le storie 1080 × 1920.',
  calendarTitle: 'Aggiungi il 2027 al mio calendario',
  calendarLede: 'Un solo file con i tuoi momenti e il cielo condiviso, ognuno con un promemoria il giorno prima. Viene creato in questo browser e salvato sul tuo dispositivo; non c’è un link a cui iscriversi, perché un link dovrebbe contenere i tuoi dati di nascita.',
  calendarButton: 'Scarica il file di calendario',
  calendarDone: 'File di calendario salvato. Aprilo per aggiungere gli eventi alla tua app di calendario.',
  calendarNote: 'Il file si chiama zodiacs-2027-sky.ics. La maggior parte delle app di calendario lo importa con un doppio tocco o dal menu di importazione.',
  calendarName: 'Zodiacs.org · Il mio cielo del 2027',
  calendarExact: 'Esatto alle {time} UTC.',
  calendarMore: 'Altro: {url}',
  calendarForecast: W.note,
  confidenceNote: 'Ogni lettura riporta la sua affidabilità della lettura: quanto sono precisi i dati del tema su cui si basa, non la probabilità che qualcosa accada.',
  cardHeadline: 'Il mio cielo nel',
  cardSun: P('Sun'),
  cardMoon: P('Moon'),
  cardRising: 'Ascendente',
  cardCount: (n) => (n === 1 ? '1 momento tocca il mio tema' : `${n} momenti toccano il mio tema`),
  cardQuiet: 'Un anno tranquillo per il mio tema',
  confidence: (value) => `Affidabilità della lettura ${value}%`,
  day,
  dayTime: (iso) => {
    const d = new Date(iso);
    return `${dayOfMonth(d)} ${MONTHS[d.getUTCMonth()]} alle ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
  },
  range: (fromIso, toIso, year) => `${dal(day(fromIso, year))} ${al(day(toIso, year))}`,
  list,
  signName: (slug) => localSignName(slug, 'it'),
  planet: P,
  pointName,

  eclipseTitle: (type, kind) => `Eclissi ${type === 'solar' ? 'solare' : 'lunare'} ${kindOf(kind)}`,
  eclipseLine: (type, kind, degree, sign) => type === 'solar'
    ? `Una Luna nuova con un peso in più, a ${degree} in ${sign}. Gli astrologi leggono le eclissi solari come inizi che arrivano prima del previsto.${kind === 'total' ? ' Questa è totale: la Luna copre tutto il Sole lungo la sua fascia.' : ''}`
    : `Una Luna piena con un peso in più, a ${degree} in ${sign}. Le eclissi lunari si leggono come finali e grandi pulizie.${kind === 'penumbral' ? ' Questa è penombrale, debole a occhio nudo.' : ''}`,
  retrogradeTitle: retrograde,
  retrogradeLine: (planet) => RETROGRADE_LINE[planet] ?? `${P(planet)} sembra muoversi all’indietro per un po’.`,
  retrogradeDetail: (range, sign, shadow) => `${cap(range)}${sign ? `, in ${sign}` : ''}.${shadow ? ` L’ombra va ${shadow}.` : ''}`,
  ingressTitle: (planet, sign) => `${P(planet)} entra in ${sign}`,
  ingressLine: (planet, sign, until) => `${P(planet)} resta in ${sign} fino ${al(until)}: ${tone(planet)}${around(signTopic(sign))}.`,
  stationRetrograde: 'inizio del moto retrogrado',
  underWay: 'Già in corso all’inizio dell’anno',
  stationDirect: 'ritorno al moto diretto',
  backgroundTitle: 'Dove passano il 2027 i pianeti lenti',
  backgroundLine: (planet, signs) => `${P(planet)}: ${signs}.`,
  backgroundSigns: (spans) => spans.length === 1
    ? `${spans[0].sign} tutto l’anno`
    : spans.map((span, i) => `${i === 0 ? '' : 'poi '}${span.sign}${span.until ? ` fino ${al(span.until)}` : ''}`).join(', '),
  passLabel: (pass, count) => `passaggio ${pass} di ${count}`,

  solarTitle: W.solarTitle,
  solarLine: 'Il Sole torna al grado esatto in cui si trovava quando sei nato. Gli astrologi leggono il tema di questo momento come la forma del tuo anno che comincia.',
  solarDetail: (time) => `Esatto ${elides(time) ? 'l’' : 'il '}${time}.`,
  milestoneTitle: (kind, index) => kind === 'uranus-opposition'
    ? 'La tua opposizione di Urano'
    : `Il tuo ${ORDINAL[index] ?? `${index}º`} ${W.milestones[kind].name.charAt(0).toLowerCase()}${W.milestones[kind].name.slice(1)}`,
  milestoneLine: (kind) => W.milestones[kind].about,
  contactTitle: (planet, aspect, point) => `${P(planet)} ${contactTitle(aspect, point, false)}`,
  contactLine: (planet, aspect, point) => {
    const phrase = ASPECT_VERB[aspect];
    const mover = MOVER[planet];
    if (!phrase || !mover) return `${P(planet)} forma un aspetto con ${role(point).the}.`;
    return `${P(planet)} ${phrase.verb(point)}: ${mover}, ${phrase.gloss}.`;
  },
  exactOn: (dates) => `Esatto: ${dates}.`,
  passOf: (pass, count) => `Passaggio ${pass} di ${count}.`,
  loopBefore: (year) => `Il ciclo è cominciato nel ${year}.`,
  loopAfter: (year) => `Il ciclo si chiude nel ${year}.`,
  slowNote: W.slowNote,
  eclipseHitTitle: (type, contact, point) => `Un’eclissi ${type === 'solar' ? 'solare' : 'lunare'} cade ${contact === 'conjunction' ? onYour(point) : `di fronte ${toYour(point)}`}`,
  eclipseHitLine: (type, contact, point, degree, sign) => {
    const where = contact === 'conjunction' ? role(point).on : `di fronte ${role(point).to}`;
    return type === 'solar'
      ? `L’eclissi a ${degree} in ${sign} cade ${where}. Leggila come una porta che si apre lì: qualcosa comincia, prima di quanto avevi previsto.`
      : `L’eclissi a ${degree} in ${sign} cade ${where}. Leggila come una grande pulizia: qualcosa lì arriva alla sua fine naturale, e ritrovi spazio.`;
  },
  eclipseOrb: (orb) => `A ${decimal(orb)}° dal punto esatto.`,
  retrogradeHitTitle: (planet, points) => `${retrograde(planet)} ripassa ${list(points.map(onYour))}`,
  retrogradeHitLine: (planet, points) => {
    const names = list(points.map(your));
    const roles = list(points.map(shortRole));
    if (planet === 'Mercury') return `Mercurio attraversa ${names} tre volte: avanti, indietro e di nuovo avanti. Le conversazioni e i piani che toccano ${roles} hanno una seconda stesura.`;
    if (planet === 'Venus') return `Venere attraversa ${names} tre volte. Vecchi sentimenti e vecchi gusti che riguardano ${roles} tornano per essere rivisti.`;
    return `${P(planet)} attraversa ${names} tre volte. ${cap(roles)} ${points.length > 1 ? 'fanno' : 'fa'} un lungo allenamento: prima più lento, poi più forte.`;
  },
  ingressSunTitle: (planet) => `${P(planet)} entra nel tuo segno solare`,
  ingressRisingTitle: (planet) => `${P(planet)} entra nel tuo segno ascendente`,
  ingressHouseTitle: (planet, house) => `${P(planet)} entra nella tua ${HOUSE_ORDINAL[house]} casa`,
  ingressPersonalLine: (planet, sign, house, ownSign) => {
    const parts = [`${P(planet)} entra in ${sign}`];
    if (house) parts.push(`, la tua ${HOUSE_ORDINAL[house]} casa con le case a segno intero: ${tone(planet)}${around(HOUSE_TOPIC[house])}.`);
    else parts.push(`: ${tone(planet)}${around(signTopic(sign))}.`);
    if (ownSign === 'sun') parts.push(' È il tuo segno solare, quindi il ciclo ricomincia dove il tuo tema tiene il motore.');
    if (ownSign === 'rising') parts.push(' È il tuo segno ascendente, quindi il cambiamento si vede prima nel modo in cui vai incontro al mondo.');
    return parts.join('');
  },
  backgroundHouseLine: (planet, sign, house, until) => `${P(planet)} ${until ? `resta in ${sign} fino ${al(until)}` : `passa l’anno in ${sign}`}, la tua ${HOUSE_ORDINAL[house]} casa con le case a segno intero: ${tone(planet)}${around(HOUSE_TOPIC[house])}.`,
  cardContact: (planet, aspect, point) => `${P(planet)} ${contactTitle(aspect, point, true)}`,
  cardEclipse: (point) => `Un’eclissi ${onMy(point)}`,
  cardRetrograde: (planet, points) => `${retrograde(planet)} ${list(points.map(onMy))}`,
  cardMilestone: (kind) => MILESTONE_CARD[kind],
  cardIngress: (planet, house, ownSign) => ownSign === 'sun'
    ? `${P(planet)} nel mio segno solare`
    : ownSign === 'rising'
      ? `${P(planet)} nel mio segno ascendente`
      : `${P(planet)} nella mia ${HOUSE_ORDINAL[house ?? 0] ?? ''} casa`,
});
