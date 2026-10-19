import { afterEach, describe, expect, it, vi } from 'vitest';
import { russianDeferredStyleURLs, russianDeferredStylesReady } from './i18n-r2-deferred-styles.mjs';

const baseURL = 'http://127.0.0.1:4418';
const names = ['calculator.hash.css', 'explorer.hash.css', 'ChartActionDock.hash.css'];
const fixture = (styles = names) => styles.map((name) => {
  const link = `<link rel="stylesheet" href="/_astro/${name}">`;
  return `<template data-zdx-deferred-style>${link}</template><noscript>${link}</noscript>`;
}).join('');

afterEach(() => vi.unstubAllGlobals());

describe('Russian deferred CSS browser evidence', () => {
  it('follows the renamed shared chunk and excludes its noscript duplicate', () => {
    expect(russianDeferredStyleURLs(fixture(), baseURL))
      .toEqual(names.map((name) => `${baseURL}/_astro/${name}`));
  });

  it.each([[], names.slice(0, 2), [...names, 'extra.hash.css']].map((styles) => ({ styles })))(
    'rejects a changed stylesheet count: $styles',
    ({ styles }) => {
      expect(() => russianDeferredStyleURLs(fixture(styles), baseURL)).toThrow(/three deferred/u);
    },
  );

  it('rejects duplicate declarations and an invalid deferred link', () => {
    expect(() => russianDeferredStyleURLs(fixture([names[0], names[1], names[1]]), baseURL))
      .toThrow(/three distinct/u);
    expect(() => russianDeferredStyleURLs(fixture().replace('/_astro/ChartActionDock', 'https://other.test/ChartActionDock'), baseURL))
      .toThrow(/one local stylesheet/u);
  });

  it('requires every declared URL to load; a stale or unrelated third sheet cannot substitute', () => {
    const expected = russianDeferredStyleURLs(fixture(), baseURL);
    for (const third of [undefined, expected[1], `${baseURL}/_astro/ChartCalculator.hash.css`, `${baseURL}/_astro/unrelated.hash.css`]) {
      vi.stubGlobal('document', { styleSheets: [null, ...expected.slice(0, 2), third].map((href) => ({ href })) });
      expect(russianDeferredStylesReady(expected)).toBe(false);
    }
    vi.stubGlobal('document', { styleSheets: [null, ...expected].map((href) => ({ href })) });
    expect(russianDeferredStylesReady(expected)).toBe(true);
  });

  it('does not treat an empty or partial expectation as delivery evidence', () => {
    const expected = russianDeferredStyleURLs(fixture(), baseURL);
    vi.stubGlobal('document', { styleSheets: expected.map((href) => ({ href })) });
    for (const incomplete of [[], expected.slice(0, 2), [expected[0], expected[1], expected[1]]]) {
      expect(russianDeferredStylesReady(incomplete)).toBe(false);
    }
  });
});
