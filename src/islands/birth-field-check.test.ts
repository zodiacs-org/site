import { afterEach, describe, expect, it, vi } from 'vitest';
import { birthFieldMessages, dateMessage, focusField } from './birth-field-check';

const ids = { date: 'x-date', time: 'x-time', place: 'x-place' };
const place = { name: 'Placeholder' };

afterEach(() => vi.unstubAllGlobals());

describe('birth field checks', () => {
  it('names every missing field and points at the first in reading order', () => {
    expect(birthFieldMessages('en', ids, { date: '', time: '', timeKnown: true, requireTime: true, city: null })).toEqual({
      dateError: 'Enter your birth date.',
      timeError: 'Enter your birth time.',
      placeError: 'Pick your birthplace from the list.',
      first: 'x-date',
    });
    expect(birthFieldMessages('en', ids, { date: '2000-01-01', time: '', timeKnown: true, requireTime: true, city: null }).first)
      .toBe('x-time');
    expect(birthFieldMessages('en', ids, { date: '2000-01-01', time: '00:00', requireTime: true, city: null }).first)
      .toBe('x-place');
    expect(birthFieldMessages('en', ids, { date: '2000-01-01', city: place })).toEqual({ first: undefined });
  });

  it('asks for a time only where the form requires one and the time is known', () => {
    expect(birthFieldMessages('en', ids, { date: '2000-01-01', time: '', timeKnown: true, city: place }).timeError).toBeUndefined();
    expect(birthFieldMessages('en', ids, { date: '2000-01-01', time: '', timeKnown: false, requireTime: true, city: place }).timeError)
      .toBeUndefined();
    expect(birthFieldMessages('en', { date: 'x-date' }, { date: '2000-01-01', requireTime: true, city: null })).toEqual({ first: undefined });
  });

  it('reads a date outside the field range from the field itself', () => {
    vi.stubGlobal('document', { getElementById: () => ({ validity: { valid: false } }) });
    expect(birthFieldMessages('en', ids, { date: '1700-01-01', city: place }).dateError)
      .toBe('Choose a birth date from 1800 through 2199.');
    expect(dateMessage('en', 'x-date', '1700-01-01')).toBe('Choose a date from 1800 through 2199.');
    expect(dateMessage('en', 'x-date', '')).toBe('Enter a date.');
  });

  it('takes wording for a form about someone else', () => {
    const words = { dateRequired: 'Enter their birth date.', timeRequired: 'Enter their birth time.', place: 'Pick their birthplace.' };
    expect(birthFieldMessages('es', ids, { date: '', time: '', timeKnown: true, requireTime: true, city: null }, words)).toMatchObject({
      dateError: words.dateRequired, timeError: words.timeRequired, placeError: words.place,
    });
  });

  it('focuses the field on the next frame, and does nothing without one', () => {
    const focused: string[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { callback(); return 0; });
    vi.stubGlobal('document', { getElementById: (id: string) => ({ focus: () => focused.push(id) }) });
    focusField(undefined);
    focusField('x-place');
    expect(focused).toEqual(['x-place']);
  });
});
