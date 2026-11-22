import { afterEach, describe, expect, it, vi } from 'vitest';
import { vedicFromTropical } from '../../lib/vedic-signs/sidereal';
import type { TropicalMoment } from '../../lib/vedic-signs/tropical';
import { computeVedicFromForm, prepareLocalTime, type VedicFormInput } from './compute';

/**
 * The page's worker, run in this thread: the same sidereal half
 * (./vedic.worker.ts posts vedicFromTropical's reading back), so the test
 * reads the instants the page hands it.
 */
const posted: { ends: { utc: string }[] | null }[] = [];
class InlineWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage(message: { ayanamsa: VedicFormInput['ayanamsa']; at: { utc: string }; ends: { utc: string }[] | null }) {
    posted.push(message);
    const moment = (wire: { utc: string }) => ({ ...wire, utc: new Date(wire.utc) }) as unknown as TropicalMoment;
    const { ayanamsa, at, ends, ...rest } = message;
    const reading = vedicFromTropical({ ...(rest as object), at: moment(at), ends: ends ? ends.map(moment) : null } as never, ayanamsa);
    queueMicrotask(() => this.onmessage?.({ data: { reading } }));
  }
  terminate() {}
}

afterEach(() => { vi.unstubAllGlobals(); posted.length = 0; });

const APIA = { tz: 'Pacific/Apia', lat: -13.83, lon: -171.76 };
async function form(birthDate: string, birthTime: string | null) {
  vi.stubGlobal('Worker', InlineWorker);
  const input: VedicFormInput = { birthDate, birthTime, place: APIA, ayanamsa: 'lahiri' };
  await prepareLocalTime(input.birthDate, input.place.tz);
  return computeVedicFromForm(input);
}

describe('the /vedic-signs/ page on a clock that repeated or skipped a date', () => {
  it('reads the whole of a date the clock showed twice (Apia, 4 July 1892), as the tool does', async () => {
    const reading = await form('1892-07-04', null);
    expect(posted[0].ends!.map((end) => end.utc)).toEqual(['1892-07-03T11:27:02.000Z', '1892-07-05T11:27:01.000Z']);
    expect(reading.moonNakshatra).toBeNull();
    expect(reading.nakshatraCandidates).toEqual(['Chitra', 'Swati', 'Vishakha']);
  });

  it('refuses a date the clock never showed (Apia, 30 December 2011) before anything is worked out, timed or not', async () => {
    for (const time of [null, '12:00']) {
      await expect(form('2011-12-30', time)).rejects.toThrow(RangeError);
      expect(posted).toHaveLength(0);
    }
    await expect(form('2011-12-31', null)).resolves.toBeTruthy();
  });
});
