"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { DashboardQuickActionCard } from "@/components/dashboard/DashboardQuickActionCard";
import { PageHeader, PageShell, SectionCard, ui } from "@/components/ui/app-ui";
import { cn } from "@/lib/utils";

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
        eyebrow="Home"
        title="Dashboard"
        subtitle="Your hub for requesting food, viewing matches, or managing surplus listings."
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
