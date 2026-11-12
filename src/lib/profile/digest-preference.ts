import { getSupabaseClient } from '../supabase/client';

/**
 * The weekly digest subscription: the signed-in account's own
 * profiles.digest_opt_in, read and written through the owner's row policies.
 * It is the same switch with v1 and with account sync v2; whether a digest
 * uses the synced chart is the separate chart_emails consent.
 */

interface RemoteDigestPreferenceRow {
  digest_opt_in: boolean | null;
}

export async function getDigestOptIn(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return false;

  const { data, error } = await client
    .from('profiles')
    .select('digest_opt_in')
    .eq('user_id', userData.user.id)
    .maybeSingle<RemoteDigestPreferenceRow>();
  if (error) throw error;

  return data?.digest_opt_in === true;
}

export async function setDigestOptIn(digestOptIn: boolean): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) return false;

  // Write only the digest column. On conflict this leaves `settings`
  // untouched (the main sync path owns it); a stale local profile can no
  // longer clobber the synced settings. On insert, `settings` takes its
  // column default and the trigger stamps updated_at.
  const { error } = await client
    .from('profiles')
    .upsert({
      user_id: userData.user.id,
      digest_opt_in: digestOptIn,
    }, { onConflict: 'user_id' });
  if (error) throw error;

  return true;
}
