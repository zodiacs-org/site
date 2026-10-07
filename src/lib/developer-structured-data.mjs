/**
 * Structured data the developer pages share (the brief's Track S1):
 * SoftwareApplication for the engine and the MCP server, SoftwareSourceCode for
 * the engine's repository, WebAPI for the APIs, Dataset for each data release.
 * scripts/validate-schema.mjs holds each developer page to its contract in
 * scripts/developer-structured-data-checks.mjs over the built site, with these
 * same constants.
 */

export const SITE = 'https://zodiacs.org';
/** The Organization node every page carries (src/components/SEO.astro). */
export const ORGANIZATION_ID = `${SITE}/#org`;
export const ORGANIZATION = Object.freeze({ '@id': ORGANIZATION_ID });
/** The OpenAPI document of every endpoint under /api/v1/, static and compute. */
export const OPENAPI_URL = `${SITE}/api/v1/openapi.json`;
/** The engine's code is MIT; its ΔT module's 32 values are CC BY 4.0. The MCP archive bundles both. */
export const ENGINE_LICENSES = Object.freeze([
  'https://spdx.org/licenses/MIT.html',
  'https://spdx.org/licenses/CC-BY-4.0.html',
]);
/** The shared sky data's licence, as /api/v1/index.json states it. */
export const SKY_DATA_LICENSE = 'https://creativecommons.org/licenses/by/4.0/';
/** The conformance vectors' licence (conformance/LICENSE in the engine repository). */
export const CONFORMANCE_LICENSE = 'https://creativecommons.org/publicdomain/zero/1.0/';
export const FREE_OFFER = Object.freeze({ '@type': 'Offer', price: '0', priceCurrency: 'USD' });

/**
 * A developer page's breadcrumb, named as the page names itself. Without it the
 * site builds one from the URL, which names /developers/mcp/ "Mcp".
 * @param {string} path
 * @param {string} name
 */
export function developerBreadcrumb(path, name) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Zodiacs.org', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Developers', item: `${SITE}/developers/` },
      { '@type': 'ListItem', position: 3, name, item: `${SITE}${path}` },
    ],
  };
}
