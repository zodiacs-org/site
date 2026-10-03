/// <reference lib="webworker" />
import { scanTransitContacts } from '../lib/engine/transit-scan';
import { wrappedWindow, wrappedTargets } from '../lib/return-visits/wrapped';
import type { Chart } from '../lib/engine/types';
self.onmessage = (event: MessageEvent<{ chart: Chart; year: number }>) => {
  try {
    const { chart, year } = event.data;
    const { from, to } = wrappedWindow(year);
    const contacts = scanTransitContacts({ bodies: chart.bodies, angles: chart.input.timeKnown ? chart.angles : null }, from, to, {
      transitBodies: ['Jupiter', 'Saturn'], natalPoints: wrappedTargets(chart), aspects: ['conjunction', 'square', 'opposition'],
    }).filter((contact) => new Date(contact.exactUtc).getUTCFullYear() === year);
    self.postMessage({ contacts });
  } catch { self.postMessage({ error: true }); }
};
