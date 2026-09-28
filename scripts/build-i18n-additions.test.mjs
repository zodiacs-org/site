import { describe, expect, it } from 'vitest';
import { GROWTH_UI_EN } from '../src/lib/i18n/ui/growth';
import { SHARE_CARD_COPY } from '../src/lib/share-card-copy';
import { COMPATIBILITY_PREFILL_COPY } from '../src/islands/PrefilledPairNotice';
import { EN as TRUST_EN } from '../src/strings/en.mjs';
import { PWA_PROMPT_COPY } from '../src/strings/pwa';
import {
  ADDITION_TRANSLATIONS,
  i18nAdditionEntries,
  i18nAdditionSections,
  i18nManifestIsCurrent,
  renderI18nAdditions,
  requiredLocalesForKey,
} from './build-i18n-additions.mjs';

const EXPECTED_SECTION_COUNTS = {
  'WS1 — trust, disclosure, and archive receipts': 72,
  'WS2b — email capture and shared footer': 32,
  'WS2c — OG and social-card art': 122,
  'WS2d — structured data': 47,
  'WS3 — share cards and result sharing': 60,
  'WS4 — PWA, install prompt, and flag-off push scaffold': 22,
  'WS5 — programmatic pages and Chinese zodiac': 77,
  'WS6 — widgets': 83,
  'WS8 — wallet natal chart': 68,
};

describe('additive locale handoff manifest', () => {
  it('covers the exact 583-key additive source set without duplicates', () => {
    const sections = i18nAdditionEntries();
    const entries = sections.flatMap(({ entries: values }) => values);
    const counts = Object.fromEntries(sections.map(({ title, entries: values }) => [title, values.length]));

    expect(counts).toEqual(EXPECTED_SECTION_COUNTS);
    expect(entries).toHaveLength(583);
    expect(new Set(entries.map(({ key }) => key)).size).toBe(entries.length);
    expect(i18nAdditionSections()).toEqual(
      sections.map(({ title, entries: values }) => [title, values.map(({ key }) => key)]),
    );
  });

  it('derives all trust and shared-UI additions, including footer disclosure, from source catalogs', () => {
    const byTitle = new Map(i18nAdditionEntries().map(({ title, entries }) => [title, entries]));
    const trustKeys = byTitle.get('WS1 — trust, disclosure, and archive receipts').map(({ key }) => key);
    const sharedEntries = byTitle.get('WS2b — email capture and shared footer');

    expect(trustKeys).toEqual(Object.keys(TRUST_EN).sort((a, b) => a.localeCompare(b)));
    expect(sharedEntries.map(({ key }) => key)).toEqual(
      Object.keys(GROWTH_UI_EN).sort((a, b) => a.localeCompare(b)),
    );
    expect(sharedEntries.find(({ key }) => key === 'footerDisclosure')).toMatchObject({
      english: 'Disclosure',
      pendingLocales: [],
    });
  });

  it('keeps Astrofolio and Terminal distinct while the shared wing card stays neutral', () => {
    const entries = i18nAdditionEntries().flatMap(({ entries: values }) => values);
    const byKey = new Map(entries.map((entry) => [entry.key, entry.english]));

    expect(byKey.get('og.astrofolio.alt')).toContain('Astrofolio');
    expect(byKey.get('og.terminal.alt')).toContain('Terminal');
    expect(byKey.get('og.wing.title')).toBe('The Twelve');
    expect(byKey.get('og.wing.data')).toBe('Astrofolio · Registry · Terminal');
    expect(byKey.has('og.registry.alt')).toBe(false);
  });

  it('supplies the exact required key set for every translated catalogue', () => {
    const entries = i18nAdditionEntries().flatMap(({ entries: values }) => values);
    const byKey = new Map(entries.map((entry) => [entry.key, entry]));
    const placeholders = (value) => [...value.matchAll(/\{[A-Za-z][A-Za-z0-9]*\}/g)].map(([token]) => token).sort();

    for (const [locale, catalogue] of Object.entries(ADDITION_TRANSLATIONS)) {
      const expected = entries
        .filter(({ key }) => requiredLocalesForKey(key).includes(locale))
        .map(({ key }) => key)
        .sort();
      expect(Object.keys(catalogue).sort(), locale).toEqual(expected);
      for (const [key, translated] of Object.entries(catalogue)) {
        const english = byKey.get(key)?.english;
        expect(english, `${locale}.${key}`).toEqual(expect.any(String));
        expect(placeholders(translated), `${locale}.${key}`).toEqual(placeholders(english));
        expect((translated.match(/<br\/>/g) ?? []).length, `${locale}.${key}`).toBe((english.match(/<br\/>/g) ?? []).length);
        const marker = english.match(/\[OPERATOR TO [^\]]+\]/)?.[0];
        if (marker) expect(translated, `${locale}.${key}`).toContain(marker);
      }
    }
  });

  it('keeps client-safe runtime copy byte-identical to the translated catalogues', () => {
    const families = [
      ['shareCard', SHARE_CARD_COPY],
      ['compatibilityPrefill', COMPATIBILITY_PREFILL_COPY],
      ['pwa.prompt', PWA_PROMPT_COPY],
    ];
    for (const [locale, catalogue] of Object.entries({
      pt: ADDITION_TRANSLATIONS.PT,
      fr: ADDITION_TRANSLATIONS.FR,
      it: ADDITION_TRANSLATIONS.IT,
    })) {
      for (const [prefix, runtimeCopy] of families) {
        for (const [key, value] of Object.entries(runtimeCopy[locale])) {
          expect(value, `${locale}.${prefix}.${key}`).toBe(catalogue[`${prefix}.${key}`]);
        }
      }
    }
  });

  it('gives every key an English default, a one-line usage brief, and an explicit locale state', () => {
    const entries = i18nAdditionEntries().flatMap(({ entries: values }) => values);
    for (const entry of entries) {
      expect(entry.english, entry.key).not.toBe('');
      expect(entry.context, entry.key).toMatch(/^Location: .+\. Tone: .+\.$/);
      expect(entry.context, entry.key).not.toContain('\n');
      expect(entry.pendingLocales, entry.key).toEqual(expect.any(Array));
      expect(entry.pendingLocales.every((locale) => ['ES', 'PT', 'FR', 'IT'].includes(locale)), entry.key).toBe(true);
      expect(new Set(entry.pendingLocales).size, entry.key).toBe(entry.pendingLocales.length);
    }
  });

  it('carries placeholder and artwork line-break requirements beside every affected default', () => {
    const entries = i18nAdditionEntries().flatMap(({ entries: values }) => values);
    for (const entry of entries) {
      const placeholders = [...new Set(entry.english.match(/\{[A-Za-z][A-Za-z0-9]*\}/g) ?? [])];
      for (const placeholder of placeholders) {
        expect(entry.context, `${entry.key} must preserve ${placeholder}`).toContain(placeholder);
      }
      if (entry.english.includes('<br/>')) {
        expect(entry.context, `${entry.key} must preserve <br/>`).toContain('literal <br/>');
      }
      if (entry.english.includes('[OPERATOR TO ')) {
        expect(entry.context, `${entry.key} must preserve its pending marker`).toContain('operator-action marker verbatim');
      }
    }
  });

  it('renders all per-key fields and keeps the checked-in manifest byte-current', async () => {
    const rendered = renderI18nAdditions();
    expect(rendered).toContain('TODO(i18n): translation handoff for 583 additive keys');
    expect(rendered).toContain('`push.prompt.accept`');
    expect(
      i18nAdditionEntries()
        .flatMap(({ entries: values }) => values)
        .find(({ key }) => key === 'push.prompt.accept')?.pendingLocales,
    ).toEqual([]);
    expect(i18nAdditionEntries().flatMap(({ entries: values }) => values).every(({ pendingLocales }) => pendingLocales.length === 0)).toBe(true);
    expect(rendered.match(/^  - EN default:/gm)).toHaveLength(583);
    expect(rendered.match(/^  - Usage:/gm)).toHaveLength(583);
    expect(rendered.match(/^  - Pending locales:/gm)).toHaveLength(583);
    expect(rendered).toContain('`footerDisclosure`');
    expect(await i18nManifestIsCurrent()).toBe(true);
  });
});
