"use client";

import { useMemo, useState } from "react";

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
};

export default function HomePage() {
  const [mode, setMode] = useState<"landing" | "need" | "resource" | "match">(
    "landing"
  );
  const [needText, setNeedText] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<NeedAnalysis | null>(null);

  const match = useMemo<MatchResult | null>(() => {
    if (!analysis) return null;

    if (analysis.needType === "Food") {
      return {
        title: "Prepared Meal Pack",
        distance: "0.8 miles",
        timeLeft: "2 hrs left",
        message: "We found a meal available nearby.",
      };
    }

    if (analysis.needType === "Shelter") {
      return {
        title: "Emergency Bed Slot",
        distance: "1.4 miles",
        timeLeft: "Available tonight",
        message: "A nearby shelter has space available.",
      };
    }

    return {
      title: "Community Support Resource",
      distance: "1.1 miles",
      timeLeft: "Open now",
      message: "We found nearby support that may help.",
    };
  }, [analysis]);

  async function handleFindSupport() {
    if (!needText.trim()) return;

    setLoading(true);

    // Mock AI analysis for hackathon/demo use
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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Intent Commons</h1>
          <nav className="flex gap-3">
            <button
              onClick={() => setMode("landing")}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
            >
              Home
            </button>
            <button
              onClick={() => setMode("need")}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
            >
              Need Support
            </button>
            <button
              onClick={() => setMode("resource")}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100"
            >
              Add Resource
            </button>
          </nav>
        </header>

        {mode === "landing" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
            <div className="max-w-3xl">
              <p className="mb-3 inline-block rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
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
                <button
                  onClick={() => setMode("need")}
                  className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
                >
                  I need support
                </button>
                <button
                  onClick={() => setMode("resource")}
                  className="rounded-2xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
                >
                  I have extra resources
                </button>
              </div>
            </div>
          </section>
        )}

        {mode === "need" && (
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-bold">Tell us what is going on</h2>
              <p className="mt-2 text-sm text-slate-600">
                Keep it simple. A short sentence is enough.
              </p>

              <textarea
                value={needText}
                onChange={(e) => setNeedText(e.target.value)}
                placeholder="Example: I need food tonight and I do not have transportation."
                className="mt-5 min-h-[180px] w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-slate-500"
              />

              <button
                onClick={handleFindSupport}
                disabled={loading || !needText.trim()}
                className="mt-4 w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Analyzing..." : "Find support"}
              </button>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
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
                    className="mt-5 w-full rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
                  >
                    View match
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {mode === "resource" && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-bold">Add surplus food or support</h2>
            <p className="mt-2 text-sm text-slate-600">
              Keep this simple for demo day.
            </p>

            <form className="mt-6 grid gap-4 md:grid-cols-2">
              <input
                className="rounded-2xl border border-slate-300 p-3 text-sm"
                placeholder="Resource title"
              />
              <input
                className="rounded-2xl border border-slate-300 p-3 text-sm"
                placeholder="Quantity"
              />
              <input
                className="rounded-2xl border border-slate-300 p-3 text-sm"
                placeholder="Expiry time"
              />
              <input
                className="rounded-2xl border border-slate-300 p-3 text-sm"
                placeholder="Address or coordinates"
              />
              <button
                type="button"
                className="md:col-span-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
              >
                Save resource
              </button>
            </form>
          </section>
        )}

        {mode === "match" && match && analysis && (
          <section className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-slate-500">Best match</p>
                    <h2 className="mt-1 text-2xl font-bold">{match.title}</h2>
                  </div>
                  <UrgencyBadge urgency={analysis.urgency} />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <InfoTile label="Distance" value={match.distance} />
                  <InfoTile label="Time left" value={match.timeLeft} />
                </div>

                <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-slate-700">
                  {match.message}
                </p>

                <div className="mt-5 flex gap-3">
                  <button className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">
                    Reserve
                  </button>
                  <button className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900">
                    Play voice
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-bold">Nearby map</h3>
              <div className="mt-4 flex h-[360px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500">
                Map placeholder
                <br />
                Replace this box with Google Maps markers for the user and
                matched resource.
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
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