/**
 * The day a page prints as "Updated" (`<p data-event-updated>Updated <time
 * datetime="YYYY-MM-DD">`), or undefined when it prints none. The event pages
 * written to the reading style guide carry one.
 */
export function eventUpdatedDay(html) {
  const line = /<p\b[^>]*\bdata-event-updated\b[^>]*>[\s\S]*?<time\b[^>]*\bdatetime="([^"]*)"/u.exec(html);
  return line ? line[1] : undefined;
}

/**
 * Event dates must agree with their publication receipt, including absence.
 * A page that prints an "Updated" day (`updatedDay`) dates its Article from
 * that day instead, and the day may not come before the receipt's.
 */
export function eventArticleDateFailures(article, published, updatedDay) {
  if (!published) return ['event Article has no publication receipt'];
  const failures = [];
  const receiptDay = published.lastModified;
  const day = updatedDay ?? receiptDay;
  const instant = `${day}T00:00:00.000Z`;
  const parsed = Date.parse(instant);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(parsed)
    || new Date(parsed).toISOString() !== instant) {
    failures.push(updatedDay === undefined ? 'event receipt has an invalid lastModified' : 'event page prints an invalid Updated day');
  }
  if (updatedDay !== undefined && updatedDay < receiptDay) failures.push('event page prints an Updated day before its publication receipt');
  if (article.dateModified !== instant) {
    failures.push(updatedDay === undefined
      ? 'event Article.dateModified differs from its publication receipt'
      : 'event Article.dateModified differs from the Updated day the page prints');
  }
  if (published.publishedAt === undefined) {
    if (Object.hasOwn(article, 'datePublished')) failures.push('event Article invents an undocumented datePublished');
  } else if (article.datePublished !== published.publishedAt) {
    failures.push('event Article.datePublished differs from its publication receipt');
  }
  return failures;
}
