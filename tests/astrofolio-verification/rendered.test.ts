import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertStaticFacts, machineEvidence, staticText } from './browser.mjs';
import { evidence, STATUS_LABELS } from '../../src/registry/astrofolio-verification/evidence';

const root = resolve(import.meta.dirname, '../..');
const builtPage = resolve(root, 'dist/registry/verify/index.html');
const registry = JSON.parse(readFileSync(resolve(root, 'public/registry/zodiacs.registry.json'), 'utf8'));

describe.skipIf(!existsSync(builtPage))('built Astrofolio verification extraction (requires an Astro build)', () => {
  const read = () => readFileSync(builtPage, 'utf8');

  it('preserves every Registry identifier, material claim and qualification in static and machine views', () => {
    assertStaticFacts(read(), registry);
  });

  it('renders the reviewed adapter without refreshing dates, omitting qualifications or promoting statuses', () => {
    expect(machineEvidence(read())).toEqual(evidence);
    const html = read();
    for (const claim of evidence.claims) {
      const article = [...html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/giu)]
        .find((entry) => entry[1].includes(`data-claim-id="${claim.id}"`));
      expect(article, claim.id).toBeTruthy();
      expect(staticText(article![2])).toContain(STATUS_LABELS[claim.status]);
    }
  });

  it('does not let the machine view invent additional canonical identifiers', () => {
    const machine = machineEvidence(read());
    const identifiers = new Set(registry.assets.flatMap((asset: { representations: { address: string }[] }) => asset.representations.map((record) => record.address)));
    const found: string[] = [];
    const inspect = (value: unknown, key = '') => {
      if (Array.isArray(value)) value.forEach((entry) => inspect(entry, key));
      else if (value && typeof value === 'object') Object.entries(value).forEach(([field, entry]) => inspect(entry, field));
      else if (typeof value === 'string' && /^(?:address|identifier|originAddress)$/u.test(key)) found.push(value);
    };
    inspect(machine);
    expect(found.length).toBeGreaterThanOrEqual(24);
    for (const identifier of found) expect(identifiers.has(identifier), identifier).toBe(true);
  });

  it('keeps Registry matching limits in readable HTML without executing page scripts', () => {
    // The optional raw JSON export cannot satisfy human-readable disclosure checks.
    const text = staticText(read().replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/giu, ''));
    expect(text).toMatch(/(?:not|does not|cannot).{0,100}(?:safety|safe)/iu);
    expect(text).toMatch(/(?:not|does not|cannot).{0,100}(?:rights|entitlement|benefits)/iu);
    expect(text).toMatch(/operator.{0,20}(?:attest|statement)/iu);
    expect(text).toMatch(/(?:unresolved|not established|not documented)/iu);
    expect(text).toMatch(/(?:snapshot|revision)/iu);
  });

  it('uses a standard breadcrumb schema whose destination and name match visible content', () => {
    const html = read();
    const documents = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/giu)]
      .filter((entry) => /\btype=["']application\/ld\+json["']/u.test(entry[1]))
      .map((entry) => JSON.parse(entry[2]));
    const nodes = documents.flatMap((document) => document['@graph'] ?? [document]);
    const breadcrumbs = nodes.filter((node) => node['@type'] === 'BreadcrumbList');
    expect(breadcrumbs).toHaveLength(1);
    expect(breadcrumbs[0].itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Zodiacs.org', item: 'https://zodiacs.org/' },
      { '@type': 'ListItem', position: 2, name: 'Registry', item: 'https://zodiacs.org/registry/' },
      { '@type': 'ListItem', position: 3, name: 'Astrofolio verification', item: 'https://zodiacs.org/registry/verify/' },
    ]);
    expect(staticText(html)).toContain('Astrofolio verification');
    expect(nodes.some((node) => /(?:Review|AggregateRating|FinancialProduct|Certification)/u.test(node['@type']))).toBe(false);
  });
});
