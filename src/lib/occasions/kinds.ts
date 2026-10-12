/** The occasions a card can be made for. Remembrance is added later, with its own wording. */
export const OCCASION_KINDS = [
  'wedding', 'anniversary', 'met', 'birthday', 'baby', 'pet', 'home', 'job', 'graduation',
  'retirement', 'coming-of-age', 'gathering',
] as const;
export type OccasionKind = (typeof OCCASION_KINDS)[number];

/** Labels for the occasion picker. */
export const OCCASION_LABELS: Readonly<Record<OccasionKind, string>> = {
  wedding: 'Wedding',
  anniversary: 'Anniversary',
  met: 'The day we met',
  birthday: 'Birthday',
  baby: 'A new baby',
  pet: 'A pet’s birthday or adoption day',
  home: 'A new home',
  job: 'A new job',
  graduation: 'Graduation',
  retirement: 'Retirement',
  'coming-of-age': 'Coming of age (18th, 21st, quinceañera)',
  gathering: 'An evening under the sky',
};
