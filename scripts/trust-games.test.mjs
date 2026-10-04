import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
describe('Games scoring explanation', () => {
  it('matches the deployed SQL weights and UTC weekly uniqueness', async () => {
    const sql = await read('supabase/migrations/20260817080000_zodiac_games.sql');
    expect(sql).toMatch(/join_points\s+constant\s+integer\s*:=\s*100/i);
    expect(sql).toMatch(/checkin_points\s+constant\s+integer\s*:=\s*25/i);
    expect(sql).toContain('iso_year, iso_week');
    const race = await read('src/pages/race/index.astro');
    expect(race).not.toContain('weekly check-ins, and shares');
    expect(race).toContain("t('en', 'trustGamesScore')");
    const ramp = await read('src/components/RaceRamp.astro');
    expect(ramp).toContain("t(locale, 'trustGamesScore')");
    // The operator disclosure lives in the footer and FAQ; the banner stays on scoring.
    expect(ramp).not.toContain('trustFreeAnswer');
    const footer = await read('src/components/SiteFooter.astro');
    expect(footer).toContain("t(locale, 'trustFreeAnswer')");
    for (const locale of ['en', 'es', 'pt', 'fr', 'it', 'ru']) {
      const catalog = await read(`src/lib/i18n/ui/${locale}.ts`);
      expect(catalog).toMatch(/trustGamesScore:.*100.*25/);
    }
  });
});
