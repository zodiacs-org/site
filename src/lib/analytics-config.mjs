/** Property allowlist shared by Astro pages and the generated Registry shell. */
export const ANALYTICS_EVENT_PROPS = Object.freeze({
  reference_opened: ['topic', 'page', 'locale', 'task', 'destination'],
  reference_cta_clicked: ['topic', 'page', 'locale', 'task', 'destination'],
  reference_task_completed: ['topic', 'page', 'locale', 'task', 'destination'],
  chart_computed: ['mode', 'source'],
  chart_saved: ['source'],
  compat_computed: ['source'],
  email_subscribed: ['placement'],
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
  email_capture_viewed: ['placement'],
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

const REGISTRY_BRIDGE_SURFACE_VALUES = Object.freeze([
  'birth_chart', 'birthday', 'sign_guide',
]);

const REGISTRY_BRIDGE_LOCALE_VALUES = Object.freeze([
  'en', 'es', 'pt', 'fr', 'it', 'ru',
]);

const REFERENCE_VALUES = Object.freeze({
  topic: Object.freeze(['synastry']),
  page: Object.freeze(['hub', 'sun-moon', 'moon-venus', 'moon-mars']),
  locale: Object.freeze(['en']),
  task: Object.freeze(['comparison']),
  destination: Object.freeze(['compatibility']),
});

/** Closed-value contracts for non-identifying product dimensions. */
export const ANALYTICS_EVENT_VALUES = Object.freeze({
  reference_opened: REFERENCE_VALUES,
  reference_cta_clicked: REFERENCE_VALUES,
  reference_task_completed: REFERENCE_VALUES,
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
