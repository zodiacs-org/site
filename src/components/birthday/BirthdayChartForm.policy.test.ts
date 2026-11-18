import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FUTURE_BIRTH_DATE_SENTENCE, UNDER_13_SENTENCE } from '../../lib/birth-date-policy';

/**
 * The birthday page's chart form hands a date to /birth-chart/ through this
 * tab's session storage. A birth date less than 13 years ago, or one still to
 * come, is refused in the form itself with the audit's exact sentence, so it
 * is never handed off (ZOD-224 point 6). The form's script is inline, so the
 * test runs that script against small stand-ins for the elements it touches.
 */
const source = readFileSync(new URL('./BirthdayChartForm.astro', import.meta.url), 'utf8');
const script = /<script is:inline>([\s\S]*?)<\/script>/u.exec(source)?.[1] ?? '';

type Listener = (event: { preventDefault(): void }) => void;

function element(extra: Record<string, unknown> = {}) {
  const attributes: Record<string, string> = {};
  const listeners: Record<string, Listener> = {};
  return {
    value: '',
    checked: false,
    disabled: false,
    hidden: true,
    textContent: '',
    dataset: {} as Record<string, string>,
    attributes,
    listeners,
    addEventListener(type: string, listener: Listener) { listeners[type] = listener; },
    setAttribute(name: string, value: string) { attributes[name] = value; },
    removeAttribute(name: string) { delete attributes[name]; },
    getAttribute(name: string) { return attributes[name] ?? null; },
    focus() {},
    ...extra,
  };
}

function mountForm(month: string, day: string) {
  const year = element();
  const time = element();
  const unknown = element({ checked: true });
  const error = element();
  const form = element();
  form.dataset = { month, day, under13: UNDER_13_SENTENCE, future: FUTURE_BIRTH_DATE_SENTENCE };
  form.attributes.action = '/birth-chart/';
  const parts: Record<string, unknown> = { '#bday-year': year, '#bday-time': time, '#bday-time-unknown': unknown, '#bday-form-error': error };
  (form as unknown as { querySelector(selector: string): unknown }).querySelector = (selector: string) => parts[selector];
  const store = new Map<string, string>();
  const storage = {
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
    setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
    removeItem: (key: string) => { store.delete(key); },
  };
  const assign = vi.fn();
  const document = { querySelector: (selector: string) => (selector === '[data-bday-handoff]' ? form : null) };
  new Function('document', 'window', 'sessionStorage', 'crypto', script)(
    document,
    { location: { assign } },
    storage,
    { getRandomValues: (bytes: Uint8Array) => bytes.fill(7) },
  );
  const submit = (value: string) => {
    year.value = value;
    form.listeners.submit({ preventDefault() {} });
  };
  return { submit, error, storage, assign, store };
}

describe('the birthday chart form refuses a child or future birth date before handing it off', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T12:00:00Z'));
  });
  afterEach(() => { vi.useRealTimers(); });

  it('binds the policy module\'s two sentences, not copies of them', () => {
    expect(source).toContain("import { FUTURE_BIRTH_DATE_SENTENCE, UNDER_13_SENTENCE } from '../../lib/birth-date-policy';");
    expect(source).toContain('data-under13={UNDER_13_SENTENCE} data-future={FUTURE_BIRTH_DATE_SENTENCE}');
  });

  it('shows the under-13 sentence for a birthday 12 years ago, in English, and hands nothing off', () => {
    const form = mountForm('06', '15');
    form.submit('2014');
    expect(form.error.textContent).toBe(UNDER_13_SENTENCE);
    expect(form.error.hidden).toBe(false);
    expect(form.error.attributes.lang).toBe('en');
    expect(form.storage.setItem).not.toHaveBeenCalled();
    expect(form.assign).not.toHaveBeenCalled();
  });

  it('shows the future sentence for next year and hands nothing off', () => {
    const form = mountForm('06', '15');
    form.submit('2027');
    expect(form.error.textContent).toBe(FUTURE_BIRTH_DATE_SENTENCE);
    expect(form.storage.setItem).not.toHaveBeenCalled();
    expect(form.assign).not.toHaveBeenCalled();
  });

  it('refuses the day before a 13th birthday at UTC-12 and accepts the 13th birthday itself', () => {
    // At 12:00 UTC on 17 November 2026 the date at UTC-12 is 17 November.
    const before = mountForm('11', '18');
    before.submit('2013');
    expect(before.error.textContent).toBe(UNDER_13_SENTENCE);
    const birthday = mountForm('11', '17');
    birthday.submit('2013');
    expect(birthday.error.textContent).toBe('');
    expect(birthday.assign).toHaveBeenCalledWith(expect.stringMatching(/^\/birth-chart\/#h=[0-9a-f]{32}$/u));
  });

  it('still hands an adult\'s date over by session key only, with no lang mark left on the error area', () => {
    const form = mountForm('06', '15');
    form.submit('2014');
    form.submit('1994');
    expect(form.error.textContent).toBe('');
    expect(form.error.attributes.lang).toBeUndefined();
    const [url] = form.assign.mock.calls[0] as [string];
    expect(url).not.toMatch(/1994|06-15/u);
    const [[, stored]] = form.storage.setItem.mock.calls as [[string, string]];
    expect(JSON.parse(stored)).toEqual({ k: 'date', d: '1994-06-15', t: null });
  });
});

describe('a date handed to the chart page is checked on arrival', () => {
  it('shows the refusal when the handed-over date is refused, before focusing the birthplace', () => {
    const calculator = readFileSync(new URL('../../islands/ChartCalculator.tsx', import.meta.url), 'utf8');
    const openDate = /const openDate = \(handoff[\s\S]*?\n {4}\};/u.exec(calculator)?.[0] ?? '';
    expect(openDate).toMatch(/const refusal = birthDateRefusal\(handoff\.date\);\s*if \(refusal\) \{\s*setError\(birthDateRefusalText\(refusal\)\);\s*return;/u);
    expect(openDate.indexOf('birthDateRefusal(')).toBeLessThan(openDate.indexOf("querySelector<HTMLElement>('#place')"));
  });
});
