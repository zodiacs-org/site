import { ARRIVAL_REF_VALUES } from './arrival-refs.mjs';

/** Property allowlist shared by Astro pages and the generated Registry shell. */
export const ANALYTICS_EVENT_PROPS = Object.freeze({
  chart_computed: ['mode', 'source'],
  chart_saved: ['source'],
  compat_computed: ['source'],
  email_subscribed: ['placement', 'source'],
  share_card_downloaded: ['variant'],
  widget_embed_copied: ['widget', 'mode'],
  registry_visit: [],
  registry_bridge_impression: ['sign', 'surface', 'locale'],
  registry_bridge_click: ['sign', 'surface', 'locale'],
  registry_sign_selected: ['sign', 'source'],
  verifier_used: ['chain', 'outcome'],
  terminal_view_switch: ['surface', 'direction'],
  sdk_click: ['source', 'destination'],
  bio_click: ['destination'],
  // A visit that arrived from a link the Zodiacs app gave in ChatGPT or another assistant.
  assistant_arrival: ['assistant'],
  wallet_chart_computed: ['chain', 'holds_registry_asset'],
  aura_view: [],
  aura_compose: ['outcome', 'held_bucket'],
  aura_share: ['outcome'],
  aura_refresh: ['outcome'],
  aura_calculator: ['direction'],
  aura_entry: ['source'],
  aura_return: ['interval'],
  aura_response: ['value'],
  aura_cabinet_select: [],
  aura_cabinet_reveal: ['outcome'],
  aura_talisman_personalize: ['state'],
  race_view: ['season'],
  team_join: ['sign', 'season'],
  weekly_checkin: ['sign', 'season'],
  share_card: ['sign', 'platform', 'season'],
  trophy_view: ['season', 'days_left'],
  season_result_view: ['season', 'winner'],
  trophy_hall_view: [],
  race_to_astrofolio: ['sign', 'source'],
  ramp_click: ['source'],
  invite_created: ['notify'],
  invite_opened: ['state'],
  invite_completed: [],
  invite_returned: ['method'],
  invite_converted: ['action'],
  invite_revoked: [],

  // The growth tests' counts (docs/ANALYTICS.md, "Growth test events"). Every
  // property here has a closed list below; none can carry an email address, a
  // sign, a birth date, time or place, a name or anything typed.
  good_day_check: ['use', 'source'],
  good_day_calendar_add: ['source'],
  year_score_completed: [],
  year_pack_cta: ['surface'],
  year_pack_unlocked: ['kind'],
  birthday_card_made: ['source'],
  birthday_card_arrival: [],
  birthday_reminder_added: [],
  birthday_gift_cta: [],

  // Existing event names remain accepted so historical funnels do not break.
  result_rendered: ['mode'],
  explorer_interaction: ['mode', 'source'],
  tour_start: ['variant'],
  tour_complete: ['variant'],
  tour_step: ['step'],
  context_help_opened: ['term', 'surface'],
  first_reading_prompt: ['action'],
  first_reading_step: ['step'],
  first_reading_completed: [],
  next_action_clicked: ['state', 'action'],
  email_capture_viewed: ['placement', 'source'],
  search_open: [],
  search_go: ['kind'],
  assistant_open: [],
  assistant_reply: [],
  push_prompt: [],
  push_subscribe: [],
  today_view: [],
  living_chart_open: ['source'],
  living_chart_saved: ['mode'],
  living_chart_deleted: [],
  living_chart_export: ['format'],
  calendar_subscribe: [],
  calendar_download: [],
  chart_save: ['source'],
  chart_share: ['variant'],
  wing_entry: ['source'],
  lens_change: ['lens'],
  transit_search: ['span', 'bodies'],
  srchart_view: ['via'],
  composite_view: [],
  grid_select: [],
  chiron_toggle: ['on'],
  detail_toggle: ['to'],
  chart_name_set: ['via'],
  comm_read_view: [],
});

const ZODIAC_SIGN_VALUES = Object.freeze([
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
]);

/**
 * Which kind of link opened the browser tab. `direct` is the default: no
 * recognised `?ref=` word. The rest are the only `ref` words the site reads
 * (src/lib/arrival-source.ts) and the only ones a share page accepts
 * (src/lib/share-results.ts); any other word is dropped. The list lives in its
 * own small module so the share parsers can read it without this whole file.
 */
export { ARRIVAL_REF_VALUES };
export const ARRIVAL_SOURCE_VALUES = Object.freeze(['direct', ...ARRIVAL_REF_VALUES]);

/** Where an email sign-up form sits. */
export const EMAIL_CAPTURE_PLACEMENT_VALUES = Object.freeze([
  'chart', 'horoscopes', 'footer', 'note_page', 'good_days', 'year_score', 'birthday_card',
]);

/** First, second or a later use on this device (src/lib/use-count.ts). */
export const USE_BUCKET_VALUES = Object.freeze(['first', 'second', 'more']);

const REGISTRY_BRIDGE_SURFACE_VALUES = Object.freeze([
  'birth_chart', 'birthday', 'sign_guide',
]);

const REGISTRY_BRIDGE_LOCALE_VALUES = Object.freeze([
  'en', 'es', 'pt', 'fr', 'it', 'ru',
]);

/** Closed-value contracts for non-identifying product dimensions. */
export const ANALYTICS_EVENT_VALUES = Object.freeze({
  email_capture_viewed: Object.freeze({
    placement: EMAIL_CAPTURE_PLACEMENT_VALUES,
    source: ARRIVAL_SOURCE_VALUES,
  }),
  email_subscribed: Object.freeze({
    placement: EMAIL_CAPTURE_PLACEMENT_VALUES,
    source: ARRIVAL_SOURCE_VALUES,
  }),
  good_day_check: Object.freeze({
    use: USE_BUCKET_VALUES,
    source: ARRIVAL_SOURCE_VALUES,
  }),
  good_day_calendar_add: Object.freeze({ source: ARRIVAL_SOURCE_VALUES }),
  year_pack_cta: Object.freeze({
    surface: Object.freeze(['year_score', 'year_sky', 'birthday_report', 'birthday_card']),
  }),
  year_pack_unlocked: Object.freeze({ kind: Object.freeze(['self', 'gift']) }),
  birthday_card_made: Object.freeze({ source: Object.freeze(['direct', 'card']) }),
  assistant_arrival: Object.freeze({
    assistant: Object.freeze(['chatgpt', 'assistant']),
  }),
  bio_click: Object.freeze({
    destination: Object.freeze([
      'website', 'birth_chart', 'astrofolio', ...ZODIAC_SIGN_VALUES,
    ]),
  }),
  registry_bridge_impression: Object.freeze({
    sign: ZODIAC_SIGN_VALUES,
    surface: REGISTRY_BRIDGE_SURFACE_VALUES,
    locale: REGISTRY_BRIDGE_LOCALE_VALUES,
  }),
  registry_bridge_click: Object.freeze({
    sign: ZODIAC_SIGN_VALUES,
    surface: REGISTRY_BRIDGE_SURFACE_VALUES,
    locale: REGISTRY_BRIDGE_LOCALE_VALUES,
  }),
  chart_computed: Object.freeze({
    source: Object.freeze(['fresh', 'shared_details', 'shared_positions']),
  }),
  chart_share: Object.freeze({
    variant: Object.freeze([
      'details_link',
      'positions_link',
      'big_three_card',
      'full_chart_card',
      'signature_card',
      'approach_card',
      'communication_card',
    ]),
  }),
  living_chart_open: Object.freeze({
    source: Object.freeze(['today', 'profile']),
  }),
  living_chart_saved: Object.freeze({
    mode: Object.freeze(['active', 'quiet']),
  }),
  living_chart_export: Object.freeze({
    format: Object.freeze(['json', 'markdown']),
  }),
  team_join: Object.freeze({ sign: ZODIAC_SIGN_VALUES }),
  weekly_checkin: Object.freeze({ sign: ZODIAC_SIGN_VALUES }),
  share_card: Object.freeze({ sign: ZODIAC_SIGN_VALUES }),
  season_result_view: Object.freeze({ winner: ZODIAC_SIGN_VALUES }),
  race_to_astrofolio: Object.freeze({
    sign: ZODIAC_SIGN_VALUES,
    source: Object.freeze(['race', 'champion']),
  }),
  terminal_view_switch: Object.freeze({
    surface: Object.freeze(['header', 'preference_banner']),
    direction: Object.freeze(['consumer_to_pro', 'pro_to_consumer']),
  }),
  invite_opened: Object.freeze({
    state: Object.freeze(['ready', 'invalid', 'closed', 'used', 'unavailable', 'offline']),
  }),
  invite_returned: Object.freeze({
    method: Object.freeze(['share', 'copy', 'download']),
  }),
  invite_converted: Object.freeze({
    action: Object.freeze(['saved_chart', 'saved_pair', 'own_chart']),
  }),
});
