import { PROFILE_KEY, MAX_CHARTS, type Profile, type SavedChart, type SavedPlace } from './schema';
import { loadProfile, explicitSelfChart } from './read-store';
import { loadMe, parseMe, type MeSettings } from './me';
import { CIRCLE_KEY, ME_KEY } from './page-keys';
import { loadCircle, parseCircle, MAX_CIRCLE, type CircleEntry } from './circle';
import { profileAccessAllowed } from '../account-v2/profile-access-reader';
import { clearChartDeletion } from './deletions';

export const BACKUP_LIMIT = 2_000_000;
export interface ChartBackup {
  format: 'zodiacs-chart-backup'; version: 1; createdAt: string;
  profile: Profile; me: MeSettings; circle: CircleEntry[];
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length <= max;
const instant = (v: unknown): v is string => text(v, 40) && Number.isFinite(Date.parse(v));
const longitude = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 360;
const house = (v: unknown): v is Profile['settings']['houseSystem'] => v === 'whole' || v === 'placidus';
const bodies = new Set(['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','North Node','South Node']);
const flags = new Set(['dst-gap','dst-fold','lmt','no-time','polar-fallback','outside-reference-span']);
const fail = (): never => { throw new Error('This is not a valid Zodiacs chart backup. Nothing was changed.'); };

function parsePlace(v: unknown): SavedPlace | null {
  if (v === null) return null;
  if (!object(v) || !text(v.name) || !text(v.admin1) || !text(v.country)
    || typeof v.lat !== 'number' || !Number.isFinite(v.lat) || Math.abs(v.lat) > 90
    || typeof v.lon !== 'number' || !Number.isFinite(v.lon) || Math.abs(v.lon) > 180 || !text(v.tz, 100)) return fail();
  try { new Intl.DateTimeFormat('en', { timeZone: v.tz }); } catch { return fail(); }
  return { name: v.name, admin1: v.admin1, country: v.country, lat: v.lat, lon: v.lon, tz: v.tz };
}

function parseChart(v: unknown): SavedChart {
  if (!object(v) || !text(v.id, 100) || !/^[A-Za-z0-9_-]+$/u.test(v.id) || !text(v.name)
    || !instant(v.createdAt) || !instant(v.updatedAt) || !object(v.birth) || !object(v.summary)) return fail();
  const b = v.birth, s = v.summary;
  if (!text(b.date, 10) || !/^\d{4}-\d{2}-\d{2}$/u.test(b.date)
    || !Number.isFinite(Date.parse(b.date)) || new Date(b.date).toISOString().slice(0, 10) !== b.date
    || typeof b.timeKnown !== 'boolean' || (b.time !== null && (!text(b.time, 5) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/u.test(b.time)))
    || (b.timeKnown && b.time === null) || !text(s.engineVersion, 100) || !instant(s.utcISO) || !house(s.houseSystem)
    || !Array.isArray(s.bodies) || s.bodies.length < 1 || s.bodies.length > 12 || !Array.isArray(s.flags) || s.flags.length > 6
    || s.flags.some(f => typeof f !== 'string' || !flags.has(f))
    || (v.relationship !== undefined && v.relationship !== 'self' && v.relationship !== 'other')) return fail();
  const normalizedBodies = s.bodies.map(item => {
    if (!object(item) || !text(item.body, 20) || !bodies.has(item.body) || !longitude(item.lon) || typeof item.retrograde !== 'boolean') return fail();
    return { body: item.body, lon: item.lon, retrograde: item.retrograde };
  });
  if (new Set(normalizedBodies.map(b => b.body)).size !== normalizedBodies.length) return fail();
  if (s.angles !== null && (!object(s.angles) || !longitude(s.angles.asc) || !longitude(s.angles.mc))) return fail();
  if (!b.timeKnown && s.angles !== null) return fail();
  return {
    id: v.id, name: v.name, createdAt: v.createdAt, updatedAt: v.updatedAt,
    ...(v.relationship ? { relationship: v.relationship } : {}),
    birth: { date: b.date, time: b.time as string | null, timeKnown: b.timeKnown, place: parsePlace(b.place) },
    summary: { engineVersion: s.engineVersion, utcISO: s.utcISO, houseSystem: s.houseSystem,
      bodies: normalizedBodies, angles: s.angles === null ? null : { asc: (s.angles as Record<string, number>).asc!, mc: (s.angles as Record<string, number>).mc! },
      flags: s.flags as SavedChart['summary']['flags'] },
  };
}

export function parseChartBackup(raw: string): ChartBackup {
  if (raw.length > BACKUP_LIMIT) return fail();
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return fail(); }
  if (!object(v) || v.format !== 'zodiacs-chart-backup' || v.version !== 1 || !instant(v.createdAt)
    || !object(v.profile) || v.profile.version !== 1 || !object(v.profile.settings) || !house(v.profile.settings.houseSystem)
    || !Array.isArray(v.profile.charts) || v.profile.charts.length > MAX_CHARTS || !object(v.me) || v.me.version !== 1
    || !Array.isArray(v.circle) || v.circle.length > MAX_CIRCLE) return fail();
  const charts = v.profile.charts.map(parseChart);
  if (new Set(charts.map(c => c.id)).size !== charts.length) return fail();
  const circle = parseCircle(JSON.stringify(v.circle));
  if (circle.length !== v.circle.length) return fail();
  return { format: 'zodiacs-chart-backup', version: 1, createdAt: v.createdAt,
    profile: { version: 1, settings: { houseSystem: v.profile.settings.houseSystem }, charts },
    me: parseMe(JSON.stringify(v.me)), circle };
}

export function createChartBackup(): ChartBackup {
  if (!profileAccessAllowed()) throw new Error('Unlock your saved charts before downloading a backup.');
  return parseChartBackup(JSON.stringify({ format: 'zodiacs-chart-backup', version: 1, createdAt: new Date().toISOString(),
    profile: loadProfile(), me: loadMe(), circle: loadCircle() }));
}

/** Adds new charts and cards. Existing entries win; never infer a new owner over an existing one. */
export function mergeChartBackup(current: Profile, currentCircle: CircleEntry[], backup: ChartBackup): { profile: Profile; circle: CircleEntry[]; added: number } {
  const charts = [...current.charts];
  const circle = [...currentCircle];
  const currentSelf = explicitSelfChart(current.charts);
  const incomingSelf = explicitSelfChart(backup.profile.charts);
  let added = 0;
  for (const source of backup.profile.charts) {
    if (charts.some(c => c.id === source.id || (JSON.stringify(c.birth) === JSON.stringify(source.birth) && c.summary.houseSystem === source.summary.houseSystem))) continue;
    charts.push({ ...source, updatedAt: new Date().toISOString(),
      ...(source.relationship === 'self' && (currentSelf || !incomingSelf) ? { relationship: 'other' as const } : {}) });
    added++;
  }
  for (const entry of backup.circle) {
    if (!circle.some(c => c.id === entry.id || JSON.stringify(c.chart) === JSON.stringify(entry.chart))) circle.push(entry);
  }
  if (charts.length > MAX_CHARTS || circle.length > MAX_CIRCLE) throw new Error('There is not enough room for this backup. Nothing was changed.');
  return { profile: { ...current, charts }, circle, added };
}

export function restoreChartBackup(backup: ChartBackup, restoreIdentity: boolean): number {
  if (!profileAccessAllowed()) throw new Error('Unlock your saved charts before restoring a backup.');
  // All writes are synchronous within the same account access generation. No account/session keys are imported.
  const current = loadProfile();
  const merged = mergeChartBackup(current, loadCircle(), backup);
  const writes: [string, string][] = [[PROFILE_KEY, JSON.stringify(merged.profile)], [CIRCLE_KEY, JSON.stringify(merged.circle)]];
  if (restoreIdentity) writes.push([ME_KEY, JSON.stringify({ ...backup.me, keepCloseDismissed: false })]);
  const previous = writes.map(([key]) => [key, localStorage.getItem(key)] as const);
  try { for (const [key, value] of writes) localStorage.setItem(key, value); }
  catch {
    for (const [key, value] of previous.reverse()) {
      try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* Existing keys are smaller than failed writes. */ }
    }
    throw new Error('This browser could not save the backup. Free some storage and try again.');
  }
  for (const chart of merged.profile.charts) if (!current.charts.some(c => c.id === chart.id)) clearChartDeletion(chart.id);
  window.dispatchEvent(new Event('zodiacs:profile'));
  window.dispatchEvent(new Event('zodiacs:circle'));
  window.dispatchEvent(new Event('zodiacs:me'));
  return merged.added;
}
