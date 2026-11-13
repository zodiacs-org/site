/**
 * Italian copy for the sign-season pages (/it/seasons/ and
 * /it/seasons/{sign}/), line for line with copy-en.ts: the same shape, the
 * same order of `asks` round the zodiac, and nothing that carries a date.
 * Sign and planet names come from the site's helpers (signs.ts and
 * i18n/astrology.ts); Italian puts an article before them, which ARTICLE
 * holds by sign. Tu, as the rest of the Italian site; no dashes, no health,
 * money or betting predictions, no guarantees.
 */
import { planetLabel } from '../i18n/astrology';
import { SIGNS, elementLabel, modalityLabel, signName } from '../signs';
import type { SeasonCopy, SeasonUi } from './copy-en';

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
type Article = 'l’' | 'il' | 'lo' | 'la' | 'i';
/** The article each sign takes: l’Ariete, il Toro, i Gemelli, lo Scorpione. */
const ARTICLE: Record<string, Article> = {
  aries: 'l’', taurus: 'il', gemini: 'i', cancer: 'il', leo: 'il', virgo: 'la',
  libra: 'la', scorpio: 'lo', sagittarius: 'il', capricorn: 'il', aquarius: 'l’', pisces: 'i',
};
const SLUG_BY_NAME = new Map(SIGNS.map((sign) => [signName(sign, 'it'), sign.slug]));
const articleOf = (sign: string): Article => ARTICLE[SLUG_BY_NAME.get(sign) ?? ''] ?? 'il';
/** "l’Ariete", "il Toro", "i Gemelli". */
const the = (sign: string) => (articleOf(sign) === 'l’' ? `l’${sign}` : `${articleOf(sign)} ${sign}`);
/** "dell’Ariete", "del Toro", "dei Gemelli", "della Vergine", "dello Scorpione". */
const of = (sign: string) => ({ 'l’': `dell’${sign}`, il: `del ${sign}`, lo: `dello ${sign}`, la: `della ${sign}`, i: `dei ${sign}` })[articleOf(sign)];
/** "nell’Ariete", "nel Toro", "nei Gemelli". */
const into = (sign: string) => ({ 'l’': `nell’${sign}`, il: `nel ${sign}`, lo: `nello ${sign}`, la: `nella ${sign}`, i: `nei ${sign}` })[articleOf(sign)];
const RULED: Record<string, string> = { Sun: 'Governato dal', Moon: 'Governato dalla' };
/** Days that start with a vowel sound take an elided article: "l’8 aprile", "dall’11 marzo". */
const elides = (date: string) => /^(?:8|11)\s/u.test(date);
const il = (date: string) => (elides(date) ? `l’${date}` : `il ${date}`);
const al = (date: string) => (elides(date) ? `all’${date}` : `al ${date}`);
const dal = (date: string) => (elides(date) ? `dall’${date}` : `dal ${date}`);

export const SEASON_HOUSE_ORDINALS_IT = [
  'prima', 'seconda', 'terza', 'quarta', 'quinta', 'sesta',
  'settima', 'ottava', 'nona', 'decima', 'undicesima', 'dodicesima',
] as const;

export const SEASON_UI_IT: SeasonUi = {
  dateLocale: 'it-IT',
  hubMetaTitle: 'Stagioni dei segni: quando ogni stagione dello zodiaco comincia e finisce',
  hubDescription: (title, until) => (title
    ? `È la ${lower(title)} fino ${al(until)}. Quando comincia e finisce ciascuna delle dodici stagioni dei segni, e che cosa chiede ciascuna a ogni segno.`
    : 'Quando comincia e finisce ciascuna delle dodici stagioni dei segni, e che cosa chiede ciascuna a ogni segno.'),
  hubFeatureLabel: 'Adesso e dopo',
  hubAllHeading: 'Tutte e dodici, nell’ordine in cui le raggiunge il Sole',
  hubNote: 'Le date sono in UTC. La pagina di ogni stagione riporta gli orari esatti nel tuo fuso orario, con un conto alla rovescia.',
  hubImageAlt: 'Stagioni dei segni, Zodiacs.org',
  range: (from, to) => `${dal(from)} ${al(to)}`,
  metaTitle: (title, year) => `${title} ${year ? `${year}: ` : ''}date, conto alla rovescia e che cosa chiede`,
  description: ({ title, sign, phase, start, end }) => (phase
    ? `${title} ${phase === 'under-way' ? 'è in corso' : 'comincia'}: il Sole entra ${into(sign)} ${il(start)} e ne esce ${il(end)}. Che cosa chiede la stagione a ciascuno dei dodici segni.`
    : `${title}: quando il Sole entra ${into(sign)} e quando ne esce, e che cosa chiede la stagione a ciascuno dei dodici segni.`),
  faq: ({ sign, phase, start, end, days, confidence, value }) => [
    ...(phase ? [{
      q: `Quando ${phase === 'under-way' ? 'finisce' : 'comincia'} la stagione ${of(sign)}?`,
      a: `Il Sole entra ${into(sign)} ${il(start)} e ne esce ${il(end)}, circa ${days} giorni dopo. La pagina mostra entrambi i momenti nel tuo fuso orario.`,
    }] : []),
    {
      q: `Perché le date ${of(sign)} cambiano da un anno all’altro?`,
      a: `Le date abituali ${of(sign)} sono una media. L’anno del calendario non dura un numero intero di giorni, quindi il momento in cui il Sole entra ${into(sign)} si sposta di qualche ora ogni anno e può cadere in un giorno vicino, anche a seconda del tuo fuso orario.`,
    },
    {
      q: `E se sono nato il primo o l’ultimo giorno della stagione ${of(sign)}?`,
      a: 'Il tuo segno solare dipende dal momento esatto della tua nascita, non dalle date medie. Un tema natale con la tua ora di nascita scioglie il dubbio.',
    },
    {
      q: `Che cosa vuol dire “${confidence}”?`,
      a: `Dice quanto è specifica una lettura. Una riga scritta per un solo segno solare, senza data né ora di nascita, ha ${value}%. Non è la probabilità che qualcosa accada.`,
    },
  ],
  quality: (modality, element) => `Segno ${lower(modalityLabel(modality, 'it'))} di ${lower(elementLabel(element, 'it'))}`,
  ruledBy: (ruler) => `${RULED[ruler] ?? 'Governato da'} ${planetLabel('it', ruler)}`,
  aboutDays: (days) => `Circa ${days} giorni`,
  imageAlt: (sign) => `${sign}, Zodiacs.org`,
  eventName: (title, year) => `${title} ${year}`,
  eventDescription: (sign, start, end) => `Il Sole è ${into(sign)} ${dal(start)} ${al(end)}.`,
  forSign: (sign) => `Per ${the(sign)}`,
  confidence: (value) => `Affidabilità della lettura ${value}%`,
  hubTitle: 'Stagioni dei segni',
  hubLede: 'Il Sole passa circa un mese in ogni segno. Ogni stagione ha il suo ritmo, e ciascuna chiede qualcosa di diverso a ogni segno. Ecco quando comincia e finisce ciascuna.',
  hubNow: 'Adesso',
  hubNext: 'Dopo',
  kicker: (sign) => `Il Sole in ${sign}`,
  title: (sign) => `Stagione ${of(sign)}`,
  enters: 'Il Sole entra',
  leaves: 'Il Sole esce',
  localNote: 'Gli orari sono mostrati nel tuo fuso orario. La tabella qui sotto li riporta in UTC.',
  startsIn: 'Comincia tra',
  endsIn: 'Finisce tra',
  upcoming: (date) => `Comincia ${il(date)}`,
  underWay: (date) => `In corso fino ${al(date)}`,
  noWindow: 'Le prossime date di questa stagione non sono ancora pubblicate.',
  days: 'giorni',
  hours: 'ore',
  minutes: 'min',
  seconds: 's',
  aboutHeading: 'Di che cosa parla la stagione',
  asksHeading: 'Che cosa chiede a ogni segno',
  asksLede: 'Leggi il tuo segno solare, e anche il tuo ascendente se lo conosci. Ogni riga segue la parte del tuo tema che la stagione attraversa.',
  houseLine: (house) => `La tua ${house} casa`,
  ownSeason: 'La tua stagione',
  readHoroscope: 'L’oroscopo di oggi',
  cardHeading: 'Condividi la stagione',
  cardLede: 'Un’immagine per le storie, 1080 per 1920, creata sul tuo dispositivo. Aggiungi un segno se vuoi: la card mostra il segno e niente di te.',
  cardSign: 'Aggiungi un segno',
  cardNoSign: 'Nessun segno, solo la stagione',
  cardMake: 'Crea l’immagine per le storie',
  cardShare: 'Condividi la storia',
  cardDownload: 'Scarica',
  cardPreparing: 'Creazione dell’immagine…',
  cardError: 'Questo browser non è riuscito a disegnare l’immagine.',
  cardPrivacy: 'Non viene inviato nulla finché non la condividi.',
  datesHeading: 'Anno per anno',
  datesLede: 'Gli istanti esatti in cui il Sole entra nel segno e ne esce, in UTC. Le date dei segni che si citano di solito sono medie; il passaggio vero si sposta fino a un giorno da un anno all’altro.',
  datesSeason: 'Stagione',
  datesEnters: 'Entra (UTC)',
  datesLeaves: 'Esce (UTC)',
  datesDays: 'Giorni',
  moreHeading: 'Per saperne di più',
  signGuide: (sign) => `La guida ${of(sign)}`,
  horoscope: (sign) => `Oroscopo ${of(sign)}`,
  allSeasons: 'Tutte e dodici le stagioni',
  birthChart: 'Il tuo tema natale',
  guideLead: 'Vuoi sapere che cosa significa la stagione per il tuo tema?',
  guideLabel: 'Chiedi a Guide di questa stagione',
  faqHeading: 'Domande e risposte',
};

export const SEASON_COPY_IT: Readonly<Record<string, SeasonCopy>> = {
  aries: {
    theme: 'Il Sole fa ripartire lo zodiaco: un mese per gli inizi, il coraggio e il primo passo.',
    about: [
      'La stagione dell’Ariete comincia all’equinozio di marzo, quando il Sole arriva a 0 gradi dell’Ariete e lo zodiaco ricomincia. L’astrologia la tratta come il vero capodanno. L’Ariete è un segno cardinale di fuoco governato da Marte, e tutto in lui punta ai primi passi.',
      'In parole semplici, è un mese per cominciare. Le idee che hanno passato l’inverno chiedono una prima bozza, una prima telefonata, un primo passo. L’energia è alta e la pazienza corta.',
      'Il rischio è l’impazienza. Dai ai progetti nuovi qualche settimana prima di giudicarli, e finisci una cosa ogni due che ne cominci.',
    ],
    asks: [
      'È la tua stagione, e il tuo anno gira. Comincia la cosa che rimandi da tempo, e lascia che la gente ti veda cominciarla.',
      'La tua stagione è la prossima, quindi questo è il mese tranquillo che la precede. Riposa, finisci ciò che è a metà e lascia andare qualcosa prima di ricominciare.',
      'Amici e gruppi si animano. Unisciti all’iniziativa, apri la chat di gruppo e di’ ad alta voce che cosa speri da quest’anno.',
      'Il tuo lavoro è in vetrina. Proponiti, candidati o metti il tuo nome su qualcosa; l’impegno fatto in pubblico vale doppio questo mese.',
      'L’orizzonte ti chiama. Prenota il viaggio, iscriviti al corso o difendi l’idea in cui credi davvero.',
      'Qualcosa di condiviso chiede di essere sistemato: una promessa, un favore da ricambiare, una questione di fiducia. Portalo allo scoperto e chiudilo con chiarezza.',
      'Sono gli altri a fare la prima mossa. Lascia che il partner o una persona vicina prenda l’iniziativa per una volta, e rispondi con franchezza.',
      'Le tue giornate vogliono una routine nuova. Scegli un’abitudine e cominciala di lunedì, senza annunciare una vita tutta nuova.',
      'Il gioco si fa più audace. Invita a uscire quella persona, comincia il progetto creativo prima di sentirti pronto e goditi l’essere principiante.',
      'L’energia nuova parte da casa. Aggiusta la cosa che ti dà fastidio ogni mattina, e affronta la conversazione di famiglia che tieni da parte da tempo.',
      'I messaggi corrono. Di’ subito la cosa diretta, rispondi a ciò che aspetta e fai la breve gita che continui a rimandare.',
      'La spinta nuova cade su ciò che possiedi e a cui tieni. Liberati di ciò che non usi più e metti il tuo impegno in ciò che ti mancherebbe.',
    ],
    guidePrompt: 'Che cosa chiede la stagione dell’Ariete al mio segno quest’anno?',
  },
  taurus: {
    theme: 'Il Sole rallenta nel Toro: un mese per la pazienza, il comfort e costruire qualcosa che duri.',
    about: [
      'La stagione del Toro segue la fretta dell’Ariete con un segno fisso di terra governato da Venere. Il Sole resta qui circa un mese, da fine aprile a maggio.',
      'È un mese per tenere duro. Porta avanti ciò che è cominciato in primavera, goditi quello che hai davanti e nota ciò a cui tieni abbastanza da prendertene cura.',
      'Il rischio è la testardaggine. Essere costanti va bene; restare bloccati no, quindi resta aperto ai piccoli cambiamenti.',
    ],
    asks: [
      'È la tua stagione. Prenditi il tuo tempo, rendi comodo il tuo ambiente e decidi che cosa vuoi costruire nell’anno che viene.',
      'La tua stagione è la prossima, quindi questo mese è per riposare. Dormi di più, resta un po’ più a casa e lascia andare una preoccupazione ostinata.',
      'Le amicizie chiedono tempo più che programmi. Organizza una lunga cena con i tuoi e trasforma una speranza comune in un piano concreto.',
      'Il tuo lavoro premia la costanza. Continua a fare ciò in cui sei bravo, in modo visibile e nei tempi, invece di cercare un cambiamento clamoroso.',
      'I progetti di viaggio o di studio vogliono una forma pratica. Scegli una data, metti da parte il tempo e fai un primo passo che stia in questa settimana.',
      'Le questioni condivise chiedono pazienza. La fiducia costruita piano è quella che regge, quindi non mettere fretta a nessuno perché ti dica più di quanto vuole.',
      'Il partner o un amico stretto vuole stabilità da te. Fatti trovare quando hai detto che ci saresti stato, e lascia parlare i piccoli gesti affidabili.',
      'Le routine si assestano. Costruisci un’abitudine quotidiana stabile e proteggila, e lascia che il lavoro davanti a te venga fatto bene più che in fretta.',
      'Il piacere è il punto di questo mese. Goditi il buon cibo, la buona compagnia e un passatempo manuale, e lascia che l’amore vada al suo ritmo.',
      'La casa chiede attenzione, e quell’attenzione può essere piacevole. Cucina, sposta i mobili, pianta qualcosa e tieni vicino chi fa sentire la casa un focolare.',
      'Le conversazioni rallentano e diventano pratiche. Parla meno e con peso, e mantieni le promesse fatte a vicini e fratelli.',
      'L’umore stabile cade su ciò che tieni e a cui dai valore. Abbi cura delle tue cose, ripara prima di sostituire e nota che cosa rende buona una giornata.',
    ],
    guidePrompt: 'Che cosa chiede la stagione del Toro al mio segno quest’anno?',
  },
  gemini: {
    theme: 'Il Sole passa nei Gemelli: un mese per la conversazione, la curiosità e tanti fili tenuti insieme.',
    about: [
      'La stagione dei Gemelli è un segno mobile d’aria governato da Mercurio. Va da fine maggio al solstizio di giugno.',
      'È un mese per parlare e imparare. I messaggi si moltiplicano, i piani cambiano in fretta e la curiosità è la guida migliore che hai.',
      'Il rischio è disperdersi. Scegli i due o tre fili che contano e lascia che il resto aspetti.',
    ],
    asks: [
      'È la tua stagione. Parla con persone nuove, segui la tua curiosità e lascia che il tuo anno cominci con qualche bella conversazione.',
      'La tua stagione è la prossima, quindi questo è il mese tranquillo che la precede. Scrivi le cose, tieni qualche pensiero per te e lascia riposare la mente.',
      'La tua agenda sociale si riempie. Di’ di sì al piano di gruppo, conosci gli amici degli amici e condividi l’idea su cui rimugini da tempo.',
      'Il lavoro gira sulla comunicazione. Manda la proposta, aggiorna il tuo profilo e assicurati che chi decide sappia che cosa stai facendo.',
      'La tua curiosità viaggia lontano. Leggi il libro, segui il corso, progetta il viaggio e parla con qualcuno che vede il mondo in modo diverso.',
      'Le domande sulla fiducia vogliono essere fatte ad alta voce. Fai la conversazione sincera su ciò che condividete, e leggi le clausole in piccolo prima di firmare.',
      'Le conversazioni con il partner contano più del solito. Ascolta che cosa ti viene chiesto davvero, e di’ con chiarezza di che cosa hai bisogno in cambio.',
      'La tua lista di cose da fare cresce in ogni direzione. Raggruppa i compiti piccoli, rispondi ai messaggi a blocchi e lascia spazi tra l’uno e l’altro.',
      'Flirt, giochi e giochi di parole vengono facili. Scrivi qualcosa per divertimento, fai tante domande a un appuntamento e tieni le cose leggere.',
      'La casa si fa rumorosa, nel senso buono. Parla con la famiglia, metti in ordine i cassetti e le carte, e invita gente.',
      'I messaggi si accumulano, e questo mese ti sta bene. Rispondi, chiama, scrivi e di’ di sì alla breve gita o al corso sotto casa.',
      'Le idee cadono su come usi il tuo tempo e su ciò a cui dai valore. Impara un’abilità che ti semplifichi le giornate, e scambia ciò che sai con chi ti sta intorno.',
    ],
    guidePrompt: 'Che cosa chiede la stagione dei Gemelli al mio segno quest’anno?',
  },
  cancer: {
    theme: 'Il Sole entra nel Cancro al solstizio di giugno: un mese per la casa, la cura e le persone che sono come una famiglia.',
    about: [
      'La stagione del Cancro comincia al solstizio di giugno, quando il Sole arriva a 0 gradi del Cancro. È un segno cardinale d’acqua governato dalla Luna.',
      'È un mese per prendersi cura delle persone e dei luoghi. Casa, famiglia, memoria e sentimenti passano in primo piano, e le piccole gentilezze fanno molta strada.',
      'Il rischio è chiudersi troppo nel proprio guscio. Lascia una porta aperta.',
    ],
    asks: [
      'È la tua stagione, e un momento per prenderti cura prima di te. Decidi come dovrebbero essere quest’anno la casa e l’appartenenza, e comincia da lì.',
      'La tua stagione è la prossima, quindi questo mese è per ritirarti un po’. Lascia che i vecchi sentimenti affiorino e passino, e torna riposato.',
      'Gli amici diventano famiglia questo mese. Ospita, fatti sentire con l’amico che si è fatto silenzioso e metti energia nel gruppo che ti sostiene.',
      'La tua vita pubblica chiede un tocco di cura. Abbi cura della tua squadra, fai da guida a qualcuno e lascia che la gente veda la parte di te che si preoccupa degli altri.',
      'La spinta va verso luoghi e idee che sanno di casa. Visita un posto a cui appartieni, o impara la storia del luogo da cui vieni.',
      'Sentimenti profondi affiorano attorno a ciò che condividi con gli altri. Sii sincero su che cosa ti serve per sentirti al sicuro, e chiedi lo stesso a loro.',
      'Il partner ha bisogno di cura e vuole darne. Fai spazio a una serata tranquilla insieme, e lascia che si prenda cura anche di te.',
      'Il tuo ritmo quotidiano chiede dolcezza. Crea piccole routine che si prendano cura di te, e non lasciare che il lavoro invada tutte le sere.',
      'L’affetto viene facile. Fai qualcosa con amore, passa del tempo senza fretta con le persone a cui sei affezionato e lascia che l’amore sia accogliente.',
      'Questo è il mese della casa. Passa del tempo con la famiglia o con chi è come una famiglia, e rendi una stanza un posto più bello in cui stare.',
      'Le parole portano più sentimento adesso. Fatti sentire con un fratello o un vicino, e di’ la cosa gentile invece di darla per scontata.',
      'La cura si rivolge a ciò che tieni. Fai in modo che il tuo spazio e le tue routine ti diano sicurezza, e tieniti stretto ciò che ha davvero senso per te.',
    ],
    guidePrompt: 'Che cosa chiede la stagione del Cancro al mio segno quest’anno?',
  },
  leo: {
    theme: 'Il Sole è a casa nel Leone: un mese per il calore, il lavoro creativo e lasciarti vedere.',
    about: [
      'La stagione del Leone è un segno fisso di fuoco governato dal Sole stesso, ed è per questo che gli astrologi lo chiamano il segno del Sole. Va da fine luglio a fine agosto.',
      'È un mese per la generosità e il gioco. Crea qualcosa, festeggia qualcuno e sali sul palco quando te lo offrono.',
      'Il rischio è l’orgoglio. Condividi la luce dei riflettori, e resta calda per tutti.',
    ],
    asks: [
      'È la tua stagione. Fatti vedere, festeggiati senza chiedere scusa e comincia il tuo anno con qualcosa che mostri chi sei.',
      'La tua stagione è la prossima, quindi esci per un po’ dai riflettori. Riposa, e preparati in silenzio per il tuo turno.',
      'Gli amici si stringono attorno a te, e tu attorno a loro. Organizza la festa, fai il tifo per il gruppo e racconta i tuoi piani per l’anno.',
      'Il tuo lavoro è sotto i riflettori. Guida il progetto, prenditi il merito che ti sei guadagnato e fatti avanti quando chiedono chi se ne occupa.',
      'Le grandi avventure chiamano. Viaggia in un posto pieno di colori, insegna ciò che sai e segui un’idea che ti faccia sentire più grande.',
      'La generosità mette alla prova la fiducia. Condividi a mani aperte dove è sicuro farlo, e sii sincero su che cosa vuoi in cambio.',
      'Il partner vuole essere festeggiato, e anche tu. Fai festa alle persone che ami, e lascia che la facciano a te.',
      'L’orgoglio per il lavoro ben fatto è il tema. Fai i compiti di ogni giorno con un po’ di stile, e lascia che i colleghi ti vedano brillare nelle cose normali.',
      'Questo è il tuo mese di ricreazione. Crea, flirta, esibisciti e di’ di sì a tutto ciò che ti fa ridere.',
      'La casa diventa un luogo di calore. Organizza una riunione, festeggia qualcuno della famiglia e rendi il posto luminoso.',
      'Parli con più sicurezza questo mese. Racconta la storia, fai il brindisi e manda il messaggio che illumina la giornata di qualcuno.',
      'Il calore arriva al senso del tuo valore. Credi in te, dai valore al tuo lavoro ad alta voce e dedica il tuo tempo a ciò che ti dà gioia.',
    ],
    guidePrompt: 'Che cosa chiede la stagione del Leone al mio segno quest’anno?',
  },
  virgo: {
    theme: 'Il Sole passa nella Vergine: un mese per mettere ordine, curare il mestiere e fare cose utili.',
    about: [
      'La stagione della Vergine è un segno mobile di terra governato da Mercurio. Va da fine agosto all’equinozio di settembre.',
      'È un mese per il mestiere e l’ordine. Le routine si ricostruiscono, i dettagli si controllano e i piccoli miglioramenti fanno un autunno migliore.',
      'Il rischio è fare i pignoli su tutto. Decidi quali dettagli contano e lascia che il resto sia abbastanza buono.',
    ],
    asks: [
      'È la tua stagione. Metti in ordine l’anno che viene: decidi che cosa conta, lascia perdere il resto e diventa molto bravo in una cosa.',
      'La tua stagione è la prossima. Smaltisci gli arretrati senza rumore, fai riposare la mente e lascia andare il bisogno di fare tutto alla perfezione.',
      'Gli amici possono contare sul tuo aiuto, e i gruppi sul tuo senso dell’ordine. Offri ciò che sai fare, e aiuta un piano di gruppo ad andare in porto.',
      'Il tuo lavoro si fa notare per la qualità. Rifinisci ciò che consegni, sistema il procedimento che fa perdere tempo a tutti e lascia parlare la tua competenza.',
      'Lo studio ti ripaga. Segui il corso, pianifica il viaggio nei dettagli e informati su qualcosa che hai sempre creduto senza verificare.',
      'Le questioni condivise chiedono attenzione accurata. Passa in rassegna ciò che devi e ciò che ti è dovuto, in favori e sulla carta, e sistema ciò che puoi.',
      'Il partner apprezza l’aiuto pratico. Fai la cosa utile senza che te lo chiedano, e parlate di come vi dividete i carichi.',
      'Questo è il mese delle routine. Pianifica le tue settimane, snellisci il lavoro e costruisci un ritmo quotidiano che riesci a mantenere.',
      'Il divertimento diventa mestiere. Pratica un passatempo finché non ci diventi bravo, e mostra affetto con piccoli favori utili.',
      'La casa chiede ordine. Svuota l’armadio, aggiusta ciò che è rotto e organizza la casa perché funzioni con meno fatica.',
      'I dettagli contano in ogni messaggio. Rileggi due volte, fai seguito e impara un’abilità nuova a piccoli passi ogni giorno.',
      'Il senso pratico cade su ciò che possiedi e a cui dai valore. Seleziona, ripara e organizza, e tieni ciò che è davvero utile.',
    ],
    guidePrompt: 'Che cosa chiede la stagione della Vergine al mio segno quest’anno?',
  },
  libra: {
    theme: 'Il Sole entra nella Bilancia all’equinozio di settembre: un mese per l’equilibrio, l’equità e le persone con cui fai coppia.',
    about: [
      'La stagione della Bilancia comincia all’equinozio di settembre, quando il giorno e la notte durano quasi lo stesso ovunque sulla Terra. È un segno cardinale d’aria governato da Venere.',
      'È un mese per le relazioni e l’equità. Coppie, accordi e decisioni condivise passano in primo piano, e la bellezza conta più del solito.',
      'Il rischio è rimandare le decisioni per accontentare tutti. Scegli, e scegli con gentilezza.',
    ],
    asks: [
      'È la tua stagione. Riequilibra la tua vita per l’anno che viene, e dedica tempo alle relazioni che ti fanno essere più te stesso.',
      'La tua stagione è la prossima, quindi riposati per un po’ dai bisogni degli altri, e trova il tuo equilibrio in privato.',
      'Le amicizie chiedono di essere riequilibrate. Cerca l’amico che cerca sempre te, e aiuta un gruppo ad arrivare a una decisione giusta.',
      'Il tuo lavoro adesso gira sulle relazioni. Collabora, fai una presentazione tra due persone e sii chi tiene la pace nella stanza.',
      'Gli altri punti di vista sono l’avventura. Viaggia con qualcuno, studia in coppia e discuti in buona fede di qualcosa che conta.',
      'La domanda è l’equità in ciò che condividi. Solleva uno squilibrio con calma, e accordatevi su condizioni che entrambi potete mantenere.',
      'Questo è il mese della coppia. Prendi un impegno, negozia o parla sinceramente di ciò di cui ha bisogno ciascuno, faccia a faccia.',
      'Le tue giornate vogliono equilibrio. Distribuisci il carico di lavoro, dividi i compiti in modo equo e smetti di dire sì a tutto.',
      'L’amore e l’arte fioriscono. Esci per appuntamenti, vai nelle gallerie e crea qualcosa solo perché è bello.',
      'La casa chiede armonia. Risolvi con equità un disaccordo domestico, e rendi un angolo della casa calmo e bello.',
      'La diplomazia ti viene facile. Chiarisci un malinteso, e ascolta entrambe le parti prima di dire la tua.',
      'L’equilibrio si rivolge a ciò a cui dai valore. Confronta ciò che dai con ciò che ricevi, e rendi il tuo ambiente un po’ più bello.',
    ],
    guidePrompt: 'Che cosa chiede la stagione della Bilancia al mio segno quest’anno?',
  },
  scorpio: {
    theme: 'Il Sole va in profondità nello Scorpione: un mese per la sincerità, la fiducia e lasciar andare ciò che è finito.',
    about: [
      'La stagione dello Scorpione è un segno fisso d’acqua, governato da Plutone nell’astrologia moderna e da Marte nella tradizione antica. Va da fine ottobre a fine novembre.',
      'È un mese per la profondità. Le conversazioni diventano vere, la lealtà viene messa alla prova e ciò che ha fatto il suo corso può finire senza scenate.',
      'Il rischio è il segreto fine a sé stesso. Fidati di chi se l’è guadagnato.',
    ],
    asks: [
      'È la tua stagione. Decidi a che cosa ti dedicherai fino in fondo quest’anno, e lascia andare ciò che vuoi solo a metà.',
      'La tua stagione è la prossima. Passa del tempo da solo, lascia che qualcosa finisca con eleganza ed esci dal mese più leggero.',
      'Le amicizie vengono messe alla prova e ne escono più forti. Tieni vicino gli amici di cui ti fidi, e lascia spegnersi un gruppo che non ti somiglia più.',
      'Il tuo lavoro guadagna da una strategia silenziosa. Prepara la mossa, tieni le carte coperte e mostra risultati invece di intenzioni.',
      'Vuoi risposte, non chiacchiere. Studia ciò che ti affascina, viaggia in un posto carico di storia e metti in discussione una convinzione che hai ereditato.',
      'Un mese forte per la fiducia. Condividi ciò che hai trattenuto con qualcuno che se l’è guadagnato, e chiudete ciò che è rimasto in sospeso tra voi.',
      'Il partner chiede lealtà e sincerità. Di’ ciò che senti, e lascia che una relazione si faccia più profonda o cambi forma.',
      'Il tuo lavoro va a fondo. Fai una cosa alla volta, arriva alla radice del problema e lascia le routine che ti sfiniscono.',
      'La passione è alta. Lascia che l’amore si faccia serio, e buttati in un progetto creativo che significhi qualcosa per te.',
      'Possono riaffiorare vecchie questioni di famiglia. Affrontale con sincerità e in privato, e svuota la stanza che custodisce il passato.',
      'Le conversazioni scavano. Fai la domanda che hai evitato, e ascolta ciò che non viene detto.',
      'L’intensità cade su ciò a cui dai valore. Tieniti stretto ciò che è davvero tuo, e lascia andare ciò che tieni solo per abitudine.',
    ],
    guidePrompt: 'Che cosa chiede la stagione dello Scorpione al mio segno quest’anno?',
  },
  sagittarius: {
    theme: 'Il Sole raggiunge il Sagittario: un mese per gli orizzonti, le parole franche e il quadro d’insieme prima che l’anno giri.',
    about: [
      'La stagione del Sagittario comincia quando il Sole arriva a 0 gradi del Sagittario a fine novembre, e dura fino al solstizio di dicembre, quando il Sole passa nel Capricorno. È un segno mobile di fuoco governato da Giove, e l’ultimo tratto dell’anno del calendario cade al suo interno.',
      'È un mese per allargare lo sguardo. Viaggi, studio, convinzioni e umorismo passano in primo piano, e anche dire chiaramente ciò che pensi. Dopo l’intensità della stagione dello Scorpione di solito sembra più leggera, e un po’ irrequieta.',
      'Il Sagittario è raffigurato come un arciere, e la stagione funziona allo stesso modo: scegli un bersaglio lontano, poi mira. Il rischio è promettere più di quanto stia nelle settimane prima delle feste, quindi scegli l’avventura che conta e lascia spazio al resto.',
    ],
    asks: [
      'È la tua stagione, e il tuo anno comincia qui. Di’ di sì al viaggio, al corso o alla grande domanda che ti porti dietro, e sii sincero su ciò che vuoi dopo.',
      'La tua stagione è la prossima, quindi questo è il mese tranquillo che la precede. Riposa, ripensa all’anno e lascia andare una convinzione che non ti somiglia più.',
      'Gli amici allargano il tuo mondo. Conosci persone di altri posti, entra in un gruppo che condivide i tuoi interessi e di’ ad alta voce che cosa speri dall’anno prossimo.',
      'Il tuo lavoro vuole una visione più ampia. Condividi il piano lungo, punta più in alto dell’anno scorso e lascia che il tuo entusiasmo si veda da chi decide.',
      'Questo è il tuo mese per l’orizzonte. Viaggia, studia, pubblica o leggi del posto che vuoi vedere, e segui l’idea che ti entusiasma di più.',
      'Emergono grandi domande sulla fiducia e su ciò che condividi. Parlatene apertamente e con buon umore, e mettetevi d’accordo su ciò che ciascuno può promettere.',
      'Il partner porta l’avventura. Organizzate un viaggio insieme, ascolta come vede il mondo e di’ chiaramente come la pensi.',
      'Le tue routine vogliono più spazio per muoversi. Fai una passeggiata all’aperto, impara qualcosa in pausa pranzo e sii onesto con la tua lista su ciò che sta in una giornata.',
      'Il divertimento si fa avventuroso. Vai in un posto nuovo per un appuntamento, ridi più del previsto e comincia un progetto creativo senza una fine in vista.',
      'La casa apre le porte. Accogli ospiti, parla della storia di famiglia durante un lungo pranzo e fai spazio a qualcuno che viene da lontano.',
      'Questo mese dici ciò che pensi, e la gente ascolta. Resta gentile oltre che sincero, e fai la breve gita che diventa una storia.',
      'L’ottimismo cade su ciò a cui dai valore. Dedica il tuo tempo a ciò in cui credi, sii generoso dove conta e conserva il senso dell’umorismo davanti a ciò che non puoi controllare.',
    ],
    guidePrompt: 'Che cosa chiede la stagione del Sagittario al mio segno quest’anno?',
  },
  capricorn: {
    theme: 'Il Sole entra nel Capricorno al solstizio di dicembre: un mese per la struttura, gli obiettivi lunghi e il lavoro che dura.',
    about: [
      'La stagione del Capricorno comincia al solstizio di dicembre e porta il calendario fino all’anno nuovo. È un segno cardinale di terra governato da Saturno.',
      'È un mese per i progetti che intendi mantenere. Si fissano gli obiettivi, si mettono in ordine le responsabilità e la pazienza ripaga in modi che si vedono.',
      'Il rischio è tutto lavoro e niente calore. Trova tempo per le persone per cui lavori.',
    ],
    asks: [
      'È la tua stagione. Fissa gli obiettivi del tuo anno, pianifica i passi e prendi sul serio le tue ambizioni senza scusarti.',
      'La tua stagione è la prossima. Riposati dalle tue responsabilità, rivedi l’anno con sincerità e alleggerisci il carico.',
      'Amicizie e gruppi chiedono di pensare a lungo termine. Trova tempo per le persone che restano, e dai un po’ di struttura a un piano di gruppo.',
      'Questo è il mese del tuo lavoro. Assumiti responsabilità, punta all’obiettivo lungo e lascia che il tuo impegno sia visto dalle persone che contano.',
      'Imparare si fa serio. Impegnati in un corso, pianifica un viaggio con cura e costruisci la tua competenza un passo alla volta.',
      'Le responsabilità condivise chiedono di essere chiarite. Guarda ciò che porti per gli altri e ciò che gli altri portano per te, e rendi l’accordo giusto e chiaro.',
      'Il partner vuole impegno e patti chiari. Parlate insieme del futuro, e sii qualcuno su cui può contare.',
      'Le routine diventano le fondamenta. Fissa un orario che riesci a rispettare, e costruisci abitudini per il lungo periodo invece di vittorie rapide.',
      'Il gioco prende uno scopo. Pratica l’abilità creativa che vuoi padroneggiare, e lascia che l’amore sia stabile più che drammatico.',
      'La casa chiede struttura. Aggiusta ciò che va aggiustato, prendi la decisione a lungo termine su dove vivi e mantieni le tradizioni di famiglia a cui tieni.',
      'Le parole pesano questo mese. Parla meno, con peso, e mantieni gli impegni con le persone che hai intorno.',
      'La struttura cade su ciò che possiedi e a cui dai valore. Fai un piano per le cose che ti stanno a cuore, e metti il tuo impegno in ciò che dura.',
    ],
    guidePrompt: 'Che cosa chiede la stagione del Capricorno al mio segno quest’anno?',
  },
  aquarius: {
    theme: 'Il Sole passa nell’Acquario: un mese per gli amici, le idee nuove e fare le cose a modo tuo.',
    about: [
      'La stagione dell’Acquario è un segno fisso d’aria, governato da Urano nell’astrologia moderna e da Saturno nella tradizione antica. Va da fine gennaio a metà febbraio.',
      'È un mese per la comunità e l’indipendenza insieme. Gruppi, amicizie e cause passano in primo piano, con idee che rompono con l’abitudine.',
      'Il rischio è tenere le persone a distanza. Lascia entrare i tuoi amici.',
    ],
    asks: [
      'È la tua stagione. Fai le cose a modo tuo, prova un’idea nuova e passa l’anno con persone che ti lasciano essere te stesso.',
      'La tua stagione è la prossima. Fai un passo indietro dalla folla, riposa e sogna in silenzio ciò che viene.',
      'Questo è il mese degli amici e della comunità. Riunisci i tuoi, unisciti a una causa e condividi le tue speranze per il futuro.',
      'Il tuo lavoro guadagna dalle idee nuove. Proponi l’idea nuova, lavora in squadra e prendi la strada che ti somiglia di più.',
      'Le idee viaggiano lontano questo mese. Studia qualcosa di nuovo, entra in contatto con persone lontane e lascia che le tue opinioni si aggiornino.',
      'Ciò che condividi con gli altri chiede uno sguardo nuovo. Ripensa un accordo che non funziona più, e sii sincero sul tuo bisogno di indipendenza.',
      'Il partner ha bisogno di libertà oltre che di vicinanza. Datevi spazio, e parlate del futuro che volete insieme.',
      'La tua routine quotidiana è pronta per un aggiornamento. Prova uno strumento nuovo o un modo nuovo di lavorare, e fai in modo che le giornate si adattino a te e non il contrario.',
      'Il divertimento si fa insolito. Prova un passatempo che non avresti mai scelto, flirta con qualcuno di inaspettato e crea qualcosa di sperimentale.',
      'La casa chiede un cambio di disposizione o di routine. Prova una sistemazione nuova, e dai a tutti in casa più spazio per essere sé stessi.',
      'I tuoi messaggi portano idee originali. Condividile, unisciti a una conversazione nel tuo quartiere o online e impara qualcosa di nuovo.',
      'Le idee nuove cadono su ciò a cui dai valore. Ripensa a come usi il tuo tempo, e tieni ciò che si adatta alla persona che stai diventando.',
    ],
    guidePrompt: 'Che cosa chiede la stagione dell’Acquario al mio segno quest’anno?',
  },
  pisces: {
    theme: 'Il Sole chiude il suo giro nei Pesci: un mese per l’immaginazione, il riposo e lasciar andare l’anno vecchio.',
    about: [
      'La stagione dei Pesci è l’ultima delle dodici, un segno mobile d’acqua governato da Nettuno nell’astrologia moderna e da Giove nella tradizione antica. Va da metà febbraio all’equinozio di marzo, quando la stagione dell’Ariete fa ripartire lo zodiaco.',
      'È un mese per la dolcezza e l’immaginazione. Arte, musica, compassione e riposo passano in primo piano, e le fini arrivano più facilmente del solito.',
      'Il rischio è andare alla deriva. Dai ai tuoi sogni a occhi aperti un passo pratico.',
    ],
    asks: [
      'È la tua stagione. Segui la tua immaginazione, sii gentile con te stesso e comincia il tuo anno con qualcosa di creativo.',
      'La tua stagione è la prossima, e l’anno dello zodiaco sta finendo. Riposa, lascia andare gli avanzi dell’anno e preparati a ripartire da capo.',
      'Gli amici offrono conforto. Passa del tempo con chi ti capisce, e aiuta un gruppo con una gentilezza silenziosa.',
      'Il tuo lavoro guadagna dall’immaginazione. Porta un’idea creativa al tavolo, e lascia che la compassione guidi il tuo modo di guidare gli altri.',
      'La tua mente vaga lontano. Leggi poesia, esplora un’idea che ti commuove o viaggia in un posto vicino all’acqua.',
      'I sentimenti vanno in profondità in ciò che condividi. Fidati del tuo istinto su a chi aprirti, e lascia andare una vecchia ferita.',
      'Il partner ha bisogno di comprensione. Ascolta con pazienza, perdona un piccolo sgarbo e condividete i vostri sogni.',
      'Le tue routine chiedono dolcezza. Aggiungi riposo alle tue giornate, e aiuta qualcuno al lavoro senza tenere il conto.',
      'L’amore e l’arte diventano sognanti. Crea senza giudicare, goditi la musica e i film, e lascia che una cotta resti un po’ misteriosa.',
      'La casa diventa un rifugio. Rendila tranquilla, passa del tempo sereno con la famiglia e lascia che i vecchi ricordi affiorino piano.',
      'Le parole arrivano con il sentimento. Scrivi, disegna o parla di ciò che ti commuove, e sii gentile nei tuoi messaggi.',
      'La compassione cade su ciò a cui dai valore. Dona dove significa qualcosa, e tieniti strette le cose che ti ispirano.',
    ],
    guidePrompt: 'Che cosa chiede la stagione dei Pesci al mio segno quest’anno?',
  },
};
