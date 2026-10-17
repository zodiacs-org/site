/**
 * Copy for the translated homes (LocalizedHome.astro), one record per
 * released locale, mirroring the English homepage section by section.
 * Strings the site already publishes in a locale (the old homes, the tools
 * hub, the sharing and navigation labels, the UI catalogue) are reused as
 * written. The two extra questions of the English FAQ live in each locale
 * page, where the claims ledger reads translated answers.
 */
import { homeTrustFaq } from '../../lib/home-trust';
import type { CatalogLocale } from '../../lib/i18n';

export type HomeLocale = Exclude<CatalogLocale, 'en'>;

export interface HomeFaqItem {
  q: string;
  a: string;
  href?: string;
  link?: string;
}

interface Pillar {
  kicker: string;
  title: string;
  body: string;
  link: string;
  alt: string;
}

export interface HomeCopy {
  hero: {
    title: string;
    sub: string;
    cta: string;
    horoscope: string;
    trust: string;
    credit: string;
    pause: string;
  };
  sky: { label: string; link: string };
  today: {
    kicker: string;
    title: string;
    lede: string;
    all: string;
    note: string;
    sunHere: string;
    sunHereAria: (sign: string) => string;
  };
  sample: { kicker: string; title: string; lede: string };
  tools: {
    title: string;
    lede: string;
    together: string;
    /** The fourth pill of the light row: the eclipse table, or the sky calendar where it is not translated. */
    extra: { path: string; label: string };
    items: readonly { title: string; promise: string }[];
  };
  signs: { id: string; title: string; lede: string };
  pillars: { title: string; lede: string; learn: Pillar; calculate: Pillar; keep: Pillar };
  faq: { lead: string; link: string; trail: string };
  close: { title: string; lede: string; more: string; image: string };
  company: { before: string; after: string };
}

export const HOME_COPY: Record<HomeLocale, HomeCopy> = {
  es: {
    hero: {
      title: 'Explora las estrellas detrás de tu historia.',
      sub: 'Cartas natales, signo lunar, compatibilidad y horóscopos gratis: privados y fáciles de entender.',
      cta: 'Obtén tu carta natal gratis',
      horoscope: 'Tu horóscopo',
      trust: 'Gratis · Sin registro · Calculado en tu navegador',
      credit: 'La banda del zodiaco, del video de portada de Zodiacs',
      pause: 'Pausar animación',
    },
    sky: { label: 'El cielo ahora', link: 'El cielo de hoy' },
    today: {
      kicker: 'Tu lectura diaria',
      title: 'El cielo de hoy, signo por signo',
      lede: 'Toca tu signo solar para leer el horóscopo de hoy. No necesitas la hora de nacimiento.',
      all: 'Todos los horóscopos',
      note: 'Las lecturas se publican cada día y son para reflexionar.',
      sunHere: 'El Sol está aquí',
      sunHereAria: (sign) => `${sign}, el Sol está aquí ahora`,
    },
    sample: {
      kicker: 'Una carta real, sin escribir nada',
      title: 'Mira cómo una carta natal se convierte en una historia.',
      lede: 'Toda carta empieza con tres signos. Aquí están los de Frida Kahlo, calculados con el cielo de 1907. La tuya tarda unos veinte segundos.',
    },
    tools: {
      title: 'Empieza con tu carta',
      lede: 'Encuentra tu carta natal, signo lunar, ascendente, compatibilidad y lo que está pasando en el cielo ahora.',
      together: 'Juntos:',
      extra: { path: '/eclipses/', label: 'Eclipses hasta 2028' },
      items: [
        { title: 'Carta natal', promise: 'Tu Sol, Luna, ascendente, planetas, casas y lo que significan.' },
        { title: 'Signo lunar', promise: 'Cómo sientes, qué te calma y qué necesitas para sentirte en casa.' },
        { title: 'Ascendente', promise: 'La primera impresión que das y cómo se ordena tu carta.' },
        { title: 'Compatibilidad', promise: 'Compara dos cartas y mira dónde conectan, chocan y crecen.' },
      ],
    },
    signs: {
      id: 'signos',
      title: 'Los doce signos',
      lede: 'Guías claras para cada signo: personalidad, amor, compatibilidad y qué significa en tu carta.',
    },
    pillars: {
      title: 'Conoce tus signos. Guarda lo que importa.',
      lede: 'El sitio tiene tres partes y puedes empezar por cualquiera.',
      learn: {
        kicker: 'Aprender',
        title: 'Una guía para cada signo',
        body: 'Doce guías de signos, con su carácter, sus relaciones y lo que cada uno significa en tu carta.',
        link: 'Ver los doce signos',
        alt: 'Aguador pintado que vierte agua de un cántaro sobre una banda zodiacal oscura',
      },
      calculate: {
        kicker: 'Calcular',
        title: 'Herramientas de astrología gratis',
        body: 'Carta natal, Luna, ascendente, compatibilidad y tránsitos, calculados en privado en tu navegador.',
        link: 'Herramientas de astrología',
        alt: 'Volutas de latón labrado sobre la esfera grabada de un reloj',
      },
      keep: {
        kicker: 'Guardar',
        title: 'Cartas guardadas',
        body: 'Guarda una carta, vuelve a ella cuando quieras y ten cerca a las personas que te importan. Inicia sesión solo si quieres sincronizar.',
        link: 'Cartas guardadas',
        alt: 'Rostro solar dorado sobre una banda pintada de figuras del zodiaco',
      },
    },
    faq: { lead: '¿Te quedan dudas? Mira ', link: 'cómo calculamos las cartas', trail: '.' },
    close: {
      title: 'Empieza con tu carta natal.',
      lede: 'Fecha, hora y lugar de nacimiento. Privado en tu navegador.',
      more: 'O mira tus tres grandes en segundos',
      image: '/assets/hero/zodiacs-hero-poster.avif',
    },
    company: {
      before: 'Zodiacs.org es propiedad de ',
      after: ', una sociedad de responsabilidad limitada de Nuevo México, que también lo opera.',
    },
  },
  pt: {
    hero: {
      title: 'Explore as estrelas por trás da sua história.',
      sub: 'Mapas astrais, signo lunar, compatibilidade e horóscopos grátis: precisos, privados e fáceis de entender.',
      cta: 'Faça seu mapa astral grátis',
      horoscope: 'Seu horóscopo',
      trust: 'Grátis · Sem cadastro · Calculado no seu navegador',
      credit: 'A faixa do zodíaco, do vídeo de abertura do Zodiacs',
      pause: 'Pausar animação',
    },
    sky: { label: 'O céu agora', link: 'O céu de hoje' },
    today: {
      kicker: 'Sua leitura do dia',
      title: 'O céu de hoje, signo por signo',
      lede: 'Toque no seu signo solar para ler o horóscopo de hoje. Você não precisa da hora de nascimento.',
      all: 'Todos os horóscopos',
      note: 'As leituras são publicadas todos os dias e servem para reflexão.',
      sunHere: 'O Sol está aqui',
      sunHereAria: (sign) => `${sign}, o Sol está aqui agora`,
    },
    sample: {
      kicker: 'Um mapa real, sem digitar nada',
      title: 'Veja como um mapa astral vira uma história.',
      lede: 'Todo mapa começa com três signos. Aqui estão os de Frida Kahlo, calculados com o céu de 1907. O seu leva uns vinte segundos.',
    },
    tools: {
      title: 'Comece pelo seu mapa',
      lede: 'Descubra seu mapa astral, signo lunar, ascendente, compatibilidade e o que está acontecendo no céu agora.',
      together: 'Juntos:',
      extra: { path: '/eclipses/', label: 'Eclipses até 2028' },
      items: [
        { title: 'Mapa astral', promise: 'Seu Sol, sua Lua, seu ascendente, seus planetas, suas casas e o significado de cada um.' },
        { title: 'Signo lunar', promise: 'Como você vive as emoções, o que traz calma e do que precisa para se sentir em casa.' },
        { title: 'Ascendente', promise: 'A primeira impressão que você causa e como seu mapa se organiza.' },
        { title: 'Compatibilidade', promise: 'Compare dois mapas e veja onde vocês se conectam, entram em conflito e crescem.' },
      ],
    },
    signs: {
      id: 'signos',
      title: 'Os doze signos',
      lede: 'Guias claros de cada signo: personalidade, amor, compatibilidade e o que ele significa no seu mapa.',
    },
    pillars: {
      title: 'Conheça seus signos. Guarde o que importa.',
      lede: 'O site tem três partes, e você pode começar por qualquer uma.',
      learn: {
        kicker: 'Aprender',
        title: 'Um guia para cada signo',
        body: 'Doze guias de signos, com personalidade, relacionamentos e o que cada um significa no seu mapa.',
        link: 'Ver os doze signos',
        alt: 'Aguadeiro pintado despejando água de um jarro sobre uma faixa escura do zodíaco',
      },
      calculate: {
        kicker: 'Calcular',
        title: 'Ferramentas de astrologia grátis',
        body: 'Mapa astral, Lua, ascendente, compatibilidade e trânsitos, calculados com privacidade no seu navegador.',
        link: 'Ferramentas de astrologia',
        alt: 'Arabescos de latão trabalhado sobre o mostrador gravado de um relógio',
      },
      keep: {
        kicker: 'Guardar',
        title: 'Mapas salvos',
        body: 'Salve um mapa, volte a ele quando quiser e mantenha por perto as pessoas de quem você gosta. Entre na conta só se quiser sincronizar.',
        link: 'Mapas salvos',
        alt: 'Rosto de sol dourado sobre uma faixa pintada com figuras do zodíaco',
      },
    },
    faq: { lead: 'Ainda tem dúvidas? Veja ', link: 'como calculamos os mapas', trail: '.' },
    close: {
      title: 'Comece pelo seu mapa astral.',
      lede: 'Data, hora e local de nascimento. Com privacidade, no seu navegador.',
      more: 'Ou veja seus três signos principais em segundos',
      image: '/assets/hero/zodiacs-hero-poster.avif',
    },
    company: {
      before: 'O Zodiacs.org pertence à ',
      after: ', uma sociedade de responsabilidade limitada do Novo México, que também o opera.',
    },
  },
  fr: {
    hero: {
      title: 'Explore les étoiles derrière ton histoire.',
      sub: 'Thèmes astraux, signe lunaire, compatibilité et horoscopes gratuits : précis, confidentiels et faciles à comprendre.',
      cta: 'Obtiens ton thème astral gratuit',
      horoscope: 'Ton horoscope',
      trust: 'Gratuit · Sans inscription · Calculé dans ton navigateur',
      credit: 'La bande du zodiaque, extraite du film d’accueil de Zodiacs',
      pause: 'Mettre l’animation en pause',
    },
    sky: { label: 'Le ciel en ce moment', link: 'Le ciel du jour' },
    today: {
      kicker: 'Ta lecture du jour',
      title: 'Le ciel du jour, signe par signe',
      lede: 'Touche ton signe solaire pour lire l’horoscope du jour, sans heure de naissance. Les horoscopes quotidiens sont pour l’instant en anglais.',
      all: 'Tous les horoscopes',
      note: 'Les lectures paraissent chaque jour et sont à lire comme une invitation à réfléchir.',
      sunHere: 'Le Soleil y est',
      sunHereAria: (sign) => `${sign}, le Soleil y est en ce moment`,
    },
    sample: {
      kicker: 'Un vrai thème, sans rien saisir',
      title: 'Vois comment un thème astral devient une histoire.',
      lede: 'Tout thème commence par trois signes. Voici ceux de Frida Kahlo, calculés à partir du ciel de 1907. Le tien prend une vingtaine de secondes.',
    },
    tools: {
      title: 'Commence par ton thème',
      lede: 'Découvre ton thème astral, ton signe lunaire, ton ascendant, tes compatibilités et ce qui se passe dans le ciel maintenant.',
      together: 'À plusieurs :',
      extra: { path: '/eclipses/', label: 'Éclipses jusqu’en 2028' },
      items: [
        { title: 'Thème astral', promise: 'Ton Soleil, ta Lune, ton ascendant, tes planètes, tes maisons et leur signification.' },
        { title: 'Signe lunaire', promise: 'Ta manière de ressentir, ce qui t’apaise et ce dont tu as besoin pour te sentir chez toi.' },
        { title: 'Ascendant', promise: 'La première impression que tu donnes et la façon dont ton thème s’organise.' },
        { title: 'Compatibilité', promise: 'Compare deux thèmes : où ils s’accordent, où ils se heurtent, où ils grandissent.' },
      ],
    },
    signs: {
      id: 'signes',
      title: 'Les douze signes',
      lede: 'Des guides clairs pour chaque signe : personnalité, amour, compatibilité et signification dans ton thème.',
    },
    pillars: {
      title: 'Découvre tes signes. Garde ce qui compte.',
      lede: 'Le site a trois parties, et tu peux commencer par n’importe laquelle.',
      learn: {
        kicker: 'Apprendre',
        title: 'Un guide pour chaque signe',
        body: 'Douze guides des signes : caractère, relations et ce que chacun signifie dans ton thème.',
        link: 'Voir les douze signes',
        alt: 'Verseau peint versant l’eau d’une jarre sur une bande zodiacale sombre',
      },
      calculate: {
        kicker: 'Calculer',
        title: 'Outils d’astrologie gratuits',
        body: 'Thème astral, Lune, ascendant, compatibilité et transits, calculés en toute confidentialité dans ton navigateur.',
        link: 'Outils d’astrologie',
        alt: 'Volutes de laiton ouvragé sur le cadran gravé d’une horloge',
      },
      keep: {
        kicker: 'Garder',
        title: 'Thèmes enregistrés',
        body: 'Enregistre un thème, reviens-y quand tu veux et garde près de toi les personnes qui comptent. Connecte-toi seulement si tu veux synchroniser.',
        link: 'Thèmes enregistrés',
        alt: 'Visage solaire doré au-dessus d’une bande peinte de figures du zodiaque',
      },
    },
    faq: { lead: 'Encore des questions ? Découvre ', link: 'comment nous calculons les thèmes', trail: '.' },
    close: {
      title: 'Commence par ton thème astral.',
      lede: 'Date, heure et lieu de naissance. En toute confidentialité, dans ton navigateur.',
      more: 'Ou découvre tes trois signes principaux en quelques secondes',
      image: '/assets/hero/zodiacs-hero-poster.avif',
    },
    company: {
      before: 'Zodiacs.org appartient à ',
      after: ', société à responsabilité limitée du Nouveau-Mexique, qui l’exploite.',
    },
  },
  it: {
    hero: {
      title: 'Esplora le stelle dietro la tua storia.',
      sub: 'Temi natali, segno lunare, compatibilità e oroscopi gratuiti: precisi, riservati e facili da capire.',
      cta: 'Calcola gratis il tuo tema natale',
      horoscope: 'Il tuo oroscopo',
      trust: 'Gratis · Senza registrazione · Calcolato nel tuo browser',
      credit: 'La fascia dello zodiaco, dal video di apertura di Zodiacs',
      pause: 'Metti in pausa l’animazione',
    },
    sky: { label: 'Il cielo adesso', link: 'Il cielo di oggi' },
    today: {
      kicker: 'La tua lettura del giorno',
      title: 'Il cielo di oggi, segno per segno',
      lede: 'Tocca il tuo segno solare per leggere l’oroscopo di oggi, senza ora di nascita. Gli oroscopi quotidiani per ora sono in inglese.',
      all: 'Tutti gli oroscopi',
      note: 'Le letture escono ogni giorno e sono pensate come spunto di riflessione.',
      sunHere: 'Il Sole è qui',
      sunHereAria: (sign) => `${sign}, il Sole è qui adesso`,
    },
    sample: {
      kicker: 'Un tema vero, senza scrivere nulla',
      title: 'Guarda come un tema natale diventa una storia.',
      lede: 'Ogni tema comincia da tre segni. Ecco quelli di Frida Kahlo, calcolati sul cielo del 1907. Il tuo richiede una ventina di secondi.',
    },
    tools: {
      title: 'Inizia dal tuo tema',
      lede: 'Scopri il tuo tema natale, il segno lunare, l’ascendente, le compatibilità e ciò che accade nel cielo adesso.',
      together: 'Insieme:',
      extra: { path: '/eclipses/', label: 'Eclissi fino al 2028' },
      items: [
        { title: 'Tema natale', promise: 'Il tuo Sole, la tua Luna, l’ascendente, i pianeti, le case e il loro significato.' },
        { title: 'Segno lunare', promise: 'Come vivi le emozioni, che cosa ti calma e ciò di cui hai bisogno per sentirti a casa.' },
        { title: 'Ascendente', promise: 'La prima impressione che dai e il modo in cui si organizza il tuo tema.' },
        { title: 'Compatibilità', promise: 'Confronta due temi e scopri dove si accordano, si scontrano e crescono.' },
      ],
    },
    signs: {
      id: 'segni',
      title: 'I dodici segni',
      lede: 'Guide chiare per ogni segno: personalità, amore, compatibilità e significato nel tuo tema.',
    },
    pillars: {
      title: 'Conosci i tuoi segni. Conserva ciò che conta.',
      lede: 'Il sito ha tre parti e puoi cominciare da una qualsiasi.',
      learn: {
        kicker: 'Imparare',
        title: 'Una guida per ogni segno',
        body: 'Dodici guide ai segni: carattere, relazioni e che cosa significa ciascuno nel tuo tema.',
        link: 'Vedi i dodici segni',
        alt: 'Acquario dipinto che versa l’acqua da una brocca su una fascia zodiacale scura',
      },
      calculate: {
        kicker: 'Calcolare',
        title: 'Strumenti astrologici gratuiti',
        body: 'Tema natale, Luna, ascendente, compatibilità e transiti, calcolati in privato nel tuo browser.',
        link: 'Strumenti di astrologia',
        alt: 'Volute di ottone lavorato sul quadrante inciso di un orologio',
      },
      keep: {
        kicker: 'Conservare',
        title: 'Temi salvati',
        body: 'Salva un tema, ritrovalo quando vuoi e tieni vicine le persone a cui tieni. Accedi solo se vuoi sincronizzare.',
        link: 'Temi salvati',
        alt: 'Volto solare dorato sopra una fascia dipinta di figure dello zodiaco',
      },
    },
    faq: { lead: 'Altre domande? Scopri ', link: 'come calcoliamo i temi', trail: '.' },
    close: {
      title: 'Inizia dal tuo tema natale.',
      lede: 'Data, ora e luogo di nascita. In privato, nel tuo browser.',
      more: 'Oppure scopri i tuoi tre segni principali in pochi secondi',
      image: '/assets/hero/zodiacs-hero-poster.avif',
    },
    company: {
      before: 'Zodiacs.org è di proprietà di ',
      after: ', società a responsabilità limitata del New Mexico, che lo gestisce.',
    },
  },
  ru: {
    hero: {
      title: 'Узнайте, какие звёзды стоят за вашей историей.',
      sub: 'Бесплатные натальные карты, совместимость и гиды по знакам. Всё считается приватно в вашем браузере и объясняется простым языком.',
      cta: 'Постройте бесплатную натальную карту',
      horoscope: 'Гороскопы',
      trust: 'Бесплатно · Без регистрации · Расчёт в вашем браузере',
      credit: 'Пояс зодиака, кадр из вступительного видео Zodiacs',
      pause: 'Приостановить анимацию',
    },
    sky: { label: 'Небо сейчас', link: 'Небо сегодня' },
    today: {
      kicker: 'Гороскоп на сегодня',
      title: 'Сегодняшнее небо по знакам',
      lede: 'Выберите свой солнечный знак, чтобы прочитать гороскоп на сегодня. Время рождения не нужно. Ежедневные гороскопы пока выходят только по-английски.',
      all: 'Все гороскопы',
      note: 'Гороскопы выходят каждый день, читайте их как повод поразмышлять.',
      sunHere: 'Солнце здесь',
      sunHereAria: (sign) => `${sign}: сейчас здесь Солнце`,
    },
    sample: {
      kicker: 'Настоящая карта, вводить ничего не нужно',
      title: 'Посмотрите, как натальная карта становится историей.',
      lede: 'Любая карта начинается с трёх знаков. Вот знаки Фриды Кало, рассчитанные по небу 1907 года. Ваша карта строится примерно за двадцать секунд.',
    },
    tools: {
      title: 'Начните со своей карты',
      lede: 'Постройте натальную карту, узнайте лунный знак, асцендент и совместимость, а затем посмотрите на сегодняшнее небо.',
      together: 'Вместе:',
      extra: { path: '/sky-calendar/', label: 'Календарь неба' },
      items: [
        { title: 'Натальная карта', promise: 'Солнце, Луна, асцендент, планеты, дома и их значение.' },
        { title: 'Лунный знак', promise: 'Как вы чувствуете, что вас успокаивает и что даёт ощущение дома.' },
        { title: 'Асцендент', promise: 'Первое впечатление и то, как выстроена вся карта.' },
        { title: 'Совместимость', promise: 'Сравните две карты: где они сходятся, где спорят и где помогают друг другу расти.' },
      ],
    },
    signs: {
      id: 'signs',
      title: 'Двенадцать знаков',
      lede: 'Ясные гиды по каждому знаку: характер, отношения, совместимость и его роль в вашей карте.',
    },
    pillars: {
      title: 'Узнайте свои знаки. Сохраните важное.',
      lede: 'На сайте три раздела, и начать можно с любого.',
      learn: {
        kicker: 'Изучить',
        title: 'Гид по каждому знаку',
        body: 'Двенадцать гидов по знакам: характер, отношения и то, что каждый знак значит в вашей карте.',
        link: 'Все двенадцать знаков',
        alt: 'Расписной Водолей льёт воду из кувшина на тёмном зодиакальном поясе',
      },
      calculate: {
        kicker: 'Рассчитать',
        title: 'Бесплатные инструменты',
        body: 'Натальная карта, Луна, асцендент, совместимость и транзиты, рассчитанные приватно в вашем браузере.',
        link: 'Астрологические инструменты',
        alt: 'Узорные латунные завитки над гравированным циферблатом часов',
      },
      keep: {
        kicker: 'Сохранить',
        title: 'Сохранённые карты',
        body: 'Сохраните карту, возвращайтесь к ней и держите рядом карты близких. Входить в аккаунт нужно, только если хотите синхронизацию.',
        link: 'Сохранённые карты',
        alt: 'Позолоченный лик солнца над расписным поясом зодиакальных фигур',
      },
    },
    faq: { lead: 'Остались вопросы? Посмотрите, ', link: 'как мы рассчитываем карты', trail: '.' },
    close: {
      title: 'Начните со своей натальной карты.',
      lede: 'Дата, время и место рождения. Приватно, в вашем браузере.',
      more: 'Или узнайте свою большую тройку за несколько секунд',
      image: '/assets/hero/zodiacs-hero-poster-ru.avif',
    },
    company: {
      before: 'Zodiacs.org принадлежит компании ',
      after: ' (общество с ограниченной ответственностью, штат Нью-Мексико), которая им и управляет.',
    },
  },
};

/** The English homepage's order: the two trust questions, then the page's own. */
export function localizedHomeFaq(locale: HomeLocale, extra: readonly HomeFaqItem[]): HomeFaqItem[] {
  return [...homeTrustFaq(locale), ...extra];
}

/** FAQPage structured data for exactly the questions the page shows. */
export function localizedHomeFaqSchema(faq: readonly HomeFaqItem[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}
