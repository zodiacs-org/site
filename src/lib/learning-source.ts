import { profileAccessAllowed } from './account-v2/profile-access-reader';
import { loadProfile } from './profile/read-store';
import { isResolvableLocalTime } from './time/localToUtc';
import { learningInputIdentity } from './learning-input-identity';
import type { ProfileChartRunInput } from './profile/profile-chart-handoff';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
export interface LearningSource { id: string; label: string; input: ProfileChartRunInput; identity: string }

/** Read-only, fail-closed projection. Cached chart positions are never recomputed evidence. */
export function projectLearningSource(value: unknown): LearningSource | null {
  try {
    if (!object(value) || typeof value.id !== 'string' || !UUID.test(value.id)
      || typeof value.name !== 'string' || !object(value.birth) || !object(value.summary)) return null;
    const b = value.birth; const s = value.summary; const p = b.place;
    if (typeof b.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.date)
      || b.date < '1800-01-01' || b.date > '2199-12-31' || typeof b.timeKnown !== 'boolean'
      || (b.timeKnown && (typeof b.time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(b.time)))
      || !object(p) || !finite(p.lat) || Math.abs(p.lat) > 90 || !finite(p.lon) || Math.abs(p.lon) > 180
      || typeof p.tz !== 'string' || !p.tz.trim()
      || !['name', 'admin1', 'country'].every((key) => typeof p[key] === 'string')
      || (s.houseSystem !== 'whole' && s.houseSystem !== 'placidus')
      || typeof s.engineVersion !== 'string' || typeof s.utcISO !== 'string'
      || !Array.isArray(s.bodies) || !Array.isArray(s.flags) || !s.flags.every((flag) => typeof flag === 'string')
      || !s.bodies.every((body) => object(body) && typeof body.body === 'string' && finite(body.lon) && typeof body.retrograde === 'boolean')
      || (s.angles !== null && (!object(s.angles) || !finite(s.angles.asc) || !finite(s.angles.mc)))) return null;
    const day = new Date(`${b.date}T12:00:00Z`);
    if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== b.date) return null;
    const time = b.timeKnown ? b.time as string : '12:00';
    if (!isResolvableLocalTime(b.date, time, p.tz)) return null;
    const input: ProfileChartRunInput = { date: b.date, time, timeKnown: b.timeKnown,
      city: { name: p.name as string, admin1: p.admin1 as string, country: p.country as string,
        lat: p.lat, lon: p.lon, tz: p.tz, pop: 0 }, houseSystem: s.houseSystem,
      subjectMode: value.relationship === 'self' ? 'self' : 'other' };
    return { id: value.id, label: value.name, input, identity: learningInputIdentity(input) };
  } catch { return null; }
}

export function readLearningSources(): LearningSource[] {
  if (!profileAccessAllowed()) return [];
  const sources = loadProfile().charts.map(projectLearningSource).filter((source): source is LearningSource => source !== null);
  // Ambiguous duplicate IDs cannot establish an exact private source.
  return sources.filter((source) => sources.filter((other) => other.id === source.id).length === 1);
}

export function learningSourceCurrent(source: Pick<LearningSource, 'id' | 'identity'>): boolean {
  return profileAccessAllowed() && readLearningSources().some((current) => current.id === source.id && current.identity === source.identity);
}
