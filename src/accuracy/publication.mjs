import publication from '../data/accuracy/publication.json' with { type: 'json' };

export const ACCURACY_PATH = '/developers/accuracy/';
export const accuracyPublished = publication.published === true;

export function accuracyRobots(rules, published = accuracyPublished) {
  if (published) return rules;
  const barePath = ACCURACY_PATH.slice(0, -1);
  // Each crawler group allows the site at its root.
  return rules.replace(/^Allow: \/$/gmu, `Allow: /\nDisallow: ${barePath}$\nDisallow: ${ACCURACY_PATH}`);
}
