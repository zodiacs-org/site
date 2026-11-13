/// <reference lib="webworker" />
/**
 * "Your 2027 sky": the year's exact dates for one chart, found off the main
 * thread. It receives longitudes, the chart's UTC instant and the year's
 * retrograde table, and posts back dates; nothing leaves the device.
 */
import { scanYearSky, type YearRetrogradeInput, type YearSkyNatal } from '../lib/year-sky/scan';

self.onmessage = (event: MessageEvent<{ natal: YearSkyNatal; year: number; retrogrades: YearRetrogradeInput[] }>) => {
  try {
    const { natal, year, retrogrades } = event.data;
    self.postMessage({ scan: scanYearSky(natal, year, retrogrades) });
  } catch {
    self.postMessage({ error: true });
  }
};
