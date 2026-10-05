import type { Sign } from '../lib/signs';

export interface ItalianGuide {
  sign: string;
  title: string;
  description: string;
  intro: string[];
  sections: { heading: string; body: string[]; risingProfile?: boolean }[];
  faq: { q: string; a: string }[];
}

interface Profile {
  name: string;
  dates: string;
  elementMode: string;
  ruler: string;
  core: string;
  strength: string;
  shadow: string;
  love: string;
  friendship: string;
  work: string;
  purpose: string;
  growth: string;
  sun: string;
  moon: string;
  rising: string;
  venus: string;
  mars: string;
  house: string;
  ease: string;
  tension: string;
  care: string;
  privateTruth: string;
}

const EDGE_COPY = 'Se la tua data di nascita è vicina a un cambio di segno, calcola il tuo tema natale: il Sole non cambia segno alla stessa ora ogni anno.';

const PROFILES: Record<string, Profile> = {
  aries: {
    name: 'Ariete', dates: 'dal 21 marzo al 19 aprile', elementMode: 'fuoco cardinale', ruler: 'Marte',
    core: 'un temperamento rapido, diretto e poco incline a lasciarsi convincere dalle scuse',
    strength: 'mettere in moto ciò su cui gli altri stanno ancora riflettendo e trasformare una possibilità in azione',
    shadow: 'confondere l’urgenza con la verità o abbandonare qualcosa quando l’entusiasmo iniziale cala',
    love: 'desiderio chiaro, gioco, onestà e una persona che non cerchi di spegnere il suo slancio',
    friendship: 'legami vivi, programmi spontanei e persone capaci di dire sì senza convocare un comitato',
    work: 'avviare progetti, risolvere le emergenze, competere apertamente e aprire la strada',
    purpose: 'imparare a iniziare senza esaurirsi, guidare senza travolgere e scegliere le battaglie che meritano il suo fuoco',
    growth: 'rallentare abbastanza da ascoltare, portare a termine ciò che conta e non trattare ogni ritardo come una sconfitta',
    sun: 'un’identità che si scopre agendo e si riconosce quando ha qualcosa da cominciare', moon: 'emozioni immediate: sente in fretta, si arrabbia in fretta e può ritrovare altrettanto rapidamente lo slancio vitale',
    rising: 'una presenza diretta, giovane e fisica, che entra in una stanza come se avesse già deciso di avanzare', venus: 'un amore che fa il primo passo, dice ciò che vuole e preferisce una scintilla onesta a una storia tiepida',
    mars: 'desiderio e conflitto allo stato puro: azione visibile, competizione aperta e poca pazienza per i giri di parole', house: 'l’ambito in cui hai bisogno di autonomia, decisione e del permesso di provare prima di avere garanzie',
    ease: 'Leone, Sagittario e Gemelli alimentano spesso il suo entusiasmo senza chiedergli di diventare un’altra persona', tension: 'Cancro, Capricorno e Bilancia gli mostrano il valore della pausa, della cura e della negoziazione',
    care: 'muoversi, sudare, riposare dopo lo sforzo e trovare uno sfogo sano alla rabbia',
    privateTruth: 'L’Ariete non sempre vuole vincere; spesso vuole sentirsi vivo e libero di provarci',
  },
  taurus: {
    name: 'Toro', dates: 'dal 20 aprile al 20 maggio', elementMode: 'terra fissa', ruler: 'Venere',
    core: 'un temperamento calmo, sensoriale e più resistente di quanto sembri a prima vista',
    strength: 'rendere abitabile la vita prendendosi cura con costanza dei corpi, dei ritmi, delle risorse e dei legami',
    shadow: 'restare troppo a lungo dove non cresce più nulla perché ciò che è noto sembra più sicuro',
    love: 'lealtà, contatto, coerenza e gesti percepibili nella vita quotidiana',
    friendship: 'amicizie affidabili, buon cibo, musica, ricordi e una presenza senza fretta',
    work: 'creare valore, sostenere i processi, amministrare le risorse e migliorare il concreto con buon gusto',
    purpose: 'capire che la stabilità non è immobilità, ma una base da cui il desiderio può respirare',
    growth: 'lasciare andare prima di irrigidirsi, distinguere la lealtà dall’abitudine e accettare che anche il cambiamento possa essere una forma di cura',
    sun: 'un’identità che ha bisogno di tempo, corpo e un rapporto chiaro con ciò che ha valore', moon: 'emozioni che si regolano con sicurezza, contatto, routine e segnali ripetuti di fiducia',
    rising: 'una presenza tranquilla, salda e attraente, che il mondo legge come difficile da smuovere con la pressione', venus: 'un amore sensuale e paziente, con una memoria fine per il piacere e la cura concreta',
    mars: 'un desiderio costante: tarda a partire, ma una volta presa una decisione possiede una forza enorme', house: 'l’ambito in cui cerchi calma, una sicurezza che venga da dentro, piaceri semplici e decisioni sostenibili',
    ease: 'Vergine, Capricorno e Cancro spesso comprendono il suo bisogno di fiducia e di un ritmo proprio', tension: 'Leone, Acquario e Scorpione possono portare orgoglio, intensità e un’attrazione che richiede flessibilità',
    care: 'sonno regolare, buon cibo, contatto, natura e meno pressione a rispondere subito',
    privateTruth: 'Il Toro non è ostinato per sport; protegge ciò che ha impiegato molto tempo ad amare',
  },
  gemini: {
    name: 'Gemelli', dates: 'dal 21 maggio al 20 giugno', elementMode: 'aria mobile', ruler: 'Mercurio',
    core: 'un temperamento curioso, verbale, mobile e capace di trovare tre prospettive dove altri ne vedono una',
    strength: 'aprire finestre, collegando persone, idee, dati e possibilità con una rapidità contagiosa',
    shadow: 'muoversi tanto in fretta da non lasciare a una domanda importante il tempo di diventare conoscenza profonda',
    love: 'conversazione, umorismo, libertà mentale e un legame che non punisca la curiosità',
    friendship: 'legami stimolanti, messaggi a tarda ora, programmi che cambiano e complicità nel pensare ad alta voce',
    work: 'comunicare, tradurre, insegnare, vendere, indagare, scrivere e cogliere gli schemi mentre si formano',
    purpose: 'trasformare le informazioni in un linguaggio utile senza perdere il piacere di fare domande',
    growth: 'restare in una conversazione difficile, proteggere l’attenzione e non usare l’ingegno per eludere la vulnerabilità',
    sun: 'un’identità fatta di apprendimento, che si riconosce quando può dare un nome, confrontare e cambiare idea', moon: 'emozioni che hanno bisogno di parlare, scrivere o muoversi per capire ciò che sentono',
    rising: 'una presenza leggera, espressiva e vigile, che sembra accorgersi di tutto prima ancora che venga detto', venus: 'un amore che comincia nella mente e cresce con il gioco, i messaggi, i riferimenti condivisi e le risate',
    mars: 'un desiderio irrequieto che discute, prova, fa domande e può stancarsi quando mancano gli stimoli', house: 'l’ambito in cui hai bisogno di varietà, linguaggio, scambio e del permesso di sperimentare',
    ease: 'Bilancia, Acquario e Ariete offrono loro aria, slancio e una sensazione di movimento condiviso', tension: 'Vergine, Pesci e Sagittario possono creare tensioni tra dettaglio, sogno e verità, ma anche allargare il loro sguardo',
    care: 'meno schermi prima di dormire, passeggiate, respiro e spazi in cui la mente non debba produrre',
    privateTruth: 'I Gemelli non cambiano perché non sentono; cambiano perché percepiscono troppo per fingere una sola risposta',
  },
  cancer: {
    name: 'Cancro', dates: 'dal 21 giugno al 22 luglio', elementMode: 'acqua cardinale', ruler: 'la Luna',
    core: 'un temperamento intuitivo, protettivo e più forte quando può prendersi cura senza nascondersi',
    strength: 'creare un rifugio, ricordando, accompagnando, nutrendo e leggendo i bisogni prima che abbiano parole',
    shadow: 'aspettare che gli altri indovinino cosa fa male o chiudersi nel guscio quando basterebbe una richiesta',
    love: 'tenerezza affidabile, memoria condivisa, reciprocità emotiva e una casa simbolica a cui tornare',
    friendship: 'legami leali, conversazioni intime e persone che comprendono il peso dei piccoli gesti',
    work: 'prendersi cura, conservare, progettare case, sostenere le squadre, raccontare la memoria e proteggere ciò che è vulnerabile',
    purpose: 'imparare che sensibilità e chiarezza possono convivere: prendersi cura non richiede di scomparire',
    growth: 'esprimere i bisogni prima che diventino risentimento, accettare aiuto e non leggere ogni distanza come abbandono',
    sun: 'un’identità che si organizza attorno all’appartenenza, alla memoria e alla protezione', moon: 'emozioni molto forti perché la Luna è nel proprio domicilio, che richiedono sicurezza, ritmi e il permesso di sentire',
    rising: 'una presenza attenta e sensibile, che all’inizio può sembrare riservata e poi profondamente vicina', venus: 'un amore nutriente, attento e nostalgico, con il desiderio di creare un mondo privato per due',
    mars: 'un’azione protettiva che combatte per chi ama, anche se a volte si muove di lato prima di affrontare direttamente', house: 'l’ambito in cui hai bisogno di un senso di casa, intimità, cura e un legame onesto con le tue radici',
    ease: 'Scorpione, Pesci e Toro spesso comprendono la sua profondità emotiva e il suo bisogno di fiducia', tension: 'Ariete, Bilancia e Capricorno possono insegnargli indipendenza, negoziazione e struttura',
    care: 'cibo semplice, riposo, acqua, rituali domestici e limiti chiari di fronte ai drammi altrui',
    privateTruth: 'Il Cancro non è fragile; è permeabile, e per questo deve scegliere con cura chi può entrare',
  },
  leo: {
    name: 'Leone', dates: 'dal 23 luglio al 22 agosto', elementMode: 'fuoco fisso', ruler: 'il Sole',
    core: 'un temperamento caloroso, leale, teatrale quando serve e fiero di ciò che ama',
    strength: 'dare vita a una scena, incoraggiando, celebrando, creando e ricordando agli altri che anche loro possono brillare',
    shadow: 'dipendere troppo dallo sguardo esterno o confondere l’orgoglio con una protezione necessaria',
    love: 'la gioia di sentirsi scelto, il gioco, attenzioni vere e la libertà di donare affetto senza essere usato',
    friendship: 'legami generosi, celebrazioni, progetti creativi e lealtà visibili',
    work: 'guidare, recitare, insegnare, progettare esperienze, dirigere squadre e sostenere una visione con il cuore',
    purpose: 'creare dal proprio centro invece che dal bisogno di approvazione',
    growth: 'ascoltare anche quando non è al centro, chiedere affetto senza mettere in scena un dramma e condividere la scena',
    sun: 'un’identità solare rafforzata dal fatto che il Sole è nel proprio domicilio: vitalità, capacità di essere autore della propria vita e desiderio di vivere con presenza', moon: 'emozioni che hanno bisogno di riconoscimento, calore e di un luogo in cui il cuore non sembri eccessivo',
    rising: 'una presenza magnetica, espressiva e memorabile, che tende a entrare con una luce difficile da ignorare', venus: 'un amore espansivo, romantico e generoso, che ama sentirsi speciale e far sentire speciale l’altra persona',
    mars: 'un desiderio teatrale e leale, che combatte con orgoglio, difende ciò che ama e ha bisogno di una causa degna', house: 'l’ambito in cui vuoi creare, giocare, guidare e firmare qualcosa con il tuo nome',
    ease: 'Ariete, Sagittario e Bilancia spesso alimentano la sua gioia, il suo fuoco e il gusto per lo scambio', tension: 'Toro, Scorpione e Acquario possono mostrargli pazienza, profondità e distacco',
    care: 'sole, movimento piacevole, gioco, arte e una pausa dal bisogno di essere sempre acceso',
    privateTruth: 'Il Leone non vuole soltanto attenzione; vuole che il suo amore venga accolto con la stessa grandezza con cui lo offre',
  },
  virgo: {
    name: 'Vergine', dates: 'dal 23 agosto al 22 settembre', elementMode: 'terra mobile', ruler: 'Mercurio',
    core: 'un temperamento attento, utile, preciso e più sensibile di quanto lasci vedere la sua efficienza',
    strength: 'migliorare ciò che tocca, ordinando, rivedendo, riparando e trasformando un’idea in qualcosa che funziona',
    shadow: 'confondere il valore con la perfezione o usare la critica per non sentire l’incertezza',
    love: 'fiducia, cura quotidiana, parole chiare e una relazione in cui aiutare non sia un obbligo silenzioso',
    friendship: 'legami onesti, progetti pratici e persone che rispettano i piccoli dettagli',
    work: 'analizzare, curare, scrivere, fare ricerca, occuparsi della salute, progettare processi e rendere utile la conoscenza',
    purpose: 'imparare che ciò che è abbastanza buono può essere anche bello e che il riposo fa parte del metodo',
    growth: 'parlarti con meno durezza, lasciare che gli altri ti aiutino e non trasformare ogni errore in un’identità',
    sun: 'un’identità costruita attraverso il servizio, il mestiere, l’osservazione e il miglioramento continuo', moon: 'emozioni che si regolano con ordine, routine e la sensazione di essere utili senza sfruttarsi',
    rising: 'una presenza ordinata, attenta e riservata, che il mondo legge come capace di notare ciò che manca', venus: 'un amore premuroso e selettivo, espresso con gesti concreti più che con grandi discorsi',
    mars: 'un desiderio operoso che corregge, si esercita, perfeziona e può frustrarsi quando prevale il caos', house: 'l’ambito in cui hai bisogno di affinare, semplificare, curare le abitudini e applicare discernimento',
    ease: 'Toro, Capricorno e Cancro spesso apprezzano la sua cura concreta e il suo desiderio di sicurezza', tension: 'Gemelli, Sagittario e Pesci possono aiutarla ad allentare il bisogno di controllo attraverso il gioco, una prospettiva più ampia e la capacità di lasciar andare',
    care: 'routine flessibili, una digestione tranquilla, sonno, pause vere e meno elenchi impossibili',
    privateTruth: 'La Vergine non cerca gli errori per piacere; spesso sta tentando di rendere la vita meno dolorosa',
  },
  libra: {
    name: 'Bilancia', dates: 'dal 23 settembre al 22 ottobre', elementMode: 'aria cardinale', ruler: 'Venere',
    core: 'un temperamento diplomatico, perspicace e molto attento all’atmosfera tra le persone',
    strength: 'trovare la giusta proporzione, abbellendo, mediando, ascoltando entrambe le parti e restituendo eleganza al conflitto',
    shadow: 'aspettare un’opzione perfetta finché la vita non decide al suo posto',
    love: 'reciprocità, conversazione, bellezza condivisa e una relazione in cui la scelta sia reciproca',
    friendship: 'legami socievoli, gusto condiviso, confronto gentile e progetti in cui tutti possano sentirsi a proprio agio',
    work: 'negoziare, progettare, consigliare, scrivere, difendere la giustizia e creare esperienze equilibrate',
    purpose: 'imparare che la vera pace a volte comincia con una frase scomoda detta al momento giusto',
    growth: 'decidere prima che nasca il risentimento, sostenere una posizione propria e non chiamare armonia il proprio silenzio',
    sun: 'un’identità che si scopre nello specchio degli altri: relazione, gusto, giustizia e scelta consapevole', moon: 'emozioni che hanno bisogno di armonia, compagnia e spazi in cui il conflitto non diventi una minaccia',
    rising: 'una presenza elegante e socievole, che tende ad addolcire l’atmosfera prima di mostrare la propria intensità', venus: 'un amore nel proprio territorio: fascino, cooperazione, estetica e desiderio di un legame ben curato',
    mars: 'un’azione che passa attraverso la ricerca dell’equilibrio, lotta per la giustizia ma può tardare ad accettare la propria rabbia', house: 'l’ambito in cui cerchi equilibrio, alleanza, bellezza e decisioni che tengano conto dell’altra persona',
    ease: 'Gemelli, Acquario e Leone spesso alimentano la sua conversazione, la sua aria socievole e il senso del gioco', tension: 'Cancro, Capricorno e Ariete possono mostrarle bisogno, struttura e desiderio diretto',
    care: 'bellezza semplice, arte, relazioni distese e tempo da soli per ascoltare la propria voce',
    privateTruth: 'La Bilancia non evita il conflitto per superficialità; spesso sente fin troppo il costo di rompere l’armonia',
  },
  scorpio: {
    name: 'Scorpione', dates: 'dal 23 ottobre al 21 novembre', elementMode: 'acqua fissa', ruler: 'Marte nella tradizione e Plutone nell’astrologia moderna',
    core: 'un temperamento intenso, riservato, perspicace e poco interessato alle versioni di facciata della verità',
    strength: 'entrare dove altri non vogliono guardare e trovare potere, desiderio, lutto e trasformazione',
    shadow: 'proteggersi tanto da costringere l’intimità a superare prove impossibili',
    love: 'lealtà profonda, desiderio onesto, fiducia conquistata e una relazione capace di parlare di ciò che è difficile',
    friendship: 'legami selezionati, confidenze vere e persone che non tradiscano ciò che è stato detto a bassa voce',
    work: 'indagare, curare, analizzare le crisi, gestire risorse condivise e lavorare con ciò che è nascosto',
    purpose: 'imparare che il potere non è controllo e che anche fidarsi può essere una forza',
    growth: 'aprire le finestre prima che la stanza si chiuda, chiedere verità senza punire la vulnerabilità',
    sun: 'un’identità che si forgia attraversando l’intensità e non si accontenta di vivere in superficie', moon: 'emozioni profonde, private e resistenti, che hanno bisogno di tempo per mostrare ciò che accade davvero',
    rising: 'una presenza magnetica e attenta, che può dare agli altri l’impressione di essere compresi prima ancora che parlino', venus: 'un amore totale, fedele ed esigente, con desiderio di fusione e un legittimo timore del tradimento',
    mars: 'un desiderio strategico che aspetta, osserva, misura e agisce con forza quando la decisione è già presa', house: 'l’ambito in cui trasformi, indaghi, condividi il potere e impari a lasciare andare ciò che ti controlla',
    ease: 'Cancro, Pesci e Vergine spesso comprendono la sua profondità e il suo bisogno di fiducia', tension: 'Leone, Acquario e Toro possono portare orgoglio, distanza o ostinazione, ma anche magnetismo',
    care: 'intimità protetta, terapia, acqua, movimento intenso e pratiche che permettano di scaricare senza distruggere',
    privateTruth: 'Lo Scorpione non cerca drammi; cerca qualcosa di abbastanza vero da non doverlo sorvegliare',
  },
  sagittarius: {
    name: 'Sagittario', dates: 'dal 22 novembre al 21 dicembre', elementMode: 'fuoco mobile', ruler: 'Giove',
    core: 'un temperamento franco, di ampie vedute, irrequieto e più filosofico di quanto lasci intendere il suo umorismo',
    strength: 'allargare la mappa, offrendo prospettiva, coraggio, verità e il desiderio di varcare una porta nuova',
    shadow: 'usare la libertà come scusa per non restare dove qualcosa ha bisogno di cura',
    love: 'spazio, avventura, onestà, risate e una persona con un orizzonte proprio',
    friendship: 'amicizie con cui viaggiare, lunghi confronti, progetti improvvisati e persone che non temano di cambiare idea',
    work: 'insegnare, viaggiare, pubblicare, guidare, fare impresa, studiare e collegare le esperienze al loro significato',
    purpose: 'imparare che la verità diventa più forte quando si accompagna al tatto',
    growth: 'mantenere le promesse, ascoltare i dettagli e non trasformare ogni limite in una prigione',
    sun: 'un’identità che cresce esplorando e trovando un significato più grande della routine', moon: 'emozioni che hanno bisogno di movimento, speranza e del permesso di guardare più lontano',
    rising: 'una presenza aperta, onesta e a volte incontenibile, che sembra sempre in viaggio verso qualcos’altro', venus: 'un amore avventuroso, giocoso e libero, con un gusto per le risate e le promesse che aprono il mondo',
    mars: 'un desiderio guidato da una visione, che combatte per i principi, si accende per le cause e detesta sentirsi rinchiuso', house: 'l’ambito in cui cerchi viaggio, studio, fede, umorismo e una versione più ampia della vita',
    ease: 'Ariete, Leone e Acquario spesso accompagnano il suo fuoco, la sua indipendenza e il suo bisogno di aria', tension: 'Vergine, Pesci e Gemelli possono creare tensioni tra metodo, sensibilità e dispersione',
    care: 'aria aperta, gambe in movimento, apprendimento vivo e una pausa dal bisogno di ottimizzare tutto',
    privateTruth: 'Il Sagittario non fugge dalla profondità; fugge da una vita che gli chiede di smettere di crescere',
  },
  capricorn: {
    name: 'Capricorno', dates: 'dal 22 dicembre al 19 gennaio', elementMode: 'terra cardinale', ruler: 'Saturno',
    core: 'un temperamento sobrio, strategico, resistente e più tenero di quanto mostri all’inizio',
    strength: 'trasformare l’intenzione in struttura, organizzando, sostenendo, misurando il tempo e costruendo con pazienza',
    shadow: 'confondere il riposo con la debolezza o credere di doversi guadagnare ogni gesto d’amore',
    love: 'impegno, rispetto, pazienza, umorismo asciutto e dimostrazioni che durino oltre l’entusiasmo iniziale',
    friendship: 'legami leali e discreti, capaci di esserci quando la vita diventa adulta',
    work: 'dirigere, pianificare, amministrare, costruire istituzioni, curare la reputazione e sostenere obiettivi a lungo termine',
    purpose: 'imparare che l’ambizione può includere una vita interiore, non soltanto risultati visibili',
    growth: 'chiedere sostegno prima di esaurirsi, celebrare i progressi e non rimandare la gioia alla fine della salita',
    sun: 'un’identità che matura con il tempo, la responsabilità e un rapporto serio con ciò che vuole realizzare', moon: 'emozioni contenute, che hanno bisogno di sicurezza, competenza e del permesso di essere vulnerabili senza perdere autorevolezza',
    rising: 'una presenza riservata, competente e un po’ inaccessibile finché non nasce la fiducia', venus: 'un amore attento e serio, con il desiderio di costruire qualcosa che abbia forma e futuro',
    mars: 'un desiderio disciplinato che lavora per obiettivi, calcola gli sforzi e tende a vincere grazie alla costanza', house: 'l’ambito in cui ti assumi responsabilità, crei struttura e impari il potere della pazienza',
    ease: 'Toro, Vergine e Scorpione spesso rispettano il suo ritmo, la sua profondità e il suo bisogno di lealtà', tension: 'Ariete, Bilancia e Cancro possono insegnargli velocità, reciprocità e cura emotiva',
    care: 'prendersi cura delle ossa, dormire, porre limiti al lavoro, coltivare l’umorismo, programmare il riposo e concedersi di non produrre',
    privateTruth: 'Il Capricorno non è freddo; spesso cerca di dimostrarsi degno di fiducia prima di chiedere tenerezza',
  },
  aquarius: {
    name: 'Acquario', dates: 'dal 20 gennaio al 18 febbraio', elementMode: 'aria fissa', ruler: 'Saturno nella tradizione e Urano nell’astrologia moderna',
    core: 'un temperamento indipendente, mentale, attento e difficile da addomesticare con le aspettative sociali',
    strength: 'vedere il sistema dall’esterno e chiedersi se una regola serva ancora',
    shadow: 'rifugiarsi nella distanza quando la vita richiede presenza emotiva',
    love: 'amicizia, libertà mentale, una singolarità condivisa e una relazione senza possesso',
    friendship: 'legami scelti, comunità, conversazioni insolite e persone che rispettino la sua differenza',
    work: 'innovare, fare ricerca, programmare, organizzare gruppi, progettare sistemi e difendere futuri possibili',
    purpose: 'imparare che essere diversi non richiede di restare soli e che anche la comunità può avere intimità',
    growth: 'restare presente quando qualcuno ha bisogno di calore, non soltanto di una teoria brillante',
    sun: 'un’identità che ha bisogno di pensare con la propria testa e di vivere secondo una visione', moon: 'emozioni elaborate con distanza, idee e tempo, per cui il sentire può arrivare dopo la comprensione',
    rising: 'una presenza singolare, fresca e un po’ imprevedibile, in cui gli altri percepiscono una distanza magnetica', venus: 'un amore basato sull’amicizia, sulla libertà e sull’accettazione di ciò che rende unica ogni persona',
    mars: 'un desiderio ostinato e mentale, che combatte per i principi, i sistemi e il proprio spazio', house: 'l’ambito in cui innovi, metti in discussione, ti separi dalla norma e cerchi una rete più onesta',
    ease: 'Gemelli, Bilancia e Sagittario spesso gli offrono conversazione, socialità e un orizzonte più ampio', tension: 'Toro, Scorpione e Leone possono creare tensioni tra sicurezza, intensità e orgoglio personale',
    care: 'disconnessione digitale, circolazione, amicizie reali e routine che non sembrino una gabbia',
    privateTruth: 'L’Acquario non vuole essere diverso per posa; vuole respirare senza dover chiedere il permesso di pensare in modo diverso',
  },
  pisces: {
    name: 'Pesci', dates: 'dal 19 febbraio al 20 marzo', elementMode: 'acqua mobile', ruler: 'Giove nella tradizione e Nettuno nell’astrologia moderna',
    core: 'un temperamento sensibile, immaginativo, compassionevole e permeabile a ciò che gli altri non dicono',
    strength: 'ammorbidire i confini, immaginando, perdonando, sognando, creando e ascoltando il linguaggio dell’invisibile',
    shadow: 'sciogliersi nei bisogni degli altri o chiamare destino ciò che richiede limiti',
    love: 'tenerezza, mistero, empatia, arte e una relazione in cui la sensibilità non sia motivo di scherno',
    friendship: 'legami dolci, creativi, spirituali o profondamente umani, in cui nessuno debba fingere durezza',
    work: 'creare, curare, accompagnare, prendersi cura, interpretare simboli, fare musica, scrivere o lavorare tra mondi diversi',
    purpose: 'capire che una compassione che sa porre limiti resta compassione e spesso dura più a lungo',
    growth: 'dire di no prima di scomparire, dare forma al talento e non salvare chi non vuole cambiare',
    sun: 'un’identità che ha bisogno di ispirazione, dedizione e di un rapporto vivo con l’immaginazione', moon: 'emozioni porose che colgono atmosfere, sogni e silenzi e hanno bisogno di tempo per tornare a sé',
    rising: 'una presenza mutevole, dolce e difficile da definire, su cui gli altri proiettano molto', venus: 'un amore idealistico, romantico e tenero, con un desiderio di fusione e bellezza condivisa',
    mars: 'un desiderio indiretto, ispirato e a volte elusivo, che agisce meglio quando trova un significato emotivo', house: 'l’ambito in cui i confini si ammorbidiscono e compaiono il sogno, la fede, l’arte, il lutto o la compassione',
    ease: 'Cancro, Scorpione e Capricorno spesso comprendono la loro profondità e offrono loro contenimento', tension: 'Gemelli, Sagittario e Vergine possono creare tensioni tra parola, verità e ordine, ma anche dare loro forma',
    care: 'sonno, acqua, musica, una solitudine gentile e limiti personali di fronte alle persone esigenti',
    privateTruth: 'I Pesci non sono perduti; spesso stanno percependo uno strato della realtà che gli altri ignorano',
  },
};

interface GuideSeed {
  intro: [string, string];
  sections: ItalianGuide['sections'];
  faq: ItalianGuide['faq'];
}

const SEEDS: Record<string, GuideSeed> = {
  aries: {
    intro: [
      'L’Ariete apre la ruota zodiacale. È l’impulso a cominciare, la scintilla che arriva prima del piano perfetto e il coraggio di muoversi anche quando non ci sono ancora tutte le risposte.',
      'In un tema natale, l’Ariete mostra dove agisci con più franchezza. Non è un’energia sempre paziente: spesso è onestà, desiderio e un bisogno molto chiaro di sentire che la vita avanza.',
    ],
    sections: [
      { heading: 'Personalità dell’Ariete', body: [
        'L’Ariete è spesso diretto, rapido e trasparente. Quando qualcosa gli sta a cuore, si vede. Questa energia preferisce una risposta chiara a una conversazione che non finisce mai e tende a imparare facendo più che aspettando un permesso.',
        'Il suo lato luminoso è l’iniziativa: incoraggia, accende e apre la strada. La sfida è portare avanti ciò che ha iniziato quando l’entusiasmo iniziale cala. La maturità dell’Ariete non consiste nello spegnersi, ma nello scegliere meglio dove spendere il proprio fuoco.',
      ] },
      { heading: 'L’Ariete in amore', body: [
        'Nei legami, l’Ariete cerca desiderio vivo, onestà e una persona con un mondo proprio. Lo attraggono le relazioni in cui ci sono gioco, sfida e movimento, senza dover indovinare che cosa prova l’altra persona.',
        'Si trova spesso bene con Leone, Sagittario e Gemelli. Con Cancro, Capricorno e Bilancia può esserci più attrito, ma anche molta intesa se entrambi imparano ad ascoltare il ritmo dell’altro.',
      ] },
      { heading: 'L’Ariete nel tuo tema', body: [
        'Tutti abbiamo l’Ariete in una zona del tema. Lì vuoi decidere, provare e sentirti autonomo. Il Sole in Ariete ne fa un tratto dell’identità; la Luna in Ariete, un’emozione immediata; l’ascendente Ariete, presenza e prima impressione.',
      ] },
    ],
    faq: [
      { q: 'Quali sono le date dell’Ariete?', a: `In genere dal 21 marzo al 19 aprile. ${EDGE_COPY}` },
      { q: 'L’Ariete è un segno di fuoco?', a: 'Sì. L’Ariete è fuoco cardinale: energia che dà inizio, accende e spinge qualcosa a cominciare.' },
      { q: 'Con chi è compatibile l’Ariete?', a: 'Tende a trovarsi bene con Leone, Sagittario e Gemelli. Per una lettura di coppia davvero utile, confronta i due temi completi.' },
    ],
  },
  taurus: {
    intro: [
      'Il Toro arriva quando la primavera smette di promettere e comincia a sostenere. È il segno di ciò che si cura nel tempo: corpo, piacere, stabilità, risorse e amore dimostrato nei fatti.',
      'In un tema natale, il Toro mostra dove hai bisogno di sicurezza reale. Non soltanto comodità, ma anche un ritmo tuo, buoni limiti e la pazienza di costruire qualcosa che duri.',
    ],
    sections: [
      { heading: 'Personalità del Toro', body: [
        'Il Toro è spesso calmo, sensoriale e costante. Decide con lentezza, ma quando decide cambia raramente per la pressione esterna. La sua fiducia si conquista con una presenza ripetuta, non con grandi promesse.',
        'La sua forza è la capacità di restare. La sfida è accorgersi quando la lealtà è diventata inerzia. A volte anche lasciare andare è un modo di prendersi cura di ciò che conta.',
      ] },
      { heading: 'Il Toro in amore', body: [
        'Il Toro ama con i fatti: tempo, cibo, contatto, memoria e cura concreta. Ha bisogno di stabilità e coerenza; i segnali contraddittori tendono a stancarlo in fretta.',
        'Si trova spesso bene con Vergine, Capricorno e Cancro. Con Leone, Acquario e Scorpione può esserci un’attrazione forte e ostinata, purché entrambi imparino a cedere senza sentirsi sconfitti.',
      ] },
      { heading: 'Il Toro nel tuo tema', body: [
        'Il Toro indica dove cerchi calma, valore e una vita che sembri abitabile. In Venere parla di gusto e desiderio; nella Luna, di sicurezza emotiva; nell’ascendente, di una presenza tranquilla e salda.',
      ] },
    ],
    faq: [
      { q: 'Quali sono le date del Toro?', a: `In genere dal 20 aprile al 20 maggio. ${EDGE_COPY}` },
      { q: 'Il Toro è un segno di terra?', a: 'Sì. Il Toro è terra fissa: stabilità, corpo, risorse e resistenza.' },
      { q: 'Quale pianeta governa il Toro?', a: 'Venere, associata all’amore, al piacere, alla bellezza e al valore.' },
    ],
  },
  gemini: {
    intro: [
      'I Gemelli sono aria in movimento: domande, conversazioni, connessioni e la rapidità di una mente che ha bisogno di varietà per sentirsi viva.',
      'In un tema natale, i Gemelli mostrano dove impari provando, parlando, leggendo, cambiando prospettiva e raccogliendo informazioni prima di fermarti su una sola risposta.',
    ],
    sections: [
      { heading: 'Personalità dei Gemelli', body: [
        'I Gemelli sono spesso curiosi, agili e socievoli. Colgono gli schemi, cambiano argomento con facilità e molte volte pensano meglio ad alta voce. Il loro dono è aprire finestre.',
        'La sfida è non confondere il movimento con la direzione. Quando i Gemelli scelgono una domanda importante e le restano accanto, la loro intelligenza smette di disperdersi e diventa mestiere.',
      ] },
      { heading: 'I Gemelli in amore', body: [
        'I Gemelli hanno bisogno di conversazione, gioco mentale e spazio per respirare. Una relazione che non lascia posto alla curiosità tende a sembrare troppo stretta.',
        'Si trovano spesso bene con Bilancia, Acquario e Ariete. Con Vergine, Pesci e Sagittario può esserci tensione tra dettaglio, sogno e libertà; se gestita bene, insegna molto.',
      ] },
      { heading: 'I Gemelli nel tuo tema', body: [
        'I Gemelli indicano l’area in cui ti conviene fare più domande, parlare con maggiore chiarezza e permetterti di cambiare idea. In Mercurio sono particolarmente forti: linguaggio, apprendimento e ritmo mentale.',
      ] },
    ],
    faq: [
      { q: 'Quali sono le date dei Gemelli?', a: `In genere dal 21 maggio al 20 giugno. ${EDGE_COPY}` },
      { q: 'I Gemelli sono un segno d’aria?', a: 'Sì. I Gemelli sono aria mobile: idee, scambio e adattamento.' },
      { q: 'Quale pianeta governa i Gemelli?', a: 'Mercurio, il pianeta associato alla comunicazione, al linguaggio e al movimento delle informazioni.' },
    ],
  },
  cancer: {
    intro: [
      'Il Cancro comincia con il solstizio di giugno: molta luce, molta memoria e un ritorno verso l’intimità. È il segno della cura, dell’appartenenza e della sensibilità che protegge.',
      'In un tema natale, il Cancro mostra dove senti prima di spiegare. Indica anche dove hai bisogno di un senso di casa, fiducia e una sicurezza che non sia soltanto materiale.',
    ],
    sections: [
      { heading: 'Personalità del Cancro', body: [
        'Il Cancro è spesso intuitivo, leale e più forte di quanto sembri. Legge rapidamente le atmosfere e ricorda dettagli che altri dimenticano. La sua cura può essere molto concreta: chiedere, nutrire, accompagnare.',
        'La sfida è chiedere apertamente invece di mettere alla prova gli altri per vedere se indovinano. La sensibilità del Cancro è un talento, ma ha bisogno di parole chiare per non trasformarsi in una corazza.',
      ] },
      { heading: 'Il Cancro in amore', body: [
        'Il Cancro cerca una tenerezza affidabile. Ama creando rifugio: abitudini, memoria condivisa e gesti che dicono «ti tengo presente». Ha bisogno di reciprocità emotiva, non soltanto di intensità.',
        'Si trova spesso bene con Scorpione, Pesci e Toro. Con Ariete, Bilancia e Capricorno può esserci uno scontro di ritmi, ma anche legami molto forti quando ci sono cura e maturità.',
      ] },
      { heading: 'Il Cancro nel tuo tema', body: [
        'Il Cancro indica dove proteggi, ricordi e hai bisogno di appartenere. Nella Luna si esprime con particolare forza; nell’ascendente, come una presenza sensibile e attenta.',
      ] },
    ],
    faq: [
      { q: 'Quali sono le date del Cancro?', a: `In genere dal 21 giugno al 22 luglio. ${EDGE_COPY}` },
      { q: 'Il Cancro è un segno d’acqua?', a: 'Sì. Il Cancro è acqua cardinale: emozione che dà inizio alla cura.' },
      { q: 'Quale pianeta governa il Cancro?', a: 'La Luna, associata alla memoria, all’istinto, al corpo emotivo e al bisogno di sicurezza.' },
    ],
  },
  leo: {
    intro: [
      'Il Leone è il cuore dell’estate: presenza, calore, creatività e desiderio di essere visto per ciò che è davvero.',
      'In un tema natale, il Leone mostra dove hai bisogno di esprimerti con un sano orgoglio. Non si tratta soltanto di attenzione, ma di essere autore della tua vita, di giocare e di mostrare generosità.',
    ],
    sections: [
      { heading: 'Personalità del Leone', body: [
        'Il Leone è spesso caloroso, espressivo e leale. Ha un modo naturale di occupare lo spazio, incoraggiare gli altri e dare vita a una scena.',
        'La sua sfida è non dipendere dagli applausi per ricordare il proprio valore. Quando crea dal proprio centro e non dal bisogno di approvazione, la sua luce diventa più generosa.',
      ] },
      { heading: 'Il Leone in amore', body: [
        'Il Leone ama con entusiasmo e ha bisogno di sentirsi scelto. L’indifferenza gli fa più male di una discussione onesta; preferisce una relazione viva a una cortese ma spenta.',
        'Si trova spesso bene con Ariete, Sagittario e Bilancia. Con Toro, Scorpione e Acquario può esserci un orgoglio inflessibile da entrambe le parti, ma anche un’attrazione molto potente.',
      ] },
      { heading: 'Il Leone nel tuo tema', body: [
        'Il Leone indica dove vuoi creare, giocare, guidare o mostrare qualcosa di tuo. Nel Sole diventa identità centrale; in Venere, amore espressivo; nell’ascendente, presenza radiosa.',
      ] },
    ],
    faq: [
      { q: 'Quali sono le date del Leone?', a: `In genere dal 23 luglio al 22 agosto. ${EDGE_COPY}` },
      { q: 'Il Leone è un segno di fuoco?', a: 'Sì. Il Leone è fuoco fisso: calore costante, creatività e lealtà.' },
      { q: 'Quale pianeta governa il Leone?', a: 'Il Sole, associato all’identità, alla vitalità e all’espressione consapevole.' },
    ],
  },
  virgo: {
    intro: [
      'La Vergine arriva con il raccolto: osservare da vicino, separare ciò che è utile da ciò che è superfluo e far funzionare meglio le cose.',
      'In un tema natale, la Vergine mostra dove migliori la vita prestando attenzione. La sua magia non è la perfezione, ma la capacità di accorgersi di ciò che va aggiustato.',
    ],
    sections: [
      { heading: 'Personalità della Vergine', body: [
        'La Vergine è spesso attenta, pratica ed esigente con sé stessa. Vede dettagli che altri trascurano e molte volte esprime l’amore offrendo un aiuto concreto.',
        'La sua sfida è permettere che qualcosa sia abbastanza buono. Lo stesso sguardo che migliora i progetti può diventare duro verso di sé se non impara a riposare.',
      ] },
      { heading: 'La Vergine in amore', body: [
        'La Vergine ama prestando attenzione: ricorda, organizza, si prende cura e corregge perché vuole che qualcosa duri. Ha bisogno di fiducia per mostrare tenerezza senza sentire di perdere il controllo.',
        'Si trova spesso bene con Toro, Capricorno e Cancro. Con Gemelli, Sagittario e Pesci può esserci tensione tra analisi, libertà e sensibilità.',
      ] },
      { heading: 'La Vergine nel tuo tema', body: [
        'La Vergine indica dove ti conviene affinare i processi, curare le abitudini e rendere utile ciò che sai. In Mercurio parla di analisi; nella sesta casa, di routine e salute quotidiana.',
      ] },
    ],
    faq: [
      { q: 'Quali sono le date della Vergine?', a: `In genere dal 23 agosto al 22 settembre. ${EDGE_COPY}` },
      { q: 'La Vergine è un segno di terra?', a: 'Sì. La Vergine è terra mobile: dettaglio, adattamento e miglioramento pratico.' },
      { q: 'Quale pianeta governa la Vergine?', a: 'Mercurio, considerato qui come la mente che ordina, rivede e applica.' },
    ],
  },
  libra: {
    intro: [
      'La Bilancia comincia vicino all’equinozio di settembre, quando il giorno e la notte si equilibrano. Il suo tema centrale è la relazione: proporzione, bellezza, giustizia e scelta reciproca.',
      'In un tema natale, la Bilancia mostra dove pensi meglio grazie al confronto con un’altra persona. Indica anche dove hai bisogno di armonia, ma non a costo della tua voce.',
    ],
    sections: [
      { heading: 'Personalità della Bilancia', body: [
        'La Bilancia è spesso affascinante, diplomatica e sensibile all’ingiustizia. Coglie rapidamente le sfumature sociali e sa migliorare un’atmosfera senza imporsi con la forza.',
        'La sua sfida è decidere senza aspettare che ogni opzione sia perfettamente equilibrata. A volte la pace vera richiede una conversazione scomoda.',
      ] },
      { heading: 'La Bilancia in amore', body: [
        'La Bilancia cerca complicità, bellezza e reciprocità. Ama sentirsi scelta e anche scegliere: una relazione come conversazione viva, non come obbligo.',
        'Si trova spesso bene con Gemelli, Acquario e Leone. Con Cancro, Capricorno e Ariete può esserci tensione tra cura, struttura e indipendenza.',
      ] },
      { heading: 'La Bilancia nel tuo tema', body: [
        'La Bilancia indica dove impari attraverso il contrasto e la cooperazione. In Venere diventa gusto per le relazioni; in Marte può esitare prima di agire; nell’ascendente mostra grazia sociale.',
      ] },
    ],
    faq: [
      { q: 'Quali sono le date della Bilancia?', a: `In genere dal 23 settembre al 22 ottobre. ${EDGE_COPY}` },
      { q: 'La Bilancia è un segno d’aria?', a: 'Sì. La Bilancia è aria cardinale: idee che cercano incontro ed equilibrio.' },
      { q: 'Quale pianeta governa la Bilancia?', a: 'Venere, nella sua dimensione di bellezza, legame, proporzione e scelta.' },
    ],
  },
  scorpio: {
    intro: [
      'Lo Scorpione appare quando l’anno entra in profondità. È il segno di ciò che non si dice ad alta voce: desiderio, perdita, fiducia, trasformazione e verità emotiva.',
      'In un tema natale, lo Scorpione mostra dove non ti accontenti della superficie. Lì hai bisogno di onestà, intimità e una forma di potere che non sia controllo.',
    ],
    sections: [
      { heading: 'Personalità dello Scorpione', body: [
        'Lo Scorpione è spesso intenso, riservato e perspicace. Legge i sottintesi, custodisce le informazioni e si impegna completamente quando si fida.',
        'La sua sfida è non trasformare la protezione in isolamento. La lealtà dello Scorpione è enorme, ma deve permettere agli altri di avvicinarsi prima che superino ogni prova.',
      ] },
      { heading: 'Lo Scorpione in amore', body: [
        'Lo Scorpione cerca profondità e verità. Non gli interessano i rapporti di facciata: vuole una presenza reale, un desiderio onesto e un’intimità in cui ci sia spazio anche per ciò che è difficile.',
        'Si trova spesso bene con Cancro, Pesci e Vergine. Con Leone, Acquario e Toro può esserci un forte magnetismo insieme ad attriti legati al controllo, all’orgoglio o all’ostinazione.',
      ] },
      { heading: 'Lo Scorpione nel tuo tema', body: [
        'Lo Scorpione indica dove trasformi, indaghi e impari a fidarti. In Marte parla di desiderio strategico; nella Luna, di emozioni intense; nell’ascendente, di una presenza magnetica.',
      ] },
    ],
    faq: [
      { q: 'Quali sono le date dello Scorpione?', a: `In genere dal 23 ottobre al 21 novembre. ${EDGE_COPY}` },
      { q: 'Lo Scorpione è un segno d’acqua?', a: 'Sì. Lo Scorpione è acqua fissa: emozione profonda, costante e difficile da ignorare.' },
      { q: 'Quale pianeta governa lo Scorpione?', a: 'La tradizione usa Marte; l’astrologia moderna considera anche Plutone.' },
    ],
  },
  sagittarius: {
    intro: [
      'Il Sagittario guarda verso l’orizzonte. È ricerca, verità, viaggio, umorismo e bisogno che la vita abbia un senso oltre la routine.',
      'In un tema natale, il Sagittario mostra dove cresci esplorando: luoghi, idee, convinzioni, studi o conversazioni che allargano il mondo.',
    ],
    sections: [
      { heading: 'Personalità del Sagittario', body: [
        'Il Sagittario è spesso onesto, ottimista e libero. Ha talento nell’incoraggiare gli altri e nel dire verità attorno alle quali molti girano troppo a lungo.',
        'La sua sfida è ricordare che anche la verità ha bisogno di tatto. Non tutto ciò che sembra una costrizione è impegno, ma non ogni impegno è una gabbia.',
      ] },
      { heading: 'Il Sagittario in amore', body: [
        'Il Sagittario ha bisogno di un’avventura condivisa e di una relazione che respiri. Vuole una persona con un orizzonte proprio, non qualcuno che lo trasformi nell’intera mappa.',
        'Si trova spesso bene con Ariete, Leone e Acquario. Con Vergine, Pesci e Gemelli può esserci tensione tra dettaglio, sensibilità ed eccesso di movimento.',
      ] },
      { heading: 'Il Sagittario nel tuo tema', body: [
        'Il Sagittario indica dove cerchi uno scopo, insegnamento ed espansione. In Giove diventa fede e appetito; in Mercurio, franchezza; nell’ascendente, una presenza aperta e diretta.',
      ] },
    ],
    faq: [
      { q: 'Quali sono le date del Sagittario?', a: `In genere dal 22 novembre al 21 dicembre. ${EDGE_COPY}` },
      { q: 'Il Sagittario è un segno di fuoco?', a: 'Sì. Il Sagittario è fuoco mobile: visione, entusiasmo e cambiamento di prospettiva.' },
      { q: 'Quale pianeta governa il Sagittario?', a: 'Giove, associato alla crescita, al significato, alla fede e all’ampiezza.' },
    ],
  },
  capricorn: {
    intro: [
      'Il Capricorno comincia con il solstizio di dicembre: poco rumore, molta struttura e la pazienza di costruire mentre fa ancora freddo.',
      'In un tema natale, il Capricorno mostra dove ti assumi responsabilità, misuri il tempo e vuoi che qualcosa sia reale, non soltanto fonte d’ispirazione.',
    ],
    sections: [
      { heading: 'Personalità del Capricorno', body: [
        'Il Capricorno è spesso serio, strategico e resistente. Pensa alle conseguenze, dà valore all’impegno e sa che molte cose importanti non si costruiscono in fretta.',
        'La sua sfida è non trasformare l’autosufficienza in solitudine. Merita anche riposo, aiuto e una vita che non sia soltanto rendimento.',
      ] },
      { heading: 'Il Capricorno in amore', body: [
        'Il Capricorno ama con impegno concreto. Può metterci tempo ad aprirsi, ma quando lo fa tende a pensare al lungo periodo, alla cura reale e a decisioni sostenibili.',
        'Si trova spesso bene con Toro, Vergine e Scorpione. Con Ariete, Bilancia e Cancro può esserci tensione tra velocità, legame e vulnerabilità.',
      ] },
      { heading: 'Il Capricorno nel tuo tema', body: [
        'Il Capricorno indica dove maturare non è una punizione, ma un percorso. In Saturno parla di limiti e padronanza; nell’ascendente, di una presenza contenuta e ambiziosa.',
      ] },
    ],
    faq: [
      { q: 'Quali sono le date del Capricorno?', a: `In genere dal 22 dicembre al 19 gennaio. ${EDGE_COPY}` },
      { q: 'Il Capricorno è un segno di terra?', a: 'Sì. Il Capricorno è terra cardinale: struttura che dà inizio e sostiene.' },
      { q: 'Quale pianeta governa il Capricorno?', a: 'Saturno, associato al tempo, ai limiti, alla responsabilità e alla maturità.' },
    ],
  },
  aquarius: {
    intro: [
      'L’Acquario guarda il sistema dall’esterno. È pensiero indipendente, futuro, comunità, differenza e la domanda se una regola serva ancora.',
      'In un tema natale, l’Acquario mostra dove hai bisogno di aria, di una visione e del permesso di non adattarti del tutto.',
    ],
    sections: [
      { heading: 'Personalità dell’Acquario', body: [
        'L’Acquario è spesso originale, attento e difficile da mettere sotto pressione. Può sembrare distante, ma molte volte sta considerando il quadro nel suo insieme.',
        'La sua sfida è scendere dall’idea alla presenza. Amare l’umanità è nobile; lo è anche prendersi cura della persona che si ha davanti.',
      ] },
      { heading: 'L’Acquario in amore', body: [
        'L’Acquario ha bisogno di amicizia, libertà mentale e una relazione che rispetti la sua singolarità. Sentirsi posseduto lo soffoca, ma può essere profondamente leale quando ha spazio.',
        'Si trova spesso bene con Gemelli, Bilancia e Sagittario. Con Toro, Scorpione e Leone può esserci una tensione fissa: nessuno vuole cedere per primo.',
      ] },
      { heading: 'L’Acquario nel tuo tema', body: [
        'L’Acquario indica dove innovi, metti in discussione e cerchi una versione più libera della vita. In Saturno parla di struttura sociale; in Urano, di rottura e cambiamento.',
      ] },
    ],
    faq: [
      { q: 'Quali sono le date dell’Acquario?', a: `In genere dal 20 gennaio al 18 febbraio. ${EDGE_COPY}` },
      { q: 'L’Acquario è un segno d’acqua?', a: 'No. Anche se il suo simbolo è il portatore d’acqua, l’Acquario è un segno d’aria.' },
      { q: 'Quale pianeta governa l’Acquario?', a: 'La tradizione usa Saturno; l’astrologia moderna considera anche Urano.' },
    ],
  },
  pisces: {
    intro: [
      'I Pesci chiudono la ruota zodiacale. Portano sensibilità, immaginazione, compassione e quella parte della vita che non entra del tutto nelle parole.',
      'In un tema natale, i Pesci mostrano dove percepisci i confini più morbidi: intuizione, arte, sogno, fede, stanchezza altrui e desiderio di una connessione profonda.',
    ],
    sections: [
      { heading: 'Personalità dei Pesci', body: [
        'I Pesci sono spesso empatici, creativi e permeabili. Colgono le atmosfere, immaginano possibilità e molte volte capiscono prima che qualcuno spieghi.',
        'La loro sfida riguarda i limiti. Sentire molto non significa farsi carico di tutto; aiutare non richiede di scomparire. I Pesci fioriscono quando la loro compassione prende forma.',
      ] },
      { heading: 'I Pesci in amore', body: [
        'I Pesci amano con immaginazione e dedizione. Cercano tenerezza, mistero e una relazione in cui trovi spazio il mondo invisibile di entrambi.',
        'Si trovano spesso bene con Cancro, Scorpione e Capricorno. Con Gemelli, Sagittario e Vergine può esserci tensione tra sogno, verità e ordine.',
      ] },
      { heading: 'I Pesci nel tuo tema', body: [
        'I Pesci indicano dove hai bisogno di ispirazione e di una pausa dall’eccesso di durezza. Nella Luna sono emozioni porose; in Venere, amore idealistico; nell’ascendente, una presenza dolce e mutevole.',
      ] },
    ],
    faq: [
      { q: 'Quali sono le date dei Pesci?', a: `In genere dal 19 febbraio al 20 marzo. ${EDGE_COPY}` },
      { q: 'I Pesci sono un segno d’acqua?', a: 'Sì. I Pesci sono acqua mobile: sensibilità, immaginazione e adattamento emotivo.' },
      { q: 'Quale pianeta governa i Pesci?', a: 'La tradizione usa Giove; l’astrologia moderna considera anche Nettuno.' },
    ],
  },
};

function buildGuide(slug: string, p: Profile): ItalianGuide {
  const grammar = {
    aries: { subject: 'l’Ariete', subjectCap: 'L’Ariete', di: 'dell’Ariete', da: 'dall’Ariete', plural: false },
    taurus: { subject: 'il Toro', subjectCap: 'Il Toro', di: 'del Toro', da: 'dal Toro', plural: false },
    gemini: { subject: 'i Gemelli', subjectCap: 'I Gemelli', di: 'dei Gemelli', da: 'dai Gemelli', plural: true },
    cancer: { subject: 'il Cancro', subjectCap: 'Il Cancro', di: 'del Cancro', da: 'dal Cancro', plural: false },
    leo: { subject: 'il Leone', subjectCap: 'Il Leone', di: 'del Leone', da: 'dal Leone', plural: false },
    virgo: { subject: 'la Vergine', subjectCap: 'La Vergine', di: 'della Vergine', da: 'dalla Vergine', plural: false },
    libra: { subject: 'la Bilancia', subjectCap: 'La Bilancia', di: 'della Bilancia', da: 'dalla Bilancia', plural: false },
    scorpio: { subject: 'lo Scorpione', subjectCap: 'Lo Scorpione', di: 'dello Scorpione', da: 'dallo Scorpione', plural: false },
    sagittarius: { subject: 'il Sagittario', subjectCap: 'Il Sagittario', di: 'del Sagittario', da: 'dal Sagittario', plural: false },
    capricorn: { subject: 'il Capricorno', subjectCap: 'Il Capricorno', di: 'del Capricorno', da: 'dal Capricorno', plural: false },
    aquarius: { subject: 'l’Acquario', subjectCap: 'L’Acquario', di: 'dell’Acquario', da: 'dall’Acquario', plural: false },
    pisces: { subject: 'i Pesci', subjectCap: 'I Pesci', di: 'dei Pesci', da: 'dai Pesci', plural: true },
  }[slug];
  if (!grammar) throw new Error(`Manca la grammatica italiana per ${slug}`);
  const seed = SEEDS[slug];
  if (!seed) throw new Error(`Manca la base italiana per ${slug}`);
  const { subject, subjectCap, di: diName, plural } = grammar;
  const elementPhrase = /^[aeiouàèéìòù]/iu.test(p.elementMode) ? `d’${p.elementMode}` : `di ${p.elementMode}`;
  const intro = [...seed.intro];
  const sections: ItalianGuide['sections'] = [
    ...seed.sections,
    {
      heading: `Come riconoscere ${subject}`,
      body: [
        `Si nota innanzitutto ${p.core}. Il segno può essere riservato o estroverso a seconda del resto del tema, ma la sua attenzione torna spesso allo stesso bisogno fondamentale.`,
        `Il dono del segno è ${p.strength}. Quando non ha nulla da dimostrare, questa qualità diventa più generosa, più precisa e più facile da accogliere.`,
        `La difficoltà del segno è ${p.shadow}. Leggerlo come uno strumento invece che come un’etichetta aiuta a distinguere una qualità viva da un vecchio riflesso di protezione.`,
      ],
    },
    {
      heading: `${subjectCap}, legami e fiducia`,
      body: [
        `Per creare vicinanza, ${subject} ${plural ? 'cercano' : 'cerca'} ${p.love}. Quando manca, una relazione può sembrare giusta all’esterno e restare vuota all’interno.`,
        `Nell’amicizia, ${subject} ${plural ? 'cercano' : 'cerca'} ${p.friendship}. La compatibilità più sana non è sempre la più intensa, ma spesso quella che lascia respirare il segno senza costringerlo a spiegarsi di continuo.`,
        `${p.ease}. Con questi segni, l’intesa è spesso più semplice. ${p.tension}. Questi legami non sono una cattiva idea: chiedono soltanto più consapevolezza. In coppia, il tema completo conta molto più del Sole: Luna, Venere, Marte, ascendente e case raccontano la storia reale.`,
      ],
    },
    {
      heading: `${subjectCap}, lavoro e direzione`,
      body: [
        `Nel lavoro, ${subject} ${plural ? 'danno' : 'dà'} il meglio quando ${plural ? 'possono' : 'può'} ${p.work}. Non si tratta necessariamente di una professione precisa, ma di un modo di affrontare qualsiasi compito.`,
        `La direzione profonda del segno è questa: ${p.purpose}. Può iniziare con una decisione molto semplice, ripetuta abbastanza a lungo da diventare un modo di vivere.`,
        `Le risorse sono utili quando sostengono la vita reale. Una routine, un budget o un obiettivo devono dare una struttura al segno, non rinchiuderlo in una caricatura di sé.`,
      ],
    },
    {
      heading: `${subjectCap} nelle posizioni del tema`,
      risingProfile: true,
      body: [
        `Il Sole in ${p.name} parla di ${p.sun}; la Luna in ${p.name}, di ${p.moon}; l’ascendente in ${p.name} mostra al mondo prima di tutto ${p.rising}.`,
        `Venere in ${p.name} evoca ${p.venus}. Marte in ${p.name} descrive ${p.mars}. Questi posizionamenti a volte spiegano perché una persona non si riconosce nella consueta descrizione del proprio segno solare.`,
        `La posizione ${diName} nel tema indica ${p.house}. Calcola il tuo tema completo con ora e luogo di nascita per vedere se questo argomento appare nell’identità, nelle relazioni, nel lavoro, nella famiglia o nella vita interiore.`,
        `Le date ${diName} vanno in genere ${p.dates}, ma il Sole non entra in un segno alla stessa ora ogni anno. Vicino al confine, solo un tema calcolato con i tuoi dati dà una risposta affidabile.`,
      ],
    },
    {
      heading: `Ombra e crescita ${diName}`,
      body: [
        `L’ombra ${diName} non è un difetto morale. Spesso è una strategia un tempo utile che ha cominciato a funzionare da sola: ${p.shadow}.`,
        `Il percorso del segno è questo: ${p.growth}. L’obiettivo non è negarne l’impulso, ma dargli una forma più consapevole e duratura.`,
        `Anche il corpo conta. Pratiche utili: ${p.care}. L’astrologia diventa utile quando arriva alle piccole decisioni concrete.`,
      ],
    },
    {
      heading: `Ciò che ${subject} ${plural ? 'dicono' : 'dice'} raramente ad alta voce`,
      body: [
        `${p.privateTruth}. Questa verità intima spesso dice più degli stereotipi associati al segno.`,
        `${subjectCap} ${plural ? 'possono' : 'può'} tenere insieme gli opposti: forza e bisogno di cura, libertà e appartenenza, calma apparente e vita interiore intensa. Il tema completo permette a queste sfumature di coesistere.`,
        `Questa guida è un punto di partenza. Per capire ${subject} nella tua vita, guarda dove compare questo segno nel tuo tema, quali pianeti vi si trovano e quali aspetti formano. Il segno dà il vocabolario; il tema natale compone la frase.`,
      ],
    },
  ];
  const faq: ItalianGuide['faq'] = [
    ...seed.faq,
    { q: `Che cosa significa una forte presenza ${diName} nel tema?`, a: `Diversi pianeti o punti importanti parlano il linguaggio di questo segno ${elementPhrase}. La guida prende come riferimento questa reggenza: ${p.ruler}. Le case e gli aspetti indicano dove e come si esprime questa presenza.` },
    { q: `E se non mi riconosco in questo ritratto ${diName}?`, a: 'È normale. L’ascendente, la Luna, i pianeti dominanti e gli aspetti forti modificano molto il modo in cui si vive il segno solare. Calcola il tema completo prima di scartarlo.' },
    { q: `Qual è la lezione ${diName}?`, a: `La lezione è ${p.purpose}. In questo modo il segno conserva la sua forza senza restare prigioniero di un riflesso di difesa.` },
  ];
  return {
    sign: slug,
    title: `${p.name}: date, personalità e compatibilità`,
    description: `${p.name}: date, personalità, amore, compatibilità e significato nel tema natale. Vicino a un cambio di segno? Il tema natale fissa il tuo Sole.`,
    intro,
    sections,
    faq,
  };
}

export const IT_GUIDES: Record<string, ItalianGuide> = Object.fromEntries(
  Object.entries(PROFILES).map(([slug, profile]) => [slug, buildGuide(slug, profile)]),
);

export function italianGuideFor(sign: Sign): ItalianGuide {
  const guide = IT_GUIDES[sign.slug];
  if (!guide) throw new Error(`Manca la guida italiana per ${sign.slug}`);
  return guide;
}
