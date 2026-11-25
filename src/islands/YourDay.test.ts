import { readFileSync } from 'node:fs';
import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { afterEach, describe, expect, it } from 'vitest';
import { FUTURE_BIRTH_DATE_SENTENCE } from '../lib/birth-date-policy';
import YourDay, { UNDER_13, deviceClock, yourDayRefusal } from './YourDay';

describe('the Your day page reads the birth date by the shared policy', () => {
  const zone = process.env.TZ;
  afterEach(() => {
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  });

  // At 2026-11-09T02:00Z it is already the 9th in Madrid (03:00), but still the 8th at UTC-12.
  it.each(['Europe/Madrid', 'Pacific/Kiritimati', 'Asia/Bangkok', 'UTC', 'America/New_York', 'Pacific/Pago_Pago'])(
    'refuses the 13th birthday until it has begun everywhere, on a device in %s',
    (deviceZone) => {
      process.env.TZ = deviceZone;
      expect(yourDayRefusal('2013-11-09', new Date('2026-11-09T02:00:00Z'))).toBe(UNDER_13);
      expect(yourDayRefusal('2013-11-09', new Date('2026-11-09T11:59:59Z'))).toBe(UNDER_13);
      expect(yourDayRefusal('2013-11-09', new Date('2026-11-09T12:00:00Z'))).toBeNull();
      expect(yourDayRefusal('2013-11-08', new Date('2026-11-09T02:00:00Z'))).toBeNull();
    },
  );

  it('calls a date the future only past the calendar date at UTC+14', () => {
    expect(yourDayRefusal('2026-11-10', new Date('2026-11-09T09:59:59Z'))).toBe(FUTURE_BIRTH_DATE_SENTENCE);
    expect(yourDayRefusal('2026-11-10', new Date('2026-11-09T10:00:00Z'))).toBe(UNDER_13);
    expect(yourDayRefusal('1990-05-03', new Date('2026-11-09T02:00:00Z'))).toBeNull();
  });

  it('checks the converted date before it loads the calculation, not on the device clock', () => {
    const source = readFileSync(new URL('./YourDay.tsx', import.meta.url), 'utf8');
    const read = source.slice(source.indexOf('async function read('));
    const check = read.indexOf('checkedBirthDate(date, calendar, yourDayRefusal)');
    expect(check).toBeGreaterThan(0);
    expect(check).toBeLessThan(read.indexOf("import('./your-day/compute')"));
    expect(check).toBeLessThan(read.indexOf('computeYourDay('));
    expect(source).toMatch(/birthDateRefusal\(birthDate, now\)/u);
    expect(source).not.toMatch(/under13\(/u);
  });
});

describe('the Your day form', () => {
  const SOURCE = readFileSync(new URL('./YourDay.tsx', import.meta.url), 'utf8');
  const input = (markup: string, id: string) => markup.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`, 'u'))?.[0] ?? '';

  it('opens with the birth time and birthplace locked, and no birthplace search to send a city lookup', () => {
    const markup = render(h(YourDay, {}));
    expect(input(markup, 'yd-time')).toMatch(/\sdisabled/u);
    expect(input(markup, 'yd-place')).toMatch(/\sdisabled/u);
    expect(markup).not.toContain('role="combobox"');
  });

  it('asks for the time and birthplace only through the gated fields, opened by the converted date', () => {
    expect(SOURCE).not.toMatch(/<BirthFields\b/u);
    expect(SOURCE).toMatch(/<GatedBirthFields\b/u);
    expect(SOURCE).toMatch(/useBirthDateCheck\(date, calendar, yourDayRefusal\)/u);
    expect(SOURCE).toMatch(/const ready = birthDateOpen\(check\) && city !== null/u);
  });

  it('writes the device clock note as one text node, so filling in the zone after load moves nothing already drawn', () => {
    expect(SOURCE).toMatch(/<p class="field__help yd__clock">\{`Times are on this device’s clock\$\{clock \? ` \(\$\{clock\.zone\.replaceAll\('_', ' '\)\}\)` : ''\}\.`\}<\/p>/u);
    expect(render(h(YourDay, {}))).toContain('<p class="field__help yd__clock">Times are on this device’s clock.</p>');
  });

  it('reads the device clock again when the form is sent, so a tab left open past midnight reads the new today', () => {
    const zone = process.env.TZ;
    try {
      process.env.TZ = 'Asia/Bangkok';
      // The page loaded at 23:59 on 9 November in Bangkok and the form was sent at 00:01 on the 10th.
      expect(deviceClock(new Date('2026-11-09T16:59:00Z'))).toEqual({ zone: 'Asia/Bangkok', today: '2026-11-09' });
      expect(deviceClock(new Date('2026-11-09T17:01:00Z'))).toEqual({ zone: 'Asia/Bangkok', today: '2026-11-10' });
    } finally {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
    const read = SOURCE.slice(SOURCE.indexOf('async function read('), SOURCE.indexOf('} finally {', SOURCE.indexOf('async function read(')));
    // Read at the start of each request, and the calculation, the day limit and the "today" wording use it.
    expect(read).toMatch(/const now = new Date\(\);\s*\n\s*const current = deviceClock\(now\);\s*\n\s*setClock\(current\);/u);
    expect(read).toContain('daysBetween(current.today, target)');
    expect(read).toContain('date: target, zone: current.zone, today: current.today, now,');
    expect(read).not.toMatch(/clock\.(?:zone|today)/u);
    // The day the person chose is the one read: nothing moves it to the new today.
    expect(read).toContain('setDay(target);');
  });

  it('answers a birth time or a whole date the clock skipped with its own sentence', () => {
    const read = SOURCE.slice(SOURCE.indexOf('async function read('));
    expect(read).toMatch(/cause instanceof SkippedBirthTimeError \? SKIPPED_BIRTH_TIME : cause instanceof SkippedBirthDateError \? SKIPPED_BIRTH_DATE/u);
  });

  it('logs nothing: no exception, which can carry birth details, reaches the console', () => {
    expect(SOURCE).not.toMatch(/console\./u);
  });
});

describe('the personal pages drive on this branch', () => {
  const drive = readFileSync(new URL('../../tests/personal-pages-drive.mjs', import.meta.url), 'utf8');
  const workflow = readFileSync(new URL('../../.github/workflows/site-check.yml', import.meta.url), 'utf8');
  it('drives Your day, its age gate and share link, and runs in the flag-on job', () => {
    expect(drive).toContain("path: '/your-day/'");
    expect(drive).toContain("check('an under-13 date locks the birth time'");
    expect(drive).toContain("return '[data-your-day-share]'");
    const job = workflow.slice(workflow.indexOf('  your-day-flag-on:'));
    expect(job.slice(0, job.indexOf('\n  good-days-drive:'))).toContain('run: node tests/personal-pages-drive.mjs');
  });
});
