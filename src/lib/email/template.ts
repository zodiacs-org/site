/**
 * One branded shell for every message the site sends.
 *
 * Email is not the web: no stylesheet is loaded, no webfont resolves, no
 * custom property survives, and Outlook still lays out with Word. So this
 * module inlines every value, builds with tables, and copies the sign hues
 * from tokens.css as literal hex — the design system restated in the only
 * dialect mail clients read.
 *
 * The palette is the site's void, which the compatibility-invite mail has
 * already proven survives Gmail and Outlook dark-mode inversion: the
 * surfaces are explicitly dark, so a client that inverts a light shell has
 * nothing to fight over.
 *
 * Callers hand over a document and get both parts back. The text part is
 * not a fallback afterthought — it is the same document, and several
 * clients still show it.
 */

/** Sign hues, verbatim from --sign-* in src/styles/tokens.css. */
export const SIGN_HUE: Readonly<Record<string, string>> = {
  aries: '#DE8E79',
  taurus: '#B9D4BE',
  gemini: '#B29DD0',
  cancer: '#B6D4E4',
  leo: '#E0A9B4',
  virgo: '#B7D9B0',
  libra: '#D3A9DE',
  scorpio: '#B9DCE8',
  sagittarius: '#E0B080',
  capricorn: '#C0DEA8',
  aquarius: '#AE8FC9',
  pisces: '#A9D4C4',
};

/** Void surfaces and ink, verbatim from tokens.css. */
const VOID_0 = '#060709';
const VOID_1 = '#0A0C11';
const INK_0 = '#EEF1F7';
const INK_1 = '#C6CCDA';
const INK_3 = '#7A8397';
const HAIR = '#242936';

/**
 * Webfonts do not load in most clients. Georgia stands in for EB Garamond
 * (both old-style serifs), the system sans for Instrument Sans, and the
 * platform monospace for JetBrains Mono.
 */
const SERIF = "Georgia,'Times New Roman',Times,serif";
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

export interface EmailRow {
  /** Leading label — a name, a rank, a date. */
  label?: string;
  /** The sentence itself. */
  body: string;
  /** A computed receipt line, set in monospace beneath the body. */
  receipt?: string;
}

export interface EmailSection {
  heading?: string;
  paragraphs?: string[];
  rows?: EmailRow[];
  /** Shown in place of rows when a section computed to nothing. */
  empty?: string;
}

export interface EmailLink {
  label: string;
  url: string;
}

export interface EmailDocument {
  /** Inbox preview text. Never rendered in the body. */
  preheader: string;
  /** Monospace eyebrow above the title — a date, a register. */
  eyebrow: string;
  title: string;
  /** Sign slug: sets the accent hue and the header disc. */
  sign?: string;
  /** Small line under the eyebrow — who this is for. */
  identity?: string;
  intro?: string;
  sections: EmailSection[];
  cta?: EmailLink;
  /** Secondary links, listed under the button. */
  links?: EmailLink[];
  footerLines: string[];
  unsubscribeUrl?: string;
  manageUrl?: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Only absolute http(s) URLs reach an href. */
function safeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    return escapeHtml(parsed.toString());
  } catch {
    return '';
  }
}

export function signIconUrl(baseUrl: string, sign: string): string {
  const base = baseUrl.replace(/\/+$/u, '');
  return `${base}/assets/zodiac-icons/128/${sign}.png`;
}

/**
 * Where the header pictures come from. By default the sign disc is the
 * remote PNG and there is no ring. A message that must load nothing remote
 * passes cid: references to inline attachments instead.
 */
export interface EmailImages {
  /** The twelve-dot ring beside the wordmark; omitted means no ring. */
  ring?: string;
  /** The sign disc; defaults to the remote icon when the document has a sign. */
  sign?: string;
}

/** An image src: an absolute http(s) URL or a cid: reference to an inline attachment. */
function safeImageSrc(src: string): string {
  if (/^cid:[A-Za-z0-9._-]+$/u.test(src)) return src;
  return safeUrl(src);
}

function accentFor(sign?: string): string {
  return (sign && SIGN_HUE[sign]) || INK_0;
}

function sectionHtml(section: EmailSection, accent: string): string {
  const heading = section.heading
    ? `<tr><td style="padding:0 0 12px;font:600 11px/1.4 ${MONO};letter-spacing:.14em;text-transform:uppercase;color:${INK_3}">${escapeHtml(section.heading)}</td></tr>`
    : '';

  const paragraphs = (section.paragraphs ?? [])
    .map((p) => `<tr><td style="padding:0 0 14px;font:17px/1.6 ${SERIF};color:${INK_1}">${escapeHtml(p)}</td></tr>`)
    .join('');

  const rows = (section.rows ?? [])
    .map((row) => {
      const label = row.label
        ? `<div style="font:600 13px/1.45 ${SANS};color:${INK_0};margin:0 0 3px">${escapeHtml(row.label)}</div>`
        : '';
      const receipt = row.receipt
        ? `<div style="font:11px/1.5 ${MONO};color:${INK_3};margin:5px 0 0">${escapeHtml(row.receipt)}</div>`
        : '';
      // A hue-tinted rule at the row's head is the whole ornament budget.
      return `<tr><td style="padding:0 0 14px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
          <td width="3" bgcolor="${accent}" style="width:3px;background:${accent};font-size:0;line-height:0">&nbsp;</td>
          <td style="padding:1px 0 1px 13px">${label}<div style="font:15px/1.6 ${SANS};color:${INK_1}">${escapeHtml(row.body)}</div>${receipt}</td>
        </tr></table>
      </td></tr>`;
    })
    .join('');

  const empty = section.empty && !(section.rows ?? []).length
    ? `<tr><td style="padding:0 0 14px;font:15px/1.6 ${SANS};color:${INK_3}">${escapeHtml(section.empty)}</td></tr>`
    : '';

  return `<tr><td style="padding:0 0 26px">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      ${heading}${paragraphs}${rows}${empty}
    </table>
  </td></tr>`;
}

export function renderEmailHtml(doc: EmailDocument, baseUrl: string, images: EmailImages = {}): string {
  const accent = accentFor(doc.sign);

  // Outlook lays out with Word, which ignores flex — the header is a table.
  const signSrc = doc.sign ? safeImageSrc(images.sign ?? signIconUrl(baseUrl, doc.sign)) : '';
  const disc = signSrc
    ? `<td width="44" style="width:44px;padding:0 14px 0 0"><img src="${signSrc}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border:0;border-radius:50%" /></td>`
    : '';
  const ringSrc = images.ring ? safeImageSrc(images.ring) : '';
  // The brand lockup (DESIGN.md, "Brand Lockup"): the tilted ring, 34 by 19, then ZODIACS · ORG.
  const ring = ringSrc
    ? `<td style="padding:0 10px 0 0;vertical-align:middle"><img src="${ringSrc}" width="34" height="19" alt="" style="display:block;width:34px;height:19px;border:0" /></td>`
    : '';

  const identity = doc.identity
    ? `<div style="font:12px/1.45 ${SANS};color:${INK_3};margin:4px 0 0">${escapeHtml(doc.identity)}</div>`
    : '';

  const intro = doc.intro
    ? `<tr><td style="padding:0 0 24px;font:18px/1.62 ${SERIF};color:${INK_1}">${escapeHtml(doc.intro)}</td></tr>`
    : '';

  const cta = doc.cta && safeUrl(doc.cta.url)
    ? `<tr><td style="padding:6px 0 28px">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
          <td bgcolor="${INK_0}" style="border-radius:999px">
            <a href="${safeUrl(doc.cta.url)}" style="display:inline-block;padding:14px 24px;font:700 14px/1.2 ${SANS};color:${VOID_0};text-decoration:none;border-radius:999px">${escapeHtml(doc.cta.label)}</a>
          </td>
        </tr></table>
      </td></tr>`
    : '';

  const links = (doc.links ?? []).filter((l) => safeUrl(l.url));
  const linkList = links.length
    ? `<tr><td style="padding:0 0 26px;font:14px/1.9 ${SANS};color:${INK_1}">${links
        .map((l) => `<a href="${safeUrl(l.url)}" style="color:${INK_1};text-decoration:underline">${escapeHtml(l.label)}</a>`)
        .join('<br />')}</td></tr>`
    : '';

  const footerLinks = [
    doc.manageUrl && safeUrl(doc.manageUrl)
      ? `<a href="${safeUrl(doc.manageUrl)}" style="color:${INK_1};text-decoration:underline">Manage what you receive</a>`
      : '',
    doc.unsubscribeUrl && safeUrl(doc.unsubscribeUrl)
      ? `<a href="${safeUrl(doc.unsubscribeUrl)}" style="color:${INK_1};text-decoration:underline">Unsubscribe</a>`
      : '',
  ].filter(Boolean).join(' &nbsp;·&nbsp; ');

  const footer = [
    ...doc.footerLines.map((line) => `<div style="margin:0 0 7px">${escapeHtml(line)}</div>`),
    footerLinks ? `<div style="margin:10px 0 0">${footerLinks}</div>` : '',
  ].filter(Boolean).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<title>${escapeHtml(doc.title)}</title>
</head>
<body style="margin:0;padding:0;background:${VOID_0};color:${INK_1};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(doc.preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${VOID_0}" style="background:${VOID_0}">
<tr><td align="center" style="padding:28px 12px 40px">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background:${VOID_1};border:1px solid ${HAIR};border-radius:14px">

<tr><td style="padding:26px 28px 20px;border-bottom:1px solid ${HAIR}">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
    ${disc}
    <td style="vertical-align:middle">
      <div style="font:600 11px/1.4 ${MONO};letter-spacing:.14em;text-transform:uppercase;color:${INK_3}">${escapeHtml(doc.eyebrow)}</div>
      ${identity}
    </td>
    <td align="right" style="vertical-align:middle">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
        ${ring}<td style="vertical-align:middle;font:400 13px/1.2 ${SERIF};letter-spacing:.2em;text-transform:uppercase;color:${INK_0};white-space:nowrap">Zodiacs<span style="margin:0 .2em;color:${INK_3}">·</span><span style="font-weight:500;color:${INK_1}">org</span></td>
      </tr></table>
    </td>
  </tr></table>
</td></tr>

<tr><td style="padding:30px 28px 0">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    <tr><td style="padding:0 0 20px;font:500 27px/1.3 ${SERIF};color:${INK_0}">${escapeHtml(doc.title)}</td></tr>
    ${intro}
    ${doc.sections.map((s) => sectionHtml(s, accent)).join('')}
    ${cta}
    ${linkList}
  </table>
</td></tr>

<tr><td style="padding:20px 28px 26px;border-top:1px solid ${HAIR};font:12px/1.6 ${SANS};color:${INK_3}">
  ${footer}
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

export function renderEmailText(doc: EmailDocument): string {
  const lines: string[] = [doc.eyebrow];
  if (doc.identity) lines.push(doc.identity);
  lines.push('', doc.title, '');
  if (doc.intro) lines.push(doc.intro, '');

  for (const section of doc.sections) {
    if (section.heading) lines.push(section.heading.toUpperCase(), '');
    for (const paragraph of section.paragraphs ?? []) lines.push(paragraph, '');
    const rows = section.rows ?? [];
    for (const row of rows) {
      lines.push(row.label ? `${row.label}: ${row.body}` : row.body);
      if (row.receipt) lines.push(`  ${row.receipt}`);
    }
    if (rows.length) lines.push('');
    if (!rows.length && section.empty) lines.push(section.empty, '');
  }

  if (doc.cta) lines.push(`${doc.cta.label}: ${doc.cta.url}`, '');
  for (const link of doc.links ?? []) lines.push(`${link.label}: ${link.url}`);
  if ((doc.links ?? []).length) lines.push('');

  lines.push(...doc.footerLines);
  if (doc.manageUrl) lines.push(`Manage what you receive: ${doc.manageUrl}`);
  if (doc.unsubscribeUrl) lines.push(`Unsubscribe: ${doc.unsubscribeUrl}`);

  return lines.join('\n');
}
