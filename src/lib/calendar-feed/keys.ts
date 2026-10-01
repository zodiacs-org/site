/**
 * Feed ids and removal keys, made on the server from Node's cryptographic
 * random source. Only a key's SHA-256 digest is stored; the key is returned
 * once, to the browser that made the feed.
 */
import { createHash, randomBytes } from 'node:crypto';
import { CALENDAR_FEED_ID_RE, CALENDAR_FEED_SECRET_RE } from './shared.js';

export function createCalendarFeedId(): string {
  const id = randomBytes(16).toString('base64url');
  if (!CALENDAR_FEED_ID_RE.test(id)) throw new Error('The feed id generator returned an invalid value.');
  return id;
}

export function createCalendarFeedSecret(): string {
  const secret = randomBytes(32).toString('base64url');
  if (!CALENDAR_FEED_SECRET_RE.test(secret)) {
    throw new Error('The feed key generator returned an invalid value.');
  }
  return secret;
}

/** The digest the database keeps, or null for anything that is not a key. */
export function calendarFeedSecretHash(secret: unknown): string | null {
  return typeof secret === 'string' && CALENDAR_FEED_SECRET_RE.test(secret)
    ? createHash('sha256').update(secret, 'utf8').digest('hex')
    : null;
}

/** The CDN cache tag of one feed's responses, so removing it clears them. */
export function calendarFeedCacheTag(id: string): string {
  return `calendar-feed-${id}`;
}
