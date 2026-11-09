/// <reference lib="webworker" />
/**
 * The /vedic-signs/ page's signs, worked out off the main thread and in a
 * bundle of their own: @zodiacs/engine/vedic shares the engine's internal
 * chunks, so imported into the page's module graph it would split the engine
 * chunk every chart page loads. It receives the birth instants the page
 * resolved and posts back the reading from src/lib/vedic-signs/compute.ts,
 * the same function the get_vedic_signs tool runs. Nothing leaves the device.
 */
import { computeVedicSigns, type VedicSignsInstants } from '../../lib/vedic-signs/compute';

type Message = Omit<VedicSignsInstants, 'birthUtc' | 'dayEnds'> & { birthUtc: string; dayEnds?: string[] | undefined };

self.onmessage = (event: MessageEvent<Message>) => {
  try {
    const { birthUtc, dayEnds, ...rest } = event.data;
    self.postMessage({ reading: computeVedicSigns({ ...rest, birthUtc: new Date(birthUtc), dayEnds: dayEnds?.map((end) => new Date(end)) }) });
  } catch {
    self.postMessage({ error: true });
  }
};
