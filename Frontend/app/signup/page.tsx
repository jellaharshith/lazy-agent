"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatAuthErrorMessage } from "@/lib/authErrors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import type { UserRole } from "@/types/auth";
import { PageShell, SectionCard, ui } from "@/components/ui/app-ui";

function looksLikeE164(s: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(s.trim());
}

export default function SignUpPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("seeker");
  const [optionalPhone, setOptionalPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!isSupabaseConfigured()) {
      setError("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    const phoneTrim = optionalPhone.trim();
    if (phoneTrim && !looksLikeE164(phoneTrim)) {
      setError("Phone must be in E.164 format with country code, e.g. +15551234567.");
      return;
    }
    setSubmitting(true);
    try {
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
        setError(formatAuthErrorMessage(signError.message));
        return;
      }

      const u = data.user;
      if (!u) {
        setError("Sign up did not return a user.");
        return;
      }

      if (data.session) {
        const profileRow: { id: string; full_name: string | null; role: UserRole; phone_number?: string } = {
          id: u.id,
          full_name: fullName.trim() || null,
          role,
        };
        if (phoneTrim) {
          profileRow.phone_number = phoneTrim;
        }
        const { error: profileError } = await getSupabase().from("profiles").upsert(profileRow, {
          onConflict: "id",
        });

        if (profileError) {
          setError(profileError.message);
          return;
        }

        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setInfo(
        "Check your email to confirm your account. After confirming, sign in to continue."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageShell className="py-16">
      <div className="mx-auto w-full max-w-xl">
        <SectionCard className="p-7 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Create account</p>
          <h1 className={ui.title + " mt-2"}>Sign up</h1>
          <p className="mt-2 text-sm text-slate-600">Choose your role — you can refine this later in Supabase if needed.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className={ui.fieldLabel}>
              Full name
              <input
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={ui.input}
                placeholder="Your name"
              />
            </label>
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
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={ui.input}
                placeholder="At least 6 characters"
              />
            </label>
            <fieldset>
              <legend className={ui.fieldLabel}>I am a</legend>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    checked={role === "seeker"}
                    onChange={() => setRole("seeker")}
                  />
                  Seeker
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="role"
                    checked={role === "provider"}
                    onChange={() => setRole("provider")}
                  />
                  Provider
                </label>
              </div>
            </fieldset>
            <label className={ui.fieldLabel}>
              Phone <span className="font-normal text-slate-500">(optional)</span>
              <input
                type="tel"
                autoComplete="tel"
                value={optionalPhone}
                onChange={(e) => setOptionalPhone(e.target.value)}
                className={ui.input}
                placeholder="+15551234567"
              />
              <span className="mt-1 block text-xs font-normal leading-relaxed text-slate-500">
                E.164 with country code. Seekers: prefill for reservation confirmation calls. Providers: voice
                alerts when someone reserves your listing (also editable on the dashboard).
              </span>
            </label>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            {info && <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">{info}</p>}
            <button type="submit" disabled={submitting} className={ui.primaryButton + " w-full justify-center"}>
              {submitting ? "Creating account…" : "Sign up"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link href="/signin" className="font-semibold text-slate-900 hover:underline">
              Sign in
            </Link>
          </p>
        </SectionCard>
      </div>
    </PageShell>
  );
}
