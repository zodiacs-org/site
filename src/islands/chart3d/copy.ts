/**
 * Strings for the dimensional chart view.
 *
 * These live beside the island rather than in the shared UI catalogue, the
 * same way the calculator's own lens and wheel-action labels do. Because
 * this module is only imported by the lazily-loaded view, the five extra
 * locales never reach the birth-chart route's initial payload.
 *
 * Russian falls back to English with the marker the rest of the site uses
 * for not-yet-translated surfaces; the control itself is never hidden.
 */
import type { CatalogLocale, ReleasedLocale } from '../../lib/i18n/core';

export interface DepthCopy {
  figureLabel: string;
  tiltLabel: string;
  tiltAria: string;
  timeLabel: string;
  timeAria: string;
  reset: string;
  resetAria: string;
  keyEcliptic: string;
  keyEquator: string;
  keyMoon: string;
  keyHorizon: string;
  keyBounds: string;
  keyDecl: string;
  dragHint: string;
  north: string;
  south: string;
  /** {body} {dir} {deg} */
  offPlane: string;
  sunDefines: string;
  /** {deg} */
  eclipseInside: string;
  eclipseOutside: string;
  /** {deg} {when} */
  sectDay: string;
  sectNight: string;
  sectLevel: string;
  /** Fills {when}: the time control moves the sky off the birth minute. */
  atBirth: string;
  atMoment: string;
  /** {light} {inSect} {outSect} */
  sectLine: string;
  sectLink: string;
  /** {a} {degA} {dirA} {b} {degB} {dirB} {rel} {orb} {sep} */
  declLine: string;
  declParallel: string;
  declContra: string;
  /** {n} */
  declMore: string;
  declLink: string;
  /** Selected body's own ties: {rel} {body} {orb} */
  declPicked: string;
  /** Synastry: legend rows and the tightest-contact line. */
  keyYours: string;
  keyTheirs: string;
  /** {a} {b} — bodies already localized; {rel} aspect name; {orb} degrees. */
  interLine: string;
  /** {n} */
  interMore: string;
  /** Shown when a side carries longitude-only positions. */
  flatSide: string;
  /** {body} {deg} {limit} */
  outOfBounds: string;
  moonMean: string;
  /** Shown while the time control is away from birth. */
  scrubNote: string;
  noAngles: string;
  /** Selected-body readout. */
  latitudeShort: string;
  declinationShort: string;
  above: string;
  below: string;
  /** Empty for released locales; the marker sentence for Russian. */
  englishNote: string;
}

const en: DepthCopy = {
  figureLabel:
    'The chart as an armillary sphere. Drag to turn it. The ecliptic carries the zodiac band; the celestial equator crosses it at the equinoxes, the Moon’s orbit at the nodes, and the horizon at your ascendant.',
  tiltLabel: 'Tilt',
  tiltAria: 'Tilt the sphere: 0 degrees looks straight down on the flat wheel, 90 degrees is edge-on to the ecliptic',
  timeLabel: 'Time',
  timeAria: 'Move the sky through the twelve hours either side of birth; the planets barely move, the horizon turns',
  reset: 'Reset view',
  resetAria: 'Return the sphere to its opening angle',
  keyEcliptic: 'ecliptic · the zodiac band the chart sits on',
  keyEquator: 'celestial equator · 23.4° · crosses at the equinoxes',
  keyMoon: 'Moon’s orbit · 5.1° · dashed · crosses at the nodes',
  keyHorizon: 'horizon · your sky at birth · meets the zodiac at the ascendant',
  keyBounds: 'declination bounds · ±23.4° · the furthest the Sun ever goes',
  keyDecl: 'shared declination · the ring a parallel pair rides',
  dragHint:
    'Drag to turn the sphere. Bodies sit at their real ecliptic latitude, on a globe of directions — where each one was, not how far away.',
  north: 'north',
  south: 'south',
  offPlane: '{body} {dir} {deg}°',
  sunDefines: 'Sun 0.0° — it defines the plane',
  eclipseInside: 'The Sun is {deg}° from the nearer node, so this chart falls inside an eclipse season.',
  eclipseOutside: 'The Sun is {deg}° from the nearer node, so this chart is outside an eclipse season.',
  sectDay: 'Day chart — the Sun stood {deg}° above the horizon {when}.',
  sectNight: 'Night chart — the Sun sat {deg}° below the horizon {when}.',
  sectLevel: 'The Sun sits on the horizon itself, between a day chart and a night one.',
  atBirth: 'at birth',
  atMoment: 'at that moment',
  sectLine: 'sect light {light} · in sect {inSect} · out of sect {outSect}',
  sectLink: 'What sect means',
  declLine: '{a} {degA}° {dirA} · {b} {degB}° {dirB} · {rel} to {orb}° · {sep}° apart on the wheel',
  declParallel: 'parallel',
  declContra: 'contraparallel',
  declMore: 'This chart carries {n} declination aspects in all.',
  declLink: 'What a parallel is',
  declPicked: '{rel} {body} {orb}°',
  keyYours: 'your planets · solid',
  keyTheirs: 'their planets · dashed',
  interLine: 'Your {a} {rel} their {b} · {orb}° from exact',
  interMore: '{n} contacts between the two charts are drawn.',
  flatSide: 'Positions shared by link carry longitude only, so that chart’s bodies sit on the band.',
  outOfBounds: '{body} declination {deg}° — out of bounds, past the {limit}° the Sun never passes.',
  moonMean: 'The Moon’s road is drawn at its mean 5.1° tilt through this chart’s nodes; the real nodes drift about 19.3° a year.',
  scrubNote: 'As time runs, each planet moves along the zodiac at the rate it had at birth; its tilt above the plane is held.',
  noAngles: 'Without a birth time and place there is no horizon to draw — this is the sky, but not yet your sky.',
  latitudeShort: 'lat',
  declinationShort: 'dec',
  above: 'above the horizon',
  below: 'below the horizon',
  englishNote: '',
};

const es: DepthCopy = {
  figureLabel:
    'La carta como esfera armilar. Arrástrala para girarla. La eclíptica lleva la banda zodiacal; el ecuador celeste la cruza en los equinoccios, la órbita de la Luna en los nodos y el horizonte en tu ascendente.',
  tiltLabel: 'Inclinación',
  tiltAria: 'Inclina la esfera: 0 grados mira la rueda plana desde arriba, 90 grados la deja de canto',
  timeLabel: 'Hora',
  timeAria: 'Mueve el cielo por las doce horas antes y después del nacimiento; los planetas apenas se mueven, el horizonte gira',
  reset: 'Restablecer vista',
  resetAria: 'Devuelve la esfera a su ángulo inicial',
  keyEcliptic: 'eclíptica · la banda zodiacal donde vive la carta',
  keyEquator: 'ecuador celeste · 23,4° · cruza en los equinoccios',
  keyMoon: 'órbita de la Luna · 5,1° · discontinua · cruza en los nodos',
  keyHorizon: 'horizonte · tu cielo al nacer · toca el zodiaco en el ascendente',
  keyBounds: 'límites de declinación · ±23,4° · lo más lejos que llega el Sol',
  keyDecl: 'declinación compartida · el anillo por el que va un par paralelo',
  dragHint:
    'Arrastra para girar la esfera. Los cuerpos están en su latitud eclíptica real, sobre un globo de direcciones: dónde estaba cada uno, no a qué distancia.',
  north: 'norte',
  south: 'sur',
  offPlane: '{body} {dir} {deg}°',
  sunDefines: 'Sol 0,0° — él define el plano',
  eclipseInside: 'El Sol está a {deg}° del nodo más cercano, así que esta carta cae dentro de una temporada de eclipses.',
  eclipseOutside: 'El Sol está a {deg}° del nodo más cercano, así que esta carta queda fuera de una temporada de eclipses.',
  sectDay: 'Carta diurna — el Sol estaba {deg}° sobre el horizonte {when}.',
  sectNight: 'Carta nocturna — el Sol estaba {deg}° bajo el horizonte {when}.',
  sectLevel: 'El Sol está justo en el horizonte, entre una carta diurna y una nocturna.',
  atBirth: 'al nacer',
  atMoment: 'en ese momento',
  sectLine: 'luminaria de secta {light} · en secta {inSect} · fuera de secta {outSect}',
  sectLink: 'Qué significa la secta',
  declLine: '{a} {degA}° {dirA} · {b} {degB}° {dirB} · {rel} a {orb}° · {sep}° de distancia en la rueda',
  declParallel: 'paralelo',
  declContra: 'contraparalelo',
  declMore: 'Esta carta reúne {n} aspectos de declinación en total.',
  declLink: 'Qué es un paralelo',
  declPicked: '{rel} con {body} {orb}°',
  keyYours: 'tus planetas · trazo continuo',
  keyTheirs: 'sus planetas · discontinuo',
  interLine: 'Tu {a} en {rel} con su {b} · a {orb}° del exacto',
  interMore: 'Se dibujan {n} contactos entre las dos cartas.',
  flatSide: 'Las posiciones compartidas por enlace llevan solo longitud, así que los cuerpos de esa carta quedan sobre la banda.',
  outOfBounds: 'Declinación de {body}: {deg}° — fuera de límites, más allá de los {limit}° que el Sol nunca pasa.',
  moonMean: 'El camino de la Luna se dibuja con su inclinación media de 5,1° por los nodos de esta carta; los nodos reales se desplazan unos 19,3° al año.',
  scrubNote: 'Al correr el tiempo, cada planeta avanza por el zodiaco al ritmo que llevaba al nacer; su inclinación sobre el plano queda fija.',
  noAngles: 'Sin hora y lugar de nacimiento no hay horizonte que dibujar: esto es el cielo, pero todavía no es tu cielo.',
  latitudeShort: 'lat',
  declinationShort: 'dec',
  above: 'sobre el horizonte',
  below: 'bajo el horizonte',
  englishNote: '',
};

const pt: DepthCopy = {
  figureLabel:
    'O mapa como esfera armilar. Arraste para girar. A eclíptica carrega a faixa zodiacal; o equador celeste a cruza nos equinócios, a órbita da Lua nos nodos e o horizonte no seu ascendente.',
  tiltLabel: 'Inclinação',
  tiltAria: 'Incline a esfera: 0 graus olha a roda plana de cima, 90 graus a deixa de perfil',
  timeLabel: 'Hora',
  timeAria: 'Mova o céu pelas doze horas antes e depois do nascimento; os planetas quase não se movem, o horizonte gira',
  reset: 'Redefinir vista',
  resetAria: 'Devolve a esfera ao ângulo inicial',
  keyEcliptic: 'eclíptica · a faixa zodiacal onde o mapa fica',
  keyEquator: 'equador celeste · 23,4° · cruza nos equinócios',
  keyMoon: 'órbita da Lua · 5,1° · tracejada · cruza nos nodos',
  keyHorizon: 'horizonte · seu céu ao nascer · encontra o zodíaco no ascendente',
  keyBounds: 'limites de declinação · ±23,4° · o ponto mais distante que o Sol alcança',
  keyDecl: 'declinação partilhada · o anel que um par paralelo percorre',
  dragHint:
    'Arraste para girar a esfera. Os corpos ficam na sua latitude eclíptica real, sobre um globo de direções: onde cada um estava, não a que distância.',
  north: 'norte',
  south: 'sul',
  offPlane: '{body} {dir} {deg}°',
  sunDefines: 'Sol 0,0° — ele define o plano',
  eclipseInside: 'O Sol está a {deg}° do nodo mais próximo, então este mapa cai dentro de uma temporada de eclipses.',
  eclipseOutside: 'O Sol está a {deg}° do nodo mais próximo, então este mapa fica fora de uma temporada de eclipses.',
  sectDay: 'Mapa diurno — o Sol estava {deg}° acima do horizonte {when}.',
  sectNight: 'Mapa noturno — o Sol estava {deg}° abaixo do horizonte {when}.',
  sectLevel: 'O Sol está exatamente no horizonte, entre um mapa diurno e um noturno.',
  atBirth: 'ao nascer',
  atMoment: 'nesse momento',
  sectLine: 'luminar da seita {light} · em seita {inSect} · fora de seita {outSect}',
  sectLink: 'O que significa a seita',
  declLine: '{a} {degA}° {dirA} · {b} {degB}° {dirB} · {rel} a {orb}° · {sep}° de distância na roda',
  declParallel: 'paralelo',
  declContra: 'contraparalelo',
  declMore: 'Este mapa reúne {n} aspetos de declinação no total.',
  declLink: 'O que é um paralelo',
  declPicked: '{rel} com {body} {orb}°',
  keyYours: 'seus planetas · traço contínuo',
  keyTheirs: 'planetas da outra pessoa · tracejado',
  interLine: 'Seu {a} em {rel} com o {b} da outra pessoa · a {orb}° do exato',
  interMore: 'São desenhados {n} contatos entre os dois mapas.',
  flatSide: 'Posições partilhadas por link trazem apenas a longitude, então os corpos desse mapa ficam sobre a faixa.',
  outOfBounds: 'Declinação de {body}: {deg}° — fora de limites, além dos {limit}° que o Sol nunca passa.',
  moonMean: 'O caminho da Lua é desenhado na sua inclinação média de 5,1° pelos nodos deste mapa; os nodos reais deslocam-se cerca de 19,3° por ano.',
  scrubNote: 'Com o tempo a correr, cada planeta avança pelo zodíaco no ritmo que tinha ao nascer; a sua inclinação sobre o plano fica fixa.',
  noAngles: 'Sem hora e local de nascimento não há horizonte a desenhar: este é o céu, mas ainda não o seu céu.',
  latitudeShort: 'lat',
  declinationShort: 'dec',
  above: 'acima do horizonte',
  below: 'abaixo do horizonte',
  englishNote: '',
};

const fr: DepthCopy = {
  figureLabel:
    'Le thème en sphère armillaire. Fais glisser pour la tourner. L’écliptique porte la bande zodiacale ; l’équateur céleste la croise aux équinoxes, l’orbite de la Lune aux nœuds et l’horizon à ton ascendant.',
  tiltLabel: 'Inclinaison',
  tiltAria: 'Incline la sphère : 0 degré regarde la roue plate d’en haut, 90 degrés la met de profil',
  timeLabel: 'Heure',
  timeAria: 'Déplace le ciel sur les douze heures autour de la naissance ; les planètes bougent à peine, l’horizon tourne',
  reset: 'Réinitialiser la vue',
  resetAria: 'Ramène la sphère à son angle d’ouverture',
  keyEcliptic: 'écliptique · la bande zodiacale où se tient le thème',
  keyEquator: 'équateur céleste · 23,4° · croise aux équinoxes',
  keyMoon: 'orbite de la Lune · 5,1° · pointillés · croise aux nœuds',
  keyHorizon: 'horizon · ton ciel à la naissance · rejoint le zodiaque à l’ascendant',
  keyBounds: 'limites de déclinaison · ±23,4° · le plus loin que le Soleil aille',
  keyDecl: 'déclinaison partagée · l’anneau que suit une paire parallèle',
  dragHint:
    'Fais glisser pour tourner la sphère. Les corps sont à leur latitude écliptique réelle, sur un globe de directions : où chacun se trouvait, non à quelle distance.',
  north: 'nord',
  south: 'sud',
  offPlane: '{body} {dir} {deg}°',
  sunDefines: 'Soleil 0,0° — c’est lui qui définit le plan',
  eclipseInside: 'Le Soleil est à {deg}° du nœud le plus proche : ce thème tombe dans une saison d’éclipses.',
  eclipseOutside: 'Le Soleil est à {deg}° du nœud le plus proche : ce thème est hors saison d’éclipses.',
  sectDay: 'Thème diurne — le Soleil était {deg}° au-dessus de l’horizon {when}.',
  sectNight: 'Thème nocturne — le Soleil était {deg}° sous l’horizon {when}.',
  sectLevel: 'Le Soleil est sur l’horizon même, entre un thème diurne et un thème nocturne.',
  atBirth: 'à la naissance',
  atMoment: 'à cet instant',
  sectLine: 'luminaire de secte {light} · en secte {inSect} · hors secte {outSect}',
  sectLink: 'Ce que veut dire la secte',
  declLine: '{a} {degA}° {dirA} · {b} {degB}° {dirB} · {rel} à {orb}° · {sep}° d’écart sur la roue',
  declParallel: 'parallèle',
  declContra: 'contre-parallèle',
  declMore: 'Ce thème compte {n} aspects de déclinaison en tout.',
  declLink: 'Ce qu’est un parallèle',
  declPicked: '{rel} avec {body} {orb}°',
  keyYours: 'tes planètes · trait plein',
  keyTheirs: 'leurs planètes · pointillés',
  interLine: '{a} de ton thème en {rel} avec leur {b} · à {orb}° de l’exact',
  interMore: '{n} contacts entre les deux thèmes sont tracés.',
  flatSide: 'Les positions partagées par lien ne portent que la longitude ; les corps de ce thème restent sur la bande.',
  outOfBounds: 'Déclinaison de {body} : {deg}° — hors limites, au-delà des {limit}° que le Soleil ne dépasse jamais.',
  moonMean: 'La route de la Lune est tracée à son inclinaison moyenne de 5,1° par les nœuds de ce thème ; les nœuds réels dérivent d’environ 19,3° par an.',
  scrubNote: 'Quand le temps défile, chaque planète avance sur le zodiaque au rythme qu’elle avait à la naissance ; son inclinaison sur le plan reste fixe.',
  noAngles: 'Sans heure ni lieu de naissance, pas d’horizon à tracer : voici le ciel, mais pas encore le tien.',
  latitudeShort: 'lat',
  declinationShort: 'décl',
  above: 'au-dessus de l’horizon',
  below: 'sous l’horizon',
  englishNote: '',
};

const it: DepthCopy = {
  figureLabel:
    'Il tema come sfera armillare. Trascina per ruotarla. L’eclittica porta la fascia zodiacale; l’equatore celeste la incrocia agli equinozi, l’orbita della Luna ai nodi e l’orizzonte al tuo ascendente.',
  tiltLabel: 'Inclinazione',
  tiltAria: 'Inclina la sfera: 0 gradi guarda la ruota piatta dall’alto, 90 gradi la mette di taglio',
  timeLabel: 'Ora',
  timeAria: 'Muovi il cielo nelle dodici ore intorno alla nascita; i pianeti si muovono appena, l’orizzonte gira',
  reset: 'Reimposta vista',
  resetAria: 'Riporta la sfera al suo angolo iniziale',
  keyEcliptic: 'eclittica · la fascia zodiacale su cui sta il tema',
  keyEquator: 'equatore celeste · 23,4° · incrocia agli equinozi',
  keyMoon: 'orbita della Luna · 5,1° · tratteggiata · incrocia ai nodi',
  keyHorizon: 'orizzonte · il tuo cielo alla nascita · tocca lo zodiaco all’ascendente',
  keyBounds: 'limiti di declinazione · ±23,4° · il punto più lontano che il Sole raggiunge',
  keyDecl: 'declinazione condivisa · l’anello che percorre una coppia parallela',
  dragHint:
    'Trascina per ruotare la sfera. I corpi stanno alla loro latitudine eclittica reale, su un globo di direzioni: dove ciascuno era, non quanto lontano.',
  north: 'nord',
  south: 'sud',
  offPlane: '{body} {dir} {deg}°',
  sunDefines: 'Sole 0,0° — è lui a definire il piano',
  eclipseInside: 'Il Sole è a {deg}° dal nodo più vicino, quindi questo tema cade dentro una stagione di eclissi.',
  eclipseOutside: 'Il Sole è a {deg}° dal nodo più vicino, quindi questo tema resta fuori da una stagione di eclissi.',
  sectDay: 'Tema diurno — il Sole stava {deg}° sopra l’orizzonte {when}.',
  sectNight: 'Tema notturno — il Sole stava {deg}° sotto l’orizzonte {when}.',
  sectLevel: 'Il Sole sta proprio sull’orizzonte, fra un tema diurno e uno notturno.',
  atBirth: 'alla nascita',
  atMoment: 'in quel momento',
  sectLine: 'luminare di setta {light} · in setta {inSect} · fuori setta {outSect}',
  sectLink: 'Che cosa significa la setta',
  declLine: '{a} {degA}° {dirA} · {b} {degB}° {dirB} · {rel} a {orb}° · {sep}° di distanza sulla ruota',
  declParallel: 'parallelo',
  declContra: 'controparallelo',
  declMore: 'Questo tema conta {n} aspetti di declinazione in tutto.',
  declLink: 'Che cos’è un parallelo',
  declPicked: '{rel} con {body} {orb}°',
  keyYours: 'i tuoi pianeti · tratto pieno',
  keyTheirs: 'i loro pianeti · tratteggiato',
  interLine: 'Il tuo {a} in {rel} con il loro {b} · a {orb}° dall’esatto',
  interMore: 'Sono tracciati {n} contatti fra i due temi.',
  flatSide: 'Le posizioni condivise via link portano solo la longitudine: i corpi di quel tema restano sulla fascia.',
  outOfBounds: 'Declinazione di {body}: {deg}° — fuori limite, oltre i {limit}° che il Sole non supera mai.',
  moonMean: 'La strada della Luna è tracciata alla sua inclinazione media di 5,1° per i nodi di questo tema; i nodi reali si spostano di circa 19,3° all’anno.',
  scrubNote: 'Mentre il tempo scorre, ogni pianeta avanza lungo lo zodiaco al ritmo che aveva alla nascita; la sua inclinazione sul piano resta ferma.',
  noAngles: 'Senza ora e luogo di nascita non c’è orizzonte da tracciare: questo è il cielo, ma non ancora il tuo cielo.',
  latitudeShort: 'lat',
  declinationShort: 'decl',
  above: 'sopra l’orizzonte',
  below: 'sotto l’orizzonte',
  englishNote: '',
};

const DEPTH_COPY = { en, es, pt, fr, it } satisfies Record<ReleasedLocale, DepthCopy>;

/** The site's marker for a surface that has not been translated yet. */
const RU_NOTE = 'Подписи к сфере пока по-английски.';

export function depthCopyFor(locale: CatalogLocale): DepthCopy {
  if (locale === 'ru') return { ...en, englishNote: RU_NOTE };
  return DEPTH_COPY[locale as ReleasedLocale] ?? en;
}

/** Fill {name} placeholders. Kept tiny — this is not a template engine. */
export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/gu, (whole, key: string) => values[key] ?? whole);
}
