/**
 * The committed list of past moon, eclipse and event pages hidden from
 * search, for the pages and the sitemap. The rules are in past-pages-hidden.mjs.
 */
import list from '../../data/indexing/past-pages-hidden.json';
import { pastPagesHidden } from './past-pages-hidden.mjs';

export const PAST_PAGES_HIDDEN: readonly string[] = Object.freeze([...(list.paths as string[])]);

/** Whether a page address is on the hidden list. */
export const isPastPageHidden: (path: string) => boolean = pastPagesHidden(PAST_PAGES_HIDDEN);
