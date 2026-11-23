const escape = (text: string) => text
  .replace(/&/gu, '&amp;')
  .replace(/</gu, '&lt;')
  .replace(/>/gu, '&gt;')
  .replace(/"/gu, '&quot;');

const inline = (text: string) => {
  const escaped = escape(text);
  const withLinks = escaped.replace(
    /\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/gu,
    '<a href="$2">$1</a>',
  );
  return withLinks
    .replace(/\*\*([^*]+)\*\*/gu, '<strong>$1</strong>')
    .replace(/`([^`]+)`/gu, '<code>$1</code>');
};

/**
 * Renders the Markdown notes beside each conformance run: both bullet lists
 * (up to one level of nesting) and paragraph blocks with inline links, bold
 * text, and code spans.
 */
export function notesHtml(markdown: string | null): string {
  if (!markdown) return '';
  const out: string[] = [];
  let inList = false;
  let nested = false;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    out.push(`<p>${inline(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!inList) return;
    if (nested) {
      out.push('</ul></li>');
      nested = false;
    }
    out.push('</ul>');
    inList = false;
  };

  for (const rawLine of markdown.split('\n')) {
    const item = /^(\s*)- (.*)$/u.exec(rawLine);
    if (item) {
      flushParagraph();
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      const deep = item[1].length > 0;
      if (deep && !nested) {
        out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/u, '');
        out.push('<ul>');
        nested = true;
      } else if (!deep && nested) {
        out.push('</ul></li>');
        nested = false;
      }
      out.push(`<li>${inline(item[2])}</li>`);
      continue;
    }

    const trimmed = rawLine.trim();
    if (trimmed === '') {
      flushParagraph();
      closeList();
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeList();
  return out.join('');
}
