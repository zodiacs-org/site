import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { PF_BOOK_COPY } from './ProfileManager';

describe('weekly digest return target', () => {
  it('renders the fragment anchor before the asynchronous session panel', async () => {
    const source = await readFile(new URL('./ProfileManager.tsx', import.meta.url), 'utf8');
    expect(source).toMatch(
      /<div id="weekly-digest">\s*\{session && locale !== 'ru' && weeklyDigestSignupEnabled\(\) && \(/u,
    );
    expect(source).not.toContain('class="pf-digest-panel" id="weekly-digest"');
  });

  it('hides the opt-in checkbox until the public digest flag is on', async () => {
    const source = await readFile(new URL('./ProfileManager.tsx', import.meta.url), 'utf8');
    expect(source).toContain("import { weeklyDigestSignupEnabled } from '../lib/weekly-digest/feature-flags'");
  });
});

describe('Russian profile failure copy', () => {
  it('does not expose provider or English daily-lifecycle errors', async () => {
    const source = await readFile(new URL('./ProfileManager.tsx', import.meta.url), 'utf8');
    expect(source).toContain("locale === 'ru' ? t(locale, 'syncFailed') : result.message");
    expect(source).toMatch(/setSyncMessage\(locale === 'ru'\s*\? t\(locale, 'syncFailed'\)/u);
    expect(source).toMatch(/setDailyMessage\(locale === 'ru'\s*\? t\(locale, 'syncFailed'\)/u);
  });
});

describe('English profile chart count', () => {
  it('uses singular grammar for one saved chart', () => {
    expect(PF_BOOK_COPY.en.count(1)).toBe('1 birth chart saved.');
  });

  it('keeps the existing plural explanation for multiple saved charts', () => {
    expect(PF_BOOK_COPY.en.count(2)).toBe(
      '2 birth charts saved — yours and the people you read for.',
    );
  });
});

describe('Spanish profile chart count', () => {
  it('uses singular grammar for one saved chart', () => {
    expect(PF_BOOK_COPY.es.count(1)).toBe('1 carta natal guardada.');
  });

  it('keeps the existing plural explanation for multiple saved charts', () => {
    expect(PF_BOOK_COPY.es.count(2)).toBe(
      '2 cartas natales guardadas: la tuya y las de las personas para quienes haces lecturas.',
    );
  });
});

describe('Brazilian Portuguese profile chart count', () => {
  it('uses singular grammar for one saved chart', () => {
    expect(PF_BOOK_COPY.pt.count(1)).toBe('1 mapa astral salvo.');
  });

  it('uses plural grammar for multiple saved charts', () => {
    expect(PF_BOOK_COPY.pt.count(2)).toBe(
      '2 mapas astrais salvos: o seu e os das pessoas para quem você faz leituras.',
    );
  });
});

describe('French profile chart count', () => {
  it('uses singular grammar for one saved chart', () => {
    expect(PF_BOOK_COPY.fr.count(1)).toBe('1 thème astral enregistré.');
  });

  it('uses plural grammar for multiple saved charts', () => {
    expect(PF_BOOK_COPY.fr.count(2)).toBe(
      '2 thèmes astraux enregistrés : le tien et ceux que tu interprètes pour d’autres personnes.',
    );
  });
});

describe('Italian profile chart count', () => {
  it('uses singular grammar for one saved chart', () => {
    expect(PF_BOOK_COPY.it.count(1)).toBe('1 tema natale salvato.');
  });

  it('uses plural grammar for multiple saved charts', () => {
    expect(PF_BOOK_COPY.it.count(2)).toBe(
      '2 temi natali salvati: il tuo e quelli che interpreti per altre persone.',
    );
  });
});
