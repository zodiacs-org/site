import {
  HOUSE_THEME,
  ORDINAL,
  houseLine,
  wholeSignHouseFromAsc,
  type Daily,
  type DailyLine,
} from '../daily';
import {
  publicationForSign,
  type DailyPublication,
} from '../daily-publication';
import {
  singlePublishedEventSign,
  type PublishedEventDescriptor,
} from '../events/publication';
import type { HoroscopeProgram, HoroscopeReading } from '../horoscope-program';
import type { SavedChart } from '../profile/schema';
import { signBySlug, signForLongitude } from '../signs';
import { natalPointsForChart, selectTodayContacts, type TodayContact } from '../today';
import { TRANSIT_ORB, transitLine } from '../transits';
import type { DailyEmailMessage, DailyEmailRecipient } from './types';

interface MessageSection {
  heading?: string;
  paragraphs: string[];
}

interface MessageModel {
  subject: string;
  preheader: string;
  identity: string;
  identityDetail?: string;
  title: string;
  welcome?: string;
  sign?: string;
  signName?: string;
  sections: MessageSection[];
  why?: string;
  cta: { label: string; url: string };
  nearbyEvent?: { title: string; summary: string; separator?: string; url: string };
  footerLines: string[];
  manageUrl?: string;
  unsubscribeUrl: string;
  postalAddress: string;
}

const HOUSE_SUBJECT_THEMES: Record<number, string> = {
  1: 'your presence leads the day',
  2: 'money and values take focus',
  3: 'messages come to the front',
  4: 'home asks for your attention',
  5: 'creative life takes the lead',
  6: 'routines ask for adjustment',
  7: 'relationships come into focus',
  8: 'shared matters need attention',
  9: 'the wider view calls',
  10: 'public priorities take focus',
  11: 'friends and plans come forward',
  12: 'quiet work matters most',
};

function baseOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Daily email base URL must use HTTPS.');
  return url.origin;
}

function siteUrl(baseUrl: string, path: string): string {
  return new URL(path, `${baseOrigin(baseUrl)}/`).toString();
}

function dateLabel(day: string, weekday = false): string {
  return new Intl.DateTimeFormat('en', {
    ...(weekday ? { weekday: 'long' as const } : {}),
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00.000Z`));
}

function readingForSign(program: HoroscopeProgram, sign: string): HoroscopeReading {
  const reading = program.signs.find((entry) => entry.sign === sign)?.readings.today;
  if (!reading
    || reading.status !== 'publishable'
    || reading.period.from !== program.anchorDate
    || reading.period.through !== program.anchorDate) {
    throw new Error(`No publishable daily horoscope for ${sign}.`);
  }
  return reading;
}

export function validateDailyEmailSources({
  daily,
  publication,
  program,
}: {
  daily: Daily;
  publication: DailyPublication;
  program: HoroscopeProgram;
}): void {
  const date = publication.date;
  if (daily.date !== date || program.anchorDate !== date) {
    throw new Error('Daily email sources do not share the exact committed edition date.');
  }
  if (daily.schema !== 'zodiacs.daily-facts.v1'
    || publication.schema !== 'zodiacs.daily-publication.v1'
    || program.schema !== 'zodiacs.horoscope-program.v1'
    || publication.locale !== 'en'
    || program.locale !== 'en') {
    throw new Error('Daily email sources are not the approved English publication package.');
  }
  for (const entry of publication.signs) {
    const published = publicationForSign(publication, entry.sign);
    const reading = readingForSign(program, entry.sign);
    if (!published || !published.todayLine.text || !reading.text) {
      throw new Error(`Daily email source is incomplete for ${entry.sign}.`);
    }
  }
  if (publication.signs.length !== 12 || program.signs.length !== 12) {
    throw new Error('Daily email sources must contain all twelve signs.');
  }
}

function chartSunSign(recipient: Extract<DailyEmailRecipient, { tier: 'chart' }>): string | null {
  if (recipient.chart.birth.timeKnown !== true) return null;
  const sun = recipient.chart.summary.bodies.find((body) => body.body === 'Sun');
  return sun && Number.isFinite(sun.lon) ? signForLongitude(sun.lon).slug : null;
}

function chartAscendantSign(chart: SavedChart): string | null {
  if (!chart.birth.timeKnown) return null;
  const ascendant = chart.summary.angles?.asc;
  return Number.isFinite(ascendant) ? signForLongitude(Number(ascendant)).slug : null;
}

function chartName(value: string): string {
  const normalized = value.replace(/[\r\n\t]+/gu, ' ').replace(/\s{2,}/gu, ' ').trim();
  return normalized.slice(0, 120) || 'Your chart';
}

function cleanPostalAddress(value: string): string {
  return value.replace(/[\r\n\t]+/gu, ' ').replace(/\s{2,}/gu, ' ').trim().slice(0, 240);
}

function withExactTime(line: DailyLine): string {
  const time = /\bexact (\d{2}:\d{2} UTC)$/u.exec(line.receipt)?.[1];
  if (!time || line.text.includes(time)) return line.text;
  return `${line.text.replace(/[.]$/u, '')}: ${time}.`;
}

function sunModel(
  recipient: Extract<DailyEmailRecipient, { tier: 'sun_sign' }>,
  publication: DailyPublication,
  baseUrl: string,
  unsubscribeUrl: string,
  postalAddress: string,
): MessageModel {
  const sign = signBySlug(recipient.sign);
  const published = publicationForSign(publication, sign.slug);
  if (!published) throw new Error(`No published daily email source for ${sign.slug}.`);
  const collective = published.lines
    .filter((line) => line.scope === 'collective')
    .map(withExactTime);
  const subjectTheme = HOUSE_SUBJECT_THEMES[published.todayLine.house ?? 0]
    ?? published.todayLine.text.replace(/^Today (?:may )?/u, '').replace(/[.]$/u, '').slice(0, 72);
  return {
    subject: `${sign.name} today — ${subjectTheme}`,
    preheader: [published.headline, collective[0]].filter(Boolean).join(' '),
    identity: `${sign.name.toUpperCase()} · ${dateLabel(publication.date, true).toUpperCase()}`,
    title: published.headline,
    sign: sign.slug,
    signName: sign.name,
    sections: collective.length ? [{ paragraphs: collective }] : [],
    cta: {
      label: `Read the full ${sign.name} daily`,
      url: siteUrl(baseUrl, `/horoscopes/${sign.slug}/`),
    },
    footerLines: [
      `You asked for the ${sign.name} daily at zodiacs.org.`,
      'Your email and your chosen sign are all we store — never birth details.',
    ],
    unsubscribeUrl,
    postalAddress,
  };
}

function chartBirthSummary(chart: SavedChart): string {
  const parts = [dateLabel(chart.birth.date)];
  if (chart.birth.timeKnown && chart.birth.time) {
    const [hour, minute] = chart.birth.time.split(':').map(Number);
    if (Number.isInteger(hour) && Number.isInteger(minute)) {
      const suffix = hour >= 12 ? 'PM' : 'AM';
      parts.push(`${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`);
    }
  }
  if (chart.birth.place?.name) parts.push(chart.birth.place.name);
  return parts.join(' · ');
}

function nearbyChartEventTitle(event: PublishedEventDescriptor): string {
  const title = event.title.replace(/\s+—\s+.*$/u, '').trim();
  const date = new Intl.DateTimeFormat('en', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(event.anchor));
  return `${title} on ${date}`;
}

function degreeLabel(longitude: number): string {
  const sign = signForLongitude(longitude);
  const within = ((longitude % 30) + 30) % 30;
  let degree = Math.floor(within);
  let minute = Math.round((within - degree) * 60);
  if (minute === 60) {
    degree += 1;
    minute = 0;
  }
  return `${degree}°${String(minute).padStart(2, '0')}′ ${sign.name}`;
}

function contactSubject(contact: TodayContact): string {
  const verb: Record<TodayContact['type'], string> = {
    conjunction: 'reaches',
    sextile: 'opens for',
    square: 'challenges',
    trine: 'supports',
    opposition: 'faces',
  };
  return `${contact.transiting} ${verb[contact.type]} your natal ${contact.natal}`;
}

function contactReceipt(contact: TodayContact, methodologyUrl: string): string {
  return `${contact.transiting} ${degreeLabel(contact.transitingLon)} · your natal ${contact.natal} ${degreeLabel(contact.natalLon)} · ${contact.type} · ${contact.orb.toFixed(2)}° orb · method → ${methodologyUrl}`;
}

function chartModel(
  recipient: Extract<DailyEmailRecipient, { tier: 'chart' }>,
  daily: Daily,
  publication: DailyPublication,
  program: HoroscopeProgram,
  baseUrl: string,
  unsubscribeUrl: string,
  postalAddress: string,
): MessageModel {
  const name = chartName(recipient.chart.name);
  const referenceOnly = recipient.chart.birth.timeKnown !== true;
  const referenceNotice = 'Birth time is unknown. These are reference-moment positions; the Sun sign has not been verified across the whole birth date.';
  const contacts = selectTodayContacts(
    natalPointsForChart(recipient.chart),
    daily.bodies,
    TRANSIT_ORB,
    3,
  );
  const quiet = 'Today looks quieter against your chart. There is less pressure to act on anything immediately.';
  const personal = contacts.length
    ? contacts.map((contact) => transitLine(contact.transiting, contact.type, contact.natal))
    : [quiet];
  const signSlug = chartSunSign(recipient);
  const ascendantSign = chartAscendantSign(recipient.chart);
  const sections: MessageSection[] = [];
  if (personal.length > 1) sections.push({ paragraphs: personal.slice(1) });
  if (contacts.length === 0 && signSlug) {
    const baseline = readingForSign(program, signSlug);
    sections.push({
      heading: `${signBySlug(signSlug).name} Sun-sign baseline`,
      paragraphs: [baseline.passages[0].text],
    });
  }
  const sharedSky: string[] = [];
  const moon = ascendantSign
    ? daily.bodies.find((body) => body.body === 'Moon' && Number.isFinite(body.lon))
    : null;
  if (moon && ascendantSign) {
    sharedSky.push(houseLine(
      moon,
      wholeSignHouseFromAsc(moon.sign, ascendantSign),
    ).text);
  }
  const collective = publication.signs[0]?.lines.find((line) => line.scope === 'collective');
  if (collective) sharedSky.push(`Sky-wide: ${withExactTime(collective)}`);
  if (sharedSky.length) sections.push({ paragraphs: sharedSky });
  const strongest = contacts[0];
  return {
    subject: strongest
      ? `${referenceOnly ? 'Your reference chart' : 'Your chart'} today — ${contactSubject(strongest)}`
      : `${referenceOnly ? 'Your reference chart' : 'Your chart'} today — a quieter sky`,
    preheader: [referenceOnly ? referenceNotice : null, personal[0], sharedSky[0]].filter(Boolean).join(' '),
    identity: `FOR ${name.toUpperCase()} · ${dateLabel(program.anchorDate, true).toUpperCase()}`,
    identityDetail: [chartBirthSummary(recipient.chart), referenceOnly ? referenceNotice : null].filter(Boolean).join(' · '),
    title: personal[0],
    sections,
    ...(strongest ? {
      why: contactReceipt(strongest, siteUrl(baseUrl, '/methodology/')),
    } : {}),
    cta: { label: 'Open your full brief', url: siteUrl(baseUrl, '/today/') },
    footerLines: [`This brief reads ${name}, the chart you chose to sync.`],
    manageUrl: siteUrl(baseUrl, '/profile/#daily-brief'),
    unsubscribeUrl,
    postalAddress,
  };
}

/** Opens a recipient's first daily email, which may come weeks after they signed up. */
export const FIRST_DELIVERY_WELCOME = 'This is your first daily email from Zodiacs.org, the one you signed up for. If you would rather not get them, use the Unsubscribe link at the bottom.';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function textFromModel(model: MessageModel): string {
  const lines = [model.identity];
  if (model.identityDetail) lines.push(model.identityDetail);
  lines.push('');
  if (model.welcome) lines.push(model.welcome, '');
  lines.push(model.title, '');
  for (const section of model.sections) {
    if (section.heading) lines.push(section.heading, '');
    for (const paragraph of section.paragraphs) lines.push(paragraph, '');
  }
  if (model.why) lines.push(`Why this appeared: ${model.why}`, '');
  if (model.nearbyEvent) {
    lines.push(
      `Ahead: ${model.nearbyEvent.title}${model.nearbyEvent.separator ?? ' — '}${model.nearbyEvent.summary}`,
      model.nearbyEvent.url,
      '',
    );
  }
  lines.push(`${model.cta.label}:`, model.cta.url, '', '—');
  for (const line of model.footerLines) lines.push(line);
  if (model.manageUrl) lines.push(`Manage: ${model.manageUrl}`);
  lines.push(`Unsubscribe: ${model.unsubscribeUrl}`, model.postalAddress);
  return lines.join('\n');
}

function htmlFromModel(model: MessageModel, baseUrl: string): string {
  const sections = model.sections.map((section) => `
    <section style="margin:0 0 26px">
      ${section.heading ? `<h2 style="font:600 12px/1.35 system-ui,-apple-system,sans-serif;letter-spacing:.1em;text-transform:uppercase;margin:0 0 10px;color:#7A8397">${escapeHtml(section.heading)}</h2>` : ''}
      ${section.paragraphs.map((paragraph) => `<p style="font:18px/1.58 Georgia,serif;margin:0 0 14px;color:#C6CCDA">${escapeHtml(paragraph)}</p>`).join('')}
    </section>`).join('');
  const event = model.nearbyEvent ? `
    <section style="border-top:1px solid #26282E;padding-top:18px;margin:4px 0 26px">
      <p style="font:14px/1.55 system-ui,-apple-system,sans-serif;margin:0;color:#C6CCDA"><strong style="color:#EEF1F7">Ahead: ${escapeHtml(model.nearbyEvent.title)}</strong>${escapeHtml(model.nearbyEvent.separator ?? ' — ')}${escapeHtml(model.nearbyEvent.summary)} <a href="${escapeHtml(model.nearbyEvent.url)}" style="color:#EEF1F7">Read the event</a></p>
    </section>` : '';
  // PNG, not WebP: Outlook on Windows and several older clients decode
  // neither WebP nor AVIF, and a broken disc is worse than no disc.
  const signIcon = model.sign ? `
        <img src="${escapeHtml(siteUrl(baseUrl, `/assets/zodiac-icons/128/${model.sign}.png`))}" width="44" height="44" alt="${escapeHtml(model.signName ?? '')}" style="display:block;width:44px;height:44px;border:0;border-radius:50%" />` : '';
  const detail = model.identityDetail
    ? `<p style="font:12px/1.45 system-ui,-apple-system,sans-serif;margin:6px 0 0;color:#7A8397">${escapeHtml(model.identityDetail)}</p>`
    : '';
  const why = model.why
    ? `<p style="font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0 0 26px;color:#7A8397">Why this appeared: ${escapeHtml(model.why)}</p>`
    : '';
  const footer = model.footerLines.map((line) => `<p style="margin:0 0 7px">${escapeHtml(line)}</p>`).join('');
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
  <body bgcolor="#060709" style="margin:0;background:#060709;color:#C6CCDA">
    <span style="display:none!important;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden">${escapeHtml(model.preheader)}</span>
    <main bgcolor="#060709" style="box-sizing:border-box;max-width:600px;margin:0 auto;background:#060709;padding:36px 24px 44px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-bottom:1px solid #26282E;padding:0 0 22px;margin:0 0 28px">
        <tr>
          ${signIcon ? `<td width="58" style="width:58px;vertical-align:middle;padding:0 14px 22px 0">${signIcon}</td>` : ''}
          <td style="vertical-align:middle;padding:0 0 22px"><p style="font:600 11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;margin:0;color:#7A8397">${escapeHtml(model.identity)}</p>${detail}</td>
          <td align="right" style="vertical-align:middle;padding:0 0 22px"><p style="font:600 13px/1.2 Georgia,serif;margin:0;color:#EEF1F7;white-space:nowrap">Zodiacs.org</p></td>
        </tr>
      </table>
      ${model.welcome ? `<p style="font:14px/1.55 system-ui,-apple-system,sans-serif;margin:0 0 24px;padding:14px 16px;border:1px solid #26282E;border-radius:12px;color:#C6CCDA">${escapeHtml(model.welcome)}</p>` : ''}
      <h1 style="font:500 27px/1.34 Georgia,serif;margin:0 0 22px;color:#EEF1F7">${escapeHtml(model.title)}</h1>
      ${sections}
      ${why}
      ${event}
      <p style="margin:0 0 34px"><a href="${escapeHtml(model.cta.url)}" style="display:inline-block;background:#EEF1F7;color:#060709;text-decoration:none;font:700 14px/1.2 system-ui,-apple-system,sans-serif;padding:14px 18px;border-radius:999px">${escapeHtml(model.cta.label)}</a></p>
      <footer style="border-top:1px solid #26282E;padding-top:20px;color:#7A8397;font:12px/1.55 system-ui,-apple-system,sans-serif">
        ${footer}
        ${model.manageUrl ? `<p style="margin:0 0 7px"><a href="${escapeHtml(model.manageUrl)}" style="color:#C6CCDA">Manage</a></p>` : ''}
        <p style="margin:0 0 7px"><a href="${escapeHtml(model.unsubscribeUrl)}" style="color:#C6CCDA">Unsubscribe</a></p>
        <p style="margin:0">${escapeHtml(model.postalAddress)}</p>
      </footer>
    </main>
  </body>
</html>`;
}

export function renderDailyEmail({
  recipient,
  daily,
  publication,
  program,
  nearbyEvent,
  baseUrl,
  unsubscribeUrl,
  senderPostalAddress,
  firstDelivery = false,
}: {
  recipient: DailyEmailRecipient;
  daily: Daily;
  publication: DailyPublication;
  program: HoroscopeProgram;
  nearbyEvent?: PublishedEventDescriptor | null;
  baseUrl: string;
  unsubscribeUrl: string;
  senderPostalAddress?: string;
  /** No earlier daily email reached this recipient. */
  firstDelivery?: boolean;
}): DailyEmailMessage {
  validateDailyEmailSources({ daily, publication, program });
  const postalAddress = cleanPostalAddress(senderPostalAddress ?? 'Zodiacs.org · Postal address configured for live sends');
  if (!postalAddress) throw new Error('Daily email sender postal address is required.');
  const model = recipient.tier === 'sun_sign'
    ? sunModel(recipient, publication, baseUrl, unsubscribeUrl, postalAddress)
    : chartModel(recipient, daily, publication, program, baseUrl, unsubscribeUrl, postalAddress);
  if (firstDelivery) model.welcome = FIRST_DELIVERY_WELCOME;
  if (nearbyEvent && nearbyEvent.anchor.slice(0, 10) > publication.date) {
    if (recipient.tier === 'sun_sign') {
      model.nearbyEvent = {
        title: nearbyEvent.title,
        summary: nearbyEvent.summary,
        url: siteUrl(baseUrl, nearbyEvent.path),
      };
    } else {
      const ascendantSign = chartAscendantSign(recipient.chart);
      const eventSign = singlePublishedEventSign(nearbyEvent);
      if (ascendantSign && eventSign) {
        try {
          signBySlug(eventSign);
          const house = wholeSignHouseFromAsc(eventSign, ascendantSign);
          model.nearbyEvent = {
            title: nearbyChartEventTitle(nearbyEvent),
            summary: `falls in your ${ORDINAL[house]} house — a checkpoint for ${HOUSE_THEME[house]}.`,
            separator: ' ',
            url: siteUrl(baseUrl, nearbyEvent.path),
          };
        } catch {
          // Without a canonical event sign, there is no declared whole-sign derivation.
        }
      }
    }
  }
  return {
    subject: model.subject,
    preheader: model.preheader,
    text: textFromModel(model),
    html: htmlFromModel(model, baseUrl),
    unsubscribeUrl,
  };
}
