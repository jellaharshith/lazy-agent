# Local testing

## Frontend (Next.js)

From `Frontend/`:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If you see missing chunk errors (`Cannot find module './XXX.js'`), stop the dev server, delete the cache, and restart:

```bash
rm -rf .next && npm run dev
```

## Auth / test users

There are **no shared credentials** in the repo. Users live in **your Supabase project**.

### Option A — Sign up in the app

1. Go to [http://localhost:3000/signup](http://localhost:3000/signup).
2. Choose **Seeker** or **Provider**, enter name, email, and password (minimum 6 characters).
3. If email confirmation is required, check the inbox or use Option B below.

### Option B — Auto-confirm signups (dev only)

Requires `SUPABASE_ACCESS_TOKEN` in the **repo root** `.env` (create at [Supabase account tokens](https://supabase.com/dashboard/account/tokens)). Also set `SUPABASE_URL` (or `SUPABASE_PROJECT_REF`).

From the repo root:

```bash
node scripts/supabase-auth-dev-autoconfirm.mjs
```

Then new signups won’t need confirmation emails. Turn confirmation back on in production.

### Option C — Manual user in Supabase Dashboard

1. [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **Users** → **Add user**.
2. Ensure a matching row exists in **`profiles`** with the same `id` as the auth user (or complete signup once so the app can create it).

### Option D — Script: create two dev users (seeker + provider)

1. In [Supabase Dashboard](https://supabase.com/dashboard) → **Settings → API**, copy the **`service_role`** secret (server-only — never put it in `NEXT_PUBLIC_*` or commit it).

2. Add to your repo root `.env`:

   ```bash
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   ```

   (`SUPABASE_URL` should already match your project.)

3. From the **repo root**:

   ```bash
   npm run create-test-users
   ```

   Defaults:

   | Role     | Email                     | Password (unless overridden) |
   |----------|---------------------------|------------------------------|
   | Seeker   | `seeker-dev@example.com`  | `LazyAgentTest1!`            |
   | Provider | `provider-dev@example.com`| `LazyAgentTest1!`            |

   Set `DEV_TEST_USER_PASSWORD` in `.env` to use a different password.

### Example emails (manual signup)

Use any addresses you control, for example:

| Role     | Example email              |
|----------|----------------------------|
| Seeker   | `seeker-test@local.dev`    |
| Provider | `provider-test@local.dev`  |

Pick a strong test password and store it only in your own notes.

## Environment

The Next app expects `Frontend/.env.local` (or env vars) with:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Match the values from your Supabase project **Settings → API**.
