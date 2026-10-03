import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const distRoot = resolve(process.cwd(), 'dist');

function htmlFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith('.html') ? [path] : [];
  });
}

describe.skipIf(!existsSync(distRoot))('built client UI payloads', () => {
  it('offers Guide quick prompts as plain links on every horoscope surface', () => {
    const surfaces = [
      'today/index.html',
      'horoscopes/index.html',
      'horoscopes/aries/index.html',
      'horoscopes/aries/tomorrow/index.html',
      'horoscopes/aries/weekly/index.html',
      'horoscopes/aries/monthly/index.html',
      'horoscopes/aries/love/index.html',
      'horoscopes/aries/career/index.html',
      'horoscopes/aries/2027/index.html',
    ];
    for (const path of surfaces) {
      const html = readFileSync(join(distRoot, path), 'utf8');
      const chips = [...html.matchAll(/<a\b[^>]*data-assistant-prompt="([^"]*)"[^>]*>/g)];
      expect(chips.length, path).toBeGreaterThanOrEqual(3);
      for (const [tag, prompt] of chips) {
        expect(tag, path).toContain('href="/ask/"');
        expect(tag, path).toContain('data-assistant-open');
        expect(prompt.length, `${path}: ${prompt}`).toBeLessThanOrEqual(120);
        expect(prompt, path).toMatch(/\?$/);
      }
    }
  });

  it('inlines CSS only on the latency-sensitive Phase 1 entry pages', () => {
    const criticalPaths = [
      'today/index.html',
      ...[
        'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
        'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
      ].map((sign) => `horoscopes/${sign}/index.html`),
    ];

    for (const path of criticalPaths) {
      const html = readFileSync(join(distRoot, path), 'utf8');
      expect(html, path).toContain('<style data-zdx-critical=');
      expect(html, path).not.toMatch(/<link\b[^>]*\brel=["']stylesheet["']/i);
      expect(html, path).not.toContain('data-inline-critical-css');
    }

    const tomorrow = readFileSync(
      join(distRoot, 'horoscopes', 'aries', 'tomorrow', 'index.html'),
      'utf8',
    );
    expect(tomorrow).toMatch(/<link\b[^>]*\brel=["']stylesheet["']/i);
    expect(tomorrow).not.toContain('<style data-zdx-critical=');

    const russianBirthChart = readFileSync(
      join(distRoot, 'ru', 'birth-chart', 'index.html'),
      'utf8',
    );
    expect(russianBirthChart.match(/<style\b[^>]*\bdata-zdx-critical=/gi)).toHaveLength(1);
    expect(russianBirthChart).toMatch(/data-zdx-critical=["']Base\.[^"']+\.css["']/i);
    expect(russianBirthChart).toContain('data-zdx-calculator-first-paint');
    expect(russianBirthChart.match(/<template data-zdx-deferred-style>/gi)).toHaveLength(3);
    expect(russianBirthChart.match(/<noscript><link\b[^>]*\brel=["']stylesheet["']/gi)).toHaveLength(3);
    expect(russianBirthChart).toContain('data-zdx-deferred-style-loader');
    expect(russianBirthChart).not.toMatch(/\bonload=/i);
    expect(russianBirthChart).toContain('client="interaction"');
    expect(russianBirthChart).not.toContain('client="idle"');
    expect(russianBirthChart).not.toContain('data-inline-critical-css');
    expect(russianBirthChart).toContain('data-local-typography');
    expect(russianBirthChart).toContain('data-local-chrome-typography');
    expect(russianBirthChart).not.toMatch(/<link\b[^>]*\brel=["']preload["'][^>]*\/fonts\/(?:golos-text|eb-garamond-cyrillic)/i);

    const horoscopeHub = readFileSync(join(distRoot, 'horoscopes', 'index.html'), 'utf8');
    expect(horoscopeHub).toContain('data-local-typography');
    expect(horoscopeHub).not.toContain('data-local-chrome-typography');
    expect(horoscopeHub).toMatch(/<link\b[^>]*\brel=["']preload["'][^>]*\/fonts\/(?:instrument-sans|eb-garamond-latin)/i);

    const peopleDirectory = readFileSync(join(distRoot, 'people', 'index.html'), 'utf8');
    expect(peopleDirectory).toContain('data-local-typography');
    expect(peopleDirectory).not.toContain('data-local-chrome-typography');
    expect(peopleDirectory).toMatch(/<link\b[^>]*\brel=["']preload["'][^>]*\/fonts\/eb-garamond-latin-400-normal\.woff2/i);
    expect(peopleDirectory).not.toMatch(/<link\b[^>]*\brel=["']preload["'][^>]*\/fonts\/(?:instrument-sans|eb-garamond-latin-500)/i);
  });

  it('installs one locale catalog before every island that uses shared UI copy', () => {
    const hydratedPages = htmlFiles(distRoot)
      .map((path) => ({ path, html: readFileSync(path, 'utf8') }))
      .filter(({ html }) => html.includes('<astro-island'));

    expect(hydratedPages.length).toBeGreaterThan(0);
    for (const { path, html } of hydratedPages) {
      const installs = html.match(/globalThis\.__ZDX_UI__/g) ?? [];
      const relativePath = relative(distRoot, path);
      const ownsItsCopy = relativePath === 'today/index.html'
        || /^horoscopes\/[^/]+\/index\.html$/.test(relativePath);
      if (html.includes('data-standalone-widget') || ownsItsCopy) {
        expect(installs, relative(distRoot, path)).toHaveLength(0);
        continue;
      }
      expect(installs, relative(distRoot, path)).toHaveLength(1);
    }
  }, 15000);

  it('embeds the selected Portuguese catalog on a hydrated Portuguese page', () => {
    const html = readFileSync(join(distRoot, 'pt', 'birth-chart', 'index.html'), 'utf8');

    expect(html).toContain('globalThis.__ZDX_UI__');
    expect(html).toContain('"navCollect":"Astrofolio"');
    expect(html).toContain('"birthChart":"Mapa astral"');
  });

  it('embeds the selected French catalog on a hydrated French page', () => {
    const html = readFileSync(join(distRoot, 'fr', 'birth-chart', 'index.html'), 'utf8');

    expect(html).toContain('globalThis.__ZDX_UI__');
    expect(html).toContain('"navCollect":"Astrofolio"');
    expect(html).toContain('"birthChart":"Thème astral"');
  });

  it('embeds the selected Italian catalog on a hydrated Italian page', () => {
    const html = readFileSync(join(distRoot, 'it', 'birth-chart', 'index.html'), 'utf8');

    expect(html).toContain('globalThis.__ZDX_UI__');
    expect(html).toContain('"navCollect":"Astrofolio"');
    expect(html).toContain('"birthChart":"Tema natale"');
  });

  it.each(['aries/index.html', 'es/aries/index.html', 'pt/aries/index.html', 'fr/aries/index.html', 'it/aries/index.html'])(
    'keeps the zero-JS guide %s free of client catalog payloads',
    (path) => {
      const html = readFileSync(join(distRoot, path), 'utf8');

      expect(html).not.toContain('<astro-island');
      expect(html).not.toContain('globalThis.__ZDX_UI__');
    },
  );
});
