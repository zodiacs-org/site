/**
 * The Moon journal page's own prose (head, hero and the two notes under the
 * journal), by locale. The page renders it at build time; the island never
 * imports it. A paragraph with links is a list of parts: plain text, or a
 * link to one of the pages named in MoonJournalLink.
 *
 * Voice as in copy.ts: plain, warm and dry; no em or en dashes.
 */
import type { MoonJournalLocale } from './copy';

export type MoonJournalLink = 'calendar' | 'phase' | 'events';
export type MoonJournalPart = string | { link: MoonJournalLink; text: string };

export interface MoonJournalPageCopy {
  title: string;
  description: string;
  appName: string;
  imageAlt: string;
  heading: string;
  lede: string;
  noscript: string;
  keptHeading: string;
  kept: readonly string[];
  datesHeading: string;
  dates: readonly MoonJournalPart[];
}

export const MOON_JOURNAL_LINKS: Record<MoonJournalLink, string> = {
  calendar: '/full-moon-calendar/',
  phase: '/moon-phase/',
  events: '/events/',
};

const EN: MoonJournalPageCopy = {
  title: 'Moon Journal: Notes for Each New and Full Moon',
  description: 'A private notebook for the new and full Moons, with a question for each one by sign. Kept only on your device, with no account.',
  appName: 'Moon Journal',
  imageAlt: 'Moon journal, Zodiacs.org',
  heading: 'A Moon journal that stays on your device.',
  lede: 'At each new Moon, a question about what you are starting. At each full Moon, a question about what has come to light. The question changes with the sign the Moon is in, and last cycle’s note sits beside it so you can see what moved.',
  noscript: 'The journal needs JavaScript to read the Moon for your device and to keep your notes in this browser. Enable it and reload to start writing.',
  keptHeading: 'Where your notes are kept',
  kept: [
    'Only in this browser, on this device. There is no account and no copy on our side: what you write is never sent to Zodiacs.org or anyone else, and this page does not load Guide or any outside script. Clearing this site’s data in your browser deletes the journal, and a private window forgets it when it closes.',
    'To keep a copy or move it to another device, use “Download my journal”. It saves a plain text file in Markdown that any notes app can open. “Delete everything” removes every entry from this browser.',
  ],
  datesHeading: 'Where the dates come from',
  dates: [
    'The new and full Moons are the exact instants from the site’s sky data, shown in your own time zone. The sign is where the Moon stands at that instant. Tonight’s phase is worked out on your device. Every date is also on the ',
    { link: 'calendar', text: 'full moon calendar' },
    ' and the ',
    { link: 'phase', text: 'moon phase' },
    ' page, and each new and full Moon has its own page in ',
    { link: 'events', text: 'sky events' },
    '.',
  ],
};

const ES: MoonJournalPageCopy = {
  title: 'Diario lunar: notas para cada luna nueva y llena',
  description: 'Un cuaderno privado para las lunas nuevas y llenas, con una pregunta para cada una según el signo. Se guarda solo en tu dispositivo, sin cuenta.',
  appName: 'Diario lunar',
  imageAlt: 'Diario lunar, Zodiacs.org',
  heading: 'Un diario lunar que se queda en tu dispositivo.',
  lede: 'En cada luna nueva, una pregunta sobre lo que estás empezando. En cada luna llena, una pregunta sobre lo que ha salido a la luz. La pregunta cambia con el signo en el que está la Luna, y la nota del ciclo anterior queda al lado para que veas qué se movió.',
  noscript: 'El diario necesita JavaScript para leer la Luna en tu dispositivo y guardar tus notas en este navegador. Actívalo y recarga la página para empezar a escribir.',
  keptHeading: 'Dónde se guardan tus notas',
  kept: [
    'Solo en este navegador, en este dispositivo. No hay cuenta ni copia de nuestro lado: lo que escribes nunca se envía a Zodiacs.org ni a nadie más, y esta página no carga Guide ni ningún script externo. Si borras los datos de este sitio en tu navegador, se borra el diario, y una ventana privada lo olvida al cerrarse.',
    'Para guardar una copia o llevarla a otro dispositivo, usa “Descargar mi diario”. Guarda un archivo de texto sencillo en Markdown que cualquier app de notas puede abrir. “Borrar todo” quita todas las entradas de este navegador.',
  ],
  datesHeading: 'De dónde salen las fechas',
  dates: [
    'Las lunas nuevas y llenas son los instantes exactos de los datos del cielo del sitio, mostrados en tu propia zona horaria. El signo es donde está la Luna en ese instante. La fase de esta noche se calcula en tu dispositivo. Todas las fechas están también en el ',
    { link: 'calendar', text: 'calendario de lunas llenas' },
    ' y en la página de la ',
    { link: 'phase', text: 'fase lunar' },
    ', y cada luna nueva y llena tiene su propia página en ',
    { link: 'events', text: 'eventos del cielo' },
    '.',
  ],
};

const PT: MoonJournalPageCopy = {
  title: 'Diário lunar: notas para cada lua nova e cheia',
  description: 'Um caderno privado para as luas novas e cheias, com uma pergunta para cada uma conforme o signo. Fica só no seu aparelho, sem conta.',
  appName: 'Diário lunar',
  imageAlt: 'Diário lunar, Zodiacs.org',
  heading: 'Um diário lunar que fica no seu aparelho.',
  lede: 'A cada lua nova, uma pergunta sobre o que você está começando. A cada lua cheia, uma pergunta sobre o que veio à tona. A pergunta muda com o signo em que a Lua está, e a nota do ciclo anterior fica ao lado para você ver o que mudou.',
  noscript: 'O diário precisa de JavaScript para ler a Lua no seu aparelho e guardar as suas notas neste navegador. Ative e recarregue a página para começar a escrever.',
  keptHeading: 'Onde as suas notas ficam',
  kept: [
    'Só neste navegador, neste aparelho. Não há conta nem cópia do nosso lado: o que você escreve nunca é enviado ao Zodiacs.org nem a mais ninguém, e esta página não carrega o Guide nem nenhum script de fora. Apagar os dados deste site no navegador apaga o diário, e uma janela anônima esquece tudo quando é fechada.',
    'Para guardar uma cópia ou levar para outro aparelho, use “Baixar o meu diário”. Ele salva um arquivo de texto simples em Markdown que qualquer app de notas consegue abrir. “Apagar tudo” remove todas as entradas deste navegador.',
  ],
  datesHeading: 'De onde vêm as datas',
  dates: [
    'As luas novas e cheias são os instantes exatos dos dados do céu do site, mostrados no seu próprio fuso horário. O signo é onde a Lua está nesse instante. A fase desta noite é calculada no seu aparelho. Todas as datas também estão no ',
    { link: 'calendar', text: 'calendário de luas cheias' },
    ' e na página da ',
    { link: 'phase', text: 'fase da Lua' },
    ', e cada lua nova e cheia tem a sua própria página em ',
    { link: 'events', text: 'eventos do céu' },
    '.',
  ],
};

const FR: MoonJournalPageCopy = {
  title: 'Journal lunaire : des notes pour chaque nouvelle et pleine Lune',
  description: 'Un carnet privé pour les nouvelles et pleines Lunes, avec une question pour chacune selon le signe. Conservé uniquement sur ton appareil, sans compte.',
  appName: 'Journal lunaire',
  imageAlt: 'Journal lunaire, Zodiacs.org',
  heading: 'Un journal lunaire qui reste sur ton appareil.',
  lede: 'À chaque nouvelle Lune, une question sur ce que tu commences. À chaque pleine Lune, une question sur ce qui est apparu au grand jour. La question change avec le signe où se trouve la Lune, et la note du cycle précédent reste à côté pour que tu voies ce qui a bougé.',
  noscript: 'Le journal a besoin de JavaScript pour lire la Lune sur ton appareil et garder tes notes dans ce navigateur. Active-le et recharge la page pour commencer à écrire.',
  keptHeading: 'Où tes notes sont gardées',
  kept: [
    'Uniquement dans ce navigateur, sur cet appareil. Il n’y a ni compte ni copie de notre côté : ce que tu écris n’est jamais envoyé à Zodiacs.org ni à personne d’autre, et cette page ne charge ni Guide ni aucun script extérieur. Effacer les données de ce site dans ton navigateur supprime le journal, et une fenêtre privée l’oublie en se fermant.',
    'Pour garder une copie ou le déplacer sur un autre appareil, utilise « Télécharger mon journal ». Cela enregistre un simple fichier texte en Markdown que n’importe quelle application de notes peut ouvrir. « Tout supprimer » retire toutes les entrées de ce navigateur.',
  ],
  datesHeading: 'D’où viennent les dates',
  dates: [
    'Les nouvelles et pleines Lunes sont les instants exacts des données du ciel du site, affichés dans ton propre fuseau horaire. Le signe est celui où se trouve la Lune à cet instant. La phase de ce soir est calculée sur ton appareil. Toutes les dates figurent aussi dans le ',
    { link: 'calendar', text: 'calendrier des pleines lunes' },
    ' et sur la page de la ',
    { link: 'phase', text: 'phase de la Lune' },
    ', et chaque nouvelle et pleine Lune a sa propre page dans les ',
    { link: 'events', text: 'événements du ciel' },
    '.',
  ],
};

const IT: MoonJournalPageCopy = {
  title: 'Diario lunare: note per ogni Luna nuova e piena',
  description: 'Un quaderno privato per le Lune nuove e piene, con una domanda per ciascuna secondo il segno. Resta solo sul tuo dispositivo, senza account.',
  appName: 'Diario lunare',
  imageAlt: 'Diario lunare, Zodiacs.org',
  heading: 'Un diario lunare che resta sul tuo dispositivo.',
  lede: 'A ogni Luna nuova, una domanda su ciò che stai cominciando. A ogni Luna piena, una domanda su ciò che è venuto alla luce. La domanda cambia con il segno in cui si trova la Luna, e la nota del ciclo precedente resta accanto così puoi vedere che cosa si è mosso.',
  noscript: 'Il diario ha bisogno di JavaScript per leggere la Luna sul tuo dispositivo e conservare le tue note in questo browser. Attivalo e ricarica la pagina per cominciare a scrivere.',
  keptHeading: 'Dove sono conservate le tue note',
  kept: [
    'Solo in questo browser, su questo dispositivo. Non c’è un account né una copia da parte nostra: ciò che scrivi non viene mai inviato a Zodiacs.org né a nessun altro, e questa pagina non carica Guide né alcuno script esterno. Cancellare i dati di questo sito nel browser elimina il diario, e una finestra in incognito lo dimentica quando si chiude.',
    'Per tenerne una copia o spostarlo su un altro dispositivo, usa “Scarica il mio diario”. Salva un semplice file di testo in Markdown che qualsiasi app di note può aprire. “Elimina tutto” toglie tutte le voci da questo browser.',
  ],
  datesHeading: 'Da dove vengono le date',
  dates: [
    'Le Lune nuove e piene sono gli istanti esatti dei dati del cielo del sito, mostrati nel tuo fuso orario. Il segno è quello in cui si trova la Luna in quell’istante. La fase di stanotte viene calcolata sul tuo dispositivo. Ogni data è anche nel ',
    { link: 'calendar', text: 'calendario delle lune piene' },
    ' e nella pagina della ',
    { link: 'phase', text: 'fase lunare' },
    ', e ogni Luna nuova e piena ha la sua pagina negli ',
    { link: 'events', text: 'eventi del cielo' },
    '.',
  ],
};

export const MOON_JOURNAL_PAGE_COPY: Readonly<Record<MoonJournalLocale, MoonJournalPageCopy>> = Object.freeze({
  en: EN, es: ES, pt: PT, fr: FR, it: IT,
});
