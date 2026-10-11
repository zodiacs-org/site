import { dailyContentManifest, dailyContentResponse } from '../../lib/daily-content-manifest';

export const prerender = true;

export function getStaticPaths() {
  return [{ params: { date: dailyContentManifest.date } }];
}

export const GET = dailyContentResponse;
