"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRole } from "@/hooks/useRole";

export function Navbar() {
  const { profile, session, signOut } = useAuth();
  const { isSeeker, isProvider } = useRole();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 shadow-[0_1px_8px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          SurplusLink
        </Link>

        <nav className="flex flex-wrap items-center gap-2 text-sm">
          {session?.user?.email ? (
            <span className="hidden max-w-[180px] truncate text-xs text-slate-500 sm:inline">
              {session.user.email}
            </span>
          ) : null}

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
          {session ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Sign out
            </button>
          ) : (
            <Link href="/signin" className="rounded-lg px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
