"use client";

import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
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

const PROFILE_LOAD_TIMEOUT_MS = 12_000;

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
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadOrCreateProfile(user: User): Promise<ProfileResult> {
  const supabase = getSupabase();

  const { data: existing, error: selectErr } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at, phone_number")
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
    .select("id, full_name, role, created_at, phone_number")
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

  const refreshProfile = useCallback(async () => {
    setProfileError(null);
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
  }, [session?.user]);

  useEffect(() => {
    let cancelled = false;

    if (!isSupabaseConfigured()) {
      setUser(null);
      setSession(null);
      setProfile(null);
      setProfileLoading(false);
      setProfileError(null);
      setLoading(false);
      return;
    }

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
          setSession(null);
          setUser(null);
          setProfile(null);
          setProfileError(err instanceof Error ? err.message : "Could not restore session");
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
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, nextSession) => {
      if (cancelled) return;

      // GoTrue can emit INITIAL_SESSION with a null session when internal storage read fails,
      // even after getSession() / SIGNED_IN already set a valid session. Re-read once so we
      // do not wipe a good session a few seconds later.
      let sessionToApply = nextSession;
      if (event === "INITIAL_SESSION" && !nextSession) {
        try {
          const { data } = await supabase.auth.getSession();
          sessionToApply = data.session ?? null;
        } catch (reReadErr) {
          console.error("[auth] INITIAL_SESSION null; getSession re-read failed:", reReadErr);
        }
      }

      setSession(sessionToApply);
      setUser(sessionToApply?.user ?? null);

      const uid = sessionToApply?.user?.id;
      console.log("[auth] onAuthStateChange", event, "user id:", uid ?? "none");

      if (sessionToApply?.user) {
        setProfileLoading(true);
        setProfileError(null);
        try {
          const { profile: p, error } = await loadOrCreateProfileWithTimeout(sessionToApply.user);
          if (cancelled) return;
          setProfile(p);
          setProfileError(error);
          if (error) {
            console.error("[auth] onAuthStateChange profile error:", error);
          } else {
            console.log("[auth] onAuthStateChange profile ok", p ? `role=${p.role}` : "");
          }
        } catch (profileErr) {
          console.error("[auth] onAuthStateChange profile exception:", profileErr);
          if (!cancelled) {
            setProfile(null);
            setProfileError(profileErr instanceof Error ? profileErr.message : "Profile load failed");
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

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabase();
        await supabase.auth.signOut();
      } catch (e) {
        console.error("[auth] signOut", e);
      }
    }
    setUser(null);
    setSession(null);
    setProfile(null);
    setProfileLoading(false);
    setProfileError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      session,
      loading,
      profileLoading,
      profileError,
      signOut,
      refreshProfile,
    }),
    [user, profile, session, loading, profileLoading, profileError, signOut, refreshProfile]
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
