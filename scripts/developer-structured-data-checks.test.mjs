import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEVELOPER_PAGES, OPENAPI_URL, SKY_DATA_FOLDERS, conformanceUrls, developerExpectations, developerStructuredDataErrors,
  mcpArchiveUrl, servesUrlIn, skyDataFiles,
} from './developer-structured-data-checks.mjs';
import {
  CONFORMANCE_LICENSE, ENGINE_LICENSES, FREE_OFFER, ORGANIZATION, SKY_DATA_LICENSE, developerBreadcrumb,
} from '../src/lib/developer-structured-data.mjs';
import { archiveUrlFor } from '../src/lib/mcp-install-block.ts';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const SITE = 'https://zodiacs.org';
const ORG_NODE = { '@type': 'Organization', '@id': `${SITE}/#org`, name: 'Zodiacs.org', url: `${SITE}/` };

// A small built site: the files the fixtures name, and the one anchor the hub links to.
const SERVED = new Set([
  '/developers/', '/developers/engine/', '/developers/mcp/', '/developers/compute/', '/developers/conformance/',
  '/developers/sky-benchmark/', '/api/v1/openapi.json', '/api/v1/signs.json', '/api/v1/aspects/2026.json',
  '/developers/sky-benchmark/v0/items.json', '/developers/sky-benchmark/v0/key.json', '/developers/sky-benchmark/v0/tool-answers.json',
]);
const servesUrl = (url) => SERVED.has(url.pathname) && (!url.hash || (url.pathname === '/developers/' && url.hash === '#sky-data'));

const conformanceFiles = ['https://raw.githubusercontent.com/zodiacs-org/engine/abc/conformance/vectors/L1.json'];
const expected = developerExpectations({
  candidate: { version: '1.2.3', artifactUrl: 'https://raw.githubusercontent.com/zodiacs-org/engine/abc/engine.tgz', sourceRepository: 'https://github.com/zodiacs-org/engine' },
  manifest: { version: '0.1.0', artifactCommit: 'def', file: 'server.tgz' },
  conformanceSource: { repository: 'https://github.com/zodiacs-org/engine', commit: 'abc' },
  conformanceSummary: { suiteVersion: '0.1.0', levels: [{ file: 'vectors/L1.json' }] },
  skyIndex: { coverage: { years: { from: 2026, to: 2030 } } },
  skyFiles: ['/api/v1/signs.json', '/api/v1/aspects/2026.json'],
  benchmarkItems: { version: 'v0', dates: { from: '1900-01-01', to: '2049-12-31' } },
});
const context = { servesUrl, expected };
const check = (path, nodes) => developerStructuredDataErrors(path, nodes, context);

const engineApp = () => ({
  '@type': 'SoftwareApplication',
  '@id': `${SITE}/developers/engine/#software`,
  name: 'Zodiacs Engine',
  description: 'A chart engine.',
  url: `${SITE}/developers/engine/`,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Node.js 22.7 and newer',
  softwareVersion: '1.2.3',
  downloadUrl: 'https://raw.githubusercontent.com/zodiacs-org/engine/abc/engine.tgz',
  license: ENGINE_LICENSES,
  offers: FREE_OFFER,
  publisher: ORGANIZATION,
});
const engineSource = () => ({
  '@type': 'SoftwareSourceCode',
  name: 'Zodiacs Engine source code',
  codeRepository: 'https://github.com/zodiacs-org/engine',
  programmingLanguage: 'TypeScript',
  license: ENGINE_LICENSES,
  targetProduct: { '@id': `${SITE}/developers/engine/#software` },
});
const mcpApp = () => ({
  ...engineApp(),
  '@id': `${SITE}/developers/mcp/#software`,
  name: 'Zodiacs MCP server',
  url: `${SITE}/developers/mcp/`,
  softwareVersion: '0.1.0',
  downloadUrl: 'https://raw.githubusercontent.com/zodiacs-org/site/def/public/examples/server.tgz',
});
const webApi = (url) => ({
  '@type': 'WebAPI',
  name: 'Zodiacs compute API',
  description: 'Charts on our server.',
  url,
  documentation: OPENAPI_URL,
  provider: ORGANIZATION,
  offers: FREE_OFFER,
});
const skyData = () => ({
  '@type': 'Dataset',
  name: 'Zodiacs shared sky data',
  description: 'JSON files.',
  url: `${SITE}/developers/#sky-data`,
  license: SKY_DATA_LICENSE,
  temporalCoverage: '2026-01-01/2030-12-31',
  creator: ORGANIZATION,
  distribution: ['signs.json', 'aspects/2026.json'].map((path) => ({ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE}/api/v1/${path}` })),
});
const conformance = () => ({
  '@type': 'Dataset',
  name: 'Conformance suite',
  description: 'Vectors.',
  url: `${SITE}/developers/conformance/`,
  version: '0.1.0',
  license: CONFORMANCE_LICENSE,
  creator: ORGANIZATION,
  distribution: conformanceFiles.map((contentUrl) => ({ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl })),
});
const benchmark = () => ({
  '@type': 'Dataset',
  name: 'Zodiacs sky-fact benchmark',
  description: 'Questions.',
  url: `${SITE}/developers/sky-benchmark/`,
  version: 'v0',
  temporalCoverage: '1900-01-01/2049-12-31',
  license: CONFORMANCE_LICENSE,
  creator: ORGANIZATION,
  distribution: ['items.json', 'key.json', 'tool-answers.json'].map((name) => ({ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE}/developers/sky-benchmark/v0/${name}` })),
});
const pages = () => ({
  '/developers/': [ORG_NODE, webApi(`${SITE}/developers/#sky-data`), skyData()],
  '/developers/engine/': [ORG_NODE, engineApp(), engineSource(), developerBreadcrumb('/developers/engine/', 'Zodiacs Engine')],
  '/developers/mcp/': [ORG_NODE, mcpApp(), developerBreadcrumb('/developers/mcp/', 'MCP server')],
  '/developers/compute/': [ORG_NODE, webApi(`${SITE}/developers/compute/`), developerBreadcrumb('/developers/compute/', 'Compute API')],
  '/developers/conformance/': [ORG_NODE, conformance(), developerBreadcrumb('/developers/conformance/', 'Conformance suite')],
  '/developers/sky-benchmark/': [ORG_NODE, benchmark(), developerBreadcrumb('/developers/sky-benchmark/', 'Sky-fact benchmark')],
});
/** The page's nodes with the node of `type` changed. */
const edited = (path, type, change) => pages()[path].map((node) => (node['@type'] === type ? change({ ...node }) : node));

describe("the developer pages' structured data", () => {
  it('names a contract for each developer page that carries markup', () => {
    expect(Object.keys(DEVELOPER_PAGES)).toEqual(['/developers/', '/developers/engine/', '/developers/mcp/', '/developers/compute/', '/developers/conformance/', '/developers/sky-benchmark/']);
  });

  it('passes every page as it should be, and ignores pages outside the contract', () => {
    for (const [path, nodes] of Object.entries(pages())) expect(check(path, nodes), path).toEqual([]);
    expect(check('/about/', [])).toEqual([]);
  });

  it('fails a missing type, a missing field, a price and a breadcrumb named from the slug or linked elsewhere', () => {
    expect(check('/developers/mcp/', [ORG_NODE, developerBreadcrumb('/developers/mcp/', 'MCP server')])).toEqual(['/developers/mcp/: missing SoftwareApplication']);
    expect(check('/developers/mcp/', edited('/developers/mcp/', 'SoftwareApplication', ({ softwareVersion, ...rest }) => rest)))
      .toContain('/developers/mcp/: SoftwareApplication is missing softwareVersion');
    expect(check('/developers/mcp/', edited('/developers/mcp/', 'SoftwareApplication', (node) => ({ ...node, offers: { price: '5', priceCurrency: 'USD' } }))))
      .toEqual(['/developers/mcp/: SoftwareApplication needs a zero-price Offer']);
    const slug = [ORG_NODE, mcpApp(), developerBreadcrumb('/developers/mcp/', 'Mcp')];
    expect(check('/developers/mcp/', slug)).toEqual(['/developers/mcp/: breadcrumb should be Zodiacs.org › Developers › MCP server, linked to /, /developers/ and /developers/mcp/, not Zodiacs.org › Developers › Mcp']);
    const middle = developerBreadcrumb('/developers/mcp/', 'MCP server');
    middle.itemListElement[1] = { ...middle.itemListElement[1], name: 'Tools' };
    expect(check('/developers/mcp/', [ORG_NODE, mcpApp(), middle])).toHaveLength(1);
    const linked = developerBreadcrumb('/developers/mcp/', 'MCP server');
    linked.itemListElement[2] = { ...linked.itemListElement[2], item: `${SITE}/developers/` };
    expect(check('/developers/mcp/', [ORG_NODE, mcpApp(), linked])).toHaveLength(1);
  });

  it('holds each licence to the one the release carries, and a page that licenses nothing of its own to stating none', () => {
    expect(check('/developers/', edited('/developers/', 'Dataset', ({ license, ...rest }) => rest)))
      .toEqual([`/developers/: Dataset.license should be ${JSON.stringify([SKY_DATA_LICENSE])}, not null`]);
    expect(check('/developers/sky-benchmark/', edited('/developers/sky-benchmark/', 'Dataset', (node) => ({ ...node, license: SKY_DATA_LICENSE }))))
      .toEqual([`/developers/sky-benchmark/: Dataset.license should be ${JSON.stringify([CONFORMANCE_LICENSE])}, not ${JSON.stringify([SKY_DATA_LICENSE])}`]);
    expect(check('/developers/sky-benchmark/', edited('/developers/sky-benchmark/', 'Dataset', ({ license, ...rest }) => rest)))
      .toEqual([`/developers/sky-benchmark/: Dataset.license should be ${JSON.stringify([CONFORMANCE_LICENSE])}, not null`]);
    expect(check('/developers/conformance/', edited('/developers/conformance/', 'Dataset', (node) => ({ ...node, license: SKY_DATA_LICENSE }))))
      .toHaveLength(1);
    expect(check('/developers/mcp/', edited('/developers/mcp/', 'SoftwareApplication', (node) => ({ ...node, license: [ENGINE_LICENSES[0]] }))))
      .toHaveLength(1);
    expect(check('/developers/compute/', edited('/developers/compute/', 'WebAPI', (node) => ({ ...node, license: SKY_DATA_LICENSE }))))
      .toHaveLength(1);
  });

  it('ties versions, downloads and files to their records', () => {
    expect(check('/developers/engine/', edited('/developers/engine/', 'SoftwareApplication', (node) => ({ ...node, softwareVersion: '1.2.2' }))))
      .toEqual(['/developers/engine/: SoftwareApplication.softwareVersion should be "1.2.3", not "1.2.2"']);
    expect(check('/developers/engine/', edited('/developers/engine/', 'SoftwareApplication', (node) => ({ ...node, downloadUrl: 'https://www.npmjs.com/package/@zodiacs/engine/v/1.2.3' }))))
      .toEqual(['/developers/engine/: SoftwareApplication.downloadUrl should be "https://raw.githubusercontent.com/zodiacs-org/engine/abc/engine.tgz", not "https://www.npmjs.com/package/@zodiacs/engine/v/1.2.3"']);
    // An archive on this site must be a file the build serves.
    expect(check('/developers/mcp/', edited('/developers/mcp/', 'SoftwareApplication', (node) => ({ ...node, downloadUrl: `${SITE}/examples/missing.tgz` }))))
      .toContain('/developers/mcp/: SoftwareApplication.downloadUrl names /examples/missing.tgz, which the build does not serve');
    // Conformance files at another commit.
    expect(check('/developers/conformance/', edited('/developers/conformance/', 'Dataset', (node) => ({
      ...node,
      distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: 'https://raw.githubusercontent.com/zodiacs-org/engine/main/conformance/vectors/L1.json' }],
    })))).toHaveLength(1);
    // A sky data file left out, or one the generator does not write.
    expect(check('/developers/', edited('/developers/', 'Dataset', (node) => ({ ...node, distribution: node.distribution.slice(0, 1) })))).toHaveLength(1);
    expect(check('/developers/', edited('/developers/', 'Dataset', (node) => ({
      ...node,
      distribution: [...node.distribution, { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE}/api/v1/eclipses/2031.json` }],
    })))).toEqual([
      '/developers/: Dataset.distribution[2].contentUrl names /api/v1/eclipses/2031.json, which the build does not serve',
      expect.stringMatching(/^\/developers\/: Dataset\.distribution should list 2 files/u),
    ]);
    expect(check('/developers/sky-benchmark/', edited('/developers/sky-benchmark/', 'Dataset', (node) => ({ ...node, version: 'v1' }))))
      .toEqual(['/developers/sky-benchmark/: Dataset.version should be "v0", not "v1"']);
  });

  it('holds each span to the data, and reads a span open at one end', () => {
    expect(check('/developers/', edited('/developers/', 'Dataset', (node) => ({ ...node, temporalCoverage: '2026-01-01/2031-12-31' }))))
      .toEqual(['/developers/: Dataset.temporalCoverage should be "2026-01-01/2030-12-31", not "2026-01-01/2031-12-31"']);
    expect(check('/developers/', edited('/developers/', 'Dataset', (node) => ({ ...node, temporalCoverage: '2030-12-31/2026-01-01' }))))
      .toContain('/developers/: Dataset.temporalCoverage is not a start/end span: "2030-12-31/2026-01-01"');
    // A dataset with no span on record may give an open one.
    expect(check('/developers/conformance/', edited('/developers/conformance/', 'Dataset', (node) => ({ ...node, temporalCoverage: '1900-01-01/..' })))).toEqual([]);
    expect(check('/developers/conformance/', edited('/developers/conformance/', 'Dataset', (node) => ({ ...node, temporalCoverage: '../..' })))).toHaveLength(1);
  });

  it('reads a single download and a list of offers as schema.org allows', () => {
    expect(check('/developers/sky-benchmark/', edited('/developers/sky-benchmark/', 'Dataset', (node) => ({ ...node, distribution: node.distribution[0] }))))
      .toEqual([expect.stringMatching(/^\/developers\/sky-benchmark\/: Dataset\.distribution should list 3 files/u)]);
    expect(check('/developers/conformance/', edited('/developers/conformance/', 'Dataset', (node) => ({ ...node, distribution: node.distribution[0] })))).toEqual([]);
    expect(check('/developers/mcp/', edited('/developers/mcp/', 'SoftwareApplication', (node) => ({ ...node, offers: [{ '@type': 'Offer', price: 0, priceCurrency: 'USD' }] })))).toEqual([]);
  });

  it("fails an organization the page's graph does not hold, a product the source code does not build, and an anchor the page lacks", () => {
    const withoutOrganization = pages()['/developers/compute/'].filter((node) => node !== pages()['/developers/compute/'][0] && node['@type'] !== 'Organization');
    expect(check('/developers/compute/', withoutOrganization)).toEqual(['/developers/compute/: WebAPI needs the organization as provider']);
    expect(check('/developers/engine/', edited('/developers/engine/', 'SoftwareSourceCode', (node) => ({ ...node, targetProduct: { '@id': `${SITE}/developers/mcp/#software` } }))))
      .toEqual(["/developers/engine/: SoftwareSourceCode.targetProduct must name this page's SoftwareApplication"]);
    expect(check('/developers/', edited('/developers/', 'WebAPI', (node) => ({ ...node, url: `${SITE}/developers/#sky-api` }))))
      .toEqual(['/developers/: WebAPI.url names /developers/#sky-api, which the build does not serve']);
    expect(check('/developers/compute/', edited('/developers/compute/', 'WebAPI', (node) => ({ ...node, documentation: `${SITE}/developers/compute/` }))))
      .toEqual([`/developers/compute/: WebAPI.documentation must be ${OPENAPI_URL}`]);
  });

  it('serves only files, and an anchor only where the page has an element with that id', () => {
    const root = mkdtempSync(join(tmpdir(), 'zodiacs-structured-data-'));
    try {
      mkdirSync(join(root, 'api/v1/planets'), { recursive: true });
      mkdirSync(join(root, 'developers'), { recursive: true });
      writeFileSync(join(root, 'api/v1/signs.json'), '{}');
      writeFileSync(join(root, 'developers/index.html'), '<h2 id="sky-data">Shared sky data</h2>');
      const serves = servesUrlIn(root);
      expect(serves(new URL(`${SITE}/api/v1/signs.json`))).toBe(true);
      expect(serves(new URL(`${SITE}/api/v1/planets`))).toBe(false);
      expect(serves(new URL(`${SITE}/api/v1/missing.json`))).toBe(false);
      expect(serves(new URL(`${SITE}/developers/#sky-data`))).toBe(true);
      expect(serves(new URL(`${SITE}/developers/#sky`))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('expects the records the pages are built from', () => {
    const manifest = read('../public/examples/mcp-server.json');
    expect(mcpArchiveUrl(manifest)).toBe(archiveUrlFor(manifest));
    const source = read('../src/data/conformance/source.json');
    const summary = read('../src/data/conformance/summary.json');
    expect(conformanceUrls(source, summary)).toEqual(summary.levels.map((level) => `https://raw.githubusercontent.com/zodiacs-org/engine/${source.commit}/conformance/${level.file}`));
    expect(skyDataFiles({ planets: ['sun.json'], eclipses: ['2026.json', 'README.md'] }))
      .toEqual(['/api/v1/sky/today.json', '/api/v1/sky/upcoming.json', '/api/v1/signs.json', '/api/v1/planets/sun.json', '/api/v1/eclipses/2026.json']);
    expect(SKY_DATA_FOLDERS).toEqual(['planets', 'retrogrades', 'stations', 'ingresses', 'moon-phases', 'eclipses', 'aspects']);
    const candidate = read('../src/data/platform-engine-candidate.json');
    const items = read('../public/developers/sky-benchmark/v0/items.json');
    const real = developerExpectations({
      candidate, manifest, conformanceSource: source, conformanceSummary: summary,
      skyIndex: { coverage: { years: { from: 2026, to: 2030 } } }, skyFiles: [], benchmarkItems: items,
    });
    expect(real['/developers/engine/'].SoftwareApplication).toEqual({ softwareVersion: candidate.version, downloadUrl: candidate.artifactUrl });
    expect(real['/developers/sky-benchmark/'].Dataset.temporalCoverage).toBe(`${items.dates.from}/${items.dates.to}`);
  });
});
