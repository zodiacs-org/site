/**
 * Privacy-bounded product analytics.
 *
 * Only event names and properties declared here may leave the browser. The
 * allowlist deliberately excludes URLs, addresses, email values, chart data,
 * birth details, free text, and persistent identifiers.
 */
import {
  ANALYTICS_EVENT_PROPS as EVENT_PROPS,
  ANALYTICS_EVENT_VALUES as EVENT_VALUES,
} from './analytics-config.mjs';

export const ANALYTICS_EVENT_PROPS = EVENT_PROPS as Readonly<Record<string, readonly string[]>>;
export const ANALYTICS_EVENT_VALUES = EVENT_VALUES as Readonly<
  Record<string, Readonly<Record<string, readonly string[]>>>
>;

export type AnalyticsEventName =
  | 'reference_opened'
  | 'reference_cta_clicked'
  | 'reference_task_completed'
  | 'chart_computed'
  | 'chart_saved'
  | 'compat_computed'
  | 'email_subscribed'
  | 'share_card_downloaded'
  | 'widget_embed_copied'
  | 'registry_visit'
  | 'registry_bridge_impression'
  | 'registry_bridge_click'
  | 'verifier_used'
  | 'terminal_view_switch'
  | 'sdk_click'
  | 'bio_click'
  | 'wallet_chart_computed'
  | 'aura_view'
  | 'aura_compose'
  | 'aura_share'
  | 'aura_refresh'
  | 'aura_calculator'
  | 'aura_entry'
  | 'aura_return'
  | 'aura_response'
  | 'aura_cabinet_select'
  | 'aura_cabinet_reveal'
  | 'aura_talisman_personalize'
  | 'invite_created'
  | 'invite_opened'
  | 'invite_completed'
  | 'invite_returned'
  | 'invite_converted'
  | 'invite_revoked'
  | 'result_rendered'
  | 'explorer_interaction'
  | 'tour_start'
  | 'tour_complete'
  | 'tour_step'
  | 'context_help_opened'
  | 'first_reading_prompt'
  | 'first_reading_step'
  | 'first_reading_completed'
  | 'next_action_clicked'
  | 'email_capture_viewed'
  | 'search_open'
  | 'search_go'
  | 'assistant_open'
  | 'assistant_reply'
  | 'push_prompt'
  | 'push_subscribe'
  | 'today_view'
  | 'living_chart_open'
  | 'living_chart_saved'
  | 'living_chart_deleted'
  | 'living_chart_export'
  | 'calendar_subscribe'
  | 'chart_save'
  | 'chart_share'
  | 'wing_entry'
  | 'lens_change'
  | 'transit_search'
  | 'srchart_view'
  | 'composite_view'
  | 'grid_select'
  | 'chiron_toggle'
  | 'detail_toggle'
  | 'chart_name_set'
  | 'comm_read_view'
  | 'race_view'
  | 'team_join'
  | 'weekly_checkin'
  | 'share_card'
  | 'trophy_view'
  | 'season_result_view'
  | 'trophy_hall_view'
  | 'race_to_astrofolio'
  | 'ramp_click';
export type AnalyticsPropertyValue = string | number | boolean;
export type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;

export function sanitizeAnalyticsProperties(
  name: string,
  properties: Record<string, unknown> = {},
): AnalyticsProperties | null {
  const allowed = (ANALYTICS_EVENT_PROPS as Record<string, readonly string[]>)[name];
  if (!allowed) return null;

  const safe: AnalyticsProperties = {};
  for (const key of allowed) {
    const value = properties[key];
    const values = (ANALYTICS_EVENT_VALUES as Record<
      string,
      Readonly<Record<string, readonly string[]>>
    >)[name]?.[key];
    if (values && (typeof value !== 'string' || !values.includes(value))) continue;
    if (typeof value === 'number' || typeof value === 'boolean') safe[key] = value;
    if (typeof value === 'string' && value.length <= 32) safe[key] = value;
  }
  return safe;
}

export function trackAnalytics(
  name: AnalyticsEventName,
  properties: AnalyticsProperties = {},
): void {
  if (typeof window === 'undefined') return;
  const safe = sanitizeAnalyticsProperties(name, properties);
  if (!safe) return;
  const analytics = (window as Window & {
    zodiacsAnalytics?: { track?: (event: string, props: AnalyticsProperties) => void };
  }).zodiacsAnalytics;
  analytics?.track?.(name, safe);
}
