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
      note: 'Dos signos de fuego avanzan a la misma velocidad y perdonan a la misma velocidad. La pregunta abierta es quién se ocupa de los frenos.',
    },
    'earth+fire': {
      label: 'Chispa y suelo',
      note: 'El fuego pone el encendido; la tierra, la constancia. Funciona cuando cada signo deja de calificar el ritmo del otro.',
    },
    'air+fire': {
      label: 'Oxígeno',
      note: 'El aire alimenta al fuego y el fuego mantiene tibio al aire: una combinación rápida, conversadora y móvil. Alguien tiene que sostener el calendario de todos modos.',
    },
    'fire+water': {
      label: 'Vapor',
      note: 'El impulso se encuentra con el sentimiento: cada signo puede lo que el otro no. Manejado sin cuidado, quema; bien manejado, mueve cosas.',
    },
    'earth+earth': {
      label: 'Roca firme',
      note: 'Dos signos de tierra construyen una vida que funciona en el papel y en la práctica. Agendar las sorpresas se vuelve una tarea compartida.',
    },
    'air+earth': {
      label: 'Idea y presupuesto',
      note: 'El aire trae posibilidades; la tierra pregunta cuánto cuestan. Con respeto, eso es una sociedad; con impaciencia, un comité.',
    },
    'earth+water': {
      label: 'Río y orilla',
      note: 'El agua suaviza a la tierra y la tierra le da forma al agua: la combinación clásica de fuerza tranquila, con muy poca fricción.',
    },
    'air+air': {
      label: 'Viento cruzado',
      note: 'Conversación sin fin e independencia mutua. Los sentimientos necesitan una cita: hecha a propósito y cumplida.',
    },
    'air+water': {
      label: 'Ponerle nombre al clima',
      note: 'El aire quiere nombrar el sentimiento; el agua quiere sentirlo. El trabajo de traducción nunca termina del todo, y vale la pena hacerlo.',
    },
    'water+water': {
      label: 'Agua profunda',
      note: 'Dos signos de agua se leen sin subtítulos. La marea sube y baja para ambos a la vez: conviene tener un barómetro.',
    },
  },
  pt: {
    'fire+fire': {
      label: 'Calor compartilhado',
      note: 'Dois signos de fogo andam na mesma velocidade e perdoam na mesma velocidade. A pergunta em aberto é quem cuida dos freios.',
    },
    'earth+fire': {
      label: 'Faísca e solo',
      note: 'O fogo dá a ignição; a terra, a continuidade. Funciona quando cada signo para de dar nota ao ritmo do outro.',
    },
    'air+fire': {
      label: 'Oxigênio',
      note: 'O ar alimenta o fogo e o fogo mantém o ar aquecido: uma combinação rápida, falante e móvel. Alguém ainda precisa segurar a agenda.',
    },
    'fire+water': {
      label: 'Vapor',
      note: 'O impulso encontra o sentimento: cada signo consegue o que o outro não consegue. Sem cuidado, escalda; com cuidado, põe as coisas em movimento.',
    },
    'earth+earth': {
      label: 'Rocha firme',
      note: 'Dois signos de terra constroem uma vida que funciona no papel e na prática. Agendar as surpresas vira tarefa compartilhada.',
    },
    'air+earth': {
      label: 'Ideia e orçamento',
      note: 'O ar traz possibilidades; a terra pergunta quanto custam. Com respeito, isso é uma parceria; com impaciência, um comitê.',
    },
    'earth+water': {
      label: 'Rio e margem',
      note: 'A água amacia a terra e a terra dá forma à água: a combinação clássica de força tranquila, com pouquíssimo atrito.',
    },
    'air+air': {
      label: 'Vento cruzado',
      note: 'Conversa sem fim e independência mútua. Os sentimentos precisam de hora marcada: marcada de propósito e cumprida.',
    },
    'air+water': {
      label: 'Dar nome ao tempo',
      note: 'O ar quer dar nome ao sentimento; a água quer senti-lo. O trabalho de tradução nunca termina de vez, e vale a pena.',
    },
    'water+water': {
      label: 'Águas profundas',
      note: 'Dois signos de água se leem sem legenda. A maré sobe e desce para os dois ao mesmo tempo: vale ter um barômetro.',
    },
  },
  fr: {
    'fire+fire': {
      label: 'Chaleur partagée',
      note: 'Deux signes de feu avancent à la même vitesse et pardonnent à la même vitesse. Reste à savoir qui surveille les freins.',
    },
    'earth+fire': {
      label: 'Étincelle et terreau',
      note: 'Le feu apporte l’allumage, la terre la suite dans les idées. Ça marche dès que chaque signe cesse de noter le tempo de l’autre.',
    },
    'air+fire': {
      label: 'Oxygène',
      note: 'L’air nourrit le feu et le feu garde l’air au chaud : une alliance rapide, bavarde et mobile. Il faut quand même quelqu’un pour tenir le calendrier.',
    },
    'fire+water': {
      label: 'Vapeur',
      note: 'L’élan rencontre le sentiment : chaque signe sait faire ce que l’autre ne sait pas. Mal dosé, ça brûle ; bien dosé, ça fait avancer les choses.',
    },
    'earth+earth': {
      label: 'Socle',
      note: 'Deux signes de terre bâtissent une vie qui tient sur le papier comme en pratique. Programmer les surprises devient une corvée partagée.',
    },
    'air+earth': {
      label: 'Idée et devis',
      note: 'L’air apporte des possibilités, la terre demande ce qu’elles coûtent. Avec du respect, c’est un partenariat ; avec de l’impatience, un comité.',
    },
    'earth+water': {
      label: 'Rivière et berge',
      note: 'L’eau adoucit la terre et la terre donne une forme à l’eau : l’alliance classique de la force tranquille, avec très peu de frottement.',
    },
    'air+air': {
      label: 'Vent de travers',
      note: 'Conversation sans fin et indépendance mutuelle. Les sentiments ont besoin d’un rendez-vous, pris exprès et tenu.',
    },
    'air+water': {
      label: 'Nommer la météo',
      note: 'L’air veut nommer le sentiment ; l’eau veut le ressentir. Le travail de traduction ne s’arrête jamais vraiment, et il en vaut la peine.',
    },
    'water+water': {
      label: 'Eaux profondes',
      note: 'Deux signes d’eau se lisent sans sous-titres. La marée monte et descend pour les deux en même temps : mieux vaut garder un baromètre.',
    },
  },
  it: {
    'fire+fire': {
      label: 'Calore condiviso',
      note: 'Due segni di fuoco vanno alla stessa velocità e perdonano alla stessa velocità. La domanda aperta è chi bada ai freni.',
    },
    'earth+fire': {
      label: 'Scintilla e terreno',
      note: 'Il fuoco mette l’accensione, la terra la costanza. Funziona quando ciascun segno smette di dare i voti al ritmo dell’altro.',
    },
    'air+fire': {
      label: 'Ossigeno',
      note: 'L’aria alimenta il fuoco e il fuoco tiene calda l’aria: una combinazione rapida, loquace e mobile. Qualcuno deve comunque tenere fermo il calendario.',
    },
    'fire+water': {
      label: 'Vapore',
      note: 'L’impulso incontra il sentimento: ciascun segno sa fare ciò che l’altro non sa. Gestito male scotta; gestito bene muove le cose.',
    },
    'earth+earth': {
      label: 'Fondamenta',
      note: 'Due segni di terra costruiscono una vita che funziona sulla carta e nella pratica. Mettere in agenda le sorprese diventa un compito condiviso.',
    },
    'air+earth': {
      label: 'Idea e preventivo',
      note: 'L’aria porta possibilità, la terra chiede quanto costano. Con il rispetto è una società; con l’impazienza, un comitato.',
    },
    'earth+water': {
      label: 'Fiume e argine',
      note: 'L’acqua ammorbidisce la terra e la terra dà forma all’acqua: la classica combinazione dalla forza tranquilla, con pochissimo attrito.',
    },
    'air+air': {
      label: 'Vento di traverso',
      note: 'Conversazione infinita e indipendenza reciproca. I sentimenti hanno bisogno di un appuntamento: preso apposta e rispettato.',
    },
    'air+water': {
      label: 'Dare un nome al tempo',
      note: 'L’aria vuole dare un nome al sentimento; l’acqua vuole sentirlo. Il lavoro di traduzione non finisce mai del tutto, e vale la pena farlo.',
    },
    'water+water': {
      label: 'Acque profonde',
      note: 'Due segni d’acqua si leggono senza sottotitoli. La marea sale e scende per tutti e due insieme: conviene tenere un barometro.',
    },
  },
};

const MODALITY_NOTES: Record<PairLocale, NoteTable> = {
  es: {
    'cardinal+cardinal': {
      label: 'Dos que inician',
      note: 'Ambos signos abren estaciones; ambos llegan con un plan. La negociación real es cuál plan se aplica este trimestre.',
    },
    'cardinal+fixed': {
      label: 'Quien inicia y quien sostiene',
      note: 'Un signo lanza, el otro mantiene. Reparte el trabajo de maravilla, siempre que también se reparta el crédito.',
    },
    'cardinal+mutable': {
      label: 'Quien inicia y quien se adapta',
      note: 'Un signo marca el rumbo, el otro corrige el curso sin ego. Poca fricción: cuida que la deriva no reemplace al timón.',
    },
    'fixed+fixed': {
      label: 'Dos anclas',
      note: 'Dos signos duraderos, leales e inamovibles en la misma discusión. Los desacuerdos se calcifican si nadie cede con cita previa.',
    },
    'fixed+mutable': {
      label: 'Ancla y vela',
      note: 'Estabilidad más flexibilidad: cada signo aporta lo que el otro se salta. Solo molesta cuando alguno niega la función del otro.',
    },
    'mutable+mutable': {
      label: 'Dos velas',
      note: 'Dos signos adaptables sin fin y rara vez en conflicto abierto. Las decisiones pueden orbitar meses sin aterrizar: conviene poner una fecha límite.',
    },
  },
  pt: {
    'cardinal+cardinal': {
      label: 'Dois que começam',
      note: 'Os dois signos abrem estações; os dois chegam com um plano. A negociação de verdade é qual plano vale neste trimestre.',
    },
    'cardinal+fixed': {
      label: 'Quem começa e quem mantém',
      note: 'Um signo lança, o outro sustenta. Divide o trabalho lindamente, desde que o crédito também seja dividido.',
    },
    'cardinal+mutable': {
      label: 'Quem começa e quem se adapta',
      note: 'Um signo define a direção, o outro ajusta o curso sem ego. Pouco atrito: cuidado para a deriva não tomar o lugar do leme.',
    },
    'fixed+fixed': {
      label: 'Duas âncoras',
      note: 'Dois signos duráveis, leais e irremovíveis na mesma discussão. As divergências calcificam, a menos que alguém ceda com hora marcada.',
    },
    'fixed+mutable': {
      label: 'Âncora e vela',
      note: 'Estabilidade mais flexibilidade: cada signo oferece o que o outro pula. Só vira ressentimento quando um nega a função do outro.',
    },
    'mutable+mutable': {
      label: 'Duas velas',
      note: 'Dois signos infinitamente adaptáveis e raramente em conflito aberto. As decisões podem orbitar por meses sem pousar: vale definir um prazo.',
    },
  },
  fr: {
    'cardinal+cardinal': {
      label: 'Deux signes qui lancent',
      note: 'Les deux ouvrent une saison ; les deux arrivent avec un plan. La vraie négociation porte sur le plan qui s’applique ce trimestre.',
    },
    'cardinal+fixed': {
      label: 'Lancer et tenir',
      note: 'Un signe lance, l’autre fait durer. La répartition du travail est superbe, tant que le mérite est réparti lui aussi.',
    },
    'cardinal+mutable': {
      label: 'Lancer et ajuster',
      note: 'Un signe fixe le cap, l’autre corrige la route sans ego. Peu de frottement : attention à ce que la dérive ne remplace pas la barre.',
    },
    'fixed+fixed': {
      label: 'Deux ancres',
      note: 'Deux signes durables, loyaux et inébranlables dans la même dispute. Les désaccords se figent, sauf si quelqu’un cède sur rendez-vous.',
    },
    'fixed+mutable': {
      label: 'Ancre et voile',
      note: 'Stabilité plus souplesse : chaque signe fournit ce que l’autre saute. Le ressentiment ne vient que lorsque l’un nie la fonction de l’autre.',
    },
    'mutable+mutable': {
      label: 'Deux voiles',
      note: 'Deux signes adaptables à l’infini et rarement en conflit ouvert. Les décisions peuvent rester en orbite pendant des mois : mieux vaut fixer une échéance.',
    },
  },
  it: {
    'cardinal+cardinal': {
      label: 'Due segni che avviano',
      note: 'Entrambi aprono una stagione; entrambi arrivano con un piano. La vera trattativa è quale piano vale in questo trimestre.',
    },
    'cardinal+fixed': {
      label: 'Chi avvia e chi mantiene',
      note: 'Un segno lancia, l’altro fa durare. Divide il lavoro benissimo, purché si divida anche il merito.',
    },
    'cardinal+mutable': {
      label: 'Chi avvia e chi si adatta',
      note: 'Un segno fissa la direzione, l’altro corregge la rotta senza ego. Poco attrito: attenzione che la deriva non prenda il posto del timone.',
    },
    'fixed+fixed': {
      label: 'Due ancore',
      note: 'Due segni durevoli, leali e irremovibili nella stessa discussione. I disaccordi si calcificano, a meno che qualcuno non ceda su appuntamento.',
    },
    'fixed+mutable': {
      label: 'Ancora e vela',
      note: 'Stabilità più flessibilità: ciascun segno fornisce ciò che l’altro salta. Il risentimento nasce solo quando uno nega la funzione dell’altro.',
    },
    'mutable+mutable': {
      label: 'Due vele',
      note: 'Due segni adattabili all’infinito e di rado in conflitto aperto. Le decisioni possono restare in orbita per mesi senza atterrare: conviene fissare una scadenza.',
    },
  },
};

const POLARITY_NOTES: Record<PairLocale, { day: string; night: string; mixed: string }> = {
  es: {
    day: 'Dos signos diurnos: la energía va hacia afuera en ambos lados, hacia la acción y la expresión. El descanso es el punto ciego compartido.',
    night: 'Dos signos nocturnos: ambos procesan hacia adentro antes de que algo se note. Aquí los silencios suelen ser trabajo, no distancia.',
    mixed: 'Un signo diurno y uno nocturno: uno piensa en voz alta, el otro piensa primero. Cada uno aporta el registro que el otro se salta.',
  },
  pt: {
    day: 'Dois signos diurnos: a energia corre para fora dos dois lados, rumo à ação e à expressão. O descanso é o ponto cego em comum.',
    night: 'Dois signos noturnos: os dois processam por dentro antes que algo apareça. Aqui os silêncios costumam ser trabalho, não distância.',
    mixed: 'Um signo diurno e um noturno: um pensa em voz alta, o outro pensa primeiro. Cada um oferece o registro que o outro pula.',
  },
  fr: {
    day: 'Deux signes diurnes : l’énergie part vers l’extérieur des deux côtés, vers l’action et l’expression. Le repos est l’angle mort commun.',
    night: 'Deux signes nocturnes : les deux digèrent à l’intérieur avant que rien ne se voie. Ici, les silences sont en général du travail, pas de la distance.',
    mixed: 'Un signe diurne et un signe nocturne : l’un pense à voix haute, l’autre pense d’abord. Chacun apporte le registre que l’autre saute.',
  },
  it: {
    day: 'Due segni diurni: l’energia va verso l’esterno da entrambe le parti, verso l’azione e l’espressione. Il riposo è il punto cieco in comune.',
    night: 'Due segni notturni: entrambi elaborano dentro prima che si veda qualcosa. Qui i silenzi di solito sono lavoro, non distanza.',
    mixed: 'Un segno diurno e uno notturno: uno pensa ad alta voce, l’altro prima pensa. Ciascuno porta il registro che l’altro salta.',
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
