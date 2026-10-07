import { z } from 'zod';
import source from '../../data/horoscope-program.json';
import type { HoroscopeProgram, HoroscopeReading } from '../../lib/horoscope-program-types';
import { SIGN_SLUGS } from '../../lib/compute-api/constants';

export const DEFAULT_HOROSCOPE_ZONE = 'America/New_York';
export const HOROSCOPE_URI = 'ui://zodiacs/horoscopes-preview-v1.html';
export const horoscopeInput = z.strictObject({
  sign: z.enum(SIGN_SLUGS).optional().describe('Sun sign. Omit to open the sign picker; do not infer a sign.'),
  period: z.enum(['day', 'week']).default('day'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Requested calendar date. Omitted means the current date in zone.'),
  zone: z.string().min(1).max(64).default(DEFAULT_HOROSCOPE_ZONE).describe('IANA timezone; defaults to America/New_York. Selects the current date and formats evidence times. Editions remain based on UTC sky snapshots.'),
  focus: z.enum(['general', 'love', 'career']).default('general'),
});
export type HoroscopeRequest = z.input<typeof horoscopeInput>;
export const program = source as HoroscopeProgram;

export function dateInZone(now: Date, zone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}
function validDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
export function getHoroscope(input: unknown, now = new Date(), edition = program) {
  const parsed = horoscopeInput.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: { code: 'invalid-request', message: 'Choose a supported sign, period, date, focus and IANA timezone.' } };
  const args = parsed.data;
  let localDate: string;
  try { localDate = dateInZone(now, args.zone); } catch { return { ok: false as const, error: { code: 'invalid-timezone', message: 'Choose a valid IANA timezone, such as America/New_York.' } }; }
  const date = args.date ?? localDate;
  if (!validDate(date)) return { ok: false as const, error: { code: 'invalid-date', message: 'Choose a real calendar date in YYYY-MM-DD format.' } };
  const request = { ...args, date };
  const base = { schema: 'zodiacs.horoscope-preview.v1', request, editionDate: edition.anchorDate, localDate, basis: 'UTC sky snapshots; the timezone selects the requested calendar date and formats evidence times. It does not recalculate a personal horoscope.', interpretation: 'Astrological interpretation for reflection, not a factual prediction or professional advice.', privacy: 'No birth details, account, storage or model-generation request is needed. A connected assistant receives the requested sign and reading.' };
  if (!args.sign) return { ...base, ok: true as const, status: 'choose-sign' as const, signs: [...SIGN_SLUGS] };
  const readings = edition.signs.find(entry => entry.sign === args.sign)?.readings;
  const candidates: HoroscopeReading[] = readings ? args.period === 'week' ? [readings.weekly] : args.focus === 'general' ? [readings.today, readings.tomorrow] : [readings[args.focus]] : [];
  const available = candidates.filter(item => item.status === 'publishable').map(item => ({ from: item.period.from, through: item.period.through, originalSurface: item.surface }));
  const reading = args.period === 'week' && args.focus !== 'general' ? undefined : candidates.find(item => item.status === 'publishable' && item.period.from <= date && date <= item.period.through);
  if (!reading) return { ...base, ok: true as const, status: 'unavailable' as const, available, message: args.period === 'week' && args.focus !== 'general' ? 'This edition has general weekly readings. Choose General, or Daily for love and career.' : `No published ${args.focus} ${args.period === 'week' ? 'weekly' : 'daily'} reading covers ${date}. Choose one of the available editions below.` };
  const refs = new Set(reading.passages.flatMap(passage => passage.evidenceRefs));
  // Include source facts for every interpretive solar-house mapping.
  for (const receipt of edition.evidence) if (refs.has(receipt.id) && receipt.sourceFactId) refs.add(receipt.sourceFactId);
  const evidence = edition.evidence.filter(receipt => refs.has(receipt.id)).map(receipt => ({ ...receipt, localAt: new Intl.DateTimeFormat('en-US', { timeZone: args.zone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(receipt.at)) }));
  if (Array.from(refs).some(id => !evidence.some(receipt => receipt.id === id))) return { ...base, ok: false as const, error: { code: 'missing-evidence', message: 'The reading has an incomplete source record and is unavailable.' } };
  return { ...base, ok: true as const, status: 'available' as const, available, reading,
    sourceNote: `Original ${reading.surface} reading from the ${edition.anchorDate} edition. Relative words such as “today” and “tomorrow” refer to that edition; the reading covers ${reading.period.from} through ${reading.period.through}.`,
    evidence, method: edition.policy,
    links: [{ title: 'Horoscopes on Zodiacs', url: `https://zodiacs.org/horoscopes/${args.sign}/` }, { title: 'Methodology', url: 'https://zodiacs.org/methodology/' }],
  };
}
