/**
 * Ogni testo visibile delle pagine quotidiane in italiano: l'oroscopo di oggi
 * per segno, l'indice degli oroscopi e la pagina del cielo di oggi. Scritto in
 * italiano, con il tu delle letture quotidiane (src/lib/i18n/daily-reading.ts).
 * Niente lineette lunghe o medie.
 */
import type { Copy } from '../../../components/localized/horoscope-copy';
import type { HubCopy } from '../../../components/localized/hub-copy';
import { TODAY, cap, named, type TodayCopy } from '../../../components/localized/today-copy';
import { aspectLabel } from '../../i18n/astrology';
import { signName } from '../../signs';

// ── Articoli e preposizioni articolate ──

const CONTRACT: Record<string, Record<string, string>> = {
  di: { il: 'del', lo: 'dello', la: 'della', 'l’': 'dell’', i: 'dei' },
  a: { il: 'al', lo: 'allo', la: 'alla', 'l’': 'all’', i: 'ai' },
  da: { il: 'dal', lo: 'dallo', la: 'dalla', 'l’': 'dall’', i: 'dai' },
  su: { il: 'sul', lo: 'sullo', la: 'sulla', 'l’': 'sull’', i: 'sui' },
};

function prep(p: keyof typeof CONTRACT, phrase: string): string {
  const match = /^(il|lo|la|i) (.*)$/s.exec(phrase);
  if (match) return `${CONTRACT[p][match[1]]} ${match[2]}`;
  if (phrase.startsWith('l’')) return `${CONTRACT[p]['l’']}${phrase.slice(2)}`;
  return `${p} ${phrase}`;
}

/** I segni con il loro articolo: "l’Ariete", "lo Scorpione", "i Gemelli". */
const SIGN_ARTICLE: Record<string, string> = {
  Ariete: 'l’Ariete', Toro: 'il Toro', Gemelli: 'i Gemelli', Cancro: 'il Cancro',
  Leone: 'il Leone', Vergine: 'la Vergine', Bilancia: 'la Bilancia', Scorpione: 'lo Scorpione',
  Sagittario: 'il Sagittario', Capricorno: 'il Capricorno', Acquario: 'l’Acquario', Pesci: 'i Pesci',
};
const the = (name: string) => SIGN_ARTICLE[name] ?? name;

/** Una data già scritta ("8 novembre 2026") con il suo articolo: "l’8 novembre 2026", "il 9 novembre", "il 1° dicembre". */
function theDate(date: string): string {
  const match = /^(\d{1,2})(\s.*)$/s.exec(date);
  if (!match) return date;
  const day = Number(match[1]);
  if (day === 8 || day === 11) return `l’${day}${match[2]}`;
  return `il ${day === 1 ? '1°' : day}${match[2]}`;
}

/** Venere è femminile: "Venere retrograda", ma "Mercurio retrogrado". */
const retro = (planet: string) => (planet === 'Venere' ? 'retrograda' : 'retrogrado');

// ── L'oroscopo di oggi, segno per segno ──

const horoscope: Copy = {
  title: (name, date) => `Oroscopo ${name} oggi, ${date} | Zodiacs.org`,
  description: (name, date, notes) => `L’oroscopo di oggi, ${date}, per ${the(name)}: ${notes} dalle sue case solari, con le posizioni reali del cielo e i relativi riferimenti.`,
  notes: (count) => (count === 1 ? '1 nota' : `${count} note`),
  imageAlt: (name) => `${name}, oroscopo di oggi, Zodiacs.org`,
  crumbs: 'Oroscopi',
  crumbsAria: 'Percorso di navigazione',
  h1: (name) => `${name} oggi`,
  credit: (name) => `${name}, dalle illustrazioni dei segni di Zodiacs`,
  periodsAria: (name) => `Periodi dell’oroscopo ${prep('di', the(name))}`,
  todayWord: 'Oggi',
  week: 'Questa settimana',
  month: 'Questo mese',
  periodsNote: 'Settimana e mese, per ora in inglese',
  railLabel: 'Cambia segno',
  metaLabel: 'Oroscopo del giorno',
  noteCount: (count) => (count === 1 ? '1 nota' : `${count} note`),
  readingTitle: (name) => `Il cielo di oggi visto ${prep('da', the(name))}`,
  foot: (name) => `Scritto per ${the(name)} come segno solare. Le posizioni del cielo sono calcolate; il loro significato è un’interpretazione astrologica. Usalo per riflettere, non come la previsione di un fatto.`,
  methodLink: 'Come calcoliamo',
  share: (name) => `Oroscopo ${name} di oggi`,
  shareLabel: 'Invia questa lettura',
  askLead: 'Hai domande su questa lettura?',
  askLabel: 'Chiedi a Guide',
  prompts: (name) => [
    `Che cosa significa il cielo di oggi per ${the(name)}?`,
    'Da quali pianeti nasce questa lettura?',
    'Come leggo tutto questo nel mio tema natale?',
  ],
  railAria: 'Su questa lettura',
  skyTitle: 'Il cielo dietro questa lettura',
  skyBasis: '12:00 UTC',
  skySub: 'Ogni nota nasce da una di queste posizioni.',
  skyRow: (planet, sign) => `${planet} in ${sign}`,
  skyHouse: (house, name) => `Casa ${house} contata ${prep('da', the(name))}.`,
  moonLit: (phase, percent) => `${phase}, illuminata al ${percent}%.`,
  retrograde: 'Retrogrado.',
  alsoSun: (position) => `Nello stesso cielo: Sole ${position}`,
  fullSky: 'Tutto il cielo di oggi',
  wheelAria: (date, name) => `Il cielo alle 12:00 UTC ${prep('di', theDate(date))}, contato ${prep('da', the(name))} come prima casa`,
  wheelCaption: (date, name, focus, count) => `Il cielo alle 12:00 UTC ${prep('di', theDate(date))}, nella ruota ${prep('di', the(name))}.${count > 0 ? ` A colori: ${focus}, ${count === 1 ? 'il pianeta di questa lettura' : 'i pianeti di questa lettura'}.` : ''}`,
  ctaKicker: 'Oltre il tuo segno solare',
  ctaTitle: 'Guarda dove cade questo cielo nel tuo tema natale.',
  ctaLede: (name, moonSign, house) => `Questa lettura conta la ruota ${prep('da', the(name))}, quindi la Luna in ${moonSign} cade nella casa ${house}. Il tuo tema natale parte dal tuo ascendente, quindi la stessa Luna può toccare un’altra parte della tua vita.`,
  ticks: [
    'Il tuo Sole, la tua Luna e il tuo ascendente, e che cosa significa ciascuno',
    'Il cielo di ogni giorno letto sul tuo tema natale',
    'Si calcola nel tuo browser, senza creare un account',
  ],
  reassure: ['Data, ora e luogo di nascita.', 'Una ventina di secondi.'],
  saved: 'Hai già salvato un tema? ',
  savedLink: 'Confrontalo con il cielo di oggi',
  moreTitle: (name) => `Altro ${prep('su', the(name))}`,
  moreLede: 'Lo stesso cielo su periodi più lunghi, e il segno letto da un altro punto del tema.',
  moreLonger: 'Domani, settimana e mese',
  moreLongerText: (name) => `Le letture più lunghe per ${the(name)}, anche su amore, lavoro e 2027.`,
  moreRising: (name) => `Ascendente ${name}`,
  moreRisingNote: 'Profilo dell’ascendente',
  moreRisingText: (name) => `${name} come segno ascendente, quello che sorgeva all’orizzonte est al momento della nascita.`,
  moreAll: 'Tutti i segni',
  moreAllText: 'I dodici oroscopi del cielo di oggi in una sola pagina.',
  guideKicker: 'La guida del segno',
  guideTitle: (name) => `${name}, nel dettaglio`,
  guideCopy: (name) => `Carattere, amore, lavoro e denaro, affinità, e che cosa significa ${the(name)} nel tuo tema natale.`,
  guideLink: (name) => `Guida completa ${prep('a', the(name))}`,
  signsTitle: 'Leggi un altro segno',
  signsLede: 'Le note del cielo di oggi per tutti e dodici i segni, dalle stesse posizioni.',
  allHoroscopes: 'Tutti gli oroscopi',
  signsAria: 'Altri segni',
  readingNow: 'Stai leggendo',
  faqTitle: (name) => `Oroscopo del giorno ${prep('di', the(name))}: domande`,
  faqMore: 'Altro sul metodo: ',
  faq: (name) => [
    {
      q: `Che cosa copre questo oroscopo del giorno ${prep('di', the(name))}?`,
      a: `Fino a quattro note a partire dal cielo di oggi: in quale casa solare ${prep('di', the(name))} cadono la Luna e i pianeti personali, più gli eventi esatti della data. Ogni nota porta il suo riferimento.`,
    },
    {
      q: `Questa lettura vale solo per chi ha ${the(name)} come segno solare?`,
      a: `Comincia da ${the(name)} come segno solare. Se conosci il tuo ascendente, leggi anche quello; il tema natale completo dà il quadro più personale.`,
    },
    {
      q: `Come può usare questa lettura chi è ${prep('di', the(name))}?`,
      a: 'Prendi la parte che ti serve, trasformala in una domanda o in un passo concreto, e lascia decidere il tuo giudizio.',
    },
  ],
};

// ── Il cielo di oggi ──

const NUMBER_WORDS = ['nessuno', 'uno', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci'];

const today: TodayCopy = {
  title: (date) => `Oggi, il cielo ${prep('di', theDate(date))} | Zodiacs.org`,
  description: (date) => `Il cielo di oggi per i dodici segni solari: fino a quattro note per segno, calcolate dalle posizioni reali ${prep('di', theDate(date))}.`,
  crumbsAria: 'Percorso di navigazione',
  home: 'Home',
  todayWord: 'oggi',
  TodayWord: 'Oggi',
  onDate: (date) => theDate(date),
  h1: 'Il cielo di oggi',
  lede: 'Dove si trova ogni pianeta, che cosa ha rappresentato per tradizione ogni posizione e che cosa arriva dopo nel calendario.',
  cta: 'Confrontalo con il tuo tema',
  yourSign: 'Il tuo segno',
  reassure: 'Gratis · Senza registrazione · Posizioni alle 12:00 UTC',
  wheelAria: (date) => `Il cielo alle 12:00 UTC ${prep('di', theDate(date))}: il Sole, la Luna e i pianeti nei loro segni, con gli aspetti entro tre gradi dall’esatto`,
  legendRx: 'Retrogrado',
  legendEasy: 'Trigono o sestile',
  legendTense: 'Quadratura o opposizione',
  legendJoined: 'Congiunzione',
  lightsKicker: 'Da dove comincia la giornata',
  lightsTitle: 'Il Sole e la Luna',
  lightsLede: 'I due luminari da cui parte l’astrologia: dove si trovano e che cosa hanno rappresentato per tradizione i loro segni.',
  moonLink: 'La Luna di stanotte, nel dettaglio',
  sunTag: (degree) => `Sole · ${degree}`,
  moonTag: (degree, percent) => `Luna · ${degree} · illuminata al ${percent}%`,
  sunIn: (sign) => `Sole in ${sign}`,
  moonIn: (sign) => `Luna in ${sign}`,
  sunNote: (third, ingress) => `Il Sole è ${['nel primo terzo', 'nel terzo centrale', 'nell’ultimo terzo'][third]} del segno${ingress ? ` ed entra in ${ingress.sign} ${theDate(ingress.date)}` : ''}.`,
  moonNote: (age, single, lastDegree) => `${single ? 'È passato' : 'Sono passati'} ${age} ${single ? 'giorno' : 'giorni'} dalla Luna nuova${lastDegree ? ', e la Luna è nell’ultimo grado del segno' : ''}.`,
  moonAge: (age, single) => `Età: ${age} ${single ? 'giorno' : 'giorni'}`,
  cycleAria: 'Questo ciclo lunare',
  signsKicker: 'Il tuo segno',
  signsLede: 'Scegli il tuo segno solare. Ogni nota nasce dalle posizioni registrate del cielo di oggi, lette dalle case solari del tuo segno; i riferimenti sotto ogni lettura dicono esattamente da dove viene. Sono temi da osservare, non istruzioni.',
  allHoroscopes: 'Tutti gli oroscopi',
  signsAria: 'Segni',
  horoscopeLink: (sign) => `Oroscopo ${sign} di oggi`,
  guideLink: (sign) => `Guida ${prep('a', the(sign))}`,
  personalTitle: 'Il tuo tema, davanti al cielo di oggi',
  personalBody: 'Con data, ora e luogo di nascita, il tuo tema natale si calcola qui, nel tuo browser. Il confronto privato di un tema salvato con ogni edizione, per ora, è nell’edizione inglese.',
  personalCompare: 'Vedi il confronto privato',
  planetsTitle: 'Dove sono i pianeti',
  planetsSub: (date) => `12:00 UTC, ${date}.`,
  planetsSubMore: ' Ogni corpo con ciò che ha rappresentato per tradizione.',
  topics: {
    Sun: 'identità e direzione',
    Moon: 'bisogni emotivi e istinto',
    Mercury: 'pensiero e comunicazione',
    Venus: 'affetti, piacere e valori',
    Mars: 'slancio e affermazione di sé',
    Jupiter: 'crescita e convinzioni',
    Saturn: 'responsabilità e crescita nel lungo periodo',
    Uranus: 'indipendenza e cambiamento',
    Neptune: 'immaginazione e ideali',
    Pluto: 'potere e trasformazione profonda',
  },
  direct: 'Diretto',
  retrograde: 'Retrogrado',
  station: (type, clock) => `${type === 'retrograde' ? 'Retrogrado' : 'Diretto'} dalle ${clock} UTC`,
  comingTitle: 'Che cosa arriva nel cielo',
  comingSub: 'Date in UTC: in America alcune cadono un giorno prima.',
  eclipseTitle: (type, kind, sign) => `Eclissi ${type} ${kind} in ${sign}`,
  eclipseShort: (type, kind) => `${type} ${kind}`,
  eclipseType: { solar: 'solare', lunar: 'lunare' },
  eclipseKind: { total: 'totale', partial: 'parziale', annular: 'anulare', penumbral: 'di penombra', hybrid: 'ibrida' },
  ingressTitle: (subject, sign) => `${subject} entra in ${sign}`,
  ingressDetail: (retrograde, from) => `${retrograde ? 'In moto retrogrado, ' : ''}${retrograde ? prep('da', the(from)) : cap(prep('da', the(from)))}`,
  lunationTitle: (type, sign) => `${type === 'new' ? 'Luna nuova' : 'Luna piena'} in ${sign}`,
  stationTitle: (planet, type) => `${planet} ${type === 'retrograde' ? `diventa ${retro(planet)}` : 'torna diretto'}`,
  aspectDetail: (a, b) => `${a} e ${b}`,
  nextEclipse: (name, date) => `Prossima eclissi: ${name}, ${date}`,
  calendarLink: 'Il calendario completo del cielo',
  dayEvent: (event) => {
    if (event.kind === 'station' && event.planet) {
      const who = named('it', event.planet);
      return `${who} ${event.type === 'retrograde' ? `diventa ${retro(who)}` : 'riprende il moto diretto'}`;
    }
    if (event.kind === 'aspect' && event.a && event.b && event.type) {
      const exact: Record<string, string> = {
        conjunction: 'una congiunzione esatta', sextile: 'un sestile esatto', square: 'una quadratura esatta',
        trine: 'un trigono esatto', opposition: 'un’opposizione esatta',
      };
      return `${named('it', event.a)} e ${named('it', event.b)} formano ${exact[event.type] ?? aspectLabel('it', event.type)}`;
    }
    if (event.kind === 'ingress' && event.planet && event.sign) return `${named('it', event.planet)} entra in ${signName(event.sign, 'it')}`;
    if (event.kind === 'lunation' && event.sign) return `la ${event.type === 'new' ? 'Luna nuova' : 'Luna piena'} cade in ${signName(event.sign, 'it')}`;
    return null;
  },
  rxTitle: 'I retrogradi, a colpo d’occhio',
  rxLink: 'Tutte le date dei retrogradi',
  rxNone: ['Nessun pianeta è retrogrado ', TODAY, '.'],
  rxNow: (list, count) => [`${list} ${count === 1 ? `è ${retro(list)}` : 'sono retrogradi'} `, TODAY, '.'],
  rxNext: (planet, date) => [`${planet} diventa ${retro(planet)} ${theDate(date)}.`],
  rxEnded: (planet, date) => (date
    ? [`Il periodo retrogrado di ${planet} si è chiuso ${theDate(date)}.`]
    : [`Il periodo retrogrado di ${planet} si è chiuso `, TODAY, '.']),
  rxTableAria: (range) => `Periodi retrogradi ${range}`,
  rxPlanet: 'Pianeta',
  rxPeriod: 'Periodo',
  rxNowPrefix: 'Retrogrado · ',
  rxNowDirect: ', ora diretto',
  rxStateNow: 'Retrogrado ora',
  rxStateUpcoming: 'In arrivo',
  rxStateEnded: 'Concluso',
  rxMeansKicker: 'Che cosa vuol dire retrogrado',
  rxMeans: 'Vista dalla Terra, a volte un pianeta sembra rallentare, fermarsi e tornare indietro sullo sfondo delle stelle. La sua orbita reale non cambia. Gli astrologi leggono da sempre questi tratti come un tempo di revisione: i temi del pianeta si riprendono in mano invece di cominciare da capo.',
  aspectsTitle: 'Gli aspetti più esatti',
  aspectsLede: (all, shown) => {
    const word = (count: number) => NUMBER_WORDS[count] ?? String(count);
    if (all > shown) return `Gli aspetti sono gli angoli tra i pianeti. ${cap(word(all))} sono entro tre gradi dall’esatto alle 12:00 UTC; questi sono i ${word(shown)} più esatti.`;
    return `Gli aspetti sono gli angoli tra i pianeti. ${all === 1 ? 'Questo è' : `Questi ${word(all)} sono`} entro tre gradi dall’esatto alle 12:00 UTC.`;
  },
  definitions: {
    conjunction: 'Un aspetto di 0° che riunisce due parti del tema nello stesso punto.',
    sextile: 'Un aspetto di 60° che si legge come un’occasione di collaborazione tra due parti del tema.',
    square: 'Un aspetto di 90° che si legge come un attrito che chiede di agire o di aggiustare qualcosa.',
    trine: 'Un aspetto di 120° che si legge come un legame scorrevole tra due parti del tema.',
    opposition: 'Un aspetto di 180° che mette due punti del tema uno di fronte all’altro.',
  },
  represent: (a, topicA, b, topicB) => `Per tradizione, ${a} rappresenta ${topicA}; ${b}, ${topicB}.`,
  exactAt: (clock) => `Esatto alle ${clock} UTC`,
  fromExact: (orb) => `A ${orb} dall’esatto`,
  furtherTitle: 'Per andare oltre',
  furtherLede: 'Altri modi per seguire il cielo, data dopo data.',
  allTools: 'Tutti gli strumenti',
  tools: [
    { href: '/transits/', title: 'Transiti', promise: 'Il cielo di oggi confrontato con il tuo tema natale.' },
    { href: '/moon-phase/', title: 'Fase lunare', promise: 'La Luna di stanotte o quella di qualsiasi data.' },
    { href: '/sky-calendar/', title: 'Calendario del cielo', promise: 'Lune nuove e lune piene nella tua app del calendario.' },
    { href: '/eclipses/', title: 'Eclissi', promise: 'Le eclissi di Sole e di Luna fino al 2030.' },
  ],
  askTitle: 'Domande sul cielo di oggi?',
  askLead: 'Guide è un assistente di intelligenza artificiale per le domande di astrologia e per aiutarti a usare Zodiacs.',
  askLabel: 'Chiedi a Guide',
  prompts: [
    'Che cosa significa il cielo di oggi per il mio segno?',
    'Che cos’è un pianeta retrogrado?',
    'Come leggo il cielo di oggi nel mio tema natale?',
  ],
  methodTitle: 'Come nasce questa pagina',
  methodBody: (date) => `Le posizioni sono calcolate per le 12:00 UTC della data dell’edizione, ${theDate(date)}. Gli orari del calendario sono in UTC. Le note per segno descrivono temi su cui riflettere, non consigli.`,
  coverage: 'Questa edizione usa solo le posizioni dei pianeti; per questa data non è disponibile l’ora esatta degli eventi.',
  provenanceLabel: 'Dietro questa lettura quotidiana',
  provenanceDescription: 'Dati del cielo, limiti e criteri editoriali',
  provenanceBefore: 'Ogni nota è legata al cielo registrato del giorno ',
  provenanceAfter: ', la data dell’edizione in UTC; le posizioni dei pianeti sono quelle delle 12:00 UTC. Le note in italiano nascono dagli stessi fatti dell’edizione inglese, con modelli scritti in questa lingua, e portano gli stessi riferimenti: la stessa casa e lo stesso corpo celeste della versione inglese.',
  methodLink: 'Come calcoliamo',
  publicationLink: 'Come si pubblica ogni edizione',
  correctionsLink: 'Correzioni',
};

// ── L'indice degli oroscopi ──

const hub: HubCopy = {
  title: (date) => `Oroscopo di oggi, ${date} | Zodiacs.org`,
  description: (date) => `Oroscopo di oggi, ${date}: una nota chiara per ognuno dei dodici segni, calcolata dalle posizioni reali del cielo.`,
  imageAlt: 'Oroscopo di oggi per i dodici segni, Zodiacs.org',
  h1: 'Oroscopo di oggi',
  dateline: (date) => `Edizione del giorno · ${date}`,
  lede: 'Trova il tuo segno e leggi la nota più concreta sul cielo di oggi. Parti dal segno solare e, se lo conosci, leggi anche il tuo ascendente.',
  stamp: (date) => `Aggiornato ogni giorno · ${date}`,
  jumpLabel: 'Vai al tuo segno',
  pickerAria: 'Scegli il segno del tuo oroscopo',
  read: 'Leggi oggi →',
  notePersonal: 'Vuoi una lettura più personale? ',
  noteChart: 'Calcola gratis il tuo tema natale',
  noteSky: ' Il cielo completo, pianeta per pianeta, è nella ',
  noteSkyLink: 'pagina del cielo di oggi',
  noteLonger: '. Le letture di domani, della settimana e del mese sono nell’',
  noteEnglish: 'edizione inglese',
  askLead: 'Non sai da dove cominciare?',
  askLabel: 'Chiedi a Guide',
  prompts: [
    'Leggo il mio segno solare o il mio ascendente?',
    'Che cosa significa il cielo di oggi per tutti?',
    'Come si calcolano questi oroscopi?',
  ],
  methodSummary: 'Dietro queste letture',
  methodBefore: (date) => `Questa è l’edizione UTC ${prep('di', theDate(date))}; le posizioni sono quelle del cielo registrato alle 12:00 UTC. Gli oroscopi per segno solare danno il quadro generale. Vedi `,
  methodLink: 'come calcoliamo',
};

export const it: { horoscope: Copy; today: TodayCopy; hub: HubCopy } = { horoscope, today, hub };
