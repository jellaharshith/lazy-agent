# Supabase user authentication (archived copy)

This folder is a **snapshot of the user-authentication pieces** that were removed from the main app. The live app no longer enforces sign-in; this tree is for reference or manual restore.

## What was included

- **Backend:** JWT middleware (`requireAuth`, `optionalAuth`), role middleware, `/api/my/*` and `/api/protected/*` routes, Express `Request` typing for `user` / `authToken` / `profile`, and the previous `intake` / `resources` route handlers that read `req.user`.
- **Frontend:** `AuthContext` (with Supabase session types in the original), sign-in/sign-up UI components, Supabase browser client, `authHeaders` helper, and auth guard components.
- **Scripts:** `create-test-users.mjs`, `supabase-auth-dev-autoconfirm.mjs` (see root `package.json` in `root-package.json` for npm script names).
- **SQL:** `auth_profiles.sql`, `add_user_columns.sql`.

## How to restore (outline)

1. Copy files from this tree back into the repo paths they mirror (e.g. `auth-version/Backend/middleware/auth.ts` → `Backend/middleware/auth.ts`).
2. Re-merge `Backend/index.ts` to mount `myRouter` and `protectedExampleRouter`, and restore the `GET /` API listing entries for those routes.
3. Restore `Backend/types/express.d.ts` and `createSupabaseWithAccessToken` usage if you use RLS-scoped calls.
4. In the Frontend, add `@supabase/supabase-js` to `Frontend/package.json` and run `npm install` in `Frontend/`.
5. Restore `Frontend/lib/supabase.ts`, guards, sign-in/up pages, and wire `AuthProvider` to Supabase `onAuthStateChange` if you want full session handling (the snapshot’s `AuthContext` may still be demo-oriented; adjust as needed).
6. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `Frontend/.env.local` for client auth.

Keep secrets out of git; use `.env` / `.env.local` only on your machine.
