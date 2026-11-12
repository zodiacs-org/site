/** The earliest and latest instants a civil birth date can be, on any clock, when no place is known. */
export function birthDayEnvelope(date: string): [Date, Date] {
  const start = Date.parse(`${date}T00:00:00Z`);
  return [new Date(start - 14 * 3_600_000), new Date(start + (24 * 60 - 1) * 60_000 + 12 * 3_600_000)];
}
/** The Sun's sign index when both ends of the birth day agree, else the two candidates. */
export function settledSunSign(ends: readonly [Date, Date], sunLonAt: (at: Date) => number): { sign: number | null; candidates: number[] } {
  const signs = ends.map((at) => Math.floor((((sunLonAt(at) % 360) + 360) % 360) / 30));
  return signs[0] === signs[1] ? { sign: signs[0], candidates: [] } : { sign: null, candidates: signs };
}
