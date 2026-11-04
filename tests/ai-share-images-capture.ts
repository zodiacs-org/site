/**
 * The share images (a compatibility score, a date's rating, a birthday, the
 * sky calendar's next event, a horoscope for a day, a month or a year, chart
 * twins, a famous chart, a life milestone, the big three, the Chinese zodiac
 * and an invitation to compare charts) and their 1080×1920 story
 * pictures, rendered locally from share queries like the ones the cards'
 * share links carry, those with a forecast or a score with their reading
 * confidence. Manual, for before-and-after review; no network.
 *
 *   npx vite-node --script tests/ai-share-images-capture.ts -- --out <dir>
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  handleBirthdayImageRequest, handleCompatibilityImageRequest, handleHoroscopeImageRequest, handleOccasionImageRequest, handleSkyCalendarImageRequest,
  handleBirthdayStoryRequest, handleCompatibilityStoryRequest, handleHoroscopeStoryRequest, handleOccasionStoryRequest, handleSkyCalendarStoryRequest,
  handleChartTwinsImageRequest, handleFamousChartImageRequest, handleMilestoneImageRequest,
  handleChartTwinsStoryRequest, handleFamousChartStoryRequest, handleMilestoneStoryRequest,
  handleBigThreeImageRequest, handleChineseZodiacImageRequest, handleInviteImageRequest,
  handleBigThreeStoryRequest, handleChineseZodiacStoryRequest, handleInviteStoryRequest,
} from '../src/server/result-preview';

// The horoscope is the published reading for the window's own date.
const { generatedFor } = JSON.parse(await readFile(new URL('../src/data/horoscope-window.json', import.meta.url), 'utf8')) as { generatedFor: string };

const argv = process.argv.slice(2);
const out = argv[argv.indexOf('--out') + 1];
if (!out || argv.indexOf('--out') < 0) throw new Error('Give --out <dir> for the images.');
const IMAGES: [string, (request: Request) => Promise<Response>, string][] = [
  ['share-compatibility', handleCompatibilityImageRequest, '/api/og/compatibility-image?a=Ana&as=taurus&b=Luis&bs=leo&score=60&attraction=70&communication=57&stability=52&v=good'],
  ['share-compatibility-unnamed', handleCompatibilityImageRequest, '/api/og/compatibility-image?as=aquarius&bs=cancer&score=58&attraction=61&communication=55&stability=49&v=good'],
  ['share-occasion', handleOccasionImageRequest, '/api/og/occasion-image?o=wedding&d=2027-06-12&n=Ana+%26+Luis&p=Florence%2C+Italy&sun=gemini&moon=libra&score=69&v=good'],
  ['share-occasion-plain', handleOccasionImageRequest, '/api/og/occasion-image?o=birthday&d=2026-10-23&sun=libra&moon=aries&score=74&v=good'],
  ['share-birthday', handleBirthdayImageRequest, '/api/og/birthday-image?d=05-03'],
  ['share-birthday-cusp', handleBirthdayImageRequest, '/api/og/birthday-image?d=04-20'],
  ['share-birthday-famous', handleBirthdayImageRequest, '/api/og/birthday-image?d=05-04'],
  ['share-sky-calendar', handleSkyCalendarImageRequest, '/api/og/sky-calendar-image?k=retrograde&b=mercury&d=2026-10-24'],
  ['share-horoscope', handleHoroscopeImageRequest, `/api/og/horoscope-image?s=leo&d=${generatedFor}`],
  ['story-compatibility', handleCompatibilityStoryRequest, '/api/og/compatibility-story?a=Ana&as=taurus&b=Luis&bs=leo&score=60&attraction=70&communication=57&stability=52&v=good'],
  ['story-occasion', handleOccasionStoryRequest, '/api/og/occasion-story?o=wedding&d=2027-06-12&n=Ana+%26+Luis&p=Florence%2C+Italy&sun=gemini&moon=libra&score=69&v=good'],
  ['story-birthday', handleBirthdayStoryRequest, '/api/og/birthday-story?d=05-03'],
  ['story-birthday-cusp', handleBirthdayStoryRequest, '/api/og/birthday-story?d=04-20'],
  ['story-sky-calendar', handleSkyCalendarStoryRequest, '/api/og/sky-calendar-story?k=retrograde&b=mercury&d=2026-10-24'],
  ['story-horoscope', handleHoroscopeStoryRequest, `/api/og/horoscope-story?s=leo&d=${generatedFor}`],
  ['share-chart-twins', handleChartTwinsImageRequest, '/api/og/chart-twins-image?s=taurus&m=leo'],
  ['share-famous-chart', handleFamousChartImageRequest, '/api/og/famous-chart-image?p=frida-kahlo'],
  ['share-milestone', handleMilestoneImageRequest, '/api/og/milestone-image?k=saturn-return&i=1&a=29&f=2026-04-23&l=2026-12-31'],
  ['story-chart-twins', handleChartTwinsStoryRequest, '/api/og/chart-twins-story?s=taurus&m=leo'],
  ['story-famous-chart', handleFamousChartStoryRequest, '/api/og/famous-chart-story?p=frida-kahlo'],
  ['story-milestone', handleMilestoneStoryRequest, '/api/og/milestone-story?k=saturn-return&i=1&a=29&f=2026-04-23&l=2026-12-31'],
  ['share-compatibility-confidence', handleCompatibilityImageRequest, '/api/og/compatibility-image?as=aquarius&bs=cancer&score=58&attraction=61&communication=55&stability=49&v=good&c=70'],
  ['share-occasion-confidence', handleOccasionImageRequest, '/api/og/occasion-image?o=wedding&d=2027-06-12&sun=gemini&moon=libra&score=69&v=good&c=70'],
  ['share-horoscope-month', handleHoroscopeImageRequest, `/api/og/horoscope-image?s=leo&m=${generatedFor.slice(0, 7)}`],
  ['share-horoscope-year', handleHoroscopeImageRequest, `/api/og/horoscope-image?s=aquarius&y=${generatedFor.slice(0, 4)}`],
  ['share-big-three', handleBigThreeImageRequest, '/api/og/big-three-image?s=leo&m=aries&r=libra'],
  ['share-big-three-untimed', handleBigThreeImageRequest, '/api/og/big-three-image?s=sagittarius'],
  ['share-chinese-zodiac-horse', handleChineseZodiacImageRequest, '/api/og/chinese-zodiac-image?a=horse'],
  ['share-chinese-zodiac-rooster', handleChineseZodiacImageRequest, '/api/og/chinese-zodiac-image?a=rooster'],
  ['share-invite', handleInviteImageRequest, '/api/og/invite-image?s=taurus&p=scorpio'],
  ['story-compatibility-confidence', handleCompatibilityStoryRequest, '/api/og/compatibility-story?as=aquarius&bs=cancer&score=58&attraction=61&communication=55&stability=49&v=good&c=70'],
  ['story-horoscope-month', handleHoroscopeStoryRequest, `/api/og/horoscope-story?s=leo&m=${generatedFor.slice(0, 7)}`],
  ['story-big-three', handleBigThreeStoryRequest, '/api/og/big-three-story?s=leo&m=aries&r=libra'],
  ['story-chinese-zodiac', handleChineseZodiacStoryRequest, '/api/og/chinese-zodiac-story?a=tiger'],
  ['story-invite', handleInviteStoryRequest, '/api/og/invite-story?s=taurus&p=scorpio'],
];
await mkdir(resolve(out), { recursive: true });
for (const [name, handle, path] of IMAGES) {
  const response = await handle(new Request(`https://zodiacs.org${path}`));
  if (response.status !== 200) throw new Error(`${name}: ${response.status}`);
  await writeFile(resolve(out, `${name}.jpg`), Buffer.from(await response.arrayBuffer()));
}
console.log(`Rendered ${IMAGES.length} share images and story pictures in ${out}.`);
