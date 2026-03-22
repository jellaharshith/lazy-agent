"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { BreakdownChart } from "@/components/dashboard/BreakdownChart";
import { DashboardQuickActionCard } from "@/components/dashboard/DashboardQuickActionCard";
import { MiniBarChart } from "@/components/dashboard/MiniBarChart";
import { MiniTrendCard } from "@/components/dashboard/MiniTrendCard";
import { PageHeader, PageShell, SectionCard, ui, EmptyState } from "@/components/ui/app-ui";
import { apiUrl, jsonHeaders } from "@/lib/api";
import { getSupabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type LiveStats = {
  foodAvailableCount: number;
  expiringSoonCount: number;
  savedCount: number;
  activeProvidersCount: number;
  activeReservationsCount: number;
};

type LiveAvailableItem = {
  id: string;
  title: string;
  quantity: number;
  discountedPrice: number | null;
  expiresAt: string | null;
  status: string;
  providerName: string | null;
};

type LiveExpiringItem = {
  id: string;
  title: string;
  quantity: number;
  discountedPrice: number | null;
  expiresAt: string | null;
  minutesLeft: number | null;
  status: string;
};

type LiveReservationItem = {
  id: string;
  resourceTitle: string;
  createdAt: string;
  status: string;
};

type TrendPoint = { label: string; value: number };

type LiveTrends = {
  availableByHour: TrendPoint[];
  savedByHour: TrendPoint[];
  resourceTypeBreakdown: TrendPoint[];
  availabilityCaption?: string;
  savedCaption?: string;
  breakdownCaption?: string;
};

type LivePayload = {
  stats: LiveStats;
  availableNow: LiveAvailableItem[];
  expiringSoon: LiveExpiringItem[];
  recentReservations: LiveReservationItem[];
  trends: LiveTrends;
};

const EMPTY_TRENDS: LiveTrends = {
  availableByHour: [],
  savedByHour: [],
  resourceTypeBreakdown: [],
};

function RoleBadge({ role }: { role: string }) {
  const label = role === "provider" ? "Provider account" : "Seeker account";
  return (
    <span
      className={cn(
        ui.mutedLabel,
        role === "provider"
          ? "border-indigo-200 bg-indigo-50 text-indigo-900"
          : "border-emerald-200 bg-emerald-50 text-emerald-900"
      )}
    >
      {label}
    </span>
  );
}

function OpsBadge({ kind }: { kind: "available" | "expiring" | "reserved" | "saved" }) {
  const map = {
    available: "border-emerald-200 bg-emerald-50 text-emerald-900",
    expiring: "border-amber-200 bg-amber-50 text-amber-900",
    reserved: "border-indigo-200 bg-indigo-50 text-indigo-900",
    saved: "border-sky-200 bg-sky-50 text-sky-900",
  } as const;
  const label =
    kind === "available"
      ? "Available"
      : kind === "expiring"
        ? "Expiring soon"
        : kind === "reserved"
          ? "Reserved"
          : "Saved";
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", map[kind])}>
      {label}
    </span>
  );
}

function reservationBadgeKind(status: string): "reserved" | "saved" {
  const s = status.toLowerCase();
  if (s === "confirmed" || s === "completed" || s === "picked_up") return "saved";
  return "reserved";
}

function formatUpdatedLabel(at: Date | null): string {
  if (!at) return "Not loaded yet";
  const sec = Math.floor((Date.now() - at.getTime()) / 1000);
  if (sec < 8) return "Updated just now";
  if (sec < 60) return `Updated ${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `Updated ${min}m ago`;
  return at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatPrice(n: number | null): string {
  if (n === null || n === undefined) return "—";
  return `$${Number(n).toFixed(2)}`;
}

function formatExpiry(iso: string | null): string {
  if (!iso) return "No expiry set";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "emerald" | "amber" | "sky" | "indigo";
}) {
  const ring =
    tone === "emerald"
      ? "border-emerald-100 bg-gradient-to-br from-emerald-50/90 to-white"
      : tone === "amber"
        ? "border-amber-100 bg-gradient-to-br from-amber-50/90 to-white"
        : tone === "sky"
          ? "border-sky-100 bg-gradient-to-br from-sky-50/90 to-white"
          : tone === "indigo"
            ? "border-indigo-100 bg-gradient-to-br from-indigo-50/90 to-white"
            : "border-slate-200 bg-white";
  return (
    <div className={cn("rounded-2xl border p-4 shadow-sm sm:p-5", ring)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function ProviderAlertPhoneCard() {
  const { session, profile, demoMode, refreshProfile } = useAuth();
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setPhone(profile?.phone_number?.trim() ?? "");
  }, [profile?.phone_number]);

  if (demoMode || !session || profile?.role !== "provider") {
    return null;
  }

  async function savePhone() {
    setSaving(true);
    setNote(null);
    try {
      const supabase = getSupabase();
      const trimmed = phone.trim();
      const { error } = await supabase
        .from("profiles")
        .update({ phone_number: trimmed || null })
        .eq("id", session.user.id);
      if (error) {
        setNote(error.message.includes("phone_number") || error.message.includes("column")
          ? "Add column phone_number to profiles (run Backend/sql/add_profile_phone.sql in Supabase)."
          : error.message);
        return;
      }
      await refreshProfile();
      setNote("Saved.");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard className={ui.sectionGap + " border-emerald-200/80 bg-emerald-50/30"}>
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900/80">Provider alerts</p>
      <h2 className="mt-2 text-lg font-bold text-slate-900">Voice alert phone</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        When a seeker reserves your listing, we call this number (E.164). It must be a real phone and{" "}
        <span className="font-medium text-slate-700">different from your Twilio caller ID</span>. Trial Twilio
        projects can only call verified numbers. If empty, the server may use{" "}
        <code className="rounded bg-white/80 px-1 text-xs">PROVIDER_ALERT_PHONE</code> or{" "}
        <code className="rounded bg-white/80 px-1 text-xs">TWILIO_TEST_TO</code> from <code className="rounded bg-white/80 px-1 text-xs">.env</code>.
      </p>
      <label className={ui.fieldLabel + " mt-4 block"}>
        Phone
        <input
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={ui.input}
          placeholder="+1…"
        />
      </label>
      <button
        type="button"
        className={ui.secondaryButton + " mt-3"}
        disabled={saving}
        onClick={() => void savePhone()}
      >
        {saving ? "Saving…" : "Save"}
      </button>
      {note ? (
        <p className={"mt-2 text-sm " + (note === "Saved." ? "text-emerald-800" : "text-amber-900")}>
          {note}
        </p>
      ) : null}
    </SectionCard>
  );
}

function VoiceTestCallPanel() {
  const { session, demoMode } = useAuth();
  const [loading, setLoading] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  if (demoMode || !session) {
    return null;
  }

  async function runTestCall() {
    setLoading(true);
    setErrMsg(null);
    setOkMsg(null);
    try {
      const res = await fetch(apiUrl("/api/voice/test-call"), {
        method: "POST",
        headers: jsonHeaders(session),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        destinationHint?: string;
      };
      if (!res.ok) {
        setErrMsg(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
        return;
      }
      if (data.success) {
        setOkMsg(
          `Outbound call created (destination ${data.destinationHint ?? "••••"}). ${data.message ?? ""}`.trim()
        );
      } else {
        setErrMsg(typeof data.error === "string" ? data.error : "Call was not placed");
      }
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SectionCard className={ui.sectionGap + " border-violet-200/80 bg-violet-50/35"}>
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-800/90">Voice</p>
      <h2 className="mt-2 text-lg font-bold text-slate-900">Test Twilio call</h2>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">
        Places the same test call as <code className="rounded bg-white/80 px-1 py-0.5 text-xs">npm run twilio:test-call</code>{" "}
        to the number in server <code className="rounded bg-white/80 px-1 py-0.5 text-xs">TWILIO_TEST_TO</code>. Trial
        accounts must verify that number in Twilio.
      </p>
      <button
        type="button"
        className={ui.secondaryButton + " mt-4"}
        disabled={loading}
        onClick={() => void runTestCall()}
      >
        {loading ? "Calling…" : "Place test call"}
      </button>
      {okMsg ? <p className="mt-3 text-sm font-medium text-emerald-800">{okMsg}</p> : null}
      {errMsg ? <p className="mt-3 text-sm font-medium text-red-700">{errMsg}</p> : null}
    </SectionCard>
  );
}

function LiveOperationsBoard() {
  const [data, setData] = useState<LivePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/dashboard/live"), { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.error === "string" ? body.error : `Request failed (${res.status})`);
      }
      const json = (await res.json()) as LivePayload;
      setData({
        ...json,
        trends: { ...EMPTY_TRENDS, ...json.trends },
      });
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load live data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  const stats = data?.stats;
  const trends = data?.trends ?? EMPTY_TRENDS;

  return (
    <section className={ui.sectionGap} aria-label="Live operations">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operations</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">Surplus activity</h2>
          <p className="mt-1 text-sm text-slate-600">Polls every 15 seconds — tap refresh for an immediate update.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">{formatUpdatedLabel(lastUpdated)}</span>
          <button type="button" className={ui.secondaryButton + " py-2"} onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <SectionCard className="mt-6 border-red-200 bg-red-50/50">
          <p className="text-sm font-semibold text-red-900">{error}</p>
          <p className="mt-1 text-sm text-red-800/90">Check the API server and Supabase keys (service role unlocks reservation stats).</p>
          <button type="button" className={ui.secondaryButton + " mt-4"} onClick={() => void load()}>
            Retry
          </button>
        </SectionCard>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Food available" value={stats?.foodAvailableCount ?? 0} tone="emerald" />
        <StatTile label="Going to waste soon" value={stats?.expiringSoonCount ?? 0} tone="amber" />
        <StatTile label="Food saved" value={stats?.savedCount ?? 0} tone="sky" />
        <StatTile label="Active reservations" value={stats?.activeReservationsCount ?? 0} tone="indigo" />
        <StatTile label="Active providers" value={stats?.activeProvidersCount ?? 0} />
      </div>

      {data ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <MiniTrendCard
            title="Availability trend"
            subtitle={
              trends.availabilityCaption ??
              "New listings posted into each of the last four local hours (sampled)."
            }
          >
            <MiniBarChart
              data={trends.availableByHour}
              barClassName="bg-emerald-500/80"
              emptyHint={
                trends.availabilityCaption
                  ? "No listing timestamps in range."
                  : "No new listings in this window."
              }
            />
          </MiniTrendCard>
          <MiniTrendCard
            title="Food saved trend"
            subtitle={
              trends.savedCaption ??
              "Reservations (reserved + confirmed) created in each clock hour."
            }
          >
            <MiniBarChart
              data={trends.savedByHour}
              barClassName="bg-sky-500/80"
              emptyHint={
                trends.savedCaption
                  ? "Nothing to plot from the current snapshot."
                  : "No reservation events in this window."
              }
            />
          </MiniTrendCard>
          <MiniTrendCard
            title="Food types"
            subtitle={
              trends.breakdownCaption ??
              "Category when set; otherwise resource type on available listings."
            }
          >
            <BreakdownChart
              data={trends.resourceTypeBreakdown}
              barClassName="bg-indigo-500/75"
              emptyHint={
                trends.breakdownCaption
                  ? "No breakdown rows returned."
                  : "No typed listings in the sample."
              }
            />
          </MiniTrendCard>
        </div>
      ) : null}

      {loading && !data ? (
        <SectionCard className="mt-6 animate-pulse border-slate-200 bg-slate-50">
          <p className="text-sm font-medium text-slate-500">Loading live dashboard…</p>
        </SectionCard>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard className="border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900">Available now</h3>
            <OpsBadge kind="available" />
          </div>
          {!loading && data && data.availableNow.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No listings" description="When providers publish surplus, they will show up here." />
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {(data?.availableNow ?? []).map((item) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-sm text-slate-800"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900">{item.title}</span>
                    <span className="shrink-0 text-xs text-slate-500">Qty {item.quantity}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {formatPrice(item.discountedPrice)} · {formatExpiry(item.expiresAt)}
                  </p>
                  {item.providerName ? <p className="mt-1 text-xs text-slate-500">{item.providerName}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard className="border-amber-100 bg-gradient-to-b from-amber-50/40 to-white">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900">Going to waste soon</h3>
            <OpsBadge kind="expiring" />
          </div>
          <p className="mt-1 text-xs text-amber-900/80">Within the next 3 hours · soonest first</p>
          {!loading && data && data.expiringSoon.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="All clear" description="Nothing is expiring in the next three hours." />
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {(data?.expiringSoon ?? []).map((item, idx) => (
                <li
                  key={item.id}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-sm",
                    idx === 0 ? "border-amber-300 bg-amber-50/90 shadow-sm" : "border-amber-100 bg-white/80"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900">{item.title}</span>
                    {item.minutesLeft !== null ? (
                      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-950">
                        {item.minutesLeft}m left
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {formatPrice(item.discountedPrice)} · {formatExpiry(item.expiresAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard className="border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900">Recent reservations</h3>
            <OpsBadge kind="saved" />
          </div>
          {!loading && data && data.recentReservations.length === 0 ? (
            <div className="mt-4">
              <EmptyState title="No reservations yet" description="Seeker holds will appear here as they come in." />
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {(data?.recentReservations ?? []).map((item) => (
                <li key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-slate-900">{item.resourceTitle}</span>
                    <OpsBadge kind={reservationBadgeKind(item.status)} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(item.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const { profile, demoMode, session, loading, profileLoading } = useAuth();
  const role = profile?.role ?? "seeker";
  const displayName = profile?.full_name?.trim() || session?.user?.email?.split("@")[0] || "there";

  if (!loading && !demoMode && !session) {
    return (
      <PageShell>
        <PageHeader
          eyebrow="SurplusLink"
          title="Dashboard"
          subtitle="Sign in to open your seeker or provider workspace from one place."
        />
        <SectionCard className="mt-8 max-w-lg">
          <p className="text-sm leading-relaxed text-slate-600">
            SurplusLink matches urgent food needs to nearby surplus listings and optional voice confirmation.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link href="/signin" className={ui.primaryButton + " w-full justify-center py-3 sm:w-auto"}>
              Sign in
            </Link>
            <Link href="/signup" className={ui.secondaryButton + " w-full justify-center py-3 sm:w-auto"}>
              Create account
            </Link>
          </div>
        </SectionCard>
      </PageShell>
    );
  }

  if (!loading && !profileLoading && !demoMode && session && !profile) {
    return (
      <PageShell>
        <PageHeader title="Dashboard" subtitle="We need your profile to personalize this page." />
        <SectionCard className="mt-8">
          <p className="text-sm text-slate-700">We couldn&apos;t load your profile. Try refreshing the page.</p>
        </SectionCard>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="SurplusLink"
        title="Live dashboard"
        subtitle="Track available food, expiring listings, and meals saved in real time."
      />

      <SectionCard className={ui.sectionGap + " border-slate-200 bg-gradient-to-br from-white via-slate-50/40 to-white"}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Welcome</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Hi, {displayName}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              {role === "seeker"
                ? "Start a food request or jump to your matches — everything routes from here."
                : "Publish listings and keep inventory current so seekers can find you quickly."}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end sm:pt-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Signed in as</p>
            <RoleBadge role={role} />
            {demoMode && (
              <p className="max-w-xs text-right text-xs text-slate-500">
                Demo mode: use the header toggle to preview seeker vs provider without signing in.
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      <VoiceTestCallPanel />

      <LiveOperationsBoard />

      {role === "seeker" && (
        <>
          <section className={ui.sectionGap + " grid gap-4 lg:grid-cols-2"}>
            <DashboardQuickActionCard
              accent
              kicker="Quick action"
              title="Request food"
              description="Describe what you need in plain language. We rank nearby surplus, show a map, and help you reserve when it’s a live listing."
              primaryHref="/request-food"
              primaryLabel="Request food"
            />
            <DashboardQuickActionCard
              kicker="Quick action"
              title="View matches"
              description="Open your matches view to see nearby options, distances, and anything you’ve reserved."
              primaryHref="/matches"
              primaryLabel="View matches"
            />
          </section>
          <SectionCard className={ui.sectionGap + " border-dashed border-slate-200 bg-slate-50/50"}>
            <p className="text-sm leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">Tip:</span> allow location in the browser for better
              distance ranking. You can still run the flow with a default city.
            </p>
          </SectionCard>
        </>
      )}

      {role === "provider" && (
        <>
          <ProviderAlertPhoneCard />
          <section className={ui.sectionGap + " grid gap-4 lg:grid-cols-2"}>
            <DashboardQuickActionCard
              accent
              kicker="Quick action"
              title="Add resource"
              description="Set title, category, quantity, pricing, and pickup window. New surplus becomes eligible for matching right away."
              primaryHref="/add-resource"
              primaryLabel="Add resource"
            />
            <DashboardQuickActionCard
              kicker="Quick action"
              title="My resources"
              description="Review quantity, prices, expiry, and status for everything you’ve published."
              primaryHref="/provider/resources"
              primaryLabel="View my resources"
            />
          </section>
          <SectionCard className={ui.sectionGap + " border-dashed border-slate-200 bg-slate-50/50"}>
            <p className="text-sm leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">Tip:</span> use “Use my location” on the add form so
              seekers see accurate distance on the map.
            </p>
          </SectionCard>
        </>
      )}

      <section className={ui.sectionGap}>
        <SectionCard className="border-dashed border-slate-200 bg-slate-50/60">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Explore</p>
          <p className="mt-2 text-sm text-slate-600">Original multi-step concept demo.</p>
          <Link href="/flow" className={ui.secondaryButton + " mt-4"}>
            Open flow
          </Link>
        </SectionCard>
      </section>
    </PageShell>
  );
}
