/**
 * Les textes visibles des pages quotidiennes en français : l’horoscope du
 * jour par signe (LocalizedHoroscope.astro), le ciel du jour
 * (LocalizedToday.astro) et la page des horoscopes (LocalizedHoroscopeHub.astro).
 * Tutoiement, comme la lecture quotidienne (src/lib/i18n/daily-reading.ts).
 * Apostrophe typographique, espace simple avant « : ; ? ! % », comme
 * src/lib/seasons/copy-fr.ts. Aucun tiret long.
 */
import type { Copy } from '../../../components/localized/horoscope-copy';
import type { HubCopy } from '../../../components/localized/hub-copy';
import { TODAY, cap, named, type TodayCopy } from '../../../components/localized/today-copy';
import { aspectLabel } from '../../i18n/astrology';
import { SIGNS, signName } from '../../signs';

/** L’article de chaque signe : le Bélier, la Vierge, les Gémeaux. */
const ARTICLE: Record<string, 'le' | 'la' | 'les'> = {
  aries: 'le', taurus: 'le', gemini: 'les', cancer: 'le', leo: 'le', virgo: 'la',
  libra: 'la', scorpio: 'le', sagittarius: 'le', capricorn: 'le', aquarius: 'le', pisces: 'les',
};
const SLUG_BY_NAME = new Map(SIGNS.map((sign) => [signName(sign, 'fr'), sign.slug]));
const articleOf = (name: string) => ARTICLE[SLUG_BY_NAME.get(name) ?? ''];
/** "le Bélier", "la Vierge", "les Gémeaux" ; un nom inconnu reste tel quel. */
const the = (name: string) => (articleOf(name) ? `${articleOf(name)} ${name}` : name);
/** "du Bélier", "de la Vierge", "des Gémeaux" ; sinon "de" élidé devant une voyelle ou un h. */
const of = (name: string) => {
  const article = articleOf(name);
  if (article) return `${({ le: 'du', la: 'de la', les: 'des' } as const)[article]} ${name}`;
  return /^[aeiouyhâàéèêîôûAEIOUYHÂÀÉÈÊÎÔÛ]/u.test(name) ? `d’${name}` : `de ${name}`;
};
/** "aux natifs du Bélier" */
const natives = (name: string) => `aux natifs ${of(name)}`;

const horoscope: Copy = {
  title: (name, date) => `Horoscope ${name} du jour, ${date} | Zodiacs.org`,
  description: (name, date, notes) => `Horoscope ${name} du jour, ${date} : ${notes} à partir des maisons solaires du signe, avec les positions réelles du ciel et leurs relevés.`,
  notes: (count) => (count === 1 ? '1 note lue' : `${count} notes lues`),
  imageAlt: (name) => `${name}, l’horoscope du jour, Zodiacs.org`,
  crumbs: 'Horoscopes',
  crumbsAria: 'Fil d’Ariane',
  h1: (name) => `${name} aujourd’hui`,
  credit: (name) => `${name}, d’après les illustrations des signes de Zodiacs`,
  periodsAria: (name) => `Périodes de l’horoscope ${of(name)}`,
  todayWord: 'Aujourd’hui',
  week: 'Cette semaine',
  month: 'Ce mois-ci',
  periodsNote: 'Semaine et mois, pour l’instant en anglais',
  railLabel: 'Changer de signe',
  metaLabel: 'Horoscope quotidien',
  noteCount: (count) => (count === 1 ? '1 note' : `${count} notes`),
  readingTitle: (name) => `Le ciel du jour, vu ${of(name)}`,
  foot: (name) => `Écrit pour ${the(name)} en tant que signe solaire. Les positions du ciel sont calculées ; leur sens relève de l’interprétation astrologique. Sers-t’en pour réfléchir, pas comme une prédiction des événements.`,
  methodLink: 'Notre méthode de calcul',
  share: (name) => `Horoscope ${name} du jour`,
  shareLabel: 'Envoyer cette lecture',
  askLead: 'Des questions sur cette lecture ?',
  askLabel: 'Demander à Guide',
  prompts: (name) => [
    `Que signifie le ciel du jour pour ${the(name)} ?`,
    'De quelles planètes vient cette lecture ?',
    'Comment lire cela dans mon thème astral ?',
  ],
  railAria: 'À propos de cette lecture',
  skyTitle: 'Le ciel derrière cette lecture',
  skyBasis: '12 h UTC',
  skySub: 'Chaque note vient de l’une de ces positions.',
  skyRow: (planet, sign) => `${planet} en ${sign}`,
  skyHouse: (house, name) => `Maison ${house}, comptée depuis ${the(name)}.`,
  moonLit: (phase, percent) => `${phase}, éclairée à ${percent} %.`,
  retrograde: 'Rétrograde.',
  alsoSun: (position) => `Aussi dans ce ciel : Soleil ${position}`,
  fullSky: 'Tout le ciel du jour',
  wheelAria: (date, name) => `Le ciel du ${date} à 12 h UTC, compté depuis ${the(name)} comme première maison`,
  wheelCaption: (date, name, focus, count) => `Le ciel du ${date} à 12 h UTC, sur la roue ${of(name)}.${count > 0 ? ` En couleur : ${focus}, ${count === 1 ? 'la planète de cette lecture' : 'les planètes de cette lecture'}.` : ''}`,
  ctaKicker: 'Au-delà de ton signe solaire',
  ctaTitle: 'Vois où tombe ce ciel dans ton propre thème.',
  ctaLede: (name, moonSign, house) => `Cette lecture compte la roue depuis ${the(name)}, si bien que la Lune en ${moonSign} y tombe en maison ${house}. Ton thème astral part de ton propre ascendant : la même Lune peut donc toucher un autre domaine de ta vie.`,
  ticks: [
    'Ton Soleil, ta Lune et ton ascendant, et ce que chacun signifie',
    'Le ciel de chaque jour lu sur ton propre thème',
    'Calculé dans ton navigateur, sans créer de compte',
  ],
  reassure: ['Date, heure et lieu de naissance.', 'Une vingtaine de secondes.'],
  saved: 'Tu as déjà enregistré un thème ? ',
  savedLink: 'Compare-le au ciel du jour',
  moreTitle: (name) => `Plus sur ${the(name)}`,
  moreLede: 'Le même ciel sur des périodes plus longues, et le signe lu depuis un autre point du thème.',
  moreLonger: 'Demain, semaine et mois',
  moreLongerText: (name) => `Les lectures plus longues ${of(name)}, aussi pour l’amour, le travail et 2027.`,
  moreRising: (name) => `Ascendant ${name}`,
  moreRisingNote: 'Profil de l’ascendant',
  moreRisingText: (name) => `${cap(the(name))} comme signe ascendant : celui qui se levait à l’horizon est à ta naissance.`,
  moreAll: 'Tous les signes',
  moreAllText: 'Les douze horoscopes du ciel du jour sur une seule page.',
  guideKicker: 'Le guide du signe',
  guideTitle: (name) => `${name}, en profondeur`,
  guideCopy: (name) => `Personnalité, amour, travail et argent, compatibilités, et ce que ${the(name)} signifie dans ton thème astral.`,
  guideLink: (name) => `Le guide complet ${of(name)}`,
  signsTitle: 'Lire un autre signe',
  signsLede: 'Les notes du ciel du jour pour les douze signes, à partir des mêmes positions.',
  allHoroscopes: 'Tous les horoscopes',
  signsAria: 'Autres signes',
  readingNow: 'En cours de lecture',
  faqTitle: (name) => `Horoscope quotidien ${of(name)} : questions`,
  faqMore: 'Plus sur la méthode : ',
  faq: (name) => [
    {
      q: `Que couvre la lecture quotidienne ${of(name)} ?`,
      a: `Jusqu’à quatre notes tirées du ciel du jour : les maisons solaires ${of(name)} où tombent la Lune et les planètes personnelles, et tout événement exact à cette date. Chaque note porte son relevé.`,
    },
    {
      q: `Cette lecture s’adresse-t-elle seulement ${natives(name)} ?`,
      a: `Elle part ${of(name)} comme signe solaire. Si tu connais ton ascendant, lis-le aussi ; ton thème astral complet donne l’image la plus personnelle.`,
    },
    {
      q: 'Comment tirer parti de cette lecture ?',
      a: 'Prends ce qui te sert, transforme-le en question ou en geste concret, et laisse ton propre jugement décider.',
    },
  ],
};

const EXACT: Record<string, string> = {
  conjunction: 'une conjonction exacte', sextile: 'un sextile exact', square: 'un carré exact',
  trine: 'un trigone exact', opposition: 'une opposition exacte',
};
const NUMBER_WORDS = ['aucun', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];
const word = (count: number) => NUMBER_WORDS[count] ?? String(count);

const today: TodayCopy = {
  title: (date) => `Le ciel du jour, ${date} | Zodiacs.org`,
  description: (date) => `Le ciel du jour pour les douze signes solaires : jusqu’à quatre notes par signe, calculées à partir des positions réelles du ${date}.`,
  crumbsAria: 'Fil d’Ariane',
  home: 'Accueil',
  todayWord: 'aujourd’hui',
  TodayWord: 'Aujourd’hui',
  onDate: (date) => `le ${date}`,
  h1: 'Le ciel du jour',
  lede: 'Où se trouve chaque planète, ce que chaque position représente traditionnellement, et ce qui vient ensuite au calendrier.',
  cta: 'Compare-le à ton thème',
  yourSign: 'Ton signe',
  reassure: 'Gratuit · Sans inscription · Positions à 12 h UTC',
  wheelAria: (date) => `Le ciel du ${date} à 12 h UTC : le Soleil, la Lune et les planètes dans leurs signes, avec les aspects à moins de trois degrés de l’exactitude`,
  legendRx: 'Rétrograde',
  legendEasy: 'Trigone ou sextile',
  legendTense: 'Carré ou opposition',
  legendJoined: 'Conjonction',
  lightsKicker: 'Là où commence la journée',
  lightsTitle: 'Le Soleil et la Lune',
  lightsLede: 'Les deux luminaires par lesquels l’astrologie commence : où ils se trouvent, et ce que leurs signes représentent traditionnellement.',
  moonLink: 'La Lune de ce soir, en détail',
  sunTag: (degree) => `Soleil · ${degree}`,
  moonTag: (degree, percent) => `Lune · ${degree} · éclairée à ${percent} %`,
  sunIn: (sign) => `Soleil en ${sign}`,
  moonIn: (sign) => `Lune en ${sign}`,
  sunNote: (third, ingress) => `Le Soleil se trouve dans ${['le premier tiers', 'le tiers central', 'le dernier tiers'][third]} du signe${ingress ? ` et entre en ${ingress.sign} le ${ingress.date}` : ''}.`,
  moonNote: (age, single, lastDegree) => `La Nouvelle Lune remonte à ${age} ${single ? 'jour' : 'jours'}${lastDegree ? ', et la Lune est dans le dernier degré du signe' : ''}.`,
  moonAge: (age, single) => `Âge : ${age} ${single ? 'jour' : 'jours'}`,
  cycleAria: 'Ce cycle lunaire',
  signsKicker: 'Ton signe',
  signsLede: 'Choisis ton signe solaire. Chaque note vient des positions relevées du ciel du jour, lues depuis les maisons solaires de ton signe ; les relevés sous chaque lecture disent exactement d’où elle vient. Ce sont des thèmes à observer, pas des consignes.',
  allHoroscopes: 'Tous les horoscopes',
  signsAria: 'Signes',
  horoscopeLink: (sign) => `Horoscope ${sign} du jour`,
  guideLink: (sign) => `Guide ${of(sign)}`,
  personalTitle: 'Ton thème face au ciel du jour',
  personalBody: 'Avec ta date, ton heure et ton lieu de naissance, ton thème astral se calcule ici, dans ton navigateur. La comparaison privée d’un thème enregistré avec chaque édition se trouve, pour l’instant, dans l’édition anglaise.',
  personalCompare: 'Voir la comparaison privée',
  planetsTitle: 'Où sont les planètes',
  planetsSub: (date) => `12 h UTC, ${date}.`,
  planetsSubMore: ' Chaque corps avec ce qu’il représente traditionnellement.',
  topics: {
    Sun: 'l’identité et la direction',
    Moon: 'les besoins affectifs et les instincts',
    Mercury: 'la pensée et la communication',
    Venus: 'l’affection, le plaisir et les valeurs',
    Mars: 'l’élan et l’affirmation de soi',
    Jupiter: 'la croissance et les convictions',
    Saturn: 'la responsabilité et la construction sur la durée',
    Uranus: 'l’indépendance et le changement',
    Neptune: 'l’imagination et les idéaux',
    Pluto: 'le pouvoir et les transformations profondes',
  },
  direct: 'Direct',
  retrograde: 'Rétrograde',
  station: (type, clock) => `${type === 'retrograde' ? 'Rétrograde' : 'Direct'} depuis ${clock} UTC`,
  comingTitle: 'Ce qui vient dans le ciel',
  comingSub: 'Dates en UTC : certaines tombent un jour plus tôt sur le continent américain.',
  eclipseTitle: (type, kind, sign) => `Éclipse ${type} ${kind} en ${sign}`,
  eclipseShort: (type, kind) => `éclipse ${type} ${kind}`,
  eclipseType: { solar: 'solaire', lunar: 'lunaire' },
  eclipseKind: { total: 'totale', partial: 'partielle', annular: 'annulaire', penumbral: 'pénombrale', hybrid: 'hybride' },
  ingressTitle: (subject, sign) => `${cap(subject)} entre en ${sign}`,
  ingressDetail: (retrograde, from) => `${retrograde ? 'Rétrograde, depuis' : 'Depuis'} ${from}`,
  lunationTitle: (type, sign) => `${type === 'new' ? 'Nouvelle Lune' : 'Pleine Lune'} en ${sign}`,
  stationTitle: (planet, type) => `${planet} ${type === 'retrograde' ? 'devient rétrograde' : 'redevient direct'}`,
  aspectDetail: (a, b) => `${a} et ${b}`,
  nextEclipse: (name, date) => `Prochaine éclipse : ${name}, ${date}`,
  calendarLink: 'Le calendrier complet du ciel',
  dayEvent: (event) => {
    if (event.kind === 'station' && event.planet) {
      return `${named('fr', event.planet)} ${event.type === 'retrograde' ? 'devient rétrograde' : 'redevient direct'}`;
    }
    if (event.kind === 'aspect' && event.a && event.b && event.type) {
      return `${named('fr', event.a)} et ${named('fr', event.b)} forment ${EXACT[event.type] ?? aspectLabel('fr', event.type)}`;
    }
    if (event.kind === 'ingress' && event.planet && event.sign) return `${named('fr', event.planet)} entre en ${signName(event.sign, 'fr')}`;
    if (event.kind === 'lunation' && event.sign) return `la ${event.type === 'new' ? 'Nouvelle Lune' : 'Pleine Lune'} a lieu en ${signName(event.sign, 'fr')}`;
    return null;
  },
  rxTitle: 'Les rétrogrades en un coup d’œil',
  rxLink: 'Toutes les dates des rétrogrades',
  rxNone: ['Aucune planète n’est rétrograde ', TODAY, '.'],
  rxNow: (list, count) => [`${list} ${count === 1 ? 'est rétrograde' : 'sont rétrogrades'} `, TODAY, '.'],
  rxNext: (planet, date) => [`${planet} devient rétrograde le ${date}.`],
  rxEnded: (planet, date) => (date
    ? [`La phase rétrograde de ${planet} s’est terminée le ${date}.`]
    : [`La phase rétrograde de ${planet} s’est terminée `, TODAY, '.']),
  rxTableAria: (range) => `Phases rétrogrades ${range}`,
  rxPlanet: 'Planète',
  rxPeriod: 'Période',
  rxNowPrefix: 'Rétrograde · ',
  rxNowDirect: ', de nouveau direct',
  rxStateNow: 'Rétrograde en ce moment',
  rxStateUpcoming: 'À venir',
  rxStateEnded: 'Terminé',
  rxMeansKicker: 'Ce que veut dire rétrograde',
  rxMeans: 'Vue depuis la Terre, une planète semble parfois ralentir, s’arrêter puis reculer devant le fond des étoiles. Son orbite réelle ne change pas. Les astrologues lisent depuis longtemps ces phases comme un temps de révision : on reprend les thèmes de la planète plutôt que d’en commencer de nouveaux.',
  aspectsTitle: 'Les aspects les plus exacts',
  aspectsLede: (all, shown) => {
    if (all > shown) return `Les aspects sont les angles entre les planètes. ${cap(word(all))} sont à moins de trois degrés de l’exactitude à 12 h UTC ; voici les ${word(shown)} plus exacts.`;
    return `Les aspects sont les angles entre les planètes. ${all === 1 ? 'Celui-ci est' : `Ces ${word(all)} aspects sont`} à moins de trois degrés de l’exactitude à 12 h UTC.`;
  },
  definitions: {
    conjunction: 'Un aspect de 0° qui réunit deux parties du thème au même endroit.',
    sextile: 'Un aspect de 60°, lu comme une occasion de coopérer pour deux parties du thème.',
    square: 'Un aspect de 90°, lu comme une friction qui demande d’agir ou de s’ajuster.',
    trine: 'Un aspect de 120°, lu comme un lien fluide entre deux parties du thème.',
    opposition: 'Un aspect de 180° qui place deux points du thème face à face.',
  },
  represent: (a, topicA, b, topicB) => `Par tradition, ${a} représente ${topicA} ; ${b}, ${topicB}.`,
  exactAt: (clock) => `Exact à ${clock} UTC`,
  fromExact: (orb) => `À ${orb} de l’exactitude`,
  furtherTitle: 'Pour aller plus loin',
  furtherLede: 'D’autres façons de suivre le ciel, date après date.',
  allTools: 'Tous les outils',
  tools: [
    { href: '/transits/', title: 'Transits', promise: 'Le ciel du jour comparé à ton thème.' },
    { href: '/moon-phase/', title: 'Phase de la Lune', promise: 'La Lune de ce soir, ou celle de n’importe quelle date.' },
    { href: '/sky-calendar/', title: 'Calendrier du ciel', promise: 'Nouvelles et Pleines Lunes dans ton agenda.' },
    { href: '/eclipses/', title: 'Éclipses', promise: 'Les éclipses de Soleil et de Lune jusqu’en 2030.' },
  ],
  askTitle: 'Des questions sur le ciel du jour ?',
  askLead: 'Guide est un assistant d’IA pour les questions d’astrologie et pour t’aider à utiliser Zodiacs.',
  askLabel: 'Demander à Guide',
  prompts: [
    'Que signifie le ciel du jour pour mon signe ?',
    'Qu’est-ce qu’une planète rétrograde ?',
    'Comment lire le ciel du jour dans mon thème astral ?',
  ],
  methodTitle: 'Comment cette page est faite',
  methodBody: (date) => `Les positions sont calculées pour 12 h UTC à la date de l’édition, le ${date}. Les heures du calendrier sont en UTC. Les notes par signe décrivent des thèmes de réflexion, pas des conseils.`,
  coverage: 'Cette édition n’utilise que les positions des planètes ; l’heure exacte des événements n’est pas disponible pour cette date.',
  provenanceLabel: 'Derrière cette lecture quotidienne',
  provenanceDescription: 'Données du ciel, limites et choix éditoriaux',
  provenanceBefore: 'Chaque note est rattachée au ciel relevé le ',
  provenanceAfter: ', date de l’édition en UTC ; les positions des planètes reprennent un instantané à 12 h UTC. Les notes en français partent des mêmes faits que l’édition anglaise, avec des gabarits écrits dans cette langue, et un test automatique vérifie que chacune renvoie à la même maison et au même corps que sa version anglaise.',
  methodLink: 'Notre méthode de calcul',
  publicationLink: 'Comment chaque édition est publiée',
  correctionsLink: 'Corrections',
};

const hub: HubCopy = {
  title: (date) => `Horoscopes du jour, ${date} | Zodiacs.org`,
  description: (date) => `Horoscopes du jour, ${date} : une note claire pour chacun des douze signes, calculée à partir des positions réelles du ciel.`,
  imageAlt: 'Horoscopes du jour pour les douze signes, Zodiacs.org',
  h1: 'Horoscopes du jour',
  dateline: (date) => `Édition quotidienne · ${date}`,
  lede: 'Trouve ton signe et lis la note la plus concrète sur le ciel du jour. Commence par ton signe solaire puis, si tu le connais, ton ascendant.',
  stamp: (date) => `Mis à jour chaque jour · ${date}`,
  jumpLabel: 'Va à ton signe',
  pickerAria: 'Choisis ton signe',
  read: 'Lire aujourd’hui →',
  notePersonal: 'Tu veux une lecture plus personnelle ? ',
  noteChart: 'Calcule ton thème astral gratuitement',
  noteSky: ' Le ciel complet, planète par planète, se trouve sur ',
  noteSkyLink: 'la page du ciel du jour',
  noteLonger: '. Les lectures de demain, de la semaine et du mois sont dans ',
  noteEnglish: 'l’édition anglaise',
  askLead: 'Tu ne sais pas par où commencer ?',
  askLabel: 'Demander à Guide',
  prompts: [
    'Dois-je lire mon signe solaire ou mon ascendant ?',
    'Que signifie le ciel du jour pour tout le monde ?',
    'Comment ces horoscopes sont-ils calculés ?',
  ],
  methodSummary: 'Derrière ces lectures',
  methodBefore: (date) => `Voici l’édition UTC du ${date} ; les positions reprennent le ciel relevé à 12 h UTC. Les horoscopes par signe solaire donnent la vue d’ensemble. Consulte `,
  methodLink: 'notre méthode de calcul',
};

export const fr: { horoscope: Copy; today: TodayCopy; hub: HubCopy } = { horoscope, today, hub };
