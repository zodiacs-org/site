/// <reference lib="webworker" />
import { personalSky, personalWindow } from '../lib/personal-calendar/compute';
import type { Chart } from '../lib/engine/types';
self.onmessage = (event: MessageEvent<{ chart: Chart; now: string }>) => {
  try {
    const { chart, now } = event.data;
    const { from, to } = personalWindow(new Date(now));
    self.postMessage({ sky: personalSky(chart, from, to) });
  } catch { self.postMessage({ error: true }); }
};
