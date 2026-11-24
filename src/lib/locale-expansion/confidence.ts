/**
 * The reading confidence of a Sun-sign reading, by the site's one rule
 * (src/ai-tools/reading-confidence.ts), for the localized pages. Pages and
 * components take it from here, as the seasons pages do from their copy.
 */
import { readingConfidence } from '../../ai-tools/reading-confidence';

export const SUN_SIGN_READING_CONFIDENCE = readingConfidence('sign');
