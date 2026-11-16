import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { confirmReminder } from './store';

const ENV = { PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service' };
const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';
// The SQL cannot run offline, so its rules are checked as written.
const migration = readFileSync(new URL('../../../supabase/migrations/20261112090000_birthday_reminders.sql', import.meta.url), 'utf8');
const fn = (name: string) => {
  const start = migration.indexOf(`create or replace function public.${name}(`);
  return migration.slice(start, migration.indexOf('$$;', start));
};

describe('birthday reminder storage', () => {
  it('answers a confirmation with the row id, or null', async () => {
    for (const [body, expected] of [[JSON.stringify(ID), ID], ['null', null], ['true', null], ['"not-an-id"', null]] as const) {
      const fetcher = vi.fn(async () => new Response(body));
      expect(await confirmReminder('a'.repeat(64), ENV, fetcher as unknown as typeof fetch)).toBe(expected);
    }
  });

  it('confirms with the row id, so the confirmed page can carry a stop link', () => {
    expect(fn('birthday_reminder_confirm')).toContain('returns uuid');
    expect(fn('birthday_reminder_confirm')).toContain('return found_id;');
  });

  it('caps one address at six confirmation emails in 24 hours, under a lock, keeping the one a minute rule', () => {
    const request = fn('birthday_reminder_request');
    expect(migration).toContain('request_count smallint not null default 0');
    expect(migration).toContain('window_started_at timestamptz');
    // The lock comes first, so two requests for one address cannot both pass either cap.
    expect(request.indexOf('pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_email, 0))')).toBeGreaterThan(0);
    expect(request.indexOf('pg_advisory_xact_lock')).toBeLessThan(request.indexOf('select requested_at'));
    expect(request).toContain("window_start <= pg_catalog.now() - interval '24 hours'");
    expect(request).toContain("if sent >= 6 then return pg_catalog.jsonb_build_object('outcome', 'capped')");
    expect(request).toContain("interval '60 seconds'");
    // A confirmed reminder is answered before any cap and never changed.
    expect(request.indexOf("if confirmed is not null")).toBeLessThan(request.indexOf('if sent >= 6'));
    expect(request).toContain('where r.confirmed_at is null');
  });

  it('counts a reminder as sent for 300 days, not to the end of the calendar year', () => {
    expect(migration).not.toContain("date_trunc('year'");
    for (const name of ['birthday_reminders_due', 'birthday_reminder_claim']) {
      expect(fn(name)).toContain("last_sent_on < (pg_catalog.now() at time zone 'UTC')::date - 300");
    }
  });
});
