/**
 * Short videos of the sky's coming events (TikTok, Reels, Shorts): one
 * vertical 1080 x 1920 MP4 per published event page, drawn by the same page
 * and end card as the daily horoscope videos (scripts/build-daily-shorts.mjs),
 * with the art of the event's sign, the event's name, its UTC day, the page's
 * own summary and the time the page prints. Each video gets a caption file
 * for posting by hand.
 *
 *   npm run data:event-shorts                                  the next 31 days
 *   npm run data:event-shorts -- --from 2027-07-01 --days 60   another span
 *   npm run data:event-shorts -- --only eclipse-2027-07-18     some events, by page id
 *
 * Writes dist-shorts/events/{id}.mp4, {id}.txt (the caption), {id}-cover.png
 * and manifest.json. dist-shorts/ is git-ignored; this script posts nothing
 * anywhere. The words come from scripts/event-shorts-lib.ts.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SHORTS, renderShort, shortsBrowser, shortsEndCard, shortsFonts } from './build-daily-shorts.mjs';
import { eventShorts } from './event-shorts-lib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function buildEventShorts({ from, days, only, outRoot = SHORTS.outDir, concurrency = 3 }: {
  from?: string; days?: number; only?: string[]; outRoot?: string; concurrency?: number;
} = {}) {
  const shorts = eventShorts({ from, days, only });
  if (!shorts.length) throw new Error('No published event falls in that span');
  const endCard = await shortsEndCard();
  const out = resolve(root, outRoot, 'events');
  await mkdir(out, { recursive: true });
  const fonts = await shortsFonts();
  const browser = await shortsBrowser();
  const results: Record<string, unknown>[] = [];
  try {
    const queue = [...shorts];
    const worker = async () => {
      for (let short = queue.shift(); short; short = queue.shift()) {
        const started = Date.now();
        const result = await renderShort({ browser, fonts, out, endCard, short });
        results.push({ id: short.id, page: `https://zodiacs.org${short.path}`, at: short.at, ...result });
        console.log(`  ${short.id}: ${result.seconds}s (${((Date.now() - started) / 1000).toFixed(0)}s to render)`);
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  } finally {
    await browser.close();
  }
  const order = shorts.map((short) => short.id);
  results.sort((a, b) => order.indexOf(a.id as string) - order.indexOf(b.id as string));
  await writeFile(join(out, 'manifest.json'), `${JSON.stringify({
    source: 'src/data/events-publication.json',
    note: 'Built for posting by hand. Nothing here has been posted.',
    videos: results,
  }, null, 2)}\n`);
  return { out, results };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      from: { type: 'string' },
      days: { type: 'string' },
      only: { type: 'string' },
      out: { type: 'string' },
      concurrency: { type: 'string' },
    },
  });
  const { out, results } = await buildEventShorts({
    from: values.from,
    days: values.days ? Number(values.days) : undefined,
    only: values.only?.split(',').map((id) => id.trim()).filter(Boolean),
    outRoot: values.out,
    concurrency: values.concurrency ? Number(values.concurrency) : undefined,
  });
  console.log(`Event shorts: ${results.length} videos with captions in ${out}`);
}
