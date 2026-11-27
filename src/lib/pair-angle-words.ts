/**
 * The words of the pair pages' "angle between you" plate
 * (src/components/compat/PairAnglePlate.astro), one table per pair page
 * language. The facts (signs apart, degrees, aspect, what the two signs
 * share) are computed once in src/lib/pair-angle.ts; these tables only word
 * them. English is the plate as first published.
 *
 * The translations follow each language's pair pages
 * (src/components/compat/LocalizedPairPage.astro, src/lib/compat-i18n.ts):
 * the couple is addressed as ustedes, vocês, vous and voi, as the pair notes
 * do; the polarity words are the pages' own (extrovertido / reservado,
 * extraverti / réservé, estroverso / riservato); element and modality names
 * come from signs.ts; the five major aspects take aspectLabel's names
 * (src/lib/i18n/astrology.ts). French and Italian put an article before a
 * sign in running text, through the helpers in sun-year-words.ts.
 * Geometry and shared make-up only: no line says how a couple gets on.
 * No dashes in any line.
 */
import { elementLabel, modalityLabel, signName, type Modality, type Sign } from './signs';
import { aspectLabel } from './i18n/astrology';
import { frElement, frThe, itElement, itIn, itThe } from './sun-year-words';

export type PairAngleLocale = 'en' | 'es' | 'fr' | 'it' | 'pt';
export const PAIR_ANGLE_LOCALES: readonly PairAngleLocale[] = ['en', 'es', 'fr', 'it', 'pt'];

export type PairAspect = 'conjunction' | 'semi-sextile' | 'sextile' | 'square' | 'trine' | 'quincunx' | 'opposition';

/** What the words are given: the two signs and the computed geometry. */
export interface PairAngleFacts {
  a: Sign;
  b: Sign;
  same: boolean;
  /** Signs apart the shorter way round, 0 to 6. */
  steps: number;
  degrees: number;
  aspect: PairAspect;
  sharesElement: boolean;
  sharesModality: boolean;
}

export interface PairAngleWords {
  /** "The angle between you". */
  kicker: string;
  heading: (f: PairAngleFacts) => string;
  lede: (f: PairAngleFacts) => string;
  /** The wheel's accessible name. */
  alt: (f: PairAngleFacts) => string;
  /** Under the centre number. */
  aspect: Readonly<Record<PairAspect, string>>;
  /** Share of the wheel the angle spans, by signs apart. */
  share: readonly string[];
  signsApart: string;
  sameSign: string;
  shorterWay: string;
  angle: string;
  elements: string;
  modalities: string;
  /** "Both fire" / "Fire and air". */
  elementPair: (f: PairAngleFacts) => string;
  /** "Both cardinal" / "Cardinal and fixed". */
  modalityPair: (f: PairAngleFacts) => string;
  elementShared: { yes: string; no: string };
  modalityShared: { yes: string; no: string };
  /** The link to an aspect's own Learn page. */
  learn: (aspect: PairAspect) => string;
  /** The link to the aspects index, for the two minor aspects. */
  learnIndex: string;
  source: string;
}

const lower = (value: string) => value.charAt(0).toLocaleLowerCase() + value.slice(1);
const upper = (value: string) => value.charAt(0).toLocaleUpperCase() + value.slice(1);
const pick = (steps: number, lines: readonly string[]) => lines[steps];

/* ── English ─────────────────────────────────────────────────── */
const EN_COUNT = ['none', 'one', 'two', 'three', 'four', 'five', 'six'];
const enElement = (s: Sign) => lower(elementLabel(s.element));
const enModality = (s: Sign) => lower(modalityLabel(s.modality));
const enPolarity = (s: Sign) => (s.polarity === 'day' ? 'outgoing' : 'private');

const EN: PairAngleWords = {
  kicker: 'The angle between you',
  heading: ({ a, b, steps }) => {
    const pair = `${a.name} and ${b.name}`;
    return pick(steps, [
      `${a.name} and ${a.name} share one sign`,
      `${pair} are next-door signs`,
      `${pair} are two signs apart`,
      `${pair} are three signs apart`,
      `${pair} are four signs apart`,
      `${pair} are five signs apart`,
      `${pair} sit opposite each other`,
    ]);
  },
  lede: ({ a, b, steps }) => {
    const pair = `${a.name} and ${b.name}`;
    const element = enElement(a);
    const modality = enModality(a);
    const polarity = enPolarity(a);
    return pick(steps, [
      `Both Suns sit in ${a.name}, at the same point on the wheel, the angle astrology calls a conjunction. You share everything a sign is made of: the element (${element}), the modality (${modality}) and the polarity (${polarity}).`,
      `Next-door signs are 30 degrees apart, a semi-sextile. ${pair} share no element, no modality and no polarity: all three change from one sign to the next.`,
      `Two signs apart is 60 degrees, a sextile, a sixth of the wheel. ${pair} share a polarity, both ${polarity}, but not an element or a modality.`,
      `Three signs apart is 90 degrees, a square, a quarter of the wheel. ${pair} share a modality, both ${modality}, and differ in element and polarity.`,
      `Four signs apart is 120 degrees, a trine, a third of the wheel. ${pair} share an element, both ${element}, and a polarity, and differ in modality.`,
      `Five signs apart is 150 degrees, a quincunx. Like next-door signs, ${pair} share no element, no modality and no polarity.`,
      `Six signs apart is 180 degrees, an opposition, half the wheel. ${pair} share a modality, both ${modality}, and a polarity, both ${polarity}, and differ only in element.`,
    ]);
  },
  alt: ({ a, b, same, steps, degrees, aspect }) => (same
    ? `A zodiac wheel of twelve signs with Aries at the top. ${a.name} is ringed: both Suns sit in the same sign, 0 degrees apart, a conjunction.`
    : `A zodiac wheel of twelve signs with Aries at the top. A line joins ${a.name} and ${b.name}, ${EN_COUNT[steps]} ${steps === 1 ? 'sign' : 'signs'} and ${degrees} degrees apart, a ${aspect}.`),
  aspect: {
    conjunction: 'conjunction', 'semi-sextile': 'semi-sextile', sextile: 'sextile', square: 'square',
    trine: 'trine', quincunx: 'quincunx', opposition: 'opposition',
  },
  share: ['the same point', 'a twelfth of the wheel', 'a sixth of the wheel', 'a quarter of the wheel', 'a third of the wheel', 'five twelfths of the wheel', 'half the wheel'],
  signsApart: 'Signs apart',
  sameSign: 'the same sign',
  shorterWay: 'the shorter way round',
  angle: 'Angle',
  elements: 'Elements',
  modalities: 'Modalities',
  elementPair: ({ a, b, sharesElement }) => (sharesElement ? `Both ${enElement(a)}` : `${elementLabel(a.element)} and ${enElement(b)}`),
  modalityPair: ({ a, b, sharesModality }) => (sharesModality ? `Both ${enModality(a)}` : `${modalityLabel(a.modality)} and ${enModality(b)}`),
  elementShared: { yes: 'shared', no: 'not shared' },
  modalityShared: { yes: 'shared', no: 'not shared' },
  learn: (aspect) => `The ${aspect} in a birth chart`,
  learnIndex: 'The five major aspects',
  source: 'Counted sign to sign, 30 degrees a sign. The exact angle between two Suns depends on the birth dates.',
};

/*
 * The modality as a feminine adjective (it describes "la modalidad",
 * "la modalité" and so on) and in the masculine plural (it describes two
 * signs); the polarity likewise.
 */
type Forms = { f: Readonly<Record<Modality, string>>; pl: Readonly<Record<Modality, string>> };
type PolarityForms = { f: { day: string; night: string }; pl: { day: string; night: string } };

/* ── Spanish: ustedes, as the pair notes ─────────────────────── */
const ES_MODALITY: Forms = {
  f: { cardinal: 'cardinal', fixed: 'fija', mutable: 'mutable' },
  pl: { cardinal: 'cardinales', fixed: 'fijos', mutable: 'mutables' },
};
const ES_POLARITY: PolarityForms = {
  f: { day: 'extrovertida', night: 'reservada' },
  pl: { day: 'extrovertidos', night: 'reservados' },
};
const ES_COUNT = ['ningún', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis'];
const esElement = (s: Sign) => lower(elementLabel(s.element, 'es'));
const esName = (s: Sign) => signName(s, 'es');

const ES_ASPECT_A: Readonly<Record<PairAspect, string>> = {
  conjunction: 'una conjunción', 'semi-sextile': 'un semisextil', sextile: 'un sextil', square: 'una cuadratura',
  trine: 'un trígono', quincunx: 'un quincuncio', opposition: 'una oposición',
};
const ES_ASPECT_THE: Readonly<Record<PairAspect, string>> = {
  conjunction: 'La conjunción', 'semi-sextile': 'El semisextil', sextile: 'El sextil', square: 'La cuadratura',
  trine: 'El trígono', quincunx: 'El quincuncio', opposition: 'La oposición',
};

const ES: PairAngleWords = {
  kicker: 'El ángulo entre ustedes',
  heading: ({ a, b, steps }) => {
    const pair = `${esName(a)} y ${esName(b)}`;
    return pick(steps, [
      `${esName(a)} y ${esName(a)} comparten un mismo signo`,
      `${pair} son signos vecinos`,
      `${pair} están a dos signos de distancia`,
      `${pair} están a tres signos de distancia`,
      `${pair} están a cuatro signos de distancia`,
      `${pair} están a cinco signos de distancia`,
      `${pair} son signos opuestos`,
    ]);
  },
  lede: ({ a, b, steps }) => {
    const pair = `${esName(a)} y ${esName(b)}`;
    const element = esElement(a);
    return pick(steps, [
      `Los dos Soles están en ${esName(a)}, en el mismo punto de la rueda, el ángulo que la astrología llama conjunción. Comparten todo lo que forma un signo: el elemento (${element}), la modalidad (${ES_MODALITY.f[a.modality]}) y la polaridad (${ES_POLARITY.f[a.polarity]}).`,
      `Los signos vecinos están a 30 grados de distancia, un semisextil. ${pair} no comparten elemento, ni modalidad, ni polaridad: las tres cosas cambian de un signo al siguiente.`,
      `Dos signos de distancia son 60 grados, un sextil, un sexto de la rueda. ${pair} comparten polaridad, los dos ${ES_POLARITY.pl[a.polarity]}, pero no elemento ni modalidad.`,
      `Tres signos de distancia son 90 grados, una cuadratura, un cuarto de la rueda. ${pair} comparten modalidad, los dos ${ES_MODALITY.pl[a.modality]}, y se diferencian en elemento y polaridad.`,
      `Cuatro signos de distancia son 120 grados, un trígono, un tercio de la rueda. ${pair} comparten elemento, los dos de ${element}, y polaridad, y se diferencian en modalidad.`,
      `Cinco signos de distancia son 150 grados, un quincuncio. Como los signos vecinos, ${pair} no comparten elemento, ni modalidad, ni polaridad.`,
      `Seis signos de distancia son 180 grados, una oposición, la mitad de la rueda. ${pair} comparten modalidad, los dos ${ES_MODALITY.pl[a.modality]}, y polaridad, los dos ${ES_POLARITY.pl[a.polarity]}, y solo se diferencian en elemento.`,
    ]);
  },
  alt: ({ a, b, same, steps, degrees, aspect }) => (same
    ? `Una rueda zodiacal de doce signos con Aries arriba. Un círculo rodea ${esName(a)}: los dos Soles están en el mismo signo, a 0 grados, una conjunción.`
    : `Una rueda zodiacal de doce signos con Aries arriba. Una línea une ${esName(a)} y ${esName(b)}, a ${ES_COUNT[steps]} ${steps === 1 ? 'signo' : 'signos'} y ${degrees} grados de distancia, ${ES_ASPECT_A[aspect]}.`),
  aspect: {
    conjunction: aspectLabel('es', 'conjunction'), 'semi-sextile': 'semisextil', sextile: aspectLabel('es', 'sextile'),
    square: aspectLabel('es', 'square'), trine: aspectLabel('es', 'trine'), quincunx: 'quincuncio',
    opposition: aspectLabel('es', 'opposition'),
  },
  share: ['el mismo punto', 'un doceavo de la rueda', 'un sexto de la rueda', 'un cuarto de la rueda', 'un tercio de la rueda', 'cinco doceavos de la rueda', 'la mitad de la rueda'],
  signsApart: 'Signos de distancia',
  sameSign: 'el mismo signo',
  shorterWay: 'por el lado más corto',
  angle: 'Ángulo',
  elements: 'Elementos',
  modalities: 'Modalidades',
  elementPair: ({ a, b, sharesElement }) => (sharesElement ? `Dos signos de ${esElement(a)}` : `${elementLabel(a.element, 'es')} y ${esElement(b)}`),
  modalityPair: ({ a, b, sharesModality }) => (sharesModality ? `Dos signos ${ES_MODALITY.pl[a.modality]}` : `${modalityLabel(a.modality, 'es')} y ${lower(modalityLabel(b.modality, 'es'))}`),
  elementShared: { yes: 'compartido', no: 'no compartido' },
  modalityShared: { yes: 'compartida', no: 'no compartida' },
  learn: (aspect) => `${ES_ASPECT_THE[aspect]} en una carta natal`,
  learnIndex: 'Los cinco aspectos mayores',
  source: 'Contado de signo a signo, 30 grados por signo. El ángulo exacto entre dos Soles depende de las fechas de nacimiento.',
};
/* ── Portuguese (Brazil): vocês, as the pair notes ───────────── */
const PT_MODALITY: Forms = {
  f: { cardinal: 'cardinal', fixed: 'fixa', mutable: 'mutável' },
  pl: { cardinal: 'cardinais', fixed: 'fixos', mutable: 'mutáveis' },
};
const PT_POLARITY: PolarityForms = {
  f: { day: 'extrovertida', night: 'reservada' },
  pl: { day: 'extrovertidos', night: 'reservados' },
};
const PT_COUNT = ['nenhum', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis'];
const ptElement = (s: Sign) => lower(elementLabel(s.element, 'pt'));
const ptName = (s: Sign) => signName(s, 'pt');
const PT_ASPECT_A: Readonly<Record<PairAspect, string>> = {
  conjunction: 'uma conjunção', 'semi-sextile': 'um semissextil', sextile: 'um sextil', square: 'uma quadratura',
  trine: 'um trígono', quincunx: 'um quincúncio', opposition: 'uma oposição',
};
const PT_ASPECT_THE: Readonly<Record<PairAspect, string>> = {
  conjunction: 'A conjunção', 'semi-sextile': 'O semissextil', sextile: 'O sextil', square: 'A quadratura',
  trine: 'O trígono', quincunx: 'O quincúncio', opposition: 'A oposição',
};

const PT: PairAngleWords = {
  kicker: 'O ângulo entre vocês',
  heading: ({ a, b, steps }) => {
    const pair = `${ptName(a)} e ${ptName(b)}`;
    return pick(steps, [
      `${ptName(a)} e ${ptName(a)} compartilham o mesmo signo`,
      `${pair} são signos vizinhos`,
      `${pair} estão a dois signos de distância`,
      `${pair} estão a três signos de distância`,
      `${pair} estão a quatro signos de distância`,
      `${pair} estão a cinco signos de distância`,
      `${pair} são signos opostos`,
    ]);
  },
  lede: ({ a, b, steps }) => {
    const pair = `${ptName(a)} e ${ptName(b)}`;
    const element = ptElement(a);
    return pick(steps, [
      `Os dois Sóis estão em ${ptName(a)}, no mesmo ponto da roda, o ângulo que a astrologia chama de conjunção. Vocês compartilham tudo o que forma um signo: o elemento (${element}), a modalidade (${PT_MODALITY.f[a.modality]}) e a polaridade (${PT_POLARITY.f[a.polarity]}).`,
      `Signos vizinhos estão a 30 graus um do outro, um semissextil. ${pair} não compartilham elemento, modalidade nem polaridade: os três mudam de um signo para o seguinte.`,
      `Dois signos de distância são 60 graus, um sextil, um sexto da roda. ${pair} compartilham a polaridade, os dois ${PT_POLARITY.pl[a.polarity]}, mas não o elemento nem a modalidade.`,
      `Três signos de distância são 90 graus, uma quadratura, um quarto da roda. ${pair} compartilham a modalidade, os dois ${PT_MODALITY.pl[a.modality]}, e diferem no elemento e na polaridade.`,
      `Quatro signos de distância são 120 graus, um trígono, um terço da roda. ${pair} compartilham o elemento, os dois de ${element}, e a polaridade, e diferem na modalidade.`,
      `Cinco signos de distância são 150 graus, um quincúncio. Como os signos vizinhos, ${pair} não compartilham elemento, modalidade nem polaridade.`,
      `Seis signos de distância são 180 graus, uma oposição, metade da roda. ${pair} compartilham a modalidade, os dois ${PT_MODALITY.pl[a.modality]}, e a polaridade, os dois ${PT_POLARITY.pl[a.polarity]}, e diferem só no elemento.`,
    ]);
  },
  alt: ({ a, b, same, steps, degrees, aspect }) => (same
    ? `Uma roda do zodíaco com os doze signos e Áries no alto. Um círculo envolve ${ptName(a)}: os dois Sóis estão no mesmo signo, a 0 graus, uma conjunção.`
    : `Uma roda do zodíaco com os doze signos e Áries no alto. Uma linha liga ${ptName(a)} e ${ptName(b)}, a ${PT_COUNT[steps]} ${steps === 1 ? 'signo' : 'signos'} e ${degrees} graus de distância, ${PT_ASPECT_A[aspect]}.`),
  aspect: {
    conjunction: aspectLabel('pt', 'conjunction'), 'semi-sextile': 'semissextil', sextile: aspectLabel('pt', 'sextile'),
    square: aspectLabel('pt', 'square'), trine: aspectLabel('pt', 'trine'), quincunx: 'quincúncio',
    opposition: aspectLabel('pt', 'opposition'),
  },
  share: ['o mesmo ponto', 'a duodécima parte da roda', 'um sexto da roda', 'um quarto da roda', 'um terço da roda', 'cinco doze avos da roda', 'metade da roda'],
  signsApart: 'Signos de distância',
  sameSign: 'o mesmo signo',
  shorterWay: 'pelo lado mais curto',
  angle: 'Ângulo',
  elements: 'Elementos',
  modalities: 'Modalidades',
  elementPair: ({ a, b, sharesElement }) => (sharesElement ? `Dois signos de ${ptElement(a)}` : `${elementLabel(a.element, 'pt')} e ${ptElement(b)}`),
  modalityPair: ({ a, b, sharesModality }) => (sharesModality ? `Dois signos ${PT_MODALITY.pl[a.modality]}` : `${modalityLabel(a.modality, 'pt')} e ${lower(modalityLabel(b.modality, 'pt'))}`),
  elementShared: { yes: 'compartilhado', no: 'não compartilhado' },
  modalityShared: { yes: 'compartilhada', no: 'não compartilhada' },
  learn: (aspect) => `${PT_ASPECT_THE[aspect]} no mapa astral`,
  learnIndex: 'Os cinco aspectos maiores',
  source: 'Contado de signo em signo, 30 graus por signo. O ângulo exato entre dois Sóis depende das datas de nascimento.',
};

/* ── French: vous for the couple, as the pair notes; le Bélier ─ */
// The pair page's French copy sets a narrow no-break space before a colon.
const FR_COLON = ' :';
const FR_MODALITY: Forms = {
  f: { cardinal: 'cardinale', fixed: 'fixe', mutable: 'mutable' },
  pl: { cardinal: 'cardinaux', fixed: 'fixes', mutable: 'mutables' },
};
const FR_POLARITY: PolarityForms = {
  f: { day: 'extravertie', night: 'réservée' },
  pl: { day: 'extravertis', night: 'réservés' },
};
const FR_COUNT = ['aucun', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six'];
const frName = (s: Sign) => signName(s, 'fr');
/** "le Bélier et le Lion"; capitalised at the start of a sentence. */
const frPair = (a: Sign, b: Sign) => `${frThe(a.slug)} et ${frThe(b.slug)}`;
const FR_ASPECT_A: Readonly<Record<PairAspect, string>> = {
  conjunction: 'une conjonction', 'semi-sextile': 'un semi-sextile', sextile: 'un sextile', square: 'un carré',
  trine: 'un trigone', quincunx: 'un quinconce', opposition: 'une opposition',
};
const FR_ASPECT_THE: Readonly<Record<PairAspect, string>> = {
  conjunction: 'La conjonction', 'semi-sextile': 'Le semi-sextile', sextile: 'Le sextile', square: 'Le carré',
  trine: 'Le trigone', quincunx: 'Le quinconce', opposition: 'L’opposition',
};

const FR: PairAngleWords = {
  kicker: 'L’angle entre vous',
  heading: ({ a, b, steps }) => {
    const pair = `${frName(a)} et ${frName(b)}`;
    return pick(steps, [
      `${frName(a)} et ${frName(a)}, un seul et même signe`,
      `${pair}, deux signes voisins`,
      `${pair}, à deux signes d’écart`,
      `${pair}, à trois signes d’écart`,
      `${pair}, à quatre signes d’écart`,
      `${pair}, à cinq signes d’écart`,
      `${pair}, deux signes opposés`,
    ]);
  },
  lede: ({ a, b, steps }) => {
    const pair = upper(frPair(a, b));
    const element = lower(elementLabel(a.element, 'fr'));
    return pick(steps, [
      `Les deux Soleils sont dans ${frThe(a.slug)}, au même point de la roue, l’angle que l’astrologie appelle une conjonction. Vous partagez tout ce qui compose un signe${FR_COLON} l’élément (${element}), la modalité (${FR_MODALITY.f[a.modality]}) et la polarité (${FR_POLARITY.f[a.polarity]}).`,
      `Deux signes voisins sont à 30 degrés l’un de l’autre, un semi-sextile. ${pair} n’ont en commun ni élément, ni modalité, ni polarité${FR_COLON} les trois changent d’un signe au suivant.`,
      `Deux signes d’écart font 60 degrés, un sextile, un sixième de la roue. ${pair} partagent une polarité, tous deux ${FR_POLARITY.pl[a.polarity]}, mais ni élément ni modalité.`,
      `Trois signes d’écart font 90 degrés, un carré, un quart de la roue. ${pair} partagent une modalité, tous deux ${FR_MODALITY.pl[a.modality]}, et diffèrent par l’élément et la polarité.`,
      `Quatre signes d’écart font 120 degrés, un trigone, un tiers de la roue. ${pair} partagent un élément, tous deux signes ${frElement(a.element)}, et une polarité, et diffèrent par la modalité.`,
      `Cinq signes d’écart font 150 degrés, un quinconce. Comme deux signes voisins, ${frPair(a, b)} n’ont en commun ni élément, ni modalité, ni polarité.`,
      `Six signes d’écart font 180 degrés, une opposition, la moitié de la roue. ${pair} partagent une modalité, tous deux ${FR_MODALITY.pl[a.modality]}, et une polarité, tous deux ${FR_POLARITY.pl[a.polarity]}, et ne diffèrent que par l’élément.`,
    ]);
  },
  alt: ({ a, b, same, steps, degrees, aspect }) => (same
    ? `Une roue du zodiaque de douze signes, le Bélier en haut. Un cercle entoure ${frThe(a.slug)}${FR_COLON} les deux Soleils sont dans le même signe, à 0 degré, une conjonction.`
    : `Une roue du zodiaque de douze signes, le Bélier en haut. Une ligne relie ${frPair(a, b)}, à ${FR_COUNT[steps]} ${steps === 1 ? 'signe' : 'signes'} et ${degrees} degrés l’un de l’autre, ${FR_ASPECT_A[aspect]}.`),
  aspect: {
    conjunction: aspectLabel('fr', 'conjunction'), 'semi-sextile': 'semi-sextile', sextile: aspectLabel('fr', 'sextile'),
    square: aspectLabel('fr', 'square'), trine: aspectLabel('fr', 'trine'), quincunx: 'quinconce',
    opposition: aspectLabel('fr', 'opposition'),
  },
  share: ['le même point', 'un douzième de la roue', 'un sixième de la roue', 'un quart de la roue', 'un tiers de la roue', 'cinq douzièmes de la roue', 'la moitié de la roue'],
  signsApart: 'Signes d’écart',
  sameSign: 'le même signe',
  shorterWay: 'par le plus court chemin',
  angle: 'Angle',
  elements: 'Éléments',
  modalities: 'Modalités',
  elementPair: ({ a, b, sharesElement }) => (sharesElement ? `Deux signes ${frElement(a.element)}` : `${elementLabel(a.element, 'fr')} et ${lower(elementLabel(b.element, 'fr'))}`),
  modalityPair: ({ a, b, sharesModality }) => (sharesModality ? `Deux signes ${FR_MODALITY.pl[a.modality]}` : `${modalityLabel(a.modality, 'fr')} et ${lower(modalityLabel(b.modality, 'fr'))}`),
  elementShared: { yes: 'partagé', no: 'non partagé' },
  modalityShared: { yes: 'partagée', no: 'non partagée' },
  learn: (aspect) => `${FR_ASPECT_THE[aspect]} dans un thème natal`,
  learnIndex: 'Les cinq aspects majeurs',
  source: 'Compté de signe en signe, 30 degrés par signe. L’angle exact entre deux Soleils dépend des dates de naissance.',
};

/* ── Italian: voi for the couple, as the pair notes; l’Ariete ── */
const IT_MODALITY: Forms = {
  f: { cardinal: 'cardinale', fixed: 'fissa', mutable: 'mobile' },
  pl: { cardinal: 'cardinali', fixed: 'fissi', mutable: 'mobili' },
};
const IT_POLARITY: PolarityForms = {
  f: { day: 'estroversa', night: 'riservata' },
  pl: { day: 'estroversi', night: 'riservati' },
};
const IT_COUNT = ['nessun', 'un', 'due', 'tre', 'quattro', 'cinque', 'sei'];
const itName = (s: Sign) => signName(s, 'it');
/** "l’Ariete e il Leone"; capitalised at the start of a sentence. */
const itPair = (a: Sign, b: Sign) => `${itThe(a.slug)} e ${itThe(b.slug)}`;
const IT_ASPECT_A: Readonly<Record<PairAspect, string>> = {
  conjunction: 'una congiunzione', 'semi-sextile': 'un semisestile', sextile: 'un sestile', square: 'una quadratura',
  trine: 'un trigono', quincunx: 'un quinconce', opposition: 'un’opposizione',
};
const IT_ASPECT_THE: Readonly<Record<PairAspect, string>> = {
  conjunction: 'La congiunzione', 'semi-sextile': 'Il semisestile', sextile: 'Il sestile', square: 'La quadratura',
  trine: 'Il trigono', quincunx: 'Il quinconce', opposition: 'L’opposizione',
};

const IT: PairAngleWords = {
  kicker: 'L’angolo tra voi',
  heading: ({ a, b, steps }) => {
    const pair = `${itName(a)} e ${itName(b)}`;
    return pick(steps, [
      `${itName(a)} e ${itName(a)}, uno stesso segno`,
      `${pair}, due segni vicini`,
      `${pair}, a due segni di distanza`,
      `${pair}, a tre segni di distanza`,
      `${pair}, a quattro segni di distanza`,
      `${pair}, a cinque segni di distanza`,
      `${pair}, due segni opposti`,
    ]);
  },
  lede: ({ a, b, steps }) => {
    const pair = upper(itPair(a, b));
    const element = lower(elementLabel(a.element, 'it'));
    return pick(steps, [
      `Entrambi i Soli sono ${itIn(a.slug)}, nello stesso punto della ruota, l’angolo che l’astrologia chiama congiunzione. Condividete tutto ciò di cui è fatto un segno: l’elemento (${element}), la modalità (${IT_MODALITY.f[a.modality]}) e la polarità (${IT_POLARITY.f[a.polarity]}).`,
      `I segni vicini distano 30 gradi, un semisestile. ${pair} non hanno in comune né l’elemento, né la modalità, né la polarità: cambiano tutte e tre da un segno al successivo.`,
      `Due segni di distanza sono 60 gradi, un sestile, un sesto della ruota. ${pair} condividono la polarità, entrambi ${IT_POLARITY.pl[a.polarity]}, ma non l’elemento né la modalità.`,
      `Tre segni di distanza sono 90 gradi, una quadratura, un quarto della ruota. ${pair} condividono la modalità, entrambi ${IT_MODALITY.pl[a.modality]}, e differiscono per elemento e polarità.`,
      `Quattro segni di distanza sono 120 gradi, un trigono, un terzo della ruota. ${pair} condividono l’elemento, entrambi segni ${itElement(a.element)}, e la polarità, e differiscono per la modalità.`,
      `Cinque segni di distanza sono 150 gradi, un quinconce. Come i segni vicini, ${itPair(a, b)} non hanno in comune né l’elemento, né la modalità, né la polarità.`,
      `Sei segni di distanza sono 180 gradi, un’opposizione, metà della ruota. ${pair} condividono la modalità, entrambi ${IT_MODALITY.pl[a.modality]}, e la polarità, entrambi ${IT_POLARITY.pl[a.polarity]}, e differiscono solo per l’elemento.`,
    ]);
  },
  alt: ({ a, b, same, steps, degrees, aspect }) => (same
    ? `Una ruota zodiacale di dodici segni con l’Ariete in alto. Un cerchio circonda ${itThe(a.slug)}: entrambi i Soli sono nello stesso segno, a 0 gradi, una congiunzione.`
    : `Una ruota zodiacale di dodici segni con l’Ariete in alto. Una linea unisce ${itPair(a, b)}, a ${IT_COUNT[steps]} ${steps === 1 ? 'segno' : 'segni'} e ${degrees} gradi di distanza, ${IT_ASPECT_A[aspect]}.`),
  aspect: {
    conjunction: aspectLabel('it', 'conjunction'), 'semi-sextile': 'semisestile', sextile: aspectLabel('it', 'sextile'),
    square: aspectLabel('it', 'square'), trine: aspectLabel('it', 'trine'), quincunx: 'quinconce',
    opposition: aspectLabel('it', 'opposition'),
  },
  share: ['lo stesso punto', 'un dodicesimo della ruota', 'un sesto della ruota', 'un quarto della ruota', 'un terzo della ruota', 'cinque dodicesimi della ruota', 'metà della ruota'],
  signsApart: 'Segni di distanza',
  sameSign: 'lo stesso segno',
  shorterWay: 'per la via più breve',
  angle: 'Angolo',
  elements: 'Elementi',
  modalities: 'Modalità',
  elementPair: ({ a, b, sharesElement }) => (sharesElement ? `Due segni ${itElement(a.element)}` : `${elementLabel(a.element, 'it')} e ${lower(elementLabel(b.element, 'it'))}`),
  modalityPair: ({ a, b, sharesModality }) => (sharesModality ? `Due segni ${IT_MODALITY.pl[a.modality]}` : `${modalityLabel(a.modality, 'it')} e ${lower(modalityLabel(b.modality, 'it'))}`),
  elementShared: { yes: 'condiviso', no: 'non condiviso' },
  modalityShared: { yes: 'condivisa', no: 'non condivisa' },
  learn: (aspect) => `${IT_ASPECT_THE[aspect]} nel tema natale`,
  learnIndex: 'I cinque aspetti maggiori',
  source: 'Contato segno per segno, 30 gradi a segno. L’angolo esatto tra due Soli dipende dalle date di nascita.',
};

export const PAIR_ANGLE_WORDS: Readonly<Record<PairAngleLocale, PairAngleWords>> = {
  en: EN, es: ES, pt: PT, fr: FR, it: IT,
};
