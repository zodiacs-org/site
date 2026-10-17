/**
 * The words of the personal sky calendar, in the six catalog languages.
 * Engine-free: the events are written on the main thread from dates the
 * worker found. English transit descriptions are the site's own transitLine.
 */
import type { CatalogLocale } from '../i18n/core';
import type { MilestoneKind } from '../occasions/milestones';

export type PersonalPlanet = 'Saturn' | 'Uranus' | 'Neptune' | 'Pluto';
export type PersonalAspect = 'conjunction' | 'square' | 'trine' | 'opposition';
export type PersonalPoint = 'Sun' | 'Moon';

export interface PersonalWords {
  calendarName: string;
  solarTitle: string;
  /** {position}: the natal Sun, e.g. 14°22′ Leo. */
  solarAbout: string;
  /** {time}: YYYY-MM-DD HH:MM. */
  exactAt: string;
  slowNote: string;
  pass: string;
  unknownTime: string;
  more: string;
  note: string;
  milestones: Record<MilestoneKind, { name: string; about: string }>;
  planets: Record<PersonalPlanet, string>;
  /** Title per aspect and natal point; {planet} is the transiting planet. */
  titles: Record<PersonalAspect, Record<PersonalPoint, string>>;
  movers: Record<PersonalPlanet, string>;
  aspects: Record<PersonalAspect, string>;
  points: Record<PersonalPoint, string>;
}

export const PERSONAL_WORDS: Readonly<Record<CatalogLocale, PersonalWords>> = {
  en: {
    calendarName: 'Zodiacs.org · Your sky',
    solarTitle: 'Your solar return',
    solarAbout: 'The Sun comes back to {position}, where it was when you were born. Astrologers read the chart for this moment as the shape of the year ahead.',
    exactAt: 'Exact at {time} UTC.',
    slowNote: 'A slow planet stays near this point for weeks on either side of the exact date.',
    pass: 'Pass {pass} of {count}.',
    unknownTime: 'Birth time unknown: the chart is set for noon at your birthplace, so this date is approximate.',
    more: 'More: {url}',
    note: 'Dates are computed; what they mean is astrology’s forecast, not a guarantee.',
    milestones: {
      'jupiter-return': { name: 'Jupiter return', about: 'Jupiter is back where it was when you were born, about every twelve years. Astrologers read it as the start of a new twelve-year round.' },
      'saturn-return': { name: 'Saturn return', about: 'Saturn is back where it was at your birth, at about 29, 58 and 88. The oldest milestone in astrology: a time to take stock and build what lasts.' },
      'uranus-opposition': { name: 'Uranus opposition', about: 'Uranus stands opposite its place at your birth, around 40 to 42. Astrologers connect it with the midlife wish to do something differently.' },
    },
    planets: { Saturn: 'Saturn', Uranus: 'Uranus', Neptune: 'Neptune', Pluto: 'Pluto' },
    titles: {
      conjunction: { Sun: '{planet} meets your Sun', Moon: '{planet} meets your Moon' },
      square: { Sun: '{planet} squares your Sun', Moon: '{planet} squares your Moon' },
      trine: { Sun: '{planet} trines your Sun', Moon: '{planet} trines your Moon' },
      opposition: { Sun: '{planet} opposes your Sun', Moon: '{planet} opposes your Moon' },
    },
    // English descriptions use transitLine; these serve the other parts.
    movers: { Saturn: '', Uranus: '', Neptune: '', Pluto: '' },
    aspects: { conjunction: '', square: '', trine: '', opposition: '' },
    points: { Sun: '', Moon: '' },
  },
  es: {
    calendarName: 'Zodiacs.org · Tu cielo',
    solarTitle: 'Tu retorno solar',
    solarAbout: 'El Sol vuelve a {position}, donde estaba cuando naciste. Los astrólogos leen la carta de este momento como la forma del año que empieza.',
    exactAt: 'Exacto a las {time} UTC.',
    slowNote: 'Un planeta lento se queda cerca de este punto varias semanas antes y después de la fecha exacta.',
    pass: 'Paso {pass} de {count}.',
    unknownTime: 'Hora de nacimiento desconocida: la carta se calcula para el mediodía en tu lugar de nacimiento, así que esta fecha es aproximada.',
    more: 'Más: {url}',
    note: 'Las fechas están calculadas; lo que significan es el pronóstico de la astrología, no una garantía.',
    milestones: {
      'jupiter-return': { name: 'Retorno de Júpiter', about: 'Júpiter vuelve a donde estaba cuando naciste, más o menos cada doce años. Los astrólogos lo leen como el comienzo de una nueva vuelta de doce años.' },
      'saturn-return': { name: 'Retorno de Saturno', about: 'Saturno vuelve a donde estaba al nacer, hacia los 29, los 58 y los 88 años. El hito más antiguo de la astrología: un momento para hacer balance y construir lo que dura.' },
      'uranus-opposition': { name: 'Oposición de Urano', about: 'Urano se sitúa frente a su lugar natal, entre los 40 y los 42 años. Los astrólogos lo relacionan con el deseo de mitad de la vida de hacer algo distinto.' },
    },
    planets: { Saturn: 'Saturno', Uranus: 'Urano', Neptune: 'Neptuno', Pluto: 'Plutón' },
    titles: {
      conjunction: { Sun: '{planet} se une a tu Sol', Moon: '{planet} se une a tu Luna' },
      square: { Sun: '{planet} en cuadratura con tu Sol', Moon: '{planet} en cuadratura con tu Luna' },
      trine: { Sun: '{planet} en trígono con tu Sol', Moon: '{planet} en trígono con tu Luna' },
      opposition: { Sun: '{planet} en oposición a tu Sol', Moon: '{planet} en oposición a tu Luna' },
    },
    movers: {
      Saturn: 'Saturno trae una larga temporada de presión y de rendir cuentas.',
      Uranus: 'Urano trae una sacudida que se repite durante meses.',
      Neptune: 'Neptuno trae una niebla lenta de anhelo y contornos borrosos.',
      Pluto: 'Plutón trae una excavación que dura años.',
    },
    aspects: {
      conjunction: 'En conjunción se posa sobre ese punto y durante un tiempo lo tiñe todo.',
      square: 'La cuadratura es una fricción que no se resuelve sola.',
      trine: 'El trígono es una ayuda que llega sin pedirla.',
      opposition: 'La oposición es una tensión que conviene enfrentar de cara en lugar de absorberla.',
    },
    points: { Sun: 'Tu Sol habla de tu sentido de ti.', Moon: 'Tu Luna habla de tu vida emocional.' },
  },
  pt: {
    calendarName: 'Zodiacs.org · Seu céu',
    solarTitle: 'Sua revolução solar',
    solarAbout: 'O Sol volta a {position}, onde estava quando você nasceu. Os astrólogos leem o mapa deste momento como o formato do ano que começa.',
    exactAt: 'Exato às {time} UTC.',
    slowNote: 'Um planeta lento fica perto deste ponto por semanas antes e depois da data exata.',
    pass: 'Passagem {pass} de {count}.',
    unknownTime: 'Hora de nascimento desconhecida: o mapa é calculado para o meio-dia no seu local de nascimento, então esta data é aproximada.',
    more: 'Mais: {url}',
    note: 'As datas são calculadas; o que significam é a previsão da astrologia, não uma garantia.',
    milestones: {
      'jupiter-return': { name: 'Retorno de Júpiter', about: 'Júpiter volta para onde estava quando você nasceu, mais ou menos a cada doze anos. Os astrólogos o leem como o início de um novo ciclo de doze anos.' },
      'saturn-return': { name: 'Retorno de Saturno', about: 'Saturno volta para onde estava no seu nascimento, por volta dos 29, 58 e 88 anos. O marco mais antigo da astrologia: hora de fazer um balanço e construir o que dura.' },
      'uranus-opposition': { name: 'Oposição de Urano', about: 'Urano fica oposto ao seu lugar de nascimento, por volta dos 40 aos 42 anos. Os astrólogos o ligam ao desejo, no meio da vida, de fazer algo diferente.' },
    },
    planets: { Saturn: 'Saturno', Uranus: 'Urano', Neptune: 'Netuno', Pluto: 'Plutão' },
    titles: {
      conjunction: { Sun: '{planet} encontra seu Sol', Moon: '{planet} encontra sua Lua' },
      square: { Sun: '{planet} em quadratura com seu Sol', Moon: '{planet} em quadratura com sua Lua' },
      trine: { Sun: '{planet} em trígono com seu Sol', Moon: '{planet} em trígono com sua Lua' },
      opposition: { Sun: '{planet} em oposição ao seu Sol', Moon: '{planet} em oposição à sua Lua' },
    },
    movers: {
      Saturn: 'Saturno traz uma longa temporada de pressão e de prestação de contas.',
      Uranus: 'Urano traz um solavanco que se repete por meses.',
      Neptune: 'Netuno traz uma névoa lenta de saudade e contornos borrados.',
      Pluto: 'Plutão traz uma escavação que dura anos.',
    },
    aspects: {
      conjunction: 'Em conjunção, ele pousa sobre esse ponto e por um tempo dá cor a tudo ali.',
      square: 'A quadratura é um atrito que não se resolve sozinho.',
      trine: 'O trígono é uma ajuda que chega sem ser pedida.',
      opposition: 'A oposição é uma tensão que vale encarar de frente em vez de absorver.',
    },
    points: { Sun: 'Seu Sol fala do seu senso de si.', Moon: 'Sua Lua fala da sua vida emocional.' },
  },
  fr: {
    calendarName: 'Zodiacs.org · Ton ciel',
    solarTitle: 'Ta révolution solaire',
    solarAbout: 'Le Soleil revient à {position}, là où il était à ta naissance. Les astrologues lisent le thème de ce moment comme la forme de l’année qui commence.',
    exactAt: 'Exact à {time} UTC.',
    slowNote: 'Une planète lente reste près de ce point des semaines avant et après la date exacte.',
    pass: 'Passage {pass} sur {count}.',
    unknownTime: 'Heure de naissance inconnue : le thème est calculé pour midi à ton lieu de naissance, donc cette date est approximative.',
    more: 'Plus : {url}',
    note: 'Les dates sont calculées ; ce qu’elles signifient relève de la prévision astrologique, pas d’une garantie.',
    milestones: {
      'jupiter-return': { name: 'Retour de Jupiter', about: 'Jupiter revient là où il était à ta naissance, environ tous les douze ans. Les astrologues y voient le début d’un nouveau cycle de douze ans.' },
      'saturn-return': { name: 'Retour de Saturne', about: 'Saturne revient là où il était à ta naissance, vers 29, 58 et 88 ans. Le plus ancien jalon de l’astrologie : le moment de faire le point et de bâtir ce qui dure.' },
      'uranus-opposition': { name: 'Opposition d’Uranus', about: 'Uranus se tient face à sa place de naissance, vers 40 à 42 ans. Les astrologues l’associent à l’envie, au milieu de la vie, de faire autrement.' },
    },
    planets: { Saturn: 'Saturne', Uranus: 'Uranus', Neptune: 'Neptune', Pluto: 'Pluton' },
    titles: {
      conjunction: { Sun: '{planet} rejoint ton Soleil', Moon: '{planet} rejoint ta Lune' },
      square: { Sun: '{planet} au carré de ton Soleil', Moon: '{planet} au carré de ta Lune' },
      trine: { Sun: '{planet} en trigone à ton Soleil', Moon: '{planet} en trigone à ta Lune' },
      opposition: { Sun: '{planet} en opposition à ton Soleil', Moon: '{planet} en opposition à ta Lune' },
    },
    movers: {
      Saturn: 'Saturne apporte une longue saison de pression et de comptes à rendre.',
      Uranus: 'Uranus apporte une secousse qui se répète pendant des mois.',
      Neptune: 'Neptune apporte un brouillard lent de désir et de flou.',
      Pluto: 'Pluton apporte une fouille qui dure des années.',
    },
    aspects: {
      conjunction: 'En conjonction, il se pose sur ce point et, pendant un temps, colore tout ce qui s’y trouve.',
      square: 'Le carré est une friction qui ne se résout pas d’elle-même.',
      trine: 'Le trigone est une aide qui arrive sans qu’on la demande.',
      opposition: 'L’opposition est une tension à affronter de face plutôt qu’à encaisser.',
    },
    points: { Sun: 'Ton Soleil parle de ton sens de toi-même.', Moon: 'Ta Lune parle de ta vie émotionnelle.' },
  },
  it: {
    calendarName: 'Zodiacs.org · Il tuo cielo',
    solarTitle: 'La tua rivoluzione solare',
    solarAbout: 'Il Sole torna a {position}, dove si trovava quando sei nato. Gli astrologi leggono il tema di questo momento come la forma dell’anno che comincia.',
    exactAt: 'Esatto alle {time} UTC.',
    slowNote: 'Un pianeta lento resta vicino a questo punto per settimane prima e dopo la data esatta.',
    pass: 'Passaggio {pass} di {count}.',
    unknownTime: 'Ora di nascita sconosciuta: il tema è calcolato per mezzogiorno nel tuo luogo di nascita, quindi questa data è approssimativa.',
    more: 'Altro: {url}',
    note: 'Le date sono calcolate; il loro significato è la previsione dell’astrologia, non una garanzia.',
    milestones: {
      'jupiter-return': { name: 'Ritorno di Giove', about: 'Giove torna dove si trovava alla tua nascita, all’incirca ogni dodici anni. Gli astrologi lo leggono come l’inizio di un nuovo giro di dodici anni.' },
      'saturn-return': { name: 'Ritorno di Saturno', about: 'Saturno torna dove si trovava alla tua nascita, verso i 29, i 58 e gli 88 anni. La tappa più antica dell’astrologia: il momento di fare il punto e costruire ciò che dura.' },
      'uranus-opposition': { name: 'Opposizione di Urano', about: 'Urano si trova opposto alla sua posizione natale, tra i 40 e i 42 anni. Gli astrologi lo collegano al desiderio, a metà della vita, di fare qualcosa di diverso.' },
    },
    planets: { Saturn: 'Saturno', Uranus: 'Urano', Neptune: 'Nettuno', Pluto: 'Plutone' },
    titles: {
      conjunction: { Sun: '{planet} incontra il tuo Sole', Moon: '{planet} incontra la tua Luna' },
      square: { Sun: '{planet} in quadratura al tuo Sole', Moon: '{planet} in quadratura alla tua Luna' },
      trine: { Sun: '{planet} in trigono al tuo Sole', Moon: '{planet} in trigono alla tua Luna' },
      opposition: { Sun: '{planet} in opposizione al tuo Sole', Moon: '{planet} in opposizione alla tua Luna' },
    },
    movers: {
      Saturn: 'Saturno porta una lunga stagione di pressione e di resa dei conti.',
      Uranus: 'Urano porta uno scossone che si ripete per mesi.',
      Neptune: 'Nettuno porta una nebbia lenta di desiderio e contorni sfumati.',
      Pluto: 'Plutone porta uno scavo che dura anni.',
    },
    aspects: {
      conjunction: 'In congiunzione si posa su quel punto e per un po’ colora tutto ciò che vi si trova.',
      square: 'La quadratura è un attrito che non si risolve da solo.',
      trine: 'Il trigono è un aiuto che arriva senza chiederlo.',
      opposition: 'L’opposizione è una tensione da affrontare di petto invece che da assorbire.',
    },
    points: { Sun: 'Il tuo Sole parla del tuo senso di te.', Moon: 'La tua Luna parla della tua vita emotiva.' },
  },
  ru: {
    calendarName: 'Zodiacs.org · Ваше небо',
    solarTitle: 'Ваш солярный возврат',
    solarAbout: 'Солнце возвращается в {position}, где оно было в момент вашего рождения. Астрологи читают карту этого момента как очертания наступающего года.',
    exactAt: 'Точно в {time} UTC.',
    slowNote: 'Медленная планета остаётся рядом с этой точкой несколько недель до и после точной даты.',
    pass: 'Прохождение {pass} из {count}.',
    unknownTime: 'Время рождения неизвестно: карта рассчитана на полдень в месте рождения, поэтому дата приблизительная.',
    more: 'Подробнее: {url}',
    note: 'Даты рассчитаны; их значение — астрологический прогноз, а не гарантия.',
    milestones: {
      'jupiter-return': { name: 'Возвращение Юпитера', about: 'Юпитер возвращается туда, где был в момент вашего рождения, примерно раз в двенадцать лет. Астрологи считают это началом нового двенадцатилетнего круга.' },
      'saturn-return': { name: 'Возвращение Сатурна', about: 'Сатурн возвращается туда, где был при вашем рождении, примерно в 29, 58 и 88 лет. Самая старая веха астрологии: время подвести итоги и строить то, что останется.' },
      'uranus-opposition': { name: 'Оппозиция Урана', about: 'Уран встаёт напротив своего места в вашей карте примерно в возрасте от 40 до 42 лет. Астрологи связывают это с желанием в середине жизни сделать что-то по-другому.' },
    },
    planets: { Saturn: 'Сатурн', Uranus: 'Уран', Neptune: 'Нептун', Pluto: 'Плутон' },
    titles: {
      conjunction: { Sun: '{planet} соединяется с вашим Солнцем', Moon: '{planet} соединяется с вашей Луной' },
      square: { Sun: '{planet} в квадрате к вашему Солнцу', Moon: '{planet} в квадрате к вашей Луне' },
      trine: { Sun: '{planet} в трине к вашему Солнцу', Moon: '{planet} в трине к вашей Луне' },
      opposition: { Sun: '{planet} в оппозиции к вашему Солнцу', Moon: '{planet} в оппозиции к вашей Луне' },
    },
    movers: {
      Saturn: 'Сатурн приносит долгий период давления и подведения счетов.',
      Uranus: 'Уран приносит встряску, которая повторяется месяцами.',
      Neptune: 'Нептун приносит медленный туман тоски и размытых очертаний.',
      Pluto: 'Плутон приносит раскопки длиной в годы.',
    },
    aspects: {
      conjunction: 'В соединении он ложится на эту точку и на время окрашивает всё, что с ней связано.',
      square: 'Квадрат — трение, которое само не разрешится.',
      trine: 'Трин — помощь, которая приходит без просьбы.',
      opposition: 'Оппозиция — напряжение, которое лучше встретить лицом к лицу, чем терпеть.',
    },
    points: { Sun: 'Ваше Солнце говорит о вашем ощущении себя.', Moon: 'Ваша Луна говорит о вашей эмоциональной жизни.' },
  },
};

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (token, name: string) => Object.hasOwn(values, name) ? String(values[name]) : token);
}
