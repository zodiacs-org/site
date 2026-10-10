/** Consumer Organization identity; Registry/SDK product nodes remain separately owned. */
export const ORGANIZATION_ID = 'https://zodiacs.org/#org';
export const PUBLISHED_IDENTITY_URLS = Object.freeze([
  "https://github.com/zodiacs-org/engine",
  "https://www.npmjs.com/package/@zodiacs/engine",
  "https://pypi.org/project/zodiacs/"
]);
const hasType = (node, type) => Array.isArray(node?.['@type'])
  ? node['@type'].includes(type) : node?.['@type'] === type;
export function organizationIdentityErrors(nodes, { required = false } = {}) {
  const found = nodes.filter(node => node?.['@id'] === ORGANIZATION_ID);
  const errors = [];
  if (required && found.length !== 1) errors.push('Consumer Organization must appear exactly once');
  if (found.length > 1 && !required) errors.push('Duplicate consumer Organization identity');
  for (const node of found) {
    if (!hasType(node, 'Organization')) errors.push('Consumer identity must be an Organization');
    if (node.name !== 'Zodiacs.org') errors.push('Consumer Organization name must be Zodiacs.org');
    if (node.url !== 'https://zodiacs.org/') errors.push('Consumer Organization URL must be canonical');
    if (!Array.isArray(node.sameAs)
      || JSON.stringify([...node.sameAs].sort()) !== JSON.stringify([...PUBLISHED_IDENTITY_URLS].sort())) {
      errors.push('Consumer Organization sameAs must list the existing engine repository, npm and PyPI identities exactly once');
    }
  }
  const seen = new Set();
  function references(value, top = false) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (!top && value['@id'] === ORGANIZATION_ID) {
      if (value.name !== undefined && value.name !== 'Zodiacs.org') errors.push('Consumer Organization reference name must be Zodiacs.org');
      if (value.url !== undefined && value.url !== 'https://zodiacs.org/') errors.push('Consumer Organization reference URL must be canonical');
      if (value['@type'] !== undefined && !hasType(value, 'Organization')) errors.push('Consumer Organization reference type must be Organization');
      if (value.sameAs !== undefined && (!Array.isArray(value.sameAs) || JSON.stringify([...value.sameAs].sort()) !== JSON.stringify([...PUBLISHED_IDENTITY_URLS].sort()))) errors.push('Consumer Organization reference profiles must match the canonical entity');
    }
    for (const child of Object.values(value)) references(child);
  }
  for (const node of nodes) references(node, true);
  return errors;
}
