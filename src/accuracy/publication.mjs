import publication from '../data/accuracy/publication.json' with { type: 'json' };

export const ACCURACY_PATH = '/developers/accuracy/';
export const accuracyPublished = publication.published === true;

export function accuracyRoutes(published = accuracyPublished) {
  return {
    name: 'accuracy-publication',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        if (!published) return;
        injectRoute({ pattern: ACCURACY_PATH, entrypoint: './src/accuracy/page.astro' });
        injectRoute({ pattern: `${ACCURACY_PATH}raw/[date]/[file]`, entrypoint: './src/accuracy/raw.ts' });
      },
    },
  };
}

export function accuracyRobots(rules, published = accuracyPublished) {
  if (published) return rules;
  const barePath = ACCURACY_PATH.slice(0, -1);
  // Each crawler group allows the site at its root.
  return rules.replace(/^Allow: \/$/gmu, `Allow: /\nDisallow: ${barePath}$\nDisallow: ${ACCURACY_PATH}`);
}
