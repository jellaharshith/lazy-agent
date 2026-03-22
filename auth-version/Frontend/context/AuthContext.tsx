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

const DEMO_PROFILE_ID = "00000000-0000-0000-0000-000000000001";
const STORAGE_KEY = "intent-commons-demo-role";

function readStoredRole(): UserRole {
  if (typeof window === "undefined") return "seeker";
  const r = localStorage.getItem(STORAGE_KEY);
  return r === "provider" ? "provider" : "seeker";
}

function buildProfile(role: UserRole): Profile {
  return {
    id: DEMO_PROFILE_ID,
    full_name: "Demo user",
    role,
    created_at: new Date().toISOString(),
  };
}

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Demo-only: switch seeker vs provider (no login). */
  setDemoRole: (role: UserRole) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(() => buildProfile("seeker"));

  useEffect(() => {
    setProfile(buildProfile(readStoredRole()));
  }, []);

  const setDemoRole = useCallback((role: UserRole) => {
    localStorage.setItem(STORAGE_KEY, role);
    setProfile(buildProfile(role));
  }, []);

  const signOut = useCallback(async () => {
    setDemoRole("seeker");
  }, [setDemoRole]);

  const refreshProfile = useCallback(async () => {}, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: null,
      profile,
      session: null,
      loading: false,
      signOut,
      refreshProfile,
      setDemoRole,
    }),
    [profile, signOut, refreshProfile, setDemoRole]
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
