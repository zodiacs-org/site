/** Report worst pairwise similarity over an explicit historical date range. */
import '../src/lib/engine/server-de440.mjs';
import {
  DAILY_EDITORIAL_CONSTITUTION,
  buildDailyPublication,
  wordShingleJaccard,
} from '../src/lib/daily-publication';
import { REPO_ROOT } from './daily-publication-files';
import { computeDailySnapshot } from './daily-snapshot-lib.mjs';
import type { Daily } from '../src/lib/daily';

function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}
const from = option('--from', '2026-06-20');
const through = option('--through', '2026-08-31');
const start = new Date(`${from}T00:00:00.000Z`);
const end = new Date(`${through}T00:00:00.000Z`);
if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
  throw new Error('Use a real --from/--through YYYY-MM-DD range');
}

type Maximum = { score: number; date: string; pair: string; leftText: string; rightText: string };
const maxima: Record<'headline' | 'today' | 'reading', Maximum> = {
  headline: { score: 0, date: '', pair: '', leftText: '', rightText: '' },
  today: { score: 0, date: '', pair: '', leftText: '', rightText: '' },
  reading: { score: 0, date: '', pair: '', leftText: '', rightText: '' },
};
for (let time = start.getTime(); time <= end.getTime(); time += 86_400_000) {
  const date = new Date(time).toISOString().slice(0, 10);
  const facts = await computeDailySnapshot(date, REPO_ROOT) as Daily;
  const publication = buildDailyPublication(facts);
  for (let left = 0; left < publication.signs.length; left += 1) {
    for (let right = left + 1; right < publication.signs.length; right += 1) {
      const l = publication.signs[left];
      const r = publication.signs[right];
      const texts = {
        headline: [l.headline, r.headline],
        today: [l.todayLine.text, r.todayLine.text],
        reading: [
          l.lines.filter((line) => line.scope === 'solar-house').map((line) => line.text).join(' '),
          r.lines.filter((line) => line.scope === 'solar-house').map((line) => line.text).join(' '),
        ],
      };
      for (const surface of Object.keys(texts) as Array<keyof typeof texts>) {
        const score = wordShingleJaccard(
          texts[surface][0], texts[surface][1], DAILY_EDITORIAL_CONSTITUTION.distinctness.shingleWords,
        );
        if (score > maxima[surface].score) {
          maxima[surface] = {
            score,
            date,
            pair: `${l.sign}/${r.sign}`,
            leftText: texts[surface][0],
            rightText: texts[surface][1],
          };
        }
      }
    }
  }
}
console.log(JSON.stringify({ from, through, maxima }, null, 2));
