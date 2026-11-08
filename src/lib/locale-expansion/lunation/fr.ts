/**
 * Pleines et Nouvelles Lunes en français, écrites à partir des faits du
 * catalogue. Les heures de Paris, Bruxelles et Montréal sont tirées de
 * l’instant lui-même, avec le fuseau de chaque lieu (Intl), donc heure
 * d’hiver et heure d’été comprises. Tutoiement, apostrophe typographique,
 * aucun tiret long.
 */
import { signBySlug, signName } from '../../signs';
import { degreeMinutes } from '../../today-sky';
import { dayMonthYear } from '../horoscope/format';
import { THEME, of } from '../horoscope/fr';
import type { LunationCopy, LunationFacts } from './types';

const L = 'fr' as const;
const sign = (slug: string) => signName(signBySlug(slug), L);
const kindName = (facts: LunationFacts) => (facts.kind === 'full' ? 'Pleine Lune' : 'Nouvelle Lune');
/** "24 novembre 2026", avec "1er" pour le premier du mois. */
const when = (f: LunationFacts) => dayMonthYear(L, f.at).replace(/^1 /, '1er ');
/** "14:53", comme les autres pages françaises du site (horoscopes, year-sky). */
const hm = (hour: string, minute: string) => `${hour}:${minute}`;
const clock = (f: LunationFacts) => `${hm(f.at.slice(11, 13), f.at.slice(14, 16))} UTC`;
/** "2°19′ des Gémeaux", "14°05′ de la Vierge". */
const degree = (f: LunationFacts) => `${degreeMinutes(f.degree)} ${of(f.sign)}`;

/** L’heure locale d’un fuseau, avec le jour quand il diffère de celui en UTC. */
function localTime(f: LunationFacts, timeZone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23', day: 'numeric', month: 'numeric', year: 'numeric',
  }).formatToParts(new Date(f.at)).map((part) => [part.type, part.value]));
  const time = hm(parts.hour, parts.minute);
  if (Number(parts.day) === Number(f.at.slice(8, 10))) return time;
  const local = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}T12:00:00Z`;
  return `${time}, le ${dayMonthYear(L, local).replace(/^1 /, '1er ').replace(/ \d{4}$/, '')}`;
}

/** Ce que chaque signe met en jeu quand la Lune l’éclaire ou l’assombrit. */
const SIGN_TOPIC: Record<string, string> = {
  aries: 'l’élan, le courage et l’impatience',
  taurus: 'la sécurité, le confort et ce qui se construit lentement',
  gemini: 'les mots, la curiosité et les liens proches',
  cancer: 'le foyer, le soin des siens et la mémoire familiale',
  leo: 'l’expression de soi, la fierté et la joie',
  virgo: 'l’ordre, le travail soigné et les détails',
  libra: 'les accords, le sens de la justice et la vie à deux',
  scorpio: 'la confiance, ce qui se partage et ce qui se transforme',
  sagittarius: 'le sens des choses, les voyages et les convictions',
  capricorn: 'les responsabilités, les objectifs et le temps long',
  aquarius: 'l’amitié, les groupes et les idées neuves',
  pisces: 'la sensibilité, le repos et ce qui reste non dit',
};

export const fr: LunationCopy = {
  locale: L,
  title: (f) => `${kindName(f)} en ${sign(f.sign)} : ${when(f)}`,
  h1: (f) => `${kindName(f)} en ${sign(f.sign)}`,
  description: (f) => `La ${kindName(f)} du ${when(f)} est exacte à ${clock(f)}, à ${degree(f)}. Ce qu’elle signifie et comment elle touche chaque signe.`,
  kindLabel: (kind) => (kind === 'full' ? 'Pleine Lune' : 'Nouvelle Lune'),
  crumbsRoot: 'Calendrier lunaire',
  lead: (f) => (f.kind === 'full'
    ? `La Pleine Lune du ${when(f)} est exacte à ${clock(f)}, avec la Lune à ${degree(f)} et le Soleil juste en face. C’est le moment le plus lumineux du cycle : ce qui a commencé à la Nouvelle Lune précédente se voit maintenant clairement.`
    : `La Nouvelle Lune du ${when(f)} est exacte à ${clock(f)}, avec le Soleil et la Lune réunis à ${degree(f)}. Elle ouvre un cycle d’environ quatre semaines, le moment classique pour poser une intention modeste et concrète.`),
  eclipseNote: (f) => (f.eclipse
    ? f.eclipse.type === 'solar'
      ? 'Cette Nouvelle Lune coïncide avec une éclipse de Soleil : on la lit d’ordinaire comme un départ plus marqué que d’habitude.'
      : 'Cette Pleine Lune coïncide avec une éclipse de Lune : la clôture qu’elle apporte se lit d’ordinaire comme plus nette que d’habitude.'
    : ''),
  factLabels: { exact: 'Moment exact', position: 'Position', phase: 'Phase' },
  meaning: (f) => (f.kind === 'full'
    ? [
      `En ${sign(f.sign)}, la Pleine Lune met en lumière ${SIGN_TOPIC[f.sign]}. C’est le bon moment pour constater des résultats, finir ce qui traînait et dire tout haut ce que tu sais déjà.`,
      'Inutile de prendre de grandes décisions le jour même : la Pleine Lune éclaire, et la semaine qui suit sert à ajuster sans hâte.',
    ]
    : [
      `En ${sign(f.sign)}, la Nouvelle Lune ouvre un cycle pour ${SIGN_TOPIC[f.sign]}. Mieux vaut un premier petit pas qu’une longue liste de bonnes résolutions.`,
      'Note une seule intention et reviens-y à la Pleine Lune suivante, environ deux semaines plus tard.',
    ]),
  signNotesHeading: 'Comment elle touche chaque signe',
  signNotesIntro: 'Comptée depuis ton signe solaire (maisons solaires en signes entiers), cette Lune tombe dans un domaine différent pour chaque signe.',
  signNote: (sunSign, house) => `${sign(sunSign)} : maison ${house}, ${THEME[house]}.`,
  previous: 'Précédente',
  next: 'Suivante',
  calendarLink: 'Calendrier des Pleines Lunes',
  moonPhaseLink: 'La phase de la Lune aujourd’hui',
  horoscopesLink: 'Horoscopes',
  confidence: (value) => `Confiance de lecture ${value} %`,
  confidenceNote: 'Le chiffre dit à quel point les données de la lecture sont précises (ici, le signe solaire seul), pas la probabilité que quelque chose arrive.',
  method: 'Le moment exact et la position sont calculés par le moteur astronomique du site. Les heures sont en UTC.',
  faqHeading: 'Questions fréquentes',
  faq: (f) => [
    {
      q: `À quelle heure a lieu la ${kindName(f)} du ${when(f)} ?`,
      a: `Elle est exacte à ${clock(f)}. En France et en Belgique, qui avancent d’une heure sur l’UTC en hiver et de deux en été, il est alors ${localTime(f, 'Europe/Paris')}. Au Québec, qui retarde de cinq heures sur l’UTC en hiver et de quatre en été, il est ${localTime(f, 'America/Toronto')}.`,
    },
    {
      q: `Dans quel signe se trouve la ${kindName(f)} ?`,
      a: `En ${sign(f.sign)}, à ${degreeMinutes(f.degree)}.`,
    },
    {
      q: 'Ai-je besoin de mon thème astral pour la lire ?',
      a: 'Non. Les notes par signe n’utilisent que le signe solaire. Avec ton thème astral, tu vois dans quelle maison elle tombe exactement pour toi.',
    },
  ],
};
