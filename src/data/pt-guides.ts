import type { Sign } from '../lib/signs';

export interface PortugueseGuide {
  sign: string;
  title: string;
  description: string;
  intro: string[];
  sections: { heading: string; body: string[]; risingProfile?: boolean }[];
  faq: { q: string; a: string }[];
}

const edgeCopy = 'Nasceu na cúspide? Calcule seu mapa astral.';

export const PT_GUIDES: Record<string, PortugueseGuide> = {
  aries: {
    sign: 'aries',
    title: 'Áries: datas, personalidade e compatibilidade',
    description: `Áries: datas, personalidade, amor, compatibilidade e o queÁries significa no seu mapa. ${edgeCopy}`,
    intro: [
      'Áries abre a roda do zodíaco. É o impulso de começar, a faísca que surge antes do plano perfeito e a coragem de agir mesmo quando ainda faltam respostas.',
      'Em um mapa astral, Áries mostra onde você age com mais franqueza. Nem sempre é paciência; muitas vezes é honestidade, desejo e uma necessidade muito clara de sentir que a vida está avançando.',
    ],
    sections: [
      {
        heading: 'Personalidade de Áries',
        body: [
          'Áries costuma ser direto, rápido e transparente. Quando algo importa, dá para perceber. Essa energia prefere uma resposta clara a uma conversa que nunca termina e costuma aprender mais fazendo do que esperando permissão.',
          'Seu lado luminoso é a iniciativa: anima, acende e abre caminho. Seu desafio é sustentar o que começou quando o entusiasmo inicial diminui. A maturidade de Áries não está em apagar o fogo, mas em escolher melhor onde usá-lo.',
        ],
      },
      {
        heading: 'Áries no amor',
        body: [
          'Nos relacionamentos, Áries busca desejo vivo, honestidade e alguém com um mundo próprio. Sente atração por relações com brincadeira, desafio e movimento, sem precisar adivinhar o que a outra pessoa sente.',
          'Costuma fluir com Leão, Sagitário e Gêmeos. Com Câncer, Capricórnio e Libra, pode haver mais atrito, mas também muita química se os dois aprenderem a respeitar o ritmo um do outro.',
        ],
      },
      {
        heading: 'Áries no seu mapa',
        body: [
          'Todos temos Áries em alguma área do mapa. Ali, você quer decidir, experimentar e ter autonomia. O Sol em Áries transforma isso em identidade; a Lua em Áries, em emoção imediata; e o ascendente em Áries, em presença e primeira impressão.',
        ],
      },
    ],
    faq: [
      { q: 'Quais são as datas de Áries?', a: `Aproximadamente de 21 de março a 19 de abril. ${edgeCopy}` },
      { q: 'Áries é um signo de fogo?', a: 'Sim. Áries é fogo cardinal: energia que inicia, acende e impulsiona algo a começar.' },
      { q: 'Com quem Áries é compatível?', a: 'Costuma fluir com Leão, Sagitário e Gêmeos. Para uma leitura útil do casal, compare os dois mapas completos.' },
    ],
  },
  taurus: {
    sign: 'taurus',
    title: 'Touro: datas, personalidade e compatibilidade',
    description: `Touro: datas, personalidade, amor, compatibilidade e o queTouro significa no seu mapa. ${edgeCopy}`,
    intro: [
      'Touro chega quando a primavera deixa de prometer e começa a sustentar. É o signo do que se cuida com tempo: corpo, prazer, estabilidade, recursos e amor demonstrado por atitudes.',
      'Em um mapa astral, Touro mostra onde você precisa de segurança concreta. Não apenas conforto, mas também ritmo próprio, bons limites e paciência para construir algo duradouro.',
    ],
    sections: [
      {
        heading: 'Personalidade de Touro',
        body: [
          'Touro costuma ser calmo, sensorial e constante. Decide devagar, mas, depois de decidir, raramente muda por pressão externa. Sua confiança se conquista com presença contínua, não com grandes promessas.',
          'Sua força é a permanência. Seu desafio é perceber quando a lealdade virou inércia. Às vezes, deixar ir também é uma forma de cuidar do que tem valor.',
        ],
      },
      {
        heading: 'Touro no amor',
        body: [
          'Touro ama por meio de atitudes: tempo, comida, toque, memória e cuidado prático. Precisa de estabilidade e coerência; sinais contraditórios costumam esgotar sua paciência rapidamente.',
          'Costuma fluir com Virgem, Capricórnio e Câncer. Com Leão, Aquário e Escorpião, pode haver uma atração forte e teimosa, desde que os dois aprendam a ceder sem se sentir derrotados.',
        ],
      },
      {
        heading: 'Touro no seu mapa',
        body: [
          'Touro indica onde você busca calma, valor e uma vida que pareça habitável. Em Vênus, fala de gosto e desejo; na Lua, de segurança emocional; no ascendente, de uma presença tranquila e firme.',
        ],
      },
    ],
    faq: [
      { q: 'Quais são as datas de Touro?', a: `Aproximadamente de 20 de abril a 20 de maio. ${edgeCopy}` },
      { q: 'Touro é um signo de terra?', a: 'Sim. Touro é terra fixa: estabilidade, corpo, recursos e resistência.' },
      { q: 'Qual planeta rege Touro?', a: 'Vênus, associada ao amor, ao prazer, à beleza e ao valor.' },
    ],
  },
  gemini: {
    sign: 'gemini',
    title: 'Gêmeos: datas, personalidade e compatibilidade',
    description: `Gêmeos: datas, personalidade, amor, compatibilidade e o queGêmeos significa no seu mapa. ${edgeCopy}`,
    intro: [
      'Gêmeos é ar em movimento: perguntas, conversas, conexões e a rapidez de uma mente que precisa de variedade para se sentir viva.',
      'Em um mapa astral, Gêmeos mostra onde você aprende testando, falando, lendo, mudando de perspectiva e reunindo informações antes de escolher uma única resposta.',
    ],
    sections: [
      {
        heading: 'Personalidade de Gêmeos',
        body: [
          'Gêmeos costuma ser curioso, ágil e sociável. Percebe padrões, muda de assunto com facilidade e muitas vezes pensa melhor em voz alta. Seu dom é abrir janelas.',
          'O desafio é não confundir movimento com direção. Quando Gêmeos escolhe uma pergunta importante e permanece com ela, sua inteligência deixa de se dispersar e vira ofício.',
        ],
      },
      {
        heading: 'Gêmeos no amor',
        body: [
          'Gêmeos precisa de conversa, estímulo mental e espaço para respirar. Uma relação que não permite curiosidade costuma parecer pequena.',
          'Flui com Libra, Aquário e Áries. Com Virgem, Peixes e Sagitário, pode haver tensão entre detalhe, sonho e liberdade; quando bem conduzida, essa tensão ensina muito.',
        ],
      },
      {
        heading: 'Gêmeos no seu mapa',
        body: [
          'Gêmeos marca a área em que vale a pena perguntar mais, falar com clareza e se permitir mudar de ideia. Em Mercúrio, ganha força especial: linguagem, aprendizagem e ritmo mental.',
        ],
      },
    ],
    faq: [
      { q: 'Quais são as datas de Gêmeos?', a: `Aproximadamente de 21 de maio a 20 de junho. ${edgeCopy}` },
      { q: 'Gêmeos é um signo de ar?', a: 'Sim. Gêmeos é ar mutável: ideias, intercâmbio e adaptação.' },
      { q: 'Qual planeta rege Gêmeos?', a: 'Mercúrio, o planeta associado à comunicação, à linguagem e ao movimento das informações.' },
    ],
  },
  cancer: {
    sign: 'cancer',
    title: 'Câncer: datas, personalidade e compatibilidade',
    description: `Câncer: datas, personalidade, amor, compatibilidade e o queCâncer significa no seu mapa. ${edgeCopy}`,
    intro: [
      'Câncer começa no solstício de junho: muita luz, muita memória e um retorno ao íntimo. É o signo do cuidado, do pertencimento e da sensibilidade que protege.',
      'Em um mapa astral, Câncer mostra onde você sente antes de explicar. Também mostra onde precisa de lar, confiança e uma forma de segurança que não seja apenas material.',
    ],
    sections: [
      {
        heading: 'Personalidade de Câncer',
        body: [
          'Câncer costuma ser intuitivo, leal e mais forte do que parece. Lê os ambientes rapidamente e guarda detalhes que outras pessoas esquecem. Seu cuidado pode ser muito concreto: perguntar, alimentar e acompanhar.',
          'O desafio é pedir diretamente em vez de testar se alguém vai adivinhar. A sensibilidade de Câncer é um talento, mas precisa de palavras claras para não virar uma carapaça.',
        ],
      },
      {
        heading: 'Câncer no amor',
        body: [
          'Câncer busca ternura confiável. Ama criando abrigo: rotinas, memória compartilhada e gestos que dizem “penso em você”. Precisa de reciprocidade emocional, não apenas intensidade.',
          'Flui com Escorpião, Peixes e Touro. Com Áries, Libra e Capricórnio, pode haver choque de ritmo, mas também relações muito fortes quando existe cuidado e maturidade.',
        ],
      },
      {
        heading: 'Câncer no seu mapa',
        body: [
          'Câncer indica onde você protege, recorda e precisa pertencer. Na Lua, se expressa com força especial; no ascendente, como uma presença sensível e observadora.',
        ],
      },
    ],
    faq: [
      { q: 'Quais são as datas de Câncer?', a: `Aproximadamente de 21 de junho a 22 de julho. ${edgeCopy}` },
      { q: 'Câncer é um signo de água?', a: 'Sim. Câncer é água cardinal: emoção que dá início ao cuidado.' },
      { q: 'Qual astro rege Câncer?', a: 'A Lua, associada à memória, ao instinto, ao corpo emocional e às necessidades de segurança.' },
    ],
  },
  leo: {
    sign: 'leo',
    title: 'Leão: datas, personalidade e compatibilidade',
    description: `Leão: datas, personalidade, amor, compatibilidade e o queLeão significa no seu mapa. ${edgeCopy}`,
    intro: [
      'Leão é o coração do verão: presença, calor, criatividade e o desejo de ser visto pelo que realmente é.',
      'Em um mapa astral, Leão mostra onde você precisa se expressar com orgulho saudável. Não se trata apenas de atenção, mas de autoria, diversão e generosidade visível.',
    ],
    sections: [
      {
        heading: 'Personalidade de Leão',
        body: [
          'Leão costuma ser caloroso, expressivo e leal. Tem uma forma natural de ocupar espaço, animar as pessoas e fazer uma cena ganhar vida.',
          'Seu desafio é não depender de aplausos para lembrar do próprio valor. Quando Leão cria a partir do seu centro, e não da necessidade de aprovação, sua luz se torna mais generosa.',
        ],
      },
      {
        heading: 'Leão no amor',
        body: [
          'Leão ama com entusiasmo e precisa se sentir escolhido. A indiferença dói mais do que uma discussão honesta; prefere uma relação viva a uma relação educada, porém apagada.',
          'Flui com Áries, Sagitário e Libra. Com Touro, Escorpião e Aquário, pode haver orgulho fixo dos dois lados, mas também uma atração muito intensa.',
        ],
      },
      {
        heading: 'Leão no seu mapa',
        body: [
          'Leão marca onde você quer criar, brincar, liderar ou mostrar algo que é seu. No Sol, vira identidade central; em Vênus, amor expressivo; no ascendente, presença radiante.',
        ],
      },
    ],
    faq: [
      { q: 'Quais são as datas de Leão?', a: `Aproximadamente de 23 de julho a 22 de agosto. ${edgeCopy}` },
      { q: 'Leão é um signo de fogo?', a: 'Sim. Leão é fogo fixo: calor constante, criatividade e lealdade.' },
      { q: 'Qual astro rege Leão?', a: 'O Sol, associado à identidade, à vitalidade e à expressão consciente.' },
    ],
  },
  virgo: {
    sign: 'virgo',
    title: 'Virgem: datas, personalidade e compatibilidade',
    description: `Virgem: datas, personalidade, amor, compatibilidade e o queVirgem significa no seu mapa. ${edgeCopy}`,
    intro: [
      'Virgem chega com a colheita: observar de perto, separar o que é útil do que sobra e fazer as coisas funcionarem melhor.',
      'Em um mapa astral, Virgem mostra onde você melhora a vida com atenção. Sua magia não é a perfeição, mas a capacidade de perceber o que precisa de ajuste.',
    ],
    sections: [
      {
        heading: 'Personalidade de Virgem',
        body: [
          'Virgem costuma ser observador, prático e exigente consigo mesmo. Vê detalhes que outras pessoas deixam passar e muitas vezes expressa amor oferecendo ajuda concreta.',
          'Seu desafio é aceitar que algo pode ser bom o bastante. O mesmo olhar que melhora projetos pode se voltar com dureza para si se não aprender a descansar.',
        ],
      },
      {
        heading: 'Virgem no amor',
        body: [
          'Virgem ama prestando atenção: lembra, organiza, cuida e corrige porque quer que algo dure. Precisa de confiança para demonstrar ternura sem sentir que perdeu o controle.',
          'Flui com Touro, Capricórnio e Câncer. Com Gêmeos, Sagitário e Peixes, pode haver tensão entre análise, liberdade e sensibilidade.',
        ],
      },
      {
        heading: 'Virgem no seu mapa',
        body: [
          'Virgem mostra onde você observa, aprimora e coloca ordem no que parecia confuso. Em Mercúrio, refina o pensamento; na Lua, busca segurança por meio de rotinas úteis.',
        ],
      },
    ],
    faq: [
      { q: 'Quais são as datas de Virgem?', a: `Aproximadamente de 23 de agosto a 22 de setembro. ${edgeCopy}` },
      { q: 'Virgem é um signo de terra?', a: 'Sim. Virgem é terra mutável: praticidade, análise e adaptação.' },
      { q: 'Qual planeta rege Virgem?', a: 'Mercúrio, associado ao pensamento, à linguagem e à capacidade de organizar informações.' },
    ],
  },
  libra: {
    sign: 'libra',
    title: 'Libra: datas, personalidade e compatibilidade',
    description: `Libra: datas, personalidade, amor, compatibilidade e o queLibra significa no seu mapa. ${edgeCopy}`,
    intro: [
      'Libra começa no equinócio: o instante em que luz e escuridão encontram equilíbrio. É o signo da relação, da proporção, da beleza e das escolhas feitas com outra pessoa em mente.',
      'Em um mapa astral, Libra mostra onde você busca reciprocidade e justiça. Também mostra onde pode demorar a decidir porque percebe muitos lados de uma mesma questão.',
    ],
    sections: [
      {
        heading: 'Personalidade de Libra',
        body: [
          'Libra costuma ser diplomático, sociável e sensível ao ambiente. Percebe o tom, a distância e o que faria uma conversa funcionar melhor.',
          'Seu desafio é não chamar de paz aquilo que, na verdade, é silêncio por medo do conflito. Escolher também é uma forma de equilíbrio.',
        ],
      },
      {
        heading: 'Libra no amor',
        body: [
          'Libra se orienta pelos relacionamentos. Precisa de troca, conversa e a sensação de que os dois estão escolhendo o vínculo com o mesmo cuidado.',
          'Flui com Gêmeos, Aquário e Leão. Com Câncer, Capricórnio e Áries, pode haver tensão entre necessidade, estrutura e desejo direto.',
        ],
      },
      {
        heading: 'Libra no seu mapa',
        body: [
          'Libra indica onde você negocia, busca beleza e aprende por meio do encontro. Em Vênus, fala de atração e gosto; no ascendente, de uma presença elegante e receptiva.',
        ],
      },
    ],
    faq: [
      { q: 'Quais são as datas de Libra?', a: `Aproximadamente de 23 de setembro a 22 de outubro. ${edgeCopy}` },
      { q: 'Libra é um signo de ar?', a: 'Sim. Libra é ar cardinal: relação, ideias e iniciativa social.' },
      { q: 'Qual planeta rege Libra?', a: 'Vênus, associada ao amor, à beleza, ao valor e à forma de criar vínculos.' },
    ],
  },
  scorpio: {
    sign: 'scorpio',
    title: 'Escorpião: datas, personalidade e compatibilidade',
    description: `Escorpião: datas, personalidade, amor, compatibilidade e o queEscorpião significa no seu mapa. ${edgeCopy}`,
    intro: [
      'Escorpião é água profunda: intimidade, desejo, poder, perda e tudo o que se transforma quando deixamos de olhar apenas a superfície.',
      'Em um mapa astral, Escorpião mostra onde você não aceita meias verdades. Ali, a confiança custa caro, mas, quando existe, o compromisso pode ser enorme.',
    ],
    sections: [
      {
        heading: 'Personalidade de Escorpião',
        body: [
          'Escorpião costuma ser intenso, reservado e muito perceptivo. Lê motivações, percebe contradições e prefere uma verdade difícil a uma versão decorativa.',
          'Seu desafio é não transformar proteção em controle. A intimidade só acontece quando o outro não precisa passar por provas impossíveis.',
        ],
      },
      {
        heading: 'Escorpião no amor',
        body: [
          'Escorpião busca profundidade, lealdade e desejo sem disfarces. Não precisa que tudo seja dramático, mas precisa sentir que a relação é real.',
          'Flui com Câncer, Peixes e Virgem. Com Leão, Aquário e Touro, pode haver orgulho, distância ou teimosia, além de um magnetismo forte.',
        ],
      },
      {
        heading: 'Escorpião no seu mapa',
        body: [
          'Escorpião marca onde você investiga, compartilha poder e aprende a deixar ir. Na Lua, traz emoções privadas e intensas; no ascendente, uma presença magnética e observadora.',
        ],
      },
    ],
    faq: [
      { q: 'Quais são as datas de Escorpião?', a: `Aproximadamente de 23 de outubro a 21 de novembro. ${edgeCopy}` },
      { q: 'Escorpião é um signo de água?', a: 'Sim. Escorpião é água fixa: profundidade emocional, lealdade e transformação.' },
      { q: 'Qual planeta rege Escorpião?', a: 'A tradição usa Marte; a astrologia moderna também considera Plutão.' },
    ],
  },
  sagittarius: {
    sign: 'sagittarius',
    title: 'Sagitário: datas, personalidade e compatibilidade',
    description: `Sagitário: datas, personalidade, amor, compatibilidade e o queSagitário significa no seu mapa. ${edgeCopy}`,
    intro: [
      'Sagitário é fogo em movimento: horizonte, viagem, verdade, humor e a necessidade de encontrar um sentido maior do que a rotina.',
      'Em um mapa astral, Sagitário mostra onde você cresce ao explorar. Ali, a vida pede perspectiva, experiência e liberdade para formular perguntas maiores.',
    ],
    sections: [
      {
        heading: 'Personalidade de Sagitário',
        body: [
          'Sagitário costuma ser franco, expansivo e inquieto. Tem facilidade para enxergar o panorama geral e recuperar a esperança quando os detalhes pesam.',
          'Seu desafio é lembrar que a verdade também precisa de tato. A liberdade fica mais sólida quando inclui responsabilidade pelo que foi prometido.',
        ],
      },
      {
        heading: 'Sagitário no amor',
        body: [
          'Sagitário precisa de espaço, humor e uma pessoa com horizontes próprios. O vínculo funciona melhor quando compromisso não significa confinamento.',
          'Flui com Áries, Leão e Aquário. Com Virgem, Peixes e Gêmeos, pode haver tensão entre método, sensibilidade e dispersão.',
        ],
      },
      {
        heading: 'Sagitário no seu mapa',
        body: [
          'Sagitário mostra onde você busca viagem, estudo, fé e uma visão mais ampla da vida. Em Júpiter, amplia a confiança; no ascendente, traz uma presença aberta e espontânea.',
        ],
      },
    ],
    faq: [
      { q: 'Quais são as datas de Sagitário?', a: `Aproximadamente de 22 de novembro a 21 de dezembro. ${edgeCopy}` },
      { q: 'Sagitário é um signo de fogo?', a: 'Sim. Sagitário é fogo mutável: entusiasmo, exploração e adaptação.' },
      { q: 'Qual planeta rege Sagitário?', a: 'Júpiter, associado ao crescimento, à visão, ao estudo e ao sentido.' },
    ],
  },
  capricorn: {
    sign: 'capricorn',
    title: 'Capricórnio: datas, personalidade e compatibilidade',
    description: `Capricórnio: datas, personalidade, amor, compatibilidade e o queCapricórnio significa no seu mapa. ${edgeCopy}`,
    intro: [
      'Capricórnio começa no solstício: a noite mais longa e o primeiro movimento da luz de volta. É o signo do tempo, da responsabilidade e do que se constrói degrau por degrau.',
      'Em um mapa astral, Capricórnio mostra onde você leva a vida a sério. Ali, quer competência, estrutura e resultados que resistam ao tempo.',
    ],
    sections: [
      {
        heading: 'Personalidade de Capricórnio',
        body: [
          'Capricórnio costuma ser estratégico, resistente e reservado no início. Mede riscos, entende hierarquias e sabe que muitas coisas importantes levam tempo.',
          'Seu desafio é não confundir descanso com fraqueza nem achar que todo afeto precisa ser merecido. Uma vida bem construída também precisa ser vivida.',
        ],
      },
      {
        heading: 'Capricórnio no amor',
        body: [
          'Capricórnio ama com compromisso, respeito e atitudes que sobrevivem ao entusiasmo inicial. Pode se abrir devagar, mas leva a lealdade a sério.',
          'Flui com Touro, Virgem e Escorpião. Com Áries, Libra e Câncer, pode haver tensão entre velocidade, reciprocidade e cuidado emocional.',
        ],
      },
      {
        heading: 'Capricórnio no seu mapa',
        body: [
          'Capricórnio indica onde você assume responsabilidade, cria estrutura e aprende o poder da paciência. Em Saturno, fala de maturidade; no ascendente, de uma presença competente e reservada.',
        ],
      },
    ],
    faq: [
      { q: 'Quais são as datas de Capricórnio?', a: `Aproximadamente de 22 de dezembro a 19 de janeiro. ${edgeCopy}` },
      { q: 'Capricórnio é um signo de terra?', a: 'Sim. Capricórnio é terra cardinal: estrutura, ambição e iniciativa prática.' },
      { q: 'Qual planeta rege Capricórnio?', a: 'Saturno, associado ao tempo, à responsabilidade, aos limites e à maturidade.' },
    ],
  },
  aquarius: {
    sign: 'aquarius',
    title: 'Aquário: datas, personalidade e compatibilidade',
    description: `Aquário: datas, personalidade, amor, compatibilidade e o queAquário significa no seu mapa. ${edgeCopy}`,
    intro: [
      'Aquário é ar fixo: ideias que se sustentam, sistemas vistos de fora e a pergunta incômoda sobre se uma regra ainda faz sentido.',
      'Em um mapa astral, Aquário mostra onde você precisa pensar por conta própria. Ali, pertencer só funciona quando existe espaço para ser diferente.',
    ],
    sections: [
      {
        heading: 'Personalidade de Aquário',
        body: [
          'Aquário costuma ser independente, observador e difícil de encaixar em expectativas sociais. Vê padrões coletivos e futuros possíveis.',
          'Seu desafio é não usar a distância como abrigo quando a vida pede presença emocional. Ser diferente não exige estar sozinho.',
        ],
      },
      {
        heading: 'Aquário no amor',
        body: [
          'Aquário precisa de amizade, liberdade mental e aceitação do que há de incomum em cada pessoa. Posse e controle costumam afastá-lo.',
          'Flui com Gêmeos, Libra e Sagitário. Com Touro, Escorpião e Leão, pode haver tensão entre segurança, intensidade e orgulho pessoal.',
        ],
      },
      {
        heading: 'Aquário no seu mapa',
        body: [
          'Aquário mostra onde você inova, questiona normas e busca uma rede mais honesta. Em Urano, enfatiza mudança; no ascendente, uma presença singular e imprevisível.',
        ],
      },
    ],
    faq: [
      { q: 'Quais são as datas de Aquário?', a: `Aproximadamente de 20 de janeiro a 18 de fevereiro. ${edgeCopy}` },
      { q: 'Aquário é um signo de ar?', a: 'Sim. Aquário é ar fixo: ideias, comunidade e convicções duradouras.' },
      { q: 'Qual planeta rege Aquário?', a: 'A tradição usa Saturno; a astrologia moderna também considera Urano.' },
    ],
  },
  pisces: {
    sign: 'pisces',
    title: 'Peixes: datas, personalidade e compatibilidade',
    description: `Peixes: datas, personalidade, amor, compatibilidade e o quePeixes significa no seu mapa. ${edgeCopy}`,
    intro: [
      'Peixes encerra a roda do zodíaco: imaginação, compaixão, sonho e a percepção de que nem tudo que é real pode ser medido.',
      'Em um mapa astral, Peixes mostra onde seus limites ficam mais porosos. Ali, você capta atmosferas, símbolos e emoções que talvez ainda não tenham palavras.',
    ],
    sections: [
      {
        heading: 'Personalidade de Peixes',
        body: [
          'Peixes costuma ser empático, criativo e permeável. Capta atmosferas, imagina possibilidades e muitas vezes entende antes que alguém explique.',
          'Seu desafio são os limites. Sentir muito não significa carregar tudo; ajudar não exige desaparecer. Peixes floresce quando sua compaixão ganha forma.',
        ],
      },
      {
        heading: 'Peixes no amor',
        body: [
          'Peixes ama com imaginação e entrega. Busca ternura, mistério e uma relação em que o mundo interior dos dois tenha espaço.',
          'Flui com Câncer, Escorpião e Capricórnio. Com Gêmeos, Sagitário e Virgem, pode haver tensão entre sonho, verdade e ordem.',
        ],
      },
      {
        heading: 'Peixes no seu mapa',
        body: [
          'Peixes indica onde você precisa de inspiração e de descanso do excesso de dureza. Na Lua, é emoção porosa; em Vênus, amor idealista; no ascendente, presença suave e mutável.',
        ],
      },
    ],
    faq: [
      { q: 'Quais são as datas de Peixes?', a: `Aproximadamente de 19 de fevereiro a 20 de março. ${edgeCopy}` },
      { q: 'Peixes é um signo de água?', a: 'Sim. Peixes é água mutável: sensibilidade, imaginação e adaptação emocional.' },
      { q: 'Qual planeta rege Peixes?', a: 'A tradição usa Júpiter; a astrologia moderna também considera Netuno.' },
    ],
  },
};

interface GuideDepth {
  name: string;
  dateRange: string;
  elementMode: string;
  ruling: string;
  temperament: string;
  gift: string;
  challenge: string;
  loveNeeds: string;
  friendship: string;
  work: string;
  purpose: string;
  sun: string;
  moon: string;
  rising: string;
  venus: string;
  mars: string;
  house: string;
  growth: string;
  easeful: string;
  charged: string;
  bodyCare: string;
  privateTruth: string;
}

const DEPTH: Record<string, GuideDepth> = {
  aries: {
    name: 'Áries',
    dateRange: 'de 21 de março a 19 de abril',
    elementMode: 'fogo cardinal',
    ruling: 'Marte',
    temperament: 'rápido, direto e difícil de convencer com desculpas',
    gift: 'acende o que outras pessoas ainda estão pensando e transforma uma possibilidade em movimento',
    challenge: 'confundir urgência com verdade ou abandonar algo quando deixa de parecer novo',
    loveNeeds: 'desejo claro, brincadeira, honestidade e alguém que não apague seu impulso',
    friendship: 'amizades vivas, planos espontâneos e gente capaz de dizer sim sem convocar um comitê',
    work: 'iniciar projetos, resolver emergências, competir de forma direta e abrir terreno',
    purpose: 'aprender a começar sem se consumir, liderar sem atropelar e escolher batalhas que mereçam seu fogo',
    sun: 'identidade que se descobre na ação; a pessoa entende quem é quando tem algo para começar',
    moon: 'emoção imediata: sente rápido, se irrita rápido e também pode recuperar o ânimo depressa',
    rising: 'presença direta, jovem e física; entra em um ambiente como se já tivesse decidido avançar',
    venus: 'amor que toma a iniciativa, diz o que quer e prefere uma faísca honesta a um romance morno',
    mars: 'desejo e conflito em estado puro: ação visível, competição aberta e pouca paciência para rodeios',
    house: 'a área em que você precisa de autonomia, decisão e permissão para tentar antes de ter garantias',
    growth: 'diminuir a velocidade o bastante para escutar, concluir o que importa e não tratar cada demora como derrota',
    easeful: 'Leão, Sagitário e Gêmeos costumam alimentar seu entusiasmo sem pedir que se torne outra pessoa',
    charged: 'Câncer, Capricórnio e Libra podem mostrar o valor da pausa, do cuidado e da negociação',
    bodyCare: 'movimento, suor, descanso depois do esforço e uma saída saudável para a raiva',
    privateTruth: 'Áries nem sempre quer vencer; muitas vezes, só quer se sentir vivo e livre para tentar',
  },
  taurus: {
    name: 'Touro',
    dateRange: 'de 20 de abril a 20 de maio',
    elementMode: 'terra fixa',
    ruling: 'Vênus',
    temperament: 'calmo, sensorial e mais resistente do que parece à primeira vista',
    gift: 'torna a vida habitável: cuida de corpos, ritmos, recursos e vínculos com constância',
    challenge: 'permanecer tempo demais onde já não existe crescimento porque o conhecido parece mais seguro',
    loveNeeds: 'lealdade, contato, coerência e gestos que possam ser sentidos no dia a dia',
    friendship: 'amizades confiáveis e planos cheios de comida, música, memória e presença sem pressa',
    work: 'construir valor, sustentar processos, administrar recursos e aprimorar o mundo material com bom gosto',
    purpose: 'aprender que estabilidade não é imobilidade, mas uma base de onde o desejo pode respirar',
    sun: 'identidade que precisa de tempo, corpo e uma relação clara com o que tem valor',
    moon: 'emoção que se regula com segurança, contato, rotina e sinais repetidos de confiança',
    rising: 'presença tranquila, firme e atraente; o mundo vê alguém difícil de mover por pressão',
    venus: 'amor sensual e paciente, com memória aguçada para o prazer e o cuidado prático',
    mars: 'desejo constante: demora a começar, mas, depois de decidir, revela uma força enorme',
    house: 'a área em que você busca calma, segurança interior, prazer simples e decisões sustentáveis',
    growth: 'soltar antes de endurecer, distinguir lealdade de hábito e permitir que a mudança também seja cuidado',
    easeful: 'Virgem, Capricórnio e Câncer costumam entender sua necessidade de confiança e ritmo',
    charged: 'Leão, Aquário e Escorpião podem trazer orgulho, intensidade e uma atração que exige flexibilidade',
    bodyCare: 'sono regular, boa comida, toque, natureza e menos pressão para responder imediatamente',
    privateTruth: 'Touro não é teimoso por esporte; protege aquilo que levou tempo para amar',
  },
  gemini: {
    name: 'Gêmeos',
    dateRange: 'de 21 de maio a 20 de junho',
    elementMode: 'ar mutável',
    ruling: 'Mercúrio',
    temperament: 'curioso, comunicativo, móvel e capaz de encontrar três perspectivas onde outras pessoas veem uma',
    gift: 'abre janelas: conecta pessoas, ideias, dados e possibilidades com uma rapidez contagiante',
    challenge: 'se mover tanto que uma pergunta importante não tenha tempo de se transformar em sabedoria',
    loveNeeds: 'conversa, humor, liberdade mental e uma relação que não castigue a curiosidade',
    friendship: 'amizades inteligentes, mensagens fora de hora, planos mutáveis e cumplicidade para pensar em voz alta',
    work: 'comunicar, traduzir, ensinar, vender, pesquisar, escrever e detectar padrões em movimento',
    purpose: 'transformar informação em linguagem útil sem perder o prazer de perguntar',
    sun: 'identidade construída pelo aprendizado; a pessoa se reconhece quando pode nomear, comparar e mudar de ideia',
    moon: 'emoção que precisa falar, escrever ou se mover para compreender o que sente',
    rising: 'presença leve, expressiva e alerta; parece saber de tudo antes que seja dito',
    venus: 'amor que começa na mente e cresce com brincadeira, mensagens, referências compartilhadas e riso',
    mars: 'desejo inquieto: debate, experimenta, pergunta e pode se cansar se não houver estímulo',
    house: 'a área em que você precisa de variedade, linguagem, troca e permissão para experimentar',
    growth: 'permanecer em uma conversa difícil, cuidar da atenção e não usar a esperteza para evitar a vulnerabilidade',
    easeful: 'Libra, Aquário e Áries costumam oferecer ar, faísca e uma sensação de movimento compartilhado',
    charged: 'Virgem, Peixes e Sagitário podem criar tensão entre o detalhe, o sonho e a verdade, mas também ampliar sua perspectiva',
    bodyCare: 'menos telas antes de dormir, caminhadas, respiração e espaços onde a mente não precise produzir',
    privateTruth: 'Gêmeos não muda porque não sente; muda porque percebe coisas demais para fingir uma única resposta',
  },
  cancer: {
    name: 'Câncer',
    dateRange: 'de 21 de junho a 22 de julho',
    elementMode: 'água cardinal',
    ruling: 'a Lua',
    temperament: 'intuitivo, protetor e mais forte quando pode cuidar sem se esconder',
    gift: 'cria abrigo: recorda, acompanha, nutre e percebe necessidades antes que elas ganhem palavras',
    challenge: 'esperar que os outros adivinhem o que dói ou usar a carapaça quando bastaria pedir',
    loveNeeds: 'ternura confiável, memória compartilhada, reciprocidade emocional e um lar simbólico para onde voltar',
    friendship: 'amizades leais, conversas íntimas e gente que entende o peso dos pequenos gestos',
    work: 'cuidar, preservar, criar lares, sustentar equipes, narrar memórias e proteger o que é vulnerável',
    purpose: 'aprender que sensibilidade e clareza podem coexistir; cuidar não exige desaparecer',
    sun: 'identidade organizada em torno de pertencimento, memória e proteção',
    moon: 'emoção muito forte, pois a Lua está em casa: precisa de segurança, ritmo e permissão para sentir',
    rising: 'presença observadora e sensível; no início pode parecer reservada e, depois, profundamente próxima',
    venus: 'amor acolhedor, atento e nostálgico, com desejo de criar um mundo particular a dois',
    mars: 'ação protetora: luta por quem ama, embora às vezes se aproxime de lado antes de encarar de frente',
    house: 'a área em que você precisa de lar, intimidade, cuidado e uma relação honesta com suas raízes',
    growth: 'nomear necessidades antes que virem ressentimento, aceitar ajuda e não transformar toda distância em abandono',
    easeful: 'Escorpião, Peixes e Touro costumam compreender sua profundidade emocional e sua necessidade de confiança',
    charged: 'Áries, Libra e Capricórnio podem ensinar independência, negociação e estrutura',
    bodyCare: 'comida simples, descanso, água, rituais domésticos e limites claros para o drama alheio',
    privateTruth: 'Câncer não é frágil; é permeável e, por isso, precisa escolher muito bem quem deixa entrar',
  },
  leo: {
    name: 'Leão',
    dateRange: 'de 23 de julho a 22 de agosto',
    elementMode: 'fogo fixo',
    ruling: 'o Sol',
    temperament: 'caloroso, leal, teatral quando necessário e orgulhoso do que ama',
    gift: 'dá vida a uma cena: anima, celebra, cria e lembra às outras pessoas que elas também podem brilhar',
    challenge: 'depender demais do olhar externo ou confundir orgulho com proteção',
    loveNeeds: 'ser escolhido com alegria, brincar, receber atenção verdadeira e dar afeto sem se sentir usado',
    friendship: 'amizades generosas, celebrações, projetos criativos e lealdades visíveis',
    work: 'liderar, atuar, ensinar, criar experiências, dirigir equipes e sustentar uma visão com coração',
    purpose: 'criar a partir do próprio centro, não da necessidade de aprovação',
    sun: 'identidade solar em seu próprio território: vitalidade, autoria e desejo de viver com presença',
    moon: 'emoção que precisa de reconhecimento, calor e um lugar onde o coração não pareça exagerado',
    rising: 'presença magnética, expressiva e memorável; costuma chegar com uma luz difícil de ignorar',
    venus: 'amor demonstrativo, romântico e generoso, com gosto por se sentir especial e fazer o outro se sentir especial',
    mars: 'desejo dramático e leal: luta com orgulho, defende o que ama e precisa de uma causa digna',
    house: 'a área em que você quer criar, brincar, liderar e assinar algo com seu nome',
    growth: 'escutar mesmo quando não está no centro, pedir carinho sem encenar e dividir o palco',
    easeful: 'Áries, Sagitário e Libra costumam alimentar sua alegria, seu fogo e seu gosto pela troca',
    charged: 'Touro, Escorpião e Aquário podem mostrar paciência, profundidade e desapego',
    bodyCare: 'sol, movimento prazeroso, brincadeira, arte e descanso da obrigação de estar sempre aceso',
    privateTruth: 'Leão não quer apenas atenção; quer que seu amor seja recebido com a mesma grandeza com que é oferecido',
  },
  virgo: {
    name: 'Virgem',
    dateRange: 'de 23 de agosto a 22 de setembro',
    elementMode: 'terra mutável',
    ruling: 'Mercúrio',
    temperament: 'observador, prestativo, preciso e mais sensível do que sua eficiência deixa transparecer',
    gift: 'melhora o que toca: organiza, edita, conserta e transforma uma ideia em algo que funciona',
    challenge: 'confundir valor com perfeição ou usar a crítica para não sentir incerteza',
    loveNeeds: 'confiança, cuidado cotidiano, palavras claras e uma relação em que ajudar não seja uma obrigação silenciosa',
    friendship: 'amizades honestas, planos práticos e gente que respeita os pequenos detalhes',
    work: 'analisar, curar, escrever, pesquisar, cuidar da saúde, criar processos e tornar o conhecimento útil',
    purpose: 'aprender que o bom o bastante também pode ser belo e que o descanso faz parte do método',
    sun: 'identidade construída por meio de serviço, ofício, observação e melhoria contínua',
    moon: 'emoção que se regula com ordem, rotina e a sensação de ser útil sem se explorar',
    rising: 'presença discreta, atenta e reservada; o mundo vê alguém que percebe o que está faltando',
    venus: 'amor cuidadoso e seletivo, expresso em gestos concretos mais do que em grandes discursos',
    mars: 'desejo aplicado: corrige, pratica, aperfeiçoa e pode se frustrar quando o caos vence',
    house: 'a área em que você precisa refinar, simplificar, cuidar dos hábitos e aplicar discernimento',
    growth: 'falar consigo com menos dureza, permitir que outras pessoas ajudem e não transformar cada erro em identidade',
    easeful: 'Touro, Capricórnio e Câncer costumam valorizar seu cuidado prático e seu desejo de segurança',
    charged: 'Gêmeos, Sagitário e Peixes podem afrouxar seu controle por meio da brincadeira, da abertura e da entrega',
    bodyCare: 'rotinas flexíveis, digestão tranquila, sono, pausas de verdade e menos listas impossíveis',
    privateTruth: 'Virgem não procura falhas por prazer; costuma estar tentando fazer a vida doer menos',
  },
  libra: {
    name: 'Libra',
    dateRange: 'de 23 de setembro a 22 de outubro',
    elementMode: 'ar cardinal',
    ruling: 'Vênus',
    temperament: 'diplomático, perceptivo e muito atento à atmosfera entre as pessoas',
    gift: 'encontra proporção: embeleza, concilia, escuta os dois lados e devolve elegância ao conflito',
    challenge: 'esperar por uma opção perfeita até que a vida decida em seu lugar',
    loveNeeds: 'reciprocidade, conversa, beleza compartilhada e uma relação em que a escolha seja mútua',
    friendship: 'amizades sociáveis, gosto compartilhado, debate gentil e planos em que todos possam ficar à vontade',
    work: 'negociar, criar, aconselhar, escrever, defender a justiça e produzir experiências equilibradas',
    purpose: 'aprender que a paz verdadeira às vezes começa com uma frase incômoda dita a tempo',
    sun: 'identidade que se descobre no espelho dos outros: relação, gosto, justiça e escolha consciente',
    moon: 'emoção que precisa de harmonia, companhia e espaços onde o conflito não se transforme em ameaça',
    rising: 'presença elegante e sociável; costuma suavizar o ambiente antes de mostrar sua própria intensidade',
    venus: 'amor em seu próprio território: encanto, cooperação, estética e desejo de um vínculo bem cuidado',
    mars: 'ação mediada pela balança: luta por justiça, mas pode demorar a reconhecer a própria raiva',
    house: 'a área em que você busca equilíbrio, parceria, beleza e decisões que considerem a outra pessoa',
    growth: 'decidir antes que surja ressentimento, sustentar uma posição própria e não chamar seu silêncio de harmonia',
    easeful: 'Gêmeos, Aquário e Leão costumam alimentar sua conversa, sua sociabilidade e seu senso de diversão',
    charged: 'Câncer, Capricórnio e Áries podem mostrar necessidade, estrutura e desejo direto',
    bodyCare: 'beleza simples, arte, relações tranquilas e tempo a sós para escutar a própria voz',
    privateTruth: 'Libra não evita conflitos por superficialidade; muitas vezes sente intensamente o custo de quebrar a harmonia do ambiente',
  },
  scorpio: {
    name: 'Escorpião',
    dateRange: 'de 23 de outubro a 21 de novembro',
    elementMode: 'água fixa',
    ruling: 'Marte na tradição e Plutão em leituras modernas',
    temperament: 'intenso, reservado, perceptivo e pouco interessado em versões decorativas da verdade',
    gift: 'entra onde outras pessoas não querem olhar e encontra poder, desejo, luto e transformação',
    challenge: 'se proteger tanto que a intimidade precise passar por provas impossíveis',
    loveNeeds: 'lealdade profunda, desejo honesto, confiança conquistada e uma relação capaz de falar sobre o que é difícil',
    friendship: 'amizades seletivas, confidências reais e gente que não traia o que foi dito em voz baixa',
    work: 'investigar, curar, analisar crises, administrar recursos compartilhados e trabalhar com o que está oculto',
    purpose: 'aprender que poder não é controle e que confiar também pode ser uma força',
    sun: 'identidade forjada ao atravessar a intensidade; não se contenta em viver na superfície',
    moon: 'emoção profunda, privada e resistente; precisa de tempo para revelar o que realmente acontece',
    rising: 'presença magnética e observadora; pode fazer os outros se sentirem compreendidos antes de falar',
    venus: 'amor total, fiel e exigente, com desejo de fusão e um medo legítimo de traição',
    mars: 'desejo estratégico: espera, observa, avalia e age com força quando a decisão já foi tomada',
    house: 'a área em que você transforma, investiga, compartilha poder e aprende a soltar o que controla você',
    growth: 'abrir as janelas antes que o ambiente se feche, pedir verdade sem punir a vulnerabilidade',
    easeful: 'Câncer, Peixes e Virgem costumam compreender sua profundidade e sua necessidade de confiança',
    charged: 'Leão, Aquário e Touro podem trazer orgulho, distância ou teimosia, mas também magnetismo',
    bodyCare: 'privacidade, terapia, água, movimento intenso e práticas que permitam descarregar sem destruir',
    privateTruth: 'Escorpião não procura drama; procura algo verdadeiro o bastante para não precisar vigiar',
  },
  sagittarius: {
    name: 'Sagitário',
    dateRange: 'de 22 de novembro a 21 de dezembro',
    elementMode: 'fogo mutável',
    ruling: 'Júpiter',
    temperament: 'franco, expansivo, inquieto e mais filosófico do que seu humor deixa transparecer',
    gift: 'amplia o mapa: oferece perspectiva, ânimo, verdade e vontade de atravessar uma nova porta',
    challenge: 'usar a liberdade como desculpa para não permanecer onde algo precisa de cuidado',
    loveNeeds: 'espaço, aventura, honestidade, riso e alguém com horizonte próprio',
    friendship: 'amizades viajantes, debates longos, planos improvisados e gente que não tema mudar de opinião',
    work: 'ensinar, viajar, publicar, orientar, empreender, estudar e conectar experiências a um significado',
    purpose: 'aprender que a verdade fica mais forte quando também tem tato',
    sun: 'identidade que cresce ao explorar e encontrar um sentido maior do que a rotina',
    moon: 'emoção que precisa de movimento, esperança e permissão para enxergar mais longe',
    rising: 'presença aberta, honesta e às vezes expansiva demais; parece estar a caminho de outra coisa',
    venus: 'amor aventureiro, divertido e livre, com gosto pelo riso e por promessas que ampliam o mundo',
    mars: 'desejo guiado por uma visão: luta por princípios, se inflama com causas e detesta se sentir preso',
    house: 'a área em que você busca viagem, estudo, fé, humor e uma versão mais ampla da vida',
    growth: 'cumprir o que promete, escutar os detalhes e não transformar cada limite em prisão',
    easeful: 'Áries, Leão e Aquário costumam acompanhar seu fogo, sua independência e seu desejo de espaço',
    charged: 'Virgem, Peixes e Gêmeos podem criar tensão entre o método, a sensibilidade e a dispersão',
    bodyCare: 'ar livre, pernas em movimento, aprendizagem viva e descanso da obrigação de otimizar tudo',
    privateTruth: 'Sagitário não foge da profundidade; foge de uma vida que exige que pare de crescer',
  },
  capricorn: {
    name: 'Capricórnio',
    dateRange: 'de 22 de dezembro a 19 de janeiro',
    elementMode: 'terra cardinal',
    ruling: 'Saturno',
    temperament: 'sóbrio, estratégico, resistente e mais carinhoso do que costuma mostrar no início',
    gift: 'transforma intenção em estrutura: organiza, sustenta, mede o tempo e constrói com paciência',
    challenge: 'confundir descanso com fraqueza ou acreditar que precisa merecer cada gesto de amor',
    loveNeeds: 'compromisso, respeito, paciência, humor seco e demonstrações que sobrevivam ao entusiasmo inicial',
    friendship: 'amizades leais, discretas e capazes de permanecer quando a vida fica adulta',
    work: 'liderar, planejar, administrar, construir instituições, cuidar da reputação e sustentar metas de longo prazo',
    purpose: 'aprender que a ambição pode incluir uma vida interior, e não apenas resultados visíveis',
    sun: 'identidade que amadurece com o tempo, a responsabilidade e uma relação séria com o que deseja alcançar',
    moon: 'emoção contida; precisa de segurança, competência e permissão para ser vulnerável sem perder autoridade',
    rising: 'presença reservada, competente e um pouco inacessível até que surja confiança',
    venus: 'amor cuidadoso e sério, com desejo de construir algo que tenha forma e futuro',
    mars: 'desejo disciplinado: trabalha por objetivos, calcula esforços e costuma vencer pela constância',
    house: 'a área em que você assume responsabilidade, cria estrutura e aprende o poder da paciência',
    growth: 'pedir apoio antes de se esgotar, celebrar os avanços e não adiar a alegria até o fim da escada',
    easeful: 'Touro, Virgem e Escorpião costumam respeitar seu ritmo, sua profundidade e seu desejo de lealdade',
    charged: 'Áries, Libra e Câncer podem ensinar velocidade, reciprocidade e cuidado emocional',
    bodyCare: 'cuidado com os ossos, sono, limites no trabalho, humor, descanso programado e permissão para não produzir',
    privateTruth: 'Capricórnio não é frio; muitas vezes está tentando ser digno de confiança antes de pedir ternura',
  },
  aquarius: {
    name: 'Aquário',
    dateRange: 'de 20 de janeiro a 18 de fevereiro',
    elementMode: 'ar fixo',
    ruling: 'Saturno na tradição e Urano em leituras modernas',
    temperament: 'independente, mental, observador e difícil de enquadrar nas expectativas sociais',
    gift: 'vê o sistema de fora e pergunta se uma regra ainda serve',
    challenge: 'se refugiar na distância quando a vida exige presença emocional',
    loveNeeds: 'amizade, liberdade mental, estranheza compartilhada e uma relação sem posse',
    friendship: 'amizades escolhidas, comunidades, conversas incomuns e gente que respeite sua diferença',
    work: 'inovar, pesquisar, programar, organizar grupos, criar sistemas e defender futuros possíveis',
    purpose: 'aprender que ser diferente não exige estar só e que uma comunidade também pode ter intimidade',
    sun: 'identidade que precisa pensar por conta própria e viver de acordo com uma visão',
    moon: 'emoção processada com distância, ideias e tempo; sentir pode vir depois de entender',
    rising: 'presença singular, renovadora e um pouco imprevisível; as pessoas percebem uma distância magnética',
    venus: 'amor baseado em amizade, liberdade e aceitação do que há de estranho em cada pessoa',
    mars: 'desejo obstinado e cerebral: luta por princípios, sistemas e espaço próprio',
    house: 'a área em que você inova, questiona, se afasta da norma e busca uma rede mais honesta',
    growth: 'permanecer presente quando alguém precisa de calor, e não apenas de uma teoria brilhante',
    easeful: 'Gêmeos, Libra e Sagitário costumam oferecer conversa, sociabilidade e horizonte',
    charged: 'Touro, Escorpião e Leão podem criar tensão em torno da segurança, da intensidade e do orgulho pessoal',
    bodyCare: 'desconexão digital, circulação, amizades reais e rotinas que não pareçam uma prisão',
    privateTruth: 'Aquário não quer ser diferente por pose; quer respirar sem pedir permissão para pensar de outro modo',
  },
  pisces: {
    name: 'Peixes',
    dateRange: 'de 19 de fevereiro a 20 de março',
    elementMode: 'água mutável',
    ruling: 'Júpiter na tradição e Netuno em leituras modernas',
    temperament: 'sensível, imaginativo, compassivo e permeável ao que outras pessoas não dizem',
    gift: 'suaviza as bordas: imagina, perdoa, sonha, cria e escuta a linguagem do invisível',
    challenge: 'se dissolver nas necessidades alheias ou chamar de destino aquilo que exige limites',
    loveNeeds: 'ternura, mistério, empatia, arte e uma relação em que a sensibilidade não seja motivo de deboche',
    friendship: 'amizades gentis, criativas, espirituais ou muito humanas, em que ninguém precise fingir dureza',
    work: 'criar, curar, acompanhar, cuidar, interpretar símbolos, fazer música, escrever ou trabalhar entre mundos',
    purpose: 'aprender que compaixão com limites continua sendo compaixão e costuma durar mais',
    sun: 'identidade que precisa de inspiração, entrega e uma relação viva com a imaginação',
    moon: 'emoção porosa: sente ambientes, sonhos e silêncios e precisa de tempo para voltar a si',
    rising: 'presença mutável, suave e difícil de definir; outras pessoas projetam muito sobre ela',
    venus: 'amor idealista, romântico e terno, com desejo de fusão e beleza compartilhada',
    mars: 'desejo indireto, inspirado e às vezes evasivo; age melhor quando existe sentido emocional',
    house: 'a área em que os limites se suavizam e surgem sonho, fé, arte, luto ou compaixão',
    growth: 'dizer não antes de desaparecer, dar forma ao talento e não resgatar quem não quer mudar',
    easeful: 'Câncer, Escorpião e Capricórnio costumam compreender sua profundidade e oferecer contenção',
    charged: 'Gêmeos, Sagitário e Virgem podem criar tensão entre a palavra, a verdade e a ordem, mas também ajudar a dar forma à sua sensibilidade',
    bodyCare: 'sono, água, música, solidão tranquila e limites pessoais diante de pessoas exigentes',
    privateTruth: 'Peixes não está perdido; muitas vezes percebe uma camada da realidade que outras pessoas ignoram',
  },
};

function expandedSections(profile: GuideDepth): PortugueseGuide['sections'] {
  return [
    {
      heading: `Como reconhecer ${profile.name}`,
      body: [
        `${profile.name} costuma se mostrar ${profile.temperament}. Isso não significa que todas as pessoas desse signo se comportem do mesmo modo; significa que, quando o mapa dá força a essa energia, a vida se organiza em torno desse pulso. Seu dom é claro: ${profile.gift}.`,
        `O ponto mais delicado é distinguir virtude de reflexo automático. O dom de ${profile.name} fica mais nítido quando não precisa ser demonstrado o tempo todo. Sua sombra aparece quando passa a ${profile.challenge}.`,
        `Por isso, vale ler o signo como uma ferramenta, não como uma sentença. ${profile.name} descreve uma maneira de responder à vida: o que se nota primeiro, o que se protege, o que se deseja e que tipo de experiência ajuda alguém a recuperar o próprio eixo.`,
      ],
    },
    {
      heading: `${profile.name} no amor, na amizade e na confiança`,
      body: [
        `No amor, ${profile.name} precisa de ${profile.loveNeeds}. Quando isso falta, a relação pode parecer adequada por fora e vazia por dentro. Esse signo não se abre de verdade apenas porque existe atração; precisa sentir que o ritmo do vínculo permite preservar a própria identidade.`,
        `Na amizade, busca ${profile.friendship}. Às vezes, a compatibilidade mais saudável não é a mais intensa, mas a que deixa o signo respirar sem precisar se explicar o dia inteiro. Quando ${profile.name} se sente aceito, sua melhor qualidade aparece sem esforço.`,
        `${profile.easeful}. Essa costuma ser a química mais fácil. ${profile.charged}. Esses vínculos não precisam ser uma má ideia: apenas exigem mais consciência. Em um relacionamento, o mapa completo importa muito mais do que o Sol. A Lua, Vênus, Marte, o ascendente e as casas mostram a história real.`,
      ],
    },
    {
      heading: `${profile.name} no trabalho, no dinheiro e no propósito`,
      body: [
        `No trabalho, ${profile.name} se destaca ao ${profile.work}. Nem sempre se trata de uma profissão literal; pode ser uma forma de abordar qualquer tarefa. Onde outras pessoas veem apenas mais uma pendência, esse signo vê uma maneira de organizar sua energia e mostrar o que sabe fazer.`,
        `Seu propósito não precisa parecer grandioso. Muitas vezes, começa com algo simples: ${profile.purpose}. Quando uma vida respeita esse movimento, o signo deixa de agir por defesa e começa a agir por escolha.`,
        `Com dinheiro e recursos, ${profile.name} precisa observar o que traz segurança e o que traz vitalidade. Um orçamento, uma rotina ou uma meta servem quando sustentam a vida real. Quando viram uma prisão, o signo perde o contato com sua melhor inteligência.`,
      ],
    },
    {
      heading: `${profile.name} no seu mapa astral`,
      risingProfile: true,
      body: [
        `Seu signo solar é apenas uma parte. Com o Sol em ${profile.name}, aparece uma ${profile.sun}. Com a Lua em ${profile.name}, a história se torna uma ${profile.moon}. Com o ascendente em ${profile.name}, o mundo costuma encontrar primeiro uma ${profile.rising}.`,
        `Vênus e Marte mudam o tom dos relacionamentos. Vênus em ${profile.name} fala de ${profile.venus}. Marte em ${profile.name} mostra ${profile.mars}. Essas posições podem explicar por que alguém não se identifica com a descrição típica de seu signo solar.`,
        `A casa em que ${profile.name} cai também importa. O signo nessa casa aponta para ${profile.house}. Se você não sabe em que casa ele está no seu mapa, calcule o mapa astral completo com hora e local; assim, é possível ver se o tema aparece na identidade, nos relacionamentos, no trabalho, na família, na criatividade ou no mundo interior.`,
        `A precisão importa principalmente perto das mudanças de signo. As datas de ${profile.name} costumam ir ${profile.dateRange}, mas o Sol não entra no signo no mesmo horário todos os anos. Se você nasceu na transição, a única resposta confiável vem de um mapa calculado com seus dados.`,
      ],
    },
    {
      heading: `Sombra e crescimento de ${profile.name}`,
      body: [
        `A sombra de ${profile.name} não é um defeito moral. É uma estratégia que fez sentido em algum momento e depois se tornou automática demais. O crescimento começa quando o signo percebe que já não precisa responder sempre a partir do mesmo lugar.`,
        `Para esse signo, a prática central é ${profile.growth}. A frase pode parecer simples, mas costuma tocar exatamente o ponto em que o mapa amadurece: não negar o impulso, e sim dar a ele uma forma mais consciente.`,
        `O corpo também importa. Estas práticas ajudam ${profile.name}: ${profile.bodyCare}. A astrologia é mais útil quando chega às pequenas decisões: como você descansa, como pede, como sai de um ciclo e o que escolhe repetir.`,
      ],
    },
    {
      heading: `O que ${profile.name} raramente diz em voz alta`,
      body: [
        `${profile.privateTruth}. Essa camada íntima costuma explicar mais do que qualquer estereótipo. Por trás da imagem pública do signo, existe uma necessidade humana muito concreta: ser compreendido sem precisar virar uma caricatura.`,
        `Ler ${profile.name} com cuidado significa dar dignidade às suas contradições. Pode mostrar força e precisar de cuidado, buscar liberdade e desejar pertencimento, parecer sério e ter humor, ser sensível e ter limites. O mapa completo permite acolher essas combinações sem forçá-las a caber em um rótulo.`,
        `Por isso, este guia é um ponto de partida. Para saber o que ${profile.name} significa na sua vida, veja onde aparece no seu mapa, quais planetas estão ali e quais relações ativa. O signo oferece o idioma; o mapa astral oferece a frase completa.`,
      ],
    },
  ];
}

function expandedFaq(profile: GuideDepth): PortugueseGuide['faq'] {
  return [
    {
      q: `O que significa ter muita energia de ${profile.name} no mapa?`,
      a: `Significa que vários planetas ou pontos importantes falam a linguagem de ${profile.name}, um signo de ${profile.elementMode}. Este guia usa a seguinte regência como referência: ${profile.ruling}. Isso aparece na personalidade, nos vínculos e nas decisões, mas a casa e os aspectos mostram onde se expressa.`,
    },
    {
      q: `E se eu não me identificar com ${profile.name}?`,
      a: 'É normal. O ascendente, a Lua, os planetas dominantes e os aspectos fortes podem mudar muito a forma como o signo solar é vivido. Calcule o mapa completo antes de descartar o signo.',
    },
    {
      q: `Qual é a lição de ${profile.name}?`,
      a: `Sua lição é ${profile.purpose}. Quando esse aprendizado amadurece, o signo preserva sua força sem ficar preso à própria defesa automática.`,
    },
  ];
}

export function portugueseGuideFor(sign: Sign): PortugueseGuide {
  const guide = PT_GUIDES[sign.slug];
  if (!guide) throw new Error(`Missing Portuguese guide for ${sign.slug}`);
  const profile = DEPTH[sign.slug];
  if (!profile) throw new Error(`Missing Portuguese guide depth for ${sign.slug}`);
  return {
    ...guide,
    sections: [...guide.sections, ...expandedSections(profile)],
    faq: [...guide.faq, ...expandedFaq(profile)],
  };
}
