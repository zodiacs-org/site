/**
 * The pair page's computed panel and derived questions in the four
 * translated languages. English stays in compat.ts, which also owns the
 * logic (which combination a pair is); this file only carries wording.
 * Server-side only: the translated pair pages render it at build time and
 * no island imports it.
 */
import { pairFacts } from './compat';
import type { InteractionNote, PairFacts } from './compat';
import { signName } from './signs';
import type { Sign } from './signs';

export type PairLocale = 'es' | 'pt' | 'fr' | 'it';
export const PAIR_LOCALES: readonly PairLocale[] = ['es', 'pt', 'fr', 'it'];

type NoteTable = Record<string, InteractionNote>;

const ELEMENT_NOTES: Record<PairLocale, NoteTable> = {
  es: {
    'fire+fire': {
      label: 'Calor compartido',
      note: 'Dos signos de fuego comparten el ritmo: rápidos para empezar, rápidos para perdonar y rara vez faltos de energía.',
    },
    'earth+fire': {
      label: 'Chispa y suelo',
      note: 'El fuego suele empezar las cosas y la tierra, llevarlas a término: dos velocidades distintas, y cada una cubre lo que la otra deja.',
    },
    'air+fire': {
      label: 'Oxígeno',
      note: 'El aire alimenta al fuego y el fuego calienta al aire: una combinación rápida, conversadora e inquieta.',
    },
    'fire+water': {
      label: 'Vapor',
      note: 'El impulso se encuentra con el sentimiento, y cada uno tiene lo que al otro le suele faltar. La astrología lo lee como una mezcla intensa, en ambas direcciones.',
    },
    'earth+earth': {
      label: 'Roca firme',
      note: 'Dos signos de tierra comparten el gusto por lo práctico y lo duradero: una combinación estable y con los pies en la tierra.',
    },
    'air+earth': {
      label: 'Idea y presupuesto',
      note: 'El aire trae posibilidades y la tierra pregunta cuánto costarían: las ideas se encuentran con la práctica.',
    },
    'earth+water': {
      label: 'Río y orilla',
      note: 'El agua suaviza a la tierra y la tierra le da forma al agua: la combinación clásica de fuerza tranquila en la astrología.',
    },
    'air+air': {
      label: 'Viento cruzado',
      note: 'Conversación sin fin y mucho espacio para cada uno. Dos signos de aire suelen encontrarse primero en las ideas y después en los sentimientos.',
    },
    'air+water': {
      label: 'Ponerle nombre al clima',
      note: 'El aire quiere ponerle nombre al sentimiento; el agua quiere sentirlo. Dos lenguajes distintos para el mismo clima.',
    },
    'water+water': {
      label: 'Agua profunda',
      note: 'Dos signos de agua se leen sin subtítulos y suelen compartir un estado de ánimo en cuanto llega.',
    },
  },
  pt: {
    'fire+fire': {
      label: 'Calor compartilhado',
      note: 'Dois signos de fogo compartilham o ritmo: rápidos para começar, rápidos para perdoar e raramente sem energia.',
    },
    'earth+fire': {
      label: 'Faísca e solo',
      note: 'O fogo costuma começar as coisas e a terra, levá-las até o fim: duas velocidades diferentes, cada uma cobrindo o que a outra deixa.',
    },
    'air+fire': {
      label: 'Oxigênio',
      note: 'O ar alimenta o fogo e o fogo aquece o ar: uma combinação rápida, falante e inquieta.',
    },
    'fire+water': {
      label: 'Vapor',
      note: 'O impulso encontra o sentimento, e cada um tem o que costuma faltar ao outro. A astrologia lê isso como uma mistura intensa, nos dois sentidos.',
    },
    'earth+earth': {
      label: 'Rocha firme',
      note: 'Dois signos de terra compartilham o gosto pelo que é prático e duradouro: uma combinação estável e com os pés no chão.',
    },
    'air+earth': {
      label: 'Ideia e orçamento',
      note: 'O ar traz possibilidades e a terra pergunta quanto custariam: as ideias encontram a prática.',
    },
    'earth+water': {
      label: 'Rio e margem',
      note: 'A água amacia a terra e a terra dá forma à água: a combinação clássica de força tranquila na astrologia.',
    },
    'air+air': {
      label: 'Vento cruzado',
      note: 'Conversa sem fim e bastante espaço para cada um. Dois signos de ar costumam se encontrar primeiro nas ideias e depois nos sentimentos.',
    },
    'air+water': {
      label: 'Dar nome ao tempo',
      note: 'O ar quer dar nome ao sentimento; a água quer senti-lo. Duas línguas diferentes para o mesmo tempo.',
    },
    'water+water': {
      label: 'Águas profundas',
      note: 'Dois signos de água se leem sem legenda e costumam compartilhar um estado de espírito assim que ele chega.',
    },
  },
  fr: {
    'fire+fire': {
      label: 'Chaleur partagée',
      note: 'Deux signes de feu partagent le même rythme : prompts à démarrer, prompts à pardonner, et rarement à court d’énergie.',
    },
    'earth+fire': {
      label: 'Étincelle et terreau',
      note: 'Le feu tend à lancer les choses et la terre à les mener à bout : deux vitesses différentes, chacune couvrant ce que l’autre laisse.',
    },
    'air+fire': {
      label: 'Oxygène',
      note: 'L’air nourrit le feu et le feu réchauffe l’air : une alliance rapide, bavarde et remuante.',
    },
    'fire+water': {
      label: 'Vapeur',
      note: 'L’élan rencontre le sentiment, et chacun possède ce qui manque souvent à l’autre. L’astrologie y lit un mélange fort, dans les deux sens.',
    },
    'earth+earth': {
      label: 'Socle',
      note: 'Deux signes de terre partagent le goût du concret et du durable : une alliance stable, les pieds sur terre.',
    },
    'air+earth': {
      label: 'Idée et devis',
      note: 'L’air apporte des possibilités et la terre demande ce qu’elles coûteraient : les idées rencontrent la pratique.',
    },
    'earth+water': {
      label: 'Rivière et berge',
      note: 'L’eau adoucit la terre et la terre donne une forme à l’eau : l’alliance classique de la force tranquille en astrologie.',
    },
    'air+air': {
      label: 'Vent de travers',
      note: 'Conversation sans fin et beaucoup d’espace pour chacun. Deux signes d’air se rejoignent souvent d’abord dans les idées, ensuite dans les sentiments.',
    },
    'air+water': {
      label: 'Nommer la météo',
      note: 'L’air veut nommer le sentiment ; l’eau veut le ressentir. Deux langages différents pour la même météo.',
    },
    'water+water': {
      label: 'Eaux profondes',
      note: 'Deux signes d’eau se lisent sans sous-titres et partagent souvent une humeur dès qu’elle arrive.',
    },
  },
  it: {
    'fire+fire': {
      label: 'Calore condiviso',
      note: 'Due segni di fuoco condividono il passo: veloci a cominciare, veloci a perdonare e raramente a corto di energia.',
    },
    'earth+fire': {
      label: 'Scintilla e terreno',
      note: 'Il fuoco tende ad avviare le cose e la terra a portarle a termine: due velocità diverse, ciascuna copre ciò che l’altra lascia.',
    },
    'air+fire': {
      label: 'Ossigeno',
      note: 'L’aria alimenta il fuoco e il fuoco scalda l’aria: una combinazione rapida, loquace e irrequieta.',
    },
    'fire+water': {
      label: 'Vapore',
      note: 'L’impulso incontra il sentimento, e ciascuno ha ciò che spesso manca all’altro. L’astrologia lo legge come una miscela intensa, in entrambe le direzioni.',
    },
    'earth+earth': {
      label: 'Fondamenta',
      note: 'Due segni di terra condividono il gusto per ciò che è pratico e duraturo: una combinazione stabile e con i piedi per terra.',
    },
    'air+earth': {
      label: 'Idea e preventivo',
      note: 'L’aria porta possibilità e la terra chiede quanto costerebbero: le idee incontrano la pratica.',
    },
    'earth+water': {
      label: 'Fiume e argine',
      note: 'L’acqua ammorbidisce la terra e la terra dà forma all’acqua: la classica combinazione astrologica della forza tranquilla.',
    },
    'air+air': {
      label: 'Vento di traverso',
      note: 'Conversazione infinita e molto spazio per ciascuno. Due segni d’aria tendono a incontrarsi prima nelle idee e poi nei sentimenti.',
    },
    'air+water': {
      label: 'Dare un nome al tempo',
      note: 'L’aria vuole dare un nome al sentimento; l’acqua vuole sentirlo. Due lingue diverse per lo stesso tempo.',
    },
    'water+water': {
      label: 'Acque profonde',
      note: 'Due segni d’acqua si leggono senza sottotitoli e tendono a condividere uno stato d’animo appena arriva.',
    },
  },
};

const MODALITY_NOTES: Record<PairLocale, NoteTable> = {
  es: {
    'cardinal+cardinal': {
      label: 'Dos que inician',
      note: 'Ambos signos abren una estación, y ambos suelen llegar con un plan propio.',
    },
    'cardinal+fixed': {
      label: 'Quien inicia y quien sostiene',
      note: 'Uno suele lanzar y el otro sostener: las dos mitades de sacar algo adelante.',
    },
    'cardinal+mutable': {
      label: 'Quien inicia y quien se adapta',
      note: 'Uno suele marcar el rumbo y el otro, corregirlo sobre la marcha.',
    },
    'fixed+fixed': {
      label: 'Dos anclas',
      note: 'Dos signos fijos: constantes, leales y lentos para cambiar de rumbo.',
    },
    'fixed+mutable': {
      label: 'Ancla y vela',
      note: 'La estabilidad se encuentra con la flexibilidad, y cada signo aporta lo que el otro suele saltarse.',
    },
    'mutable+mutable': {
      label: 'Dos velas',
      note: 'Ambos signos se adaptan con facilidad y rara vez se atrincheran, así que las decisiones suelen quedar abiertas más tiempo.',
    },
  },
  pt: {
    'cardinal+cardinal': {
      label: 'Dois que começam',
      note: 'Os dois signos abrem uma estação, e os dois costumam chegar com um plano próprio.',
    },
    'cardinal+fixed': {
      label: 'Quem começa e quem mantém',
      note: 'Um costuma lançar e o outro sustentar: as duas metades de fazer algo acontecer.',
    },
    'cardinal+mutable': {
      label: 'Quem começa e quem se adapta',
      note: 'Um costuma definir a direção e o outro, ajustar o rumo pelo caminho.',
    },
    'fixed+fixed': {
      label: 'Duas âncoras',
      note: 'Dois signos fixos: constantes, leais e lentos para mudar de rumo.',
    },
    'fixed+mutable': {
      label: 'Âncora e vela',
      note: 'A estabilidade encontra a flexibilidade, e cada signo oferece o que o outro costuma pular.',
    },
    'mutable+mutable': {
      label: 'Duas velas',
      note: 'Os dois signos se adaptam com facilidade e raramente fincam pé, então as decisões costumam ficar em aberto por mais tempo.',
    },
  },
  fr: {
    'cardinal+cardinal': {
      label: 'Deux signes qui lancent',
      note: 'Les deux signes ouvrent une saison, et tous deux arrivent souvent avec leur propre plan.',
    },
    'cardinal+fixed': {
      label: 'Lancer et tenir',
      note: 'L’un tend à lancer et l’autre à faire durer : les deux moitiés d’un projet mené à bien.',
    },
    'cardinal+mutable': {
      label: 'Lancer et ajuster',
      note: 'L’un tend à fixer le cap et l’autre à corriger la route en chemin.',
    },
    'fixed+fixed': {
      label: 'Deux ancres',
      note: 'Deux signes fixes : constants, loyaux et lents à changer de cap.',
    },
    'fixed+mutable': {
      label: 'Ancre et voile',
      note: 'La stabilité rencontre la souplesse, chaque signe apportant ce que l’autre a tendance à sauter.',
    },
    'mutable+mutable': {
      label: 'Deux voiles',
      note: 'Les deux signes s’adaptent facilement et campent rarement sur leurs positions, si bien que les décisions restent souvent ouvertes plus longtemps.',
    },
  },
  it: {
    'cardinal+cardinal': {
      label: 'Due segni che avviano',
      note: 'Entrambi i segni aprono una stagione, ed entrambi tendono ad arrivare con un piano proprio.',
    },
    'cardinal+fixed': {
      label: 'Chi avvia e chi mantiene',
      note: 'Uno tende ad avviare e l’altro a sostenere: le due metà di un lavoro portato a termine.',
    },
    'cardinal+mutable': {
      label: 'Chi avvia e chi si adatta',
      note: 'Uno tende a fissare la direzione e l’altro a correggere la rotta strada facendo.',
    },
    'fixed+fixed': {
      label: 'Due ancore',
      note: 'Due segni fissi: costanti, leali e lenti a cambiare rotta.',
    },
    'fixed+mutable': {
      label: 'Ancora e vela',
      note: 'La stabilità incontra la flessibilità, e ciascun segno fornisce ciò che l’altro tende a saltare.',
    },
    'mutable+mutable': {
      label: 'Due vele',
      note: 'Entrambi i segni si adattano con facilità e di rado si impuntano, così le decisioni tendono a restare aperte più a lungo.',
    },
  },
};

const POLARITY_NOTES: Record<PairLocale, { day: string; night: string; mixed: string }> = {
  es: {
    day: 'Dos signos diurnos: la energía va hacia afuera en ambos lados, hacia la acción y la expresión.',
    night: 'Dos signos nocturnos: ambos suelen procesar hacia adentro antes de que algo se note.',
    mixed: 'Un signo diurno y uno nocturno: uno suele pensar en voz alta y el otro, pensar primero.',
  },
  pt: {
    day: 'Dois signos diurnos: a energia corre para fora dos dois lados, rumo à ação e à expressão.',
    night: 'Dois signos noturnos: os dois costumam processar por dentro antes que algo apareça.',
    mixed: 'Um signo diurno e um noturno: um costuma pensar em voz alta, o outro, pensar primeiro.',
  },
  fr: {
    day: 'Deux signes diurnes : l’énergie part vers l’extérieur des deux côtés, vers l’action et l’expression.',
    night: 'Deux signes nocturnes : tous deux digèrent souvent à l’intérieur avant que rien ne se voie.',
    mixed: 'Un signe diurne et un signe nocturne : l’un pense souvent à voix haute, l’autre d’abord en silence.',
  },
  it: {
    day: 'Due segni diurni: l’energia va verso l’esterno da entrambe le parti, verso l’azione e l’espressione.',
    night: 'Due segni notturni: entrambi tendono a elaborare dentro prima che si veda qualcosa.',
    mixed: 'Un segno diurno e uno notturno: uno tende a pensare ad alta voce, l’altro a pensare prima.',
  },
};

const comboKey = (a: string, b: string) => [a, b].sort().join('+');

function polarityNote(locale: PairLocale, a: Sign, b: Sign): string {
  const notes = POLARITY_NOTES[locale];
  if (a.polarity === 'day' && b.polarity === 'day') return notes.day;
  if (a.polarity === 'night' && b.polarity === 'night') return notes.night;
  return notes.mixed;
}

export interface LocalizedPairFacts extends PairFacts {
  locale: PairLocale;
  /** Sign names in the page's language, in zodiac order. */
  nameA: string;
  nameB: string;
}

/** compat.ts's pairFacts with the panel wording in the page's language. */
export function localizedPairFacts(locale: PairLocale, slugA: string, slugB: string): LocalizedPairFacts {
  const facts = pairFacts(slugA, slugB);
  const element = ELEMENT_NOTES[locale][comboKey(facts.a.element, facts.b.element)];
  const modality = MODALITY_NOTES[locale][comboKey(facts.a.modality, facts.b.modality)];
  if (!element || !modality) throw new Error(`Missing ${locale} pair note for ${facts.slug}`);
  return {
    ...facts,
    locale,
    nameA: signName(facts.a, locale),
    nameB: signName(facts.b, locale),
    element,
    modality,
    polarity: polarityNote(locale, facts.a, facts.b),
  };
}

interface FaqCopy {
  /** How the pair is named inside a question, e.g. "Aries y Leo". */
  names: (a: string, b: string, same: boolean) => string;
  how: (names: string) => string;
  howAnswer: (label: string, note: string) => string;
  clash: (names: string) => string;
  clashAnswer: (label: string, note: string) => string;
  compatible: (names: string) => string;
  compatibleAnswer: (polarity: string) => string;
}

const FAQ_COPY: Record<PairLocale, FaqCopy> = {
  es: {
    names: (a, b, same) => (same ? `dos ${a}` : `${a} y ${b}`),
    how: (names) => `¿Cómo funcionan ${names} en una relación?`,
    howAnswer: (label, note) => `${label} es el patrón de partida: ${note} El resto de ambas cartas natales decide cómo se vive ese patrón.`,
    clash: (names) => `¿En qué suelen chocar ${names}?`,
    clashAnswer: (label, note) => `${label} describe cómo se encuentran las decisiones y los ritmos: ${note}`,
    compatible: (names) => `¿Son compatibles ${names}?`,
    compatibleAnswer: (polarity) => `Pueden serlo. Los signos solares describen un punto de partida, no un veredicto. ${polarity} Una comparación completa también lee las dos Lunas, los dos Venus, los dos Martes y los aspectos entre las cartas.`,
  },
  pt: {
    names: (a, b) => `${a} e ${b}`,
    how: (names) => `Como ${names} funcionam em um relacionamento?`,
    howAnswer: (label, note) => `${label} é o padrão de partida: ${note} O restante dos dois mapas astrais decide como esse padrão é vivido.`,
    clash: (names) => `Onde ${names} costumam se desentender?`,
    clashAnswer: (label, note) => `${label} descreve como as decisões e os ritmos se encontram: ${note}`,
    compatible: (names) => `${names} são compatíveis?`,
    compatibleAnswer: (polarity) => `Podem ser. Os signos solares descrevem um ponto de partida, não um veredito. ${polarity} Uma comparação completa também lê as duas Luas, os dois Vênus, os dois Martes e os aspectos entre os mapas.`,
  },
  fr: {
    names: (a, b) => `${a}-${b}`,
    how: (names) => `Comment fonctionne le duo ${names} dans une relation ?`,
    howAnswer: (label, note) => `${label} : c’est le schéma de départ. ${note} Le reste des deux thèmes astraux décide de la façon dont ce schéma se vit.`,
    clash: (names) => `Où le duo ${names} a-t-il tendance à s’accrocher ?`,
    clashAnswer: (label, note) => `${label} : voilà comment les décisions et les rythmes se rencontrent. ${note}`,
    compatible: (names) => `Le duo ${names} est-il compatible ?`,
    compatibleAnswer: (polarity) => `Il peut l’être. Les signes solaires décrivent un point de départ, pas un verdict. ${polarity} Une comparaison complète lit aussi les deux Lunes, les deux Vénus, les deux Mars et les aspects entre les thèmes.`,
  },
  it: {
    names: (a, b) => `${a}-${b}`,
    how: (names) => `Come funziona in una relazione la coppia ${names}?`,
    howAnswer: (label, note) => `${label} è lo schema di partenza: ${note} Il resto dei due temi natali decide come quello schema viene vissuto.`,
    clash: (names) => `Dove tende a scontrarsi la coppia ${names}?`,
    clashAnswer: (label, note) => `${label} descrive come si incontrano decisioni e ritmi: ${note}`,
    compatible: (names) => `La coppia ${names} è compatibile?`,
    compatibleAnswer: (polarity) => `Può esserlo. I segni solari descrivono un punto di partenza, non un verdetto. ${polarity} Un confronto completo legge anche le due Lune, le due Veneri, i due Marte e gli aspetti tra i temi natali.`,
  },
};

/** The three questions every pair page answers from its computed panel. */
export function localizedPairFaq(locale: PairLocale, [slugA, slugB]: [string, string]) {
  const facts = localizedPairFacts(locale, slugA, slugB);
  const copy = FAQ_COPY[locale];
  const names = copy.names(facts.nameA, facts.nameB, facts.same);
  return [
    { q: copy.how(names), a: copy.howAnswer(facts.element.label, facts.element.note) },
    { q: copy.clash(names), a: copy.clashAnswer(facts.modality.label, facts.modality.note) },
    { q: copy.compatible(names), a: copy.compatibleAnswer(facts.polarity) },
  ];
}
