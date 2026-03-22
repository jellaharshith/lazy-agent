"use client";

import Link from "next/link";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { PageHeader, PageShell, SectionCard, ui } from "@/components/ui/app-ui";

function ProviderHomeContent() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Provider"
        title="Provider workspace"
        subtitle="List surplus food with clear pricing and pickup details — seekers use the same card styling on the request flow."
      />

      <section className={ui.sectionGap + " grid gap-4 sm:grid-cols-2"}>
        <SectionCard>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary action</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Add surplus listing</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Set title, category, quantity, prices, expiry, and pickup coordinates in one form.
          </p>
          <Link href="/add-resource" className={ui.primaryButton + " mt-5 w-full justify-center sm:w-auto"}>
            Add resource
          </Link>
        </SectionCard>

        <SectionCard>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inventory</p>
          <h2 className="mt-2 text-lg font-semibold text-slate-900">Review your listings</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            See quantity, prices, expiry, and status in a compact card layout.
          </p>
          <Link href="/provider/resources" className={ui.secondaryButton + " mt-5 w-full justify-center sm:w-auto"}>
            My resources
          </Link>
        </SectionCard>
      </section>
    </PageShell>
  );
}

export default function ProviderDashboardPage() {
  return (
    <RoleGuard allowedRoles={["provider"]}>
      <ProviderHomeContent />
    </RoleGuard>
  );
}
