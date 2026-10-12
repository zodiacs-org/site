import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const root = fileURLToPath(new URL('../../../', import.meta.url));
// It loads the site's own resolver of its day, which #723 replaced with the engine's.
if (!fs.existsSync(path.join(root, 'src/lib/time/tz-history-load.ts'))) {
  console.error('This probe reads the site\'s former resolver, which #723 replaced with @zodiacs/engine/geo. Run it from a checkout before that change, such as ec0451ff.');
  process.exit(2);
}
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
const cache = new Map();
const sources = {};
function load(relative) {
  const file = path.join(root, relative);
  if (cache.has(file)) return cache.get(file).exports;
  const source = fs.readFileSync(file, 'utf8');
  sources[relative] = crypto.createHash('sha256').update(source).digest('hex');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} }; cache.set(file, module);
  new Function('module', 'exports', 'require', code)(module, module.exports, (specifier) => load(path.relative(root, path.resolve(path.dirname(file), `${specifier}.ts`))));
  return module.exports;
}
const { parseCivilDate } = load('src/lib/time/civil-date.ts');
const { resolveLocalToUtc } = load('src/lib/time/localToUtc.ts');
const failures = [];
let calendarCases = 0;
for (let year = 1600; year < 2000; year += 1) for (let month = 1; month <= 12; month += 1) for (let day = 1; day <= 31; day += 1) {
  const text = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = parseCivilDate(text);
  const date = new Date(0); date.setUTCFullYear(year, month - 1, day);
  const valid = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (Boolean(parsed) !== valid) failures.push({ kind: 'calendar', text });
  calendarCases += 1;
}
const zones = Intl.supportedValuesOf('timeZone');
const instants = ['0000-02-29T12:00:00Z','0099-12-31T12:00:00Z','0100-01-01T12:00:00Z','1582-10-10T12:00:00Z','1907-07-06T12:00:00Z','2024-03-10T12:00:00Z','2024-11-03T12:00:00Z','9999-12-30T12:00:00Z'];
let roundTrips = 0;
for (const zone of zones) {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: zone, calendar: 'gregory', numberingSystem: 'latn', era: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  for (const instant of instants) {
    const originalMs = Date.parse(instant);
    const parts = Object.fromEntries(formatter.formatToParts(originalMs).map(({ type, value }) => [type, value]));
    const year = parts.era === 'BC' ? 1 - Number(parts.year) : Number(parts.year);
    const date = `${String(year).padStart(4, '0')}-${parts.month}-${parts.day}`;
    const time = `${parts.hour}:${parts.minute}`;
    const knownMatchingMs = originalMs - Number(parts.second) * 1000;
    try {
      const result = resolveLocalToUtc(date, time, zone);
      if (result.flags.includes('dst-gap') || result.utc.getTime() > knownMatchingMs || knownMatchingMs - result.utc.getTime() > 86_400_000) failures.push({ kind: 'existing-instant-roundtrip', zone, date, time, knownMatching: new Date(knownMatchingMs).toISOString(), actual: result.utc.toISOString(), flags: result.flags });
    } catch (error) { failures.push({ kind: 'threw', zone, date, time, error: error.message }); }
    roundTrips += 1;
  }
}
const controls = [
  ['2024-04-07', '01:45', 'Australia/Lord_Howe', '2024-04-06T14:45:00.000Z', 'dst-fold'],
  ['2024-10-06', '02:15', 'Australia/Lord_Howe', '2024-10-05T15:45:00.000Z', 'dst-gap'],
  ['2011-12-30', '12:00', 'Pacific/Apia', '2011-12-30T22:00:00.000Z', 'dst-gap'],
  ['1907-07-06', '08:30', 'America/Mexico_City', '1907-07-06T15:06:36.000Z', 'lmt'],
].map(([date,time,zone,expected,flag]) => {
  const r = resolveLocalToUtc(date,time,zone);
  const row = { date,time,zone,expected,flag,actual:r.utc.toISOString(),flags:r.flags };
  if(row.actual !== expected || !r.flags.includes(flag)) failures.push({kind:'control',...row});
  return row;
});
const hostDefaultTimezone = [undefined, null, '', 123, {}].map((value) => {
  try { const r = resolveLocalToUtc('2001-01-01','12:00',value); return {type: typeof value, value: String(value), utc:r.utc.toISOString(), flags:r.flags}; }
  catch(error) { return {type:typeof value,value:String(value),error:error.constructor.name,message:error.message}; }
});
console.log(JSON.stringify({ observedAt: new Date().toISOString(), node:process.version, icu:process.versions.icu, tz:process.versions.tz, hostTimezone:Intl.DateTimeFormat().resolvedOptions().timeZone,sources,calendarCases,roundTrips,zones:zones.length,controls,failures,hostDefaultTimezone, limitations:['Finite corpus against this runtime ICU; round-trip check is not independent validation of historical tzdb offsets.','Read-only source review and scratch execution; no repository mutation, full build, browser or network.'] },null,2));
process.exitCode=failures.length?1:0;
