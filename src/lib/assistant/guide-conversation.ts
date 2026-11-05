/**
 * The words that make Guide feel like a conversation: a greeting drawn from
 * the sky right now, starter questions that fit the page, and follow-ups
 * offered under each answer. Everything here is display copy written by the
 * site. Nothing in this module reads the visitor's chart or sends anything.
 */
import type { ReleasedLocale as Locale } from '../i18n/core';
import { planetLabel } from '../i18n/astrology';
import { signForLongitude, signName } from '../signs';

/** Page groups with their own starters; anything else uses `default`. */
export type StarterTopic =
  | 'default'
  | 'birth-chart'
  | 'moon-sign'
  | 'transits'
  | 'compatibility'
  | 'learn'
  | 'horoscopes'
  | 'astrology-method';

type Starters = Record<StarterTopic, readonly [string, string, string]>;

export const GUIDE_PAGE_STARTERS: Record<Locale, Starters> = {
  en: {
    default: ['What does today’s sky mean for my sign?', 'How do I start reading a birth chart?', 'Which tool here should I try first?'],
    'birth-chart': ['What are the Sun, Moon and rising signs?', 'Why does my birth time matter?', 'What should I look at first in my chart?'],
    'moon-sign': ['What does a Moon sign describe?', 'How is the Moon sign different from the Sun sign?', 'Why can the Moon sign change on one day?'],
    transits: ['What is a retrograde?', 'What does today’s sky mean for my sign?', 'How do I read transits against my chart?'],
    compatibility: ['Which placements matter most for compatibility?', 'What is synastry?', 'Can two signs with a hard aspect still get along?'],
    learn: ['What are the twelve houses?', 'What is the difference between signs and houses?', 'What should a beginner learn first?'],
    horoscopes: ['What does today’s sky mean for my sign?', 'Should I read my Sun or my rising sign?', 'How is this horoscope written?'],
    'astrology-method': ['How are the positions calculated?', 'What is the tropical zodiac?', 'Which house system does this site use?'],
  },
  es: {
    default: ['¿Qué significa el cielo de hoy para mi signo?', '¿Cómo empiezo a leer una carta natal?', '¿Qué herramienta debería probar primero?'],
    'birth-chart': ['¿Qué son el Sol, la Luna y el ascendente?', '¿Por qué importa mi hora de nacimiento?', '¿Qué miro primero en mi carta?'],
    'moon-sign': ['¿Qué describe el signo lunar?', '¿En qué se diferencia el signo lunar del solar?', '¿Por qué la Luna puede cambiar de signo en un día?'],
    transits: ['¿Qué es un retrógrado?', '¿Qué significa el cielo de hoy para mi signo?', '¿Cómo leo los tránsitos sobre mi carta?'],
    compatibility: ['¿Qué posiciones importan más en la compatibilidad?', '¿Qué es la sinastría?', '¿Pueden llevarse bien dos signos con un aspecto tenso?'],
    learn: ['¿Qué son las doce casas?', '¿En qué se diferencian signos y casas?', '¿Qué debería aprender primero?'],
    horoscopes: ['¿Qué significa el cielo de hoy para mi signo?', '¿Leo mi signo solar o mi ascendente?', '¿Cómo se escribe este horóscopo?'],
    'astrology-method': ['¿Cómo se calculan las posiciones?', '¿Qué es el zodiaco tropical?', '¿Qué sistema de casas usa este sitio?'],
  },
  pt: {
    default: ['O que o céu de hoje significa para o meu signo?', 'Como começo a ler um mapa astral?', 'Qual ferramenta devo testar primeiro?'],
    'birth-chart': ['O que são o Sol, a Lua e o ascendente?', 'Por que a hora de nascimento importa?', 'O que devo olhar primeiro no meu mapa?'],
    'moon-sign': ['O que o signo lunar descreve?', 'Qual a diferença entre signo lunar e solar?', 'Por que a Lua pode mudar de signo em um dia?'],
    transits: ['O que é um retrógrado?', 'O que o céu de hoje significa para o meu signo?', 'Como leio os trânsitos no meu mapa?'],
    compatibility: ['Quais posições mais importam na compatibilidade?', 'O que é sinastria?', 'Dois signos com um aspecto tenso podem se dar bem?'],
    learn: ['O que são as doze casas?', 'Qual a diferença entre signos e casas?', 'O que devo aprender primeiro?'],
    horoscopes: ['O que o céu de hoje significa para o meu signo?', 'Leio meu signo solar ou meu ascendente?', 'Como este horóscopo é escrito?'],
    'astrology-method': ['Como as posições são calculadas?', 'O que é o zodíaco tropical?', 'Qual sistema de casas este site usa?'],
  },
  fr: {
    default: ['Que dit le ciel du jour pour mon signe ?', 'Comment commencer à lire un thème natal ?', 'Quel outil essayer en premier ?'],
    'birth-chart': ['Que sont le Soleil, la Lune et l’ascendant ?', 'Pourquoi l’heure de naissance compte-t-elle ?', 'Que regarder en premier dans mon thème ?'],
    'moon-sign': ['Que décrit le signe lunaire ?', 'Quelle différence entre signe lunaire et signe solaire ?', 'Pourquoi la Lune peut-elle changer de signe en un jour ?'],
    transits: ['Qu’est-ce qu’une rétrogradation ?', 'Que dit le ciel du jour pour mon signe ?', 'Comment lire les transits sur mon thème ?'],
    compatibility: ['Quelles positions comptent le plus en compatibilité ?', 'Qu’est-ce que la synastrie ?', 'Deux signes en aspect tendu peuvent-ils s’entendre ?'],
    learn: ['Que sont les douze maisons ?', 'Quelle différence entre signes et maisons ?', 'Par quoi commencer quand on débute ?'],
    horoscopes: ['Que dit le ciel du jour pour mon signe ?', 'Lire mon signe solaire ou mon ascendant ?', 'Comment cet horoscope est-il écrit ?'],
    'astrology-method': ['Comment les positions sont-elles calculées ?', 'Qu’est-ce que le zodiaque tropical ?', 'Quel système de maisons ce site utilise-t-il ?'],
  },
  it: {
    default: ['Cosa significa il cielo di oggi per il mio segno?', 'Come inizio a leggere un tema natale?', 'Quale strumento dovrei provare per primo?'],
    'birth-chart': ['Cosa sono il Sole, la Luna e l’ascendente?', 'Perché conta l’ora di nascita?', 'Cosa guardo per primo nel mio tema?'],
    'moon-sign': ['Cosa descrive il segno lunare?', 'Che differenza c’è tra segno lunare e solare?', 'Perché la Luna può cambiare segno in un giorno?'],
    transits: ['Cos’è un retrogrado?', 'Cosa significa il cielo di oggi per il mio segno?', 'Come leggo i transiti sul mio tema?'],
    compatibility: ['Quali posizioni contano di più nella compatibilità?', 'Cos’è la sinastria?', 'Due segni in aspetto teso possono andare d’accordo?'],
    learn: ['Cosa sono le dodici case?', 'Che differenza c’è tra segni e case?', 'Cosa dovrei imparare per primo?'],
    horoscopes: ['Cosa significa il cielo di oggi per il mio segno?', 'Leggo il segno solare o l’ascendente?', 'Come viene scritto questo oroscopo?'],
    'astrology-method': ['Come vengono calcolate le posizioni?', 'Cos’è lo zodiaco tropicale?', 'Quale sistema di case usa questo sito?'],
  },
};

/** The page groups Guide already knows by pathname, mapped onto starter sets. */
export function starterTopic(pageId: string | null | undefined): StarterTopic {
  switch (pageId) {
    case 'birth-chart':
    case 'moon-sign':
    case 'transits':
    case 'compatibility':
    case 'learn':
    case 'horoscopes':
    case 'astrology-method':
      return pageId;
    default:
      return 'default';
  }
}

export function pageStarters(locale: Locale, pageId: string | null | undefined): readonly string[] {
  const set = GUIDE_PAGE_STARTERS[locale] ?? GUIDE_PAGE_STARTERS.en;
  return set[starterTopic(pageId)];
}

const FOLLOW_UPS: Record<Locale, { general: readonly string[]; retrograde: string }> = {
  en: { general: ['Tell me more', 'What does this mean for my sign?', 'Can you give an example?'], retrograde: 'When does it end?' },
  es: { general: ['Cuéntame más', '¿Qué significa para mi signo?', '¿Me das un ejemplo?'], retrograde: '¿Cuándo termina?' },
  pt: { general: ['Conte mais', 'O que isso significa para o meu signo?', 'Pode dar um exemplo?'], retrograde: 'Quando termina?' },
  fr: { general: ['Dis-m’en plus', 'Qu’est-ce que ça veut dire pour mon signe ?', 'Tu peux donner un exemple ?'], retrograde: 'Quand est-ce que ça se termine ?' },
  it: { general: ['Dimmi di più', 'Cosa significa per il mio segno?', 'Puoi farmi un esempio?'], retrograde: 'Quando finisce?' },
};

const RETROGRADE_WORD = /retrogr|rétrogr/iu;

/** Three short follow-ups for the latest answer. */
export function followUpsFor(locale: Locale, answer: string): string[] {
  const copy = FOLLOW_UPS[locale] ?? FOLLOW_UPS.en;
  const [more, sign, example] = copy.general;
  return RETROGRADE_WORD.test(answer) ? [more, copy.retrograde, sign] : [more, sign, example];
}

const RETROGRADE_CAPABLE = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

export interface GreetingBody {
  body: string;
  lon: number;
  retrograde: boolean;
}

function joinNames(locale: Locale, names: string[]): string {
  if (names.length < 2) return names.join('');
  const and = { en: 'and', es: 'y', pt: 'e', fr: 'et', it: 'e' }[locale] ?? 'and';
  return `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;
}

/**
 * One or two sentences about the sky right now, e.g. "The Moon is in Taurus
 * today and the Sun is in Scorpio. Retrograde now: Mercury." Returns null when
 * the positions are missing, so the caller can fall back to the plain intro.
 */
export function skyGreeting(locale: Locale, bodies: readonly GreetingBody[]): string | null {
  const sun = bodies.find((entry) => entry.body === 'Sun');
  const moon = bodies.find((entry) => entry.body === 'Moon');
  if (!sun || !moon) return null;
  const sunSign = signName(signForLongitude(sun.lon), locale);
  const moonSign = signName(signForLongitude(moon.lon), locale);
  const retro = RETROGRADE_CAPABLE
    .filter((name) => bodies.some((entry) => entry.body === name && entry.retrograde))
    .map((name) => planetLabel(locale, name));
  const list = joinNames(locale, retro);
  switch (locale) {
    case 'es':
      return `Hoy la Luna está en ${moonSign} y el Sol en ${sunSign}.${retro.length ? ` Retrógrados ahora: ${list}.` : ''} ¿Qué te gustaría saber?`;
    case 'pt':
      return `Hoje a Lua está em ${moonSign} e o Sol em ${sunSign}.${retro.length ? ` Retrógrados agora: ${list}.` : ''} O que você gostaria de saber?`;
    case 'fr':
      return `Aujourd’hui, la Lune est en ${moonSign} et le Soleil en ${sunSign}.${retro.length ? ` Rétrogrades en ce moment : ${list}.` : ''} Que veux-tu savoir ?`;
    case 'it':
      return `Oggi la Luna è in ${moonSign} e il Sole in ${sunSign}.${retro.length ? ` Retrogradi ora: ${list}.` : ''} Cosa vorresti sapere?`;
    default:
      return `The Moon is in ${moonSign} today and the Sun is in ${sunSign}.${retro.length ? ` Retrograde now: ${list}.` : ''} What would you like to know?`;
  }
}

/** Where to send someone while Guide can't answer, in their own language. */
export function waitLinks(locale: Locale): { daily: string; chart: string; privacy: string } {
  switch (locale) {
    case 'es': return { daily: '/es/horoscopes/', chart: '/es/birth-chart/', privacy: '/es/privacy/' };
    case 'pt': return { daily: '/pt/horoscopes/', chart: '/pt/birth-chart/', privacy: '/pt/privacy/' };
    case 'fr': return { daily: '/fr/transits/', chart: '/fr/birth-chart/', privacy: '/fr/privacy/' };
    case 'it': return { daily: '/it/transits/', chart: '/it/birth-chart/', privacy: '/it/privacy/' };
    default: return { daily: '/horoscopes/', chart: '/birth-chart/', privacy: '/privacy/' };
  }
}

const MY_SIGN_PHRASE: Record<Locale, { pattern: RegExp; replace: (name: string) => string }> = {
  en: { pattern: /for my sign/u, replace: (name) => `for ${name}` },
  es: { pattern: /para mi signo/u, replace: (name) => `para ${name}` },
  pt: { pattern: /para o meu signo/u, replace: (name) => `para ${name}` },
  fr: { pattern: /pour mon signe/u, replace: (name) => `pour le signe ${name}` },
  it: { pattern: /per il mio segno/u, replace: (name) => `per il segno ${name}` },
};

/** True when a suggested question asks about "my sign". */
export function asksAboutMySign(locale: Locale, prompt: string): boolean {
  return (MY_SIGN_PHRASE[locale] ?? MY_SIGN_PHRASE.en).pattern.test(prompt);
}

/** "What does this mean for my sign?" becomes "What does this mean for Leo?". */
export function withMySign(locale: Locale, prompt: string, sign: string | null): string {
  if (!sign) return prompt;
  const phrase = MY_SIGN_PHRASE[locale] ?? MY_SIGN_PHRASE.en;
  return prompt.replace(phrase.pattern, phrase.replace(signName(sign, locale)));
}

export const MY_SIGN_COPY: Record<Locale, {
  pick: string;
  yours: (name: string) => string;
  change: string;
  helpful: string;
  up: string;
  down: string;
  thanks: string;
}> = {
  en: { pick: 'Which sign? Guide will remember it on this device.', yours: (name) => `Your sign: ${name}`, change: 'Change', helpful: 'Was this helpful?', up: 'Helpful', down: 'Not helpful', thanks: 'Thanks for telling us.' },
  es: { pick: '¿Qué signo? Guide lo recordará en este dispositivo.', yours: (name) => `Tu signo: ${name}`, change: 'Cambiar', helpful: '¿Te ayudó?', up: 'Útil', down: 'No es útil', thanks: 'Gracias por decírnoslo.' },
  pt: { pick: 'Qual signo? O Guide vai lembrar neste dispositivo.', yours: (name) => `Seu signo: ${name}`, change: 'Mudar', helpful: 'Isso ajudou?', up: 'Útil', down: 'Não ajudou', thanks: 'Obrigado por nos dizer.' },
  fr: { pick: 'Quel signe ? Guide s’en souviendra sur cet appareil.', yours: (name) => `Ton signe : ${name}`, change: 'Changer', helpful: 'Cette réponse t’a aidé ?', up: 'Utile', down: 'Pas utile', thanks: 'Merci de nous l’avoir dit.' },
  it: { pick: 'Quale segno? Guide lo ricorderà su questo dispositivo.', yours: (name) => `Il tuo segno: ${name}`, change: 'Cambia', helpful: 'Ti è stato utile?', up: 'Utile', down: 'Non utile', thanks: 'Grazie per avercelo detto.' },
};
