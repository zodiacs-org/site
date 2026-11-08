/**
 * Horoscopes par période en français : demain, semaine, mois, amour, travail
 * et année. Écrit en français à partir des faits (./types.ts), sans traduire
 * l’anglais ni l’espagnol. Registre : tutoiement, phrases simples, ton posé ;
 * aucune promesse sur la santé, l’argent ou le destin. Aucun tiret long.
 * Typographie : apostrophe typographique, espace simple avant « : ; ? ! % »,
 * comme le reste du français du site (src/lib/seasons/copy-fr.ts).
 */
import { SIGNS, signBySlug, signName } from '../../signs';
import { aspectLabel, planetLabel } from '../../i18n/astrology';
import { cap, dayMonth, dayMonthYear, monthName, monthYear, pick, utcClock, weekday } from './format';
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

const L = 'fr' as const;
const SIGN_ORDER = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const idx = (slug: string) => SIGN_ORDER.indexOf(slug);

const sign = (slug: string) => signName(signBySlug(slug), L);
const planet = (body: string) => planetLabel(L, body);
/** Le Soleil et la Lune prennent l’article ; les planètes, non. */
const subject = (body: string) => (body === 'Sun' ? 'le Soleil' : body === 'Moon' ? 'la Lune' : planet(body));

/** L’article de chaque signe : le Bélier, la Vierge, les Gémeaux. */
const ARTICLE: Record<string, 'le' | 'la' | 'les'> = {
  aries: 'le', taurus: 'le', gemini: 'les', cancer: 'le', leo: 'le', virgo: 'la',
  libra: 'la', scorpio: 'le', sagittarius: 'le', capricorn: 'le', aquarius: 'le', pisces: 'les',
};
const SLUG_BY_NAME = new Map(SIGNS.map((entry) => [signName(entry, L), entry.slug]));
/** Le slug d’un signe donné par son slug ou par son nom affiché ; undefined pour un nom inconnu. */
const slugOf = (key: string) => (ARTICLE[key] ? key : SLUG_BY_NAME.get(key));
/** Élision devant une voyelle ou un h : "d’Aries", "de Leo". */
const deName = (name: string) => (/^[aeiouyhâàéèêîôûAEIOUYHÂÀÉÈÊÎÔÛ]/u.test(name) ? `d’${name}` : `de ${name}`);
/** "le Bélier", "la Vierge", "les Gémeaux", à partir du slug ou du nom ; un nom inconnu reste tel quel. */
export const the = (key: string) => {
  const slug = slugOf(key);
  return slug ? `${ARTICLE[slug]} ${sign(slug)}` : key;
};
const The = (key: string) => cap(the(key));
/** "du Bélier", "de la Vierge", "des Gémeaux" ; "de Leo" pour un nom inconnu. */
export const of = (key: string) => {
  const slug = slugOf(key);
  return slug ? `${({ le: 'du', la: 'de la', les: 'des' } as const)[ARTICLE[slug]]} ${sign(slug)}` : deName(key);
};

/** "9 novembre", avec "1er" pour le premier du mois, comme l’écrit le français. */
const firstDay = (text: string) => text.replace(/^1 /, '1er ');
const date = (at: string) => firstDay(dayMonth(L, at));
const dateYear = (at: string) => firstDay(dayMonthYear(L, at));
const dayNum = (at: string) => (Number(at.slice(8, 10)) === 1 ? '1er' : String(Number(at.slice(8, 10))));
/** "du 2 au 8 novembre", ou "du 30 novembre au 6 décembre". */
const range = (from: string, through: string) => (from.slice(0, 7) === through.slice(0, 7)
  ? `du ${dayNum(from)} au ${date(through)}`
  : `du ${date(from)} au ${date(through)}`);

/**
 * Contractions et élisions obligatoires : "de le" devient "du", "à les"
 * devient "aux", "de" devant une voyelle devient "d’". Les gabarits ci-dessous
 * n’emploient jamais "le" ou "les" comme pronoms après "de" ou "à".
 */
const tidy = (text: string) => text
  .replace(/(?<!\p{L})à le (?=\p{L})/gu, 'au ')
  .replace(/(?<!\p{L})à les (?=\p{L})/gu, 'aux ')
  .replace(/(?<!\p{L})de le (?=\p{L})/gu, 'du ')
  .replace(/(?<!\p{L})de les (?=\p{L})/gu, 'des ')
  .replace(/(?<!\p{L})([Dd])e (?=[aeiouyéèêàâîôûAEIOUYÉÈÊÀÂÎÔÛ])/gu, '$1’')
  .replace(/(?<!\p{L})([Qq])ue (?=[aeiouéèêAEIOUÉÈÊ])/gu, '$1u’')
  .replace(/\s+/g, ' ')
  .trim();

const ORDINAL = ['', 'première', 'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième', 'septième', 'huitième', 'neuvième', 'dixième', 'onzième', 'douzième'];

/** Ce que chaque maison solaire met sur la table, élément par élément, avec l’article. */
const THEME_PARTS: Record<number, string[]> = {
  1: ['ton image', 'tes débuts', 'ta façon de te présenter'],
  2: ['l’argent', 'ce que tu possèdes', 'ce qui te rassure'],
  3: ['les échanges', 'les démarches', 'ton entourage proche'],
  4: ['le foyer', 'la famille', 'ta vie privée'],
  5: ['le plaisir', 'les amours', 'ce que tu crées par goût'],
  6: ['le travail quotidien', 'les habitudes', 'l’organisation'],
  7: ['le couple', 'les accords d’égal à égal'],
  8: ['les ressources partagées', 'les dettes', 'la confiance intime'],
  9: ['les voyages', 'les études', 'tes convictions'],
  10: ['la carrière', 'la réputation', 'ce que l’on voit de toi'],
  11: ['les amitiés', 'les groupes', 'tes projets d’avenir'],
  12: ['le repos', 'le retrait', 'ce qui travaille en silence'],
};
const joinAnd = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} et ${items.at(-1)}` : items.join(''));
/** "le repos, le retrait et ce qui travaille en silence" */
export const THEME: Record<number, string> = Object.fromEntries(
  Object.entries(THEME_PARTS).map(([house, parts]) => [house, joinAnd(parts)]),
);
/** "du repos, du retrait et de ce qui travaille en silence": le français répète la préposition. */
const deTheme = (house: number) => joinAnd(THEME_PARTS[house].map((part) => `de ${part}`));
/** "au repos, au retrait et à ce qui travaille en silence" */
const aTheme = (house: number) => joinAnd(THEME_PARTS[house].map((part) => `à ${part}`));

/** Titres courts pour les intertitres de l’année. */
const SHORT: Record<number, string> = {
  1: 'Image et nouveaux départs',
  2: 'Argent et priorités',
  3: 'Échanges et entourage',
  4: 'Foyer et famille',
  5: 'Plaisir et créativité',
  6: 'Quotidien et organisation',
  7: 'Couple et accords',
  8: 'Ressources partagées et intimité',
  9: 'Études et horizons',
  10: 'Carrière et réputation',
  11: 'Amitiés et projets',
  12: 'Repos et retrait',
};

/** Un premier geste concret par maison. */
const ADVICE: Record<number, string> = {
  1: 'Dis ce que tu veux lancer avant de réagir à ce que proposent les autres.',
  2: 'Mets des chiffres sur ce que cela coûte, sur ce que tu as et sur ce que tu attends.',
  3: 'Réponds au message en attente et mets par écrit ce qui a été convenu.',
  4: 'Regarde ce dont tu as besoin chez toi et réserve-lui du temps avant d’accepter autre chose.',
  5: 'Accorde-toi un moment pour une activité faite par plaisir, sans viser de résultat.',
  6: 'Reprends la liste du jour et retires-en une tâche qui ne te revient pas.',
  7: 'Parle clairement à l’autre et pose la question au lieu de supposer.',
  8: 'Fais la part entre ce qui est à toi, ce qui est commun et ce qui est dû.',
  9: 'Lis, renseigne-toi ou prépare un déplacement : de quoi sortir de tes habitudes de pensée.',
  10: 'Termine ce que d’autres vont voir, et fais savoir qui l’a fait.',
  11: 'Écris à cet ami ou à ce groupe et fixe une date.',
  12: 'Garde une heure sans écran et laisse la journée ralentir.',
};

/** Un second regard sur la même maison, pour ne pas répéter le conseil. */
const REFINE: Record<number, string> = {
  1: 'Un petit changement dans ta façon de te présenter en dit plus qu’une grande annonce.',
  2: 'Avant de dépenser, demande-toi si l’achat aura encore du sens dans une semaine.',
  3: 'Relis ce que tu envoies : un mot mal placé peut coûter un après-midi.',
  4: 'Répare une chose précise à la maison plutôt que de planifier de grands travaux.',
  5: 'Laisse le jeu rester un jeu : tout n’a pas à devenir un projet.',
  6: 'Regarde une habitude devenue automatique et décide si tu veux la garder.',
  7: 'Un accord juste se reconnaît à ce que chacun sait ce qui lui revient.',
  8: 'Une conversation un peu inconfortable sur l’argent ou la confiance évite bien des soupçons.',
  9: 'Une idée nouvelle prend de la valeur quand tu la mets à l’épreuve dans du concret.',
  10: 'Choisis un objectif visible et mesure tes progrès sur des faits, pas sur des impressions.',
  11: 'Regarde quels groupes t’apportent vraiment quelque chose et lesquels tu suis par habitude.',
  12: 'Bien dormir et refermer des dossiers en suspens, c’est aussi avancer.',
};

/** L’angle affectif de chaque maison. */
const LOVE: Record<number, string> = {
  1: 'Reste toi-même, sans mise en scène : c’est le naturel qui touche en ce moment.',
  2: 'L’affection se voit dans le concret : une attention, un coup de main, du temps donné.',
  3: 'Une conversation toute simple vaut mieux qu’un grand geste.',
  4: 'Le calme à la maison sert de socle : prends soin de l’espace que vous partagez.',
  5: 'L’envie de profiter est là : propose un moment qui vous fasse rire.',
  6: 'L’amour passe aussi par le quotidien : partager les tâches sans tenir les comptes.',
  7: 'Le couple demande un rapport d’égal à égal : écoute avant de répondre.',
  8: 'La confiance grandit quand tu parles de ce qui compte vraiment pour toi.',
  9: 'Ouvre la relation à du nouveau : un lieu, une idée, un sujet inhabituel.',
  10: 'Veille à ce que le travail ne prenne pas toute la place qui revient à l’autre.',
  11: 'L’amitié fait partie de l’amour en ce moment : les sorties à plusieurs aident.',
  12: 'Certaines choses se disent mieux en tête-à-tête, sans se presser.',
};

/** L’angle professionnel de chaque maison. */
const WORK: Record<number, string> = {
  1: 'Prends l’initiative sur une tâche qui porte ton nom.',
  2: 'Revois revenus, tarifs ou budgets avec des chiffres précis.',
  3: 'Mails, appels et démarches demandent de l’ordre et des réponses rapides.',
  4: 'Organise l’endroit où tu travailles pour qu’il ne te vide pas de ton énergie.',
  5: 'Un projet créatif ou une proposition personnelle mérite ta meilleure heure.',
  6: 'Mets de l’ordre dans les méthodes et les délais : la régularité porte plus loin qu’un coup de collier.',
  7: 'Négocie clairement avec associés, clients et partenaires.',
  8: 'Regarde les dettes, les ressources communes et ce qui dépend des autres.',
  9: 'Te former, publier ou viser un nouveau public paie sur la durée.',
  10: 'Ta réputation se joue sur ce que tu livres : termine d’abord ce qui se voit le plus.',
  11: 'Les contacts et le travail d’équipe ouvrent des portes.',
  12: 'Avance sur ce qui ne se voit pas encore, sans attendre d’applaudissements trop tôt.',
};

/** Ce qui réussit le mieux à chaque signe, en une phrase. */
const KEY: Record<string, string> = {
  aries: `${The('aries')} gagne à faire un premier pas net plutôt qu’à courir dans tous les sens.`,
  taurus: `${The('taurus')} avance mieux à son rythme, sans céder ce qui le rassure vraiment.`,
  gemini: `Pour ${the('gemini')}, la clarté vient d’une seule conversation, choisie et menée jusqu’au bout.`,
  cancer: `Pour ${the('cancer')}, prendre soin des autres ne veut pas dire tout porter : tes propres besoins comptent aussi.`,
  leo: `${The('leo')} rayonne davantage quand le fond est prêt avant la mise en scène.`,
  virgo: `${The('virgo')} n’a pas besoin de tout corriger : une seule chose bien faite suffit.`,
  libra: `Pour ${the('libra')}, l’équilibre arrive quand tu dis ce que tu préfères au lieu de deviner ce que veulent les autres.`,
  scorpio: `La force ${of('scorpio')}, c’est de savoir quoi garder et quoi lâcher, sans drame.`,
  sagittarius: `${The('sagittarius')} tire plus d’une direction claire que de dix pistes ouvertes.`,
  capricorn: `Pour ${the('capricorn')}, le progrès se mesure en pas que l’on peut tenir.`,
  aquarius: `Pour ${the('aquarius')}, une idée prend sa valeur quand elle trouve un endroit concret où s’appliquer.`,
  pisces: `Pour ${the('pisces')}, des limites claires protègent la sensibilité au lieu de l’éteindre.`,
};

/** Le fil de chaque signe pour l’année. */
const YEAR: Record<string, string> = {
  aries: 'Cette année récompense l’élan qui dure : commencer te vient facilement, c’est finir qui compte.',
  taurus: 'Cette année te demande de revoir ce qui te donne vraiment de la sécurité et de lâcher ce qui n’est qu’habitude.',
  gemini: 'Cette année tourne autour du choix : moins de fronts ouverts, plus de conversations qui aboutissent.',
  cancer: 'Cette année parle de prendre soin sans t’épuiser, et de faire de ton chez-toi un refuge plutôt qu’une corvée.',
  leo: 'Cette année sépare être vu et être connu, et met en valeur ce qui aurait du sens même sans public.',
  virgo: 'Cette année demande de l’ordre sans perfectionnisme : améliorer ce qui compte et laisser filer le reste.',
  libra: 'Cette année met tes accords à l’épreuve : lesquels sont justes, lesquels tiennent seulement pour éviter un conflit.',
  scorpio: 'Cette année parle de confiance : à qui tu l’accordes, ce que tu partages et ce que tu choisis de garder pour toi.',
  sagittarius: 'Cette année t’invite à transformer ta curiosité en un plan, avec des dates.',
  capricorn: 'Cette année confirme ce que tu as construit et montre quelle structure ne te sert plus.',
  aquarius: 'Cette année relie tes idées aux bonnes personnes : les projets grandissent à plusieurs.',
  pisces: 'Cette année t’aide à donner forme à ce que tu pressens, avec des limites qui te protègent.',
};

const KIND_LOVE: Record<string, string> = {
  aries: `En amour, ${the('aries')} a besoin de franchise et de place pour bouger.`,
  taurus: `En amour, ${the('taurus')} fait davantage confiance à la constance qu’aux promesses.`,
  gemini: `En amour, ${the('gemini')} ont besoin de conversation et de surprise à parts égales.`,
  cancer: `En amour, ${the('cancer')} s’ouvre quand il se sent en lieu sûr.`,
  leo: `En amour, ${the('leo')} brille quand l’admiration circule dans les deux sens.`,
  virgo: `En amour, ${the('virgo')} montre son affection par de petits gestes précis.`,
  libra: `En amour, ${the('libra')} cherche la réciprocité, pas seulement l’harmonie.`,
  scorpio: `En amour, ${the('scorpio')} a besoin de vérité avant d’intensité.`,
  sagittarius: `En amour, ${the('sagittarius')} veut faire route à deux sans perdre sa liberté.`,
  capricorn: `En amour, ${the('capricorn')} croit ce qui se prouve avec le temps.`,
  aquarius: `En amour, ${the('aquarius')} a besoin d’amitié au sein du couple.`,
  pisces: `En amour, ${the('pisces')} donnent beaucoup : il est juste qu’ils reçoivent aussi.`,
};

const KIND_WORK: Record<string, string> = {
  aries: `Au travail, ${the('aries')} donne le meilleur quand il peut ouvrir la voie.`,
  taurus: `Au travail, ${the('taurus')} est à l’aise avec des délais réalistes et des moyens clairs.`,
  gemini: `Au travail, ${the('gemini')} excellent quand ils peuvent expliquer et faire le lien.`,
  cancer: `Au travail, ${the('cancer')} s’investit pleinement quand l’équipe se sent soutenue.`,
  leo: `Au travail, la visibilité sert ${the('leo')} quand le dossier est solide.`,
  virgo: `Au travail, ${the('virgo')} est efficace quand elle peut améliorer une méthode précise.`,
  libra: `Au travail, ${the('libra')} est à son meilleur quand elle négocie et équilibre les intérêts.`,
  scorpio: `Au travail, ${the('scorpio')} excelle quand il peut creuser un sujet à fond.`,
  sagittarius: `Au travail, ${the('sagittarius')} avance bien quand il voit où va le projet.`,
  capricorn: `Au travail, ${the('capricorn')} s’appuie sur des objectifs mesurables.`,
  aquarius: `Au travail, ${the('aquarius')} apporte le plus quand il propose une autre façon de faire.`,
  pisces: `Au travail, ${the('pisces')} s’engagent quand la tâche a un sens clair.`,
};

/** Deux maisons différentes reliées par l’aspect. */
const ASPECT_MEANING: Record<string, string> = {
  conjunction: 'Les deux domaines se rejoignent : ce que tu fais dans l’un se voit dans l’autre.',
  sextile: 'C’est une ouverture discrète : saisis-la par un petit pas concret.',
  square: 'Les deux domaines se frottent : ajuste l’un avant de forcer l’autre.',
  trine: 'Les choses circulent bien entre les deux : bon moment pour avancer sans forcer.',
  opposition: 'Les deux domaines tirent chacun de leur côté : cherche le juste milieu.',
};

/** Les deux corps dans la même maison. */
const ASPECT_SAME: Record<string, string> = {
  conjunction: 'Les deux forces agissent ensemble, au même endroit.',
  sextile: 'Une ouverture discrète, à saisir par un petit pas concret.',
  square: 'Un frottement qui demande un ajustement plutôt qu’un passage en force.',
  trine: 'Cela circule bien : avance sans forcer.',
  opposition: 'Deux élans contraires : cherche le juste milieu.',
};

const SLOW_YEARS = new Set(['Saturn', 'Uranus', 'Neptune', 'Pluto']);

function houseIn(house: number): string {
  return `ta ${ORDINAL[house]} maison`;
}

/** "la Lune est en Scorpion, dans ta troisième maison" */
function positionClause(fact: PositionFact): string {
  const rx = fact.retrograde ? ' rétrograde' : '';
  return `${subject(fact.body)} est${rx} en ${sign(fact.sign)}, dans ${houseIn(fact.house)}`;
}

/** Une phrase sur l’événement, sans la date. */
function eventClause(fact: EventFact): string {
  const where = fact.sign ? sign(fact.sign) : '';
  switch (fact.eventKind) {
    case 'ingress':
      return `${subject(fact.body!)} entre en ${where}`;
    case 'station':
      return fact.eventType === 'retrograde'
        ? `${subject(fact.body!)} devient rétrograde en ${where}`
        : `${subject(fact.body!)} redevient direct en ${where}`;
    case 'lunation':
      return fact.eventType === 'full' ? `c’est la Pleine Lune en ${where}` : `c’est la Nouvelle Lune en ${where}`;
    case 'eclipse':
      return fact.eventType === 'solar' ? `une éclipse de Soleil a lieu en ${where}` : `une éclipse de Lune a lieu en ${where}`;
    case 'aspect': {
      const a = subject(fact.a!);
      const b = subject(fact.b!);
      const type = fact.eventType ?? 'conjunction';
      if (type === 'conjunction') return `${a} rejoint ${b}`;
      if (type === 'opposition') return `${a} s’oppose à ${b}`;
      return `${a} forme un ${aspectLabel(L, type)} avec ${b}`;
    }
  }
}

/** Le même événement en titre court, pour la liste du ciel et les dates à noter. */
function eventTitle(fact: EventFact): string {
  const where = fact.sign ? sign(fact.sign) : '';
  switch (fact.eventKind) {
    case 'ingress': return `${cap(subject(fact.body!))} entre en ${where}`;
    case 'station': return `${cap(planet(fact.body!))} ${fact.eventType === 'retrograde' ? 'rétrograde' : 'direct'} en ${where}`;
    case 'lunation': return `${fact.eventType === 'full' ? 'Pleine Lune' : 'Nouvelle Lune'} en ${where}`;
    case 'eclipse': return `Éclipse ${fact.eventType === 'solar' ? 'solaire' : 'lunaire'} en ${where}`;
    case 'aspect': return `${cap(planet(fact.a!))} ${aspectLabel(L, fact.eventType ?? 'conjunction')} ${planet(fact.b!)}`;
  }
}

/** Ce que l’événement veut dire dans la maison où il tombe ; la variante dépend du jour pour éviter les redites. */
function eventMeaning(fact: EventFact): string {
  const h = fact.houses[0];
  if (!h) return '';
  const theme = THEME[h];
  const day = Number(fact.at.slice(8, 10)) + Number(fact.at.slice(5, 7));
  switch (fact.eventKind) {
    case 'ingress':
      if (fact.body === 'Jupiter') {
        return pick([
          `Pour environ un an, l’accent se porte sur ${theme}.`,
          `Une année s’ouvre pour ${theme}.`,
        ], day);
      }
      if (fact.body && SLOW_YEARS.has(fact.body)) {
        return pick([
          `Une longue période s’ouvre pour ${theme}.`,
          `Pour plusieurs années, l’accent revient souvent sur ${theme}.`,
          `C’est le début d’un long chapitre pour ${theme}.`,
        ], day);
      }
      return pick([
        `Pendant les semaines qui suivent, l’attention se porte sur ${theme}.`,
        `Le projecteur se déplace vers ${theme}.`,
        `Pour quelques semaines, tes journées font plus de place ${aTheme(h)}.`,
      ], day);
    case 'station':
      return fact.eventType === 'retrograde'
        ? pick([
          `C’est le moment de revoir ${theme} avant de t’engager dans du neuf.`,
          `Reprends ${theme} sans te presser.`,
          `Repasse sur ${theme} et corrige ce qui doit l’être.`,
        ], day)
        : pick([
          `Ce qui était à l’arrêt du côté ${deTheme(h)} se remet en mouvement.`,
          `L’élan revient pour ${theme}.`,
          `Les décisions reportées sur ${theme} peuvent de nouveau avancer.`,
        ], day);
    case 'lunation':
      return fact.eventType === 'full'
        ? pick([
          `Ce qui mûrissait du côté ${deTheme(h)} arrive à son terme.`,
          `Un aboutissement se dessine pour ${theme}.`,
        ], day)
        : pick([
          `Bon point de départ pour ${theme}.`,
          `Un nouveau cycle commence pour ${theme}.`,
        ], day);
    case 'eclipse':
      return `Un tournant pour ${theme} : mieux vaut ne rien trancher ce jour-là.`;
    case 'aspect': {
      const [h1, h2] = fact.houses;
      const type = fact.eventType ?? 'conjunction';
      return h2 && h2 !== h1
        ? `Deux domaines sont en jeu : d’un côté ${THEME[h1]}, de l’autre ${THEME[h2]}. ${ASPECT_MEANING[type]}`
        : `Tout se joue autour ${deTheme(h1)}. ${ASPECT_SAME[type]}`;
    }
  }
}

const timed = (fact: EventFact) => fact.eventKind === 'lunation' || fact.eventKind === 'eclipse' || fact.eventKind === 'aspect';

function factSentence(fact: Fact, when: 'today' | 'tomorrow' | 'dated'): string {
  if (fact.kind === 'position') {
    return when === 'tomorrow' ? `Demain, ${positionClause(fact)}.` : `${cap(positionClause(fact))}.`;
  }
  const at = timed(fact) ? `Le ${date(fact.at)}, à ${utcClock(fact.at)},` : `Le ${date(fact.at)},`;
  return `${at} ${eventClause(fact)}. ${eventMeaning(fact)}`.trim();
}

const firstHouse = (facts: Fact[]) => facts.find((fact) => fact.kind === 'position')?.house
  ?? (facts.find((fact) => fact.kind === 'event') as EventFact | undefined)?.houses[0] ?? 1;

// ── Les surfaces ──

const CLOSE_TOMORROW = [
  'Prépare dès ce soir le premier geste : la journée démarrera plus légèrement.',
  'Note ce soir ce que tu ne veux pas oublier demain.',
  'Si quelque chose peut attendre après-demain, laisse-le attendre.',
  'Commence par ce qui ne dépend que de toi.',
  'Garde une marge dans ton agenda pour l’imprévu.',
];

function tomorrow(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  const used = new Set<number>();
  return ctx.passages.map(({ facts, index }) => {
    const h = firstHouse(facts);
    const advice = used.has(h) ? REFINE[h] : ADVICE[h];
    used.add(h);
    const sentences = facts.map((fact) => factSentence(fact, fact.kind === 'position' ? 'tomorrow' : 'dated'));
    if (index === 0) {
      return { text: `${sentences.join(' ')} Cela met au premier plan ${THEME[h]}. ${advice} ${KEY[s]}` };
    }
    if (index === ctx.passages.length - 1) {
      return { text: `${sentences.join(' ')} ${advice} ${pick(CLOSE_TOMORROW, idx(s))}` };
    }
    return { text: `${sentences.join(' ')} ${advice}` };
  });
}

const CLOSE_WEEK = [
  'Pour le bilan du dimanche, retiens une chose qui a fonctionné et une autre que tu changerais.',
  'Avant que la semaine suivante commence, décide ce que tu ne referas pas.',
  'Termine la semaine sur quelque chose de fini, même petit.',
  'Garde le dimanche soir pour remettre de l’ordre, pas pour rattraper tout le retard.',
];

function weekly(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  const used = new Set<number>();
  const last = ctx.passages.length - 1;
  return ctx.passages.map(({ facts, index }) => {
    const moons = facts.filter((fact): fact is PositionFact => fact.kind === 'position');
    if (index === 0 && moons.length >= 2) {
      const [start, ...rest] = moons;
      const end = rest.at(-1)!;
      const mid = rest.length > 1 ? rest[0] : undefined;
      const midText = mid ? ` Vers ${weekday(L, mid.at)}, elle passe dans le secteur ${deTheme(mid.house)}.` : '';
      return {
        text: `La semaine ${range(ctx.from, ctx.through)} s’ouvre avec la Lune en ${sign(start.sign)}, qui éclaire ${THEME[start.house]}.${midText} La semaine se termine dans le secteur ${deTheme(end.house)}. ${KEY[s]}`,
      };
    }
    const h = firstHouse(facts);
    const advice = used.has(h) ? REFINE[h] : ADVICE[h];
    used.add(h);
    const event = facts.find((fact): fact is EventFact => fact.kind === 'event');
    if (event) return { text: factSentence(event, 'dated') };
    if (index === 1) return { text: `Les premiers jours demandent de l’attention pour ${THEME[h]}. ${advice}` };
    if (index === last) return { text: `La semaine se referme sur ${THEME[h]}. ${advice} ${pick(CLOSE_WEEK, idx(s))}` };
    return { text: `En milieu de semaine, l’attention se déplace vers ${THEME[h]}. ${advice}` };
  });
}

const LOVE_CLOSE = [
  'Une question sincère éclaire plus qu’une supposition.',
  'Regarde si la réponse de l’autre rend l’espace commun plus facile à vivre.',
  'Pas besoin de tout régler aujourd’hui : il suffit de ne rien cacher.',
  'Dis ce dont tu as besoin en une phrase simple.',
  'Un geste tenu vaut mieux qu’une promesse de plus.',
];

function love(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  return ctx.passages.map(({ facts, index }) => {
    const h = firstHouse(facts);
    const sentences = facts.map((fact) => factSentence(fact, 'dated')).join(' ');
    if (index === 0) return { text: `${sentences} ${LOVE[h]} ${KIND_LOVE[s]}` };
    return { text: `${sentences} Le climat affectif se tourne vers ${THEME[h]}. ${pick(LOVE_CLOSE, idx(s), h)}` };
  });
}

const WORK_CLOSE = [
  'Une tâche bouclée vaut mieux que trois commencées.',
  'Note où tu en es avant de passer à autre chose.',
  'Demande une précision plutôt que de deviner ce qu’on attend de toi.',
];

function career(ctx: PeriodContext): LocalizedPassage[] {
  const s = ctx.sign;
  return ctx.passages.map(({ facts, index }) => {
    const h = firstHouse(facts);
    const sentences = facts.map((fact) => factSentence(fact, 'dated')).join(' ');
    if (index === 0) return { text: `${sentences} ${WORK[h]} ${KIND_WORK[s]}` };
    return { text: `${sentences} L’autre point d’attention : ${THEME[h]}. ${REFINE[h]} ${pick(WORK_CLOSE, idx(s))}` };
  });
}

// ── L’année ──

const QUARTERS: Array<[number, number]> = [[1, 3], [4, 6], [7, 9], [10, 12]];

function dominantHouse(facts: Fact[]): number {
  const counts = new Map<number, number>();
  for (const fact of facts) {
    const houses = fact.kind === 'position' ? [fact.house] : fact.houses;
    for (const house of houses) counts.set(house, (counts.get(house) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]?.[0] ?? 1;
}

function datedList(facts: Fact[]): string {
  return facts
    .filter((fact): fact is EventFact => fact.kind === 'event')
    .map((fact) => `Le ${date(fact.at)}, ${eventClause(fact)}. ${eventMeaning(fact)}`)
    .join(' ');
}

const THEMED_HEADINGS = [
  'Amour, amitié et accords clairs',
  'Travail, argent et autorité qui tient',
  'Foyer, repos et charge privée',
  'Ton propre cap',
];

const THEMED_LEADS = [
  'En amour, compte ce qui se voit : une demande, un accord revu, un temps protégé.',
  'Pour le travail et l’argent, mesure tes forces, les délais et ce que tu livres, pas seulement l’envie.',
  'À la maison et dans le repos, protège l’essentiel : le sommeil, l’espace et du temps sans obligation.',
  'Sur le plan personnel, grandir sert à quelque chose quand une décision concrète change.',
];

function yearly(ctx: PeriodContext, year: string): LocalizedPassage[] {
  const s = ctx.sign;
  return ctx.passages.map(({ facts, index }) => {
    const events = facts.filter((fact): fact is EventFact => fact.kind === 'event');
    if (index === 0) {
      const first = events[0];
      const firstText = first ? ` La première date à noter est le ${date(first.at)} : ${eventClause(first)}. ${eventMeaning(first)}` : '';
      return { heading: `L’année ${year} ${of(s)}`, text: `${YEAR[s]}${firstText}` };
    }
    if (index >= 1 && index <= 4) {
      const [from, to] = QUARTERS[index - 1];
      const h = dominantHouse(facts);
      const lead = pick([
        `Ce trimestre tourne autour ${deTheme(h)}.`,
        `Ces mois-ci, l’accent porte sur ${THEME[h]}.`,
        `Ici, le poids repose sur ${THEME[h]}.`,
      ], index, idx(s));
      return {
        heading: tidy(`De ${monthName(L, from)} à ${monthName(L, to)} : ${SHORT[h].toLowerCase()}`),
        text: `${lead} ${datedList(facts)} ${REFINE[h]}`.trim(),
      };
    }
    if (index >= 5 && index <= 8) {
      const k = index - 5;
      const extra = k === 0 ? KIND_LOVE[s] : k === 1 ? KIND_WORK[s] : k === 3 ? KEY[s] : '';
      return { heading: THEMED_HEADINGS[k], text: `${THEMED_LEADS[k]} ${extra} ${datedList(facts)}` };
    }
    const dates = events.map((fact) => `le ${date(fact.at)} (${eventTitle(fact)})`);
    const joined = dates.length > 1 ? `${dates.slice(0, -1).join(', ')} et ${dates.at(-1)}` : dates.join('');
    return {
      heading: 'Trois dates pour faire le point',
      text: `Note trois dates pour voir où en est ton année : ${joined}. À chacune, écris ce qui a changé et ce que tu veux garder.`,
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

// ── Le mois ──

const CLOSE_MONTH = [
  'En fin de mois, retiens une chose qui a fonctionné et une autre que tu changerais.',
  'Avant le mois suivant, décide ce que tu ne veux pas répéter.',
  'Termine le mois sur quelque chose de fini, même petit.',
];

function monthlyRaw(ctx: MonthlyContext): LocalizedPassage[] {
  const s = ctx.sign;
  const label = monthYear(L, ctx.month);
  const lunations = ctx.events.filter((fact) => fact.eventKind === 'lunation' || fact.eventKind === 'eclipse');
  const stations = ctx.events.filter((fact) => fact.eventKind === 'station');
  const ingresses = ctx.events.filter((fact) => fact.eventKind === 'ingress');
  const aspects = ctx.events.filter((fact) => fact.eventKind === 'aspect').slice(0, 4);
  const lead = lunations[0];
  const passages: LocalizedPassage[] = [{
    text: `${cap(label)} pour ${the(s)}. Ton signe solaire est lu comme la première maison, à la manière des horoscopes mensuels. ${lead ? `Le mois tourne autour ${deTheme(lead.houses[0])}.` : ''} ${KEY[s]}`,
  }];
  if (lunations.length) passages.push({ heading: 'Les lunaisons du mois', text: lunations.map((fact) => factSentence(fact, 'dated')).join(' ') });
  if (stations.length) passages.push({ heading: 'Planètes qui changent de sens', text: stations.map((fact) => factSentence(fact, 'dated')).join(' ') });
  if (ingresses.length) passages.push({ heading: 'Changements de signe', text: ingresses.map((fact) => factSentence(fact, 'dated')).join(' ') });
  if (aspects.length) passages.push({ heading: 'Aspects exacts', text: aspects.map((fact) => factSentence(fact, 'dated')).join(' ') });
  const close = lead ? ADVICE[lead.houses[0]] : REFINE[1];
  passages.push({ heading: 'Pour finir le mois', text: `${close} ${pick(CLOSE_MONTH, idx(s))}` });
  return passages;
}

function monthly(ctx: MonthlyContext): LocalizedPassage[] {
  return monthlyRaw(ctx).map((passage) => ({ ...passage, text: tidy(passage.text) }));
}

// ── La page ──

type ChromeCtx = { surface: PeriodSurface | 'monthly'; from: string; through: string; month?: string };

/** "Horoscope Bélier de demain, 9 novembre", la tête de la description. */
function headline(name: string, ctx: ChromeCtx): string {
  switch (ctx.surface) {
    case 'tomorrow': return `Horoscope ${name} de demain, ${date(ctx.from)}`;
    case 'weekly': return `Horoscope ${name} de la semaine ${range(ctx.from, ctx.through)}`;
    case 'monthly': return `Horoscope ${name} de ${monthYear(L, ctx.month!)}`;
    case 'love': return `Horoscope amour ${name} du ${date(ctx.from)}`;
    case 'career': return `Horoscope travail ${name} du ${date(ctx.from)}`;
    case 'yearly-2026': return `Horoscope ${name} 2026`;
    case 'yearly-2027': return `Horoscope ${name} 2027`;
  }
}

export const fr: HoroscopeLocaleModule = {
  locale: L,
  period,
  monthly,
  chrome: {
    title: (name, ctx) => {
      switch (ctx.surface) {
        case 'tomorrow': return `Horoscope ${name} de demain, ${date(ctx.from)}`;
        case 'weekly': return `Horoscope ${name} de la semaine du ${date(ctx.from)}`;
        case 'monthly': return `Horoscope mensuel ${name}, ${monthYear(L, ctx.month!)}`;
        case 'love': return `Horoscope amour ${name} du jour`;
        case 'career': return `Horoscope travail ${name} du jour`;
        case 'yearly-2026': return `Horoscope ${name} 2026`;
        case 'yearly-2027': return `Horoscope ${name} 2027`;
      }
    },
    h1: (name, ctx) => {
      switch (ctx.surface) {
        case 'tomorrow': return `Horoscope ${name} de demain`;
        case 'weekly': return `Horoscope ${name} de la semaine`;
        case 'monthly': return `Horoscope ${name} du mois`;
        case 'love': return `Horoscope amour ${name}`;
        case 'career': return `Horoscope travail ${name}`;
        case 'yearly-2026': return `Horoscope ${name} 2026`;
        case 'yearly-2027': return `Horoscope ${name} 2027`;
      }
    },
    description: (name, ctx) => tidy(`${headline(name, ctx)} : écrit à partir du ciel calculé, avec les positions, les lunaisons et les dates exactes, comptées depuis ton signe solaire.`),
    periodLabel: {
      today: 'Aujourd’hui', tomorrow: 'Demain', weekly: 'Semaine', monthly: 'Mois', love: 'Amour', career: 'Travail', 'yearly-2026': '2026', 'yearly-2027': '2027',
    },
    crumbs: 'Horoscopes',
    switchAria: 'Choisis la période',
    skyHeading: 'Le ciel derrière cette lecture',
    skyIntro: 'Chaque phrase s’appuie sur ces données, calculées pour midi UTC ou à la minute exacte de l’événement.',
    skyRow: (fact) => (fact.kind === 'position'
      ? `${cap(planet(fact.body))}${fact.retrograde ? ' rétrograde' : ''} en ${sign(fact.sign)}, maison ${fact.house} · ${dateYear(fact.at)}`
      : `${eventTitle(fact)} · ${dateYear(fact.at)}, ${utcClock(fact.at)}`),
    moreHeading: 'Plus pour ton signe',
    signGuide: (name) => `Guide ${of(name)}`,
    pairs: (name) => `Compatibilité ${of(name)}`,
    calculator: 'Calcule ton thème astral',
    otherSigns: 'Les autres signes',
    method: 'Les maisons sont comptées depuis ton signe solaire (maisons solaires en signes entiers). Les heures sont en UTC.',
    confidence: (value) => `Confiance de lecture ${value} %`,
    confidenceNote: 'Le chiffre dit à quel point les données de la lecture sont précises (ici, le signe solaire seul), pas la probabilité que quelque chose arrive.',
    faq: (name, surface) => [
      {
        q: `D’où vient l’horoscope ${of(name)} ?`,
        a: 'Des positions calculées des planètes et de la Lune pour ces dates. Chaque phrase renvoie à la donnée sur laquelle elle s’appuie, et les maisons sont comptées depuis ton signe solaire.',
      },
      {
        q: surface === 'weekly' ? 'Quelle semaine couvre-t-il ?'
          : surface === 'monthly' ? 'Quel mois couvre-t-il ?'
            : surface === 'yearly-2026' || surface === 'yearly-2027' ? 'Quelle période couvre-t-il ?'
              : 'Quand est-il mis à jour ?',
        a: surface === 'weekly'
          ? 'La semaine va du lundi au dimanche, en heure UTC, et se renouvelle chaque lundi.'
          : surface === 'monthly'
            ? 'Le mois civil, en UTC. Celui du mois suivant paraît le 1er.'
            : surface === 'yearly-2026' || surface === 'yearly-2027'
              ? 'L’année civile entière, en UTC, avec la date exacte de chaque événement qui la jalonne.'
              : 'Il est recalculé chaque jour, avec le même ciel que l’édition quotidienne.',
      },
      {
        q: 'Est-ce utile si je ne connais pas mon heure de naissance ?',
        a: 'Oui. Cette lecture n’utilise que le signe solaire. Avec ta date, ton heure et ton lieu de naissance, tu peux calculer ton thème astral complet et connaître ton ascendant.',
      },
    ],
  },
};
