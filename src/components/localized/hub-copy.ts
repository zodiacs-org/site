/** Every visible string of the localized horoscope hub (LocalizedHoroscopeHub.astro). fr and it live in src/lib/locale-expansion/daily-copy/. */
import dailyData from '../../data/daily.json';
import type { Daily } from '../../lib/daily';
import { dailyReadingForLocale } from '../../lib/i18n/daily-reading';
import { formatDate } from '../../lib/i18n/dates';
import { englishOnlyCue } from '../../lib/i18n/english-only';
import { localizePath, t } from '../../lib/i18n';
import { SIGNS, signName } from '../../lib/signs';
import { signDateRange } from '../../lib/sign-display';

export type HubLocale = 'es' | 'pt' | 'fr' | 'it' | 'ru';


export interface HubCopy {
  title: (date: string) => string;
  description: (date: string) => string;
  imageAlt: string;
  h1: string;
  dateline: (date: string) => string;
  lede: string;
  stamp: (date: string) => string;
  jumpLabel: string;
  pickerAria: string;
  read: string;
  notePersonal: string;
  noteChart: string;
  noteSky: string;
  noteSkyLink: string;
  noteLonger: string;
  noteEnglish: string;
  askLead: string;
  askLabel: string;
  prompts: string[];
  methodSummary: string;
  methodBefore: (date: string) => string;
  methodLink: string;
}

export const HUB_COPY: Record<'es' | 'pt', HubCopy> = {
  es: {
    title: (date) => `Horóscopos de hoy, ${date} | Zodiacs.org`,
    description: (date) => `Horóscopos de hoy, ${date}: una nota clara para cada uno de los doce signos, calculada a partir de las posiciones reales del cielo.`,
    imageAlt: 'Horóscopos de hoy para los doce signos, Zodiacs.org',
    h1: 'Horóscopos de hoy',
    dateline: (date) => `Edición diaria · ${date}`,
    lede: 'Busca tu signo y encontrarás la nota más concreta del cielo de hoy. Lee primero tu signo solar y, si lo conoces, también tu ascendente.',
    stamp: (date) => `Se actualiza cada día · ${date}`,
    jumpLabel: 'Ve a tu signo',
    pickerAria: 'Elige el signo de tu horóscopo',
    read: 'Leer hoy →',
    notePersonal: '¿Quieres una lectura más personal? ',
    noteChart: 'Calcula tu carta natal gratis',
    noteSky: ' El cielo completo, planeta por planeta, está en ',
    noteSkyLink: 'la página del cielo de hoy',
    noteLonger: '. Las lecturas de mañana, de la semana y del mes están en ',
    noteEnglish: 'la edición en inglés',
    askLead: '¿No sabes por dónde empezar?',
    askLabel: 'Preguntar a Guide',
    prompts: [
      '¿Leo mi signo solar o mi ascendente?',
      '¿Qué significa el cielo de hoy para todos?',
      '¿Cómo se calculan estos horóscopos?',
    ],
    methodSummary: 'Detrás de estas lecturas',
    methodBefore: (date) => `Esta es la edición UTC del ${date}; las posiciones usan el cielo registrado a las 12:00 UTC. Los horóscopos por signo solar dan la visión general. Consulta `,
    methodLink: 'cómo calculamos',
  },
  pt: {
    title: (date) => `Horóscopos de hoje, ${date} | Zodiacs.org`,
    description: (date) => `Horóscopos de hoje, ${date}: uma nota clara para cada um dos doze signos, calculada a partir das posições reais do céu.`,
    imageAlt: 'Horóscopos de hoje para os doze signos, Zodiacs.org',
    h1: 'Horóscopos de hoje',
    dateline: (date) => `Edição diária · ${date}`,
    lede: 'Encontre o seu signo e veja a nota mais concreta sobre o céu de hoje. Leia primeiro o seu signo solar e, se souber, o seu ascendente também.',
    stamp: (date) => `Atualizado todo dia · ${date}`,
    jumpLabel: 'Vá para o seu signo',
    pickerAria: 'Escolha o signo do seu horóscopo',
    read: 'Ler hoje →',
    notePersonal: 'Quer uma visão mais pessoal? ',
    noteChart: 'Calcule o seu mapa astral grátis',
    noteSky: ' O céu completo, planeta por planeta, está na ',
    noteSkyLink: 'página do céu de hoje',
    noteLonger: '. As leituras de amanhã, da semana e do mês estão na ',
    noteEnglish: 'edição em inglês',
    askLead: 'Não sabe por onde começar?',
    askLabel: 'Perguntar ao Guide',
    prompts: [
      'Devo ler o meu signo solar ou o meu ascendente?',
      'O que o céu de hoje significa para todos?',
      'Como estes horóscopos são calculados?',
    ],
    methodSummary: 'Por trás destas leituras',
    methodBefore: (date) => `Esta é a edição UTC de ${date}; as posições usam o céu registrado às 12h UTC. Os horóscopos por signo solar dão a visão geral. Veja `,
    methodLink: 'como calculamos',
  },
};
