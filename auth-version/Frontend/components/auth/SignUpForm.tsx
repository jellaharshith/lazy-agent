"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatAuthErrorMessage } from "@/lib/authErrors";
import { getSupabase } from "@/lib/supabase";
import type { UserRole } from "@/types/auth";

export function SignUpForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("seeker");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    const { data, error: signError } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role,
        },
      },
    });

    if (signError) {
      setSubmitting(false);
      setError(formatAuthErrorMessage(signError.message));
      return;
    }

    const u = data.user;
    if (!u) {
      setSubmitting(false);
      setError("Sign up did not return a user.");
      return;
    }

    // App-side profile row (no DB trigger). Requires a session for RLS insert.
    if (data.session) {
      const { error: profileError } = await getSupabase().from("profiles").upsert(
        {
          id: u.id,
          full_name: fullName.trim() || null,
          role,
        },
        { onConflict: "id" }
      );

      if (profileError) {
        setSubmitting(false);
        setError(profileError.message);
        return;
      }

      router.replace("/flow");
      router.refresh();
      setSubmitting(false);
      return;
    }

    // Email confirmation on: no session yet — user must confirm, then complete profile on first sign-in.
    setInfo(
      "Check your email to confirm your account. After confirming, sign in once — you may need to contact an admin if profile setup did not run."
    );
    setSubmitting(false);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
    >
      <h1 className="text-2xl font-bold text-slate-900">Create account</h1>
      <p className="text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/signin" className="font-medium text-slate-900 underline">
          Sign in
        </Link>
      </p>

      <div>
        <label className="block text-sm font-medium text-slate-700">Full name</label>
        <input
          type="text"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

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
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-slate-700">I am a</legend>
        <div className="mt-2 flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="role"
              checked={role === "seeker"}
              onChange={() => setRole("seeker")}
            />
            Seeker (need help)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="role"
              checked={role === "provider"}
              onChange={() => setRole("provider")}
            />
            Provider (offer resources)
          </label>
        </div>
      </fieldset>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {info && (
        <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">{info}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {submitting ? "Creating account…" : "Sign up"}
      </button>
    </form>
  );
}
