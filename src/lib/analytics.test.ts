import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ANALYTICS_EVENT_PROPS,
  ANALYTICS_EVENT_VALUES,
  sanitizeAnalyticsProperties,
  trackAnalytics,
} from './analytics';

const REQUIRED_EVENTS = [
  'chart_computed',
  'chart_saved',
  'compat_computed',
  'email_subscribed',
  'share_card_downloaded',
  'widget_embed_copied',
  'registry_visit',
  'registry_bridge_impression',
  'registry_bridge_click',
  'verifier_used',
  'terminal_view_switch',
  'sdk_click',
  'bio_click',
  'wallet_chart_computed',
  'aura_view',
  'aura_compose',
  'aura_share',
  'aura_refresh',
  'aura_calculator',
  'aura_entry',
  'aura_return',
  'aura_response',
  'aura_cabinet_select',
  'aura_cabinet_reveal',
  'aura_talisman_personalize',
  'invite_created',
  'invite_opened',
  'invite_completed',
  'invite_returned',
  'invite_converted',
  'invite_revoked',
  'context_help_opened',
  'first_reading_prompt',
  'first_reading_step',
  'first_reading_completed',
  'next_action_clicked',
  'email_capture_viewed',
  'living_chart_open',
  'living_chart_saved',
  'living_chart_deleted',
  'living_chart_export',
  'good_day_check',
  'good_day_calendar_add',
  'year_score_completed',
  'year_pack_cta',
  'year_pack_unlocked',
  'birthday_card_made',
  'birthday_card_arrival',
  'birthday_reminder_added',
  'birthday_gift_cta',
] as const;

// The events the growth tests read (docs/ANALYTICS.md, "Growth test events"),
// with the two email events whose placements and source they widen.
const GROWTH_EVENTS = [
  'email_capture_viewed',
  'email_subscribed',
  'good_day_check',
  'good_day_calendar_add',
  'year_score_completed',
  'year_pack_cta',
  'year_pack_unlocked',
  'birthday_card_made',
  'birthday_card_arrival',
  'birthday_reminder_added',
  'birthday_gift_cta',
] as const;

const SIGNS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const ARRIVAL_SOURCES = ['direct', 'video', 'chatgpt', 'assistant', 'card', 'app', 'note'];

// Everything a visitor could be told apart by, or could have typed.
const PERSONAL_FIELDS = {
  email: 'visitor@example.com',
  sign: 'leo',
  sun: 'leo',
  sunSign: 'leo',
  sun_sign: 'leo',
  moonSign: 'cancer',
  rising: 'virgo',
  birthDate: '1990-01-01',
  birth_date: '1990-01-01',
  date: '1990-01-01',
  birthTime: '12:34',
  time: '12:34',
  birthPlace: 'Bangkok',
  place: 'Bangkok',
  city: 'Bangkok',
  latitude: 13.75,
  longitude: 100.5,
  timeZone: 'Asia/Bangkok',
  name: 'Ada',
  firstName: 'Ada',
  recipient: 'Ada',
  text: 'anything typed',
  message: 'anything typed',
  query: 'anything typed',
  ref: 'free-string-from-a-link',
  url: '/birthday/?d=0101',
  id: 'abc123',
  visitorId: 'abc123',
  count: 7,
};

// Words that would name a property able to hold one of the fields above.
const PERSONAL_WORDS = new Set([
  'email', 'mail', 'address', 'sign', 'sun', 'moon', 'rising', 'ascendant', 'zodiac',
  'birth', 'birthday', 'dob', 'date', 'day', 'month', 'year', 'time', 'hour', 'minute',
  'place', 'city', 'country', 'location', 'lat', 'latitude', 'lon', 'lng', 'longitude', 'zone', 'tz',
  'name', 'first', 'last', 'recipient', 'person', 'text', 'message', 'query', 'search', 'note',
  'url', 'href', 'link', 'ref', 'id', 'uuid', 'visitor', 'user', 'session', 'device', 'token',
]);
// Splits a property name into its words: `birth_date`, `birthDate` and `BirthDate` give birth, date.
const wordsOf = (key: string) => key
  .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
  .split(/[^A-Za-z0-9]+/u)
  .filter(Boolean)
  .map((word) => word.toLowerCase());

describe('analytics event contract', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('contains every directive event', () => {
    for (const name of REQUIRED_EVENTS) expect(ANALYTICS_EVENT_PROPS).toHaveProperty(name);
  });

  it('never permits identity or exact-sign properties on Aura events', () => {
    expect(sanitizeAnalyticsProperties('aura_compose', {
      outcome: 'success',
      held_bucket: '2-5',
      address: '0x1111111111111111111111111111111111111111',
      chart_id: 'private',
      held_signs: 'aries,leo',
      clicked_sign: 'leo',
    })).toEqual({ outcome: 'success', held_bucket: '2-5' });
    expect(sanitizeAnalyticsProperties('aura_cabinet_reveal', {
      outcome: 'played',
      sign: 'aries',
      finish: 'gold',
      amount: '1000000',
    })).toEqual({ outcome: 'played' });
  });

  it('sanitizes the payload at the actual browser emission boundary', () => {
    const track = vi.fn();
    vi.stubGlobal('window', { zodiacsAnalytics: { track } });
    trackAnalytics('aura_compose', {
      outcome: 'success',
      held_bucket: '6-12',
      address: '0x1111111111111111111111111111111111111111',
      chart_id: 'private',
    });
    expect(track).toHaveBeenCalledWith('aura_compose', {
      outcome: 'success',
      held_bucket: '6-12',
    });
  });

  it('counts an arrival from an assistant link by the name of the assistant only', () => {
    expect(sanitizeAnalyticsProperties('assistant_arrival', { assistant: 'chatgpt', url: '/birth-chart/?x' })).toEqual({ assistant: 'chatgpt' });
    expect(sanitizeAnalyticsProperties('assistant_arrival', { assistant: 'someone-else' })).toEqual({});
  });

  it('drops unknown events rather than forwarding them', () => {
    expect(sanitizeAnalyticsProperties('birth_details', { date: '1990-01-01' })).toBeNull();
  });

  it('keeps only short, explicitly allowed scalar properties', () => {
    expect(sanitizeAnalyticsProperties('verifier_used', {
      chain: 'solana',
      outcome: 'not_found',
      address: 'never-forward-an-address',
      chainObject: { name: 'solana' },
    })).toEqual({ chain: 'solana', outcome: 'not_found' });
    expect(sanitizeAnalyticsProperties('sdk_click', {
      source: 'registry',
      destination: 'x'.repeat(33),
    })).toEqual({ source: 'registry' });
  });

  it('keeps bio attribution aggregate-only and inside fixed destinations', () => {
    expect(sanitizeAnalyticsProperties('bio_click', {
      destination: 'birth_chart',
      href: '/birth-chart/?private=1',
      visitor: 'private',
    })).toEqual({ destination: 'birth_chart' });
    expect(sanitizeAnalyticsProperties('bio_click', {
      destination: 'custom-link',
    })).toEqual({});
  });

  it('keeps beginner-guidance events useful without accepting chart data', () => {
    expect(sanitizeAnalyticsProperties('context_help_opened', {
      term: 'whole-sign-houses',
      surface: 'chart-form',
      birthDate: '1990-01-01',
    })).toEqual({ term: 'whole-sign-houses', surface: 'chart-form' });
    expect(sanitizeAnalyticsProperties('next_action_clicked', {
      state: 'saved',
      action: 'today',
      chartId: 'private',
    })).toEqual({ state: 'saved', action: 'today' });
  });

  it('keeps Registry bridge measurement aggregate-only and inside fixed enums', () => {
    const privateFields = {
      birthDate: '1990-01-01',
      birthTime: '12:34',
      place: 'Bangkok',
      timeZone: 'Asia/Bangkok',
      latitude: 13.75,
      longitude: 100.5,
      chartId: 'private',
      href: '/registry/leo/?private=1',
    };
    expect(sanitizeAnalyticsProperties('registry_bridge_impression', {
      sign: 'leo',
      surface: 'birth_chart',
      locale: 'en',
      ...privateFields,
    })).toEqual({ sign: 'leo', surface: 'birth_chart', locale: 'en' });
    expect(sanitizeAnalyticsProperties('registry_bridge_click', {
      sign: 'pisces',
      surface: 'birthday',
      locale: 'fr',
      ...privateFields,
    })).toEqual({ sign: 'pisces', surface: 'birthday', locale: 'fr' });
    expect(sanitizeAnalyticsProperties('registry_bridge_impression', {
      sign: 'ophiuchus',
      surface: 'custom-page',
      locale: 'visitor@example.com',
    })).toEqual({});
  });

  it('scrubs Registry bridge payloads at the actual browser emission boundary', () => {
    const track = vi.fn();
    vi.stubGlobal('window', { zodiacsAnalytics: { track } });
    trackAnalytics('registry_bridge_click', {
      sign: 'aries',
      surface: 'sign_guide',
      locale: 'pt',
      date: '2026-03-20',
      time: '22:15',
      place: 'Bangkok',
      chartId: 'private',
    });
    expect(track).toHaveBeenCalledWith('registry_bridge_click', {
      sign: 'aries',
      surface: 'sign_guide',
      locale: 'pt',
    });
  });

  it('keeps sharing-loop analytics inside fixed, non-identifying enums', () => {
    expect(sanitizeAnalyticsProperties('chart_computed', {
      mode: 'full',
      source: 'shared_positions',
      token: 'never',
    })).toEqual({ mode: 'full', source: 'shared_positions' });
    expect(sanitizeAnalyticsProperties('chart_computed', {
      mode: 'full',
      source: 'link-from-a-friend',
    })).toEqual({ mode: 'full' });
    expect(sanitizeAnalyticsProperties('chart_share', {
      variant: 'positions_link',
      token: 'never',
    })).toEqual({ variant: 'positions_link' });
    expect(sanitizeAnalyticsProperties('chart_share', {
      variant: 'custom-link-from-a-friend',
    })).toEqual({});
    expect(sanitizeAnalyticsProperties('invite_created', {
      notify: true,
      token: 'never',
      label: 'never',
    })).toEqual({ notify: true });
    expect(sanitizeAnalyticsProperties('invite_opened', {
      state: 'ready',
      sign: 'cancer',
    })).toEqual({ state: 'ready' });
    expect(sanitizeAnalyticsProperties('invite_opened', {
      state: 'owner@example.com',
    })).toEqual({});
    expect(sanitizeAnalyticsProperties('invite_returned', {
      method: 'copy',
      url: 'never',
    })).toEqual({ method: 'copy' });
  });

  it('keeps Living Chart analytics content-free and inside fixed enums', () => {
    expect(sanitizeAnalyticsProperties('living_chart_open', {
      source: 'today',
      chartId: 'private',
      note: 'never-forward-note-content',
    })).toEqual({ source: 'today' });
    expect(sanitizeAnalyticsProperties('living_chart_open', {
      source: 'profile',
      momentId: 'private',
    })).toEqual({ source: 'profile' });
    expect(sanitizeAnalyticsProperties('living_chart_open', { source: 'home' })).toEqual({});

    expect(sanitizeAnalyticsProperties('living_chart_saved', {
      mode: 'active',
      date: '2026-08-18',
      text: 'never-forward-reading-content',
    })).toEqual({ mode: 'active' });
    expect(sanitizeAnalyticsProperties('living_chart_saved', { mode: 'quiet' })).toEqual({ mode: 'quiet' });
    expect(sanitizeAnalyticsProperties('living_chart_saved', { mode: 'private' })).toEqual({});

    expect(sanitizeAnalyticsProperties('living_chart_deleted', {
      id: 'private',
      note: 'never',
    })).toEqual({});
    expect(sanitizeAnalyticsProperties('living_chart_export', {
      format: 'json',
      filename: 'private.json',
      contents: 'never',
    })).toEqual({ format: 'json' });
    expect(sanitizeAnalyticsProperties('living_chart_export', { format: 'markdown' })).toEqual({
      format: 'markdown',
    });
    expect(sanitizeAnalyticsProperties('living_chart_export', { format: 'csv' })).toEqual({});
  });

  it('scrubs Living Chart content at the actual browser emission boundary', () => {
    const track = vi.fn();
    vi.stubGlobal('window', { zodiacsAnalytics: { track } });
    trackAnalytics('living_chart_saved', {
      mode: 'active',
      note: 'never-forward-note-content',
      momentId: 'never-forward-a-record-id',
    });
    expect(track).toHaveBeenCalledWith('living_chart_saved', { mode: 'active' });
  });

  it('keeps Terminal view switches inside the fixed surface and direction enums', () => {
    expect(sanitizeAnalyticsProperties('terminal_view_switch', {
      surface: 'header',
      direction: 'consumer_to_pro',
      url: '/terminal/pro/',
    })).toEqual({ surface: 'header', direction: 'consumer_to_pro' });
    expect(sanitizeAnalyticsProperties('terminal_view_switch', {
      surface: 'preference_banner',
      direction: 'consumer_to_pro',
    })).toEqual({ surface: 'preference_banner', direction: 'consumer_to_pro' });
    expect(sanitizeAnalyticsProperties('terminal_view_switch', {
      surface: 'consumer',
      direction: 'to_pro',
    })).toEqual({});
  });

  it('accepts the new email placements and a source from the closed arrival list', () => {
    for (const event of ['email_capture_viewed', 'email_subscribed']) {
      for (const placement of ['chart', 'horoscopes', 'footer', 'note_page', 'good_days', 'year_score', 'birthday_card']) {
        for (const source of ARRIVAL_SOURCES) {
          expect(sanitizeAnalyticsProperties(event, { placement, source })).toEqual({ placement, source });
        }
      }
      expect(sanitizeAnalyticsProperties(event, { placement: 'unknown', source: 'newsletter' })).toEqual({});
      expect(sanitizeAnalyticsProperties(event, {
        placement: 'good_days',
        source: 'video',
        email: 'visitor@example.com',
        sign: 'leo',
      })).toEqual({ placement: 'good_days', source: 'video' });
    }
  });

  it('keeps each growth event inside its closed values', () => {
    expect(sanitizeAnalyticsProperties('good_day_check', { use: 'first', source: 'note' }))
      .toEqual({ use: 'first', source: 'note' });
    expect(sanitizeAnalyticsProperties('good_day_check', { use: 'second', source: 'direct' }))
      .toEqual({ use: 'second', source: 'direct' });
    expect(sanitizeAnalyticsProperties('good_day_check', { use: 'more', source: 'app' }))
      .toEqual({ use: 'more', source: 'app' });
    expect(sanitizeAnalyticsProperties('good_day_check', { use: 3, source: 'tiktok' })).toEqual({});
    expect(sanitizeAnalyticsProperties('good_day_check', { use: 'fourth' })).toEqual({});
    expect(sanitizeAnalyticsProperties('good_day_calendar_add', { source: 'card' })).toEqual({ source: 'card' });
    expect(sanitizeAnalyticsProperties('good_day_calendar_add', { source: 'email' })).toEqual({});
    expect(sanitizeAnalyticsProperties('year_score_completed', { score: 72, sign: 'leo' })).toEqual({});
    for (const surface of ['year_score', 'year_sky', 'birthday_report', 'birthday_card']) {
      expect(sanitizeAnalyticsProperties('year_pack_cta', { surface })).toEqual({ surface });
    }
    expect(sanitizeAnalyticsProperties('year_pack_cta', { surface: 'checkout' })).toEqual({});
    expect(sanitizeAnalyticsProperties('year_pack_unlocked', { kind: 'self' })).toEqual({ kind: 'self' });
    expect(sanitizeAnalyticsProperties('year_pack_unlocked', { kind: 'gift', price: 9 })).toEqual({ kind: 'gift' });
    expect(sanitizeAnalyticsProperties('year_pack_unlocked', { kind: 'child' })).toEqual({});
    expect(sanitizeAnalyticsProperties('birthday_card_made', { source: 'direct' })).toEqual({ source: 'direct' });
    expect(sanitizeAnalyticsProperties('birthday_card_made', { source: 'card' })).toEqual({ source: 'card' });
    expect(sanitizeAnalyticsProperties('birthday_card_made', { source: 'video' })).toEqual({});
    for (const event of ['birthday_card_arrival', 'birthday_reminder_added', 'birthday_gift_cta']) {
      expect(sanitizeAnalyticsProperties(event, { source: 'card', month: 1, day: 1 })).toEqual({});
    }
  });

  it('drops unknown growth events, unknown values and strings over 32 characters', () => {
    for (const name of ['good_day', 'year_pack_purchased', 'birthday_card_opened', 'good_day_check ']) {
      expect(sanitizeAnalyticsProperties(name, { use: 'first' })).toBeNull();
    }
    const long = 'x'.repeat(33);
    for (const event of GROWTH_EVENTS) {
      const props = ANALYTICS_EVENT_PROPS[event];
      expect(sanitizeAnalyticsProperties(event, Object.fromEntries(props.map((key) => [key, long])))).toEqual({});
      expect(sanitizeAnalyticsProperties(event, Object.fromEntries(props.map((key) => [key, 'unknown_value'])))).toEqual({});
      expect(sanitizeAnalyticsProperties(event, Object.fromEntries(props.map((key) => [key, 1])))).toEqual({});
      expect(sanitizeAnalyticsProperties(event, Object.fromEntries(props.map((key) => [key, true])))).toEqual({});
    }
  });

  it('gives no growth event a way to carry an email, a sign, birth details, a name or typed text', () => {
    for (const event of GROWTH_EVENTS) {
      const props = ANALYTICS_EVENT_PROPS[event];
      expect(props, event).toBeDefined();
      for (const key of props) {
        // No property is named for anything personal.
        for (const word of wordsOf(key)) expect(PERSONAL_WORDS.has(word), `${event}.${key}`).toBe(false);
        // Every property has a closed list, so no free string can pass.
        const values = ANALYTICS_EVENT_VALUES[event]?.[key];
        expect(values, `${event}.${key} needs a closed list`).toBeDefined();
        for (const value of values ?? []) {
          // No closed value is a sign, a date, a time, an email or long enough to be typed text.
          expect(SIGNS, `${event}.${key}=${value}`).not.toContain(value.toLowerCase());
          expect(value, `${event}.${key}`).toMatch(/^[a-z][a-z_]{0,31}$/u);
          expect(value, `${event}.${key}`).not.toMatch(/@|\d/u);
        }
      }
      // Whatever a page passes, the personal fields never come through.
      const safe = sanitizeAnalyticsProperties(event, PERSONAL_FIELDS);
      expect(safe, event).toEqual({});
    }
  });

  it('names no property of any event for an email, birth details, a name or typed text', () => {
    // Some older events carry a page's sign slug (Registry bridge, Race); none
    // can carry the visitor's own details.
    const olderCarveOuts = new Set(['sign']);
    for (const [event, props] of Object.entries(ANALYTICS_EVENT_PROPS)) {
      for (const key of props) {
        for (const word of wordsOf(key)) {
          if (olderCarveOuts.has(word)) continue;
          expect(PERSONAL_WORDS.has(word), `${event}.${key}`).toBe(false);
        }
      }
    }
    expect(wordsOf('birthDate')).toEqual(['birth', 'date']);
    expect(wordsOf('sun_sign')).toEqual(['sun', 'sign']);
  });

  it('scrubs growth payloads at the actual browser emission boundary', () => {
    const track = vi.fn();
    vi.stubGlobal('window', { zodiacsAnalytics: { track } });
    trackAnalytics('good_day_check', { use: 'second', source: 'video', ...PERSONAL_FIELDS });
    expect(track).toHaveBeenCalledWith('good_day_check', { use: 'second', source: 'video' });
    trackAnalytics('birthday_card_made', { source: 'card', ...PERSONAL_FIELDS });
    expect(track).toHaveBeenCalledWith('birthday_card_made', { source: 'card' });
    trackAnalytics('birthday_reminder_added', { ...PERSONAL_FIELDS });
    expect(track).toHaveBeenCalledWith('birthday_reminder_added', {});
  });

  it('leaves assistant_arrival as it was', () => {
    expect(ANALYTICS_EVENT_PROPS.assistant_arrival).toEqual(['assistant']);
    expect(ANALYTICS_EVENT_VALUES.assistant_arrival).toEqual({ assistant: ['chatgpt', 'assistant'] });
  });
});
