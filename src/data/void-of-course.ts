/**
 * The site's void-of-course Moon, in one place. The /void-of-course-moon/ calendar and the hosted search_sky_events
 * both read their periods here, so the two cannot give different times. They are @zodiacs/engine's windows under its
 * default rule (VOID_OF_COURSE_CONVENTION with the modern bodies): from the Moon's last exact Ptolemaic aspect
 * (conjunction, sextile, square, trine or opposition) in a sign to the Sun or a planet from Mercury to Pluto, until the
 * Moon enters the next sign. Build-time and server-side only; no island imports it. It sits in src/data, beside the
 * glossary that pages and explain_astrology also share, outside the Phase 1 screenshot sources that walk src/lib
 * (tests/visual/phase1-evidence-contract.mjs).
 */
import { VOID_BODIES, VOID_OF_COURSE_CONVENTION, voidOfCourseAt, voidOfCourseWindows } from '@zodiacs/engine/techniques';
import type { VoidOfCourseStatus, VoidOfCourseWindow } from '@zodiacs/engine/techniques';

export type { VoidOfCourseStatus, VoidOfCourseWindow };

/** The bodies whose aspects count: the engine's default set, the Sun through Pluto. */
export const SITE_VOID_BODIES = VOID_OF_COURSE_CONVENTION.defaultBodies;
export const SITE_VOID_BODY_NAMES: readonly string[] = VOID_BODIES[SITE_VOID_BODIES];
/** The rule's ids in the conventions registry (src/data/conventions/registry.json). */
export const SITE_VOID_CONVENTION_IDS = [
  `void-of-course:${VOID_OF_COURSE_CONVENTION.name}`,
  `void-of-course-bodies:${SITE_VOID_BODIES}`,
] as const;

/** Every void period whose ending ingress falls in (from, to], in time order. */
export function siteVoidOfCourseWindows(from: Date, to: Date): readonly VoidOfCourseWindow[] {
  return voidOfCourseWindows(from, to);
}

/** Whether the Moon is void of course at an instant, with the period in progress and the next. */
export function siteVoidOfCourseAt(at: Date): VoidOfCourseStatus {
  return voidOfCourseAt(at);
}
