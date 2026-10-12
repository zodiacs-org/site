/*
 * For each time zone in the city index, compares the pinned history
 * (src/data/tz-history/2025c/) with the host's Intl data over the legal time
 * the site reads from it: from 1900-01-01, or from the end of the zone's local
 * mean time era (src/data/tz-lmt.json) if later, to 1970-01-01. Inside an era
 * the site reads the birthplace's own mean time instead, and where the pinned
 * history has no offset ("-00") it reads the host's, so neither counts.
 *
 * The comparison is by interval, not by sampling: the pinned transitions are
 * exact, and the host's are found by checking each day at 12:00 UTC and
 * bisecting every change to the second. Between two consecutive transitions
 * of either, the difference is constant. Run from the repository root:
 *
 *   node docs/platform/evidence/tz-history-2025c/tools/index-divergence.mjs > docs/platform/evidence/tz-history-2025c/index-divergence.json
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';

// The pinned history it reads was removed by #723, when the site moved to @zodiacs/engine/geo.
if (!existsSync('src/data/tz-history/2025c')) {
  throw new Error('This check reads the site\'s pinned history, which #723 removed. Run it from a checkout before that change, such as ec0451ff.');
}

const directory = 'src/data/tz-history/2025c';
const zones = {};
for (const file of readdirSync(directory)) {
  if (file !== 'excluded.json') Object.assign(zones, JSON.parse(readFileSync(`${directory}/${file}`, 'utf8')).zones);
}
const index = JSON.parse(readFileSync('public/data/cities/index.json', 'utf8'));
const { eras } = JSON.parse(readFileSync('src/data/tz-lmt.json', 'utf8'));
const formats = new Map();
const host = (zone, seconds) => {
  if (!formats.has(zone)) formats.set(zone, new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }));
  const name = formats.get(zone).formatToParts(seconds * 1000).find((part) => part.type === 'timeZoneName').value;
  const match = /GMT([+-])(\d\d):(\d\d)(?::(\d\d))?/.exec(name);
  return match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4] ?? 0)) : 0;
};
const pinned = (history, seconds) => {
  let at = 0;
  while (at < history.t.length && history.t[at] <= seconds) at += 1;
  return history.o[at];
};

const START = Date.UTC(1900, 0, 1) / 1000;
const END = 0;
const DAY = 86_400;
const divergent = {};
for (const zone of index.tz) {
  const history = zones[zone];
  const from = Math.max(START, Object.prototype.hasOwnProperty.call(eras, zone) ? eras[zone] : START);
  const breaks = new Set([from, END, ...history.t.filter((t) => t > from && t < END)]);
  // The host's changes: each day at 12:00 UTC, and every change bisected to the second.
  let before = host(zone, from);
  let previous = from;
  for (let noon = Math.ceil((from - 43_200) / DAY) * DAY + 43_200; ; noon += DAY) {
    const at = Math.min(noon, END - 1);
    const offset = host(zone, at);
    if (offset !== before) {
      let lo = previous;
      let hi = at;
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (host(zone, mid) === before) lo = mid;
        else hi = mid;
      }
      breaks.add(hi);
      before = offset;
    }
    previous = at;
    if (at === END - 1) break;
  }
  const points = [...breaks].sort((a, b) => a - b);
  let seconds = 0;
  let first = null;
  let last = null;
  let largest = 0;
  for (let index = 0; index + 1 < points.length; index += 1) {
    const [a, b] = [points[index], points[index + 1]];
    const offset = pinned(history, a);
    if (offset === null) continue;
    const difference = Math.abs(offset - host(zone, a));
    if (!difference) continue;
    seconds += b - a;
    first ??= new Date(a * 1000).toISOString().slice(0, 19) + 'Z';
    last = new Date(b * 1000).toISOString().slice(0, 19) + 'Z';
    largest = Math.max(largest, difference);
  }
  if (seconds) divergent[zone] = { days: Math.round(seconds / DAY * 100) / 100, from: first, until: last, largestMinutes: Math.round(largest / 60 * 100) / 100 };
}
const names = Object.keys(divergent);
console.log(JSON.stringify({
  measured: {
    host: `Node ${process.versions.node}, ICU ${process.versions.icu}, tzdb ${process.versions.tz}`,
    span: 'legal time from 1900-01-01, or the end of the zone\'s local mean time era if later, to 1970-01-01',
  },
  indexZones: index.tz.length,
  divergentZones: names.length,
  divergentByAnHourOrMore: names.filter((name) => divergent[name].largestMinutes >= 60).length,
  divergent,
}, null, 1));
