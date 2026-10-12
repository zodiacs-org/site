/*
 * Brief v1 M3's rule for step 1.12: "the 98-zone divergence list resolves to
 * backzone truth". The list (../tzdb-divergence-98.json) is the audit's: for
 * each zone, up to three segments where the host's TZif files (Debian tzdata
 * 2025b, built with backzone) and Node's Intl (tzdb 2025c, default build)
 * disagree, with the disagreement in minutes.
 *
 * For each segment, a birth at 12:00 local time inside the segment is
 * resolved twice: with a longitude (the site's birthplace path, which reads
 * the pinned history before 1970) and without (the host's history). Their
 * offsets should differ by exactly the listed disagreement. The longitude is
 * the zone's own mean-time meridian where tz-lmt.json has one (wrapped into
 * -180..180), so the birthplace's mean time cannot be what moves the result.
 * Run from the repository root:
 *
 *   npx vite-node --script docs/platform/evidence/engine-beyond-swiss/corpora/tools/divergence-list-check.ts \
 *     > docs/platform/evidence/engine-beyond-swiss/corpora/tzdb-divergence-98-check.json
 *
 * It checks the site's own resolver, its pinned history and its mean-time
 * table, which #723 removed when the site moved to @zodiacs/engine/geo. It runs
 * from a checkout before that change, such as ec0451ff, and
 * tzdb-divergence-98-check.json is its record. The engine checks the same
 * list against its own resolver in src/geo/zone-history.test.ts ("the audit's
 * 98-zone divergence list").
 */
import { existsSync, readFileSync } from 'node:fs';

if (!existsSync('src/lib/time/tz-history-load.ts')) {
  throw new Error('This check reads the site\'s own resolver, which #723 removed. Run it from a checkout before that change, such as ec0451ff.');
}
const { prepareLocalTime, resolveLocalToUtc } = await import('../../../../../../src/lib/time/localToUtc');
const { loadZoneHistory } = await import('../../../../../../src/lib/time/tz-history-load');

const list = JSON.parse(readFileSync('docs/platform/evidence/engine-beyond-swiss/corpora/tzdb-divergence-98.json', 'utf8'));
const lmt = JSON.parse(readFileSync('src/data/tz-lmt.json', 'utf8'));
const { excluded } = JSON.parse(readFileSync('src/data/tz-history/2025c/excluded.json', 'utf8'));
const DAY = 86_400_000;

const rows = [];
for (const zone of list.zones) {
  for (const segment of zone.sample) {
    const from = Date.parse(`${segment.from}T00:00:00Z`);
    const to = Date.parse(`${segment.to}T00:00:00Z`);
    // The list gives whole dates; a segment of a day or two may not hold 12:00
    // on either date, so both are tried. Longer ones are sampled in the middle.
    const short = segment.days <= 2;
    const dates = (short ? [from, to] : [from + Math.floor((to - from) / DAY / 2) * DAY])
      .map((ms) => new Date(ms).toISOString().slice(0, 10));
    // tz-lmt.json's offsets run from -12 to +14 hours; wrapped to a longitude.
    const meridian = typeof lmt.offsets[zone.tz] === 'number' ? lmt.offsets[zone.tz] / 240 : 0;
    const longitude = ((meridian + 540) % 360) - 180;
    let date = dates[0];
    let moved = 0;
    let instant = 0;
    for (const candidate of dates) {
      await prepareLocalTime(candidate, zone.tz);
      const pinned = resolveLocalToUtc(candidate, '12:00', zone.tz, { longitude });
      const host = resolveLocalToUtc(candidate, '12:00', zone.tz);
      date = candidate;
      instant = host.utc.getTime() / 1000;
      moved = Math.round((pinned.offsetMinutes - host.offsetMinutes) * 60) / 60;
      if (Math.abs(moved - segment.tzifMinusIcuMinutes) < 1e-9) break;
    }
    // Where tzdb writes "-00" (no local time yet), the site reads the host's
    // offset by design; the list's TZif reference reads it as UTC.
    const history = await loadZoneHistory(zone.tz);
    let index = 0;
    while (history && index < history.t.length && history.t[index] <= instant) index += 1;
    const kind = Number(date.slice(0, 4)) >= 1970
      ? 'after 1970'
      : Object.prototype.hasOwnProperty.call(excluded, zone.tz) ? 'excluded name'
        : history && history.o[index] === null ? 'no local time (-00)' : 'before 1970';
    rows.push({
      zone: zone.tz, date, short, listedMinutes: segment.tzifMinusIcuMinutes, movedMinutes: moved,
      kind, agrees: Math.abs(moved - segment.tzifMinusIcuMinutes) < 1e-9,
    });
  }
}

const count = (filter) => rows.filter(filter).length;
const summary = {
  zones: list.zones.length,
  segments: rows.length,
  before1970: count((row) => row.kind === 'before 1970'),
  before1970Agree: count((row) => row.kind === 'before 1970' && row.agrees),
  excludedName: count((row) => row.kind === 'excluded name'),
  noLocalTime: count((row) => row.kind === 'no local time (-00)'),
  after1970: count((row) => row.kind === 'after 1970'),
};
process.stdout.write(`${JSON.stringify({
  note: 'Output of tools/divergence-list-check.ts. "before 1970" rows are the rule; "excluded name", "after 1970" and "no local time (-00)" rows are left to the host by design and are expected to move 0.',
  host: { node: process.version, icu: process.versions.icu, tz: process.versions.tz },
  summary,
  disagreements: rows.filter((row) => row.kind === 'before 1970' && !row.agrees),
  rows,
}, null, 1)}\n`);
