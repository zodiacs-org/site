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
      expect(copy).toMatch(/Anthropic/);
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
    // Without a birth time, the calculator names the Moon's sign only where
    // the birth date's own limits show it (src/lib/moon-day-bounds.ts): one
    // sign all day, both signs on a sign-change day, or unverified otherwise.
    const rules = {
      en: [
        /12:00 local civil time/, /rising sign, angles, and houses/,
        /If the Moon stayed in one sign for the whole date, the result names that sign/,
        /if the Moon changed sign that day, it shows both signs/,
        /if the date's start and end cannot be confirmed, it marks the Moon's sign as unverified/,
        /the result names the Moon's sign without a degree/,
      ],
      es: [
        /12:00 del tiempo civil local/, /ascendente, ángulos y casas/,
        /Si la Luna permaneció en un solo signo durante toda la fecha, el resultado nombra ese signo/,
        /si cambió de signo ese día, muestra ambos signos/,
        /si no se pueden confirmar el inicio y el final de la fecha, marca el signo de la Luna como no verificado/,
        /el resultado nombra el signo sin grado/,
      ],
      pt: [
        /12:00 no horário civil local/, /ascendente, ângulos e casas/,
        /Se a Lua permaneceu em um único signo durante toda a data, o resultado informa esse signo/,
        /se mudou de signo naquele dia, mostra os dois signos/,
        /se o início e o fim da data não puderem ser confirmados, marca o signo da Lua como não verificado/,
        /o resultado informa o signo sem grau/,
      ],
      fr: [
        /12 h en heure civile locale/, /l’ascendant, les angles et les maisons/,
        /Si la Lune est restée dans un seul signe toute la journée, le résultat nomme ce signe/,
        /si elle a changé de signe ce jour-là, il affiche les deux signes/,
        /si le début et la fin du jour ne peuvent pas être confirmés, il marque le signe de la Lune comme non vérifié/,
        /le résultat nomme le signe sans degré/,
      ],
      it: [
        /12:00 dell’ora civile locale/, /ascendente, angoli e case/,
        /Se la Luna è rimasta in un solo segno per tutta la data, il risultato indica quel segno/,
        /se ha cambiato segno quel giorno, mostra entrambi i segni/,
        /se inizio e fine della data non possono essere confermati, segnala il segno della Luna come non verificato/,
        /il risultato indica il segno senza grado/,
      ],
      ru: [
        /12:00 местного гражданского времени/, /асцендент, углы и дома/,
        /Если Луна весь день оставалась в одном знаке, результат называет этот знак/,
        /если в тот день она сменила знак, показывает оба/,
        /если начало и конец даты подтвердить не удаётся, отмечает знак Луны как непроверенный/,
        /результат называет знак Луны без градуса/,
      ],
    };
    for (const [locale, patterns] of Object.entries(rules)) {
      const path = locale === 'en'
        ? 'src/pages/methodology/index.astro'
        : `src/pages/${locale}/methodology/index.astro`;
      const copy = await text(path);
      for (const pattern of patterns) expect(copy, `${path}: ${pattern}`).toMatch(pattern);
    }
  });

  it('states the unknown-time Moon rule on every unprotected English and Russian surface that describes it', async () => {
    // One sign when the Moon held it through the whole birth date, both signs of
    // a day it changed sign, and unverified otherwise (src/lib/moon-day-bounds.ts).
    const english = {
      single: /names? (?:your |the )?Moon(?:’s|'s)? sign(?:, without a degree,)? (?:when|if|only when) the Moon (?:stayed in one sign|held it) (?:all day|for the whole (?:birth )?date)/u,
      both: /shows? both (?:Moon )?signs (?:when|if) (?:the Moon|it) changed sign that day/u,
      otherwise: /otherwise[^.]*?(?:marks?|is marked)[^.]*?unverified|marks the Moon(?:’s|'s) sign as unverified when the date(?:’s|'s) start and end cannot be confirmed/u,
    };
    const russian = {
      single: /называет (?:лунный знак|этот знак|знак Луны), если Луна весь день (?:рождения )?оставалась в одном знаке/u,
      both: /показывает оба знака, если в тот день она сменила знак/u,
      otherwise: /а иначе (?:помечает|отмечает) лунный знак как (?:неподтверждённый|непроверенный)/u,
    };
    const surfaces = [
      ['src/pages/index.astro', english], ['src/pages/moon-sign/index.astro', english],
      ['src/pages/birth-chart/index.astro', english], ['src/pages/big-three/index.astro', english],
      ['public/llms.txt', english], ['public/llms-full.txt', english],
      ['scripts/build-assistant-context.mjs', english], ['api/_assistant/context.ts', english],
      ['src/pages/ru/index.astro', russian], ['src/pages/ru/moon-sign/index.astro', russian],
      ['src/pages/ru/birth-chart/index.astro', russian],
    ];
    for (const [path, rule] of surfaces) {
      const copy = await text(path);
      for (const [state, pattern] of Object.entries(rule)) expect(copy, `${path}: ${state}`).toMatch(pattern);
      // The line that states the rule claims no more than the date's limits show, in plain punctuation.
      const line = copy.split('\n').find((entry) => rule.single.test(entry));
      expect(line, `${path}: one line states the rule`).toBeDefined();
      expect(line, path).not.toMatch(/[\u2013\u2014]/u);
      expect(line, path).not.toMatch(/\balways\b|\bevery (?:date|birth)|exact (?:Moon )?degree|всегда|точн(?:ый|ого) градус/iu);
      expect(copy, path).not.toMatch(/marks the Moon(?:’s|'s)? sign as unverified,? (?:because|until you add a time, because)|помечает лунный знак как неподтверждённый, пока вы не укажете время: Луна|Поскольку Луна может сменить знак в течение дня, результат помечает|отмечает знак Луны как непроверенный, потому что/u);
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
      expect(copy, path).toMatch(/Anthropic/);
      expect(copy, path).toMatch(/Plausible/);
      expect(copy, path).toMatch(/24 (?:hours|horas|heures|ore|часа)/u);
      for (const pattern of guideSafetyDisclosure.get(path) ?? []) {
        expect(copy, `${path}: ${pattern}`).toMatch(pattern);
      }
    }
    const assistant = await text('src/lib/assistant/open-assistant.ts');
    expect(assistant).toMatch(/Anthropic/);
    expect(assistant).toMatch(/does not automatically attach your saved birth chart or personal chart placements/);
    expect(assistant).toMatch(/browser session|session/i);
  });

  it('keeps the runtime Guide policy aligned with the public disclosure', async () => {
    const [policy, provider] = await Promise.all([
      text('src/lib/guide-server/policy.ts'),
      text('src/lib/guide-server/anthropic.ts'),
    ]);
    expect(policy).toMatch(/You are Guide/);
    expect(policy).toMatch(/plain language/);
    expect(policy).toMatch(/financial/);
    expect(provider).toMatch(/https:\/\/api\.anthropic\.com\/v1\/messages/);
    expect(provider).toMatch(/x-api-key/);
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
    expect(strategy).toMatch(/derived placements to Anthropic/iu);
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
  it('wires the reviewed byte-exact 1200x630 hero art card into homepage metadata and the site fallback', async () => {
    const [page, seo, cards, bytes, earlier] = await Promise.all([
      text('src/pages/index.astro'),
      text('src/components/SEO.astro'),
      text('src/lib/og-art-cards.mjs'),
      readFile(resolve(root, 'public/assets/og/v8/home-20261019.jpg')),
      readFile(resolve(root, 'public/assets/og/v2/share-pastel-wheel-20261019.png')),
    ]);
    expect(page).toContain('image={HOME_ART_CARD}');
    expect(page).toContain('imageAlt={HOME_ART_CARD_ALT}');
    expect(cards).toContain("export const HOME_ART_CARD = `${ART_CARD_DIR}/home-20261019.jpg`;");
    expect(cards).toMatch(/HOME_ART_CARD_ALT = '[^']*zodiac band from the hero film[^']*Explore the stars behind your story/u);
    // English pages fall back to it; a localized page to its locale's own homepage card.
    expect(seo).toContain('explicitImage ?? catalogImage ?? (ART_CARD_LOCALES.includes(locale) ? homeArtCard(locale) : HOME_ART_CARD);');
    expect(seo).toContain('<meta property="og:image:type" content={imageType} />');
    expect(seo).toContain('<meta name="twitter:image" content={imageUrl} />');
    expect(createHash('sha256').update(bytes).digest('hex'))
      // The 2026-10-19 art card: the hero film's poster cut at full size, with
      // the hero's headline in the display serif and the brand lockup
      // (src/lib/og-art-cards.mjs, DESIGN.md).
      .toBe('e7d2b4c009b5cb00349e969217a6846d0484a79b858b0e746d7011036d5fe4fc');
    // The card it replaced stays published, unchanged, for links already shared.
    expect(createHash('sha256').update(earlier).digest('hex'))
      .toBe('f315272bcba1b99de463a4df89cb18284caeed3a6d7cbdd016cc26323dd2bcbe');
  });
});
