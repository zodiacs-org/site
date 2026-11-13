# Google and Apple sign-in, and saved pages: setup for the owner

This is the checklist for switching on three account features that are already
in the code but turned off:

1. **Continue with Google** on the profile's sign-in panel.
2. **Continue with Apple** on the same panel.
3. **Save to your profile** under a compatibility reading and an occasion card,
   with a "Saved to your profile" list on `/profile/`, plus the "Sign in to
   save" line under a birth chart.

Each one stays hidden until its Vercel setting is `1`. Nothing breaks while
they are off; email sign-in keeps working exactly as it does today. You can do
them in any order and switch any of them off again by deleting the setting and
redeploying.

You need: the Supabase dashboard (project **Zodiacs.org**), the Vercel
dashboard (team `zodiacsofficial`, project `zodiacs-org`), a Google account
for Google Cloud, and, for Apple only, an Apple Developer Program membership
(US$99 a year).

Our Supabase project's sign-in return address, which both Google and Apple
need, is:

```
https://mftpcdpttteuwbolobye.supabase.co/auth/v1/callback
```

(`mftpcdpttteuwbolobye` is the project ref recorded in `docs/SUPABASE.md`; it
is also the first part of the `PUBLIC_SUPABASE_URL` setting in Vercel. It is
not a secret.)

---

## Step 0. Let Supabase send people back to the new sign-in page

Google and Apple sign-in finish on a new page, `/auth/callback/`. Supabase only
sends people to addresses on its allow list.

1. Supabase dashboard → **Authentication** → **URL Configuration**.
2. Under **Redirect URLs**, add each of these (keep the existing `/profile/`
   entries):
   - `https://zodiacs.org/auth/callback/**`
   - `https://*.vercel.app/auth/callback/**`
   - `http://localhost:4321/auth/callback/**`
3. Save.

---

## Step 1. Google

### 1a. Create the Google sign-in client (Google Cloud Console)

1. Go to <https://console.cloud.google.com/> and sign in with the Google
   account that should own this (ideally a shared admin account, not a
   personal one).
2. At the top, open the project picker → **New project**. Name it
   `Zodiacs.org sign-in` → **Create**. Make sure it is selected.
3. Left menu → **APIs & Services** → **OAuth consent screen** (Google may call
   this **Google Auth Platform** → **Branding**).
   - App name: `Zodiacs.org`
   - User support email: `admin@zodiacs.org`
   - App logo: optional (if you add one, Google reviews it, which can take a
     few days).
   - App home page: `https://zodiacs.org/`
   - Privacy policy: `https://zodiacs.org/privacy/`
   - Terms of service: `https://zodiacs.org/terms/`
   - Authorized domains: add `zodiacs.org` **and** `supabase.co`.
   - Developer contact email: `admin@zodiacs.org`.
   - Audience / user type: **External**.
   - Scopes (Data access): add only `openid`, `.../auth/userinfo.email` and
     `.../auth/userinfo.profile`. These three need no Google review.
   - Publish the app (**Audience** → **Publish app**, status "In production").
     While it says "Testing", only test users you list can sign in.
4. Left menu → **Clients** (or **APIs & Services** → **Credentials**) →
   **Create client** / **Create credentials** → **OAuth client ID**.
   - Application type: **Web application**
   - Name: `Zodiacs.org (Supabase)`
   - Authorized JavaScript origins: `https://zodiacs.org`
   - Authorized redirect URIs: exactly
     `https://mftpcdpttteuwbolobye.supabase.co/auth/v1/callback`
   - **Create**.
5. Google shows a **Client ID** and a **Client secret**. Copy both somewhere
   safe for the next step. Do not paste them into chat, email or the repo.

### 1b. Paste them into Supabase

1. Supabase dashboard → **Authentication** → **Sign In / Providers** →
   **Google**.
2. Turn **Enable Sign in with Google** on.
3. Paste the **Client ID** and **Client Secret** from 1a.
4. Leave "Skip nonce checks" off. **Save**.

### 1c. Turn the button on (Vercel)

1. Vercel → project `zodiacs-org` → **Settings** → **Environment Variables**.
2. Add `PUBLIC_AUTH_GOOGLE` with value `1` for **Production** (and Preview if
   you want to try it there first).
3. Redeploy (Deployments → latest production deployment → **Redeploy**). The
   setting is read when the site is built, so it needs a new build.

---

## Step 2. Apple

Apple needs a paid Apple Developer Program membership (US$99/year,
<https://developer.apple.com/programs/enroll/>). Enrolling as an organization
needs a D-U-N-S number and can take a few days; enrolling as an individual is
faster but shows your personal name as the seller.

### 2a. Create the identifiers and key (Apple Developer)

All of this is at <https://developer.apple.com/account/resources/>.

1. **Find your Team ID**: top right of the Membership page — a 10-character
   code such as `A1B2C3D4E5`. Note it.
2. **App ID** (Apple requires one even for a website):
   **Identifiers** → **+** → **App IDs** → **App** → Continue.
   - Description: `Zodiacs.org`
   - Bundle ID (explicit): `org.zodiacs.web`
   - Tick **Sign In with Apple** in the capability list. → Continue →
     **Register**.
3. **Services ID** (this is the one the website uses):
   **Identifiers** → **+** → **Services IDs** → Continue.
   - Description: `Zodiacs.org sign-in` (people see this name on Apple's
     sign-in sheet)
   - Identifier: `org.zodiacs.signin` → Continue → **Register**.
   - Open the new Services ID, tick **Sign In with Apple**, then
     **Configure**:
     - Primary App ID: `org.zodiacs.web`
     - Domains and Subdomains: `mftpcdpttteuwbolobye.supabase.co`
     - Return URLs: `https://mftpcdpttteuwbolobye.supabase.co/auth/v1/callback`
     - **Next** → **Done** → **Continue** → **Save**.
4. **Key**: **Keys** → **+**.
   - Key name: `Zodiacs.org Sign in with Apple`
   - Tick **Sign In with Apple** → **Configure** → choose `org.zodiacs.web`
     → Save → Continue → **Register**.
   - **Download** the `.p8` file. Apple lets you download it only once; keep
     it somewhere safe (a password manager). Note the **Key ID** shown on the
     page (10 characters).

### 2b. Make the client secret and paste into Supabase

Apple does not give you a secret directly; Supabase turns the key into one.

1. Supabase dashboard → **Authentication** → **Sign In / Providers** →
   **Apple**. Turn **Enable Sign in with Apple** on.
2. **Client IDs**: `org.zodiacs.signin` (the Services ID from 2a.3).
3. **Secret Key (for OAuth)**: Supabase's Apple provider page links to a
   secret generator (also in Supabase's guide,
   <https://supabase.com/docs/guides/auth/social-login/auth-apple>). Enter your
   Team ID, Key ID, the Services ID and the contents of the `.p8` file; it
   produces a long secret beginning `eyJ`. Paste that secret here. **Save**.
4. Put a reminder in your calendar for **five months from today**: Apple's
   secrets expire after at most six months, and sign-in with Apple stops
   working when it does. Renewing is step 3 again with the same `.p8` file.

### 2c. Turn the button on (Vercel)

Same as 1c, with `PUBLIC_AUTH_APPLE` = `1`, then redeploy.

---

## Step 3. Save to your profile (needs a database change)

This feature stores each saved page in a new table, `public.saved_pages`. The
table does not exist in production yet. **Applying the migration is a
production database change and needs your approval**; nothing in this branch
applies it.

1. Review `supabase/migrations/20261015090000_saved_pages.sql`. It creates one
   table, readable and writable only by the signed-in owner (row-level
   security), at most 100 rows per account, deleted with the account. It is
   safe to run twice.
2. Supabase dashboard → **SQL Editor** → **New query** → paste the whole file
   → **Run**. It should say "Success. No rows returned".
3. Check: **Table Editor** shows `saved_pages`, with the shield (RLS) icon on.
4. Vercel → Environment Variables → add `PUBLIC_ACCOUNT_SAVES_ENABLED` = `1`
   → redeploy.

To switch it off again, delete the setting and redeploy. Saved rows stay in the
table until you remove them or the person deletes their account.

---

## How to check each one works

After the redeploy:

1. Open <https://zodiacs.org/profile/> in a private window. The sign-in panel
   shows **Continue with Google** and/or **Continue with Apple** above the
   email box (only the ones you switched on).
2. Press **Continue with Google**. Google's sign-in page opens and names
   `Zodiacs.org`. Sign in. You land back on `/profile/` signed in ("Sync is
   on", with your email). Any charts saved in that browser upload as they do
   after an email sign-in.
3. Repeat with **Continue with Apple** (on an Apple device you will see Face ID
   or Touch ID; elsewhere, Apple's web page). Choosing "Hide my email" is fine.
4. In Supabase → **Authentication** → **Users**, the new user shows provider
   `google` or `apple`.
5. With saved pages on: open <https://zodiacs.org/occasions/>, make a card,
   press **Save to your profile**, then **Open your profile**: the card is
   listed under "Saved to your profile" and its link reopens the card. Do the
   same on <https://zodiacs.org/compatibility/>. Signed out, the same place
   shows "Sign in to save"; after signing in, the profile saves that page by
   itself.

If a button shows "provider is not enabled", the Supabase provider switch in
1b or 2b is off. If Google says "redirect_uri_mismatch", the redirect URI in 1a
step 4 does not exactly match the address at the top of this page. If you come
back to a page saying sign-in could not be finished, check Step 0, and start
and finish sign-in in the same browser.

## What the site sends and receives

The site sends the person to Supabase, which sends them to Google or Apple.
The provider gives Supabase the email address and, if the person allows it,
the name (Google also a profile-picture address). Nothing is posted to the
person's Google or Apple account. The privacy page describes this once the
flags are on; it reads the same flags, so it changes with the build.

## A note on "Continue with ChatGPT"

Not built. There is no placeholder for it in this release.
