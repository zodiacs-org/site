import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

describe('growth link graph', () => {
  it('keeps sign guides linked to horoscope periods and the profile capture', async () => {
    const [guide, horoscopeBand, profileHook, profilePage] = await Promise.all([
      source('../pages/[sign]/index.astro'),
      source('../components/GuideHoroscopeBand.astro'),
      source('../components/GuideProfileHook.astro'),
      source('../pages/profile/index.astro'),
    ]);

    expect(guide).toContain('<GuideHoroscopeBand signName={sign.name} slug={sign.slug} />');
    expect(guide).toContain('<GuideProfileHook signName={sign.name} slug={sign.slug} />');
    expect(horoscopeBand).toContain('href={`/horoscopes/${slug}/`}');
    expect(horoscopeBand).toContain('href={`/horoscopes/${slug}/weekly/`}');
    expect(horoscopeBand).toContain('href={`/horoscopes/${slug}/monthly/`}');
    expect(profileHook).toContain('href={`/profile/?sun=${slug}`}');
    expect(profilePage).toContain('<ProfileSunSignCapture client:load />');
  });

  it('keeps horoscope programs linked back to their full sign guide', async () => {
    const program = await source('../components/HoroscopeProgramPage.astro');
    expect(program).toContain('<a class="hz-guide" href={`/${sign.slug}/`}>');
    expect(program).toContain('Full {sign.name} guide <span class="arr">→</span>');
  });

  it('links published calendar rows while preserving their stable anchor IDs', async () => {
    const [fullMoons, eclipses] = await Promise.all([
      source('../pages/full-moon-calendar/index.astro'),
      source('../pages/eclipses/index.astro'),
    ]);

    expect(fullMoons).toContain('path: publishedEventById.get(id)?.path ?? null');
    expect(fullMoons).toContain('<tr id={f.id}');
    expect(fullMoons).toContain('{f.path ? <a href={f.path}>{fmtDay(f.at)}</a> : fmtDay(f.at)}');

    expect(eclipses).toContain('const anchorId = `${publicationId}-${e.type}`;');
    expect(eclipses).toContain('path: publishedEventById.get(publicationId)?.path ?? null');
    expect(eclipses).toContain('<tr id={e.anchorId}');
    expect(eclipses).toContain('{e.path ? <a href={e.path}>{fmtDay(e.at)}</a> : fmtDay(e.at)}');
  });

  it('links chart-story and deep-read Moon placements into the library', async () => {
    const [readingPath, approach, communication] = await Promise.all([
      source('../islands/explorer/ReadingPath.tsx'),
      source('../islands/ApproachRead.tsx'),
      source('../islands/CommunicationRead.tsx'),
    ]);

    expect(readingPath).toContain('href={`/learn/placements/moon-in-${slug}/`}');
    expect(approach).toContain('href={`/learn/placements/moon-in-${slug}/`}');
    expect(communication).toContain('href={`/learn/placements/moon-in-${slug}/`}');
  });

  it('sends the Spanish hero to the localized calculator', async () => {
    const homepage = await source('../pages/es/index.astro');
    expect(homepage).toContain("href={localizePath('es', '/birth-chart/')}");
    expect(homepage).toContain('Obtén tu carta natal gratis');
    expect(homepage).not.toContain('por ahora en inglés');
  });
});
