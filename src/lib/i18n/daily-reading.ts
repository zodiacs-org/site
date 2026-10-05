import {
  dailyBodyFactId,
  dailyEventFactId,
  dailyHouseFactId,
  dailyReading,
  solarHouse,
  type Daily,
  type DailyBody,
  type DailyEvent,
  type DailyLine,
  type DailyReading,
} from '../daily';
import { signBySlug, signName } from '../signs';
import { aspectLabel, planetLabel } from './astrology';
import type { Locale } from './index';

const ORDINAL_ES = [
  '', 'primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta',
  'séptima', 'octava', 'novena', 'décima', 'undécima', 'duodécima',
];

const HOUSE_THEME_ES: Record<number, string> = {
  1: 'tu imagen, tus comienzos y la impresión que causas',
  2: 'el dinero, las posesiones y lo que te da estabilidad',
  3: 'las diligencias, los hermanos, los mensajes y tu entorno cercano',
  4: 'el hogar, la familia y la base privada de tu vida',
  5: 'el placer, el romance, los hijos y lo que creas por gusto',
  6: 'el trabajo en curso, los hábitos de salud y la carga diaria',
  7: 'la pareja y las personas con quienes tratas de igual a igual',
  8: 'el dinero compartido, las deudas, la intimidad y lo que se fusiona',
  9: 'los viajes, el estudio, las creencias y la mirada de largo alcance',
  10: 'la carrera, la reputación y lo que ve el público',
  11: 'las amistades, los grupos y el futuro al que apuntas',
  12: 'el descanso, el retiro y lo que ocurre bajo la superficie',
};

const PLANET_VERB_ES: Record<string, string> = {
  Moon: 'La Luna pasa hoy por',
  Sun: 'El Sol recorre',
  Mercury: 'Mercurio activa',
  Venus: 'Venus aporta calidez a',
  Mars: 'Marte impulsa',
  Jupiter: 'Júpiter expande',
  Saturn: 'Saturno pone a prueba',
  Uranus: 'Urano altera',
  Neptune: 'Neptuno difumina',
  Pluto: 'Plutón transforma lentamente',
};

const ORDINAL_PT = [
  '', 'primeira', 'segunda', 'terceira', 'quarta', 'quinta', 'sexta',
  'sétima', 'oitava', 'nona', 'décima', 'décima primeira', 'décima segunda',
];

const HOUSE_THEME_PT: Record<number, string> = {
  1: 'sua imagem, seus começos e a impressão que você causa',
  2: 'o dinheiro, os bens e o que dá estabilidade a você',
  3: 'as tarefas, os irmãos, as mensagens e seu ambiente próximo',
  4: 'o lar, a família e a base privada da sua vida',
  5: 'o prazer, o romance, os filhos e o que você cria por gosto',
  6: 'o trabalho em andamento, os hábitos de saúde e a carga diária',
  7: 'os relacionamentos e as pessoas do outro lado da mesa',
  8: 'o dinheiro compartilhado, as dívidas, a intimidade e o que se une',
  9: 'as viagens, os estudos, as crenças e a visão de longo alcance',
  10: 'a carreira, a reputação e o que o público vê',
  11: 'as amizades, os grupos e o futuro que você busca construir',
  12: 'o descanso, o recolhimento e o que acontece sob a superfície',
};

const PLANET_VERB_PT: Record<string, string> = {
  Moon: 'A Lua passa hoje por',
  Sun: 'O Sol percorre',
  Mercury: 'Mercúrio ativa',
  Venus: 'Vênus aquece',
  Mars: 'Marte impulsiona',
  Jupiter: 'Júpiter expande',
  Saturn: 'Saturno testa',
  Uranus: 'Urano altera',
  Neptune: 'Netuno desfaz os contornos de',
  Pluto: 'Plutão transforma lentamente',
};

const ORDINAL_FR = [
  '', 'première', 'deuxième', 'troisième', 'quatrième', 'cinquième', 'sixième',
  'septième', 'huitième', 'neuvième', 'dixième', 'onzième', 'douzième',
];

const HOUSE_THEME_FR: Record<number, string> = {
  1: 'ton image, tes débuts et l’impression que tu donnes',
  2: 'l’argent, les possessions et ce qui t’apporte de la stabilité',
  3: 'les déplacements du quotidien, la fratrie, les messages et ton environnement proche',
  4: 'le foyer, la famille et les fondations intimes de ta vie',
  5: 'le plaisir, les histoires d’amour, les enfants et ce que tu crées par goût',
  6: 'le travail en cours, les habitudes de santé et la charge quotidienne',
  7: 'les relations et les personnes qui te font face',
  8: 'l’argent partagé, les dettes, l’intimité et ce qui s’entremêle',
  9: 'les voyages, les études, les croyances et la vision à long terme',
  10: 'la carrière, la réputation et ce que voit le public',
  11: 'les amitiés, les groupes et l’avenir que tu vises',
  12: 'le repos, le retrait et ce qui se passe sous la surface',
};

const PLANET_VERB_FR: Record<string, string> = {
  Moon: 'La Lune traverse aujourd’hui',
  Sun: 'Le Soleil parcourt',
  Mercury: 'Mercure active',
  Venus: 'Vénus réchauffe',
  Mars: 'Mars dynamise',
  Jupiter: 'Jupiter développe',
  Saturn: 'Saturne met à l’épreuve',
  Uranus: 'Uranus bouleverse',
  Neptune: 'Neptune brouille',
  Pluto: 'Pluton transforme lentement',
};

const ORDINAL_IT = [
  '', 'prima', 'seconda', 'terza', 'quarta', 'quinta', 'sesta',
  'settima', 'ottava', 'nona', 'decima', 'undicesima', 'dodicesima',
];

const HOUSE_THEME_IT: Record<number, string> = {
  1: 'la tua immagine, i tuoi inizi e l’impressione che dai',
  2: 'il denaro, i beni e ciò che ti dà stabilità',
  3: 'le commissioni, fratelli e sorelle, i messaggi e il tuo ambiente vicino',
  4: 'la casa, la famiglia e le fondamenta private della tua vita',
  5: 'il piacere, l’amore, i figli e ciò che crei per il gusto di farlo',
  6: 'il lavoro in corso, le abitudini di salute e il carico quotidiano',
  7: 'le relazioni e le persone che hai di fronte',
  8: 'il denaro condiviso, i debiti, l’intimità e ciò che si unisce',
  9: 'i viaggi, lo studio, le convinzioni e la visione a lungo termine',
  10: 'la carriera, la reputazione e ciò che vede il pubblico',
  11: 'le amicizie, i gruppi e il futuro a cui punti',
  12: 'il riposo, il ritiro e ciò che accade sotto la superficie',
};

const PLANET_VERB_IT: Record<string, string> = {
  Moon: 'La Luna attraversa oggi',
  Sun: 'Il Sole attraversa',
  Mercury: 'Mercurio attiva',
  Venus: 'Venere riscalda',
  Mars: 'Marte mette in moto',
  Jupiter: 'Giove espande',
  Saturn: 'Saturno mette alla prova',
  Uranus: 'Urano scuote',
  Neptune: 'Nettuno sfuma',
  Pluto: 'Plutone trasforma lentamente',
};

const emPt = (phrase: string) => `em ${phrase}`
  .replace(/^em o /, 'no ')
  .replace(/^em a /, 'na ')
  .replace(/^em os /, 'nos ')
  .replace(/^em as /, 'nas ');

const signLabel = (slug: string) => signName(signBySlug(slug), 'es');
const signLabelPt = (slug: string) => signName(signBySlug(slug), 'pt');
const signLabelFr = (slug: string) => signName(signBySlug(slug), 'fr');
const signLabelIt = (slug: string) => signName(signBySlug(slug), 'it');
const utcTime = (at: string) => `${at.slice(11, 16)} UTC`;

type LineContext = { date: string; sunSign: string };

/** The same receipts the English renderer attaches, so a localized line answers to identical evidence. */
function solarHouseProvenance(sourceFactId: string, context: LineContext, house: number) {
  return {
    scope: 'solar-house' as const,
    evidenceRefs: [sourceFactId, dailyHouseFactId(context.date, context.sunSign, sourceFactId, house)],
  };
}

function houseLineEs(body: DailyBody, house: number, context: LineContext): DailyLine {
  const planet = planetLabel('es', body.body);
  const rx = body.retrograde ? ' ℞' : '';
  return {
    text: `${PLANET_VERB_ES[body.body] ?? `${planet} recorre`} tu ${ORDINAL_ES[house]} casa: ${HOUSE_THEME_ES[house]}.`,
    receipt: `${planet} ${body.degree.toFixed(1)}° ${signLabel(body.sign)}${rx} · casa ${house}`,
    house,
    body: body.body,
    hue: signBySlug(body.sign).hue,
    templateId: 'body-house.v1',
    ...solarHouseProvenance(dailyBodyFactId(context.date, body), context, house),
  };
}

function eventLineEs(event: DailyEvent, sunSign: string, date: string): DailyLine | null {
  if (event.kind === 'ingress' && event.planet && event.sign) {
    const house = solarHouse(event.sign, sunSign);
    const planet = planetLabel('es', event.planet);
    const focus = event.planet === 'Saturn' || event.planet === 'Pluto'
      ? 'pone el foco a largo plazo en'
      : 'pone el foco en';
    return {
      text: `${planet} entra hoy en tu ${ORDINAL_ES[house]} casa y ${focus} ${HOUSE_THEME_ES[house]}.`,
      receipt: `${planet} → 0° ${signLabel(event.sign)} · ${utcTime(event.at)}`,
      body: event.planet,
      hue: signBySlug(event.sign).hue,
      house,
      templateId: 'ingress-house.v1',
      ...solarHouseProvenance(dailyEventFactId(date, event), { date, sunSign }, house),
    };
  }
  if (event.kind === 'lunation' && event.sign) {
    const house = solarHouse(event.sign, sunSign);
    const name = event.type === 'new' ? 'Luna nueva' : 'Luna llena';
    const meaning = event.type === 'new'
      ? 'abre un punto de partida en'
      : 'marca una culminación en';
    return {
      text: `${name} en tu ${ORDINAL_ES[house]} casa: ${meaning} ${HOUSE_THEME_ES[house]}.`,
      receipt: `${name} ${event.degree?.toFixed(1)}° ${signLabel(event.sign)} · ${utcTime(event.at)}`,
      body: 'Moon',
      hue: signBySlug(event.sign).hue,
      house,
      templateId: 'lunation-house.v1',
      ...solarHouseProvenance(dailyEventFactId(date, event), { date, sunSign }, house),
    };
  }
  if (event.kind === 'station' && event.planet && event.sign) {
    const house = solarHouse(event.sign, sunSign);
    const planet = planetLabel('es', event.planet);
    const retrograde = event.type === 'retrograde';
    const direction = retrograde ? 'estaciona retrógrado' : 'estaciona directo';
    const meaning = retrograde ? 'pone en revisión' : 'vuelve a poner en movimiento';
    return {
      text: `${planet} ${direction} en tu ${ORDINAL_ES[house]} casa: ${meaning} ${HOUSE_THEME_ES[house]}.`,
      receipt: `${planet} ${direction} ${event.degree?.toFixed(1)}° ${signLabel(event.sign)} · ${utcTime(event.at)}`,
      body: event.planet,
      hue: signBySlug(event.sign).hue,
      house,
      templateId: 'station-house.v1',
      ...solarHouseProvenance(dailyEventFactId(date, event), { date, sunSign }, house),
    };
  }
  if (event.kind === 'aspect' && event.a && event.b && event.type) {
    const a = planetLabel('es', event.a);
    const b = planetLabel('es', event.b);
    const aspect = aspectLabel('es', event.type);
    return {
      text: `${a} en ${aspect} con ${b} alcanza hoy su punto exacto: es un aspecto de alcance general y el comprobante muestra la hora.`,
      receipt: `${a} ${aspect} ${b} · exacto ${utcTime(event.at)}`,
      body: event.a,
      templateId: 'aspect-collective.v1',
      scope: 'collective',
      evidenceRefs: [dailyEventFactId(date, event)],
    };
  }
  return null;
}

function houseLinePt(body: DailyBody, house: number, context: LineContext): DailyLine {
  const planet = planetLabel('pt', body.body);
  const rx = body.retrograde ? ' ℞' : '';
  return {
    text: `${PLANET_VERB_PT[body.body] ?? `${planet} percorre`} sua ${ORDINAL_PT[house]} casa: ${HOUSE_THEME_PT[house]}.`,
    receipt: `${planet} ${body.degree.toFixed(1)}° ${signLabelPt(body.sign)}${rx} · casa ${house}`,
    house,
    body: body.body,
    hue: signBySlug(body.sign).hue,
    templateId: 'body-house.v1',
    ...solarHouseProvenance(dailyBodyFactId(context.date, body), context, house),
  };
}

function eventLinePt(event: DailyEvent, sunSign: string, date: string): DailyLine | null {
  if (event.kind === 'ingress' && event.planet && event.sign) {
    const house = solarHouse(event.sign, sunSign);
    const planet = planetLabel('pt', event.planet);
    const focus = event.planet === 'Saturn' || event.planet === 'Pluto'
      ? 'coloca o foco de longo prazo'
      : 'coloca o foco';
    return {
      text: `${planet} entra hoje na sua ${ORDINAL_PT[house]} casa e ${focus} ${emPt(HOUSE_THEME_PT[house])}.`,
      receipt: `${planet} → 0° ${signLabelPt(event.sign)} · ${utcTime(event.at)}`,
      body: event.planet,
      hue: signBySlug(event.sign).hue,
      house,
      templateId: 'ingress-house.v1',
      ...solarHouseProvenance(dailyEventFactId(date, event), { date, sunSign }, house),
    };
  }
  if (event.kind === 'lunation' && event.sign) {
    const house = solarHouse(event.sign, sunSign);
    const name = event.type === 'new' ? 'Lua nova' : 'Lua cheia';
    const meaning = event.type === 'new'
      ? 'abre um ponto de partida'
      : 'marca uma culminação';
    return {
      text: `${name} na sua ${ORDINAL_PT[house]} casa: ${meaning} ${emPt(HOUSE_THEME_PT[house])}.`,
      receipt: `${name} ${event.degree?.toFixed(1)}° ${signLabelPt(event.sign)} · ${utcTime(event.at)}`,
      body: 'Moon',
      hue: signBySlug(event.sign).hue,
      house,
      templateId: 'lunation-house.v1',
      ...solarHouseProvenance(dailyEventFactId(date, event), { date, sunSign }, house),
    };
  }
  if (event.kind === 'station' && event.planet && event.sign) {
    const house = solarHouse(event.sign, sunSign);
    const planet = planetLabel('pt', event.planet);
    const retrograde = event.type === 'retrograde';
    const direction = retrograde ? 'estaciona retrógrado' : 'estaciona direto';
    const meaning = retrograde ? 'coloca em revisão' : 'volta a colocar em movimento';
    return {
      text: `${planet} ${direction} na sua ${ORDINAL_PT[house]} casa: ${meaning} ${HOUSE_THEME_PT[house]}.`,
      receipt: `${planet} ${direction} ${event.degree?.toFixed(1)}° ${signLabelPt(event.sign)} · ${utcTime(event.at)}`,
      body: event.planet,
      hue: signBySlug(event.sign).hue,
      house,
      templateId: 'station-house.v1',
      ...solarHouseProvenance(dailyEventFactId(date, event), { date, sunSign }, house),
    };
  }
  if (event.kind === 'aspect' && event.a && event.b && event.type) {
    const a = planetLabel('pt', event.a);
    const b = planetLabel('pt', event.b);
    const aspect = aspectLabel('pt', event.type);
    return {
      text: `${a} em ${aspect} com ${b} chega hoje ao ponto exato: é um aspecto de alcance geral, e o registro mostra o horário.`,
      receipt: `${a} ${aspect} ${b} · exato às ${utcTime(event.at)}`,
      body: event.a,
      templateId: 'aspect-collective.v1',
      scope: 'collective',
      evidenceRefs: [dailyEventFactId(date, event)],
    };
  }
  return null;
}

function houseLineFr(body: DailyBody, house: number, context: LineContext): DailyLine {
  const planet = planetLabel('fr', body.body);
  const rx = body.retrograde ? ' ℞' : '';
  return {
    text: `${PLANET_VERB_FR[body.body] ?? `${planet} parcourt`} ta ${ORDINAL_FR[house]} maison : ${HOUSE_THEME_FR[house]}.`,
    receipt: `${planet} ${body.degree.toFixed(1)}° ${signLabelFr(body.sign)}${rx} · maison ${house}`,
    house,
    body: body.body,
    hue: signBySlug(body.sign).hue,
    templateId: 'body-house.v1',
    ...solarHouseProvenance(dailyBodyFactId(context.date, body), context, house),
  };
}

function eventLineFr(event: DailyEvent, sunSign: string, date: string): DailyLine | null {
  if (event.kind === 'ingress' && event.planet && event.sign) {
    const house = solarHouse(event.sign, sunSign);
    const planet = planetLabel('fr', event.planet);
    const focus = event.planet === 'Saturn' || event.planet === 'Pluto'
      ? 'met l’accent à long terme sur'
      : 'met l’accent sur';
    return {
      text: `${planet} entre aujourd’hui dans ta ${ORDINAL_FR[house]} maison et ${focus} ${HOUSE_THEME_FR[house]}.`,
      receipt: `${planet} → 0° ${signLabelFr(event.sign)} · ${utcTime(event.at)}`,
      body: event.planet,
      hue: signBySlug(event.sign).hue,
      house,
      templateId: 'ingress-house.v1',
      ...solarHouseProvenance(dailyEventFactId(date, event), { date, sunSign }, house),
    };
  }
  if (event.kind === 'lunation' && event.sign) {
    const house = solarHouse(event.sign, sunSign);
    const name = event.type === 'new' ? 'Nouvelle Lune' : 'Pleine Lune';
    const meaning = event.type === 'new'
      ? 'ouvre un nouveau chapitre'
      : 'marque un aboutissement';
    return {
      text: `La ${name} dans ta ${ORDINAL_FR[house]} maison ${meaning} : ${HOUSE_THEME_FR[house]}.`,
      receipt: `${name} ${event.degree?.toFixed(1)}° ${signLabelFr(event.sign)} · ${utcTime(event.at)}`,
      body: 'Moon',
      hue: signBySlug(event.sign).hue,
      house,
      templateId: 'lunation-house.v1',
      ...solarHouseProvenance(dailyEventFactId(date, event), { date, sunSign }, house),
    };
  }
  if (event.kind === 'station' && event.planet && event.sign) {
    const house = solarHouse(event.sign, sunSign);
    const planet = planetLabel('fr', event.planet);
    const retrograde = event.type === 'retrograde';
    const direction = retrograde ? 'devient rétrograde' : 'redevient direct';
    const meaning = retrograde ? 'invite à revoir' : 'remet en mouvement';
    return {
      text: `${planet} ${direction} dans ta ${ORDINAL_FR[house]} maison : ${meaning} ${HOUSE_THEME_FR[house]}.`,
      receipt: `${planet} ${direction} ${event.degree?.toFixed(1)}° ${signLabelFr(event.sign)} · ${utcTime(event.at)}`,
      body: event.planet,
      hue: signBySlug(event.sign).hue,
      house,
      templateId: 'station-house.v1',
      ...solarHouseProvenance(dailyEventFactId(date, event), { date, sunSign }, house),
    };
  }
  if (event.kind === 'aspect' && event.a && event.b && event.type) {
    const a = planetLabel('fr', event.a);
    const b = planetLabel('fr', event.b);
    const aspect = aspectLabel('fr', event.type);
    return {
      text: `${a} en ${aspect} avec ${b} devient exact aujourd’hui : cet aspect est collectif, et le relevé en indique l’heure.`,
      receipt: `${a} ${aspect} ${b} · exact à ${utcTime(event.at)}`,
      body: event.a,
      templateId: 'aspect-collective.v1',
      scope: 'collective',
      evidenceRefs: [dailyEventFactId(date, event)],
    };
  }
  return null;
}

function houseLineIt(body: DailyBody, house: number, context: LineContext): DailyLine {
  const planet = planetLabel('it', body.body);
  const rx = body.retrograde ? ' ℞' : '';
  return {
    text: `${PLANET_VERB_IT[body.body] ?? `${planet} attraversa`} la tua ${ORDINAL_IT[house]} casa: ${HOUSE_THEME_IT[house]}.`,
    receipt: `${planet} ${body.degree.toFixed(1)}° ${signLabelIt(body.sign)}${rx} · casa ${house}`,
    house,
    body: body.body,
    hue: signBySlug(body.sign).hue,
    templateId: 'body-house.v1',
    ...solarHouseProvenance(dailyBodyFactId(context.date, body), context, house),
  };
}

function eventLineIt(event: DailyEvent, sunSign: string, date: string): DailyLine | null {
  if (event.kind === 'ingress' && event.planet && event.sign) {
    const house = solarHouse(event.sign, sunSign);
    const planet = planetLabel('it', event.planet);
    const focus = event.planet === 'Saturn' || event.planet === 'Pluto'
      ? 'porta lì l’attenzione a lungo termine'
      : 'porta lì l’attenzione';
    return {
      text: `${planet} entra oggi nella tua ${ORDINAL_IT[house]} casa e ${focus}: ${HOUSE_THEME_IT[house]}.`,
      receipt: `${planet} → 0° ${signLabelIt(event.sign)} · ${utcTime(event.at)}`,
      body: event.planet,
      hue: signBySlug(event.sign).hue,
      house,
      templateId: 'ingress-house.v1',
      ...solarHouseProvenance(dailyEventFactId(date, event), { date, sunSign }, house),
    };
  }
  if (event.kind === 'lunation' && event.sign) {
    const house = solarHouse(event.sign, sunSign);
    const name = event.type === 'new' ? 'Luna nuova' : 'Luna piena';
    const meaning = event.type === 'new'
      ? 'apre un nuovo capitolo'
      : 'segna un compimento';
    return {
      text: `La ${name} nella tua ${ORDINAL_IT[house]} casa ${meaning}: ${HOUSE_THEME_IT[house]}.`,
      receipt: `${name} ${event.degree?.toFixed(1)}° ${signLabelIt(event.sign)} · ${utcTime(event.at)}`,
      body: 'Moon',
      hue: signBySlug(event.sign).hue,
      house,
      templateId: 'lunation-house.v1',
      ...solarHouseProvenance(dailyEventFactId(date, event), { date, sunSign }, house),
    };
  }
  if (event.kind === 'station' && event.planet && event.sign) {
    const house = solarHouse(event.sign, sunSign);
    const planet = planetLabel('it', event.planet);
    const retrograde = event.type === 'retrograde';
    const direction = retrograde ? 'staziona in moto retrogrado' : 'staziona in moto diretto';
    const meaning = retrograde ? 'porta a rivedere' : 'rimette in moto';
    return {
      text: `${planet} ${direction} nella tua ${ORDINAL_IT[house]} casa: ${meaning} ${HOUSE_THEME_IT[house]}.`,
      receipt: `${planet} ${direction} ${event.degree?.toFixed(1)}° ${signLabelIt(event.sign)} · ${utcTime(event.at)}`,
      body: event.planet,
      hue: signBySlug(event.sign).hue,
      house,
      templateId: 'station-house.v1',
      ...solarHouseProvenance(dailyEventFactId(date, event), { date, sunSign }, house),
    };
  }
  if (event.kind === 'aspect' && event.a && event.b && event.type) {
    const a = planetLabel('it', event.a);
    const b = planetLabel('it', event.b);
    const aspect = aspectLabel('it', event.type);
    return {
      text: `${a} in ${aspect} con ${b} raggiunge oggi il punto esatto: è un aspetto collettivo e qui sotto trovi l’ora esatta.`,
      receipt: `${a} ${aspect} ${b} · esatto alle ${utcTime(event.at)}`,
      body: event.a,
      templateId: 'aspect-collective.v1',
      scope: 'collective',
      evidenceRefs: [dailyEventFactId(date, event)],
    };
  }
  return null;
}

/**
 * Locale-aware rendering over the same structured daily facts. English keeps
 * the canonical source output byte-for-byte; translated locales mirror its
 * selection order while rendering native labels, house themes, and receipts.
 */
export function dailyReadingForLocale(sunSign: string, daily: Daily, locale: Locale): DailyReading {
  if (locale === 'en') return dailyReading(sunSign, daily);

  const eventLine = locale === 'pt'
    ? eventLinePt
    : locale === 'fr'
      ? eventLineFr
      : locale === 'it'
        ? eventLineIt
        : eventLineEs;
  const houseLine = locale === 'pt'
    ? houseLinePt
    : locale === 'fr'
      ? houseLineFr
      : locale === 'it'
        ? houseLineIt
        : houseLineEs;
  const fallback = locale === 'pt'
    ? 'Um céu tranquilo hoje.'
    : locale === 'fr'
      ? 'Un ciel calme aujourd’hui.'
      : locale === 'it'
        ? 'Un cielo tranquillo oggi.'
        : 'Un cielo tranquilo hoy.';

  const lines: DailyLine[] = [];
  const usedHouses = new Set<number>();

  for (const event of daily.events) {
    const line = eventLine(event, sunSign, daily.date);
    if (line) {
      lines.push(line);
      if (event.sign) usedHouses.add(solarHouse(event.sign, sunSign));
    }
    if (lines.length >= 2) break;
  }

  const byName = (name: string) => daily.bodies.find((body) => body.body === name);
  const moon = byName('Moon');
  if (moon) {
    const house = solarHouse(moon.sign, sunSign);
    if (!usedHouses.has(house)) {
      lines.push(houseLine(moon, house, { date: daily.date, sunSign }));
      usedHouses.add(house);
    }
  }

  for (const name of ['Mercury', 'Venus', 'Mars', 'Sun']) {
    if (lines.length >= 4) break;
    const body = byName(name);
    if (!body) continue;
    const house = solarHouse(body.sign, sunSign);
    if (usedHouses.has(house)) continue;
    lines.push(houseLine(body, house, { date: daily.date, sunSign }));
    usedHouses.add(house);
  }

  return { headline: lines[0]?.text ?? fallback, lines };
}
