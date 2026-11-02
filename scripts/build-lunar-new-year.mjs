/**
 * The Lunar New Year table the get_chinese_zodiac tool reads
 * (src/data/lunar-new-year.json): the Gregorian date of the first day of the
 * first month of the Chinese calendar for every year it covers.
 *
 * The rule is the modern (1645) Chinese calendar's, on China Standard Time
 * (UTC+8) from 1929 and Beijing mean time (116°25′E, UTC+7:45:40) before, as
 * the calendar itself reckoned dates: a month starts on the day of a new Moon; the eleventh month is the
 * one holding the winter solstice; the New Year is the second new Moon after
 * that month starts, or the third when a leap month falls between (a year
 * from one eleventh month to the next with thirteen months makes its first
 * month without a principal solar term, a multiple of 30° of the Sun's
 * longitude, the leap month). New Moons and solar terms come from
 * astronomy-engine, the ephemeris the site's engine uses, on the engine's ΔT
 * (scripts/lib/deltat-install.mjs). The result is held
 * to the published Lunar New Year dates (a 1900 to 2099 table) in
 * src/ai-tools/features/chinese-zodiac.test.ts.
 *
 * Usage: node scripts/build-lunar-new-year.mjs [--check]
 */
import './lib/deltat-install.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { SearchMoonPhase, SearchSunLongitude, MakeTime } from 'astronomy-engine';

export const FROM_YEAR = 1900;
export const TO_YEAR = 2101;
const OUT = new URL('../src/data/lunar-new-year.json', import.meta.url);
const DAY = 86_400_000;
const CST = 8 * 3_600_000;
/** Beijing mean time, which the calendar used until 1929. */
const BEIJING_MEAN = (7 * 3600 + 45 * 60 + 40) * 1000;
const CST_FROM = Date.UTC(1929, 0, 1);

/** The calendar date in China Standard Time (Beijing mean time before 1929) of an instant. */
const cstDate = (date) => new Date(date.getTime() + (date.getTime() < CST_FROM ? BEIJING_MEAN : CST)).toISOString().slice(0, 10);

/** Every new Moon from about a month before `from` to `to`. */
function newMoons(from, to) {
  const out = [];
  let cursor = new Date(from.getTime() - 35 * DAY);
  while (cursor < to) {
    const found = SearchMoonPhase(0, MakeTime(cursor), 40);
    if (!found) throw new Error(`No new Moon after ${cursor.toISOString()}`);
    out.push(found.date);
    cursor = new Date(found.date.getTime() + DAY);
  }
  return out;
}

/** The instant the Sun reaches `longitude` after `from`. */
function sunAt(longitude, from) {
  const found = SearchSunLongitude(longitude, MakeTime(from), 400);
  if (!found) throw new Error(`No solar longitude ${longitude} after ${from.toISOString()}`);
  return found.date;
}

/** The start (CST date) of the month holding `day`: the last new Moon on or before it. */
function monthStartOn(day, moonDays) {
  let start = null;
  for (const moon of moonDays) if (moon <= day) start = moon;
  if (!start) throw new Error(`No new Moon on or before ${day}`);
  return start;
}

export function lunarNewYear(year) {
  const solstice = (y) => sunAt(270, new Date(Date.UTC(y, 11, 1)));
  const before = solstice(year - 1);
  const after = solstice(year);
  const moonDays = newMoons(before, new Date(after.getTime() + 40 * DAY)).map(cstDate);
  const eleventh = monthStartOn(cstDate(before), moonDays);
  const nextEleventh = monthStartOn(cstDate(after), moonDays);
  const months = moonDays.filter((day) => day >= eleventh && day <= nextEleventh);
  // months holds both eleventh months: 13 entries for 12 months, 14 for a leap year.
  const monthCount = months.length - 1;
  if (monthCount !== 12 && monthCount !== 13) throw new Error(`${year}: ${monthCount} months between eleventh months`);
  let firstMonth = 2;
  if (monthCount === 13) {
    // The principal terms (multiples of 30°) between the two solstices, as CST dates.
    const terms = [];
    let cursor = new Date(before.getTime() - 20 * DAY);
    for (let index = 0; index <= 12; index += 1) {
      const at = sunAt((270 + 30 * index) % 360, cursor);
      terms.push(cstDate(at));
      cursor = new Date(at.getTime() + DAY);
    }
    const leap = months.slice(0, -1).findIndex((start, index) => !terms.some((term) => term >= start && term < months[index + 1]));
    // A leap eleventh or twelfth month pushes the New Year one month later.
    if (leap === 1 || leap === 2) firstMonth = 3;
  }
  return months[firstMonth];
}

export function render() {
  const dates = {};
  for (let year = FROM_YEAR; year <= TO_YEAR; year += 1) dates[year] = lunarNewYear(year);
  return `${JSON.stringify({
    schema: 'zodiacs.lunar-new-year.v1',
    rule: 'First day of the first month of the Chinese calendar, on China Standard Time (UTC+8) from 1929 and Beijing mean time before, from astronomy-engine new Moons and solar terms; scripts/build-lunar-new-year.mjs.',
    from: FROM_YEAR,
    to: TO_YEAR,
    dates,
  }, null, 2)}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const text = render();
  if (process.argv.includes('--check')) {
    const current = await readFile(OUT, 'utf8').catch(() => '');
    if (current !== text) { console.error('src/data/lunar-new-year.json is stale; run node scripts/build-lunar-new-year.mjs'); process.exit(1); }
    console.log('Verified src/data/lunar-new-year.json');
  } else {
    await writeFile(OUT, text);
    console.log(`Built src/data/lunar-new-year.json (${TO_YEAR - FROM_YEAR + 1} years)`);
  }
}
