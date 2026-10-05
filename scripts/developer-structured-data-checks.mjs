/**
 * The structured data each developer page must carry (the brief's Track S1),
 * checked by scripts/validate-schema.mjs over the built site:
 * SoftwareApplication for the engine and the MCP server, SoftwareSourceCode for
 * the engine's repository, WebAPI for the APIs, Dataset for each data release,
 * and a breadcrumb that names the page as the page names itself.
 *
 * Each value the markup states is held to the record it comes from: versions
 * and downloads to the engine's candidate record and the MCP manifest, the
 * conformance files to the commit they were copied from, licences to the
 * licence each release carries, spans and files to the data, and every URL on
 * zodiacs.org to a file the build serves.
 */
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CONFORMANCE_LICENSE, ENGINE_LICENSES, OPENAPI_URL, ORGANIZATION_ID, SITE, SKY_DATA_LICENSE,
} from '../src/lib/developer-structured-data.mjs';

export { OPENAPI_URL };

/**
 * For each developer page: the types it must carry, the licence each states
 * (null where it states none, as for a release whose licence is not chosen),
 * and the name its breadcrumb ends with.
 */
export const DEVELOPER_PAGES = Object.freeze({
  '/developers/': {
    types: ['WebAPI', 'Dataset'],
    licenses: { WebAPI: null, Dataset: [SKY_DATA_LICENSE] },
  },
  '/developers/engine/': {
    types: ['SoftwareApplication', 'SoftwareSourceCode'],
    breadcrumb: 'Zodiacs Engine',
    licenses: { SoftwareApplication: ENGINE_LICENSES, SoftwareSourceCode: ENGINE_LICENSES },
  },
  '/developers/mcp/': {
    types: ['SoftwareApplication'],
    breadcrumb: 'MCP server',
    licenses: { SoftwareApplication: ENGINE_LICENSES },
  },
  '/developers/compute/': {
    types: ['WebAPI'],
    breadcrumb: 'Compute API',
    licenses: { WebAPI: null },
  },
  '/developers/conformance/': {
    types: ['Dataset'],
    breadcrumb: 'Conformance suite',
    licenses: { Dataset: [CONFORMANCE_LICENSE] },
  },
  '/developers/sky-benchmark/': {
    types: ['Dataset'],
    breadcrumb: 'Sky-fact benchmark',
    licenses: { Dataset: null },
  },
});

/**
 * The archive the MCP page's install block fetches. src/lib/mcp-install-block.ts
 * writes it as archiveUrlFor, and a test holds the two to the same URL; this one
 * is written apart so that a wrong URL on the page cannot also be the expected one.
 */
export const mcpArchiveUrl = (manifest) =>
  `https://raw.githubusercontent.com/zodiacs-org/site/${manifest.artifactCommit}/public/examples/${manifest.file}`;

/** Each conformance level's vectors at the commit summary.json was copied from. */
export const conformanceUrls = (source, summary) => summary.levels.map((level) =>
  `${source.repository.replace(/^https:\/\/github\.com\//u, 'https://raw.githubusercontent.com/')}/${source.commit}/conformance/${level.file}`);

/** The JSON data files of the sky data API, given the file names the build holds in each folder under /api/v1/. */
export function skyDataFiles(folders) {
  return [
    '/api/v1/sky/today.json',
    '/api/v1/sky/upcoming.json',
    '/api/v1/signs.json',
    ...Object.entries(folders).flatMap(([folder, names]) =>
      names.filter((name) => name.endsWith('.json')).map((name) => `/api/v1/${folder}/${name}`)),
  ];
}

/** The folders under /api/v1/ that hold sky data files, one per planet or per year. */
export const SKY_DATA_FOLDERS = Object.freeze(['planets', 'retrogrades', 'stations', 'ingresses', 'moon-phases', 'eclipses', 'aspects']);

/**
 * What each page's markup must state, from the records it is built from:
 * the engine's candidate record, the MCP manifest, the conformance suite's
 * source and summary, the built sky API's index and data files, and the
 * benchmark's questions.
 */
export function developerExpectations({ candidate, manifest, conformanceSource, conformanceSummary, skyIndex, skyFiles, benchmarkItems }) {
  return {
    '/developers/': {
      Dataset: {
        temporalCoverage: `${skyIndex.coverage.years.from}-01-01/${skyIndex.coverage.years.to}-12-31`,
        contentUrls: skyFiles.map((path) => `${SITE}${path}`),
      },
    },
    '/developers/engine/': {
      SoftwareApplication: { softwareVersion: candidate.version, downloadUrl: candidate.artifactUrl },
      SoftwareSourceCode: { codeRepository: candidate.sourceRepository },
    },
    '/developers/mcp/': {
      SoftwareApplication: { softwareVersion: manifest.version, downloadUrl: mcpArchiveUrl(manifest) },
    },
    '/developers/conformance/': {
      Dataset: { version: conformanceSummary.suiteVersion, contentUrls: conformanceUrls(conformanceSource, conformanceSummary) },
    },
    '/developers/sky-benchmark/': {
      Dataset: {
        version: benchmarkItems.version,
        temporalCoverage: `${benchmarkItems.dates.from}/${benchmarkItems.dates.to}`,
        contentUrls: ['items.json', 'key.json', 'tool-answers.json'].map((name) => `${SITE}/developers/sky-benchmark/${benchmarkItems.version}/${name}`),
      },
    },
  };
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

/**
 * Whether a built site in `root` holds a file, not a folder, at a URL's path,
 * and, for a URL with a fragment, an element with that id in it.
 */
export function servesUrlIn(root) {
  return (url) => {
    const pathname = decodeURIComponent(url.pathname);
    const file = resolve(root, `.${pathname.endsWith('/') ? `${pathname}index.html` : pathname}`);
    try {
      if (!statSync(file).isFile()) return false;
    } catch {
      return false;
    }
    if (!url.hash) return true;
    const id = escapeRegExp(decodeURIComponent(url.hash.slice(1)));
    return new RegExp(`\\sid=(?:"${id}"|'${id}')`, 'u').test(readFileSync(file, 'utf8'));
  };
}

const hasType = (node, type) => (Array.isArray(node?.['@type']) ? node['@type'].includes(type) : node?.['@type'] === type);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const httpsUrl = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};
/** A property schema.org lets be one value or a list, as a list. */
const list = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
const sorted = (values) => JSON.stringify([...values].sort());
/** A date, or ".." for an open end, as schema.org's temporalCoverage writes an interval. */
const SPAN = /^(\.\.|\d{4}(?:-\d{2}(?:-\d{2})?)?)\/(\.\.|\d{4}(?:-\d{2}(?:-\d{2})?)?)$/u;
const BREADCRUMB_TRAIL = ['Zodiacs.org', 'Developers'];

/**
 * The failures of one built page's JSON-LD nodes against its contract.
 * `servesUrl(url)` says whether the built site holds a file at a URL of
 * zodiacs.org and, for a URL with a fragment, an element with that id in it.
 * `expected` is developerExpectations' result.
 */
export function developerStructuredDataErrors(pathname, nodes, { servesUrl, expected = {} }) {
  const contract = DEVELOPER_PAGES[pathname];
  if (!contract) return [];
  const wanted = expected[pathname] ?? {};
  const failures = [];
  const fail = (message) => failures.push(`${pathname}: ${message}`);
  const onSite = (value, field) => {
    if (!httpsUrl(value)) return fail(`${field} is not an https URL: ${JSON.stringify(value)}`);
    const url = new URL(value);
    if (url.origin === SITE && !servesUrl(url)) fail(`${field} names ${url.pathname}${url.hash}, which the build does not serve`);
  };
  const required = (node, type, fields) => {
    for (const field of fields) if (!text(node[field])) fail(`${type} is missing ${field}`);
  };
  const stated = (node, type, field) => {
    const value = wanted[type]?.[field];
    if (value !== undefined && node[field] !== value) fail(`${type}.${field} should be ${JSON.stringify(value)}, not ${JSON.stringify(node[field])}`);
  };
  /** The site's Organization: a reference to the node every page carries, which must be in the graph, or one written out. */
  const organization = (value) => (value?.['@id'] === ORGANIZATION_ID
    ? nodes.some((node) => node['@id'] === ORGANIZATION_ID && hasType(node, 'Organization') && text(node.name))
    : hasType(value, 'Organization') && text(value.name));
  const free = (node, type) => {
    if (!list(node.offers).some((offer) => String(offer?.price) === '0' && text(offer?.priceCurrency))) fail(`${type} needs a zero-price Offer`);
  };
  const licensed = (node, type) => {
    const license = contract.licenses[type];
    const actual = node.license === undefined ? null : list(node.license);
    if (JSON.stringify(actual) !== JSON.stringify(license === null ? null : [...license])) {
      fail(`${type}.license should be ${JSON.stringify(license)}, not ${JSON.stringify(actual)}`);
    }
  };

  for (const type of contract.types) {
    const found = nodes.filter((node) => hasType(node, type));
    if (found.length === 0) fail(`missing ${type}`);
    for (const node of found) {
      if (type === 'SoftwareApplication') {
        required(node, type, ['name', 'description', 'applicationCategory', 'operatingSystem', 'softwareVersion']);
        stated(node, type, 'softwareVersion');
        onSite(node.url, `${type}.url`);
        onSite(node.downloadUrl, `${type}.downloadUrl`);
        stated(node, type, 'downloadUrl');
        if (!organization(node.publisher)) fail(`${type} needs the organization as publisher`);
        licensed(node, type);
        free(node, type);
      } else if (type === 'SoftwareSourceCode') {
        required(node, type, ['name', 'programmingLanguage']);
        if (!httpsUrl(node.codeRepository)) fail(`${type} needs an https codeRepository`);
        stated(node, type, 'codeRepository');
        const product = node.targetProduct?.['@id'];
        if (!product || !nodes.some((other) => hasType(other, 'SoftwareApplication') && other['@id'] === product)) {
          fail(`${type}.targetProduct must name this page's SoftwareApplication`);
        }
        licensed(node, type);
      } else if (type === 'WebAPI') {
        required(node, type, ['name', 'description']);
        onSite(node.url, `${type}.url`);
        if (node.documentation !== OPENAPI_URL) fail(`${type}.documentation must be ${OPENAPI_URL}`);
        else onSite(node.documentation, `${type}.documentation`);
        if (!organization(node.provider)) fail(`${type} needs the organization as provider`);
        licensed(node, type);
        free(node, type);
      } else if (type === 'Dataset') {
        required(node, type, ['name', 'description']);
        stated(node, type, 'version');
        onSite(node.url, `${type}.url`);
        if (!organization(node.creator)) fail(`${type} needs the organization as creator`);
        licensed(node, type);
        if (node.temporalCoverage !== undefined) {
          const span = SPAN.exec(String(node.temporalCoverage));
          const backwards = span && span[1] !== '..' && span[2] !== '..' && span[1] > span[2];
          if (!span || backwards || (span[1] === '..' && span[2] === '..')) {
            fail(`${type}.temporalCoverage is not a start/end span: ${JSON.stringify(node.temporalCoverage)}`);
          }
        }
        stated(node, type, 'temporalCoverage');
        const downloads = list(node.distribution);
        if (downloads.length === 0) fail(`${type} needs at least one DataDownload`);
        downloads.forEach((download, index) => {
          if (!hasType(download, 'DataDownload') || !text(download.encodingFormat)) fail(`${type}.distribution[${index}] needs a DataDownload with an encodingFormat`);
          onSite(download.contentUrl, `${type}.distribution[${index}].contentUrl`);
        });
        const urls = wanted[type]?.contentUrls;
        if (urls && sorted(downloads.map((download) => download.contentUrl)) !== sorted(urls)) {
          fail(`${type}.distribution should list ${urls.length} files, ${JSON.stringify([...urls].sort())}, not ${JSON.stringify(downloads.map((download) => download.contentUrl).sort())}`);
        }
      }
    }
  }

  if (contract.breadcrumb) {
    const trail = nodes.find((node) => hasType(node, 'BreadcrumbList'))?.itemListElement;
    const names = Array.isArray(trail) ? trail.map((item) => item?.name) : [];
    const want = [...BREADCRUMB_TRAIL, contract.breadcrumb];
    const items = Array.isArray(trail) ? trail.map((item) => item?.item) : [];
    if (JSON.stringify(names) !== JSON.stringify(want) || JSON.stringify(items) !== JSON.stringify([`${SITE}/`, `${SITE}/developers/`, `${SITE}${pathname}`])
      || !trail.every((item, index) => item?.position === index + 1)) {
      fail(`breadcrumb should be ${want.join(' › ')}, linked to /, /developers/ and ${pathname}, not ${names.join(' › ') || 'missing'}`);
    }
  }
  return failures;
}
