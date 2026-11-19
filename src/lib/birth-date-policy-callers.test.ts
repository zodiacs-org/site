import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Every form that builds a person's chart from a birth date refuses a date
 * less than 13 years ago, or one still to come, through one shared policy
 * (src/lib/birth-date-policy.ts; the 9 November 2026 audit, Decision C).
 * This holds each island to importing birthDateRefusal from it, so a new
 * entry path cannot quietly skip the check.
 *
 * The four localized "Your 2027 sky" islands (YearSkyEs, YearSkyFr,
 * YearSkyIt, YearSkyPt) only register their words and re-export YearSky, so
 * they are held to that re-export instead.
 */
const ISLANDS = [
  'ChartCalculator',
  'BigThreeQuick',
  'SomeoneElseChart',
  'SynastryCalculator',
  'synastry/InviteExperience',
  'synastry/SendBackExperience',
  'PrivateCompatibilityInvite',
  'TransitTracker',
  'SolarReturnCalculator',
  'LunarReturnCalculator',
  'SaturnReturnCalculator',
  'NumerologyCalculator',
  'ChartTwins',
  'LifeMilestones',
  'GroupCharts',
  'PersonalCalendar',
  'ReturnPersonal',
  'YearSky',
  'MiniBirthChartWidget',
] as const;

const YEAR_SKY_TWINS = ['YearSkyEs', 'YearSkyFr', 'YearSkyIt', 'YearSkyPt'] as const;

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const island = (name: string) => read(`islands/${name}.tsx`);
const POLICY_IMPORT = /import\s*\{[^}]*\bbirthDateRefusal\b[^}]*\}\s*from\s*'(?:\.\.\/)+lib\/birth-date-policy'/u;

describe('the birth date policy reaches every chart form', () => {
  it.each(ISLANDS)('%s imports birthDateRefusal from the shared policy', (name) => {
    expect(island(name)).toMatch(POLICY_IMPORT);
  });

  // SharingBirthForm is the shared fields component and computes nothing; the
  // check lives in each island that submits it (and in calculateEntry).
  it('holds every island that uses SharingBirthForm to the policy', () => {
    const users = readdirSync(new URL('../islands/', import.meta.url))
      .filter((file) => file.endsWith('.tsx') && file !== 'SharingBirthForm.tsx')
      .filter((file) => /from '\.\/SharingBirthForm'/u.test(island(file.slice(0, -4))));
    expect(users.length).toBeGreaterThan(0);
    for (const file of users) expect(island(file.slice(0, -4)), file).toMatch(POLICY_IMPORT);
  });

  it.each(YEAR_SKY_TWINS)('%s is the shared YearSky island with its own words', (name) => {
    const source = island(name);
    expect(source).toMatch(/export \{ default \} from '\.\/YearSky';/u);
    expect(source).not.toMatch(/useState|calculateEntry/u);
  });

  it('checks the converted Gregorian date in the shared chart entry before any engine work', () => {
    const entry = read('lib/sharing/chart-entry.ts');
    expect(entry).toMatch(/import \{[^}]*\bbirthDateRefusal\b[^}]*\} from '\.\.\/birth-date-policy'/u);
    const refusal = entry.indexOf('birthDateRefusal(civil.date)');
    expect(refusal).toBeGreaterThan(entry.indexOf("birthDateForChart(locale, entry.date, entry.calendar)"));
    expect(refusal).toBeLessThan(entry.indexOf('prepareLocalTime('));
    expect(refusal).toBeLessThan(entry.indexOf('engine.computeChart('));
  });

  it('leaves the Moon phase lookup exempt (a date-only sky reader)', () => {
    expect(island('MoonPhaseTool')).not.toMatch(/birth-date-policy|birthDateRefusal/u);
  });

  it('keeps the two sentences byte for byte as the audit wrote them', () => {
    const policy = read('lib/birth-date-policy.ts');
    expect(policy).toContain("\"Zodiacs is for people 13 and over, so it doesn't read charts for birth dates less than 13 years ago.\"");
    expect(policy).toContain("\"That birth date hasn't happened yet. Check the year and try again.\"");
  });
});
