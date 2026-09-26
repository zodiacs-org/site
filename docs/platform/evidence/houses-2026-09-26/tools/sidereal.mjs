// The engine's apparent sidereal time (astronomy-engine's SiderealTime on the
// engine's ΔT) at 14 instants, for sidereal.py to set beside ERFA and Swiss.
import '../../../../../scripts/lib/deltat-install.mjs';
import { MakeTime, SiderealTime } from 'astronomy-engine';
import { deltaTAt } from '@zodiacs/engine/deltat';

for (const year of [1820, 1860, 1900, 1950, 2000, 2040, 2049, 2051, 2060, 2080, 2100, 2130, 2160, 2190]) {
  const utc = new Date(Date.UTC(year, 5, 15, 7, 13, 0));
  const deltaT = deltaTAt((utc.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000).seconds;
  process.stdout.write(`${JSON.stringify({ utc: utc.toISOString(), gastHours: SiderealTime(MakeTime(utc)), deltaT })}\n`);
}
