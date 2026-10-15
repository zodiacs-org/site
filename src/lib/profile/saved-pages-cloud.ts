/**
 * Saved pages in the account (public.saved_pages). Every call goes through
 * the signed-in Supabase session; row-level security limits each person to
 * their own rows. Loaded only when someone saves or opens the profile list.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase/client';
import {
  MAX_SAVED_PAGES,
  parseSavedPageRow,
  savedPageDraft,
  type SavedPage,
  type SavedPageDraft,
} from './saved-pages-config';

export type SaveOutcome = 'saved' | 'exists' | 'full' | 'signed-out' | 'error';

async function signedIn(client: SupabaseClient | null): Promise<{ client: SupabaseClient; userId: string } | null> {
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) return null;
  return { client, userId: data.session.user.id };
}

/** The account's saved pages, newest first; null when signed out. */
export async function listSavedPages(client = getSupabaseClient()): Promise<SavedPage[] | null> {
  const session = await signedIn(client);
  if (!session) return null;
  const query = (columns: string) => session.client
    .from('saved_pages')
    .select(columns)
    .order('saved_at', { ascending: false })
    .limit(MAX_SAVED_PAGES);
  // The assistant columns arrive with a later migration; until it is applied, list the site's own columns.
  let { data, error } = await query('id, kind, title, href, saved_at, source, summary');
  if (error?.code === '42703') ({ data, error } = await query('id, kind, title, href, saved_at'));
  if (error) throw error;
  return ((data ?? []) as unknown[]).map(parseSavedPageRow).filter((row): row is SavedPage => row !== null);
}

export async function saveSavedPage(draft: SavedPageDraft, client = getSupabaseClient()): Promise<SaveOutcome> {
  const clean = savedPageDraft(draft);
  if (!clean) return 'error';
  const session = await signedIn(client);
  if (!session) return 'signed-out';
  const { error } = await session.client
    .from('saved_pages')
    .insert({ user_id: session.userId, kind: clean.kind, title: clean.title, href: clean.href });
  if (!error) return 'saved';
  if (error.code === '23505') return 'exists';
  if (error.message?.includes('saved_pages_full')) return 'full';
  return 'error';
}

/** Calls back with whether a session is present, now and on every change. */
export function onSavedPagesAuthChange(callback: (signedIn: boolean) => void, client = getSupabaseClient()): () => void {
  if (!client) {
    callback(false);
    return () => {};
  }
  const { data } = client.auth.onAuthStateChange((_event, session) => callback(Boolean(session)));
  return () => data.subscription.unsubscribe();
}

/**
 * Everything saved with the account, as stored, for the profile's download:
 * the links and, for assistant saves, the summary and the worked-out result.
 */
export async function exportSavedPages(client = getSupabaseClient()): Promise<unknown[] | null> {
  const session = await signedIn(client);
  if (!session) return null;
  const query = (columns: string) => session.client
    .from('saved_pages')
    .select(columns)
    .order('saved_at', { ascending: false })
    .limit(MAX_SAVED_PAGES);
  let { data, error } = await query('id, kind, title, href, saved_at, source, summary, detail');
  if (error?.code === '42703') ({ data, error } = await query('id, kind, title, href, saved_at'));
  if (error) throw error;
  return (data ?? []) as unknown[];
}

export async function removeSavedPage(id: string, client = getSupabaseClient()): Promise<boolean> {
  const session = await signedIn(client);
  if (!session) return false;
  const { error } = await session.client.from('saved_pages').delete().eq('id', id);
  return !error;
}
