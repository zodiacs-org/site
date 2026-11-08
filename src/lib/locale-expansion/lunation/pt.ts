/**
 * Luas cheias e novas em português do Brasil, escritas a partir dos fatos do
 * catálogo. Os horários do Brasil e de Portugal saem do próprio instante,
 * calculados pelo Intl com o fuso de cada lugar.
 */
import { signBySlug, signName } from '../../signs';
import { degreeMinutes } from '../../today-sky';
import { monthName } from '../horoscope/format';
import { theme } from '../horoscope/pt';
import type { LunationCopy, LunationFacts } from './types';

const L = 'pt' as const;
const sign = (slug: string) => signName(signBySlug(slug), L);
const kindName = (facts: LunationFacts) => (facts.kind === 'full' ? 'Lua cheia' : 'Lua nova');

/** "24 de novembro de 2026", e "1º de dezembro de 2026". */
function dateOf(day: number, month: number, year?: string): string {
  const d = day === 1 ? '1º' : String(day);
  return `${d} de ${monthName(L, month)}${year ? ` de ${year}` : ''}`;
}
const when = (f: LunationFacts) => dateOf(Number(f.at.slice(8, 10)), Number(f.at.slice(5, 7)), f.at.slice(0, 4));
const hhmm = (f: LunationFacts) => f.at.slice(11, 16);
/** "às 14:53 UTC", "à 01:15 UTC". */
const clock = (f: LunationFacts) => `${f.at.slice(11, 13) === '01' ? 'à' : 'às'} ${hhmm(f)} UTC`;
const degree = (f: LunationFacts) => `${degreeMinutes(f.degree)} de ${sign(f.sign)}`;

/** O relógio local de um fuso, com o dia quando ele muda em relação ao UTC. */
function localTime(f: LunationFacts, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', day: 'numeric', month: 'numeric',
  }).formatToParts(new Date(f.at)).map((part) => [part.type, part.value]));
  const time = `${parts.hour}:${parts.minute}`;
  const sameDay = Number(parts.day) === Number(f.at.slice(8, 10));
  return sameDay ? time : `${time} do dia ${dateOf(Number(parts.day), Number(parts.month))}`;
}

/** O que cada signo põe em jogo quando a Lua o ilumina ou o escurece. */
const SIGN_TOPIC: Record<string, string> = {
  aries: 'a iniciativa, a coragem e a pressa',
  taurus: 'a segurança, o corpo e o que se constrói devagar',
  gemini: 'as palavras, a curiosidade e os laços mais próximos',
  cancer: 'o lar, o cuidado e a memória da família',
  leo: 'a expressão pessoal, o orgulho e a alegria',
  virgo: 'a ordem, o trabalho bem feito e os detalhes',
  libra: 'os acordos, o senso de justiça e a convivência',
  scorpio: 'a confiança, o que é dividido e o que se transforma',
  sagittarius: 'o sentido das coisas, as viagens e as crenças',
  capricorn: 'a responsabilidade, as metas e o tempo',
  aquarius: 'a amizade, os grupos e as ideias novas',
  pisces: 'a sensibilidade, o descanso e o que fica sem ser dito',
};

export const pt: LunationCopy = {
  locale: L,
  title: (f) => `${kindName(f)} em ${sign(f.sign)}: ${when(f)}`,
  h1: (f) => `${kindName(f)} em ${sign(f.sign)}`,
  description: (f) => `A ${kindName(f)} de ${when(f)} fica exata ${clock(f)}, a ${degree(f)}. O que ela significa e como toca cada signo.`,
  kindLabel: (kind) => (kind === 'full' ? 'Lua cheia' : 'Lua nova'),
  crumbsRoot: 'Calendário de luas cheias',
  lead: (f) => (f.kind === 'full'
    ? `A Lua cheia de ${when(f)} fica exata ${clock(f)}, com a Lua a ${degree(f)} e o Sol exatamente do outro lado do céu. É o ponto mais iluminado do ciclo: o que começou na Lua nova anterior agora aparece com clareza.`
    : `A Lua nova de ${when(f)} fica exata ${clock(f)}, com o Sol e a Lua juntos a ${degree(f)}. É o começo de um ciclo de cerca de quatro semanas, o momento clássico para definir uma intenção pequena e concreta.`),
  eclipseNote: (f) => (f.eclipse
    ? f.eclipse.type === 'solar'
      ? 'Esta Lua nova coincide com um eclipse solar, por isso costuma ser lida como um começo mais marcado do que o normal.'
      : 'Esta Lua cheia coincide com um eclipse lunar, por isso o fechamento que ela traz costuma ser lido como mais forte do que o normal.'
    : ''),
  factLabels: { exact: 'Momento exato', position: 'Posição', phase: 'Fase' },
  meaning: (f) => (f.kind === 'full'
    ? [
      `Em ${sign(f.sign)}, a Lua cheia põe em foco ${SIGN_TOPIC[f.sign]}. É um bom momento para ver resultados, terminar o que ficou pela metade e dizer em voz alta o que você já sabe.`,
      'Não é preciso tomar grandes decisões no mesmo dia: a Lua cheia esclarece, e a semana seguinte serve para ajustar com calma.',
    ]
    : [
      `Em ${sign(f.sign)}, a Lua nova abre um ciclo para ${SIGN_TOPIC[f.sign]}. Funciona melhor com um primeiro passo pequeno do que com uma lista longa de metas.`,
      'Escreva uma única intenção e volte a ela na Lua cheia seguinte, umas duas semanas depois.',
    ]),
  signNotesHeading: 'Como ela toca cada signo',
  signNotesIntro: 'Contada a partir do seu signo solar (casas solares de signo inteiro), esta Lua cai numa área diferente para cada signo.',
  signNote: (sunSign, house) => `${sign(sunSign)}: casa ${house}, ${theme(house)}.`,
  previous: 'Anterior',
  next: 'Próxima',
  calendarLink: 'Calendário de luas cheias',
  moonPhaseLink: 'Fase da Lua hoje',
  horoscopesLink: 'Horóscopos',
  confidence: (value) => `Confiança da leitura ${value}%`,
  confidenceNote: 'O número diz o quanto são específicos os dados da leitura (aqui, só o signo solar), e não a chance de algo acontecer.',
  method: 'O momento exato e a posição são calculados pelo motor astronômico do site e conferidos com as efemérides da NASA. Os horários estão em UTC.',
  faqHeading: 'Perguntas frequentes',
  faq: (f) => [
    {
      q: `A que horas é a ${kindName(f)} de ${when(f)}?`,
      a: `Ela fica exata ${clock(f)}. No horário de Brasília, que fica três horas atrás do UTC e não tem horário de verão desde 2019, o relógio marca ${localTime(f, 'America/Sao_Paulo')}. Em Portugal continental, que segue o UTC no inverno e soma uma hora no verão, marca ${localTime(f, 'Europe/Lisbon')}.`,
    },
    {
      q: `Em que signo está a ${kindName(f)}?`,
      a: `Em ${sign(f.sign)}, a ${degreeMinutes(f.degree)}.`,
    },
    {
      q: 'Preciso do meu mapa astral para ler?',
      a: 'Não. As notas por signo usam só o signo solar. Com o seu mapa astral, você vê em que casa ela cai exatamente para você.',
    },
  ],
};
