/**
 * Run from the site root after the metadata-only, functions-only vercel build:
 * node --no-experimental-detect-module docs/platform/evidence/calendar-feeds-2026-10-01/tools/verify-packaged-calendar.mjs
 * No environment values, feed capabilities, network calls or database writes.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

assert(process.execArgv.includes('--no-experimental-detect-module'));
const functionDirectory = '.vercel/output/functions/api/calendar/transits.func';
const config = JSON.parse(readFileSync(resolve(functionDirectory, '.vc-config.json'), 'utf8'));
assert.equal(config.runtime, 'nodejs22.x');
let fetchAttempts = 0;
globalThis.fetch = async () => {
  fetchAttempts += 1;
  throw new Error('Network fetch is unavailable in the packaged check.');
};
const module = await import(pathToFileURL(resolve(functionDirectory, config.handler)).href);
assert.equal(typeof module.default, 'function');
function response() {
  return {
    statusCode: 0, body: '', headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(body) { this.body = body; },
  };
}
const routes = [];
for (const [route, method, expectedAllow] of [
  ['create', 'GET', 'POST'], ['feed', 'POST', 'GET, DELETE'], ['sweep', 'GET', 'POST'],
]) {
  const res = response();
  await module.default({ method, query: { [module.CALENDAR_ROUTE_PARAMETER]: route }, headers: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, expectedAllow);
  routes.push({ route, method, status: res.statusCode, allow: expectedAllow });
}
// Deliberately synthetic positions: every body is at zero, angles are 0/90.
const token = '2.eyJiIjpbMCwwLDAsMCwwLDAsMCwwLDAsMCwwLDBdLCJhIjpbMCw5MF0sImgiOiJ3IiwidiI6IjEuMC4wIn0';
const calendar = module.buildTransitCalendar(token, {
  from: new Date('2026-03-19T00:00:00Z'),
  to: new Date('2026-03-22T00:00:00Z'),
  generatedAt: '2026-03-19T12:00:00Z',
});
assert(calendar.startsWith('BEGIN:VCALENDAR\r\n'));
assert(calendar.endsWith('END:VCALENDAR\r\n'));
assert(calendar.includes('BEGIN:VEVENT\r\n'));
assert(!calendar.includes(token));
assert.equal(fetchAttempts, 0);
console.log(JSON.stringify({
  schema: 'zodiacs.calendar-feed-packaged-check/v1',
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  entrySha256: createHash('sha256').update(readFileSync(resolve(functionDirectory, config.handler))).digest('hex'),
  runtime: process.version,
  functionRuntime: config.runtime,
  moduleSyntaxDetection: false,
  handler: `${functionDirectory}/${config.handler}`,
  routeMethodGuards: routes,
  syntheticCalendar: { validEnvelope: true, events: calendar.split('BEGIN:VEVENT\r\n').length - 1 },
  fetchAttempts,
  scope: 'Packaged import, rejected method paths, and an in-process synthetic calendar only; no live-service checks.',
}, null, 2));
