/**
 * Structured data the sky hubs' Event nodes share (/eclipses/,
 * /full-moon-calendar/, /mercury-retrograde/, /retrogrades/ and their
 * localized pages). scripts/validate-schema.mjs holds every Event node on the
 * built site to it.
 */

/**
 * Where a sky event takes place. Every instant on the hubs is geocentric (an
 * eclipse's peak, a full Moon's opposition, a planet appearing to move
 * backwards as seen from Earth), so the place is the Earth, named as an
 * identifier and tied to its Wikidata entity. Google lists `location` as
 * required for an Event; a VirtualLocation would claim the event is attended
 * online, which a sky event is not.
 */
export const SKY_EVENT_LOCATION = Object.freeze({
  '@type': 'Place',
  name: 'Earth',
  sameAs: 'https://www.wikidata.org/wiki/Q2',
});
