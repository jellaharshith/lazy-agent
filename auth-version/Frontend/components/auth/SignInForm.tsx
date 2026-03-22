"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatAuthErrorMessage } from "@/lib/authErrors";
import { getSupabase } from "@/lib/supabase";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: signError } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setSubmitting(false);

    if (signError) {
      setError(formatAuthErrorMessage(signError.message));
      return;
    }

    router.replace("/flow");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
      <p className="text-sm text-slate-600">
        No account?{" "}
        <Link href="/signup" className="font-medium text-slate-900 underline">
          Sign up
        </Link>
      </p>

      <div>
        <label className="block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
