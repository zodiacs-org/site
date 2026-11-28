import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { CATALOG_LOCALES, type CatalogLocale } from '../core';
import en from './en';
import es from './es';
import fr from './fr';
import itCatalog from './it';
import pt from './pt';
import ru from './ru';
import { GROWTH_UI_EN, GROWTH_UI_ES } from './growth';

// The French, Italian and Portuguese catalogs (and GROWTH_UI_ES) start their
// growth block with `...GROWTH_UI_EN` and then override each key. The
// `satisfies UiCatalog` check is met by the spread alone, so a growth key that
// a catalog forgets to override, or a new key added to GROWTH_UI_EN, would
// ship in English with no type error. These tests make that a failure.

const here = dirname(fileURLToPath(import.meta.url));
const GROWTH_KEYS = Object.keys(GROWTH_UI_EN) as (keyof typeof GROWTH_UI_EN)[];

/**
 * Growth strings a catalog may leave identical to English, each with its
 * reason. Anything else equal to English counts as an untranslated string.
 */
const SAME_AS_ENGLISH: Partial<Record<CatalogLocale, Partial<Record<keyof typeof GROWTH_UI_EN, string>>>> = {
  es: { footerWidgets: 'loanword "Widgets" used as-is in Spanish' },
  fr: { footerWidgets: 'loanword "Widgets" used as-is in French' },
  pt: { footerWidgets: 'loanword "Widgets" used as-is in Portuguese' },
  ru: {
    emailCaptureEmailPlaceholder:
      'written in ru.ts, not spread; left as you@example.com pending a native choice (reports/i18n-string-coverage.md §1)',
  },
};

interface SpreadSite {
  file: string;
  /** Name of the object the spread sits in, for messages. */
  owner: string;
  /** Property names written after the spread, in source order. */
  overrides: string[];
}

function propertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return null;
}

function ownerName(literal: ts.ObjectLiteralExpression): string {
  let node: ts.Node = literal;
  while (node.parent && !ts.isVariableDeclaration(node.parent)) {
    node = node.parent;
    if (ts.isSourceFile(node)) return '(anonymous object)';
  }
  const declaration = node.parent;
  return declaration && ts.isVariableDeclaration(declaration) ? declaration.name.getText() : '(anonymous object)';
}

/** Every `...GROWTH_UI_EN` spread in the UI catalog sources except en.ts. */
function growthSpreadSites(): SpreadSite[] {
  const sites: SpreadSite[] = [];
  const files = readdirSync(here).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
  for (const file of files) {
    if (file === 'en.ts') continue;
    const text = readFileSync(join(here, file), 'utf8');
    if (!text.includes('GROWTH_UI_EN')) continue;
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const visit = (node: ts.Node) => {
      if (ts.isObjectLiteralExpression(node)) {
        const spreadIndex = node.properties.findIndex((property) =>
          ts.isSpreadAssignment(property)
          && ts.isIdentifier(property.expression)
          && property.expression.text === 'GROWTH_UI_EN');
        if (spreadIndex >= 0) {
          const overrides = node.properties.slice(spreadIndex + 1).flatMap((property) => {
            if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) {
              const name = propertyName(property.name);
              return name ? [name] : [];
            }
            return [];
          });
          sites.push({ file, owner: ownerName(node), overrides });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return sites;
}

describe('GROWTH_UI_EN spread', () => {
  const sites = growthSpreadSites();

  it('is found where the catalogs use it today', () => {
    // Proves the source scan still finds the known spreads, so the per-site
    // test below cannot pass by finding nothing. A new spread anywhere in the
    // catalogs is picked up and checked as well.
    expect(sites.map((site) => `${site.file}:${site.owner}`).sort()).toEqual(
      expect.arrayContaining(['fr.ts:fr', 'growth.ts:GROWTH_UI_ES', 'it.ts:it', 'pt.ts:pt']),
    );
  });

  it.each(sites.map((site) => [`${site.file} (${site.owner})`, site] as const))(
    '%s writes out every growth key after the spread',
    (_label, site) => {
      const written = new Set(site.overrides);
      const left = GROWTH_KEYS.filter((key) => !written.has(key));
      expect(left, `${site.file}: growth keys that fall through to English`).toEqual([]);
    },
  );
});

describe('growth strings in each catalog', () => {
  const catalogs: Record<Exclude<CatalogLocale, 'en'>, Record<string, string>> = {
    es,
    fr,
    it: itCatalog,
    pt,
    ru,
  };

  it('covers every catalog locale', () => {
    expect(Object.keys(catalogs).sort()).toEqual(CATALOG_LOCALES.filter((locale) => locale !== 'en').sort());
  });

  it('keeps English as the growth source', () => {
    for (const key of GROWTH_KEYS) expect((en as Record<string, string>)[key], key).toBe(GROWTH_UI_EN[key]);
  });

  it('keeps GROWTH_UI_ES as the Spanish growth block', () => {
    for (const key of GROWTH_KEYS) expect((es as Record<string, string>)[key], key).toBe(GROWTH_UI_ES[key]);
  });

  it.each(Object.entries(catalogs))('%s carries no English growth string outside the allowlist', (locale, catalog) => {
    const allowed = SAME_AS_ENGLISH[locale as CatalogLocale] ?? {};
    const english = GROWTH_KEYS.filter((key) => catalog[key] === GROWTH_UI_EN[key] && !(key in allowed));
    expect(english, `${locale}: growth strings still in English`).toEqual([]);
  });

  it('keeps the allowlist honest', () => {
    // An allowlisted key that has since been translated must leave the list.
    for (const [locale, keys] of Object.entries(SAME_AS_ENGLISH)) {
      const catalog = catalogs[locale as Exclude<CatalogLocale, 'en'>];
      for (const key of Object.keys(keys ?? {}) as (keyof typeof GROWTH_UI_EN)[]) {
        expect(catalog[key], `${locale}.${key}`).toBe(GROWTH_UI_EN[key]);
      }
    }
  });
});
