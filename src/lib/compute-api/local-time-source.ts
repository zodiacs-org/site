/**
 * The entry scripts/build-compute-local-time.mjs bundles into
 * api/_compute/local-time.mjs for the compute API's function: the site's own
 * local-time resolver, unchanged, with the tables it loads (the local mean
 * time eras and the pinned zone history before 1970). Nothing on a page
 * imports this file.
 */
export { prepareLocalTime, resolveLocalToUtc } from '../time/localToUtc';
export { loadZoneHistory } from '../time/tz-history-load';
