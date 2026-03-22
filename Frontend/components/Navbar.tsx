"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRole } from "@/hooks/useRole";
import type { UserRole } from "@/types/auth";

export function Navbar() {
  const { profile, setDemoRole, demoMode, session, signOut } = useAuth();
  const { isSeeker, isProvider } = useRole();

  function pick(role: UserRole) {
    setDemoRole(role);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-[0_1px_8px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          SurplusLink
        </Link>

        <nav className="flex flex-wrap items-center gap-2 text-sm">
          {demoMode && (
            <div
              className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm"
              role="group"
              aria-label="Demo role"
            >
              <button
                type="button"
                onClick={() => pick("seeker")}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                  profile?.role === "seeker"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                Seeker
              </button>
              <button
                type="button"
                onClick={() => pick("provider")}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                  profile?.role === "provider"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                Provider
              </button>
            </div>
          )}

          {!demoMode && session?.user?.email && (
            <span className="hidden max-w-[180px] truncate text-xs text-slate-500 sm:inline">
              {session.user.email}
            </span>
          )}

          <Link
            href="/dashboard"
            className="rounded-lg px-2 py-1 font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
          >
            Dashboard
          </Link>
          {isSeeker && (
            <>
              <Link
                href="/request-food"
                className="rounded-lg px-2 py-1 font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Request
              </Link>
              <Link
                href="/matches"
                className="rounded-lg px-2 py-1 font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Matches
              </Link>
            </>
          )}
          {isProvider && (
            <>
              <Link
                href="/provider"
                className="rounded-lg px-2 py-1 font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Provider
              </Link>
              <Link
                href="/add-resource"
                className="rounded-lg px-2 py-1 font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900"
              >
                Add resource
              </Link>
            </>
          )}
          {profile?.role && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-slate-700">
              {profile.role}
            </span>
          )}
          {!demoMode && session && (
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Sign out
            </button>
          )}
          {!session && !demoMode && (
            <Link href="/signin" className="rounded-lg px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
