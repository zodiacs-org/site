/**
 * Lune piene e lune nuove in italiano, scritte a partire dai fatti del catalogo.
 * Niente lineette lunghe o medie.
 */
import { signBySlug, signName } from '../../signs';
import { degreeMinutes } from '../../today-sky';
import { dayMonthYear, utcClock } from '../horoscope/format';
import { THEME, prep, withArticle } from '../horoscope/it';
import type { LunationCopy, LunationFacts } from './types';

const L = 'it' as const;
const sign = (slug: string) => signName(signBySlug(slug), L);
/** "del Sagittario", "dei Gemelli", "dell’Ariete". */
const ofSign = (slug: string) => prep('di', withArticle(sign(slug)));
const kindName = (facts: LunationFacts) => (facts.kind === 'full' ? 'Luna piena' : 'Luna nuova');

/** "24 novembre 2026", con "1°" per il primo del mese. */
const when = (facts: LunationFacts) => dayMonthYear(L, facts.at).replace(/^1 /, '1° ');
/** "il 24 novembre 2026", "l’8 novembre 2026", "l’11 novembre 2026". */
const theDate = (facts: LunationFacts) => {
  const day = Number(facts.at.slice(8, 10));
  return day === 8 || day === 11 ? `l’${when(facts)}` : `il ${when(facts)}`;
};

/** L'ora in Italia (Europe/Rome), con lo scarto da UTC del giorno: +1 d'inverno, +2 con l'ora legale. */
function italianTime(at: string): { clock: string; offset: number; nextDay: boolean } {
  const instant = new Date(at);
  const parts = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', day: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = Number(get('hour'));
  const offset = ((hour - instant.getUTCHours()) + 24) % 24;
  return { clock: `${get('hour')}:${get('minute')}`, offset, nextDay: Number(get('day')) !== instant.getUTCDate() };
}

/** Che cosa mette in gioco ogni segno quando la Luna lo illumina o lo lascia al buio. */
const SIGN_TOPIC: Record<string, string> = {
  aries: 'l’iniziativa, il coraggio e la fretta',
  taurus: 'la sicurezza, i sensi e ciò che si costruisce con pazienza',
  gemini: 'le parole, la curiosità e i legami di tutti i giorni',
  cancer: 'la casa, la cura e la memoria di famiglia',
  leo: 'l’espressione di sé, l’orgoglio e la gioia',
  virgo: 'l’ordine, il lavoro fatto bene e i dettagli',
  libra: 'gli accordi, l’equità e la vita in comune',
  scorpio: 'la fiducia, ciò che si condivide e ciò che cambia in profondità',
  sagittarius: 'il senso delle cose, i viaggi e le convinzioni',
  capricorn: 'la responsabilità, gli obiettivi e il tempo',
  aquarius: 'l’amicizia, i gruppi e le idee nuove',
  pisces: 'la sensibilità, il riposo e ciò che resta non detto',
};

const ECLIPSE_KIND: Record<string, string> = {
  total: 'totale', partial: 'parziale', annular: 'anulare', penumbral: 'di penombra', hybrid: 'ibrida',
};

export const it: LunationCopy = {
  locale: L,
  title: (f) => `${kindName(f)} in ${sign(f.sign)}: ${when(f)}`,
  h1: (f) => `${kindName(f)} in ${sign(f.sign)}`,
  description: (f) => `La ${kindName(f)} ${prep('di', theDate(f))} è esatta alle ${utcClock(f.at)}, a ${degreeMinutes(f.degree)} ${ofSign(f.sign)}. Che cosa significa e che cosa cambia per ogni segno.`,
  kindLabel: (kind) => (kind === 'full' ? 'Luna piena' : 'Luna nuova'),
  crumbsRoot: 'Calendario lunare',
  lead: (f) => (f.kind === 'full'
    ? `La Luna piena ${prep('di', theDate(f))} è esatta alle ${utcClock(f.at)}, con la Luna a ${degreeMinutes(f.degree)} ${ofSign(f.sign)} e il Sole proprio di fronte. È il punto più luminoso del ciclo: quello che è partito con la Luna nuova precedente ora si vede con chiarezza.`
    : `La Luna nuova ${prep('di', theDate(f))} è esatta alle ${utcClock(f.at)}, con il Sole e la Luna insieme a ${degreeMinutes(f.degree)} ${ofSign(f.sign)}. Comincia un ciclo di circa quattro settimane: per tradizione è il momento di fissare un’intenzione piccola e concreta.`),
  eclipseNote: (f) => {
    if (!f.eclipse) return '';
    const kind = f.eclipse.kind && ECLIPSE_KIND[f.eclipse.kind] ? ` ${ECLIPSE_KIND[f.eclipse.kind]}` : '';
    return f.eclipse.type === 'solar'
      ? `Questa Luna nuova coincide con un’eclissi di Sole${kind}, perciò di solito la si legge come un inizio più marcato del solito.`
      : `Questa Luna piena coincide con un’eclissi di Luna${kind}, perciò di solito la si legge come una chiusura più netta del solito.`;
  },
  factLabels: { exact: 'Momento esatto', position: 'Posizione', phase: 'Fase' },
  meaning: (f) => (f.kind === 'full'
    ? [
      `In ${sign(f.sign)} la Luna piena mette a fuoco ${SIGN_TOPIC[f.sign]}. È un buon momento per raccogliere i risultati, chiudere qualcosa rimasto a metà e dire ad alta voce quello che sai già.`,
      'Non serve prendere grandi decisioni proprio quel giorno: la Luna piena porta chiarezza, e la settimana dopo serve ad aggiustare le cose con calma.',
    ]
    : [
      `In ${sign(f.sign)} la Luna nuova apre un ciclo che riguarda ${SIGN_TOPIC[f.sign]}. Funziona meglio un primo passo piccolo che una lunga lista di buoni propositi.`,
      'Scrivi una sola intenzione e riprendila alla Luna piena successiva, circa due settimane dopo.',
    ]),
  signNotesHeading: 'Che cosa cambia per ogni segno',
  signNotesIntro: 'Contata dal tuo segno solare (case solari a segno intero), questa Luna cade in un’area diversa per ogni segno.',
  signNote: (sunSign, house) => `${sign(sunSign)}: casa ${house}, ${THEME[house]}.`,
  previous: 'Precedente',
  next: 'Successiva',
  calendarLink: 'Calendario delle lune piene',
  moonPhaseLink: 'La fase lunare di oggi',
  horoscopesLink: 'Oroscopi',
  confidence: (value) => `Affidabilità della lettura ${value}%`,
  confidenceNote: 'Il numero dice quanto sono specifici i dati della lettura (qui, solo il segno solare), non la probabilità che qualcosa accada.',
  method: 'Il momento esatto e la posizione sono calcolati con il motore astronomico del sito. Gli orari sono in UTC.',
  faqHeading: 'Domande frequenti',
  faq: (f) => {
    const local = italianTime(f.at);
    const rule = local.offset === 2
      ? 'dove in quel periodo vale l’ora legale (UTC+2); d’inverno, con l’ora solare, lo scarto scende a un’ora (UTC+1)'
      : 'dove in quel periodo vale l’ora solare (UTC+1); d’estate, con l’ora legale, lo scarto sale a due ore (UTC+2)';
    return [
      {
        q: `A che ora è la ${kindName(f)} ${prep('di', theDate(f))}?`,
        a: `È esatta alle ${utcClock(f.at)}, cioè alle ${local.clock}${local.nextDay ? ' del giorno dopo' : ''} in Italia, ${rule}.`,
      },
      {
        q: `In quale segno cade la ${kindName(f)}?`,
        a: `In ${sign(f.sign)}, a ${degreeMinutes(f.degree)}.`,
      },
      {
        q: 'Mi serve il tema natale per leggerla?',
        a: 'No. Le note per segno usano solo il segno solare. Con il tuo tema natale puoi vedere in quale casa cade esattamente per te.',
      },
    ];
  },
};
