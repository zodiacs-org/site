import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANALYTICS_EVENT_PROPS, sanitizeAnalyticsProperties, trackAnalytics } from './analytics';

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
] as const;

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
});
