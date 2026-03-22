"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiUrl, jsonHeaders } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, PageShell, SectionCard, StatusCard, ui } from "@/components/ui/app-ui";

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
    <div className="flex h-[320px] items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
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

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
      {children}
    </span>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <span className="shrink-0 text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

function RequestFoodContent() {
  const { session, profileError, refreshProfile } = useAuth();
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
  const [voiceAudioBase64, setVoiceAudioBase64] = useState<string | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
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
    voiceAudioRef.current?.pause();
    voiceAudioRef.current = null;
    if (!voiceAudioBase64) return;
    const el = new Audio(`data:audio/mp3;base64,${voiceAudioBase64}`);
    voiceAudioRef.current = el;
    void el.play().catch(() => {
      /* autoplay often blocked; user can tap Play voice */
    });
    return () => {
      el.pause();
      voiceAudioRef.current = null;
    };
  }, [voiceAudioBase64]);

  const userLocation = coords;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setReserved(false);
    setVoiceAudioBase64(null);
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
        voice?: { audioBase64?: string };
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
      const b64 =
        typeof data.voice?.audioBase64 === "string" && data.voice.audioBase64.trim()
          ? data.voice.audioBase64.trim()
          : null;
      setVoiceAudioBase64(b64);
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
    <PageShell>
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
              className={ui.secondaryButton + " mt-3"}
            >
              Try again
            </button>
          </StatusCard>
        </div>
      )}

      <SectionCard className={ui.sectionGap}>
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${locationDot}`} />
          <span className="text-xs text-slate-600">
            {locationStatus === "pending" && "Detecting your location…"}
            {locationStatus === "granted" && "Using your GPS location"}
            {locationStatus === "fallback" && "Using default city location"}
          </span>
        </div>

        <p className="text-xs font-medium text-slate-500">Try an example</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setRawText(p)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
            >
              {p}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          <div>
            <label className={ui.fieldLabel}>What do you need?</label>
            <p className="mt-0.5 text-xs text-slate-400">A short sentence is enough.</p>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={5}
              className={ui.textarea + " mt-2"}
              placeholder='e.g. "I have not eaten today"'
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={ui.primaryButton + " w-full justify-center py-3 text-base"}
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
        </form>
      </SectionCard>

      {error && (
        <div className="mt-5">
          <StatusCard tone="danger">{error}</StatusCard>
        </div>
      )}

      {result?.success && !loading && (
        <div ref={resultsRef} className={ui.sectionGap + " scroll-mt-24 space-y-5"}>
          <SectionCard
            className={
              bm
                ? "border-l-4 border-l-emerald-500"
                : "border-l-4 border-l-amber-400 bg-amber-50/30"
            }
          >
            <p
              className={
                "text-xs font-semibold uppercase tracking-wide " +
                (bm ? "text-emerald-600" : "text-amber-800")
              }
            >
              {bm ? "Here’s your match" : "Need recorded"}
            </p>
            <p className="mt-2 text-xl font-semibold leading-snug text-slate-900">
              {result.message ?? "We received your request."}
            </p>
            <p className="mt-2 text-sm text-slate-500">{result.summary}</p>
          </SectionCard>

          {bm ? (
            <>
              <SectionCard>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Best nearby match
                  </p>
                  <Pill>{Number(bm.distanceKm).toFixed(2)} km away</Pill>
                </div>
                <p className="mt-3 text-lg font-bold text-slate-900">{bm.title}</p>
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 divide-y divide-slate-100">
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
                  <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Reserve pickup
                    </p>
                    <label className={ui.fieldLabel}>
                      Phone
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={ui.input}
                        placeholder="+1…"
                        disabled={reserved}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={reserved || reserveLoading || !session}
                        onClick={() => void onReserve()}
                        className={ui.primaryButton + " disabled:opacity-50"}
                      >
                        {reserved ? "Reserved" : reserveLoading ? "Reserving..." : "Reserve"}
                      </button>
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={ui.secondaryButton}
                        >
                          Open in Maps
                        </a>
                      )}
                    </div>
                    {!session && (
                      <p className="text-xs text-amber-900">
                        <Link href="/signin" className="font-semibold underline">
                          Sign in
                        </Link>{" "}
                        as a seeker to reserve this pickup.
                      </p>
                    )}
                    {reserveError && <p className="text-sm text-red-600">{reserveError}</p>}
                    {reserved && (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
                        Food reserved successfully.
                      </div>
                    )}
                    {reserved && (
                      <div
                        className={
                          voiceAudioBase64
                            ? "rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                            : "rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                        }
                      >
                        <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-slate-500">
                          Voice confirmation
                        </p>
                        {voiceAudioBase64 ? (
                          <>
                            <p className="mt-1.5 text-sm font-semibold leading-snug text-slate-900">
                              Voice confirmation ready
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-emerald-900/80">
                              Tap play to hear your pickup confirmation. We also try to start audio automatically
                              when your browser allows it.
                            </p>
                            <button
                              type="button"
                              className={ui.secondaryButton + " mt-3"}
                              onClick={() => {
                                const el = voiceAudioRef.current;
                                if (!el) return;
                                el.currentTime = 0;
                                void el.play();
                              }}
                            >
                              Play voice
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="mt-1.5 text-sm font-semibold leading-snug text-slate-900">
                              Voice unavailable, but reservation confirmed
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
                              We couldn&apos;t generate audio right now (check your ElevenLabs API key). Your pickup
                              is still saved.
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!bm.resourceId && mapsUrl && (
                  <div className="mt-4">
                    <a href={mapsUrl} target="_blank" rel="noreferrer" className={ui.secondaryButton}>
                      Open in Maps
                    </a>
                  </div>
                )}
              </SectionCard>

              {hasMap && bm.location && (
                <SectionCard>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</p>
                  <p className="mt-1 text-sm text-slate-500">
                    <span className="font-semibold text-slate-800">A</span> — you ·{" "}
                    <span className="font-semibold text-slate-800">B</span> — {bm.title}
                  </p>
                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                    <MatchMap
                      userLocation={userLocation}
                      matchLocation={bm.location}
                      matchTitle={bm.title}
                    />
                  </div>
                </SectionCard>
              )}
            </>
          ) : (
            <StatusCard tone="warning">
              No nearby food resources found right now. Your need has been recorded.
            </StatusCard>
          )}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              AI classification
            </p>
            <div className="flex flex-wrap gap-3 text-sm">
              <div>
                <span className="text-slate-400">Type </span>
                <span className="font-medium capitalize text-slate-700">{cls?.need_type ?? "—"}</span>
              </div>
              <span className="text-slate-300">·</span>
              <div>
                <span className="text-slate-400">Urgency </span>
                <span className="font-medium capitalize text-slate-700">{cls?.urgency ?? "—"}</span>
              </div>
              <span className="text-slate-300">·</span>
              <div>
                <span className="text-slate-400">Confidence </span>
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
