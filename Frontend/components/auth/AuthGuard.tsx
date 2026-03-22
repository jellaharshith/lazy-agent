"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type AuthGuardProps = {
  children: ReactNode;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
};

export function AuthGuard({ children, fallback, loadingFallback }: AuthGuardProps) {
  const { loading, demoMode, session, user } = useAuth();
  const router = useRouter();
  const redirectingRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!demoMode && !user && !session?.user) {
      if (redirectingRef.current) return;
      redirectingRef.current = true;
      router.replace("/signin");
    }
  }, [loading, demoMode, session?.user, user, router]);

  if (loading) {
    return (
      <>
        {loadingFallback ?? (
          <div className="mx-auto max-w-2xl px-6 py-12 text-sm text-slate-600">Loading...</div>
        )}
      </>
    );
  }

  if (!demoMode && !session?.user) {
    return (
      <>
        {fallback ?? (
          <div className="mx-auto max-w-2xl px-6 py-12 text-sm text-slate-600">Loading...</div>
        )}
      </>
    );
  }

  return <>{children}</>;
}
