/**
 * The Year Ahead Score's tiers, on their own so the share function can name a
 * score's tier without loading the transit sentences (./reading.ts re-exports
 * it). Copy rules as in ./reading.ts. Pure.
 */
export interface ScoreTier {
  key: 'open' | 'supportive' | 'balanced' | 'pressure' | 'heavy-pressure';
  label: string;
  summary: string;
}

/**
 * The tier for a 0 to 10 score. The cut points sit symmetrically around 5
 * (2, 3.5, 6.5, 8); scripts/calibrate-year-score.ts prints the share of
 * people in each tier, with and without a birth time.
 */
export function scoreTier(score: number): ScoreTier {
  if (score >= 8) return { key: 'open', label: 'A wide open year', summary: 'The slow planets mostly help. Tradition reads a year like this as strong for career growth, and a good window to start things and sign agreements.' };
  if (score >= 6.5) return { key: 'supportive', label: 'A supportive year', summary: 'More of the slow-planet weather helps than presses. A good year to build on what already works, in your work and at home.' };
  if (score >= 3.5) return { key: 'balanced', label: 'A balanced year', summary: 'Support and pressure arrive in about equal measure. The months below show when each one leads.' };
  if (score >= 2) return { key: 'pressure', label: 'A year of steady pressure', summary: 'The slow planets ask more than they give. Astrology reads this as a year for patience and follow through: steady work, keeping things simple and taking rest seriously.' };
  return { key: 'heavy-pressure', label: 'A year of heavy pressure', summary: 'The slow planets press hard on the chart. Tradition reads this as a demanding year: keep commitments clear, look after your energy and let patient work do the building.' };
}
