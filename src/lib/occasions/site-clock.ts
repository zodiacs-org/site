/** The site's own local-time resolver, for the occasion pages (the MCP runtime passes the compute API's). */
import { prepareLocalTime, resolveLocalToUtc } from '../time/localToUtc';
import type { OccasionClock } from './card';

export const SITE_CLOCK: OccasionClock = { prepareLocalTime, resolveLocalToUtc };
