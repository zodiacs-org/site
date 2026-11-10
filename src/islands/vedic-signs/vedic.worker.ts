/// <reference lib="webworker" />
/**
 * The /vedic-signs/ page's sidereal half, in a bundle of its own:
 * @zodiacs/engine/vedic shares the engine's internal chunks, so imported into
 * the page's module graph it would split the engine chunk every chart page
 * loads. It receives the tropical Sun, Moon and rising degree the page worked
 * out with the site's chart engine (src/lib/vedic-signs/tropical.ts) and posts
 * back the reading from src/lib/vedic-signs/sidereal.ts, the half the
 * get_vedic_signs tool runs after the same tropical one. It holds no chart
 * calculation of its own. Nothing leaves the device.
 */
import { vedicFromTropical } from '../../lib/vedic-signs/sidereal';
import type { TropicalMoment, TropicalMoments } from '../../lib/vedic-signs/tropical';
import type { VedicAyanamsa } from '../../lib/vedic-signs/wording';

type WireMoment = Omit<TropicalMoment, 'utc'> & { utc: string };
type Message = Omit<TropicalMoments, 'at' | 'ends'> & { at: WireMoment; ends: WireMoment[] | null; ayanamsa: VedicAyanamsa };

const moment = (wire: WireMoment): TropicalMoment => ({ ...wire, utc: new Date(wire.utc) });

self.onmessage = (event: MessageEvent<Message>) => {
  try {
    const { ayanamsa, at, ends, ...rest } = event.data;
    self.postMessage({ reading: vedicFromTropical({ ...rest, at: moment(at), ends: ends ? ends.map(moment) : null }, ayanamsa) });
  } catch {
    self.postMessage({ error: true });
  }
};
