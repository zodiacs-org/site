import { currentHoroscopeMonth } from '../src/lib/horoscope-month.mjs';

const DAY_MS = 86_400_000;

export const HOROSCOPE_SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

function utcDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`invalid clock value: ${String(value)}`);
  return date.toISOString().slice(0, 10);
}

export function assertEditionAge(editionDate, now = new Date(), maxAge = 0) {
  if (!Number.isInteger(maxAge) || maxAge < 0 || maxAge > 3) {
    throw new Error(`--max-age must be an integer from 0 to 3, received ${maxAge}`);
  }
  const edition = new Date(`${editionDate}T00:00:00.000Z`);
  if (Number.isNaN(edition.getTime()) || edition.toISOString().slice(0, 10) !== editionDate) {
    throw new Error(`daily facts carry an invalid UTC date: ${editionDate}`);
  }
  const currentDate = utcDate(now);
  const current = new Date(`${currentDate}T00:00:00.000Z`);
  const age = Math.floor((current.getTime() - edition.getTime()) / DAY_MS);
  if (age < 0 || age > maxAge) {
    throw new Error(
      `daily edition ${editionDate} has age ${age}; allowed deployment range is 0-${maxAge} UTC days`,
    );
  }
  return age;
}

function frontmatter(source, sourceName) {
  const block = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u)?.[1];
  if (!block) throw new Error(`${sourceName}: missing YAML frontmatter`);
  return block;
}

function frontmatterValue(block, field, sourceName, required = true) {
  const raw = block.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'))?.[1]?.trim();
  if (!raw) {
    if (!required) return null;
    throw new Error(`${sourceName}: missing ${field} frontmatter`);
  }
  return raw.replace(/^(?:"([^"]*)"|'([^']*)')$/u, '$1$2');
}

export function parseMonthlyHoroscopeEntry(source, sourceName = 'horoscope entry') {
  const block = frontmatter(source, sourceName);
  const draft = frontmatterValue(block, 'draft', sourceName, false);
  if (draft !== null && draft !== 'true' && draft !== 'false') {
    throw new Error(`${sourceName}: draft must be true or false`);
  }
  return {
    sourceName,
    sign: frontmatterValue(block, 'sign', sourceName),
    month: frontmatterValue(block, 'month', sourceName),
    draft: draft === 'true',
  };
}

export function hasCompleteLiveHoroscopeMonth(monthlyEntries, month) {
  const actualSigns = monthlyEntries
    .filter((entry) => !entry.draft && entry.month === month)
    .map((entry) => entry.sign)
    .sort();
  const expectedSigns = [...HOROSCOPE_SIGNS].sort();
  return JSON.stringify(actualSigns) === JSON.stringify(expectedSigns);
}

export function assertHoroscopePackageFreshness({
  now = new Date(),
  daily,
  publication,
  manifest,
  program,
  transits,
  monthlyEntries,
}) {
  const currentDate = utcDate(now);
  const currentMonth = currentDate.slice(0, 7);
  const aligned = [
    ['daily facts', daily?.date],
    ['daily publication', publication?.date],
    ['daily manifest', manifest?.date],
    ['horoscope program', program?.anchorDate],
  ];
  for (const [label, date] of aligned) {
    if (date !== currentDate) {
      throw new Error(`${label} date ${String(date)} does not match current UTC date ${currentDate}`);
    }
  }
  if (transits?.month !== currentMonth) {
    throw new Error(
      `transit catalog month ${String(transits?.month)} does not match current UTC month ${currentMonth}`,
    );
  }

  const liveEntries = monthlyEntries.filter((entry) => !entry.draft);
  const latestLiveMonth = currentHoroscopeMonth(liveEntries.map((entry) => entry.month), currentMonth);
  if (latestLiveMonth !== currentMonth) {
    throw new Error(
      `latest live monthly horoscope ${String(latestLiveMonth)} does not match current UTC month ${currentMonth}`,
    );
  }
  const current = liveEntries.filter((entry) => entry.month === currentMonth);
  if (!hasCompleteLiveHoroscopeMonth(liveEntries, currentMonth)) {
    const actualSigns = current.map((entry) => entry.sign).sort();
    throw new Error(
      `monthly horoscope ${currentMonth} must contain exactly the 12 signs; found: ${actualSigns.join(', ')}`,
    );
  }
  return { currentDate, currentMonth, signCount: current.length };
}
