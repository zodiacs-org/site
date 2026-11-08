/**
 * Oroscopi per periodo in italiano: domani, settimana, mese, amore, lavoro e anno.
 * Scritto in italiano a partire dai fatti (./types.ts), non tradotto da un'altra
 * lingua. Registro: del tu, frasi piane, niente enfasi; nessuna promessa su
 * salute, denaro o destino. Niente lineette lunghe o medie.
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

const L = 'it' as const;
const SIGN_ORDER = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const idx = (slug: string) => SIGN_ORDER.indexOf(slug);

const sign = (slug: string) => signName(signBySlug(slug), L);
const planet = (body: string) => planetLabel(L, body);
/** Il Sole e la Luna vogliono l'articolo; i pianeti, in astrologia, no. */
const subject = (body: string) => (body === 'Sun' ? 'il Sole' : body === 'Moon' ? 'la Luna' : planet(body));
/** Venere è femminile: "Venere retrograda", ma "Mercurio retrogrado". */
const retro = (body: string) => (body === 'Venus' ? 'retrograda' : 'retrogrado');

// ── Preposizioni articolate ──

const CONTRACT: Record<string, Record<string, string>> = {
  di: { il: 'del', lo: 'dello', la: 'della', 'l’': 'dell’', i: 'dei', gli: 'degli', le: 'delle' },
  a: { il: 'al', lo: 'allo', la: 'alla', 'l’': 'all’', i: 'ai', gli: 'agli', le: 'alle' },
  da: { il: 'dal', lo: 'dallo', la: 'dalla', 'l’': 'dall’', i: 'dai', gli: 'dagli', le: 'dalle' },
  in: { il: 'nel', lo: 'nello', la: 'nella', 'l’': 'nell’', i: 'nei', gli: 'negli', le: 'nelle' },
  su: { il: 'sul', lo: 'sullo', la: 'sulla', 'l’': 'sull’', i: 'sui', gli: 'sugli', le: 'sulle' },
};

/** "in" + "la casa" = "nella casa"; "a" + "l’8 novembre" = "all’8 novembre"; senza articolo resta com'è. */
export function prep(p: keyof typeof CONTRACT, phrase: string): string {
  const match = /^(il|lo|la|i|gli|le) (.*)$/s.exec(phrase);
  if (match) return `${CONTRACT[p][match[1]]} ${match[2]}`;
  if (phrase.startsWith('l’')) return `${CONTRACT[p]['l’']}${phrase.slice(2)}`;
  return `${p} ${phrase}`;
}

/** La preposizione ripetuta davanti a ogni voce di un elenco: "alla casa, alla famiglia e alla tua vita privata". */
function prepList(p: keyof typeof CONTRACT, list: string): string {
  const items = list.split(/, | e /);
  if (items.length === 1) return prep(p, list);
  const last = items.pop()!;
  return `${items.map((item) => prep(p, item)).join(', ')} e ${prep(p, last)}`;
}

/** I segni con il loro articolo: "l’Ariete", "lo Scorpione", "i Gemelli". */
const SIGN_ARTICLE: Record<string, string> = {
  Ariete: 'l’Ariete', Toro: 'il Toro', Gemelli: 'i Gemelli', Cancro: 'il Cancro',
  Leone: 'il Leone', Vergine: 'la Vergine', Bilancia: 'la Bilancia', Scorpione: 'lo Scorpione',
  Sagittario: 'il Sagittario', Capricorno: 'il Capricorno', Acquario: 'l’Acquario', Pesci: 'i Pesci',
};
export const withArticle = (name: string) => SIGN_ARTICLE[name] ?? name;

// ── Date ──

/** "il 9 novembre", "l’8 novembre", "l’11 novembre", "il 1° novembre". */
function theDay(at: string, withMonth = true): string {
  const day = Number(at.slice(8, 10));
  const article = day === 8 || day === 11 ? 'l’' : 'il ';
  const number = day === 1 ? '1°' : String(day);
  const month = withMonth ? ` ${dayMonth(L, at).replace(/^\d+\s+/, '')}` : '';
  return `${article}${number}${month}`;
}
const date = (at: string) => dayMonth(L, at).replace(/^1 /, '1° ');
/** "dal 2 all’8 novembre", oppure "dal 30 novembre al 6 dicembre". */
const range = (from: string, through: string) => (from.slice(0, 7) === through.slice(0, 7)
  ? `${prep('da', theDay(from, false))} ${prep('a', theDay(through))}`
  : `${prep('da', theDay(from))} ${prep('a', theDay(through))}`);
const tidy = (text: string) => text.replace(/\s+/g, ' ').replace(/\s+([.,:;])/g, '$1').trim();

const ORDINAL = ['', 'prima', 'seconda', 'terza', 'quarta', 'quinta', 'sesta', 'settima', 'ottava', 'nona', 'decima', 'undicesima', 'dodicesima'];

/** I temi di ogni casa solare, con l'articolo. */
export const THEME: Record<number, string> = {
  1: 'la tua immagine, i nuovi inizi e il modo in cui ti presenti',
  2: 'il denaro, ciò che possiedi e ciò che ti dà sicurezza',
  3: 'i messaggi, le commissioni e le persone che hai vicino',
  4: 'la casa, la famiglia e la tua vita privata',
  5: 'il piacere, l’amore e ciò che crei per il gusto di farlo',
  6: 'le incombenze di ogni giorno, le abitudini e le routine',
  7: 'la coppia e gli accordi alla pari',
  8: 'il denaro in comune, i debiti e la fiducia più intima',
  9: 'i viaggi, lo studio e le tue convinzioni',
  10: 'la carriera, la reputazione e ciò che gli altri vedono di te',
  11: 'le amicizie, i gruppi e i progetti per il futuro',
  12: 'il riposo, il ritiro e ciò che si muove dentro di te',
};

/** Lo stesso tema in breve, con l'articolo, per le frasi che ne nominano due. */
const FOCUS: Record<number, string> = {
  1: 'la tua immagine',
  2: 'il denaro',
  3: 'i messaggi e le commissioni',
  4: 'la casa e la famiglia',
  5: 'il piacere e la creatività',
  6: 'le routine quotidiane',
  7: 'la coppia e gli accordi',
  8: 'le risorse in comune',
  9: 'lo studio e i viaggi',
  10: 'la carriera',
  11: 'le amicizie e i gruppi',
  12: 'il riposo',
};

/** Titoli brevi per i capitoli dell'anno. */
const SHORT: Record<number, string> = {
  1: 'Immagine e nuovi inizi',
  2: 'Denaro e priorità',
  3: 'Messaggi e ambiente vicino',
  4: 'Casa e famiglia',
  5: 'Piacere e creatività',
  6: 'Routine e lavoro quotidiano',
  7: 'Coppia e accordi',
  8: 'Ciò che si condivide',
  9: 'Studio e orizzonti',
  10: 'Carriera e reputazione',
  11: 'Amicizie e progetti',
  12: 'Riposo e ritiro',
};

/** Un primo passo concreto per ogni casa. */
const ADVICE: Record<number, string> = {
  1: 'Di’ che cosa vuoi avviare prima di reagire a quello che propongono gli altri.',
  2: 'Metti in cifre quello che spendi, quello che hai e quello che aspetti di ricevere.',
  3: 'Rispondi al messaggio rimasto in sospeso e metti per iscritto quello che si è deciso.',
  4: 'Chiediti che cosa ti serve in casa e riservagli del tempo prima di accettare altri impegni.',
  5: 'Ritagliati un’ora per qualcosa che fai solo per piacere, senza pensare al risultato.',
  6: 'Riordina la lista della giornata e togli un compito che non spetta a te.',
  7: 'Parla chiaro con l’altra persona e fai domande invece di dare le cose per scontate.',
  8: 'Tieni distinto ciò che è tuo, ciò che è in comune e ciò che è dovuto.',
  9: 'Leggi, chiedi o progetta un viaggio: qualcosa che ti porti fuori dai soliti pensieri.',
  10: 'Porta a termine ciò che gli altri vedranno e fai capire chi ci ha lavorato.',
  11: 'Scrivi a quell’amico o a quel gruppo e fissa una data.',
  12: 'Tieniti un’ora senza schermi e lascia che la giornata rallenti.',
};

/** Un secondo sguardo sulla stessa casa, per non ripetere il consiglio. */
const REFINE: Record<number, string> = {
  1: 'Un piccolo cambiamento nel modo in cui ti presenti dice più di un grande annuncio.',
  2: 'Prima di comprare, chiediti se l’acquisto avrà ancora senso fra una settimana.',
  3: 'Rileggi quello che mandi: una parola fuori posto può costarti un pomeriggio.',
  4: 'Sistema una cosa precisa in casa invece di progettare di rifare tutto.',
  5: 'Lascia che il gioco resti un gioco: non tutto deve diventare un progetto.',
  6: 'Guarda un’abitudine diventata automatica e decidi se vale la pena tenerla.',
  7: 'Un accordo è equo quando tutti e due sanno che cosa spetta a ciascuno.',
  8: 'Una conversazione scomoda su soldi o fiducia risparmia parecchi sospetti.',
  9: 'Un’idea nuova vale di più quando la metti alla prova in qualcosa di pratico.',
  10: 'Scegli un obiettivo visibile e misura i progressi con i fatti, non con le impressioni.',
  11: 'Guarda quali gruppi ti danno davvero qualcosa e quali frequenti per abitudine.',
  12: 'Anche dormire bene e chiudere ciò che è rimasto in sospeso è un modo di andare avanti.',
};

/** Il lato affettivo di ogni casa. */
const LOVE: Record<number, string> = {
  1: 'Mostrati come sei: in questo momento conta la spontaneità più della messa in scena.',
  2: 'L’affetto si vede nelle cose concrete: un pensiero, un aiuto, del tempo dedicato.',
  3: 'Una conversazione semplice vale più di qualsiasi grande gesto.',
  4: 'La calma in casa è la base: prenditi cura dello spazio che condividete.',
  5: 'C’è voglia di divertirsi: proponi un programma che vi faccia ridere.',
  6: 'L’amore passa anche dalla vita di tutti i giorni: dividere i compiti senza tenere il conto.',
  7: 'Il rapporto chiede di stare alla pari: ascolta prima di rispondere.',
  8: 'La fiducia cresce quando parli di ciò che ti sta davvero a cuore.',
  9: 'Apri la relazione a qualcosa di nuovo: un luogo, un’idea, un argomento diverso.',
  10: 'Fai in modo che il lavoro non si prenda lo spazio che spetta all’altra persona.',
  11: 'Ora l’amicizia fa parte dell’amore: le serate in compagnia aiutano.',
  12: 'Certe cose si dicono meglio in privato e senza fretta.',
};

/** Il lato professionale di ogni casa. */
const WORK: Record<number, string> = {
  1: 'Prendi l’iniziativa su un compito che porti il tuo nome.',
  2: 'Rivedi entrate, tariffe o preventivi con numeri precisi.',
  3: 'Email, telefonate e pratiche chiedono ordine e risposte rapide.',
  4: 'Sistema il posto da cui lavori, così non ti porta via energia.',
  5: 'Un progetto creativo o una proposta tua merita l’ora migliore della giornata.',
  6: 'Metti ordine in procedure e scadenze: la costanza rende più dello sforzo occasionale.',
  7: 'Tratta con chiarezza: soci, clienti e accordi messi per iscritto.',
  8: 'Controlla debiti, risorse comuni e ciò che dipende da altri.',
  9: 'Formarti, pubblicare o rivolgerti a un pubblico nuovo dà frutti sul lungo periodo.',
  10: 'La tua reputazione passa da ciò che consegni: chiudi per primo il lavoro più in vista.',
  11: 'I contatti e il lavoro di squadra aprono porte.',
  12: 'Lavora su ciò che ancora non si vede e non cercare applausi prima del tempo.',
};

/** Come lavora meglio ogni segno, in una frase. */
const KEY: Record<string, string> = {
  aries: 'Per l’Ariete vale più un primo passo pulito che una corsa disordinata.',
  taurus: 'Il Toro avanza meglio al proprio passo, senza cedere ciò che gli dà una sicurezza vera.',
  gemini: 'Per i Gemelli la chiarezza sta nello scegliere una conversazione e portarla fino in fondo.',
  cancer: 'Per il Cancro prendersi cura degli altri non vuol dire caricarsi di tutto: contano anche i propri bisogni.',
  leo: 'Per il Leone la presenza conta di più quando la sostanza è pronta prima dello spettacolo.',
  virgo: 'Alla Vergine basta migliorare bene una cosa sola, senza correggere tutto il resto.',
  libra: 'Per la Bilancia l’equilibrio arriva quando dice che cosa preferisce, invece di indovinare che cosa vogliono gli altri.',
  scorpio: 'La forza dello Scorpione sta nel sapere che cosa tenere e che cosa lasciar andare, senza drammi.',
  sagittarius: 'Al Sagittario serve più una direzione chiara che dieci strade aperte.',
  capricorn: 'Per il Capricorno il progresso si misura in passi che si possono reggere nel tempo.',
  aquarius: 'Per l’Acquario un’idea vale quando trova un posto concreto in cui mettersi alla prova.',
  pisces: 'Per i Pesci i confini chiari proteggono la sensibilità, non la spengono.',
};

/** Il filo dell'anno per ogni segno. */
const YEAR: Record<string, string> = {
  aries: 'Quest’anno premia l’iniziativa che dura: cominciare ti viene facile, il valore sta nel finire.',
  taurus: 'Quest’anno ti chiede di capire che cosa ti dà sicurezza davvero e di lasciare ciò che è solo abitudine.',
  gemini: 'Quest’anno ruota intorno alle scelte: meno fronti aperti e più conversazioni che portano da qualche parte.',
  cancer: 'Quest’anno parla di prenderti cura degli altri senza consumarti, e di una casa che sia un rifugio e non un obbligo.',
  leo: 'Quest’anno separa l’essere visto dall’essere conosciuto, e dà valore a ciò che avrebbe senso anche senza applausi.',
  virgo: 'Quest’anno chiede ordine senza perfezionismo: migliorare ciò che conta e lasciar correre il resto.',
  libra: 'Quest’anno mette alla prova i tuoi accordi: quali sono equi e quali tieni in piedi solo per evitare uno scontro.',
  scorpio: 'Quest’anno parla di fiducia: a chi la dai, che cosa condividi e che cosa scegli di tenere per te.',
  sagittarius: 'Quest’anno ti invita a trasformare la curiosità in un piano con delle date precise.',
  capricorn: 'Quest’anno conferma ciò che hai costruito e ti mostra quale struttura non ti serve più.',
  aquarius: 'Quest’anno mette le tue idee accanto alle persone giuste: i progetti crescono in compagnia.',
  pisces: 'Quest’anno ti aiuta a dare forma a ciò che intuisci, con confini che ti proteggano.',
};

const KIND_LOVE: Record<string, string> = {
  aries: 'In amore l’Ariete ha bisogno di franchezza e di spazio per muoversi.',
  taurus: 'In amore il Toro dà più peso alla costanza che alle promesse.',
  gemini: 'In amore i Gemelli cercano dialogo e sorpresa in parti uguali.',
  cancer: 'In amore il Cancro si apre quando si sente al sicuro.',
  leo: 'In amore il Leone dà il meglio quando l’ammirazione va in tutte e due le direzioni.',
  virgo: 'In amore la Vergine dimostra l’affetto con gesti piccoli e precisi.',
  libra: 'In amore la Bilancia cerca reciprocità, non soltanto armonia.',
  scorpio: 'In amore lo Scorpione ha bisogno di verità prima che di intensità.',
  sagittarius: 'In amore il Sagittario vuole condividere la strada senza perdere la propria libertà.',
  capricorn: 'In amore il Capricorno si fida di ciò che si dimostra con il tempo.',
  aquarius: 'In amore l’Acquario ha bisogno di amicizia dentro la coppia.',
  pisces: 'In amore i Pesci danno molto; conviene che imparino anche a ricevere.',
};

const KIND_WORK: Record<string, string> = {
  aries: 'Sul lavoro l’Ariete rende al meglio quando può aprire la strada.',
  taurus: 'Sul lavoro il Toro rende con scadenze realistiche e risorse chiare.',
  gemini: 'Sul lavoro i Gemelli rendono quando possono spiegare e mettere in contatto le persone.',
  cancer: 'Sul lavoro il Cancro rende quando la squadra si sente seguita.',
  leo: 'Sul lavoro la visibilità aiuta il Leone quando ciò che c’è sotto è già pronto.',
  virgo: 'Sul lavoro la Vergine rende quando può migliorare un processo preciso.',
  libra: 'Sul lavoro la Bilancia rende quando media e tiene in equilibrio interessi diversi.',
  scorpio: 'Sul lavoro lo Scorpione rende quando può andare a fondo delle cose.',
  sagittarius: 'Sul lavoro il Sagittario rende quando vede dove va il progetto.',
  capricorn: 'Sul lavoro il Capricorno rende con obiettivi misurabili.',
  aquarius: 'Sul lavoro l’Acquario rende quando propone un modo diverso di fare le cose.',
  pisces: 'Sul lavoro i Pesci rendono quando il compito ha un senso chiaro.',
};

/** Il tono di un aspetto, valido per una casa sola o per due. */
const ASPECT_TONE: Record<string, string> = {
  conjunction: 'Le due spinte si sommano: quello che fai da una parte si sente anche dall’altra.',
  sextile: 'È un’occasione tranquilla: coglila con un passo piccolo e concreto.',
  square: 'C’è attrito: aggiusta una cosa prima di forzarne un’altra.',
  trine: 'Le cose scorrono: buon momento per avanzare senza strappi.',
  opposition: 'Le due spinte tirano in direzioni opposte: cerca il punto di equilibrio.',
};

const ASPECT_ARTICLE: Record<string, string> = { sextile: 'un', square: 'una', trine: 'un' };

function houseIn(house: number): string {
  return `nella tua ${ORDINAL[house]} casa`;
}

/** "la Luna è in Scorpione, nella tua quarta casa" */
function positionClause(fact: PositionFact): string {
  const rx = fact.retrograde ? ` ${retro(fact.body)}` : '';
  return `${subject(fact.body)}${rx} è in ${sign(fact.sign)}, ${houseIn(fact.house)}`;
}

/** L'evento in una frase, senza la data. */
function eventClause(fact: EventFact): string {
  const where = fact.sign ? sign(fact.sign) : '';
  switch (fact.eventKind) {
    case 'ingress':
      return `${subject(fact.body!)} entra in ${where}`;
    case 'station':
      return fact.eventType === 'retrograde'
        ? `${subject(fact.body!)} si ferma e comincia il moto retrogrado in ${where}`
        : `${subject(fact.body!)} riprende il moto diretto in ${where}`;
    case 'lunation':
      return fact.eventType === 'full' ? `arriva la Luna piena in ${where}` : `arriva la Luna nuova in ${where}`;
    case 'eclipse':
      return fact.eventType === 'solar' ? `c’è un’eclissi di Sole in ${where}` : `c’è un’eclissi di Luna in ${where}`;
    case 'aspect': {
      const a = subject(fact.a!);
      const b = subject(fact.b!);
      const type = fact.eventType ?? 'conjunction';
      if (type === 'conjunction') return `${a} si congiunge ${prep('a', b)}`;
      if (type === 'opposition') return `${a} si oppone ${prep('a', b)}`;
      return `${a} forma ${ASPECT_ARTICLE[type] ?? 'un'} ${aspectLabel(L, type)} con ${b}`;
    }
  }
}

/** L'ordine dei corpi, per variare la frase quando due eventi cadono in date vicine. */
const BODY_ORDER = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

/** Che cosa vuol dire l'evento nella casa in cui cade; la variante dipende dal giorno, così il testo non si ripete. */
function eventMeaning(fact: EventFact): string {
  const h = fact.houses[0];
  if (!h) return '';
  const theme = THEME[h];
  const body = BODY_ORDER.indexOf(fact.body ?? fact.a ?? '');
  const day = Number(fact.at.slice(8, 10)) + Number(fact.at.slice(5, 7)) + Math.max(body, 0);
  switch (fact.eventKind) {
    case 'ingress':
      return pick([
        `Si apre una fase lunga per ${theme}.`,
        `Comincia un capitolo nuovo che riguarda ${theme}.`,
        `Da quel giorno cambia il passo ${prepList('su', FOCUS[h])}.`,
      ], day);
    case 'station':
      return fact.eventType === 'retrograde'
        ? pick([
          `È il momento di rivedere ${theme}, prima di impegnarti in qualcosa di nuovo.`,
          `Conviene riprendere in mano con calma ${theme}.`,
          `Torna utile rimettere mano ${prepList('a', FOCUS[h])} e correggere quello che serve.`,
        ], day)
        : pick([
          `Quello che era rimasto in sospeso torna a muoversi, a cominciare ${prepList('da', FOCUS[h])}.`,
          `Riprende slancio tutto ciò che riguarda ${theme}.`,
          `Le decisioni rimandate ${prepList('su', FOCUS[h])} possono andare avanti.`,
        ], day);
    case 'lunation':
      return fact.eventType === 'full'
        ? `Arriva al punto qualcosa che maturava da tempo, e riguarda ${theme}.`
        : `È un buon inizio per ${theme}.`;
    case 'eclipse':
      return `Segna una svolta per ${theme}; meglio non forzare decisioni proprio quel giorno.`;
    case 'aspect': {
      const [h1, h2] = fact.houses;
      const tone = ASPECT_TONE[fact.eventType ?? 'conjunction'];
      return h2 && h2 !== h1
        ? `Mette in relazione due ambiti: da una parte ${FOCUS[h1]}, dall’altra ${FOCUS[h2]}. ${tone}`
        : `Tutto si gioca in un solo ambito: ${theme}. ${tone}`;
    }
  }
}

function factSentence(fact: Fact, when: 'tomorrow' | 'dated'): string {
  if (fact.kind === 'position') {
    const lead = when === 'tomorrow' ? 'domani ' : '';
    return `${cap(`${lead}${positionClause(fact)}`)}.`;
  }
  const clock = fact.eventKind === 'lunation' || fact.eventKind === 'eclipse' || fact.eventKind === 'aspect' ? ` alle ${utcClock(fact.at)}` : '';
  return `${cap(theDay(fact.at))}${clock} ${eventClause(fact)}. ${eventMeaning(fact)}`.trim();
}

const firstHouse = (facts: Fact[]) => facts.find((fact) => fact.kind === 'position')?.house
  ?? (facts.find((fact) => fact.kind === 'event') as EventFact | undefined)?.houses[0] ?? 1;

// ── Le pagine per periodo ──

const CLOSE_TOMORROW = [
  'Prepara stasera il primo passo: domani la giornata partirà più leggera.',
  'Annota oggi quello che non vuoi dimenticare domani.',
  'Se qualcosa può aspettare dopodomani, lascialo aspettare.',
  'Comincia da ciò che dipende solo da te.',
];

function tomorrow(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  const used = new Map<number, number>();
  return ctx.passages.map(({ facts, index }) => {
    const h = firstHouse(facts);
    const seen = used.get(h) ?? 0;
    const advice = seen === 0 ? ADVICE[h] : seen === 1 ? REFINE[h] : '';
    used.set(h, seen + 1);
    const sentences = facts.map((fact) => factSentence(fact, fact.kind === 'position' ? 'tomorrow' : 'dated'));
    if (index === 0) {
      return { text: `${sentences.join(' ')} In primo piano ci sono ${THEME[h]}. ${advice} ${KEY[s]}` };
    }
    if (index === ctx.passages.length - 1) {
      return { text: `${sentences.join(' ')} ${advice} ${pick(CLOSE_TOMORROW, idx(s))}` };
    }
    return { text: `${sentences.join(' ')} ${advice}` };
  });
}

const CLOSE_WEEK = [
  'Per il bilancio della domenica, tieni a mente una cosa che ha funzionato e una che cambieresti.',
  'Prima che cominci la settimana nuova, decidi che cosa non vuoi ripetere.',
  'Chiudi la settimana con qualcosa di finito, anche se piccolo.',
];

function weekly(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  const used = new Map<number, number>();
  const last = ctx.passages.length - 1;
  return ctx.passages.map(({ facts, index }) => {
    const moons = facts.filter((fact): fact is PositionFact => fact.kind === 'position');
    if (index === 0 && moons.length >= 2) {
      const [start, ...rest] = moons;
      const end = rest.at(-1)!;
      const mid = rest.length > 1 ? rest[0] : undefined;
      const midText = mid ? `; verso ${weekday(L, mid.at)} si sposta ${prepList('su', FOCUS[mid.house])}` : '';
      return {
        text: `La settimana ${range(ctx.from, ctx.through)} comincia con la Luna in ${sign(start.sign)}, che mette in luce ${THEME[start.house]}${midText}, e si chiude ${prepList('su', FOCUS[end.house])}. ${KEY[s]}`,
      };
    }
    const h = firstHouse(facts);
    const seen = used.get(h) ?? 0;
    const advice = seen === 0 ? ADVICE[h] : seen === 1 ? REFINE[h] : '';
    used.set(h, seen + 1);
    const event = facts.find((fact): fact is EventFact => fact.kind === 'event');
    if (event) return { text: factSentence(event, 'dated') };
    if (index === 1) return { text: `Nei primi giorni contano soprattutto ${THEME[h]}. ${advice}` };
    if (index === last) return { text: `La settimana si chiude con un tema in primo piano: ${THEME[h]}. ${advice} ${pick(CLOSE_WEEK, idx(s))}` };
    return { text: `A metà settimana l’attenzione si sposta: ${THEME[h]}. ${advice}` };
  });
}

const LOVE_CLOSE = [
  'Una domanda sincera chiarisce più di una supposizione.',
  'Guarda se la risposta dell’altra persona rende più facile lo spazio che condividete.',
  'Non serve risolvere tutto oggi: basta non nasconderlo.',
  'Di’ di che cosa hai bisogno con una frase semplice.',
];

function love(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  return ctx.passages.map(({ facts, index }) => {
    const h = firstHouse(facts);
    const sentences = facts.map((fact) => factSentence(fact, 'dated')).join(' ');
    if (index === 0) return { text: `${sentences} ${LOVE[h]} ${KIND_LOVE[s]}` };
    return { text: `${sentences} Il clima affettivo si sposta verso ${THEME[h]}. ${pick(LOVE_CLOSE, idx(s))}` };
  });
}

function career(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  return ctx.passages.map(({ facts, index }) => {
    const h = firstHouse(facts);
    const sentences = facts.map((fact) => factSentence(fact, 'dated')).join(' ');
    if (index === 0) return { text: `${sentences} ${WORK[h]} ${KIND_WORK[s]}` };
    return { text: `${sentences} Anche il lavoro passa da qui: ${THEME[h]}. ${REFINE[h]}` };
  });
}

// ── L'anno ──

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
    .map((fact) => `${cap(theDay(fact.at))} ${eventClause(fact)}. ${eventMeaning(fact)}`)
    .join(' ');
}

const THEMED_HEADINGS = [
  'Amore, amicizie e accordi chiari',
  'Lavoro, denaro e un’autorevolezza che regge',
  'Casa, riposo e il carico privato',
  'La tua strada',
];

const THEMED_LEADS = [
  'Negli affetti conta ciò che si vede: una richiesta, un accordo cambiato, un tempo difeso.',
  'Nel lavoro e nel denaro misura le forze, le scadenze e ciò che consegni, non solo la voglia di fare.',
  'In casa e nel riposo difendi l’essenziale: sonno, spazio e tempo senza obblighi.',
  'Sul piano personale la crescita serve quando cambia una decisione concreta.',
];

function yearly(ctx: PeriodContext, year: string): LocalizedPassage[] {
  const s = ctx.sign;
  const name = withArticle(sign(s));
  return ctx.passages.map(({ facts, index }) => {
    const events = facts.filter((fact): fact is EventFact => fact.kind === 'event');
    if (index === 0) {
      const first = events[0];
      const firstText = first ? ` La prima data da segnare è ${theDay(first.at)}: ${eventClause(first)}. ${eventMeaning(first)}` : '';
      return { heading: `Il ${year} ${prep('di', name)}`, text: `${YEAR[s]}${firstText}` };
    }
    if (index >= 1 && index <= 4) {
      const [from, to] = QUARTERS[index - 1];
      const h = dominantHouse(facts);
      const lead = pick([
        `Questo trimestre ruota intorno ${prepList('a', THEME[h])}.`,
        `In questi mesi l’attenzione va soprattutto ${prepList('a', FOCUS[h])}.`,
        `Qui il peso cade ${prepList('su', FOCUS[h])}.`,
      ], index, idx(s));
      return {
        heading: `Da ${monthName(L, from)} a ${monthName(L, to)}: ${SHORT[h].toLowerCase()}`,
        text: `${lead} ${datedList(facts)} ${REFINE[h]}`.trim(),
      };
    }
    if (index >= 5 && index <= 8) {
      const k = index - 5;
      const extra = k === 0 ? KIND_LOVE[s] : k === 1 ? KIND_WORK[s] : k === 3 ? KEY[s] : '';
      return { heading: THEMED_HEADINGS[k], text: `${THEMED_LEADS[k]} ${extra} ${datedList(facts)}` };
    }
    const dates = events.map((fact) => `${theDay(fact.at)} (${eventClause(fact)})`);
    const joined = dates.length > 1 ? `${dates.slice(0, -1).join(', ')} e ${dates.at(-1)}` : dates.join('');
    return {
      heading: dates.length === 3 ? 'Tre date per fare il punto sull’anno' : 'Le date per fare il punto sull’anno',
      text: `Segnati queste date per vedere come sta andando l’anno: ${joined}. A ognuna, annota che cosa è cambiato e che cosa vuoi tenere.`,
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

// ── Il mese ──

const CLOSE_MONTH = [
  'A fine mese, scegli una cosa che ha funzionato e portala nel mese successivo.',
  'Prima che cominci il mese nuovo, decidi che cosa non vuoi ripetere.',
  'Chiudi il mese con una faccenda risolta, anche se piccola.',
  'Rileggi a fine mese quello che ti eri segnato all’inizio e guarda che cosa è cambiato.',
];

function monthlyRaw(ctx: MonthlyContext): LocalizedPassage[] {
  const s = ctx.sign;
  const label = monthYear(L, ctx.month);
  const lunations = ctx.events.filter((fact) => fact.eventKind === 'lunation' || fact.eventKind === 'eclipse');
  const stations = ctx.events.filter((fact) => fact.eventKind === 'station');
  const ingresses = ctx.events.filter((fact) => fact.eventKind === 'ingress');
  const aspects = ctx.events.filter((fact) => fact.eventKind === 'aspect').slice(0, 4);
  const lead = lunations[0];
  const passages: LocalizedPassage[] = [{
    text: `${cap(label)} per ${withArticle(sign(s))}, con il tuo segno solare letto come prima casa, come fanno gli oroscopi mensili. ${lead ? `Il mese ruota intorno ${prepList('a', THEME[lead.houses[0]])}.` : ''} ${KEY[s]}`,
  }];
  if (lunations.length) passages.push({ heading: 'Le lune del mese', text: lunations.map((fact) => factSentence(fact, 'dated')).join(' ') });
  if (stations.length) passages.push({ heading: 'Pianeti che cambiano passo', text: stations.map((fact) => factSentence(fact, 'dated')).join(' ') });
  if (ingresses.length) passages.push({ heading: 'Cambi di segno', text: ingresses.map((fact) => factSentence(fact, 'dated')).join(' ') });
  if (aspects.length) passages.push({ heading: 'Aspetti esatti', text: aspects.map((fact) => factSentence(fact, 'dated')).join(' ') });
  const close = lead ? ADVICE[lead.houses[0]] : REFINE[1];
  passages.push({ heading: 'Per chiudere il mese', text: `${close} ${pick(CLOSE_MONTH, idx(s))}` });
  return passages;
}

function monthly(ctx: MonthlyContext): LocalizedPassage[] {
  return monthlyRaw(ctx).map((passage) => ({ ...passage, text: tidy(passage.text) }));
}

// ── La pagina ──

type ChromeCtx = { surface: PeriodSurface | 'monthly'; from: string; through: string; month?: string };

function periodPhrase(ctx: ChromeCtx): string {
  switch (ctx.surface) {
    case 'tomorrow': return `di domani, ${date(ctx.from)},`;
    case 'weekly': return `della settimana ${range(ctx.from, ctx.through)}`;
    case 'monthly': return `di ${monthYear(L, ctx.month!)}`;
    case 'love': return `dell’amore, ${date(ctx.from)},`;
    case 'career': return `del lavoro, ${date(ctx.from)},`;
    case 'yearly-2026': return 'del 2026';
    case 'yearly-2027': return 'del 2027';
  }
}

/** Il titolo intero se resta sotto i 60 caratteri, altrimenti la versione corta. */
const fit = (full: string, short: string) => (full.length < 60 ? full : short);

export const it: HoroscopeLocaleModule = {
  locale: L,
  period,
  monthly,
  chrome: {
    title: (name, ctx) => {
      const who = withArticle(name);
      switch (ctx.surface) {
        case 'tomorrow': return `Oroscopo di domani per ${who}, ${date(ctx.from)}`;
        case 'weekly': return fit(
          `Oroscopo settimanale per ${who}, ${range(ctx.from, ctx.through)}`,
          `Oroscopo settimanale per ${who}, ${prep('da', theDay(ctx.from))}`,
        );
        case 'monthly': return `Oroscopo mensile per ${who}: ${monthYear(L, ctx.month!)}`;
        case 'love': return `Oroscopo dell’amore per ${who}, oggi`;
        case 'career': return `Oroscopo del lavoro per ${who}, oggi`;
        case 'yearly-2026': return `Oroscopo 2026 per ${who}`;
        case 'yearly-2027': return `Oroscopo 2027 per ${who}`;
      }
    },
    h1: (name, ctx) => {
      const who = withArticle(name);
      switch (ctx.surface) {
        case 'tomorrow': return `Oroscopo di domani per ${who}`;
        case 'weekly': return `Oroscopo settimanale per ${who}`;
        case 'monthly': return `Oroscopo mensile per ${who}`;
        case 'love': return `Oroscopo dell’amore per ${who}`;
        case 'career': return `Oroscopo del lavoro per ${who}`;
        case 'yearly-2026': return `Oroscopo 2026 per ${who}`;
        case 'yearly-2027': return `Oroscopo 2027 per ${who}`;
      }
    },
    description: (name, ctx) => tidy(`L’oroscopo ${periodPhrase(ctx)} per ${withArticle(name)}, scritto a partire dal cielo calcolato: posizioni, lune e date esatte, contate dal tuo segno solare.`),
    periodLabel: {
      today: 'Oggi', tomorrow: 'Domani', weekly: 'Settimana', monthly: 'Mese', love: 'Amore', career: 'Lavoro', 'yearly-2026': '2026', 'yearly-2027': '2027',
    },
    crumbs: 'Oroscopi',
    switchAria: 'Scegli il periodo',
    skyHeading: 'Il cielo dietro questa lettura',
    skyIntro: 'Ogni frase poggia su questi dati, calcolati a mezzogiorno UTC oppure al minuto esatto dell’evento.',
    skyRow: (fact) => (fact.kind === 'position'
      ? `${cap(planet(fact.body))}${fact.retrograde ? ` ${retro(fact.body)}` : ''} in ${sign(fact.sign)}, casa ${fact.house} · ${dayMonthYear(L, fact.at)}`
      : `${cap(eventClause(fact))} · ${dayMonthYear(L, fact.at)}, ${utcClock(fact.at)}`),
    moreHeading: 'Altro per il tuo segno',
    signGuide: (name) => `Guida ${prep('a', withArticle(name))}`,
    pairs: (name) => `Affinità ${prep('di', withArticle(name))}`,
    calculator: 'Calcola il tuo tema natale',
    otherSigns: 'Gli altri segni',
    method: 'Le case si contano dal tuo segno solare (case solari a segno intero). Gli orari sono in UTC.',
    confidence: (value) => `Affidabilità della lettura ${value}%`,
    confidenceNote: 'Il numero dice quanto sono specifici i dati su cui poggia la lettura (qui, solo il segno solare), non la probabilità che qualcosa accada.',
    faq: (name, surface) => [
      {
        q: `Da dove nasce l’oroscopo ${prep('di', withArticle(name))}?`,
        a: 'Dalle posizioni calcolate dei pianeti e della Luna per queste date. Ogni frase rimanda al dato su cui si basa, e le case si contano dal tuo segno solare.',
      },
      {
        q: surface === 'weekly' ? 'Quale settimana copre?' : surface === 'monthly' ? 'Quale mese copre?' : 'Quando si aggiorna?',
        a: surface === 'weekly'
          ? 'La settimana va dal lunedì alla domenica in orario UTC e si rinnova ogni lunedì.'
          : surface === 'monthly'
            ? 'Copre il mese di calendario in UTC; quello del mese successivo esce il giorno 1.'
            : 'Si ricalcola ogni giorno con lo stesso cielo dell’edizione quotidiana.',
      },
      {
        q: 'Serve anche se non conosco la mia ora di nascita?',
        a: 'Sì. Questo oroscopo usa solo il segno solare. Con data, ora e luogo di nascita puoi calcolare il tuo tema natale completo e scoprire il tuo ascendente.',
      },
    ],
  },
};
