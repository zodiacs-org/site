/** Le date dei segni zodiacali in italiano. Niente lineette lunghe o medie. */
import type { ZodiacDatesCopy } from './types';

export const it: ZodiacDatesCopy = {
  locale: 'it',
  title: (current, next) => `Date dei segni zodiacali ${current} e ${next}`,
  h1: 'Le date dei segni zodiacali',
  description: (current, next) => `I dodici segni con date, elemento, modalità e governatore, e il minuto esatto in UTC in cui il Sole entra in ogni segno nel ${current} e nel ${next}.`,
  lede: (current, next) => `Le date che si leggono di solito per ogni segno sono approssimative: il Sole cambia segno in un momento diverso ogni anno. Qui trovi il minuto esatto, in UTC, di ogni ingresso nel ${current} e nel ${next}.`,
  crumbs: 'Impara',
  tableHeading: 'I dodici segni in una tabella',
  tableCaption: (current, next) => `Date, corrispondenze e ingresso esatto del Sole in ogni segno, ${current} e ${next}`,
  columns: {
    sign: 'Segno', dates: 'Date abituali', longitude: 'Longitudine', element: 'Elemento', modality: 'Modalità',
    ruler: 'Governatore', seasons: 'Stagione', ingress: (year) => `Ingresso del Sole ${year}`,
  },
  north: 'Nord',
  south: 'Sud',
  season: { Spring: 'primavera', Summer: 'estate', Autumn: 'autunno', Winter: 'inverno' },
  explainerHeading: 'Che cosa vogliono dire le date esatte',
  explainer: [
    'Lo zodiaco tropicale parte dall’Ariete, a 0 gradi di longitudine eclittica, e divide il cerchio in dodici segni uguali di 30 gradi ciascuno. Questi confini restano fermi; a cambiare sono il giorno e l’ora in cui il Sole li attraversa, perché un anno non dura un numero esatto di giorni.',
    'Per questo due persone nate nello stesso giorno del calendario, ma in anni diversi, possono avere segni solari diversi se sono nate a ridosso del cambio. Quella che di solito si chiama cuspide non è un segno a metà: il Sole è sempre in un segno o nell’altro.',
    'Se il tuo compleanno cade vicino a una di queste date, controlla il tuo segno con data, ora e luogo di nascita. L’ora locale dipende dal fuso orario in vigore quel giorno, ora legale compresa, e il calcolo del tema natale ne tiene conto.',
  ],
  calculatorLink: 'Calcola il tuo tema natale',
  methodLink: 'Come si calcolano le date',
  csvLink: 'Scarica la tabella (CSV, in inglese)',
  faqHeading: 'Domande frequenti',
  faq: (current) => [
    {
      q: 'Perché le date dei segni cambiano ogni anno?',
      a: 'Perché l’anno del calendario e l’anno solare non coincidono al minuto. Il Sole passa ogni anno dallo stesso punto del cielo, ma a un’ora diversa, e a volte in un giorno diverso.',
    },
    {
      q: `Quando comincia l’Ariete nel ${current}?`,
      a: 'La tabella riporta il minuto esatto in UTC. Per l’ora italiana aggiungi un’ora quando è in vigore l’ora solare e due con l’ora legale.',
    },
    {
      q: 'Che cosa succede se il mio compleanno cade su una cuspide?',
      a: 'Il tuo Sole è in un solo segno. Calcola il tuo tema natale con l’ora e il luogo di nascita per sapere quale.',
    },
  ],
};
