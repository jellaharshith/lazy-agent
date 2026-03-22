"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useAuth } from "@/context/AuthContext";
import { ui } from "@/components/ui/app-ui";
import type { UserRole } from "@/types/auth";

type RoleGuardProps = {
  allowedRoles: UserRole[];
  children: ReactNode;
};

export function RoleGuard({ allowedRoles, children }: RoleGuardProps) {
  const { loading, profileLoading, profile, profileError, demoMode, session, setDemoRole, refreshProfile } =
    useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || demoMode || profileLoading) return;
    if (!profile) return;
    if (!allowedRoles.includes(profile.role)) {
      router.replace("/dashboard");
    }
  }, [loading, demoMode, profileLoading, profile, allowedRoles, router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12 text-sm text-slate-600">Loading...</div>
    );
  }

  if (!demoMode && session?.user && profileLoading) {
    const meta = session.user.user_metadata as { role?: string } | undefined;
    const metaRole = meta?.role === "provider" || meta?.role === "seeker" ? meta.role : null;
    if (metaRole && (allowedRoles as readonly string[]).includes(metaRole)) {
      return <AuthGuard>{children}</AuthGuard>;
    }
    return (
      <div className="mx-auto max-w-2xl px-6 py-12 text-sm text-slate-600">Loading profile…</div>
    );
  }

  function roleGate(): ReactNode {
    if (!demoMode && session?.user && !profile) {
      if (profileError) {
        return (
          <main className="mx-auto max-w-2xl px-6 py-12">
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-950">
              <h1 className="text-lg font-semibold">Couldn&apos;t load profile</h1>
              <p className="mt-2 text-sm break-words">{profileError}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" onClick={() => void refreshProfile()} className={ui.primaryButton}>
                  Try again
                </button>
                <Link href="/dashboard" className={ui.secondaryButton}>
                  Dashboard
                </Link>
              </div>
            </div>
          </main>
        );
      }
      return (
        <main className="mx-auto max-w-2xl px-6 py-12">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <h1 className="text-lg font-semibold">Profile not ready</h1>
            <p className="mt-2 text-sm text-amber-900">
              Your account has no profile row yet. Try refreshing, or sign out and back in.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => void refreshProfile()} className={ui.primaryButton}>
                Retry
              </button>
              <Link href="/dashboard" className={ui.secondaryButton}>
                Dashboard
              </Link>
            </div>
          </div>
        </main>
      );
    }

    if (demoMode && !profile) {
      return (
        <main className="mx-auto max-w-2xl px-6 py-12">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <h1 className="text-lg font-semibold">Profile not found</h1>
            <p className="mt-2 text-sm text-amber-900">Try refreshing the page.</p>
            <Link href="/dashboard" className={`${ui.primaryButton} mt-4 inline-flex`}>
              Dashboard
            </Link>
          </div>
        </main>
      );
    }

    if (profile && allowedRoles.includes(profile.role)) {
      return <>{children}</>;
    }

    if (!demoMode && profile && !allowedRoles.includes(profile.role)) {
      return (
        <main className="mx-auto max-w-2xl px-6 py-12 text-sm text-slate-600">Loading...</main>
      );
    }

    if (demoMode && profile && !allowedRoles.includes(profile.role)) {
      return (
        <main className="mx-auto max-w-2xl px-6 py-12">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <h1 className="text-lg font-semibold">This page is not available for your role.</h1>
            <p className="mt-2 text-sm text-amber-900">
              Switch demo role or use the dashboard to continue.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {allowedRoles.includes("seeker") && (
                <button
                  type="button"
                  onClick={() => setDemoRole("seeker")}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  Demo: seeker
                </button>
              )}
              {allowedRoles.includes("provider") && (
                <button
                  type="button"
                  onClick={() => setDemoRole("provider")}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  Demo: provider
                </button>
              )}
              <Link
                href="/dashboard"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </main>
      );
    }

    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <h1 className="text-lg font-semibold">Profile not found</h1>
          <p className="mt-2 text-sm text-amber-900">
            Try signing in again or open the dashboard.
          </p>
          <Link href="/dashboard" className={`${ui.primaryButton} mt-4 inline-flex`}>
            Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return <AuthGuard>{roleGate()}</AuthGuard>;
}
