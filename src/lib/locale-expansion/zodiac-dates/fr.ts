/**
 * Dates des signes du zodiaque en français. Tutoiement, apostrophe
 * typographique, aucun tiret long. Les libellés suivent l’interface française
 * du site (Comprendre, Élément, Maître).
 */
import type { ZodiacDatesCopy } from './types';

export const fr: ZodiacDatesCopy = {
  locale: 'fr',
  title: (current, next) => `Dates des signes du zodiaque ${current} et ${next}`,
  h1: 'Dates des signes du zodiaque',
  description: (current, next) => `Les douze signes avec leurs dates, leur élément, leur modalité et leur maître, et la minute exacte, en UTC, où le Soleil entre dans chaque signe en ${current} et ${next}.`,
  lede: (current, next) => `Les dates habituelles des signes sont approximatives : le Soleil change de signe à un moment différent chaque année. Voici la minute exacte, en UTC, de chaque entrée en ${current} et ${next}.`,
  crumbs: 'Comprendre',
  tableHeading: 'Les douze signes en un tableau',
  tableCaption: (current, next) => `Dates, correspondances et entrée exacte du Soleil dans chaque signe, ${current} et ${next}`,
  columns: {
    sign: 'Signe', dates: 'Dates habituelles', longitude: 'Longitude', element: 'Élément', modality: 'Modalité',
    ruler: 'Maître', seasons: 'Saison', ingress: (year) => `Entrée du Soleil ${year}`,
  },
  north: 'Nord',
  south: 'Sud',
  season: { Spring: 'printemps', Summer: 'été', Autumn: 'automne', Winter: 'hiver' },
  explainerHeading: 'Ce que disent les dates exactes',
  explainer: [
    'Le zodiaque tropical commence au Bélier, à 0° de longitude écliptique, et partage le cercle en douze signes égaux de 30°. Ces limites ne bougent pas. Ce qui change, c’est la date et l’heure auxquelles le Soleil les franchit, parce qu’une année ne compte pas un nombre entier de jours.',
    'Deux personnes nées le même jour, mais pas la même année, peuvent donc avoir des signes solaires différents si elles sont nées près du changement. Ce qu’on appelle une « cuspide » n’est pas un signe mixte : le Soleil est toujours dans un signe ou dans l’autre.',
    'Si ta naissance tombe près de l’une de ces dates, vérifie ton signe avec ta date, ton heure et ton lieu de naissance. L’heure locale dépend du fuseau horaire en vigueur ce jour-là, et le calcul du thème astral en tient compte.',
  ],
  calculatorLink: 'Calcule ton thème astral',
  methodLink: 'Comment les dates sont calculées',
  csvLink: 'Télécharger le tableau (CSV, en anglais)',
  faqHeading: 'Questions fréquentes',
  faq: (current) => [
    {
      q: 'Pourquoi les dates des signes changent-elles chaque année ?',
      a: 'Parce que l’année du calendrier et l’année solaire ne coïncident pas à la minute près. Le Soleil franchit chaque année le même point du ciel, mais à une heure différente, et parfois un autre jour.',
    },
    {
      q: `Quand commence le Bélier en ${current} ?`,
      a: 'Le tableau donne la minute exacte en UTC. En France et en Belgique, ajoute une heure en hiver et deux en été ; au Québec, retire cinq heures en hiver et quatre en été.',
    },
    {
      q: 'Et si ma naissance tombe sur une cuspide ?',
      a: 'Ton Soleil est dans un seul signe. Calcule ton thème astral avec ton heure et ton lieu de naissance pour savoir lequel.',
    },
  ],
};
