/**
 * The month the localized monthly horoscopes cover: the same month the
 * English monthly pages publish (the latest non-draft MDX month no later than
 * the committed daily edition), read from the committed transit catalog.
 */
import dailyData from '../../../data/daily.json';
import { currentHoroscopeMonth, utcMonth } from '../../horoscope-month.mjs';
import { transitsFor } from '../../horoscopes';

// Raw text, read for the frontmatter only, so this works in Astro and in plain vite-node.
const monthFiles = import.meta.glob<string>('../../../content/horoscopes/*.mdx', {
  eager: true, query: '?raw', import: 'default',
});

/** The English monthly's own publication dates for a sign, so the localized page dates the same edition. */
export function monthDates(month: string, sign: string): { published: string; updated: string } {
  for (const [path, raw] of Object.entries(monthFiles)) {
    if (!path.endsWith(`/${month}-${sign}.mdx`)) continue;
    const front = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    const published = front.match(/^published:\s*"?(\d{4}-\d{2}-\d{2})"?\s*$/m)?.[1];
    const updated = front.match(/^updated:\s*"?(\d{4}-\d{2}-\d{2})"?\s*$/m)?.[1] ?? published;
    if (published && updated) return { published, updated };
  }
  throw new Error(`No monthly horoscope for ${sign} in ${month}`);
}

export function publishedHoroscopeMonths(): string[] {
  const months: string[] = [];
  for (const raw of Object.values(monthFiles)) {
    const front = raw.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    const month = front.match(/^month:\s*"?(\d{4}-\d{2})"?\s*$/m)?.[1];
    const draft = /^draft:\s*true\s*$/m.test(front);
    if (month && !draft) months.push(month);
  }
  return [...new Set(months)].sort();
}

export function expansionMonth() {
  const month = currentHoroscopeMonth(publishedHoroscopeMonths(), utcMonth((dailyData as { date: string }).date));
  if (!month) throw new Error('No published horoscope month');
  const transits = transitsFor(month);
  if (!transits) throw new Error(`No transit catalog for ${month}`);
  return { month, transits };
}
