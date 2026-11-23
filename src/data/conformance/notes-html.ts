const escape = (text: string) => text
  .replace(/&/gu, '&amp;')
  .replace(/</gu, '&lt;')
  .replace(/>/gu, '&gt;')
  .replace(/"/gu, '&quot;');

function matchHttpsLink(text: string, start: number): { end: number; label: string; href: string } | null {
  if (text[start] !== '[') return null;
  const closeBracket = text.indexOf(']', start + 1);
  if (closeBracket === -1 || text[closeBracket + 1] !== '(') return null;
  const urlStart = closeBracket + 2;
  if (!text.startsWith('https://', urlStart)) return null;

  let depth = 0;
  let i = urlStart;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/u.test(ch)) return null;
    if (ch === '(') {
      depth += 1;
    } else if (ch === ')') {
      if (depth === 0) {
        return {
          end: i + 1,
          label: text.slice(start + 1, closeBracket),
          href: text.slice(urlStart, i),
        };
      }
      depth -= 1;
    }
    i += 1;
  }
  return null;
}

function inline(text: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        out.push(`<code>${escape(text.slice(i + 1, end))}</code>`);
        i = end + 1;
        continue;
      }
    }
    if (text[i] === '[' ) {
      const link = matchHttpsLink(text, i);
      if (link) {
        out.push(`<a href="${escape(link.href)}">${inline(link.label)}</a>`);
        i = link.end;
        continue;
      }
    }
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2);
      if (end !== -1 && end > i + 2) {
        out.push(`<strong>${inline(text.slice(i + 2, end))}</strong>`);
        i = end + 2;
        continue;
      }
    }
    out.push(escape(text[i]));
    i += 1;
  }
  return out.join('');
}

/**
 * Renders the Markdown notes beside each conformance run: both bullet lists
 * (up to one level of nesting) and paragraph blocks with inline links, bold
 * text, and code spans.
 */
export function notesHtml(markdown: string | null): string {
  if (!markdown) return '';
  const lines = markdown.split('\n');
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

  for (let idx = 0; idx < lines.length; idx += 1) {
    const rawLine = lines[idx];
    const item = /^(\s*)- (.*)$/u.exec(rawLine);
    if (item) {
      flushParagraph();
      const deep = item[1].length > 0;
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      if (deep && !nested && out.length > 0 && out[out.length - 1].endsWith('</li>')) {
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
      if (inList) {
        let next = idx + 1;
        while (next < lines.length && lines[next].trim() === '') next += 1;
        if (next < lines.length && /^(\s*)- /u.test(lines[next])) {
          continue;
        }
        closeList();
      }
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeList();
  return out.join('');
}
