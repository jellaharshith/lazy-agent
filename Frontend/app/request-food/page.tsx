"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiUrl, jsonHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, PageShell, SectionCard, StatusCard, ui } from "@/components/ui/app-ui";
import { cn } from "@/lib/utils";

const DEFAULT_LAT = 37.6688;
const DEFAULT_LNG = -122.0808;

const EXAMPLE_PROMPTS = [
  "I have not eaten today",
  "I need a quick meal nearby",
  "Show me cheap Indian food nearby",
  "Show me free food options",
];

const MatchMap = dynamic(() => import("@/components/MatchMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[200px] min-h-[180px] w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500 sm:h-[240px] sm:min-h-[220px] md:h-[280px] lg:h-[320px] xl:h-[360px]">
      Loading map…
    </div>
  ),
});

type IntakeClassification = {
  need_type?: string;
  urgency?: string;
  confidence?: number;
  source?: string;
};

type BestMatch = {
  title: string;
  type?: string;
  quantity: number;
  originalPrice?: number | null;
  discountedPrice?: number | null;
  distanceKm: number;
  expiresAt?: string | null;
  source?: string;
  rating?: number | null;
  location?: { lat: number; lng: number };
  resourceId?: string | null;
};

type IntakeSuccess = {
  success: boolean;
  message?: string;
  summary?: string;
  classification?: IntakeClassification;
  bestMatch?: BestMatch | null;
};

function formatConfidence(c?: number): string {
  if (typeof c !== "number" || !Number.isFinite(c)) return "—";
  return `${Math.round(c * 100)}%`;
}

function formatExpires(value?: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

/** Loose E.164 check for outbound Twilio (country code + digits). */
function looksLikeE164(s: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(s.trim());
}

function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center justify-start whitespace-normal break-words rounded-full bg-slate-100 px-2.5 py-1 text-left text-xs font-medium leading-snug text-slate-600 sm:py-0.5",
        className
      )}
    >
      {children}
    </span>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2 last:border-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:py-2.5">
      <span className="shrink-0 text-xs font-medium text-slate-500 sm:text-sm">{label}</span>
      <span className="min-w-0 break-words text-sm font-medium text-slate-900 sm:text-right">
        {value}
      </span>
    </div>
  );
}

function RequestFoodContent() {
  const { session, profile, profileError, refreshProfile } = useAuth();
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IntakeSuccess | null>(null);

  const [coords, setCoords] = useState({ lat: DEFAULT_LAT, lng: DEFAULT_LNG });
  const [locationStatus, setLocationStatus] = useState<"pending" | "granted" | "fallback">(
    "pending"
  );

  const [phone, setPhone] = useState("");
  const [reserveLoading, setReserveLoading] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [reserved, setReserved] = useState(false);
  const [voiceCalls, setVoiceCalls] = useState<{
    seeker: { attempted: boolean; success: boolean; provider: string; message: string; simulated?: boolean };
    provider: { attempted: boolean; success: boolean; provider: string; message: string; simulated?: boolean };
  } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setLocationStatus("fallback");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationStatus("granted");
      },
      () => setLocationStatus("fallback"),
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 5_000 }
    );
  }, []);

  useEffect(() => {
    if (result?.success && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result?.success]);

  useEffect(() => {
    const saved = profile?.phone_number?.trim();
    if (!result?.success || !saved) return;
    setPhone((prev) => prev.trim() || saved);
  }, [result?.success, profile?.phone_number]);

  const userLocation = coords;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setReserved(false);
    setVoiceCalls(null);
    setReserveError(null);
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/intake"), {
        method: "POST",
        headers: jsonHeaders(session),
        body: JSON.stringify({ raw_text: rawText, lat: coords.lat, lng: coords.lng }),
      });
      const data = (await res.json()) as IntakeSuccess & { error?: string; details?: string };
      if (!res.ok) {
        const msg = data.error ?? "Request failed";
        const detail = data.details ? ` — ${data.details}` : "";
        setError(`${msg}${detail}`);
        return;
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function onReserve() {
    const rid = result?.bestMatch?.resourceId;
    if (!rid || !session?.access_token) {
      setReserveError("Sign in as a seeker to reserve a Supabase listing.");
      return;
    }
    if (!phone.trim()) {
      setReserveError("Enter a phone number for confirmation.");
      return;
    }
    if (!looksLikeE164(phone)) {
      setReserveError(
        "Use international format with + and country code (e.g. +15551234567). Must be your real phone, not your Twilio caller ID."
      );
      return;
    }
    setReserveLoading(true);
    setReserveError(null);
    try {
      const res = await fetch(apiUrl("/api/reservations"), {
        method: "POST",
        headers: jsonHeaders(session),
        body: JSON.stringify({
          resource_id: rid,
          phone_number: phone.trim(),
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        message?: string;
        reservation?: { id: string; resource_id: string; status: string; created_at?: string };
        voiceCalls?: {
          seeker: {
            attempted: boolean;
            success: boolean;
            provider: string;
            message: string;
            simulated?: boolean;
          };
          provider: {
            attempted: boolean;
            success: boolean;
            provider: string;
            message: string;
            simulated?: boolean;
          };
        };
      };
      if (!res.ok) {
        const msg =
          (typeof data.message === "string" && data.message.trim() && data.message) ||
          (typeof data.error === "string" && data.error.trim() && data.error) ||
          "Reservation failed";
        setReserveError(msg);
        return;
      }
      if (!data.success || !data.reservation) {
        setReserveError("Reservation could not be completed. Please try again.");
        return;
      }
      setReserved(true);
      setVoiceCalls(data.voiceCalls ?? null);
    } catch (err) {
      setReserveError(err instanceof Error ? err.message : "Network error");
    } finally {
      setReserveLoading(false);
    }
  }

  const cls = result?.classification;
  const bm = result?.bestMatch;
  const hasMap =
    bm && bm.location && Number.isFinite(bm.location.lat) && Number.isFinite(bm.location.lng);

  const mapsUrl =
    bm?.location != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${bm.location.lat},${bm.location.lng}`
      : null;

  const locationDot =
    locationStatus === "granted"
      ? "bg-emerald-400"
      : locationStatus === "fallback"
        ? "bg-amber-400"
        : "bg-slate-300 animate-pulse";

  const priceLine =
    bm?.discountedPrice != null && bm.discountedPrice !== undefined
      ? bm.originalPrice != null && bm.originalPrice > (bm.discountedPrice ?? 0)
        ? `$${Number(bm.discountedPrice).toFixed(2)} (was $${Number(bm.originalPrice).toFixed(2)})`
        : `$${Number(bm.discountedPrice).toFixed(2)}`
      : null;

  return (
    <PageShell className="max-w-4xl min-w-0">
      <PageHeader
        eyebrow="Seeker"
        title="Request food"
        subtitle="Describe your situation or preferences — we match urgency, distance, and surplus listings."
      />

      {profileError && (
        <div className={ui.sectionGap}>
          <StatusCard tone="danger">
            <p className="font-medium">Profile could not be loaded</p>
            <p className="mt-2 text-sm break-words">{profileError}</p>
            <button
              type="button"
              onClick={() => void refreshProfile()}
              className={cn(ui.secondaryButton, "mt-3 w-full min-h-11 sm:w-auto sm:min-h-0")}
            >
              Try again
            </button>
          </StatusCard>
        </div>
      )}

      <SectionCard className={ui.sectionGap}>
        <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 sm:mb-5 sm:items-center sm:py-2.5 sm:px-3.5">
          <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full sm:mt-0 ${locationDot}`} />
          <span className="min-w-0 text-xs leading-relaxed text-slate-600">
            {locationStatus === "pending" && "Detecting your location…"}
            {locationStatus === "granted" && "Using your GPS location"}
            {locationStatus === "fallback" && "Using default city location"}
          </span>
        </div>

        <p className="text-xs font-medium text-slate-500 sm:text-sm">Try an example</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5 sm:mt-2 sm:gap-2">
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setRawText(p)}
              className="max-w-full min-w-0 basis-full rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left text-xs leading-snug text-slate-700 shadow-sm transition hover:bg-slate-50 sm:basis-auto sm:py-2 sm:text-sm"
            >
              <span className="block break-words">{p}</span>
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-4 space-y-3 sm:mt-5 sm:space-y-5">
          <div className="min-w-0">
            <label className={ui.fieldLabel}>What do you need?</label>
            <p className="mt-0.5 text-xs text-slate-400 sm:text-sm">A short sentence is enough.</p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={5}
              className={cn(ui.textarea, "mt-2 min-h-[6.5rem] w-full resize-y sm:min-h-[8rem]")}
              placeholder='e.g. "I have not eaten today"'
              required
            />
          </div>
          <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="submit"
              disabled={loading}
              className={cn(
                ui.primaryButton,
                "min-h-11 w-full justify-center py-2.5 text-[0.9375rem] sm:w-auto sm:min-w-[12rem] sm:py-2.5 sm:text-sm"
              )}
            >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Finding food nearby…
              </span>
            ) : (
              "Find food nearby"
            )}
            </button>
          </div>
        </form>
      </SectionCard>

      {error && (
        <div className="mt-4 sm:mt-5">
          <StatusCard tone="danger">{error}</StatusCard>
        </div>
      )}

      {result?.success && !loading && (
        <div
          ref={resultsRef}
          className={cn(ui.sectionGap, "scroll-mt-16 space-y-3 sm:scroll-mt-24 sm:space-y-5")}
        >
          <SectionCard
            className={
              bm
                ? "border-l-4 border-l-emerald-500"
                : "border-l-4 border-l-amber-400 bg-amber-50/30"
            }
          >
            <p
              className={
                "text-[0.65rem] font-semibold uppercase tracking-wide sm:text-xs " +
                (bm ? "text-emerald-600" : "text-amber-800")
              }
            >
              {bm ? "Here’s your match" : "Need recorded"}
            </p>
            <p className="mt-2 break-words text-base font-semibold leading-snug text-slate-900 sm:text-lg md:text-xl">
              {result.message ?? "We received your request."}
            </p>
            {result.summary ? (
              <p className="mt-1.5 break-words text-sm leading-relaxed text-slate-500 sm:mt-2">
                {result.summary}
              </p>
            ) : null}
          </SectionCard>

          {bm ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:gap-5 lg:grid-cols-2 lg:items-start">
                <SectionCard className="min-w-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <p className="min-w-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Best nearby match
                  </p>
                  <Pill className="w-fit max-w-full shrink-0 self-start sm:self-center">
                    {Number(bm.distanceKm).toFixed(2)} km away
                  </Pill>
                </div>
                <p className="mt-3 break-words text-base font-bold leading-snug text-slate-900 sm:mt-3 sm:text-lg">
                  {bm.title}
                </p>
                <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50 px-3 sm:mt-4 sm:px-4">
                  {priceLine && <DataRow label="Price" value={priceLine} />}
                  <DataRow label="Quantity available" value={bm.quantity || "—"} />
                  <DataRow label="Expires" value={formatExpires(bm.expiresAt)} />
                  {bm.type && (
                    <DataRow
                      label="Type"
                      value={<span className="capitalize">{bm.type.replace(/_/g, " ")}</span>}
                    />
                  )}
                  {bm.source && (
                    <DataRow label="Source" value={<span className="capitalize">{bm.source}</span>} />
                  )}
                </div>

                {bm.resourceId && (
                  <div className="mt-3 space-y-2.5 rounded-xl border border-slate-200 bg-white p-3 sm:mt-4 sm:space-y-3 sm:p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reserve pickup
                    </p>
                    <label className={ui.fieldLabel}>
                      Phone for confirmation call
                      <input
                        type="tel"
                        autoComplete="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={ui.input}
                        placeholder="+15551234567"
                        disabled={reserved}
                      />
                      <span className="mt-1.5 block text-xs font-normal leading-relaxed text-slate-500">
                        Enter your mobile in E.164 (+country code, e.g. +15551234567). Twilio trial accounts can
                        only ring verified numbers. Do not use your Twilio caller ID here — it must be a
                        different phone.
                        {profile?.phone_number?.trim()
                          ? " We prefilled from your profile when this was empty; you can change it."
                          : null}
                      </span>
                    </label>
                    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch sm:gap-2">
                      <button
                        type="button"
                        disabled={reserved || reserveLoading || !session}
                        onClick={() => void onReserve()}
                        className={cn(
                          ui.primaryButton,
                          "order-1 min-h-11 w-full shrink-0 justify-center disabled:opacity-50 sm:order-none sm:w-auto sm:min-w-[9rem] sm:min-h-0"
                        )}
                      >
                        {reserved ? "Reserved" : reserveLoading ? "Reserving..." : "Reserve"}
                      </button>
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(
                            ui.secondaryButton,
                            "order-2 min-h-11 w-full shrink-0 justify-center sm:order-none sm:w-auto sm:min-h-0"
                          )}
                        >
                          Open in Maps
                        </a>
                      )}
                    </div>
                    {!session && (
                      <p className="break-words text-xs leading-relaxed text-amber-900">
                        <Link href="/signin" className="font-semibold underline">
                          Sign in
                        </Link>{" "}
                        as a seeker to reserve this pickup.
                      </p>
                    )}
                    {reserveError && (
                      <p className="break-words text-sm leading-relaxed text-red-600">{reserveError}</p>
                    )}
                    {reserved && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm leading-relaxed text-emerald-950">
                        Food reserved successfully.
                      </div>
                    )}
                    {reserved && voiceCalls && (
                      <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:px-4 sm:py-3">
                        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
                          Phone confirmation
                        </p>
                        <ul className="mt-2 space-y-2 text-sm text-slate-900">
                          <li className="flex gap-2">
                            <span className="shrink-0 text-emerald-700" aria-hidden>
                              {voiceCalls.seeker.success ? "✓" : voiceCalls.seeker.attempted ? "!" : "—"}
                            </span>
                            <span className="min-w-0 break-words">
                              {voiceCalls.seeker.success
                                ? "Customer confirmation call sent"
                                : voiceCalls.seeker.attempted
                                  ? `Customer call: ${voiceCalls.seeker.message}`
                                  : "Customer confirmation call was not placed"}
                            </span>
                          </li>
                          <li className="flex gap-2">
                            <span className="shrink-0 text-emerald-700" aria-hidden>
                              {voiceCalls.provider.success ? "✓" : voiceCalls.provider.attempted ? "!" : "—"}
                            </span>
                            <span className="min-w-0 break-words">
                              {voiceCalls.provider.success
                                ? "Provider alert call sent"
                                : voiceCalls.provider.attempted
                                  ? `Provider call: ${voiceCalls.provider.message}`
                                  : "Provider alert was not sent"}
                            </span>
                          </li>
                        </ul>
                        {(voiceCalls.seeker.simulated || voiceCalls.provider.simulated) && (
                          <p className="mt-2 text-xs font-medium text-emerald-900/85">
                            Demo voice confirmation completed (simulated calls).
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!bm.resourceId && mapsUrl && (
                  <div className="mt-4">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(ui.secondaryButton, "inline-flex min-h-11 w-full justify-center sm:w-auto")}
                    >
                      Open in Maps
                    </a>
                  </div>
                )}
              </SectionCard>

                {hasMap && bm.location && (
                  <SectionCard className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</p>
                    <p className="mt-1 break-words text-sm leading-relaxed text-slate-500">
                      <span className="inline">
                        <span className="font-semibold text-slate-800">A</span> — you ·{" "}
                        <span className="font-semibold text-slate-800">B</span> —{" "}
                      </span>
                      <span className="mt-0.5 block min-w-0 break-words sm:mt-0 sm:inline">
                        {bm.title}
                      </span>
                    </p>
                    <div className="mt-3 min-w-0 overflow-hidden rounded-xl border border-slate-200 sm:mt-4">
                      <MatchMap
                        userLocation={userLocation}
                        matchLocation={bm.location}
                        matchTitle={bm.title}
                      />
                    </div>
                  </SectionCard>
                )}
              </div>
            </>
          ) : (
            <StatusCard tone="warning">
              No nearby food resources found right now. Your need has been recorded.
            </StatusCard>
          )}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 shadow-[0_2px_12px_rgba(15,23,42,0.04)] sm:px-5 sm:py-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 sm:mb-3">
              AI classification
            </p>
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              <div className="min-w-0 rounded-lg border border-slate-200/80 bg-white/60 px-2.5 py-1.5 sm:border-0 sm:bg-transparent sm:p-0">
                <span className="block text-xs font-medium text-slate-400 sm:inline sm:font-normal">
                  Type{" "}
                </span>
                <span className="font-medium capitalize text-slate-700">{cls?.need_type ?? "—"}</span>
              </div>
              <div className="min-w-0 rounded-lg border border-slate-200/80 bg-white/60 px-2.5 py-1.5 sm:border-0 sm:bg-transparent sm:p-0">
                <span className="block text-xs font-medium text-slate-400 sm:inline sm:font-normal">
                  Urgency{" "}
                </span>
                <span className="font-medium capitalize text-slate-700">{cls?.urgency ?? "—"}</span>
              </div>
              <div className="min-w-0 rounded-lg border border-slate-200/80 bg-white/60 px-2.5 py-1.5 sm:border-0 sm:bg-transparent sm:p-0">
                <span className="block text-xs font-medium text-slate-400 sm:inline sm:font-normal">
                  Confidence{" "}
                </span>
                <span className="font-medium text-slate-700">{formatConfidence(cls?.confidence)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function RequestFoodPageGate() {
  const { loading, profileLoading, session, demoMode, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!demoMode && !session?.user) {
      router.replace("/signin");
    }
  }, [loading, demoMode, session?.user, router]);

  useEffect(() => {
    if (loading || profileLoading) return;
    if (profile?.role === "provider") {
      router.replace("/dashboard");
    }
  }, [loading, profileLoading, profile?.role, router]);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12 text-sm text-slate-600">Loading...</div>
    );
  }

  if (!demoMode && !session?.user) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12 text-sm text-slate-600">Redirecting…</div>
    );
  }

  return <RequestFoodContent />;
}

export default function RequestFoodPage() {
  return <RequestFoodPageGate />;
}
