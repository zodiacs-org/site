import { afterEach, describe, expect, it, vi } from 'vitest';
import { completeReferenceTask } from './reference-completion';
import { sanitizeAnalyticsProperties } from './analytics';

afterEach(() => vi.unstubAllGlobals());
describe('nonpersonal reference completion', () => {
  const setup = (marker: unknown) => {
    let value = marker === null ? null : JSON.stringify(marker);
    const track = vi.fn();
    vi.stubGlobal('sessionStorage', { getItem: () => value, removeItem: () => { value = null; } });
    vi.stubGlobal('window', { zodiacsAnalytics: { track } });
    return track;
  };
  it('completes once and removes the same-tab marker', () => {
    const track = setup({ page: 'moon-venus', expires: 2000 });
    expect(completeReferenceTask(1000)).toBe(true);
    expect(completeReferenceTask(1000)).toBe(false);
    expect(track).toHaveBeenCalledExactlyOnceWith('reference_task_completed', { topic: 'synastry', page: 'moon-venus', locale: 'en', task: 'comparison', destination: 'compatibility' });
  });
  it('rejects missing, expired, malformed and unknown markers', () => {
    for (const marker of [null, {}, { page: 'hub', expires: 900 }, { page: 'a typed name', expires: 2000 }, { page: 'hub', expires: 9e15 }]) {
      const track = setup(marker);
      expect(completeReferenceTask(1000)).toBe(false);
      expect(track).not.toHaveBeenCalled();
    }
  });
  it('drops birth data, URLs, names and unapproved dimension values', () => {
    expect(sanitizeAnalyticsProperties('reference_opened', { topic: 'synastry', page: 'hub', locale: 'en', task: 'comparison', destination: 'compatibility', name: 'Private', utc: '2000-01-01', url: '/?birth=private' })).toEqual({ topic: 'synastry', page: 'hub', locale: 'en', task: 'comparison', destination: 'compatibility' });
    expect(sanitizeAnalyticsProperties('reference_opened', { page: 'private input', topic: 'natal', locale: 'fr' })).toEqual({});
  });
});
