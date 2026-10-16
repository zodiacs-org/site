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
      note: 'Ustedes van a todo gas: química inmediata, peleas rápidas y reconciliaciones aún más rápidas. Esperen mucha emoción.',
    },
    'earth+fire': {
      label: 'Chispa y suelo',
      note: 'El fuego empieza y la tierra termina: juntos harán mucho, pero esperen choques por el ritmo.',
    },
    'air+fire': {
      label: 'Oxígeno',
      note: 'El aire aviva el fuego: conversaciones animadas, grandes planes y un vínculo divertido y veloz.',
    },
    'fire+water': {
      label: 'Vapor',
      note: 'La pasión se encuentra con el sentimiento: atracción intensa, pero los ánimos pueden desbordarse. Esta pareja necesita paciencia.',
    },
    'earth+earth': {
      label: 'Roca firme',
      note: 'Estables y leales: construyen algo sólido juntos, aunque el romance puede caer en la rutina.',
    },
    'air+earth': {
      label: 'Idea y presupuesto',
      note: 'Las ideas se encuentran con lo práctico: se equilibran, pero uno puede ver al otro demasiado soñador o demasiado prudente.',
    },
    'earth+water': {
      label: 'Río y orilla',
      note: 'Una de las mejores parejas de la astrología: el agua suaviza a la tierra, la tierra le da forma al agua y crece una confianza profunda.',
    },
    'air+air': {
      label: 'Viento cruzado',
      note: 'Primero mejores amigos: conversación sin fin y mucha libertad, aunque los sentimientos profundos pueden quedar sin decir.',
    },
    'air+water': {
      label: 'Ponerle nombre al clima',
      note: 'La cabeza se encuentra con el corazón: el aire quiere hablarlo y el agua quiere sentirlo. Esperen malentendidos si falta paciencia.',
    },
    'water+water': {
      label: 'Agua profunda',
      note: 'Se leen al instante: un vínculo profundo e intuitivo, y sentirán el estado de ánimo del otro.',
    },
  },
  pt: {
    'fire+fire': {
      label: 'Calor compartilhado',
      note: 'Vocês esquentam rápido: química imediata, brigas rápidas e reconciliações ainda mais rápidas. Esperem muita emoção.',
    },
    'earth+fire': {
      label: 'Faísca e solo',
      note: 'O fogo começa e a terra termina: juntos vocês fazem muito, mas esperem atritos por causa do ritmo.',
    },
    'air+fire': {
      label: 'Oxigênio',
      note: 'O ar aviva o fogo: conversas animadas, grandes planos e um vínculo divertido e veloz.',
    },
    'fire+water': {
      label: 'Vapor',
      note: 'A paixão encontra o sentimento: atração intensa, mas os ânimos podem transbordar. Este casal precisa de paciência.',
    },
    'earth+earth': {
      label: 'Rocha firme',
      note: 'Estáveis e leais: vocês constroem algo sólido juntos, embora o romance possa cair na rotina.',
    },
    'air+earth': {
      label: 'Ideia e orçamento',
      note: 'As ideias encontram o lado prático: vocês se equilibram, mas um pode achar o outro sonhador demais ou cauteloso demais.',
    },
    'earth+water': {
      label: 'Rio e margem',
      note: 'Um dos melhores pares da astrologia: a água amacia a terra, a terra dá forma à água e cresce uma confiança profunda.',
    },
    'air+air': {
      label: 'Vento cruzado',
      note: 'Melhores amigos primeiro: conversa sem fim e muita liberdade, embora os sentimentos profundos possam ficar sem ser ditos.',
    },
    'air+water': {
      label: 'Dar nome ao tempo',
      note: 'A cabeça encontra o coração: o ar quer conversar e a água quer sentir. Esperem mal-entendidos se faltar paciência.',
    },
    'water+water': {
      label: 'Águas profundas',
      note: 'Vocês se leem na hora: um vínculo profundo e intuitivo, e vão sentir o humor um do outro.',
    },
  },
  fr: {
    'fire+fire': {
      label: 'Chaleur partagée',
      note: 'Vous deux, ça brûle : une alchimie immédiate, des disputes rapides et des réconciliations encore plus rapides. Attendez-vous à beaucoup d’intensité.',
    },
    'earth+fire': {
      label: 'Étincelle et terreau',
      note: 'Le feu lance, la terre termine : vous accomplirez beaucoup ensemble, mais attendez-vous à des frictions sur le rythme.',
    },
    'air+fire': {
      label: 'Oxygène',
      note: 'L’air attise le feu : des conversations animées, de grands projets et un lien vif et joyeux.',
    },
    'fire+water': {
      label: 'Vapeur',
      note: 'La passion rencontre le sentiment : une attirance intense, mais les humeurs peuvent déborder. Ce duo a besoin de patience.',
    },
    'earth+earth': {
      label: 'Socle',
      note: 'Stables et fidèles : vous bâtissez quelque chose de solide ensemble, même si la romance peut tomber dans la routine.',
    },
    'air+earth': {
      label: 'Idée et devis',
      note: 'Les idées rencontrent le concret : vous vous équilibrez, mais l’un peut trouver l’autre trop rêveur ou trop prudent.',
    },
    'earth+water': {
      label: 'Rivière et berge',
      note: 'L’un des meilleurs duos de l’astrologie : l’eau adoucit la terre, la terre donne forme à l’eau, et une confiance profonde s’installe.',
    },
    'air+air': {
      label: 'Vent de travers',
      note: 'Meilleurs amis d’abord : une conversation sans fin et beaucoup de liberté, même si les sentiments profonds restent parfois tus.',
    },
    'air+water': {
      label: 'Nommer la météo',
      note: 'La tête rencontre le cœur : l’air veut en parler, l’eau veut le ressentir. Attendez-vous à des malentendus sans patience.',
    },
    'water+water': {
      label: 'Eaux profondes',
      note: 'Vous vous lisez instantanément : un lien profond et intuitif, et vous ressentirez les humeurs l’un de l’autre.',
    },
  },
  it: {
    'fire+fire': {
      label: 'Calore condiviso',
      note: 'Voi due bruciate in fretta: intesa immediata, litigi veloci e riappacificazioni ancora più veloci. Aspettatevi tanta emozione.',
    },
    'earth+fire': {
      label: 'Scintilla e terreno',
      note: 'Il fuoco comincia, la terra finisce: insieme farete molto, ma aspettatevi scontri sul ritmo.',
    },
    'air+fire': {
      label: 'Ossigeno',
      note: 'L’aria attizza il fuoco: conversazioni vivaci, grandi progetti e un legame divertente e veloce.',
    },
    'fire+water': {
      label: 'Vapore',
      note: 'La passione incontra il sentimento: attrazione intensa, ma gli animi possono traboccare. Questa coppia ha bisogno di pazienza.',
    },
    'earth+earth': {
      label: 'Fondamenta',
      note: 'Stabili e leali: costruite insieme qualcosa di solido, anche se il romanticismo può scivolare nella routine.',
    },
    'air+earth': {
      label: 'Idea e preventivo',
      note: 'Le idee incontrano la concretezza: vi bilanciate, ma uno può trovare l’altro troppo sognatore o troppo prudente.',
    },
    'earth+water': {
      label: 'Fiume e argine',
      note: 'Una delle coppie migliori dell’astrologia: l’acqua ammorbidisce la terra, la terra dà forma all’acqua e cresce una fiducia profonda.',
    },
    'air+air': {
      label: 'Vento di traverso',
      note: 'Prima migliori amici: conversazione infinita e tanta libertà, anche se i sentimenti profondi possono restare taciuti.',
    },
    'air+water': {
      label: 'Dare un nome al tempo',
      note: 'La testa incontra il cuore: l’aria vuole parlarne, l’acqua vuole sentirlo. Aspettatevi malintesi se manca la pazienza.',
    },
    'water+water': {
      label: 'Acque profonde',
      note: 'Vi leggete all’istante: un legame profondo e intuitivo, e sentirete l’uno gli stati d’animo dell’altro.',
    },
  },
};

const MODALITY_NOTES: Record<PairLocale, NoteTable> = {
  es: {
    'cardinal+cardinal': {
      label: 'Dos que inician',
      note: 'Dos líderes: mucho empuje y batallas frecuentes por quién manda.',
    },
    'cardinal+fixed': {
      label: 'Quien inicia y quien sostiene',
      note: 'Uno empieza y el otro sostiene: un equipo productivo cuando se ponen de acuerdo en el rumbo.',
    },
    'cardinal+mutable': {
      label: 'Quien inicia y quien se adapta',
      note: 'Uno guía y el otro se adapta: una relación fácil, con pocas luchas de poder.',
    },
    'fixed+fixed': {
      label: 'Dos anclas',
      note: 'Dos signos leales y tercos: un vínculo duradero, pero ninguno cede en una discusión.',
    },
    'fixed+mutable': {
      label: 'Ancla y vela',
      note: 'La estabilidad se encuentra con la flexibilidad: se equilibran muy bien.',
    },
    'mutable+mutable': {
      label: 'Dos velas',
      note: 'Tranquilos y adaptables: pocas peleas, pero las decisiones pueden quedarse en el aire.',
    },
  },
  pt: {
    'cardinal+cardinal': {
      label: 'Dois que começam',
      note: 'Dois líderes: muita garra e disputas frequentes sobre quem manda.',
    },
    'cardinal+fixed': {
      label: 'Quem começa e quem mantém',
      note: 'Um começa e o outro sustenta: uma equipe produtiva quando vocês concordam no rumo.',
    },
    'cardinal+mutable': {
      label: 'Quem começa e quem se adapta',
      note: 'Um guia e o outro se adapta: uma parceria tranquila, com poucas disputas de poder.',
    },
    'fixed+fixed': {
      label: 'Duas âncoras',
      note: 'Dois signos leais e teimosos: um vínculo duradouro, mas nenhum cede numa discussão.',
    },
    'fixed+mutable': {
      label: 'Âncora e vela',
      note: 'A estabilidade encontra a flexibilidade: vocês se equilibram muito bem.',
    },
    'mutable+mutable': {
      label: 'Duas velas',
      note: 'Tranquilos e adaptáveis: poucas brigas, mas as decisões podem ficar no ar.',
    },
  },
  fr: {
    'cardinal+cardinal': {
      label: 'Deux signes qui lancent',
      note: 'Deux meneurs : beaucoup d’élan, et des batailles régulières pour savoir qui décide.',
    },
    'cardinal+fixed': {
      label: 'Lancer et tenir',
      note: 'L’un lance, l’autre fait durer : une équipe efficace dès que vous êtes d’accord sur la direction.',
    },
    'cardinal+mutable': {
      label: 'Lancer et ajuster',
      note: 'L’un mène, l’autre s’adapte : une relation facile, avec peu de luttes de pouvoir.',
    },
    'fixed+fixed': {
      label: 'Deux ancres',
      note: 'Deux signes fidèles et têtus : un lien durable, mais aucun ne cède dans une dispute.',
    },
    'fixed+mutable': {
      label: 'Ancre et voile',
      note: 'La stabilité rencontre la souplesse : vous vous équilibrez très bien.',
    },
    'mutable+mutable': {
      label: 'Deux voiles',
      note: 'Faciles à vivre et adaptables : peu de disputes, mais les décisions peuvent traîner.',
    },
  },
  it: {
    'cardinal+cardinal': {
      label: 'Due segni che avviano',
      note: 'Due leader: tanta grinta e battaglie frequenti su chi comanda.',
    },
    'cardinal+fixed': {
      label: 'Chi avvia e chi mantiene',
      note: 'Uno comincia e l’altro sostiene: una squadra produttiva quando siete d’accordo sulla direzione.',
    },
    'cardinal+mutable': {
      label: 'Chi avvia e chi si adatta',
      note: 'Uno guida e l’altro si adatta: un rapporto facile, con poche lotte di potere.',
    },
    'fixed+fixed': {
      label: 'Due ancore',
      note: 'Due segni leali e testardi: un legame duraturo, ma nessuno dei due cede in una discussione.',
    },
    'fixed+mutable': {
      label: 'Ancora e vela',
      note: 'La stabilità incontra la flessibilità: vi bilanciate molto bene.',
    },
    'mutable+mutable': {
      label: 'Due vele',
      note: 'Tranquilli e adattabili: pochi litigi, ma le decisioni possono restare in sospeso.',
    },
  },
};

const POLARITY_NOTES: Record<PairLocale, { day: string; night: string; mixed: string }> = {
  es: {
    day: 'Los dos extrovertidos: una pareja activa, sociable y llena de energía.',
    night: 'Los dos reservados: un vínculo íntimo y profundo que necesita tiempo a solas.',
    mixed: 'Uno extrovertido y uno reservado: se equilibran, porque uno lo habla y el otro lo piensa.',
  },
  pt: {
    day: 'Os dois extrovertidos: um casal ativo, sociável e cheio de energia.',
    night: 'Os dois reservados: um vínculo íntimo e profundo que precisa de tempo a sós.',
    mixed: 'Um extrovertido e um reservado: vocês se equilibram, porque um fala e o outro pensa.',
  },
  fr: {
    day: 'Deux extravertis : un duo actif, sociable et plein d’énergie.',
    night: 'Deux réservés : un lien intime et profond, qui a besoin de moments à deux.',
    mixed: 'Un extraverti et un réservé : vous vous équilibrez, l’un en parle, l’autre y réfléchit.',
  },
  it: {
    day: 'Due estroversi: una coppia attiva, socievole e piena di energia.',
    night: 'Due riservati: un legame intimo e profondo, che ha bisogno di tempo da soli.',
    mixed: 'Un estroverso e un riservato: vi bilanciate, perché uno ne parla e l’altro ci riflette.',
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
