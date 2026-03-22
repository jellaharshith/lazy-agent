"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatAuthErrorMessage } from "@/lib/authErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { PageShell, SectionCard, ui } from "@/components/ui/app-ui";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isSupabaseConfigured()) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: signError } = await getSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signError) {
        setError(formatAuthErrorMessage(signError.message));
        return;
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell className="py-16">
      <div className="mx-auto w-full max-w-xl">
        <SectionCard className="p-7 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Welcome back</p>
          <h1 className={ui.title + " mt-2"}>Sign in</h1>
          <p className="mt-2 text-sm text-slate-600">Sign in to continue to your dashboard, requests, and matches.</p>

          {!isSupabaseConfigured() ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-medium">Auth is not wired yet</p>
              <p className="mt-1 text-amber-900/90">
                Add <code className="rounded bg-white/80 px-1 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                <code className="rounded bg-white/80 px-1 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
                <code className="rounded bg-white/80 px-1 text-xs">.env.local</code> (or the repo root{" "}
                <code className="rounded bg-white/80 px-1 text-xs">.env</code> if you use the shared Next config), then
                restart <code className="rounded bg-white/80 px-1 text-xs">next dev</code>.
              </p>
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className={ui.fieldLabel}>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={ui.input}
                placeholder="you@example.com"
              />
            </label>
            <label className={ui.fieldLabel}>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={ui.input}
                placeholder="Enter password"
              />
            </label>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <button type="submit" disabled={submitting} className={ui.primaryButton + " w-full justify-center"}>
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-600">
            New here?{" "}
            <Link href="/signup" className="font-semibold text-slate-900 hover:underline">
              Create an account
            </Link>
          </p>
        </SectionCard>
      </div>
    </PageShell>
  );
}
