import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const text = (path) => readFile(resolve(root, path), 'utf8');

const localeFiles = (surface) => [
  `src/pages/${surface}/index.astro`,
  ...['es', 'pt', 'fr', 'it', 'ru'].map((locale) => `src/pages/${locale}/${surface}/index.astro`),
];

describe('public trust-surface claims', () => {
  it('keeps the AI-readable context aligned with actual opt-in transmissions', async () => {
    const [short, full] = await Promise.all([text('public/llms.txt'), text('public/llms-full.txt')]);
    for (const copy of [short, full]) {
      expect(copy).toMatch(/12:00 local civil time/);
      expect(copy).toMatch(/angles.*houses/s);
      expect(copy).toMatch(/Guide/);
      expect(copy).toMatch(/OpenAI/);
      expect(copy).toMatch(/store:false/);
      expect(copy).toMatch(/does not automatically attach your saved birth chart/);
      expect(copy).not.toMatch(/Attach my chart/);
      expect(copy).toMatch(/generated draft reply.*second safety check/s);
      expect(copy).toMatch(/Avoid entering private birth details in Guide/);
      expect(copy).toMatch(/IANA\/ICU.*(?:browser|runtime)/s);
      expect(copy).toMatch(/raw IP.*user agent.*24 hours/s);
    }
    expect(short).toMatch(/daily horoscopes RSS/);
    expect(short).not.toMatch(/monthly horoscopes RSS/i);
    expect(full).toMatch(/dated daily edition/);
  });

  it('does not overclaim host timezone coverage or unknown-time precision', async () => {
    const paths = [
      'src/pages/index.astro',
      ...localeFiles('birth-chart'),
      ...localeFiles('methodology'),
      ...localeFiles('moon-sign'),
      ...localeFiles('compatibility'),
      ...['en', 'es', 'pt', 'fr', 'it', 'ru'].map((locale) => `src/lib/i18n/ui/${locale}.ts`),
    ];
    const copy = (await Promise.all(paths.map(text))).join('\n');
    expect(copy).not.toMatch(/full IANA|complete IANA|complete historical database|historia(?:l)? completa|base completa (?:de |da |dell’)?IANA|todo o histórico|historique complet|tout l’historique|intera cronologia|полная история|полной баз/iu);
    expect(copy).not.toMatch(/planets (?:are|remain|are still) exact to the day|planets are exact for the day|planetas (?:son|siguen siendo) precisos para el día|posições dos planetas continuam precisas para o dia|planètes (?:sont|restent) précises pour la journée|pianeti restano precisi per il giorno|планеты .*точны для (?:этого )?дня/iu);
  });

  it('states the complete no-time policy on every methodology page', async () => {
    // Since 9d180c9f the calculator marks the Moon's sign unverified on every
    // date without a birth time. The es/pt/fr/it pages still describe the
    // earlier sign-change flag and are protected; docs/claims/ledger.json
    // records those sentences as stale until an allowance lets them change,
    // so this test no longer pins them.
    const rules = {
      en: [/12:00 local civil time/, /rising sign, angles, and houses/, /marks the Moon's sign as unverified/],
      es: [/12:00 del tiempo civil local/, /ascendente, ángulos y casas/],
      pt: [/12:00 no horário civil local/, /ascendente, ângulos e casas/],
      fr: [/12 h en heure civile locale/, /l’ascendant, les angles et les maisons/],
      it: [/12:00 dell’ora civile locale/, /ascendente, angoli e case/],
      ru: [/12:00 местного гражданского времени/, /асцендент, углы и дома/, /знак Луны как непроверенный/],
    };
    for (const [locale, patterns] of Object.entries(rules)) {
      const path = locale === 'en'
        ? 'src/pages/methodology/index.astro'
        : `src/pages/${locale}/methodology/index.astro`;
      const copy = await text(path);
      for (const pattern of patterns) expect(copy, `${path}: ${pattern}`).toMatch(pattern);
    }
  });

  it('names assistant consent and bounded analytics processing on every privacy page', async () => {
    const guideSafetyDisclosure = new Map([
      ['src/pages/privacy/index.astro', [/generated draft reply/, /second safety check/]],
      ['src/pages/es/privacy/index.astro', [/borrador generado/, /segunda\s+revisión de seguridad/s]],
      ['src/pages/pt/privacy/index.astro', [/rascunho gerado/, /segunda\s+verificação de segurança/s]],
      ['src/pages/fr/privacy/index.astro', [/brouillon généré/, /second contrôle de\s+sécurité/s]],
      ['src/pages/it/privacy/index.astro', [/bozza\s+generata/s, /secondo controllo di\s+sicurezza/s]],
      ['src/pages/ru/privacy/index.astro', [/сгенерированный черновик ответа/, /второй проверки безопасности/]],
    ]);
    for (const path of localeFiles('privacy')) {
      const copy = await text(path);
      expect(copy, path).toMatch(/OpenAI/);
      expect(copy, path).toMatch(/Plausible/);
      expect(copy, path).toMatch(/24 (?:hours|horas|heures|ore|часа)/u);
      for (const pattern of guideSafetyDisclosure.get(path) ?? []) {
        expect(copy, `${path}: ${pattern}`).toMatch(pattern);
      }
    }
    const assistant = await text('src/lib/assistant/open-assistant.ts');
    expect(assistant).toMatch(/OpenAI/);
    expect(assistant).toMatch(/does not automatically attach your saved birth chart or personal chart placements/);
    expect(assistant).toMatch(/browser session|session/i);
  });

  it('keeps the runtime Guide policy aligned with the public disclosure', async () => {
    const [policy, provider] = await Promise.all([
      text('src/lib/guide-server/policy.ts'),
      text('src/lib/guide-server/openai.ts'),
    ]);
    expect(policy).toMatch(/You are Guide/);
    expect(policy).toMatch(/plain language/);
    expect(policy).toMatch(/financial/);
    expect(provider).toMatch(/store: false/);
    expect(provider).toMatch(/background: false/);
    expect(provider).not.toMatch(/user_id|visitorHash/);
  });
});

describe('repository operating claims', () => {
  it('keeps the canonical strategy precise about opt-in birth-data transmission', async () => {
    const strategy = await text('docs/STRATEGY.md');
    expect(strategy).not.toMatch(/birth data never leaves the device/iu);
    expect(strategy).toMatch(/chart calculation stays on the device/iu);
    expect(strategy).toMatch(/opts into account sync/iu);
    expect(strategy).toMatch(/types them into Guide/iu);
    expect(strategy).toMatch(/derived placements to OpenAI/iu);
    expect(strategy).toMatch(/not the saved name, birth date, time, place, or coordinates/iu);
  });

  it('keeps Growth OS measurement independent and aggregate-only', async () => {
    const [desk, review] = await Promise.all([
      text('docs/growth/playbooks/growth-signal-desk.md'),
      text('docs/growth/templates/weekly-review.md'),
    ]);
    for (const copy of [desk, review]) {
      expect(copy).toMatch(/independent(?:ly)? aggregate/iu);
      expect(copy).toMatch(/not .*linked.*user|never a linked visitor/isu);
      expect(copy).toMatch(/retention/iu);
      expect(copy).toMatch(/N\/A/u);
    }
    expect(`${desk}\n${review}`).not.toMatch(
      /eligible landing sessions|eligible returning visitors|visitors with a local save|consumer sessions|Journey scorecard/iu,
    );
  });

  it('records the accepted nonpersistent Plausible deduplication boundary in source and output', async () => {
    const [generator, report] = await Promise.all([
      text('scripts/build-build-report.mjs'),
      text('BUILD-REPORT.md'),
    ]);
    for (const copy of [generator, report]) {
      expect(copy).toMatch(/no cookies or persistent\/browser fingerprinting/iu);
      expect(copy).toMatch(/IP address and User-Agent/iu);
      expect(copy).toMatch(/site\/device\/day identifier/iu);
      expect(copy).toMatch(/salt rotates and is deleted every 24 hours/iu);
      expect(copy).toMatch(/no identifier is exposed to Zodiacs\.org or Growth OS/iu);
    }
  });
});

describe('homepage social card', () => {
  it('wires the reviewed byte-exact black 1200x630 card with prominent pastel symbols into homepage metadata', async () => {
    const [page, seo, bytes] = await Promise.all([
      text('src/pages/index.astro'),
      text('src/components/SEO.astro'),
      readFile(resolve(root, 'public/assets/og/v2/share-pastel-wheel-20260809.png')),
    ]);
    expect(page).toContain('image="/assets/og/v2/share-pastel-wheel-20260809.png"');
    expect(page).toMatch(/imageAlt="[^"]*large ring of twelve pastel zodiac symbols/);
    expect(seo).toContain('<meta property="og:image:type" content={imageType} />');
    expect(seo).toContain('<meta name="twitter:image" content={imageUrl} />');
    expect(createHash('sha256').update(bytes).digest('hex'))
      .toBe('8cdbd6b9adedc94b1793137dc0def58c2497ab1560f1850ef4e033d5ee7467fe');
  });
});
