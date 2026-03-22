"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiUrl, jsonHeaders } from "@/lib/api";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { useAuth } from "@/context/AuthContext";
import { EmptyState, PageHeader, PageShell, SectionCard, StatusCard, ui } from "@/components/ui/app-ui";

type ReservationRow = {
  id: string;
  resource_id: string;
  status: string;
  phone_number: string | null;
  created_at: string;
  resource_title?: string | null;
};

function maskPhone(p: string | null): string {
  if (!p || p.length < 4) return "—";
  const tail = p.slice(-4);
  return `···${tail}`;
}

function MatchesContent() {
  const { session } = useAuth();
  const [rows, setRows] = useState<ReservationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.access_token) {
      setLoading(false);
      setError("Sign in to see your reservations.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/my/reservations"), {
        headers: jsonHeaders(session),
      });
      const data = (await res.json()) as ReservationRow[] | { error?: string };
      if (!res.ok) {
        setError(typeof data === "object" && data && "error" in data ? String(data.error) : "Failed to load");
        return;
      }
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setError("Could not load reservations");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Seeker"
        title="Reservations"
        subtitle="Pickups you’ve reserved from surplus listings. Voice confirmation runs after a successful reserve."
        actions={
          <button type="button" onClick={() => void load()} className={ui.secondaryButton + " text-xs"}>
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-4">
          <StatusCard tone="warning">{error}</StatusCard>
        </div>
      )}

      {loading ? (
        <SectionCard>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            Loading reservations…
          </div>
        </SectionCard>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No reservations yet"
          description="Run Request food, get a Supabase match, then reserve with your phone number."
          action={
            <Link href="/request-food" className={ui.primaryButton}>
              Request food
            </Link>
          }
        />
      ) : (
        <SectionCard className={ui.sectionGap}>
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className={ui.subCard + " text-sm"}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{r.resource_title ?? "Listing"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {new Date(r.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-emerald-800 ring-1 ring-emerald-200">
                    {r.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Confirmation phone: <span className="font-mono text-slate-700">{maskPhone(r.phone_number)}</span>
                </p>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </PageShell>
  );
}

export default function MatchesPage() {
  return (
    <RoleGuard allowedRoles={["seeker"]}>
      <MatchesContent />
    </RoleGuard>
  );
}
