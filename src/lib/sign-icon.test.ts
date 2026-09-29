import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * Which sign pictures a page fetches must not follow the chart on it, or the
 * file requests alone give our host the chart's Sun, Moon and rising signs
 * (audit finding F-18). signIcon (lib/sign-icon.ts) asks for all twelve pictures
 * of a size in zodiac order the first time any is rendered; the browser test
 * tests/sign-icon-requests-drive.mjs compares the requests of two real charts.
 */
function recordImageRequests(): string[] {
  const requested: string[] = [];
  vi.stubGlobal('Image', class {
    set src(value: string) {
      requested.push(value);
    }
  });
  return requested;
}

async function requestsFor(slugs: readonly string[]): Promise<string[]> {
  vi.resetModules();
  const requested = recordImageRequests();
  const { signIcon } = await import('./sign-icon');
  for (const slug of slugs) {
    expect(signIcon(48, slug)).toBe(`/assets/zodiac-icons/48/${slug}.webp`);
    expect(signIcon(128, slug)).toBe(`/assets/zodiac-icons/128/${slug}.webp`);
  }
  return requested;
}

describe('signIcon', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('asks for all twelve WebP pictures of a size, in zodiac order, the first time one is shown', async () => {
    const { SIGNS } = await import('./signs');
    const requested = await requestsFor(['scorpio']);
    expect(requested).toEqual([
      ...SIGNS.map(({ slug }) => `/assets/zodiac-icons/48/${slug}.webp`),
      ...SIGNS.map(({ slug }) => `/assets/zodiac-icons/128/${slug}.webp`),
    ]);
  });

  it('gives two different charts the same requests', async () => {
    // Two Big Threes with no sign in common: the audit's Tucson 1955 chart
    // (Scorpio Sun, Cancer Moon, Libra rising) and another.
    const first = await requestsFor(['scorpio', 'cancer', 'libra']);
    const second = await requestsFor(['pisces', 'aquarius', 'virgo']);
    expect(second).toEqual(first);
    expect(first).toHaveLength(24);
    expect(first.some((path) => path.endsWith('.avif'))).toBe(false);
  });

  it('asks once per size for the life of the page', async () => {
    vi.resetModules();
    const requested = recordImageRequests();
    const { signIcon } = await import('./sign-icon');
    for (const slug of ['leo', 'leo', 'aries', 'pisces']) signIcon(128, slug);
    expect(requested).toHaveLength(12);
    expect(requested.every((path) => path.startsWith('/assets/zodiac-icons/128/'))).toBe(true);
  });

  it('only names the picture where there is no browser to fetch it', async () => {
    const { signIcon } = await import('./sign-icon');
    expect(typeof Image).toBe('undefined');
    expect(signIcon(128, 'leo')).toBe('/assets/zodiac-icons/128/leo.webp');
  });
});

/**
 * Every island or library file that makes a sign picture's address from a
 * slug, and why its requests cannot follow a chart. A chart's sign goes
 * through signIcon; a new file fails here until someone decides and lists it.
 */
const LISTED: Record<string, string> = {
  'src/lib/sign-icon.ts': 'signIcon itself',
  'src/islands/BigThreeQuick.tsx': 'asks for all twelve discs itself (requestAllDiscs) before it sets its result',
  'src/lib/share-card.ts': 'card discs come from allDiscs, all twelve in zodiac order',
  'src/lib/compatibility-card.ts': 'loads all twelve discs in zodiac order',
  'src/lib/lunar-return-card.ts': 'embeds all twelve discs in zodiac order',
  'src/lib/share-card-pastel-icons.ts': 'embeds all twelve discs in zodiac order',
  'src/lib/wheel/Wheel.tsx': 'draws all twelve discs in zodiac order',
  'src/lib/wheel/TechnicalWheel.tsx': 'draws all twelve discs in zodiac order',
  'src/islands/MiniBirthChartWidget.tsx': 'its header shows all twelve; the result uses signIcon',
  'src/islands/PwaInstallPrompt.tsx': 'shows all twelve',
  'src/islands/TodayBySign.tsx': 'shows all twelve',
  'src/islands/ZodiacWheelHero.tsx': 'shows all twelve',
  'src/islands/today/SunSignFallback.tsx': 'the picker shows all twelve before any choice',
  'src/islands/PrefilledPairNotice.tsx': 'the two signs come from the page address, which the host already has',
  'src/islands/RaceBoard.tsx': 'the race standings; a player’s team is sent to the game anyway',
  'src/lib/games/share-card.ts': 'the race card: all twelve, and the team the game already has',
  'src/lib/search/open-search.ts': 'results for words typed into search, not a chart',
  'src/lib/daily-email/content.ts': 'an email built on the server, which already has the subscriber’s sign',
  'src/lib/email/daily-page.ts': 'a page built on the server, which already has the sign',
  'src/lib/email/server-page.ts': 'a page built on the server, which already has the sign',
  'src/lib/email/template.ts': 'an email built on the server, which already has the sign',
  'src/islands/WalletChart.tsx': 'Registry wing: a wallet’s chart from public chain data',
  'src/islands/aura/AlignmentGrid.tsx': 'Registry wing',
  'src/islands/aura/AuraTalisman.tsx': 'Registry wing',
  'src/islands/aura/ZodiacMedallion.tsx': 'Registry wing',
  'src/lib/aura-share-card.ts': 'Registry wing',
  'src/lib/wallet/share-card.ts': 'Registry wing',
  'src/lib/registry-aura-entry.mjs': 'Registry wing',
};

const root = resolve(process.cwd());

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

describe('sign pictures made from a slug', () => {
  it('are listed, each with why its requests cannot follow a chart', () => {
    const making = ['src/islands', 'src/components', 'src/lib']
      .flatMap((directory) => walk(resolve(root, directory)))
      .filter((path) => /\.(?:ts|tsx|mjs|js|jsx)$/u.test(path) && !/\.(?:test|spec)\./u.test(path))
      .map((path) => relative(root, path).split(sep).join('/'))
      .filter((path) => /\/assets\/zodiac-icons\/(?:\d+|\$\{[^}]*\})\/\$\{/u
        .test(readFileSync(resolve(root, path), 'utf8')))
      .sort();
    expect(making).toEqual(Object.keys(LISTED).sort());
  });
});
