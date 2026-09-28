import { useEffect, useRef } from 'preact/hooks';
import AspectGlyph from '../components/AspectGlyph';
import PlanetGlyph from '../components/PlanetGlyph';
import { trackAnalytics } from '../lib/analytics';
import type { Chart } from '../lib/engine/types';
import { t, type CatalogLocale as Locale } from '../lib/i18n';
import { aspectLabel, planetLabel } from '../lib/i18n/astrology';
import { natalAspectLine } from '../lib/natal';
import {
  decodePositionsLink,
  type PositionsShareChart,
} from '../lib/share-positions';
import {
  prepareChartSheet,
  preparePlacementCard,
  savePreparedChartCard,
  type PreparedChartCard,
} from '../lib/share-card';
import { ensurePastelZodiacIconEmbedding } from '../lib/share-card-pastel-icons';
import { degreeInSign, formatLongitude } from '../lib/signs';
import { moonIsUncertain } from '../lib/moon-certainty';
import { positionsReading } from '../lib/share-positions-reading';
import Wheel from '../lib/wheel/Wheel';
import SignChip from './SignChip';

export const SHARE_POSITIONS_EN = {
    shareOptionsTitle: 'Share this chart',
    closeShare: 'Close sharing options',
    hideBirthDetails: 'Hide birth details',
    copyPositionsLink: 'Copy positions-only link',
    positionsShareNote: 'The link has no name, birth date, time or place fields. Its positions still give your birth date and time, to the minute. They also narrow your birthplace to an area about 110 km wide and hundreds of kilometres long near the equator, and smaller nearer the poles; near the Arctic Circle it can be a strip less than a kilometre from north to south.',
    positionsShareNoteNoTime: 'The link has no name, birth date, time or place fields. With no birth time, it carries the sky at 12:00 UTC on your birth date, not at noon where you were born, so it gives your birth date but nothing about your birthplace. Any position in it can differ from your chart: the Moon by several degrees, the other planets by less, and on a day a planet changes sign, so can its sign.',
    positionsOnlyTitle: 'Shared chart positions',
    positionsOnlyNotice: 'Positions only, with no name, date, time or place fields.',
    positionsOnlyPrivacy: 'The exact positions still give the birth date and time. They also narrow the birthplace to an area about 110 km wide and hundreds of kilometres long near the equator, and smaller nearer the poles; near the Arctic Circle it can be a strip less than a kilometre from north to south. A link made by an earlier version of the site for a birth before standard time can narrow it to strips about 3 km wide.',
    positionsOnlyPrivacyNoTime: 'The positions still give the birth date. With no birth time, they are for a reference time on that date.',
    reconstructedHouses: 'Houses are reconstructed as whole sign from the shared Ascendant. The original house calculation cannot be rebuilt from positions alone.',
    sharedAspects: 'Major aspects',
    positionsLinkInvalid: 'That positions-only link is invalid or incomplete.',
    shareLinkAmbiguous: 'This link contains two chart formats, so neither one was opened.',
    positionsShareUnavailable: "Couldn't create a positions-only link for this chart.",
    preparingImage: 'Preparing image…',
    shareThisImage: 'Share this image',
    moreWaysToShare: 'More ways to share',
    chartImagePrivacy: 'The image shows chart positions and calculation settings, with no name, birth date, time, place, coordinates or chart link. Its positions still give the birth date and time. It shows the Ascendant and Midheaven only to the whole degree and leaves out Placidus houses, so it narrows the birthplace no more than the link does.',
    chartImagePrivacyNoTime: 'The image shows chart positions and calculation settings, with no name, birth date, place, coordinates or chart link. With no birth time, it shows the sky at 12:00 UTC on your birth date, as the link does, so it gives your birth date but nothing about your birthplace. Any position can differ a little from your chart, and on a day a planet changes sign, so can its sign.',
    chartImagePrivacyDetails: 'This image includes the birth date and, if known, the local birth time, with the place, coordinates, time zone and UTC instant. It does not include a name or chart link.',
    moonCardTitle: 'Moon sign card',
    risingCardTitle: 'Rising sign card',
    moonCardAction: 'Share my Moon sign',
    risingCardAction: 'Share my Rising sign',
} as const;

const SHARE_COPY = {
  en: SHARE_POSITIONS_EN,
  es: {
    shareOptionsTitle: 'Compartir esta carta',
    closeShare: 'Cerrar opciones para compartir',
    hideBirthDetails: 'Ocultar datos de nacimiento',
    copyPositionsLink: 'Copiar enlace solo con posiciones',
    positionsShareNote: 'El enlace no tiene campos de nombre, fecha, hora ni lugar de nacimiento. Sus posiciones siguen dando tu fecha y hora de nacimiento, al minuto. Además acotan tu lugar de nacimiento a una zona de unos 110 km de ancho y cientos de kilómetros de largo cerca del ecuador, y más pequeña hacia los polos; cerca del círculo polar ártico puede ser una franja de menos de un kilómetro de norte a sur.',
    positionsShareNoteNoTime: 'El enlace no tiene campos de nombre, fecha, hora ni lugar de nacimiento. Sin hora de nacimiento, lleva el cielo de las 12:00 UTC de tu fecha de nacimiento, no el del mediodía en tu lugar de nacimiento, así que da tu fecha de nacimiento pero nada sobre ese lugar. Cualquier posición puede diferir de tu carta: la Luna, varios grados; los demás planetas, menos; y el día en que un planeta cambia de signo, también su signo.',
    positionsOnlyTitle: 'Posiciones compartidas de la carta',
    positionsOnlyNotice: 'Solo posiciones, sin campos de nombre, fecha, hora ni lugar.',
    positionsOnlyPrivacy: 'Las posiciones exactas siguen dando la fecha y la hora de nacimiento. Además acotan el lugar de nacimiento a una zona de unos 110 km de ancho y cientos de kilómetros de largo cerca del ecuador, y más pequeña hacia los polos; cerca del círculo polar ártico puede ser una franja de menos de un kilómetro de norte a sur. Un enlace creado con una versión anterior del sitio para un nacimiento anterior a la hora estándar puede acotarlo a franjas de unos 3 km de ancho.',
    positionsOnlyPrivacyNoTime: 'Las posiciones siguen dando la fecha de nacimiento. Sin hora de nacimiento, corresponden a una hora de referencia de ese día.',
    reconstructedHouses: 'Las casas se reconstruyen por signo entero desde el Ascendente compartido. El cálculo original no puede reconstruirse solo con las posiciones.',
    sharedAspects: 'Aspectos mayores',
    positionsLinkInvalid: 'Ese enlace solo con posiciones no es válido o está incompleto.',
    shareLinkAmbiguous: 'Este enlace contiene dos formatos de carta, por lo que no se abrió ninguno.',
    positionsShareUnavailable: 'No se pudo crear un enlace solo con posiciones para esta carta.',
    preparingImage: 'Preparando imagen…',
    shareThisImage: 'Compartir esta imagen',
    moreWaysToShare: 'Más formas de compartir',
    chartImagePrivacy: 'La imagen muestra las posiciones de la carta y los ajustes de cálculo, sin nombre, fecha, hora ni lugar de nacimiento, coordenadas ni enlace a la carta. Sus posiciones siguen dando la fecha y la hora de nacimiento. Muestra el ascendente y el medio cielo solo al grado entero y deja fuera las casas Placidus, así que no acota el lugar de nacimiento más que el enlace.',
    chartImagePrivacyNoTime: 'La imagen muestra las posiciones de la carta y los ajustes de cálculo, sin nombre, fecha ni lugar de nacimiento, coordenadas ni enlace a la carta. Sin hora de nacimiento, muestra el cielo de las 12:00 UTC de tu fecha de nacimiento, igual que el enlace, así que da tu fecha de nacimiento pero nada sobre tu lugar de nacimiento. Cualquier posición puede diferir un poco de tu carta y, el día en que un planeta cambia de signo, también su signo.',
    chartImagePrivacyDetails: 'Esta imagen incluye la fecha y, si se conoce, la hora local de nacimiento, con el lugar, las coordenadas, la zona horaria y el instante UTC. No incluye el nombre ni un enlace a la carta.',
    moonCardTitle: 'Tarjeta del signo lunar',
    risingCardTitle: 'Tarjeta del ascendente',
    moonCardAction: 'Compartir mi signo lunar',
    risingCardAction: 'Compartir mi ascendente',
  },
  pt: {
    shareOptionsTitle: 'Compartilhar este mapa',
    closeShare: 'Fechar opções de compartilhamento',
    hideBirthDetails: 'Ocultar dados de nascimento',
    copyPositionsLink: 'Copiar link apenas com posições',
    positionsShareNote: 'O link não tem campos de nome, data, hora ou local de nascimento. Suas posições ainda indicam sua data e hora de nascimento, com precisão de minuto. Elas também restringem o seu local de nascimento a uma área de cerca de 110 km de largura e centenas de quilômetros de comprimento perto do equador, e menor perto dos polos; perto do Círculo Polar Ártico, pode ser uma faixa de menos de um quilômetro de norte a sul.',
    positionsShareNoteNoTime: 'O link não tem campos de nome, data, hora ou local de nascimento. Sem a hora de nascimento, ele leva o céu das 12:00 UTC da sua data de nascimento, e não o do meio-dia no seu local de nascimento; por isso indica a sua data de nascimento, mas nada sobre esse local. Qualquer posição nele pode diferir do seu mapa: a Lua, alguns graus; os outros planetas, menos; e, no dia em que um planeta muda de signo, também o signo dele.',
    positionsOnlyTitle: 'Posições compartilhadas do mapa',
    positionsOnlyNotice: 'Apenas posições, sem campos de nome, data, hora ou local.',
    positionsOnlyPrivacy: 'As posições exatas ainda indicam a data e a hora de nascimento. Elas também restringem o local de nascimento a uma área de cerca de 110 km de largura e centenas de quilômetros de comprimento perto do equador, e menor perto dos polos; perto do Círculo Polar Ártico, pode ser uma faixa de menos de um quilômetro de norte a sul. Um link criado por uma versão anterior do site para um nascimento anterior à hora padrão pode restringi-lo a faixas de cerca de 3 km de largura.',
    positionsOnlyPrivacyNoTime: 'As posições ainda indicam a data de nascimento. Sem a hora de nascimento, correspondem a um horário de referência nesse dia.',
    reconstructedHouses: 'As casas são reconstruídas por signo inteiro a partir do Ascendente compartilhado. O cálculo original não pode ser refeito apenas com as posições.',
    sharedAspects: 'Aspectos principais',
    positionsLinkInvalid: 'Esse link apenas com posições é inválido ou está incompleto.',
    shareLinkAmbiguous: 'Este link contém dois formatos de mapa, por isso nenhum deles foi aberto.',
    positionsShareUnavailable: 'Não foi possível criar um link apenas com posições para este mapa.',
    preparingImage: 'Preparando imagem…',
    shareThisImage: 'Compartilhar esta imagem',
    moreWaysToShare: 'Mais formas de compartilhar',
    chartImagePrivacy: 'A imagem mostra as posições do mapa e as configurações de cálculo, sem nome, data, hora ou local de nascimento, coordenadas nem link do mapa. Suas posições ainda revelam a data e a hora de nascimento. Ela mostra o ascendente e o meio do céu apenas em graus inteiros e deixa de fora as casas Placidus, então não restringe o local de nascimento mais do que o link.',
    chartImagePrivacyNoTime: 'A imagem mostra as posições do mapa e as configurações de cálculo, sem nome, data ou local de nascimento, coordenadas nem link do mapa. Sem a hora de nascimento, ela mostra o céu das 12:00 UTC da sua data de nascimento, como o link; por isso indica a sua data de nascimento, mas nada sobre o seu local de nascimento. Qualquer posição pode diferir um pouco do seu mapa e, no dia em que um planeta muda de signo, também o signo dele.',
    chartImagePrivacyDetails: 'Esta imagem inclui a data e, se conhecida, a hora local de nascimento, com o local, as coordenadas, o fuso horário e o instante UTC. Não inclui nome nem link do mapa.',
    moonCardTitle: 'Cartão do signo lunar',
    risingCardTitle: 'Cartão do ascendente',
    moonCardAction: 'Compartilhar meu signo lunar',
    risingCardAction: 'Compartilhar meu ascendente',
  },
  fr: {
    shareOptionsTitle: 'Partager ce thème',
    closeShare: 'Fermer les options de partage',
    hideBirthDetails: 'Masquer les données de naissance',
    copyPositionsLink: 'Copier le lien avec les positions uniquement',
    positionsShareNote: 'Le lien n’a pas de champ pour le nom, la date, l’heure ou le lieu de naissance. Ses positions donnent quand même ta date et ton heure de naissance, à la minute près. Elles situent aussi ton lieu de naissance dans une zone d’environ 110 km de large et de plusieurs centaines de kilomètres de long près de l’équateur, plus petite vers les pôles ; près du cercle polaire arctique, ce peut être une bande de moins d’un kilomètre du nord au sud.',
    positionsShareNoteNoTime: 'Le lien n’a pas de champ pour le nom, la date, l’heure ou le lieu de naissance. Sans heure de naissance, il contient le ciel de 12:00 UTC à ta date de naissance, et non celui de midi à ton lieu de naissance : il donne ta date de naissance, mais rien sur ce lieu. Chaque position peut différer de ton thème : la Lune de plusieurs degrés, les autres planètes de moins et, le jour où une planète change de signe, son signe aussi.',
    positionsOnlyTitle: 'Positions partagées du thème',
    positionsOnlyNotice: 'Positions uniquement, sans champ de nom, de date, d’heure ou de lieu.',
    positionsOnlyPrivacy: 'Les positions exactes donnent quand même la date et l’heure de naissance. Elles situent aussi le lieu de naissance dans une zone d’environ 110 km de large et de plusieurs centaines de kilomètres de long près de l’équateur, plus petite vers les pôles ; près du cercle polaire arctique, ce peut être une bande de moins d’un kilomètre du nord au sud. Un lien créé par une version antérieure du site pour une naissance antérieure à l’heure légale peut le situer dans des bandes d’environ 3 km de large.',
    positionsOnlyPrivacyNoTime: 'Les positions donnent quand même la date de naissance. Sans heure de naissance, elles correspondent à une heure de référence ce jour-là.',
    reconstructedHouses: 'Les maisons sont reconstruites en signes entiers à partir de l’Ascendant partagé. Le calcul d’origine ne peut pas être retrouvé à partir des seules positions.',
    sharedAspects: 'Aspects majeurs',
    positionsLinkInvalid: 'Ce lien avec les positions uniquement est incorrect ou incomplet.',
    shareLinkAmbiguous: 'Ce lien contient deux formats de thème : aucun des deux n’a donc été ouvert.',
    positionsShareUnavailable: 'Impossible de créer un lien avec les positions uniquement pour ce thème.',
    preparingImage: 'Préparation de l’image…',
    shareThisImage: 'Partager cette image',
    moreWaysToShare: 'Autres façons de partager',
    chartImagePrivacy: 'L’image montre les positions du thème et les réglages de calcul, sans nom, date, heure ou lieu de naissance, coordonnées ni lien vers le thème. Ses positions donnent encore la date et l’heure de naissance. Elle ne montre l’ascendant et le milieu du ciel qu’au degré entier et laisse de côté les maisons Placidus : elle ne situe donc pas le lieu de naissance plus précisément que le lien.',
    chartImagePrivacyNoTime: 'L’image montre les positions du thème et les réglages de calcul, sans nom, date ou lieu de naissance, coordonnées ni lien vers le thème. Sans heure de naissance, elle montre le ciel de 12:00 UTC à ta date de naissance, comme le lien : elle donne ta date de naissance, mais rien sur ton lieu de naissance. Chaque position peut différer un peu de ton thème et, le jour où une planète change de signe, son signe aussi.',
    chartImagePrivacyDetails: 'Cette image inclut la date et, si elle est connue, l’heure locale de naissance, avec le lieu, les coordonnées, le fuseau horaire et l’instant UTC. Elle n’inclut ni nom ni lien vers le thème.',
    moonCardTitle: 'Carte du signe lunaire',
    risingCardTitle: 'Carte de l’Ascendant',
    moonCardAction: 'Partager mon signe lunaire',
    risingCardAction: 'Partager mon Ascendant',
  },
  it: {
    shareOptionsTitle: 'Condividi questo tema',
    closeShare: 'Chiudi le opzioni di condivisione',
    hideBirthDetails: 'Nascondi i dati di nascita',
    copyPositionsLink: 'Copia il link con le sole posizioni',
    positionsShareNote: 'Il link non ha campi per nome, data, ora o luogo di nascita. Le sue posizioni indicano comunque data e ora della tua nascita, al minuto. Restringono anche il luogo di nascita a una zona larga circa 110 km e lunga centinaia di chilometri vicino all’equatore, più piccola verso i poli; vicino al Circolo polare artico può essere una striscia di meno di un chilometro da nord a sud.',
    positionsShareNoteNoTime: 'Il link non ha campi per nome, data, ora o luogo di nascita. Senza ora di nascita, contiene il cielo delle 12:00 UTC della tua data di nascita, non quello del mezzogiorno nel tuo luogo di nascita, quindi indica la data di nascita ma nulla del luogo. Ogni posizione può differire dal tuo tema: la Luna di diversi gradi, gli altri pianeti di meno e, nel giorno in cui un pianeta cambia segno, anche il suo segno.',
    positionsOnlyTitle: 'Posizioni condivise del tema',
    positionsOnlyNotice: 'Solo posizioni, senza campi per nome, data, ora o luogo.',
    positionsOnlyPrivacy: 'Le posizioni esatte indicano comunque data e ora di nascita. Restringono anche il luogo di nascita a una zona larga circa 110 km e lunga centinaia di chilometri vicino all’equatore, più piccola verso i poli; vicino al Circolo polare artico può essere una striscia di meno di un chilometro da nord a sud. Un link creato da una versione precedente del sito per una nascita precedente all’ora standard può restringerlo a strisce larghe circa 3 km.',
    positionsOnlyPrivacyNoTime: 'Le posizioni indicano comunque la data di nascita. Senza ora di nascita, si riferiscono a un orario di riferimento di quel giorno.',
    reconstructedHouses: 'Le case sono ricostruite a segno intero dall’Ascendente condiviso. Il calcolo originale non può essere ricavato dalle sole posizioni.',
    sharedAspects: 'Aspetti maggiori',
    positionsLinkInvalid: 'Questo link con le sole posizioni non è valido o è incompleto.',
    shareLinkAmbiguous: 'Questo link contiene due formati diversi per il tema, quindi non ne è stato aperto nessuno.',
    positionsShareUnavailable: 'Non è stato possibile creare un link con le sole posizioni per questo tema.',
    preparingImage: 'Preparazione immagine…',
    shareThisImage: 'Condividi questa immagine',
    moreWaysToShare: 'Altri modi per condividere',
    chartImagePrivacy: 'L’immagine mostra le posizioni del tema e le impostazioni di calcolo, senza nome, data, ora o luogo di nascita, coordinate né link al tema. Le sue posizioni danno ancora la data e l’ora di nascita. Mostra l’ascendente e il medio cielo solo al grado intero e lascia fuori le case Placidus, quindi non restringe il luogo di nascita più del link.',
    chartImagePrivacyNoTime: 'L’immagine mostra le posizioni del tema e le impostazioni di calcolo, senza nome, data o luogo di nascita, coordinate né link al tema. Senza ora di nascita, mostra il cielo delle 12:00 UTC della tua data di nascita, come il link, quindi indica la data di nascita ma nulla del luogo di nascita. Ogni posizione può differire un po’ dal tuo tema e, nel giorno in cui un pianeta cambia segno, anche il suo segno.',
    chartImagePrivacyDetails: 'Questa immagine include la data e, se nota, l’ora locale di nascita, con luogo, coordinate, fuso orario e istante UTC. Non include nome né un link al tema.',
    moonCardTitle: 'Carta del segno lunare',
    risingCardTitle: 'Carta dell’Ascendente',
    moonCardAction: 'Condividi il mio segno lunare',
    risingCardAction: 'Condividi il mio Ascendente',
  },
  ru: {
    shareOptionsTitle: 'Поделиться этой картой',
    closeShare: 'Закрыть варианты отправки',
    hideBirthDetails: 'Скрыть данные рождения',
    copyPositionsLink: 'Скопировать ссылку только с положениями',
    positionsShareNote: 'В ссылке нет полей для имени, даты, времени и места рождения. Положения всё равно выдают дату и время вашего рождения с точностью до минуты. Кроме того, они сужают место рождения до области шириной около 110 км и длиной в сотни километров у экватора, меньшей ближе к полюсам; у Северного полярного круга это может быть полоса меньше километра с севера на юг.',
    positionsShareNoteNoTime: 'В ссылке нет полей для имени, даты, времени и места рождения. Без времени рождения она содержит небо на 12:00 UTC в день вашего рождения, а не на полдень в месте рождения, поэтому выдаёт дату рождения, но ничего не говорит о месте. Любое положение в ней может отличаться от вашей карты: Луна — на несколько градусов, другие планеты — меньше, а в день, когда планета меняет знак, — и её знак.',
    positionsOnlyTitle: 'Положения из присланной карты',
    positionsOnlyNotice: 'Только положения, без полей имени, даты, времени и места.',
    positionsOnlyPrivacy: 'Точные положения всё равно выдают дату и время рождения. Кроме того, они сужают место рождения до области шириной около 110 км и длиной в сотни километров у экватора, меньшей ближе к полюсам; у Северного полярного круга это может быть полоса меньше километра с севера на юг. Ссылка, созданная прежней версией сайта для рождения до введения поясного времени, может сузить его до полос шириной около 3 км.',
    positionsOnlyPrivacyNoTime: 'Положения всё равно выдают дату рождения. Без времени рождения они даны на условное время этого дня.',
    reconstructedHouses: 'Дома восстановлены как целые знаки от переданного Асцендента. Исходный расчёт домов нельзя восстановить только по положениям.',
    sharedAspects: 'Мажорные аспекты',
    positionsLinkInvalid: 'Ссылка только с положениями недействительна или неполна.',
    shareLinkAmbiguous: 'В ссылке есть два формата карты, поэтому ни один не был открыт.',
    positionsShareUnavailable: 'Не удалось создать ссылку только с положениями для этой карты.',
    preparingImage: 'Готовим изображение…',
    shareThisImage: 'Поделиться изображением',
    moreWaysToShare: 'Другие способы поделиться',
    chartImagePrivacy: 'На изображении есть положения карты и настройки расчёта, но нет имени, даты, времени и места рождения, координат и ссылки на карту. По положениям всё же можно определить дату и время рождения. Асцендент и MC показаны только с точностью до целого градуса, а дома Плацидуса не показаны, поэтому место рождения по изображению сужается не больше, чем по ссылке.',
    chartImagePrivacyNoTime: 'На изображении есть положения карты и настройки расчёта, но нет имени, даты и места рождения, координат и ссылки на карту. Без времени рождения на нём небо на 12:00 UTC в день вашего рождения, как и в ссылке, поэтому оно выдаёт дату рождения, но ничего не говорит о месте рождения. Любое положение может немного отличаться от вашей карты, а в день, когда планета меняет знак, — и её знак.',
    chartImagePrivacyDetails: 'На этом изображении есть дата и, если известно, местное время рождения, а также место, координаты, часовой пояс и момент UTC. Имя и ссылка на карту не включены.',
    moonCardTitle: 'Карточка знака Луны',
    risingCardTitle: 'Карточка асцендента',
    moonCardAction: 'Поделиться знаком Луны',
    risingCardAction: 'Поделиться асцендентом',
  },
} as const;

export type ShareCopyKey = keyof typeof SHARE_COPY.en;

export function shareText(locale: Locale, key: ShareCopyKey): string {
  return SHARE_COPY[locale][key];
}

/** Kept behind this module's dynamic boundary for the calculator receiver. */
export function decodePositionsToken(token: string): PositionsShareChart | null {
  return decodePositionsLink(token);
}

/**
 * The image offered first, with birth details hidden. birthDate is the civil
 * date a chart without a birth time is shown at 12:00 UTC on, as its link is.
 */
export async function preparePrimaryShareArtifact(
  chart: Chart,
  mode: 'full' | 'moon' | 'rising',
  locale: Locale,
  moonAmbiguous = false,
  birthDate?: string,
): Promise<PreparedChartCard> {
  if (mode === 'full') {
    await ensurePastelZodiacIconEmbedding();
    return prepareChartSheet(chart, { locale, hideBirthDetails: true, moonAmbiguous, birthDate });
  }
  return preparePlacementCard(chart, mode, locale, {
    referenceTime: !chart.input.timeKnown,
    moonAmbiguous,
    birthDate,
  });
}

export function sharePreparedArtifact(prepared: PreparedChartCard) {
  return savePreparedChartCard(prepared);
}

export async function sharePrimaryArtifact(
  prepared: PreparedChartCard,
  mode: 'full' | 'moon' | 'rising',
): Promise<'idle' | 'saved' | 'error'> {
  try {
    const outcome = await savePreparedChartCard(prepared);
    if (outcome === 'cancelled') return 'idle';
    const variant = mode === 'full' ? 'full_chart_card' : 'big_three_card';
    trackAnalytics('chart_share', { variant });
    trackAnalytics('share_card_downloaded', { variant });
    return 'saved';
  } catch (error) {
    console.error(error);
    return 'error';
  }
}

interface PositionsOnlyResultProps {
  chart: PositionsShareChart;
  locale: Locale;
}

/** The intentionally reduced receiver for a v2 share token. */
export function PositionsOnlyResult({ chart, locale }: PositionsOnlyResultProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      rootRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      headingRef.current?.focus();
    });
  }, []);

  const rows = chart.angles
    ? [
      ...chart.bodies.map((body) => ({ key: body.body, label: planetLabel(locale, body.body), lon: body.lon, body: body.body })),
      { key: 'asc', label: 'ASC', lon: chart.angles.asc, body: null },
      { key: 'mc', label: 'MC', lon: chart.angles.mc, body: null },
    ]
    : chart.bodies.map((body) => ({ key: body.body, label: planetLabel(locale, body.body), lon: body.lon, body: body.body }));
  const reading = positionsReading(chart);

  return (
    <section class="calc__result calc__positions-only" ref={rootRef} data-positions-only>
      <h2 class="calc__positions-title" tabIndex={-1} ref={headingRef}>
        {shareText(locale, 'positionsOnlyTitle')}
      </h2>
      <p class="notice" role="status">{shareText(locale, 'positionsOnlyNotice')}</p>
      {moonIsUncertain(chart) && <p class="notice" data-moon-uncertain>{t(locale, 'moon')} · {t(locale, 'needsBirthTime')}</p>}
      <p class="calc__positions-privacy">{shareText(locale, chart.angles ? 'positionsOnlyPrivacy' : 'positionsOnlyPrivacyNoTime')}</p>

      <div class="calc__wheel shell">
        <div class="core calc__wheel-core">
          <div aria-hidden="true">
            <Wheel
              bodies={chart.bodies.filter((body) => body.body !== 'South Node')}
              asc={chart.angles?.asc ?? null}
              mc={chart.angles?.mc ?? null}
              cusps={reading.cusps}
              aspects={reading.aspects}
            />
          </div>
          <p class="calc__receipt mono">{t(locale, 'engine')}{chart.engineVersion}</p>
        </div>
      </div>

      <div class="calc__table-wrap">
        <table class="calc__table">
          <thead>
            <tr><th>{t(locale, 'body')}</th><th>{t(locale, 'position')}</th><th>{t(locale, 'sign')}</th>{reading.cusps && <th>{t(locale, 'house')}</th>}</tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>
                  {row.body && <span class="calc__glyph"><PlanetGlyph body={row.body} size={15} /></span>}
                  {row.label}
                </td>
                <td class="mono">{row.body ? formatLongitude(row.lon, locale).split(' ')[0] : `${Math.floor(degreeInSign(row.lon))}°`}</td>
                <td>{row.body === 'Moon' && moonIsUncertain(chart) ? t(locale, 'needsBirthTime') : <SignChip lon={row.lon} locale={locale} />}</td>
                {reading.cusps && <td class="mono">{reading.houses.get(row.body ?? (row.key === 'asc' ? 'ASC' : 'MC'))}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {reading.reconstructedWholeSign && (
        <p class="calc__positions-privacy" data-reconstructed-houses>{shareText(locale, 'reconstructedHouses')}</p>
      )}
      {reading.topAspects.length > 0 && (
        <section class="calc__aspects calc__positions-aspects" aria-labelledby="shared-aspects-title">
          <h3 id="shared-aspects-title">{shareText(locale, 'sharedAspects')}</h3>
          <ul>
            {reading.topAspects.map((aspect) => (
              <li key={`${aspect.a}-${aspect.type}-${aspect.b}`}>
                <p class="mono">
                  <PlanetGlyph body={aspect.a} size={13} /> {planetLabel(locale, aspect.a)}{' '}
                  <AspectGlyph type={aspect.type} size={13} /> {aspectLabel(locale, aspect.type)}{' '}
                  <PlanetGlyph body={aspect.b} size={13} /> {planetLabel(locale, aspect.b)} · {t(locale, 'orb')} {aspect.orb.toFixed(1)}°
                </p>
                {locale === 'en' && <p>{natalAspectLine(aspect.a, aspect.type, aspect.b)}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
