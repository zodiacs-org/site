import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as ts from 'typescript';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const API_ROOT = join(ROOT, 'api');
const NODE_MODULES_ROOT = `${join(ROOT, 'node_modules')}${sep}`;
const EXPECTED_HANDLERS = [
  'api/account.ts',
  'api/aura-holdings.ts',
  'api/assistant.ts',
  'api/calendar/transits.ts',
  'api/compatibility.ts',
  'api/email/admin-bootstrap.ts',
  'api/email/chart-preference.ts',
  'api/email/subscribe.ts',
  'api/guide.ts',
  'api/push/subscribe.ts',
  'api/unsubscribe.ts',
  'api/wallet-birth.ts',
] as const;

interface RuntimeImport {
  specifier: string;
  hasJsonAttribute: boolean;
}

function repoPath(path: string): string {
  return relative(ROOT, path).split(sep).join('/');
}

function deployedFunctionFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || entry.name.startsWith('_')) return [];
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return deployedFunctionFiles(path);
    return entry.isFile()
      && /\.(?:[cm]?[jt]s|[jt]sx)$/.test(path)
      && !/\.d\.[cm]?ts$/.test(path)
      ? [repoPath(path)]
      : [];
  });
}

function importHasRuntimeValue(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (!clause) return true;
  if (clause.isTypeOnly) return false;
  if (clause.name) return true;
  if (!clause.namedBindings) return false;
  if (ts.isNamespaceImport(clause.namedBindings)) return true;
  return clause.namedBindings.elements.some((element) => !element.isTypeOnly);
}

function exportHasRuntimeValue(node: ts.ExportDeclaration): boolean {
  if (node.isTypeOnly) return false;
  if (!node.exportClause || ts.isNamespaceExport(node.exportClause)) return true;
  return node.exportClause.elements.some((element) => !element.isTypeOnly);
}

function jsonAttribute(node: ts.ImportDeclaration): boolean {
  return node.attributes?.elements.some((attribute) => {
    const name = attribute.name.text;
    return name === 'type' && ts.isStringLiteral(attribute.value) && attribute.value.text === 'json';
  }) ?? false;
}

function dynamicJsonAttribute(node: ts.CallExpression): boolean {
  const options = node.arguments[1];
  if (!options || !ts.isObjectLiteralExpression(options)) return false;
  const attributes = options.properties.find((property) => ts.isPropertyAssignment(property)
    && (property.name.getText() === 'with' || property.name.getText() === 'assert'));
  if (!attributes || !ts.isPropertyAssignment(attributes)
    || !ts.isObjectLiteralExpression(attributes.initializer)) return false;
  return attributes.initializer.properties.some((property) => ts.isPropertyAssignment(property)
    && property.name.getText() === 'type'
    && ts.isStringLiteral(property.initializer)
    && property.initializer.text === 'json');
}

function runtimeImportsFromSource(path: string, sourceText: string): RuntimeImport[] {
  const source = ts.createSourceFile(
    path,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
  );
  const imports: RuntimeImport[] = [];

  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && importHasRuntimeValue(node)) {
      imports.push({
        specifier: node.moduleSpecifier.text,
        hasJsonAttribute: jsonAttribute(node),
      });
    } else if (ts.isExportDeclaration(node)
      && node.moduleSpecifier
      && ts.isStringLiteral(node.moduleSpecifier)
      && exportHasRuntimeValue(node)) {
      imports.push({ specifier: node.moduleSpecifier.text, hasJsonAttribute: false });
    } else if (ts.isCallExpression(node)
      && node.arguments.length >= 1
      && ts.isStringLiteral(node.arguments[0])
      && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      imports.push({
        specifier: node.arguments[0].text,
        hasJsonAttribute: dynamicJsonAttribute(node),
      });
    } else if (ts.isCallExpression(node)
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'require') {
      imports.push({ specifier: node.arguments[0].text, hasJsonAttribute: false });
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return imports;
}

function runtimeImports(path: string): RuntimeImport[] {
  return runtimeImportsFromSource(path, readFileSync(path, 'utf8'));
}

function resolveSource(from: string, specifier: string): string | null {
  const base = resolve(dirname(from), specifier);
  const extension = extname(base);
  const candidates = extension === '.js'
    ? [base, `${base.slice(0, -3)}.ts`, `${base.slice(0, -3)}.tsx`]
    : extension === '.mjs'
      ? [base, `${base.slice(0, -4)}.mts`]
      : extension
        ? [base]
        : [
            base,
            `${base}.ts`,
            `${base}.tsx`,
            `${base}.js`,
            join(base, 'index.ts'),
            join(base, 'index.tsx'),
            join(base, 'index.js'),
          ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function auditRuntimeGraphs(): { violations: string[]; catalogs: string[] } {
  const pending = EXPECTED_HANDLERS.map((entry) => join(ROOT, entry));
  const visited = new Set<string>();
  const violations: string[] = [];

  while (pending.length > 0) {
    const path = pending.pop()!;
    if (visited.has(path) || path.endsWith('.json')) continue;
    visited.add(path);

    for (const imported of runtimeImports(path)) {
      if (!imported.specifier.startsWith('.')) continue;
      if (!/\.(?:[cm]?js|json|node)$/.test(imported.specifier)) {
        violations.push(`${repoPath(path)} -> ${imported.specifier} has no emitted runtime extension`);
      }
      if (imported.specifier.endsWith('.json') && !imported.hasJsonAttribute) {
        violations.push(`${repoPath(path)} -> ${imported.specifier} has no JSON import attribute`);
      }
      const target = resolveSource(path, imported.specifier);
      if (!target) {
        violations.push(`${repoPath(path)} -> ${imported.specifier} does not resolve from source`);
      } else if (target.startsWith(NODE_MODULES_ROOT)) {
        violations.push(`${repoPath(path)} -> ${imported.specifier} is an unapproved relative dependency import`);
      } else {
        pending.push(target);
      }
    }
  }

  return {
    violations: [...new Set(violations)].sort(),
    catalogs: [...visited]
      .map(repoPath)
      .filter((path) => path.startsWith('src/strings/') && path.endsWith('.mjs'))
      .sort(),
  };
}

describe('Vercel API runtime packaging', () => {
  it('exposes only the intended function handlers', () => {
    expect(deployedFunctionFiles(API_ROOT).sort()).toEqual([...EXPECTED_HANDLERS].sort());
    expect(EXPECTED_HANDLERS).toHaveLength(12);
  });

  it('routes the seven compute endpoints through the existing compatibility function', () => {
    const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
    for (const endpoint of ['chart', 'positions', 'houses', 'events', 'time', 'sky-fact', 'elections']) {
      expect(vercel.rewrites).toContainEqual({
        source: `/api/v1/${endpoint}`,
        destination: `/api/compatibility?__zodiacs_compute=${endpoint}`,
      });
    }
    expect(runtimeImports(join(ROOT, 'api/compatibility.ts'))).toContainEqual({
      specifier: './_compute/handler.js',
      hasJsonAttribute: false,
    });
    // The site's resolver reaches the function as a self-contained bundle,
    // not through its extensionless source imports.
    expect(runtimeImports(join(ROOT, 'api/_compute/handler.ts'))).toContainEqual({
      specifier: './local-time.mjs',
      hasJsonAttribute: false,
    });
  });

  it('routes Registry news through the existing compatibility function', () => {
    const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
    expect(vercel.rewrites).toContainEqual({
      source: '/api/registry/news',
      destination: '/api/compatibility?action=registry-news',
    });
  });

  it('routes the Zodiac Games through the existing compatibility function', () => {
    const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
    expect(vercel.rewrites).toContainEqual({
      source: '/api/games',
      destination: '/api/compatibility?__zodiacs_games_route=1',
    });
  });

  it('routes both chart-preview surfaces through the existing compatibility function', () => {
    const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
    expect(vercel.rewrites).toContainEqual({
      source: '/api/og/chart',
      destination: '/api/compatibility?__zodiacs_og_route=link',
    });
    expect(vercel.rewrites).toContainEqual({
      source: '/api/og/chart-image',
      destination: '/api/compatibility?__zodiacs_og_route=image',
    });
  });

  it('keeps account lifecycle actions on one scoped function route', () => {
    const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
    expect(vercel.rewrites).toContainEqual({
      source: '/api/account/:action',
      destination: '/api/account?action=:action',
    });
  });

  it('keeps the public email lifecycle URLs on one bundled function', () => {
    const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
    expect(vercel.rewrites).toContainEqual({
      source: '/api/email/confirm',
      destination: '/api/email/subscribe?__zodiacs_email_route=confirm',
    });
    expect(vercel.rewrites).toContainEqual({
      source: '/api/email/unsubscribe',
      destination: '/api/email/subscribe?__zodiacs_email_route=unsubscribe',
    });
  });

  it('routes the dormant Guide transport without creating a user-facing route', () => {
    const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
    expect(vercel.rewrites).toContainEqual({
      source: '/v1/guide/turn',
      destination: '/api/guide?action=turn',
    });
    const trailingSlashRedirect = vercel.redirects.find(
      (rule: { destination?: string }) => rule.destination === '/:path/',
    );
    expect(trailingSlashRedirect).toBeDefined();
    const parameterPattern = trailingSlashRedirect.source.slice('/:path('.length, -1);
    expect(new RegExp(`^(?:${parameterPattern})$`, 'u').test('v1/guide/turn')).toBe(false);
    expect(new RegExp(`^(?:${parameterPattern})$`, 'u').test('learn/aspects')).toBe(true);
    expect(existsSync(join(ROOT, 'src/pages/guide'))).toBe(false);
  });

  it('uses Node ESM-safe relative imports through every handler graph', () => {
    const audit = auditRuntimeGraphs();
    expect(audit.violations).toEqual([]);
    expect(audit.catalogs).toEqual([]);
    expect(runtimeImports(join(ROOT, 'api/compatibility.ts'))).toContainEqual({
      specifier: '../src/server/chart-preview.js',
      hasJsonAttribute: false,
    });
    expect(runtimeImports(join(ROOT, 'src/server/chart-preview.ts'))).toContainEqual({
      specifier: '@vercel/og',
      hasJsonAttribute: false,
    });
    expect(readFileSync(join(ROOT, 'src/server/chart-preview.ts'), 'utf8')).not.toContain("runtime: 'edge'");
  });

  it('packages the shared admin bootstrap guard in both daily enrollment graphs', () => {
    for (const handler of [
      'api/email/chart-preference.ts',
      'api/email/_confirm.ts',
    ]) {
      expect(runtimeImports(join(ROOT, handler))).toContainEqual({
        specifier: '../../src/lib/email/daily-admin-bootstrap.js',
        hasJsonAttribute: false,
      });
    }
  });

  it('follows attributed two-argument dynamic JSON imports', () => {
    expect(runtimeImportsFromSource(
      'virtual.ts',
      `const data = await import('./fixture.json', { with: { type: 'json' } });`,
    )).toEqual([{ specifier: './fixture.json', hasJsonAttribute: true }]);
  });
});
