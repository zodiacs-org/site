/**
 * Every visible string of the Spanish and Portuguese daily horoscope pages
 * (LocalizedHoroscope.astro). Kept in a module so the art share cards
 * (src/lib/og-art-cards-copy.ts) take their words from the same place.
 */
export type LocalizedHoroscopeLocale = 'es' | 'pt';

export interface Copy {
  title: (name: string, date: string) => string;
  description: (name: string, date: string, notes: string) => string;
  notes: (count: number) => string;
  imageAlt: (name: string) => string;
  crumbs: string;
  crumbsAria: string;
  h1: (name: string) => string;
  credit: (name: string) => string;
  periodsAria: (name: string) => string;
  todayWord: string;
  week: string;
  month: string;
  periodsNote: string;
  railLabel: string;
  metaLabel: string;
  noteCount: (count: number) => string;
  readingTitle: (name: string) => string;
  foot: (name: string) => string;
  methodLink: string;
  share: (name: string) => string;
  shareLabel: string;
  askLead: string;
  askLabel: string;
  prompts: (name: string) => string[];
  railAria: string;
  skyTitle: string;
  skyBasis: string;
  skySub: string;
  skyRow: (planet: string, sign: string) => string;
  skyHouse: (house: number, name: string) => string;
  moonLit: (phase: string, percent: number) => string;
  retrograde: string;
  alsoSun: (position: string) => string;
  fullSky: string;
  wheelAria: (date: string, name: string) => string;
  wheelCaption: (date: string, name: string, focus: string, count: number) => string;
  ctaKicker: string;
  ctaTitle: string;
  ctaLede: (name: string, moonSign: string, house: number) => string;
  ticks: string[];
  reassure: [string, string];
  saved: string;
  savedLink: string;
  moreTitle: (name: string) => string;
  moreLede: string;
  moreLonger: string;
  moreLongerText: (name: string) => string;
  moreRising: (name: string) => string;
  moreRisingNote: string;
  moreRisingText: (name: string) => string;
  moreAll: string;
  moreAllText: string;
  guideKicker: string;
  guideTitle: (name: string) => string;
  guideCopy: (name: string) => string;
  guideLink: (name: string) => string;
  signsTitle: string;
  signsLede: string;
  allHoroscopes: string;
  signsAria: string;
  readingNow: string;
  faqTitle: (name: string) => string;
  faqMore: string;
  faq: (name: string) => { q: string; a: string }[];
}

export const LOCALIZED_HOROSCOPE_COPY: Record<LocalizedHoroscopeLocale, Copy> = {
  es: {
    title: (name, date) => `Horóscopo de ${name} hoy, ${date} | Zodiacs.org`,
    description: (name, date, notes) => `Horóscopo de ${name} hoy, ${date}: ${notes} desde sus casas solares, con las posiciones reales del cielo y sus comprobantes.`,
    notes: (count) => (count === 1 ? '1 nota leída' : `${count} notas leídas`),
    imageAlt: (name) => `${name}, horóscopo de hoy, Zodiacs.org`,
    crumbs: 'Horóscopos',
    crumbsAria: 'Ruta de navegación',
    h1: (name) => `${name} hoy`,
    credit: (name) => `${name}, del arte de signos de Zodiacs`,
    periodsAria: (name) => `Periodos del horóscopo de ${name}`,
    todayWord: 'Hoy',
    week: 'Esta semana',
    month: 'Este mes',
    periodsNote: 'Semana y mes, por ahora en inglés',
    railLabel: 'Cambiar de signo',
    metaLabel: 'Horóscopo diario',
    noteCount: (count) => (count === 1 ? '1 nota' : `${count} notas`),
    readingTitle: (name) => `El cielo de hoy visto desde ${name}`,
    foot: (name) => `Escrito para ${name} como signo solar. Las posiciones del cielo están calculadas; su significado es una interpretación astrológica. Úsalo para reflexionar, no como una predicción de hechos.`,
    methodLink: 'Cómo calculamos',
    share: (name) => `Horóscopo de ${name} de hoy`,
    shareLabel: 'Enviar esta lectura',
    askLead: '¿Preguntas sobre esta lectura?',
    askLabel: 'Preguntar a Guide',
    prompts: (name) => [
      `¿Qué significa el cielo de hoy para ${name}?`,
      '¿De qué planetas sale esta lectura?',
      '¿Cómo leo esto en mi carta natal?',
    ],
    railAria: 'Sobre esta lectura',
    skyTitle: 'El cielo detrás de esta lectura',
    skyBasis: '12:00 UTC',
    skySub: 'Cada nota sale de una de estas posiciones.',
    skyRow: (planet, sign) => `${planet} en ${sign}`,
    skyHouse: (house, name) => `Casa ${house} contada desde ${name}.`,
    moonLit: (phase, percent) => `${phase}, ${percent}% iluminada.`,
    retrograde: 'Retrógrado.',
    alsoSun: (position) => `También en este cielo: Sol ${position}`,
    fullSky: 'Todo el cielo de hoy',
    wheelAria: (date, name) => `El cielo a las 12:00 UTC del ${date}, contado desde ${name} como primera casa`,
    wheelCaption: (date, name, focus, count) => `El cielo a las 12:00 UTC del ${date}, en la rueda de ${name}.${count > 0 ? ` En color: ${focus}, ${count === 1 ? 'el planeta de esta lectura' : 'los planetas de esta lectura'}.` : ''}`,
    ctaKicker: 'Más allá de tu signo solar',
    ctaTitle: 'Mira dónde cae este cielo en tu propia carta.',
    ctaLede: (name, moonSign, house) => `Esta lectura cuenta la rueda desde ${name}, así que la Luna en ${moonSign} cae en la casa ${house}. Tu carta natal cuenta desde tu propio ascendente, así que la misma Luna puede tocar otra parte de tu vida.`,
    ticks: [
      'Tu Sol, tu Luna y tu ascendente, y lo que significa cada uno',
      'El cielo de cada día leído sobre tu propia carta',
      'Se calcula en tu navegador, sin crear una cuenta',
    ],
    reassure: ['Fecha, hora y lugar de nacimiento.', 'Unos veinte segundos.'],
    saved: '¿Ya guardaste una carta? ',
    savedLink: 'Compárala con el cielo de hoy',
    moreTitle: (name) => `Más sobre ${name}`,
    moreLede: 'El mismo cielo en periodos más largos, y el signo leído desde otro punto de la carta.',
    moreLonger: 'Mañana, semana y mes',
    moreLongerText: (name) => `Las lecturas más largas de ${name}, también de amor, trabajo y 2027.`,
    moreRising: (name) => `Ascendente ${name}`,
    moreRisingNote: 'Perfil del ascendente',
    moreRisingText: (name) => `${name} como signo ascendente, el que estaba en el horizonte este al nacer.`,
    moreAll: 'Todos los signos',
    moreAllText: 'Los doce horóscopos del cielo de hoy en una página.',
    guideKicker: 'La guía del signo',
    guideTitle: (name) => `${name}, a fondo`,
    guideCopy: (name) => `Personalidad, amor, trabajo y dinero, compatibilidad, y lo que significa ${name} en tu carta natal.`,
    guideLink: (name) => `Guía completa de ${name}`,
    signsTitle: 'Lee otro signo',
    signsLede: 'Las notas del cielo de hoy para los doce signos, desde las mismas posiciones.',
    allHoroscopes: 'Todos los horóscopos',
    signsAria: 'Otros signos',
    readingNow: 'Leyendo ahora',
    faqTitle: (name) => `Horóscopo diario de ${name}: preguntas`,
    faqMore: 'Más sobre el método: ',
    faq: (name) => [
      {
        q: `¿Qué cubre este horóscopo diario de ${name}?`,
        a: `Hasta cuatro notas a partir del cielo de hoy: en qué casa solar de ${name} caen la Luna y los planetas personales, y cualquier evento exacto de la fecha. Cada nota lleva su comprobante.`,
      },
      {
        q: `¿Esta lectura es solo para quien tiene ${name} como signo solar?`,
        a: `Empieza por ${name} como signo solar. Si conoces tu ascendente, léelo también; tu carta natal completa da la imagen más personal.`,
      },
      {
        q: `¿Cómo puede usar ${name} esta lectura?`,
        a: 'Toma la parte que te sirva, conviértela en una pregunta o en un paso concreto, y deja que tu propio criterio decida.',
      },
    ],
  },
  pt: {
    title: (name, date) => `Horóscopo de ${name} hoje, ${date} | Zodiacs.org`,
    description: (name, date, notes) => `Horóscopo de ${name} hoje, ${date}: ${notes} a partir das casas solares do signo, com as posições reais do céu e seus registros.`,
    notes: (count) => (count === 1 ? '1 nota lida' : `${count} notas lidas`),
    imageAlt: (name) => `${name}, horóscopo de hoje, Zodiacs.org`,
    crumbs: 'Horóscopos',
    crumbsAria: 'Trilha de navegação',
    h1: (name) => `${name} hoje`,
    credit: (name) => `${name}, da arte dos signos do Zodiacs`,
    periodsAria: (name) => `Períodos do horóscopo de ${name}`,
    todayWord: 'Hoje',
    week: 'Esta semana',
    month: 'Este mês',
    periodsNote: 'Semana e mês, por enquanto em inglês',
    railLabel: 'Trocar de signo',
    metaLabel: 'Horóscopo diário',
    noteCount: (count) => (count === 1 ? '1 nota' : `${count} notas`),
    readingTitle: (name) => `O céu de hoje visto de ${name}`,
    foot: (name) => `Escrito para ${name} como signo solar. As posições do céu são calculadas; o significado delas é uma interpretação astrológica. Use para refletir, não como uma previsão de acontecimentos.`,
    methodLink: 'Como calculamos',
    share: (name) => `Horóscopo de ${name} de hoje`,
    shareLabel: 'Enviar esta leitura',
    askLead: 'Dúvidas sobre esta leitura?',
    askLabel: 'Perguntar ao Guide',
    prompts: (name) => [
      `O que o céu de hoje significa para ${name}?`,
      'De quais planetas vem esta leitura?',
      'Como leio isto no meu mapa astral?',
    ],
    railAria: 'Sobre esta leitura',
    skyTitle: 'O céu por trás desta leitura',
    skyBasis: '12h UTC',
    skySub: 'Cada nota vem de uma destas posições.',
    skyRow: (planet, sign) => `${planet} em ${sign}`,
    skyHouse: (house, name) => `Casa ${house} contada a partir de ${name}.`,
    moonLit: (phase, percent) => `${phase}, ${percent}% iluminada.`,
    retrograde: 'Retrógrado.',
    alsoSun: (position) => `Também neste céu: Sol ${position}`,
    fullSky: 'Todo o céu de hoje',
    wheelAria: (date, name) => `O céu às 12h UTC de ${date}, contado a partir de ${name} como primeira casa`,
    wheelCaption: (date, name, focus, count) => `O céu às 12h UTC de ${date}, na roda de ${name}.${count > 0 ? ` Em cor: ${focus}, ${count === 1 ? 'o planeta desta leitura' : 'os planetas desta leitura'}.` : ''}`,
    ctaKicker: 'Além do seu signo solar',
    ctaTitle: 'Veja onde este céu cai no seu próprio mapa.',
    ctaLede: (name, moonSign, house) => `Esta leitura conta a roda a partir de ${name}, então a Lua em ${moonSign} cai na casa ${house}. O seu mapa astral conta a partir do seu próprio ascendente, então a mesma Lua pode tocar outra parte da sua vida.`,
    ticks: [
      'Seu Sol, sua Lua e seu ascendente, e o que cada um significa',
      'O céu de cada dia lido sobre o seu próprio mapa',
      'Calculado no seu navegador, sem criar conta',
    ],
    reassure: ['Data, hora e local de nascimento.', 'Cerca de vinte segundos.'],
    saved: 'Já salvou um mapa? ',
    savedLink: 'Compare com o céu de hoje',
    moreTitle: (name) => `Mais sobre ${name}`,
    moreLede: 'O mesmo céu em períodos mais longos, e o signo lido a partir de outro ponto do mapa.',
    moreLonger: 'Amanhã, semana e mês',
    moreLongerText: (name) => `As leituras mais longas de ${name}, também de amor, trabalho e 2027.`,
    moreRising: (name) => `Ascendente em ${name}`,
    moreRisingNote: 'Perfil do ascendente',
    moreRisingText: (name) => `${name} como signo ascendente, o que estava no horizonte leste no nascimento.`,
    moreAll: 'Todos os signos',
    moreAllText: 'Os doze horóscopos do céu de hoje numa página.',
    guideKicker: 'O guia do signo',
    guideTitle: (name) => `${name}, a fundo`,
    guideCopy: (name) => `Personalidade, amor, trabalho e dinheiro, compatibilidade e o que ${name} significa no seu mapa astral.`,
    guideLink: (name) => `Guia completo de ${name}`,
    signsTitle: 'Leia outro signo',
    signsLede: 'As notas do céu de hoje para os doze signos, a partir das mesmas posições.',
    allHoroscopes: 'Todos os horóscopos',
    signsAria: 'Outros signos',
    readingNow: 'Lendo agora',
    faqTitle: (name) => `Horóscopo diário de ${name}: perguntas`,
    faqMore: 'Mais sobre o método: ',
    faq: (name) => [
      {
        q: `O que este horóscopo diário de ${name} cobre?`,
        a: `Até quatro notas a partir do céu de hoje: em que casa solar de ${name} caem a Lua e os planetas pessoais, e qualquer evento exato da data. Cada nota traz o seu registro.`,
      },
      {
        q: `Esta leitura é só para quem tem ${name} como signo solar?`,
        a: `Comece por ${name} como signo solar. Se você conhece o seu ascendente, leia também; o seu mapa astral completo dá o retrato mais pessoal.`,
      },
      {
        q: `Como ${name} pode usar esta leitura?`,
        a: 'Pegue a parte que for útil, transforme em uma pergunta ou em um passo concreto e deixe o seu próprio julgamento decidir.',
      },
    ],
  },
};
