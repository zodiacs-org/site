# Account Sync v2: key rotation, rewrap and escrow

This runbook covers the two server keyrings Account Sync v2 uses. It never
needs a key value written down anywhere but the escrow and the secret stores
named below. Nothing in it is run on a schedule: every rotation is a reviewed,
owner-approved operation.

| Keyring | Variables (names only) | Protects | Can old data move to a new key? |
| --- | --- | --- | --- |
| Encryption | `ACCOUNT_SYNC_V2_ENCRYPTION_KEYS`, `ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION` | Chart envelopes, Daily Sun alias locators, deletion provider payloads | Yes: `scripts/account-sync-v2-rewrap.ts` re-wraps them |
| Fingerprint | `ACCOUNT_SYNC_V2_FINGERPRINT_KEYS`, `ACCOUNT_SYNC_V2_ACTIVE_FINGERPRINT_KEY_VERSION` | Mutation verifiers and deletion recovery verifiers (HMACs) | No: an HMAC cannot be recomputed without its input, so old versions are retired by waiting |

Both are JSON objects of numeric versions to canonical base64 32-byte keys
(`SETUP.md` has the limits). They live in the Vercel project `zodiacs-org`
(Production) and, for the encryption keyring only, in the GitHub environments
`daily-email-production` and `weekly-digest-production`, which decrypt
chart_emails charts in their send step.

## How the encryption works, and why rewrap is safe

Each write encrypts its payload with a fresh random data key, then wraps that
data key with the active service key. The payload's authenticated data binds
purpose, owner and record (and, for a chart, its revision) but not the key
version; only the wrap binds the key version. So moving a record to a new key
re-wraps the data key and leaves the ciphertext and nonce untouched. The
rewrap tool never decrypts a chart or an address, and the database RPCs it
uses (`account_v2_rewrap_candidates`, `account_v2_rewrap_apply`,
`account_v2_key_version_inventory`, migration 20261113090000) neither return
nor accept ciphertext.

## Escrow

1. Generate a key on a trusted machine, for example
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"`.
   Do not paste it into a chat, an issue, a commit, a log or a shell history
   that syncs anywhere.
2. Before it is provisioned anywhere, put it in the owner's escrow (two
   independent copies outside Vercel and GitHub, for example a password
   manager vault and an offline copy). Record next to it: keyring name,
   version number, date created, date activated, date removed.
3. Keep every retired encryption version in escrow for at least 90 days after
   it leaves the keyring. The encrypted database backups
   (`db-backup.yml`) keep 90 days, and a restored backup holds envelopes
   wrapped under whatever version was active then; with the old key in escrow
   it can be read and re-wrapped, without it those envelopes are lost.
4. Losing an encryption key that was never escrowed is not recoverable:
   charts under it can no longer be decrypted (their owners get the Sun
   edition until they choose their chart again), and alias locators under it
   leave deletions marked as needing Daily Sun reconciliation. Escrow first.

## Rotating the encryption keyring

Version numbers below: `N` is the current active version, `M` the new one.

1. **Escrow `M`** as above.
2. **Add `M`, keep `N` active.** Set `ACCOUNT_SYNC_V2_ENCRYPTION_KEYS` to hold
   both `N` and `M` in Vercel and in both GitHub environments. Leave
   `ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION` at `N`. Redeploy production. Every
   reader can now read `M` before anything is written with it.
3. **Activate `M`.** Set `ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION` to `M` in all
   three places and redeploy. New writes now use `M`.
4. **Dry run the rewrap** from a trusted machine, with the four variables the
   tool reads (`PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the
   keyring and active version as in step 3) exported in that shell only:

   ```bash
   npx vite-node --script scripts/account-sync-v2-rewrap.ts -- --from N
   ```

   It prints the rows per kind and key version, then the ids it would
   re-wrap and counts. It writes nothing. A row it cannot unwrap is printed
   as `cannot rewrap <id>` and makes the run exit non-zero; stop and find out
   why before going on.
5. **Apply:**

   ```bash
   npx vite-node --script scripts/account-sync-v2-rewrap.ts -- --from N --apply
   ```

   Options: `--kind chart|alias|provider|all`, `--batch` (1 to 500 rows a
   call, default 100), `--batches` (per kind, default 50). Every write is a
   compare-and-swap on the row's ids, old version and old wrapped key, so a
   row the owner changed meanwhile is skipped, a second run is a no-op, and
   the run can be stopped and repeated at any point. It prints the inventory
   again at the end. If more than one batch of rows cannot be unwrapped, the
   run stops early for that kind; fix those rows first.
6. **Wait at least seven days** after step 3 with `N` still in the keyring.
   Deletion provider payloads and receipts are request-bound and live seven
   days; an instance that had not yet redeployed may also have written with
   `N`. Run step 5 again at the end of the wait.
7. **Prove `N` is unused:** the inventory (`select
   public.account_v2_key_version_inventory();` as the service role, or the
   tool's `before:` lines) must show no row at version `N` for any kind.
8. **Retire `N`:** remove it from the keyring in all three places and
   redeploy. Keep it in escrow for 90 more days (Escrow, step 3).

Never remove a version while the inventory still shows rows under it. The
contract's rule ("an old key may not be retired until all records using it
have been re-encrypted or deleted") is exactly step 7.

## Rotating the fingerprint keyring

The database stores verifiers as `version:hex`. Deletion recovery proofs are
checked against every retained version, so dropping a version too early makes
an open deletion receipt unverifiable: the person has to start the deletion
again while signed in, or the hourly retention pass finishes it after its
seven days.

1. Escrow the new version `M` (same rules; the 90-day backup rule does not
   apply, a verifier is not data).
2. Add `M` to `ACCOUNT_SYNC_V2_FINGERPRINT_KEYS` (at most four versions) and
   set `ACCOUNT_SYNC_V2_ACTIVE_FINGERPRINT_KEY_VERSION` to `M` in Vercel.
   Redeploy.
3. **Keep the old version `N` for at least seven days** after step 2, and
   until no live receipt uses it:

   ```sql
   select count(*)
   from private.account_deletion_receipts
   where expires_at > now()
     and split_part(recovery_verifier, ':', 1) = 'N';
   ```

   It must return 0. Older mutation receipts keep their `N` verifiers; after
   `N` is gone, an exact replay of a mutation made before the rotation is
   answered as a mutation conflict.
4. Remove `N` and redeploy.

## Order when both rotate

Rotate the encryption keyring first and finish its step 8, then the
fingerprint keyring. Never rotate either during an incident without the old
key in escrow.

## What not to do

- Do not run the rewrap tool from CI, a shared machine, or with keys in a
  file in the repository. It reads the shell environment only.
- Do not paste the tool's input variables into a ticket. Its output is safe to
  share: counts and row ids (owner, chart or request UUIDs and the first 12
  characters of an opaque recipient hash), never a key, a wrapped key,
  ciphertext, an address or a chart.
- Do not reuse a key across the two keyrings or across versions.
