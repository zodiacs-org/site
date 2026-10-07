import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  READ_ONLY_POSTURE,
  extractConsumerFragments,
  findConsumerBoundaryViolations,
  scanConsumerBoundary,
  SOURCE_ROOTS,
} from './consumer-boundary-lib.mjs';

function rules(source, file) {
  return findConsumerBoundaryViolations(source, file).map(({ rule }) => rule);
}

describe('consumer boundary source scanner', () => {
  it('allows only the approved collection description in shared navigation', () => {
    const copy = "---\nconst description = 'Official Zodiac token collection';\n---\n<p>{description}</p>";
    expect(rules(copy, 'src/components/SiteNav.astro')).toEqual([]);
    expect(rules(copy, 'src/pages/index.astro').length).toBeGreaterThan(0);
    expect(rules(copy.replace('Official Zodiac token collection', 'Buy an official Zodiac token'), 'src/components/SiteNav.astro').length).toBeGreaterThan(0);
  });

  it('allows the exact owner-approved trust statement only on its catalog key', () => {
    const statement = 'Our astrology tools and guides are free, with no signup required. Zodiacs.org also operates Astrofolio, the Zodiac token collection.';
    const catalog = `const en = { trustFreeAnswer: ${JSON.stringify(statement)} };`;
    expect(rules(catalog, 'src/lib/i18n/ui/en.ts')).toEqual([]);
    expect(rules(catalog.replace('trustFreeAnswer', 'hero'), 'src/lib/i18n/ui/en.ts').length).toBeGreaterThan(0);
    expect(rules(catalog.replace('the Zodiac token collection.', 'the Zodiac token collection. Buy today.'), 'src/lib/i18n/ui/en.ts').length).toBeGreaterThan(0);
  });

  it('reads visible Astro copy and frontmatter strings without treating comments as copy', () => {
    const source = `---
const description = 'A free astrology calculator.';
// official Zodiac token belongs in the wing
---
<main><p>Meet the official Zodiac token.</p></main>
<style>/* crypto market */</style>`;
    const violations = findConsumerBoundaryViolations(source, 'src/pages/example/index.astro');
    expect(violations.map(({ match }) => match)).toContain('official Zodiac token');
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.every(({ text }) => text.includes('Meet the official Zodiac token.'))).toBe(true);
  });

  it.each([
    ['src/islands/Example.tsx', 'export const View = () => <p>A crypto market shortcut.</p>;'],
    ['src/lib/email/example.ts', "export const body = 'Buy this Zodiac token today.';"],
    ['src/lib/share-card.ts', "export const footer = 'Trade the Zodiac token.';"],
    ['src/server/chart-preview.ts', "export const footer = 'Trade the Zodiac token.';"],
    ['api/example.ts', "export const errorMessage = 'The token market is ready.';"],
    ['src/content/example.mdx', 'A memecoin does not belong in this guide.'],
    ['src/data/example.json', '{"description":"Official Zodiac token"}'],
  ])('detects seeded audience copy in %s', (file, source) => {
    expect(findConsumerBoundaryViolations(source, file).length).toBeGreaterThan(0);
  });

  it.each([
    ['en', '<p>Read the token details.</p>'],
    ['es', '<p>Compra este token oficial en el mercado de criptomonedas.</p>'],
    ['pt', '<p>Compre este token oficial no mercado de criptomoedas.</p>'],
    ['it', '<p>Acquista questo token ufficiale nel mercato delle criptovalute.</p>'],
    ['fr', '<p>Achetez ce jeton officiel sur le marché des cryptomonnaies.</p>'],
    ['ru', '<p>Купите официальный токен на рынке криптовалют.</p>'],
  ])('rejects visible %s token, market, or crypto copy', (locale, source) => {
    expect(findConsumerBoundaryViolations(source, `src/pages/${locale}/example.astro`).length)
      .toBeGreaterThan(0);
  });

  it('does not confuse identifiers, comments, module names, or auth-token errors with audience copy', () => {
    const source = `
      import { createHash } from 'node:crypto';
      // official Zodiac token and market desk
      const marketToken = 'expired session token';
      export function tokenFromBody() { return marketToken; }
    `;
    expect(findConsumerBoundaryViolations(source, 'api/session.ts')).toEqual([]);
    expect(findConsumerBoundaryViolations("throw new Error('web-crypto-unavailable')", 'src/lib/hash.ts')).toEqual([]);
    expect(findConsumerBoundaryViolations("export const copy = 'Elle peut marcher ici.'", 'src/data/fr-guides.ts')).toEqual([]);
    expect(findConsumerBoundaryViolations('<p>A sessão permanece criptografada.</p>', 'src/pages/pt/profile/index.astro')).toEqual([]);
    expect(findConsumerBoundaryViolations("throw new Error('Invalid positions-only chart token.')", 'api/calendar/transits.ts')).toEqual([]);
    expect(findConsumerBoundaryViolations("throw new Error('Official Zodiac token market.')", 'api/calendar/transits.ts').length).toBeGreaterThan(0);
  });

  it('keeps legal disclosure narrow instead of exempting a whole legal page', () => {
    const defensive = '<p>Digital assets can be volatile, may have no buyers, and can fall to zero market value.</p>';
    expect(findConsumerBoundaryViolations(defensive, 'src/pages/terms/index.astro')).toEqual([]);

    const seededPromotion = '<p>Buy this official Zodiac token today.</p>';
    expect(rules(seededPromotion, 'src/pages/terms/index.astro')).toContain('token or coin vocabulary');

    const negationDecoy = '<p>No signup. Buy this official Zodiac token today.</p>';
    expect(rules(negationDecoy, 'src/pages/terms/index.astro')).toContain('token or coin vocabulary');

    expect(rules('<p>No signup. Meet the official Zodiac token.</p>', 'src/pages/terms/index.astro'))
      .toContain('token or coin vocabulary');
    expect(rules('<p>This is not advice. The official Zodiac token is exciting.</p>', 'src/pages/terms/index.astro'))
      .toContain('token or coin vocabulary');
  });

  it('allows only the keyed operator disclosure to state the redirect relationship', () => {
    const disclosure = `export const EN = {
      'disclosure.operatorStatement': 'Operator update: astrofolio.xyz redirects to the official public Astrofolio experience at zodiacs.org/astrofolio and is not a separate surface.',
      'home.hero': 'A free birth chart.',
    };`;
    expect(findConsumerBoundaryViolations(disclosure, 'src/strings/en.mjs')).toEqual([]);

    const leak = `export const EN = {
      'home.hero': 'Visit astrofolio.xyz for its official Zodiac token market.',
    };`;
    const violations = findConsumerBoundaryViolations(leak, 'src/strings/en.mjs');
    expect(violations.map(({ rule }) => rule)).toContain('external wing or acquisition destination');
    expect(violations.map(({ rule }) => rule)).toContain('token or coin vocabulary');

    const unrelatedCatalog = `export const COPY = {
      'disclosure.operatorStatement': 'Visit the crypto market.',
    };`;
    expect(findConsumerBoundaryViolations(unrelatedCatalog, 'src/lib/email/copy.ts').length).toBeGreaterThan(0);

    const acquisitionVenue = `export const EN = {
      'disclosure.operatorStatement': 'astrofolio.xyz redirects to zodiacs.org/astrofolio. Visit jup.ag for details.',
    };`;
    expect(rules(acquisitionVenue, 'src/strings/en.mjs'))
      .toContain('external wing or acquisition destination');

    const promotionalDisclosure = `export const EN = {
      'disclosure.foo': 'Buy the official Zodiac token today.',
    };`;
    expect(rules(promotionalDisclosure, 'src/strings/en.mjs'))
      .toContain('token or coin vocabulary');

    const approvedKeyPromotion = `export const EN = {
      'disclosure.tradeStatement': 'Buy the official Zodiac token today.',
    };`;
    expect(rules(approvedKeyPromotion, 'src/strings/en.mjs'))
      .toContain('token or coin vocabulary');
  });

  it('recognizes defensive legal copy in released locales without exempting promotion', () => {
    const defensive = '<p>Le fournisseur blockchain ne reçoit pas les données de naissance.</p>';
    expect(findConsumerBoundaryViolations(defensive, 'src/pages/fr/privacy/index.astro')).toEqual([]);

    const seededPromotion = '<p>Achetez le token officiel sur le crypto market.</p>';
    expect(findConsumerBoundaryViolations(seededPromotion, 'src/pages/fr/privacy/index.astro').length).toBeGreaterThan(0);
  });

  it('rejects acquisition venues even when the link sits in a legal page', () => {
    const source = '<p>We do not operate this venue. <a href="https://jup.ag/">Open it</a>.</p>';
    expect(rules(source, 'src/pages/terms/index.astro')).toContain('external wing or acquisition destination');
  });

  it('pins sanctioned internal bridges and rejects the same link elsewhere', () => {
    const bridge = '<a href={`/registry/${slug}/`}>View the record</a>';
    expect(findConsumerBoundaryViolations(bridge, 'src/components/CollectBand.astro')).toEqual([]);
    expect(rules(bridge, 'src/lib/email/daily.ts')).toContain('unsanctioned wing link');
    expect(rules('<a href="/terminal/markets/">Trade</a>', 'src/components/CollectBand.astro'))
      .toContain('unsanctioned wing link');
    expect(rules('<a href="/sdk/">SDK</a>', 'src/pages/about/index.astro'))
      .toContain('unsanctioned wing link');

    const secondLink = `export const links = '/registry/\${slug}/ then /terminal/markets/';`;
    expect(rules(secondLink, 'src/components/CollectBand.astro'))
      .toContain('unsanctioned wing link');

    expect(findConsumerBoundaryViolations('<a href="/astrofolio/">Astrofolio</a>', 'src/components/SiteFooter.astro'))
      .toEqual([]);
    expect(findConsumerBoundaryViolations('<a href="/astrofolio/">Explore Astrofolio</a>', 'src/pages/bio/index.astro'))
      .toEqual([]);
    expect(findConsumerBoundaryViolations('<a href="/astrofolio/how-to-buy/">Eligibility terms</a>', 'src/pages/terms/index.astro'))
      .toEqual([]);
    expect(findConsumerBoundaryViolations("const route = '/sdk/';", 'src/pages/sitemap.xml.ts'))
      .toEqual([]);
    expect(rules('<a href="/terminal/">Terminal</a>', 'src/components/SiteFooter.astro'))
      .toContain('unsanctioned wing link');
    expect(rules('<a href="/registry">Record</a>', 'src/pages/example.astro'))
      .toContain('unsanctioned wing link');
    expect(rules('<a href="/registry?x=1">Record</a>', 'src/pages/example.astro'))
      .toContain('unsanctioned wing link');
  });

  it('limits the developer SDK bridge to two exact pages and approved references', () => {
    for (const file of ['src/pages/developers/index.astro', 'src/pages/developers/support/index.astro']) {
      expect(findConsumerBoundaryViolations('<a href="/sdk/">Optional ownership SDK</a>', file)).toEqual([]);
      for (const href of ['/sdk/market/', '/terminal/', '/registry/', '/astrofolio/how-to-buy/']) {
        expect(rules(`<a href="${href}">Reference</a>`, file)).toContain('unsanctioned wing link');
      }
      expect(rules('<p>Use the crypto market.</p>', file)).toContain('market vocabulary');
      expect(rules('<a href="https://jup.ag/">Open</a>', file)).toContain('external wing or acquisition destination');
    }
    expect(findConsumerBoundaryViolations('<a href="/sdk/engine/">API reference</a>', 'src/pages/developers/support/index.astro')).toEqual([]);
    expect(rules('<a href="/sdk/engine/">API reference</a>', 'src/pages/developers/index.astro')).toContain('unsanctioned wing link');
    for (const file of ['src/pages/developers/examples/index.astro', 'src/pages/developers/support/other.astro', 'src/pages/about/index.astro']) {
      expect(rules('<a href="/sdk/">SDK</a>', file)).toContain('unsanctioned wing link');
    }
  });

  it('recognizes only the Node hashing import in the displayed starter setup', () => {
    const block = (code, name = 'setup') => `---\nconst ${name} = \`node <<'JS'\n${code}\nJS\`;\n---\n<pre>{${name}}</pre>`;
    const file = 'src/pages/developers/examples/index.astro';
    const moduleImport = "import { createHash } from 'node:crypto';";
    expect(findConsumerBoundaryViolations(block(moduleImport), file)).toEqual([]);
    expect(rules(block(moduleImport + "\nconsole.log('Use the crypto market');"), file)).toContain('market vocabulary');
    expect(rules(block(moduleImport + "\nconsole.log('/registry/');"), file)).toContain('unsanctioned wing link');
    expect(rules(block(moduleImport, 'promotion'), file)).toContain('crypto vocabulary');
    expect(rules(block(moduleImport), 'src/pages/index.astro')).toContain('crypto vocabulary');
    expect(rules(block("import { x } from 'node:crypto-market';"), file)).toContain('crypto vocabulary');
  });

  it('finds raw and fenced MDX wing links before stripping markup', () => {
    expect(rules('<a href="/registry/">Record</a>', 'src/content/example.mdx'))
      .toContain('unsanctioned wing link');
    expect(rules('```md\n[Record](/registry/)\n```', 'src/content/example.mdx'))
      .toContain('unsanctioned wing link');
  });

  it('preserves exactly the required read-only posture without creating a free-form bypass', () => {
    expect(findConsumerBoundaryViolations(READ_ONLY_POSTURE, 'public/llms.txt')).toEqual([]);
    const seeded = READ_ONLY_POSTURE.replace('Optional market context', 'A crypto market shortcut');
    expect(findConsumerBoundaryViolations(seeded, 'public/llms.txt').length).toBeGreaterThan(0);
  });

  it('extracts TSX, Astro, MDX, and JSON values as source-located fragments', () => {
    expect(extractConsumerFragments('<p>One market.</p>', 'src/pages/a.astro')[0]).toMatchObject({ kind: 'visible', line: 1 });
    expect(extractConsumerFragments('export const x = <p>One market.</p>', 'src/islands/a.tsx').some(({ text }) => text.includes('One market.'))).toBe(true);
    expect(extractConsumerFragments('One market.', 'src/content/a.mdx')[0]).toMatchObject({ kind: 'visible', line: 1 });
    expect(extractConsumerFragments('{"copy":"One market."}', 'src/data/a.json')[0]).toMatchObject({ key: 'copy', line: 1 });
  });

  it('fails a seeded full-tree source while keeping Registry exclusions exact', async () => {
    const repo = await mkdtemp(join(tmpdir(), 'consumer-boundary-'));
    try {
      // Seeded from the scanner's own root list, plus the subdirectories these
      // assertions need. A hand-kept copy here drifted the first time a root
      // was added and failed with ENOENT rather than a boundary result.
      for (const root of [...SOURCE_ROOTS, 'src/data/registry-research', 'src/lib/email', 'public']) {
        await mkdir(join(repo, root), { recursive: true });
      }
      await writeFile(join(repo, 'public/llms.txt'), 'Free astrology tools.');
      await writeFile(join(repo, 'src/data/registry-research/drafts.json'), '{"copy":"Official Zodiac token market"}');
      await writeFile(join(repo, 'src/data/registry-research/unreviewed.json'), '{"copy":"Official Zodiac token market"}');
      await writeFile(join(repo, 'src/lib/email/example.ts'), "export const body = 'Buy this Zodiac asset.';");

      const { violations } = await scanConsumerBoundary(repo);
      expect(violations.some(({ file }) => file === 'src/lib/email/example.ts')).toBe(true);
      expect(violations.some(({ file }) => file === 'src/data/registry-research/unreviewed.json')).toBe(true);
      expect(violations.some(({ file }) => file === 'src/data/registry-research/drafts.json')).toBe(false);
    } finally {
      await rm(repo, { force: true, recursive: true });
    }
  });

  it('pins the Packet C consumer copy and llms boundary', async () => {
    const [about, terms, llms, llmsFull] = await Promise.all([
      readFile(new URL('../src/pages/about/index.astro', import.meta.url), 'utf8'),
      readFile(new URL('../src/pages/terms/index.astro', import.meta.url), 'utf8'),
      readFile(new URL('../public/llms.txt', import.meta.url), 'utf8'),
      readFile(new URL('../public/llms-full.txt', import.meta.url), 'utf8'),
    ]);

    expect(about).not.toMatch(/astrofolio\.xyz|official Zodiac token|market desk/iu);
    expect(terms).not.toContain('astrofolio.xyz');

    const pointer = 'Read-only Registry and developer context: https://zodiacs.org/llms-full.txt';
    expect(llms.split(pointer)).toHaveLength(2);
    const consumerLead = llms.slice(0, llms.indexOf(pointer));
    expect(consumerLead).not.toMatch(/Astrofolio|Terminal|official Zodiac token|market desk|simple guide to buying/iu);
    expect(llms.split(READ_ONLY_POSTURE)).toHaveLength(2);

    expect(llmsFull).toContain('a simple guide to buying');
    expect(llmsFull).toContain('a "{sign} token" or "{sign} coin"');
  });
});
