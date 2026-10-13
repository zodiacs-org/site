/**
 * The entry scripts/build-compute-local-time.mjs bundles into
 * api/_compute/local-time.mjs for the compute API's function: the engine's
 * local-time resolver, @zodiacs/engine/geo, with the histories it loads before
 * 1970, and the map from a zone name in any letter case to its tzdb spelling.
 * Nothing on a page imports this file.
 */
export { TZDB, prepareLocalTime, resolveLocalToUtc } from '@zodiacs/engine/geo';
export { canonicalZoneName } from '../time/zone-names';
