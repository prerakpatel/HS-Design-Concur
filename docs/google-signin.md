# Google sign-in: the three one-time steps (no coding)

Your app lives at **https://design-and-concur.vercel.app**. Your Supabase project is
**design-and-concur** (https://supabase.com/dashboard/project/gegiwouyrhcexjozkbhh).
Budget about 20 minutes. You need to be signed in to Google as the account that should own the
temple's Google Cloud setup (a hariss.org account is ideal so it is not tied to one person's Gmail).

## Step 1 · Create a Google "OAuth client" (Google Cloud Console)

1. Open https://console.cloud.google.com and sign in.
2. Top-left project picker → **New project** → name it `Design and Concur` → **Create**. Wait for the
   notification, then select the project.
3. Left menu → **APIs & Services → OAuth consent screen** (Google may call it "Branding" /
   "Audience" under *Google Auth Platform*). Click **Get started**.
   - App name: `Design & Concur` · User support email: your email
   - Audience: **External**
   - Contact email: your email → **Create**.
   - Under **Audience**, click **Publish app** so anyone with a Google account can sign in
     (the app's own admin approval is what gates access, not Google).
4. Left menu → **Clients** (or **Credentials**) → **Create credentials → OAuth client ID**.
   - Application type: **Web application**
   - Name: `Design & Concur web`
   - **Authorised JavaScript origins**: add both
     - `https://design-and-concur.vercel.app`
     - `https://gegiwouyrhcexjozkbhh.supabase.co`
   - **Authorised redirect URIs**: add exactly
     - `https://gegiwouyrhcexjozkbhh.supabase.co/auth/v1/callback`
   - **Create**. A box shows **Client ID** and **Client secret**. Keep this tab open.

## Step 2 · Tell Supabase about it

1. Open https://supabase.com/dashboard/project/gegiwouyrhcexjozkbhh/auth/providers
2. Click **Google** → switch **Enable Sign in with Google** on.
3. Paste the **Client ID** and **Client secret** from Step 1 → **Save**.
4. Now open https://supabase.com/dashboard/project/gegiwouyrhcexjozkbhh/auth/url-configuration
   - **Site URL**: `https://design-and-concur.vercel.app`
   - **Redirect URLs** → add these three, one per line:
     - `https://design-and-concur.vercel.app/**`
     - `https://*-hello-6042s-projects-0888460f.vercel.app/**` (preview deployments)
     - `http://localhost:3000/**` (only needed if someone runs the app on their laptop)
   - **Save**.

## Step 3 · Give Vercel the secret key

1. Open https://supabase.com/dashboard/project/gegiwouyrhcexjozkbhh/settings/api-keys → tab
   **Secret keys** → **Create new secret key** (name it `vercel`) → copy it. It starts with `sb_secret_`.
2. Open https://vercel.com/hello-6042s-projects-0888460f/design-and-concur/settings/environment-variables
   - Key: `SUPABASE_SECRET_KEY` · Value: paste the key · Environments: leave all three ticked → **Save**.
3. In Vercel, **Deployments** → open the latest → **⋯ → Redeploy** so the new key is picked up.

## Check it worked

1. Visit https://design-and-concur.vercel.app in a private/incognito window.
2. Click **Continue with Google** and sign in with `pushkar936@gmail.com`,
   `pushkar.patel@hariss.org` or `anand.shah@hariss.org`. You should land on **Events** as a Core Admin.
3. Anyone else who signs in sees **You are on the list** until a Core Admin approves them in
   **Settings**.

## If something goes wrong

| What you see | Cause | Fix |
|---|---|---|
| Google says **redirect_uri_mismatch** | Step 1 redirect URI typo | It must be exactly `https://gegiwouyrhcexjozkbhh.supabase.co/auth/v1/callback` |
| Google says **access_denied** / "app not verified" | Consent screen still in *Testing* | Step 1.3 → **Publish app**, or add the tester's email under *Test users* |
| Back on the sign-in page with "Sign-in did not complete" | Site URL / redirect list | Step 2.4, make sure `https://design-and-concur.vercel.app/**` is listed |
| Stuck on **You are on the list** with an admin email | Email doesn't match the bootstrap list | The three bootstrap emails are case-insensitive but must match exactly; ask me to add another |
