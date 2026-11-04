/**
 * The GeoNames cities15000 index, loaded by the hosted function and the
 * developer server, not by the shared tool module. Keeping the import here
 * leaves the city names out of api/_ai/runtime.mjs, which the consumer
 * boundary reads as copy. The names are place names, and nothing is stored.
 */
import index from '../../../public/data/cities/index.json';
import { PLACE_SHARDS } from '../../mcp/places';
import type { PlaceTable } from './birthplace';

export function loadPlaceTable(): PlaceTable {
  return { index: index as unknown as PlaceTable['index'], shards: PLACE_SHARDS };
}
