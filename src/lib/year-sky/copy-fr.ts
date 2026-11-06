/**
 * "Ton ciel de 2027" : the French words of Your 2027 sky. Importing this
 * module registers them (defineYearSkyWords), so only the French page and
 * its island carry them. Sign and planet names come from the site's own
 * helpers; the reading follows the English one line for line.
 *
 * House rules, as in copy.ts: plain, warm and dry; tu, as the rest of the
 * French site; no em or en dashes; no health, money, betting or guarantees.
 */
import { planetLabel } from '../i18n/astrology';
import { signName as localSignName } from '../signs';
import { PERSONAL_WORDS } from '../personal-calendar/words';
import type { MilestoneKind } from '../occasions/milestones';
import { defineYearSkyWords, type YearAspect, type YearSkyWords } from './copy';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const ORDINAL = ['', 'premier', 'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième', 'septième', 'huitième'];
const HOUSE_ORDINAL = ['', 'première', 'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième', 'septième', 'huitième', 'neuvième', 'dixième', 'onzième', 'douzième'];
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const P = (body: string) => planetLabel('fr', body);
const W = PERSONAL_WORDS.fr;

const HOUSE_TOPIC = [
  '',
  'ta façon de te montrer et de commencer les choses',
  'ce à quoi tu tiens et ce que tu gardes près de toi',
  'les échanges, les petits trajets, les frères et sœurs et les voisins',
  'le foyer, la famille et les racines',
  'le jeu, l’amour et la création',
  'le travail de tous les jours et les routines',
  'le couple et les liens en tête à tête',
  'l’intimité, la confiance et ce que tu partages',
  'les voyages, les études et les grandes idées',
  'le travail, la réputation et la direction',
  'les amis, les groupes et les espoirs',
  'le repos, la retraite et ce qui se passe à l’abri des regards',
];

const SIGN_TOPIC: Record<string, string> = {
  aries: 'les commencements',
  taurus: 'le confort et la stabilité',
  gemini: 'les échanges et les idées',
  cancer: 'le foyer et la famille',
  leo: 'le jeu et le fait d’être vu',
  virgo: 'le savoir-faire et le travail utile',
  libra: 'le couple et l’équité',
  scorpio: 'la confiance et la profondeur',
  sagittarius: 'les voyages et les grandes idées',
  capricorn: 'le travail et la position',
  aquarius: 'les amis et l’avenir',
  pisces: 'le repos et l’imagination',
};
const SLUG_BY_NAME = new Map(Object.keys(SIGN_TOPIC).map((slug) => [localSignName(slug, 'fr'), slug]));
const signTopic = (sign: string) => SIGN_TOPIC[SLUG_BY_NAME.get(sign) ?? ''] ?? sign;

const POINT: Record<string, string> = { ASC: 'ascendant', MC: 'milieu du ciel' };
/** Points that are feminine in French. */
const FEMININE = new Set(['Moon', 'Venus']);
const pointName = (point: string) => POINT[point] ?? P(point);
const your = (point: string) => `${FEMININE.has(point) ? 'ta' : 'ton'} ${pointName(point)}`;
const my = (point: string) => `${FEMININE.has(point) ? 'ma' : 'mon'} ${pointName(point)}`;

/** What each point stands for; the part before a comma is its short form. */
const ROLE: Record<string, string> = {
  Sun: 'ton sens de toi-même',
  Moon: 'ta vie émotionnelle',
  Mercury: 'ta façon de penser',
  Venus: 'ta façon d’aimer',
  Mars: 'ton élan',
  Jupiter: 'ton appétit d’en avoir plus',
  Saturn: 'ton sens du devoir',
  ASC: 'ton ascendant, ta façon d’aborder le monde',
  MC: 'ton milieu du ciel, ta direction publique',
};
const role = (point: string) => ROLE[point] ?? your(point);
const shortRole = (point: string) => role(point).split(',')[0];

const TONE: Record<string, string> = {
  Jupiter: 'environ un an de croissance',
  Saturn: 'environ deux ans et demi de construction lente',
  Uranus: 'environ sept ans de changement',
  Neptune: 'plus de dix ans de rêve',
  Pluto: 'deux décennies de changement profond',
};
const tone = (planet: string) => TONE[planet] ?? 'une longue période';
/** The topic a slow planet's years turn on, after a comma: ", avec au centre ...". */
const around = (topic: string) => `, avec au centre ${topic}`;

const MOVER: Record<string, string> = {
  Venus: 'une période douce de chaleur et d’envie',
  Mars: 'une période chargée de chaleur et d’urgence',
  Jupiter: 'une période généreuse de confiance',
  Saturn: 'une longue saison de pression et de comptes à rendre',
  Uranus: 'une secousse qui se répète pendant des mois',
  Neptune: 'un brouillard lent de désir et de flou',
  Pluto: 'une fouille qui dure des années',
};
const ASPECT_VERB: Record<YearAspect, { verb: string; gloss: string }> = {
  conjunction: { verb: 'se pose sur', gloss: 'qui pendant un temps colore tout ce qui s’y trouve' },
  square: { verb: 'pousse contre', gloss: 'une friction qui ne se résout pas d’elle-même' },
  trine: { verb: 'traverse en douceur', gloss: 'une aide qui arrive sans qu’on la demande' },
  opposition: { verb: 'se tient face à', gloss: 'une tension à affronter de face plutôt qu’à encaisser' },
};
const ASPECT_TITLE: Record<YearAspect, string> = {
  conjunction: 'rejoint',
  square: 'au carré de',
  trine: 'en trigone à',
  opposition: 'en opposition à',
};

const RETROGRADE_LINE: Record<string, string> = {
  Mercury: 'Les projets, les messages et les voyages demandent un second regard. Termine, relis et répare avant de lancer quoi que ce soit.',
  Venus: 'Les anciens sentiments et les anciens goûts reviennent pour être revus. Une bonne période pour réparer plutôt que pour commencer.',
  Mars: 'L’énergie se tourne vers l’intérieur. Une longue période pour revoir ta façon de pousser, pas pour chercher de nouvelles disputes.',
  Jupiter: 'La croissance ralentit pour être vérifiée. Une saison pour finir ce que l’année a commencé.',
  Saturn: 'Les engagements sont revus de l’intérieur. Le travail discret sur les fondations porte ses fruits plus tard.',
  Uranus: 'Les changements des dernières années se posent, et tu vois lesquels tu voulais vraiment.',
  Neptune: 'Le brouillard se lève un peu. Les espoirs reçoivent une douce mise à l’épreuve du réel.',
  Pluto: 'Le travail en profondeur devient discret et personnel.',
};

const ECLIPSE_KIND: Record<string, string> = { total: 'totale', annular: 'annulaire', partial: 'partielle', penumbral: 'pénombrale', hybrid: 'hybride' };
const kindOf = (kind: string) => ECLIPSE_KIND[kind] ?? kind;

const MILESTONE_CARD: Record<MilestoneKind, string> = {
  'jupiter-return': 'Mon retour de Jupiter',
  'saturn-return': 'Mon retour de Saturne',
  'uranus-opposition': 'Mon opposition d’Uranus',
};

const dayOfMonth = (d: Date) => (d.getUTCDate() === 1 ? '1er' : String(d.getUTCDate()));
const day = (iso: string, year: number) => {
  const d = new Date(iso);
  const base = `${dayOfMonth(d)} ${MONTHS[d.getUTCMonth()]}`;
  return d.getUTCFullYear() === year ? base : `${base} ${d.getUTCFullYear()}`;
};
const list = (items: string[]) => items.length <= 1
  ? items.join('')
  : `${items.slice(0, -1).join(', ')} et ${items.at(-1)}`;
const decimal = (value: string) => value.replace('.', ',');

export const YEAR_SKY_WORDS_FR: YearSkyWords = defineYearSkyWords('fr', {
  dateLocale: 'fr-FR',
  pageTitle: 'Ton ciel de 2027 : l’année qui vient pour ton thème astral',
  pageDescription: 'Les éclipses, les planètes lentes, les rétrogradations et les retours de 2027 qui touchent ton thème astral, mois par mois, avec une carte à partager et un fichier de calendrier créés sur ton appareil.',
  heroTitle: 'Ton ciel de 2027',
  heroLede: 'Les grands moments de 2027 qui touchent ton propre thème : les éclipses, les planètes lentes, Vénus et Mars sur ton Soleil, ta révolution solaire et les rétrogradations qui tombent sur tes positions. Tout est calculé dans ce navigateur.',
  noscript: 'Pour lire l’année de ton thème, il faut JavaScript. Le ciel partagé plus bas fonctionne sans.',
  chooserTitle: 'Le lire pour ton thème',
  chooserSaved: 'Thème enregistré',
  savedLede: (name) => (name ? `Avec ton thème enregistré, ${name}.` : 'Choisis un de tes thèmes enregistrés.'),
  enterOther: 'Saisir d’autres données de naissance',
  useSaved: 'Utiliser un thème enregistré',
  readMine: 'Lire mon 2027',
  enterDetails: 'Saisir des données de naissance',
  enterDetailsLede: 'Saisis une date, une heure et un lieu de naissance pour lire l’année de ce thème.',
  readEntered: 'Lire mon 2027',
  orGeneral: 'Ou lis le ciel que tout le monde partage.',
  reading: 'Lecture de l’année…',
  cancel: 'Annuler',
  error: 'L’année n’a pas pu être calculée. Vérifie les données et réessaie.',
  savedRemoved: 'Ce thème enregistré a changé pendant la lecture de l’année. Réessaie.',
  saveHint: 'Enregistrer un thème te permet de revenir ici sans tout ressaisir.',
  saveChart: 'Enregistrer un thème',
  privacy: 'L’année est calculée sur cet appareil. Tes données de naissance ne sont ni envoyées, ni conservées, ni mises dans un lien.',
  resultTitle: 'Ton 2027',
  resultLede: 'Chaque moment ci-dessous porte son jour exact en UTC. Les planètes lentes restent proches pendant des semaines avant et après la date exacte : lis chacune comme une saison avec un sommet.',
  briefTitle: 'L’année en bref',
  allYearTitle: 'Toute l’année',
  allYearLede: 'Où se trouvent les planètes lentes dans ton thème toute l’année, en maisons signes entiers à partir de ton signe ascendant.',
  quietQuarter: 'Rien de grand ne touche ton thème ces mois-ci. Le ciel partagé plus bas compte toujours.',
  unknownTime: 'Sans heure de naissance, le thème est calculé pour midi à la date de naissance : une date peut donc varier d’un jour, et la Lune, l’ascendant et les maisons sont laissés de côté.',
  quarterNames: ['De janvier à mars', 'D’avril à juin', 'De juillet à septembre', 'D’octobre à décembre'],
  monthNames: MONTHS,
  generalTitle: 'Le ciel de 2027 que tout le monde partage',
  generalLede: 'Cinq éclipses, les rétrogradations et l’endroit où les planètes lentes passent l’année. Ces dates sont les mêmes pour tous ; ce qu’elles touchent dépend du thème.',
  generalInvite: 'Tu veux savoir lesquelles tombent sur ton thème ?',
  generalInviteLink: 'Le lire pour ton thème',
  generalCalendar: 'Mettre le ciel partagé dans ton application de calendrier',
  moreTitle: 'Plus sur 2027',
  moreLinks: [
    { path: '/eclipses/', label: 'Éclipses solaires et lunaires' },
    { path: '/mercury-retrograde/', label: 'Mercure rétrograde' },
    { path: '/full-moon-calendar/', label: 'Calendrier des pleines lunes' },
    { path: '/sky-calendar/', label: 'Mettre le ciel partagé dans ton application de calendrier' },
    { path: '/transits/', label: 'Les transits, jour après jour' },
    { path: '/birth-chart/', label: 'Ton thème astral' },
  ],
  shareTitle: 'Partage ton année',
  shareLede: 'La carte ne montre que des signes et des planètes : ni nom, ni date, heure ou lieu de naissance, ni dates de ton thème.',
  shareSquare: 'Partager la carte carrée',
  shareStory: 'Partager la carte pour les stories',
  shareShared: 'Partagée.',
  shareSaved: 'Enregistrée sur ton appareil.',
  cardNote: 'Créée dans ce navigateur. La carte carrée fait 1080 × 1080 et celle pour les stories 1080 × 1920.',
  calendarTitle: 'Ajouter 2027 à mon calendrier',
  calendarLede: 'Un seul fichier avec tes moments et le ciel partagé, chacun avec un rappel la veille. Il est créé dans ce navigateur et enregistré sur ton appareil ; il n’y a pas de lien d’abonnement, car un lien devrait contenir tes données de naissance.',
  calendarButton: 'Télécharger le fichier de calendrier',
  calendarDone: 'Fichier de calendrier enregistré. Ouvre-le pour ajouter les événements à ton application de calendrier.',
  calendarNote: 'Le fichier s’appelle zodiacs-2027-sky.ics. La plupart des applications de calendrier l’importent d’un double appui ou depuis leur menu d’importation.',
  calendarName: 'Zodiacs.org · Mon ciel de 2027',
  calendarExact: 'Exact à {time} UTC.',
  calendarMore: 'Plus : {url}',
  calendarForecast: W.note,
  confidenceNote: 'Chaque lecture porte une confiance de lecture : elle dit à quel point les données du thème derrière elle sont précises, pas la probabilité que quelque chose arrive.',
  cardHeadline: 'Mon ciel en',
  cardSun: P('Sun'),
  cardMoon: P('Moon'),
  cardRising: 'Ascendant',
  cardCount: (n) => (n === 1 ? '1 moment touche mon thème' : `${n} moments touchent mon thème`),
  cardQuiet: 'Une année calme pour mon thème',
  confidence: (value) => `Confiance de lecture ${value} %`,
  day,
  dayTime: (iso) => {
    const d = new Date(iso);
    return `${dayOfMonth(d)} ${MONTHS[d.getUTCMonth()]} à ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
  },
  range: (fromIso, toIso, year) => `du ${day(fromIso, year)} au ${day(toIso, year)}`,
  list,
  signName: (slug) => localSignName(slug, 'fr'),
  planet: P,
  pointName,

  eclipseTitle: (type, kind) => `Éclipse ${type === 'solar' ? 'solaire' : 'lunaire'} ${kindOf(kind)}`,
  eclipseLine: (type, kind, degree, sign) => type === 'solar'
    ? `Une nouvelle Lune au poids particulier, à ${degree} en ${sign}. Les astrologues lisent les éclipses solaires comme des débuts qui arrivent plus tôt que prévu.${kind === 'total' ? ' Celle-ci est totale : la Lune couvre tout le Soleil le long de sa bande.' : ''}`
    : `Une pleine Lune au poids particulier, à ${degree} en ${sign}. Les éclipses lunaires se lisent comme des fins et des grands rangements.${kind === 'penumbral' ? ' Celle-ci est pénombrale, à peine visible à l’œil nu.' : ''}`,
  retrogradeTitle: (planet) => `${P(planet)} rétrograde`,
  retrogradeLine: (planet) => RETROGRADE_LINE[planet] ?? `${P(planet)} semble reculer pendant un temps.`,
  retrogradeDetail: (range, sign, shadow) => `${cap(range)}${sign ? `, en ${sign}` : ''}.${shadow ? ` L’ombre va ${shadow}.` : ''}`,
  ingressTitle: (planet, sign) => `${P(planet)} entre en ${sign}`,
  ingressLine: (planet, sign, until) => `${P(planet)} reste en ${sign} jusqu’au ${until} : ${tone(planet)}${around(signTopic(sign))}.`,
  stationRetrograde: 'début de la rétrogradation',
  underWay: 'Déjà en cours au début de l’année',
  stationDirect: 'retour au mouvement direct',
  backgroundTitle: 'Où les planètes lentes passent 2027',
  backgroundLine: (planet, signs) => `${P(planet)} : ${signs}.`,
  backgroundSigns: (spans) => spans.length === 1
    ? `${spans[0].sign} toute l’année`
    : spans.map((span, i) => `${i === 0 ? '' : 'puis '}${span.sign}${span.until ? ` jusqu’au ${span.until}` : ''}`).join(', '),
  passLabel: (pass, count) => `passage ${pass} sur ${count}`,

  solarTitle: W.solarTitle,
  solarLine: 'Le Soleil revient au degré exact qu’il occupait à ta naissance. Les astrologues lisent le thème de ce moment comme la forme de ton année qui commence.',
  solarDetail: (time) => `Exact le ${time}.`,
  milestoneTitle: (kind, index) => kind === 'uranus-opposition'
    ? 'Ton opposition d’Uranus'
    : `Ton ${ORDINAL[index] ?? `${index}e`} ${W.milestones[kind].name.charAt(0).toLowerCase()}${W.milestones[kind].name.slice(1)}`,
  milestoneLine: (kind) => W.milestones[kind].about,
  contactTitle: (planet, aspect, point) => `${P(planet)} ${ASPECT_TITLE[aspect]} ${your(point)}`,
  contactLine: (planet, aspect, point) => {
    const phrase = ASPECT_VERB[aspect];
    const mover = MOVER[planet];
    if (!phrase || !mover) return `${P(planet)} forme un aspect avec ${role(point)}.`;
    return `${P(planet)} ${phrase.verb} ${role(point)} : ${mover}, ${phrase.gloss}.`;
  },
  exactOn: (dates) => `Exact : ${dates}.`,
  passOf: (pass, count) => `Passage ${pass} sur ${count}.`,
  loopBefore: (year) => `La boucle a commencé en ${year}.`,
  loopAfter: (year) => `La boucle se termine en ${year}.`,
  slowNote: W.slowNote,
  eclipseHitTitle: (type, contact, point) => `Une éclipse ${type === 'solar' ? 'solaire' : 'lunaire'} tombe ${contact === 'conjunction' ? 'sur' : 'face à'} ${your(point)}`,
  eclipseHitLine: (type, contact, point, degree, sign) => {
    const where = contact === 'conjunction' ? `sur ${role(point)}` : `face à ${role(point)}`;
    return type === 'solar'
      ? `L’éclipse à ${degree} en ${sign} tombe ${where}. Lis-la comme une porte qui s’ouvre là : quelque chose commence, plus tôt que prévu.`
      : `L’éclipse à ${degree} en ${sign} tombe ${where}. Lis-la comme un grand rangement : quelque chose arrive là à sa fin naturelle, et tu retrouves de la place.`;
  },
  eclipseOrb: (orb) => `À ${decimal(orb)}° de l’exactitude.`,
  retrogradeHitTitle: (planet, points) => `${P(planet)} rétrograde repasse sur ${list(points.map(your))}`,
  retrogradeHitLine: (planet, points) => {
    const names = list(points.map(your));
    const roles = list(points.map(shortRole));
    if (planet === 'Mercury') return `Mercure croise ${names} trois fois : en avant, en arrière, puis de nouveau en avant. Les échanges et les projets qui touchent ${roles} ont droit à un second jet.`;
    if (planet === 'Venus') return `Vénus croise ${names} trois fois. Les anciens sentiments et les anciens goûts liés à ${roles} reviennent pour être revus.`;
    return `${P(planet)} croise ${names} trois fois. ${cap(roles)} ${points.length > 1 ? 'font' : 'fait'} un long entraînement : d’abord plus lent, puis plus fort.`;
  },
  ingressSunTitle: (planet) => `${P(planet)} entre dans ton signe solaire`,
  ingressRisingTitle: (planet) => `${P(planet)} entre dans ton signe ascendant`,
  ingressHouseTitle: (planet, house) => `${P(planet)} entre dans ta ${HOUSE_ORDINAL[house]} maison`,
  ingressPersonalLine: (planet, sign, house, ownSign) => {
    const parts = [`${P(planet)} entre en ${sign}`];
    if (house) parts.push(`, ta ${HOUSE_ORDINAL[house]} maison en maisons signes entiers : ${tone(planet)}${around(HOUSE_TOPIC[house])}.`);
    else parts.push(` : ${tone(planet)}${around(signTopic(sign))}.`);
    if (ownSign === 'sun') parts.push(' C’est ton signe solaire : le cycle recommence là où ton thème a son moteur.');
    if (ownSign === 'rising') parts.push(' C’est ton signe ascendant : le changement se voit d’abord dans ta façon d’aborder le monde.');
    return parts.join('');
  },
  backgroundHouseLine: (planet, sign, house, until) => `${P(planet)} ${until ? `est en ${sign} jusqu’au ${until}` : `passe l’année en ${sign}`}, ta ${HOUSE_ORDINAL[house]} maison en maisons signes entiers : ${tone(planet)}${around(HOUSE_TOPIC[house])}.`,
  cardContact: (planet, aspect, point) => `${P(planet)} ${ASPECT_TITLE[aspect]} ${my(point)}`,
  cardEclipse: (point) => `Une éclipse sur ${my(point)}`,
  cardRetrograde: (planet, points) => `${P(planet)} rétrograde sur ${list(points.map(my))}`,
  cardMilestone: (kind) => MILESTONE_CARD[kind],
  cardIngress: (planet, house, ownSign) => ownSign === 'sun'
    ? `${P(planet)} dans mon signe solaire`
    : ownSign === 'rising'
      ? `${P(planet)} dans mon signe ascendant`
      : `${P(planet)} dans ma ${HOUSE_ORDINAL[house ?? 0] ?? ''} maison`,
});
