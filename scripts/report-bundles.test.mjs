import { afterAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryRoots = [];
afterAll(() => temporaryRoots.forEach((root) => rmSync(root, { recursive: true, force: true })));

function check(changes = {}) {
  const root = mkdtempSync(join(tmpdir(), 'zodiacs-bundle-gate-'));
  temporaryRoots.push(root);
  const files = {
    'budgets.json': JSON.stringify({ '/': 42, '/birth-chart/': 70, '/aries/': 0,
      '/registry/collection/': 48, 'chunk-max': 60, 'engine-chunk': 25 }),
    'dist/index.html': '<script type="module" src="/_astro/client.fixture.js"></script>',
    'dist/birth-chart/index.html': '', 'dist/aries/index.html': '',
    'dist/registry/collection/index.html': '',
    'dist/_astro/client.fixture.js': 'export const ready=true;',
    'dist/_astro/full.fixture.js': 'import { engine } from "./engine-core.fixture.js";export { engine };',
    'dist/_astro/engine-core.fixture.js': 'export const engine=["Value is not boolean:","Light-travel time solver did not converge"];',
    'dist/_astro/receipt.fixture.js': 'export const provenance={name:"astronomy-engine"};',
    'src/lib/engine/server-ephemeris.ts': 'import * as A from "astronomy-engine";',
    'src/lib/engine/full.ts': 'import { computeChart } from "@zodiacs/engine/internal";',
    'src/lib/engine/aspects.ts': 'import { A } from "@zodiacs/engine/internal/math";',
    'src/lib/engine/houses.ts': 'import { H } from "@zodiacs/engine/internal/math";',
    'src/lib/engine/types.ts': 'import { T } from "@zodiacs/engine/internal/math";',
    ...changes,
  };
  for (const [name, contents] of Object.entries(files)) {
    const path = join(root, name); mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }
  mkdirSync(join(root, 'scripts'));
  copyFileSync(join(sourceRoot, 'scripts/report-bundles.mjs'), join(root, 'scripts/report-bundles.mjs'));
  symlinkSync(join(sourceRoot, 'node_modules'), join(root, 'node_modules'), 'dir');
  try {
    return { code: 0, output: execFileSync(process.execPath, ['scripts/report-bundles.mjs', '--fail'],
      { cwd: root, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (error) {
    return { code: error.status, output: `${error.stdout}\n${error.stderr}` };
  }
}

describe('actual bundle gate', () => {
  it('accepts a factored static engine closure and an inert provenance name', () => {
    expect(check().code).toBe(0);
  });

  it.each([
    'import "astronomy-engine";',
    'export * from "astronomy-engine";',
    'import /* comment */ ("astronomy-engine");',
    'import (`astronomy-engine`);',
    'require /* comment */ ("astronomy-engine");',
    'import "astronomy-engine/astronomy.browser.js";',
    String.raw`import "astronomy-\u0065ngine";`,
    String.raw`export * from "\u0061stronomy-engine";`,
    String.raw`import("astronomy-\x65ngine");`,
    String.raw`require("astronomy-\u0065ngine");`,
    'import(("astronomy-engine"));',
    'require(("astronomy-engine"));',
    '(require)("astronomy-engine");',
    'import "https://esm.sh/astronomy-engine@2.1.19";',
    'import("https://esm.sh/astronomy-engine");',
    'import { createRequire } from "node:module";',
  ])('still rejects actual server/vendor loading: %s', (source) => {
    const result = check({ 'dist/_astro/receipt.fixture.js': source });
    expect(result.code).toBe(1);
    expect(result.output).toContain('browser engine isolation');
  });

  it('does not parse comments or data strings as vendor imports', () => {
    expect(check({ 'dist/_astro/receipt.fixture.js':
      '// import "astronomy-engine";\nexport const note=\'import "astronomy-engine";\';' }).code).toBe(0);
  });

  it('rejects the engine when imported eagerly through a shared chunk', () => {
    const result = check({ 'dist/_astro/client.fixture.js': 'import "./engine-core.fixture.js";' });
    expect(result.code).toBe(1);
    expect(result.output).toContain('homepage engine isolation');
  });

  it('rejects a missing dependency rather than measuring a partial closure', () => {
    const result = check({ 'dist/_astro/full.fixture.js': 'import "./missing.fixture.js";' });
    expect(result.code).toBe(1);
    expect(result.output).toContain('references missing local chunk');
  });

  it('rejects shared engine code eagerly loaded by Registry Collection', () => {
    const result = check({ 'dist/registry/collection/index.html':
      '<script type="module" src="/_astro/engine-core.fixture.js"></script>' });
    expect(result.code).toBe(1);
    expect(result.output).toContain('Registry Collection eagerly loads');
  });

  it.each([
    ['src/islands/Unexpected.ts', 'import * as A from "astronomy-engine";'],
    ['src/lib/Unexpected.ts', 'import { computeChart } from "@zodiacs/engine/internal";'],
    ['src/islands/SideEffect.ts', 'import "astronomy-engine";'],
  ])('preserves exact source import boundaries at %s', (path, code) => {
    const result = check({ [path]: code });
    expect(result.code).toBe(1);
    expect(result.output).toContain('engine source isolation');
  });

  it('requires both ephemeris fingerprints in the full static closure', () => {
    const result = check({ 'dist/_astro/engine-core.fixture.js': 'export const engine="Value is not boolean:";' });
    expect(result.code).toBe(1);
    expect(result.output).toContain('engine marker fingerprint missing');
  });

  it('enforces the unchanged engine limit across multiple individually small chunks', () => {
    let seed = 1;
    const text = () => Array.from({ length: 19_000 }, () => {
      seed = Math.imul(seed, 1664525) + 1013904223 | 0;
      return String.fromCharCode(33 + ((seed >>> 0) % 90));
    }).join('');
    const result = check({
      'dist/_astro/full.fixture.js': 'import "./engine-core.fixture.js";import "./extra-a.fixture.js";import "./extra-b.fixture.js";',
      'dist/_astro/extra-a.fixture.js': `export const data=${JSON.stringify(text())};`,
      'dist/_astro/extra-b.fixture.js': `export const data=${JSON.stringify(text())};`,
    });
    expect(result.code).toBe(1);
    expect(result.output).toContain('static closure');
    expect(result.output).toContain('limit 25 KB');
    expect(result.output).not.toContain('chunk-max:');
  });
});

describe('worker window engine boundary',()=>{
 it.each(['import { birthWindow } from "@zodiacs/engine/window";','const load=()=>import("@zodiacs/engine/window");','export { birthWindow } from "@zodiacs/engine/window";','import {} from "@zodiacs/engine/window";','export {} from "@zodiacs/engine/window";'])('rejects runtime window loading outside full.ts: %s',source=>{
  const result=check({'src/islands/window.worker.ts':source});expect(result.code).toBe(1);expect(result.output).toContain('window runtime must use');
 });
 it('allows erased types and loading the existing boundary URL',()=>{
  expect(check({'src/islands/window.worker.ts':'import type { BirthWindowInput } from "@zodiacs/engine/window";const load=(url)=>import(url);'}).code).toBe(0);
  expect(check({'src/islands/Window.ts':'import { type BirthWindow } from "@zodiacs/engine/window";'}).code).toBe(0);
 });
 it('rejects worker ephemeris code outside the full static closure',()=>{
  const result=check({'dist/_astro/window.worker.fixture.js':'export const engine=["Value is not boolean:","Light-travel time solver did not converge"];'});
  expect(result.code).toBe(1);expect(result.output).toContain('worker/browser engine isolation');
 });
});
