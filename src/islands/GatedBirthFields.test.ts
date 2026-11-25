import { h } from 'preact';
import { render } from 'preact-render-to-string';
import { afterEach, describe, expect, it } from 'vitest';
import { birthDateRefusal, birthDateRefusalText, FUTURE_BIRTH_DATE_SENTENCE, UNDER_13_SENTENCE } from '../lib/birth-date-policy';
import { GatedBirthFields, LOCKED_HELP, birthDateOpen, checkedBirthDate, quickBirthDateCheck, staleBirthDetails, type BirthDateCheck } from './GatedBirthFields';

const refuse = (birthDate: string, now: Date) => {
  const refusal = birthDateRefusal(birthDate, now);
  return refusal ? birthDateRefusalText(refusal) : null;
};
const LISBON = { name: 'Lisbon', admin1: 'Lisbon', country: 'Portugal', lat: 38.72, lon: -9.14, tz: 'Europe/Lisbon' };

const fields = (check: BirthDateCheck, extra: Record<string, unknown> = {}) => render(h('div', null, h(GatedBirthFields, {
  locale: 'en', dateId: 'g-date', timeId: 'g-time', placeId: 'g-place',
  date: '2020-01-01', calendar: 'gregorian', check, time: '08:30', timeKnown: true, city: LISBON as never,
  onDateChange: () => {}, onCalendarChange: () => {}, onTimeChange: () => {}, onTimeKnownChange: () => {}, onCityChange: () => {},
  timeHelp: 'Time help.', placeHelp: 'Place help.', ...extra,
})));
const input = (markup: string, id: string) => markup.match(new RegExp(`<input[^>]*id="${id}"[^>]*>`, 'u'))?.[0] ?? '';
const DISABLED = /\sdisabled(?:=""|\s|>|\/)/u;

describe('the gated birth fields', () => {
  it('lock the time and offer no birthplace search until the date is accepted, and show why at the date', () => {
    for (const check of [{ error: UNDER_13_SENTENCE }, { error: FUTURE_BIRTH_DATE_SENTENCE }, null] as BirthDateCheck[]) {
      const markup = fields(check);
      const label = JSON.stringify(check);
      expect(input(markup, 'g-time'), label).toMatch(DISABLED);
      expect(input(markup, 'g-time'), label).not.toContain('08:30');
      expect(input(markup, 'g-place'), label).toMatch(DISABLED);
      // No combobox and no birthplace held: PlaceSearch is not mounted, so no city lookup request can be sent.
      expect(markup, label).not.toContain('role="combobox"');
      expect(markup, label).not.toContain('Lisbon');
      expect(markup, label).toContain(LOCKED_HELP);
      if (check) expect(markup).toMatch(new RegExp(`class="field__error" role="alert">${(check as { error: string }).error.split(/[’']/u)[0]}`, 'u'));
    }
  });

  it('open the time and the birthplace search once the converted date is accepted', () => {
    const markup = fields({ date: '1990-05-03' }, { city: null, time: '' });
    expect(input(markup, 'g-time')).not.toMatch(DISABLED);
    expect(markup).toContain('role="combobox"');
    expect(markup).not.toContain(LOCKED_HELP);
    expect(markup).toContain('Time help.');
    expect(markup).not.toContain(UNDER_13_SENTENCE.split("'")[0]);
  });

  it('keep the time locked while no birth time is given, even with an accepted date', () => {
    expect(input(fields({ date: '1990-05-03' }, { timeKnown: false }), 'g-time')).toMatch(DISABLED);
  });

  it('clear a time and a birthplace only when the date is refused', () => {
    expect(staleBirthDetails({ error: UNDER_13_SENTENCE }, '08:30', LISBON as never)).toEqual({ time: true, city: true });
    expect(staleBirthDetails({ error: UNDER_13_SENTENCE }, '', null)).toEqual({ time: false, city: false });
    expect(staleBirthDetails({ date: '1990-05-03' }, '08:30', LISBON as never)).toEqual({ time: false, city: false });
    expect(staleBirthDetails(null, '08:30', LISBON as never)).toEqual({ time: false, city: false });
    expect(birthDateOpen({ date: '1990-05-03' })).toBe(true);
    expect(birthDateOpen({ error: UNDER_13_SENTENCE })).toBe(false);
    expect(birthDateOpen(null)).toBe(false);
  });

  describe('check the date on the shared policy\'s UTC-12 day, whatever the device says', () => {
    const zone = process.env.TZ;
    afterEach(() => {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    });

    // At 2026-11-10T02:00Z it is already the 10th at UTC+14, but still the 9th at UTC-12.
    it.each(['Pacific/Kiritimati', 'Asia/Bangkok', 'Europe/Madrid', 'UTC', 'America/New_York', 'Pacific/Pago_Pago'])('on a device in %s', async (deviceZone) => {
      process.env.TZ = deviceZone;
      expect(quickBirthDateCheck('2013-11-10', 'gregorian', refuse, new Date('2026-11-10T02:00:00Z'))).toEqual({ error: UNDER_13_SENTENCE });
      expect(quickBirthDateCheck('2013-11-10', 'gregorian', refuse, new Date('2026-11-10T11:59:59Z'))).toEqual({ error: UNDER_13_SENTENCE });
      expect(quickBirthDateCheck('2013-11-10', 'gregorian', refuse, new Date('2026-11-10T12:00:00Z'))).toEqual({ date: '2013-11-10' });
      expect(await checkedBirthDate('2013-11-10', 'gregorian', refuse, new Date('2026-11-10T11:59:59Z'))).toEqual({ error: UNDER_13_SENTENCE });
      expect(await checkedBirthDate('2013-11-10', 'gregorian', refuse, new Date('2026-11-10T12:00:00Z'))).toEqual({ date: '2013-11-10' });
    });
  });

  it('leave a date written another way to conversion, and check the converted date', async () => {
    const now = new Date('2026-11-09T12:00:00Z');
    expect(quickBirthDateCheck('', 'gregorian', refuse, now)).toBeNull();
    for (const typed of [' 2020-01-01', '2020-1-1', '2020/01/01', '1900-01-01']) {
      expect(quickBirthDateCheck(typed, 'gregorian', refuse, now), typed).toBeUndefined();
    }
    expect(quickBirthDateCheck('1990-05-03', 'julian', refuse, now)).toBeUndefined();
    // A leading space or a different spelling converts to a child's date, and is refused there.
    for (const typed of [' 2020-01-01', '2020-1-1', '2020-01-01 ']) {
      expect(await checkedBirthDate(typed, 'gregorian', refuse, now), typed).toEqual({ error: UNDER_13_SENTENCE });
    }
    expect(await checkedBirthDate(' 1990-05-03', 'gregorian', refuse, now)).toEqual({ date: '1990-05-03' });
    expect(await checkedBirthDate('1900-01-01', 'julian', refuse, now)).toEqual({ date: '1900-01-13' });
    expect(await checkedBirthDate('2027-01-01', 'gregorian', refuse, now)).toEqual({ error: FUTURE_BIRTH_DATE_SENTENCE });
  });
});
