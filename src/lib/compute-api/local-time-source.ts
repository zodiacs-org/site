/**
 * The entry scripts/build-compute-local-time.mjs bundles into
 * api/_compute/local-time.mjs for the compute API's function: the site's own
 * local-time resolver, unchanged, with the tables it loads (the local mean
 * time eras and the pinned zone history before 1970), and the map from a zone
 * name in any letter case to its tzdb spelling. Nothing on a page imports
 * this file.
 */
export { prepareLocalTime, resolveLocalToUtc } from '../time/localToUtc';
export { loadZoneHistory } from '../time/tz-history-load';
export { canonicalZoneName } from '../time/zone-names';
