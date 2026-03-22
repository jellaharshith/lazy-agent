"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiUrl, jsonHeaders } from "@/lib/api";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { useAuth } from "@/context/AuthContext";
import { EmptyState, PageHeader, PageShell, SectionCard, StatusCard, ui } from "@/components/ui/app-ui";
import { cn } from "@/lib/utils";

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
    <PageShell className="max-w-4xl min-w-0">
      <PageHeader
        eyebrow="Seeker"
        title="Reservations"
        subtitle="Pickups you’ve reserved from surplus listings. Voice confirmation runs after a successful reserve."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className={cn(
              ui.secondaryButton,
              "min-h-11 w-full shrink-0 text-sm sm:w-auto sm:min-h-0 sm:text-sm"
            )}
          >
            Refresh
          </button>
        }
      />

      {error && (
        <div className="mb-3 sm:mb-4">
          <StatusCard tone="warning">{error}</StatusCard>
        </div>
      )}

      {loading ? (
        <SectionCard className="mx-auto w-full min-w-0 max-w-3xl">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span
              className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
              aria-hidden
            />
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
        <SectionCard className={cn(ui.sectionGap, "mx-auto w-full min-w-0 max-w-3xl")}>
          <ul className="space-y-2.5 sm:space-y-4">
            {rows.map((r) => (
              <li
                key={r.id}
                className={cn(
                  ui.subCard,
                  "text-sm shadow-[0_1px_4px_rgba(15,23,42,0.04)] transition hover:border-slate-300/80"
                )}
              >
                <p className="break-words font-semibold leading-snug text-slate-900">
                  {r.resource_title ?? "Listing"}
                </p>
                <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
                  <time
                    className="min-w-0 text-xs leading-snug text-slate-500 sm:text-sm"
                    dateTime={r.created_at}
                  >
                    {new Date(r.created_at).toLocaleString()}
                  </time>
                  <span className="inline-flex max-w-full items-center justify-start whitespace-normal break-words rounded-full bg-emerald-50 px-2.5 py-1 text-left text-[0.7rem] font-semibold capitalize leading-snug text-emerald-800 ring-1 ring-emerald-200 sm:px-3 sm:text-xs">
                    {r.status}
                  </span>
                </div>
                <p className="mt-2.5 border-t border-slate-200/80 pt-2.5 text-xs leading-relaxed text-slate-500 sm:mt-3 sm:pt-3 sm:text-sm">
                  <span className="block sm:inline">Confirmation phone:</span>{" "}
                  <span className="mt-0.5 inline-block font-mono text-sm text-slate-700 sm:mt-0">
                    {maskPhone(r.phone_number)}
                  </span>
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
