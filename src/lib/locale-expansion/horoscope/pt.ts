/**
 * Horóscopos por período em português do Brasil: amanhã, semana, mês, amor,
 * trabalho e ano. Escrito em português a partir dos fatos (./types.ts), sem
 * traduzir o inglês nem o espanhol. Registro: "você", frases simples, sem
 * drama; nenhuma promessa sobre saúde, dinheiro, destino ou relacionamentos.
 * Sem travessões.
 */
import { signBySlug, signName } from '../../signs';
import { aspectLabel, planetLabel } from '../../i18n/astrology';
import { cap, monthName, monthYear, pick, weekday } from './format';
import type {
  EventFact,
  Fact,
  HoroscopeLocaleModule,
  LocalizedPassage,
  MonthlyContext,
  PeriodContext,
  PeriodSurface,
  PositionFact,
} from './types';

const L = 'pt' as const;
const SIGN_ORDER = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const idx = (slug: string) => SIGN_ORDER.indexOf(slug);

const sign = (slug: string) => signName(signBySlug(slug), L);
const planet = (body: string) => planetLabel(L, body);
/** O Sol e a Lua levam artigo; os planetas, não. */
const subject = (body: string) => (body === 'Sun' ? 'o Sol' : body === 'Moon' ? 'a Lua' : planet(body));

/** "9 de novembro", e "1º de dezembro", como se escreve no Brasil. */
function dayLabel(at: string): string {
  const day = Number(at.slice(8, 10));
  return day === 1 ? '1º' : String(day);
}
const date = (at: string) => `${dayLabel(at)} de ${monthName(L, Number(at.slice(5, 7)))}`;
const dateYear = (at: string) => `${date(at)} de ${at.slice(0, 4)}`;
/** "de 2 a 8 de novembro", ou "de 30 de novembro a 6 de dezembro". */
const range = (from: string, through: string) => (from.slice(0, 7) === through.slice(0, 7)
  ? `de ${dayLabel(from)} a ${date(through)}`
  : `de ${date(from)} a ${date(through)}`);
/** Para títulos: "28/9 a 4/10" quando a semana atravessa o mês, para caber em 60 caracteres. */
const shortRange = (from: string, through: string) => (from.slice(0, 7) === through.slice(0, 7)
  ? `${dayLabel(from)} a ${date(through)}`
  : `${Number(from.slice(8, 10))}/${Number(from.slice(5, 7))} a ${Number(through.slice(8, 10))}/${Number(through.slice(5, 7))}`);
/** "às 07:02 UTC", "à 01:15 UTC". */
const clock = (at: string) => {
  const hh = at.slice(11, 13);
  return `${hh === '01' ? 'à' : 'às'} ${at.slice(11, 16)} UTC`;
};
const utc = (at: string) => `${at.slice(11, 16)} UTC`;

// ── Contrações ──

export const CONTRACT: Record<string, Record<string, string>> = {
  em: { o: 'no', a: 'na', os: 'nos', as: 'nas' },
  de: { o: 'do', a: 'da', os: 'dos', as: 'das' },
  a: { o: 'ao', a: 'à', os: 'aos', as: 'às' },
  por: { o: 'pelo', a: 'pela', os: 'pelos', as: 'pelas' },
};

/** Junta preposição e artigo: em + o lar = no lar, a + a família = à família. */
function contract(prep: keyof typeof CONTRACT, phrase: string): string {
  const match = phrase.match(/^(os|as|o|a) (.*)$/);
  if (!match) return `${prep} ${phrase}`;
  return `${CONTRACT[prep][match[1]]} ${match[2]}`;
}

/**
 * Rede de segurança para os modelos: contrai o que tiver escapado
 * ("em o" vira "no", "de a" vira "da", "a o" vira "ao", "por a" vira "pela").
 */
function tidy(text: string): string {
  return text
    // Só depois de espaço ou do início: \b em JavaScript não conhece "ç" nem "ú".
    .replace(/(^|[\s(])(em|de|por) (os|as|o|a)(?=\s)/g, (_, pre: string, prep: string, art: string) => `${pre}${CONTRACT[prep][art]}`)
    .replace(/(^|[\s(])a (os|as|o|a)(?=\s)/g, (_, pre: string, art: string) => `${pre}${CONTRACT.a[art]}`)
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

const ORDINAL = ['', 'primeira', 'segunda', 'terceira', 'quarta', 'quinta', 'sexta', 'sétima', 'oitava', 'nona', 'décima', 'décima primeira', 'décima segunda'];

/** O que cada casa solar põe em jogo, item por item, cada um com o seu artigo. */
export const THEME_ITEMS: Record<number, string[]> = {
  1: ['a sua imagem', 'os seus começos', 'a impressão que você causa'],
  2: ['os seus recursos', 'o que você valoriza', 'o que dá estabilidade a você'],
  3: ['as conversas', 'as mensagens', 'o seu ambiente próximo'],
  4: ['o lar', 'a família', 'a sua vida privada'],
  5: ['o prazer', 'o romance', 'o que você cria por gosto'],
  6: ['o trabalho do dia a dia', 'os hábitos', 'as suas rotinas'],
  7: ['os relacionamentos', 'os acordos de igual para igual'],
  8: ['o dinheiro compartilhado', 'as dívidas', 'a confiança íntima'],
  9: ['as viagens', 'os estudos', 'as suas crenças'],
  10: ['a carreira', 'a reputação', 'o que o público vê de você'],
  11: ['as amizades', 'os grupos', 'os planos para o futuro'],
  12: ['o descanso', 'o recolhimento', 'o que se move por dentro'],
};

/** "o lar, a família e a sua vida privada"; com preposição, ela se repete e contrai em cada item. */
export function theme(house: number, prep?: keyof typeof CONTRACT): string {
  const items = THEME_ITEMS[house].map((item) => (prep ? contract(prep, item) : item));
  return items.length > 1 ? `${items.slice(0, -1).join(', ')} e ${items.at(-1)}` : items[0];
}

/** Títulos curtos para os subtítulos do ano. */
const SHORT: Record<number, string> = {
  1: 'Imagem e começos',
  2: 'Valores e estabilidade',
  3: 'Conversas e entorno',
  4: 'Lar e família',
  5: 'Prazer e criatividade',
  6: 'Rotina e trabalho diário',
  7: 'Relacionamentos e acordos',
  8: 'Finanças compartilhadas e intimidade',
  9: 'Estudos e horizontes',
  10: 'Carreira e reputação',
  11: 'Amizades e projetos',
  12: 'Descanso e recolhimento',
};

/** Um primeiro passo concreto por casa. */
const ADVICE: Record<number, string> = {
  1: 'Diga o que você quer começar antes de reagir ao que os outros propõem.',
  2: 'Anote o que de fato importa para você e o que dá firmeza ao seu dia a dia.',
  3: 'Responda à mensagem pendente e deixe por escrito o que foi combinado.',
  4: 'Veja do que a casa precisa e reserve tempo para isso antes de aceitar outro compromisso.',
  5: 'Separe um tempo para algo que você faz só por gosto, sem pensar no resultado.',
  6: 'Organize a lista do dia e tire dela uma tarefa que não é sua.',
  7: 'Fale com clareza com a outra pessoa e pergunte em vez de supor.',
  8: 'Separe o que é seu, o que é dividido com alguém e o que ainda falta acertar.',
  9: 'Leia, pergunte ou planeje uma viagem: algo que tire a cabeça da rotina.',
  10: 'Termine o que os outros vão ver e deixe claro quem fez.',
  11: 'Escreva para aquele amigo ou para aquele grupo e marque uma data.',
  12: 'Reserve uma hora longe das telas e deixe o dia desacelerar.',
};

/** Um segundo olhar sobre a mesma casa, para não repetir o conselho. */
const REFINE: Record<number, string> = {
  1: 'Uma mudança pequena no jeito de se apresentar diz mais que um grande anúncio.',
  2: 'Pense no que você valoriza de verdade e deixe isso guiar a próxima escolha.',
  3: 'Releia o que você envia: uma palavra fora do lugar pode custar uma tarde.',
  4: 'Conserte uma coisa concreta em casa em vez de planejar uma reforma inteira.',
  5: 'Deixe a diversão ser diversão; nem tudo precisa virar projeto.',
  6: 'Revise um hábito que ficou automático e decida se vale mantê-lo.',
  7: 'Um acordo justo se reconhece quando os dois sabem o que cabe a cada um.',
  8: 'Uma conversa franca sobre dinheiro ou confiança poupa muita suspeita depois.',
  9: 'Uma ideia nova vale mais quando você a testa em algo prático.',
  10: 'Escolha uma meta visível e meça o avanço com fatos, não com impressões.',
  11: 'Veja quais grupos realmente somam e quais você segue só por hábito.',
  12: 'Dormir bem e encerrar assuntos pendentes também conta como avançar.',
};

/** O lado afetivo de cada casa. */
const LOVE: Record<number, string> = {
  1: 'Mostre-se como você é; o que atrai agora é a naturalidade.',
  2: 'O carinho aparece no que é concreto: um gesto, uma ajuda, um tempo dedicado.',
  3: 'Uma conversa simples vale mais que qualquer gesto grandioso.',
  4: 'A calma em casa é a base: cuide do espaço que vocês dividem.',
  5: 'Há vontade de aproveitar; proponha um programa que faça vocês rirem.',
  6: 'O amor também mora no cotidiano: dividir as tarefas sem ficar contando quem fez mais.',
  7: 'A relação pede trato de igual para igual; escute antes de responder.',
  8: 'A confiança cresce quando você fala do que realmente importa para você.',
  9: 'Leve a relação para algo novo: um lugar, uma ideia, um assunto diferente.',
  10: 'Cuide para que o trabalho não ocupe todo o espaço que é da outra pessoa.',
  11: 'A amizade faz parte do amor agora; programas em grupo ajudam.',
  12: 'Há coisas que se dizem melhor a sós e sem pressa.',
};

/** O lado profissional de cada casa. */
const WORK: Record<number, string> = {
  1: 'Tome a iniciativa numa tarefa que leve o seu nome.',
  2: 'Deixe claro o valor do que você entrega e os recursos de que precisa para trabalhar bem.',
  3: 'E-mails, ligações e burocracias pedem ordem e resposta rápida.',
  4: 'Arrume o lugar de onde você trabalha para que ele não roube a sua energia.',
  5: 'Um projeto criativo ou uma proposta sua merece a sua melhor hora.',
  6: 'Organize processos e prazos; a constância rende mais que o esforço pontual.',
  7: 'Negocie com clareza: sócios, clientes e acordos assinados.',
  8: 'Olhe para dívidas, recursos compartilhados e o que depende de outras pessoas.',
  9: 'Estudar, publicar ou abrir uma frente nova dá resultado a longo prazo.',
  10: 'A sua reputação está no que você entrega; termine primeiro o que tem mais visibilidade.',
  11: 'Os contatos e o trabalho em equipe abrem portas.',
  12: 'Trabalhe no que ainda não aparece e não espere aplauso antes da hora.',
};

/** Uma terceira linha por casa, para que nenhum conselho se repita na mesma página. */
const THIRD: Record<number, string> = {
  1: 'Escolha uma coisa para começar hoje e deixe as outras para depois.',
  2: 'Repare no que traz estabilidade ao seu dia e proteja isso primeiro.',
  3: 'Uma ligação curta resolve o que dez mensagens deixam no ar.',
  4: 'Um canto arrumado da casa já muda o humor do dia.',
  5: 'Volte a um passatempo que ficou de lado, nem que seja por meia hora.',
  6: 'Comece pela tarefa mais chata; o resto do dia fica mais leve.',
  7: 'Antes de cobrar algo da outra pessoa, diga com clareza o que você espera.',
  8: 'Combine com antecedência o que é de cada um, antes que vire mal-entendido.',
  9: 'Separe um tempo para aprender algo fora da sua rotina de sempre.',
  10: 'Mostre o resultado, não o esforço: é isso que fica na memória de quem vê.',
  11: 'Um grupo vale pelo que vocês fazem juntos, não pelo tamanho.',
  12: 'Deixe uma parte do dia sem agenda e veja o que aparece.',
};

/** Uma segunda linha de trabalho por casa, para a segunda passagem do horóscopo profissional. */
const WORK2: Record<number, string> = {
  1: 'Apresente a sua proposta com o seu nome e um prazo.',
  2: 'Deixe claro o valor do que você faz antes de aceitar mais trabalho.',
  3: 'Responda ao que está pendente e confirme por escrito o que foi decidido.',
  4: 'Proteja o tempo de casa: trabalho levado para lá rende menos do que parece.',
  5: 'Reserve a melhor hora do dia para a parte criativa do trabalho.',
  6: 'Revise um processo que toma tempo demais e corte uma etapa.',
  7: 'Antes de fechar um acordo, confirme quem faz o quê e até quando.',
  8: 'Veja o que depende de recursos de outras pessoas e combine prazos claros.',
  9: 'Um curso, uma leitura técnica ou uma conversa com alguém de outra área amplia o horizonte.',
  10: 'Entregue primeiro o que mais gente vai ver; o resto pode esperar um pouco.',
  11: 'Um contato antigo pode abrir uma porta nova; escreva para ele.',
  12: 'Organize os bastidores: o que ninguém vê sustenta o que todos veem.',
};

/** O que uma página já disse, para não repetir uma linha. */
class Page {
  private used = new Set<string>();
  /** A primeira linha ainda não usada; vazia quando todas já foram. */
  take(lines: string[]): string {
    const line = lines.find((candidate) => candidate && !this.used.has(candidate)) ?? '';
    if (line) this.used.add(line);
    return line;
  }
  /** Como take, mas volta à primeira variante quando todas já foram usadas. */
  vary(lines: string[]): string {
    return this.take(lines) || lines[0] || '';
  }
  advice(house: number): string {
    return this.take([ADVICE[house], REFINE[house], THIRD[house]]);
  }
  mark(line: string): string {
    this.used.add(line);
    return line;
  }
}

/** Como cada signo funciona melhor, numa frase. */
const KEY: Record<string, string> = {
  aries: 'Para Áries, um primeiro passo bem dado rende mais que uma corrida desordenada.',
  taurus: 'Touro se sai melhor no próprio ritmo, sem abrir mão do que de fato traz segurança.',
  gemini: 'Para Gêmeos, a clareza vem de escolher uma conversa e levá-la até o fim.',
  cancer: 'Para Câncer, cuidar não significa carregar tudo sozinho: o que você precisa também conta.',
  leo: 'Leão brilha mais quando o conteúdo está pronto antes de subir ao palco.',
  virgo: 'Para Virgem, basta melhorar uma coisa e fazê-la bem; não é preciso corrigir tudo.',
  libra: 'Para Libra, o equilíbrio chega quando você diz o que prefere em vez de adivinhar o que os outros querem.',
  scorpio: 'A força de Escorpião está em saber o que guardar e o que soltar, sem drama.',
  sagittarius: 'Para Sagitário, uma direção clara vale mais que dez possibilidades em aberto.',
  capricorn: 'Capricórnio mede o progresso em passos que dá para sustentar.',
  aquarius: 'Para Aquário, uma ideia ganha valor quando encontra um lugar concreto onde ser aplicada.',
  pisces: 'Para Peixes, limites claros protegem a sensibilidade em vez de apagá-la.',
};

/** O fio de cada signo no ano. */
const YEAR: Record<string, string> = {
  aries: 'O ano premia a iniciativa que se sustenta: começar é fácil para você, o que conta é terminar.',
  taurus: 'Este ano pede que você reveja o que de fato traz segurança e solte o que é só costume.',
  gemini: 'O ano gira em torno de escolhas: menos frentes abertas e mais conversas que chegam a algum lugar.',
  cancer: 'Este ano fala de cuidar sem se desgastar, com uma casa que seja abrigo e não obrigação.',
  leo: 'O ano separa ser visto de ser conhecido e valoriza o que faria sentido mesmo sem plateia.',
  virgo: 'Este ano pede ordem sem perfeccionismo: melhorar o que importa e deixar o resto passar.',
  libra: 'O ano testa os seus acordos: quais são justos e quais você mantém só para evitar conflito.',
  scorpio: 'Este ano fala de confiança: em quem você a deposita, o que divide e o que prefere guardar.',
  sagittarius: 'O ano convida você a transformar a curiosidade num plano com datas.',
  capricorn: 'Este ano confirma o que você construiu e mostra qual estrutura já não faz falta.',
  aquarius: 'O ano aproxima as suas ideias das pessoas certas: os projetos crescem em companhia.',
  pisces: 'Este ano ajuda você a dar forma ao que intui, com limites que protegem.',
};

const KIND_LOVE: Record<string, string> = {
  aries: 'No amor, Áries precisa de franqueza e de espaço para se mexer.',
  taurus: 'Touro valoriza a constância mais do que as promessas.',
  gemini: 'Na vida a dois, Gêmeos precisa de conversa e de surpresa na mesma medida.',
  cancer: 'No amor, Câncer se abre quando se sente em lugar seguro.',
  leo: 'Leão brilha no amor quando a admiração vai nos dois sentidos.',
  virgo: 'No amor, Virgem demonstra carinho com gestos pequenos e precisos.',
  libra: 'Libra busca reciprocidade, e não só harmonia.',
  scorpio: 'No amor, Escorpião precisa de verdade antes de intensidade.',
  sagittarius: 'Sagitário quer dividir o caminho sem perder a liberdade.',
  capricorn: 'Na vida a dois, Capricórnio confia no que se prova com o tempo.',
  aquarius: 'No amor, Aquário precisa de amizade dentro da relação.',
  pisces: 'Peixes dá muito; é bom que também receba.',
};

const KIND_WORK: Record<string, string> = {
  aries: 'No trabalho, Áries rende quando pode abrir caminho.',
  taurus: 'Touro rende com prazos realistas e recursos claros.',
  gemini: 'Gêmeos trabalha melhor quando pode explicar e pôr pessoas em contato.',
  cancer: 'No trabalho, Câncer rende quando a equipe se sente cuidada.',
  leo: 'Na carreira, a visibilidade ajuda Leão quando o que está por trás já está pronto.',
  virgo: 'No trabalho, Virgem rende quando pode melhorar um processo concreto.',
  libra: 'Libra trabalha bem negociando e equilibrando interesses.',
  scorpio: 'No trabalho, Escorpião rende quando pode investigar a fundo.',
  sagittarius: 'Sagitário rende quando enxerga para onde o projeto vai.',
  capricorn: 'Capricórnio rende com metas que dá para medir.',
  aquarius: 'No trabalho, Aquário rende propondo outro jeito de fazer as coisas.',
  pisces: 'Peixes rende quando a tarefa tem um sentido claro.',
};

const ASPECT_MEANING: Record<string, string> = {
  conjunction: 'As duas áreas se juntam: o que você fizer numa aparece na outra.',
  sextile: 'É uma oportunidade tranquila; aproveite com um passo pequeno e concreto.',
  square: 'Há atrito entre as duas áreas; ajuste uma antes de forçar a outra.',
  trine: 'As coisas fluem entre as duas áreas; bom momento para avançar sem forçar.',
  opposition: 'As duas áreas puxam para lados opostos; procure o meio-termo.',
};

const ASPECT_SAME_HOUSE: Record<string, string> = {
  conjunction: 'O efeito se concentra nesse setor.',
  sextile: 'É uma oportunidade tranquila; aproveite com um passo pequeno e concreto.',
  square: 'Há atrito dentro do mesmo assunto; ajuste uma parte antes de forçar a outra.',
  trine: 'As coisas fluem; bom momento para avançar sem forçar.',
  opposition: 'O mesmo assunto puxa para dois lados; procure o meio-termo.',
};

const SLOW = new Set(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);

/** Vênus é feminino: "Vênus retrógrada"; os outros planetas, "retrógrado". */
const retro = (body: string) => (body === 'Venus' ? 'retrógrada' : 'retrógrado');

/** "a Lua passa por Escorpião, na sua décima segunda casa" */
function positionClause(fact: PositionFact): string {
  const where = `na sua ${ORDINAL[fact.house]} casa`;
  if (fact.retrograde) return `${subject(fact.body)} segue ${retro(fact.body)} em ${sign(fact.sign)}, ${where}`;
  if (fact.body === 'Moon') return `a Lua passa por ${sign(fact.sign)}, ${where}`;
  return `${subject(fact.body)} está em ${sign(fact.sign)}, ${where}`;
}

/** Frase sobre um evento, sem a data. */
function eventClause(fact: EventFact): string {
  const where = fact.sign ? sign(fact.sign) : '';
  switch (fact.eventKind) {
    case 'ingress':
      return `${subject(fact.body!)} entra em ${where}`;
    case 'station':
      return fact.eventType === 'retrograde'
        ? `${subject(fact.body!)} fica ${retro(fact.body!)} em ${where}`
        : `${subject(fact.body!)} retoma o movimento direto em ${where}`;
    case 'lunation':
      return fact.eventType === 'full' ? `acontece a Lua cheia em ${where}` : `acontece a Lua nova em ${where}`;
    case 'eclipse':
      return fact.eventType === 'solar' ? `acontece um eclipse solar em ${where}` : `acontece um eclipse lunar em ${where}`;
    case 'aspect': {
      const a = subject(fact.a!);
      const b = subject(fact.b!);
      const type = fact.eventType ?? 'conjunction';
      if (type === 'opposition') return `${a} faz oposição ${contract('a', b)}`;
      return `${a} faz ${aspectLabel(L, type)} com ${b}`;
    }
  }
}

/** O evento como nome, para a lista do céu: "Lua nova em Escorpião". */
function eventNoun(fact: EventFact): string {
  const where = fact.sign ? sign(fact.sign) : '';
  if (fact.eventKind === 'lunation') return fact.eventType === 'full' ? `Lua cheia em ${where}` : `Lua nova em ${where}`;
  if (fact.eventKind === 'eclipse') return fact.eventType === 'solar' ? `Eclipse solar em ${where}` : `Eclipse lunar em ${where}`;
  return cap(eventClause(fact));
}

/** O que o evento significa na casa onde cai: as variantes, a partir da do dia, para o texto não se repetir. */
function meaningVariants(fact: EventFact): string[] {
  const h = fact.houses[0];
  if (!h) return [];
  const day = Number(fact.at.slice(8, 10)) + Number(fact.at.slice(5, 7));
  const rotate = (lines: string[]) => lines.map((_, i) => lines[(i + day) % lines.length]);
  switch (fact.eventKind) {
    case 'ingress':
      return SLOW.has(fact.body ?? '')
        ? rotate([
          `Começa uma fase longa para ${theme(h)}.`,
          `Abre-se um capítulo de anos para ${theme(h)}.`,
          `Daqui em diante, vale rever o jeito de lidar com ${theme(h)}.`,
        ])
        : rotate([
          `Nas próximas semanas, o foco vai para ${theme(h)}.`,
          `Por algumas semanas, a atenção se volta para ${theme(h)}.`,
          `O assunto das próximas semanas passa a ser ${theme(h)}.`,
        ]);
    case 'station':
      return fact.eventType === 'retrograde'
        ? rotate([
          `Hora de revisar ${theme(h)} antes de assumir qualquer compromisso novo.`,
          `É tempo de rever ${theme(h)}, sem pressa.`,
          `Vale olhar de novo para ${theme(h)} e corrigir o que for preciso.`,
        ])
        : rotate([
          `O que estava parado ${theme(h, 'em')} volta a andar.`,
          `O impulso volta para ${theme(h)}.`,
          `As decisões adiadas sobre ${theme(h)} podem avançar.`,
        ]);
    case 'lunation':
      return fact.eventType === 'full'
        ? rotate([
          `Algo que vinha amadurecendo ${theme(h, 'em')} chega ao ponto.`,
          `O que você vem cultivando ${theme(h, 'em')} fica à vista.`,
        ])
        : rotate([
          `É um bom começo para ${theme(h)}.`,
          `Bom momento para plantar algo novo ${theme(h, 'em')}.`,
        ]);
    case 'eclipse':
      return rotate([
        `Marca uma virada ${theme(h, 'em')}; melhor não forçar decisões nesse mesmo dia.`,
        `Traz uma mudança de rumo ${theme(h, 'em')}; dê alguns dias antes de decidir.`,
      ]);
    case 'aspect': {
      const [h1, h2] = fact.houses;
      const type = fact.eventType ?? 'conjunction';
      return h2 && h2 !== h1
        ? [`De um lado, ${theme(h1)}; do outro, ${theme(h2)}. ${ASPECT_MEANING[type]}`]
        : [`Os dois atuam ${theme(h1, 'em')}. ${ASPECT_SAME_HOUSE[type]}`];
    }
  }
}

function factSentence(fact: Fact, page: Page, lead = ''): string {
  if (fact.kind === 'position') return `${cap(`${lead}${positionClause(fact)}`)}.`;
  const timed = fact.eventKind === 'lunation' || fact.eventKind === 'eclipse' || fact.eventKind === 'aspect';
  const at = `No dia ${date(fact.at)}${timed ? `, ${clock(fact.at)},` : ','}`;
  return `${at} ${eventClause(fact)}. ${page.vary(meaningVariants(fact))}`.trim();
}

const firstHouse = (facts: Fact[]) => facts.find((fact) => fact.kind === 'position')?.house
  ?? (facts.find((fact) => fact.kind === 'event') as EventFact | undefined)?.houses[0] ?? 1;

// ── Superfícies ──

const CLOSE_TOMORROW = [
  'Deixe o primeiro passo preparado hoje à noite, e o dia começa mais leve.',
  'Anote hoje o que você não quer esquecer amanhã.',
  'Se algo pode esperar até depois de amanhã, deixe esperar.',
  'Comece pelo que depende só de você.',
  'Escolha uma única coisa para terminar até a hora do almoço.',
];

/** "Com a Lua em Sagitário e Mercúrio retrógrado em Escorpião, ..." */
function recap(facts: Fact[]): string {
  const positions = facts.filter((fact): fact is PositionFact => fact.kind === 'position');
  const nouns = positions.map((fact) => `${subject(fact.body)}${fact.retrograde ? ` ${retro(fact.body)}` : ''} em ${sign(fact.sign)}`);
  const joined = nouns.length > 1 ? `${nouns.slice(0, -1).join(', ')} e ${nouns.at(-1)}` : nouns[0] ?? '';
  const houses = [...new Set(positions.map((fact) => fact.house))];
  if (!joined) return '';
  return houses.length > 1
    ? `Com ${joined}, o dia termina entre dois assuntos: de um lado, ${theme(houses[0])}; do outro, ${theme(houses[1])}.`
    : `Com ${joined}, o dia termina ${theme(houses[0], 'em')}.`;
}

function tomorrow(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  const page = new Page();
  page.mark(KEY[s]);
  return ctx.passages.map(({ facts, index }) => {
    const h = firstHouse(facts);
    let led = false;
    const written = facts.map((fact) => {
      const lead = index === 0 && !led && fact.kind === 'position' ? 'amanhã ' : '';
      if (lead) led = true;
      return factSentence(fact, page, lead);
    });
    // Uma frase de posição que a página já disse vira um resumo, em vez de se repetir.
    const fresh = written.filter((sentence) => page.take([sentence.replace(/^Amanhã a/, 'A')]));
    const sentences = fresh.length ? fresh : [recap(facts)];
    const advice = page.advice(h);
    if (index === 0) {
      return { text: `${sentences.join(' ')} Isso traz para o primeiro plano ${theme(h)}. ${advice} ${KEY[s]}` };
    }
    if (index === ctx.passages.length - 1) {
      return { text: `${sentences.join(' ')} ${advice} ${pick(CLOSE_TOMORROW, idx(s))}` };
    }
    return { text: `${sentences.join(' ')} ${advice}` };
  });
}

const CLOSE_WEEK = [
  'Na revisão de domingo, fique com uma coisa que funcionou e outra que você mudaria.',
  'Antes que a próxima semana comece, decida o que você não vai repetir.',
  'Feche a semana com algo terminado, mesmo que seja pequeno.',
  'Guarde o domingo para arrumar a semana seguinte com calma.',
];

function weekly(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  const page = new Page();
  const last = ctx.passages.length - 1;
  return ctx.passages.map(({ facts, index }) => {
    const moons = facts.filter((fact): fact is PositionFact => fact.kind === 'position');
    if (index === 0 && moons.length >= 2) {
      const [start, ...rest] = moons;
      const end = rest.at(-1)!;
      const mid = rest.length > 1 ? rest[0] : undefined;
      const midText = mid ? `; por volta de ${weekday(L, mid.at)}, passa para ${theme(mid.house)}` : '';
      return {
        text: `A semana ${range(ctx.from, ctx.through)} começa com a Lua em ${sign(start.sign)}, no terreno ${theme(start.house, 'de')}${midText}; no fim da semana, chega ${theme(end.house, 'a')}. ${page.mark(KEY[s])}`,
      };
    }
    const h = firstHouse(facts);
    const event = facts.find((fact): fact is EventFact => fact.kind === 'event');
    if (event) return { text: factSentence(event, page) };
    const advice = page.advice(h);
    if (index === 1) return { text: `Os primeiros dias pedem atenção ${theme(h, 'a')}. ${advice}` };
    if (index === last) return { text: `A semana fecha com ${theme(h)}. ${advice} ${pick(CLOSE_WEEK, idx(s))}` };
    return { text: `No meio da semana, o foco passa para ${theme(h)}. ${advice}` };
  });
}

const LOVE_CLOSE = [
  'Uma pergunta sincera esclarece mais do que uma suposição.',
  'Repare se a resposta da outra pessoa deixa o espaço de vocês mais leve.',
  'Não é preciso resolver tudo hoje; basta não esconder.',
  'Diga do que você precisa numa frase simples.',
  'Um gesto pequeno e no tempo certo vale mais que uma grande declaração.',
];

function love(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  const page = new Page();
  return ctx.passages.map(({ facts, index }) => {
    const h = firstHouse(facts);
    const sentences = facts.map((fact) => factSentence(fact, page)).join(' ');
    if (index === 0) return { text: `${sentences} ${page.mark(LOVE[h])} ${KIND_LOVE[s]}` };
    const close = page.take([LOVE[h], pick(LOVE_CLOSE, idx(s), h), pick(LOVE_CLOSE, idx(s), h + 1)]);
    return { text: `${sentences} O clima afetivo se volta para ${theme(h)}. ${close}` };
  });
}

function career(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  const page = new Page();
  return ctx.passages.map(({ facts, index }) => {
    const h = firstHouse(facts);
    const sentences = facts.map((fact) => factSentence(fact, page)).join(' ');
    if (index === 0) return { text: `${sentences} ${page.mark(WORK[h])} ${KIND_WORK[s]}` };
    return { text: `${sentences} O trabalho também olha para ${theme(h)}. ${page.take([WORK2[h], WORK[h]])}` };
  });
}

// ── O ano ──

const QUARTERS: Array<[number, number]> = [[1, 3], [4, 6], [7, 9], [10, 12]];

/** As casas do trecho, da mais citada para a menos citada. */
function rankedHouses(facts: Fact[]): number[] {
  const counts = new Map<number, number>();
  for (const fact of facts) {
    const houses = fact.kind === 'position' ? [fact.house] : fact.houses;
    for (const house of houses) counts.set(house, (counts.get(house) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0]).map(([house]) => house);
}

function datedList(facts: Fact[], page: Page): string {
  return facts
    .filter((fact): fact is EventFact => fact.kind === 'event')
    // Um evento já explicado na página aparece só com a data, sem repetir o comentário.
    .map((fact) => `Em ${date(fact.at)}, ${eventClause(fact)}. ${page.take(meaningVariants(fact))}`)
    .join(' ');
}

const THEMED_HEADINGS = [
  'Amor, amizade e acordos claros',
  'Trabalho, dinheiro e uma autoridade que se sustenta',
  'Casa, descanso e a carga que ninguém vê',
  'O seu próprio rumo',
];

const THEMED_LEADS = [
  'Nos afetos, conta o que dá para ver: um pedido, um acordo revisto, um tempo protegido.',
  'No trabalho e no dinheiro, meça a sua capacidade, os prazos e o que você entrega, não só a vontade.',
  'Em casa e no descanso, proteja o básico: sono, espaço e tempo sem obrigações.',
  'No plano pessoal, crescer só vale quando muda uma decisão concreta.',
];

function yearly(ctx: PeriodContext, year: string): LocalizedPassage[] {
  const s = ctx.sign;
  const name = sign(s);
  const page = new Page();
  let previous = 0;
  return ctx.passages.map(({ facts, index }) => {
    const events = facts.filter((fact): fact is EventFact => fact.kind === 'event');
    if (index === 0) {
      const first = events[0];
      const firstText = first ? ` A primeira data para marcar é ${date(first.at)}: ${eventClause(first)}. ${page.vary(meaningVariants(first))}` : '';
      return { heading: `${name} em ${year}`, text: `${YEAR[s]}${firstText}` };
    }
    if (index >= 1 && index <= 4) {
      const [from, to] = QUARTERS[index - 1];
      const ranked = rankedHouses(facts);
      // Dois trimestres seguidos nunca dividem o mesmo título: se a casa principal repete, vale a seguinte.
      const h = (ranked[0] === previous ? ranked.find((house) => house !== previous) : ranked[0]) ?? (previous % 12) + 1;
      previous = h;
      const leads = [
        `Este trimestre gira em torno ${theme(h, 'de')}.`,
        `O foco destes meses está ${theme(h, 'em')}.`,
        `Aqui o peso cai sobre ${theme(h)}.`,
      ];
      const start = (index + idx(s)) % leads.length;
      const lead = page.vary([...leads.slice(start), ...leads.slice(0, start)]);
      return {
        heading: `De ${monthName(L, from)} a ${monthName(L, to)}: ${SHORT[h].charAt(0).toLowerCase()}${SHORT[h].slice(1)}`,
        text: `${lead} ${datedList(facts, page)} ${page.take([REFINE[h], THIRD[h], ADVICE[h]])}`.trim(),
      };
    }
    if (index >= 5 && index <= 8) {
      const k = index - 5;
      const extra = k === 0 ? KIND_LOVE[s] : k === 1 ? KIND_WORK[s] : k === 3 ? KEY[s] : '';
      return { heading: THEMED_HEADINGS[k], text: `${THEMED_LEADS[k]} ${extra} ${datedList(facts, page)}`.trim() };
    }
    const dates = events.map((fact) => `${date(fact.at)} (${eventClause(fact)})`);
    const joined = dates.length > 1 ? `${dates.slice(0, -1).join(', ')} e ${dates.at(-1)}` : dates.join('');
    return {
      heading: 'Três datas para revisar o ano',
      text: `Marque três datas para ver como o ano está indo: ${joined}. Em cada uma, anote o que mudou e o que você quer manter.`,
    };
  });
}

function periodRaw(ctx: PeriodContext): LocalizedPassage[] {
  switch (ctx.surface) {
    case 'tomorrow': return tomorrow(ctx);
    case 'weekly': return weekly(ctx);
    case 'love': return love(ctx);
    case 'career': return career(ctx);
    case 'yearly-2026': return yearly(ctx, '2026');
    case 'yearly-2027': return yearly(ctx, '2027');
  }
}

function period(ctx: PeriodContext): LocalizedPassage[] {
  return periodRaw(ctx).map((passage) => ({ ...passage, text: tidy(passage.text) }));
}

// ── O mês ──

const CLOSE_MONTH = [
  'No fim do mês, fique com uma coisa que funcionou e outra que você mudaria.',
  'Antes que o mês termine, decida o que você não vai levar para o próximo.',
  'Feche o mês com algo terminado, mesmo que seja pequeno.',
];

function monthlyRaw(ctx: MonthlyContext): LocalizedPassage[] {
  const s = ctx.sign;
  const label = monthYear(L, ctx.month);
  const lunations = ctx.events.filter((fact) => fact.eventKind === 'lunation' || fact.eventKind === 'eclipse');
  const stations = ctx.events.filter((fact) => fact.eventKind === 'station');
  const ingresses = ctx.events.filter((fact) => fact.eventKind === 'ingress');
  const aspects = ctx.events.filter((fact) => fact.eventKind === 'aspect').slice(0, 4);
  const lead = lunations[0];
  const page = new Page();
  const passages: LocalizedPassage[] = [{
    text: `Nos horóscopos mensais, o seu signo solar vale como casa 1; ${lead ? `por essa conta, ${label} gira em torno ${theme(lead.houses[0], 'de')}` : `as datas abaixo mostram onde cai cada movimento do céu em ${label}`}. ${KEY[s]}`,
  }];
  if (lunations.length) passages.push({ heading: 'Fases da Lua', text: lunations.map((fact) => factSentence(fact, page)).join(' ') });
  if (stations.length) passages.push({ heading: 'Planetas que mudam de direção', text: stations.map((fact) => factSentence(fact, page)).join(' ') });
  if (ingresses.length) passages.push({ heading: 'Mudanças de signo', text: ingresses.map((fact) => factSentence(fact, page)).join(' ') });
  if (aspects.length) passages.push({ heading: 'Aspectos exatos', text: aspects.map((fact) => factSentence(fact, page)).join(' ') });
  const close = lead ? ADVICE[lead.houses[0]] : REFINE[1];
  passages.push({ heading: 'Para fechar o mês', text: `${close} ${pick(CLOSE_MONTH, idx(s))}` });
  return passages;
}

function monthly(ctx: MonthlyContext): LocalizedPassage[] {
  return monthlyRaw(ctx).map((passage) => ({ ...passage, text: tidy(passage.text) }));
}

// ── Página ──

type ChromeCtx = { surface: PeriodSurface | 'monthly'; from: string; through: string; month?: string };

function describe(name: string, ctx: ChromeCtx): string {
  switch (ctx.surface) {
    case 'tomorrow': return `O horóscopo de ${name} para amanhã, ${date(ctx.from)}`;
    case 'weekly': return `O horóscopo de ${name} para a semana ${range(ctx.from, ctx.through)}`;
    case 'monthly': return `O horóscopo de ${name} para ${monthYear(L, ctx.month!)}`;
    case 'love': return `O horóscopo do amor de ${name} para ${date(ctx.from)}`;
    case 'career': return `O horóscopo do trabalho de ${name} para ${date(ctx.from)}`;
    case 'yearly-2026': return `O horóscopo de ${name} para 2026`;
    case 'yearly-2027': return `O horóscopo de ${name} para 2027`;
  }
}

export const pt: HoroscopeLocaleModule = {
  locale: L,
  period,
  monthly,
  chrome: {
    title: (name, ctx) => {
      switch (ctx.surface) {
        case 'tomorrow': return `Horóscopo de ${name} para amanhã, ${date(ctx.from)}`;
        case 'weekly': return `Horóscopo semanal de ${name}: ${shortRange(ctx.from, ctx.through)}`;
        case 'monthly': return `Horóscopo mensal de ${name}: ${monthYear(L, ctx.month!)}`;
        case 'love': return `Horóscopo do amor de ${name} hoje`;
        case 'career': return `Horóscopo do trabalho de ${name} hoje`;
        case 'yearly-2026': return `Horóscopo de ${name} 2026`;
        case 'yearly-2027': return `Horóscopo de ${name} 2027`;
      }
    },
    h1: (name, ctx) => {
      switch (ctx.surface) {
        case 'tomorrow': return `Horóscopo de ${name} para amanhã`;
        case 'weekly': return `Horóscopo semanal de ${name}`;
        case 'monthly': return `Horóscopo mensal de ${name}`;
        case 'love': return `Horóscopo do amor de ${name}`;
        case 'career': return `Horóscopo do trabalho de ${name}`;
        case 'yearly-2026': return `Horóscopo de ${name} 2026`;
        case 'yearly-2027': return `Horóscopo de ${name} 2027`;
      }
    },
    description: (name, ctx) => tidy(`${describe(name, ctx)}, escrito com base no céu calculado: posições, fases da Lua e datas exatas, com as casas contadas a partir do seu signo solar.`),
    periodLabel: {
      today: 'Hoje', tomorrow: 'Amanhã', weekly: 'Semana', monthly: 'Mês', love: 'Amor', career: 'Trabalho', 'yearly-2026': '2026', 'yearly-2027': '2027',
    },
    crumbs: 'Horóscopos',
    switchAria: 'Escolha o período',
    skyHeading: 'O céu por trás desta leitura',
    skyIntro: 'Cada frase se apoia nestes dados, calculados para o meio-dia UTC ou para o minuto exato do evento.',
    skyRow: (fact) => (fact.kind === 'position'
      ? `${cap(planet(fact.body))}${fact.retrograde ? ` ${retro(fact.body)}` : ''} em ${sign(fact.sign)}, casa ${fact.house} · ${dateYear(fact.at)}`
      : `${eventNoun(fact)} · ${dateYear(fact.at)}, ${utc(fact.at)}`),
    moreHeading: 'Mais para o seu signo',
    signGuide: (name) => `Guia de ${name}`,
    pairs: (name) => `Compatibilidade de ${name}`,
    calculator: 'Faça seu mapa astral grátis',
    otherSigns: 'Os outros signos',
    method: 'As casas são contadas a partir do seu signo solar (casas solares de signo inteiro). Os horários estão em UTC.',
    confidence: (value) => `Confiança da leitura ${value}%`,
    confidenceNote: 'O número diz o quanto são específicos os dados em que a leitura se apoia (aqui, só o signo solar), e não a chance de algo acontecer.',
    faq: (name, surface) => [
      {
        q: `De onde vem o horóscopo de ${name}?`,
        a: 'Das posições calculadas dos planetas e da Lua para estas datas. Cada frase se apoia num dado do céu, e as casas são contadas a partir do seu signo solar.',
      },
      {
        q: surface === 'weekly' ? 'Que semana ele cobre?' : surface === 'monthly' ? 'Que mês ele cobre?' : 'Quando ele é atualizado?',
        a: surface === 'weekly'
          ? 'A semana vai de segunda a domingo, no horário UTC, e é renovada toda segunda-feira.'
          : surface === 'monthly'
            ? 'Cobre o mês do calendário em UTC; o do mês seguinte é publicado no dia 1º.'
            : 'É recalculado todos os dias com o mesmo céu usado na edição diária.',
      },
      {
        q: 'Serve se eu não sei a minha hora de nascimento?',
        a: 'Serve. Este horóscopo usa só o signo solar. Com data, hora e local de nascimento, você pode calcular o seu mapa astral completo e ver o seu ascendente.',
      },
    ],
  },
};
