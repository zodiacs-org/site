import { describe, expect, it } from 'vitest';
import type { SavedChart } from '../lib/profile/schema';
import { ENGINE_VERSION } from '../lib/engine/types';
import type { City } from '../lib/geo/search';
import { resolveForm, resolveLink, resolveSaved, type SlotState } from './SynastryCalculator';

/*
 * A side computed on this device without a birth time is noon at the
 * birthplace, an instant that gives the place away, so each resolver hands
 * the send-back link its civil date (untimedDate) and the link carries noon
 * UTC on it instead (SendBackExperience.sendBackToken). A side with a birth
 * time, or one that arrived as positions, carries no date.
 */
const loadEngine = () => import('../lib/engine/full');
const kathmandu: City = {
  name: 'Kathmandu', admin1: '', country: 'Nepal', lat: 27.72, lon: 85.32, tz: 'Asia/Kathmandu', pop: 1_000_000,
};

function slot(timeKnown: boolean): SlotState {
  return {
    source: 'form', savedId: '', name: 'Me', date: '1990-04-11',
    time: timeKnown ? '08:30' : '', timeKnown, city: kathmandu, link: null, positions: null,
  };
}

function saved(timeKnown: boolean): SavedChart {
  return {
    id: '5b1f1d4e-2f0c-4a53-9d1e-2d7f4b0c9a12',
    name: 'Aries Sun · 1990-04-11',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    birth: { date: '1990-04-11', time: timeKnown ? '08:30' : null, timeKnown, place: kathmandu },
    summary: {
      engineVersion: ENGINE_VERSION,
      utcISO: '1990-04-11T06:15:00.000Z',
      houseSystem: 'whole',
      bodies: [],
      angles: null,
      flags: [],
    },
  } as SavedChart;
}

describe('synastry sides and the send-back link', () => {
  it('gives each side computed without a birth time its civil date, and no other side one', async () => {
    const [formUntimed, formTimed, linkUntimed, linkTimed, savedUntimed, savedTimed] = await Promise.all([
      resolveForm(slot(false), 'Person A', loadEngine),
      resolveForm(slot(true), 'Person A', loadEngine),
      resolveLink({ input: { date: '1990-04-11', time: null, timeKnown: false, lat: 27.72, lon: 85.32, tz: 'Asia/Kathmandu' }, label: 'Sam' } as never, loadEngine),
      resolveLink({ input: { date: '1990-04-11', time: '08:30', timeKnown: true, lat: 27.72, lon: 85.32, tz: 'Asia/Kathmandu' }, label: 'Sam' } as never, loadEngine),
      resolveSaved(saved(false), loadEngine),
      resolveSaved(saved(true), loadEngine),
    ]);
    expect(formUntimed.untimedDate).toBe('1990-04-11');
    expect(linkUntimed.untimedDate).toBe('1990-04-11');
    expect(savedUntimed.untimedDate).toBe('1990-04-11');
    for (const side of [formTimed, linkTimed, savedTimed]) expect(side.untimedDate).toBeUndefined();
    // The untimed sides' own positions are noon in Kathmandu (06:15 UTC).
    expect(formUntimed.positions.angles).toBeNull();
  });
});
