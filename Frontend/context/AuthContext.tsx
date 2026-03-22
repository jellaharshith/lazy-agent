"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Profile, UserRole } from "@/types/auth";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

const DEMO_STORAGE_KEY = "intent-commons-demo-role";
const PROFILE_LOAD_TIMEOUT_MS = 12_000;

function readDemoRole(): UserRole {
  if (typeof window === "undefined") return "seeker";
  const r = localStorage.getItem(DEMO_STORAGE_KEY);
  return r === "provider" ? "provider" : "seeker";
}

function demoProfile(role: UserRole): Profile {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    full_name: "Demo user",
    role,
    created_at: new Date().toISOString(),
  };
}

function formatSupabaseError(err: {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}): string {
  return [err.message, err.details, err.hint, err.code].filter(Boolean).join(" | ");
}

type ProfileResult = { profile: Profile | null; error: string | null };

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  /** True until the first `getSession()` completes. */
  loading: boolean;
  /** True while fetching `profiles` for the signed-in user. */
  profileLoading: boolean;
  /** Last profile fetch error (cleared on success or sign-out). */
  profileError: string | null;
  demoMode: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setDemoRole: (role: UserRole) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadOrCreateProfile(user: User): Promise<ProfileResult> {
  const supabase = getSupabase();

  const { data: existing, error: selectErr } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (selectErr) {
    console.error("[auth] profile select Supabase error:", selectErr);
    return { profile: null, error: formatSupabaseError(selectErr) };
  }

  if (existing && existing.role) {
    console.log("[auth] profile fetch result: found row", { id: user.id, role: existing.role });
    return { profile: existing as Profile, error: null };
  }

  const meta = user.user_metadata as { role?: string; full_name?: string } | undefined;
  const role = (meta?.role === "provider" ? "provider" : "seeker") as UserRole;
  const full_name = typeof meta?.full_name === "string" ? meta.full_name : null;

  const { error: upsertErr } = await supabase.from("profiles").upsert(
    { id: user.id, full_name, role },
    { onConflict: "id" }
  );

  if (upsertErr) {
    console.error("[auth] profile upsert Supabase error:", upsertErr);
    return { profile: null, error: formatSupabaseError(upsertErr) };
  }

  const { data: again, error: againErr } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (againErr) {
    console.error("[auth] profile re-select Supabase error:", againErr);
    return { profile: null, error: formatSupabaseError(againErr) };
  }

  if (!again?.role) {
    const msg = "Profile row missing after upsert";
    console.error("[auth] profile fetch result:", msg);
    return { profile: null, error: msg };
  }

  console.log("[auth] profile fetch result: created/loaded", { id: user.id, role: again.role });
  return { profile: again as Profile, error: null };
}

async function loadOrCreateProfileWithTimeout(user: User): Promise<ProfileResult> {
  try {
    return await Promise.race([
      loadOrCreateProfile(user),
      new Promise<ProfileResult>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Profile load timed out after ${PROFILE_LOAD_TIMEOUT_MS}ms`)),
          PROFILE_LOAD_TIMEOUT_MS
        )
      ),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[auth] profile fetch failed:", err);
    return { profile: null, error: msg };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(false);

  const refreshProfile = useCallback(async () => {
    setProfileError(null);
    if (demoMode) {
      setProfile(demoProfile(readDemoRole()));
      return;
    }
    if (!session?.user) {
      setProfile(null);
      return;
    }
    const uid = session.user.id;
    console.log("[auth] refreshProfile for user id:", uid);
    setProfileLoading(true);
    try {
      const { profile: p, error } = await loadOrCreateProfileWithTimeout(session.user);
      setProfile(p);
      setProfileError(error);
      if (error) {
        console.error("[auth] refreshProfile error message:", error);
      } else {
        console.log("[auth] refreshProfile ok", p ? `role=${p.role}` : "no profile");
      }
    } finally {
      setProfileLoading(false);
    }
  }, [demoMode, session?.user]);

  useEffect(() => {
    let cancelled = false;

    if (!isSupabaseConfigured()) {
      setDemoMode(true);
      setUser(null);
      setSession(null);
      setProfile(demoProfile(readDemoRole()));
      setProfileLoading(false);
      setProfileError(null);
      setLoading(false);
      return;
    }

    setDemoMode(false);

    const supabase = getSupabase();

    async function boot() {
      setLoading(true);
      setProfileError(null);
      let sessionUser: User | null = null;
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;

        const s = data.session ?? null;
        setSession(s);
        setUser(s?.user ?? null);
        sessionUser = s?.user ?? null;

        console.log("[auth] session user id:", sessionUser?.id ?? "none");

        if (!sessionUser) {
          setProfile(null);
          setProfileLoading(false);
        }
      } catch (err) {
        console.error("[auth] getSession error:", err);
        if (!cancelled) {
          setDemoMode(true);
          setSession(null);
          setUser(null);
          setProfile(demoProfile(readDemoRole()));
          setProfileError(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }

      if (cancelled || !sessionUser) {
        return;
      }

      setProfileLoading(true);
      setProfileError(null);
      try {
        const { profile: nextProfile, error } = await loadOrCreateProfileWithTimeout(sessionUser);
        if (cancelled) return;
        setProfile(nextProfile);
        setProfileError(error);
        if (error) {
          console.error("[auth] boot profile error:", error);
        }
      } finally {
        if (!cancelled) {
          setProfileLoading(false);
        }
      }
    }

    void boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (cancelled) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      const uid = nextSession?.user?.id;
      console.log("[auth] onAuthStateChange session user id:", uid ?? "none");

      if (nextSession?.user) {
        setProfileLoading(true);
        setProfileError(null);
        try {
          const { profile: p, error } = await loadOrCreateProfileWithTimeout(nextSession.user);
          if (cancelled) return;
          setProfile(p);
          setProfileError(error);
          if (error) {
            console.error("[auth] onAuthStateChange profile error:", error);
          } else {
            console.log("[auth] onAuthStateChange profile ok", p ? `role=${p.role}` : "");
          }
        } finally {
          if (!cancelled) {
            setProfileLoading(false);
          }
        }
      } else {
        setProfile(null);
        setProfileError(null);
        setProfileLoading(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const setDemoRole = useCallback((role: UserRole) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(DEMO_STORAGE_KEY, role);
    }
    setProfile(demoProfile(role));
    setProfileError(null);
  }, []);

  const signOut = useCallback(async () => {
    if (demoMode) {
      setDemoRole("seeker");
      return;
    }
    try {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    } catch (e) {
      console.error("[auth] signOut", e);
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setProfileLoading(false);
    setProfileError(null);
  }, [demoMode, setDemoRole]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      session,
      loading,
      profileLoading,
      profileError,
      demoMode,
      signOut,
      refreshProfile,
      setDemoRole,
    }),
    [user, profile, session, loading, profileLoading, profileError, demoMode, signOut, refreshProfile, setDemoRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
