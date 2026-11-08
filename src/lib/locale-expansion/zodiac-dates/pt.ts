/** Datas dos signos em português do Brasil. */
import type { ZodiacDatesCopy } from './types';

export const pt: ZodiacDatesCopy = {
  locale: 'pt',
  title: (current, next) => `Datas dos signos do zodíaco em ${current} e ${next}`,
  h1: 'Datas dos signos do zodíaco',
  description: (current, next) => `Os doze signos com as suas datas, elemento, modalidade e regente, e o minuto exato em UTC em que o Sol entra em cada signo em ${current} e ${next}.`,
  lede: (current, next) => `As datas que costumam aparecer para cada signo são aproximadas: o Sol muda de signo num momento diferente a cada ano. Aqui está o minuto exato, em UTC, de cada entrada em ${current} e ${next}.`,
  crumbs: 'Aprender',
  tableHeading: 'Os doze signos numa tabela',
  tableCaption: (current, next) => `Datas, correspondências e entrada exata do Sol em cada signo, ${current} e ${next}`,
  columns: {
    sign: 'Signo', dates: 'Datas habituais', longitude: 'Longitude', element: 'Elemento', modality: 'Modalidade',
    ruler: 'Regente', seasons: 'Estação', ingress: (year) => `Entrada do Sol em ${year}`,
  },
  north: 'Norte',
  south: 'Sul',
  season: { Spring: 'primavera', Summer: 'verão', Autumn: 'outono', Winter: 'inverno' },
  explainerHeading: 'O que as datas exatas querem dizer',
  explainer: [
    'O zodíaco tropical começa em Áries, no grau 0 de longitude eclíptica, e divide o círculo em doze signos iguais de 30 graus. Esses limites não mudam; o que muda é a data e a hora em que o Sol passa por eles, porque o ano não tem um número exato de dias.',
    'Por isso, duas pessoas nascidas no mesmo dia do calendário, em anos diferentes, podem ter signos solares diferentes se nasceram perto da mudança. O que muita gente chama de "cúspide" não é um signo misturado: o Sol está sempre num signo ou no outro.',
    'As estações aparecem para os dois hemisférios. No Brasil, que fica no hemisfério sul, a entrada do Sol em Áries marca o começo do outono, e a entrada em Libra, o da primavera; em Portugal, é o contrário.',
    'Se você nasceu perto de uma dessas datas, confira o seu signo com a data, a hora e o local de nascimento. A hora local depende do fuso horário daquele dia, e o cálculo do mapa astral leva isso em conta.',
  ],
  calculatorLink: 'Faça seu mapa astral grátis',
  methodLink: 'Como as datas são calculadas',
  csvLink: 'Baixar a tabela (CSV, em inglês)',
  faqHeading: 'Perguntas frequentes',
  faq: (current) => [
    {
      q: 'Por que as datas dos signos mudam todo ano?',
      a: 'Porque o ano do calendário e o ano solar não batem ao minuto. O Sol passa pelo mesmo ponto do céu todo ano, mas numa hora diferente, e às vezes num dia diferente.',
    },
    {
      q: `Quando começa Áries em ${current}?`,
      a: 'A tabela dá o minuto exato em UTC. No horário de Brasília, tire três horas; em Portugal continental, o horário é o mesmo do UTC no inverno e uma hora a mais no verão.',
    },
    {
      q: 'E se eu nasci numa cúspide?',
      a: 'O seu Sol está num signo só. Calcule o seu mapa astral com a hora e o local de nascimento para saber qual.',
    },
  ],
};
