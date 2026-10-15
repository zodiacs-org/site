/**
 * Reviewed display labels for People birthplaces.
 *
 * Wikidata records some birthplaces below the level of a settlement (a
 * hospital, a street, a house, a parish or a city district) and some under a
 * name that reads as a better-known place. Profiles and the AI people index
 * name the birthplace in prose ("Positions at 12:00 civil time in …"), so
 * those are shown under a settlement-level label instead.
 *
 * The label is sourced, not typed. BIRTHPLACE_LABELS names, most specific
 * first, the Wikidata entities whose cached English labels make it up, and
 * each must lie on the recorded birthplace's chain of containing
 * administrative entities (P131) in ../birthplace-settlements.json, written by
 * fetch-birthplace-settlements.mjs. The recorded entity, its coordinates and
 * its time zone are not changed, so no chart moves. Everyone not listed keeps
 * the label of the recorded entity. See ../birthplace-labels-2026-10-15.md.
 *
 * This is a closed, reviewed list of display labels, not permission to change
 * a recorded birthplace.
 */
import { readFileSync } from 'node:fs';

let cachedEvidence;
/** ../birthplace-settlements.json, read once on first use. */
export function settlementEvidence() {
  cachedEvidence ??= JSON.parse(
    readFileSync(new URL('../birthplace-settlements.json', import.meta.url), 'utf8'),
  );
  return cachedEvidence;
}

/** Slug → entity ids, most specific first, whose labels are joined with ", ". */
export const BIRTHPLACE_LABELS = Object.freeze({});

/**
 * Wikidata classes (P31) whose instances are settlements: a city, town,
 * village or hamlet, or a municipality that is one. Reviewed against every
 * class the cached evidence records; an entity with none of these is not
 * treated as a settlement.
 */
export const SETTLEMENT_CLASSES = Object.freeze({});

/** The recorded entity and every entity that contains it through the cached P131 chain, nearest first. */
export function containingEntities(entity, places = settlementEvidence().places) {
  const seen = [];
  let frontier = [entity];
  while (frontier.length > 0) {
    const next = [];
    for (const id of frontier) {
      if (seen.includes(id)) continue;
      const place = places[id];
      if (!place) throw new Error(`${id} is missing from the birthplace settlement evidence`);
      seen.push(id);
      next.push(...place.locatedIn);
    }
    frontier = next;
  }
  return seen;
}

export function isSettlement(entity, evidence = settlementEvidence(), classes = SETTLEMENT_CLASSES) {
  const place = evidence.places[entity];
  if (!place) throw new Error(`${entity} is missing from the birthplace settlement evidence`);
  return place.instanceOf.some((id) => Object.hasOwn(classes, id));
}

/**
 * The display label of one person's recorded birthplace: the reviewed
 * selection if there is one, otherwise the recorded entity's own label.
 * Throws when a selection leaves the cached chain.
 */
export function birthplaceDisplay(
  slug,
  { entity, entityLabel },
  evidence = settlementEvidence(),
  labels = BIRTHPLACE_LABELS,
) {
  if (!evidence.places[entity]) {
    throw new Error(`${slug}: recorded birthplace ${entity} is missing from the birthplace settlement evidence`);
  }
  if (!Object.hasOwn(labels, slug)) return { entity, label: entityLabel, entities: [entity] };
  const selection = labels[slug];
  if (!Array.isArray(selection) || selection.length === 0 || new Set(selection).size !== selection.length) {
    throw new Error(`${slug}: a reviewed birthplace label names one or more distinct entities`);
  }
  let from = entity;
  for (const id of selection) {
    if (!containingEntities(from, evidence.places).includes(id)) {
      throw new Error(`${slug}: ${id} does not contain ${from} in the cached P131 chain`);
    }
    if (!evidence.places[id].label) throw new Error(`${slug}: ${id} has no cached English label`);
    from = id;
  }
  return {
    entity: selection[0],
    label: selection.map((id) => evidence.places[id].label).join(', '),
    entities: [...selection],
  };
}

/**
 * The manifest's birthPlace with the display label applied. The recorded
 * entity, its label, the country, the coordinates and the time zone are
 * carried as they are.
 */
export function withBirthplaceDisplay(slug, birthPlace, evidence = settlementEvidence(), labels = BIRTHPLACE_LABELS) {
  const display = birthplaceDisplay(slug, birthPlace, evidence, labels);
  const {
    entity, entityLabel, displayEntity: _entity, displayLabel: _label, normalisedLabel: _normalised, ...rest
  } = birthPlace;
  return {
    entity,
    entityLabel,
    displayEntity: display.entity,
    displayLabel: display.label,
    normalisedLabel: [display.label, birthPlace.country?.label].filter(Boolean).join(', '),
    ...rest,
  };
}
