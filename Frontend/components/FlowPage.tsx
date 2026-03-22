"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useRole } from "@/hooks/useRole";
import { PageHeader, PageShell, SectionCard, ui } from "@/components/ui/app-ui";

const MatchMap = dynamic(() => import("@/components/MatchMap"), {
  ssr: false,
});

const DEMO_USER_LOCATION = { lat: 37.7749, lng: -122.4194 };

type NeedAnalysis = {
  needType: string;
  urgency: "Low" | "Medium" | "High";
  confidence: number;
};

type MatchResult = {
  title: string;
  distance: string;
  timeLeft: string;
  message: string;
  location: { lat: number; lng: number };
};

export default function FlowPage() {
  const { isSeeker, isProvider } = useRole();

  const [mode, setMode] = useState<"landing" | "need" | "resource" | "match">(
    "landing"
  );
  const [needText, setNeedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<NeedAnalysis | null>(null);

  const bestMatch = useMemo<MatchResult | null>(() => {
    if (!analysis) return null;

    if (analysis.needType === "Food") {
      return {
        title: "Prepared Meal Pack",
        distance: "0.8 miles",
        timeLeft: "2 hrs left",
        message: "We found a meal available nearby.",
        location: { lat: 37.7812, lng: -122.4134 },
      };
    }

    if (analysis.needType === "Shelter") {
      return {
        title: "Emergency Bed Slot",
        distance: "1.4 miles",
        timeLeft: "Available tonight",
        message: "A nearby shelter has space available.",
        location: { lat: 37.7695, lng: -122.4312 },
      };
    }

    return {
      title: "Community Support Resource",
      distance: "1.1 miles",
      timeLeft: "Open now",
      message: "We found nearby support that may help.",
      location: { lat: 37.788, lng: -122.407 },
    };
  }, [analysis]);

  async function handleFindSupport() {
    if (!needText.trim()) return;

    setLoading(true);

    await new Promise((resolve) => setTimeout(resolve, 900));

    const lower = needText.toLowerCase();

    let nextAnalysis: NeedAnalysis = {
      needType: "General Support",
      urgency: "Medium",
      confidence: 84,
    };

    if (
      lower.includes("food") ||
      lower.includes("hungry") ||
      lower.includes("meal")
    ) {
      nextAnalysis = {
        needType: "Food",
        urgency: "High",
        confidence: 94,
      };
    } else if (
      lower.includes("sleep") ||
      lower.includes("shelter") ||
      lower.includes("bed")
    ) {
      nextAnalysis = {
        needType: "Shelter",
        urgency: "High",
        confidence: 89,
      };
    } else if (
      lower.includes("job") ||
      lower.includes("work") ||
      lower.includes("employment")
    ) {
      nextAnalysis = {
        needType: "Employment",
        urgency: "Medium",
        confidence: 81,
      };
    }

    setAnalysis(nextAnalysis);
    setLoading(false);
  }

  function goToMatch() {
    if (analysis) setMode("match");
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Legacy showcase"
        title="Interactive demo flow"
        subtitle="A full concept walkthrough for seeker and provider actions in one screen."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setMode("landing")}
              className={ui.secondaryButton}
            >
              Home
            </button>
            {isSeeker && (
              <button
                onClick={() => setMode("need")}
                className={ui.secondaryButton}
              >
                Need Support
              </button>
            )}
            {isProvider && (
              <button
                onClick={() => setMode("resource")}
                className={ui.secondaryButton}
              >
                Add Resource
              </button>
            )}
          </div>
        }
      />

        {mode === "landing" && (
          <SectionCard className="mt-8 rounded-3xl p-10">
            <div className="max-w-3xl">
              <p className="mb-3 inline-block rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700">
                AI-powered local matching
              </p>
              <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                AI connects hidden needs to nearby unused resources.
              </h2>
              <p className="mt-4 max-w-2xl text-lg text-slate-600">
                One smooth flow: describe a need, understand the AI result,
                match to something nearby, and see the outcome instantly.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                {isSeeker && (
                  <button
                    onClick={() => setMode("need")}
                    className={ui.primaryButton}
                  >
                    I need support
                  </button>
                )}
                {isProvider && (
                  <button
                    onClick={() => setMode("resource")}
                    className={ui.secondaryButton}
                  >
                    I have extra resources
                  </button>
                )}
              </div>
            </div>
          </SectionCard>
        )}

        {mode === "need" && isSeeker && (
          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <SectionCard className="rounded-3xl">
              <h2 className="text-2xl font-bold">Tell us what is going on</h2>
              <p className="mt-2 text-sm text-slate-600">
                Keep it simple. A short sentence is enough.
              </p>

              <textarea
                value={needText}
                onChange={(e) => setNeedText(e.target.value)}
                placeholder="Example: I need food tonight and I do not have transportation."
                className={ui.textarea + " mt-5 min-h-[180px] p-4"}
              />

              <button
                onClick={handleFindSupport}
                disabled={loading || !needText.trim()}
                className={ui.primaryButton + " mt-4 w-full"}
              >
                {loading ? "Analyzing..." : "Find support"}
              </button>
            </SectionCard>

            <SectionCard className="rounded-3xl">
              <h3 className="text-xl font-bold">AI Result</h3>
              {!analysis ? (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                  Your AI result will appear here with need type, urgency, and
                  confidence.
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Need type</span>
                    <span className="font-semibold">{analysis.needType}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-slate-500">Urgency</span>
                    <UrgencyBadge urgency={analysis.urgency} />
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm text-slate-500">Confidence</span>
                    <span className="font-semibold">{analysis.confidence}%</span>
                  </div>

                  <button
                    onClick={goToMatch}
                    className={ui.primaryButton + " mt-5 w-full"}
                  >
                    View match
                  </button>
                </div>
              )}
            </SectionCard>
          </section>
        )}

        {mode === "need" && !isSeeker && (
          <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
            The need request flow is for <strong>seekers</strong>. Use the header{" "}
            <strong>Seeker</strong> / <strong>Provider</strong> toggle to switch roles.
          </section>
        )}

        {mode === "resource" && isProvider && (
          <SectionCard className="mt-8 rounded-3xl">
            <h2 className="text-2xl font-bold">Add surplus food or support</h2>
            <p className="mt-2 text-sm text-slate-600">
              Keep this simple for demo day.
            </p>

            <form className="mt-6 grid gap-4 md:grid-cols-2">
              <input
                className={ui.input + " mt-0"}
                placeholder="Resource title"
              />
              <input
                className={ui.input + " mt-0"}
                placeholder="Quantity"
              />
              <input
                className={ui.input + " mt-0"}
                placeholder="Expiry time"
              />
              <input
                className={ui.input + " mt-0"}
                placeholder="Address or coordinates"
              />
              <button
                type="button"
                className={ui.primaryButton + " md:col-span-2"}
              >
                Save resource
              </button>
            </form>
          </SectionCard>
        )}

        {mode === "resource" && !isProvider && (
          <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950">
            Adding resources is for <strong>providers</strong>. Use the header{" "}
            <strong>Seeker</strong> / <strong>Provider</strong> toggle to switch roles.
          </section>
        )}

        {mode === "match" && bestMatch && analysis && isSeeker && (
          <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-6">
              <SectionCard className="rounded-3xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Best match</p>
                    <h2 className="mt-1 text-2xl font-bold">{bestMatch.title}</h2>
                  </div>
                  <UrgencyBadge urgency={analysis.urgency} />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <InfoTile label="Distance" value={bestMatch.distance} />
                  <InfoTile label="Time left" value={bestMatch.timeLeft} />
                </div>

                <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-slate-700">
                  {bestMatch.message}
                </p>

                <div className="mt-5 flex gap-3">
                  <button className={ui.primaryButton}>
                    Reserve
                  </button>
                  <button className={ui.secondaryButton}>
                    Play voice
                  </button>
                </div>
              </SectionCard>
            </div>

            <SectionCard className="rounded-3xl">
              <h3 className="text-xl font-bold">Nearby map</h3>
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <MatchMap
                  userLocation={DEMO_USER_LOCATION}
                  matchLocation={bestMatch.location}
                  matchTitle={bestMatch.title}
                />
              </div>
            </SectionCard>
          </section>
        )}
    </PageShell>
  );
}

function UrgencyBadge({
  urgency,
}: {
  urgency: "Low" | "Medium" | "High";
}) {
  const styles = {
    Low: "bg-green-100 text-green-700",
    Medium: "bg-yellow-100 text-yellow-700",
    High: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[urgency]}`}
    >
      {urgency}
    </span>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}
