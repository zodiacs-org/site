import { timeBasis } from '@zodiacs/engine/time';

/**
 * An instant as an engine before 2.0.0 wrote it. Those engines read a UTC instant after the end of the IERS UT1
 * table (2027-10-02) as UT1; from 2.0.0 the engine reads it on continuous UTC (TT = UTC + 69.184 s), so the same TT
 * is written UT1 − UTC later, about 0.2 s in late 2027 and 2 s by 2047. References recorded with the earlier engines
 * keep their instants; this reads a current instant the way they were written. Before the table end it is unchanged.
 */
export function asBeforeContinuousUtc(iso: string): string {
  const ms = Date.parse(iso);
  const { timeScale } = timeBasis(ms);
  if (timeScale.basis !== 'continuous-utc' || timeScale.ut1MinusUtc === null) return iso;
  return new Date(ms + timeScale.ut1MinusUtc.seconds * 1000).toISOString();
}

/**
 * The UTC label an engine from 2.0.0 reads at the UT1 (and so the TT) that an
 * engine before 2.0.0 read from `iso`: after the IERS table the earlier
 * engines took a label as UT1, so a reference built on their clock is matched
 * by the label whose continuous-UTC reading lands on that UT1. Other instants
 * come back unchanged.
 */
export function onBeforeContinuousUtcClock(iso: string): Date {
  const ut1 = Date.parse(iso);
  let label = ut1;
  for (let i = 0; i < 3; i += 1) {
    const { timeScale } = timeBasis(label);
    if (timeScale.basis !== 'continuous-utc' || timeScale.ut1MinusUtc === null) return new Date(ut1);
    label = ut1 - timeScale.ut1MinusUtc.seconds * 1000;
  }
  return new Date(label);
}
