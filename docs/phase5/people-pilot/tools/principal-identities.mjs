/** Reviewed editorial selections of principal identity. Raw P106 evidence is unchanged.
 * Audit A20 corrected the first three against primary biographies; see
 * ../editorial-identities-2026-09-05.md. The 15 October 2026 review extended
 * the same correction to every directory-indexable person whose label led with
 * or paired in a secondary occupation, or was less specific than the noun the
 * description leads with, choosing cached occupation labels that match the
 * lead of the cached Wikidata description; see
 * ../editorial-identities-2026-10-15.md.
 * This is a closed, reviewed list of identity labels, not permission to recompose copy.
 */
export const PRINCIPAL_IDENTITIES = Object.freeze({
  // Audit A20, 5 September 2026.
  'neil-armstrong': ['astronaut', 'test pilot'],
  'amelia-earhart': ['aircraft pilot'],
  'maya-angelou': ['writer'],
  // Directory identity review, 15 October 2026.
  'alan-turing': ['computer scientist'],
  'albert-camus': ['philosopher', 'writer'],
  'alexander-graham-bell': ['scientist', 'inventor'],
  'alfred-hitchcock': ['film director'],
  'andy-warhol': ['visual artist', 'film director'],
  'audrey-hepburn': ['film actor'],
  'ayrton-senna': ['Formula One driver'],
  'bertrand-russell': ['analytic philosopher', 'logician'],
  'bette-davis': ['film actor'],
  'billie-holiday': ['jazz singer'],
  'bruce-lee': ['martial artist', 'film actor'],
  'charles-darwin': ['naturalist', 'biologist'],
  'charles-dickens': ['novelist', 'social critic'],
  'charlie-chaplin': ['film actor', 'film director'],
  'charlotte-bronte': ['novelist', 'poet'],
  'david-bowie': ['singer-songwriter', 'film actor'],
  'diego-maradona': ['association football player'],
  'ella-fitzgerald': ['jazz singer'],
  'elvis-presley': ['singer', 'film actor'],
  'franz-kafka': ['novelist'],
  'freddie-mercury': ['singer-songwriter'],
  'friedrich-nietzsche': ['philosopher'],
  'grace-kelly': ['film actor'],
  'haile-selassie': ['monarch'],
  'immanuel-kant': ['philosopher'],
  'indira-gandhi': ['politician'],
  'ingrid-bergman': ['film actor'],
  'jane-austen': ['novelist'],
  'jawaharlal-nehru': ['politician'],
  'jean-michel-basquiat': ['painter'],
  'john-lennon': ['singer-songwriter'],
  'judy-garland': ['film actor', 'singer'],
  'karl-marx': ['philosopher'],
  'katharine-hepburn': ['film actor'],
  'lata-mangeshkar': ['singer'],
  'louis-armstrong': ['jazz musician', 'trumpeter'],
  'luciano-pavarotti': ['opera singer'],
  'mahatma-gandhi': ['freedom fighter'],
  'maria-callas': ['opera singer'],
  'marie-curie': ['physicist', 'chemist'],
  'mark-twain': ['writer', 'humorist'],
  'michael-faraday': ['physicist'],
  'muhammad-ali-jinnah': ['politician'],
  'nelson-mandela': ['politician', 'political activist'],
  'pablo-picasso': ['painter', 'sculptor'],
  'paul-newman': ['film actor'],
  'prince': ['singer-songwriter'],
  'raj-kapoor': ['film actor', 'film producer'],
  'rosa-parks': ['civil rights advocate'],
  'sally-ride': ['astronaut', 'physicist'],
  'selena': ['singer'],
  'stephen-hawking': ['theoretical physicist', 'cosmologist'],
  'subhas-chandra-bose': ['politician'],
  'swami-vivekananda': ['monk', 'philosopher'],
  'sylvia-plath': ['poet', 'writer'],
  'tina-turner': ['singer', 'songwriter'],
  'toni-morrison': ['novelist', 'essayist'],
  'victor-hugo': ['novelist', 'poet'],
  'wilt-chamberlain': ['basketball player'],
});

export function reviewedIdentity(candidate, evidence, existingIdentity) {
  if (!Object.hasOwn(PRINCIPAL_IDENTITIES, candidate.slug)) return null;
  const disciplines = PRINCIPAL_IDENTITIES[candidate.slug];
  if (JSON.stringify(candidate.disciplines) !== JSON.stringify(disciplines)) {
    throw new Error(`${candidate.slug}: editorial selection differs from the reviewed identity migration`);
  }
  const sourced = new Set(evidence.occupations.map(({ label }) => label));
  if (disciplines.some((label) => !sourced.has(label))) {
    throw new Error(`${candidate.slug}: selected identity is absent from the cached occupation evidence`);
  }
  // The country and life-date suffix are outside this editorial migration.
  const suffixAt = existingIdentity.indexOf(' · ');
  if (suffixAt < 0) throw new Error(`${candidate.slug}: missing existing identity suffix`);
  const label = disciplines.join(' and ');
  return label[0].toUpperCase() + label.slice(1) + existingIdentity.slice(suffixAt);
}
